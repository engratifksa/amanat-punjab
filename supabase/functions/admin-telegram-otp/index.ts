// Supabase Edge Function (Deno) — Zero-Cost Server-Side Admin Telegram 2FA
// Deploy with: supabase functions deploy admin-telegram-otp
// Set secrets:
//   supabase secrets set TELEGRAM_BOT_TOKEN=<token> TELEGRAM_CHAT_ID=<chat_id> ADMIN_PASSWORD_SHA256=<hash>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const otpStore = new Map<string, { code: string; expiresAt: number }>();

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, passwordHash, otp } = body as {
      action: 'request_otp' | 'verify_otp';
      passwordHash?: string;
      otp?: string;
    };

    const expectedHash = Deno.env.get('ADMIN_PASSWORD_SHA256') ?? '';
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID') ?? '';

    if (action === 'request_otp') {
      if (!passwordHash || passwordHash !== expectedHash) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid admin password' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const code = String(100000 + (arr[0] % 900000));
      otpStore.set('admin', { code, expiresAt: Date.now() + 5 * 60 * 1000 });

      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          parse_mode: 'HTML',
          text: `<b>Amanat Admin 2FA OTP</b>\n\nYour one-time verification code is: <code>${code}</code>\nExpires in 5 minutes. Never share this code.`,
        }),
      });

      if (!tgRes.ok) {
        return new Response(JSON.stringify({ ok: false, error: 'Failed to dispatch Telegram OTP' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true, message: 'OTP sent to Telegram' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify_otp') {
      const record = otpStore.get('admin');
      if (!record || Date.now() > record.expiresAt || record.code !== otp) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired OTP' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      otpStore.delete('admin');
      return new Response(JSON.stringify({ ok: true, verifiedAt: new Date().toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Unsupported action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
