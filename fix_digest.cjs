const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\src\\DigestView.jsx';
let content = fs.readFileSync(filepath, 'utf8');

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

if (!content.includes('@media (max-width: 768px)')) {
    content = content.replace('  .digest-panel-close {', mobileCss + '\n  .digest-panel-close {');
}

content = content.replace('<div className="digest-panel">', '<div className={`digest-panel ${selMail ? "active" : ""}`}>');

fs.writeFileSync(filepath, content);
console.log('Fixed DigestView.jsx');
