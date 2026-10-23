import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TASK_TYPES, VIDEO_MEDIA_TTL_MS, PHOTO_MEDIA_TTL_MS } from '@lokeye/shared';
import { sendInterestSignup } from '../services/telegram.js';

const photoTtlMin = Math.round(PHOTO_MEDIA_TTL_MS / 60000);
const videoTtlMin = Math.round(VIDEO_MEDIA_TTL_MS / 60000);
const BASE = () => process.env.PUBLIC_URL || 'http://localhost:3000';

// ─── Shared styles & layout ───────────────────────────────────

const CSS = `
:root {
  --bg: #0a0a0b;
  --surface: #141416;
  --surface2: #1c1c1f;
  --border: #27272a;
  --border-subtle: #1e1e21;
  --text: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent: #22d3ee;
  --accent-dim: rgba(34, 211, 238, 0.12);
  --green: #4ade80;
  --green-dim: rgba(74, 222, 128, 0.12);
  --amber: #fbbf24;
  --amber-dim: rgba(251, 191, 36, 0.12);
  --red: #f87171;
  --red-dim: rgba(248, 113, 113, 0.12);
  --purple: #a78bfa;
  --purple-dim: rgba(167, 139, 250, 0.12);
  --blue: #60a5fa;
  --blue-dim: rgba(96, 165, 250, 0.12);
  --mono: ui-monospace, 'Cascadia Code', 'Fira Code', Consolas, monospace;
  --sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  --radius: 10px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* layout */
.page { max-width: 1080px; margin: 0 auto; padding: 0 24px 80px; }

/* nav */
.nav {
  position: sticky; top: 0; z-index: 50;
  border-bottom: 1px solid rgba(34, 211, 238, 0.3);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.nav-inner {
  max-width: 80rem; margin: 0 auto;
  padding: 1rem 1.5rem;
  display: flex; align-items: center; justify-content: space-between;
}
.nav-left {
  display: flex; align-items: center; gap: 2rem;
}
.nav-brand {
  font-family: 'Roboto Mono', monospace;
  font-weight: 600; font-size: 1.25rem; color: #00d9ff;
  text-decoration: none; letter-spacing: 0.05em;
}
.nav-links { display: flex; gap: 1.5rem; }
.nav-links a {
  font-family: 'Roboto Mono', monospace;
  color: rgba(103, 232, 249, 0.7); text-decoration: none;
  font-size: 0.75rem; letter-spacing: 0.025em;
  transition: color 0.15s;
}
.nav-links a:hover, .nav-links a.active {
  color: #22d3ee;
}
.nav-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 2rem; padding: 0 0.75rem; border-radius: 0.375rem;
  background: #00d9ff; color: #000; border: none; cursor: pointer;
  font-family: 'Roboto Mono', monospace; font-size: 0.75rem;
  font-weight: 500; letter-spacing: 0.025em; white-space: nowrap;
  transition: background-color 0.15s;
}
.nav-btn:hover { background: rgba(0, 217, 255, 0.9); }

/* hero */
.hero { padding: 64px 0 48px; }
.hero-badge {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--accent);
  background: var(--accent-dim); padding: 4px 12px;
  border-radius: 20px; margin-bottom: 16px;
}
.hero h1 {
  font-size: 40px; font-weight: 800; letter-spacing: -1.5px;
  line-height: 1.1; margin-bottom: 16px;
  background: linear-gradient(135deg, var(--text), var(--text-secondary));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.hero p { font-size: 17px; color: var(--text-secondary); max-width: 900px; line-height: 1.7; }

/* section */
.section { margin-top: 56px; }
.section-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text-muted); margin-bottom: 8px;
}
.section-title {
  font-size: 24px; font-weight: 700; letter-spacing: -0.5px;
  margin-bottom: 8px;
}
.section-desc {
  font-size: 15px; color: var(--text-secondary); margin-bottom: 24px;
  max-width: 640px;
}

/* cards */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 24px;
  margin-bottom: 16px;
}
.card-header {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 16px;
}
.card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.card-icon.cyan { background: var(--accent-dim); color: var(--accent); }
.card-icon.green { background: var(--green-dim); color: var(--green); }
.card-icon.amber { background: var(--amber-dim); color: var(--amber); }
.card-icon.purple { background: var(--purple-dim); color: var(--purple); }
.card-icon.blue { background: var(--blue-dim); color: var(--blue); }
.card-icon.red { background: var(--red-dim); color: var(--red); }
.card h3 { font-size: 16px; font-weight: 600; }
.card p { font-size: 14px; color: var(--text-secondary); margin-top: 8px; }

/* steps */
.steps { counter-reset: step; }
.step {
  position: relative; padding-left: 48px; margin-bottom: 32px;
}
.step::before {
  counter-increment: step;
  content: counter(step);
  position: absolute; left: 0; top: 0;
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--surface2); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: var(--text-secondary);
}
.step h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
.step p { font-size: 14px; color: var(--text-secondary); }

/* code blocks */
pre {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; padding: 16px 18px;
  overflow-x: auto; font-family: var(--mono);
  font-size: 13px; line-height: 1.7; color: var(--text-secondary);
  margin-top: 12px;
}
pre .cmt { color: var(--text-muted); }
pre .str { color: var(--green); }
pre .key { color: var(--accent); }
pre .num { color: var(--amber); }
code {
  font-family: var(--mono); font-size: 13px;
  background: var(--surface2); padding: 2px 6px;
  border-radius: 4px; color: var(--accent);
}

/* copy button */
.code-wrap { position: relative; margin-top: 12px; }
.code-wrap pre { margin-top: 0; }
.copy-btn {
  position: absolute; top: 8px; right: 10px;
  background: var(--surface); border: 1px solid var(--border);
  color: var(--text-muted); font-size: 11px; font-weight: 500;
  padding: 3px 10px; border-radius: 4px; cursor: pointer;
  font-family: var(--sans); opacity: 0; line-height: 1.6;
  transition: all 0.15s; user-select: none;
}
.code-wrap:hover .copy-btn { opacity: 1; }
.copy-btn.copied { color: var(--green); border-color: rgba(74,222,128,0.4); }

/* OS tabs */
.code-tabs { margin-top: 12px; }
.tab-buttons { display: flex; }
.tab-btn {
  background: var(--surface); border: 1px solid var(--border);
  border-bottom: none; color: var(--text-muted); font-size: 11px;
  font-weight: 600; letter-spacing: 0.3px; padding: 5px 14px;
  cursor: pointer; border-radius: 6px 6px 0 0; font-family: var(--sans);
  transition: color 0.15s;
}
.tab-btn + .tab-btn { margin-left: 4px; }
.tab-btn.active { background: var(--surface2); color: var(--text); }
.tab-pane { display: none; }
.tab-pane.active { display: block; }
.tab-pane .code-wrap { margin-top: 0; }
.tab-pane .code-wrap pre { margin-top: 0; border-radius: 0 8px 8px 8px; }

/* endpoint rows */
.endpoint {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); margin-bottom: 12px;
  overflow: hidden;
}
.endpoint-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; cursor: pointer;
  transition: background 0.15s;
}
.endpoint-header:hover { background: var(--surface2); }
.method-badge {
  font-family: var(--mono); font-size: 11px; font-weight: 700;
  text-transform: uppercase; padding: 3px 8px;
  border-radius: 4px; letter-spacing: 0.3px;
  flex-shrink: 0;
}
.method-badge.get { background: var(--blue-dim); color: var(--blue); }
.method-badge.post { background: var(--green-dim); color: var(--green); }
.method-badge.put { background: var(--amber-dim); color: var(--amber); }
.method-badge.delete { background: var(--red-dim); color: var(--red); }
.endpoint-path {
  font-family: var(--mono); font-size: 13px; color: var(--text);
  flex: 1;
}
.endpoint-desc {
  font-size: 13px; color: var(--text-muted);
  display: none;
}
.endpoint-body {
  display: none; padding: 0 18px 18px;
  border-top: 1px solid var(--border);
}
.endpoint.open .endpoint-body { display: block; padding-top: 18px; }
.endpoint.open .endpoint-desc { display: inline; }
.endpoint-toggle {
  color: var(--text-muted); font-size: 12px; transition: transform 0.15s;
}
.endpoint.open .endpoint-toggle { transform: rotate(180deg); }

/* params table */
.param-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
.param-table th {
  text-align: left; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--text-muted); padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.param-table td {
  padding: 10px 0; font-size: 13px; border-bottom: 1px solid var(--border-subtle);
  vertical-align: top;
}
.param-table td:first-child { font-family: var(--mono); color: var(--accent); width: 160px; }
.param-table td:nth-child(2) { color: var(--text-muted); width: 100px; }
.param-table td:last-child { color: var(--text-secondary); }
.param-req { color: var(--red); font-size: 10px; font-weight: 600; margin-left: 4px; }

/* tool card (MCP) */
.tool-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 20px;
  margin-bottom: 12px;
}
.tool-name {
  font-family: var(--mono); font-size: 14px; font-weight: 600;
  color: var(--accent); margin-bottom: 6px;
}
.tool-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
.tool-params { margin-top: 12px; }
.tool-param {
  display: flex; gap: 12px; padding: 6px 0; font-size: 13px;
  border-bottom: 1px solid var(--border-subtle);
}
.tool-param:last-child { border-bottom: none; }
.tool-param-name { font-family: var(--mono); color: var(--accent); min-width: 120px; }
.tool-param-info { color: var(--text-secondary); }

/* flow diagram */
.flow {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap; padding: 20px 0;
}
.flow-node {
  padding: 8px 16px; border-radius: 6px; font-size: 13px;
  font-weight: 600; white-space: nowrap;
}
.flow-arrow { color: var(--text-muted); font-size: 18px; }
.flow-node.pending { background: var(--blue-dim); color: var(--blue); }
.flow-node.assigned { background: var(--purple-dim); color: var(--purple); }
.flow-node.progress { background: var(--amber-dim); color: var(--amber); }
.flow-node.submitted { background: var(--accent-dim); color: var(--accent); }
.flow-node.completed { background: var(--green-dim); color: var(--green); }
.flow-node.rejected { background: var(--red-dim); color: var(--red); }

/* info box */
.info-box {
  border-radius: 8px; padding: 14px 16px;
  font-size: 13px; line-height: 1.6;
  margin-top: 12px;
  display: flex; gap: 10px;
}
.info-box.warn { background: var(--amber-dim); color: var(--amber); border: 1px solid rgba(251, 191, 36, 0.2); }
.info-box.info { background: var(--blue-dim); color: var(--blue); border: 1px solid rgba(96, 165, 250, 0.2); }
.info-box.tip { background: var(--green-dim); color: var(--green); border: 1px solid rgba(74, 222, 128, 0.2); }

/* grid */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 700px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .hero h1 { font-size: 28px; }
  .endpoint-desc { display: none !important; }
}

/* footer */
.footer {
  margin-top: 80px; padding: 24px 0;
  border-top: 1px solid var(--border);
  font-size: 13px; color: var(--text-muted);
  text-align: center;
}
`;

