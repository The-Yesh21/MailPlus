import urllib
import asyncio
import traceback
import json
import requests
import os
import base64
import re
from functools import partial
import html
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import FastAPI, Request, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from dotenv import load_dotenv
from jose import jwt, JWTError
import httpx
from groq import Groq
import firebase_admin
from firebase_admin import credentials as fb_credentials, firestore as fb_firestore

load_dotenv()

# ── Firebase / Firestore ────────────────────────────────────────────────────
_firebase_cred_path = os.getenv("FIREBASE_CREDENTIALS", "./serviceAccountKey.json")
if not firebase_admin._apps:
    _cred = fb_credentials.Certificate(_firebase_cred_path)
    firebase_admin.initialize_app(_cred)
fs = fb_firestore.client()

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI()

GOOGLE_CLIENT_ID     = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI         = os.getenv("REDIRECT_URI")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:5173")
SECRET_KEY           = os.getenv("SECRET_KEY", "fallback-secret-key")
GROQ_API_KEY         = os.getenv("GROQ_API_KEY")
HF_TOKEN             = os.getenv("HF_TOKEN")
ALGORITHM            = "HS256"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Firestore helpers ────────────────────────────────────────────────────────

def increment_user_stats(user_email: str, emails_analyzed=0, urgent=0, replies=0, voice=0):
    """Atomically increment per-user counters."""
    try:
        ref = fs.collection("user_stats").document(user_email)
        ref.set({
            "emails_analyzed":      fb_firestore.Increment(emails_analyzed),
            "urgent_emails_caught": fb_firestore.Increment(urgent),
            "replies_drafted":      fb_firestore.Increment(replies),
            "voice_briefings_sent": fb_firestore.Increment(voice),
        }, merge=True)
    except Exception as e:
        print(f"Firestore increment error: {e}")


def get_user_stats(user_email: str) -> dict:
    """Read cumulative stats from Firestore."""
    try:
        doc = fs.collection("user_stats").document(user_email).get()
        if doc.exists:
            return doc.to_dict()
    except Exception as e:
        print(f"Firestore read error: {e}")
    return {"emails_analyzed": 0, "urgent_emails_caught": 0,
            "replies_drafted": 0, "voice_briefings_sent": 0}


def append_activity_feed(user_email: str, new_items: list):
    """Prepend new activity items to Firestore; keep only the last 10."""
    try:
        ref = fs.collection("user_stats").document(user_email)
        doc = ref.get()
        existing = (doc.to_dict() or {}).get("recent_activity", []) if doc.exists else []
        merged = (new_items + existing)[:10]
        ref.set({"recent_activity": merged}, merge=True)
    except Exception as e:
        print(f"Firestore activity write error: {e}")


def save_email_ai_result(user_email: str, email_id: str, result: dict):
    """Persist AI analysis result for a single email."""
    try:
        fs.collection("email_ai")\
          .document(user_email)\
          .collection("results")\
          .document(email_id)\
          .set(result, merge=True)
    except Exception as e:
        print(f"Firestore AI result write error: {e}")


def get_activity_feed(user_email: str) -> list:
    try:
        doc = fs.collection("user_stats").document(user_email).get()
        if doc.exists:
            return (doc.to_dict() or {}).get("recent_activity", [])
    except Exception as e:
        print(f"Firestore activity read error: {e}")
    return []


# ── Auth helpers ─────────────────────────────────────────────────────────────

