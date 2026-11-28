import type {
  AppSettings,
  ChannelDeliveryState,
  NotificationAudience,
  NotificationEventType,
  NotificationRecord,
} from '@/types/amanat';

export const MAJOR_MILESTONES = [25, 50, 75, 100] as const;

export function detectCrossedMajorMilestone(
  prevAmount: number,
  newAmount: number,
  targetAmount: number
): number | null {
  const safeTarget = Math.max(1, targetAmount);
  const prevPct = Math.floor((prevAmount / safeTarget) * 100);
  const newPct = Math.min(100, Math.floor((newAmount / safeTarget) * 100));

  let crossed: number | null = null;
  for (const m of MAJOR_MILESTONES) {
    if (prevPct < m && newPct >= m) {
      crossed = m;
    }
  }
  return crossed;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTelegramProgressBar(pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round(clamped / 10);
  return `${'🟩'.repeat(filled)}${'⬜'.repeat(10 - filled)} ${clamped}%`;
}

export interface BuildMilestoneNotificationArgs {
  event_type: NotificationEventType;
  audience: NotificationAudience;
  target_code: string;
  case_id: string | null;
  campaign_id: string | null;
  title_en: string;
  title_ur: string;
  body_en: string;
  body_ur: string;
  vendor_name: string;
  district: string;
  collected_pkr?: number;
  target_pkr?: number;
  milestone_pct?: number | null;
  senderEmail: string;
  recipient_emails: string[];
  recipient_telegram_ids: string[];
}

export function buildBrandedEmailHtml(args: BuildMilestoneNotificationArgs): string {
  const pct =
    args.milestone_pct ??
    (args.target_pkr && args.collected_pkr !== undefined
      ? Math.min(100, Math.round((args.collected_pkr / Math.max(1, args.target_pkr)) * 100))
      : null);

  const remaining =
    args.target_pkr && args.collected_pkr !== undefined
      ? Math.max(0, args.target_pkr - args.collected_pkr)
      : null;

  const audienceLabel =
    args.audience === 'both'
      ? 'Donors & Deserving Household Update'
      : args.audience === 'donor'
      ? 'Donor Escrow Update'
      : 'Confidential Applicant Update';

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F3F7F5;font-family:'Segoe UI',Arial,sans-serif;color:#0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #D1FAE5;box-shadow:0 12px 32px rgba(6,78,59,0.08);">
          <tr>
            <td style="background:#064E3B;padding:22px 26px;color:#FFFFFF;border-bottom:3px solid #D97706;">
              <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#FDE68A;font-weight:700;">${escapeHtml(audienceLabel)} · ${escapeHtml(args.target_code)}</div>
              <div style="font-size:20px;font-weight:800;margin-top:5px;">Amanat (امانت) — Direct Welfare Escrow</div>
              <div style="font-size:12px;color:#D1FAE5;margin-top:3px;">0% Platform Fee · ${escapeHtml(args.district)}, Punjab</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">
              <h1 style="margin:0 0 10px 0;font-size:20px;color:#064E3B;line-height:1.3;">${escapeHtml(args.title_en)}</h1>
              <p style="margin:0 0 14px 0;font-size:14px;color:#334155;line-height:1.65;">${escapeHtml(args.body_en)}</p>
              <div dir="rtl" style="margin:0 0 18px 0;padding:12px 14px;background:#ECFDF5;border-right:4px solid #059669;border-radius:10px;font-size:14px;color:#064E3B;line-height:1.9;">
                <strong>${escapeHtml(args.title_ur)}</strong><br/>${escapeHtml(args.body_ur)}
              </div>
              ${
                pct !== null && args.target_pkr !== undefined && args.collected_pkr !== undefined
                  ? `<div style="margin:18px 0;padding:16px;background:#F8FAF9;border:1px solid #E2E8F0;border-radius:14px;">
                      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#064E3B;margin-bottom:8px;">
                        <span>Confirmed Escrow: PKR ${args.collected_pkr.toLocaleString('en-PK')} (${pct}%)</span>
                        <span>Target: PKR ${args.target_pkr.toLocaleString('en-PK')}</span>
                      </div>
                      <div style="height:12px;background:#E2E8F0;border-radius:999px;overflow:hidden;">
                        <div style="height:12px;width:${pct}%;background:linear-gradient(90deg,#065F46,#10B981);border-radius:999px;"></div>
                      </div>
                      ${
                        remaining !== null
                          ? `<div style="margin-top:8px;font-size:12px;color:#64748B;">Remaining to close vendor invoice: <strong>PKR ${remaining.toLocaleString('en-PK')}</strong></div>`
                          : ''
                      }
                    </div>`
                  : ''
              }
              <div style="padding:14px 16px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;font-size:12px;color:#78350F;">
                <strong>Named Escrow Vendor:</strong> ${escapeHtml(args.vendor_name)}<br/>
                <span style="color:#92400E;">Zero raw cash is disbursed — funds settle directly against verified vendor invoices.</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#F8FAF9;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;text-align:center;">
              Sent officially from <strong>${escapeHtml(args.senderEmail)}</strong> · Amanat Direct Welfare PWA, Punjab, Pakistan
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildTelegramCardText(args: BuildMilestoneNotificationArgs): string {
  const pct =
    args.milestone_pct ??
    (args.target_pkr && args.collected_pkr !== undefined
      ? Math.min(100, Math.round((args.collected_pkr / Math.max(1, args.target_pkr)) * 100))
      : null);

  const lines = [
    `🕌 <b>Amanat (امانت) · ${escapeHtml(args.target_code)}</b>`,
    `<b>${escapeHtml(args.title_en)}</b>`,
    '',
    escapeHtml(args.body_en),
    '',
    `<i>${escapeHtml(args.title_ur)}</i>`,
    escapeHtml(args.body_ur),
  ];

  if (pct !== null && args.target_pkr !== undefined && args.collected_pkr !== undefined) {
    lines.push(
      '',
      `📊 <b>Progress:</b> ${buildTelegramProgressBar(pct)}`,
      `💚 <b>Confirmed:</b> PKR ${args.collected_pkr.toLocaleString('en-PK')} / PKR ${args.target_pkr.toLocaleString('en-PK')}`
    );
  }

  lines.push(
    '',
    `🏥 <b>Escrow Vendor:</b> ${escapeHtml(args.vendor_name)}`,
    `📍 <b>District:</b> ${escapeHtml(args.district)}, Punjab`,
    `✉️ <i>Support: ${escapeHtml(args.senderEmail)}</i>`
  );

  return lines.join('\n');
}

export function createNotificationRecord(
  args: BuildMilestoneNotificationArgs
): NotificationRecord {
  const uniqueEmails = Array.from(
    new Set(args.recipient_emails.map((e) => e.trim()).filter(Boolean))
  );
  const uniqueTg = Array.from(
    new Set(args.recipient_telegram_ids.map((id) => id.trim()).filter(Boolean))
  );

  return {
    id: `ntf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    event_type: args.event_type,
    audience: args.audience,
    target_code: args.target_code,
    case_id: args.case_id,
    campaign_id: args.campaign_id,
    milestone_pct: args.milestone_pct ?? null,
    title_en: args.title_en,
    title_ur: args.title_ur,
    body_en: args.body_en,
    body_ur: args.body_ur,
    email_subject: `Amanat ${args.target_code}: ${args.title_en}`,
    email_html: buildBrandedEmailHtml(args),
    telegram_text: buildTelegramCardText(args),
    recipient_emails: uniqueEmails,
    recipient_telegram_ids: uniqueTg,
    channels_status: {
      app: 'delivered',
      email: uniqueEmails.length > 0 ? 'preview' : 'preview',
      telegram: uniqueTg.length > 0 ? 'preview' : 'preview',
    },
    read: false,
    created_at: new Date().toISOString(),
  };
}

/** Dispatches to Native PWA Web Notification, Live Telegram Bot (if configured), and Gmail Edge Function (if configured) */
export async function dispatchMultiChannelNotification(
  record: NotificationRecord,
  settings: AppSettings
): Promise<NotificationRecord['channels_status']> {
  const status: NotificationRecord['channels_status'] = {
    app: 'delivered',
    email: 'preview',
    telegram: 'preview',
  };

  // 1. Native Browser / PWA Notification (when permission granted)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(`Amanat (${record.target_code}) — ${record.title_en}`, {
          body: record.body_en,
          icon: '/pwa-192x192.svg',
        });
      } catch {
        // Ignore if browser blocks direct constructor in favor of SW
      }
    }
  }

  // 2. Live Telegram Bot API dispatch (if Bot Token + target chat IDs exist)
  const botToken = settings.telegram_config.botToken.trim();
  const tgTargets =
    record.recipient_telegram_ids.length > 0
      ? record.recipient_telegram_ids
      : settings.telegram_config.chatId.trim()
      ? [settings.telegram_config.chatId.trim()]
      : [];

  if (botToken && tgTargets.length > 0) {
    let okCount = 0;
    for (const chatId of tgTargets) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: record.telegram_text,
            parse_mode: 'HTML',
          }),
        });
        if (res.ok) okCount += 1;
      } catch {
        // Keep preview/failed gracefully
      }
    }
    status.telegram = okCount > 0 ? 'delivered' : 'failed';
  }

  // 3. Live Gmail SMTP via Supabase Edge Function (if configured)
  const edgeUrl = settings.email_gateway?.edgeFunctionUrl?.trim();
  if (edgeUrl && record.recipient_emails.length > 0) {
    try {
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderEmail: settings.email_gateway?.senderEmail ?? 'support.amanat@gmail.com',
          recipientEmails: record.recipient_emails,
          emailSubject: record.email_subject,
          emailHtml: record.email_html,
          recipientTelegramIds: [],
          telegramText: record.telegram_text,
        }),
      });
      status.email = res.ok ? 'delivered' : 'failed';
    } catch {
      status.email = 'failed';
    }
  }

  return status;
}
