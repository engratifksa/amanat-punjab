import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  CheckCircle2,
  MapPin,
  ClipboardCheck,
  ShieldCheck,
  Clock,
  Phone,
  User,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import type {
  AuthUserSession,
  FieldVerification,
  Profile,
  WelfareCase,
} from '@/types/amanat';
import { formatCnicInput, formatPKR } from '@/lib/utils';
import { Badge, Button, Card, Input, Select, Textarea } from './ui/primitives';
import {
  LocationPinPicker,
  haversineDistanceKm,
  type GeoCoordinates,
} from './LocationPinPicker';
import { SmartImageCapture } from './SmartImageCapture';
import { VerifierDynamicIdCard } from './DigitalCards';
import { PUNJAB_DISTRICTS } from '@/lib/seedData';

interface VerifierWorkspaceProps {
  currentUser: AuthUserSession | null;
  profiles: Profile[];
  onOpenAuth: () => void;
  onApplyAsVerifier: (payload: {
    district: string;
    tehsil: string;
    cnic_number: string;
    phone: string;
    photo_url: string;
  }) => Promise<void>;
  cases: WelfareCase[];
  verifications: FieldVerification[];
  onSubmitVerification: (payload: {
    case_id: string;
    verifier_id: string;
    visit_notes: string;
    household_members: number;
    monthly_income_pkr: number;
    evidence_urls: string[];
    gps_tehsil_tag: string;
    verifier_lat: number | null;
    verifier_lng: number | null;
    distance_from_applicant_km: number | null;
    handshake_pin_verified: boolean;
    isOffline: boolean;
  }) => Promise<void>;
  onSyncOffline: () => Promise<number>;
}