def create_jwt(data: dict):
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def decode_jwt(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(request: Request):
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    return decode_jwt(auth.split(" ")[1])


# ── Email parsing helpers ────────────────────────────────────────────────────

def parse_email_body(payload, limit=None):
    body_html, body_text = "", ""

    def extract(parts):
        nonlocal body_html, body_text
        for part in parts:
            mime = part.get("mimeType", "")
            if mime == "text/plain":
                data = part["body"].get("data", "")
                if data:
                    try: body_text += base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                    except: pass
            elif mime == "text/html":
                data = part["body"].get("data", "")
                if data:
                    try: body_html += base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                    except: pass
            elif "parts" in part:
                extract(part["parts"])

    if "parts" in payload:
        extract(payload["parts"])
    else:
        mime = payload.get("mimeType", "")
        data = payload.get("body", {}).get("data", "")
        if data:
            try:
                if mime == "text/plain":   body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
                elif mime == "text/html":  body_html = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            except: pass

    body = body_html if body_html else body_text
    clean = re.sub(r"<[^>]+>", "", body)
    clean = html.unescape(clean).strip()
    if limit:
        return clean[:limit]
    return body if body_html else clean


def parse_from(from_header):
    match = re.search(r'(.*)<(.+?)>', from_header)
    if match:
        return match.group(1).strip().strip('"'), match.group(2).strip()
    return from_header.strip(), from_header.strip()


def parse_priority_json(raw: str) -> dict:
    fallback = {"priority": "normal", "reason": "Could not analyze",
                "deadline": None, "requires_reply": False}
    if not raw:
        return fallback
    try:
        clean = re.sub(r'```json\s*', '', raw)
        clean = re.sub(r'```\s*', '', clean).strip()
        m = re.search(r'\{.*\}', clean, re.DOTALL)
        return json.loads(m.group() if m else clean)
    except:
        return fallback


# ── Groq Hybrid Engine ──────────────────────────────────────────────────────

def call_groq(prompt: str, system: str, max_tokens: int = 400) -> str:
    for attempt in range(3):
        try:
            client = Groq(api_key=GROQ_API_KEY)
            comp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "system", "content": system},
                          {"role": "user",   "content": prompt}],
                temperature=0.3,
                max_completion_tokens=max_tokens,
                top_p=1, stream=False, stop=None
            )
            content = comp.choices[0].message.content
            return content.strip() if content else None
        except Exception as e:
            if '429' in str(e):
                import time
                wait = 2 * (attempt + 1)
                time.sleep(wait)
                continue
            print(f"Groq error: {e}")
            return None
    return None

def build_prompt(from_name, subject, body_preview):
    return f"""Analyze this email and respond with ONLY a valid JSON object, no markdown, no explanation:
{{
  "priority": "urgent" or "normal" or "low",
  "reason": "one sentence why",
  "requires_reply": true or false,
  "summary": "exactly 2 sentences about what this email is and what action is needed",
  "draft_reply": "3 sentence professional reply signed as Yeshwanth"
}}

From: {from_name}
Subject: {subject}
Preview: {body_preview[:400]}"""

def analyze_email_hf(from_name, subject, body_preview):
    # Despite the name 'analyze_email_hf' used by other endpoints, we use Groq + Regex here
    raw = call_groq(build_prompt(from_name, subject, body_preview), "You are an email assistant. Reply only with valid JSON.", 400)
    data = parse_priority_json(raw)
    
    # 1. Deterministic Deadline Parsing (Overrides AI Hallucinations)
    text_to_analyze = f"{subject} {body_preview}"
    deadline = None
    deadline_match = re.search(r'within the next (\d+)\s+(hours?|minutes?|days?)', text_to_analyze, re.IGNORECASE)
    if deadline_match:
        deadline = f"within the next {deadline_match.group(1)} {deadline_match.group(2)}"
    elif re.search(r'by tomorrow', text_to_analyze, re.IGNORECASE):
        deadline = "by tomorrow"
        
    priority = data.get("priority", "normal")
    if deadline:
        priority = "urgent" # Force urgent if strict deadline is found

    return {
        "priority": priority,
        "reason": data.get("reason", "Categorized by AI"),
        "deadline": deadline,
        "requires_reply": data.get("requires_reply", False),
        "summary": data.get("summary", "Could not generate summary."),
        "draft_reply": data.get("draft_reply", "Draft generation failed.")
    }

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/auth/login")
def login():
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent"
    }
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return {"auth_url": auth_url}


@app.get("/auth/callback")
async def callback(code: str, state: str = None, scope: str = None,
                   authuser: str = None, prompt: str = None, iss: str = None):
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": REDIRECT_URI,
                    "grant_type": "authorization_code",
                }
            )
            token_data = token_resp.json()
            if "error" in token_data:
                return RedirectResponse(url=f"{FRONTEND_URL}/?error={token_data['error']}")

            access_token = token_data["access_token"]
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            user_info = user_resp.json()

        token = create_jwt({
            "access_token": access_token,
            "email": user_info.get("email", ""),
            "name":  user_info.get("name", ""),
            "picture": user_info.get("picture", "")
        })
        return RedirectResponse(url=f"{FRONTEND_URL}/?token={token}")
    except Exception as e:
        print(f"Callback error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/?error={str(e)}")


@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {"email": user.get("email"), "name": user.get("name"), "picture": user.get("picture")}


# ── Email endpoints ───────────────────────────────────────────────────────────

