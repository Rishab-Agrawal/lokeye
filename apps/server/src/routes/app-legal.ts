import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { clearHumanAuthCache } from '../plugins/human-auth.js';
import { MIN_WITHDRAWAL_RUPEES } from '@lokeye/shared';
import { sendWithdrawalRequest } from '../services/telegram.js';

// ─── Styles for legal pages (clean, readable, light background) ──

const LEGAL_CSS = `
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --text-secondary: #4a4a4a;
  --text-muted: #717171;
  --border: #e5e5e5;
  --accent: #4f46e5;
  --surface: #f9fafb;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}
.legal-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 80px;
}
.legal-header {
  margin-bottom: 40px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}
.legal-header .app-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.legal-header h1 {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text);
  margin-bottom: 8px;
}
.legal-header .effective-date {
  font-size: 14px;
  color: var(--text-muted);
}
h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
  margin: 36px 0 12px;
}
h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 24px 0 8px;
}
p {
  margin-bottom: 12px;
  color: var(--text-secondary);
}
ul {
  margin: 8px 0 16px 24px;
  color: var(--text-secondary);
}
li {
  margin-bottom: 6px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0 24px;
  font-size: 14px;
}
th, td {
  text-align: left;
  padding: 10px 14px;
  border: 1px solid var(--border);
}
th {
  background: var(--surface);
  font-weight: 600;
  color: var(--text);
}
td {
  color: var(--text-secondary);
}
a {
  color: var(--accent);
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
.contact-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  margin-top: 32px;
}
.contact-box p {
  margin-bottom: 4px;
}
@media (max-width: 640px) {
  .legal-page { padding: 32px 16px 64px; }
  .legal-header h1 { font-size: 26px; }
  h2 { font-size: 18px; }
  table { font-size: 13px; }
  th, td { padding: 8px 10px; }
}
`;

function privacyPolicyPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lokeye | Privacy Policy</title>
  <style>${LEGAL_CSS}</style>
