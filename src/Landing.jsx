import React, { useEffect, useRef } from 'react';

const Landing = ({ onLogin }) => {
  const observerRef = useRef(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.fade-in').forEach(el => {
      observerRef.current.observe(el);
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="landing-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Instrument+Serif:ital@0;1&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        :root {
          --bg: #0D1117;
          --surface: #161B22;
          --amber: #F0A500;
          --teal: #1AAB8A;
          --text-primary: #E6EDF3;
          --text-secondary: #8B949E;
        }

        body { 
          background-color: var(--bg); 
          color: var(--text-primary); 
          font-family: 'DM Sans', sans-serif;
          overflow-x: hidden;
        }

        .landing-container {
          max-width: 100vw;
        }

        /* Logo Animations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes glowPulse {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(240,165,0,0.3)); }
          50% { filter: drop-shadow(0 0 20px rgba(240,165,0,0.7)); }
        }

        .navbar-logo {
          height: 36px;
          width: auto;
          opacity: 0;
          animation: fadeIn 0.6s ease forwards;
          transition: transform 0.2s ease, filter 0.2s ease;
          will-change: transform;
        }
        .navbar-logo:hover {
          transform: scale(1.05);
          filter: drop-shadow(0 0 8px rgba(240, 165, 0, 0.3));
        }

        .hero-logo {
          height: 80px;
          width: auto;
          opacity: 0;
          animation: 
            slideDown 0.8s ease 0.2s forwards,
            float 3s ease-in-out infinite 1s,
            glowPulse 2.5s ease-in-out infinite 1s;
          will-change: transform;
          margin-bottom: 32px;
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }

        /* Utility */
        .fade-in {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s ease-out, transform 0.8s ease-out;
        }
        .fade-in.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .btn-amber {
          background-color: var(--amber);
          color: #0D1117;
          padding: 16px 32px;
          border-radius: 40px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-size: 18px;
          transition: transform 0.2s, box-shadow 0.2s;
          display: inline-block;
          text-decoration: none;
          animation: pulse-glow 2s infinite;
        }
        .btn-amber:hover { transform: scale(1.02); }
        .btn-amber:active { transform: scale(0.98); }

        @keyframes pulse-glow {
          0% { box-shadow: 0 0 0 0 rgba(240, 165, 0, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(240, 165, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(240, 165, 0, 0); }
        }

        /* Section styles */
        section {
          padding: 100px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
        }

        .label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 24px;
          text-transform: uppercase;
        }

        /* Navbar */
        nav {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          padding: 32px 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }
        .logo {
          font-family: 'Instrument Serif', serif;
          font-size: 28px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .logo-dot { width: 8px; height: 8px; background-color: var(--amber); border-radius: 50%; }
        .nav-signin {
          border: 1px solid var(--amber);
          color: var(--amber);
          background: transparent;
          padding: 10px 24px;
          border-radius: 30px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-signin:hover { background: var(--amber); color: #0D1117; }

        /* Hero */
        .hero {
          min-height: 100vh;
          justify-content: center;
          overflow: hidden;
        }
        .hero h1 {
          font-family: 'Instrument Serif', serif;
          font-size: 56px;
          line-height: 1.1;
          margin-bottom: 24px;
          max-width: 800px;
        }
        .hero p {
          font-size: 18px;
          color: var(--text-secondary);
          max-width: 600px;
          margin-bottom: 40px;
          line-height: 1.6;
        }
        .hero-muted {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 16px;
        }

        /* Floating Cards */
        .floating-cards {
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          pointer-events: none;
          z-index: -1;
        }
        .mock-card {
          position: absolute;
          background: var(--surface);
          border: 1px solid #30363D;
          border-radius: 12px;
          padding: 16px;
          width: 240px;
          opacity: 0.4;
        }
        .mock-card .line { height: 8px; background: #30363D; border-radius: 4px; margin-bottom: 8px; }
        .card-1 { top: 20%; left: 10%; transform: rotate(-12deg); }
        .card-2 { top: 60%; left: 5%; transform: rotate(8deg); }
        .card-3 { top: 25%; right: 10%; transform: rotate(15deg); }

        /* Problem */
        .problem-stat {
          font-size: 40px;
          font-weight: 700;
          margin-bottom: 60px;
          max-width: 700px;
        }
        .problem-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          max-width: 1100px;
          width: 100%;
        }
        .problem-card {
          background: var(--surface);
          border-left: 4px solid var(--amber);
          border-radius: 12px;
          padding: 32px;
          text-align: left;
        }
        .problem-card h3 { font-size: 20px; margin-bottom: 12px; }
        .problem-card p { font-size: 15px; color: var(--text-secondary); line-height: 1.6; }

        /* How it works */
        .steps-container {
          display: flex;
          justify-content: space-between;
          width: 100%;
          max-width: 1100px;
          position: relative;
          margin-top: 40px;
        }
        .steps-line {
          position: absolute;
          top: 24px;
          left: 50px;
          right: 50px;
          height: 1px;
          background: #30363D;
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
          width: 48px;
          height: 48px;
          background: var(--amber);
          color: #0D1117;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          margin-bottom: 24px;
        }
        .step h3 { font-size: 18px; margin-bottom: 12px; }
        .step p { font-size: 14px; color: var(--text-secondary); line-height: 1.5; }

        /* Features */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(2, 1fr);
          gap: 24px;
          max-width: 1100px;
          width: 100%;
        }
        .feature-card {
          background: var(--surface);
          border: 1px solid #30363D;
          border-radius: 12px;
          padding: 32px;
          text-align: left;
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          border-color: var(--amber);
        }
        .feature-icon { font-size: 24px; margin-bottom: 16px; display: block; }
        .feature-card h3 { font-size: 18px; margin-bottom: 8px; }
        .feature-card p { font-size: 14px; color: var(--text-secondary); line-height: 1.5; }

        /* Footer */
        .footer {
          padding-bottom: 60px;
        }
        .footer .logo { font-size: 40px; margin-bottom: 12px; }
        .footer .tagline { font-size: 20px; color: var(--text-secondary); margin-bottom: 40px; }
        .copyright { font-size: 13px; color: var(--text-secondary); margin-top: 24px; }

        @media (max-width: 900px) {
          .problem-grid, .features-grid { grid-template-columns: 1fr; }
          .steps-container { flex-direction: column; gap: 40px; }
          .steps-line { display: none; }
          .hero h1 { font-size: 40px; }
          nav { padding: 24px; }
        }
      `}</style>

      <nav>
        <img src="/logo.png" alt="MailPulse" className="navbar-logo" />
        <button className="nav-signin" onClick={onLogin}>Sign in</button>
      </nav>

      <section className="hero fade-in">
        <img src="/logo.png" alt="MailPulse" className="hero-logo" />
        <div className="floating-cards">
          <div className="mock-card card-1">
            <div className="line" style={{ width: '40%' }}></div>
            <div className="line" style={{ width: '80%' }}></div>
            <div className="line" style={{ width: '60%' }}></div>
          </div>
          <div className="mock-card card-2">
            <div className="line" style={{ width: '50%' }}></div>
            <div className="line" style={{ width: '70%' }}></div>
            <div className="line" style={{ width: '40%' }}></div>
          </div>
          <div className="mock-card card-3">
            <div className="line" style={{ width: '60%' }}></div>
            <div className="line" style={{ width: '30%' }}></div>
            <div className="line" style={{ width: '70%' }}></div>
          </div>
        </div>
        <h1>Your inbox shouldn't run your morning.</h1>
        <p>
          MailPulse scans your Gmail, ranks what matters, and sends you a 
          60-second WhatsApp voice briefing every morning. No app to open. 
          No inbox to dread.
        </p>
        <button className="btn-amber" onClick={onLogin}>Connect Gmail & Get Started</button>
        <p className="hero-muted">Free to try · No credit card · Works with any Gmail account</p>
      </section>

      <section className="problem fade-in">
        <div className="label" style={{ color: 'var(--amber)' }}>THE PROBLEM</div>
        <h2 className="problem-stat">The average person spends 2.5 hours checking email daily</h2>
        <div className="problem-grid">
          <div className="problem-card">
            <h3>📬 Inbox overload</h3>
            <p>50+ emails a day compete for your attention. The important ones get buried.</p>
          </div>
          <div className="problem-card">
            <h3>⏰ Missed deadlines</h3>
            <p>Replies that needed to happen today get lost in newsletters and notifications.</p>
          </div>
          <div className="problem-card">
            <h3>🧠 Mental drain</h3>
            <p>Context switching to email kills deep work. You check it 74 times a day on average.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works fade-in">
        <div className="label" style={{ color: 'var(--teal)' }}>HOW IT WORKS</div>
        <div className="steps-container">
          <div className="steps-line"></div>
          <div className="step">
            <div className="step-num">1</div>
            <h3>Connect Gmail</h3>
            <p>One-click Google OAuth. We only read, never send.</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>AI Scans Your Inbox</h3>
            <p>Every email ranked by urgency, deadline, and sender importance.</p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>Get Your Briefing</h3>
            <p>A 60-second voice note lands in your WhatsApp at 7:30am.</p>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <h3>Reply With Confidence</h3>
            <p>AI-drafted replies ready to send with one tap.</p>
          </div>
        </div>
      </section>

      <section className="features fade-in">
        <div className="label">WHAT YOU GET</div>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">🎯</span>
            <h3>Priority Inbox</h3>
            <p>Urgent emails surfaced automatically</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🎙️</span>
            <h3>Voice Briefings</h3>
            <p>WhatsApp audio note every morning</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">✍️</span>
            <h3>AI Draft Replies</h3>
            <p>Tone-matched replies ready to send</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📊</span>
            <h3>Thread Context</h3>
            <p>Full conversation history in 2 sentences</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <h3>Deadline Detection</h3>
            <p>Never miss a time-sensitive email</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🔒</span>
            <h3>Privacy First</h3>
            <p>Read-only access, your data stays yours</p>
          </div>
        </div>
      </section>

      <section className="footer fade-in">
        <img src="/logo.png" alt="MailPulse" className="navbar-logo" style={{ marginBottom: '16px' }} />
        <p className="tagline">Your inbox, briefed.</p>
        <button className="btn-amber" onClick={onLogin}>Get Started Free</button>
        <p className="copyright">© 2025 MailPulse · Built for people who get too many emails</p>
      </section>
    </div>
  );
};

export default Landing;
