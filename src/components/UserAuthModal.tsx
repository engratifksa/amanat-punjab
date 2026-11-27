import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, UserCheck, HeartHandshake, ClipboardCheck, AlertCircle } from 'lucide-react';
import type { AuthUserSession } from '@/types/amanat';
import { PUNJAB_DISTRICTS } from '@/lib/seedData';
import { supabase } from '@/lib/dataClient';
import { Badge, Button, Input, Select } from './ui/primitives';

export const PENDING_OAUTH_KEY = 'amanat_pending_oauth_role_v1';

interface UserAuthModalProps {
  isOpen: boolean;
  defaultRole: 'donor' | 'beneficiary' | 'verifier';
  onClose: () => void;
  onSuccess: (session: AuthUserSession) => Promise<void>;
}

export function UserAuthModal({
  isOpen,
  defaultRole,
  onClose,
  onSuccess,
}: UserAuthModalProps) {
  const [role, setRole] = useState<'donor' | 'beneficiary' | 'verifier'>(defaultRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState('Lahore');
  const [tehsil, setTehsil] = useState(PUNJAB_DISTRICTS['Lahore'][0]);
  const [submitting, setSubmitting] = useState(false);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRole(defaultRole);
      setOauthNotice(null);
    }
  }, [defaultRole, isOpen]);

  if (!isOpen) return null;

  const handleDistrictChange = (d: string) => {
    setDistrict(d);
    setTehsil(PUNJAB_DISTRICTS[d]?.[0] ?? d);
  };

  const handleRealGoogleOAuth = async () => {
    if (!supabase) {
      await handleSignIn('google');
      return;
    }
    setSubmitting(true);
    setOauthNotice(null);
    try {
      localStorage.setItem(
        PENDING_OAUTH_KEY,
        JSON.stringify({ role, district, tehsil, fullName: fullName.trim() })
      );
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        setOauthNotice(
          `Google OAuth provider is not enabled in Supabase Dashboard yet (${error.message}). You can enable it under Authentication → Providers → Google, or continue instantly below.`
        );
      }
    } catch (err) {
      setOauthNotice(`Could not start Google OAuth: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async (provider: 'google' | 'email', e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const resolvedEmail =
      email.trim() ||
      (role === 'verifier'
        ? 'volunteer.verifier@gmail.com'
        : role === 'beneficiary'
        ? 'family.applicant@gmail.com'
        : 'generous.donor@gmail.com');
    const resolvedName =
      fullName.trim() ||
      (role === 'verifier'
        ? 'Haji Muhammad Tariq'
        : role === 'beneficiary'
        ? 'Muhammad Akram'
        : 'Overseas Donor');

    setSubmitting(true);
    try {
      await onSuccess({
        id: `usr-${Date.now().toString(36)}`,
        email: resolvedEmail,
        full_name: resolvedName,
        role,
        provider,
        district,
        tehsil,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Amanat Sign In"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-glass-lg border border-emerald-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between bg-emerald-950 px-6 py-5 text-white">
          <div>
            <Badge
              variant="gold"
              className="mb-2 bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Zero-Cost Google OAuth &amp; Role Access
            </Badge>
            <h2 className="text-lg font-extrabold">Sign In / Create Account</h2>
            <p className="mt-0.5 text-xs text-emerald-100/80">
              {role === 'donor'
                ? 'Optional for donors — unlocks your personal Zakat & Receipt Dashboard.'
                : role === 'beneficiary'
                ? 'Instant sign-up (no approval wait) to submit confidential requests.'
                : 'Field Verifiers sign in via Google and require Admin Board approval.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Sign In"
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-alabaster text-[11px] font-extrabold">
          {(
            [
              ['donor', 'Donor', UserCheck],
              ['beneficiary', 'Beneficiary', HeartHandshake],
              ['verifier', 'Field Verifier', ClipboardCheck],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setRole(id)}
              className={`flex items-center justify-center gap-1 py-3 transition ${
                role === id
                  ? 'bg-emerald-50 text-emerald-950 border-b-2 border-emerald-700'
                  : 'text-slate-500 hover:text-emerald-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={(e) => handleSignIn('email', e)} className="p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Full Name
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={
                  role === 'verifier'
                    ? 'e.g. Haji Muhammad Tariq (accredited) or your name'
                    : 'Your full name'
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Google / Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
              />
            </div>

            {role === 'verifier' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Coverage District
                  </label>
                  <Select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                  >
                    {Object.keys(PUNJAB_DISTRICTS).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Coverage Tehsil
                  </label>
                  <Select value={tehsil} onChange={(e) => setTehsil(e.target.value)}>
                    {(PUNJAB_DISTRICTS[district] ?? [district]).map((th) => (
                      <option key={th} value={th}>
                        {th}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>

          {oauthNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-2">
              <p className="flex items-start gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <span>{oauthNotice}</span>
              </p>
              <Button
                type="button"
                variant="gold"
                size="sm"
                className="w-full"
                onClick={() => handleSignIn('google')}
              >
                Continue Immediately (Quick Session)
              </Button>
            </div>
          )}

          {/* Primary Google Sign-In Button */}
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={submitting}
            onClick={handleRealGoogleOAuth}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#FFFFFF"
                d="M21.35 11.1H12v2.98h5.35c-.23 1.5-1.74 4.4-5.35 4.4-3.22 0-5.85-2.67-5.85-5.98S8.78 6.52 12 6.52c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.97 14.55 3 12 3 7.03 3 3 7.03 3 12s4.03 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.59-.06-1.04-.15-1.1z"
              />
            </svg>
            <span>
              {submitting ? 'Signing in...' : `Continue with Google as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </span>
          </Button>

          {role !== 'verifier' && (
            <Button type="submit" variant="outline" size="md" className="w-full" disabled={submitting}>
              Continue with Email
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
