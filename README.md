# 🌊 FloodGate

<p align="center">
  <img src="public/logo.png" alt="FloodGate Banner" width="400" />
</p>

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-ISC-blue.svg" alt="License"></a>
  <a href="https://github.com/RhazeCoder/floodgate"><img src="https://img.shields.io/badge/Version-2.0.0-orange.svg" alt="Version"></a>
</p>

<p align="center">
  <strong>🔥 High-Performance Network Automation & Load Testing System</strong>
</p>

---

> [!CAUTION]
> **Educational Purposes Only**
> This project demonstrates advanced network automation, load testing, proxy rotation, and real-time dashboard telemetry. Do **not** use it for harassment, spamming, DoS/DDoS, or any illegal activity. The author and contributors are **not** responsible for any misuse.

## 🚀 Overview

**FloodGate** is a cutting-edge automation orchestrator built heavily over Node.js. It features a microservice-style architecture, a real-time WebSocket dashboard, advanced multi-protocol proxy rotation, and high-precision load simulation capabilities.

V2.0 has been entirely rewritten from the ground up to focus on ultimate performance, zero-downtime stability, and a premium _Glassmorphism_ User Interface for telemetry tracking.

## ✨ Key Features

- **🎯 High-Precision Traffic Generation** — Control exact RPS (Requests-Per-Second) spanning 1 to 500+, featuring newly refined and threaded timing logic.
- **🔄 Smart Proxy Rotation** — Automatic health checks, concurrent rotations for residential proxies, and instant zero-downtime failover handling.
- **⚡ Live Web Dashboard** — WebSocket-powered UI updates real-time analytics instantaneously (no manual refreshing needed).
- **📊 Real-Time Bandwidth Monitor** — Per-session and total bandwidth tracking visually mapped onto dynamic interactive charts.
- **💾 Unlimited Data Storage** — Modern MongoDB-backed backend seamlessly stores system data, enabling highly responsive searches, filters, and paginations.
- **💅 Premium UI/UX** — Modern SaaS dark theme with stunning glassmorphism cards, micro-animations, and smooth web-transitions.
- **🔌 Extensible Plugin System** — Developer-friendly base. Easily inject custom payload modules into the `services/` ecosystem.

---

## 💻 Tech Stack

- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB / Mongoose
- **Frontend** Vanilla JS, Canvas Graphs, CSS Micro-animations
- **Network Tools:** Axios, https-proxy-agent, Puppeteer
- **Testing Capabilities:** Jest, Supertest

---

## 🛠️ Installation

### Prerequisites
- Node.js `v18+` (Strictly required for experimental ES modules)
- MongoDB Database (Local instance or Remote Atlas URI)
- Git CLI

### Quick Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/RhazeCoder/floodgate.git
   cd floodgate
   ```

2. **Install all dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the project's root directory:
   ```env
   # Application Port
   PORT=3000

   # Database Connection String
   MONGODB_URI=mongodb://127.0.0.1:27017/floodgate

   # Admin Authentication
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your_secure_password
   ```

   > [!IMPORTANT]  
   > **DO NOT** commit your `.env` file. Keep your database credentials safe.

4. **Launch the Application:**
   - **On Windows:** Simply double-click `Launcher.bat` for the built-in quick GUI Launcher which provides easy Start/Stop controls.
   - **Manual Start:** 
     ```bash
     npm start
     ```
   
   - **For Developers:**
     ```bash
     npm run dev
     ```

5. **Open the Dashboard:**
   Navigate to `http://localhost:3000` via your web browser to view the interface.

---

## 📸 Dashboard Preview

![FloodGate Dashboard](screenshots/dashboard.png)
*View real-time attack telemetry, worker statuses, bandwidth saturation, and proxy rotations.*

---

## 🤝 Contributing

We heartily welcome open-source contributions!
1. Fork the project.
2. Create your targeted feature branch (`git checkout -b feature/AmazingMechanism`).
3. Commit your meaningful changes (`git commit -m 'Added groundbreaking feature'`).
4. Push to the branch (`git push origin feature/AmazingMechanism`).
5. Draft a thorough Pull Request detailing your changes.

Please review the standard `CONTRIBUTING.md` file for full layout guidelines, ES module coding standards, and rigorous testing procedures.

---

## 🛡️ License & Legal

Distributed freely under the **ISC License**. Refer to `LICENSE` for more profound insights.

> [!WARNING]
> By cloning, modifying, interacting with, testing, or executing this code, you explicitly acknowledge it is provided purely 'AS IS'. You assume absolutely all responsibility for any damage or legal liability. 

---
<p align="center">Made with ❤️ based on FloodGate Core systems.</p>
