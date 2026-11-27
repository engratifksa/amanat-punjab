// Supabase Edge Function (Deno) — Zero-Cost 3-Channel Notification Dispatcher
// Sends branded HTML emails via Gmail SMTP (support.amanat@gmail.com + free Google App Password)
// and rich Telegram cards via free Telegram Bot API.
//
// Deploy: supabase functions deploy dispatch-notifications
// Secrets:
//   supabase secrets set GMAIL_USER=support.amanat@gmail.com GMAIL_APP_PASSWORD=<16-char-app-password>
//   supabase secrets set TELEGRAM_BOT_TOKEN=<bot-token>

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
  recipientTelegramIds: string[];
  telegramText: string;
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

    // 1. Dispatch Branded HTML Email via Gmail SMTP (Free up to 500/day)
    if (gmailAppPassword && payload.recipientEmails.length > 0) {
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

        await transporter.sendMail({
          from: `"Amanat — Sacred Trust (امانت)" <${gmailUser}>`,
          bcc: payload.recipientEmails.join(', '),
          replyTo: gmailUser,
          subject: payload.emailSubject,
          html: payload.emailHtml,
        });

        results.email = 'delivered';
        results.emailCount = payload.recipientEmails.length;
      } catch (err) {
        console.error('Gmail SMTP error:', err);
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
