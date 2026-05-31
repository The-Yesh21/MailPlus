import React, { useState, useEffect, useRef, useMemo } from 'react';
import Landing from './src/Landing';
import DigestView from './src/DigestView';

const EmailPreview = ({ html }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);
    const content = hasHtmlTags ? html : `<p>${html.replace(/\n/g, '<br/>')}</p>`;

    const srcDoc = `
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset="utf-8">
      <base target="_blank">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
          font-size: 14px; 
          line-height: 1.6; 
          color: #C9D1D9; 
          background: transparent; 
          margin: 0;
          word-wrap: break-word;
        }
        img { max-width: 100%; height: auto; }
        a { color: #FF9F0A; }
        * { max-width: 100%; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363D; border-radius: 2px; }
      </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `;

    iframeRef.current.srcdoc = srcDoc;
  }, [html]);

  const handleLoad = (e) => {
    const iframe = e.target;
    if (iframe.contentDocument && iframe.contentDocument.body) {
      iframe.style.height = Math.min(iframe.contentDocument.body.scrollHeight, 400) + 'px';
    }
  };

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      style={{ width: '100%', border: 'none', minHeight: '100px', display: 'block' }}
      onLoad={handleLoad}
      title="Email Preview"
    />
  );
};

const useCounter = (end, duration = 1000, start = 0) => {
  const [count, setCount] = useState(start);
  useEffect(() => {
    let startTime = null;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * (end - start) + start));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration, start]);
  return count;
};

// ── Live Deadline Countdown ──────────────────────────────────────────────────
const parseDeadlineMs = (deadlineStr) => {
  if (!deadlineStr) return null;
  const s = deadlineStr.toLowerCase();
  const map = [
    [/(\d+)\s*hour/,   h => h * 3600000],
    [/(\d+)\s*day/,    d => d * 86400000],
    [/(\d+)\s*minute/, m => m * 60000],
    [/(\d+)\s*week/,   w => w * 604800000],
    [/end of (today|day)/, () => {
      const eod = new Date(); eod.setHours(23, 59, 59, 0); return eod.getTime() - Date.now();
    }],
    [/tomorrow/, () => 86400000],
    [/tonight/,  () => {
      const midnight = new Date(); midnight.setHours(23, 59, 0, 0); return midnight.getTime() - Date.now();
    }],
  ];
  for (const [pattern, calc] of map) {
    const m = s.match(pattern);
    if (m) return typeof calc === 'function' ? calc(parseInt(m[1]) || 1) : calc(1);
  }
  return null;
};

// Returns true if the deadline has already passed given the email's received time
const isDeadlineExpired = (deadlineStr, emailDate) => {
  if (!deadlineStr) return false;
  const durationMs = parseDeadlineMs(deadlineStr);
  if (!durationMs) return false;
  const baseTime = emailDate
    ? (typeof emailDate === 'number' ? emailDate : new Date(emailDate).getTime())
    : Date.now();
  return (baseTime + durationMs) < Date.now();
};

// Returns a short human label for the original deadline duration e.g. "12h", "2d", "30m"
const formatDuration = (ms) => {
  if (!ms) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60)  return `${mins}m`;
  const hrs = Math.round(ms / 3600000);
  if (hrs < 24)   return `${hrs}h`;
  const days = Math.round(ms / 86400000);
  return `${days}d`;
};

const DeadlineCountdown = ({ deadline, analyzedAt, emailDate }) => {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!deadline) return;
    const durationMs = parseDeadlineMs(deadline);
    if (!durationMs) return;

    // Use email received time first (most accurate), then analyzed_at, then now
    const baseTime = emailDate
      ? (typeof emailDate === 'number' ? emailDate : new Date(emailDate).getTime())
      : analyzedAt
        ? new Date(analyzedAt).getTime()
        : Date.now();

    const expiresAt = baseTime + durationMs;
    const update = () => setRemaining(expiresAt - Date.now());
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [deadline, analyzedAt, emailDate]);

  const formatRemaining = (ms) => {
    if (ms <= 0) return { text: 'Deadline passed', color: '#8b0000' };
    const hrs  = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const days = Math.floor(ms / 86400000);
    const text = days >= 1 ? `${days}d ${hrs % 24}h left`
               : hrs >= 1  ? `${hrs}h ${mins}m left`
               :              `${mins}m left`;
    const color = ms < 2 * 3600000 ? '#FF2A55'
                : ms < 6 * 3600000 ? '#FF9F0A'
                : '#32ADE6';
    return { text, color };
  };

  // Can't parse the deadline string — just show raw AI text
  if (remaining === null) {
    return <div className="deadline-chip">🕒 Deadline: {deadline}</div>;
  }

  const { text, color } = formatRemaining(remaining);
  const durationMs   = parseDeadlineMs(deadline);
  const originalLabel = formatDuration(durationMs);  // e.g. "12h"
  const baseTime = emailDate
    ? (typeof emailDate === 'number' ? emailDate : new Date(emailDate).getTime())
    : analyzedAt ? new Date(analyzedAt).getTime() : Date.now();
  const expiresAt  = durationMs ? new Date(baseTime + durationMs) : null;
  const expiresStr = expiresAt
    ? expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="deadline-chip" style={{ borderColor: color, color, background: `${color}18` }}>
      🕒 {text}
      {originalLabel && (
        <span style={{ opacity: 0.55, fontSize: '11px', marginLeft: '6px' }}>
          of {originalLabel} deadline
        </span>
      )}
      {expiresStr && (
        <span style={{ opacity: 0.55, fontSize: '11px', marginLeft: '6px' }}>
          · expires {expiresStr}
        </span>
      )}
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────


const StatCard = ({ label, val, trend, icon, className, index }) => {
  const numVal = parseInt(String(val).replace(/,/g, '')) || 0;
  const animatedVal = useCounter(numVal, 1500 + index * 200);
  const displayVal = animatedVal.toLocaleString();

  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <span className={`stat-trend ${index === 0 ? 'trend-up' : 'trend-neutral'}`}>{trend}</span>
      </div>
      <div className="stat-value">{displayVal}</div>
      <div className="stat-label">{label}</div>
      <svg className="sparkline" viewBox="0 0 100 30">
        <path
          d={`M0,25 Q15,${20-index*2} 30,22 T60,${15+index} T100,${10+index*3}`}
          fill="none" stroke="currentColor" strokeWidth="2"
          style={{ opacity: 0.3, color: index === 0 ? 'var(--amber)' : (index === 1 ? 'var(--teal)' : 'inherit') }}
        />
      </svg>
    </div>
  );
};


