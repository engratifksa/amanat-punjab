import type { Profile } from '@/types/amanat';

export const QR_STEP_SECONDS = 60;

export function getCurrentTimeStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / QR_STEP_SECONDS);
}

export function getSecondsRemainingInWindow(nowMs = Date.now()): number {
  const sec = Math.floor(nowMs / 1000);
  return QR_STEP_SECONDS - (sec % QR_STEP_SECONDS);
}

export function generateQrSecretHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeHmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateDynamicVerifierToken(
  verifierId: string,
  secret: string,
  nowMs = Date.now()
): Promise<{ qrPayload: string; sixDigitCode: string; step: number }> {
  const step = getCurrentTimeStep(nowMs);
  const hmac = await computeHmacHex(secret, `AMANAT-VF:${verifierId}:${step}`);
  const shortSig = hmac.slice(0, 16);
  // Deterministic 6-digit numeric fallback code for phones with broken cameras
  const num = parseInt(hmac.slice(0, 8), 16) % 900000;
  const sixDigitCode = String(100000 + num);
  return {
    qrPayload: `AMANAT-VF|${verifierId}|${step}|${shortSig}`,
    sixDigitCode,
    step,
  };
}

export interface VerifierScanResult {
  valid: boolean;
  reason: 'verified' | 'expired_screenshot' | 'revoked_or_unaccredited' | 'invalid_format' | 'forged';
  verifier?: Profile;
  messageEn: string;
  messageUr: string;
}

/**
 * Verifies either a scanned dynamic QR string (`AMANAT-VF|<id>|<step>|<sig>`)
 * OR a manual 6-digit live code against all accredited Field Verifiers.
 * Allows +/- 1 time window (~60s clock drift) and strictly rejects older screenshots!
 */
export async function verifyDynamicVerifierInput(
  rawInput: string,
  profiles: Profile[],
  nowMs = Date.now()
): Promise<VerifierScanResult> {
  const trimmed = rawInput.trim();
  const currentStep = getCurrentTimeStep(nowMs);

  // Path A: 6-digit manual fallback code
  if (/^\d{6}$/.test(trimmed)) {
    const accredited = profiles.filter(
      (p) => p.is_accredited_verifier && Boolean(p.verifier_qr_secret)
    );
    for (const v of accredited) {
      for (const offset of [0, -1, 1]) {
        const testStep = currentStep + offset;
        const hmac = await computeHmacHex(v.verifier_qr_secret!, `AMANAT-VF:${v.id}:${testStep}`);
        const code = String(100000 + (parseInt(hmac.slice(0, 8), 16) % 900000));
        if (code === trimmed) {
          return {
            valid: true,
            reason: 'verified',
            verifier: v,
            messageEn: `Authorized Amanat Field Verifier confirmed for ${v.tehsil}, ${v.district}. Remember: Amanat NEVER asks for cash or fees.`,
            messageUr: `تصدیق ہو گئی! یہ امانت کے مستند فیلڈ ویریفائر ہیں۔ یاد رکھیں: امانت کبھی بھی فیس یا نقد رقم نہیں مانگتا۔`,
          };
        }
      }
    }
    return {
      valid: false,
      reason: 'expired_screenshot',
      messageEn:
        'Code not recognized or expired (>60s). Do NOT share personal documents or pay any money!',
      messageUr:
        'کوڈ غلط ہے یا معیاد ختم ہو چکی ہے۔ خبردار! کسی غیر مستند شخص کو شناختی کارڈ یا رقم ہرگز نہ دیں۔',
    };
  }

  // Path B: Scanned Dynamic QR payload
  if (!trimmed.startsWith('AMANAT-VF|')) {
    return {
      valid: false,
      reason: 'invalid_format',
      messageEn: 'This QR code is NOT an official Amanat Field Verifier ID. Beware of impersonators!',
      messageUr: 'یہ کیو آر کوڈ امانت کا مستند ویریفائر کارڈ نہیں ہے۔ جعلسازی سے ہوشیار رہیں!',
    };
  }

  const parts = trimmed.split('|');
  if (parts.length !== 4) {
    return {
      valid: false,
      reason: 'invalid_format',
      messageEn: 'Malformed Amanat QR code. Possible forgery.',
      messageUr: 'ناقص کیو آر کوڈ — ممکنہ جعلسازی!',
    };
  }

  const [, verifierId, stepStr, sig] = parts;
  const step = Number(stepStr);
  const verifier = profiles.find((p) => p.id === verifierId);

  if (!verifier || !verifier.is_accredited_verifier || !verifier.verifier_qr_secret) {
    return {
      valid: false,
      reason: 'revoked_or_unaccredited',
      messageEn:
        'ALERT: This person is NOT currently accredited by the Amanat Board (or their badge was revoked). Do NOT share CNIC or money!',
      messageUr:
        'خبردار! یہ شخص امانت بورڈ سے مستند نہیں ہے (یا اس کی سند منسوخ ہو چکی ہے)۔ ہرگز تعاون یا ادائیگی نہ کریں!',
    };
  }

  // Check time window strictly (reject screenshots older than ~60-90 seconds)
  if (!Number.isFinite(step) || Math.abs(currentStep - step) > 1) {
    return {
      valid: false,
      reason: 'expired_screenshot',
      verifier,
      messageEn:
        'EXPIRED QR CODE (Possible Screenshot Scam)! Genuine Amanat badges refresh every 60 seconds. Ask the visitor to open their live Amanat app.',
      messageUr:
        'اس کیو آر کوڈ کی معیاد ختم ہو چکی ہے (ممکنہ اسکرین شاٹ دھوکہ)! اصلی امانت کارڈ ہر 60 سیکنڈ بعد بدلتا ہے۔',
    };
  }

  const expectedHmac = await computeHmacHex(
    verifier.verifier_qr_secret,
    `AMANAT-VF:${verifier.id}:${step}`
  );
  if (expectedHmac.slice(0, 16) !== sig) {
    return {
      valid: false,
      reason: 'forged',
      messageEn: 'FRAUD ALERT: Cryptographic signature mismatch! This QR code has been tampered with.',
      messageUr: 'دھوکہ دہی کا الرٹ! اس کیو آر کوڈ میں تبدیلی کی گئی ہے۔',
    };
  }

  return {
    valid: true,
    reason: 'verified',
    verifier,
    messageEn: `AUTHORIZED AMANAT FIELD VERIFIER — ${verifier.full_name} (${verifier.tehsil}, ${verifier.district}). Amanat NEVER charges fees or asks for cash.`,
    messageUr: `مستند امانت فیلڈ ویریفائر — ${verifier.full_name} (${verifier.district})۔ امانت کبھی کوئی فیس یا نقد رقم نہیں لیتا۔`,
  };
}
