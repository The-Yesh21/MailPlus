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
from email.message import EmailMessage
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import FastAPI, Request, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
import io
import uuid
import aiofiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from dotenv import load_dotenv
from jose import jwt, JWTError
import httpx
from groq import Groq
import firebase_admin
from firebase_admin import credentials as fb_credentials, firestore as fb_firestore
import numpy as np
import soundfile as sf
import io
from kokoro import KPipeline

load_dotenv()


# ── Firebase / Firestore ────────────────────────────────────────────────────
_firebase_cred_path = os.getenv("FIREBASE_CREDENTIALS", "./serviceAccountKey.json")
if not firebase_admin._apps:
    _cred = fb_credentials.Certificate(_firebase_cred_path)
    firebase_admin.initialize_app(_cred)
fs = fb_firestore.client()

# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI()
import os
os.makedirs("audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ALGORITHM            = "HS256"
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-vercel-app.vercel.app",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Local Zero-Shot & Embedding Classification ──────────────────────────────────
from transformers import pipeline as hf_pipeline

zero_shot_classifier = None
embedding_pipeline = None
anchor_embeddings = None

def get_classifier():
    global zero_shot_classifier
    if zero_shot_classifier is None:
        print("Loading zero-shot classifier...")
        zero_shot_classifier = hf_pipeline(
            "zero-shot-classification",
            model="cross-encoder/nli-MiniLM2-L6-H768",
            device=-1
        )
        print("Classifier ready!")
    return zero_shot_classifier

def get_embedding_pipeline():
    global embedding_pipeline
    if embedding_pipeline is None:
        print("Loading Sentence Embedding/Feature Extraction pipeline...")
        try:
            embedding_pipeline = hf_pipeline(
                "feature-extraction",
                model="sentence-transformers/all-MiniLM-L6-v2",
                device=-1
            )
            print("Embedding pipeline ready!")
        except Exception as e:
            print(f"Failed to initialize embedding pipeline: {e}")
            return None
    return embedding_pipeline

def get_sentence_embedding(text: str) -> np.ndarray:
    try:
        pipeline = get_embedding_pipeline()
        if pipeline is None:
            return np.zeros(384)
        
        # Mean pooling of token embeddings
        features = pipeline(text)
        features_np = np.array(features[0]) # Shape: (seq_len, hidden_size)
        embedding = np.mean(features_np, axis=0) # Shape: (hidden_size,)
        
        # Normalize to unit vector
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding
    except Exception as e:
        print(f"Embedding calculation error: {e}")
        return np.zeros(384)

# Semantic anchors representing key categories
ANCHORS = {
    "urgent_action": [
        "Please reply immediately, critical action is required ASAP.",
        "URGENT attention needed for deadline today.",
        "Action required, important request from sender.",
        "Critical system error, deploy failed, production issue.",
        "Meeting schedule confirmation and calendar invite."
    ],
    "career_opportunity": [
        "Internship application offer, job interview invitation.",
        "Campus placement drive, resume shortlisting update.",
        "Hackathon registration, online course certificate."
    ],
    "financial": [
        "Payment receipt, subscription invoice, bank transaction debit.",
        "Credit card statement, razorpay upi payment due.",
        "Refund processed successfully, subscription auto-renewal."
    ],
    "newsletter_promo": [
        "Weekly newsletter update, marketing promotional offer discount.",
        "Unsubscribe from this mailing list, sales coupon deal.",
        "Community updates, digest, blog post announcement."
    ]
}

def get_anchor_embeddings():
    global anchor_embeddings
    if anchor_embeddings is None:
        print("Pre-computing semantic anchor embeddings...")
        anchor_embeddings = {}
        for category, sentences in ANCHORS.items():
            embs = []
            for s in sentences:
                emb = get_sentence_embedding(s)
                embs.append(emb)
            # Average the anchor embeddings to get a single centroid vector per category
            centroid = np.mean(embs, axis=0)
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid = centroid / norm
            anchor_embeddings[category] = centroid
        print("Anchor embeddings ready!")
    return anchor_embeddings

def classify_email_zeroshot(subject: str, body: str, from_email: str) -> dict:
    try:
        classifier = get_classifier()
        text = f"{subject}. {body[:300]}"
        
        result = classifier(
            text,
            candidate_labels=[
                "urgent reply needed",
                "deadline mentioned", 
                "action required",
                "low priority",
                "promotional"
            ]
        )
        
        scores = dict(zip(result["labels"], result["scores"]))
        
        import re
        deadline = None
        deadline_patterns = [
            r'by (today|tomorrow|monday|tuesday|wednesday|thursday|friday)',
            r'deadline', r'expires?', r'eod|eow|asap',
            r'by \d{1,2}[\/\-]\d{1,2}'
        ]
        text_lower = f"{subject} {body}".lower()
        for pattern in deadline_patterns:
            match = re.search(pattern, text_lower)
            if match:
                deadline = match.group(0)
                break
        
        if scores.get("promotional", 0) > 0.6:
            priority = "low"
            requires_reply = False
        elif scores.get("urgent reply needed", 0) > 0.35 or \
             scores.get("deadline mentioned", 0) > 0.35:
            priority = "urgent"
            requires_reply = True
        elif scores.get("action required", 0) > 0.35:
            priority = "normal"
            requires_reply = True
        else:
            priority = "normal"
            requires_reply = False
        
        return {
            "priority": priority,
            "requires_reply": requires_reply,
            "deadline": deadline,
            "reason": f"Top label: {result['labels'][0]} ({result['scores'][0]:.2f})"
        }
    except Exception as e:
        print(f"Classification error: {e}")
        return {
            "priority": "normal",
            "requires_reply": False,
            "deadline": None,
            "reason": "Classification unavailable"
        }

def classify_email(subject: str, body: str, from_email: str) -> dict:
    try:
        # Load local embedding centroids
        anchors = get_anchor_embeddings()
        email_text = f"{subject}. {body[:300]}"
        email_emb = get_sentence_embedding(email_text)
        
        # Calculate similarities
        sims = {}
        for cat, centroid in anchors.items():
            sims[cat] = float(np.dot(email_emb, centroid))
            
        print(f"Semantic similarities for '{subject}': {sims}")
        
        # Deterministic deadline patterns
        import re
        deadline = None
        deadline_patterns = [
            r'by (today|tomorrow|monday|tuesday|wednesday|thursday|friday)',
            r'deadline', r'expires?', r'eod|eow|asap',
            r'by \d{1,2}[\/\-]\d{1,2}'
        ]
        text_lower = f"{subject} {body}".lower()
        for pattern in deadline_patterns:
            match = re.search(pattern, text_lower)
            if match:
                deadline = match.group(0)
                break
                
        # Classify based on semantic similarities
        priority = "normal"
        requires_reply = False
        reason = "Classified by local sentence embedding"
        
        # A threshold-based decision tree
        if sims.get("newsletter_promo", 0) > 0.45:
            priority = "low"
            requires_reply = False
            reason = f"Newsletter/Promo detected (sim: {sims['newsletter_promo']:.2f})"
        elif sims.get("urgent_action", 0) > 0.40 or deadline is not None:
            priority = "urgent"
            requires_reply = True
            reason = f"Urgent/Action item detected (sim: {sims['urgent_action']:.2f})"
        elif sims.get("career_opportunity", 0) > 0.42:
            priority = "normal"
            requires_reply = True
            reason = f"Career/Placement update (sim: {sims['career_opportunity']:.2f})"
        elif sims.get("financial", 0) > 0.42:
            priority = "normal"
            requires_reply = False
            reason = f"Financial transaction/billing (sim: {sims['financial']:.2f})"
            
        return {
            "priority": priority,
            "requires_reply": requires_reply,
            "deadline": deadline,
            "reason": reason
        }
    except Exception as e:
        print(f"Semantic classification error: {e}. Falling back to zero-shot classification.")
        return classify_email_zeroshot(subject, body, from_email)

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
        safe_data = {
            "priority": result.get("priority", "normal"),
            "reason": result.get("reason", ""),
            "deadline": result.get("deadline", None),
            "requires_reply": result.get("requires_reply", False),
            "summary": result.get("summary", None),
            "draft_reply": result.get("draft_reply", None),
            "messageId": email_id,
            "cachedAt": datetime.now(timezone.utc).isoformat()
        }
        fs.collection("email_ai")\
          .document(user_email)\
          .collection("results")\
          .document(email_id)\
          .set(safe_data, merge=True)
    except Exception as e:
        print(f"Firestore AI result write error: {e}")


def get_cached_email_ai_result(user_email: str, email_id: str) -> Optional[dict]:
    """Read a cached AI result from Firestore for a single email if it exists."""
    try:
        doc = fs.collection("email_ai")\
                .document(user_email)\
                .collection("results")\
                .document(email_id)\
                .get()
        if doc.exists:
            return doc.to_dict()
    except Exception as e:
        print(f"Firestore AI result read error: {e}")
    return None


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
    
    import re
    # Remove CSS blocks
    text = body
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'\.[\w-]+\s*\{[^}]*\}', '', text)
    text = re.sub(r'[\w-]+:\s*[\w#%.,\s]+;', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    clean = html.unescape(text).strip()
    
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

def format_reply_bodies(reply_text: str) -> tuple[str, str]:
    plain_text = re.sub(r'\*\*(.*?)\*\*', r'\1', reply_text).strip()
    escaped = html.escape(reply_text.strip())
    escaped = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', escaped)
    paragraphs = [
        paragraph.strip().replace("\n", "<br>")
        for paragraph in re.split(r'\n\s*\n', escaped)
        if paragraph.strip()
    ]
    html_body = (
        "<div style=\"font-family: Arial, sans-serif; font-size: 14px; "
        "line-height: 1.6; color: #111827;\">"
        + "".join(f"<p style=\"margin: 0 0 12px;\">{paragraph}</p>" for paragraph in paragraphs)
        + "</div>"
    )
    return plain_text, html_body


def call_groq(prompt: str, system: str, max_tokens: int = 300):
    max_retries = 5
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
            if content and isinstance(content, str):
                content = re.sub(
                    r'<think>.*?</think>', 
                    '', 
                    content, 
                    flags=re.DOTALL
                ).strip()
            if not isinstance(content, str):
                return None
            return content.strip() if content else None
        except Exception as e:
            import time
            error_str = str(e)
            if '429' in error_str:
                wait = 3 * (attempt + 1)
                print(f"Rate limit, waiting {wait}s")
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
  "draft_reply": "a complete professional reply email, not a summary. Use greeting, concise body, and closing signed as Yeshwanth. Use line breaks between paragraphs. Use **bold** only around important commitments, deadlines, blockers, requested actions, or decisions that need attention."
}}

