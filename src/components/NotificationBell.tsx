import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CheckCheck,
  Mail,
  Send,
  Smartphone,
  X,
  Eye,
  BellRing,
} from 'lucide-react';
import type { NotificationRecord, UserRole } from '@/types/amanat';
import { Badge, Button } from './ui/primitives';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  notifications: NotificationRecord[];
  activeRole: UserRole;
  language: 'en' | 'ur';
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationBell({
  notifications,
  activeRole,
  language,
  onMarkRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<NotificationRecord | null>(null);
  const [previewTab, setPreviewTab] = useState<'email' | 'telegram'>('email');
  const [pushPerm, setPushPerm] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  useEffect(() => {
    if (!previewItem && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewItem) setPreviewItem(null);
        else setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewItem, open]);

  const visible = notifications.filter((n) => {
    if (activeRole === 'admin' || activeRole === 'verifier') return true;
    if (activeRole === 'donor') return n.audience === 'donor' || n.audience === 'both';
    return n.audience === 'beneficiary' || n.audience === 'both';
  });

  const unreadCount = visible.filter((n) => !n.read).length;

  const handleRequestPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setPushPerm(perm);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Notifications"
        aria-expanded={open}
        title="3-Channel Escrow Notifications (App · Email · Telegram)"
        className="relative inline-flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-900/15 bg-white/90 text-emerald-950 hover:bg-emerald-50 transition"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-extrabold text-white shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Portaled Responsive Notification Sheet (Full-width centered on mobile, top-right anchored on desktop) */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] bg-emerald-950/35 sm:bg-transparent backdrop-blur-[1px] sm:backdrop-blur-none"
            onClick={() => setOpen(false)}
          >
            <div
              role="region"
              aria-label="Notifications Inbox"
              onClick={(e) => e.stopPropagation()}
              className="fixed inset-x-3 top-16 sm:inset-x-auto sm:end-6 sm:top-[70px] sm:w-[400px] max-h-[calc(100vh-5.5rem)] flex flex-col rounded-2xl border border-emerald-900/15 bg-white shadow-glass-lg overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 bg-emerald-950 px-4 py-3 text-white shrink-0">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold truncate">Amanat 3-Channel Updates</p>
                  <p className="text-[10px] text-emerald-200 truncate">
                    App · Gmail (support.amanat@gmail.com) · Telegram
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold hover:bg-white/20"
                    >
                      <CheckCheck className="h-3 w-3" />
                      <span>Read all</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close notifications"
                    className="rounded-lg p-1 hover:bg-white/15"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {pushPerm === 'default' && (
                <div className="flex items-center justify-between gap-2 bg-emerald-50 px-4 py-2 border-b border-emerald-100 text-[11px] text-emerald-900 shrink-0">
                  <span className="font-semibold">Enable instant mobile/browser alerts?</span>
                  <button
                    type="button"
                    onClick={handleRequestPush}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-800 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-900 shrink-0"
                  >
                    <BellRing className="h-3 w-3" />
                    Enable
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {visible.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No milestone notifications yet.
                  </div>
                ) : (
                  visible.slice(0, 20).map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'p-3.5 transition-colors hover:bg-emerald-50/40',
                        !n.read && 'bg-amber-50/40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] font-extrabold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                            {n.target_code}
                          </span>
                          {n.milestone_pct !== null && (
                            <Badge variant="gold" className="text-[10px] py-0 px-1.5">
                              {n.milestone_pct}% Milestone
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-extrabold text-emerald-950 leading-snug">
                        {language === 'ur' ? n.title_ur : n.title_en}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                        {language === 'ur' ? n.body_ur : n.body_en}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                            <Smartphone className="h-2.5 w-2.5" /> App
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                            <Mail className="h-2.5 w-2.5" />{' '}
                            {n.channels_status.email === 'delivered' ? 'Email ✓' : 'Email'}
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded bg-sky-100 px-1.5 py-0.5 text-sky-900">
                            <Send className="h-2.5 w-2.5" />{' '}
                            {n.channels_status.telegram === 'delivered' ? 'TG ✓' : 'Telegram'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onMarkRead(n.id);
                            setPreviewItem(n);
                            setPreviewTab('email');
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-gold-600"
                        >
                          <Eye className="h-3 w-3" />
                          Preview Email / TG
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Rich Branded Email HTML & Telegram Card Preview Modal */}
      {previewItem &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/65 p-3 sm:p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Notification Channel Preview"
            onClick={() => setPreviewItem(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-glass-lg border border-emerald-900/15"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 bg-emerald-950 px-4 sm:px-5 py-3.5 sm:py-4 text-white shrink-0">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-bold text-gold-300 truncate">
                    {previewItem.target_code} · Audience: {previewItem.audience.toUpperCase()}
                  </p>
                  <h3 className="text-xs sm:text-sm font-extrabold truncate">
                    {previewItem.email_subject}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  aria-label="Close Preview"
                  className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20 shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-alabaster px-4 sm:px-5 py-2.5 shrink-0">
                <Button
                  variant={previewTab === 'email' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewTab('email')}
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Gmail HTML</span>
                </Button>
                <Button
                  variant={previewTab === 'telegram' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setPreviewTab('telegram')}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Telegram Card</span>
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-100">
                {previewTab === 'email' ? (
                  <iframe
                    title="Branded Email Preview"
                    srcDoc={previewItem.email_html}
                    className="h-[420px] sm:h-[460px] w-full rounded-xl border border-slate-200 bg-white"
                  />
                ) : (
                  <div className="mx-auto max-w-md rounded-2xl bg-[#17212B] p-4 text-slate-100 shadow-lg border border-sky-500/20">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-sky-300 font-bold">
                      <span>@AmanatNotifyBot · Telegram</span>
                      <span>
                        {new Date(previewItem.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className="whitespace-pre-line text-xs leading-relaxed break-words"
                      dangerouslySetInnerHTML={{ __html: previewItem.telegram_text }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
