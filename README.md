# 🎙️ MailPulse — Your Inbox, Briefed

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gmail API](https://img.shields.io/badge/Gmail_API-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](https://developers.google.com/gmail/api)

**MailPulse** is an AI-enhanced email dashboard designed to reclaim your morning. It scans your Gmail inbox, identifies urgent tasks, and provides a streamlined interface to manage your priority feed.

> "Your inbox shouldn't run your morning."

---

## ✨ Key Features

- **🎯 Priority Feed:** Automatically ranks emails by urgency (Urgent, ASAP, Deadlines) using keyword detection.
- **🔐 Secure OAuth2 Login:** One-click connection to your Gmail account using Google's secure authentication.
- **🎙️ Morning Briefings (Concept):** A 60-second voice briefing delivered to you (UI Mockup included).
- **✍️ AI-Draft Replies:** Context-aware reply suggestions ready to send with one tap (Planned).
- **🌓 Modern Dark UI:** A high-performance, polished dashboard built with React and inspired by modern developer tools.
- **📱 Responsive Landing:** Beautifully designed entry point with clear value propositions and smooth animations.

---

## 🚀 Tech Stack

### Frontend
- **React 18** (Vite-based)
- **Vanilla CSS** (Custom styling with DM Sans & Instrument Serif)
- **State Management:** React Hooks
- **Authentication:** JWT & Google OAuth2

### Backend
- **FastAPI** (Python 3.10+)
- **Google API Client** (Gmail API)
- **JWT Security** (python-jose)
- **Uvicorn** (ASGI Server)

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Python](https://www.python.org/) (v3.10+)
- A [Google Cloud Project](https://console.cloud.google.com/) with Gmail API enabled.

### 1. Setup Backend
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   Create a `.env` file based on `.env.example`:
   ```env
   GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_secret
   REDIRECT_URI=http://localhost:8000/auth/callback
   FRONTEND_URL=http://localhost:5173
   SECRET_KEY=your_random_secret_key
   ```
5. Run the server:
   ```bash
   python main.py
   ```

### 2. Setup Frontend
1. Return to the root directory and install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## 🗺️ Roadmap
- [ ] **AI Integration:** Move from keyword-based urgency to LLM-based intent analysis.
- [ ] **Voice Briefings:** Implement Text-to-Speech for generating audio briefings.
- [ ] **WhatsApp Integration:** Automated delivery of briefings via WhatsApp API.
- [ ] **Drafting System:** Full implementation of AI-generated email replies.
- [ ] **Multi-account Support:** Manage multiple Gmail accounts in one dashboard.

---

## 🔒 Privacy & Security
MailPulse uses **read-only access** to your Gmail account. We do not store your emails on our servers; data is fetched in real-time and cached locally in your browser for performance. Authentication is handled via secure JWT tokens.

---

## 📄 License
This project is private and for educational purposes. See `package.json` for versioning details.

---
*Built for people who get too many emails.*
