const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\App.jsx';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add states
if (!content.includes('const [briefingAudioUrl, setBriefingAudioUrl]')) {
    content = content.replace(
        'const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);',
        'const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);\n  const [briefingAudioUrl, setBriefingAudioUrl] = useState(null);\n  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);'
    );
}

// 2. Add generateAndSendBriefing function
const funcRegex = /const generateAndSendBriefing = async \(\) => \{[^]+?\};/s;
const funcCode = `const generateAndSendBriefing = async () => {
    setIsGeneratingBriefing(true);
    try {
      const urgentEmails = mails
        .filter(m => aiResults[m.id]?.priority === 'urgent' || aiResults[m.id]?.priority === 'high')
        .map(m => ({ subject: m.subject, summary: aiResults[m.id]?.summary || m.snippet }));
      
      const payload = urgentEmails.length > 0 ? urgentEmails : mails.slice(0, 5).map(m => ({ subject: m.subject, summary: aiResults[m.id]?.summary || m.snippet }));

      const token = localStorage.getItem('mp_token');
      const res = await fetch(\`\${API_BASE}/ai/generate-morning-briefing\`, {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emails: payload })
      });
      
      if (!res.ok) throw new Error("Failed to generate briefing");
      const data = await res.json();
      setBriefingAudioUrl(data.url);
      
      const message = encodeURIComponent(\`🎙️ *MailPulse Morning Briefing*\\n\\nHere is your AI audio briefing for today:\\n\${data.url}\\n\\nScript:\\n\${data.script}\`);
      window.open(\`https://wa.me/?text=\${message}\`, '_blank');
      
      setStatsData(prev => ({ ...prev, voice_briefings_sent: (prev.voice_briefings_sent || 0) + 1 }));
    } catch (error) {
      console.error("Briefing error:", error);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };`;

if (!content.includes('generateAndSendBriefing = async ()')) {
    content = content.replace('const handleLogin = () => {', funcCode + '\n\n  const handleLogin = () => {');
} else {
    content = content.replace(funcRegex, funcCode);
}

// 3. Replace voice-bar
const voiceBarRegex = /<div className="voice-bar">[^]+?<\/button>\s*<\/div>/s;
const newVoiceBar = `<div className="voice-bar">
                  <div className="play-circle" onClick={() => {
                    if (briefingAudioUrl) {
                      const audio = new Audio(briefingAudioUrl);
                      audio.play();
                    }
                    setIsPlayingBriefing(!isPlayingBriefing)
                  }}>
                    {isPlayingBriefing ? <span>||</span> : <span>▶</span>}
                  </div>
                  <div className="briefing-meta">
                    <span className="briefing-title">Morning briefing</span>
                    <span className="briefing-sub">Tap Send to generate</span>
                  </div>
                  <div className="waveform">
                    {[...Array(24)].map((_, i) => (
                      <div 
                        key={i} 
                        className={\`wave-bar \${isPlayingBriefing ? 'active' : ''}\`} 
                        style={{ 
                          height: isPlayingBriefing ? '' : \`\${[8,14,10,18,12,20,10,16,8,22,12,18,8,20,14,24,10,18,8,12,6,16,10,14][i]}px\`,
                          animationDelay: \`\${i * 0.05}s\` 
                        }}
                      ></div>
                    ))}
                  </div>
                  <button className="whatsapp-btn" onClick={generateAndSendBriefing} disabled={isGeneratingBriefing} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    {isGeneratingBriefing ? <div className="spinner" style={{width:'14px',height:'14px',borderWidth:'2px'}}></div> : <span>✉</span>}
                    {isGeneratingBriefing ? "Generating..." : "Send to WhatsApp"}
                  </button>
                </div>`;

if (voiceBarRegex.test(content)) {
    content = content.replace(voiceBarRegex, newVoiceBar);
} else {
    console.log("Could not find voice bar to replace");
}

fs.writeFileSync(filepath, content);
console.log('App.jsx updated with Voice Briefing logic');
