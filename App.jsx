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

  const API_BASE = "http://localhost:8000";

  // Auth & Token Management
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('mp_token', token);
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
          return combined;
        });
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setIsLoading(false);
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
    // All other tabs (Priority Feed, All Mail) show all emails newest first
    return mails;
  };

  const handleScan = async () => {
    setIsScanning(true);
    await fetchEmails();
    setIsScanning(false);
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

        .sidebar { width: 220px; background-color: #0D1117; border-right: 1px solid #30363D; display: flex; flex-direction: column; padding: 24px 16px; flex-shrink: 0; overflow-y: auto; }
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
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="user-profile">
          <img src={user.picture} alt={user.name} className="user-avatar" />
          <span className="user-name">{user.name}</span>
          <span className="user-email">{user.email}</span>
          <button className="signout-btn" onClick={handleLogout}>Sign out</button>
        </div>

        <div className="logo">
          <div className="logo-dot" />
          MailPulse
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value" style={{ color: '#F0A500' }}>
              {mails.filter(m => m.tag === 'urgent').length}
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

        <div className="nav-section">
          <h3 className="nav-title">Navigation</h3>
          {['Priority Feed', 'All Mail', 'Awaiting Reply'].map(tab => (
            <div 
              key={tab}
              className={`nav-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
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
                  {mail.tag && (
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
                    <span className="card-title">{fullBodies[selectedMail.id] ? "Full Email Content" : "Email preview"}</span>
                  </div>
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
                {fullBodies[selectedMail.id] ? (
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
                <div className="draft-area">AI drafting is coming in the next iteration...</div>
                <div className="action-group">
                  <button className="btn btn-primary">Send reply</button>
                  <button className="btn btn-secondary">Regenerate</button>
                  <button className="btn btn-secondary">Copy</button>
                </div>
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