</head>
<body>
<div class="legal-page">
  <div class="legal-header">
    <h1>Privacy Policy</h1>
    <div class="effective-date">Effective date: March 10, 2026</div>
  </div>

  <p>Lokeye ("we", "us", "our") operates the Lokeye mobile application (the "App"). This Privacy Policy explains what personal data we collect, why we collect it, how we use and protect it, and your rights regarding that data.</p>
  <p>By creating an account and using the App, you agree to the collection and use of information as described in this policy.</p>

  <h2>1. Information We Collect</h2>

  <h3>1.1 Information you provide</h3>
  <table>
    <tr><th>Data</th><th>Purpose</th></tr>
    <tr><td>Phone number</td><td>Account creation and identification</td></tr>
    <tr><td>Display name</td><td>Shown to task requesters for identification</td></tr>
    <tr><td>UPI ID</td><td>Processing payment withdrawals to your account</td></tr>
  </table>

  <h3>1.2 Information collected automatically</h3>
  <table>
    <tr><th>Data</th><th>Purpose</th></tr>
    <tr><td>Precise location (GPS)</td><td>Matching you with nearby tasks</td></tr>
    <tr><td>Background location</td><td>Continuously matching you with tasks while the app is not in the foreground</td></tr>
  </table>

  <h3>1.3 Information collected during tasks</h3>
  <table>
    <tr><th>Data</th><th>Purpose</th></tr>
    <tr><td>Photos</td><td>Completing photo-based tasks as requested</td></tr>
    <tr><td>Videos (with audio)</td><td>Completing video-based tasks as requested</td></tr>
  </table>
  <p>Photos and videos are captured directly using your device camera within the App and uploaded only when you actively submit a task. The App does <strong>not</strong> access your device's photo gallery, media library, or file storage. The App does not access your camera or microphone without your action.</p>

  <h2>2. How We Use Your Data</h2>
  <p>We use the collected data solely for the following purposes:</p>
  <ul>
    <li>Creating and managing your account</li>
    <li>Assigning tasks based on your location</li>
    <li>Verifying and reviewing task submissions</li>
    <li>Processing payments to your UPI ID</li>
    <li>Sending push notifications about task updates and wallet activity</li>
    <li>Improving the App and fixing issues</li>
  </ul>
  <p>We do <strong>not</strong> use your data for advertising, profiling, or selling to third parties.</p>

  <h2>3. Data Sharing</h2>
  <p>We do not sell your personal data. We may share limited data with:</p>
  <ul>
    <li><strong>AI agents (task requesters)</strong> — your display name and task submission media are shared with the agent that created the task, so they can review your work.</li>
    <li><strong>Service providers</strong> — we use third-party infrastructure services (cloud hosting, database, storage, push notifications) to operate the App. These providers process data on our behalf and are bound by their own privacy policies.</li>
    <li><strong>Legal requirements</strong> — we may disclose data if required by law, regulation, or legal process.</li>
  </ul>

  <h2>4. Data Storage and Security</h2>
  <p>Your data is stored on secure cloud servers. We use industry-standard measures to protect your data, including:</p>
  <ul>
    <li>Encrypted connections (HTTPS/TLS) for all data in transit</li>
    <li>Authentication tokens to secure your account</li>
    <li>Server-side access controls and role-based permissions</li>
  </ul>
  <p>Task media (photos and videos) is stored temporarily and automatically deleted after a limited retention period.</p>

  <h2>5. Permissions</h2>
  <p>The App requests the following device permissions:</p>
  <ul>
    <li><strong>Location (foreground and background)</strong> — to match you with nearby tasks. Background location allows task matching even when the App is not actively open. You can disable background location at any time in your device settings.</li>
    <li><strong>Camera</strong> — to capture photos and videos for task completion.</li>
    <li><strong>Microphone</strong> — to record audio as part of video tasks.</li>
    <li><strong>Notifications</strong> — to alert you about new tasks, task updates, and payment activity.</li>
  </ul>
  <p>All permissions are requested at runtime with clear explanations. You may deny or revoke any permission through your device settings, though some App features may not work without them.</p>

  <h2>6. Data Retention</h2>
  <ul>
    <li><strong>Account data</strong> (phone number, display name, UPI ID) — retained while your account is active. Upon account deletion, your profile is deactivated and authentication credentials are removed. However, your phone number, display name, and UPI ID are retained indefinitely in a secure retention record for payment reconciliation, dispute resolution, and legal compliance.</li>
    <li><strong>Task and payment history</strong> — records of completed tasks, task submissions, and withdrawal requests are retained indefinitely, even after account deletion, for audit, accounting, and legal purposes.</li>
    <li><strong>Location data</strong> — only your most recent location is stored for task matching; historical location data is not retained. However, the location at which you completed each task submission is stored as part of that task record.</li>
    <li><strong>Task media</strong> — photos and videos are automatically deleted after the task retention period expires.</li>
  </ul>

  <h2>7. Your Rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li><strong>Access your data</strong> — view your profile information within the App.</li>
    <li><strong>Correct your data</strong> — update your UPI ID in the App.</li>
    <li><strong>Delete your account</strong> — request deletion of your account from within the App (Profile &gt; Delete Account) or by contacting us. Account deletion is processed immediately. Upon deletion, your authentication credentials are removed, your profile is deactivated, and active data (location, push token) is cleared. Payment-related records and a retention copy of your identity details are kept indefinitely for legal and accounting purposes as described in Section 6.</li>
    <li><strong>Revoke permissions</strong> — disable location, camera, or microphone access at any time in your device settings.</li>
  </ul>

  <h2>8. Children's Privacy</h2>
  <p>The App is not intended for anyone under 18 years of age. We do not knowingly collect personal data from children. If we learn we have collected data from a child under 18, we will delete it promptly.</p>

  <h2>9. Changes to This Policy</h2>
  <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with a revised effective date. Continued use of the App after changes constitutes acceptance of the updated policy.</p>

  <h2>10. Contact Us</h2>
  <div class="contact-box">
    <p>If you have questions or concerns about this Privacy Policy or your data, contact us at:</p>
    <p><strong>Email:</strong> <a href="mailto:contact.lokeye@gmail.com">contact.lokeye@gmail.com</a></p>
  </div>
