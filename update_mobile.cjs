const fs = require('fs');

function updateApp() {
  const file = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\App.jsx';
  let content = fs.readFileSync(file, 'utf8');

  // 1. State
  if (!content.includes('const [mobileSidebarOpen')) {
    content = content.replace(
      'const [isTransitioning, setIsTransitioning] = useState(false);',
      'const [isTransitioning, setIsTransitioning] = useState(false);\n  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);'
    );
  }

  // 2. CSS
  if (!content.includes('/* Mobile Responsiveness */')) {
    const css = `
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
`;
    content = content.replace('          body { ', css + '          body { ');
  }

  // 3. Header & Overlay
  if (!content.includes('className="mobile-header"')) {
    const header = `      <div className="app-container">
        {/* Mobile Header */}
        <div className="mobile-header">
          <div className="mobile-header-title">MailPulse</div>
          <button className="hamburger" onClick={() => setMobileSidebarOpen(true)}>☰</button>
        </div>
        <div className={\`mobile-overlay \${mobileSidebarOpen ? 'show' : ''}\`} onClick={() => setMobileSidebarOpen(false)}></div>\n`;
    content = content.replace('      <div className="app-container">\n', header);
  }

  // 4. Sidebar dynamic class
  content = content.replace('<aside className="sidebar">', '<aside className={`sidebar ${mobileSidebarOpen ? "open" : ""}`}>');

  // 5. Hide sidebar on nav clicks
  const tabs = ['Dashboard', 'Priority Feed', 'Daily Digest', 'All Mail', 'Awaiting Reply'];
  tabs.forEach(tab => {
    content = content.replace(
      `onClick={() => setActiveTab('${tab}')}`, 
      `onClick={() => { setActiveTab('${tab}'); setMobileSidebarOpen(false); }}`
    );
  });

  // 6. Detail panel active class
  content = content.replace('<section className="detail-panel">', '<section className={`detail-panel ${selectedMailId ? "active" : ""}`}>');

  // 7. Back button
  if (!content.includes('className="mobile-back-btn"')) {
    const backBtn = `<section className={\`detail-panel \${selectedMailId ? "active" : ""}\`}>
              <button className="mobile-back-btn" onClick={() => setSelectedMailId(null)}>← Back to Inbox</button>`;
    content = content.replace('<section className={`detail-panel ${selectedMailId ? "active" : ""}`}>', backBtn);
  }

  fs.writeFileSync(file, content);
  console.log('App.jsx updated.');
}

function updateDigestView() {
  const file = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\src\\DigestView.jsx';
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('@media (max-width: 768px)')) {
    const mobileCss = `
  @media (max-width: 768px) {
    .digest-scroll { padding: 16px 16px 32px; }
    .digest-title { font-size: 38px; }
    .digest-masthead { padding-bottom: 12px; margin-bottom: 16px; }
    .digest-two-col { grid-template-columns: 1fr; gap: 16px; }
    
    .digest-panel {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 200;
      transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      border-left: none; background: rgba(5,5,5,0.98); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    }
    .digest-panel.active { transform: translateY(0); }
    
    .chip-popover {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.97); width: 90vw; max-width: 400px;
    }
    .chip-popover.open { transform: translate(-50%, -50%) scale(1); }
  }
`;
    // Insert right before </style> in the string literal, or just append to DIGEST_CSS string.
    content = content.replace('  .digest-empty { text-align:center; padding:24px; color:var(--text-secondary); font-size:13px; opacity:0.7; }', '  .digest-empty { text-align:center; padding:24px; color:var(--text-secondary); font-size:13px; opacity:0.7; }' + mobileCss);
  }

  // Update panel to have active class on mobile
  content = content.replace('<div className="digest-panel">', '<div className={`digest-panel ${selMail ? "active" : ""}`}>');

  fs.writeFileSync(file, content);
  console.log('DigestView.jsx updated.');
}

updateApp();
updateDigestView();