export function VerifierWorkspace({
  currentUser,
  profiles,
  onOpenAuth,
  onApplyAsVerifier,
  cases,
  verifications,
  onSubmitVerification,
  onSyncOffline,
}: VerifierWorkspaceProps) {
  const { t } = useTranslation();
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [visitNotes, setVisitNotes] = useState('');
  const [householdMembers, setHouseholdMembers] = useState('5');
  const [monthlyIncome, setMonthlyIncome] = useState('16000');
  const [gpsTag, setGpsTag] = useState('');
  const [verifierCoords, setVerifierCoords] = useState<GeoCoordinates | null>(null);
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applyDistrict, setApplyDistrict] = useState(currentUser?.district || 'Lahore');
  const [applyTehsil, setApplyTehsil] = useState(
    currentUser?.tehsil || PUNJAB_DISTRICTS['Lahore'][0]
  );
  const [applyCnic, setApplyCnic] = useState('');
  const [applyPhone, setApplyPhone] = useState('');
  const [applyPhoto, setApplyPhoto] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [enteredHandshakePin, setEnteredHandshakePin] = useState('');

  // Match ANY signed-in user against persistent Supabase profiles (never asks to sign in again!)
  const verifierProfile = currentUser
    ? profiles.find(
        (p) =>
          (currentUser.profile_id && p.id === currentUser.profile_id) ||
          (p.auth_user_id && p.auth_user_id === currentUser.id) ||
          (p.email && p.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          p.full_name.toLowerCase() === currentUser.full_name.toLowerCase()
      ) ?? null
    : null;

  const isAccredited = Boolean(verifierProfile?.is_accredited_verifier);
  const hasApplied = Boolean(
    verifierProfile && (verifierProfile.verifier_applied || verifierProfile.role === 'verifier')
  );

  // Gate 1: Only ask to Sign In if completely logged out
  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card className="p-8 text-center space-y-5 border-emerald-900/15">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-gold-300 shadow-lg">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <Badge variant="gold">Google Login + Admin Board Accreditation</Badge>
          <h1 className="text-2xl font-extrabold text-emerald-950">
            Field Verifier Portal (Accredited Volunteers Only)
          </h1>
          <p className="mx-auto max-w-lg text-sm text-slate-600 leading-relaxed">
            Field Verifiers sign in once with <strong>Google</strong> and must be accredited by the
            Amanat Admin Board before accessing confidential household dossiers, GPS locations, or
            their anti-scam Dynamic QR ID Card.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="lg" onClick={onOpenAuth}>
              <ShieldCheck className="h-5 w-5" />
              <span>Continue with Google as Field Verifier</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Gate 2A: Already signed in, hasn't applied as Field Verifier yet -> 1-click apply (NO re-login!)
  if (!isAccredited && !hasApplied) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Card className="p-8 space-y-5 border-emerald-900/15">
          <div className="text-center space-y-2">
            <Badge variant="emerald">Signed in as {currentUser.full_name} ({currentUser.email})</Badge>
            <h1 className="text-2xl font-extrabold text-emerald-950">
              Apply to Become an Accredited Field Verifier
            </h1>
            <p className="text-sm text-slate-600">
              Select the Punjab District &amp; Tehsil where you can verify households on the ground.
              Once Admin approves you, your live 60-second Dynamic QR ID Card unlocks automatically.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">District *</label>
              <Select
                value={applyDistrict}
                onChange={(e) => {
                  const d = e.target.value;
                  setApplyDistrict(d);
                  setApplyTehsil(PUNJAB_DISTRICTS[d]?.[0] ?? d);
                }}
              >
                {Object.keys(PUNJAB_DISTRICTS).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Tehsil *</label>
              <Select value={applyTehsil} onChange={(e) => setApplyTehsil(e.target.value)}>
                {(PUNJAB_DISTRICTS[applyDistrict] ?? [applyDistrict]).map((th) => (
                  <option key={th} value={th}>
                    {th}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                CNIC Number * (Displayed Masked on ID Card)
              </label>
              <Input
                required
                value={applyCnic}
                onChange={(e) => setApplyCnic(formatCnicInput(e.target.value))}
                placeholder="35202-1234567-1"
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Mobile Number *
              </label>
              <Input
                required
                value={applyPhone}
                onChange={(e) => setApplyPhone(e.target.value)}
                placeholder="0300-1234567"
              />
            </div>
          </div>

          <SmartImageCapture
            label="Official Portrait Photo * (Required for Anti-Scam Verifier ID Card)"
            value={applyPhoto}
            onChange={setApplyPhoto}
            helperText="Take a clear selfie or upload your portrait photo. Families will see this exact Admin-approved photo when scanning your QR at their doorstep."
          />

          {applyError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800">
              {applyError}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={applying}
            onClick={async () => {
              setApplyError(null);
              const digits = applyCnic.replace(/\D/g, '');
              if (digits.length < 13) {
                setApplyError('Please enter a valid 13-digit CNIC number (e.g. 35202-1234567-1).');
                return;
              }
              if (!applyPhone.trim()) {
                setApplyError('Please enter your active mobile number.');
                return;
              }
              if (!applyPhoto) {
                setApplyError('Please take or upload a clear portrait photo for your Official Verifier ID Card.');
                return;
              }
              setApplying(true);
              try {
                await onApplyAsVerifier({
                  district: applyDistrict,
                  tehsil: applyTehsil,
                  cnic_number: applyCnic,
                  phone: applyPhone.trim(),
                  photo_url: applyPhoto,
                });
              } finally {
                setApplying(false);
              }
            }}
          >
            <ShieldCheck className="h-5 w-5" />
            <span>{applying ? 'Submitting...' : 'Submit Volunteer Verifier Application'}</span>
          </Button>
        </Card>
      </div>
    );
  }

  // Gate 2B: Applied, awaiting Admin Board Accreditation
  if (!isAccredited) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card className="p-8 text-center space-y-4 border-gold-300 bg-amber-50/40">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 text-white shadow-gold">
            <Clock className="h-7 w-7" />
          </div>
          <Badge variant="gold">Pending Verification Board Approval</Badge>
          <h1 className="text-2xl font-extrabold text-emerald-950">
            Thank You for Volunteering, {currentUser.full_name}!
          </h1>
          <p className="mx-auto max-w-lg text-sm text-slate-700 leading-relaxed">
            Your Field Verifier registration for{' '}
            <strong>
              {verifierProfile?.tehsil || currentUser.tehsil},{' '}
              {verifierProfile?.district || currentUser.district}
            </strong>{' '}
            is saved in Supabase. Your confidential dossier access and live 60-second Dynamic QR ID
            Card will unlock automatically the moment Admin clicks <em>Accredit Verifier</em>.
          </p>
        </Card>
      </div>
    );
  }

  const pendingCases = cases.filter((c) => c.status === 'pending_field_visit');
  const activeCase =
    pendingCases.find((c) => c.id === selectedCaseId) ?? pendingCases[0] ?? null;
  const unsyncedCount = verifications.filter((v) => v.synced === false).length;

  const applicantCoords =
    activeCase?.beneficiary_lat && activeCase?.beneficiary_lng
      ? { lat: activeCase.beneficiary_lat, lng: activeCase.beneficiary_lng }
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !visitNotes.trim()) return;
    setSubmitting(true);
    try {
      const distKm =
        verifierCoords && applicantCoords
          ? haversineDistanceKm(verifierCoords, applicantCoords)
          : null;

      const pinMatched = Boolean(
        activeCase.visit_handshake_pin &&
          enteredHandshakePin.trim() === activeCase.visit_handshake_pin.trim()
      );
      await onSubmitVerification({
        case_id: activeCase.id,
        verifier_id: verifierProfile?.id ?? 'prof-ver-1',
        visit_notes: visitNotes,
        household_members: Number(householdMembers) || 4,
        monthly_income_pkr: Number(monthlyIncome) || 15000,
        evidence_urls: evidencePhoto ? [evidencePhoto] : [],
        gps_tehsil_tag: gpsTag || `${activeCase.district} / ${activeCase.tehsil}`,
        verifier_lat: verifierCoords?.lat ?? null,
        verifier_lng: verifierCoords?.lng ?? null,
        distance_from_applicant_km: distKm,
        handshake_pin_verified: pinMatched,
        isOffline: simulateOffline || !navigator.onLine,
      });
      setVisitNotes('');
      setEvidencePhoto(null);
      setGpsTag('');
      setVerifierCoords(null);
      setEnteredHandshakePin('');
      setSyncMessage(
        simulateOffline
          ? `Saved ${activeCase.case_code} offline in IndexedDB. Tap Sync when signal returns.`
          : `Verified ${activeCase.case_code} with GPS lock and forwarded to Verification Board!`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async () => {
    const count = await onSyncOffline();
    setSimulateOffline(false);
    setSyncMessage(
      count > 0
        ? `Synced ${count} offline inspection report(s) from IndexedDB!`
        : 'All IndexedDB field reports are already synced.'
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
      {/* Live Anti-Scam 60-Second Dynamic Field Verifier Digital ID Card */}
      {verifierProfile && <VerifierDynamicIdCard verifier={verifierProfile} />}

      {/* Header Banner */}
      <div className="rounded-3xl bg-emerald-950 p-6 sm:p-8 text-white shadow-glass-lg flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="emerald"
              className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
            >
              <Database className="h-3.5 w-3.5" />
              {t('verifier.offlineReady')}
            </Badge>
            <Badge
              variant="gold"
              className="bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Accredited: {verifierProfile?.full_name}
            </Badge>
            <Badge
              variant={simulateOffline ? 'gold' : 'teal'}
              className={
                simulateOffline
                  ? 'bg-gold-500/25 text-gold-200 border-gold-400/40'
                  : 'bg-white/15 text-white border-white/20'
              }
            >
              {simulateOffline ? (
                <>
                  <WifiOff className="h-3.5 w-3.5" /> Offline Queue Mode
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5" /> {t('verifier.onlineMode')}
                </>
              )}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">{t('verifier.title')}</h1>
          <p className="mt-1.5 max-w-xl text-sm text-emerald-100/85">
            {t('verifier.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSimulateOffline((v) => !v)}
            className="bg-white/10 text-white border-white/25 hover:bg-white/20"
          >
            {simulateOffline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {t('verifier.simulateOffline')}
          </Button>
          <Button variant="gold" size="sm" onClick={handleSync}>
            <RefreshCw className="h-4 w-4" />
            {t('verifier.syncNow')} ({unsyncedCount})
          </Button>
        </div>
      </div>

      {syncMessage && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-2.5 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Pending Field Visit Queue */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-700" />
            {t('verifier.pendingQueue')} ({pendingCases.length})
          </h2>

          {pendingCases.length === 0 ? (
            <Card className="p-6 text-center text-sm text-slate-600">
              All assigned rural Punjab cases have been inspected!
            </Card>
          ) : (
            pendingCases.map((c) => {
              const isSelected = activeCase?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCaseId(c.id);
                    setGpsTag('');
                    setVerifierCoords(null);
                  }}
                  className={`w-full text-start rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-emerald-800 bg-emerald-50/90 ring-2 ring-emerald-700/20'
                      : 'border-slate-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-emerald-900">
                      {c.case_code}
                    </span>
                    <Badge variant="gold">{formatPKR(c.target_amount_pkr)}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                    {c.district} · {c.tehsil} — {c.vendor_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                    {c.anonymized_story_en}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Household Inspection Form with Confidential Dossier + Auto-GPS Lock + Camera/Crop */}
        <Card className="lg:col-span-7 p-6">
          {activeCase ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="font-mono text-xs font-extrabold text-emerald-800">
                    INSPECTING {activeCase.case_code}
                  </span>
                  <h3 className="text-base font-extrabold text-emerald-950">
                    {activeCase.district} · {activeCase.tehsil} ({activeCase.vendor_name})
                  </h3>
                </div>
                <Badge variant="emerald">{t(`categories.${activeCase.category}`)}</Badge>
              </div>

              {/* Confidential Beneficiary Dossier (Visible ONLY to Approved Field Verifier & Admin) */}
              {(activeCase.beneficiary_name ||
                activeCase.beneficiary_phone ||
                activeCase.beneficiary_cnic) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-amber-950">
                      Confidential Household Contact (Verifier-Only)
                    </span>
                    {applicantCoords && (
                      <a
                        href={`https://www.google.com/maps?q=${applicantCoords.lat},${applicantCoords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:underline"
                      >
                        Navigate to Pin <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-800">
                    {activeCase.beneficiary_name && (
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <User className="h-3.5 w-3.5 text-amber-700" />
                        {activeCase.beneficiary_name}
                      </span>
                    )}
                    {activeCase.beneficiary_phone && (
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Phone className="h-3.5 w-3.5 text-amber-700" />
                        {activeCase.beneficiary_phone}
                      </span>
                    )}
                    {activeCase.beneficiary_cnic && (
                      <span className="inline-flex items-center gap-1 font-mono font-semibold">
                        <CreditCard className="h-3.5 w-3.5 text-amber-700" />
                        {activeCase.beneficiary_cnic}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Two-Way Mutual Handshake 4-Digit Visit PIN (Anti-Fake-Visit Proof) */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Two-Way Mutual Visit Handshake PIN (Ask Family In Person)
                  </label>
                  {activeCase.visit_handshake_pin &&
                    enteredHandshakePin.trim() === activeCase.visit_handshake_pin.trim() && (
                      <Badge variant="emerald">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mutual Handshake Verified
                      </Badge>
                    )}
                </div>
                <p className="text-[11px] text-slate-600">
                  After showing your live 60s QR ID Card to the family, ask them for their secret
                  4-digit Amanat Visit PIN to prove an in-person mutual handshake.
                </p>
                <Input
                  value={enteredHandshakePin}
                  onChange={(e) =>
                    setEnteredHandshakePin(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  placeholder="Enter 4-digit Visit PIN from Beneficiary (e.g. 4829)"
                  className="font-mono tracking-[0.25em] font-bold"
                  maxLength={4}
                />
              </div>

              {/* 1-Tap Mobile Auto-GPS Lock + Map Pin + Distance Match */}
              <LocationPinPicker
                label="On-Site GPS Verification Lock"
                district={activeCase.district}
                tehsil={activeCase.tehsil}
                locationText={gpsTag}
                coords={verifierCoords}
                onChange={({ locationText: lt, coords: c }) => {
                  setGpsTag(lt);
                  setVerifierCoords(c);
                }}
                compareToCoords={applicantCoords}
                lockMode
                allowEdit
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    {t('verifier.householdMembers')}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    required
                    value={householdMembers}
                    onChange={(e) => setHouseholdMembers(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    {t('verifier.monthlyIncome')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    required
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  {t('verifier.visitNotes')}
                </label>
                <Textarea
                  rows={3}
                  required
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Confirm household living conditions, Zakat eligibility, and authenticity of vendor pro-forma invoice..."
                />
              </div>

              {/* Camera + Upload + Auto-Compress & Crop Evidence */}
              <SmartImageCapture
                label={t('verifier.attachPhotos')}
                value={evidencePhoto}
                onChange={setEvidencePhoto}
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : t('verifier.submitReport')}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">Select a pending case to inspect.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
