const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\server\\main.py';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Fix HF_TOKEN definition
if (!content.includes('HF_TOKEN')) {
    // If it's totally missing from the env section
    content = content.replace(
        'SECRET_KEY           = os.getenv("SECRET_KEY", "fallback-secret-key")',
        'SECRET_KEY           = os.getenv("SECRET_KEY", "fallback-secret-key")\nHF_TOKEN             = os.getenv("HF_TOKEN")'
    );
}

// 2. Fix GROQ_API_KEY if it's still there
content = content.replace('GROQ_API_KEY         = os.getenv("GROQ_API_KEY")', 'HF_TOKEN             = os.getenv("HF_TOKEN")');

// 3. Fix analyze-batch endpoint
const batchRegex = /raw = await loop\.run_in_executor\([^]*?data\.get\("draft_reply", "Could not generate draft\."\)/;

const newBatchLogic = `data = await loop.run_in_executor(
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
                "draft_reply":   data.get("draft_reply", "Could not generate draft.")`;

if (batchRegex.test(content)) {
    content = content.replace(batchRegex, newBatchLogic);
    console.log("Fixed analyze-batch");
} else {
    console.log("Could not find analyze-batch logic to replace");
}

fs.writeFileSync(filepath, content);
console.log('Fixed main.py completely');
