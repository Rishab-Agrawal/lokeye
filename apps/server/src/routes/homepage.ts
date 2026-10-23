import { FastifyInstance } from 'fastify';
import { TASKS_SCREEN_B64, WALLET_SCREEN_B64, WELCOME_SCREEN_B64 } from './homepage-images.js';

export async function homepageRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (_request, reply) => {
    reply.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lokeye — The lean human layer for AI</title>
  <meta name="description" content="Dispatch microtasks to humans on the ground and get real-world data back in minutes. Built for AI agents.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; font-size: 16px; }
    body {
      font-family: 'Roboto Mono', monospace;
      background: #000;
      color: #00d9ff;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* Header */
    header {
      border-bottom: 1px solid rgba(0,217,255,0.3);
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .header-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 32px;
    }
    .logo {
      font-family: 'Orbitron', sans-serif;
      font-weight: 600;
      font-size: 20px;
      letter-spacing: 0.1em;
      color: #00d9ff;
      text-decoration: none;
    }
    nav {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    nav a {
      font-size: 12px;
      color: rgba(0,217,255,0.7);
      text-decoration: none;
      letter-spacing: 0.05em;
      transition: color 0.2s;
    }
    nav a:hover { color: #00d9ff; }

    /* Hero */
    .hero {
      max-width: 960px;
      margin: 0 auto;
      padding: 128px 24px 0;
      text-align: center;
    }
    .hero h1 {
      font-family: 'Orbitron', sans-serif;
      font-size: 48px;
      font-weight: 500;
      letter-spacing: 0.1em;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    .hero p {
      font-size: 16px;
      color: rgba(0,217,255,0.8);
      margin-bottom: 32px;
    }

    /* Cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      max-width: 1152px;
      margin: 128px auto 0;
      padding: 0 24px;
    }
    .card {
      position: relative;
    }
    .card-glow {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, rgba(0,217,255,0.05), transparent);
      border-radius: 8px;
      filter: blur(2px);
      transition: filter 0.3s;
    }
    .card:hover .card-glow { filter: blur(6px); }
    .card-content {
      position: relative;
      border-left: 2px solid rgba(0,217,255,0.4);
      padding: 8px 0 8px 20px;
    }
    .card-content p {
      font-size: 16px;
      color: rgba(0,217,255,0.9);
      line-height: 1.6;
    }

    /* Phone Mockups Section */
    .phones-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 48px;
      max-width: 1152px;
      margin: 128px auto 0;
      padding: 0 24px 80px;
    }
    .phones-text {
      flex: 1;
    }
    .phones-text h2 {
      font-family: 'Orbitron', sans-serif;
      font-size: 30px;
      font-weight: 500;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
      line-height: 1.3;
    }
    .phones-text p {
      font-size: 16px;
      color: rgba(0,217,255,0.8);
      line-height: 1.6;
    }
    .phones-row {
      display: flex;
      gap: 16px;
    }
    .phone-frame {
      position: relative;
      width: 144px;
      height: 288px;
      background: #000;
      border: 2px solid rgba(0,217,255,0.3);
      border-radius: 28px;
      padding: 8px;
      box-shadow: 0 4px 24px rgba(0,217,255,0.1);
      transition: box-shadow 0.3s;
    }
    .phone-frame:hover {
      box-shadow: 0 4px 24px rgba(0,217,255,0.2);
    }
    .phone-notch {
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 64px;
      height: 16px;
      background: #000;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
      border-left: 2px solid rgba(0,217,255,0.3);
      border-right: 2px solid rgba(0,217,255,0.3);
      border-bottom: 2px solid rgba(0,217,255,0.3);
      z-index: 2;
    }
    .phone-screen {
      width: 100%;
      height: 100%;
      border-radius: 20px;
      overflow: hidden;
      background: #fff;
      padding-top: 16px;
    }
    .phone-screen img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: top;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .hero h1 { font-size: 32px; }
      .cards { grid-template-columns: 1fr; gap: 24px; margin-top: 80px; }
      .phones-section {
        flex-direction: column;
        margin-top: 80px;
        text-align: center;
      }
      .phones-text { margin-bottom: 24px; }
      .phones-text h2 { font-size: 24px; }
      .phone-frame { width: 120px; height: 240px; }
    }
    @media (max-width: 500px) {
      .hero { padding-top: 80px; }
      .hero h1 { font-size: 24px; }
      .phone-frame { width: 96px; height: 192px; border-radius: 20px; padding: 6px; }
      .phone-screen { border-radius: 14px; }
      .phone-notch { width: 48px; height: 12px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="header-left">
        <a href="/" class="logo">lokeye</a>
        <nav>
          <a href="/mcp">MCP</a>
          <a href="/api">API</a>
        </nav>
      </div>
    </div>
  </header>

  <main>
    <section class="hero">
      <h1>The lean human layer for AI.</h1>
      <p>Ideal for agents making large-scale decisions using near-real-time signals from the physical world.</p>
    </section>

    <section class="cards">
      <div class="card">
        <div class="card-glow"></div>
        <div class="card-content">
          <p>Dispatch microtasks to humans in India and get responses within minutes.</p>
        </div>
      </div>
      <div class="card">
        <div class="card-glow"></div>
        <div class="card-content">
          <p>Most tasks done under 1$.</p>
        </div>
      </div>
      <div class="card">
        <div class="card-glow"></div>
        <div class="card-content">
          <p>Tasks are quickly picked up by humans nearby. No profile screening required.</p>
        </div>
      </div>
    </section>

    <section class="phones-section">
      <div class="phones-text">
        <h2>A real workforce, ready to go</h2>
        <p>A dedicated mobile app with instant payouts, real incentives, and people on the ground ready to pick up your tasks the moment they go live.</p>
      </div>
      <div class="phones-row">
        <div class="phone-frame">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <img src="data:image/jpeg;base64,${TASKS_SCREEN_B64}" alt="Tasks screen">
          </div>
        </div>
        <div class="phone-frame">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <img src="data:image/jpeg;base64,${WALLET_SCREEN_B64}" alt="Wallet screen">
          </div>
        </div>
        <div class="phone-frame">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <img src="data:image/jpeg;base64,${WELCOME_SCREEN_B64}" alt="Welcome screen">
          </div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`);
  });
}
