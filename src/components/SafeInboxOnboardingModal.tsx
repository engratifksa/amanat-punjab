import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Contact,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button, Input } from './ui/primitives';
import { TelegramGuideModal } from './TelegramGuideModal';

export const SAFE_INBOX_KEY_PREFIX = 'amanat_safe_inbox_done_v1::';

interface SafeInboxOnboardingModalProps {
  isOpen: boolean;
  userEmail: string;
  userName: string;
  officialEmail?: string;
  initialTelegramId?: string;
  onSaveTelegramId: (telegramChatId: string) => Promise<void>;
  onComplete: () => void;
  onDismissLater: () => void;
}

export function SafeInboxOnboardingModal({
  isOpen,
  userEmail,
  userName,
  officialEmail = 'support.amanat@gmail.com',
  initialTelegramId = '',
  onSaveTelegramId,
  onComplete,
  onDismissLater,
}: SafeInboxOnboardingModalProps) {
  const [telegramId, setTelegramId] = useState(initialTelegramId);
  const [showGuide, setShowGuide] = useState(false);
  const [whitelistedClicked, setWhitelistedClicked] = useState(false);
  const [vcardDownloaded, setVcardDownloaded] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const mailtoHref = `mailto:${encodeURIComponent(officialEmail)}?subject=${encodeURIComponent(
    'Salam Amanat — Activate My Primary Inbox Alerts'
  )}&body=${encodeURIComponent(
    `Assalam-o-Alaikum Amanat Team,\n\nI am ${userName} (${userEmail}). Please keep my Amanat escrow receipts, Visit PINs, and milestone updates active in my Primary Inbox.\n\nJazakAllah Khair!`
  )}`;

  const handleDownloadVcard = () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Amanat Direct Welfare (Official)',
      'ORG:Amanat Direct Welfare Escrow (Punjab)',
      `EMAIL;TYPE=INTERNET:${officialEmail}`,
      'URL:https://amanat-punjab.vercel.app',
      'NOTE:Official Amanat Escrow Receipts, Visit PINs & Milestone Alerts (0% Fee).',
      'END:VCARD',
    ].join('\r\n');
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Amanat-Official-Contact.vcf';
    a.click();
    URL.revokeObjectURL(url);
    setVcardDownloaded(true);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (telegramId.trim()) {
        await onSaveTelegramId(telegramId.trim());
      }
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[135] flex items-center justify-center bg-emerald-950/75 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Activate Safe Inbox & Telegram Alerts"
    >
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-glass-lg border border-emerald-900/20">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 bg-emerald-950 px-5 py-4 text-white">
          <div>
            <Badge
              variant="gold"
              className="mb-1.5 bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              One-Time 10-Second Setup · Never Miss an Alert
            </Badge>
            <h2 className="text-base sm:text-lg font-extrabold leading-snug">
              Keep Amanat Emails Out of Spam
            </h2>
            <p className="text-[11px] text-emerald-200/85 mt-0.5">
              Assalam-o-Alaikum {userName}! Follow 1 quick step so your QR Receipts, 4-Digit Visit
              PINs &amp; Milestones land straight in your Primary Inbox.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissLater}
            aria-label="Close Safe Inbox Setup"
            className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Step 1: 1-Tap Gmail Whitelist + vCard */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-900 text-[11px] font-black text-gold-300">
                1
              </span>
              <div className="space-y-1 text-xs">
                <p className="font-extrabold text-emerald-950">
                  Mark <span className="font-mono">{officialEmail}</span> as Safe Sender (1 Tap)
                </p>
                <p className="text-slate-700 leading-relaxed">
                  Tap <strong>Send 1-Tap Hello</strong> (opens a pre-filled email — just hit Send)
                  OR <strong>Save Official Contact</strong>. Gmail permanently trusts senders you
                  message or save in Contacts!
                </p>
                <p dir="rtl" className="text-emerald-900 leading-relaxed font-semibold">
                  نیچے بٹن دبا کر ایک بار {officialEmail} کو تیار شدہ ای میل بھیج دیں یا کانٹیکٹ
                  محفوظ کر لیں تاکہ ہماری تمام رسیدیں اور خفیہ پن براہِ راست ان باکس میں آئیں۔
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={mailtoHref}
                onClick={() => setWhitelistedClicked(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-800 transition-colors"
              >
                {whitelistedClicked ? (
                  <CheckCircle2 className="h-4 w-4 text-gold-300" />
                ) : (
                  <Mail className="h-4 w-4 text-gold-300" />
                )}
                <span>{whitelistedClicked ? 'Email App Opened!' : '1-Tap Whitelist Email'}</span>
              </a>

              <button
                type="button"
                onClick={handleDownloadVcard}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-900/20 bg-white px-3 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-50 transition-colors"
              >
                {vcardDownloaded ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                ) : (
                  <Contact className="h-4 w-4 text-gold-600" />
                )}
                <span>{vcardDownloaded ? 'Contact Saved (.vcf)' : 'Save Official Contact (.vcf)'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-600 bg-white/80 rounded-xl px-3 py-2 border border-emerald-200/70">
              <strong>Already saw an email in Spam?</strong> Open it once and tap{' '}
              <strong>&ldquo;Report not spam&rdquo;</strong> — all future alerts will land in your
              Primary Inbox automatically.
            </p>
          </div>

          {/* Step 2: Optional 100% Spam-Free Telegram Alerts */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-700 text-[11px] font-black text-white">
                  2
                </span>
                <p className="text-xs font-extrabold text-sky-950">
                  Optional: Instant Spam-Free Telegram Alerts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(true)}
                className="text-xs font-extrabold text-sky-700 hover:underline"
              >
                How to get Telegram ID?
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              Telegram alerts never hit Spam. Enter your numeric Chat ID below to receive your
              personal receipts &amp; updates directly on Telegram.
            </p>
            <Input
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value.replace(/\D/g, ''))}
              placeholder="Your Telegram Chat ID (optional, e.g. 987654321)"
              className="font-mono bg-white"
            />
          </div>

          <div className="space-y-2 pt-1">
            <Button
              type="button"
              variant="gold"
              size="lg"
              className="w-full"
              disabled={saving}
              onClick={handleFinish}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Done — Activate My Safe Alerts'}</span>
            </Button>
            <button
              type="button"
              onClick={onDismissLater}
              className="w-full text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 py-1"
            >
              I&apos;ll do this later
            </button>
          </div>
        </div>
      </div>

      <TelegramGuideModal isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </div>,
    document.body
  );
}