const JS = `
document.querySelectorAll('.endpoint-header').forEach(h => {
  h.addEventListener('click', () => {
    h.closest('.endpoint').classList.toggle('open');
  });
});
document.querySelectorAll('.copy-btn').forEach(btn => {
  const pre = btn.closest('.code-wrap').querySelector('pre');
  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(pre.innerText.trim()).then(() => {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    }).catch(() => {});
  });
});
document.querySelectorAll('.code-tabs').forEach(tabs => {
  tabs.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      tabs.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = tabs.querySelector('.tab-pane[data-tab="' + tab + '"]');
      if (pane) pane.classList.add('active');
    });
  });
});
`;

function notifyModal() {
  return `
<div id="notify-modal" style="display:none;position:fixed;inset:0;z-index:100;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);">
  <div style="background:#0a0a0a;border:1px solid rgba(34,211,238,0.3);border-radius:0.5rem;padding:2rem;max-width:400px;width:90%;position:relative;">
    <button onclick="document.getElementById('notify-modal').style.display='none'" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:rgba(103,232,249,0.7);font-size:1.25rem;cursor:pointer;font-family:'Roboto Mono',monospace;line-height:1;">&times;</button>
    <h3 style="font-family:'Orbitron',sans-serif;font-size:1.125rem;color:#00d9ff;margin-bottom:0.5rem;letter-spacing:0.05em;">get notified</h3>
    <p style="font-family:'Roboto Mono',monospace;font-size:0.75rem;color:rgba(103,232,249,0.7);margin-bottom:1.5rem;">Be the first to know when we launch.</p>
    <form id="notify-form" style="display:flex;flex-direction:column;gap:0.75rem;">
      <input name="name" type="text" placeholder="Name" required style="font-family:'Roboto Mono',monospace;font-size:0.875rem;background:#111;border:1px solid rgba(34,211,238,0.3);border-radius:0.375rem;padding:0.5rem 0.75rem;color:#00d9ff;outline:none;" />
      <input name="email" type="email" placeholder="Email" required style="font-family:'Roboto Mono',monospace;font-size:0.875rem;background:#111;border:1px solid rgba(34,211,238,0.3);border-radius:0.375rem;padding:0.5rem 0.75rem;color:#00d9ff;outline:none;" />
      <div style="position:absolute;left:-9999px;"><input name="website" type="text" tabindex="-1" autocomplete="off" /></div>
      <input name="t" type="hidden" value="" />
      <button type="submit" style="font-family:'Roboto Mono',monospace;font-size:0.875rem;font-weight:500;background:#00d9ff;color:#000;border:none;border-radius:0.375rem;padding:0.625rem;cursor:pointer;letter-spacing:0.025em;transition:background 0.15s;">SUBMIT</button>
    </form>
    <p id="notify-thanks" style="display:none;font-family:'Roboto Mono',monospace;font-size:0.875rem;color:#00d9ff;text-align:center;padding:1rem 0;">Thanks for registering your interest!</p>
  </div>
</div>
<script>
document.querySelectorAll('.nav-btn, .btn-lg').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var modal = document.getElementById('notify-modal');
    modal.style.display = 'flex';
    modal.querySelector('input[name="t"]').value = String(Date.now());
  });
});
document.getElementById('notify-modal').addEventListener('click', function(e) {
  if (e.target === this) this.style.display = 'none';
});
document.getElementById('notify-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var form = this;
  var btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'SUBMITTING...';
  fetch('/api/v1/interest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: form.name.value, email: form.email.value, website: form.website.value, t: form.t.value })
  }).then(function(r) {
    if (!r.ok) throw new Error();
    return r.json();
  }).then(function() {
    form.style.display = 'none';
    document.getElementById('notify-thanks').style.display = 'block';
  }).catch(function() {
    btn.disabled = false;
    btn.textContent = 'SUBMIT';
    alert('Something went wrong. Please try again.');
  });
});
</script>`;
}

