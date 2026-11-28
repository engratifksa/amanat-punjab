import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import {
  Building2,
  Check,
  Copy,
  Download,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge, Button } from './ui/primitives';
import { cn, formatPKR, getPublicAppUrl } from '@/lib/utils';

export interface ShareableItem {
  type: 'campaign' | 'case';
  code: string;
  title_en: string;
  title_ur: string;
  summary_en: string;
  summary_ur: string;
  district: string;
  tehsil?: string;
  category: string;
  funding_type: 'zakat_eligible' | 'sadaqah_general';
  vendor_name: string;
  target_amount_pkr: number;
  collected_amount_pkr: number;
  donor_count?: number;
  is_completed?: boolean;
  has_video?: boolean;
}

interface SocialShareModalProps {
  item: ShareableItem | null;
  onClose: () => void;
}

type CaptionLang = 'both' | 'en' | 'ur';

export function SocialShareModal({ item, onClose }: SocialShareModalProps) {
  const [captionLang, setCaptionLang] = useState<CaptionLang>('both');
  const [copied, setCopied] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [nativeSharing, setNativeSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement | null>(null);

  if (!item || typeof document === 'undefined') return null;

  const baseUrl = getPublicAppUrl();
  const shareUrl =
    item.type === 'campaign'
      ? `${baseUrl}/?campaign=${encodeURIComponent(item.code)}`
      : `${baseUrl}/?case=${encodeURIComponent(item.code)}`;

  const pct = Math.min(
    100,
    Math.round((item.collected_amount_pkr / Math.max(1, item.target_amount_pkr)) * 100)
  );
  const remaining = Math.max(0, item.target_amount_pkr - item.collected_amount_pkr);
  const locationLabel = item.tehsil
    ? `${item.tehsil}, ${item.district}, Punjab`
    : `${item.district}, Punjab`;
  const fundingEn =
    item.funding_type === 'zakat_eligible' ? 'Zakat & Sadaqah Eligible' : 'Sadaqah & Khairat';
  const fundingUr =
    item.funding_type === 'zakat_eligible' ? 'زکوٰۃ اور صدقہ کے لیے مستحق' : 'صدقہ و خیرات';
  const hashtagDistrict = item.district.replace(/\s+/g, '');

  const englishCaption = `🌿 AMANAT (امانت) — 100% Direct Vendor Escrow · 0% Admin Fee

✨ ${item.title_en} (${item.code})
📍 ${locationLabel} · ${fundingEn}
🏥 Verified Escrow Vendor: ${item.vendor_name}
📊 Progress: ${formatPKR(item.collected_amount_pkr)} raised of ${formatPKR(item.target_amount_pkr)} (${pct}%)${
    remaining > 0 ? ` — ${formatPKR(remaining)} still needed` : ' — Fully Funded! Alhamdulillah'
  }

${item.summary_en}

💚 Every rupee goes directly to the verified vendor — never raw cash, always backed by a QR-verifiable receipt.
🤲 Contribute whatever you can, OR share this message with family & WhatsApp groups — "Whoever guides someone to goodness will have a reward like one who did it."

🔗 Contribute & Track Live${item.has_video ? ' (🎥 Watch Verified Ground Video)' : ''}: ${shareUrl}`;

  const urduCaption = `🌿 امانت (Amanat) — 100% براہِ راست وینڈر ایسکرو · 0% ایڈمن فیس

✨ ${item.title_ur} (${item.code})
📍 ${item.district}، پنجاب · ${fundingUr}
🏥 تصدیق شدہ وینڈر: ${item.vendor_name}
📊 اب تک جمع: ${formatPKR(item.collected_amount_pkr)} / ہدف: ${formatPKR(item.target_amount_pkr)} (${pct}%)${
    remaining > 0 ? ` — مزید ${formatPKR(remaining)} درکار ہیں` : ' — ہدف مکمل ہو گیا، الحمدللہ!'
  }

${item.summary_ur}

💚 آپ کا ہر روپیہ براہِ راست تصدیق شدہ ہسپتال، سکول یا راشن وینڈر کو ادا کیا جاتا ہے اور آپ کو QR رسید ملتی ہے۔
🤲 اپنی استطاعت کے مطابق تعاون کریں، یا کم از کم اس پیغام کو آگے شیئر کر دیں — نیکی کی رہنمائی کرنے والے کو بھی نیکی کرنے والے کے برابر اجر ملتا ہے۔

🔗 تعاون اور لائیو ٹریکنگ${item.has_video ? ' (🎥 تصدیق شدہ گراؤنڈ ویڈیو دیکھیں)' : ''} کے لیے لنک: ${shareUrl}`;

  const hashtags = `#AmanatPunjab #ZakatTransparency #SadaqahJariyah #${hashtagDistrict} #Pakistan`;

  const caption =
    captionLang === 'both'
      ? `${englishCaption}\n\n━━━━━━━━━━━━━━\n\n${urduCaption}\n\n${hashtags}`
      : captionLang === 'en'
      ? `${englishCaption}\n\n${hashtags}`
      : `${urduCaption}\n\n${hashtags}`;

  const shortTweet = `🌿 ${item.title_en} (${item.code}) in ${item.district}, Punjab — ${pct}% funded via Amanat (0% fee, 100% Direct Vendor Escrow). Donate or share to multiply the reward! #AmanatPunjab #SadaqahJariyah`;

  const generatePosterBlob = async (): Promise<Blob | null> => {
    if (!posterRef.current) return null;
    const canvas = await html2canvas(posterRef.current, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: '#022C22',
      logging: false,
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png', 0.96));
  };

  const handleDownloadPoster = async () => {
    setDownloadingPng(true);
    setShareFeedback(null);
    try {
      const blob = await generatePosterBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Amanat-${item.code}-Social-Poster.png`;
      a.click();
      URL.revokeObjectURL(url);
      setShareFeedback('High-res PNG poster downloaded! Ready for WhatsApp, Instagram & Facebook.');
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setShareFeedback('Bilingual social post copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareFeedback('Select and copy the text from the box below.');
    }
  };

  const handleNativeShare = async () => {
    setNativeSharing(true);
    setShareFeedback(null);
    try {
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof nav.share === 'function') {
        const blob = await generatePosterBlob();
        if (blob) {
          const file = new File([blob], `Amanat-${item.code}.png`, { type: 'image/png' });
          if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
            await nav.share({
              title: `${item.title_en} — Amanat (امانت)`,
              text: caption,
              url: shareUrl,
              files: [file],
            });
            setShareFeedback('Shared poster & bilingual message!');
            return;
          }
        }
        await nav.share({
          title: `${item.title_en} — Amanat (امانت)`,
          text: caption,
          url: shareUrl,
        });
        setShareFeedback('Shared bilingual message!');
      } else {
        await handleCopyCaption();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // user dismissed share sheet
      } else {
        await handleCopyCaption();
      }
    } finally {
      setNativeSharing(false);
    }
  };

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(caption)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(caption)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shortTweet)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortTweet)}&url=${encodeURIComponent(shareUrl)}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-emerald-950/75 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Share Campaign on Social Media"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-glass-lg border border-emerald-900/15"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-emerald-950 px-5 py-4 text-white">
          <div className="min-w-0">
            <Badge
              variant="gold"
              className="mb-1.5 bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Sadaqah Jariyah · Ready-to-Share Social Kit
            </Badge>
            <h3 className="text-base sm:text-lg font-extrabold leading-snug">
              Share {item.code} &amp; Multiply the Impact
            </h3>
            <p className="text-[11px] text-emerald-200/85 mt-0.5">
              Share the poster &amp; bilingual English/Urdu message so others can donate or pass it on.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Share Modal"
            className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Quick 1-Tap Share Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              type="button"
              onClick={handleNativeShare}
              disabled={nativeSharing}
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-900 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-800 transition-colors"
            >
              <Share2 className="h-4 w-4 text-gold-300" />
              {nativeSharing ? 'Preparing...' : 'Share Now'}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2.5 text-xs font-extrabold text-white shadow-sm hover:brightness-95 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>

            <a
              href={facebookUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1877F2] px-3 py-2.5 text-xs font-extrabold text-white shadow-sm hover:brightness-95 transition-all"
            >
              <Share2 className="h-4 w-4" />
              Facebook
            </a>

            <a
              href={telegramUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#229ED9] px-3 py-2.5 text-xs font-extrabold text-white shadow-sm hover:brightness-95 transition-all"
            >
              <Send className="h-4 w-4" />
              Telegram
            </a>

            <a
              href={twitterUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 transition-colors"
            >
              <span>𝕏</span>
              Post on X
            </a>
          </div>

          {shareFeedback && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{shareFeedback}</span>
            </div>
          )}

          {/* Two-Column Layout: Visual Poster + Bilingual Message */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Visual Social Poster Preview (captured as PNG) */}
            <div className="lg:col-span-6 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Ready-to-Post Social Poster (PNG)
                </span>
                <button
                  type="button"
                  onClick={handleDownloadPoster}
                  disabled={downloadingPng}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold-50 border border-gold-300 px-2.5 py-1 text-[11px] font-extrabold text-gold-900 hover:bg-gold-100 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingPng ? 'Rendering PNG...' : 'Download PNG'}
                </button>
              </div>

              {/* Capturable Luxury Emerald & Gold Poster Card */}
              <div
                ref={posterRef}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#022C22] via-[#064E3B] to-[#022C22] p-5 text-white shadow-lg border-2 border-[#D97706]/50"
              >
                {/* Decorative corner accents */}
                <div className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-amber-400/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-emerald-400/10 blur-2xl" />

                <div className="relative space-y-3.5">
                  {/* Top brand & trust pill */}
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                        AMANAT · امانت
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-200/90">
                        0% Fee · 100% Direct Vendor Escrow
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-400/20 border border-amber-300/40 px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-amber-200">
                      {item.code}
                    </span>
                  </div>

                  {/* Category & Location */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span className="rounded-md bg-emerald-400/20 border border-emerald-300/30 px-2 py-0.5 text-emerald-100">
                      {fundingEn}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-white/90">
                      <MapPin className="h-3 w-3 text-amber-300" />
                      {item.district}, Punjab
                    </span>
                  </div>

                  {/* Bilingual Title */}
                  <div className="space-y-1">
                    <h4 className="text-base font-black leading-snug text-white">
                      {item.title_en}
                    </h4>
                    <p
                      dir="rtl"
                      className="text-sm font-bold leading-relaxed text-amber-200/95"
                    >
                      {item.title_ur}
                    </p>
                  </div>

                  {/* Progress Box */}
                  <div className="rounded-xl bg-black/25 border border-white/10 p-3 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-extrabold text-emerald-200">
                        {formatPKR(item.collected_amount_pkr)}
                      </span>
                      <span className="text-[11px] font-bold text-amber-300">
                        {pct}% of {formatPKR(item.target_amount_pkr)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-100/85">
                      <Building2 className="h-3 w-3 text-amber-300 shrink-0" />
                      <span className="truncate">Escrow Vendor: {item.vendor_name}</span>
                    </div>
                  </div>

                  {/* Bottom QR + Bilingual CTA */}
                  <div className="flex items-center gap-3 rounded-xl bg-white/10 border border-white/15 p-2.5">
                    <div className="rounded-lg bg-white p-1.5 shrink-0">
                      <QRCodeCanvas
                        value={shareUrl}
                        size={68}
                        fgColor="#022C22"
                        level="M"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-extrabold text-amber-200 leading-tight flex items-center gap-1">
                        <HeartHandshake className="h-3.5 w-3.5 shrink-0" />
                        Donate or Share Further
                      </p>
                      <p dir="rtl" className="text-[11px] font-bold text-white leading-tight">
                        تعاون کریں یا آگے شیئر کریں — صدقہ جاریہ
                      </p>
                      <p className="font-mono text-[9px] text-emerald-200/80 truncate">
                        {shareUrl.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                  </div>

                  <p className="text-center text-[9px] text-emerald-200/70">
                    Privacy Protected · Verified by Amanat Field Volunteers · QR Receipt Issued
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Bilingual Ready-to-Post Message */}
            <div className="lg:col-span-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Ready-to-Post Caption
                </span>
                <div className="inline-flex rounded-xl border border-emerald-900/15 bg-slate-100 p-0.5 text-[11px] font-bold">
                  {(
                    [
                      { id: 'both', label: 'EN + اردو' },
                      { id: 'en', label: 'English' },
                      { id: 'ur', label: 'اردو' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCaptionLang(opt.id)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 transition-all',
                        captionLang === opt.id
                          ? 'bg-emerald-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-emerald-900'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                readOnly
                rows={13}
                dir={captionLang === 'ur' ? 'rtl' : 'ltr'}
                value={caption}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-medium text-slate-800 leading-relaxed focus:outline-none"
              />

              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-[11px] text-emerald-900">
                <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero-Exposure Safe:</strong> Only public campaign/case code, general
                  district, and verified escrow vendor are shared. No private beneficiary details
                  are ever exposed.
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" className="flex-1" onClick={handleCopyCaption}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied Post!' : 'Copy Full Post'}
                </Button>
                <Button
                  variant="gold"
                  className="flex-1"
                  onClick={handleDownloadPoster}
                  disabled={downloadingPng}
                >
                  <Download className="h-4 w-4" />
                  {downloadingPng ? 'Saving PNG...' : 'Save Poster PNG'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
