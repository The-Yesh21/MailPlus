const fs = require('fs');

const filepath = 'c:\\Users\\Yeshwanth\\OneDrive\\Desktop\\Fantacy\\mini-project\\email\\App.jsx';
let content = fs.readFileSync(filepath, 'utf8');

const badString = `const selectedMail = Array.isArray(mails) ? mails.find(m => m.id === selectedMailId) : null;
            --bg: #050505;`;

const goodString = `const selectedMail = Array.isArray(mails) ? mails.find(m => m.id === selectedMailId) : null;

  if (!authChecked) return null;
  if (!user) return <Landing onLogin={handleLogin} />;

  return (
    <ErrorBoundary>
      <div className="app-container">
        {/* Mobile Header */}
        <div className="mobile-header">
          <div className="mobile-header-title">MailPulse</div>
          <button className="hamburger" onClick={() => setMobileSidebarOpen(true)}>☰</button>
        </div>
        <div className={\`mobile-overlay \${mobileSidebarOpen ? 'show' : ''}\`} onClick={() => setMobileSidebarOpen(false)}></div>
        <style>{\`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #050505;`;

content = content.replace(badString, goodString);
fs.writeFileSync(filepath, content);
console.log('Fixed App.jsx');