</div>
</body>
</html>`;
}

// ─── Delete Account page ──────────────────────────────────────

const DELETE_CSS = `
${LEGAL_CSS}
.form-group {
  margin-bottom: 20px;
}
label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
}
input[type="tel"],
input[type="password"] {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 15px;
  color: var(--text);
  background: var(--surface);
  outline: none;
  transition: border-color 0.15s;
}
input:focus {
  border-color: var(--accent);
}
.phone-input-wrap {
  display: flex;
  align-items: stretch;
  gap: 0;
}
.phone-prefix {
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-right: none;
  border-radius: 8px 0 0 8px;
  font-size: 15px;
  color: var(--text);
  font-weight: 500;
  white-space: nowrap;
}
.phone-input-wrap input[type="tel"] {
  border-radius: 0 8px 8px 0;
  flex: 1;
}
.submit-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: #DC2626;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.submit-btn:hover {
  background: #B91C1C;
}
.submit-btn:disabled {
  background: #999;
  cursor: not-allowed;
}
.result-box {
  padding: 16px 20px;
  border-radius: 8px;
  margin-top: 20px;
  font-size: 14px;
  line-height: 1.6;
}
.result-success {
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  color: #166534;
}
.result-blocked {
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  color: #92400E;
}
.result-error {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  color: #991B1B;
}
.warning-box {
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 24px;
}
.warning-box p {
  color: #991B1B;
  margin-bottom: 0;
  font-size: 14px;
}
.info-list {
  margin: 16px 0 24px 20px;
  font-size: 14px;
  color: var(--text-secondary);
}
.info-list li {
  margin-bottom: 8px;
}
#loading {
  display: none;
  text-align: center;
  color: var(--text-muted);
  margin-top: 16px;
}
`;

function deleteAccountPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lokeye | Delete Account</title>
  <style>${DELETE_CSS}</style>
</head>
<body>
<div class="legal-page" style="max-width: 480px;">
  <div class="legal-header">
    <h1>Delete Account</h1>
  </div>

  <div class="warning-box">
    <p><strong>Warning:</strong> This action cannot be undone. Your account will be permanently deleted and you will no longer be able to log in.</p>
  </div>

  <p>Before deleting, please note:</p>
  <ul class="info-list">
    <li>Active or submitted tasks must be completed or reviewed first.</li>
    <li>Pending withdrawals must be processed first.</li>
    <li>If your wallet has a balance, a withdrawal request will be raised automatically.</li>
    <li>Payment history and identity records are retained for legal and accounting purposes.</li>
  </ul>

  <form id="delete-form" onsubmit="handleSubmit(event)">
    <div class="form-group">
      <label for="phone">Phone Number</label>
      <div class="phone-input-wrap">
        <span class="phone-prefix">+91</span>
        <input type="tel" id="phone" name="phone" placeholder="XXXXXXXXXX" required pattern="[0-9]{10}" maxlength="10" />
      </div>
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" placeholder="Enter your password" required minlength="6" />
    </div>
    <button type="submit" class="submit-btn" id="submit-btn">Delete My Account</button>
    <div id="loading">Processing your request...</div>
    <div id="result"></div>
  </form>
</div>
<script>
async function handleSubmit(e) {
  e.preventDefault();
  var btn = document.getElementById('submit-btn');
  var loading = document.getElementById('loading');
  var result = document.getElementById('result');
  var phone = '+91' + document.getElementById('phone').value.trim();
  var password = document.getElementById('password').value;

  btn.disabled = true;
  loading.style.display = 'block';
  result.innerHTML = '';

  try {
    var res = await fetch('/human/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, password: password }),
    });
    var data = await res.json();

    if (!res.ok) {
      result.innerHTML = '<div class="result-box result-error">' + escapeHtml(data.message || data.error || 'Something went wrong. Please try again.') + '</div>';
    } else if (data.action === 'deleted') {
      result.innerHTML = '<div class="result-box result-success">' + escapeHtml(data.message) + '</div>';
      document.getElementById('delete-form').reset();
    } else {
      result.innerHTML = '<div class="result-box result-blocked">' + escapeHtml(data.message) + '</div>';
    }
  } catch (err) {
    result.innerHTML = '<div class="result-box result-error">Network error. Please check your connection and try again.</div>';
  } finally {
    btn.disabled = false;
    loading.style.display = 'none';
  }
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
</script>
</body>
</html>`;
}

// ─── Validation schema for web delete ─────────────────────────

const WebDeleteSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(6),
});

// ─── Route registration ───────────────────────────────────────