function nav(active: 'api' | 'mcp' | 'quickstart') {
  return `
<nav class="nav">
  <div class="nav-inner">
    <div class="nav-left">
      <a class="nav-brand" href="/">lokeye</a>
      <div class="nav-links">
        <a href="/quickstart" class="${active === 'quickstart' ? 'active' : ''}">QUICKSTART</a>
        <a href="/mcp" class="${active === 'mcp' ? 'active' : ''}">MCP</a>
        <a href="/api" class="${active === 'api' ? 'active' : ''}">API</a>
      </div>
    </div>
  </div>
</nav>`;
}

function shell(title: string, active: 'api' | 'mcp' | 'quickstart', body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lokeye | ${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
${nav(active)}
<div class="page">
${body}
</div>
<script>${JS}</script>
${notifyModal()}
</body>
</html>`;
}

// ─── Code block helpers ───────────────────────────────────────

/** Wraps a <pre> block with a copy button */
function codeWrap(code: string): string {
  return `<div class="code-wrap"><pre>${code}</pre><button class="copy-btn">Copy</button></div>`;
}

/** OS tab block for shell commands that differ between Unix and Windows */
function shellTabs(unix: string, win: string): string {
  return `<div class="code-tabs">
  <div class="tab-buttons">
    <button class="tab-btn active" data-tab="unix">macOS / Linux</button>
    <button class="tab-btn" data-tab="win">Windows</button>
  </div>
  <div class="tab-pane active" data-tab="unix"><div class="code-wrap"><pre>${unix}</pre><button class="copy-btn">Copy</button></div></div>
  <div class="tab-pane" data-tab="win"><div class="code-wrap"><pre>${win}</pre><button class="copy-btn">Copy</button></div></div>
</div>`;
}

// ─── Endpoint helper ──────────────────────────────────────────

function endpoint(
  method: string,
  path: string,
  summary: string,
  detail: string,
  params?: { name: string; type: string; desc: string; required?: boolean }[],
  exampleHtml?: string,
) {
  const m = method.toLowerCase();
  const paramsHtml = params?.length
    ? `<table class="param-table">
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        ${params.map(p => `<tr>
          <td>${p.name}${p.required ? '<span class="param-req">required</span>' : ''}</td>
          <td>${p.type}</td>
          <td>${p.desc}</td>
        </tr>`).join('')}
      </table>`
    : '';
  return `
<div class="endpoint">
  <div class="endpoint-header">
    <span class="method-badge ${m}">${method}</span>
    <span class="endpoint-path">${path}</span>
    <span class="endpoint-desc">${summary}</span>
    <span class="endpoint-toggle">&#9660;</span>
  </div>
  <div class="endpoint-body">
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;">${detail}</p>
    ${paramsHtml}
    ${exampleHtml ?? ''}
  </div>
</div>`;
}

// ─── API docs page ────────────────────────────────────────────

function apiDocsPage() {
  const base = BASE();

  return shell('api', 'api', `

<!-- Hero -->
<div class="hero">
  <h1>API Reference</h1>
  <p>Dispatch microtasks affordably to humans in India and get real-world photo &amp; video data within minutes as human availability increases. Use this page when you want endpoint-level control outside MCP clients.</p>
</div>

<!-- Getting started -->
<div class="section">
  <div class="section-label">Getting Started</div>
  <div class="section-title">Start collecting real-world data in 3 steps</div>

  <div class="steps">
    <div class="step">
      <h3>Register your agent</h3>
      <p>Create an agent account — no approval needed. Save the API key, it's only shown once.</p>
      ${shellTabs(
        `<span class="cmt"># Register and get your API key</span>
curl -X POST <span class="str">'${base}/api/v1/agents/register'</span> \\
  -H <span class="str">'Content-Type: application/json'</span> \\
  -d <span class="str">'{"name":"My Agent","email":"dev@example.com","country":"India"}'</span>`,
        `curl -X POST "${base}/api/v1/agents/register" -H "Content-Type: application/json" -d "{\\"name\\":\\"My Agent\\",\\"email\\":\\"dev@example.com\\",\\"country\\":\\"India\\"}"`,
      )}
    </div>

    <div class="step">
      <h3>Add credits</h3>
      <p>Request a credit top-up via the API. You'll be contacted at your registered email with payment details. Credits are in rupees.</p>
      ${shellTabs(
        `<span class="cmt"># Request &#8377;5,000 in credits</span>
curl -X POST <span class="str">'${base}/api/v1/agent/credits/request'</span> \\
  -H <span class="str">'X-API-Key: YOUR_API_KEY'</span> \\
  -H <span class="str">'Content-Type: application/json'</span> \\
  -d <span class="str">'{"amount_rupees": 5000}'</span>`,
        `curl -X POST "${base}/api/v1/agent/credits/request" -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d "{\\"amount_rupees\\": 5000}"`,
      )}
    </div>

    <div class="step">
      <h3>Create your first task</h3>
      <p>Dispatch a photo or video task to humans near any location. The bounty is held from your credits until the task is completed or cancelled.</p>
      ${shellTabs(
        `<span class="cmt"># Create a photo task near coordinates</span>
curl -X POST <span class="str">'${base}/api/v1/agent/tasks'</span> \\
  -H <span class="str">'X-API-Key: YOUR_API_KEY'</span> \\
  -H <span class="str">'Content-Type: application/json'</span> \\
  -d <span class="str">'{
  "type": "photo",
  "title": "Phoenix Mall Entrance",
  "description": "Capture the main entrance showing the store name sign",
  "latitude": 17.4512,
  "longitude": 78.2788,
  "bounty_rupees": 20,
  "deadline": "2026-03-02T00:00:00Z"
}'</span>`,
        `curl -X POST "${base}/api/v1/agent/tasks" -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d "{\\"type\\":\\"photo\\",\\"title\\":\\"Phoenix Mall Entrance\\",\\"description\\":\\"Capture the main entrance showing the store name sign\\",\\"latitude\\":17.4512,\\"longitude\\":78.2788,\\"bounty_rupees\\":20,\\"deadline\\":\\"2026-03-02T00:00:00Z\\"}"`,
      )}
    </div>
  </div>
</div>

<!-- Auth -->
<div class="section">
  <div class="section-label">Authentication</div>
  <div class="section-title">API Key</div>
  <div class="section-desc">All agent endpoints require an <code>X-API-Key</code> header. Get your key from the registration endpoint — it's shown only once.</div>
  ${codeWrap(`<span class="cmt"># Include with every request</span>
-H <span class="str">'X-API-Key: lok_3fced84c25643987...'</span>`)}
</div>

<!-- Task lifecycle -->
<div class="section">
  <div class="section-label">Concepts</div>
  <div class="section-title">Task lifecycle</div>
  <div class="section-desc">Every task follows this state machine. After submission, you have 2 minutes to approve or reject — otherwise it's auto-approved.</div>

  <div class="flow">
    <span class="flow-node pending">Pending</span>
    <span class="flow-arrow">&rarr;</span>
    <span class="flow-node assigned">Assigned</span>
    <span class="flow-arrow">&rarr;</span>
    <span class="flow-node progress">In Progress</span>
    <span class="flow-arrow">&rarr;</span>
    <span class="flow-node submitted">Submitted</span>
    <span class="flow-arrow">&rarr;</span>
    <span class="flow-node completed">Completed</span>
  </div>

  <div class="grid-3">
    <div class="card">
      <div class="card-header"><h3>Auto-approve</h3></div>
      <p>2 minutes after submission, if no review action is taken, the task is automatically approved.</p>
    </div>
    <div class="card">
      <div class="card-header"><h3>Rejection</h3></div>
      <p>On rejection, the task immediately goes back to the pool for reassignment.</p>
    </div>
    <div class="card">
      <div class="card-header"><h3>Credits</h3></div>
      <p>Bounty is held on task creation and charged on completion. Released if the task expires or is cancelled.</p>
    </div>
  </div>

  <div class="info-box warn">
    Agents rejecting more than 35% of submissions will be flagged. Provide clear instructions to avoid poor submissions.
  </div>
</div>

<!-- Media TTL -->
<div class="section">
  <div class="section-label">Important</div>
  <div class="section-title">Media auto-deletion</div>
  <div class="section-desc">Submitted media is automatically deleted to conserve storage. Download immediately after task completion.</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>Photos</h3></div>
      <p>Auto-deleted <strong>${photoTtlMin} minutes</strong> after submission.</p>
    </div>
    <div class="card">
      <div class="card-header"><h3>Videos</h3></div>
      <p>Auto-deleted <strong>${videoTtlMin} minutes</strong> after submission.</p>
    </div>
  </div>
</div>

<!-- API Reference -->
<div class="section">
  <div class="section-label">Reference</div>
  <div class="section-title">Endpoints</div>
  <div class="section-desc">Machine-readable OpenAPI spec: <a href="/openapi.json" style="color:var(--accent);">/openapi.json</a></div>
</div>

<!-- Registration -->
<div class="section" style="margin-top:32px;">
  <h3 style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Registration</h3>

  ${endpoint('POST', '/api/v1/agents/register', 'Register a new agent', 'Create an agent account and receive an API key. No authentication required. Save the key — it cannot be retrieved later.', [
    { name: 'name', type: 'string', desc: 'Agent display name (2-100 chars)', required: true },
    { name: 'email', type: 'string', desc: 'Contact email', required: true },
    { name: 'country', type: 'string', desc: 'Country of operation', required: true },
  ], codeWrap(`<span class="cmt"># Response</span>
{
  <span class="key">"success"</span>: <span class="num">true</span>,
  <span class="key">"data"</span>: {
    <span class="key">"name"</span>: <span class="str">"My Agent"</span>,
    <span class="key">"api_key"</span>: <span class="str">"lok_3fced84c25643987..."</span>,
    <span class="key">"credits_balance"</span>: <span class="num">0</span>
  },
  <span class="key">"note"</span>: <span class="str">"Final payable might be slightly higher to account for any conversion/payment transfer rates if present."</span>
}`))}
</div>

<!-- Tasks -->
<div class="section" style="margin-top:32px;">
  <h3 style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Tasks</h3>

  ${endpoint('POST', '/api/v1/agent/tasks', 'Create a task', 'Dispatch a microtask to humans nearby to task location. Bounty is held from your credits. Tasks are sent to humans within 250m of the target location.', [
    { name: 'type', type: 'string', desc: `Task type: ${TASK_TYPES.map(t => `<code>${t}</code>`).join(', ')}`, required: true },
    { name: 'title', type: 'string', desc: 'Subject to capture — just the noun, e.g. "Phoenix Mall" (3-200 chars)', required: true },
    { name: 'description', type: 'string', desc: 'What exactly is needed (10-2000 chars)', required: true },
    { name: 'instructions', type: 'string', desc: 'Specific instructions for the human (max 5000 chars)', required: false },
    { name: 'latitude', type: 'number', desc: 'Target latitude (-90 to 90)', required: true },
    { name: 'longitude', type: 'number', desc: 'Target longitude (-180 to 180)', required: true },
    { name: 'bounty_rupees', type: 'integer', desc: 'Payment in rupees. Min &#8377;10, max &#8377;1,000', required: true },
    { name: 'deadline', type: 'string', desc: 'ISO 8601 deadline', required: true },
  ])}

  ${endpoint('GET', '/api/v1/agent/tasks', 'List your tasks', 'List all tasks created by your agent, with optional status filter and pagination.', [
    { name: 'status', type: 'string', desc: 'Filter: pending, assigned, in_progress, submitted, completed, expired, cancelled' },
    { name: 'page', type: 'integer', desc: 'Page number (default 1)' },
    { name: 'limit', type: 'integer', desc: 'Results per page (default 20, max 100)' },
  ])}

  ${endpoint('GET', '/api/v1/agent/tasks/{id}', 'Get task details', "Get a task's full details including the human's submitted response (photo URLs, text, metadata) if available.", [
    { name: 'id', type: 'uuid', desc: 'Task ID', required: true },
  ])}

  ${endpoint('DELETE', '/api/v1/agent/tasks/{id}', 'Cancel a task', 'Cancel a pending or assigned task. The held bounty is released back to your credit balance.', [
    { name: 'id', type: 'uuid', desc: 'Task ID', required: true },
  ])}

  ${endpoint('GET', '/api/v1/agent/tasks/{id}/media', 'Download task media', `Get media files from a completed task. Use <code>format=urls</code> for JSON response with signed URLs, or <code>format=proxy</code> to stream the binary file. Media is auto-deleted after ${photoTtlMin} min (photos) / ${videoTtlMin} min (videos). If you need to keep a copy, download it promptly. Approve the task before downloading.`, [
    { name: 'id', type: 'uuid', desc: 'Task ID', required: true },
    { name: 'format', type: 'string', desc: '<code>urls</code> (default) or <code>proxy</code>' },
    { name: 'index', type: 'integer', desc: 'File index (0-based). Required for <code>proxy</code> format' },
  ])}
</div>

<!-- Task review -->
<div class="section" style="margin-top:32px;">
  <h3 style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Task Review</h3>

  ${endpoint('POST', '/api/v1/agent/tasks/{id}/approve', 'Approve a submission', "Approve the human's submission. This triggers payout and marks the task as completed. You have 2 minutes — after that, it's auto-approved.", [
    { name: 'id', type: 'uuid', desc: 'Task ID', required: true },
  ])}

  ${endpoint('POST', '/api/v1/agent/tasks/{id}/reject', 'Reject a submission', 'Reject the submission with a reason. The task immediately goes back to the pool for reassignment.', [
    { name: 'id', type: 'uuid', desc: 'Task ID', required: true },
    { name: 'reason', type: 'string', desc: 'Rejection reason shown to the human (5-500 chars)', required: true },
  ])}
</div>

<!-- Humans -->
<div class="section" style="margin-top:32px;">
  <h3 style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Humans</h3>

  ${endpoint('GET', '/api/v1/agent/humans/locations', 'Get human locations', 'Get coordinates of all active humans. No identifying info — just lat/lng pairs. Only humans seen in the last 30 minutes are included. Minimum INR 10 credits required.')}

  ${endpoint('GET', '/api/v1/agent/humans/availability', 'Check availability at a location', 'Count how many active humans are within 250m of a location. Use this before creating a task to verify coverage. Minimum INR 10 credits required.', [
    { name: 'latitude', type: 'number', desc: 'Latitude (-90 to 90)', required: true },
    { name: 'longitude', type: 'number', desc: 'Longitude (-180 to 180)', required: true },
  ], shellTabs(
    `<span class="cmt"># Check if humans are nearby before creating a task</span>
curl <span class="str">'${base}/api/v1/agent/humans/availability?latitude=17.45&longitude=78.28'</span> \\
  -H <span class="str">'X-API-Key: YOUR_API_KEY'</span>

<span class="cmt"># Response</span>
{ <span class="key">"success"</span>: <span class="num">true</span>, <span class="key">"data"</span>: { <span class="key">"count"</span>: <span class="num">3</span> } }`,
    `curl "${base}/api/v1/agent/humans/availability?latitude=17.45&longitude=78.28" -H "X-API-Key: YOUR_API_KEY"

<span class="cmt"># Response</span>
{ <span class="key">"success"</span>: <span class="num">true</span>, <span class="key">"data"</span>: { <span class="key">"count"</span>: <span class="num">3</span> } }`,
  ))}
</div>

<!-- Credits -->
<div class="section" style="margin-top:32px;">
  <h3 style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Credits</h3>

  ${endpoint('GET', '/api/v1/agent/credits/balance', 'Check credit balance', 'Get your current credit balance in rupees.', undefined, codeWrap(`<span class="cmt"># Response</span>
{
  <span class="key">"success"</span>: <span class="num">true</span>,
  <span class="key">"data"</span>: {
    <span class="key">"balance"</span>: <span class="num">5000</span>,
    <span class="key">"currency"</span>: <span class="str">"INR"</span>,
    <span class="key">"balance_display"</span>: <span class="str">"INR 5000"</span>
  }
}`))}

  ${endpoint('POST', '/api/v1/agent/credits/request', 'Request credit top-up', 'Submit a request to purchase credits. You will be contacted at your registered email with payment details.', [
    { name: 'amount_rupees', type: 'integer', desc: 'Amount in rupees. Min &#8377;100, max &#8377;10,000', required: true },
  ], codeWrap(`<span class="cmt"># Response</span>
{
  <span class="key">"success"</span>: <span class="num">true</span>,
  <span class="key">"message"</span>: <span class="str">"Top-up request for INR 5000 received. You will be contacted at dev@example.com with payment details."</span>,
  <span class="key">"note"</span>: <span class="str">"Final payable might be slightly higher to account for any conversion/payment transfer rates if present."</span>
}`))}

  ${endpoint('GET', '/api/v1/agent/credits/ledger', 'Credit transaction history', 'Get paginated list of credit transactions — holds, charges, releases, and top-ups.', [
    { name: 'page', type: 'integer', desc: 'Page number (default 1)' },
    { name: 'limit', type: 'integer', desc: 'Results per page (default 20, max 100)' },
  ])}
</div>

<!-- Webhook -->
<div class="section" style="margin-top:32px;">
  <h3 style="font-size:14px;color:var(--text-muted);margin-bottom:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Webhook</h3>

  ${endpoint('GET', '/api/v1/agent/webhook', 'Get webhook URL', 'Get your currently configured webhook URL for task event notifications.')}

  ${endpoint('PUT', '/api/v1/agent/webhook', 'Set webhook URL', 'Set a URL to receive POST notifications for task events. Set to <code>null</code> to disable.', [
    { name: 'webhook_url', type: 'string', desc: 'HTTPS URL to receive event callbacks, or null to disable', required: true },
  ])}
</div>

<!-- Webhook events -->
<div class="section" style="margin-top:24px;">
  <div class="section-title" style="font-size:18px;">Webhook events</div>
  <div class="section-desc">When a task event occurs, a POST request is sent to your webhook URL with the task data.</div>
  <div class="grid-2">
    <div class="card">
      <h3 style="font-family:var(--mono);font-size:13px;color:var(--accent);">task.submitted</h3>
      <p>Fired when a human submits their response. You have 2 minutes to review.</p>
    </div>
    <div class="card">
      <h3 style="font-family:var(--mono);font-size:13px;color:var(--green);">task.completed</h3>
      <p>Fired when a task is approved (manually or auto-approved after 2 minutes).</p>
    </div>
  </div>
</div>

<div class="footer">
  lokeye - The lean human layer for AI
</div>
`);
}

// ─── MCP docs page ────────────────────────────────────────────

function mcpDocsPage() {
  const base = BASE();

  return shell('mcp', 'mcp', `

<!-- Hero -->
<div class="hero">
  <h1>Connect any MCP-enabled AI agent</h1>
  <p>lokeye exposes a remote MCP server. Connect Claude, Cursor, or any MCP client to dispatch real-world tasks, read live context, and trigger structured workflows — directly from your AI agent.</p>
</div>

<!-- Setup -->
<div class="section">
  <div class="section-label">Setup</div>
  <div class="section-title">Configure your MCP client</div>
  <div class="section-desc">Add lokeye as a remote MCP server. You need an API key — <a href="/quickstart" style="color:var(--accent);">register here</a> if you don't have one.</div>

  <div class="card">
    <div class="card-header"><h3>Cursor / VS Code</h3></div>
    <p>Add to your <code>.cursor/mcp.json</code> or VS Code MCP settings:</p>
    ${codeWrap(`{
  <span class="key">"mcpServers"</span>: {
    <span class="key">"lokeye"</span>: {
      <span class="key">"type"</span>: <span class="str">"http"</span>,
      <span class="key">"url"</span>: <span class="str">"${base}/mcp"</span>,
      <span class="key">"headers"</span>: {
        <span class="key">"X-API-Key"</span>: <span class="str">"YOUR_API_KEY"</span>
      }
    }
  }
}`)}
  </div>

  <div class="card" style="margin-top:16px;">
    <div class="card-header"><h3>Claude Code (CLI)</h3></div>
    <p>Add the remote MCP server via the CLI. Works on macOS, Linux, and Windows:</p>
    ${codeWrap(`claude mcp add --transport http lokeye ${base}/mcp --header <span class="str">"X-API-Key: YOUR_API_KEY"</span>`)}
  </div>

  <div class="info-box info" style="margin-top:16px;">
    lokeye uses the <strong>Streamable HTTP</strong> MCP transport — no stdio process needed. Each request is stateless and authenticated via the <code>X-API-Key</code> header.
  </div>
</div>

<!-- Feature overview -->
<div class="section">
  <div class="section-label">Server Capabilities</div>
  <div class="section-title">What the server exposes</div>
  <div class="section-desc">The lokeye MCP server implements all three MCP building blocks.</div>

  <div class="grid-3">
    <div class="card">
      <div class="card-header"><h3>Tools</h3></div>
      <p>Functions your model actively calls to dispatch tasks, review submissions, manage credits, and locate humans. The model decides when to call each tool based on your request.</p>
      <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">11 tools &mdash; model-controlled</p>
    </div>
    <div class="card">
      <div class="card-header"><h3>Resources</h3></div>
      <p>Read-only data your agent can pull in as context — credit balance, task lists, and live human locations. Application-driven: your client decides what to include.</p>
      <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">3 resources, 2 templates &mdash; application-driven</p>
    </div>
    <div class="card">
      <div class="card-header"><h3>Prompts</h3></div>
      <p>Pre-built instruction templates for common workflows. Invoke them with arguments to guide your model through availability checks, task creation, and area surveys.</p>
      <p style="margin-top:10px;font-size:12px;color:var(--text-muted);">3 prompts &mdash; user-controlled</p>
    </div>
  </div>
</div>

<!-- Tools -->
<div class="section">
  <div class="section-label">Tools</div>
  <div class="section-title">Available tools</div>
  <div class="section-desc">11 tools the model can invoke. Discovered via <code>tools/list</code>, executed via <code>tools/call</code>.</div>

  <div class="tool-card">
    <div class="tool-name">create_task</div>
    <div class="tool-desc">Dispatch a microtask to a nearby human to capture real-world data. Types: <code>photo</code> or <code>video</code>. Bounty in rupees (min &#8377;10). Tasks go to humans within 250m of the location. Title should be just the subject — e.g. "Phoenix Mall", not "Take a photo of Phoenix Mall".</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">type<span class="param-req">required</span></span><span class="tool-param-info"><code>photo</code> or <code>video</code></span></div>
      <div class="tool-param"><span class="tool-param-name">title<span class="param-req">required</span></span><span class="tool-param-info">Subject to capture (3-200 chars)</span></div>
      <div class="tool-param"><span class="tool-param-name">description<span class="param-req">required</span></span><span class="tool-param-info">What is needed (10-2000 chars)</span></div>
      <div class="tool-param"><span class="tool-param-name">instructions</span><span class="tool-param-info">Specific instructions for the human</span></div>
      <div class="tool-param"><span class="tool-param-name">latitude<span class="param-req">required</span></span><span class="tool-param-info">Target latitude (-90 to 90)</span></div>
      <div class="tool-param"><span class="tool-param-name">longitude<span class="param-req">required</span></span><span class="tool-param-info">Target longitude (-180 to 180)</span></div>
      <div class="tool-param"><span class="tool-param-name">bounty_rupees<span class="param-req">required</span></span><span class="tool-param-info">Payment in rupees (10-1000)</span></div>
      <div class="tool-param"><span class="tool-param-name">deadline<span class="param-req">required</span></span><span class="tool-param-info">ISO 8601 deadline</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">get_task_status</div>
    <div class="tool-desc">Get current status and details of a task. If completed, includes the human response with photo/video URLs.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">task_id<span class="param-req">required</span></span><span class="tool-param-info">Task UUID</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">list_my_tasks</div>
    <div class="tool-desc">List your tasks. Optionally filter by status: pending, assigned, in_progress, submitted, completed, expired, cancelled.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">status</span><span class="tool-param-info">Filter by status (optional)</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">cancel_task</div>
    <div class="tool-desc">Cancel a pending or assigned task. Bounty is refunded to your credits.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">task_id<span class="param-req">required</span></span><span class="tool-param-info">Task UUID</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">approve_task</div>
    <div class="tool-desc">Approve a submitted task. Triggers human payout. You have 2 minutes before auto-approval.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">task_id<span class="param-req">required</span></span><span class="tool-param-info">Task UUID</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">reject_task</div>
    <div class="tool-desc">Reject a submitted task with a reason. Task returns to the pool. Agents rejecting &gt;35% of submissions may be flagged.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">task_id<span class="param-req">required</span></span><span class="tool-param-info">Task UUID</span></div>
      <div class="tool-param"><span class="tool-param-name">reason<span class="param-req">required</span></span><span class="tool-param-info">Rejection reason shown to human (5-500 chars)</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">view_task_media</div>
    <div class="tool-desc">Get media URLs from a completed task. Photos are returned inline as base64 images. Media is auto-deleted — photos after ${photoTtlMin} min, videos after ${videoTtlMin} min. Approve the task before downloading.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">task_id<span class="param-req">required</span></span><span class="tool-param-info">Task UUID</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">check_credits</div>
    <div class="tool-desc">Check your current credit balance in rupees.</div>
    <div class="tool-params" style="color:var(--text-muted);font-size:13px;padding:6px 0;">No parameters</div>
  </div>

  <div class="tool-card">
    <div class="tool-name">request_credits</div>
    <div class="tool-desc">Request a credit top-up. You will be contacted via your registered email with payment details. Final payable might be slightly higher to account for conversion/transfer rates.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">amount_rupees<span class="param-req">required</span></span><span class="tool-param-info">Amount in rupees (&#8377;100 to &#8377;10,000)</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">check_human_availability</div>
    <div class="tool-desc">Count active humans within 250m of a location. Use before creating a task to verify coverage. Minimum INR 10 credits required.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">latitude<span class="param-req">required</span></span><span class="tool-param-info">Latitude (-90 to 90)</span></div>
      <div class="tool-param"><span class="tool-param-name">longitude<span class="param-req">required</span></span><span class="tool-param-info">Longitude (-180 to 180)</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name">get_human_locations</div>
    <div class="tool-desc">Get anonymized coordinates of all active humans seen in the last 30 minutes. Minimum INR 10 credits required.</div>
    <div class="tool-params" style="color:var(--text-muted);font-size:13px;padding:6px 0;">No parameters</div>
  </div>
</div>

<!-- Resources -->
<div class="section">
  <div class="section-label">Resources</div>
  <div class="section-title">Available resources</div>
  <div class="section-desc">Read-only context your MCP client can pull in. Discovered via <code>resources/list</code> and <code>resources/templates/list</code>, read via <code>resources/read</code>. All return <code>application/json</code>.</div>

  <h3 style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Direct resources</h3>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--blue);">lokeye://credits</div>
    <div class="tool-desc">Your current credit balance in rupees. Returns <code>&#123; balance, currency, balance_display &#125;</code>.</div>
  </div>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--blue);">lokeye://tasks</div>
    <div class="tool-desc">Your 50 most recent tasks across all statuses, ordered by creation date descending.</div>
  </div>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--blue);">lokeye://humans/locations</div>
    <div class="tool-desc">Anonymized lat/lng coordinates of all active humans seen in the last 30 minutes. Requires INR 10 minimum credits.</div>
  </div>

  <h3 style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 10px;">Resource templates</h3>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--blue);">lokeye://tasks/<span style="color:var(--amber);">{task_id}</span></div>
    <div class="tool-desc">Full details for a specific task, including the submitted response and media URLs if available. Replace <code>{task_id}</code> with a task UUID.</div>
  </div>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--blue);">lokeye://humans/availability/<span style="color:var(--amber);">{lat}</span>/<span style="color:var(--amber);">{lng}</span></div>
    <div class="tool-desc">Count of active humans within 250m of the given coordinates. Replace <code>{lat}</code> and <code>{lng}</code> with decimal values. Requires INR 10 minimum credits.</div>
  </div>
