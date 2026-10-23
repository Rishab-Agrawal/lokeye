const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_TIMEOUT_MS = 10_000;

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

/** Wrapper around fetch with a timeout for all Telegram API calls. */
function telegramFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
  });
}

export async function sendWithdrawalRequest(withdrawal: {
  id: string;
  human_name: string;
  human_phone: string;
  upi_vpa: string;
  amount_rupees: number;
}): Promise<number | null> {
  if (!BOT_TOKEN || !CHAT_ID) return null;

  const amountRupees = withdrawal.amount_rupees.toFixed(0);

  const text = [
    `\u{1F4B8} *Withdrawal Request*`,
    ``,
    `*Human:* ${escapeMarkdown(withdrawal.human_name)}`,
    `*Phone:* ${escapeMarkdown(withdrawal.human_phone)}`,
    `*UPI:* \`${withdrawal.upi_vpa}\``,
    `*Amount:* ₹${amountRupees}`,
    ``,
    `ID: \`${withdrawal.id}\``,
  ].join('\n');

  const res = await telegramFetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[
          { text: '\u2705 Mark as Paid', callback_data: `withdraw_paid:${withdrawal.id}` },
          { text: '\u274C Reject', callback_data: `withdraw_reject:${withdrawal.id}` },
        ]],
      },
    }),
  });

  const data = await res.json() as { ok: boolean; result?: { message_id: number } };
  return data.ok ? data.result!.message_id : null;
}

export async function editMessageAfterAction(
  messageId: number,
  status: 'completed' | 'rejected',
  withdrawal: { human_name: string; amount_rupees: number; upi_vpa: string },
): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const amountRupees = withdrawal.amount_rupees.toFixed(0);
  const emoji = status === 'completed' ? '\u2705' : '\u274C';
  const label = status === 'completed' ? 'PAID' : 'REJECTED';

  const text = [
    `${emoji} *Withdrawal ${label}*`,
    ``,
    `*Human:* ${escapeMarkdown(withdrawal.human_name)}`,
    `*UPI:* \`${withdrawal.upi_vpa}\``,
    `*Amount:* ₹${amountRupees}`,
  ].join('\n');

  await telegramFetch(apiUrl('editMessageText'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      message_id: messageId,
      text,
      parse_mode: 'MarkdownV2',
    }),
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!BOT_TOKEN) return;

  await telegramFetch(apiUrl('answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

export async function sendSupportRequest(human: {
  id: string;
  phone: string;
  display_name?: string | null;
}): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const displayName = human.display_name?.trim() || 'Not set';
  const text = [
    `\u{1F511} *Forgot Password Request*`,
    ``,
    `*Human ID:* \`${human.id}\``,
    `*Name:* ${escapeMarkdown(displayName)}`,
    `*Phone:* ${escapeMarkdown(human.phone)}`,
    ``,
    `To reset password, send:`,
    `\`/setpw ${human.id} <new_password> <confirm_password>\``,
  ].join('\n');

  await telegramFetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
    }),
  });
}

export async function sendHumanSupportMessage(human: {
  id: string;
  phone: string;
  display_name?: string | null;
  message: string;
}): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const displayName = human.display_name?.trim() || 'Not set';
  const text = [
    `\u{1F6A8} *In\\-app Support Request*`,
    ``,
    `*Human ID:* \`${human.id}\``,
    `*Name:* ${escapeMarkdown(displayName)}`,
    `*Phone:* ${escapeMarkdown(human.phone)}`,
    `*Message:* ${escapeMarkdown(human.message)}`,
  ].join('\n');

  await telegramFetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
    }),
  });
}

export async function sendNewAgentRegistration(agent: {
  name: string;
  email: string;
  country: string;
}): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;
  const creditCmd = `/credit ${agent.email} <amount_inr> <confirm_amount_inr> <reference>`;

  const text = [
    `\u{1F916} *New Agent Registration*`,
    ``,
    `*Name:* ${escapeMarkdown(agent.name)}`,
    `*Email:* ${escapeMarkdown(agent.email)}`,
    `*Country:* ${escapeMarkdown(agent.country)}`,
    ``,
    `Agent has 0 credits\\. Send payment details to their email\\.`,
    `To add credits after payment, run:`,
    `\`${escapeMarkdown(creditCmd)}\``,
  ].join('\n');

  await telegramFetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
    }),
  });
}

export async function sendCreditTopupRequest(agent: {
  name: string;
  email: string;
  amount_rupees: number;
}): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const amountRupees = agent.amount_rupees.toFixed(0);
  const creditCmd = `/credit ${agent.email} ${amountRupees} ${amountRupees} <reference>`;

  const text = [
    `\u{1F4B0} *Credit Top\\-up Request*`,
    ``,
    `*Agent:* ${escapeMarkdown(agent.name)}`,
    `*Email:* ${escapeMarkdown(agent.email)}`,
    `*Requested:* ₹${amountRupees}`,
    ``,
    `Reply to their email with payment details\\.`,
    `After payment, run:`,
    `\`${escapeMarkdown(creditCmd)}\``,
  ].join('\n');

  await telegramFetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
    }),
  });
}

export async function sendAgentRejectionThresholdAlert(alert: {
  name: string | null;
  email: string;
  rejection_rate_percent: number;
  threshold_percent: number;
  total_reviews: number;
  total_rejections: number;
  credits_balance: number;
}): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const displayName = alert.name?.trim() || 'Unknown';
  const blockCmd = `/blockagent ${alert.email}`;
  const unblockCmd = `/unblockagent ${alert.email}`;

  const text = [
    'ALERT: Agent rejection rate crossed threshold',
    '',
    `Name: ${displayName}`,
    `Email: ${alert.email}`,
    `Rejection Rate: ${alert.rejection_rate_percent.toFixed(1)}% (threshold ${alert.threshold_percent}%)`,
    `Total Reviews: ${alert.total_reviews}`,
    `Total Rejections: ${alert.total_rejections}`,
    `Credits Remaining: INR ${alert.credits_balance.toFixed(0)}`,
    '',
    `Block now: ${blockCmd}`,
    `Unblock later: ${unblockCmd}`,
  ].join('\n');

  await sendMessage(CHAT_ID, text);
}

export async function setWebhook(publicUrl: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  const webhookUrl = `${publicUrl}/webhooks/telegram`;
  const body: Record<string, string> = { url: webhookUrl };

  // Pass secret_token if configured so Telegram includes it in X-Telegram-Bot-Api-Secret-Token header
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    body.secret_token = secret;
  }

  const res = await telegramFetch(apiUrl('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { ok: boolean };
  return data.ok === true;
}

export async function sendInterestSignup(signup: {
  name: string;
  email: string;
  isBot: boolean;
}): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const header = signup.isBot
    ? `\u{1F6A8} *Bot Interest Signup \\(spam\\)*`
    : `\u{1F514} *New Interest Signup*`;

  const text = [
    header,
    ``,
    `*Name:* ${escapeMarkdown(signup.name)}`,
    `*Email:* ${escapeMarkdown(signup.email)}`,
    ...(signup.isBot ? [``, `_Flagged by anti\\-spam: honeypot or time check failed_`] : []),
  ].join('\n');

  await telegramFetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
    }),
  });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export async function sendMessage(chatId: string | number, text: string): Promise<void> {
  if (!BOT_TOKEN) return;

  await telegramFetch(apiUrl('sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
}