Classification rules for priority:
- "urgent": ONLY if it requires immediate action today, involves critical project deadlines, financial issues, or is a direct request from a person waiting on you.
- "low": Newsletters, automated alerts, marketing, promotional emails (e.g., Internshala, generic updates), and anything that does not require a direct personal response.
- "normal": Everything else.

Draft reply rules:
- Reply directly to the sender's request. Do not describe the email or say it is waiting for a response.
- Do not invent facts. If information is unavailable, acknowledge it professionally and commit to checking or sharing an update.
- Keep it concise but complete: 2-4 short paragraphs.
- Use **bold** sparingly for attention points such as **by tomorrow**, **project update**, **required details**, or **next steps**.
- Never use bullet points unless the original email asks for multiple items.

From: {from_name}
Subject: {subject}
Preview: {body_preview[:400]}"""

def analyze_email_hf(from_name, subject, body_preview):
    # Despite the name 'analyze_email_hf' used by other endpoints, we use Groq + Regex here
    raw = call_groq(build_prompt(from_name, subject, body_preview), "You are an email assistant. Reply only with valid JSON.", 700)
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

kokoro_pipeline = None

def get_kokoro_pipeline():
    global kokoro_pipeline
    if kokoro_pipeline is None:
        try:
            print("Initializing Kokoro pipeline...")
            from kokoro import KPipeline
            kokoro_pipeline = KPipeline(lang_code='a')
            print("Kokoro ready!")
        except Exception as e:
            print(f"Kokoro init failed: {e}")
            return None
    return kokoro_pipeline

def generate_voice_briefing(script: str, tone: str = "energetic") -> bytes:
    try:
        pipeline = get_kokoro_pipeline()
        
        if pipeline is None:
            print("Kokoro not available")
            return None
        
        print(f"Generating audio for script: {script[:100]}... with tone: {tone}")
        
        # Adjust Kokoro voice & speed dynamically based on tone
        if tone == "morning_routine":
            voice = 'af_nicole'  # Soothing, warm female voice for morning routine
            speed = 0.92         # Slightly slower for a calm, grounding feel
        elif tone == "calm":
            voice = 'af_sky'     # Very gentle, soft female voice
            speed = 0.90         # Slower pace
        elif tone == "humorous":
            voice = 'am_adam'    # Male voice with some grit/character
            speed = 1.0          # Normal speed
        elif tone == "energetic":
            voice = 'af_bella'   # Bright, upbeat female voice
            speed = 1.05         # Slightly faster, punchy
        else:
            voice = 'af_bella'
            speed = 0.95
            
        generator = pipeline(
            script,
            voice=voice,
            speed=speed
        )
        
        audio_chunks = []
        for i, (gs, ps, audio) in enumerate(generator):
            audio_chunks.append(audio)
            print(f"Generated chunk {i}")
        
        if not audio_chunks:
            print("No audio chunks generated")
            return None
        
        full_audio = np.concatenate(audio_chunks)
        buffer = io.BytesIO()
        sf.write(buffer, full_audio, 24000, format='WAV')
        buffer.seek(0)
        result = buffer.read()
        print(f"Audio generated: {len(result)} bytes")
        return result
        
    except Exception as e:
        print(f"Kokoro generation error: {traceback.format_exc()}")
        return None


# ── Routes ────────────────────────────────────────────────────────────────────

def phonetic_name_for_tts(raw: str) -> str:
    """
    Map known Indian names to phoneme sequences Kokoro's af_bella voice
    actually pronounces correctly. Tested against Kokoro's English phoneme rules:
    - 'Yaysh' → produces the 'Yesh' sound (ay+sh cluster works)
    - 'wunth' → produces 'wanth' (u in closed syllable = short 'a' in Kokoro)
    """
    mapping = {
        "yeshwanth": "Yaysh wunth",
        "yeshwant":  "Yaysh wunth",
        "yeshvanth": "Yaysh wunth",
    }
    return mapping.get(raw.strip().lower(), raw)


def is_deadline_expired_backend(deadline_str: str, email_date_ms: int) -> bool:
    """Return True if the deadline computed from email_date_ms has already passed."""
    if not deadline_str or deadline_str in ("null", "None"):
        return False
    s = deadline_str.lower()
    duration_ms = None
    import re as _re
    m = _re.search(r'(\d+)\s*(hour|minute|day|week)', s)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        multipliers = {"minute": 60_000, "hour": 3_600_000, "day": 86_400_000, "week": 604_800_000}
        duration_ms = n * multipliers.get(unit, 0)
    elif "tomorrow" in s:
        duration_ms = 86_400_000
    if not duration_ms:
        return False
    base = email_date_ms if email_date_ms else int(datetime.now(timezone.utc).timestamp() * 1000)
    expires_at = base + duration_ms
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    return expires_at < now_ms


def categorize_emails(emails: list, ai_results: dict) -> dict:
    """
    Categorize emails into work/career/finance/action/thread buckets.
    Expired-deadline emails are excluded from action_items and category highlights.
    """
    work_keywords    = ["github", "deploy", "api", "server", "pull request", "merge", "build",
                        "project", "sprint", "jira", "slack", "meeting", "standup", "review",
                        "production", "bug", "release", "update", "team"]
    career_keywords  = ["internship", "interview", "application", "offer", "hiring", "job",
                        "course", "certificate", "hackathon", "placement", "resume", "linkedin",
                        "skillbytes", "internshala", "naukri", "campus", "college", "university"]
    finance_keywords = ["payment", "invoice", "bill", "subscription", "bank", "transaction",
                        "refund", "charge", "due", "receipt", "order", "purchase", "wallet",
                        "upi", "razorpay", "stripe", "paypal", "credit", "debit"]

    work, career, finance, action_items = [], [], [], []

    # Group by threadId for conversation continuity
    threads: dict = {}
    for e in emails:
        tid = e.get("threadId") or e.get("id")
        if tid not in threads:
            threads[tid] = []
        threads[tid].append(e)

    thread_convos = [msgs for msgs in threads.values() if len(msgs) > 1]

    for e in emails:
        ai       = ai_results.get(e.get("id"), {}) or e.get("ai") or {}
        subj     = (e.get("subject") or "").lower()
        snip     = (e.get("snippet") or "").lower()
        text     = f"{subj} {snip}"
        deadline = ai.get("deadline")
        email_date = e.get("internal_date", 0)

        # If this email has a deadline that has already passed, skip it entirely
        # from action items and category highlights — it's stale news
        deadline_expired = (
            deadline and
            deadline not in ("null", "None") and
            is_deadline_expired_backend(deadline, email_date)
        )
        if deadline_expired:
            continue  # don't surface in any section of the briefing

        # Action items — things that still need a decision or action
        if ai.get("requires_reply") or ai.get("priority") == "urgent":
            action_items.append({**e, "ai": ai})

        if any(k in text for k in finance_keywords):
            finance.append({**e, "ai": ai})
        elif any(k in text for k in career_keywords):
            career.append({**e, "ai": ai})
        elif any(k in text for k in work_keywords):
            work.append({**e, "ai": ai})

    return {
        "work":          work[:4],
        "career":        career[:4],
        "finance":       finance[:3],
        "action_items":  action_items[:5],
        "thread_convos": thread_convos[:3],
    }


def build_briefing_prompt(name: str, total: int, urgent_emails: list,
                          reply_emails: list, top_emails: list,
                          categories: dict, tone: str = "energetic") -> str:
    """
    Build a rich Groq prompt for a structured, chief-of-staff style morning briefing.
    Tone options: energetic | humorous | calm | formal
    """

    tone_instructions = {
        "morning_routine": (
            "You are a warm, highly encouraging, and psychologically empowering morning performance coach and chief-of-staff. "
            "Greet Yeshwanth with genuine warmth, acknowledging the start of a fresh day. "
            "Your goal is to optimize his morning mindset: reduce anxiety, boost cognitive clarity, and gently guide him into his ideal morning flow. "
            "Frame the inbox situation positively (e.g., 'We have a couple of key items to navigate today, but nothing we can't handle smoothly. Let's tackle them one by one.'). "
            "Present urgent items as simple, achievable triggers. "
            "Structure the briefing as a relaxed, inspiring morning conversation. Use smooth transitions and inspiring words. "
            "End with an uplifting, psychologically grounding sign-off that primes him for focus and peace."
        ),
        "energetic": (
            "You are HYPED. Short punchy sentences. Lots of energy. Use exclamations naturally. "
            "Make the user feel like they're about to crush the day. Think sports coach meets tech bro."
        ),
        "humorous": (
            "You are witty and sarcastic like Grok. Dry humor, clever observations, light roasts of the inbox situation. "
            "Still useful — the jokes serve the information, not the other way around. "
            "Example: 'Internshala sent you 4 emails. They really believe in you. Or they're desperate. Probably both.'"
        ),
        "calm": (
            "You are calm, measured, and reassuring. Like a wise assistant who has seen it all. "
            "Smooth transitions, no exclamations, steady pace. Think NPR morning edition."
        ),
        "formal": (
            "You are professional and precise. No jokes, no filler. Just clean, structured information delivery. "
            "Think executive assistant briefing a CEO."
        ),
    }
    tone_desc = tone_instructions.get(tone, tone_instructions["energetic"])

    # ── Overview numbers ──────────────────────────────────────────────────────
    deadline_count = sum(
        1 for e in urgent_emails
        if (e.get("ai") or {}).get("deadline")
    )

    # ── Category summaries ────────────────────────────────────────────────────
    def fmt_category(label: str, items: list) -> str:
        if not items:
            return ""
        lines = []
        for e in items[:3]:
            ai = e.get("ai") or {}
            summary = ai.get("summary", e.get("snippet", ""))
            one = summary.split(".")[0] if summary else e.get("snippet", "")[:80]
            lines.append(f"  - {e.get('from_name','Someone')}: {e.get('subject','(no subject)')} — {one}.")
        return f"{label}:\n" + "\n".join(lines)

    work_block    = fmt_category("Work & Projects",   categories.get("work", []))
    career_block  = fmt_category("Career & Learning", categories.get("career", []))
    finance_block = fmt_category("Financial",         categories.get("finance", []))

    # ── Action items ──────────────────────────────────────────────────────────
    action_lines = ""
    for e in categories.get("action_items", [])[:5]:
        ai = e.get("ai") or {}
        reason = ai.get("reason") or ai.get("summary", "")
        one = reason.split(".")[0] if reason else e.get("snippet", "")[:60]
        deadline = ai.get("deadline")
        email_date = e.get("internal_date", 0)
        # Only show deadline if it hasn't passed yet
        if deadline and deadline not in ("null", "None") and not is_deadline_expired_backend(deadline, email_date):
            dl = f" (deadline: {deadline})"
        else:
            dl = ""
        action_lines += f"  - {e.get('from_name','Someone')}: {e.get('subject','(no subject)')} — {one}{dl}.\n"

    # ── Conversation continuity ───────────────────────────────────────────────
    thread_lines = ""
    for thread in categories.get("thread_convos", [])[:2]:
        latest = thread[-1]
        ai = (latest.get("ai") or {})
        summary = ai.get("summary", latest.get("snippet", ""))
        thread_lines += (
            f"  - {latest.get('from_name','Someone')} continued the conversation "
            f"about '{latest.get('subject','(no subject)')}': {summary.split('.')[0]}.\n"
        )

    # ── Top emails fallback ───────────────────────────────────────────────────
    top_lines = ""
    for i, e in enumerate(top_emails[:5]):
        ai = e.get("ai") or {}
        summary = ai.get("summary", e.get("snippet", ""))
        one = summary.split(".")[0] if summary else e.get("snippet", "")[:80]
        top_lines += f"  {i+1}. {e.get('from_name','Someone')}: {e.get('subject','(no subject)')} — {one}.\n"

    has_action = bool(urgent_emails or reply_emails)

    return f"""You are MailPulse — an AI chief-of-staff delivering a spoken morning email briefing.