@app.get("/emails")
async def list_emails(user=Depends(get_current_user),
                      max_results: int = Query(50, alias="maxResults")):
    try:
        access_token = user["access_token"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"labelIds": ["INBOX"], "maxResults": max_results}
            )
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="token_expired")
            messages = resp.json().get("messages", [])

            async def fetch_detail(msg_id):
                try:
                    r = await client.get(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}",
                        headers={"Authorization": f"Bearer {access_token}"},
                        params={"format": "full"}
                    )
                    return r.json()
                except:
                    return None

            details = await asyncio.gather(*[fetch_detail(m["id"]) for m in messages])

        emails = []
        for m in details:
            if not m or "id" not in m:
                continue
            hdrs = m["payload"].get("headers", [])
            subject     = next((h["value"] for h in hdrs if h["name"] == "Subject"), "No Subject")
            from_header = next((h["value"] for h in hdrs if h["name"] == "From"),    "Unknown")
            date_header = next((h["value"] for h in hdrs if h["name"] == "Date"),    "")
            from_name, from_email = parse_from(from_header)
            emails.append({
                "id":            m["id"],
                "threadId":      m["threadId"],
                "subject":       subject,
                "from_name":     from_name,
                "from_email":    from_email,
                "snippet":       m.get("snippet", ""),
                "date":          date_header,
                "internal_date": int(m.get("internalDate", 0)),
                "body_preview":  parse_email_body(m["payload"], limit=300),
                "labels":        m.get("labelIds", []),
                "is_read":       "UNREAD" not in m.get("labelIds", [])
            })

        emails.sort(key=lambda x: x["internal_date"], reverse=True)
        return {"emails": emails, "total": len(emails)}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Emails list error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/emails/{message_id}")
async def get_email(message_id: str, user=Depends(get_current_user)):
    try:
        access_token = user["access_token"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"format": "full"}
            )
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="token_expired")
            m = resp.json()
        hdrs        = m["payload"].get("headers", [])
        subject     = next((h["value"] for h in hdrs if h["name"] == "Subject"), "No Subject")
        from_header = next((h["value"] for h in hdrs if h["name"] == "From"),    "Unknown")
        date_header = next((h["value"] for h in hdrs if h["name"] == "Date"),    "")
        from_name, from_email = parse_from(from_header)
        return {
            "id":        m["id"],
            "threadId":  m["threadId"],
            "subject":   subject,
            "from_name": from_name,
            "from_email":from_email,
            "snippet":   m.get("snippet", ""),
            "date":      date_header,
            "body":      parse_email_body(m["payload"]),
            "labels":    m.get("labelIds", []),
            "is_read":   "UNREAD" not in m.get("labelIds", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get email error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Dashboard stats ───────────────────────────────────────────────────────────

@app.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    try:
        user_email   = user.get("email", "")
        access_token = user["access_token"]

        loop = asyncio.get_event_loop()

        # Run Firestore reads and Gmail API calls in parallel
        stats_future    = loop.run_in_executor(None, get_user_stats, user_email)
        activity_future = loop.run_in_executor(None, get_activity_feed, user_email)

        async with httpx.AsyncClient() as client:
            profile_resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            profile = profile_resp.json()

            unread_resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"q": "is:unread", "maxResults": 1}
            )
            unread_data = unread_resp.json()

        user_stats    = await stats_future
        activity_feed = await activity_future

        return {
            # Firestore-persisted counters
            "emails_analyzed":      user_stats.get("emails_analyzed", 0),
            "urgent_emails_caught": user_stats.get("urgent_emails_caught", 0),
            "replies_drafted":      user_stats.get("replies_drafted", 0),
            "voice_briefings_sent": user_stats.get("voice_briefings_sent", 0),
            # Gmail API
            "total_emails":         profile.get("messagesTotal", 0),
            "unread_emails":        unread_data.get("resultSizeEstimate", 0),
            # Firestore activity feed (built as emails are analyzed)
            "recent_activity_feed": activity_feed,
            # Static / computed
            "estimated_urgent_emails": user_stats.get("urgent_emails_caught", 0),
            "last_scan":            "Just now",
            "member_since":         "May 2026",
            "estimated_response_rate": 84,
            "account_age_estimate": "2.4",
        }

    except Exception as e:
        print(f"Dashboard stats error: {traceback.format_exc()}")
        return {
            "emails_analyzed": 0, "urgent_emails_caught": 0,
            "replies_drafted": 0, "voice_briefings_sent": 0,
            "total_emails": 0, "unread_emails": 0,
            "recent_activity_feed": []
        }


# ── AI endpoints ──────────────────────────────────────────────────────────────

