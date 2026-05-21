const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\server\\main.py';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Update imports
content = content.replace(
    'from elevenlabs.client import ElevenLabs',
    'import numpy as np\nimport soundfile as sf\nimport io\nfrom kokoro import KPipeline'
);

// 2. Initialize Kokoro
content = content.replace(
    'elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))',
    `kokoro_pipeline = None

def get_kokoro_pipeline():
    global kokoro_pipeline
    if kokoro_pipeline is None:
        print("Loading Kokoro TTS pipeline...")
        kokoro_pipeline = KPipeline(lang_code='a')
        print("Kokoro TTS ready!")
    return kokoro_pipeline`
);

// 3. Update the TTS generation in the endpoint
const endpointRegex = /filename = f"\{uuid\.uuid4\(\)\.hex\}\.mp3"[\s\S]*?await loop\.run_in_executor\(None, generate_elevenlabs_audio, script, filepath\)/;

const newEndpointLogic = `filename = f"{uuid.uuid4().hex}.wav"
    filepath = os.path.join("audio", filename)
    
    def generate_kokoro_audio(script_text, out_path):
        try:
            pipeline = get_kokoro_pipeline()
            generator = pipeline(script_text, voice='af_sarah', speed=1.0)
            
            audio_chunks = []
            for i, (gs, ps, audio) in enumerate(generator):
                audio_chunks.append(audio)
            
            if not audio_chunks:
                print("No audio chunks generated")
                return
            
            full_audio = np.concatenate(audio_chunks)
            sf.write(out_path, full_audio, 24000, format='WAV')
            print(f"Generated kokoro audio to {out_path}")
        except Exception as e:
            print(f"Kokoro TTS error: {e}")

    # Save the file (blocking call run in executor)
    await loop.run_in_executor(None, generate_kokoro_audio, script, filepath)`;

if (endpointRegex.test(content)) {
    content = content.replace(endpointRegex, newEndpointLogic);
    console.log("Updated TTS logic to Kokoro");
} else {
    console.log("Regex did not match TTS generation code. Current file content does not match expected format.");
}

fs.writeFileSync(filepath, content);
console.log("main.py updated with Kokoro");