const getSenderColor = (name) => {
  if (!name) return '#5E5CE6';
  const colors = ['#FF9F0A', '#32ADE6', '#5E5CE6', '#FF6B6B', '#A06BFF', '#00D1FF'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const decodeHtmlEntities = (text) => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const renderFormattedDraft = (text) => {
  if (!text) return null;
  return text.split(/\n\s*\n/).filter(Boolean).map((paragraph, paragraphIndex) => (
    <p key={`p-${paragraphIndex}`}>
      {paragraph.split('\n').map((line, lineIndex) => (
        <React.Fragment key={`l-${paragraphIndex}-${lineIndex}`}>
          {line.split(/(\*\*.*?\*\*)/g).filter(Boolean).map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={`b-${paragraphIndex}-${lineIndex}-${partIndex}`}>{part.slice(2, -2)}</strong>;
            }
            return <React.Fragment key={`t-${paragraphIndex}-${lineIndex}-${partIndex}`}>{part}</React.Fragment>;
          })}
          {lineIndex < paragraph.split('\n').length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  ));
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-error-container">
          <div className="error-panel">
            <div className="error-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p>The application encountered an unexpected error.</p>
            <button className="btn-send" onClick={() => window.location.reload()}>Reload MailPulse</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  const [user, setUser] = useState(null);

  const [mails, setMails] = useState([]);
  const [selectedMailId, setSelectedMailId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  const [briefingAudioUrl, setBriefingAudioUrl] = useState(null);
  const [isGeneratingBriefing, setIsGeneratingBriefing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('Priority Feed');
  const [fullBodies, setFullBodies] = useState({});
  const [isFetchingBody, setIsFetchingBody] = useState(false);
  const [aiResults, setAiResults] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [sendingReplyIds, setSendingReplyIds] = useState(new Set());
  const [dashboardStats, setDashboardStats] = useState({
    total_emails: 0,
    unread_emails: 0,
    estimated_urgent_emails: 0
  });
  const [statsData, setStatsData] = useState({
    emails_analyzed: 0,
    urgent_emails_caught: 0,
    replies_drafted: 0,
    voice_briefings_sent: 0
  });
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [profileImgError, setProfileImgError] = useState(false);
  const [briefingTone, setBriefingTone] = useState(() => localStorage.getItem('mp_tone') || 'energetic');
  const [whatsappNumber, setWhatsappNumber] = useState(() => localStorage.getItem('mp_wa') || '');
  const [whatsappSaved, setWhatsappSaved] = useState(false);

  const [senders, setSenders] = useState([]);
  const [selectedSender, setSelectedSender] = useState(null);
  const [senderEmails, setSenderEmails] = useState([]);
  const [senderSearch, setSenderSearch] = useState('');

  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('07:30');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [voiceGenerated, setVoiceGenerated] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [voiceScript, setVoiceScript] = useState('');
  const [voiceDuration, setVoiceDuration] = useState('');
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [toast, setToast] = useState(null);

  const setEmails = setMails;
  const setSelectedEmail = setSelectedMailId;

  const computeSenders = (emailsList) => {
    const sendersMap = {}
    
    emailsList.forEach(email => {
      const key = (email.from_email || '').toLowerCase().trim()
      
      if (!sendersMap[key]) {
        sendersMap[key] = {
          email: email.from_email,
          name: email.from_name || email.from_email,
          emails: [],
          latestDate: email.date,
          unreadCount: 0,
          urgentCount: 0,
          avatar: (email.from_name || email.from_email || '?').charAt(0).toUpperCase()
        }
      }
      
      sendersMap[key].emails.push(email)
      
      if (!email.is_read) {
        sendersMap[key].unreadCount += 1
      }
    })
    
    const sendersArray = Object.values(sendersMap)
    
    sendersArray.sort((a, b) => {
      const dateA = new Date(a.emails[0].date)
      const dateB = new Date(b.emails[0].date)
      return dateB - dateA
    })
    
    sendersArray.forEach(sender => {
      sender.emails.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      )
      sender.latestDate = sender.emails[0].date
      sender.latestSubject = sender.emails[0].subject
      sender.latestSnippet = sender.emails[0].snippet
    })
    
    return sendersArray
  }

  useEffect(() => {
    if (mails && Array.isArray(mails) && mails.length > 0) {
      const computed = computeSenders(mails)
      setSenders(computed)
    }
  }, [mails])

  useEffect(() => {
    if (senders.length > 0 && Object.keys(aiResults).length > 0) {
      const updated = senders.map(sender => ({
        ...sender,
        urgentCount: sender.emails.filter(e => 
          aiResults[e.id]?.priority === 'urgent'
        ).length
      }))
      setSenders(updated)
    }
  }, [aiResults])

  const filteredSenders = senders.filter(s => 
    (s.name || '').toLowerCase().includes(senderSearch.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(senderSearch.toLowerCase())
  );

  const audioRef = useRef(null);

  const API_BASE = "http://localhost:8000";

  // Auth & Token Management
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('mp_token', token);
      setIsTransitioning(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    const savedToken = localStorage.getItem('mp_token');
    if (savedToken) {
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        setUser({
          name: payload.name,
          email: payload.email,
          picture: payload.picture
        });

        const cachedMails = localStorage.getItem(`mp_mails_${payload.email}`);
        if (cachedMails) {
          try {
            const parsed = JSON.parse(cachedMails);
            setMails(Array.isArray(parsed) ? parsed : []);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSelectedMailId(parsed[0].id);
            }
          } catch (e) {
            console.error("Failed to parse cached mails:", e);
            setMails([]);
          }
        }
      } catch (e) {
        console.error("Token decode error:", e);
        localStorage.removeItem('mp_token');
      }
    }
    setAuthChecked(true);
  }, []);

  const fetchEmails = async () => {
    const token = localStorage.getItem('mp_token');
    if (!token || !user) return;

    if (!mails || (Array.isArray(mails) && mails.length === 0)) setIsLoading(true);
    setGlobalError(null);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE}/emails`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          handleSignOut();
          return;
        }
        throw new Error(`Server responded with ${response.status}`);
      }
      
      const data = await response.json();
      if (!data || !data.emails) {
        throw new Error("Invalid response format from server");
      }

      const newMails = (data.emails || []).map(mail => ({
        ...mail,
        tag: getUrgencyTag(mail)
      }));
      
      setMails(prevMails => {
        // Simple sync: the backend now returns up to 100 emails (read and unread) from the last 14 days
        const combined = [...newMails];
        combined.sort((a, b) => (b.internal_date || 0) - (a.internal_date || 0));
        
        localStorage.setItem(`mp_mails_${user.email}`, JSON.stringify(combined));
        if (!selectedMailId && combined.length > 0) {
          setSelectedMailId(combined[0].id);
        }
        runSmartAnalysis(combined);
        return combined;      });

      const elapsed = Date.now() - startTime;
      if (elapsed < 1200) {
        await new Promise(resolve => setTimeout(resolve, 1200 - elapsed));
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
      setGlobalError("Unable to connect to MailPulse backend");
    } finally {
      setIsLoading(false);
      setIsTransitioning(false);
    }
  };

  const dashboardDynamic = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - (7 * 24 * 60 * 60 * 1000);
    
    const todayMails = mails.filter(m => (m.internal_date || 0) >= todayStart).length;
    const weekMails = mails.filter(m => (m.internal_date || 0) >= weekStart).length;
    
    return {
      emails_today: todayMails || dashboardStats.emails_today || 0,
      emails_this_week: weekMails || dashboardStats.emails_this_week || 0
    };
  }, [mails, dashboardStats]);

  const generateAndSendBriefing = async () => {
    setIsGeneratingBriefing(true);
    try {
      // Send ALL mails with full context — backend will categorize and prioritize
      const payload = mails.slice(0, 30).map(m => ({
        id:            m.id,
        threadId:      m.threadId,
        subject:       m.subject,
        from_name:     m.from_name,
        from_email:    m.from_email,
        snippet:       m.snippet,
        internal_date: m.internal_date,
        is_read:       m.is_read,
        labels:        m.labels || [],
        ai:            aiResults[m.id] || null,
      }));

      const token = localStorage.getItem('mp_token');
      const res = await fetch(`${API_BASE}/ai/generate-morning-briefing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emails: payload, tone: briefingTone })
      });
      
      if (!res.ok) throw new Error("Failed to generate briefing");
      const data = await res.json();
      setBriefingAudioUrl(data.url);
      
      const message = encodeURIComponent(`🎙️ *MailPulse Morning Briefing*\n\nHere is your AI audio briefing for today:\n${data.url}\n\nScript:\n${data.script}`);
      window.open(`https://wa.me/?text=${message}`, '_blank');
      
      setStatsData(prev => ({ ...prev, voice_briefings_sent: (prev.voice_briefings_sent || 0) + 1 }));
    } catch (error) {
      console.error("Briefing error:", error);
    } finally {
      setIsGeneratingBriefing(false);
    }
  };

  const saveWhatsappNumber = async (number) => {
    const token = localStorage.getItem('mp_token');
    if (!token || !number.trim()) return;
    localStorage.setItem('mp_wa', number.trim());
    try {
      await fetch(`${API_BASE}/user/settings`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp_number: number.trim() })
      });
    } catch (e) { /* non-critical */ }
    setWhatsappSaved(true);
    setTimeout(() => setWhatsappSaved(false), 2000);
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`);
      if (!response.ok) throw new Error("Login endpoint failed");
      const { auth_url } = await response.json();
      if (auth_url) window.location.href = auth_url;
    } catch (error) {
      console.error("Login failed:", error);
      alert("Unable to start login process. Is the backend running?");
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('mp_token')
    setUser(null)
    setEmails([])
    setAiResults({})
    setSelectedEmail(null)
    setSenders([])
    window.location.href = '/'
  }

  const getUrgencyTag = (mail) => {
    if (!mail) return null;
    const subject = (mail.subject || "").toLowerCase();
    const urgentKeywords = ["urgent", "asap", "deadline", "action required", "today", "reminder", "follow up"];
    if (urgentKeywords.some(keyword => subject.includes(keyword))) return "urgent";
    if (!mail.is_read) return "new";
    return null;
  };

  const filteredMails = useMemo(() => {
    if (!Array.isArray(mails)) return [];
    if (activeTab === 'Awaiting Reply') return mails.filter(m => !m.is_read);
    if (activeTab === 'Priority Feed') {
      return mails
        .filter(m => {
          if (m.is_read) return false;
          const ai = aiResults[m.id];
          if (!ai) return false;
          // Exclude urgent emails whose deadline has already passed
          if (ai.priority === 'urgent' && isDeadlineExpired(ai.deadline, m.internal_date)) return false;
          return ai.priority === 'urgent' || ai.requires_reply;
        })
        .sort((a, b) => {
          const aiA = aiResults[a.id] || {};
          const aiB = aiResults[b.id] || {};
          if (aiA.priority === 'urgent' && aiB.priority !== 'urgent') return -1;
          if (aiA.priority !== 'urgent' && aiB.priority === 'urgent') return 1;
          if (aiA.requires_reply && !aiB.requires_reply) return -1;
          if (!aiA.requires_reply && aiB.requires_reply) return 1;
          return (b.internal_date || 0) - (a.internal_date || 0);
        });
    }
    return mails;
  }, [mails, activeTab, aiResults]);

  const analyzeEmail = async (mail) => {
    if (!mail) return;
    const token = localStorage.getItem('mp_token');
    if (!token) return;
    const emailId = mail.id;
    setAnalyzingIds(prev => new Set(prev).add(emailId));
    try {
      const response = await fetch(`${API_BASE}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email_id: emailId,
          subject: mail.subject,
          from_name: mail.from_name,
          body_preview: mail.body_preview,
          snippet: mail.snippet
        })
      });
      if (!response.ok) throw new Error("AI analysis failed");
      const data = await response.json();
      // console.log("Single AI analysis result:", data);
      setAiResults(prev => ({ ...prev, [emailId]: data }));
      // Refresh stats from Firestore via backend
      fetchDashboardStats();
      return data;
    } catch (error) {
      console.error("Failed to analyze email:", error);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(emailId);
        return next;
      });
    }
  };

  const getAllCachedResults = async (userEmail) => {
    try {
      const token = localStorage.getItem('mp_token');
      const resp = await fetch(`${API_BASE}/ai/cache`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      return data.cached || {};
    } catch (e) {
      console.error("Cache fetch failed:", e);
      return {};
    }
  };

  const saveAIResult = async (userEmail, msgId, safeData) => {
    // Handled automatically by backend in /ai/analyze and /ai/analyze-batch
    return Promise.resolve();
  };

  const runSmartAnalysis = async (emailsList) => {
    if (!user?.email) return
    
    // Step 1: Load all cached from Firestore first
    const cached = await getAllCachedResults(user.email)
    console.log(`Firestore cache: ${Object.keys(cached).length} results`)
    setAiResults(prev => ({ ...prev, ...cached }))
    
    // Step 2: Find only uncached emails
    const uncached = emailsList.filter(e => !cached[e.id])
    console.log(`Need to analyze: ${uncached.length} emails`)
    
    if (uncached.length === 0) {
      console.log("All cached — no API calls needed!")
      return
    }
    
    // Step 3: Analyze only uncached, top 10
    const toAnalyze = uncached.slice(0, 10)
    setIsAnalyzing(true)
    
    try {
      const token = localStorage.getItem('mp_token');
      const resp = await fetch(`${API_BASE}/ai/analyze-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ emails: toAnalyze })
      })
      const data = await resp.json()
      
      if (data.results) {
        setAiResults(prev => ({ ...prev, ...data.results }))
        
        // Step 4: Save only AI fields to Firestore
        for (const [msgId, aiData] of Object.entries(data.results)) {
          const safeData = {
            priority: aiData.priority || 'normal',
            reason: aiData.reason || '',
            deadline: aiData.deadline || null,
            requires_reply: aiData.requires_reply || false,
            summary: aiData.summary || null,
            draft_reply: aiData.draft_reply || null,
            messageId: msgId,
            cachedAt: new Date().toISOString()
          }
          await saveAIResult(user.email, msgId, safeData)
        }
        console.log(`Saved ${Object.keys(data.results).length} to Firestore`)
      }
    } finally {
      setIsAnalyzing(false)
      fetchDashboardStats();
    }
  }

  const fetchFullEmail = async (id) => {
    if (!id) return;
    const token = localStorage.getItem('mp_token');
    markEmailAsRead(id);
    setIsFetchingBody(true);
    try {
      const response = await fetch(`${API_BASE}/emails/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Fetch full email failed");
      const data = await response.json();
      if (data && data.body) {
        setFullBodies(prev => ({ ...prev, [id]: data.body }));
      }
    } catch (error) {
      console.error("Failed to fetch full email:", error);
    } finally {
      setIsFetchingBody(false);
    }
  };

  const markEmailAsRead = async (id) => {
    if (!id) return;
    const mail = mails.find(m => m.id === id);
    if (!mail || mail.is_read) return;

    const token = localStorage.getItem('mp_token');
    if (!token) return;

    const applyReadState = (items) => items.map(m => {
      if (m.id !== id) return m;
      return {
        ...m,
        is_read: true,
        labels: (m.labels || []).filter(label => label !== 'UNREAD')
      };
    });

    setMails(prev => {
      const next = applyReadState(Array.isArray(prev) ? prev : []);
      if (user?.email) {
        localStorage.setItem(`mp_mails_${user.email}`, JSON.stringify(next));
      }
      return next;
    });
    setDashboardStats(prev => ({
      ...prev,
      unread_emails: Math.max(0, (prev?.unread_emails || 0) - 1)
    }));

    try {
      const response = await fetch(`${API_BASE}/emails/${id}/mark-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const detail = await response.text();
        console.warn("Gmail mark-as-read failed:", detail);
      }
    } catch (error) {
      console.warn("Unable to mark email as read in Gmail:", error);
    }
  };

  const sendDraftReply = async (mail) => {
    if (!mail) return;
    const draft = aiResults[mail.id]?.draft_reply?.trim();
    if (!draft) {
      alert("Generate a draft reply first.");
      return;
    }

    const recipient = mail.from_email || mail.from_name || "this sender";
    const plainDraft = draft.replace(/\*\*(.*?)\*\*/g, '$1');
    const confirmed = window.confirm(
      `Send this reply to ${recipient}?\n\nSubject: Re: ${decodeHtmlEntities(mail.subject || "No Subject")}\n\n${plainDraft}`
    );
    if (!confirmed) return;

    const token = localStorage.getItem('mp_token');
    if (!token) return;

    setSendingReplyIds(prev => new Set(prev).add(mail.id));
    try {
      const response = await fetch(`${API_BASE}/emails/${mail.id}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reply_text: draft })
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Send reply failed");
      }
      setStatsData(prev => ({
        ...prev,
        replies_drafted: (prev.replies_drafted || 0) + 1
      }));
      markEmailAsRead(mail.id);
      alert("Reply sent in Gmail.");
    } catch (error) {
      console.error("Failed to send reply:", error);
      alert("Could not send the reply. If you just updated permissions, sign out and sign in again.");
    } finally {
      setSendingReplyIds(prev => {
        const next = new Set(prev);
        next.delete(mail.id);
        return next;
      });
    }
  };

  const fetchDashboardStats = async () => {
    const token = localStorage.getItem('mp_token');
    if (!token) return;
    setIsFetchingStats(true);
    try {
      const response = await fetch(`${API_BASE}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Fetch stats failed");
      const data = await response.json();
      if (data) {
        setDashboardStats(data);
        setStatsData({
          emails_analyzed: data.emails_analyzed || 0,
          urgent_emails_caught: data.urgent_emails_caught || 0,
          replies_drafted: data.replies_drafted || 0,
          voice_briefings_sent: data.voice_briefings_sent || 0
        });
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      // Keep existing or default stats on failure
    } finally {
      setIsFetchingStats(false);
    }
  };

  const generateVoiceBriefing = async () => {
    const token = localStorage.getItem('mp_token');
    if (!token) return;
    if (!mails || mails.length === 0) return;
    
    setIsGeneratingVoice(true);
    try {
      const resp = await fetch(`${API_BASE}/voice/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          emails: mails.slice(0, 10),
          ai_results: typeof aiResults === 'object' && !Array.isArray(aiResults) 
            ? aiResults 
            : {}
        })
      });
      if (!resp.ok) throw new Error("Voice generation failed");
      const result = await resp.json();
      
      setVoiceScript(result.script);
      setVoiceDuration(result.duration_estimate || "~2 mins");
      
      if (result.audio_base64) {
        const audio = new Audio(`data:audio/wav;base64,${result.audio_base64}`);
        audio.onended = () => setIsPlayingVoice(false);
        setAudioElement(audio);
        setVoiceGenerated(true);
      }
      
    } catch (error) {
      console.error("Failed to generate voice briefing:", error);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const sendToWhatsApp = () => {
    const text = encodeURIComponent(`Here is your MailPulse morning briefing:\n\n${voiceScript || 'No script available.'}`);
    window.open(`https://wa.me/${whatsappNumber || ''}?text=${text}`, '_blank');
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleEmailSelect = async (email) => {
    setSelectedMailId(email.id)
    markEmailAsRead(email.id)
    
    const existing = aiResults[email.id]
    if (existing && !existing.loading && existing.summary) {
      return
    }
    
    setAiResults(prev => ({ ...prev, [email.id]: { loading: true } }))
    
    try {
      const token = localStorage.getItem('mp_token');
      const resp = await fetch(`${API_BASE}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          email_id: email.id,
          subject: email.subject,
          from_name: email.from_name,
          body_preview: email.body_preview || email.snippet || '',
          snippet: email.snippet || ''
        })
      })
      const result = await resp.json()
      console.log("Single analyze result:", result)
      setAiResults(prev => ({ ...prev, [email.id]: result }))
      
      const safeData = {
        priority: result.priority || 'normal',
        reason: result.reason || '',
        deadline: result.deadline || null,
        requires_reply: result.requires_reply || false,
        summary: result.summary || null,
        draft_reply: result.draft_reply || null,
        messageId: email.id,
        cachedAt: new Date().toISOString()
      }
      await saveAIResult(user.email, email.id, safeData)
    } catch(e) {
      console.error('Auto analyze failed:', e)
      setAiResults(prev => ({ 
        ...prev, 
        [email.id]: { 
          loading: false,
          summary: null,
          draft_reply: null,
          priority: 'normal',
          requires_reply: false
        }
      }))
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('mp_token');
    if (token && user) {
      fetchEmails();
      fetchDashboardStats();
    }
  }, [user]);

  const handleScan = async () => {
    setIsScanning(true);
    await Promise.all([fetchEmails(), fetchDashboardStats()]);
    setIsScanning(false);
  };

  const selectedMail = Array.isArray(mails) ? mails.find(m => m.id === selectedMailId) : null;

  if (!authChecked) return null;
  if (!user) return <Landing onLogin={handleLogin} />;

  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Mobile Header */}
        <div className="mobile-header">
          <div className="mobile-header-title">MailPulse</div>
          <button className="hamburger" onClick={() => setMobileSidebarOpen(true)}>☰</button>
        </div>
        <div className={`mobile-overlay ${mobileSidebarOpen ? 'show' : ''}`} onClick={() => setMobileSidebarOpen(false)}></div>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #050505;
            --surface: rgba(22, 27, 34, 0.6);
            --border: rgba(255, 255, 255, 0.08);
            --border-muted: rgba(255, 255, 255, 0.04);
            --amber: #FF9F0A;
            --teal: #32ADE6;
            --red: #FF2A55;
            --text-primary: #F4F4F5;
            --text-secondary: #A1A1AA;
            --font-main: 'Inter', 'DM Sans', sans-serif;
            --font-serif: 'Instrument Serif', serif;
            --mesh-1: radial-gradient(at 0% 0%, rgba(94,92,230,0.15) 0px, transparent 50%);
            --mesh-2: radial-gradient(at 100% 0%, rgba(255,42,85,0.1) 0px, transparent 50%);
            --mesh-3: radial-gradient(at 100% 100%, rgba(255,159,10,0.12) 0px, transparent 50%);
            --mesh-4: radial-gradient(at 0% 100%, rgba(50,173,230,0.1) 0px, transparent 50%);
          }


          /* Mobile Responsiveness */
          .mobile-header { display: none; }
          .mobile-overlay { display: none; }
          .mobile-back-btn { display: none; }
          @media (max-width: 768px) {
            .app-container { flex-direction: column; }
            .mobile-header {
              display: flex; align-items: center; justify-content: space-between;
              padding: 16px 20px; background: rgba(5,5,5,0.7); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
              border-bottom: 1px solid var(--border); z-index: 10; flex-shrink: 0;
            }
            .mobile-header-title { font-family: var(--font-serif); font-size: 24px; font-weight: 500; color: var(--text-primary); }
            .hamburger { background: transparent; border: none; color: var(--text-primary); font-size: 24px; cursor: pointer; }
            
            .sidebar {
              position: absolute; top: 0; left: 0; bottom: 0; z-index: 100; width: 280px;
              transform: translateX(-100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
              background: rgba(5, 5, 5, 0.95);
            }
            .sidebar.open { transform: translateX(0); box-shadow: 10px 0 40px rgba(0,0,0,0.8); }
            
            .mobile-overlay {
              display: block; position: absolute; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
              z-index: 90; opacity: 0; pointer-events: none; transition: opacity 0.3s;
            }
            .mobile-overlay.show { opacity: 1; pointer-events: auto; }
            
            .mail-list { width: 100%; height: calc(100vh - 65px); flex: none; }
            .list-topbar { padding: 16px; flex-direction: column; align-items: flex-start; gap: 12px; }
            .list-title { font-size: 28px; }
            .scan-now { width: 100%; justify-content: center; }

            
            .detail-panel {
              position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 50;
              background: var(--bg);
              transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .detail-panel.active { transform: translateX(0); }
            
            .mobile-back-btn {
              display: inline-flex; align-items: center; gap: 8px;
              padding: 8px 16px; margin: 16px 16px 0;
              background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
              color: var(--text-primary); font-size: 13px; font-weight: 600; cursor: pointer;
            }
            
            .dashboard-container { padding: 16px; height: calc(100vh - 65px); }
            .analytics-grid { grid-template-columns: 1fr; }
            .badge-strip { display: none; }
          }
          body { 
            background-color: var(--bg);
            background-image: var(--mesh-1), var(--mesh-2), var(--mesh-3), var(--mesh-4);
            background-attachment: fixed;
            color: var(--text-primary); 
            font-family: var(--font-main);
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          .fatal-error-container {
            width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center;
            background: var(--bg); color: var(--text-primary);
          }
          .error-panel {
            background: var(--surface); border: 1px solid var(--border);
            padding: 40px; border-radius: 12px; text-align: center; max-width: 400px;
          }
          .error-icon { font-size: 48px; margin-bottom: 20px; color: var(--red); }
          .error-panel h2 { margin-bottom: 12px; }
          .error-panel p { color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5; }

          ::selection { background: var(--amber); color: var(--bg); }
          
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--border-muted); border-radius: 2px; }
          ::-webkit-scrollbar-thumb:hover { background: #484F58; }

          .app-container { display: flex; height: 100vh; width: 100vw; position: relative; }

          /* Sidebar */
          .sidebar {
            width: 240px;
            background:
              radial-gradient(circle at 30% 0%, rgba(59,130,246,0.08), transparent 38%),
              linear-gradient(180deg, rgba(13, 17, 23, 0.76), rgba(5, 8, 18, 0.82));
            backdrop-filter: blur(28px);
            -webkit-backdrop-filter: blur(28px);
            border-right: 1px solid rgba(255,255,255,0.075);
            display: flex;
            flex-direction: column;
            padding: 24px 16px;
            flex-shrink: 0;
            overflow-y: auto;
            box-shadow: 18px 0 50px rgba(0,0,0,0.18), inset -1px 0 0 rgba(255,255,255,0.03);
          }

          .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 32px;
            padding: 0 8px;
          }
          .user-avatar-wrap {
            width: 40px; height: 40px;
            border-radius: 50%;
            border: 2px solid var(--amber);
            padding: 2px;
            display: flex; align-items: center; justify-content: center;
          }
          .user-avatar { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
          .user-meta { flex: 1; min-width: 0; }
          .user-name { font-size: 14px; font-weight: 500; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .user-email { font-size: 12px; color: var(--text-secondary); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .sign-out { font-size: 11px; color: var(--text-secondary); cursor: pointer; text-decoration: none; margin-top: 4px; display: inline-block; }
          .sign-out:hover { color: var(--text-primary); }

          .sidebar-logo-wrap { display: flex; justify-content: center; margin-bottom: 24px; }
          .sidebar-logo { height: 24px; width: auto; display: block; margin: 12px auto; }
          .divider { height: 1px; background: var(--border); margin-bottom: 24px; }

          .digest-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 32px; }
          .digest-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          .digest-val { font-size: 28px; font-weight: 600; display: block; }
          .digest-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; }

          .nav-label {
            font-size: 10px;
            color: rgba(156,163,175,0.76);
            text-transform: uppercase;
            letter-spacing: 2.4px;
            margin: 18px 0 9px 8px;
            font-weight: 800;
          }
          .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            min-height: 40px;
            padding: 10px 12px;
            border-radius: 12px;
            font-size: 13px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: background 0.22s ease, color 0.22s ease, transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
            margin-bottom: 4px;
            border: 1px solid transparent;
            position: relative;
            overflow: hidden;
          }
          .nav-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 8px;
            bottom: 8px;
            width: 2px;
            border-radius: 999px;
            background: transparent;
            transition: background 0.22s ease, box-shadow 0.22s ease;
          }
          .nav-item:hover {
            background: rgba(255,255,255,0.045);
            color: var(--text-primary);
            transform: translateX(1px);
            border-color: rgba(255,255,255,0.055);
          }
          .nav-item.active {
            background: linear-gradient(135deg, rgba(59,130,246,0.13), rgba(212,163,115,0.06));
            border-color: rgba(59,130,246,0.22);
            color: #F3F4F6;
            font-weight: 700;
            box-shadow: 0 10px 28px rgba(0,0,0,0.18), 0 0 28px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
          }
          .nav-item.active::before {
            background: #3B82F6;
            box-shadow: 0 0 18px rgba(59,130,246,0.65);
          }
          .nav-icon {
            font-size: 16px;
            width: 22px;
            text-align: center;
            filter: drop-shadow(0 0 10px rgba(59,130,246,0.18));
          }

          /* Dashboard Styles */
          .dashboard-container {
            flex: 1;
            background: transparent;
            padding: 32px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 32px;
          }

          .analytics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
          }

          .stat-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            position: relative;
            overflow: hidden;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
          }
          .stat-card:hover {
            transform: translateY(-4px);
            border-color: var(--border-muted);
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          }
          .stat-card::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 2px;
            opacity: 0.3;
          }
          .stat-card.amber::after { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
          .stat-card.teal::after { background: var(--teal); box-shadow: 0 0 10px var(--teal); }
          .stat-card.red::after { background: var(--red); box-shadow: 0 0 10px var(--red); }
          .stat-card.blue::after { background: #5E5CE6; box-shadow: 0 0 10px #5E5CE6; }

          .stat-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
          .stat-icon { font-size: 24px; }
          .stat-trend { font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); }
          .trend-up { color: var(--teal); }
          .trend-neutral { color: var(--text-secondary); }

          .stat-value { font-size: 32px; font-weight: 700; margin-bottom: 4px; color: var(--text-primary); }
          .stat-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
          
          .sparkline { height: 30px; margin-top: auto; opacity: 0.5; }

          .dashboard-row { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }

          .panel {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            display: flex;
            flex-direction: column;
          }
          .panel-title { font-size: 16px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }

          /* Activity Feed */
          .activity-list { display: flex; flex-direction: column; gap: 16px; }
          .activity-item {
            display: flex; gap: 16px; padding: 12px;
            border-radius: 8px; transition: background 0.2s;
          }
          .activity-item:hover { background: rgba(255,255,255,0.03); }
          .activity-icon {
            width: 36px; height: 36px; border-radius: 50%;
            background: var(--bg); display: flex; align-items: center; justify-content: center;
            font-size: 18px; flex-shrink: 0;
          }
          .activity-content { flex: 1; }
          .activity-text { font-size: 14px; color: var(--text-primary); margin-bottom: 4px; }
          .activity-time { font-size: 11px; color: var(--text-secondary); }

          /* Insights */
          .insight-row { display: flex; flex-direction: column; gap: 16px; }
          .insight-card { font-size: 13px; color: var(--text-secondary); line-height: 1.6; padding-left: 12px; border-left: 2px solid var(--amber); }
          
          .progress-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 24px; }
          .progress-item { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
          .progress-svg { width: 50px; height: 50px; transform: rotate(-90deg); }
          .progress-bg { fill: none; stroke: var(--bg); stroke-width: 4; }
          .progress-fill { fill: none; stroke: var(--amber); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 1s ease-out; }
          .progress-val { font-size: 11px; font-weight: 700; color: var(--text-primary); }
          .progress-label { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }

          /* Heatmap */
          .heatmap-container { padding: 12px 0; overflow-x: auto; }
          .heatmap-grid { display: flex; gap: 4px; }
          .heatmap-day-label { font-size: 10px; color: var(--text-secondary); width: 24px; display: flex; align-items: center; }
          .heatmap-col { display: flex; flex-direction: column; gap: 4px; }
          .heatmap-cell {
            width: 12px; height: 12px; border-radius: 2px;
            background: #1C2128; position: relative;
          }
          .heatmap-cell:hover { border: 1px solid var(--text-secondary); }
          .heatmap-cell[data-level="1"] { background: #0E4429; }
          .heatmap-cell[data-level="2"] { background: #006D32; }
          .heatmap-cell[data-level="3"] { background: #26A641; }
          .heatmap-cell[data-level="4"] { background: #39D353; box-shadow: 0 0 10px #39D35330; }

          /* Profile Card */
          .premium-profile {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
            transition: all 0.3s ease;
            position: relative;
            cursor: default;
          }
          .premium-profile:hover {
            border-color: var(--amber);
            box-shadow: 0 0 20px rgba(240, 165, 0, 0.1);
          }
          .profile-top { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
          .profile-img-wrap { position: relative; width: 40px; height: 40px; }
          .profile-img { width: 40px; height: 40px; border-radius: 50%; border: 2px solid #FF9F0A; object-fit: cover; }
          .online-dot {
            position: absolute; bottom: 2px; right: 2px;
            width: 10px; height: 10px; background: var(--teal);
            border: 2px solid var(--surface); border-radius: 50%;
          }
          .profile-name { 
            font-size: 13px; font-weight: 500; color: #E6EDF3; 
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
            max-width: 140px; display: block; 
          }
          .profile-email { 
            font-size: 11px; color: #8B949E; 
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
            max-width: 140px; display: block; 
          }
          
          .profile-status {
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(26, 171, 138, 0.1); color: var(--teal);
            padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 700;
            margin-bottom: 12px;
          }
          .profile-meta {
            border-top: 1px solid var(--border);
            padding-top: 12px; display: flex; flex-direction: column; gap: 4px;
          }
          .meta-item { font-size: 11px; color: var(--text-secondary); display: flex; justify-content: space-between; }
          .meta-val { color: var(--text-primary); font-weight: 500; }

          /* Gamification */
          .badge-strip { display: flex; gap: 8px; margin-top: 16px; }
          .badge-chip {
            background: rgba(255,255,255,0.05); border: 1px solid var(--border);
            padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
            display: flex; align-items: center; gap: 6px;
          }
          .badge-chip.amber { color: var(--amber); border-color: rgba(240,165,0,0.3); }

          /* Mail List */
          .mail-list {
            width: 350px;
            background: rgba(13, 17, 23, 0.4);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
          }

          .list-topbar {
            padding: 24px 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg);
            z-index: 10;
          }

          .list-title { font-size: 18px; font-weight: 700; color: var(--text-primary); }

          .scan-now {
            background: var(--surface);
            border: 1px solid var(--border-muted);
            color: var(--text-primary);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
          }
          .scan-now:hover:not(:disabled) { border-color: var(--amber); background: rgba(240,165,0,0.05); }
          .scan-now:disabled { opacity: 0.5; cursor: not-allowed; }

          .analyzing-indicator {
            background: rgba(240, 165, 0, 0.1);
            border-bottom: 1px solid rgba(240, 165, 0, 0.2);
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 11px;
            font-weight: 600;
            color: var(--amber);
          }

          .pulsing-dot {
            width: 8px; height: 8px; background: var(--amber);
            border-radius: 50%;
            animation: pulse 1.5s infinite;
          }
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(240, 165, 0, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(240, 165, 0, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(240, 165, 0, 0); }
          }

          .list-scroll { flex: 1; overflow-y: auto; }

          .mail-row {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            gap: 12px;
            position: relative;
          }
          .mail-row:hover { background: var(--surface); }
          .mail-row.selected { background: rgba(240, 165, 0, 0.05); }
          .mail-row.selected::before {
            content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--amber);
          }

          .priority-dot {
            width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0;
          }

          .row-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
          .row-line1 { display: flex; justify-content: space-between; align-items: baseline; }
          .row-sender { font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .row-time { font-size: 11px; color: var(--text-secondary); flex-shrink: 0; }
          .row-subject { 
            font-size: 13px; font-weight: 500; color: var(--text-primary); 
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          }
          .row-snippet { 
            font-size: 12px; color: var(--text-secondary);
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.5;
            word-break: break-word;
          }

          .badge-group { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
          .badge {
            padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;
          }
          .badge-urgent { background: rgba(240, 165, 0, 0.15); color: var(--amber); }
          .badge-new { background: rgba(26, 171, 138, 0.15); color: var(--teal); }
          .badge-important { background: rgba(123, 123, 245, 0.15); color: #5E5CE6; }
          .badge-promo { background: rgba(139, 148, 158, 0.1); color: var(--text-secondary); }

          /* Detail Panel */
          .detail-panel {
            flex: 1;
            background: var(--bg);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .detail-header {
            padding: 24px 32px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            background: var(--bg);
          }

          .sender-box { display: flex; gap: 16px; align-items: flex-start; flex: 1; min-width: 0; }
          .sender-avatar {
            width: 48px; height: 48px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 700; color: white; flex-shrink: 0;
          }
          .sender-meta { flex: 1; min-width: 0; }
          .sender-meta h3 { font-size: 16px; font-weight: 600; margin-bottom: 2px; }
          .sender-meta p { font-size: 12px; color: var(--text-secondary); margin-bottom: 12px; }
          .detail-subject { font-family: var(--font-serif); font-size: 28px; line-height: 1.2; color: var(--text-primary); }

          .open-gmail {
            color: var(--text-secondary); text-decoration: none; font-size: 12px; font-weight: 600;
            padding: 8px 16px; border: 1px solid var(--border-muted); border-radius: 8px;
            transition: all 0.2s; white-space: nowrap;
          }
          .open-gmail:hover { color: var(--text-primary); border-color: var(--text-secondary); }

          .detail-content { flex: 1; overflow-y: auto; padding: 32px; display: flex; flex-direction: column; gap: 24px; }

          .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
          }
          .card-label {
            font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
            color: var(--text-secondary); margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
          }
          .summary-text { font-size: 15px; line-height: 1.6; color: var(--text-primary); }
          .deadline-chip {
            display: inline-flex; align-items: center; gap: 8px;
            background: rgba(240, 165, 0, 0.1); color: var(--amber);
            padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 16px;
          }

          .history-item { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
          .label-pills { display: flex; gap: 8px; flex-wrap: wrap; }
          .pill {
            font-size: 11px; font-weight: 600; color: var(--text-secondary);
            background: var(--bg); padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border);
          }

          .draft-text {
            font-size: 14px; line-height: 1.6; color: var(--text-primary);
            background: var(--bg); padding: 16px; border-radius: 8px; border: 1px solid var(--border-muted);
            margin-bottom: 16px; white-space: pre-wrap;
          }
          .draft-text p {
            margin: 0 0 12px;
          }
          .draft-text p:last-child {
            margin-bottom: 0;
          }
          .draft-text strong {
            color: #FFD28A;
            font-weight: 800;
          }
          .draft-placeholder { color: var(--text-secondary); font-style: italic; }

          .btn-row { display: flex; gap: 12px; }
          .btn-send {
            background: var(--amber); color: var(--bg); border: none;
            padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
          }
          .btn-sec {
            background: transparent; color: var(--text-primary); border: 1px solid var(--border-muted);
            padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
          }
          .btn-sec:hover { background: var(--border-muted); }

          /* Voice Bar */
          .voice-bar {
            background: var(--surface); border-top: 1px solid var(--border);
            padding: 16px 32px; display: flex; align-items: center; gap: 24px;
          }
          .play-circle {
            width: 40px; height: 40px; border-radius: 50%; background: var(--amber);
            display: flex; align-items: center; justify-content: center; color: var(--bg);
            font-size: 16px; cursor: pointer; flex-shrink: 0;
          }
          .briefing-meta { flex-shrink: 0; }
          .briefing-title { font-size: 14px; font-weight: 700; display: block; }
          .briefing-sub { font-size: 11px; color: var(--text-secondary); }

          .waveform { flex: 1; display: flex; align-items: center; gap: 3px; height: 30px; }
          .wave-bar { width: 3px; background: var(--border-muted); border-radius: 2px; transition: all 0.2s; }
          .wave-bar.active { background: var(--amber); animation: wave 1s infinite alternate; }
          @keyframes wave { from { height: 10px; } to { height: 24px; } }

          .whatsapp-btn {
            background: #25D366; color: white; border: none;
            padding: 10px 20px; border-radius: 30px; font-size: 13px; font-weight: 700;
            display: flex; align-items: center; gap: 8px; cursor: pointer;
          }

          /* Empty State */
          .empty-state {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 40px; text-align: center; color: var(--text-secondary);
          }
          .empty-icon { font-size: 48px; margin-bottom: 16px; }
          .empty-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
          .empty-subtitle { font-size: 14px; max-width: 240px; }

          .spinner {
            width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.1);
            border-top-color: var(--amber); border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }

          /* Bug 1: Transition Overlay */
          .transition-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: #0D1117;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          .load-logo {
            height: 72px;
            width: auto;
            display: block;
            margin: 0 auto 16px auto;
            max-width: 120px;
          }
          .load-text {
            font-size: 14px;
            color: #FF9F0A;
            margin-bottom: 16px;
          }

          .skeleton-row { padding: 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
          .skel-line { height: 10px; background: var(--border-muted); border-radius: 4px; animation: pulse-skel 1.5s infinite; }
          @keyframes pulse-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }

          .ai-skel {
            background: #21262D;
            border-radius: 4px;
            height: 16px;
            margin-bottom: 8px;
            animation: pulse-ai 1.2s infinite;
          }
          @keyframes pulse-ai {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }

          .global-error-panel {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 1000;
          }

          .slide-in { animation: slideIn 0.3s ease-out; }
          @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

          button, .nav-item, .mail-row, .digest-card, .badge-chip, .open-gmail, .sign-out, .play-circle {
            -webkit-tap-highlight-color: transparent;
          }

          button:focus-visible,
          a:focus-visible,
          .nav-item:focus-visible,
          .mail-row:focus-visible {
            outline: 2px solid rgba(255,159,10,0.72);
            outline-offset: 3px;
          }

          .hamburger {
            width: 44px;
            height: 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.045);
            border: 1px solid var(--border);
            border-radius: 14px;
            color: var(--text-primary);
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
            transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
          }
          .hamburger:hover {
            transform: translateY(-1px);
            border-color: rgba(255,159,10,0.32);
            background: rgba(255,159,10,0.08);
          }

          .digest-card,
          .badge-chip,
          .card,
          .panel {
            transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
          }
          .digest-card:hover,
          .badge-chip:hover,
          .card:hover,
          .panel:hover {
            border-color: rgba(255,255,255,0.12);
          }
          .card:hover,
          .panel:hover {
            box-shadow: 0 14px 36px rgba(0,0,0,0.22);
          }
          .btn-send,
          .btn-sec,
          .scan-now,
          .whatsapp-btn,
          .open-gmail {
            transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
          }
          .btn-send:hover,
          .scan-now:hover:not(:disabled),
          .whatsapp-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 10px 26px rgba(0,0,0,0.22);
          }
          .btn-send:active,
          .btn-sec:active,
          .scan-now:active,
          .whatsapp-btn:active,
          .mail-row:active,
          .nav-item:active {
            transform: scale(0.99);
          }

          @media (max-width: 1180px) {
            .sidebar { width: 220px; padding: 20px 12px; }
            .mail-list { width: clamp(300px, 32vw, 360px); }
            .dashboard-row { grid-template-columns: 1fr; }
            .analytics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .detail-header { padding: 22px 24px; }
            .detail-content { padding: 24px; }
            .voice-bar { padding: 14px 24px; gap: 16px; }
          }

          @media (max-width: 980px) {
            .app-container { flex-direction: column; }
            .mobile-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              min-height: 66px;
              padding: 12px 16px;
              background: rgba(5,5,5,0.78);
              backdrop-filter: blur(24px);
              -webkit-backdrop-filter: blur(24px);
              border-bottom: 1px solid var(--border);
              z-index: 80;
              flex-shrink: 0;
            }
            .mobile-header-title {
              font-family: var(--font-serif);
              font-size: 25px;
              font-weight: 500;
              color: var(--text-primary);
            }
            .sidebar {
              position: absolute;
              top: 0;
              left: 0;
              bottom: 0;
              z-index: 100;
              width: min(330px, 86vw);
              transform: translateX(-100%);
              transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
              background:
                radial-gradient(circle at 30% 0%, rgba(59,130,246,0.12), transparent 38%),
                rgba(5, 5, 5, 0.96);
              padding: 20px 16px;
            }
            .sidebar.open { transform: translateX(0); box-shadow: 16px 0 48px rgba(0,0,0,0.72); }
            .mobile-overlay {
              display: block;
              position: absolute;
              inset: 0;
              background: rgba(0,0,0,0.56);
              backdrop-filter: blur(6px);
              z-index: 90;
              opacity: 0;
              pointer-events: none;
              transition: opacity 0.25s ease;
            }
            .mobile-overlay.show { opacity: 1; pointer-events: auto; }
            .dashboard-container,
            .mail-list,
            .digest-wrap {
              height: calc(100vh - 66px);
            }
            .dashboard-container {
              width: 100%;
              padding: 20px;
              overflow-y: auto;
              gap: 22px;
            }
            .mail-list {
              width: 100%;
              flex: 1;
              min-height: 0;
              border-right: none;
            }
            .list-topbar {
              padding: 16px;
              gap: 14px;
              background: rgba(5,5,5,0.74);
              backdrop-filter: blur(18px);
            }
            .list-title { font-size: 26px; }
            .scan-now {
              min-height: 42px;
              padding: 9px 14px;
              border-radius: 12px;
            }
            .mail-row {
              min-height: 104px;
              padding: 18px 16px;
            }
            .detail-panel {
              position: absolute;
              top: 66px;
              left: 0;
              right: 0;
              bottom: 0;
              width: 100%;
              height: calc(100vh - 66px);
              z-index: 60;
              background: var(--bg);
              transform: translateX(100%);
              transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .detail-panel.active { transform: translateX(0); }
            .mobile-back-btn {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              min-height: 40px;
              padding: 8px 14px;
              margin: 14px 16px 0;
              background: var(--surface);
              border: 1px solid var(--border);
              border-radius: 999px;
              color: var(--text-primary);
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
            }
            .detail-header {
              padding: 18px 16px;
              gap: 16px;
              flex-direction: column;
            }
            .open-gmail {
              width: 100%;
              min-height: 40px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }
            .detail-subject {
              font-size: clamp(24px, 6vw, 34px);
            }
            .detail-content {
              padding: 18px 16px 130px;
              gap: 18px;
            }
            .voice-bar {
              position: sticky;
              bottom: 0;
              flex-wrap: wrap;
              padding: 14px 16px;
              gap: 12px;
              background: rgba(22,27,34,0.92);
              backdrop-filter: blur(18px);
            }
            .waveform {
              order: 4;
              width: 100%;
              flex-basis: 100%;
            }
            .whatsapp-btn {
              margin-left: auto;
              min-height: 40px;
            }
          }

          @media (max-width: 680px) {
            .analytics-grid,
            .progress-grid {
              grid-template-columns: 1fr;
            }
            .dashboard-container {
              padding: 16px;
            }
            .stat-card,
            .panel,
            .card {
              border-radius: 16px;
              padding: 18px;
            }
            .stat-value {
              font-size: 30px;
            }
            .badge-strip {
              display: flex;
              flex-wrap: wrap;
            }
            .badge-chip {
              min-height: 32px;
            }
            .btn-row {
              flex-direction: column;
            }
            .btn-send,
            .btn-sec {
              width: 100%;
              min-height: 42px;
            }
            .deadline-chip {
              width: 100%;
              justify-content: center;
              flex-wrap: wrap;
              text-align: center;
            }
            .sender-avatar {
              width: 42px;
              height: 42px;
              font-size: 17px;
            }
            .row-line1 {
              gap: 10px;
            }
            .row-sender {
              min-width: 0;
            }
            .voice-bar {
              align-items: center;
            }
            .briefing-meta {
              min-width: 0;
              flex: 1;
            }
            .whatsapp-btn {
              width: 100%;
              justify-content: center;
              order: 5;
            }
          }

          @media (max-width: 420px) {
            .mobile-header {
              min-height: 60px;
              padding: 10px 12px;
            }
            .mobile-header-title { font-size: 23px; }
            .hamburger { width: 40px; height: 40px; border-radius: 12px; }
            .dashboard-container,
            .mail-list,
            .digest-wrap {
              height: calc(100vh - 60px);
            }
            .detail-panel {
              top: 60px;
              height: calc(100vh - 60px);
            }
            .list-topbar {
              align-items: stretch;
              flex-direction: column;
            }
            .scan-now {
              width: 100%;
              justify-content: center;
            }
            .profile-name,
            .profile-email {
              max-width: 180px;
            }
            .digest-cards {
              grid-template-columns: 1fr;
            }
            .mail-row {
              padding: 16px 14px;
            }
            .detail-content {
              padding-inline: 14px;
            }
            .card-label {
              align-items: flex-start;
              line-height: 1.45;
            }
            .draft-text {
              font-size: 13px;
              padding: 14px;
            }
            .global-error-panel {
              left: 12px;
              right: 12px;
              transform: translateY(-50%);
            }
            .global-error-panel .error-panel {
              max-width: none;
              width: 100%;
              padding: 24px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
          }
        `}</style>

        {isTransitioning && (
          <div className="transition-overlay">
            <img src="/logo.png" alt="MailPulse" className="load-logo" />
            <div className="load-text">Setting up your inbox...</div>
            <div className="spinner"></div>
          </div>
        )}

        {globalError && (
          <div className="global-error-panel">
            <div className="error-panel">
              <div className="error-icon">🔌</div>
              <h2>Connection Failed</h2>
              <p>{globalError}</p>
              <button className="btn-send" onClick={handleScan}>Retry Connection</button>
            </div>
          </div>
        )}

        {/* Sidebar */}
        <aside className={`sidebar ${mobileSidebarOpen ? "open" : ""}`}>
          <div className="premium-profile">
            <div className="profile-top">
              <div className="profile-img-wrap">
                {!profileImgError ? (
                  <img 
                    src={user.picture} 
                    alt={user.name} 
                    className="profile-img" 
                    onError={() => setProfileImgError(true)}
                  />
                ) : (
                  <div className="profile-img" style={{ 
                    background: '#FF9F0A', 
                    color: '#0D1117', 
                    fontWeight: 600, 
                    fontSize: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}>
                    {user.name ? user.name[0] : '?'}
                  </div>
                )}
                <div className="online-dot"></div>
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <span className="profile-name">{user.name}</span>
                <span className="profile-email">{user.email}</span>
              </div>
            </div>
            <div className="profile-status">
              <span>●</span> Connected to Gmail
            </div>
            <div className="profile-meta">
              <div className="meta-item"><span>Member since</span><span className="meta-val">May 2026</span></div>
              <div className="meta-item"><span>Last sync</span><span className="meta-val">Just now</span></div>
              <div className="meta-item"><span>SENDERS</span><span className="meta-val">{senders.length}</span></div>
            </div>
          </div>

          <div className="sidebar-logo-wrap">
            <img 
              src="/logo.png" 
              alt="MailPulse" 
              className="sidebar-logo" 
              onError={(e) => e.target.style.display='none'}
            />
          </div>
          
          <div className="divider"></div>

          <div className="nav-label">Main</div>
          <div className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('Dashboard'); setMobileSidebarOpen(false); }}>
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </div>
          
          <div className="nav-label">Navigation</div>
          <div className={`nav-item ${activeTab === 'Priority Feed' ? 'active' : ''}`} onClick={() => { setActiveTab('Priority Feed'); setMobileSidebarOpen(false); }}>
            <span className="nav-icon">🔥</span>
            <span>Priority Feed</span>
          </div>
          <div className={`nav-item ${activeTab === 'Daily Digest' ? 'active' : ''}`} onClick={() => { setActiveTab('Daily Digest'); setMobileSidebarOpen(false); }}>
            <span className="nav-icon">📰</span>
            <span>Daily Digest</span>
          </div>
          <div className={`nav-item ${activeTab === 'senders' ? 'active' : ''}`} onClick={() => { setActiveTab('senders'); setMobileSidebarOpen(false); }}>
            <span className="nav-icon"><i className="ti ti-users"></i></span>
            <span>Senders</span>
            <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.7 }}>{senders.length} unique senders</span>
          </div>
          <div className={`nav-item ${activeTab === 'Awaiting Reply' ? 'active' : ''}`} onClick={() => { setActiveTab('Awaiting Reply'); setMobileSidebarOpen(false); }}>
            <span className="nav-icon">💬</span>
            <span>Awaiting Reply</span>
          </div>

          <div style={{ marginTop: 'auto', padding: '12px 8px' }}>
            <span className="sign-out" style={{ fontSize: '12px' }} onClick={handleSignOut}>Sign out</span>
          </div>
        </aside>

        {/* ── Dashboard & Daily Digest ── */}
        {(activeTab === 'Dashboard' || activeTab === 'Daily Digest' || activeTab === 'dashboard' || activeTab === 'daily-digest') && (
          <div className="dashboard-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header row */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>Dashboard</h1>
                <p style={{ fontSize: '13px', color: '#8B949E', margin: '4px 0 0 0' }}>{user?.email || ''}</p>
              </div>
            </header>

            {/* Stats grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ background: '#161B22', border: '1px solid #21262D', borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontSize: '32px', fontWeight: '600', color: '#F0A500', marginBottom: '4px' }}>
                  {statsData?.emails_analyzed || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Emails analyzed
                </div>
              </div>
              <div style={{ background: '#161B22', border: '1px solid #21262D', borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontSize: '32px', fontWeight: '600', color: '#F0A500', marginBottom: '4px' }}>
                  {statsData?.urgent_emails_caught || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Urgent caught
                </div>
              </div>
              <div style={{ background: '#161B22', border: '1px solid #21262D', borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontSize: '32px', fontWeight: '600', color: '#F0A500', marginBottom: '4px' }}>
                  {statsData?.replies_drafted || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Drafts generated
                </div>
              </div>
              <div style={{ background: '#161B22', border: '1px solid #21262D', borderRadius: '10px', padding: '20px' }}>
                <div style={{ fontSize: '32px', fontWeight: '600', color: '#F0A500', marginBottom: '4px' }}>
                  {senders?.length || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#8B949E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Unique senders
                </div>
              </div>
            </div>

            {/* Recent AI Analysis */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '12px', color: 'var(--text-primary)' }}>
                Recent AI Analysis
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(() => {
                  const recentAiEmails = (mails || [])
                    .filter(mail => aiResults && aiResults[mail.id])
                    .slice(0, 5);
                  if (recentAiEmails.length === 0) {
                    return (
                      <div style={{ color: '#8B949E', fontSize: '13px', padding: '12px', background: '#161B22', border: '1px solid #21262D', borderRadius: '8px' }}>
                        No recent AI-analyzed emails.
                      </div>
                    );
                  }
                  return recentAiEmails.map(mail => {
                    const ai = aiResults[mail.id] || {};
                    const priority = ai.priority || 'normal';
                    const truncatedSubject = mail.subject && mail.subject.length > 60 
                      ? mail.subject.slice(0, 60) + '...' 
                      : mail.subject;
                    return (
                      <div
                        key={mail.id}
                        onClick={() => {
                          setSelectedMailId(mail.id);
                          setActiveTab('All Mail');
                        }}
                        style={{
                          background: '#161B22',
                          border: '1px solid #21262D',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#21262D'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#161B22'}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, marginRight: '16px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {decodeHtmlEntities(mail.from_name || mail.from_email)}
                          </span>
                          <span style={{ fontSize: '12px', color: '#8B949E' }}>
                            {decodeHtmlEntities(truncatedSubject)}
                          </span>
                        </div>
                        <div>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            background: priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 148, 158, 0.15)',
                            color: priority === 'urgent' ? '#f87171' : '#8b949e',
                            border: `1px solid ${priority === 'urgent' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 148, 158, 0.3)'}`
                          }}>
                            {priority}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Voice Briefing Section */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '500', marginBottom: '12px', color: 'var(--text-primary)' }}>
                Morning Briefing
              </h3>
              <div 
                className="voice-bar" 
                onClick={() => setShowVoiceModal(true)} 
                style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#161B22', border: '1px solid #21262D', borderRadius: '10px', padding: '14px 20px', marginBottom: '12px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500', color: 'var(--text-primary)' }}>🎙️ Get voice briefing on WhatsApp</span>
                <span style={{ color: '#F0A500', fontSize: '12px', fontWeight: '600' }}>
                  Tap to schedule →
                </span>
              </div>
              <button 
                onClick={() => setShowVoiceModal(true)} 
                style={{
                  background: '#F0A500',
                  color: '#0D1117',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Generate Voice Note
              </button>
            </div>
          </div>
        )}


        {/* ── Mail List + Detail ── */}
        {(activeTab !== 'Dashboard' && activeTab !== 'Daily Digest' && activeTab !== 'senders') && (
          <>
            {/* Mail List */}
            <main className="mail-list">
              <header className="list-topbar">
                <h1 className="list-title">{activeTab}</h1>
                <button className="scan-now" onClick={handleScan} disabled={isScanning}>
                  {isScanning ? <div className="spinner"></div> : <span>↻</span>}
                  {isScanning ? "Scanning..." : "Scan now"}
                </button>
              </header>

              {isAnalyzing && (
                <div className="analyzing-indicator">
                  <div className="pulsing-dot"></div>
                  <span>AI Analyzing your inbox...</span>
                </div>
              )}

              <div className="list-scroll">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton-row">
                      <div className="skel-line" style={{ width: '60%' }}></div>
                      <div className="skel-line" style={{ width: '85%' }}></div>
                      <div className="skel-line" style={{ width: '45%' }}></div>
                    </div>
                  ))
                ) : filteredMails.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <div className="empty-title">All caught up!</div>
                    <div className="empty-subtitle">Your inbox is clean for this view.</div>
                  </div>
                ) : (
                  filteredMails.map(mail => (
                    <div 
                      key={mail.id} 
                      className={`mail-row ${selectedMailId === mail.id ? 'selected' : ''}`}
                      onClick={() => handleEmailSelect(mail)}
                    >
                      <div 
                        className="priority-dot" 
                        style={{ background: aiResults[mail.id]?.priority === 'urgent' ? 'var(--amber)' : (!mail.is_read ? 'var(--teal)' : 'var(--border-muted)') }}
                      ></div>
                      <div className="row-content">
                        <div className="row-line1">
                          <span className="row-sender">{decodeHtmlEntities(mail.from_name)}</span>
                          <span className="row-time">{new Date(mail.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="row-subject">{decodeHtmlEntities(mail.subject)}</div>
                        <div className="row-snippet">{decodeHtmlEntities(mail.snippet)}</div>
                        
                        <div className="badge-group">
                          {aiResults[mail.id]?.priority === 'urgent' && <span className="badge badge-urgent">Urgent</span>}
                          {!mail.is_read && <span className="badge badge-new">New</span>}
                          {mail.labels?.includes('IMPORTANT') && <span className="badge badge-important">Important</span>}
                          {mail.labels?.includes('CATEGORY_PROMOTIONS') && <span className="badge badge-promo">Promo</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </main>

            {/* Detail Panel */}
            <section className={`detail-panel ${selectedMailId ? "active" : ""}`}>
              <button className="mobile-back-btn" onClick={() => setSelectedMailId(null)}>← Back to Inbox</button>
              {selectedMail ? (
                <div key={selectedMail.id} className="slide-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <header className="detail-header">
                    <div className="sender-box">
                      <div className="sender-avatar" style={{ background: getSenderColor(selectedMail.from_name) }}>
                        {selectedMail.from_name ? selectedMail.from_name[0] : '?'}
                      </div>
                      <div className="sender-meta">
                        <h3>{decodeHtmlEntities(selectedMail.from_name)}</h3>
                        <p>{selectedMail.from_email}</p>
                        <h1 className="detail-subject">{decodeHtmlEntities(selectedMail.subject)}</h1>
                      </div>
                    </div>
                    <a 
                      href={`https://mail.google.com/mail/u/0/#inbox/${selectedMail.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="open-gmail"
                    >
                      Open in Gmail
                    </a>
                  </header>

                  <div className="detail-content">
                    {/* AI Context Card */}
                    <div className="card">
                      <div className="card-label">
                        <span>✨</span> AI Context Summary
                      </div>
                      {(() => {
                        const emailId = selectedMail?.id
                        const aiData = aiResults?.[emailId]
                        const isAnalyzing = aiData?.loading === true
                        const summary = aiData?.summary
                        const hasSummary = summary && 
                            typeof summary === 'string' && 
                            summary.length > 10 &&
                            summary !== 'null' &&
                            summary !== 'None' &&
                            !summary.includes('Could not')

                        console.log("Selected:", emailId, "aiData:", aiData, "summary:", summary)

                        return (
                          <>
                            {isAnalyzing && (
                              <div style={{ padding: '4px 0' }}>
                                <div className="ai-skel" style={{ width: '100%' }}></div>
                                <div className="ai-skel" style={{ width: '80%' }}></div>
                                <div className="ai-skel" style={{ width: '60%' }}></div>
                              </div>
                            )}
                            {!isAnalyzing && hasSummary && (
                              <p style={{fontSize:14, lineHeight:1.7, color:'#C9D1D9'}}>
                                {summary}
                              </p>
                            )}
                            {!isAnalyzing && !hasSummary && !aiData && (
                              <div style={{ textAlign: 'center', padding: '12px' }}>
                                <p style={{color:'#8B949E', fontSize:13, marginBottom: '12px'}}>
                                  No AI summary yet.
                                </p>
                                <button className="btn-sec" onClick={() => handleEmailSelect(selectedMail)}>
                                  ✨ Analyze this email
                                </button>
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>

                  {/* Thread History Card */}
                  <div className="card">
                    <div className="card-label">
                      <span>🕒</span> Thread History
                    </div>
                    <div className="history-item">
                      Received on {new Date(selectedMail.date).toLocaleDateString()} at {new Date(selectedMail.date).toLocaleTimeString()}
                    </div>
                    <div className="label-pills">
                      {selectedMail.labels?.map(l => (
                        <span key={l} className="pill">{l.replace('CATEGORY_', '').toLowerCase()}</span>
                      ))}
                    </div>
                  </div>

                  {/* Email Content Card */}
                  <div className="card">
                    <div className="card-label" style={{ justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>✉️</span> Email Content
                      </span>
                      {fullBodies[selectedMail.id] && (
                        <button
                          onClick={() => setFullBodies(prev => {
                            const next = { ...prev };
                            delete next[selectedMail.id];
                            return next;
                          })}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-muted)',
                            color: 'var(--text-secondary)',
                            borderRadius: '6px',
                            padding: '2px 10px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            lineHeight: '1.4',
                            transition: 'all 0.15s',
                            fontWeight: '600',
                          }}
                          onMouseEnter={e => {
                            e.target.style.background = 'var(--border-muted)';
                            e.target.style.color = 'var(--text-primary)';
                          }}
                          onMouseLeave={e => {
                            e.target.style.background = 'transparent';
                            e.target.style.color = 'var(--text-secondary)';
                          }}
                          title="Close full email"
                        >
                          ✕ Close
                        </button>
                      )}
                    </div>
                    {fullBodies[selectedMail.id] ? (
                      <EmailPreview html={fullBodies[selectedMail.id]} />
                    ) : (
                      <div>
                        <p className="summary-text" style={{ opacity: 0.7, marginBottom: '16px' }}>{decodeHtmlEntities(selectedMail.snippet)}...</p>
                        <button className="btn-sec" onClick={() => fetchFullEmail(selectedMail.id)}>
                          {isFetchingBody ? <div className="spinner"></div> : "View Full Email"}
                        </button>
                      </div>
                    )}
                  </div>


                  {/* AI Draft Card */}
                  <div className="card">
                    <div className="card-label">
                      <span>✍️</span> AI Draft Reply
                    </div>
                    {(() => {
                      const emailId = selectedMail?.id;
                      const aiData = aiResults?.[emailId];
                      const isAnalyzing = aiData?.loading === true;
                      const draft = aiData?.draft_reply;
                      const hasDraft = draft && 
                          typeof draft === 'string' && 
                          draft.length > 10 &&
                          draft !== 'null';

                      return (
                        <>
                          {isAnalyzing && (
                            <div style={{ padding: '4px 0' }}>
                              <div className="ai-skel" style={{ width: '100%' }}></div>
                              <div className="ai-skel" style={{ width: '80%' }}></div>
                              <div className="ai-skel" style={{ width: '60%' }}></div>
                            </div>
                          )}
                          {!isAnalyzing && hasDraft && (
                            <>
                              <p style={{fontSize:14, lineHeight:1.7, color:'#C9D1D9', marginBottom: '16px'}}>
                                {draft}
                              </p>
                              <div className="btn-row">
                                <button
                                  className="btn-send"
                                  onClick={() => sendDraftReply(selectedMail)}
                                  disabled={sendingReplyIds.has(selectedMail.id)}
                                >
                                  {sendingReplyIds.has(selectedMail.id) ? "Sending..." : "Send reply"}
                                </button>
                                <button className="btn-sec" onClick={() => handleEmailSelect(selectedMail)}>Regenerate</button>
                                <button className="btn-sec" onClick={() => navigator.clipboard.writeText(draft)}>Copy</button>
                              </div>
                            </>
                          )}
                          {!isAnalyzing && !hasDraft && (
                            <p style={{fontSize:13, color:'#8B949E', fontStyle:'italic'}}>
                              {aiData ? 'Could not generate draft.' : 'AI drafting coming soon...'}
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Voice Briefing Bar */}
                <div 
                  className="voice-bar" 
                  onClick={() => setShowVoiceModal(true)} 
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>🎙️ Get voice briefing on WhatsApp</span>
                  <span style={{ color: '#F0A500', fontSize: '12px', fontWeight: '600' }}>
                    Tap to schedule →
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-icon">📨</div>
                <div className="empty-title">Select an email to read</div>
                <div className="empty-subtitle">Pick something from the list to see AI insights.</div>
              </div>
            )}
          </section>
        </>
        )}

        {/* ── Senders View ── */}
        {activeTab === 'senders' && (
          <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 66px)', overflow: 'hidden' }}>
            {/* LEFT PANEL */}
            <div style={{ width: '380px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
              <div style={{ padding: '16px 16px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Senders</h1>
                  <span style={{ background: 'var(--border)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{senders.length}</span>
                </div>
                <input
                  type="text"
                  placeholder="Search senders..."
                  value={senderSearch}
                  onChange={e => setSenderSearch(e.target.value)}
                  style={{
                    background: '#161B22', border: '1px solid #30363D', borderRadius: '8px',
                    padding: '8px 12px', width: '100%', color: '#E6EDF3', fontSize: '13px',
                    outline: 'none', marginBottom: '12px'
                  }}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredSenders.map(sender => {
                  const avatarColors = ['#F0A500','#1AAB8A','#7B7BF5','#E05C5C','#3B8BD4','#E8A87C'];
                  const colorIndex = (sender.name || 'A').charCodeAt(0) % avatarColors.length;
                  const isSelected = selectedSender?.email === sender.email;
                  return (
                    <div
                      key={sender.email}
                      onClick={() => { setSelectedSender(sender); setSenderEmails(sender.emails); setSelectedMailId(null); }}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer',
                        borderBottom: '1px solid #21262D', background: isSelected ? '#161B22' : 'transparent',
                        borderLeft: isSelected ? '3px solid #F0A500' : '3px solid transparent',
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#161B22'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', background: avatarColors[colorIndex],
                        color: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '600', fontSize: '16px', flexShrink: 0, marginRight: '12px'
                      }}>{sender.avatar}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sender.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                            {new Date(sender.latestDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#C9D1D9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }}>{decodeHtmlEntities(sender.latestSubject)}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{decodeHtmlEntities(sender.latestSnippet)}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '8px' }}>
                        {sender.unreadCount > 0 && (
                          <div style={{
                            background: '#F0A500', color: '#0D1117', borderRadius: '50%', minWidth: '20px', height: '20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600'
                          }}>{sender.unreadCount}</div>
                        )}
                        {sender.urgentCount > 0 && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF2A55' }}></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', position: 'relative' }}>
              {selectedSender ? (
                <>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #21262D', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                      background: ['#F0A500','#1AAB8A','#7B7BF5','#E05C5C','#3B8BD4','#E8A87C'][(selectedSender.name || 'A').charCodeAt(0) % 6],
                      color: '#0D1117', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '20px'
                    }}>{selectedSender.avatar}</div>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>{selectedSender.name}</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{selectedSender.email}</div>
                      <div style={{ fontSize: '13px', color: '#8B949E', marginTop: '4px' }}>{selectedSender.emails.length} emails · {selectedSender.unreadCount} unread</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                    {senderEmails.map(email => {
                      const ai = aiResults[email.id];
                      const isExpanded = selectedMailId === email.id;
                      return (
                        <div key={email.id} style={{
                          background: '#161B22', border: '1px solid #21262D', borderRadius: '10px',
                          padding: '16px', margin: '0 16px 12px', cursor: 'pointer', transition: 'border-color 0.2s'
                        }} onClick={() => handleEmailSelect(email)}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ fontSize: '15px', fontWeight: '500', color: '#E6EDF3', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {!email.is_read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F0A500', flexShrink: 0 }}></span>}
                              {decodeHtmlEntities(email.subject)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                              {new Date(email.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', color: '#8B949E', lineHeight: '1.5', marginTop: '6px' }}>
                            {decodeHtmlEntities(email.snippet)}
                          </div>
                          {ai && (ai?.priority === 'urgent' || ai?.requires_reply || ai?.priority === 'low') && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                              {ai?.priority === 'urgent' && <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(255,42,85,0.15)', color: '#FF2A55', padding: '2px 8px', borderRadius: '12px' }}>URGENT</span>}
                              {ai?.priority === 'low' && <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(26,171,138,0.15)', color: '#1AAB8A', padding: '2px 8px', borderRadius: '12px' }}>LOW PRIORITY</span>}
                              {ai?.requires_reply && <span style={{ fontSize: '10px', fontWeight: 'bold', background: 'rgba(50,173,230,0.15)', color: '#32ADE6', padding: '2px 8px', borderRadius: '12px' }}>REPLY NEEDED</span>}
                            </div>
                          )}

                          {isExpanded && (
                            <div style={{ marginTop: '16px', borderTop: '1px solid #21262D', paddingTop: '16px' }} onClick={e => e.stopPropagation()}>
                              
                              <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8B949E', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>🕒</span> THREAD HISTORY
                                </div>
                                <div style={{ background: '#0D1117', padding: '16px', borderRadius: '8px', border: '1px solid #30363D', fontSize: '13px', color: '#C9D1D9' }}>
                                  <div style={{ marginBottom: email.labels?.length ? '12px' : '0' }}>
                                    Received on {new Date(email.date).toLocaleDateString()} at {new Date(email.date).toLocaleTimeString()}
                                  </div>
                                  {email.labels && email.labels.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                      {email.labels.map(l => (
                                        <span key={l} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', color: '#8B949E' }}>
                                          {l.replace('CATEGORY_', '').toLowerCase()}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8B949E', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>✉️</span> EMAIL CONTENT
                                </div>
                                {fullBodies[email.id] ? (
                                  <div style={{ background: '#0D1117', padding: '16px', borderRadius: '8px', border: '1px solid #30363D', marginBottom: '8px', overflowX: 'auto' }}>
                                    <EmailPreview html={fullBodies[email.id]} />
                                  </div>
                                ) : (
                                  <div>
                                    <button className="btn-sec" style={{ fontSize: '12px', padding: '6px 12px', minHeight: '30px' }} onClick={(e) => { e.stopPropagation(); fetchFullEmail(email.id); }}>
                                      {isFetchingBody ? "Loading..." : "View Full Email"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8B949E', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>✨</span> AI Context Summary
                                </div>
                                {ai?.loading ? (
                                  <div style={{ color: '#8B949E', fontSize: '13px', fontStyle: 'italic' }}>Generating summary...</div>
                                ) : ai?.summary && ai?.summary.length > 10 && ai?.summary !== 'null' && ai?.summary !== 'None' && !ai?.summary.includes('Could not') ? (
                                  <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#C9D1D9' }}>{ai?.summary}</div>
                                ) : (
                                  <div style={{ color: '#8B949E', fontSize: '13px', fontStyle: 'italic' }}>No AI summary available.</div>
                                )}
                              </div>
                              
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8B949E', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>✍️</span> AI Draft Reply
                                </div>
                                {ai?.loading ? (
                                  <div style={{ color: '#8B949E', fontSize: '13px', fontStyle: 'italic' }}>Generating draft...</div>
                                ) : ai?.draft_reply && ai?.draft_reply.length > 10 && ai?.draft_reply !== 'null' ? (
                                  <>
                                    <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#C9D1D9', marginBottom: '12px', background: '#0D1117', padding: '12px', borderRadius: '8px', border: '1px solid #30363D' }}>{ai?.draft_reply}</div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button className="btn-send" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px' }} onClick={() => sendDraftReply(email)} disabled={sendingReplyIds.has(email.id)}>
                                        {sendingReplyIds.has(email.id) ? "Sending..." : "Send Reply"}
                                      </button>
                                      <button className="btn-sec" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px' }} onClick={() => handleEmailSelect(email)}>Regenerate</button>
                                      <button className="btn-sec" style={{ minHeight: '32px', fontSize: '12px', padding: '0 12px' }} onClick={() => navigator.clipboard.writeText(ai?.draft_reply)}>Copy</button>
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ color: '#8B949E', fontSize: '13px', fontStyle: 'italic' }}>No draft reply generated.</div>
                                )}
                              </div>
                              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button className="btn-sec" style={{ fontSize: '12px', padding: '6px 12px', minHeight: '30px' }} onClick={(e) => { e.stopPropagation(); setSelectedMailId(null); }}>Close</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B949E' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>📨</div>
                  <div style={{ fontSize: '14px' }}>Select a sender to see all their emails</div>
                </div>
              )}
            </div>
          </div>
        )}

        {showVoiceModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '90%' }}>
              <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>🎙️ WhatsApp Voice Briefing</div>
              <div style={{ fontSize: '13px', color: '#8B949E', marginBottom: '20px' }}>Get your daily email summary as a voice note</div>

              {/* Section 1 */}
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#F0A500', letterSpacing: '1px', fontWeight: 'bold' }}>Send briefing at</div>
              <input 
                type="time" 
                value={scheduledTime} 
                onChange={(e) => setScheduledTime(e.target.value)}
                style={{ background: '#0D1117', border: '1px solid #30363D', borderRadius: '8px', padding: '10px 14px', color: '#E6EDF3', fontSize: '16px', width: '100%', marginTop: '6px', boxSizing: 'border-box', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {['06:00', '07:30', '08:00', '09:00'].map(t => {
                  const isActive = scheduledTime === t;
                  const label = parseInt(t.split(':')[0]) > 12 ? `${parseInt(t.split(':')[0]) - 12}:${t.split(':')[1]} PM` : `${parseInt(t.split(':')[0])}:${t.split(':')[1]} AM`;
                  return (
                    <div 
                      key={t}
                      onClick={() => setScheduledTime(t)}
                      style={{ 
                        background: isActive ? '#F0A500' : '#21262D', border: isActive ? '1px solid #F0A500' : '1px solid #30363D',
                        borderRadius: '20px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer',
                        color: isActive ? '#0D1117' : '#8B949E', fontWeight: isActive ? '600' : 'normal'
                      }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>

              <div style={{ height: '1px', background: '#30363D', margin: '20px 0' }}></div>

              {/* Section 2 */}
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#F0A500', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '12px' }}>Voice note preview</div>
              
              {!voiceGenerated && !isGeneratingVoice && (
                <button 
                  onClick={generateVoiceBriefing}
                  style={{ width: '100%', background: '#1AAB8A', color: 'white', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', border: 'none' }}
                >
                  ✨ Generate Voice Note
                </button>
              )}

              {isGeneratingVoice && (
                <div style={{ background: '#0D1117', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F0A500', animation: `pulse 1.5s infinite ease-in-out ${i * 0.2}s` }}></div>
                    ))}
                  </div>
                  <div style={{ color: '#8B949E', fontSize: '13px' }}>Generating your briefing...</div>
                </div>
              )}

              {voiceGenerated && (
                <div style={{ background: '#0D1117', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      onClick={() => {
                        if (!audioElement) return;
                        if (isPlayingVoice) {
                          audioElement.pause();
                          setIsPlayingVoice(false);
                        } else {
                          audioElement.play();
                          setIsPlayingVoice(true);
                        }
                      }}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F0A500', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#0D1117', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      {isPlayingVoice ? '||' : '▶'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#E6EDF3' }}>Morning briefing ready</div>
                      <div style={{ fontSize: '12px', color: '#8B949E' }}>{voiceDuration}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '24px', marginTop: '12px', padding: '0 4px' }}>
                    {[...Array(10)].map((_, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          flex: 1, background: isPlayingVoice ? '#F0A500' : '#30363D', borderRadius: '2px',
                          height: isPlayingVoice ? `${[40, 70, 50, 90, 60, 100, 50, 80, 40, 100][i]}%` : '20%',
                          transition: 'height 0.1s'
                        }}
                      ></div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button onClick={generateVoiceBriefing} style={{ background: 'none', border: 'none', color: '#8B949E', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Regenerate</button>
                  </div>
                </div>
              )}

              <div style={{ height: '1px', background: '#30363D', margin: '20px 0' }}></div>

              {/* Section 3 */}
              <button 
                onClick={sendToWhatsApp}
                disabled={!voiceGenerated}
                style={{ 
                  width: '100%', background: '#25D366', color: 'white', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '600', border: 'none', cursor: voiceGenerated ? 'pointer' : 'not-allowed', opacity: voiceGenerated ? 1 : 0.5 
                }}
              >
                📱 Send to WhatsApp Now
              </button>

              <button 
                onClick={() => {
                  showToast(`Briefing scheduled for ${scheduledTime}!`);
                  setShowVoiceModal(false);
                }}
                style={{ 
                  width: '100%', background: 'transparent', color: '#F0A500', borderRadius: '8px', padding: '12px', fontSize: '14px', border: '1px solid #F0A500', cursor: 'pointer', marginTop: '8px' 
                }}
              >
                ⏰ Schedule for {scheduledTime}
              </button>

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button onClick={() => setShowVoiceModal(false)} style={{ background: 'none', border: 'none', color: '#8B949E', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              </div>

            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#161B22', border: '1px solid #1AAB8A', borderRadius: '8px', padding: '12px 16px', color: '#1AAB8A', fontSize: '13px', zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
            {toast}
          </div>
        )}

      </div>
    </ErrorBoundary>
  );
};

export default App;
