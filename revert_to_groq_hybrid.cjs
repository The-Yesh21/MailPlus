const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\server\\main.py';
let content = fs.readFileSync(filepath, 'utf8');

// Ensure Groq is imported
if (!content.includes('from groq import Groq')) {
    content = content.replace('import httpx', 'import httpx\nfrom groq import Groq');
}

// Add GROQ_API_KEY back if missing
if (!content.includes('GROQ_API_KEY')) {
    content = content.replace('HF_TOKEN             = os.getenv("HF_TOKEN")', 'GROQ_API_KEY         = os.getenv("GROQ_API_KEY")\nHF_TOKEN             = os.getenv("HF_TOKEN")');
}

const hfLogicRegex = /# ── Hugging Face API ──[^]+?return \{\s*"priority": priority,\s*"reason": reason,\s*"deadline": deadline,\s*"requires_reply": requires_reply,\s*"summary": summary,\s*"draft_reply": "Not available via HF summarize model\."\s*\}/s;

const groqHybridLogic = `# ── Groq Hybrid Engine ──────────────────────────────────────────────────────

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
    deadline_match = re.search(r'within the next (\\d+)\\s+(hours?|minutes?|days?)', text_to_analyze, re.IGNORECASE)
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
    }`;

if (hfLogicRegex.test(content)) {
    content = content.replace(hfLogicRegex, groqHybridLogic);
    fs.writeFileSync(filepath, content);
    console.log("Successfully reverted to Groq Hybrid Engine");
} else {
    console.log("Regex did not match");
}
