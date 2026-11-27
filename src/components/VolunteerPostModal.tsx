import { useState } from 'react';
import { X, Copy, Check, Download, Share2, ShieldAlert } from 'lucide-react';
import type { WelfareCase } from '@/types/amanat';
import { Badge, Button } from './ui/primitives';
import { getPublicAppUrl } from '@/lib/utils';

interface VolunteerPostModalProps {
  welfareCase: WelfareCase | null;
  onClose: () => void;
}

export function VolunteerPostModal({ welfareCase, onClose }: VolunteerPostModalProps) {
  const [copied, setCopied] = useState(false);

  if (!welfareCase) return null;

  const signupUrl = `${getPublicAppUrl()}/#volunteer`;

  const postText = `🕌 VOLUNTEER FIELD VERIFIER NEEDED — ${welfareCase.tehsil.toUpperCase()}, ${welfareCase.district.toUpperCase()} (PUNJAB)

A deserving family in ${welfareCase.tehsil}, ${welfareCase.district} has requested verified Zakat/Sadaqah assistance through Amanat (امانت) — 100% Direct Vendor Escrow (0% fee).

We need a trustworthy local Volunteer Field Verifier from ${welfareCase.tehsil} / ${welfareCase.district} to visit the household and confirm eligibility & vendor quotation so aid can be released directly to the vendor.

📍 Area: ${welfareCase.tehsil}, ${welfareCase.district} (Exact address shared privately only after Admin approval)
🔗 Sign up via Google as a Field Verifier: ${signupUrl}

اردو پیغام:
تحصیل ${welfareCase.tehsil}، ضلع ${welfareCase.district} میں ایک مستحق خاندان کی تصدیق کے لیے مقامی رضاکار فیلڈ ویریفائر درکار ہے۔ امانت پر گوگل اکاؤنٹ کے ذریعے رجسٹر ہوں اور نیکی کے اس کام میں حصہ ڈالیں۔

#AmanatPunjab #ZakatTransparency #${welfareCase.district.replace(/\s+/g, '')} #VolunteerPakistan`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(postText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPoster = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1080" y2="1080" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#022C22"/>
          <stop offset="55%" stop-color="#064E3B"/>
          <stop offset="100%" stop-color="#022C22"/>
        </linearGradient>
      </defs>
      <rect width="1080" height="1080" fill="url(#bg)"/>
      <rect x="44" y="44" width="992" height="992" rx="44" fill="none" stroke="#F59E0B" stroke-width="5" stroke-opacity="0.6"/>
      <text x="540" y="170" text-anchor="middle" fill="#FDE68A" font-family="sans-serif" font-size="34" font-weight="800" letter-spacing="4">AMANAT (امانت) · SACRED TRUST</text>
      <rect x="240" y="220" width="600" height="68" rx="34" fill="#F59E0B"/>
      <text x="540" y="266" text-anchor="middle" fill="#022C22" font-family="sans-serif" font-size="30" font-weight="900">VOLUNTEER VERIFIER NEEDED</text>
      <text x="540" y="420" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="68" font-weight="900">${welfareCase.tehsil}</text>
      <text x="540" y="495" text-anchor="middle" fill="#A7F3D0" font-family="sans-serif" font-size="42" font-weight="700">District ${welfareCase.district}, Punjab</text>
      <text x="540" y="610" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="30">Help verify a deserving household on the ground</text>
      <text x="540" y="660" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="30">100% Direct Vendor Escrow · 0% Platform Fee</text>
      <rect x="160" y="760" width="760" height="110" rx="24" fill="#FFFFFF" fill-opacity="0.1" stroke="#FDE68A" stroke-width="2"/>
      <text x="540" y="810" text-anchor="middle" fill="#FDE68A" font-family="sans-serif" font-size="26" font-weight="700">Sign up with Google as Field Verifier:</text>
      <text x="540" y="852" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="28" font-weight="800">${signupUrl}</text>
      <text x="540" y="965" text-anchor="middle" fill="#94A3B8" font-family="sans-serif" font-size="22">Privacy Protected · Zero personal beneficiary details shared publicly</text>
    </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Amanat-Volunteer-Needed-${welfareCase.district}-${welfareCase.tehsil}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Volunteer Field Verifier Social Post Generator"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-glass-lg border border-emerald-900/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between bg-emerald-950 px-6 py-5 text-white">
          <div>
            <Badge
              variant="gold"
              className="mb-1.5 bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <Share2 className="h-3.5 w-3.5" />
              No Local Verifier Found — Ready-to-Post Recruitment
            </Badge>
            <h3 className="text-base font-extrabold">
              Volunteer Callout for {welfareCase.tehsil}, {welfareCase.district}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Volunteer Post Modal"
            className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <ShieldAlert className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              <strong>Zero-Exposure Safe:</strong> Only the general Tehsil/District (
              {welfareCase.tehsil}, {welfareCase.district}) is included. Applicant Name, CNIC,
              Phone, and exact GPS pin are strictly excluded.
            </span>
          </div>

          <textarea
            readOnly
            rows={10}
            value={postText}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-medium text-slate-800 leading-relaxed focus:outline-none"
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied Post!' : 'Copy Post Text'}</span>
            </Button>

            <Button variant="gold" size="sm" onClick={handleDownloadPoster}>
              <Download className="h-4 w-4" />
              <span>Download Branded Poster</span>
            </Button>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(postText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(signupUrl)}&text=${encodeURIComponent(postText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600"
            >
              Telegram
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(postText.slice(0, 260))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800"
            >
              X / Twitter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
