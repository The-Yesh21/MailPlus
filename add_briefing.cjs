const fs = require('fs');
const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\server\\main.py';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add new imports
if (!content.includes('from fastapi.staticfiles import StaticFiles')) {
    content = content.replace('from fastapi import FastAPI, Request, HTTPException, Depends, Query', 'from fastapi import FastAPI, Request, HTTPException, Depends, Query\nfrom fastapi.staticfiles import StaticFiles\nfrom gtts import gTTS\nimport uuid\nimport aiofiles');
}

// 2. Add StaticFiles mount after app = FastAPI()
if (!content.includes('app.mount("/audio"')) {
    content = content.replace('app = FastAPI()', 'app = FastAPI()\nimport os\nos.makedirs("audio", exist_ok=True)\napp.mount("/audio", StaticFiles(directory="audio"), name="audio")');
}

// 3. Add the /ai/generate-morning-briefing endpoint
const briefingEndpoint = `
@app.post("/ai/generate-morning-briefing")
async def generate_morning_briefing(request: Request, user=Depends(get_current_user)):
    body = await request.json()
    emails = body.get("emails", [])
    if not emails:
        raise HTTPException(status_code=400, detail="No emails provided")
        
    # Build prompt from emails
    summaries_text = "\\n".join([f"- {e.get('subject', '')}: {e.get('summary', '')}" for e in emails[:5]])
    
    prompt = f"""You are a highly motivating, energetic AI assistant. Write a short, powerful morning audio briefing script (max 3-4 sentences) summarizing these emails. 
Start with an encouraging morning greeting, summarize the key urgent things to do today, and end on a high note. 
Do not use emojis or markdown, this will be read by a Text-to-Speech engine. Make it sound natural and spoken.
Emails:
{summaries_text}
"""
    
    loop = asyncio.get_event_loop()
    # Use the existing Groq engine to generate the spoken script
    script = await loop.run_in_executor(
        None,
        partial(call_groq, prompt, "You are an expert audio scriptwriter.", 300)
    )
    
    if not script:
        script = "Good morning! You have a few important updates to check in your inbox today. Have a great day!"
        
    # Generate TTS
    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = os.path.join("audio", filename)
    
    tts = gTTS(text=script, lang='en', tld='com')
    # Save the file (blocking call run in executor)
    await loop.run_in_executor(None, tts.save, filepath)
    
    # Return the URL
    frontend_url = request.base_url
    # Ensure it uses the server host/port, though request.base_url usually does
    audio_url = f"{frontend_url}audio/{filename}"
    
    return {"url": audio_url, "script": script}
`;

if (!content.includes('/ai/generate-morning-briefing')) {
    content = content.replace('# ── Routes ────────────────────────────────────────────────────────────────────', '# ── Routes ────────────────────────────────────────────────────────────────────\n' + briefingEndpoint);
}

fs.writeFileSync(filepath, content);
console.log('Added /ai/generate-morning-briefing to main.py');