TONE: {tone_desc}

STRICT OUTPUT RULES:
- User's name is "{name}". Use it 1-2 times naturally.
- Output ONLY the spoken script. Zero markdown, zero bullet points, zero headers, zero asterisks, zero dashes.
- Target 180-220 words — thorough but under 90 seconds spoken.
- Natural spoken sentences. Write in a conversational, human-like rhythm. Use standard punctuation (periods, commas) to control pacing.
- Structure in this exact order (skip a section only if it has zero data):
  1. Quick 2-sentence overview: total emails, urgent count, reply count, deadline count.
  2. Work/Projects highlights (if any) — mention specific senders and what they need.
  3. Career/Learning highlights (if any) — internships, interviews, courses.
  4. Financial alerts (if any) — payments due, subscriptions, bank alerts.
  5. Action items — specific decisions or tasks, not vague summaries. Be direct: "Reply to X about Y", "Approve Z".
  6. Top emails / general updates (if no urgent or action items today) — summarize what the key emails are about.
  7. Conversation continuity — if someone replied to an ongoing thread, say what they said, not just that they replied.
  8. Sign-off line matching the tone.

INBOX DATA:
Total emails: {total}
Urgent (non-expired): {len(urgent_emails)}
Need reply: {len(reply_emails)}
Deadlines within 24h: {deadline_count}

