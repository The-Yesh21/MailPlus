import React, { useState, useEffect, useRef, useMemo } from 'react';
import Landing from './src/Landing';

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
        a { color: #F0A500; }
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
      sandbox="allow-same-origin"
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

const StatCard = ({ label, val, trend, icon, className, index }) => {
  const numVal = parseInt(val.replace(/,/g, ''));
  const animatedVal = useCounter(numVal, 1500 + index * 200);
  const displayVal = val.includes('.') ? animatedVal.toFixed(1) : animatedVal.toLocaleString();

  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <span className={`stat-trend ${index === 0 ? 'trend-up' : 'trend-neutral'}`}>{trend}</span>
      </div>
      <div className="stat-value">{displayVal}{val.includes('hrs') ? ' hrs' : ''}</div>
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
  if (!name) return '#7B7BF5';
  const colors = ['#F0A500', '#1AAB8A', '#7B7BF5', '#FF6B6B', '#A06BFF', '#00D1FF'];
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

const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (error) => {
      console.error("Caught by ErrorBoundary:", error);
      setHasError(true);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
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
  return children;
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
  const [fullBodies, setFullBodies] = useState({});
  const [isFetchingBody, setIsFetchingBody] = useState(false);
  const [aiResults, setAiResults] = useState({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [dashboardStats, setDashboardStats] = useState({
    total_emails: 0,
    unread_emails: 0,
    estimated_urgent_emails: 0
  });
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [globalError, setGlobalError] = useState(null);

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
          email: payload.email,
          name: payload.name,
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

    let afterParam = "";
    if (mails && Array.isArray(mails) && mails.length > 0) {
      const maxDate = Math.max(...mails.map(m => m.internal_date || 0));
      if (maxDate > 0) {
        afterParam = `?after=${maxDate}`;
      }
    }

    if (!mails || (Array.isArray(mails) && mails.length === 0)) setIsLoading(true);
    setGlobalError(null);
    
    try {
      const startTime = Date.now();
      const response = await fetch(`${API_BASE}/emails${afterParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
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
      
      if (newMails.length > 0) {
        setMails(prevMails => {
          const prev = Array.isArray(prevMails) ? prevMails : [];
          const existingIds = new Set(prev.map(m => m.id));
          const filteredNew = newMails.filter(m => !existingIds.has(m.id));
          const combined = [...filteredNew, ...prev];
          combined.sort((a, b) => (b.internal_date || 0) - (a.internal_date || 0));
          localStorage.setItem(`mp_mails_${user.email}`, JSON.stringify(combined));
          if (!selectedMailId && combined.length > 0) {
            setSelectedMailId(combined[0].id);
          }
          analyzeBatch(combined.slice(0, 10));
          return combined;
        });
      }

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

  const handleLogout = () => {
    localStorage.removeItem('mp_token');
    setUser(null);
    setMails([]);
    window.location.reload();
  };

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
          const ai = aiResults[m.id];
          return ai && (ai.priority === 'urgent' || ai.requires_reply);
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
      if (!response.ok) throw new Error("AI analysis failed");
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
    if (!Array.isArray(batch)) return;
    const token = localStorage.getItem('mp_token');
    if (!token || batch.length === 0) return;
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
      if (!response.ok) throw new Error("Batch analysis failed");
      const data = await response.json();
      if (data && data.results) {
        setAiResults(prev => ({ ...prev, ...data.results }));
      }
    } catch (error) {
      console.error("Failed to analyze batch:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchFullEmail = async (id) => {
    if (!id) return;
    const token = localStorage.getItem('mp_token');
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
      if (data) setDashboardStats(data);
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
      // Keep existing or default stats on failure
    } finally {
      setIsFetchingStats(false);
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
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #0D1117;
            --surface: #161B22;
            --border: #21262D;
            --border-muted: #30363D;
            --amber: #F0A500;
            --teal: #1AAB8A;
            --red: #FF6B6B;
            --text-primary: #E6EDF3;
            --text-secondary: #8B949E;
            --font-main: 'DM Sans', sans-serif;
            --font-serif: 'Instrument Serif', serif;
          }

          body { 
            background-color: var(--bg); 
            color: var(--text-primary); 
            font-family: var(--font-main);
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
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
            background: var(--bg);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 24px 16px;
            flex-shrink: 0;
            overflow-y: auto;
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
          .sidebar-logo { height: 24px; width: auto; }
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

          .nav-label { font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 2px; margin: 16px 0 8px 8px; font-weight: 700; }
          .nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 13px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.15s;
            margin-bottom: 4px;
          }
          .nav-item:hover { background: var(--surface); color: var(--text-primary); }
          .nav-item.active {
            background: var(--surface);
            border-left: 3px solid var(--amber);
            color: var(--amber);
            font-weight: 500;
          }
          .nav-icon { font-size: 16px; width: 20px; text-align: center; }

          /* Dashboard Styles */
          .dashboard-container {
            flex: 1;
            background: var(--bg);
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
          .stat-card.blue::after { background: #7B7BF5; box-shadow: 0 0 10px #7B7BF5; }

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
          .profile-img-wrap { position: relative; width: 48px; height: 48px; }
          .profile-img { width: 100%; height: 100%; border-radius: 50%; border: 2px solid var(--border); }
          .online-dot {
            position: absolute; bottom: 2px; right: 2px;
            width: 10px; height: 10px; background: var(--teal);
            border: 2px solid var(--surface); border-radius: 50%;
          }
          .profile-name { font-size: 15px; font-weight: 600; display: block; }
          .profile-email { font-size: 11px; color: var(--text-secondary); display: block; overflow: hidden; text-overflow: ellipsis; }
          
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
            background: var(--bg);
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
          .badge-important { background: rgba(123, 123, 245, 0.15); color: #7B7BF5; }
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

          .skeleton-row { padding: 16px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
          .skel-line { height: 10px; background: var(--border-muted); border-radius: 4px; animation: pulse-skel 1.5s infinite; }
          @keyframes pulse-skel { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.8; } }

          .global-error-panel {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            z-index: 1000;
          }

          .slide-in { animation: slideIn 0.3s ease-out; }
          @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
          }
        `}</style>

        {isTransitioning && (
          <div className="transition-overlay">
            <img src="/logo.png" alt="MailPulse" className="load-logo" />
            <div className="load-text">Setting up your inbox...</div>
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
        <aside className="sidebar">
          <div className="premium-profile">
            <div className="profile-top">
              <div className="profile-img-wrap">
                <img src={user.picture} alt={user.name} className="profile-img" />
                <div className="online-dot"></div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
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
            </div>
          </div>

          <div className="sidebar-logo-wrap">
            <img src="/logo.png" alt="MailPulse" className="sidebar-logo" />
          </div>
          
          <div className="divider"></div>

          <div className="nav-label">Main</div>
          <div className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('Dashboard')}>
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </div>
          
          <div className="nav-label">Navigation</div>
          <div className={`nav-item ${activeTab === 'Priority Feed' ? 'active' : ''}`} onClick={() => setActiveTab('Priority Feed')}>
            <span className="nav-icon">🔥</span>
            <span>Priority Feed</span>
          </div>
          <div className={`nav-item ${activeTab === 'All Mail' ? 'active' : ''}`} onClick={() => setActiveTab('All Mail')}>
            <span className="nav-icon">📥</span>
            <span>All Mail</span>
          </div>
          <div className={`nav-item ${activeTab === 'Awaiting Reply' ? 'active' : ''}`} onClick={() => setActiveTab('Awaiting Reply')}>
            <span className="nav-icon">💬</span>
            <span>Awaiting Reply</span>
          </div>

          <div style={{ marginTop: 'auto', padding: '12px 8px' }}>
            <span className="sign-out" style={{ fontSize: '12px' }} onClick={handleLogout}>Sign out</span>
          </div>
        </aside>

        {/* Main Content Area */}
        {activeTab === 'Dashboard' ? (
          <div className="dashboard-container">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Executive Summary</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  {isFetchingStats ? "AI is analyzing your Gmail history..." : `Your AI assistant has analyzed ${dashboardStats?.total_emails?.toLocaleString() || '0'} emails across your account.`}
                </p>
              </div>
              <div className="badge-strip">
                <div className="badge-chip amber">🔥 {dashboardStats?.account_age_estimate || "0.0 years"} history</div>
                <div className="badge-chip">⚡ {dashboardStats?.unread_emails || 0} unread</div>
                <div className="badge-chip amber">🎯 Response Rate: {dashboardStats?.estimated_response_rate || 0}%</div>
              </div>
            </header>

            <div className="analytics-grid">
              {[
                { label: 'Emails Summarized', val: dashboardStats?.total_emails?.toLocaleString() || '0', trend: `${dashboardStats?.emails_this_week || 0} this week`, icon: '✨', class: 'amber' },
                { label: 'Voice Briefings Ready', val: ((dashboardStats?.emails_today || 0) + (dashboardStats?.unread_emails || 0)).toLocaleString(), trend: 'Daily Digest', icon: '🎙️', class: 'teal' },
                { label: 'Urgent Emails Caught', val: dashboardStats?.estimated_urgent_emails?.toLocaleString() || '0', trend: 'Priority detection', icon: '⚠️', class: 'red' },
                { label: 'Hours Saved', val: (((dashboardStats?.total_emails || 0) * 18) / 3600).toFixed(1), trend: 'Efficiency gain', icon: '⏳', class: 'blue' }
              ].map((s, i) => (
                <StatCard key={i} {...s} index={i} className={s.class} />
              ))}
            </div>

            <div className="dashboard-row">
              <div className="panel">
                <h2 className="panel-title"><span>🕒</span> AI Activity Feed</h2>
                <div className="activity-list">
                  {isFetchingStats ? (
                    [...Array(5)].map((_, i) => (
                      <div key={i} className="skeleton-row" style={{ padding: '12px', marginBottom: '8px' }}>
                        <div className="skel-line" style={{ width: '80%' }}></div>
                      </div>
                    ))
                  ) : (
                    (dashboardStats?.recent_activity_feed || []).map((a, i) => (
                      <div key={i} className="activity-item">
                        <div className="activity-icon">{a?.icon || '✉️'}</div>
                        <div className="activity-content">
                          <div className="activity-text">{a?.text || 'Email activity detected'}</div>
                          <div className="activity-time">{a?.time || 'Just now'}</div>
                        </div>
                      </div>
                    ))
                  )}
                  {!isFetchingStats && (!dashboardStats?.recent_activity_feed || dashboardStats.recent_activity_feed.length === 0) && (
                    <div className="empty-subtitle">No recent activity detected.</div>
                  )}
                </div>
              </div>

              <div className="panel">
                <h2 className="panel-title"><span>💡</span> AI Productivity Insights</h2>
                <div className="insight-row">
                  {dashboardStats?.unread_emails > 50 && <div className="insight-card">Your inbox is accumulating unread messages rapidly.</div>}
                  {((dashboardStats?.promotional_emails || 0) / (dashboardStats?.total_emails || 1)) > 0.4 && <div className="insight-card">Most incoming traffic is promotional noise.</div>}
                  {(dashboardStats?.morning_emails || 0) > (dashboardStats?.afternoon_emails || 0) && <div className="insight-card">You receive most communication during morning hours.</div>}
                  {(dashboardStats?.estimated_response_rate || 0) > 20 && <div className="insight-card">You maintain a healthy email response pattern.</div>}
                  {dashboardStats?.oldest_email_timestamp && (
                    <div className="insight-card">Deepest visible history: {new Date(dashboardStats.oldest_email_timestamp * 1000).toLocaleDateString()}.</div>
                  )}
                </div>

                <div className="progress-grid">
                  {[
                    { label: 'Efficiency', val: Math.min(100, Math.floor((dashboardStats?.total_emails || 0) / 100)) },
                    { label: 'Inbox Zero', val: Math.max(0, 100 - Math.floor(((dashboardStats?.unread_emails || 0) / (dashboardStats?.total_emails || 1)) * 100)) },
                    { label: 'Deadlines', val: 100 - (dashboardStats?.estimated_deadline_emails || 0) }
                  ].map((p, i) => (
                    <div key={i} className="progress-item">
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifySelf: 'center' }}>
                        <svg className="progress-svg">
                          <circle className="progress-bg" cx="25" cy="25" r="20" />
                          <circle className="progress-fill" cx="25" cy="25" r="20" 
                            style={{ strokeDasharray: 126, strokeDashoffset: 126 - (126 * Math.max(0, Math.min(100, p.val))) / 100 }} 
                          />
                        </svg>
                        <span className="progress-val" style={{ position: 'absolute', width: '100%', textAlign: 'center' }}>{Math.max(0, Math.min(100, p.val))}%</span>
                      </div>
                      <span className="progress-label">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="panel">
              <h2 className="panel-title"><span>📅</span> Weekly Communication Activity</h2>
              <div className="heatmap-container">
                <div className="heatmap-grid">
                  <div className="heatmap-day-labels">
                    {['Sun', '', 'Tue', '', 'Thu', '', 'Sat'].map((d, i) => (
                      <div key={i} className="heatmap-day-label" style={{ height: '12px', marginBottom: '4px' }}>{d}</div>
                    ))}
                  </div>
                  {[...Array(24)].map((_, i) => {
                    const dayOffset = (23 - i) * 7;
                    return (
                      <div key={i} className="heatmap-col">
                        {[...Array(7)].map((_, j) => {
                          const date = new Date();
                          date.setDate(date.getDate() - (dayOffset + (6 - j)));
                          const dateStr = date.toISOString().split('T')[0];
                          const entry = dashboardStats?.activity_heatmap?.find(h => h.date === dateStr);
                          const level = entry ? Math.min(Math.floor(entry.count / 3) + 1, 4) : 0;
                          return <div key={j} className="heatmap-cell" data-level={level} title={`${dateStr}: ${entry?.count || 0} emails`}></div>
                        })}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Less</span>
                  {[0,1,2,3,4].map(l => <div key={l} className="heatmap-cell" data-level={l}></div>)/* Heatmap cells */}
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>More</span>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2 className="panel-title"><span>🎙️</span> Recent Voice Briefings</h2>
              <div className="history-table">
                {dashboardStats?.top_senders ? (
                  dashboardStats.top_senders.map((s, i) => (
                    <div key={i} className="history-row" style={{ gridTemplateColumns: '2fr 2.5fr 1fr' }}>
                      <span style={{ fontWeight: '600' }}>{s.name}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.email}</span>
                      <span style={{ textAlign: 'right', fontWeight: '700', color: 'var(--amber)' }}>{s.count} mails</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-subtitle" style={{ padding: '12px' }}>No briefing history available.</div>
                )}
              </div>
            </div>
          </div>
        ) : (
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
                      onClick={() => setSelectedMailId(mail.id)}
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
            <section className="detail-panel">
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
                      {analyzingIds.has(selectedMail.id) ? (
                        <div className="empty-state" style={{ height: '100px' }}>
                          <div className="spinner" style={{ width: '20px', height: '20px', marginBottom: '8px' }}></div>
                          <div className="empty-subtitle">Analyzing context...</div>
                        </div>
                      ) : aiResults[selectedMail.id] ? (
                      <>
                        <p className="summary-text">{aiResults[selectedMail.id].summary}</p>
                        {aiResults[selectedMail.id].deadline && (
                          <div className="deadline-chip">
                            🕒 Deadline: {aiResults[selectedMail.id].deadline}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '12px' }}>
                        <p className="history-item" style={{ marginBottom: '12px' }}>No AI summary available yet.</p>
                        <button className="btn-sec" style={{ fontSize: '12px' }} onClick={() => analyzeEmail(selectedMail)}>
                          Analyze with Groq AI
                        </button>
                      </div>
                    )}
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
                    <div className="card-label">
                      <span>✉️</span> Email Content
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
                    {aiResults[selectedMail.id]?.draft_reply ? (
                      <>
                        <div className="draft-text">{aiResults[selectedMail.id].draft_reply}</div>
                        <div className="btn-row">
                          <button className="btn-send">Send reply</button>
                          <button className="btn-sec" onClick={() => analyzeEmail(selectedMail)}>Regenerate</button>
                          <button className="btn-sec" onClick={() => navigator.clipboard.writeText(aiResults[selectedMail.id].draft_reply)}>Copy</button>
                        </div>
                      </>
                    ) : (
                      <div className="draft-text draft-placeholder">
                        {analyzingIds.has(selectedMail.id) ? "Generating draft..." : "Select 'Analyze' to generate a smart reply draft."}
                      </div>
                    )}
                  </div>
                </div>

                {/* Voice Briefing Bar */}
                <div className="voice-bar">
                  <div className="play-circle" onClick={() => setIsPlayingBriefing(!isPlayingBriefing)}>
                    {isPlayingBriefing ? <span>||</span> : <span>▶</span>}
                  </div>
                  <div className="briefing-meta">
                    <span className="briefing-title">Morning briefing ready</span>
                    <span className="briefing-sub">47s · Tap to play</span>
                  </div>
                  <div className="waveform">
                    {[...Array(24)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`wave-bar ${isPlayingBriefing ? 'active' : ''}`} 
                        style={{ 
                          height: isPlayingBriefing ? '' : `${[8,14,10,18,12,20,10,16,8,22,12,18,8,20,14,24,10,18,8,12,6,16,10,14][i]}px`,
                          animationDelay: `${i * 0.05}s` 
                        }}
                      ></div>
                    ))}
                  </div>
                  <button className="whatsapp-btn">
                    <span>✉</span> Send to WhatsApp
                  </button>
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
    </div>
  </ErrorBoundary>
  );
};

export default App;
