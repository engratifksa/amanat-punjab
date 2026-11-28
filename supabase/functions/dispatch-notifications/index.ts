// Supabase Edge Function (Deno) — Zero-Cost 3-Channel Notification Dispatcher
// Primary Email: Resend Free Tier (notifications@amanatpunjab.org, Reply-To: support@amanatpunjab.org)
//                with SPF + DKIM + DMARC alignment for Primary Inbox placement.
// Automatic Fallback: Gmail SMTP (support.amanat@gmail.com) if Resend is unconfigured,
//                     domain is still verifying, or daily free quota (100/day) is reached.
// Telegram: Rich HTML cards via free Telegram Bot API.

import nodemailer from 'npm:nodemailer@6.9.16';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DispatchPayload {
  senderEmail?: string;
  recipientEmails: string[];
  emailSubject: string;
  emailHtml: string;
  emailText?: string;
  recipientTelegramIds: string[];
  telegramText: string;
}

function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as DispatchPayload;
    const resendApiKey = (Deno.env.get('RESEND_API_KEY') ?? '').trim();
    const resendFrom =
      (Deno.env.get('RESEND_FROM_EMAIL') ?? '').trim() ||
      'Amanat Direct Welfare <notifications@amanatpunjab.org>';
    const resendReplyTo =
      (Deno.env.get('RESEND_REPLY_TO') ?? '').trim() || 'support@amanatpunjab.org';

    const gmailUser =
      Deno.env.get('GMAIL_USER') ?? payload.senderEmail ?? 'support.amanat@gmail.com';
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? '';
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

    const results = {
      email: 'skipped' as 'delivered' | 'failed' | 'skipped',
      emailProvider: 'none' as 'resend' | 'gmail' | 'mixed' | 'none',
      telegram: 'skipped' as 'delivered' | 'failed' | 'skipped',
      emailCount: 0,
      telegramCount: 0,
    };

    const uniqueRecipients = Array.from(
      new Set(
        (payload.recipientEmails ?? [])
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes('@'))
      )
    );

    // 1. Dispatch Transactional Emails (Resend Primary → Gmail SMTP Automatic Fallback)
    if (uniqueRecipients.length > 0 && (resendApiKey || gmailAppPassword)) {
      const plainText =
        payload.emailText?.trim() || stripHtmlToPlainText(payload.emailHtml);

      let resendSent = 0;
      let gmailSent = 0;
      const fallbackRecipients: string[] = [];

      if (resendApiKey) {
        for (const toAddr of uniqueRecipients) {
          try {
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: resendFrom,
                to: [toAddr],
                reply_to: resendReplyTo,
                subject: payload.emailSubject,
                text: plainText,
                html: payload.emailHtml,
                headers: {
                  'X-Auto-Response-Suppress': 'All',
                },
              }),
            });

            if (res.ok) {
              resendSent += 1;
            } else {
              const errBody = await res.text();
              console.warn(`Resend failed for ${toAddr} (${res.status}), falling back to Gmail SMTP:`, errBody);
              fallbackRecipients.push(toAddr);
            }
          } catch (singleErr) {
            console.warn(`Resend network error for ${toAddr}, falling back to Gmail SMTP:`, singleErr);
            fallbackRecipients.push(toAddr);
          }
        }
      } else {
        fallbackRecipients.push(...uniqueRecipients);
      }

      // Automatic Gmail SMTP fallback for any unsent recipients (zero lost emails)
      if (fallbackRecipients.length > 0 && gmailAppPassword) {
        try {
          const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
              user: gmailUser,
              pass: gmailAppPassword,
            },
          });

          for (const toAddr of fallbackRecipients) {
            try {
              await transporter.sendMail({
                from: `"Amanat Direct Welfare" <${gmailUser}>`,
                to: toAddr,
                replyTo: resendReplyTo || gmailUser,
                subject: payload.emailSubject,
                text: plainText,
                html: payload.emailHtml,
                headers: {
                  'X-Auto-Response-Suppress': 'All',
                },
              });
              gmailSent += 1;
            } catch (singleErr) {
              console.error(`Gmail SMTP error for ${toAddr}:`, singleErr);
            }
          }
        } catch (err) {
          console.error('Gmail SMTP transport error:', err);
        }
      }

      const totalSent = resendSent + gmailSent;
      results.emailCount = totalSent;
      results.email = totalSent > 0 ? 'delivered' : 'failed';
      results.emailProvider =
        resendSent > 0 && gmailSent > 0
          ? 'mixed'
          : resendSent > 0
            ? 'resend'
            : gmailSent > 0
              ? 'gmail'
              : 'none';
    }

    // 2. Dispatch Rich Telegram Card via Free Telegram Bot API
    if (botToken && payload.recipientTelegramIds.length > 0) {
      let sent = 0;
      for (const chatId of payload.recipientTelegramIds) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: payload.telegramText,
              parse_mode: 'HTML',
            }),
          });
          if (res.ok) sent += 1;
        } catch (err) {
          console.error('Telegram send error:', err);
        }
      }
      results.telegram = sent > 0 ? 'delivered' : 'failed';
      results.telegramCount = sent;
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
