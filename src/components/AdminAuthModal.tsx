import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  Send,
  KeyRound,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { AppSettings } from '@/types/amanat';
import {
  DEFAULT_INITIAL_PASSWORD,
  generateSecureOtp,
  hashAdminPassword,
  sendTelegramOtp,
  setAdminSession,
  type OtpDispatchResult,
} from '@/lib/adminAuth';
import { Badge, Button, Input } from './ui/primitives';

interface AdminAuthModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function AdminAuthModal({
  isOpen,
  settings,
  onClose,
  onAuthenticated,
}: AdminAuthModalProps) {
  const [gate, setGate] = useState<'password' | 'otp'>('password');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpMeta, setOtpMeta] = useState<OtpDispatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const isLockedOut = Date.now() < lockedUntil;
  const telegramConfigured = Boolean(
    settings.telegram_config.botToken.trim() && settings.telegram_config.chatId.trim()
  );

  const resetAndClose = () => {
    setGate('password');
    setPassword('');
    setOtpInput('');
    setGeneratedOtp(null);
    setOtpMeta(null);
    setError(null);
    onClose();
  };

  const dispatchOtp = async () => {
    const code = generateSecureOtp();
    setGeneratedOtp(code);
    const res = await sendTelegramOtp(code, settings.telegram_config);
    setOtpMeta(res);
    if (res.error && res.sentVia === 'telegram') {
      setError(res.error);
      return false;
    }
    return true;
  };

  const handleGate1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      setError('Too many failed attempts. Please wait 30 seconds before retrying.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const enteredHash = await hashAdminPassword(password);
      const expectedHash =
        settings.admin_password_hash || (await hashAdminPassword(DEFAULT_INITIAL_PASSWORD));

      if (enteredHash !== expectedHash) {
        const nextFails = failedAttempts + 1;
        setFailedAttempts(nextFails);
        if (nextFails >= 4) {
          setLockedUntil(Date.now() + 30_000);
          setError('4 failed password attempts. Locked for 30 seconds.');
        } else {
          setError(`Invalid Admin Password (${nextFails}/4 attempts).`);
        }
        return;
      }

      // Gate 1 passed -> Dispatch Gate 2 Telegram OTP
      const dispatched = await dispatchOtp();
      if (dispatched) {
        setGate('otp');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGate2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!generatedOtp || !otpMeta) {
      setError('OTP session expired. Please resend OTP.');
      return;
    }
    if (Date.now() > otpMeta.expiresAt) {
      setError('OTP expired (5-minute limit). Tap Resend OTP.');
      return;
    }
    if (otpInput.trim() !== generatedOtp) {
      setError('Incorrect 6-digit Telegram OTP code.');
      return;
    }

    setAdminSession();
    setGate('password');
    setPassword('');
    setOtpInput('');
    setGeneratedOtp(null);
    setOtpMeta(null);
    setFailedAttempts(0);
    onAuthenticated();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Admin Dual-Gate Authentication"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-glass-lg border border-emerald-900/20">
        {/* Header */}
        <div className="flex items-start justify-between bg-emerald-950 px-6 py-5 text-white">
          <div>
            <Badge
              variant="gold"
              className="mb-2 bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Dual-Gate Admin Protection (2FA)
            </Badge>
            <h2 className="text-lg font-extrabold">Admin Board Security Gate</h2>
            <p className="mt-0.5 text-xs text-emerald-100/80">
              Restricted to authorized Amanat Verification Board administrators.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close Admin Login"
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Gate Progress Indicator */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-alabaster text-xs font-bold">
          <div
            className={`flex items-center justify-center gap-1.5 py-2.5 ${
              gate === 'password'
                ? 'bg-emerald-50 text-emerald-900 border-b-2 border-emerald-700'
                : 'text-emerald-700'
            }`}
          >
            {gate === 'otp' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            <span>Gate 1: Password</span>
          </div>
          <div
            className={`flex items-center justify-center gap-1.5 py-2.5 ${
              gate === 'otp'
                ? 'bg-emerald-50 text-emerald-900 border-b-2 border-emerald-700'
                : 'text-slate-400'
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Gate 2: Telegram OTP</span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {gate === 'password' ? (
            <form onSubmit={handleGate1Submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Admin Master Password
                </label>
                <Input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Admin Master Password"
                />
                {!telegramConfigured && (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900 border border-emerald-200/70">
                    <strong>First-time setup password:</strong>{' '}
                    <code className="font-mono font-bold">{DEFAULT_INITIAL_PASSWORD}</code> —
                    change it &amp; add your Telegram Bot Token inside Admin Settings.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy || isLockedOut}
              >
                <Lock className="h-4 w-4" />
                <span>{busy ? 'Verifying & Sending OTP...' : 'Verify Password & Send Telegram OTP'}</span>
              </Button>
            </form>
          ) : (
            <form onSubmit={handleGate2Submit} className="space-y-4">
              {otpMeta?.sentVia === 'telegram' ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-emerald-700" />
                    6-Digit OTP Dispatched to Your Telegram!
                  </p>
                  <p className="mt-1 text-emerald-900/80">
                    Check your configured Admin Telegram chat and enter the 6-digit code below.
                    Expires in 5 minutes.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-gold-300 bg-gold-50 p-3.5 text-xs text-amber-950 space-y-1">
                  <p className="font-extrabold">
                    First-Time Setup Mode (Telegram Bot Not Configured Yet)
                  </p>
                  <p className="text-amber-900/90">
                    Your one-time verification code is:{' '}
                    <code className="rounded bg-white px-2 py-0.5 font-mono text-sm font-extrabold text-emerald-900 border border-gold-300">
                      {otpMeta?.demoCode}
                    </code>
                  </p>
                  <p className="text-[11px] text-amber-800">
                    Once inside Admin → Settings, enter your free Telegram Bot Token &amp; Chat ID
                    to receive live OTPs on Telegram.
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Enter 6-Digit Telegram OTP
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="text-center font-mono text-lg font-extrabold tracking-[0.35em]"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="gold" size="lg" className="flex-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Unlock Admin Board</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={async () => {
                    setError(null);
                    await dispatchOtp();
                  }}
                  title="Resend OTP"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
