import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight,
  AudioLines,
  BellRing,
  BrainCircuit,
  Check,
  Clock3,
  FileText,
  LockKeyhole,
  Mail,
  MessageSquareText,
  Mic2,
  Orbit,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Zap,
} from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0, y: 34 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.22, 1, 0.36, 1] } },
};

const intelligenceCards = [
  {
    className: 'orbit-card card-left',
    icon: BellRing,
    label: 'Urgent thread',
    title: 'Vendor contract needs sign-off by noon',
    meta: 'Priority: executive action',
  },
  {
    className: 'orbit-card card-right',
    icon: AudioLines,
    label: 'Morning brief',
    title: '7 decisions, 3 replies, 1 blocker',
    meta: '60 seconds prepared',
  },
  {
    className: 'orbit-card card-low',
    icon: MessageSquareText,
    label: 'Draft ready',
    title: 'Warm follow-up to enterprise lead',
    meta: 'Tone matched to your last reply',
  },
];

const problems = [
  {
    icon: Mail,
    title: 'The signal is buried',
    copy: 'Important conversations arrive beside receipts, newsletters, and meeting noise. Your attention becomes the filter.',
  },
  {
    icon: Clock3,
    title: 'Response windows close quietly',
    copy: 'The email that needs a reply today often looks identical to the one that can wait until next week.',
  },
  {
    icon: BrainCircuit,
    title: 'Context switching taxes the day',
    copy: 'Every inbox check reopens a dozen small loops, pulling strategic work back into operational drag.',
  },
];

const steps = [
  {
    icon: ShieldCheck,
    title: 'Connect securely',
    copy: 'Authorize read-only Gmail access in under a minute. MailPulse never sends from your account.',
  },
  {
    icon: BrainCircuit,
    title: 'Rank the day',
    copy: 'The AI studies urgency, deadlines, sender importance, and thread context before your morning begins.',
  },
  {
    icon: Mic2,
    title: 'Receive the briefing',
    copy: 'A concise WhatsApp voice note gives you the workday shape before the inbox can take over.',
  },
  {
    icon: Zap,
    title: 'Act with precision',
    copy: 'Draft replies, deadlines, and next actions are ready when a conversation deserves momentum.',
  },
];

const features = [
  {
    icon: Orbit,
    title: 'Priority intelligence layer',
    copy: 'A ranked command center for the messages that change your day, not just the messages that arrived last.',
    size: 'feature-large',
  },
  {
    icon: AudioLines,
    title: 'Voice briefings',
    copy: 'Turn email into a calm daily briefing for the commute, walk, or first coffee.',
  },
  {
    icon: FileText,
    title: 'Thread compression',
    copy: 'Long conversations become two-sentence context blocks with clear recommended action.',
  },
  {
    icon: TimerReset,
    title: 'Deadline detection',
    copy: 'Surfaces time-sensitive requests before they slip under operational clutter.',
  },
  {
    icon: MessageSquareText,
    title: 'AI draft replies',
    copy: 'Tone-aware responses preserve your voice while removing the blank-page pause.',
  },
  {
    icon: LockKeyhole,
    title: 'Privacy posture',
    copy: 'Read-only by design, with a product surface that makes trust feel visible.',
  },
];

const metrics = [
  ['50+', 'emails distilled each morning'],
  ['60s', 'briefing instead of inbox scanning'],
  ['3x', 'faster path to the right reply'],
];