export async function appLegalRoutes(fastify: FastifyInstance) {
  fastify.get('/human/privacy', async (_request, reply) => {
    reply.type('text/html').send(privacyPolicyPage());
  });

  fastify.get('/human/delete', async (_request, reply) => {
    reply.type('text/html').send(deleteAccountPage());
  });

  fastify.post('/human/delete', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = WebDeleteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Please enter a valid phone number and password (min 6 characters).' });
    }
    const { phone, password } = parsed.data;

    // Authenticate via Supabase
    const { data: authData, error: authError } = await fastify.supabase.auth.signInWithPassword({ phone, password });
    if (authError || !authData.session || !authData.user) {
      return reply.code(401).send({ message: 'Invalid phone number or password.' });
    }

    const humanId = authData.user.id;

    // Fetch human record
    const { rows: humanRows } = await fastify.db.query(
      `SELECT id, phone, display_name, upi_vpa, wallet_rupees, current_task_id, deleted_at
       FROM humans WHERE id = $1 LIMIT 1`,
      [humanId],
    );

    if (humanRows.length === 0) {
      return reply.code(404).send({ message: 'Account not found.' });
    }

    const human = humanRows[0];

    if (human.deleted_at) {
      return { action: 'deleted', message: 'Account has already been deleted.' };
    }

    // Check pending tasks
    const { rows: pendingTaskRows } = await fastify.db.query(
      `SELECT status FROM tasks
       WHERE human_id = $1 AND status IN ('assigned', 'in_progress', 'submitted')
       LIMIT 1`,
      [humanId],
    );

    if (pendingTaskRows.length > 0) {
      const status = pendingTaskRows[0].status as string;
      const message = status === 'submitted'
        ? 'Your account cannot be deleted yet. You have a task pending approval or rejection. Please wait and try again.'
        : 'Your account cannot be deleted yet. You have an active task. Please complete or cancel it and try again.';
      return { action: 'pending_tasks', message };
    }

    // Check pending withdrawals
    const { rows: pendingWithdrawalRows } = await fastify.db.query(
      `SELECT id FROM withdrawal_requests
       WHERE human_id = $1 AND status = 'pending'
       LIMIT 1`,
      [humanId],
    );

    if (pendingWithdrawalRows.length > 0) {
      return { action: 'pending_withdrawal', message: 'Your account cannot be deleted yet. You have a pending withdrawal request. Please wait for it to be processed and try again.' };
    }

    // Auto-raise withdrawal if wallet has balance
    if (human.wallet_rupees > 0) {
      if (!human.upi_vpa) {
        return { action: 'missing_upi', message: 'Your wallet has a balance but no UPI ID is set. Please set your UPI ID in the app first, then try again.' };
      }
      if (human.wallet_rupees < MIN_WITHDRAWAL_RUPEES) {
        return { action: 'missing_upi', message: `Your wallet has a balance below the minimum withdrawal amount (₹${MIN_WITHDRAWAL_RUPEES}). Please contact us at contact.lokeye@gmail.com for assistance.` };
      }

      // Check for existing pending withdrawal (shouldn't exist after above check, but be safe)
      const { rows: existing } = await fastify.db.query(
        `SELECT id FROM withdrawal_requests WHERE human_id = $1 AND status = 'pending'`,
        [humanId],
      );
      if (existing.length === 0) {
        const amount = human.wallet_rupees;
        const { rows: inserted } = await fastify.db.query(
          `INSERT INTO withdrawal_requests (human_id, amount_rupees, upi_vpa)
           VALUES ($1, $2, $3) RETURNING *`,
          [humanId, amount, human.upi_vpa],
        );

        const withdrawal = inserted[0];
        const messageId = await sendWithdrawalRequest({
          id: withdrawal.id,
          human_name: human.display_name || human.phone,
          human_phone: human.phone,
          upi_vpa: human.upi_vpa,
          amount_rupees: amount,
        });
        if (messageId) {
          await fastify.db.query(
            'UPDATE withdrawal_requests SET telegram_message_id = $1 WHERE id = $2',
            [messageId, withdrawal.id],
          );
        }
      }

      return { action: 'withdrawal_requested', message: 'Your wallet has a balance. A withdrawal request has been raised. Please wait for the amount to be processed, then try deleting your account again.' };
    }

    // Proceed with deletion
    const client = await fastify.db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO human_account_retention (
           human_id, retained_display_name, retained_phone, retained_upi_vpa, retention_reason
         )
         VALUES ($1, $2, $3, $4, 'user_requested_account_closure')
         ON CONFLICT (human_id) DO UPDATE
         SET retained_display_name = EXCLUDED.retained_display_name,
             retained_phone = EXCLUDED.retained_phone,
             retained_upi_vpa = EXCLUDED.retained_upi_vpa,
             retention_reason = EXCLUDED.retention_reason,
             deleted_at = NOW()`,
        [human.id, human.display_name, human.phone, human.upi_vpa],
      );

      await client.query(
        `UPDATE humans
         SET phone = $2,
             display_name = NULL,
             upi_vpa = NULL,
             expo_push_token = NULL,
             last_location = NULL,
             last_location_at = NULL,
             current_task_id = NULL,
             is_active = false,
             deletion_requested_at = NOW(),
             deleted_at = NOW(),
             deletion_reason = 'user_requested_account_closure',
             updated_at = NOW()
         WHERE id = $1`,
        [human.id, `deleted:${human.id}`],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error({ err, humanId }, 'Failed to close human account via web');
      return reply.code(500).send({ message: 'Something went wrong. Please try again or contact us at contact.lokeye@gmail.com.' });
    } finally {
      client.release();
    }

    clearHumanAuthCache(humanId);

    const { error: deleteAuthError } = await fastify.supabase.auth.admin.deleteUser(humanId);
    if (deleteAuthError) {
      fastify.log.error({ err: deleteAuthError, humanId }, 'Failed to delete auth user during web account closure');
      await fastify.supabase.auth.admin.signOut(humanId);
    }

    return { action: 'deleted', message: 'Your account has been successfully deleted. You can no longer log in with this phone number.' };
  });
}