</div>

<!-- Prompts -->
<div class="section">
  <div class="section-label">Prompts</div>
  <div class="section-title">Available prompts</div>
  <div class="section-desc">Pre-built instruction templates. Discovered via <code>prompts/list</code>, retrieved via <code>prompts/get</code> with arguments. MCP clients typically expose these as slash commands.</div>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--purple);">capture_photo</div>
    <div class="tool-desc">Guides your model through dispatching a photo task: checks human availability at the target location, then creates the task if coverage is sufficient.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">subject<span class="param-req">required</span></span><span class="tool-param-info">What to photograph, e.g. "Phoenix Mall entrance"</span></div>
      <div class="tool-param"><span class="tool-param-name">latitude<span class="param-req">required</span></span><span class="tool-param-info">Target latitude</span></div>
      <div class="tool-param"><span class="tool-param-name">longitude<span class="param-req">required</span></span><span class="tool-param-info">Target longitude</span></div>
      <div class="tool-param"><span class="tool-param-name">bounty_rupees</span><span class="tool-param-info">Payment in rupees (10–1000, default 20)</span></div>
      <div class="tool-param"><span class="tool-param-name">details</span><span class="tool-param-info">Additional instructions for the human</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--purple);">capture_video</div>
    <div class="tool-desc">Same as <code>capture_photo</code> but for video tasks. Checks availability, then dispatches a video recording task.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">subject<span class="param-req">required</span></span><span class="tool-param-info">What to record, e.g. "Traffic at Main Street junction"</span></div>
      <div class="tool-param"><span class="tool-param-name">latitude<span class="param-req">required</span></span><span class="tool-param-info">Target latitude</span></div>
      <div class="tool-param"><span class="tool-param-name">longitude<span class="param-req">required</span></span><span class="tool-param-info">Target longitude</span></div>
      <div class="tool-param"><span class="tool-param-name">bounty_rupees</span><span class="tool-param-info">Payment in rupees (10–1000, default 40)</span></div>
      <div class="tool-param"><span class="tool-param-name">details</span><span class="tool-param-info">Additional instructions for the human</span></div>
    </div>
  </div>

  <div class="tool-card">
    <div class="tool-name" style="color:var(--purple);">survey_area</div>
    <div class="tool-desc">Survey a location for human coverage before deciding whether to dispatch a task. Returns a coverage report with human count and overall map of active humans.</div>
    <div class="tool-params">
      <div class="tool-param"><span class="tool-param-name">latitude<span class="param-req">required</span></span><span class="tool-param-info">Target latitude</span></div>
      <div class="tool-param"><span class="tool-param-name">longitude<span class="param-req">required</span></span><span class="tool-param-info">Target longitude</span></div>
      <div class="tool-param"><span class="tool-param-name">task_type</span><span class="tool-param-info"><code>photo</code> or <code>video</code> (default: photo)</span></div>
    </div>
  </div>
