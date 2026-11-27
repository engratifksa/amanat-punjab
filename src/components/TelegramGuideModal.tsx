import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Send, ExternalLink, CheckCircle2, Sparkles, Copy } from 'lucide-react';
import { Badge, Button } from './ui/primitives';

interface TelegramGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TelegramGuideModal({ isOpen, onClose }: TelegramGuideModalProps) {
  if (!isOpen) return null;

  const steps = [
    {
      num: '01',
      titleEn: 'Open @AmanatTelegramBot & Tap "START"',
      titleUr: 'پہلا مرحلہ: @AmanatTelegramBot کھولیں اور START دبائیں',
      descEn:
        'Telegram requires you to tap START once so our official Amanat bot is allowed to send you milestone & Paid Vendor Receipt alerts.',
      descUr:
        'ٹیلیگرام کی رازداری کے اصول کے تحت، آپ کو ایک بار START بٹن دبانا ضروری ہے تاکہ امانت بوٹ آپ کو براہِ راست پیغامات بھیج سکے۔',
      ctaLabel: 'Open @AmanatTelegramBot',
      ctaUrl: 'https://t.me/AmanatTelegramBot?start=subscribe',
      ctaStyle: 'bg-sky-500 hover:bg-sky-600 text-white',
    },
    {
      num: '02',
      titleEn: 'Get Your Numeric Chat ID via @userinfobot',
      titleUr: 'دوسرا مرحلہ: @userinfobot سے اپنا عددی Chat ID حاصل کریں',
      descEn:
        'Tap the button below to open @userinfobot, press START, and copy the numeric "Id:" number it replies with (for example: 987654321).',
      descUr:
        'نیچے دیے گئے بٹن پر کلک کر کے @userinfobot کھولیں، START دبائیں، اور جواب میں آنے والا عددی "Id:" نمبر (مثلاً 987654321) کاپی کریں۔',
      ctaLabel: 'Open @userinfobot',
      ctaUrl: 'https://t.me/userinfobot',
      ctaStyle: 'bg-emerald-800 hover:bg-emerald-900 text-white',
    },
    {
      num: '03',
      titleEn: 'Paste Your Chat ID in Amanat',
      titleUr: 'تیسرا مرحلہ: اپنا Chat ID امانت میں درج کریں',
      descEn:
        'Paste that number into the Telegram Chat ID field. You will now receive automatic bilingual updates at 25%, 50%, 75%, 100%, and Paid Vendor Receipt!',
      descUr:
        'وہ نمبر امانت کے Telegram Chat ID خانے میں پیسٹ کریں۔ اب آپ کو 25%، 50%، 75%، 100% اور وینڈر رسید کی خودکار اطلاع ملے گی!',
      ctaLabel: null,
      ctaUrl: null,
      ctaStyle: '',
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-emerald-950/75 p-3 sm:p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="How to Get Telegram Chat ID & Subscribe"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-glass-lg border border-emerald-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-[#022C22] via-[#064E3B] to-[#0C4A6E] px-5 py-4 text-white shrink-0">
          <div>
            <Badge
              variant="gold"
              className="mb-1.5 bg-gold-500/20 text-gold-200 border-gold-400/35"
            >
              <Sparkles className="h-3.5 w-3.5" />
              30-Second Setup · 100% Free Instant Alerts
            </Badge>
            <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Send className="h-4 w-4 text-sky-300" />
              <span>How to Connect Telegram Alerts</span>
            </h2>
            <p className="text-[11px] text-emerald-100/85 mt-0.5">
              ٹیلیگرام پر فوری اطلاعات اور اپنا Chat ID حاصل کرنے کا آسان طریقہ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Telegram Guide"
            className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Animated Step-by-Step Cards */}
          {steps.map((s, idx) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
              className="rounded-2xl border border-emerald-900/10 bg-alabaster p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-900 font-mono text-xs font-extrabold text-gold-300">
                    {s.num}
                  </span>
                  <h3 className="text-xs sm:text-sm font-extrabold text-emerald-950">
                    {s.titleEn}
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{s.descEn}</p>
              <p dir="rtl" className="text-xs font-semibold text-emerald-900 leading-loose">
                {s.titleUr} — {s.descUr}
              </p>

              {s.ctaUrl && s.ctaLabel && (
                <div className="pt-1">
                  <a
                    href={s.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition ${s.ctaStyle}`}
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{s.ctaLabel}</span>
                    <ExternalLink className="h-3 w-3 opacity-80" />
                  </a>
                </div>
              )}
            </motion.div>
          ))}

          {/* Animated Mini Telegram Chat Preview showing what @userinfobot looks like */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl bg-[#17212B] p-4 text-slate-100 border border-sky-500/25 space-y-2"
          >
            <div className="flex items-center justify-between text-[11px] text-sky-300 font-bold">
              <span>Example reply from @userinfobot</span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Copy className="h-3 w-3" /> Copy only the numbers
              </span>
            </div>
            <div className="rounded-xl bg-[#242F3D] p-3 font-mono text-xs space-y-1">
              <p className="text-slate-300">@your_username</p>
              <p className="flex items-center gap-2">
                <span className="text-slate-400">Id:</span>
                <motion.span
                  animate={{ scale: [1, 1.07, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="rounded bg-gold-500/25 border border-gold-400 px-2 py-0.5 font-extrabold text-gold-300"
                >
                  987654321
                </motion.span>
                <span className="text-[10px] text-emerald-300">← Paste this in Amanat!</span>
              </p>
              <p className="text-slate-400">First: Your Name</p>
            </div>
          </motion.div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Official Bot: t.me/AmanatTelegramBot
            </span>
            <Button variant="primary" size="sm" onClick={onClose}>
              Got It, Ready to Paste
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
