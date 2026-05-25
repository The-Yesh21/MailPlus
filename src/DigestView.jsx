import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  BriefcaseBusiness,
  ChevronDown,
  Clock3,
  Copy,
  Inbox,
  MessageSquareReply,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

const DIGEST_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@500;600;700;900&display=swap');

  .digest-wrap {
    --digest-bg: #060816;
    --digest-bg-2: #0B1020;
    --digest-surface: rgba(17, 24, 39, 0.78);
    --digest-surface-strong: rgba(19, 27, 46, 0.9);
    --digest-border: rgba(255,255,255,0.06);
    --digest-border-strong: rgba(255,255,255,0.1);
    --digest-blue: #3B82F6;
    --digest-red: #8B1E3F;
    --digest-gold: #D4A373;
    --digest-violet: #8B5CF6;
    --digest-ivory: #F3F4F6;
    --digest-muted: #9CA3AF;
    --digest-dim: #6B7280;
    flex: 1;
    display: flex;
    overflow: hidden;
    height: 100%;
    min-width: 0;
    color: var(--digest-ivory);
    background:
      radial-gradient(circle at 12% 0%, rgba(59,130,246,0.12), transparent 32%),
      radial-gradient(circle at 88% 12%, rgba(139,30,63,0.16), transparent 34%),
      linear-gradient(135deg, var(--digest-bg), var(--digest-bg-2) 52%, #070914);
  }

  .digest-scroll {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
    padding: 34px 32px 72px;
    position: relative;
  }
  .digest-scroll::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.014) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: linear-gradient(to bottom, rgba(0,0,0,0.75), transparent 72%);
  }
  .digest-scroll::-webkit-scrollbar { width: 5px; }
  .digest-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }

  .digest-shell {
    width: min(100%, 1400px);
    margin: 0 auto;
    position: relative;
    z-index: 1;
  }

  .digest-masthead {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 32px;
    align-items: end;
    padding: 8px 0 28px;
    border-bottom: 1px solid var(--digest-border);
    margin-bottom: 22px;
  }
  .digest-edition {
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--digest-muted);
    margin-bottom: 12px;
  }
  .digest-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(42px, 5vw, 72px);
    font-weight: 900;
    line-height: 0.96;
    letter-spacing: -0.035em;
    color: var(--digest-ivory);
    text-shadow: 0 22px 70px rgba(59,130,246,0.22);
  }
  .digest-title span {
    color: var(--digest-gold);
    font-style: italic;
    font-weight: 600;
  }
  .digest-tagline {
    margin-top: 14px;
    max-width: 640px;
    color: var(--digest-muted);
    font-size: 15px;
    line-height: 1.7;
  }
  .digest-meta-card {
    min-width: 260px;
    border: 1px solid var(--digest-border);
    border-radius: 20px;
    background: rgba(17,24,39,0.52);
    backdrop-filter: blur(16px);
    box-shadow: 0 18px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04);
    padding: 18px;
  }
  .digest-meta-label {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--digest-dim);
    margin-bottom: 10px;
  }
  .digest-meta-date {
    font-size: 15px;
    color: var(--digest-ivory);
    font-weight: 700;
    margin-bottom: 14px;
  }
  .digest-meta-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .digest-mini-stat {
    border: 1px solid var(--digest-border);
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    color: var(--digest-muted);
    background: rgba(255,255,255,0.03);
  }
  .digest-mini-stat strong { color: var(--digest-ivory); }

  .ai-banner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 28px;
    align-items: center;
    margin: 0 0 22px;
    padding: 24px;
    border-radius: 24px;
    background:
      linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,30,63,0.08)),
      rgba(17,24,39,0.66);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(18px);
    box-shadow: 0 18px 50px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04);
    overflow: hidden;
    position: relative;
  }
  .ai-banner::after {
    content: '';
    position: absolute;
    inset: -45% -20% auto auto;
    width: 380px;
    height: 380px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(59,130,246,0.16), transparent 60%);
    pointer-events: none;
  }
  .ai-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--digest-gold);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .ai-copy {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(25px, 2.7vw, 42px);
    line-height: 1.08;
    letter-spacing: -0.02em;
    color: var(--digest-ivory);
    max-width: 820px;
  }
  .ai-subcopy {
    color: var(--digest-muted);
    font-size: 15px;
    line-height: 1.65;
    margin-top: 12px;
    max-width: 760px;
  }
  .ai-signal-grid {
    display: grid;
    grid-template-columns: repeat(2, 140px);
    gap: 10px;
    position: relative;
    z-index: 1;
  }
  .ai-signal {
    border: 1px solid var(--digest-border);
    border-radius: 16px;
    background: rgba(6,8,22,0.36);
    padding: 14px;
  }
  .ai-signal-value {
    display: block;
    font-size: 24px;
    font-weight: 800;
    color: var(--digest-ivory);
    letter-spacing: -0.02em;
  }
  .ai-signal-label {
    display: block;
    margin-top: 3px;
    color: var(--digest-muted);
    font-size: 11px;
    line-height: 1.35;
  }

  .digest-stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 34px;
    position: relative;
  }
  .digest-chip-wrap { position: relative; }
  .digest-chip {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 9px 15px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
    user-select: none;
    border: 1px solid var(--chip-border);
    color: var(--chip-color);
    background: linear-gradient(135deg, var(--chip-bg), rgba(255,255,255,0.025));
    box-shadow: 0 10px 22px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04);
    backdrop-filter: blur(12px);
  }
  .digest-chip:hover,
  .digest-chip.active {
    transform: translateY(-2px);
    border-color: var(--chip-color);
    box-shadow: 0 14px 34px rgba(0,0,0,0.24), 0 0 26px var(--chip-glow);
  }
  .digest-chip-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--chip-glow);
  }
  .digest-chip-num {
    color: var(--digest-ivory);
    font-size: 15px;
    font-weight: 800;
  }
  .digest-chip-arrow {
    opacity: 0.74;
    transition: transform 0.2s ease;
  }
  .digest-chip.active .digest-chip-arrow { transform: rotate(180deg); }

  .chip-popover {
    position: absolute;
    top: calc(100% + 12px);
    left: 0;
    z-index: 220;
    min-width: 360px;
    max-width: 460px;
    overflow: hidden;
    border: 1px solid var(--digest-border-strong);
    border-radius: 18px;
    background: rgba(10,15,30,0.92);
    backdrop-filter: blur(28px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .chip-popover-header {
    padding: 14px 16px;
    border-bottom: 1px solid var(--digest-border);
    display: flex;
    justify-content: space-between;
    gap: 14px;
  }
  .chip-popover-title {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  .chip-popover-count { font-size: 12px; color: var(--digest-muted); }
  .chip-popover-list { max-height: 320px; overflow-y: auto; }
  .chip-popover-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--digest-border);
    cursor: pointer;
    transition: background 0.16s ease;
  }
  .chip-popover-item:hover { background: rgba(255,255,255,0.045); }
  .chip-popover-avatar,
  .digest-bcard-avatar,
  .digest-fyi-pill-avatar,
  .digest-panel-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #fff;
    font-weight: 800;
  }
  .chip-popover-avatar { width: 32px; height: 32px; border-radius: 12px; font-size: 12px; }
  .chip-popover-info { flex: 1; min-width: 0; }
  .chip-popover-sender { font-size: 13px; font-weight: 700; color: var(--digest-ivory); }
  .chip-popover-email,
  .chip-popover-subj,
  .chip-popover-time {
    color: var(--digest-muted);
    font-size: 11px;
  }
  .chip-popover-subj {
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip-popover-empty {
    padding: 24px;
    color: var(--digest-muted);
    text-align: center;
    font-size: 13px;
  }

  .digest-section { margin-bottom: 42px; }
  .digest-sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
  }
  .digest-sec-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--section-color);
  }
  .digest-sec-rule {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, var(--section-color), transparent);
    opacity: 0.24;
  }
  .digest-sec-note {
    font-size: 12px;
    color: var(--digest-dim);
    white-space: nowrap;
  }

  .digest-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 28px;
    align-items: stretch;
    border-radius: 26px;
    padding: 30px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(135deg, rgba(139,30,63,0.18), rgba(59,130,246,0.08)),
      var(--digest-surface);
    border: 1px solid rgba(212,163,115,0.18);
    box-shadow:
      0 24px 70px rgba(0,0,0,0.38),
      0 0 0 1px rgba(255,255,255,0.025),
      inset 0 1px 0 rgba(255,255,255,0.05);
    backdrop-filter: blur(14px);
  }
  .digest-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(212,163,115,0.32), transparent 28%, rgba(59,130,246,0.14));
    opacity: 0.42;
  }
  .digest-hero.sel {
    border-color: rgba(212,163,115,0.42);
    box-shadow: 0 28px 80px rgba(0,0,0,0.44), 0 0 40px rgba(212,163,115,0.11);
  }
  .digest-hero-main { position: relative; z-index: 1; min-width: 0; }
  .digest-hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--digest-gold);
    margin-bottom: 14px;
  }
  .digest-hero-hl {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: clamp(28px, 3.1vw, 48px);
    font-weight: 700;
    line-height: 1.08;
    letter-spacing: -0.025em;
    color: var(--digest-ivory);
    max-width: 980px;
  }
  .digest-hero-summary {
    margin-top: 16px;
    color: rgba(243,244,246,0.78);
    font-size: 16px;
    line-height: 1.65;
    max-width: 900px;
  }
  .digest-hero-foot {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 22px;
  }
  .digest-review-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(212,163,115,0.32);
    border-radius: 999px;
    color: #16120b;
    background: linear-gradient(135deg, #E4BE8C, var(--digest-gold));
    padding: 9px 15px;
    font-size: 13px;
    font-weight: 800;
    box-shadow: 0 14px 28px rgba(212,163,115,0.16);
  }
  .digest-hero-aside {
    position: relative;
    z-index: 1;
    width: 220px;
    border: 1px solid var(--digest-border);
    border-radius: 20px;
    padding: 18px;
    background: rgba(6,8,22,0.36);
  }
  .digest-aside-label {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--digest-dim);
    margin-bottom: 10px;
  }
  .digest-aside-sender {
    color: var(--digest-ivory);
    font-size: 15px;
    font-weight: 800;
    line-height: 1.25;
    margin-bottom: 14px;
  }
  .digest-aside-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--digest-muted);
    font-size: 12px;
  }
  .digest-aside-meta span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .digest-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
  .digest-intel-card {
    min-height: 188px;
    border-radius: 20px;
    padding: 18px;
    cursor: pointer;
    background: var(--digest-surface);
    border: 1px solid var(--card-border, var(--digest-border));
    box-shadow:
      0 10px 30px rgba(0,0,0,0.35),
      0 0 0 1px rgba(255,255,255,0.02);
    backdrop-filter: blur(12px);
    transition: border-color 0.25s ease, box-shadow 0.25s ease;
  }
  .digest-intel-card:hover {
    border-color: var(--card-color);
    box-shadow: 0 16px 42px rgba(0,0,0,0.38), 0 0 26px var(--card-glow);
  }
  .digest-intel-card.sel {
    border-color: var(--card-color);
    box-shadow: 0 18px 46px rgba(0,0,0,0.42), 0 0 0 1px var(--card-color);
  }
  .digest-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
  }
  .digest-card-type {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    color: var(--card-color);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .digest-card-sender {
    color: var(--digest-muted);
    font-size: 12px;
    font-weight: 700;
    text-align: right;
    max-width: 42%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .d-hl {
    font-size: 15px;
    font-weight: 750;
    line-height: 1.38;
    letter-spacing: -0.01em;
    color: var(--digest-ivory);
    margin-bottom: 10px;
  }
  .d-body {
    color: var(--digest-muted);
    font-size: 13px;
    line-height: 1.58;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .d-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 14px;
    color: var(--digest-muted);
    font-size: 12px;
  }

  .digest-brief-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
  }
  .digest-bcard {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    min-height: 132px;
    border-radius: 18px;
    padding: 16px;
    cursor: pointer;
    background: rgba(17,24,39,0.62);
    border: 1px solid var(--digest-border);
    box-shadow: 0 10px 28px rgba(0,0,0,0.24);
    backdrop-filter: blur(12px);
    transition: border-color 0.22s ease, box-shadow 0.22s ease;
  }
  .digest-bcard:hover,
  .digest-bcard.sel {
    border-color: rgba(59,130,246,0.42);
    box-shadow: 0 16px 34px rgba(0,0,0,0.3), 0 0 24px rgba(59,130,246,0.08);
  }
  .digest-bcard-avatar {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    font-size: 13px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
  }
  .digest-bcard-body { min-width: 0; }
  .digest-bcard-sender {
    color: var(--digest-muted);
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 5px;
  }
  .digest-bcard-subject {
    color: var(--digest-ivory);
    font-size: 15px;
    font-weight: 750;
    line-height: 1.34;
    margin-bottom: 8px;
  }
  .digest-bcard-summary {
    color: var(--digest-muted);
    font-size: 13px;
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .digest-fyi-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    padding: 18px;
    border: 1px solid var(--digest-border);
    border-radius: 22px;
    background: rgba(17,24,39,0.44);
    backdrop-filter: blur(14px);
  }
  .digest-fyi-pill,
  .digest-fyi-more {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    border-radius: 999px;
    border: 1px solid var(--digest-border);
    background: rgba(255,255,255,0.035);
    color: var(--digest-muted);
    padding: 7px 12px;
    font-size: 12px;
    cursor: pointer;
    transition: transform 0.18s ease, border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
  }
  .digest-fyi-pill:hover,
  .digest-fyi-pill.sel,
  .digest-fyi-more:hover {
    transform: translateY(-1px);
    color: var(--digest-ivory);
    border-color: rgba(59,130,246,0.36);
    background: rgba(59,130,246,0.08);
  }
  .digest-fyi-pill-avatar {
    width: 20px;
    height: 20px;
    border-radius: 8px;
    font-size: 8px;
  }
  .digest-fyi-pill-name {
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .digest-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 190px;
    padding: 38px 24px;
    text-align: center;
    border: 1px dashed rgba(255,255,255,0.1);
    border-radius: 22px;
    background: rgba(17,24,39,0.48);
  }
  .digest-empty-icon { color: var(--digest-blue); margin-bottom: 12px; }
  .digest-empty-title { font-size: 15px; font-weight: 800; margin-bottom: 6px; }
  .digest-empty-sub { color: var(--digest-muted); font-size: 13px; line-height: 1.6; }

  .digest-panel {
    width: min(400px, 32vw);
    flex-shrink: 0;
    height: 100%;
    overflow-y: auto;
    border-left: 1px solid var(--digest-border);
    background: rgba(8,12,25,0.84);
    backdrop-filter: blur(26px);
    box-shadow: -18px 0 60px rgba(0,0,0,0.28);
  }
  .digest-panel::-webkit-scrollbar { width: 4px; }
  .digest-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 8px; }
  .digest-panel-accent { height: 3px; background: linear-gradient(90deg, var(--digest-red), var(--digest-gold), var(--digest-blue)); }
  .digest-panel-inner { padding: 24px; }
  .digest-panel-close {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 22px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid var(--digest-border);
    background: rgba(255,255,255,0.035);
    color: var(--digest-muted);
    cursor: pointer;
    transition: all 0.18s ease;
  }
  .digest-panel-close:hover { color: var(--digest-ivory); border-color: var(--digest-border-strong); }
  .digest-panel-avatar { width: 46px; height: 46px; border-radius: 16px; font-size: 14px; }
  .digest-panel-hl {
    font-family: 'Playfair Display', Georgia, serif;
    color: var(--digest-ivory);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.18;
    letter-spacing: -0.018em;
    margin: 16px 0 8px;
  }
  .digest-infobox {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid var(--digest-border);
    background: rgba(17,24,39,0.64);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  }
  .digest-infobox-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .digest-panel-text {
    color: rgba(243,244,246,0.82);
    font-size: 13px;
    line-height: 1.7;
    margin: 0;
  }
  .digest-analyze-btn {
    width: 100%;
    border: 1px solid rgba(212,163,115,0.32);
    border-radius: 14px;
    background: linear-gradient(135deg, #E4BE8C, var(--digest-gold));
    color: #15120c;
    padding: 12px;
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    margin-bottom: 16px;
  }
  .digest-analyze-btn:disabled { opacity: 0.62; cursor: wait; }
  .digest-copy-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--digest-border);
    background: transparent;
    color: var(--digest-muted);
    font-size: 12px;
    cursor: pointer;
  }
  .digest-badge {
    padding: 6px 11px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    border: 1px solid;
  }
  .digest-priority-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .deadline-chip {
    border-radius: 999px !important;
    padding: 7px 11px !important;
    margin-top: 0 !important;
    font-size: 12px !important;
  }

  @media (max-width: 1180px) {
    .digest-masthead,
    .ai-banner,
    .digest-hero {
      grid-template-columns: 1fr;
    }
    .digest-meta-card,
    .digest-hero-aside {
      width: 100%;
      min-width: 0;
    }
    .ai-signal-grid { grid-template-columns: repeat(4, minmax(110px, 1fr)); }
    .digest-panel { width: 360px; }
  }

  @media (max-width: 860px) {
    .digest-scroll { padding: 22px 18px 54px; }
    .digest-masthead { gap: 18px; }
    .ai-banner { padding: 20px; }
    .ai-signal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .digest-hero { padding: 22px; }
    .digest-card-grid,
    .digest-brief-grid { grid-template-columns: 1fr; }
    .digest-sec-head { align-items: flex-start; flex-direction: column; }
    .digest-sec-rule { width: 100%; flex: none; }
    .digest-panel {
      position: absolute;
      inset: 0 0 0 auto;
      width: 100%;
      z-index: 220;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
      border-left: none;
    }
    .digest-panel.active { transform: translateY(0); }
    .chip-popover {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90vw;
      min-width: 0;
    }
  }

  @media (max-width: 560px) {
    .digest-wrap {
      min-width: 0;
    }
    .digest-scroll {
      padding: 18px 14px 46px;
    }
    .digest-title {
      font-size: clamp(40px, 14vw, 56px);
    }
    .digest-tagline,
    .ai-subcopy,
    .digest-hero-summary {
      font-size: 14px;
      line-height: 1.62;
    }
    .digest-meta-card,
    .ai-banner,
    .digest-hero,
    .digest-intel-card,
    .digest-bcard,
    .digest-fyi-strip {
      border-radius: 18px;
    }
    .digest-meta-row,
    .digest-stats {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .digest-mini-stat,
    .digest-chip {
      width: 100%;
      justify-content: center;
      text-align: center;
    }
    .ai-signal-grid {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .ai-signal {
      padding: 12px;
    }
    .digest-hero {
      padding: 18px;
    }
    .digest-hero-foot {
      align-items: stretch;
      flex-direction: column;
    }
    .digest-review-btn {
      justify-content: center;
      min-height: 42px;
    }
    .digest-card-top {
      flex-direction: column;
      align-items: flex-start;
    }
    .digest-card-sender {
      max-width: 100%;
      text-align: left;
    }
    .digest-bcard {
      gap: 12px;
      padding: 14px;
    }
    .digest-fyi-strip {
      align-items: stretch;
    }
    .digest-fyi-pill,
    .digest-fyi-more {
      justify-content: center;
      min-height: 38px;
    }
    .digest-panel-inner {
      padding: 18px 16px 28px;
    }
    .digest-panel-hl {
      font-size: 22px;
    }
  }

  @media (max-width: 390px) {
    .digest-scroll {
      padding-inline: 11px;
    }
    .digest-masthead {
      padding-top: 2px;
    }
    .digest-edition,
    .ai-kicker,
    .digest-sec-label {
      letter-spacing: 0.14em;
    }
    .ai-signal-grid {
      grid-template-columns: 1fr;
    }
    .chip-popover {
      width: calc(100vw - 22px);
    }
    .chip-popover-item {
      align-items: flex-start;
    }
    .chip-popover-time {
      display: none;
    }
    .digest-panel-close,
    .digest-analyze-btn,
    .digest-copy-btn {
      width: 100%;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .digest-wrap *, .digest-wrap *::before, .digest-wrap *::after {
      animation: none !important;
      transition: none !important;
    }
  }
`;

const cardMotion = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const getSenderColor = (name) => {
  if (!name) return '#3B82F6';
  const colors = ['#3B82F6', '#8B1E3F', '#D4A373', '#8B5CF6', '#2563EB', '#A855F7'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const initials = (name) => (name || '?')
  .split(' ')
  .map((word) => word[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();

const firstSentence = (text, fallback = 'AI is still building context for this item.') => {
  if (!text) return fallback;
  const sentence = text.split('.').find(Boolean);
  return sentence ? `${sentence.trim()}.` : text;
};

const getTimeLabel = (mail) => {
  if (!mail?.date) return '';
  const parsed = new Date(mail.date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const DigestView = ({ mails, aiResults, analyzingIds, analyzeEmail, markEmailAsRead, DeadlineCountdown, isDeadlineExpired, setShowVoiceModal }) => {
  const [sel, setSel] = useState(null);
  const [activeChip, setActiveChip] = useState(null);
  const [fyiExpanded, setFyiExpanded] = useState(false);
  const popoverRef = useRef(null);

  const isEffectivelyUrgent = (mail) => {
    const ai = aiResults[mail.id];
    if (!ai || ai.priority !== 'urgent') return false;
    if (ai.deadline && isDeadlineExpired(ai.deadline, mail.internal_date)) return false;
    return true;
  };

  const urgent = mails.filter((mail) => isEffectivelyUrgent(mail));
  const action = mails.filter((mail) => aiResults[mail.id]?.requires_reply && !isEffectivelyUrgent(mail));
  const briefing = mails.filter((mail) => {
    const ai = aiResults[mail.id];
    if (!ai) return false;
    if (ai.priority === 'urgent' && ai.deadline && isDeadlineExpired(ai.deadline, mail.internal_date)) return true;
    return ai.priority === 'normal' && !ai.requires_reply;
  });
  const fyi = mails.filter((mail) => !aiResults[mail.id] || aiResults[mail.id]?.priority === 'low');

  const hero = urgent[0] || action[0] || briefing[0] || mails[0];
  const secondaryUrgent = urgent.filter((mail) => mail.id !== hero?.id);
  const actionCards = action.filter((mail) => mail.id !== hero?.id);
  const briefingCards = briefing.filter((mail) => mail.id !== hero?.id);
  const heroAi = hero ? aiResults[hero.id] : null;

  const busiestSender = useMemo(() => {
    const counts = new Map();
    mails.forEach((mail) => {
      const key = mail.from_name || mail.from_email || 'Unknown sender';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  }, [mails]);

  const chipGroups = {
    urgent: {
      list: urgent,
      label: 'Urgent',
      fullLabel: 'Urgent Signals',
      color: '#B45365',
      glow: 'rgba(139,30,63,0.26)',
      bg: 'rgba(139,30,63,0.12)',
      icon: AlertTriangle,
    },
    action: {
      list: action,
      label: 'Need Reply',
      fullLabel: 'Reply Queue',
      color: '#D4A373',
      glow: 'rgba(212,163,115,0.23)',
      bg: 'rgba(212,163,115,0.11)',
      icon: MessageSquareReply,
    },
    briefing: {
      list: briefing,
      label: 'Briefings',
      fullLabel: "Today's Briefings",
      color: '#8B5CF6',
      glow: 'rgba(139,92,246,0.2)',
      bg: 'rgba(139,92,246,0.1)',
      icon: BriefcaseBusiness,
    },
    fyi: {
      list: fyi,
      label: 'FYI',
      fullLabel: 'Ambient Inbox Signals',
      color: '#3B82F6',
      glow: 'rgba(59,130,246,0.22)',
      bg: 'rgba(59,130,246,0.1)',
      icon: Sparkles,
    },
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const selMail = sel ? mails.find((mail) => mail.id === sel) : null;
  const selAi = selMail ? aiResults[selMail.id] : null;
  const open = (id) => {
    setSel((prev) => (prev === id ? null : id));
    markEmailAsRead?.(id);
    setActiveChip(null);
  };
  const priorityColor = (priority) => {
    if (priority === 'urgent') return '#B45365';
    if (priority === 'low') return '#3B82F6';
    return '#8B5CF6';
  };

  useEffect(() => {
    if (!activeChip) return undefined;
    const handler = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) setActiveChip(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeChip]);

  const Section = ({ label, color, note, icon: Icon, children }) => (
    <motion.section
      className="digest-section"
      style={{ '--section-color': color }}
      variants={cardMotion}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="digest-sec-head">
        <div className="digest-sec-label">
          {Icon && <Icon size={15} strokeWidth={2.2} />}
          {label}
        </div>
        <div className="digest-sec-rule" />
        {note && <div className="digest-sec-note">{note}</div>}
      </div>
      {children}
    </motion.section>
  );

  const ChipPopover = ({ group }) => {
    const { list, fullLabel, color } = chipGroups[group];
    return (
      <motion.div
        className="chip-popover"
        ref={popoverRef}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.18 }}
      >
        <div className="chip-popover-header">
          <span className="chip-popover-title" style={{ color }}>{fullLabel}</span>
          <span className="chip-popover-count">{list.length} email{list.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="chip-popover-list">
          {list.length === 0 ? (
            <div className="chip-popover-empty">No signals in this category yet.</div>
          ) : (
            list.map((mail) => (
              <div key={mail.id} className="chip-popover-item" onClick={() => open(mail.id)}>
                <div className="chip-popover-avatar" style={{ background: getSenderColor(mail.from_name) }}>
                  {initials(mail.from_name || mail.from_email)}
                </div>
                <div className="chip-popover-info">
                  <div className="chip-popover-sender">{mail.from_name || mail.from_email?.split('@')[0]}</div>
                  <div className="chip-popover-email">{mail.from_email}</div>
                  <div className="chip-popover-subj">{mail.subject}</div>
                </div>
                <div className="chip-popover-time">{getTimeLabel(mail)}</div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    );
  };

  const IntelCard = ({ mail, ai, type, color, icon: Icon }) => (
    <motion.div
      className={`digest-intel-card${sel === mail.id ? ' sel' : ''}`}
      style={{
        '--card-color': color,
        '--card-border': `${color}42`,
        '--card-glow': `${color}22`,
      }}
      variants={cardMotion}
      initial="hidden"
      animate="show"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      onClick={() => open(mail.id)}
    >
      <div className="digest-card-top">
        <span className="digest-card-type">
          <Icon size={14} />
          {type}
        </span>
        <span className="digest-card-sender">{mail.from_name || mail.from_email}</span>
      </div>
      <div className="d-hl">{mail.subject}</div>
      <div className="d-body">{firstSentence(ai?.summary, mail.snippet || 'No preview available.')}</div>
      <div className="d-foot">
        {ai?.deadline && <DeadlineCountdown deadline={ai.deadline} emailDate={mail.internal_date} />}
        {ai?.requires_reply && <span>Reply recommended</span>}
      </div>
    </motion.div>
  );

  return (
    <>
      <style>{DIGEST_CSS}</style>
      <div className="digest-wrap">
        <div className="digest-scroll">
          <div className="digest-shell">
            <motion.header
              className="digest-masthead"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <div>
                <div className="digest-edition">Vol. 1 / Daily Edition / AI Intelligence</div>
                <div className="digest-title">MailPulse <span>Daily</span></div>
                <p className="digest-tagline">
                  Your inbox distilled into an editorial intelligence briefing, ranked by urgency,
                  attention cost, and decision value.
                </p>
              </div>
              <div className="digest-meta-card">
                <div className="digest-meta-label">Current Briefing</div>
                <div className="digest-meta-date">{today}</div>
                <div className="digest-meta-row">
                  <span className="digest-mini-stat"><strong>{mails.length}</strong> dispatches</span>
                  <span className="digest-mini-stat"><strong>{mails.filter((mail) => !mail.is_read).length}</strong> unread</span>
                  <span className="digest-mini-stat"><strong>{urgent.length + action.length}</strong> active</span>
                </div>
              </div>
            </motion.header>

            <motion.section
              className="ai-banner"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <div>
                <div className="ai-kicker"><Brain size={15} /> AI Narration</div>
                <div className="ai-copy">
                  Good evening, Yeshwanth. {urgent.length + action.length} updates need your attention.
                </div>
                <div className="ai-subcopy">
                  {urgent.length} signals are time-sensitive, {action.length} messages need a reply, and your most active sender today is {busiestSender?.[0] || 'still emerging'}.
                </div>
                {setShowVoiceModal && (
                  <button 
                    onClick={() => setShowVoiceModal(true)} 
                    style={{ marginTop: '24px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#F0A500', color: '#0D1117', border: 'none', borderRadius: '999px', padding: '10px 20px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 8px 24px rgba(240, 165, 0, 0.25)' }}
                  >
                    <span>🎙️</span> Generate Voice Note
                  </button>
                )}
              </div>
              <div className="ai-signal-grid">
                <div className="ai-signal"><span className="ai-signal-value">{urgent.length}</span><span className="ai-signal-label">Urgent signals</span></div>
                <div className="ai-signal"><span className="ai-signal-value">{action.length}</span><span className="ai-signal-label">Reply queue</span></div>
                <div className="ai-signal"><span className="ai-signal-value">{briefing.length}</span><span className="ai-signal-label">Briefing notes</span></div>
                <div className="ai-signal"><span className="ai-signal-value">{busiestSender?.[1] || 0}</span><span className="ai-signal-label">Top sender volume</span></div>
              </div>
            </motion.section>

            <div className="digest-stats">
              {Object.entries(chipGroups).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <div key={key} className="digest-chip-wrap">
                    <button
                      type="button"
                      className={`digest-chip${activeChip === key ? ' active' : ''}`}
                      style={{
                        '--chip-color': config.color,
                        '--chip-glow': config.glow,
                        '--chip-bg': config.bg,
                        '--chip-border': `${config.color}34`,
                      }}
                      onClick={() => setActiveChip((prev) => (prev === key ? null : key))}
                    >
                      <span className="digest-chip-icon"><Icon size={14} /></span>
                      <span className="digest-chip-num">{config.list.length}</span>
                      {config.label}
                      <ChevronDown className="digest-chip-arrow" size={14} />
                    </button>
                    <AnimatePresence>{activeChip === key && <ChipPopover group={key} />}</AnimatePresence>
                  </div>
                );
              })}
            </div>

            {hero && (
              <Section label="Featured Intelligence" color="#D4A373" note="Highest-value item selected by AI" icon={Zap}>
                <motion.article
                  className={`digest-hero${sel === hero.id ? ' sel' : ''}`}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => open(hero.id)}
                >
                  <div className="digest-hero-main">
                    <div className="digest-hero-kicker"><Sparkles size={15} /> Hero Briefing</div>
                    <h2 className="digest-hero-hl">{hero.subject}</h2>
                    <p className="digest-hero-summary">
                      {heroAi?.summary || hero.snippet || 'Select this dispatch to generate a deeper AI summary.'}
                    </p>
                    <div className="digest-hero-foot">
                      <span className="digest-review-btn">Review Now <ArrowRight size={15} /></span>
                      {heroAi?.deadline && <DeadlineCountdown deadline={heroAi.deadline} emailDate={hero.internal_date} />}
                      {heroAi?.requires_reply && <span className="digest-mini-stat"><strong>Reply</strong> recommended</span>}
                    </div>
                  </div>
                  <div className="digest-hero-aside">
                    <div className="digest-aside-label">Source</div>
                    <div className="digest-aside-sender">{hero.from_name || hero.from_email}</div>
                    <div className="digest-aside-meta">
                      <span><Clock3 size={13} /> {getTimeLabel(hero) || 'Recent'}</span>
                      <span><Inbox size={13} /> {hero.from_email || 'Inbox dispatch'}</span>
                    </div>
                  </div>
                </motion.article>
              </Section>
            )}

            {(secondaryUrgent.length > 0 || actionCards.length > 0) && (
              <Section label="Decision Queue" color="#B45365" note="Urgent and reply-worthy items" icon={AlertTriangle}>
                <div className="digest-card-grid">
                  {secondaryUrgent.map((mail) => (
                    <IntelCard
                      key={mail.id}
                      mail={mail}
                      ai={aiResults[mail.id]}
                      type="Urgent"
                      color="#B45365"
                      icon={AlertTriangle}
                    />
                  ))}
                  {actionCards.map((mail) => (
                    <IntelCard
                      key={mail.id}
                      mail={mail}
                      ai={aiResults[mail.id]}
                      type="Need Reply"
                      color="#D4A373"
                      icon={MessageSquareReply}
                    />
                  ))}
                </div>
              </Section>
            )}

            <Section label="Secondary Briefings" color="#8B5CF6" note="Context worth knowing" icon={BriefcaseBusiness}>
              {briefingCards.length === 0 ? (
                <div className="digest-empty-state">
                  <Inbox className="digest-empty-icon" size={34} />
                  <div className="digest-empty-title">Nothing here yet</div>
                  <div className="digest-empty-sub">
                    Analyzed emails with normal priority will appear here. Select an email and run AI analysis to build the briefing.
                  </div>
                </div>
              ) : (
                <div className="digest-brief-grid">
                  {briefingCards.map((mail, index) => {
                    const ai = aiResults[mail.id];
                    return (
                      <motion.div
                        key={mail.id}
                        className={`digest-bcard${sel === mail.id ? ' sel' : ''}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.24, delay: Math.min(index * 0.025, 0.18) }}
                        onClick={() => open(mail.id)}
                      >
                        <div className="digest-bcard-avatar" style={{ background: getSenderColor(mail.from_name) }}>
                          {initials(mail.from_name || mail.from_email)}
                        </div>
                        <div className="digest-bcard-body">
                          <div className="digest-bcard-sender">{mail.from_name || mail.from_email?.split('@')[0]}</div>
                          <div className="digest-bcard-subject">{mail.subject}</div>
                          <div className="digest-bcard-summary">{ai?.summary || mail.snippet}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </Section>

            {fyi.length > 0 && (
              <Section label="Ambient Inbox Signals" color="#3B82F6" note="Low-priority, still visible" icon={Sparkles}>
                <div className="digest-fyi-strip">
                  {(fyiExpanded ? fyi : fyi.slice(0, 12)).map((mail) => (
                    <button
                      key={mail.id}
                      type="button"
                      className={`digest-fyi-pill${sel === mail.id ? ' sel' : ''}`}
                      onClick={() => open(mail.id)}
                      title={mail.subject}
                    >
                      <span className="digest-fyi-pill-avatar" style={{ background: getSenderColor(mail.from_name) }}>
                        {initials(mail.from_name || mail.from_email)}
                      </span>
                      <span className="digest-fyi-pill-name">{(mail.from_name || mail.from_email || '').split(' ')[0]}</span>
                    </button>
                  ))}
                  {fyi.length > 12 && (
                    <button type="button" className="digest-fyi-more" onClick={() => setFyiExpanded((prev) => !prev)}>
                      {fyiExpanded ? 'Show less' : `+${fyi.length - 12} more`}
                    </button>
                  )}
                </div>
              </Section>
            )}
          </div>
        </div>

        <AnimatePresence>
          {selMail && (
            <motion.aside
              className={`digest-panel${selMail ? ' active' : ''}`}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 28 }}
              transition={{ duration: 0.24 }}
            >
              <div className="digest-panel-accent" />
              <div className="digest-panel-inner">
                <button className="digest-panel-close" onClick={() => setSel(null)} type="button">
                  <X size={14} /> Close
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="digest-panel-avatar" style={{ background: getSenderColor(selMail.from_name) }}>
                    {initials(selMail.from_name || selMail.from_email)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selMail.from_name || selMail.from_email}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--digest-muted)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selMail.from_email}
                    </div>
                  </div>
                </div>

                <div className="digest-panel-hl">{selMail.subject}</div>
                <div style={{ fontSize: '12px', color: 'var(--digest-muted)', marginBottom: '18px' }}>{selMail.date}</div>

                {selAi?.summary ? (
                  <div className="digest-infobox">
                    <div className="digest-infobox-label" style={{ color: '#D4A373' }}><Sparkles size={13} /> AI Summary</div>
                    <p className="digest-panel-text">{selAi.summary}</p>
                    {selAi.deadline && /\d+\s*(hour|day|minute|week|hr)/i.test(selAi.summary) && (
                      <p style={{ fontSize: '11px', color: 'var(--digest-muted)', opacity: 0.72, margin: '8px 0 0', fontStyle: 'italic' }}>
                        Time in the summary is from the original email. The live countdown below is current.
                      </p>
                    )}
                    {selAi.deadline && (
                      <div style={{ marginTop: '10px' }}>
                        <DeadlineCountdown deadline={selAi.deadline} emailDate={selMail.internal_date} />
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    className="digest-analyze-btn"
                    onClick={() => analyzeEmail(selMail)}
                    disabled={analyzingIds.has(selMail.id)}
                    type="button"
                  >
                    {analyzingIds.has(selMail.id) ? 'Analyzing...' : 'Analyze with AI'}
                  </button>
                )}

                <div className="digest-infobox">
                  <div className="digest-infobox-label" style={{ color: '#3B82F6' }}><Inbox size={13} /> Original Signal</div>
                  <p className="digest-panel-text">{selMail.snippet}</p>
                </div>

                {selAi?.draft_reply && (
                  <div className="digest-infobox">
                    <div className="digest-infobox-label" style={{ color: '#8B5CF6' }}><MessageSquareReply size={13} /> Draft Reply</div>
                    <p className="digest-panel-text" style={{ marginBottom: '12px' }}>{selAi.draft_reply}</p>
                    <button className="digest-copy-btn" onClick={() => navigator.clipboard.writeText(selAi.draft_reply)} type="button">
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                )}

                {selAi?.priority && (
                  <div className="digest-priority-row">
                    <span
                      className="digest-badge"
                      style={{
                        color: priorityColor(selAi.priority),
                        borderColor: `${priorityColor(selAi.priority)}66`,
                        background: `${priorityColor(selAi.priority)}18`,
                      }}
                    >
                      {selAi.priority.toUpperCase()}
                    </span>
                    {selAi.requires_reply && (
                      <span className="digest-badge" style={{ color: '#D4A373', borderColor: '#D4A37366', background: '#D4A37318' }}>
                        REPLY NEEDED
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default DigestView;