@app.post("/ai/analyze")
async def analyze_email(request: Request, user=Depends(get_current_user)):
    body         = await request.json()
    from_name    = body.get("from_name", "")
    subject      = body.get("subject", "")
    body_preview = body.get("body_preview", "")
    email_id     = body.get("email_id", "")
    user_email   = user.get("email", "")

    loop = asyncio.get_event_loop()
    try:
        data = await loop.run_in_executor(
            None,
            partial(analyze_email_hf, from_name, subject, body_preview)
        )

        is_urgent       = data.get("priority") == "urgent"
        has_valid_draft = False

        result = {
            "email_id":      email_id,
            "priority":      data.get("priority", "normal"),
            "reason":        data.get("reason", ""),
            "deadline":      data.get("deadline"),
            "requires_reply":data.get("requires_reply", False),
            "summary":       data.get("summary", body_preview[:200]),
            "draft_reply":   data.get("draft_reply", "Could not generate draft."),
            "analyzed_at":   datetime.now(timezone.utc).isoformat()   # for live deadline countdown
        }

        # Build activity item for the feed
        icon = "🚨" if is_urgent else ("✅" if data.get("priority") == "low" else "✉️")
        activity_item = {
            "icon":     icon,
            "text":     f"{from_name} — {subject[:40]}",
            "time":     datetime.now(timezone.utc).strftime("%H:%M"),
            "priority": data.get("priority", "normal")
        }

        # Persist to Firestore (non-blocking)
        loop.run_in_executor(None, partial(
            increment_user_stats, user_email, 1,
            1 if is_urgent else 0, 1 if has_valid_draft else 0
        ))
        loop.run_in_executor(None, partial(append_activity_feed, user_email, [activity_item]))
        loop.run_in_executor(None, partial(save_email_ai_result, user_email, email_id, result))

        return result

    except Exception as e:
        print(f"Analyze error for {email_id}: {traceback.format_exc()}")
        return {
            "email_id": email_id, "priority": "normal",
            "reason": "Analysis failed", "deadline": None,
            "requires_reply": False, "summary": body_preview[:200],
            "draft_reply": "AI unavailable — please try again."
        }


@app.post("/ai/analyze-batch")
async def analyze_batch(request: Request, user=Depends(get_current_user)):
    body       = await request.json()
    emails     = body.get("emails", [])[:5]
    user_email = user.get("email", "")
    results    = {}

    total_analyzed = total_urgent = total_replies = 0
    activity_items = []

    for email in emails:
        try:
            email_id     = email.get("id", "")
            from_name    = email.get("from_name", "")
            subject      = email.get("subject", "")
            body_preview = email.get("body_preview", "")

            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None,
                partial(analyze_email_hf, from_name, subject, body_preview)
            )

            is_urgent       = data.get("priority") == "urgent"
            has_valid_draft = False

            result = {
                "priority":      data.get("priority", "normal"),
                "reason":        data.get("reason", ""),
                "deadline":      data.get("deadline"),
                "requires_reply":data.get("requires_reply", False),
                "summary":       data.get("summary", body_preview[:200]),
                "draft_reply":   data.get("draft_reply", "Could not generate draft.")
            }
            results[email_id] = result

            # Accumulate
            total_analyzed += 1
            if is_urgent:    total_urgent  += 1
            if has_valid_draft: total_replies += 1

            icon = "🚨" if is_urgent else ("✅" if data.get("priority") == "low" else "✉️")
            activity_items.append({
                "icon":     icon,
                "text":     f"{from_name} — {subject[:40]}",
                "time":     datetime.now(timezone.utc).strftime("%H:%M"),
                "priority": data.get("priority", "normal")
            })

            # Save individual AI result to Firestore (non-blocking)
            loop.run_in_executor(None, partial(
                save_email_ai_result, user_email, email_id, result
            ))

            await asyncio.sleep(2)

        except Exception as e:
            print(f"Batch error for {email.get('id')}: {traceback.format_exc()}")
            results[email.get("id", "")] = {
                "priority": "normal", "reason": "Analysis failed",
                "deadline": None, "requires_reply": False,
                "summary": None, "draft_reply": None
            }

    # One Firestore write for stats + activity
    if total_analyzed > 0:
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, partial(
            increment_user_stats, user_email, total_analyzed, total_urgent, total_replies
        ))
        loop.run_in_executor(None, partial(append_activity_feed, user_email, activity_items))

    return {"results": results}


if __name__ == "__main__":
    import uvicorn
    print("MailPulse backend running on port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