const Landing = ({ onLogin }) => {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, 110]);
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0.36]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="mp-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap');

        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          margin: 0;
          background: #050816;
          color: #f5f5f5;
          font-family: Inter, Manrope, system-ui, sans-serif;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }

        :root {
          --bg: #050816;
          --bg-2: #09111f;
          --bg-3: #0b1020;
          --surface: rgba(17, 24, 39, 0.72);
          --surface-soft: rgba(17, 24, 39, 0.48);
          --border: rgba(255, 255, 255, 0.06);
          --border-strong: rgba(255, 255, 255, 0.1);
          --text: #f5f5f5;
          --muted: #9ca3af;
          --gold: #f59e0b;
          --blue: #3b82f6;
          --red: #7f1d3a;
          --glow: rgba(245, 158, 11, 0.18);
          --radius: 24px;
          --shadow: 0 10px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02);
          --serif: 'Playfair Display', Georgia, serif;
        }

        ::selection { background: rgba(245, 158, 11, 0.35); color: #fff; }

        .mp-page {
          position: relative;
          min-height: 100vh;
          background:
            radial-gradient(circle at 12% 8%, rgba(127, 29, 58, 0.28), transparent 34vw),
            radial-gradient(circle at 86% 10%, rgba(59, 130, 246, 0.2), transparent 30vw),
            radial-gradient(circle at 50% 44%, rgba(245, 158, 11, 0.08), transparent 34vw),
            linear-gradient(180deg, #050816 0%, #09111f 42%, #050816 100%);
          overflow: hidden;
        }

        .mp-page::before {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.32;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 82%);
        }

        .mp-page::after {
          content: '';
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.11;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
        }

        .shell {
          width: min(1350px, calc(100% - 48px));
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .mp-nav {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: min(1180px, calc(100% - 32px));
          height: 68px;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px 0 18px;
          border: 1px solid transparent;
          border-radius: 999px;
          transition: background 0.3s ease, border 0.3s ease, box-shadow 0.3s ease;
        }

        .mp-nav.scrolled {
          background: rgba(5, 8, 22, 0.74);
          border-color: var(--border);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(18px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text);
          text-decoration: none;
          font-weight: 700;
          letter-spacing: 0;
        }

        .brand img {
          width: 38px;
          height: 38px;
          object-fit: contain;
          filter: drop-shadow(0 0 18px rgba(245, 158, 11, 0.22));
        }

        .brand span { font-size: 16px; }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 999px;
          background: rgba(255,255,255,0.025);
        }

        .nav-links a {
          color: var(--muted);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 14px;
          border-radius: 999px;
          transition: color 0.2s ease, background 0.2s ease;
        }

        .nav-links a:hover {
          color: var(--text);
          background: rgba(255,255,255,0.06);
        }

        .nav-action, .primary-btn, .secondary-btn {
          border: 0;
          cursor: pointer;
          font: inherit;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          white-space: nowrap;
        }

        .nav-action {
          min-height: 44px;
          padding: 0 18px;
          color: #120f07;
          font-size: 13px;
          font-weight: 800;
          border-radius: 999px;
          background: linear-gradient(135deg, #f8c75c, #f59e0b 62%, #d97706);
          box-shadow: 0 12px 34px rgba(245, 158, 11, 0.2), inset 0 1px 0 rgba(255,255,255,0.45);
          transition: transform 0.22s ease, box-shadow 0.22s ease;
        }

        .nav-action:hover, .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 48px rgba(245, 158, 11, 0.26), inset 0 1px 0 rgba(255,255,255,0.48);
        }

        .hero {
          min-height: 100vh;
          padding: 150px 0 96px;
          display: grid;
          place-items: center;
          position: relative;
        }

        .hero-core {
          width: min(930px, 100%);
          margin: 0 auto;
          text-align: center;
          position: relative;
          z-index: 3;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 9px;
          margin-bottom: 24px;
          padding: 9px 13px;
          max-width: 100%;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: rgba(255,255,255,0.035);
          color: #d1d5db;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          backdrop-filter: blur(14px);
        }

        .eyebrow svg { color: var(--gold); width: 15px; height: 15px; }

        h1, h2, h3, p { margin: 0; }

        .hero h1 {
          font-family: var(--serif);
          font-size: clamp(54px, 8.2vw, 118px);
          line-height: 0.94;
          font-weight: 600;
          letter-spacing: 0;
          text-wrap: balance;
        }

        .highlight {
          color: transparent;
          background: linear-gradient(100deg, #f5f5f5 0%, #f4b84a 42%, #90b7ff 78%, #f5f5f5 100%);
          -webkit-background-clip: text;
          background-clip: text;
          filter: drop-shadow(0 10px 36px rgba(245, 158, 11, 0.12));
        }

        .hero-copy {
          width: min(650px, 100%);
          margin: 28px auto 0;
          color: #b6bdc8;
          font-size: clamp(16px, 1.5vw, 20px);
          line-height: 1.75;
        }

        .hero-actions {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 38px;
        }

        .primary-btn {
          position: relative;
          max-width: 100%;
          min-height: 58px;
          padding: 0 28px;
          overflow: hidden;
          color: #0d0b06;
          font-size: 15px;
          font-weight: 800;
          border-radius: 999px;
          background: linear-gradient(135deg, #ffe0a3, #f59e0b 58%, #b9561b);
          box-shadow: 0 18px 58px rgba(245, 158, 11, 0.24), inset 0 1px 0 rgba(255,255,255,0.6);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .primary-btn::before {
          content: '';
          position: absolute;
          inset: -60% auto -60% -35%;
          width: 38%;
          transform: rotate(20deg);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
          animation: shine 4.8s ease-in-out infinite;
        }

        .secondary-btn {
          max-width: 100%;
          min-height: 58px;
          padding: 0 22px;
          color: #e5e7eb;
          font-size: 15px;
          font-weight: 700;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(16px);
        }

        .proof-line {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 26px;
          color: #aeb6c2;
          font-size: 13px;
        }

        .proof-line span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 8px 11px;
          min-width: 0;
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 999px;
          background: rgba(255,255,255,0.025);
        }

        .proof-line svg { width: 14px; height: 14px; color: var(--gold); }

        .orbital-field {
          position: absolute;
          inset: 82px 0 20px;
          pointer-events: none;
          z-index: 2;
        }

        .hero-ring {
          position: absolute;
          left: 50%;
          top: 49%;
          width: min(880px, 82vw);
          aspect-ratio: 1;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(255,255,255,0.055);
          border-radius: 50%;
          box-shadow: inset 0 0 90px rgba(59, 130, 246, 0.045), 0 0 110px rgba(127, 29, 58, 0.08);
        }

        .hero-ring::before, .hero-ring::after {
          content: '';
          position: absolute;
          inset: 12%;
          border: 1px solid rgba(245, 158, 11, 0.07);
          border-radius: 50%;
        }

        .hero-ring::after {
          inset: 28%;
          border-color: rgba(59, 130, 246, 0.08);
        }

        .orbit-card {
          position: absolute;
          width: 285px;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 22px;
          background: linear-gradient(145deg, rgba(17,24,39,0.82), rgba(17,24,39,0.46));
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
          text-align: left;
          pointer-events: auto;
        }

        .orbit-card:hover { transform: translateY(-4px); }

        .card-left { left: 2%; top: 24%; }
        .card-right { right: 0; top: 25%; }
        .card-low { left: 18%; bottom: 6%; }

        .mini-head {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--muted);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .mini-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: rgba(245, 158, 11, 0.1);
          color: var(--gold);
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.12);
        }

        .orbit-card h3 {
          margin-top: 15px;
          font-size: 15px;
          line-height: 1.45;
          color: #f8fafc;
        }

        .orbit-card p {
          margin-top: 10px;
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.5;
        }

        .section {
          position: relative;
          padding: 116px 0;
          z-index: 2;
        }

        .section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          width: min(1120px, calc(100% - 48px));
          height: 1px;
          transform: translateX(-50%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        }

        .section-head {
          width: min(760px, 100%);
          margin-bottom: 44px;
        }

        .section-centered {
          margin-left: auto;
          margin-right: auto;
          text-align: center;
        }

        .kicker {
          color: var(--gold);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .section-title {
          font-family: var(--serif);
          font-size: clamp(38px, 5vw, 68px);
          line-height: 1.02;
          font-weight: 600;
          letter-spacing: 0;
          text-wrap: balance;
        }

        .section-copy {
          margin-top: 18px;
          color: #aeb6c2;
          font-size: 17px;
          line-height: 1.75;
        }

        .problem-layout {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 38px;
          align-items: stretch;
        }

        .monument {
          position: relative;
          min-height: 480px;
          padding: 36px;
          border: 1px solid var(--border);
          border-radius: 32px;
          background:
            radial-gradient(circle at 22% 20%, rgba(245,158,11,0.16), transparent 32%),
            linear-gradient(145deg, rgba(17,24,39,0.8), rgba(11,16,32,0.68));
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .monument::after {
          content: '';
          position: absolute;
          inset: auto -20% -34% 8%;
          height: 54%;
          background: radial-gradient(circle, rgba(127,29,58,0.26), transparent 70%);
        }

        .metric {
          position: relative;
          z-index: 1;
          font-family: var(--serif);
          font-size: clamp(84px, 11vw, 156px);
          line-height: 0.85;
          color: #f6b640;
          letter-spacing: 0;
          text-shadow: 0 0 56px rgba(245,158,11,0.18);
        }

        .metric-label {
          position: relative;
          z-index: 1;
          width: min(430px, 100%);
          margin-top: 24px;
          color: #d5dae3;
          font-size: 23px;
          line-height: 1.35;
        }

        .metric-line {
          position: absolute;
          left: 36px;
          right: 36px;
          bottom: 36px;
          height: 1px;
          background: linear-gradient(90deg, rgba(245,158,11,0.7), transparent);
        }

        .problem-grid {
          display: grid;
          gap: 18px;
        }

        .glass-card {
          position: relative;
          padding: 26px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--surface);
          box-shadow: var(--shadow);
          backdrop-filter: blur(16px);
          overflow: hidden;
          transition: transform 0.3s ease, border-color 0.3s ease, background 0.3s ease;
        }

        .glass-card:hover {
          transform: translateY(-4px);
          border-color: rgba(245,158,11,0.2);
          background: rgba(17,24,39,0.84);
        }

        .glass-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 12% 0%, rgba(245,158,11,0.1), transparent 35%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .glass-card:hover::before { opacity: 1; }

        .icon-box {
          position: relative;
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          margin-bottom: 28px;
          color: var(--gold);
          border-radius: 16px;
          background: rgba(245,158,11,0.1);
          box-shadow: inset 0 0 0 1px rgba(245,158,11,0.12);
        }

        .glass-card h3, .feature-card h3 {
          position: relative;
          font-size: 18px;
          line-height: 1.25;
          margin-bottom: 10px;
        }

        .glass-card p, .feature-card p {
          position: relative;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .timeline-wrap {
          position: relative;
          padding: 36px 0 10px;
        }

        .timeline-line {
          position: absolute;
          top: 72px;
          left: 8%;
          right: 8%;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(245,158,11,0.72), rgba(59,130,246,0.48), transparent);
          box-shadow: 0 0 34px rgba(245,158,11,0.2);
        }

        .steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          position: relative;
        }

        .step-card {
          padding-top: 0;
          text-align: left;
        }

        .step-circle {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          margin-bottom: 26px;
          border: 1px solid rgba(245,158,11,0.18);
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(245,158,11,0.18), rgba(17,24,39,0.92));
          color: var(--gold);
          box-shadow: 0 0 40px rgba(245,158,11,0.14);
        }

        .step-index {
          color: rgba(245,158,11,0.8);
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 13px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
        }

        .feature-card {
          min-height: 260px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .feature-large {
          grid-column: span 2;
          grid-row: span 2;
          min-height: 538px;
          padding: 34px;
          background:
            radial-gradient(circle at 78% 15%, rgba(59,130,246,0.18), transparent 38%),
            radial-gradient(circle at 18% 12%, rgba(245,158,11,0.14), transparent 34%),
            var(--surface);
        }

        .feature-large .icon-box {
          width: 64px;
          height: 64px;
          border-radius: 20px;
        }

        .feature-large h3 {
          font-family: var(--serif);
          font-size: clamp(32px, 3.4vw, 48px);
          line-height: 1.02;
        }

        .feature-large p {
          max-width: 500px;
          font-size: 16px;
        }

        .metrics-band {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          border: 1px solid var(--border);
          border-radius: 30px;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
          box-shadow: var(--shadow);
        }

        .metric-cell {
          padding: 36px 28px;
          background: rgba(17,24,39,0.58);
          text-align: center;
        }

        .metric-cell strong {
          display: block;
          font-family: var(--serif);
          color: #f6b640;
          font-size: clamp(44px, 5vw, 72px);
          line-height: 1;
          font-weight: 600;
        }

        .metric-cell span {
          display: block;
          margin-top: 11px;
          color: var(--muted);
          font-size: 14px;
        }

        .final-panel {
          position: relative;
          width: min(980px, 100%);
          margin: 0 auto;
          padding: 78px 34px;
          text-align: center;
          border: 1px solid var(--border);
          border-radius: 38px;
          background:
            radial-gradient(circle at 50% 0%, rgba(245,158,11,0.18), transparent 35%),
            radial-gradient(circle at 100% 100%, rgba(59,130,246,0.15), transparent 40%),
            rgba(17,24,39,0.64);
          box-shadow: 0 24px 90px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          overflow: hidden;
        }

        .final-panel::before {
          content: '';
          position: absolute;
          inset: 18px;
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 28px;
          pointer-events: none;
        }

        .final-panel h2 {
          position: relative;
          width: min(760px, 100%);
          margin: 0 auto;
          font-family: var(--serif);
          font-size: clamp(42px, 6vw, 82px);
          line-height: 0.98;
          font-weight: 600;
          text-wrap: balance;
        }

        .final-panel p {
          position: relative;
          width: min(600px, 100%);
          margin: 22px auto 32px;
          color: #b8c0cc;
          font-size: 17px;
          line-height: 1.7;
        }

        .footer {
          position: relative;
          z-index: 2;
          padding: 36px 0 48px;
          color: var(--muted);
          font-size: 13px;
        }

        .footer-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          border-top: 1px solid var(--border);
          padding-top: 24px;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #e5e7eb;
          font-weight: 800;
        }

        .footer-brand img { width: 26px; height: 26px; }

        @keyframes shine {
          0%, 42% { transform: translateX(0) rotate(20deg); opacity: 0; }
          52% { opacity: 1; }
          68%, 100% { transform: translateX(440%) rotate(20deg); opacity: 0; }
        }

        @media (max-width: 1100px) {
          .hero-core { width: min(780px, 100%); }
          .orbit-card { width: 238px; }
          .card-left { left: -1%; top: 18%; }
          .card-right { right: -1%; top: 20%; }
          .card-low { left: 12%; bottom: 4%; }
          .problem-layout { grid-template-columns: 1fr; }
          .monument { min-height: 420px; }
          .steps { grid-template-columns: repeat(2, 1fr); }
          .timeline-line { display: none; }
          .features-grid { grid-template-columns: repeat(2, 1fr); }
          .feature-large { min-height: 420px; }
        }

        @media (max-width: 960px) {
          .hero {
            min-height: auto;
            padding-top: 132px;
          }

          .hero-core {
            width: min(720px, 100%);
          }

          .orbital-field {
            position: relative;
            inset: auto;
            width: min(720px, 100%);
            height: 430px;
            margin-top: 42px;
          }

          .hero-ring {
            width: 520px;
            max-width: 88vw;
            top: 50%;
          }

          .orbit-card {
            width: min(310px, 43vw);
          }

          .card-left { left: 0; top: 0; }
          .card-right { right: 0; top: 110px; }
          .card-low { left: 50%; bottom: 0; transform: translateX(-50%); }
        }

        @media (max-width: 820px) {
          .shell { width: min(100% - 32px, 1350px); }
          .mp-nav { top: 10px; width: calc(100% - 20px); }
          .nav-links { display: none; }
          .brand span { display: none; }
          .hero { padding: 118px 0 74px; }
          .orbital-field { width: 100%; height: 430px; margin-top: 34px; }
          .orbit-card { width: min(300px, 86vw); }
          .card-left { left: 0; top: 0; }
          .card-right { right: 0; top: 132px; }
          .card-low { left: 50%; bottom: 0; transform: translateX(-50%); }
          .section { padding: 78px 0; }
          .monument { min-height: 390px; padding: 28px; }
          .steps, .features-grid, .metrics-band { grid-template-columns: 1fr; }
          .feature-large { grid-column: auto; grid-row: auto; min-height: 360px; }
          .metrics-band { border-radius: 24px; }
          .footer-inner { flex-direction: column; text-align: center; }
        }

        @media (max-width: 520px) {
          .shell { width: min(100% - 28px, 1350px); }
          .mp-nav { height: 60px; padding-left: 12px; }
          .brand img { width: 34px; height: 34px; }
          .nav-action { min-height: 40px; padding: 0 14px; }
          .hero h1 { font-size: clamp(46px, 15vw, 72px); }
          .hero-copy { font-size: 15px; }
          .eyebrow {
            width: 100%;
            padding: 10px 12px;
            border-radius: 18px;
            font-size: 10.5px;
            line-height: 1.35;
          }
          .hero-actions { align-items: stretch; flex-direction: column; }
          .primary-btn, .secondary-btn {
            width: 100%;
            min-height: 54px;
            padding-inline: 18px;
            text-align: center;
          }
          .proof-line { justify-content: stretch; }
          .proof-line span { width: 100%; }
          .orbital-field { height: 460px; }
          .orbit-card { width: 100%; }
          .card-right { top: 150px; }
          .card-low { left: 50%; }
          .section-title { font-size: 38px; }
          .section-copy { font-size: 15px; }
          .metric { font-size: 82px; }
          .metric-label { font-size: 19px; }
          .glass-card { padding: 22px; }
          .final-panel { padding: 58px 20px; border-radius: 28px; }
        }

        @media (max-width: 390px) {
          .shell { width: min(100% - 22px, 1350px); }
          .hero { padding-top: 108px; }
          .hero h1 { font-size: clamp(42px, 14.5vw, 58px); }
          .hero-copy { line-height: 1.65; }
          .orbital-field { height: 485px; }
          .orbit-card { padding: 14px; }
          .card-right { top: 158px; }
          .section { padding: 66px 0; }
          .monument {
            min-height: 330px;
            padding: 22px;
            border-radius: 24px;
          }
          .metric { font-size: 72px; }
          .metric-label { font-size: 17px; }
          .metric-line {
            left: 22px;
            right: 22px;
            bottom: 22px;
          }
          .feature-large { min-height: 330px; }
          .final-panel h2 { font-size: 38px; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <nav className={`mp-nav ${scrolled ? 'scrolled' : ''}`}>
        <a className="brand" href="#top" aria-label="MailPulse home">
          <img src="/logo.png" alt="" />
          <span>MailPulse</span>
        </a>
        <div className="nav-links" aria-label="Primary navigation">
          <a href="#problem">Problem</a>
          <a href="#how-it-works">Workflow</a>
          <a href="#features">Features</a>
          <a href="#metrics">Proof</a>
        </div>
        <button className="nav-action" onClick={onLogin}>
          Sign in <ArrowRight size={15} />
        </button>
      </nav>

      <section className="hero shell" id="top">
        <motion.div className="hero-core" style={{ y: heroY, opacity: heroOpacity }} variants={container} initial="hidden" animate="show">
          <motion.div className="eyebrow" variants={item}>
            <Sparkles />
            AI email intelligence for decisive mornings
          </motion.div>
          <motion.h1 variants={item}>
            Start your mornings <span className="highlight">informed, not overwhelmed.</span>
          </motion.h1>
          <motion.p className="hero-copy" variants={item}>
            MailPulse turns inbox noise into a private executive briefing: urgent threads, hidden deadlines, and draft-ready replies delivered before the workday pulls you under.
          </motion.p>
          <motion.div className="hero-actions" variants={item}>
            <button className="primary-btn" onClick={onLogin}>
              Get started free <ArrowRight size={18} />
            </button>
            <a className="secondary-btn" href="#how-it-works">
              See the briefing flow
            </a>
          </motion.div>
          <motion.div className="proof-line" variants={item}>
            <span><ShieldCheck /> Read-only Gmail access</span>
            <span><Zap /> 60-second setup</span>
            <span><Check /> Free during beta</span>
          </motion.div>
        </motion.div>

        <div className="orbital-field" aria-hidden="true">
          <motion.div
            className="hero-ring"
            animate={{ rotate: 360 }}
            transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
          />
          {intelligenceCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.title}
                className={card.className}
                initial={{ opacity: 0, y: 28, scale: 0.96 }}
                animate={{ opacity: 1, y: [0, -10, 0], scale: 1 }}
                transition={{
                  opacity: { duration: 0.8, delay: 0.45 + index * 0.15 },
                  scale: { duration: 0.8, delay: 0.45 + index * 0.15 },
                  y: { duration: 5.8 + index, repeat: Infinity, ease: 'easeInOut', delay: index * 0.35 },
                }}
              >
                <div className="mini-head">
                  <span className="mini-icon"><Icon size={17} /></span>
                  {card.label}
                </div>
                <h3>{card.title}</h3>
                <p>{card.meta}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="section" id="problem">
        <div className="shell problem-layout">
          <motion.div className="monument" variants={fadeIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}>
            <motion.div className="metric" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
              2.5 hrs
            </motion.div>
            <p className="metric-label">spent checking email every day. Most of that time is not decision-making. It is recovery from interruption.</p>
            <div className="metric-line" />
          </motion.div>

          <div>
            <motion.div className="section-head" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}>
              <motion.div className="kicker" variants={item}>The problem</motion.div>
              <motion.h2 className="section-title" variants={item}>Your inbox was built for arrival order. Your day runs on importance.</motion.h2>
              <motion.p className="section-copy" variants={item}>
                MailPulse reframes email as intelligence, so the morning begins with context instead of triage.
              </motion.p>
            </motion.div>
            <div className="problem-grid">
              {problems.map((problem, index) => {
                const Icon = problem.icon;
                return (
                  <motion.article className="glass-card" key={problem.title} variants={fadeIn} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} transition={{ delay: index * 0.08 }}>
                    <div className="icon-box"><Icon size={22} /></div>
                    <h3>{problem.title}</h3>
                    <p>{problem.copy}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="shell">
          <motion.div className="section-head section-centered" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}>
            <motion.div className="kicker" variants={item}>How it works</motion.div>
            <motion.h2 className="section-title" variants={item}>A calm intelligence loop before the inbox opens.</motion.h2>
            <motion.p className="section-copy" variants={item}>
              Four guided steps turn morning email from a scattered scan into a composed operating rhythm.
            </motion.p>
          </motion.div>

          <div className="timeline-wrap">
            <div className="timeline-line" />
            <div className="steps">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.article
                    className="glass-card step-card"
                    key={step.title}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{ duration: 0.75, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="step-circle"><Icon size={26} /></div>
                    <div className="step-index">Step 0{index + 1}</div>
                    <h3>{step.title}</h3>
                    <p>{step.copy}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="shell">
          <motion.div className="section-head" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}>
            <motion.div className="kicker" variants={item}>Product system</motion.div>
            <motion.h2 className="section-title" variants={item}>AI modules that feel like an operating system for modern work.</motion.h2>
            <motion.p className="section-copy" variants={item}>
              Asymmetric, focused, and built for repeated daily use instead of one more dashboard to babysit.
            </motion.p>
          </motion.div>

          <div className="features-grid">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  className={`glass-card feature-card ${feature.size || ''}`}
                  key={feature.title}
                  initial={{ opacity: 0, y: 34 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.72, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="icon-box"><Icon size={feature.size ? 30 : 22} /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" id="metrics">
        <div className="shell">
          <motion.div className="metrics-band" initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.8 }}>
            {metrics.map(([value, label]) => (
              <div className="metric-cell" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="section" id="final-cta">
        <div className="shell">
          <motion.div className="final-panel" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}>
            <motion.div className="eyebrow" variants={item}>
              <Sparkles />
              Your inbox, briefed
            </motion.div>
            <motion.h2 variants={item}>Wake up to the decisions, not the noise.</motion.h2>
            <motion.p variants={item}>
              Give MailPulse one morning and turn the inbox from an obligation into an intelligence briefing you can trust.
            </motion.p>
            <motion.div variants={item}>
              <button className="primary-btn" onClick={onLogin}>
                Start with Google <ArrowRight size={18} />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <footer className="footer">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <img src="/logo.png" alt="" />
            MailPulse
          </div>
          <div>© 2026 MailPulse. AI email intelligence.</div>
          <div>Read-only access. Built for calm mornings.</div>
        </div>
      </footer>
    </main>
  );
};

export default Landing;
