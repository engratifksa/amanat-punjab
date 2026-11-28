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
  UserCheck,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import type { AdminOfficer, AdminSessionInfo, AppSettings } from '@/types/amanat';
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
  onAuthenticated: (session: AdminSessionInfo) => void;
  onAuthenticateOfficer: (username: string, password: string) => Promise<AdminOfficer>;
  onRequestPasswordRecovery: () => Promise<{ sentTo: string }>;
  onCompletePasswordRecovery: (code: string, newPassword: string) => Promise<void>;
}

export function AdminAuthModal({
  isOpen,
  settings,
  onClose,
  onAuthenticated,
  onAuthenticateOfficer,
  onRequestPasswordRecovery,
  onCompletePasswordRecovery,
}: AdminAuthModalProps) {
  const [loginMode, setLoginMode] = useState<'master' | 'officer'>('master');
  const [gate, setGate] = useState<'password' | 'otp' | 'recovery'>('password');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [otpMeta, setOtpMeta] = useState<OtpDispatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  // Recovery state
  const [recoverySentTo, setRecoverySentTo] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newMasterPw, setNewMasterPw] = useState('');
  const [confirmMasterPw, setConfirmMasterPw] = useState('');

  // Board Officer login state
  const [officerUsername, setOfficerUsername] = useState('');
  const [officerPassword, setOfficerPassword] = useState('');

  if (!isOpen) return null;

  const isLockedOut = Date.now() < lockedUntil;
  const telegramConfigured = Boolean(
    settings.telegram_config.requireRealTelegramOtp &&
      settings.telegram_config.botToken.trim() &&
      settings.telegram_config.chatId.trim()
  );

  const resetAndClose = () => {
    setGate('password');
    setPassword('');
    setOtpInput('');
    setGeneratedOtp(null);
    setOtpMeta(null);
    setError(null);
    setSuccessNotice(null);
    setRecoverySentTo(null);
    setRecoveryCode('');
    setNewMasterPw('');
    setConfirmMasterPw('');
    setOfficerUsername('');
    setOfficerPassword('');
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
    setSuccessNotice(null);
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

    const session: AdminSessionInfo = { role: 'master_admin', actorName: 'Master Admin' };
    setAdminSession(session);
    resetAndClose();
    onAuthenticated(session);
  };

  const handleSendRecoveryCode = async () => {
    setError(null);
    setSuccessNotice(null);
    setBusy(true);
    try {
      const { sentTo } = await onRequestPasswordRecovery();
      setRecoverySentTo(sentTo);
      setSuccessNotice(
        `6-digit Master Password recovery code emailed to ${sentTo} (valid 10 minutes). Check Inbox or Spam.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send recovery email.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newMasterPw.trim().length < 6) {
      setError('New Master Password must be at least 6 characters.');
      return;
    }
    if (newMasterPw !== confirmMasterPw) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await onCompletePasswordRecovery(recoveryCode, newMasterPw);
      setGate('password');
      setRecoverySentTo(null);
      setRecoveryCode('');
      setNewMasterPw('');
      setConfirmMasterPw('');
      setPassword('');
      setSuccessNotice('Master Password updated! Sign in with your new password below.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleOfficerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setBusy(true);
    try {
      const officer = await onAuthenticateOfficer(officerUsername, officerPassword);
      const session: AdminSessionInfo = {
        role: 'officer',
        actorName: officer.full_name,
        officer,
      };
      setAdminSession(session);
      resetAndClose();
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid Board Officer credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Admin Board Security Gate"
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
              {loginMode === 'master'
                ? 'Dual-Gate Master Admin (2FA)'
                : 'Board Officer Scoped Access'}
            </Badge>
            <h2 className="text-lg font-extrabold">Admin Board Security Gate</h2>
            <p className="mt-0.5 text-xs text-emerald-100/80">
              Restricted to authorized Amanat Verification Board personnel.
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

        {/* Role Mode Toggle */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-alabaster text-xs font-extrabold">
          <button
            type="button"
            onClick={() => {
              setLoginMode('master');
              setGate('password');
              setError(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-3 transition ${
              loginMode === 'master'
                ? 'bg-emerald-50 text-emerald-950 border-b-2 border-emerald-700'
                : 'text-slate-500 hover:text-emerald-900'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Master Admin</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('officer');
              setError(null);
              setSuccessNotice(null);
            }}
            className={`flex items-center justify-center gap-1.5 py-3 transition ${
              loginMode === 'officer'
                ? 'bg-emerald-50 text-emerald-950 border-b-2 border-emerald-700'
                : 'text-slate-500 hover:text-emerald-900'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Board Officer</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {successNotice && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
              <span>{successNotice}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {loginMode === 'officer' ? (
            <form onSubmit={handleOfficerLogin} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Board Officer Username
                  </label>
                  <Input
                    required
                    autoFocus
                    value={officerUsername}
                    onChange={(e) => setOfficerUsername(e.target.value)}
                    placeholder="e.g. tariq.kasur"
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Password</label>
                  <Input
                    required
                    type="password"
                    value={officerPassword}
                    onChange={(e) => setOfficerPassword(e.target.value)}
                    placeholder="Enter officer password"
                  />
                </div>
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                <UserCheck className="h-4 w-4" />
                <span>{busy ? 'Verifying...' : 'Sign In as Board Officer'}</span>
              </Button>
              <p className="text-[11px] text-slate-500 text-center">
                Board Officer accounts are created &amp; managed exclusively by Master Admin.
              </p>
            </form>
          ) : gate === 'recovery' ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setGate('password');
                  setError(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Password Login
              </button>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2 text-xs text-emerald-950">
                <p className="font-extrabold flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-emerald-700" />
                  Master Password Email Recovery
                </p>
                <p className="text-slate-700 leading-relaxed">
                  We will send a single-use 6-digit recovery code (valid 10 minutes) strictly to
                  your official Admin email (
                  <strong className="font-mono">
                    {settings.email_gateway?.senderEmail || 'support.amanat@gmail.com'}
                  </strong>
                  ).
                </p>
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={handleSendRecoveryCode}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {busy
                      ? 'Sending Recovery Code...'
                      : recoverySentTo
                      ? 'Resend 6-Digit Recovery Code'
                      : 'Send 6-Digit Recovery Code to Email'}
                  </span>
                </Button>
              </div>

              <form onSubmit={handleCompleteRecovery} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    6-Digit Recovery Code (from Email)
                  </label>
                  <Input
                    required
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="text-center font-mono text-lg tracking-[0.35em] font-extrabold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    New Master Password (min 6 chars)
                  </label>
                  <Input
                    required
                    type="password"
                    minLength={6}
                    value={newMasterPw}
                    onChange={(e) => setNewMasterPw(e.target.value)}
                    placeholder="Enter new strong password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Confirm New Master Password
                  </label>
                  <Input
                    required
                    type="password"
                    minLength={6}
                    value={confirmMasterPw}
                    onChange={(e) => setConfirmMasterPw(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={busy || recoveryCode.length !== 6}
                >
                  <KeyRound className="h-4 w-4" />
                  <span>{busy ? 'Resetting...' : 'Reset Master Password'}</span>
                </Button>
              </form>
            </div>
          ) : gate === 'password' ? (
            <form onSubmit={handleGate1Submit} className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-700">
                    Gate 1: Admin Master Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setGate('recovery');
                      setError(null);
                      setSuccessNotice(null);
                    }}
                    className="text-[11px] font-extrabold text-sky-700 hover:underline"
                  >
                    Forgot Master Password?
                  </button>
                </div>
                <Input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Admin Master Password"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {telegramConfigured
                    ? 'After password verification, a 6-digit OTP will be sent to your Telegram Bot.'
                    : 'Local setup mode active — OTP will appear on screen until Live Telegram 2FA is enabled.'}
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={busy || isLockedOut}
              >
                <KeyRound className="h-4 w-4" />
                <span>{busy ? 'Verifying & Sending OTP...' : 'Continue to Gate 2 (OTP)'}</span>
              </Button>
            </form>
          ) : (
            <form onSubmit={handleGate2Submit} className="space-y-4">
              {otpMeta?.sentVia === 'telegram' ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                  <Send className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">6-Digit OTP Sent to Telegram!</p>
                    <p className="mt-0.5 text-emerald-800/90">
                      Check your configured Amanat Admin Telegram Bot chat and enter the code below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gold-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-amber-900">
                    <CheckCircle2 className="h-4 w-4 text-gold-600" />
                    <span>First-Time Setup Mode (Local Fallback)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Enter your 6-digit setup OTP below, or enable Live Telegram 2FA under{' '}
                    <strong>Admin → Settings</strong>.
                  </p>
                  {otpMeta?.demoCode && (
                    <div className="mt-1 flex items-center justify-between rounded-xl bg-white px-3 py-2 border border-gold-200">
                      <span className="text-[11px] font-bold text-slate-500">
                        Your 6-Digit Setup OTP:
                      </span>
                      <span className="font-mono text-base font-extrabold tracking-widest text-emerald-950">
                        {otpMeta.demoCode}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-extrabold text-slate-700">
                  Gate 2: Enter 6-Digit Verification OTP
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-[0.35em] font-extrabold"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={dispatchOtp}
                  className="shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  Resend
                </Button>
                <Button type="submit" variant="gold" size="md" className="flex-1">
                  <ShieldCheck className="h-4 w-4" />
                  Unlock Admin Board
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