</div>

<!-- Example flow -->
<div class="section">
  <div class="section-label">Example</div>
  <div class="section-title">Typical agent workflow</div>

  <div class="steps">
    <div class="step">
      <h3>Check availability</h3>
      <p>Call <code>check_human_availability</code> (tool) or read <code>lokeye://humans/availability/{lat}/{lng}</code> (resource) to verify humans are nearby before spending credits.</p>
    </div>
    <div class="step">
      <h3>Create task</h3>
      <p>Call <code>create_task</code> with type, location, bounty, and deadline. Or invoke the <code>capture_photo</code> / <code>capture_video</code> prompt to let the model handle both steps automatically.</p>
    </div>
    <div class="step">
      <h3>Monitor status</h3>
      <p>Poll <code>get_task_status</code> or read the <code>lokeye://tasks/{task_id}</code> resource. Set up a webhook via the API to get notified instantly on submission.</p>
    </div>
    <div class="step">
      <h3>Review &amp; download</h3>
      <p>Call <code>view_task_media</code> to review submitted photos/videos (returned as base64). Then call <code>approve_task</code> or <code>reject_task</code>. Download promptly — media is auto-deleted after ${photoTtlMin} min (photos) / ${videoTtlMin} min (videos).</p>
    </div>
  </div>

  <div class="info-box tip">
    Set up a webhook URL via the <a href="/api" style="color:var(--green);">API</a> to get notified instantly when a human submits — no polling needed.
  </div>
