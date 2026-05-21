const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\server\\main.py';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add requests to imports
if (!content.includes('import requests')) {
    content = content.replace('import json', 'import json\nimport requests');
}

// 2. Remove Groq imports & setup
content = content.replace('from groq import Groq\n', '');
content = content.replace('GROQ_API_KEY = os.getenv("GROQ_API_KEY")\n', 'HF_TOKEN = os.getenv("HF_TOKEN")\n');

// 3. Replace Groq block with Hugging Face logic
const groqRegex = /# ── Groq ──.+?# ── Routes ──/s;

const hfLogic = `# ── Hugging Face API ────────────────────────────────────────────────────────
import time

def call_hf_api(api_url: str, payload: dict, max_retries=3):
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    for attempt in range(max_retries):
        try:
            response = requests.post(api_url, headers=headers, json=payload, timeout=15)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 503:
                # Model is loading
                print(f"HF Model loading, waiting {2 * (attempt + 1)}s...")
                time.sleep(2 * (attempt + 1))
                continue
            else:
                print(f"HF API Error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"HF Request Error: {e}")
            return None
    return None

def analyze_email_hf(from_name, subject, body_preview):
    text_to_analyze = f"From: {from_name}. Subject: {subject}. Body: {body_preview[:800]}"
    
    # 1. Summarization
    summary_model = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
    summary_res = call_hf_api(summary_model, {"inputs": text_to_analyze})
    summary = "Could not generate summary."
    if summary_res and isinstance(summary_res, list) and len(summary_res) > 0:
        summary = summary_res[0].get('summary_text', summary)

    # 2. Categorization (Zero-shot)
    cat_model = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"
    cat_payload = {
        "inputs": text_to_analyze,
        "parameters": {"candidate_labels": ["urgent action required", "meeting or scheduling", "newsletter or fyi"]}
    }
    cat_res = call_hf_api(cat_model, cat_payload)
    
    priority = "normal"
    reason = "Categorized based on context"
    requires_reply = False
    
    if cat_res and 'labels' in cat_res and len(cat_res['labels']) > 0:
        top_label = cat_res['labels'][0]
        if top_label == "urgent action required":
            priority = "urgent"
            reason = "Action required"
            requires_reply = True
        elif top_label == "newsletter or fyi":
            priority = "low"
            reason = "Informational / FYI"

    # 3. Deterministic Deadline Parsing
    deadline = None
    deadline_match = re.search(r'within the next (\\d+)\\s+(hours?|minutes?|days?)', text_to_analyze, re.IGNORECASE)
    if deadline_match:
        deadline = f"within the next {deadline_match.group(1)} {deadline_match.group(2)}"
    elif re.search(r'by tomorrow', text_to_analyze, re.IGNORECASE):
        deadline = "by tomorrow"
    elif re.search(r'deadline', text_to_analyze, re.IGNORECASE):
        # Fallback if the word deadline is there
        deadline = "Action required"
        priority = "urgent"

    return {
        "priority": priority,
        "reason": reason,
        "deadline": deadline,
        "requires_reply": requires_reply,
        "summary": summary,
        "draft_reply": "Not available via HF summarize model."
    }

# ── Routes ──`;

if (groqRegex.test(content)) {
    content = content.replace(groqRegex, hfLogic);
} else {
    console.log("Could not find Groq block");
}

// 4. Update `/ai/analyze` logic to use analyze_email_hf
const analyzeEndpointRegex = /raw = await loop\.run_in_executor\([^]+?data\.get\("draft_reply", "Could not generate draft\."\)/;

const newAnalyzeEndpoint = `data = await loop.run_in_executor(
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
            "draft_reply":   data.get("draft_reply", "Could not generate draft.")`;

if (analyzeEndpointRegex.test(content)) {
    content = content.replace(analyzeEndpointRegex, newAnalyzeEndpoint);
} else {
    console.log("Could not find analyze endpoint block");
}

fs.writeFileSync(filepath, content);
console.log('Successfully updated main.py for Hugging Face');
