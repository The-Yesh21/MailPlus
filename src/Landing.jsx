import React, { useEffect, useRef, useState } from 'react';

const Landing = ({ onLogin }) => {
  const [isNavVisible, setIsNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      observer.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="landing-container">
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
          --text-primary: #E6EDF3;
          --text-secondary: #8B949E;
          --font-main: 'DM Sans', sans-serif;
          --font-serif: 'Instrument Serif', serif;
        }

        html { scroll-behavior: smooth; }
        body { 
          background-color: var(--bg); 
          color: var(--text-primary); 
          font-family: var(--font-main);
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        ::selection { background: var(--amber); color: var(--bg); }
        
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-muted); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #484F58; }

        .landing-container { width: 100%; }

        /* Navbar */
        nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          background: rgba(13, 17, 23, 0.8);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          z-index: 1000;
          transition: transform 0.3s ease;
        }
        nav.hidden { transform: translateY(-100%); }

        .nav-left { display: flex; align-items: center; }
        .nav-logo { height: 32px; width: auto; }
        
        .nav-right { display: flex; align-items: center; gap: 32px; }
        .nav-link { 
          color: var(--text-secondary); 
          text-decoration: none; 
          font-size: 14px; 
          font-weight: 500; 
          transition: color 0.2s; 
        }
        .nav-link:hover { color: var(--text-primary); }
        
        .nav-signin {
          border: 1.5px solid var(--amber);
          color: var(--amber);
          background: transparent;
          padding: 8px 24px;
          border-radius: 30px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-signin:hover { background: var(--amber); color: var(--bg); }

        /* Hero Section */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 120px 24px;
          position: relative;
          overflow: hidden;
          text-align: center;
        }

        .hero-logo {
          height: 72px;
          margin-bottom: 40px;
          animation: glowPulse 3s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(240,165,0,0.2)); }
          50% { filter: drop-shadow(0 0 25px rgba(240,165,0,0.5)); }
        }

        .hero h1 {
          font-family: var(--font-serif);
          font-size: 64px;
          line-height: 1.1;
          max-width: 700px;
          margin-bottom: 24px;
        }

        .gradient-text {
          background: linear-gradient(90deg, #F0A500, #1AAB8A, #F0A500);
          background-size: 200% auto;
          animation: gradientShift 3s linear infinite;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        @keyframes gradientShift {
          to { background-position: 200% center; }
        }

        .hero p {
          font-size: 18px;
          line-height: 1.7;
          color: var(--text-secondary);
          max-width: 520px;
          margin-bottom: 48px;
        }

        .cta-btn {
          background: var(--amber);
          color: var(--bg);
          padding: 16px 40px;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(240, 165, 0, 0.2);
        }
        .cta-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 0 30px rgba(240, 165, 0, 0.3);
        }

        .trust-badges {
          display: flex;
          gap: 16px;
          margin-top: 32px;
          font-size: 13px;
          color: var(--text-secondary);
          align-items: center;
        }
        .dot { color: var(--border-muted); }

        /* Floating Cards */
        .floating-card {
          position: absolute;
          background: var(--surface);
          border: 1px solid var(--border-muted);
          border-radius: 12px;
          padding: 16px;
          width: 280px;
          text-align: left;
          z-index: -1;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          animation: floatY 6s ease-in-out infinite;
        }
        .floating-card::after {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 12px;
          border: 1px solid rgba(240, 165, 0, 0.2);
          pointer-events: none;
        }

        .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .avatar-circle { width: 24px; height: 24px; border-radius: 50%; }
        .sender-name { font-size: 12px; font-weight: 700; }
        .card-time { font-size: 10px; color: var(--text-secondary); margin-left: auto; }
        .card-subject { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
        .card-snippet { font-size: 11px; color: var(--text-secondary); line-height: 1.4; }

        .fc-1 { left: 10%; top: 20%; transform: rotate(-8deg); animation-duration: 5s; }
        .fc-2 { right: 8%; top: 25%; transform: rotate(6deg); animation-duration: 7s; }
        .fc-3 { left: 15%; bottom: 15%; transform: rotate(-3deg); animation-duration: 8s; }

        @keyframes floatY {
          0%, 100% { transform: translateY(0) rotate(inherit); }
          50% { transform: translateY(-20px) rotate(inherit); }
        }

        /* Problem Section */
        .section-padding { padding: 120px 24px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 3px;
          color: var(--amber);
          margin-bottom: 16px;
          text-transform: uppercase;
        }
        .stat-number {
          font-family: var(--font-serif);
          font-size: 72px;
          color: var(--amber);
          line-height: 1;
          margin-bottom: 12px;
        }
        .stat-subtitle { font-size: 20px; color: var(--text-primary); margin-bottom: 64px; }

        .problem-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          max-width: 1100px;
          width: 100%;
        }
        .problem-card {
          background: var(--surface);
          border-left: 3px solid var(--amber);
          border-radius: 12px;
          padding: 28px;
          text-align: left;
          transition: all 0.2s;
        }
        .problem-card:hover { transform: translateY(-4px); border-color: #FFC033; }
        .icon-circle {
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(240, 165, 0, 0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; margin-bottom: 20px;
        }
        .problem-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
        .problem-card p { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }

        /* How It Works Section */
        .how-it-works {
          background-color: #0D1117;
          background-image: 
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 40px 40px;
          position: relative;
        }
        .how-it-works::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent, var(--bg));
          pointer-events: none;
        }
        
        .steps-container {
          display: flex;
          justify-content: space-between;
          width: 100%;
          max-width: 1000px;
          margin-top: 64px;
          position: relative;
        }
        .steps-container::after {
          content: '';
          position: absolute;
          top: 20px; left: 50px; right: 50px;
          height: 1px;
          border-top: 2px dashed var(--border-muted);
          z-index: 0;
        }

        .step {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 1;
          padding: 0 10px;
        }
        .step-num {
          width: 40px; height: 40px;
          background: var(--amber);
          color: var(--bg);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; margin-bottom: 20px;
        }
        .step h3 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
        .step p { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

        /* Features Section */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 2fr);
          gap: 20px;
          max-width: 1100px;
          width: 100%;
          margin-top: 40px;
        }
        .feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          text-align: left;
          transition: all 0.2s ease;
        }
        .feature-card:hover {
          border-color: var(--amber);
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(240, 165, 0, 0.1);
        }
        .feature-emoji { font-size: 32px; margin-bottom: 16px; display: block; }
        .feature-card h3 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
        .feature-card p { font-size: 13px; color: var(--text-secondary); line-height: 1.6; }

        /* Social Proof Bar */
        .social-proof {
          background: var(--surface);
          width: 100%;
          padding: 60px 24px;
          display: flex;
          justify-content: center;
          gap: 80px;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .proof-item { display: flex; flex-direction: column; align-items: center; }
        .proof-val { font-family: var(--font-serif); font-size: 36px; color: var(--amber); }
        .proof-label { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }

        /* Final CTA */
        .final-cta { padding: 120px 24px; text-align: center; }
        .final-cta .hero-logo { height: 48px; margin-bottom: 24px; }
        .final-cta h2 { font-family: var(--font-serif); font-size: 48px; margin-bottom: 32px; max-width: 600px; margin-left: auto; margin-right: auto; }
        .waitlist-text { font-size: 14px; color: var(--text-secondary); margin-top: 24px; }

        /* Footer */
        footer {
          padding: 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-secondary);
        }

        /* Animations */
        .animate-on-scroll {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .animate-on-scroll.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .stagger-1 { transition-delay: 0s; }
        .stagger-2 { transition-delay: 0.15s; }
        .stagger-3 { transition-delay: 0.3s; }
        .stagger-4 { transition-delay: 0.45s; }
        .stagger-5 { transition-delay: 0.6s; }
        .stagger-6 { transition-delay: 0.75s; }

        @media (max-width: 900px) {
          .problem-grid, .features-grid, .steps-container { grid-template-columns: 1fr; }
          .steps-container::after { display: none; }
          .hero h1 { font-size: 48px; }
          .social-proof { flex-direction: column; gap: 40px; }
          nav { padding: 0 20px; }
          .nav-right .nav-link { display: none; }
        }
        
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <nav className={isNavVisible ? '' : 'hidden'}>
        <div className="nav-left">
          <img src="/logo.png" alt="MailPulse" className="nav-logo" />
        </div>
        <div className="nav-right">
          <a href="#how-it-works" className="nav-link">How it works</a>
          <a href="#features" className="nav-link">Features</a>
          <button className="nav-signin" onClick={onLogin}>Sign in</button>
        </div>
      </nav>

      <section className="hero">
        <div className="floating-card fc-1">
          <div className="card-header">
            <div className="avatar-circle" style={{ background: '#F0A500' }}></div>
            <span className="sender-name">Sarah Chen</span>
            <span className="card-time">9:41 AM</span>
          </div>
          <div className="card-subject">Q2 Budget Approval</div>
          <div className="card-snippet">The revised projections for the engineering team...</div>
        </div>
        <div className="floating-card fc-2">
          <div className="card-header">
            <div className="avatar-circle" style={{ background: '#1AAB8A' }}></div>
            <span className="sender-name">Alex Rivet</span>
            <span className="card-time">10:15 AM</span>
          </div>
          <div className="card-subject">Contract signed! 🎉</div>
          <div className="card-snippet">Just received the executed agreement from...</div>
        </div>
        <div className="floating-card fc-3">
          <div className="card-header">
            <div className="avatar-circle" style={{ background: '#7B7BF5' }}></div>
            <span className="sender-name">Product Hunt</span>
            <span className="card-time">Yesterday</span>
          </div>
          <div className="card-subject">Daily Digest</div>
          <div className="card-snippet">Check out today's top launches in AI...</div>
        </div>

        <img src="/logo.png" alt="MailPulse" className="hero-logo" />
        <h1 className="animate-on-scroll stagger-1">
          Start your <span className="gradient-text">morning</span> informed, not overwhelmed.
        </h1>
        <p className="animate-on-scroll stagger-2">
          MailPulse scans your inbox, extracts what matters, and delivers a 60-second 
          audio briefing to your WhatsApp. No more inbox dread.
        </p>
        <div className="animate-on-scroll stagger-3">
          <button className="cta-btn" onClick={onLogin}>Get Started Free</button>
        </div>
        <div className="trust-badges animate-on-scroll stagger-4">
          <span>🔒 Read-only access</span>
          <span className="dot">·</span>
          <span>⚡ 60-second setup</span>
          <span className="dot">·</span>
          <span>🆓 Free to start</span>
        </div>
      </section>

      <section className="section-padding">
        <div className="label animate-on-scroll">THE PROBLEM</div>
        <div className="stat-number animate-on-scroll">2.5 hrs</div>
        <div className="stat-subtitle animate-on-scroll">spent checking email every day. Most of it wasted.</div>
        
        <div className="problem-grid">
          <div className="problem-card animate-on-scroll stagger-1">
            <div className="icon-circle">📬</div>
            <h3>Inbox Overload</h3>
            <p>50+ emails a day compete for your attention. The important ones get buried in noise.</p>
          </div>
          <div className="problem-card animate-on-scroll stagger-2">
            <div className="icon-circle">⏰</div>
            <h3>Missed Deadlines</h3>
            <p>Replies that needed to happen today get lost in newsletters and notifications.</p>
          </div>
          <div className="problem-card animate-on-scroll stagger-3">
            <div className="icon-circle">🧠</div>
            <h3>Mental Drain</h3>
            <p>Context switching to email kills deep work. You check it 74 times a day on average.</p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-padding how-it-works">
        <div className="label animate-on-scroll" style={{ color: 'var(--teal)' }}>HOW IT WORKS</div>
        <div className="steps-container">
          <div className="step animate-on-scroll stagger-1">
            <div className="step-num">1</div>
            <h3>Connect Gmail</h3>
            <p>One-click secure setup via Google. We only read, never send.</p>
          </div>
          <div className="step animate-on-scroll stagger-2">
            <div className="step-num">2</div>
            <h3>AI Scans Inbox</h3>
            <p>Every email ranked by urgency, deadline, and sender importance.</p>
          </div>
          <div className="step animate-on-scroll stagger-3">
            <div className="step-num">3</div>
            <h3>Get Briefing</h3>
            <p>A 60-second voice note lands in your WhatsApp at 7:30 AM.</p>
          </div>
          <div className="step animate-on-scroll stagger-4">
            <div className="step-num">4</div>
            <h3>Reply Fast</h3>
            <p>AI-drafted replies ready to send with one tap when needed.</p>
          </div>
        </div>
      </section>

      <section id="features" className="section-padding">
        <div className="label animate-on-scroll">WHAT YOU GET</div>
        <div className="features-grid">
          {[
            { e: '🎯', t: 'Priority Feed', d: 'Urgent emails surfaced automatically based on content and context.' },
            { e: '🎙️', t: 'Voice Briefings', d: 'Personalized WhatsApp audio note summarizing your day ahead.' },
            { e: '✍️', t: 'AI Draft Replies', d: 'Tone-matched replies ready to send, saving you hours of typing.' },
            { e: '📊', t: 'Thread Context', d: 'Full conversation history summarized in just two sentences.' },
            { e: '⚡', t: 'Deadline Detection', d: 'Never miss a time-sensitive email with automatic alerts.' },
            { e: '🔒', t: 'Privacy First', d: 'Read-only access. Your data is processed securely and stays yours.' }
          ].map((f, i) => (
            <div key={i} className={`feature-card animate-on-scroll stagger-${(i % 3) + 1}`}>
              <span className="feature-emoji">{f.e}</span>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="social-proof">
        <div className="proof-item">
          <span className="proof-val">50+</span>
          <span className="proof-label">Emails analyzed daily per user</span>
        </div>
        <div className="proof-item">
          <span className="proof-val">60s</span>
          <span className="proof-label">Morning briefing length</span>
        </div>
        <div className="proof-item">
          <span className="proof-val">3×</span>
          <span className="proof-label">Faster inbox processing</span>
        </div>
      </section>

      <section className="final-cta">
        <img src="/logo.png" alt="MailPulse" className="hero-logo" />
        <h2 className="animate-on-scroll">Start your day informed, not overwhelmed.</h2>
        <button className="cta-btn animate-on-scroll" onClick={onLogin}>Get Started Free</button>
        <p className="waitlist-text">Join the waitlist · Free during beta</p>
      </section>

      <footer>
        <div className="footer-left">
          <img src="/logo.png" alt="MailPulse" style={{ height: '24px' }} />
        </div>
        <div className="footer-center">© 2026 MailPulse</div>
        <div className="footer-right">Built with ❤️ in Bengaluru</div>
      </footer>
    </div>
  );
};

export default Landing;
