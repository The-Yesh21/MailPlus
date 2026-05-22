import React, { useState, useRef, useEffect } from 'react';

const DIGEST_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');

  .digest-wrap { flex:1; display:flex; overflow:hidden; height:100%; }
  .digest-scroll { flex:1; overflow-y:auto; padding:32px 40px 64px; min-width:0; }
  .digest-scroll::-webkit-scrollbar { width:5px; }
  .digest-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }

  /* Masthead */
  .digest-masthead { text-align:center; padding-bottom:24px; margin-bottom:32px; border-bottom:1px solid var(--border); }
  .digest-masthead-bar { height:3px; background:linear-gradient(90deg,transparent,#FF9F0A 20%,#fff 50%,#32ADE6 80%,transparent); opacity:0.4; margin-top:8px; }
  .digest-edition { font-size:10px; letter-spacing:5px; text-transform:uppercase; color:var(--text-secondary); margin-bottom:10px; }
  .digest-title { font-family:'Playfair Display',Georgia,serif; font-size:52px; font-weight:900; line-height:1; background:linear-gradient(135deg,#FF9F0A 0%,#fff 45%,#32ADE6 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:-2px; }
  .digest-tagline { font-size:11px; letter-spacing:6px; text-transform:uppercase; color:var(--text-secondary); margin-top:8px; border-top:1px solid var(--border-muted); border-bottom:1px solid var(--border-muted); padding:6px 0; display:inline-block; width:100%; }
  .digest-meta-row { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:10px; font-size:11px; color:var(--text-secondary); }
  .digest-meta-dot { opacity:0.3; }

  /* Stats chips */
  .digest-stats { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:36px; position:relative; }
  .digest-chip { display:flex; align-items:center; gap:6px; padding:6px 16px; border-radius:24px; font-size:12px; font-weight:700; border:1px solid; cursor:pointer; transition:transform 0.15s, box-shadow 0.15s; position:relative; user-select:none; }
  .digest-chip:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.2); }
  .digest-chip.active { transform:translateY(-2px); }
  .digest-chip-num { font-size:15px; font-weight:900; }
  .digest-chip-arrow { font-size:9px; margin-left:2px; opacity:0.7; transition:transform 0.2s; display:inline-block; }
  .digest-chip.active .digest-chip-arrow { transform:rotate(180deg); }

  /* Chip Popover */
  .chip-popover { position:absolute; top:calc(100% + 10px); left:0; z-index:200; background:rgba(22,27,34,0.85); backdrop-filter:blur(32px); -webkit-backdrop-filter:blur(32px); border:1px solid var(--border); border-radius:14px; min-width:340px; max-width:440px; box-shadow:0 16px 48px rgba(0,0,0,0.4); overflow:hidden; animation:popIn 0.18s cubic-bezier(0.34,1.56,0.64,1); }
  @keyframes popIn { from { opacity:0; transform:translateY(-8px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
  .chip-popover-header { padding:12px 16px 10px; border-bottom:1px solid var(--border-muted); display:flex; align-items:center; justify-content:space-between; }
  .chip-popover-title { font-size:10px; font-weight:900; letter-spacing:3px; text-transform:uppercase; }
  .chip-popover-count { font-size:11px; color:var(--text-secondary); }
  .chip-popover-list { max-height:320px; overflow-y:auto; }
  .chip-popover-list::-webkit-scrollbar { width:3px; }
  .chip-popover-list::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
  .chip-popover-item { display:flex; align-items:center; gap:12px; padding:10px 16px; border-bottom:1px solid var(--border-muted); cursor:pointer; transition:background 0.12s; }
  .chip-popover-item:last-child { border-bottom:none; }
  .chip-popover-item:hover { background:var(--bg); }
  .chip-popover-avatar { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:#fff; }
  .chip-popover-info { flex:1; min-width:0; }
  .chip-popover-sender { font-size:12px; font-weight:700; color:var(--text-primary); }
  .chip-popover-email { font-size:10px; color:var(--text-secondary); margin-top:1px; }
  .chip-popover-subj { font-size:11px; color:var(--text-secondary); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .chip-popover-time { font-size:10px; color:var(--text-secondary); flex-shrink:0; opacity:0.6; }
  .chip-popover-empty { padding:20px; text-align:center; color:var(--text-secondary); font-size:12px; }

  /* Section */
  .digest-section { margin-bottom:48px; }
  .digest-sec-head { display:flex; align-items:center; gap:12px; margin-bottom:20px; }
  .digest-sec-rule { flex:1; height:1px; background:var(--border-muted); }
  .digest-sec-label { font-size:9px; font-weight:900; letter-spacing:4px; text-transform:uppercase; white-space:nowrap; padding:4px 12px; border-radius:20px; border:1px solid; }
  .digest-sec-divider { height:3px; background:linear-gradient(90deg,transparent,currentColor 30%,transparent); opacity:0.15; margin-bottom:20px; border-radius:2px; }

  /* Hero card */
  .digest-hero { background:linear-gradient(135deg,rgba(255,42,85,0.08) 0%,var(--surface) 100%); border:1px solid rgba(255,42,85,0.3); border-left:5px solid #FF2A55; border-radius:16px; padding:28px; margin-bottom:16px; cursor:pointer; transition:all 0.25s; position:relative; overflow:hidden; }
  .digest-hero::before { content:'BREAKING'; position:absolute; top:16px; right:16px; font-size:9px; font-weight:900; letter-spacing:3px; color:#FF2A55; border:1px solid rgba(255,42,85,0.4); padding:2px 8px; border-radius:4px; background:rgba(255,42,85,0.1); }
  .digest-hero:hover { transform:translateY(-3px); box-shadow:0 16px 48px rgba(255,42,85,0.2); }
  .digest-hero.sel { box-shadow:0 0 0 2px #FF2A55, 0 16px 48px rgba(255,42,85,0.2); }
  .digest-hero-kicker { font-size:10px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:#FF2A55; margin-bottom:6px; }
  .digest-hero-hl { font-family:'Playfair Display',Georgia,serif; font-size:24px; font-weight:700; line-height:1.3; color:var(--text-primary); margin-bottom:10px; }
  .digest-hero-summary { font-size:13px; color:var(--text-secondary); line-height:1.7; margin-bottom:14px; }
  .digest-hero-foot { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }

  /* Urgent grid */
  .digest-urgent-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
  .digest-ucard { background:var(--surface); border:1px solid rgba(255,42,85,0.2); border-top:3px solid #FF2A55; border-radius:12px; padding:16px; cursor:pointer; transition:all 0.2s; }
  .digest-ucard:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(255,42,85,0.12); }
  .digest-ucard.sel { border-color:#FF2A55; box-shadow:0 0 0 2px rgba(255,42,85,0.3); }

  /* Action grid */
  .digest-action-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
  .digest-acard { background:var(--surface); border:1px solid rgba(255,159,10,0.2); border-top:3px solid #FF9F0A; border-radius:12px; padding:16px; cursor:pointer; transition:all 0.2s; }
  .digest-acard:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(255,159,10,0.1); }
  .digest-acard.sel { border-color:#FF9F0A; box-shadow:0 0 0 2px rgba(255,159,10,0.3); }

  /* Card typography */
  .d-kicker { font-size:9px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:var(--text-secondary); margin-bottom:4px; }
  .d-hl { font-family:'Playfair Display',Georgia,serif; font-size:14px; font-weight:700; line-height:1.35; margin-bottom:6px; }
  .d-body { font-size:12px; color:var(--text-secondary); line-height:1.55; margin-bottom:8px; }
  .d-foot { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11px; color:var(--text-secondary); }

  /* Briefing card grid — replaces timeline */
  .digest-brief-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
  .digest-bcard { display:flex; align-items:flex-start; gap:12px; background:var(--surface); border:1px solid var(--border-muted); border-radius:12px; padding:14px 16px; cursor:pointer; transition:all 0.2s; }
  .digest-bcard:hover { border-color:var(--border); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.15); }
  .digest-bcard.sel { border-color:#5E5CE6; box-shadow:0 0 0 2px rgba(94,92,230,0.25); }
  .digest-bcard-avatar { width:36px; height:36px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#fff; }
  .digest-bcard-body { flex:1; min-width:0; }
  .digest-bcard-sender { font-size:11px; font-weight:700; color:var(--text-secondary); margin-bottom:2px; }
  .digest-bcard-subject { font-size:13px; font-weight:600; color:var(--text-primary); line-height:1.3; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .digest-bcard-summary { font-size:11px; color:var(--text-secondary); line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

  /* FYI pill strip */
  .digest-fyi-strip { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .digest-fyi-pill { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; background:var(--surface); border:1px solid var(--border-muted); cursor:pointer; transition:all 0.15s; font-size:12px; max-width:180px; }
  .digest-fyi-pill:hover { border-color:#32ADE6; background:rgba(50,173,230,0.08); transform:translateY(-1px); }
  .digest-fyi-pill.sel { border-color:#32ADE6; background:rgba(50,173,230,0.12); }
  .digest-fyi-pill-avatar { width:18px; height:18px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:800; color:#fff; }
  .digest-fyi-pill-name { font-weight:600; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .digest-fyi-more { font-size:12px; color:var(--text-secondary); padding:5px 10px; border-radius:20px; border:1px dashed var(--border); cursor:pointer; transition:all 0.15s; white-space:nowrap; }
  .digest-fyi-more:hover { border-color:var(--border); color:var(--text-primary); }

  /* Empty state */
  .digest-empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; text-align:center; background:var(--surface); border:1px dashed var(--border); border-radius:16px; }
  .digest-empty-icon { font-size:36px; margin-bottom:12px; opacity:0.6; }
  .digest-empty-title { font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:6px; }
  .digest-empty-sub { font-size:12px; color:var(--text-secondary); line-height:1.6; }
  .digest-empty { text-align:center; padding:24px; color:var(--text-secondary); font-size:13px; opacity:0.7; }

  /* Detail panel */
  .digest-panel { width:380px; flex-shrink:0; height:100%; overflow-y:auto; border-left:1px solid var(--border); background:rgba(13,17,23,0.6); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); }
  .digest-panel::-webkit-scrollbar { width:4px; }
  .digest-panel::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
  .digest-panel-accent { height:3px; background:linear-gradient(90deg,#FF2A55,#FF9F0A,#5E5CE6,#32ADE6); }
  .digest-panel-inner { padding:24px; }
  .digest-panel-close { display:flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--border-muted); color:var(--text-secondary); border-radius:8px; padding:7px 14px; font-size:12px; cursor:pointer; transition:all 0.15s; margin-bottom:20px; }
  .digest-panel-close:hover { background:var(--border-muted); color:var(--text-primary); }
  .digest-panel-hl { font-family:'Playfair Display',Georgia,serif; font-size:17px; font-weight:700; line-height:1.35; margin-bottom:6px; }
  .digest-infobox { background:var(--bg); border-radius:10px; padding:14px; margin-bottom:14px; }
  .digest-infobox-label { font-size:9px; font-weight:800; letter-spacing:2px; margin-bottom:8px; }
  .digest-analyze-btn { width:100%; padding:11px; border-radius:10px; background:linear-gradient(135deg,#FF9F0A,#e08800); color:#000; border:none; font-weight:800; font-size:13px; cursor:pointer; margin-bottom:14px; transition:transform 0.15s,box-shadow 0.15s; }
  .digest-analyze-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(255,159,10,0.3); }
  .digest-analyze-btn:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
  .digest-priority-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
  .digest-badge { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; border:1px solid; }

  @media (max-width: 768px) {
    .digest-scroll { padding:16px 16px 48px; }
    .digest-title { font-size:38px; }
    .digest-masthead { padding-bottom:12px; margin-bottom:16px; }
    .digest-brief-grid { grid-template-columns:1fr; }
    .digest-panel { position:absolute; top:0; left:0; width:100%; height:100%; z-index:200; transform:translateY(100%); transition:transform 0.3s cubic-bezier(0.16,1,0.3,1); border-left:none; background:rgba(5,5,5,0.98); }
    .digest-panel.active { transform:translateY(0); }
    .chip-popover { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) scale(0.97); width:90vw; max-width:400px; }
    .chip-popover.open { transform:translate(-50%,-50%) scale(1); }
  }
`;

const getSenderColor = (name) => {
  if (!name) return '#5E5CE6';
  const colors = ['#FF9F0A','#32ADE6','#5E5CE6','#FF6B6B','#A06BFF','#00D1FF'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const initials = (name) => (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

const DigestView = ({ mails, aiResults, analyzingIds, analyzeEmail, DeadlineCountdown }) => {
  const [sel, setSel] = useState(null);
  const [activeChip, setActiveChip] = useState(null);
  const [fyiExpanded, setFyiExpanded] = useState(false);
  const popoverRef = useRef(null);

  const urgent   = mails.filter(m => aiResults[m.id]?.priority === 'urgent');
  const action   = mails.filter(m => aiResults[m.id]?.requires_reply && aiResults[m.id]?.priority !== 'urgent');
  const briefing = mails.filter(m => aiResults[m.id]?.priority === 'normal' && !aiResults[m.id]?.requires_reply);
  const fyi      = mails.filter(m => !aiResults[m.id] || aiResults[m.id]?.priority === 'low');
  const [hero, ...restUrgent] = urgent;

  const chipGroups = {
    urgent:   { list: urgent,   label: 'Urgent Emails',     color: '#FF2A55' },
    action:   { list: action,   label: 'Need Reply',        color: '#FF9F0A' },
    briefing: { list: briefing, label: "Today's Briefings", color: '#5E5CE6' },
    fyi:      { list: fyi,      label: 'FYI Emails',        color: '#32ADE6' },
  };

  const today  = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const selMail = sel ? mails.find(m => m.id === sel) : null;
  const selAi   = selMail ? aiResults[selMail.id] : null;
  const open    = id => { setSel(p => p === id ? null : id); setActiveChip(null); };
  const pc      = p => p==='urgent'?'#FF2A55':p==='low'?'#32ADE6':'#5E5CE6';

  useEffect(() => {
    if (!activeChip) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setActiveChip(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeChip]);

  const Sec = ({ label, color, children }) => (
    <div className="digest-section">
      <div className="digest-sec-head">
        <div className="digest-sec-rule" />
        <span className="digest-sec-label" style={{ color, borderColor:`${color}40`, background:`${color}12` }}>{label}</span>
        <div className="digest-sec-rule" />
      </div>
      {children}
    </div>
  );

  const ChipPopover = ({ group }) => {
    const { list, label, color } = chipGroups[group];
    return (
      <div className="chip-popover" ref={popoverRef}>
        <div className="chip-popover-header">
          <span className="chip-popover-title" style={{ color }}>{label}</span>
          <span className="chip-popover-count">{list.length} email{list.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="chip-popover-list">
          {list.length === 0
            ? <div className="chip-popover-empty">No emails in this category yet.</div>
            : list.map(m => (
              <div key={m.id} className="chip-popover-item" onClick={() => open(m.id)}>
                <div className="chip-popover-avatar" style={{ background: getSenderColor(m.from_name) }}>
                  {initials(m.from_name || m.from_email)}
                </div>
                <div className="chip-popover-info">
                  <div className="chip-popover-sender">{m.from_name || m.from_email?.split('@')[0]}</div>
                  <div className="chip-popover-email">{m.from_email}</div>
                  <div className="chip-popover-subj">{m.subject}</div>
                </div>
                <div className="chip-popover-time">{m.date?.match(/\d+:\d+/)?.[0] || ''}</div>
              </div>
            ))
          }
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{DIGEST_CSS}</style>
      <div className="digest-wrap">
        <div className="digest-scroll">

          {/* ── Masthead ── */}
          <div className="digest-masthead">
            <div className="digest-edition">Vol. 1 &nbsp;◆&nbsp; Daily Edition &nbsp;◆&nbsp; Powered by AI</div>
            <div className="digest-title">MailPulse Daily</div>
            <div className="digest-tagline">Your Personalized Intelligence Briefing</div>
            <div className="digest-meta-row">
              <span>{today}</span>
              <span className="digest-meta-dot">◆</span>
              <span>{mails.length} dispatches</span>
              <span className="digest-meta-dot">◆</span>
              <span>{mails.filter(m=>!m.is_read).length} unread</span>
            </div>
            <div className="digest-masthead-bar" />
          </div>

          {/* ── Stat chips ── */}
          <div className="digest-stats">
            {[
              { key:'urgent',   icon:'🚨', num:urgent.length,   label:'Urgent',     color:'#FF2A55' },
              { key:'action',   icon:'✍️', num:action.length,   label:'Need Reply', color:'#FF9F0A' },
              { key:'briefing', icon:'📋', num:briefing.length, label:'Briefings',  color:'#5E5CE6' },
              { key:'fyi',      icon:'💡', num:fyi.length,      label:'FYI',        color:'#32ADE6' },
            ].map(c => (
              <div key={c.key} style={{ position:'relative' }}>
                <span
                  className={`digest-chip${activeChip===c.key?' active':''}`}
                  style={{ borderColor:`${c.color}40`, color:c.color, background: activeChip===c.key ? `${c.color}22` : `${c.color}12` }}
                  onClick={() => setActiveChip(p => p === c.key ? null : c.key)}
                >
                  {c.icon} <span className="digest-chip-num">{c.num}</span> {c.label}
                  <span className="digest-chip-arrow">▾</span>
                </span>
                {activeChip === c.key && <ChipPopover group={c.key} />}
              </div>
            ))}
          </div>

          {/* ── Breaking News (hero urgent) ── */}
          {hero && (
            <Sec label="🚨 Breaking News" color="#FF2A55">
              <div className={`digest-hero${sel===hero.id?' sel':''}`} onClick={() => open(hero.id)}>
                <div className="digest-hero-kicker">{hero.from_name || hero.from_email}</div>
                <div className="digest-hero-hl">{hero.subject}</div>
                {aiResults[hero.id]?.summary && (
                  <div className="digest-hero-summary">{aiResults[hero.id].summary}</div>
                )}
                <div className="digest-hero-foot">
                  {aiResults[hero.id]?.deadline && (
                    <DeadlineCountdown deadline={aiResults[hero.id].deadline} emailDate={hero.internal_date} />
                  )}
                  {aiResults[hero.id]?.requires_reply && (
                    <span style={{color:'#FF9F0A',fontWeight:700,fontSize:'11px'}}>↩ Reply needed</span>
                  )}
                </div>
              </div>
              {restUrgent.length > 0 && (
                <div className="digest-urgent-grid">
                  {restUrgent.map(m => {
                    const ai = aiResults[m.id];
                    return (
                      <div key={m.id} className={`digest-ucard${sel===m.id?' sel':''}`} onClick={() => open(m.id)}>
                        <div className="d-kicker">{m.from_name || m.from_email}</div>
                        <div className="d-hl">{m.subject}</div>
                        {ai?.summary && <div className="d-body">{ai.summary.split('.')[0]}.</div>}
                        <div className="d-foot">
                          {ai?.deadline && <DeadlineCountdown deadline={ai.deadline} emailDate={m.internal_date} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Sec>
          )}

          {/* ── Action Required ── */}
          {action.length > 0 && (
            <Sec label="✍️ Action Required" color="#FF9F0A">
              <div className="digest-action-grid">
                {action.map(m => {
                  const ai = aiResults[m.id];
                  return (
                    <div key={m.id} className={`digest-acard${sel===m.id?' sel':''}`} onClick={() => open(m.id)}>
                      <div className="d-kicker">{m.from_name || m.from_email}</div>
                      <div className="d-hl">{m.subject}</div>
                      {ai?.summary && <div className="d-body">{ai.summary.split('.')[0]}.</div>}
                      {ai?.deadline && (
                        <div style={{marginTop:'6px'}}>
                          <DeadlineCountdown deadline={ai.deadline} emailDate={m.internal_date} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Sec>
          )}

          {/* ── Today's Briefing — card grid ── */}
          <Sec label="📋 Today's Briefing" color="#5E5CE6">
            {briefing.length === 0 ? (
              <div className="digest-empty-state">
                <div className="digest-empty-icon">📭</div>
                <div className="digest-empty-title">Nothing here yet</div>
                <div className="digest-empty-sub">
                  Analyzed emails with normal priority will appear here.<br />
                  Select an email and hit "Analyze with AI" to get started.
                </div>
              </div>
            ) : (
              <div className="digest-brief-grid">
                {briefing.map(m => {
                  const ai = aiResults[m.id];
                  const color = getSenderColor(m.from_name);
                  return (
                    <div
                      key={m.id}
                      className={`digest-bcard${sel===m.id?' sel':''}`}
                      onClick={() => open(m.id)}
                    >
                      <div className="digest-bcard-avatar" style={{ background: color }}>
                        {initials(m.from_name || m.from_email)}
                      </div>
                      <div className="digest-bcard-body">
                        <div className="digest-bcard-sender">{m.from_name || m.from_email?.split('@')[0]}</div>
                        <div className="digest-bcard-subject">{m.subject}</div>
                        {ai?.summary && (
                          <div className="digest-bcard-summary">{ai.summary}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Sec>

          {/* ── Also In Your Inbox — pill strip ── */}
          {fyi.length > 0 && (
            <Sec label="💡 Also In Your Inbox" color="#32ADE6">
              <div className="digest-fyi-strip">
                {(fyiExpanded ? fyi : fyi.slice(0, 8)).map(m => (
                  <span
                    key={m.id}
                    className={`digest-fyi-pill${sel===m.id?' sel':''}`}
                    onClick={() => open(m.id)}
                    title={m.subject}
                  >
                    <span className="digest-fyi-pill-avatar" style={{ background: getSenderColor(m.from_name) }}>
                      {initials(m.from_name || m.from_email)}
                    </span>
                    <span className="digest-fyi-pill-name">
                      {(m.from_name || m.from_email || '').split(' ')[0]}
                    </span>
                  </span>
                ))}
                {fyi.length > 8 && (
                  <span
                    className="digest-fyi-more"
                    onClick={() => setFyiExpanded(p => !p)}
                  >
                    {fyiExpanded ? '▲ less' : `+${fyi.length - 8} more`}
                  </span>
                )}
              </div>
            </Sec>
          )}

        </div>

        {/* ── Detail panel ── */}
        {selMail && (
          <div className={`digest-panel${selMail ? ' active' : ''}`}>
            <div className="digest-panel-accent" />
            <div className="digest-panel-inner">
              <button className="digest-panel-close" onClick={() => setSel(null)}>✕ Close</button>

              {/* Sender row */}
              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px'}}>
                <div style={{width:44,height:44,borderRadius:'50%',background:getSenderColor(selMail.from_name),display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:'14px',flexShrink:0}}>
                  {initials(selMail.from_name || selMail.from_email)}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'13px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selMail.from_name||selMail.from_email}</div>
                  <div style={{fontSize:'11px',color:'var(--text-secondary)',marginTop:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selMail.from_email}</div>
                </div>
              </div>

              <div className="digest-panel-hl">{selMail.subject}</div>
              <div style={{fontSize:'11px',color:'var(--text-secondary)',marginBottom:'18px'}}>{selMail.date}</div>

              {/* AI summary or analyze button */}
              {selAi?.summary ? (
                <div className="digest-infobox">
                  <div className="digest-infobox-label" style={{color:'#FF9F0A'}}>✨ AI SUMMARY</div>
                  <p style={{fontSize:'13px',lineHeight:1.65,margin:0}}>{selAi.summary}</p>
                  {selAi.deadline && /\d+\s*(hour|day|minute|week|hr)/i.test(selAi.summary) && (
                    <p style={{fontSize:'11px',color:'var(--text-secondary)',opacity:0.6,margin:'4px 0 6px',fontStyle:'italic'}}>
                      ↑ Time above is from the original email — live countdown below
                    </p>
                  )}
                  {selAi.deadline && (
                    <div style={{marginTop:'8px'}}>
                      <DeadlineCountdown deadline={selAi.deadline} emailDate={selMail.internal_date} />
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="digest-analyze-btn"
                  onClick={() => analyzeEmail(selMail)}
                  disabled={analyzingIds.has(selMail.id)}
                >
                  {analyzingIds.has(selMail.id) ? '⏳ Analyzing...' : '✨ Analyze with AI'}
                </button>
              )}

              {/* Snippet */}
              <div style={{fontSize:'12px',color:'var(--text-secondary)',lineHeight:1.7,marginBottom:'16px',borderLeft:'2px solid var(--border)',paddingLeft:'10px'}}>
                {selMail.snippet}
              </div>

              {/* Draft reply */}
              {selAi?.draft_reply && (
                <div className="digest-infobox">
                  <div className="digest-infobox-label" style={{color:'#32ADE6'}}>✍️ DRAFT REPLY</div>
                  <p style={{fontSize:'12px',lineHeight:1.65,margin:'0 0 10px',color:'var(--text-secondary)'}}>{selAi.draft_reply}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(selAi.draft_reply)}
                    style={{padding:'5px 14px',borderRadius:'8px',background:'transparent',border:'1px solid var(--border)',color:'var(--text-secondary)',fontSize:'12px',cursor:'pointer'}}
                  >
                    Copy
                  </button>
                </div>
              )}

              {/* Priority badges */}
              {selAi?.priority && (
                <div className="digest-priority-row">
                  <span className="digest-badge" style={{color:pc(selAi.priority),borderColor:`${pc(selAi.priority)}50`,background:`${pc(selAi.priority)}12`}}>
                    {selAi.priority.toUpperCase()}
                  </span>
                  {selAi.requires_reply && (
                    <span className="digest-badge" style={{color:'#FF9F0A',borderColor:'#FF9F0A50',background:'#FF9F0A12'}}>REPLY NEEDED</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DigestView;
