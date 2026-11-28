import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Gem,
  Stethoscope,
  GraduationCap,
  Wheat,
  Shirt,
  ShieldCheck,
  CheckCircle2,
  Building2,
  MapPin,
  Lock,
  UserPlus,
  QrCode,
} from 'lucide-react';
import { BeneficiaryDigitalCard } from './DigitalCards';
import type {
  AuthUserSession,
  CaseCategory,
  FundingType,
  Profile,
  WelfareCase,
} from '@/types/amanat';
import { PUNJAB_DISTRICTS } from '@/lib/seedData';
import { formatPKR, cn, maskCnic } from '@/lib/utils';
import { Badge, Button, Card, Input, Select, Textarea } from './ui/primitives';
import { DualProgressBar } from './DualProgressBar';
import { LocationPinPicker, type GeoCoordinates } from './LocationPinPicker';
import { SmartImageCapture } from './SmartImageCapture';
import { TelegramGuideModal } from './TelegramGuideModal';

interface BeneficiaryWorkspaceProps {
  currentUser: AuthUserSession | null;
  onOpenAuth: () => void;
  onOpenVerifierScanner: () => void;
  cases: WelfareCase[];
  profiles: Profile[];
  onSubmitCase: (payload: {
    category: CaseCategory;
    funding_type: FundingType;
    district: string;
    tehsil: string;
    anonymized_story_en: string;
    anonymized_story_ur: string;
    target_amount_pkr: number;
    vendor_name: string;
    vendor_type: string;
    vendor_invoice_url?: string;
    recipient_email?: string;
    recipient_telegram_id?: string;
    beneficiary_name: string;
    beneficiary_cnic: string;
    beneficiary_phone: string;
    beneficiary_lat: number | null;
    beneficiary_lng: number | null;
    beneficiary_address_note: string;
    beneficiary_account_email: string;
  }) => Promise<WelfareCase>;
}

const CATEGORIES: Array<{ id: CaseCategory; icon: typeof Gem }> = [
  { id: 'daughter_marriage', icon: Gem },
  { id: 'health', icon: Stethoscope },
  { id: 'education', icon: GraduationCap },
  { id: 'ration_food', icon: Wheat },
  { id: 'clothing', icon: Shirt },
];

