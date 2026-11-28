// Supabase Edge Function (Deno) — Zero-Cost 3-Channel Notification Dispatcher
// Sends clean transactional emails via Gmail SMTP (support.amanat@gmail.com + free Google App Password)
// with individual To: headers + plain-text fallback to maximize Primary Inbox placement,
// and rich Telegram cards via free Telegram Bot API.

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
    const gmailUser = Deno.env.get('GMAIL_USER') ?? payload.senderEmail ?? 'support.amanat@gmail.com';
    const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD') ?? '';
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

    const results = {
      email: 'skipped' as 'delivered' | 'failed' | 'skipped',
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

    // 1. Dispatch Transactional Emails via Gmail SMTP with proper `to:` + `text:` + `html:`
    if (gmailAppPassword && uniqueRecipients.length > 0) {
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

        const plainText =
          payload.emailText?.trim() || stripHtmlToPlainText(payload.emailHtml);

        // Send individual emails with explicit `to:` header (empty To + Bcc-only triggers Gmail Spam!)
        let sentCount = 0;
        for (const toAddr of uniqueRecipients) {
          try {
            await transporter.sendMail({
              from: `"Amanat Direct Welfare" <${gmailUser}>`,
              to: toAddr,
              replyTo: gmailUser,
              subject: payload.emailSubject,
              text: plainText,
              html: payload.emailHtml,
              headers: {
                'X-Auto-Response-Suppress': 'All',
              },
            });
            sentCount += 1;
          } catch (singleErr) {
            console.error(`Gmail SMTP error for ${toAddr}:`, singleErr);
          }
        }

        results.email = sentCount > 0 ? 'delivered' : 'failed';
        results.emailCount = sentCount;
      } catch (err) {
        console.error('Gmail SMTP transport error:', err);
        results.email = 'failed';
      }
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