{work_block if work_block else ""}
{career_block if career_block else ""}
{finance_block if finance_block else ""}

Action items:
{action_lines if action_lines else "  None today."}

Ongoing conversations:
{thread_lines if thread_lines else "  No active threads."}

{"Top emails (no urgent items today):" + chr(10) + top_lines if not has_action and top_lines else ""}

Write the briefing script now:"""


def is_valid_summary(text):
    if not text or len(text) < 20:
        return False
    if '{' in text or '}' in text or '.css' in text.lower():
        return False
    return True


@app.post("/voice/generate")
async def generate_voice_endpoint(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    emails = body.get("emails", [])
    user_email = user.get("email", "")
    tone = body.get("tone", "energetic")
    body_ai_results = body.get("ai_results", {})

    # Fetch fresh emails from Gmail to avoid stale stats/cache
    access_token = user.get("access_token")
    if access_token:
        try:
            print("Fetching fresh emails from Gmail for voice briefing...")
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params={"labelIds": ["INBOX"], "q": "newer_than:14d", "maxResults": 40}
                )
                if resp.status_code == 200:
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
                    fresh_emails = []
                    for m in details:
                        if not m or "id" not in m:
                            continue
                        hdrs = m["payload"].get("headers", [])
                        subject     = next((h["value"] for h in hdrs if h["name"] == "Subject"), "No Subject")
                        from_header = next((h["value"] for h in hdrs if h["name"] == "From"),    "Unknown")
                        date_header = next((h["value"] for h in hdrs if h["name"] == "Date"),    "")
                        from_name, from_email = parse_from(from_header)
                        fresh_emails.append({
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
                    if fresh_emails:
                        emails = fresh_emails
        except Exception as e:
            print(f"Error fetching fresh emails from Gmail: {e}")

    if not emails:
        raise HTTPException(status_code=400, detail="No emails provided or found in Gmail inbox")

    # Fetch AI results from Firestore, merge with inline ai field from frontend and body
    ai_results = {}
    try:
        results_ref = fs.collection("email_ai").document(user_email).collection("results")
        docs = results_ref.stream()
        for doc in docs:
            ai_results[doc.id] = doc.to_dict()
    except Exception as e:
        print(f"Error fetching AI results for briefing: {e}")

    # Merge body ai_results
    if isinstance(body_ai_results, dict):
        for msg_id, ai_data in body_ai_results.items():
            if ai_data and isinstance(ai_data, dict):
                ai_results.setdefault(msg_id, ai_data)

    # Merge inline email ai fields if any
    for e in emails:
        if e.get("ai") and e.get("id"):
            ai_results.setdefault(e["id"], e["ai"])

    name = user.get("name", "").split()[0]
    unread_emails = [e for e in emails if not e.get("is_read", True)]

    # For any unread email that doesn't have a real AI summary yet, analyze it on the fly with Groq!
    analysis_tasks = []
    emails_to_analyze = []
    for e in unread_emails:
        eid = e.get("id")
        if not eid:
            continue
        summary = ai_results.get(eid, {}).get("summary")
        if is_valid_summary(summary):
            has_real_summary = True
        else:
            has_real_summary = False

        if not has_real_summary:
            emails_to_analyze.append(e)
            analysis_tasks.append(
                analyze_single_email_helper(
                    email_id=eid,
                    from_name=e.get("from_name", ""),
                    subject=e.get("subject", ""),
                    body_preview=e.get("snippet", ""),  # use email snippet field instead of body_preview
                    from_email=e.get("from_email", ""),
                    user_email=user_email,
                    force_groq=True # Force Groq analysis to get a high quality LLM summary!
                )
            )

    if analysis_tasks:
        print(f"Running on-the-fly Groq analysis for {len(analysis_tasks)} unread emails for voice briefing...")
        analyzed_results = await asyncio.gather(*analysis_tasks, return_exceptions=True)
        for e, res in zip(emails_to_analyze, analyzed_results):
            if isinstance(res, dict) and "summary" in res:
                ai_results[e["id"]] = res
            else:
                print(f"Error analyzing email {e.get('id')} on the fly: {res}")

    urgent = [e for e in unread_emails if ai_results.get(e["id"], {}).get("priority") == "urgent"]
    reply_needed = [e for e in unread_emails if ai_results.get(e["id"], {}).get("requires_reply") and ai_results.get(e["id"], {}).get("priority") != "urgent"]
    total_unread = len(unread_emails)

    full_script = None

    # Try generating script via Groq AI
    try:
        categories = categorize_emails(unread_emails, ai_results)
        briefing_prompt = build_briefing_prompt(
            name=name,
            total=total_unread,
            urgent_emails=urgent,
            reply_emails=reply_needed,
            top_emails=unread_emails,
            categories=categories,
            tone=tone
        )
        
        print(f"Generating AI briefing script via Groq with tone '{tone}'...")
        ai_script = call_groq(
            briefing_prompt,
            "You are a helpful, warm AI chief-of-staff delivering a spoken morning briefing. Do NOT output markdown, bullet points, asterisks, dashes or lists. Respond ONLY with clean spoken text.",
            550
        )
        if ai_script and len(ai_script.strip()) > 50:
            full_script = ai_script.strip()
            # Strip out any remaining markdown formatting
            full_script = re.sub(r'[*_\-#`\[\]()]', '', full_script)
            print("Successfully generated briefing script via Groq!")
    except Exception as e:
        print(f"Error generating AI briefing script via Groq: {e}. Falling back to manual script.")

    # Fallback to manual script generation if Groq fails or is not configured
    if not full_script:
        parts = []

        # Warm personal opener based on time
        from datetime import datetime
        hour = datetime.now().hour
        if hour < 12:
            greeting = "Good morning"
        elif hour < 17:
            greeting = "Good afternoon"
        else:
            greeting = "Good evening"

        parts.append(
            f"{greeting}, {name}. "
            f"Here's what's waiting for you in your inbox."
        )

        if total_unread == 0:
            parts.append(
                "Great news — you're completely caught up. "
                "Your inbox is clean and there's nothing urgent pending. "
                "Enjoy your day!"
            )
        else:
            parts.append(
                f"You have {total_unread} unread "
                f"{'email' if total_unread == 1 else 'emails'} today."
            )

            if urgent:
                parts.append(
                    f"{'One email needs' if len(urgent) == 1 else str(len(urgent)) + ' emails need'} "
                    f"your immediate attention. Let me walk you through them."
                )
                for i, e in enumerate(urgent[:3]):
                    ai = ai_results.get(e["id"], {}) or {}
                    summary = ai.get("summary", "")
                    sender = e.get("from_name", "Someone")
                    subject = e.get("subject", "")
                    snippet = e.get("snippet", "")
                    deadline = ai.get("deadline")
                    
                    # Use best available context
                    context = ""
                    if summary and isinstance(summary, str) and len(summary.strip()) > 20:
                        context = summary.strip()
                    elif snippet and len(snippet.strip()) > 10:
                        context = snippet.strip()
                    else:
                        context = f"regarding {subject}" if subject else "with an urgent matter"
                    
                    parts.append(
                        f"First one" if i == 0 else f"Next one" if i == 1 else f"And",
                    )
                    parts.append(
                        f"{sender} wrote to you — {context}"
                    )
                    
                    if deadline and deadline not in ["null", "None", None, ""]:
                        parts.append(
                            f"You need to respond before {deadline}."
                        )

            if reply_needed:
                parts.append(
                    f"{len(reply_needed)} {'email needs' if len(reply_needed) == 1 else 'emails need'} "
                    f"a reply from you."
                )
                for e in reply_needed[:2]:
                    ai = ai_results.get(e["id"], {}) or {}
                    summary = ai.get("summary", "")
                    snippet = e.get("snippet", "")
                    sender = e.get("from_name", "Someone")
                    subject = e.get("subject", "")
                    
                    context = ""
                    if summary and isinstance(summary, str) and len(summary.strip()) > 20:
                        context = summary.strip()
                    elif snippet and len(snippet.strip()) > 10:
                        context = snippet.strip()
                    else:
                        context = f"about {subject}" if subject else "about an important matter"
                    
                    parts.append(
                        f"{sender} is waiting — {context}"
                    )

            if not urgent and not reply_needed and total_unread > 0:
                parts.append(
                    "None of them are urgent — "
                    "take your time going through them when you're ready."
                )

        parts.append(
            f"That's your briefing for now, {name}. "
            "Your full inbox is ready in MailPulse whenever you need it. "
            "Have a productive day."
        )

        full_script = " ".join(parts)
        full_script = full_script.replace(".. ", ". ").replace("  ", " ")

    loop = asyncio.get_event_loop()

    # Generate TTS audio
    filename = f"{uuid.uuid4().hex}.wav"
    filepath = os.path.join("audio", filename)

    # Use partial to pass the tone to generate_voice_briefing
    audio_data = await loop.run_in_executor(None, partial(generate_voice_briefing, full_script, tone))

    if not audio_data:
        raise HTTPException(status_code=500, detail="Voice generation failed")

    async with aiofiles.open(filepath, mode='wb') as f:
        await f.write(audio_data)

    frontend_url = str(request.base_url)
    audio_url = f"{frontend_url}audio/{filename}"

    import base64
    audio_base64 = base64.b64encode(audio_data).decode("utf-8")
    
    # Very rough estimate: 130 words per minute -> 2 words per second.
    word_count = len(full_script.split())
    duration_secs = max(1, word_count // 2)

    # Mark the unread emails as read in Gmail
    marked_read_ids = []
    if unread_emails and access_token:
        async def mark_single_read(msg_id):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}/modify",
                        headers={"Authorization": f"Bearer {access_token}"},
                        json={"removeLabelIds": ["UNREAD"]}
                    )
                    if resp.status_code == 200:
                        return msg_id
            except Exception as e:
                print(f"Failed to mark email {msg_id} read during briefing: {e}")
            return None

        # Execute parallel requests to mark read
        results = await asyncio.gather(*[mark_single_read(e["id"]) for e in unread_emails if e.get("id")])
        marked_read_ids = [r for r in results if r is not None]

    # Increment voice briefing stats in Firestore
    try:
        increment_user_stats(user_email, voice=1)
    except Exception as e:
        print(f"Failed to increment voice briefing stats: {e}")

    return {
        "url": audio_url, 
        "script": full_script, 
        "audio_base64": audio_base64,
        "duration_estimate": f"~{duration_secs}s",
        "marked_read_ids": marked_read_ids
    }


@app.post("/ai/generate-morning-briefing")
async def generate_morning_briefing(request: Request, user=Depends(get_current_user)):
    # Redirect to the new voice generation endpoint logic for backward compatibility
    return await generate_voice_endpoint(request, user)


@app.post("/user/settings")
async def save_user_settings(request: Request, user=Depends(get_current_user)):
    """Save user preferences (WhatsApp number, tone, etc.) to Firestore."""
    body = await request.json()
    user_email = user.get("email", "")
    try:
        update = {}
        if "whatsapp_number" in body:
            update["whatsapp_number"] = body["whatsapp_number"]
        if "briefing_tone" in body:
            update["briefing_tone"] = body["briefing_tone"]
        if update:
            fs.collection("user_stats").document(user_email).set(update, merge=True)
        return {"status": "ok"}
    except Exception as e:
        print(f"Settings save error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save settings")


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

        token_data = {
            "access_token": access_token,
            "email": user_info.get("email", ""),
            "name": user_info.get("name", ""),
            "picture": user_info.get("picture", "")
        }
        token = create_jwt(token_data)
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
                      max_results: int = Query(100, alias="maxResults")):
    try:
        access_token = user["access_token"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"labelIds": ["INBOX"], "q": "newer_than:14d", "maxResults": max_results}
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

@app.post("/emails/{message_id}/mark-read")
async def mark_email_read(message_id: str, user=Depends(get_current_user)):
    try:
        access_token = user["access_token"]
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}/modify",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"removeLabelIds": ["UNREAD"]},
            )
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="token_expired")
            if resp.status_code in (400, 403):
                raise HTTPException(
                    status_code=resp.status_code,
                    detail="gmail_modify_permission_required",
                )
            if resp.status_code >= 400:
                raise HTTPException(status_code=resp.status_code, detail=resp.text)
            data = resp.json()
        return {
            "status": "ok",
            "id": data.get("id", message_id),
            "labels": data.get("labelIds", []),
            "is_read": "UNREAD" not in data.get("labelIds", []),
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Mark read error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/emails/{message_id}/reply")
async def send_email_reply(message_id: str, request: Request, user=Depends(get_current_user)):
    body = await request.json()
    reply_text = (body.get("reply_text") or "").strip()
    if not reply_text:
        raise HTTPException(status_code=400, detail="reply_text_required")

    try:
        access_token = user["access_token"]
        user_email = user.get("email", "")

        async with httpx.AsyncClient() as client:
            original_resp = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "format": "metadata",
                    "metadataHeaders": ["Subject", "From", "Message-ID", "References"],
                },
            )
            if original_resp.status_code == 401:
                raise HTTPException(status_code=401, detail="token_expired")
            if original_resp.status_code >= 400:
                raise HTTPException(status_code=original_resp.status_code, detail=original_resp.text)

            original = original_resp.json()
            headers = original.get("payload", {}).get("headers", [])

            def header_value(name, default=""):
                return next(
                    (h.get("value", "") for h in headers if h.get("name", "").lower() == name.lower()),
                    default,
                )

            subject = header_value("Subject", "No Subject")
            from_header = header_value("From", "")
            references = header_value("References", "")
            original_message_id = header_value("Message-ID", "")
            _, to_email = parse_from(from_header)

            if not to_email:
                raise HTTPException(status_code=400, detail="missing_recipient")

            reply_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"
            message = EmailMessage()
            message["To"] = to_email
            message["Subject"] = reply_subject
            if original_message_id:
                message["In-Reply-To"] = original_message_id
                message["References"] = f"{references} {original_message_id}".strip()
            plain_reply, html_reply = format_reply_bodies(reply_text)
            message.set_content(plain_reply)
            message.add_alternative(html_reply, subtype="html")

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
            send_resp = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"raw": raw, "threadId": original.get("threadId")},
            )
            if send_resp.status_code == 401:
                raise HTTPException(status_code=401, detail="token_expired")
            if send_resp.status_code in (400, 403):
                raise HTTPException(
                    status_code=send_resp.status_code,
                    detail="gmail_send_permission_required",
                )
            if send_resp.status_code >= 400:
                raise HTTPException(status_code=send_resp.status_code, detail=send_resp.text)
            sent = send_resp.json()

        increment_user_stats(user_email, replies=1)
        return {
            "status": "sent",
            "id": sent.get("id"),
            "threadId": sent.get("threadId", original.get("threadId")),
            "to": to_email,
            "subject": reply_subject,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Send reply error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


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

@app.get("/ai/cache")
async def get_all_cached_results(user=Depends(get_current_user)):
    user_email = user.get("email", "")
    ai_results = {}
    try:
        results_ref = fs.collection("email_ai").document(user_email).collection("results")
        docs = results_ref.stream()
        for doc in docs:
            ai_results[doc.id] = doc.to_dict()
    except Exception as e:
        print(f"Error fetching cache: {e}")
    return {"cached": ai_results}

async def analyze_single_email_helper(email_id: str, from_name: str, subject: str, body_preview: str, from_email: str, user_email: str, force_groq: bool = False) -> dict:
    if body_preview:
        body_preview = re.sub(r'<style[^>]*>.*?</style>', '', body_preview, flags=re.DOTALL)
        body_preview = re.sub(r'\.[\w-]+\s*\{[^}]*\}', '', body_preview)
        body_preview = re.sub(r'[\w-]+:\s*[\w#%.,\s]+;', '', body_preview)
        body_preview = re.sub(r'<[^>]+>', '', body_preview)
        body_preview = re.sub(r'\s+', ' ', body_preview).strip()

    loop = asyncio.get_event_loop()
    try:
        # Step 0: Check Firestore cache first to avoid redundant local and Groq runs
        cached = await loop.run_in_executor(None, get_cached_email_ai_result, user_email, email_id)
        if cached:
            has_real_summary = (
                cached.get("summary") and 
                not cached.get("summary", "").startswith("FYI email from") and 
                not cached.get("summary", "").startswith("Low priority update") and
                not cached.get("summary", "").startswith("Email from")
            )
            if not force_groq or has_real_summary:
                print(f"Bypassing AI analysis for {email_id} - Returning Cached Firestore Result!")
                cached["email_id"] = email_id
                return cached

        # Step 1: Run classify_email for priority/urgency
        classification = classify_email(subject, body_preview, from_email)
        if not classification:
            classification = {
                "priority": "normal",
                "requires_reply": False,
                "deadline": None,
                "reason": "Could not classify"
            }

        # Step 2: Optimize Groq calls - only call Groq for urgent or reply-required emails, unless force_groq is True
        needs_groq = force_groq or classification["priority"] == "urgent" or classification["requires_reply"]
        
        summary = ""
        draft = ""
        
        if needs_groq:
            combined_prompt = f"""For this email write:
