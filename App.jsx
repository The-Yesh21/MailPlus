import React, { useState, useEffect, useRef } from 'react';
import Landing from './src/Landing';

const EmailPreview = ({ html }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    // Check if html contains any tags, if not wrap in p tags
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);
    const content = hasHtmlTags ? html : `<p>${html.replace(/\n/g, '<br/>')}</p>`;

    const srcDoc = `
      <!DOCTYPE html>
      <html>
      <head>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: -apple-system, sans-serif; 
          font-size: 14px; 
          line-height: 1.6; 
          color: #E6EDF3; 
          background: transparent; 
          margin: 16px;
          word-wrap: break-word;
        }
        img { max-width: 100%; height: auto; }
        a { color: #F0A500; }
        * { max-width: 100%; box-sizing: border-box; }
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
      iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px';
    }
  };

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      style={{ width: '100%', border: 'none', minHeight: '200px', display: 'block' }}
      onLoad={handleLoad}
      title="Email Preview"
    />
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [mails, setMails] = useState([]);
  const [selectedMailId, setSelectedMailId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState('All Mail');
  const [fullBodies, setFullBodies] = useState({}); // Store full email bodies by id
  const [isFetchingBody, setIsFetchingBody] = useState(false);
  const [aiResults, setAiResults] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());

  const API_BASE = "http://localhost:8000";

  const AttractiveLoader = ({ text = "Processing" }) => (
    <div className="attractive-loader">
      <div className="pulse-ring" />
      <span className="shimmer-text">{text}</span>
    </div>
  );

  // Auth & Token Management
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('mp_token', token);
      setIsTransitioning(true); // Start transition when token detected
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    const savedToken = localStorage.getItem('mp_token');
    if (savedToken) {
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        setUser({
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        });

        // Load cached mails
        const cachedMails = localStorage.getItem(`mp_mails_${payload.email}`);
        if (cachedMails) {
          const parsed = JSON.parse(cachedMails);
          setMails(parsed);
          if (parsed.length > 0) {
            setSelectedMailId(parsed[0].id);
          }
        }
      } catch (e) {
        localStorage.removeItem('mp_token');
      }
    }
    setAuthChecked(true);
  }, []);

  // Fetch Emails on Load or Token Change
  useEffect(() => {
    const token = localStorage.getItem('mp_token');
    if (token && user) {
      fetchEmails();
    }
  }, [user]);

  const fetchEmails = async () => {
    const token = localStorage.getItem('mp_token');
    if (!token || !user) return;

    // Determine 'after' timestamp if we have mails
    let afterParam = "";
    if (mails.length > 0) {
      const maxDate = Math.max(...mails.map(m => m.internal_date || 0));
      if (maxDate > 0) {
        afterParam = `?after=${maxDate}`;
      }
    }

    if (mails.length === 0) setIsLoading(true);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE}/emails${afterParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await response.json();
      const newMails = (data.emails || []).map(mail => ({
        ...mail,
        tag: getUrgencyTag(mail)
      }));
      
      if (newMails.length > 0) {
        setMails(prevMails => {
          // Merge and avoid duplicates by ID
          const existingIds = new Set(prevMails.map(m => m.id));
          const filteredNew = newMails.filter(m => !existingIds.has(m.id));
          const combined = [...filteredNew, ...prevMails];
          
          // Sort by date newest first
          combined.sort((a, b) => (b.internal_date || 0) - (a.internal_date || 0));
          
          // Persist to localStorage
          localStorage.setItem(`mp_mails_${user.email}`, JSON.stringify(combined));
          
          if (!selectedMailId && combined.length > 0) {
            setSelectedMailId(combined[0].id);
          }
          
          // Trigger AI analysis for the first 10 emails
          analyzeBatch(combined.slice(0, 10));

          return combined;
        });
      }

      // Ensure minimum 1.2s transition
      const elapsed = Date.now() - startTime;
      if (elapsed < 1200) {
        await new Promise(resolve => setTimeout(resolve, 1200 - elapsed));
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setIsLoading(false);
      setIsTransitioning(false); // End transition
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`);
      const { auth_url } = await response.json();
      window.location.href = auth_url;
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mp_token');
    setUser(null);
    setMails([]);
    window.location.reload();
  };

  const getUrgencyTag = (mail) => {
    const subject = (mail.subject || "").toLowerCase();
    const urgentKeywords = ["urgent", "asap", "deadline", "action required", "today", "reminder", "follow up"];
    
    if (urgentKeywords.some(keyword => subject.includes(keyword))) {
      return "urgent";
    }

    if (!mail.is_read) {
      return "new";
    }

    return null;
  };

  const getFilteredMails = () => {
    if (activeTab === 'Awaiting Reply') {
      return mails.filter(m => !m.is_read);
    }
    if (activeTab === 'Priority Feed') {
      return mails
        .filter(m => {
          const ai = aiResults[m.id];
          return ai && (ai.priority === 'urgent' || ai.requires_reply);
        })
        .sort((a, b) => {
          const aiA = aiResults[a.id];
          const aiB = aiResults[b.id];
          if (aiA.priority === 'urgent' && aiB.priority !== 'urgent') return -1;
          if (aiA.priority !== 'urgent' && aiB.priority === 'urgent') return 1;
          if (aiA.requires_reply && !aiB.requires_reply) return -1;
          if (!aiA.requires_reply && aiB.requires_reply) return 1;
          return (b.internal_date || 0) - (a.internal_date || 0);
        });
    }
    // All other tabs (All Mail) show all emails newest first
    return mails;
  };

  const handleScan = async () => {
    setIsScanning(true);
    await fetchEmails();
    setIsScanning(false);
  };

  const analyzeEmail = async (mail) => {
    const token = localStorage.getItem('mp_token');
    if (!token) return;

    setAnalyzingIds(prev => new Set(prev).add(mail.id));
    try {
      const response = await fetch(`${API_BASE}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email_id: mail.id,
          subject: mail.subject,
          from_name: mail.from_name,
          body_preview: mail.body_preview,
          snippet: mail.snippet
        })
      });
      const data = await response.json();
      setAiResults(prev => ({ ...prev, [mail.id]: data }));
      return data;
    } catch (error) {
      console.error("Failed to analyze email:", error);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(mail.id);
        return next;
      });
    }
  };

  const analyzeBatch = async (batch) => {
    const token = localStorage.getItem('mp_token');
    if (!token || batch.length === 0) return;

    // Filter out already analyzed emails
    const toAnalyze = batch.filter(m => !aiResults[m.id]);
    if (toAnalyze.length === 0) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/ai/analyze-batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emails: toAnalyze })
      });
      const data = await response.json();
      setAiResults(prev => ({ ...prev, ...data.results }));
    } catch (error) {
      console.error("Failed to analyze batch:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchFullEmail = async (id) => {
    const token = localStorage.getItem('mp_token');
    setIsFetchingBody(true);
    try {
      const response = await fetch(`${API_BASE}/emails/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setFullBodies(prev => ({ ...prev, [id]: data.body }));
    } catch (error) {
      console.error("Failed to fetch full email:", error);
    } finally {
      setIsFetchingBody(false);
    }
  };

  const getTagColor = (tag) => {
    switch (tag) {
      case 'urgent': return '#F0A500';
      case 'new': return '#1AAB8A';
      default: return '#8B949E';
    }
  };

  const cleanEmailBody = (text) => {
    if (!text) return "";
    let clean = text;
    // Strip style tags and their content
    clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // Strip CSS blocks (anything between { and })
    clean = clean.replace(/\{[^\}]*\}/g, '');
    // Strip HTML tags
    clean = clean.replace(/<[^>]+>/g, '');
    // Replace HTML entities
    const entities = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&#39;': "'",
      '&quot;': '"'
    };
    Object.keys(entities).forEach(entity => {
      clean = clean.replace(new RegExp(entity, 'g'), entities[entity]);
    });
    // Collapse multiple whitespace/newlines
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  };

  const selectedMail = mails.find(m => m.id === selectedMailId);

  if (!authChecked) return null;

  if (!user) {
    return <Landing onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Instrument+Serif:ital@0;1&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #0D1117; color: #E6EDF3; font-family: 'DM Sans', sans-serif; overflow: hidden; }
        .app-container { display: flex; height: 100vh; width: 100vw; user-select: none; }

        /* Logo & Transition Styles */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes bouncyScale {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.0); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(240,165,0,0.3)); }
          50% { filter: drop-shadow(0 0 25px rgba(240,165,0,0.7)); }
        }

        .sidebar-logo {
          height: 28px;
          width: auto;
          animation: slideInLeft 0.5s ease forwards;
          transition: transform 0.15s ease;
          will-change: transform;
          margin-bottom: 32px;
        }
        .sidebar-logo:hover {
          transform: scale(1.03);
        }

        .login-logo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 40px;
        }
        .login-logo {
          height: 64px;
          width: auto;
          animation: 
            bouncyScale 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
            glowPulse 4s ease-in-out infinite;
          will-change: transform;
          margin-bottom: 16px;
        }
        .login-tagline {
          font-family: 'Instrument Serif', serif;
          font-size: 20px;
          color: #8B949E;
        }

        .transition-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #0D1117;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          transition: opacity 0.5s ease;
        }
        .transition-logo {
          height: 96px;
          width: auto;
          animation: glowPulse 2s ease-in-out infinite;
          will-change: transform;
          margin-bottom: 24px;
        }
        .transition-text {
          font-size: 14px;
          color: #F0A500;
          opacity: 0.8;
          font-weight: 500;
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }

        .sidebar { width: 220px;
 background-color: #0D1117; border-right: 1px solid #30363D; display: flex; flex-direction: column; padding: 24px 16px; flex-shrink: 0; overflow-y: auto; }
        .user-profile { margin-bottom: 32px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .user-avatar { width: 48px; height: 48px; border-radius: 50%; border: 1px solid #30363D; margin-bottom: 12px; }
        .user-name { font-size: 13px; font-weight: 600; color: #E6EDF3; }
        .user-email { font-size: 11px; color: #8B949E; margin-bottom: 8px; }
        .signout-btn { background: none; border: none; color: #484F58; font-size: 11px; cursor: pointer; }
        .signout-btn:hover { color: #8B949E; }

        .logo { font-family: 'Instrument Serif', serif; font-size: 24px; display: flex; align-items: center; gap: 10px; margin-bottom: 32px; color: #E6EDF3; }
        .logo-dot { width: 8px; height: 8px; background-color: #F0A500; border-radius: 50%; }

        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 32px; }
        .stat-card { background-color: #161B22; border: 1px solid #30363D; padding: 12px; border-radius: 10px; }
        .stat-value { font-size: 18px; font-weight: 700; display: block; }
        .stat-label { font-size: 10px; color: #8B949E; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px; }

        .analyzing-indicator { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; padding: 0 8px; }
        .amber-dot { width: 8px; height: 8px; background-color: #F0A500; border-radius: 50%; animation: pulse-amber 1.5s infinite; }
        @keyframes pulse-amber { 0% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.4; transform: scale(0.8); } }
        .analyzing-text { font-size: 14px; color: #8B949E; }

        .nav-section { margin-bottom: 24px; }
        .nav-title { font-size: 11px; font-weight: 600; color: #484F58; margin-bottom: 12px; padding-left: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .nav-item { padding: 8px 12px; border-radius: 6px; font-size: 14px; color: #8B949E; cursor: pointer; transition: all 0.2s; margin-bottom: 4px; }
        .nav-item:hover { background-color: #161B22; color: #E6EDF3; }
        .nav-item.active { background-color: #161B22; color: #F0A500; font-weight: 500; }

        .skeleton-row { padding: 16px 20px; border-bottom: 1px solid #30363D; background-color: #1C2128; border-radius: 10px; margin: 8px 12px; }
        .skeleton-line { height: 10px; background-color: #E6EDF3; border-radius: 4px; margin-bottom: 8px; opacity: 0.4; animation: skeleton-pulse 1.2s infinite ease-in-out; }
        .skeleton-line.short { width: 40%; }
        .skeleton-line.medium { width: 50%; }
        .skeleton-line.long { width: 70%; }
        @keyframes skeleton-pulse { 0% { opacity: 0.3; } 50% { opacity: 0.6; } 100% { opacity: 0.3; } }

        .mail-list { width: 380px; min-width: 380px; background-color: #0D1117; border-right: 1px solid #30363D; display: flex; flex-direction: column; flex-shrink: 0; }
        .list-header { padding: 24px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363D; }
        .list-title { font-size: 18px; font-weight: 600; }
        .scan-btn { background-color: #161B22; border: 1px solid #30363D; color: #E6EDF3; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .spinner { width: 12px; height: 12px; border: 2px solid #F0A500; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .list-content { overflow-y: auto; flex: 1; }
        .section-header { font-size: 14px; font-weight: 600; color: #E6EDF3; margin: 16px 20px 8px; }

        .mail-item { padding: 14px 16px; border-bottom: 1px solid #21262D; cursor: pointer; position: relative; transition: background-color 0.2s; }
        .mail-item:hover { background-color: #161B22; }
        .mail-item.selected { background-color: #1C2128; }
        .priority-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
        .mail-top { display: flex; justify-content: space-between; margin-bottom: 6px; align-items: center; }
        .unread-dot { width: 6px; height: 6px; background-color: #F0A500; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .sender-name { font-weight: 600; font-size: 14px; }
        .mail-time { font-size: 11px; color: #484F58; }
        .mail-subject { font-size: 13px; color: #E6EDF3; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mail-snippet { font-size: 12px; color: #8B949E; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 10px; }
        .tag-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; margin-right: 6px; }

        .detail-panel { flex: 1; background-color: #0D1117; display: flex; flex-direction: column; position: relative; }
        .detail-header { padding: 24px; border-bottom: 1px solid #30363D; }
        .detail-sender-info { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
        .avatar { width: 44px; height: 44px; background-color: #161B22; border: 1px solid #30363D; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #F0A500; font-size: 16px; overflow: hidden; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sender-details h2 { font-size: 18px; font-weight: 600; margin-bottom: 2px; }
        .sender-email { font-size: 13px; color: #8B949E; }
        .detail-subject { font-size: 28px; font-weight: 500; color: #E6EDF3; letter-spacing: -0.5px; }

        .detail-body { padding: 24px; overflow-y: auto; flex: 1; padding-bottom: 140px; }
        .card { background-color: #161B22; border: 1px solid #30363D; border-radius: 10px; padding: 24px; margin-bottom: 24px; }
        .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; font-size: 13px; font-weight: 600; color: #F0A500; text-transform: uppercase; letter-spacing: 0.5px; }
        .card-title { color: #E6EDF3; }
        .summary-text { font-size: 15px; line-height: 1.8; color: #E6EDF3; white-space: pre-wrap; }
        
        .draft-area { background-color: #0D1117; border: 1px solid #30363D; border-radius: 8px; padding: 20px; font-size: 14px; line-height: 1.8; color: #8B949E; margin-bottom: 24px; font-style: italic; }
        .action-group { display: flex; gap: 12px; }
        .btn { padding: 10px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; border: none; }
        .btn-primary { background-color: #F0A500; color: #0D1117; opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background-color: #161B22; border: 1px solid #30363D; color: #E6EDF3; opacity: 0.5; cursor: not-allowed; }

        .voice-bar { position: absolute; bottom: 24px; left: 40px; right: 40px; background-color: #161B22; border: 1px solid #30363D; border-radius: 40px; padding: 14px 28px; display: flex; align-items: center; gap: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); }
        .play-btn { width: 36px; height: 36px; background-color: #F0A500; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0D1117; }
        .waveform { display: flex; align-items: center; gap: 4px; flex: 1; height: 28px; }
        .wave-bar { width: 3px; background-color: #F0A500; border-radius: 2px; transition: height 0.3s ease; }
        .wave-active { animation: wave 1.2s ease-in-out infinite; }
        @keyframes wave { 0%, 100% { height: 6px; } 50% { height: 24px; } }
        .briefing-info { font-size: 13px; color: #E6EDF3; font-weight: 500; }
        .whatsapp-btn { background-color: transparent; color: #F0A500; font-size: 13px; font-weight: 600; border: none; }

        /* Attractive Loader Styles */
        .attractive-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 32px;
          min-height: 120px;
          width: 100%;
        }
        .pulse-ring {
          width: 32px;
          height: 32px;
          border: 3px solid #F0A50015;
          border-radius: 50%;
          position: relative;
        }
        .pulse-ring::after {
          content: "";
          position: absolute;
          top: -3px; left: -3px; right: -3px; bottom: -3px;
          border: 3px solid #F0A500;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 0.8s linear infinite;
        }
        .shimmer-text {
          font-size: 11px;
          font-weight: 700;
          color: #F0A500;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          animation: pulse-opacity 1.5s ease-in-out infinite;
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>

      {isTransitioning && (
        <div className="transition-overlay">
          <img src="/logo.png" alt="MailPulse" className="transition-logo" />
          <div className="transition-text">Setting up your inbox...</div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="user-profile">
          <img src={user.picture} alt={user.name} className="user-avatar" />
          <span className="user-name">{user.name}</span>
          <span className="user-email">{user.email}</span>
          <button className="signout-btn" onClick={handleLogout}>Sign out</button>
        </div>

        <img src="/logo.png" alt="MailPulse" className="sidebar-logo" />

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value" style={{ color: '#F0A500' }}>
              {mails.filter(m => aiResults[m.id]?.priority === 'urgent').length}
            </span>
            <span className="stat-label">Urgent</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {mails.filter(m => !m.is_read).length}
            </span>
            <span className="stat-label">Unread</span>
          </div>
        </div>

        {isAnalyzing && (
          <div className="analyzing-indicator">
            <div className="amber-dot" />
            <span className="analyzing-text">Analyzing emails...</span>
          </div>
        )}

        <div className="nav-section">
          <h3 className="nav-title">Navigation</h3>
          {['Priority Feed', 'All Mail', 'Awaiting Reply'].map(tab => (
            <div 
              key={tab}
              className={`nav-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              {tab}
              {tab === 'Priority Feed' && mails.filter(m => aiResults[m.id]?.priority === 'urgent').length > 0 && (
                <span style={{ fontSize: '10px', backgroundColor: '#F0A500', color: '#0D1117', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {mails.filter(m => aiResults[m.id]?.priority === 'urgent').length}
                </span>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Mail List */}
      <main className="mail-list">
        <header className="list-header">
          <h1 className="list-title">{activeTab}</h1>
          <button className="scan-btn" onClick={handleScan} disabled={isScanning}>
            {isScanning ? <><div className="spinner" /> Scanning...</> : "Scan now"}
          </button>
        </header>

        <div className="list-content">
          <div className="section-header">{activeTab}</div>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-line long" />
                <div className="skeleton-line medium" />
                <div className="skeleton-line short" />
              </div>
            ))
          ) : activeTab === 'Priority Feed' && isAnalyzing && getFilteredMails().length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100px', gap: '12px' }}>
              <div className="amber-dot" />
              <span className="analyzing-text">Scanning for priority emails...</span>
            </div>
          ) : activeTab === 'Priority Feed' && !isAnalyzing && getFilteredMails().length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: '#484F58', fontSize: '14px' }}>
              No urgent emails right now
            </div>
          ) : (
            getFilteredMails().map(mail => (
              <div 
                key={mail.id} 
                className={`mail-item ${selectedMailId === mail.id ? 'selected' : ''}`}
                onClick={() => setSelectedMailId(mail.id)}
              >
                <div className="priority-bar" style={{ backgroundColor: getTagColor(mail.tag) }} />
                <div className="mail-top">
                  <span className="sender-name">
                    {!mail.is_read && <div className="unread-dot" />}
                    {mail.from_name}
                  </span>
                  <span className="mail-time">{new Date(mail.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="mail-subject">{mail.subject}</div>
                <div className="mail-snippet">{mail.snippet}</div>
                <div className="tag-group">
                  {aiResults[mail.id] ? (
                    <>
                      {aiResults[mail.id].priority === 'urgent' && (
                        <div className="tag-badge" style={{ backgroundColor: '#F0A50015', color: '#F0A500', border: '1px solid #F0A50030' }}>URGENT</div>
                      )}
                      {aiResults[mail.id].requires_reply && aiResults[mail.id].priority !== 'urgent' && (
                        <div className="tag-badge" style={{ backgroundColor: '#1AAB8A15', color: '#1AAB8A', border: '1px solid #1AAB8A30' }}>REPLY</div>
                      )}
                    </>
                  ) : mail.tag && (
                    <div className="tag-badge" style={{ backgroundColor: `${getTagColor(mail.tag)}15`, color: getTagColor(mail.tag) }}>
                      {mail.tag}
                    </div>
                  )}
                  {mail.labels && mail.labels.includes('IMPORTANT') && (
                    <div className="tag-badge" style={{ backgroundColor: '#F0A50015', color: '#F0A500' }}>important</div>
                  )}
                  {mail.labels && mail.labels.includes('CATEGORY_PROMOTIONS') && (
                    <div className="tag-badge" style={{ backgroundColor: '#484F5815', color: '#8B949E' }}>promo</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Detail Panel */}
      <section className="detail-panel">
        {selectedMail ? (
          <>
            <header className="detail-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="detail-sender-info">
                  <div className="avatar">
                    {selectedMail.from_name[0]}
                  </div>
                  <div className="sender-details">
                    <h2>{selectedMail.from_name}</h2>
                    <p className="sender-email">{selectedMail.from_email}</p>
                  </div>
                </div>
                <a 
                  href={`https://mail.google.com/mail/u/0/#inbox/${selectedMail.id}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="scan-btn"
                  style={{ textDecoration: 'none' }}
                >
                  Open in Gmail
                </a>
              </div>
              <h1 className="detail-subject">{selectedMail.subject}</h1>
            </header>

            <div className="detail-body">
              <div className="card">
                <div className="card-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V5.73c-.6-.34-1-1.01-1-1.73a2 2 0 0 1 2-2M9 9a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H9m3 2a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2z" />
                    </svg>
                    <span className="card-title">{aiResults[selectedMail.id] ? "AI Context Summary" : (fullBodies[selectedMail.id] ? "Full Email Content" : "Email preview")}</span>
                  </div>
                  {!aiResults[selectedMail.id] && !analyzingIds.has(selectedMail.id) && (
                    <button 
                      className="scan-btn" 
                      style={{ fontSize: '10px', padding: '4px 10px', backgroundColor: '#F0A50015', color: '#F0A500' }}
                      onClick={() => analyzeEmail(selectedMail)}
                    >
                      Analyze this email
                    </button>
                  )}
                  {!fullBodies[selectedMail.id] && !isFetchingBody && (
                    <button 
                      className="scan-btn" 
                      style={{ fontSize: '10px', padding: '4px 10px' }}
                      onClick={() => fetchFullEmail(selectedMail.id)}
                    >
                      View Full Email
                    </button>
                  )}
                  {isFetchingBody && <div className="spinner" style={{ width: '14px', height: '14px' }} />}
                </div>
                {analyzingIds.has(selectedMail.id) ? (
                  <AttractiveLoader text="Analyzing with AI..." />
                ) : aiResults[selectedMail.id] ? (
                  <>
                    <p className="summary-text">{aiResults[selectedMail.id].summary || "No summary available."}</p>
                    {aiResults[selectedMail.id].deadline && (
                      <div className="tag-badge" style={{ backgroundColor: '#ff444415', color: '#ff4444', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm1 5h-2v7h6v-2h-4V7z"/></svg>
                        Deadline: {aiResults[selectedMail.id].deadline}
                      </div>
                    )}
                  </>
                ) : fullBodies[selectedMail.id] ? (
                  <EmailPreview html={fullBodies[selectedMail.id]} />
                ) : (
                  <p className="summary-text" style={{ maxHeight: '200px', overflowY: 'hidden' }}>
                    {cleanEmailBody(selectedMail.body_preview || selectedMail.snippet)}
                  </p>
                )}
              </div>

              <div className="card">
                <div className="card-header" style={{ color: '#8B949E' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 0 1 7-7 7 7 0 0 1 7 7 7 7 0 0 1-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
                  </svg>
                  <span className="card-title">Thread History</span>
                </div>
                <div className="history-item">
                  Received on {new Date(selectedMail.date).toLocaleDateString()} at {new Date(selectedMail.date).toLocaleTimeString()}
                  <br />
                  Labels: {selectedMail.labels ? selectedMail.labels.join(', ') : 'None'}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7l2.5-1.4M19.5 15.4L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14l-2.5 1.4M22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2M13.37 8.13c-.39-.39-1.02-.39-1.41 0L2.7 17.3c-.39.39-.39 1.02 0 1.41l2.59 2.59c.39.39 1.02.39 1.41 0l9.27-9.27c.39-.39.39-1.02 0-1.41l-2.6-2.5z" />
                  </svg>
                  <span className="card-title">AI Draft Reply</span>
                </div>
                {analyzingIds.has(selectedMail.id) ? (
                  <AttractiveLoader text="Drafting reply..." />
                ) : (
                  <>
                    <div className="draft-area">
                      {aiResults[selectedMail.id] ? 
                        (aiResults[selectedMail.id].draft_reply || "AI unavailable — try again") : 
                        "AI drafting is coming in the next iteration..."}
                    </div>
                    <div className="action-group">
                      <button className="btn btn-primary" style={{ opacity: aiResults[selectedMail.id] ? 1 : 0.5, cursor: aiResults[selectedMail.id] ? 'pointer' : 'not-allowed' }}>Send reply</button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ opacity: 1, cursor: 'pointer' }}
                        onClick={() => analyzeEmail(selectedMail)}
                      >
                        Regenerate
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ opacity: aiResults[selectedMail.id] ? 1 : 0.5, cursor: aiResults[selectedMail.id] ? 'pointer' : 'not-allowed' }}
                        onClick={() => {
                          if (aiResults[selectedMail.id]?.draft_reply) {
                            navigator.clipboard.writeText(aiResults[selectedMail.id].draft_reply);
                          }
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#484F58' }}>
            Select an email to view details
          </div>
        )}

        {/* Voice Briefing Panel */}
        <div className="voice-bar">
          <div className="play-btn" onClick={() => setIsPlayingBriefing(!isPlayingBriefing)}>
            {isPlayingBriefing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </div>
          <div className="briefing-info">Morning briefing ready · 47s</div>
          <div className="waveform">
            {[...Array(24)].map((_, i) => (
              <div 
                key={i} 
                className={`wave-bar ${isPlayingBriefing ? 'wave-active' : ''}`} 
                style={{ height: isPlayingBriefing ? '' : `${[8,12,6,18,14,22,10,16,8,24,12,18,6,20,14,24,10,18,8,12,6,16,10,14][i]}px`, animationDelay: `${i * 0.05}s` }} 
              />
            ))}
          </div>
          <button className="whatsapp-btn">Send to WhatsApp</button>
        </div>
      </section>
    </div>
  );
};

export default App;
