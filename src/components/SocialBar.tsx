import { Mail } from 'lucide-react';
import type { SocialLinks } from '@/types/amanat';

interface SocialBarProps {
  links: SocialLinks;
  compact?: boolean;
}

function normalizeWhatsApp(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function normalizeEmail(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('mailto:') ? trimmed : `mailto:${trimmed}`;
}

export function SocialBar({ links, compact = false }: SocialBarProps) {
  const items = [
    {
      id: 'tiktok',
      label: 'TikTok',
      href: links.tiktok.trim(),
      hover: 'hover:bg-slate-900 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      ),
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: links.facebook.trim(),
      hover: 'hover:bg-blue-600 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.87.24-1.46 1.5-1.46h1.6V4.95A21.5 21.5 0 0 0 14.3 4.8c-2.3 0-3.85 1.4-3.85 3.98V11H7.8v3h2.65v8h3.05z" />
        </svg>
      ),
    },
    {
      id: 'x',
      label: 'X',
      href: links.x.trim(),
      hover: 'hover:bg-neutral-900 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
    {
      id: 'youtube',
      label: 'YouTube',
      href: links.youtube.trim(),
      hover: 'hover:bg-red-600 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.58A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12c1.9.58 9.4.58 9.4.58s7.5 0 9.4-.58a3 3 0 0 0 2.1-2.12A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
        </svg>
      ),
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      href: normalizeWhatsApp(links.whatsapp),
      hover: 'hover:bg-emerald-600 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.12c-.24.69-1.43 1.31-1.97 1.39-.5.08-1.14.11-1.84-.11-.42-.14-.97-.32-1.67-.62-2.94-1.27-4.86-4.24-5-4.44-.15-.2-1.2-1.6-1.2-3.05s.76-2.16 1.03-2.46c.27-.3.59-.37.79-.37h.57c.18 0 .43-.07.67.51.24.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.49-.15.17-.31.38-.44.52-.15.15-.3.31-.13.61.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.39-.25.67-.15.27.1 1.72.81 2.02.96.3.15.49.22.57.34.07.13.07.72-.17 1.41z" />
        </svg>
      ),
    },
    {
      id: 'telegram',
      label: 'Telegram',
      href: links.telegram.trim(),
      hover: 'hover:bg-sky-500 hover:text-white',
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      href: normalizeEmail(links.email),
      hover: 'hover:bg-gold-600 hover:text-white',
      icon: <Mail className="h-4 w-4" aria-hidden="true" />,
    },
  ].filter((item) => Boolean(item.href));

  if (items.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2"
      aria-label="Official Amanat Social & Contact Channels"
    >
      {items.map((item) => (
        <a
          key={item.id}
          href={item.href}
          target={item.id === 'email' ? undefined : '_blank'}
          rel={item.id === 'email' ? undefined : 'noopener noreferrer'}
          title={item.label}
          className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-900/15 bg-white/90 text-emerald-950 shadow-sm transition-all duration-200 ${
            compact ? 'p-2' : 'px-3 py-1.5 text-xs font-bold'
          } ${item.hover}`}
        >
          {item.icon}
          {!compact && <span>{item.label}</span>}
        </a>
      ))}
    </div>
  );
}
