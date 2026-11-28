import type { TelegramSecurityConfig } from '@/types/amanat';

const SESSION_KEY = 'amanat_admin_session_v1';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes inactivity/session limit
const PASSWORD_SALT = 'amanat-punjab-escrow-v1::';

export const DEFAULT_INITIAL_PASSWORD = 'Amanat@2026';

export async function hashAdminPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${PASSWORD_SALT}${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSecureOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export interface OtpDispatchResult {
  sentVia: 'telegram' | 'local_setup_fallback';
  expiresAt: number;
  demoCode?: string;
  error?: string;
}

export async function sendTelegramOtp(
  otp: string,
  config: TelegramSecurityConfig,
  customMessage?: string,
  forceLiveTelegram = false
): Promise<OtpDispatchResult> {
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const botToken = config.botToken.trim();
  const chatId = config.chatId.trim();

  // Only dispatch live Telegram OTP for Gate 2 when the toggle is explicitly enabled
  // (or when Admin clicks "Send Test OTP" with forceLiveTelegram = true).
  const shouldUseLiveTelegram =
    Boolean(botToken && chatId) && (forceLiveTelegram || Boolean(config.requireRealTelegramOtp));

  if (shouldUseLiveTelegram) {
    try {
      const text =
        customMessage ??
        `🔐 *Amanat Admin 2FA OTP*\n\nYour 6-digit verification code is: \`${otp}\`\nValid for 5 minutes. Never share this code.`;

      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
      if (res.ok) {
        return { sentVia: 'telegram', expiresAt };
      }
      const errJson = await res.json().catch(() => ({}));
      const errMsg =
        (errJson as { description?: string }).description ??
        `Telegram API responded with ${res.status}`;
      if (config.requireRealTelegramOtp) {
        return { sentVia: 'telegram', expiresAt, error: errMsg };
      }
      return {
        sentVia: 'local_setup_fallback',
        expiresAt,
        demoCode: otp,
        error: `Telegram delivery failed (${errMsg}). Using setup fallback.`,
      };
    } catch (e) {
      if (config.requireRealTelegramOtp) {
        return {
          sentVia: 'telegram',
          expiresAt,
          error: `Network error contacting Telegram: ${String(e)}`,
        };
      }
      return {
        sentVia: 'local_setup_fallback',
        expiresAt,
        demoCode: otp,
        error: 'Could not reach Telegram API. Using local setup fallback.',
      };
    }
  }

  return {
    sentVia: 'local_setup_fallback',
    expiresAt,
    demoCode: otp,
  };
}

export function setAdminSession(): void {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ authenticated: true, expiresAt }));
}

export function hasValidAdminSession(): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { authenticated: boolean; expiresAt: number };
    if (parsed.authenticated && Date.now() < parsed.expiresAt) {
      return true;
    }
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  } catch {
    return false;
  }
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
