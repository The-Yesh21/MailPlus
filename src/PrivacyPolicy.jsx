import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div style={{
      backgroundColor: '#0D1117',
      color: '#E6EDF3',
      fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      minHeight: '100vh',
      padding: '40px 20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '700px',
        margin: '0 auto'
      }}>
        {/* Back to Home Link */}
        <div style={{ marginBottom: '32px' }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/';
            }}
            style={{
              color: '#F0A500',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            ← Back to home
          </a>
        </div>

        {/* Title & Subtitle */}
        <h1 style={{
          fontFamily: '"Instrument Serif", Georgia, serif',
          fontSize: '32px',
          fontWeight: 'normal',
          color: '#F0A500',
          margin: '0 0 8px 0'
        }}>
          Privacy Policy
        </h1>
        <p style={{
          fontSize: '13px',
          color: '#8B949E',
          margin: '0 0 40px 0'
        }}>
          Last updated: June 2026
        </p>

        {/* Sections */}
        {[
          {
            title: "1. Overview",
            content: "MailPulse is an AI email assistant that helps you prioritize and respond to emails faster. This policy explains what data we access and how we protect it."
          },
          {
            title: "2. What we access",
            content: "With your permission, MailPulse connects to your Gmail account using read-only access (gmail.readonly scope). We can view your email messages but cannot send, delete, or modify anything in your Gmail account."
          },
          {
            title: "3. What we store",
            content: "We do NOT store your email content. We only store AI-generated metadata linked to each email's unique Gmail message ID: priority level, a short summary, suggested reply draft, and deadline information if detected. This data is stored securely in Firebase Firestore under your account."
          },
          {
            title: "4. How AI processing works",
            content: "Email content is sent to third-party AI providers (Groq) for analysis in real-time. This content is not stored by these providers beyond the processing request. Only the AI-generated output (summaries, priority labels) is saved to our database."
          },
          {
            title: "5. Voice briefings",
            content: "If you use the voice briefing feature, a short audio script is generated from your email summaries. This audio is generated on-demand and not permanently stored on our servers."
          },
          {
            title: "6. Data deletion",
            content: "You can delete all your stored AI data at any time by signing out and contacting us at the email below. Disconnecting Gmail access via your Google Account settings immediately revokes our access."
          },
          {
            title: "7. Third-party services",
            content: "We use Google OAuth for authentication, Groq for AI text processing, and Firebase for data storage. Each of these services has their own privacy policies."
          },
          {
            title: "8. Contact us",
            content: (
              <>
                For privacy questions or data deletion requests, email:{' '}
                <a href="mailto:yeshwanth9750@gmail.com" style={{ color: '#F0A500', textDecoration: 'none' }}>
                  yeshwanth9750@gmail.com
                </a>
              </>
            )
          }
        ].map((section, idx) => (
          <div key={idx} style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#E6EDF3',
              margin: '0 0 10px 0'
            }}>
              {section.title}
            </h2>
            <div style={{
              fontSize: '14px',
              lineHeight: '1.7',
              color: '#8B949E'
            }}>
              {section.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrivacyPolicy;