</div>

<div class="footer">
  lokeye - The lean human layer for AI
</div>
`);
}

// ─── Quickstart page ──────────────────────────────────────────

function quickstartPage() {
  const base = BASE();

  return shell('quickstart', 'quickstart', `

<!-- Hero -->
<div class="hero">
  <h1>Go live in minutes</h1>
  <p>Create your agent, connect MCP, and dispatch your first real-world task.</p>
</div>

<!-- Steps -->
<div class="section">
  <div class="section-label">Onboarding</div>
  <div class="section-title">Go live in minutes</div>
  <div class="section-desc">Follow these four steps in order. This is the fastest path for a new AI agent integration.</div>

  <div class="steps">
    <div class="step">
      <h3>Register and get API key</h3>
      <p>Call the registration endpoint once and save the returned key securely.</p>
      ${shellTabs(
        `curl -X POST <span class="str">'${base}/api/v1/agents/register'</span> \\
  -H <span class="str">'Content-Type: application/json'</span> \\
  -d <span class="str">'{"name":"My Agent","email":"dev@example.com","country":"India"}'</span>`,
        `curl -X POST "${base}/api/v1/agents/register" -H "Content-Type: application/json" -d "{\\"name\\":\\"My Agent\\",\\"email\\":\\"dev@example.com\\",\\"country\\":\\"India\\"}"`,
      )}
    </div>

    <div class="step">
      <h3>Connect your MCP client</h3>
      <p>Add lokeye as a remote MCP server and pass your API key in the header.</p>
      ${codeWrap(`{
  <span class="key">"mcpServers"</span>: {
    <span class="key">"lokeye"</span>: {
      <span class="key">"type"</span>: <span class="str">"http"</span>,
      <span class="key">"url"</span>: <span class="str">"${base}/mcp"</span>,
      <span class="key">"headers"</span>: {
        <span class="key">"X-API-Key"</span>: <span class="str">"YOUR_API_KEY"</span>
      }
    }
  }
}`)}
    </div>

    <div class="step">
      <h3>Verify MCP connection</h3>
      <p>In your MCP client, run <code>tools/list</code> and confirm you see the lokeye tool set (for example: <code>create_task</code>, <code>get_task_status</code>, <code>approve_task</code>, <code>reject_task</code>).</p>
    </div>

    <div class="step">
      <h3>Create your first task</h3>
      <p>Dispatch a photo task from your MCP client using <code>tools/call</code>:</p>
      ${codeWrap(`Tool: <span class="str">create_task</span>
Arguments:
{
  <span class="key">"type"</span>: <span class="str">"photo"</span>,
  <span class="key">"title"</span>: <span class="str">"Store entrance board"</span>,
  <span class="key">"description"</span>: <span class="str">"Capture a clear front photo of the board"</span>,
  <span class="key">"latitude"</span>: <span class="num">17.4512</span>,
  <span class="key">"longitude"</span>: <span class="num">78.2788</span>,
  <span class="key">"bounty_rupees"</span>: <span class="num">20</span>,
  <span class="key">"deadline"</span>: <span class="str">"2026-03-02T00:00:00Z"</span>
}`)}
      <p style="margin-top:14px;font-size:14px;color:var(--text-secondary);">REST fallback:</p>
      ${shellTabs(
        `curl -X POST <span class="str">'${base}/api/v1/agent/tasks'</span> \\
  -H <span class="str">'X-API-Key: YOUR_API_KEY'</span> \\
  -H <span class="str">'Content-Type: application/json'</span> \\
  -d <span class="str">'{
  "type": "photo",
  "title": "Store entrance board",
  "description": "Capture a clear front photo of the board",
  "latitude": 17.4512,
  "longitude": 78.2788,
  "bounty_rupees": 20,
  "deadline": "2026-03-02T00:00:00Z"
}'</span>`,
        `curl -X POST "${base}/api/v1/agent/tasks" -H "X-API-Key: YOUR_API_KEY" -H "Content-Type: application/json" -d "{\\"type\\":\\"photo\\",\\"title\\":\\"Store entrance board\\",\\"description\\":\\"Capture a clear front photo of the board\\",\\"latitude\\":17.4512,\\"longitude\\":78.2788,\\"bounty_rupees\\":20,\\"deadline\\":\\"2026-03-02T00:00:00Z\\"}"`,
      )}
    </div>
  </div>
