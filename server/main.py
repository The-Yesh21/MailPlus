# MailPulse Backend — connects to Gmail API and serves email data
import os
import base64
import re
import html
from datetime import datetime, timedelta
from typing import List, Optional
import urllib.parse
import asyncio
import json
import traceback
import time
from functools import partial
from collections import Counter

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from jose import jwt, JWTError
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import httpx
from groq import Groq

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret-key")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ALGORITHM = "HS256"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid"
]

# Caching for dashboard stats
dashboard_cache = {}

def call_groq(prompt: str, system: str, max_tokens: int = 300) -> str:
    max_retries = 3
    for attempt in range(max_retries):
        try:
            client = Groq(api_key=GROQ_API_KEY)
            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_completion_tokens=max_tokens,
                top_p=1,
                stream=False,
                stop=None
            )
            content = completion.choices[0].message.content
            return content.strip() if content else None
        except Exception as e:
            error_str = str(e)
            if '429' in error_str:
                wait_time = 2 * (attempt + 1)
                print(f"Rate limit hit, waiting {wait_time}s before retry {attempt+1}/{max_retries}")
                time.sleep(wait_time)
                continue
            print(f"Groq error: {e}")
            return None
    return None

def make_flow():
    return Flow.from_client_config(
        client_config={
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI
    )

def create_jwt(data: dict):
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def decode_jwt(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = auth_header.split(" ")[1]
    return decode_jwt(token)

def parse_email_body(payload, limit=None):
    body_html = ""
    body_text = ""

    def extract(parts):
        nonlocal body_html, body_text
        for part in parts:
            mime = part.get("mimeType", "")
            if mime == "text/plain":
                data = part["body"].get("data", "")
                if data:
                    body_text += base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            elif mime == "text/html":
                data = part["body"].get("data", "")
                if data:
                    body_html += base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            elif "parts" in part:
                extract(part["parts"])

    if "parts" in payload:
        extract(payload["parts"])
    else:
        mime = payload.get("mimeType", "")
        data = payload.get("body", {}).get("data", "")
        if data:
            if mime == "text/plain":
                body_text = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            elif mime == "text/html":
                body_html = base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")

    # Prefer HTML, fallback to text
    body = body_html if body_html else body_text
    body = body.strip()
    
    if limit:
        # For preview, we still want to strip HTML to avoid returning broken tags
        preview_text = body_text if body_text else re.sub('<[^<]+?>', '', body_html)
        return preview_text[:limit]
        
    return body

def parse_from(from_header):
    from_name = from_header
    from_email = from_header
    match = re.search(r'(.*)<(.+?)>', from_header)
    if match:
        from_name = match.group(1).strip().strip('"')
        from_email = match.group(2).strip()
    else:
        from_email = from_header.strip()
        from_name = from_header.strip()
    return from_name, from_email

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/dashboard/stats")
async def get_dashboard_stats(user=Depends(get_current_user)):
    user_email = user.get("email")
    now_ts = time.time()
    
    if user_email in dashboard_cache:
        cached_data, timestamp = dashboard_cache[user_email]
        if now_ts - timestamp < 300: # 5 minute cache
            return cached_data

    try:
        creds = Credentials(token=user["access_token"])
        service = build("gmail", "v1", credentials=creds)

        # 1. Get Profile Info
        profile = service.users().getProfile(userId="me").execute()
        total_emails = profile.get("messagesTotal", 0)
        total_threads = profile.get("threadsTotal", 0)

        # 2. Get Label Counts efficiently
        labels_to_fetch = [
            "INBOX", "UNREAD", "STARRED", "IMPORTANT", "SENT", "DRAFT", "SPAM",
            "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"
        ]
        
        counts = {}
        for label_id in labels_to_fetch:
            try:
                l = service.users().labels().get(userId="me", id=label_id).execute()
                counts[label_id] = {
                    "messages": l.get("messagesTotal", 0),
                    "unread": l.get("messagesUnread", 0),
                    "threads": l.get("threadsTotal", 0),
                    "unreadThreads": l.get("threadsUnread", 0)
                }
            except:
                counts[label_id] = {"messages": 0, "unread": 0, "threads": 0, "unreadThreads": 0}

        # 3. Analyze latest 500 emails for detailed stats
        list_results = service.users().messages().list(
            userId="me", 
            maxResults=500,
            q="-label:SPAM -label:TRASH"
        ).execute()
        
        messages_meta = list_results.get("messages", [])
        
        detailed_stats = {
            "senders": Counter(),
            "hourly_dist": Counter(),
            "daily_dist": Counter(),
            "urgent_count": 0,
            "deadline_count": 0,
            "morning": 0, # 5am - 12pm
            "afternoon": 0, # 12pm - 5pm
            "evening": 0, # 5pm - 5am
            "latest_ts": 0,
            "oldest_ts": now_ts,
            "today_count": 0,
            "week_count": 0,
            "month_count": 0,
            "activity_heatmap": {},
            "recent_activity": []
        }

        today_dt = datetime.now().date()
        week_ago = today_dt - timedelta(days=7)
        month_ago = today_dt - timedelta(days=30)
        
        urgent_keywords = ["urgent", "asap", "deadline", "action required", "today", "reminder", "follow up", "meeting"]
        deadline_keywords = ["tomorrow", "eod", "by 5pm", "before", "expires"]

        for i, msg_ref in enumerate(messages_meta):
            try:
                if i < 200: # Limit deep metadata analysis to 200 for speed
                    m = service.users().messages().get(
                        userId="me", id=msg_ref["id"], format="metadata",
                        metadataHeaders=["From", "Date", "Subject"]
                    ).execute()
                else:
                    break

                headers = m.get("payload", {}).get("headers", [])
                subject = html.unescape(next((h["value"] for h in headers if h["name"] == "Subject"), ""))
                from_header = next((h["value"] for h in headers if h["name"] == "From"), "")
                snippet = html.unescape(m.get("snippet", ""))
                
                from_name, from_email = parse_from(from_header)
                if from_email:
                    detailed_stats["senders"][f"{from_name} <{from_email}>"] += 1

                internal_date = int(m.get("internalDate", 0)) / 1000
                dt = datetime.fromtimestamp(internal_date)
                dt_date = dt.date()
                dt_hour = dt.hour
                
                if internal_date > detailed_stats["latest_ts"]: detailed_stats["latest_ts"] = internal_date
                if internal_date < detailed_stats["oldest_ts"]: detailed_stats["oldest_ts"] = internal_date

                if 5 <= dt_hour < 12: detailed_stats["morning"] += 1
                elif 12 <= dt_hour < 17: detailed_stats["afternoon"] += 1
                else: detailed_stats["evening"] += 1

                if dt_date == today_dt: detailed_stats["today_count"] += 1
                if dt_date >= week_ago: detailed_stats["week_count"] += 1
                if dt_date >= month_ago: detailed_stats["month_count"] += 1

                date_str = dt_date.isoformat()
                detailed_stats["activity_heatmap"][date_str] = detailed_stats["activity_heatmap"].get(date_str, 0) + 1

                text_to_scan = (subject + " " + snippet).lower()
                is_urgent = any(k in text_to_scan for k in urgent_keywords)
                is_deadline = any(k in text_to_scan for k in deadline_keywords)
                
                if is_urgent: detailed_stats["urgent_count"] += 1
                if is_deadline: detailed_stats["deadline_count"] += 1

                if i < 5:
                    act_txt = ""
                    if "invoice" in text_to_scan or "bill" in text_to_scan: act_txt = f"Detected invoice from {from_name}"
                    elif "meeting" in text_to_scan or "calendar" in text_to_scan: act_txt = f"Identified meeting request from {from_name}"
                    elif is_urgent: act_txt = f"Found urgent message from {from_name}"
                    else: act_txt = f"Analyzed new email: {subject[:40]}..."
                    
                    detailed_stats["recent_activity"].append({
                        "text": act_txt,
                        "time": dt.strftime("%I:%M %p"),
                        "icon": "🚨" if is_urgent else "✉️"
                    })

            except Exception as e:
                print(f"Error analyzing message {msg_ref['id']}: {e}")
                continue

        top_senders = []
        for s, count in detailed_stats["senders"].most_common(10):
            name, email = parse_from(s)
            top_senders.append({"name": name, "email": email, "count": count})

        heatmap = [{"date": d, "count": c} for d, c in sorted(detailed_stats["activity_heatmap"].items())]
        
        busiest_day = max(detailed_stats["activity_heatmap"], key=detailed_stats["activity_heatmap"].get) if detailed_stats["activity_heatmap"] else "None"

        account_age = "Unknown"
        if detailed_stats["oldest_ts"] < now_ts:
            years = (datetime.now() - datetime.fromtimestamp(detailed_stats["oldest_ts"])).days / 365
            account_age = f"{years:.1f} years"

        res = {
            "total_emails": total_emails,
            "unread_emails": counts["UNREAD"]["messages"],
            "read_emails": total_emails - counts["UNREAD"]["messages"],
            "important_emails": counts["IMPORTANT"]["messages"],
            "starred_emails": counts["STARRED"]["messages"],
            "sent_emails": counts["SENT"]["messages"],
            "draft_emails": counts["DRAFT"]["messages"],
            "promotional_emails": counts["CATEGORY_PROMOTIONS"]["messages"],
            "social_emails": counts["CATEGORY_SOCIAL"]["messages"],
            "spam_emails": counts["SPAM"]["messages"],
            "emails_today": detailed_stats["today_count"],
            "emails_this_week": detailed_stats["week_count"],
            "emails_this_month": detailed_stats["month_count"],
            "unique_senders": len(detailed_stats["senders"]),
            "top_senders": top_senders,
            "busiest_day": busiest_day,
            "average_emails_per_day": round(detailed_stats["week_count"] / 7, 1) if detailed_stats["week_count"] else 0,
            "estimated_response_rate": round((counts["SENT"]["messages"] / (total_emails + 1)) * 100, 1),
            "estimated_urgent_emails": detailed_stats["urgent_count"],
            "estimated_deadline_emails": detailed_stats["deadline_count"],
            "morning_emails": detailed_stats["morning"],
            "afternoon_emails": detailed_stats["afternoon"],
            "evening_emails": detailed_stats["evening"],
            "account_age_estimate": account_age,
            "latest_email_timestamp": detailed_stats["latest_ts"],
            "oldest_email_timestamp": detailed_stats["oldest_ts"],
            "total_threads": total_threads,
            "unread_threads": counts["UNREAD"]["threads"],
            "activity_heatmap": heatmap,
            "recent_activity_feed": detailed_stats["recent_activity"],
            "category_breakdown": [
                {"label": "Promotions", "value": counts["CATEGORY_PROMOTIONS"]["messages"]},
                {"label": "Social", "value": counts["CATEGORY_SOCIAL"]["messages"]},
                {"label": "Direct", "value": total_emails - counts["CATEGORY_PROMOTIONS"]["messages"] - counts["CATEGORY_SOCIAL"]["messages"]}
            ]
        }
        
        dashboard_cache[user_email] = (res, now_ts)
        return res

    except Exception as e:
        print(f"Dashboard stats error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

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
async def callback(
    code: str,
    state: str = None,
    scope: str = None,
    authuser: str = None,
    prompt: str = None,
    iss: str = None
):
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
                print(f"Token exchange error: {token_data}")
                return RedirectResponse(url=f"{FRONTEND_URL}/?error={token_data['error']}")

            access_token = token_data["access_token"]

            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            user_info = user_resp.json()

        jwt_data = {
            "access_token": access_token,
            "email": user_info.get("email", ""),
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", "")
        }
        token = create_jwt(jwt_data)

        return RedirectResponse(url=f"{FRONTEND_URL}/?token={token}")

    except Exception as e:
        print(f"Callback error: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/?error={str(e)}")

@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {
        "email": user.get("email"),
        "name": user.get("name"),
        "picture": user.get("picture")
    }

@app.get("/emails")
def list_emails(after: Optional[int] = None, user=Depends(get_current_user)):
    try:
        creds = Credentials(token=user["access_token"])
        service = build("gmail", "v1", credentials=creds)

        query = "label:INBOX"
        if after:
            query += f" after:{after}"

        results = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=50
        ).execute()

        messages = results.get("messages", [])
        emails = []

        for msg in messages:
            try:
                m = service.users().messages().get(
                    userId="me",
                    id=msg["id"],
                    format="full"
                ).execute()

                headers = m["payload"].get("headers", [])
                subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
                from_header = next((h["value"] for h in headers if h["name"] == "From"), "Unknown")
                date_header = next((h["value"] for h in headers if h["name"] == "Date"), "")
                from_name, from_email = parse_from(from_header)

                emails.append({
                    "id": m["id"],
                    "threadId": m["threadId"],
                    "subject": subject,
                    "from_name": from_name,
                    "from_email": from_email,
                    "snippet": m.get("snippet", ""),
                    "date": date_header,
                    "internal_date": int(m.get("internalDate", 0)) // 1000,
                    "body_preview": parse_email_body(m["payload"], limit=300),
                    "labels": m.get("labelIds", []),
                    "is_read": "UNREAD" not in m.get("labelIds", [])
                })
            except Exception as e:
                print(f"Error parsing message {msg['id']}: {e}")
                continue

        return {"emails": emails, "total": len(emails)}

    except HttpError as error:
        if error.resp.status == 401:
            raise HTTPException(status_code=401, detail="token_expired")
        raise HTTPException(status_code=500, detail=str(error))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/emails/{message_id}")
def get_email(message_id: str, user=Depends(get_current_user)):
    try:
        creds = Credentials(token=user["access_token"])
        service = build("gmail", "v1", credentials=creds)

        m = service.users().messages().get(
            userId="me",
            id=message_id,
            format="full"
        ).execute()

        headers = m["payload"].get("headers", [])
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
        from_header = next((h["value"] for h in headers if h["name"] == "From"), "Unknown")
        date_header = next((h["value"] for h in headers if h["name"] == "Date"), "")
        from_name, from_email = parse_from(from_header)

        return {
            "id": m["id"],
            "threadId": m["threadId"],
            "subject": subject,
            "from_name": from_name,
            "from_email": from_email,
            "snippet": m.get("snippet", ""),
            "date": date_header,
            "body": parse_email_body(m["payload"]),
            "labels": m.get("labelIds", []),
            "is_read": "UNREAD" not in m.get("labelIds", [])
        }

    except HttpError as error:
        if error.resp.status == 401:
            raise HTTPException(status_code=401, detail="token_expired")
        raise HTTPException(status_code=500, detail=str(error))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def parse_priority_json(raw: str) -> dict:
    fallback = {
        "priority": "normal",
        "reason": "Could not analyze",
        "deadline": None,
        "requires_reply": False
    }
    if not raw:
        return fallback
    try:
        clean = re.sub(r'```json\s*', '', raw)
        clean = re.sub(r'```\s*', '', clean)
        clean = clean.strip()
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            return json.loads(match.group())
        return json.loads(clean)
    except:
        return fallback

@app.post("/ai/analyze")
async def analyze_email(
    request: Request, 
    user=Depends(get_current_user)
):
    body = await request.json()
    from_name = body.get("from_name", "")
    subject = body.get("subject", "")
    body_preview = body.get("body_preview", "")[:400]
    email_id = body.get("email_id", "")

    combined_prompt = f"""Analyze this email and respond with ONLY a valid JSON object, no markdown, no explanation:
{{
  "priority": "urgent" or "normal" or "low",
  "reason": "one sentence why",
  "deadline": "deadline phrase or null",
  "requires_reply": true or false,
  "summary": "exactly 2 sentences about what this email is and what action is needed",
  "draft_reply": "3 sentence professional reply signed as Yeshwanth"
}}

From: {from_name}
Subject: {subject}
Preview: {body_preview}"""

    loop = asyncio.get_event_loop()

    try:
        raw = await loop.run_in_executor(
            None,
            partial(call_groq, combined_prompt,
            "You are an email assistant. Reply only with valid JSON exactly as instructed. No markdown, no explanation.",
            400)
        )

        data = parse_priority_json(raw)

        return {
            "email_id": email_id,
            "priority": data.get("priority", "normal"),
            "reason": data.get("reason", ""),
            "deadline": data.get("deadline", None),
            "requires_reply": data.get("requires_reply", False),
            "summary": data.get("summary", body_preview[:200]),
            "draft_reply": data.get("draft_reply", "Could not generate draft.")
        }

    except Exception as e:
        import traceback
        print(f"Analyze error for {email_id}: {traceback.format_exc()}")
        return {
            "email_id": email_id,
            "priority": "normal",
            "reason": "Analysis failed",
            "deadline": None,
            "requires_reply": False,
            "summary": body_preview[:200],
            "draft_reply": "AI unavailable — please try again."
        }

@app.post("/ai/analyze-batch")
async def analyze_batch(
    request: Request,
    user=Depends(get_current_user)
):
    body = await request.json()
    emails = body.get("emails", [])[:5]
    results = {}

    for email in emails:
        try:
            email_id = email.get("id", "")
            from_name = email.get("from_name", "")
            subject = email.get("subject", "")
            body_preview = email.get("body_preview", "")[:400]

            combined_prompt = f"""Analyze this email and respond with ONLY a valid JSON object, no markdown, no explanation:
{{
  "priority": "urgent" or "normal" or "low",
  "reason": "one sentence why",
  "deadline": "deadline phrase or null",
  "requires_reply": true or false,
  "summary": "exactly 2 sentences about what this email is and what action is needed",
  "draft_reply": "3 sentence professional reply signed as Yeshwanth"
}}

From: {from_name}
Subject: {subject}
Preview: {body_preview}"""

            loop = asyncio.get_event_loop()

            raw = await loop.run_in_executor(
                None,
                partial(call_groq, combined_prompt,
                "You are an email assistant. Reply only with valid JSON.",
                400)
            )

            data = parse_priority_json(raw)

            results[email_id] = {
                "priority": data.get("priority", "normal"),
                "reason": data.get("reason", ""),
                "deadline": data.get("deadline", None),
                "requires_reply": data.get("requires_reply", False),
                "summary": data.get("summary", body_preview[:200]),
                "draft_reply": data.get("draft_reply", "Could not generate draft.")
            }

            await asyncio.sleep(2)

        except Exception as e:
            import traceback
            print(f"Batch analyze error for {email.get('id')}: {traceback.format_exc()}")
            results[email.get("id", "")] = {
                "priority": "normal",
                "reason": "Analysis failed",
                "deadline": None,
                "requires_reply": False,
                "summary": None,
                "draft_reply": None
            }

    return {"results": results}

if __name__ == "__main__":
    import uvicorn
    print("MailPulse backend running on port 8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