1. SUMMARY: 2 sentences about what it is and what action is needed
2. DRAFT: 3 sentence professional reply signed as Yeshwanth

From: {from_name}
Subject: {subject}
Preview: {body_preview[:300]}

Reply in this exact format:
SUMMARY: <2 sentences>
DRAFT: <3 sentences>"""

            raw = await loop.run_in_executor(
                None,
                partial(call_groq, combined_prompt,
                "You are an email assistant. Follow the format exactly.",
                300)
            )

            if raw:
                if "SUMMARY:" in raw and "DRAFT:" in raw:
                    parts = raw.split("DRAFT:")
                    summary = parts[0].replace("SUMMARY:", "").strip()
                    draft = parts[1].strip()
                else:
                    summary = raw[:200]
                    draft = f"Hi {from_name},\n\nThank you for your email. I will get back to you shortly.\n\nBest,\nYeshwanth"
        else:
            # Local high-speed summarization to avoid API calls
            if classification["priority"] == "low":
                summary = f"Low priority update/newsletter from {from_name} regarding {subject}."
                draft = ""
            else:
                summary = f"FYI email from {from_name} about {subject}."
                draft = ""

        is_urgent       = classification["priority"] == "urgent"
        has_valid_draft = bool(draft)

        result = {
            "email_id":      email_id,
            "priority":      classification["priority"],
            "reason":        classification["reason"],
            "deadline":      classification["deadline"],
            "requires_reply":classification["requires_reply"],
            "summary":       summary or body_preview[:200],
            "draft_reply":   draft,
            "analyzed_at":   datetime.now(timezone.utc).isoformat()   # for live deadline countdown
        }

        # Build activity item for the feed
        icon = "🚨" if is_urgent else ("✅" if classification["priority"] == "low" else "✉️")
        text_desc = "Analyzed urgent email" if is_urgent else ("Analyzed low priority email" if classification["priority"] == "low" else "Analyzed email")
        activity_item = {
            "icon":     icon,
            "text":     text_desc,
            "time":     datetime.now(timezone.utc).strftime("%H:%M"),
            "priority": classification["priority"]
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
            "requires_reply": False, "summary": f"Email from {from_name} about {subject}.",
            "draft_reply": f"Hi {from_name},\n\nThank you for your email. I'll get back to you soon.\n\nBest, Yeshwanth"
        }


@app.post("/ai/analyze")
async def analyze_email(request: Request, user=Depends(get_current_user)):
    body         = await request.json()
    from_name    = body.get("from_name", "")
    subject      = body.get("subject", "")
    body_preview = body.get("body_preview", "")
    email_id     = body.get("email_id", "")
    from_email   = body.get("from_email", "")
    user_email   = user.get("email", "")

    return await analyze_single_email_helper(
        email_id=email_id,
        from_name=from_name,
        subject=subject,
        body_preview=body_preview,
        from_email=from_email,
        user_email=user_email
    )


@app.post("/ai/analyze-batch")
async def analyze_batch(request: Request, user=Depends(get_current_user)):
    body       = await request.json()
    emails_to_analyze = [e for e in body.get("emails", []) 
                          if not e.get("is_read", True)][:10]

    if len(emails_to_analyze) < 10:
        read_emails = [e for e in body.get("emails", []) 
                        if e.get("is_read", True)]
        emails_to_analyze += read_emails[:10-len(emails_to_analyze)]
    emails = emails_to_analyze

    print(f"Analyzing batch of {len(emails)} emails")
    user_email = user.get("email", "")
    results    = {}

    total_analyzed = total_urgent = total_replies = 0
    activity_items = []

    loop = asyncio.get_event_loop()

    for email in emails:
        try:
            email_id     = email.get("id", "")
            from_name    = email.get("from_name", "")
            subject      = email.get("subject", "")
            body_preview = email.get("body_preview", "")
            if body_preview:
                body_preview = re.sub(r'<style[^>]*>.*?</style>', '', body_preview, flags=re.DOTALL)
                body_preview = re.sub(r'\.[\w-]+\s*\{[^}]*\}', '', body_preview)
                body_preview = re.sub(r'[\w-]+:\s*[\w#%.,\s]+;', '', body_preview)
                body_preview = re.sub(r'<[^>]+>', '', body_preview)
                body_preview = re.sub(r'\s+', ' ', body_preview).strip()
            from_email   = email.get("from_email", "")

            # Step 0: Check Firestore cache first to avoid redundant runs
            cached = await loop.run_in_executor(None, get_cached_email_ai_result, user_email, email_id)
            if cached:
                print(f"Bypassing AI batch analysis for {email_id} - Using Cached Result!")
                results[email_id] = cached
                continue

            # Step 1: Run classify_email for priority/urgency
            classification = classify_email(subject, body_preview, from_email)
            if not classification:
                classification = {
                    "priority": "normal",
                    "requires_reply": False,
                    "deadline": None,
                    "reason": "Could not classify"
                }

            # Step 2: Optimize Groq calls - only call Groq for urgent or reply-required emails
            needs_groq = classification["priority"] == "urgent" or classification["requires_reply"]
            
            summary = ""
            draft = ""
            
            if needs_groq:
                combined_prompt = f"""For this email write:
