const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\server\\main.py';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Update imports
if (content.includes('from gtts import gTTS')) {
    content = content.replace('from gtts import gTTS', 'from elevenlabs.client import ElevenLabs');
} else if (!content.includes('ElevenLabs')) {
    content = content.replace('import os', 'import os\nfrom elevenlabs.client import ElevenLabs');
}

// 2. Initialize ElevenLabs client
if (!content.includes('elevenlabs_client = ElevenLabs')) {
    content = content.replace('load_dotenv()', 'load_dotenv()\n\nelevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))\n');
}

// 3. Update the TTS generation in the endpoint
const ttsRegex = /tts = gTTS\(text=script, lang='en', tld='com'\)\s*# Save the file \(blocking call run in executor\)\s*await loop\.run_in_executor\(None, tts\.save, filepath\)/;

const newTtsLogic = `def generate_elevenlabs_audio(script_text, out_path):
        audio_generator = elevenlabs_client.text_to_speech.convert(
            voice_id="1SM7GgM6IMuvQlz2BwM3",
            text=script_text,
            model_id="eleven_v3",
            language_code="en"
        )
        with open(out_path, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)

    # Save the file (blocking call run in executor)
    await loop.run_in_executor(None, generate_elevenlabs_audio, script, filepath)`;

if (ttsRegex.test(content)) {
    content = content.replace(ttsRegex, newTtsLogic);
    console.log("Updated TTS logic to ElevenLabs");
} else {
    console.log("Regex did not match TTS generation code");
}

fs.writeFileSync(filepath, content);
console.log("main.py updated with ElevenLabs");