function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function BeneficiaryWorkspace({
  currentUser,
  onOpenAuth,
  onOpenVerifierScanner,
  cases,
  profiles,
  onSubmitCase,
}: BeneficiaryWorkspaceProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CaseCategory>('health');
  const [fundingType, setFundingType] = useState<FundingType>('zakat_eligible');
  const [district, setDistrict] = useState<string>('Kasur');
  const [tehsil, setTehsil] = useState<string>(PUNJAB_DISTRICTS['Kasur'][0]);

  // Strictly Confidential Identity (hidden publicly; visible only to Admin & Approved Field Verifier)
  const [fullName, setFullName] = useState(currentUser?.full_name ?? '');
  const [cnic, setCnic] = useState('');
  const [phone, setPhone] = useState('');
  const [locationText, setLocationText] = useState('');
  const [coords, setCoords] = useState<GeoCoordinates | null>(null);

  const [vendorName, setVendorName] = useState('');
  const [vendorType, setVendorType] = useState('Hospital / Pharmacy');
  const [amount, setAmount] = useState('85000');
  const [invoicePhoto, setInvoicePhoto] = useState<string | null>(null);
  const [storyEn, setStoryEn] = useState('');
  const [storyUr, setStoryUr] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(currentUser?.email ?? '');
  const [recipientTelegramId, setRecipientTelegramId] = useState('');
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [myCaseFilter, setMyCaseFilter] = useState<
    'all' | 'zakat_eligible' | CaseCategory
  >('all');

  // Any signed-in Google/Email user has instant access (never asks to sign in again!)
  const isBeneficiarySignedIn = Boolean(currentUser);

  // Strict privacy: show ONLY applications belonging to the currently signed-in beneficiary
  const myCases = cases.filter((c) => {
    if (!currentUser) return false;
    const userEmail = currentUser.email.trim().toLowerCase();
    const caseEmail = c.beneficiary_account_email?.trim().toLowerCase() ?? '';
    return (
      (Boolean(caseEmail) && caseEmail === userEmail) ||
      (Boolean(currentUser.profile_id) && c.beneficiary_id === currentUser.profile_id)
    );
  });

  const filteredMyCases = myCases.filter((c) => {
    if (myCaseFilter === 'all') return true;
    if (myCaseFilter === 'zakat_eligible') return c.funding_type === 'zakat_eligible';
    return c.category === myCaseFilter;
  });

  const handleDistrictChange = (dist: string) => {
    setDistrict(dist);
    setTehsil(PUNJAB_DISTRICTS[dist]?.[0] ?? dist);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim() || !storyEn.trim() || !fullName.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      const created = await onSubmitCase({
        category,
        funding_type: fundingType,
        district,
        tehsil,
        anonymized_story_en: storyEn,
        anonymized_story_ur: storyUr || storyEn,
        target_amount_pkr: Number(amount) || 50000,
        vendor_name: vendorName,
        vendor_type: vendorType,
        vendor_invoice_url: invoicePhoto ?? undefined,
        recipient_email: recipientEmail.trim() || currentUser?.email || undefined,
        recipient_telegram_id: recipientTelegramId.trim() || undefined,
        beneficiary_name: fullName,
        beneficiary_cnic: cnic,
        beneficiary_phone: phone,
        beneficiary_lat: coords?.lat ?? null,
        beneficiary_lng: coords?.lng ?? null,
        beneficiary_address_note: locationText || `${district} / ${tehsil}`,
        beneficiary_account_email: currentUser?.email ?? recipientEmail.trim(),
      });
      setJustCreated(created.case_code);
      setVendorName('');
      setStoryEn('');
      setStoryUr('');
      setInvoicePhoto(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isBeneficiarySignedIn) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card className="p-8 text-center space-y-5 border-emerald-900/15">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-900 text-gold-300 shadow-lg">
            <UserPlus className="h-7 w-7" />
          </div>
          <Badge variant="emerald">Instant Sign-Up · Zero-Exposure Privacy</Badge>
          <h1 className="text-2xl font-extrabold text-emerald-950">
            Beneficiary Account Required to Submit Confidential Request
          </h1>
          <p className="mx-auto max-w-lg text-sm text-slate-600 leading-relaxed">
            Signing up takes 5 seconds and requires <strong>no admin approval</strong>. Your
            personal Name, CNIC, Contact Number, and GPS pin remain strictly hidden from the
            public and are shared only with the Verification Board and your assigned Field
            Verifier.
          </p>
          <div className="pt-2">
            <Button variant="primary" size="lg" onClick={onOpenAuth}>
              <ShieldCheck className="h-5 w-5" />
              <span>Sign Up / Continue with Google (Instant Access)</span>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
      <div className="rounded-3xl bg-emerald-950 p-6 sm:p-8 text-white shadow-glass-lg flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Badge
            variant="gold"
            className="mb-2 bg-gold-500/20 text-gold-200 border-gold-400/30"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Signed in as {currentUser!.full_name} ({currentUser!.email}) · 100% Confidential
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold">{t('beneficiary.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-emerald-100/85">
            {t('beneficiary.subtitle')}
          </p>
        </div>

        <Button
          variant="gold"
          size="md"
          onClick={onOpenVerifierScanner}
          className="shrink-0"
        >
          <QrCode className="h-4 w-4" />
          <span>Verify Visitor (Scan QR)</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Dignified Application Form */}
        <Card className="lg:col-span-7 p-6 space-y-5">
          {justCreated && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2 text-sm font-semibold text-emerald-900">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
                <span>
                  Confidential request logged as <strong>{justCreated}</strong> and routed to the
                  Verification Board for area Field Verifier assignment.
                </span>
              </div>
              <p className="text-[11px] font-medium text-emerald-800 bg-white/80 rounded-xl px-3 py-2 border border-emerald-200/70">
                <strong>Inbox Tip (ای میل ہدایت):</strong> Check your Inbox (or Spam folder once)
                for <span className="font-mono font-bold">support.amanat@gmail.com</span> and tap{' '}
                <strong>&ldquo;Not Spam&rdquo;</strong> so Field Verifier visit alerts &amp; QR
                safety instructions land directly in your Primary Inbox.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Strictly Confidential Identity Section */}
            <div className="rounded-2xl border border-emerald-900/15 bg-emerald-50/50 p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-emerald-700" />
                  Confidential Personal Identity (Hidden Publicly)
                </p>
                <Badge variant="emerald">Admin &amp; Verifier Only</Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Full Name *
                  </label>
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Applicant Full Name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    CNIC Number *
                  </label>
                  <Input
                    required
                    value={cnic}
                    onChange={(e) => setCnic(formatCnic(e.target.value))}
                    placeholder="35202-1234567-1"
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Contact Number *
                  </label>
                  <Input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-slate-600">
                {t('beneficiary.selectCategory')}
              </label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {CATEGORIES.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition-all',
                      category === id
                        ? 'border-emerald-800 bg-emerald-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-emerald-50'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[11px] font-bold leading-tight">
                      {t(`categories.${id}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  {t('beneficiary.district')}
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
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  {t('beneficiary.tehsil')}
                </label>
                <Select value={tehsil} onChange={(e) => setTehsil(e.target.value)}>
                  {(PUNJAB_DISTRICTS[district] ?? [district]).map((th) => (
                    <option key={th} value={th}>
                      {th}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Zakat / Sadaqah
                </label>
                <Select
                  value={fundingType}
                  onChange={(e) => setFundingType(e.target.value as FundingType)}
                >
                  <option value="zakat_eligible">{t('funding.zakat_eligible')}</option>
                  <option value="sadaqah_general">{t('funding.sadaqah_general')}</option>
                </Select>
              </div>
            </div>

            {/* Auto-Detect GPS Pin with Edit Option */}
            <LocationPinPicker
              label="Household Location Pin (Auto-Detect or Edit — Hidden Publicly)"
              district={district}
              tehsil={tehsil}
              locationText={locationText}
              coords={coords}
              onChange={({ locationText: lt, coords: c, detectedCity }) => {
                setLocationText(lt);
                setCoords(c);
                if (detectedCity) {
                  const matchedDist = Object.keys(PUNJAB_DISTRICTS).find(
                    (d) =>
                      detectedCity.toLowerCase().includes(d.toLowerCase()) ||
                      d.toLowerCase().includes(detectedCity.toLowerCase())
                  );
                  if (matchedDist && matchedDist !== district) {
                    setDistrict(matchedDist);
                    setTehsil(PUNJAB_DISTRICTS[matchedDist][0]);
                  }
                }
              }}
              allowEdit
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  {t('beneficiary.vendorName')}
                </label>
                <Input
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. DHQ Hospital Pharmacy / Al-Noor School"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  {t('beneficiary.amount')}
                </label>
                <Input
                  type="number"
                  min={2000}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                {t('beneficiary.vendorType')}
              </label>
              <Input
                value={vendorType}
                onChange={(e) => setVendorType(e.target.value)}
                placeholder="Hospital, School, Ration Store, Wedding Essentials Vendor"
              />
            </div>

            {/* Camera + Upload + Crop Vendor Pro-Forma Invoice */}
            <SmartImageCapture
              label="Vendor Estimate / Hospital Bill / School Challan Photo (Optional)"
              value={invoicePhoto}
              onChange={setInvoicePhoto}
            />

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                {t('beneficiary.storyEn')}
              </label>
              <Textarea
                rows={3}
                required
                value={storyEn}
                onChange={(e) => setStoryEn(e.target.value)}
                placeholder="Describe household need without including personal names or CNIC..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                {t('beneficiary.storyUr')}
              </label>
              <Textarea
                rows={2}
                dir="rtl"
                value={storyUr}
                onChange={(e) => setStoryUr(e.target.value)}
                placeholder="ضرورت کی تفصیل (اختیاری)"
              />
            </div>

            <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/40 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-emerald-950">
                  Private Step-by-Step Case Updates (Never Shown Publicly)
                </p>
                <button
                  type="button"
                  onClick={() => setShowTelegramGuide(true)}
                  className="text-xs font-extrabold text-sky-700 hover:text-sky-900 underline"
                >
                  How to get Telegram ID?
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Private Email for milestone alerts"
                />
                <Input
                  type="text"
                  value={recipientTelegramId}
                  onChange={(e) => setRecipientTelegramId(e.target.value)}
                  placeholder="Private Telegram Chat ID (e.g. 987654321)"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : t('beneficiary.submit')}
            </Button>
          </form>
        </Card>

        {/* Live Application & Payout Tracker */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-2.5">
            <h2 className="text-lg font-extrabold text-emerald-950">
              {t('beneficiary.trackerTitle')} ({myCases.length})
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: t('cases.filters.all') },
                  { id: 'zakat_eligible', label: t('cases.filters.zakat_eligible') },
                  { id: 'daughter_marriage', label: t('cases.filters.daughter_marriage') },
                  { id: 'health', label: t('cases.filters.health') },
                  { id: 'education', label: t('cases.filters.education') },
                  { id: 'ration_food', label: t('cases.filters.ration_food') },
                  { id: 'clothing', label: t('cases.filters.clothing') },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMyCaseFilter(f.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-[11px] font-bold transition-all border',
                    myCaseFilter === f.id
                      ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm'
                      : 'bg-white text-slate-700 border-emerald-900/15 hover:bg-emerald-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredMyCases.length === 0 ? (
            <Card className="p-6 text-center space-y-2 border-dashed border-emerald-900/20">
              <p className="text-sm font-extrabold text-emerald-950">
                {myCases.length === 0
                  ? 'No applications submitted under your account yet'
                  : 'No applications match this category filter'}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {myCases.length === 0
                  ? 'For your privacy, only applications submitted from your signed-in account appear here. Submit the form on the left to track your case live.'
                  : 'Switch to "All" to view all of your submitted requests.'}
              </p>
            </Card>
          ) : (
            filteredMyCases.map((c) => {
              const verifier = profiles.find((p) => p.id === c.assigned_verifier_id);
              return (
                <Card key={c.id} className="p-5 space-y-3.5">
                  <BeneficiaryDigitalCard
                    welfareCase={c}
                    assignedVerifierName={verifier?.full_name}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-lg">
                      {c.case_code}
                    </span>
                    <Badge
                      variant={
                        c.status === 'approved' || c.status === 'disbursed_to_vendor'
                          ? 'emerald'
                          : c.status === 'rejected'
                          ? 'rose'
                          : 'gold'
                      }
                    >
                      {c.status.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>
                  {c.status === 'rejected' && c.rejection_reason && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                      <strong>Board Note:</strong> {c.rejection_reason}
                    </div>
                  )}
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {c.anonymized_story_en}
                  </p>
                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                      {c.district} · {c.tehsil}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-emerald-700" />
                      Vendor: <strong>{c.vendor_name}</strong> ({formatPKR(c.target_amount_pkr)})
                    </p>
                    {verifier && (
                      <div className="mt-2 rounded-2xl border border-teal-200 bg-teal-50/70 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800">
                            Who Is Visiting You (Pre-Visit Safety Card)
                          </span>
                          {c.visit_handshake_pin && (
                            <span className="rounded-lg bg-emerald-900 px-2.5 py-0.5 font-mono text-xs font-extrabold tracking-[0.2em] text-gold-300">
                              PIN: {c.visit_handshake_pin}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {verifier.photo_url ? (
                            <img
                              src={verifier.photo_url}
                              alt={verifier.full_name}
                              className="h-12 w-12 rounded-xl object-cover border-2 border-teal-600 shrink-0"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-900 text-gold-200 font-black text-sm shrink-0">
                              {verifier.full_name
                                .split(' ')
                                .map((w) => w[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 text-[11px] space-y-0.5">
                            <p className="font-extrabold text-emerald-950">{verifier.full_name}</p>
                            <p className="text-slate-600">
                              {verifier.tehsil}, {verifier.district} · CNIC:{' '}
                              <span className="font-mono font-bold text-teal-900">
                                {maskCnic(verifier.cnic_number)}
                              </span>
                            </p>
                          </div>
                        </div>
                        {c.visit_handshake_pin && (
                          <p className="text-[10px] text-teal-900 leading-relaxed">
                            Match face &amp; scan their live 60s QR first, then share your secret
                            4-digit Visit PIN ({c.visit_handshake_pin}). Never pay any cash or fee.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <DualProgressBar
                    target={c.target_amount_pkr}
                    collected={c.raised_amount_pkr}
                    pledged={c.pledged_amount_pkr}
                    compact
                  />
                </Card>
              );
            })
          )}
        </div>
      </div>
      <TelegramGuideModal
        isOpen={showTelegramGuide}
        onClose={() => setShowTelegramGuide(false)}
      />
    </div>
  );
}