1. SUMMARY: 2 sentences about what it is and what action is needed
2. DRAFT: 3 sentence professional reply signed as Yeshwanth

From: {from_name}
Subject: {subject}
Preview: {body_preview[:300]}

Reply in this exact format:
SUMMARY: <2 sentences>
DRAFT: <3 sentences>"""

                raw = await loop.run_in_executor(
                    None,
                    partial(call_groq, combined_prompt,
                    "You are an email assistant. Follow the format exactly.",
                    300)
                )

                if raw:
                    if "SUMMARY:" in raw and "DRAFT:" in raw:
                        parts = raw.split("DRAFT:")
                        summary = parts[0].replace("SUMMARY:", "").strip()
                        draft = parts[1].strip()
                    else:
                        summary = raw[:200]
                        draft = f"Hi {from_name},\n\nThank you for your email. I will get back to you shortly.\n\nBest,\nYeshwanth"
            else:
                # Local high-speed summarization to avoid API calls
                if classification["priority"] == "low":
                    summary = f"Low priority update/newsletter from {from_name} regarding {subject}."
                    draft = ""
                else:
                    summary = f"FYI email from {from_name} about {subject}."
                    draft = ""

            is_urgent       = classification["priority"] == "urgent"
            has_valid_draft = bool(draft)

            result = {
                "priority":      classification["priority"],
                "reason":        classification["reason"],
                "deadline":      classification["deadline"],
                "requires_reply":classification["requires_reply"],
                "summary":       summary or body_preview[:200],
                "draft_reply":   draft,
                "analyzed_at":   datetime.now(timezone.utc).isoformat()
            }
            results[email_id] = result

            # Accumulate
            total_analyzed += 1
            if is_urgent:    total_urgent  += 1
            if has_valid_draft: total_replies += 1

            icon = "🚨" if is_urgent else ("✅" if classification["priority"] == "low" else "✉️")
            text_desc = "Analyzed urgent email" if is_urgent else ("Analyzed low priority email" if classification["priority"] == "low" else "Analyzed email")
            activity_items.append({
                "icon":     icon,
                "text":     text_desc,
                "time":     datetime.now(timezone.utc).strftime("%H:%M"),
                "priority": classification["priority"]
            })

            # Save individual AI result to Firestore (non-blocking)
            loop.run_in_executor(None, partial(
                save_email_ai_result, user_email, email_id, result
            ))

            await asyncio.sleep(1.5)

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
