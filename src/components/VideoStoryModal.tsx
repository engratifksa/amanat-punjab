import { createPortal } from 'react-dom';
import {
  Building2,
  ExternalLink,
  Heart,
  MapPin,
  PlayCircle,
  Share2,
  ShieldCheck,
  Video,
  X,
} from 'lucide-react';
import type { VideoPrivacyMode } from '@/types/amanat';
import { Badge, Button } from './ui/primitives';
import { DualProgressBar } from './DualProgressBar';

export interface VideoStoryItem {
  type: 'campaign' | 'case';
  code: string;
  title_en: string;
  title_ur: string;
  district: string;
  vendor_name: string;
  video_url: string;
  video_privacy_mode?: VideoPrivacyMode;
  target_amount_pkr: number;
  collected_amount_pkr: number;
  pledged_amount_pkr: number;
  is_closed?: boolean;
}

interface VideoStoryModalProps {
  item: VideoStoryItem | null;
  language: 'en' | 'ur';
  onClose: () => void;
  onDonate?: () => void;
  onShare?: () => void;
}

type ResolvedEmbed =
  | { kind: 'iframe'; src: string; provider: string }
  | { kind: 'video'; src: string; provider: string }
  | { kind: 'external'; href: string; provider: string };

export function resolveVideoEmbed(rawUrl: string): ResolvedEmbed {
  const url = rawUrl.trim();
  // 1. YouTube (watch?v=, youtu.be/, shorts/, embed/)
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  if (ytMatch?.[1]) {
    return {
      kind: 'iframe',
      src: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0`,
      provider: 'YouTube',
    };
  }

  // 2. Google Drive (/file/d/<ID>/ or ?id=<ID>)
  const driveMatch =
    url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i) ||
    url.match(/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/i);
  if (driveMatch?.[1]) {
    return {
      kind: 'iframe',
      src: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
      provider: 'Google Drive',
    };
  }

  // 3. Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeoMatch?.[1]) {
    return {
      kind: 'iframe',
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      provider: 'Vimeo',
    };
  }

  // 4. Direct MP4 / WebM
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
    return { kind: 'video', src: url, provider: 'Direct Video' };
  }

  // 5. Facebook / TikTok / Other external link
  const provider = /tiktok\.com/i.test(url)
    ? 'TikTok'
    : /facebook\.com|fb\.watch/i.test(url)
    ? 'Facebook Video'
    : /instagram\.com/i.test(url)
    ? 'Instagram'
    : 'External Video';
  return { kind: 'external', href: url, provider };
}

export function VideoStoryModal({
  item,
  language,
  onClose,
  onDonate,
  onShare,
}: VideoStoryModalProps) {
  if (!item || typeof document === 'undefined') return null;

  const embed = resolveVideoEmbed(item.video_url);
  const privacyLabel =
    item.video_privacy_mode === 'family_consented'
      ? 'Verified Ground Video · Shared With Family Consent'
      : 'Verified Ground Video · Family Privacy Protected (No Identity Exposed)';

  return createPortal(
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-emerald-950/80 p-3 sm:p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Verified Video Story for ${item.code}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-glass-lg border border-emerald-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 bg-emerald-950 px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="gold"
                className="bg-gold-500/20 text-gold-200 border-gold-400/40"
              >
                <Video className="h-3.5 w-3.5" />
                {item.code} · {embed.provider}
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-100">
                <ShieldCheck className="h-3 w-3 text-gold-300" />
                {privacyLabel}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold leading-snug">
              {language === 'ur' ? item.title_ur : item.title_en}
            </h3>
            <p className="mt-0.5 text-[11px] text-emerald-200/85 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 text-gold-300" />
                {item.district}, Punjab
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3 text-gold-300" />
                Escrow Vendor: {item.vendor_name}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Video Player"
            className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Embedded Video Player */}
          {embed.kind === 'iframe' ? (
            <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-black shadow-md border border-slate-200">
              <iframe
                src={embed.src}
                title={`Amanat Video Story — ${item.code}`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : embed.kind === 'video' ? (
            <div className="overflow-hidden rounded-2xl bg-black shadow-md border border-slate-200">
              <video src={embed.src} controls playsInline className="w-full max-h-[380px]" />
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 p-8 text-center text-white space-y-3 border border-gold-400/30">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/20 border border-gold-400/50 text-gold-300">
                <PlayCircle className="h-8 w-8" />
              </div>
              <p className="text-sm font-extrabold">
                Verified Ground Video Hosted on {embed.provider}
              </p>
              <p className="text-xs text-emerald-100/85 max-w-md mx-auto">
                Tap below to open and watch the verified ground footage, then return here to
                contribute directly via 0% fee vendor escrow.
              </p>
              <a
                href={embed.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-5 py-2.5 text-xs font-extrabold text-emerald-950 shadow-gold hover:bg-gold-400 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Watch Video on {embed.provider}</span>
              </a>
            </div>
          )}

          {/* Live Funding Progress + Immediate Contribute / Share CTA */}
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-900/10 p-4 space-y-3">
            <DualProgressBar
              target={item.target_amount_pkr}
              collected={item.collected_amount_pkr}
              pledged={item.pledged_amount_pkr}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!item.is_closed && onDonate && (
                <Button
                  type="button"
                  variant="gold"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    onClose();
                    onDonate();
                  }}
                >
                  <Heart className="h-4 w-4" />
                  <span>{language === 'ur' ? 'ابھی تعاون کریں' : 'Contribute Now'}</span>
                </Button>
              )}
              {onShare && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    onClose();
                    onShare();
                  }}
                >
                  <Share2 className="h-4 w-4 text-emerald-700" />
                  <span>{language === 'ur' ? 'شیئر کریں' : 'Share Video Story'}</span>
                </Button>
              )}
              <a
                href={item.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:text-emerald-900"
                title="Open original video link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Source</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