</div>

<!-- Next links -->
<div class="section">
  <div class="section-label">Next</div>
  <div class="section-title">Where to go next</div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><h3>API Reference</h3></div>
      <p>Full endpoint-level docs for registration, tasks, credits, humans, and webhooks.</p>
      <p style="margin-top:12px;"><a href="/api" style="color:var(--accent);">Open API docs &rarr;</a></p>
    </div>
    <div class="card">
      <div class="card-header"><h3>MCP Tool Reference</h3></div>
      <p>Tool-by-tool MCP docs with parameter definitions and typical workflow.</p>
      <p style="margin-top:12px;"><a href="/mcp" style="color:var(--accent);">Open MCP docs &rarr;</a></p>
    </div>
  </div>
</div>

<div class="footer">
  lokeye - The lean human layer for AI
</div>
`);
}

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'lokeye API',
    description: 'Get real-time world data through humans. Dispatch microtasks (photo, video) to humans nearby to task location and get results in minutes.',
    version: '1.0.0',
  },
  servers: [
    ...(process.env.PUBLIC_URL
      ? [{ url: process.env.PUBLIC_URL, description: 'Production' }]
      : []),
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key obtained from /api/v1/agents/register',
      },
    },
  },
};

// ─── Routes ───────────────────────────────────────────────────

function homePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lokeye | The lean human layer for AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; scroll-behavior: smooth; }
    body {
      font-family: 'Roboto Mono', monospace;
      background: #000000;
      color: #00d9ff;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, h5, h6 { font-family: 'Orbitron', sans-serif; }
    a { text-decoration: none; color: inherit; }
    button { font-family: 'Roboto Mono', monospace; cursor: pointer; border: none; outline: none; }

    .nav {
      position: sticky;
      top: 0;
      z-index: 50;
      border-bottom: 1px solid rgba(34, 211, 238, 0.3);
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .nav-inner {
      max-width: 80rem;
      margin: 0 auto;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 2rem;
    }
    .nav-brand {
      font-weight: 600;
      font-size: 1.25rem;
      letter-spacing: 0.05em;
      color: #00d9ff;
      text-decoration: none;
    }
    .nav-links {
      display: flex;
      gap: 1.5rem;
    }
    .nav-links a {
      font-size: 0.75rem;
      color: rgba(103, 232, 249, 0.7);
      letter-spacing: 0.025em;
      transition: color 0.15s;
    }
    .nav-links a:hover { color: #22d3ee; }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 2rem;
      padding: 0 0.75rem;
      border-radius: 0.375rem;
      background: #00d9ff;
      color: #000000;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.025em;
      font-family: 'Roboto Mono', monospace;
      white-space: nowrap;
      transition: background-color 0.15s;
    }
    .nav-btn:hover { background: rgba(0, 217, 255, 0.9); }

    .main-inner {
      max-width: 64rem;
      margin: 0 auto;
      padding: 8rem 1.5rem 4rem;
    }
    .hero {
      text-align: center;
      margin-bottom: 8rem;
    }
    .hero h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      letter-spacing: 0.05em;
      font-weight: 500;
      line-height: 1;
    }
    .hero p {
      font-size: 1rem;
      color: rgba(103, 232, 249, 0.8);
      margin-bottom: 2rem;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
      margin-bottom: 8rem;
      max-width: 72rem;
      margin-left: auto;
      margin-right: auto;
    }
    @media (max-width: 768px) {
      .cards { grid-template-columns: 1fr; }
    }
    .card {
      position: relative;
      display: flex;
    }
    .card-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom right, rgba(34, 211, 238, 0.05), transparent);
      border-radius: 0.5rem;
      filter: blur(4px);
      transition: filter 0.3s;
    }
    .card:hover .card-bg { filter: blur(8px); }
    .card-content {
      position: relative;
      border-left: 2px solid rgba(34, 211, 238, 0.4);
      padding-left: 1.25rem;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
      display: flex;
      align-items: flex-start;
    }
    .card-content.center { align-items: center; }
    .card-content p {
      font-size: 1rem;
      color: rgba(207, 250, 254, 0.9);
      line-height: 1.625;
    }
    .cta {
      text-align: center;
      padding-top: 3rem;
      padding-bottom: 3rem;
      border-top: 1px solid rgba(34, 211, 238, 0.3);
    }
    .cta h3 {
      font-family: 'Roboto Mono', monospace;
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
      letter-spacing: 0.025em;
      font-weight: 500;
      line-height: 1.5;
    }
    .cta p {
      font-size: 0.875rem;
      color: rgba(103, 232, 249, 0.8);
      margin-bottom: 1.5rem;
    }
    .btn-lg {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 2.5rem;
      padding: 0 1.5rem;
      border-radius: 0.375rem;
      background: #00d9ff;
      color: #000000;
      font-size: 0.875rem;
      font-weight: 500;
      letter-spacing: 0.025em;
      font-family: 'Roboto Mono', monospace;
      white-space: nowrap;
      transition: background-color 0.15s;
    }
    .btn-lg:hover { background: rgba(0, 217, 255, 0.9); }
  </style>
</head>
<body>
  <div style="min-height:100vh;display:flex;flex-direction:column;">
    ${nav('api')}
    <main style="flex:1;">
      <div class="main-inner">
        <div class="hero">
          <h1>The lean human layer for AI.</h1>
          <p>Ideal for agents making large-scale decisions using near-real-time signals from the physical world.</p>
        </div>

        <div class="cards">
          <div class="card">
            <div class="card-bg"></div>
            <div class="card-content">
              <p>Dispatch microtasks to humans in India and get responses within minutes.</p>
            </div>
          </div>
          <div class="card">
            <div class="card-bg"></div>
            <div class="card-content center">
              <p>Most tasks done under 1$.</p>
            </div>
          </div>
          <div class="card">
            <div class="card-bg"></div>
            <div class="card-content">
              <p>Tasks are quickly picked up by humans nearby. No profile screening required.</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  </div>
${notifyModal()}
</body>
</html>`;
}

export async function docsRoutes(fastify: FastifyInstance) {
  fastify.get('/openapi.json', async () => openApiSpec);

  fastify.get('/mcp', async (_request, reply) => {
    reply.type('text/html').send(mcpDocsPage());
  });

  fastify.get('/api', async (_request, reply) => {
    reply.type('text/html').send(apiDocsPage());
  });

  fastify.get('/docs', async (_request, reply) => {
    reply.type('text/html').send(apiDocsPage());
  });

  fastify.get('/docs/mcp', async (_request, reply) => {
    reply.type('text/html').send(mcpDocsPage());
  });

  fastify.get('/quickstart', async (_request, reply) => {
    reply.type('text/html').send(quickstartPage());
  });

  fastify.post('/api/v1/interest', async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, website, t } = request.body as { name?: string; email?: string; website?: string; t?: string };

    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.code(400).send({ error: 'Valid name and email are required' });
    }

    const isBot = !!website || (!!t && Date.now() - parseInt(t, 10) < 2000);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const { rows } = await fastify.db.query(
      `INSERT INTO interest_signups (name, email, is_bot) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = $1, is_bot = $3
       RETURNING (xmax = 0) AS is_new`,
      [trimmedName, trimmedEmail, isBot],
    );

    const isNew = rows[0]?.is_new;
    if (isNew || isBot) {
      sendInterestSignup({ name: trimmedName, email: trimmedEmail, isBot }).catch(() => {});
    }

    return { success: true };
  });
}
