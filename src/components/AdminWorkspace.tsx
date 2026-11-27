import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PlusCircle,
  Pause,
  Play,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  Sparkles,
  FileCheck2,
  UserCheck,
  Settings,
  LogOut,
  Save,
  Send,
  KeyRound,
  Globe,
  Landmark,
  Share2,
  MapPin,
  Download,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { VolunteerPostModal } from './VolunteerPostModal';
import {
  exportAllCampaignsCsv,
  exportFullAuditLedgerCsv,
  exportSingleCampaignCsv,
} from '@/lib/csvExport';
import type {
  AppSettings,
  CampaignCategory,
  CampaignStatus,
  CrowdfundingCampaign,
  Donation,
  FundingType,
  NotificationRecord,
  Profile,
  WelfareCase,
} from '@/types/amanat';
import { PUNJAB_DISTRICTS, makeInvoiceDataUrl } from '@/lib/seedData';
import { formatPKR, cn } from '@/lib/utils';
import { generateSecureOtp, hashAdminPassword, sendTelegramOtp } from '@/lib/adminAuth';
import { Badge, Button, Card, Input, Select, Textarea } from './ui/primitives';
import { DualProgressBar } from './DualProgressBar';

interface AdminWorkspaceProps {
  campaigns: CrowdfundingCampaign[];
  cases: WelfareCase[];
  donations: Donation[];
  profiles: Profile[];
  notifications: NotificationRecord[];
  settings: AppSettings;
  onCreateCampaign: (payload: {
    title_en: string;
    title_ur: string;
    summary_en: string;
    summary_ur: string;
    category: CampaignCategory;
    funding_type: FundingType;
    district: string;
    target_amount_pkr: number;
    vendor_name: string;
    deadline_date: string;
  }) => Promise<CrowdfundingCampaign>;
  onUpdateCampaignStatus: (id: string, status: CampaignStatus) => Promise<void>;
  onConfirmDonation: (donationId: string) => Promise<void>;
  onApproveCase: (caseId: string) => Promise<void>;
  onAssignVerifier: (caseId: string, verifierId: string) => Promise<void>;
  onToggleVerifier: (profileId: string, accredited: boolean) => Promise<void>;
  onUploadCampaignReceipt: (id: string, receiptUrl: string) => Promise<void>;
  onUploadCaseReceipt: (id: string, receiptUrl: string) => Promise<void>;
  onSaveSettings: (next: AppSettings) => Promise<void>;
  onSendTestNotification: () => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onDeleteCase: (id: string) => Promise<void>;
  onDeleteDonation: (id: string) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onFlushDummyData: () => Promise<void>;
  onLogoutAdmin: () => void;
}

export function AdminWorkspace({
  campaigns,
  cases,
  donations,
  profiles,
  notifications,
  settings,
  onCreateCampaign,
  onUpdateCampaignStatus,
  onConfirmDonation,
  onApproveCase,
  onAssignVerifier,
  onToggleVerifier,
  onUploadCampaignReceipt,
  onUploadCaseReceipt,
  onSaveSettings,
  onSendTestNotification,
  onDeleteCampaign,
  onDeleteCase,
  onDeleteDonation,
  onDeleteProfile,
  onFlushDummyData,
  onLogoutAdmin,
}: AdminWorkspaceProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'crowdfunding' | 'audit' | 'settings'>('crowdfunding');
  const [notice, setNotice] = useState<string | null>(null);

  // New Campaign form state
  const [titleEn, setTitleEn] = useState('');
  const [titleUr, setTitleUr] = useState('');
  const [summaryEn, setSummaryEn] = useState('');
  const [summaryUr, setSummaryUr] = useState('');
  const [category, setCategory] = useState<CampaignCategory>('daughter_marriage');
  const [fundingType, setFundingType] = useState<FundingType>('zakat_eligible');
  const [district, setDistrict] = useState('Multan');
  const [targetPkr, setTargetPkr] = useState('500000');
  const [vendorName, setVendorName] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('2026-12-30');
  const [creating, setCreating] = useState(false);

  // Settings form state
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [newPassword, setNewPassword] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [volunteerPostCase, setVolunteerPostCase] = useState<WelfareCase | null>(null);
  const [flushConfirmText, setFlushConfirmText] = useState('');
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const pendingDonations = donations.filter((d) => d.status === 'pledged_pending_verify');
  const incomingTriageCases = cases.filter((c) => c.status === 'pending_admin_review');
  const fieldVerifiedCases = cases.filter((c) => c.status === 'field_verified');
  const verifiers = profiles.filter((p) => p.role === 'verifier');
  const accreditedVerifiers = verifiers.filter((v) => v.is_accredited_verifier);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn.trim() || !vendorName.trim()) return;
    setCreating(true);
    try {
      const created = await onCreateCampaign({
        title_en: titleEn,
        title_ur: titleUr || titleEn,
        summary_en:
          summaryEn ||
          `Direct vendor escrow crowdfunding drive in ${district}, Punjab settled strictly via ${vendorName}.`,
        summary_ur: summaryUr || summaryEn || titleUr || titleEn,
        category,
        funding_type: fundingType,
        district,
        target_amount_pkr: Number(targetPkr) || 300000,
        vendor_name: vendorName,
        deadline_date: deadlineDate,
      });
      setTitleEn('');
      setTitleUr('');
      setSummaryEn('');
      setSummaryUr('');
      setVendorName('');
      setNotice(
        `Published live crowdfunding drive ${created.campaign_code}: "${created.title_en}"!`
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSaveAllSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      let nextHash = draftSettings.admin_password_hash;
      if (newPassword.trim().length >= 6) {
        nextHash = await hashAdminPassword(newPassword.trim());
      }
      await onSaveSettings({
        ...draftSettings,
        admin_password_hash: nextHash,
      });
      setNewPassword('');
      setNotice(
        'Saved Social Media Links, Escrow Payment Accounts & Telegram 2FA Settings! Changes are now live across the app.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    try {
      const sampleCode = generateSecureOtp();
      const res = await sendTelegramOtp(
        sampleCode,
        draftSettings.telegram_config,
        `✅ *Amanat Telegram 2FA Test*\n\nConnection verified! Sample OTP: \`${sampleCode}\``
      );
      if (res.sentVia === 'telegram' && !res.error) {
        setNotice('Test Telegram OTP sent successfully! Check your Telegram chat.');
      } else {
        setNotice(
          res.error ??
            'Enter both Telegram Bot Token (@BotFather) and Admin Chat ID (@userinfobot) to send a live Telegram test.'
        );
      }
    } finally {
      setTestingTelegram(false);
    }
  };

  const getDonationTargetLabel = (d: Donation) => {
    if (d.campaign_id) {
      const camp = campaigns.find((c) => c.id === d.campaign_id);
      return camp ? `${camp.campaign_code} · ${camp.title_en}` : 'Campaign';
    }
    const c = cases.find((x) => x.id === d.case_id);
    return c ? `${c.case_code} · ${c.district}` : 'Case';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Header */}
      <div className="rounded-3xl bg-emerald-950 p-6 sm:p-8 text-white shadow-glass-lg flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="gold"
              className="bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              2FA Verified Admin Session
            </Badge>
            <button
              type="button"
              onClick={onLogoutAdmin}
              className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-100 hover:bg-rose-500/35 transition"
            >
              <LogOut className="h-3 w-3" />
              Lock / Sign Out
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">{t('admin.title')}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-emerald-100/85">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Admin Sub-tabs */}
        <div className="flex flex-wrap rounded-2xl bg-white/10 p-1.5 border border-white/15 gap-1">
          <button
            type="button"
            onClick={() => setTab('crowdfunding')}
            className={cn(
              'rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all',
              tab === 'crowdfunding'
                ? 'bg-gold-500 text-white shadow-gold'
                : 'text-emerald-100 hover:bg-white/10'
            )}
          >
            {t('admin.tabCrowdfunding')} ({campaigns.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={cn(
              'rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all',
              tab === 'audit'
                ? 'bg-gold-500 text-white shadow-gold'
                : 'text-emerald-100 hover:bg-white/10'
            )}
          >
            {t('admin.tabAudit')} ({pendingDonations.length + fieldVerifiedCases.length + incomingTriageCases.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all',
              tab === 'settings'
                ? 'bg-gold-500 text-white shadow-gold'
                : 'text-emerald-100 hover:bg-white/10'
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{t('admin.tabSettings')}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between gap-3 text-sm font-semibold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs font-bold text-emerald-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {tab === 'crowdfunding' ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Create New Crowdfunding Drive Form */}
          <Card className="lg:col-span-5 p-6 space-y-4">
            <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-gold-600" />
              {t('admin.createDrive')}
            </h2>

            <form onSubmit={handleCreateCampaign} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Campaign Title (English)
                </label>
                <Input
                  required
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. Multan Winter Blanket & Ration Drive"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Campaign Title (اردو)
                </label>
                <Input
                  dir="rtl"
                  value={titleUr}
                  onChange={(e) => setTitleUr(e.target.value)}
                  placeholder="ملتان سردیوں کے کمبل اور راشن مہم"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Category
                  </label>
                  <Select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CampaignCategory)}
                  >
                    <option value="daughter_marriage">Daughter's Marriage</option>
                    <option value="health">Health & Medical</option>
                    <option value="education">Education</option>
                    <option value="ration_food">Food / Ration</option>
                    <option value="emergency_relief">Emergency Relief</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Funding Type
                  </label>
                  <Select
                    value={fundingType}
                    onChange={(e) => setFundingType(e.target.value as FundingType)}
                  >
                    <option value="zakat_eligible">Zakat Eligible</option>
                    <option value="sadaqah_general">Sadaqah / General</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    District
                  </label>
                  <Select value={district} onChange={(e) => setDistrict(e.target.value)}>
                    {Object.keys(PUNJAB_DISTRICTS).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Target (PKR)
                  </label>
                  <Input
                    type="number"
                    min={10000}
                    required
                    value={targetPkr}
                    onChange={(e) => setTargetPkr(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Deadline
                  </label>
                  <Input
                    type="date"
                    required
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Named Escrow Vendor (Hospital / Depot / Store)
                </label>
                <Input
                  required
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Nishtar Hospital Charity Pharmacy, Multan"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Summary (English)
                </label>
                <Textarea
                  rows={2}
                  value={summaryEn}
                  onChange={(e) => setSummaryEn(e.target.value)}
                  placeholder="Brief scope of verified vendor disbursement..."
                />
              </div>

              <Button
                type="submit"
                variant="gold"
                size="lg"
                className="w-full"
                disabled={creating}
              >
                <Sparkles className="h-4 w-4" />
                <span>{creating ? 'Publishing...' : t('admin.publishDrive')}</span>
              </Button>
            </form>
          </Card>

          {/* Live Simultaneous Campaigns Monitor */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-emerald-950">
                All Crowdfunding Drives ({campaigns.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportAllCampaignsCsv(campaigns)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export All Campaigns CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportFullAuditLedgerCsv(campaigns, cases, donations)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Full Audit CSV
                </Button>
              </div>
            </div>
            {campaigns.map((camp) => (
              <Card key={camp.id} className="p-5 space-y-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                        {camp.campaign_code}
                      </span>
                      <Badge
                        variant={
                          camp.status === 'active'
                            ? 'emerald'
                            : camp.status === 'paused'
                            ? 'rose'
                            : 'gold'
                        }
                      >
                        {camp.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <h3 className="mt-1.5 text-sm font-extrabold text-emerald-950">
                      {camp.title_en}
                    </h3>
                    <p className="text-xs text-slate-600">
                      {camp.district} · Vendor: <strong>{camp.vendor_name}</strong> ·{' '}
                      {camp.donor_count} donors
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {camp.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateCampaignStatus(camp.id, 'paused')}
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                    {camp.status === 'paused' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onUpdateCampaignStatus(camp.id, 'active')}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </Button>
                    )}
                    {camp.status !== 'disbursed_to_vendor' &&
                      camp.collected_amount_pkr > 0 && (
                        <Button
                          variant="gold"
                          size="sm"
                          onClick={async () => {
                            const rcpt = makeInvoiceDataUrl(
                              `Paid Disbursement — ${camp.title_en}`,
                              camp.vendor_name,
                              camp.collected_amount_pkr,
                              `RCPT-${camp.campaign_code}`,
                              true
                            );
                            await onUploadCampaignReceipt(camp.id, rcpt);
                            setNotice(`Uploaded Paid Vendor Receipt for ${camp.campaign_code}!`);
                          }}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                          {t('admin.uploadPaidReceipt')}
                        </Button>
                      )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportSingleCampaignCsv(camp, donations)}
                      title="Download CSV report for this campaign"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm(`Delete campaign ${camp.campaign_code}?`)) return;
                        await onDeleteCampaign(camp.id);
                        setNotice(`Deleted campaign ${camp.campaign_code} from database.`);
                      }}
                      title="Delete Campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <DualProgressBar
                  target={camp.target_amount_pkr}
                  collected={camp.collected_amount_pkr}
                  pledged={camp.pledged_amount_pkr}
                />
              </Card>
            ))}
          </div>
        </div>
      ) : tab === 'audit' ? (
        /* Case & Payment Audit Tab */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7 p-6 space-y-4">
            <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-gold-600" />
              {t('admin.pendingDonations')} ({pendingDonations.length})
            </h2>

            {pendingDonations.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                All donor transaction references are confirmed.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingDonations.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gold-200 bg-gold-50/40 p-4"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-emerald-950 text-sm">
                          {formatPKR(d.amount_pkr)}
                        </span>
                        <Badge variant="gold">{d.payment_channel.toUpperCase()}</Badge>
                        <span className="font-mono font-bold text-slate-700">
                          REF: {d.transaction_ref}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium">{getDonationTargetLabel(d)}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        QR: {d.receipt_qr_hash}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          await onConfirmDonation(d.id);
                          setNotice(
                            `Confirmed ${formatPKR(d.amount_pkr)} (Ref: ${d.transaction_ref}) — progress bar & donor count updated!`
                          );
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {t('admin.confirmPayment')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          if (!window.confirm(`Delete donation ref ${d.transaction_ref}?`)) return;
                          await onDeleteDonation(d.id);
                          setNotice(`Deleted donation ${d.transaction_ref}.`);
                        }}
                        title="Delete Donation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Incoming Beneficiary Requests — Admin Triage & Area Verifier Matching */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-700" />
                Incoming Beneficiary Requests — Triage &amp; Local Verifier Matcher (
                {incomingTriageCases.length})
              </h3>
              {incomingTriageCases.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No new beneficiary requests awaiting area verifier assignment.
                </p>
              ) : (
                incomingTriageCases.map((c) => {
                  const localMatches = accreditedVerifiers.filter(
                    (v) => v.district.toLowerCase() === c.district.toLowerCase()
                  );
                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-extrabold text-emerald-900">
                          {c.case_code} · {c.district} / {c.tehsil} ({formatPKR(c.target_amount_pkr)})
                        </span>
                        <Badge variant={localMatches.length > 0 ? 'emerald' : 'rose'}>
                          {localMatches.length > 0
                            ? `${localMatches.length} Accredited Verifier in ${c.district}`
                            : `No Accredited Verifier in ${c.district}`}
                        </Badge>
                      </div>
                      {(c.beneficiary_name || c.beneficiary_cnic || c.beneficiary_phone) && (
                        <p className="text-[11px] font-semibold text-amber-950 bg-white/80 rounded-lg px-2.5 py-1.5 border border-amber-200/70">
                          Confidential: <strong>{c.beneficiary_name}</strong> · CNIC:{' '}
                          <span className="font-mono">{c.beneficiary_cnic}</span> · Phone:{' '}
                          {c.beneficiary_phone}
                        </p>
                      )}
                      <p className="text-slate-700">{c.anonymized_story_en}</p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {localMatches.length > 0 ? (
                          localMatches.map((v) => (
                            <Button
                              key={v.id}
                              variant="primary"
                              size="sm"
                              onClick={async () => {
                                await onAssignVerifier(c.id, v.id);
                                setNotice(
                                  `Assigned ${v.full_name} (${v.district}) to inspect ${c.case_code}!`
                                );
                              }}
                            >
                              Assign Local Verifier: {v.full_name}
                            </Button>
                          ))
                        ) : (
                          <Button
                            variant="gold"
                            size="sm"
                            onClick={() => setVolunteerPostCase(c)}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Generate Volunteer Social Post ({c.tehsil}, {c.district})
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-3">
              <h3 className="text-sm font-extrabold text-emerald-950">
                {t('admin.pendingCases')} ({fieldVerifiedCases.length})
              </h3>
              {fieldVerifiedCases.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No field-verified cases waiting for publication.
                </p>
              ) : (
                fieldVerifiedCases.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"
                  >
                    <div className="text-xs space-y-1">
                      <span className="font-mono font-extrabold text-emerald-900">
                        {c.case_code} · {c.district} ({formatPKR(c.target_amount_pkr)})
                      </span>
                      <p className="text-slate-700">{c.anonymized_story_en}</p>
                      <p className="text-slate-500">Vendor: {c.vendor_name}</p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        await onApproveCase(c.id);
                        setNotice(`Approved & published ${c.case_code} to the public donor feed!`);
                      }}
                    >
                      {t('admin.approvePublish')}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <div className="lg:col-span-5 space-y-6">
            <Card className="p-6 space-y-3.5">
              <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-700" />
                {t('admin.verifiersList')}
              </h2>
              {verifiers.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="text-xs">
                    <p className="font-extrabold text-slate-900">{v.full_name}</p>
                    <p className="text-slate-500">
                      {v.district} · {v.tehsil}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant={v.is_accredited_verifier ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => onToggleVerifier(v.id, !v.is_accredited_verifier)}
                    >
                      {v.is_accredited_verifier ? t('admin.revoke') : t('admin.accredit')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm(`Delete verifier profile ${v.full_name}?`)) return;
                        await onDeleteProfile(v.id);
                        setNotice(`Deleted verifier ${v.full_name}.`);
                      }}
                      title="Delete Profile"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>

            <Card className="p-6 space-y-3">
              <h2 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                <Receipt className="h-4 w-4 text-gold-600" />
                Upload Paid Vendor Receipts (Approved Cases)
              </h2>
              {cases
                .filter((c) => c.status === 'approved' || c.status === 'funded')
                .slice(0, 4)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-emerald-900">{c.case_code}</p>
                      <p className="truncate text-slate-600">{c.vendor_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={async () => {
                          const rcpt = makeInvoiceDataUrl(
                            `Paid Vendor Receipt (${c.case_code})`,
                            c.vendor_name,
                            c.raised_amount_pkr || c.target_amount_pkr,
                            `RCPT-${c.case_code}`,
                            true
                          );
                          await onUploadCaseReceipt(c.id, rcpt);
                          setNotice(`Closed loop with Paid Vendor Receipt for ${c.case_code}!`);
                        }}
                      >
                        Mark Paid
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          if (!window.confirm(`Delete case ${c.case_code}?`)) return;
                          await onDeleteCase(c.id);
                          setNotice(`Deleted case ${c.case_code}.`);
                        }}
                        title="Delete Case"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
            </Card>
          </div>
        </div>
      ) : (
        /* Dedicated Settings, Social Media, Escrow Accounts & Telegram 2FA Tab */
        <form onSubmit={handleSaveAllSettings} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Social Media & Direct Contact Bar + Telegram 2FA Setup */}
            <Card className="p-6 space-y-4">
              <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-700" />
                Social Media, Contact Channels &amp; Telegram 2FA
              </h2>
              <p className="text-xs text-slate-500">
                Leave any field blank to hide that icon from the public social bar.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">TikTok URL</label>
                  <Input
                    value={draftSettings.social_links.tiktok}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        social_links: { ...s.social_links, tiktok: e.target.value },
                      }))
                    }
                    placeholder="https://tiktok.com/@amanat"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Facebook URL
                  </label>
                  <Input
                    value={draftSettings.social_links.facebook}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        social_links: { ...s.social_links, facebook: e.target.value },
                      }))
                    }
                    placeholder="https://facebook.com/amanat"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    X (Twitter) URL
                  </label>
                  <Input
                    value={draftSettings.social_links.x}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        social_links: { ...s.social_links, x: e.target.value },
                      }))
                    }
                    placeholder="https://x.com/amanat"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    YouTube URL
                  </label>
                  <Input
                    value={draftSettings.social_links.youtube}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        social_links: { ...s.social_links, youtube: e.target.value },
                      }))
                    }
                    placeholder="https://youtube.com/@amanat"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    WhatsApp Link / Number
                  </label>
                  <Input
                    value={draftSettings.social_links.whatsapp}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        social_links: { ...s.social_links, whatsapp: e.target.value },
                      }))
                    }
                    placeholder="https://wa.me/923001234567"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Official Email
                  </label>
                  <Input
                    type="email"
                    value={draftSettings.social_links.email}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        social_links: { ...s.social_links, email: e.target.value },
                      }))
                    }
                    placeholder="trust@amanat.pk"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Public Telegram Channel / Support Link
                  </label>
                  <Input
                    value={draftSettings.social_links.telegram}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        social_links: { ...s.social_links, telegram: e.target.value },
                      }))
                    }
                    placeholder="https://t.me/amanatpunjab"
                  />
                </div>
              </div>

              {/* Telegram 2FA OTP Setup */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-sky-600" />
                    Telegram 2FA OTP Bot Setup (Gate 2)
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestTelegram}
                    disabled={testingTelegram}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {testingTelegram ? 'Sending...' : 'Send Test OTP'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Telegram Bot Token (@BotFather)
                    </label>
                    <Input
                      type="password"
                      value={draftSettings.telegram_config.botToken}
                      onChange={(e) =>
                        setDraftSettings((s) => ({
                          ...s,
                          telegram_config: {
                            ...s.telegram_config,
                            botToken: e.target.value,
                          },
                        }))
                      }
                      placeholder="123456789:AAH..."
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Admin Telegram Chat ID (@userinfobot)
                    </label>
                    <Input
                      value={draftSettings.telegram_config.chatId}
                      onChange={(e) =>
                        setDraftSettings((s) => ({
                          ...s,
                          telegram_config: {
                            ...s.telegram_config,
                            chatId: e.target.value,
                          },
                        }))
                      }
                      placeholder="e.g. 987654321"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftSettings.telegram_config.requireRealTelegramOtp}
                    onChange={(e) =>
                      setDraftSettings((s) => ({
                        ...s,
                        telegram_config: {
                          ...s.telegram_config,
                          requireRealTelegramOtp: e.target.checked,
                        },
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                  />
                  Strictly require live Telegram OTP delivery (disable local fallback)
                </label>
              </div>
            </Card>

            {/* 2. Escrow Payment Accounts + Admin Password */}
            <Card className="p-6 space-y-4">
              <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                <Landmark className="h-5 w-5 text-gold-600" />
                Direct Escrow Payment Accounts (Live in Donor Modal)
              </h2>
              <p className="text-xs text-slate-500">
                Updates Raast, JazzCash, EasyPaisa, Meezan Bank, and Overseas SWIFT everywhere
                instantly.
              </p>

              <div className="space-y-3">
                {(
                  [
                    ['raast', 'Raast Instant ID'],
                    ['jazzcash', 'JazzCash Account'],
                    ['easypaisa', 'EasyPaisa Account'],
                    ['bank_transfer', 'Meezan Bank IBAN'],
                    ['international_wire', 'Overseas SWIFT / Roshan Digital'],
                  ] as const
                ).map(([key, heading]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2"
                  >
                    <p className="text-xs font-extrabold text-emerald-900">{heading}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        value={draftSettings.escrow_accounts[key].accountTitle}
                        onChange={(e) =>
                          setDraftSettings((s) => ({
                            ...s,
                            escrow_accounts: {
                              ...s.escrow_accounts,
                              [key]: {
                                ...s.escrow_accounts[key],
                                accountTitle: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="Account Title"
                      />
                      <Input
                        value={draftSettings.escrow_accounts[key].value}
                        onChange={(e) =>
                          setDraftSettings((s) => ({
                            ...s,
                            escrow_accounts: {
                              ...s.escrow_accounts,
                              [key]: {
                                ...s.escrow_accounts[key],
                                value: e.target.value,
                              },
                            },
                          }))
                        }
                        placeholder="Number / IBAN / SWIFT"
                        className="font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Gmail Notification Gateway (support.amanat@gmail.com) + Test Broadcast */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-emerald-950">
                    Gmail Notification Gateway (Major Milestones: 25% · 50% · 75% · 100%)
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await onSendTestNotification();
                      setNotice(
                        'Dispatched a Test 3-Channel Milestone Notification! Open the Notification Bell in the header to preview the Gmail HTML & Telegram card.'
                      );
                    }}
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send Test Milestone Alert
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Official Sender Gmail
                    </label>
                    <Input
                      type="email"
                      value={
                        draftSettings.email_gateway?.senderEmail ?? 'support.amanat@gmail.com'
                      }
                      onChange={(e) =>
                        setDraftSettings((s) => ({
                          ...s,
                          email_gateway: {
                            senderEmail: e.target.value,
                            senderName:
                              s.email_gateway?.senderName ?? 'Amanat — Sacred Trust (امانت)',
                            gmailAppPasswordConfigured:
                              s.email_gateway?.gmailAppPasswordConfigured ?? false,
                            edgeFunctionUrl: s.email_gateway?.edgeFunctionUrl ?? '',
                          },
                        }))
                      }
                      placeholder="support.amanat@gmail.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Supabase Edge Function URL (Gmail SMTP)
                    </label>
                    <Input
                      value={draftSettings.email_gateway?.edgeFunctionUrl ?? ''}
                      onChange={(e) =>
                        setDraftSettings((s) => ({
                          ...s,
                          email_gateway: {
                            senderEmail:
                              s.email_gateway?.senderEmail ?? 'support.amanat@gmail.com',
                            senderName:
                              s.email_gateway?.senderName ?? 'Amanat — Sacred Trust (امانت)',
                            gmailAppPasswordConfigured: Boolean(e.target.value.trim()),
                            edgeFunctionUrl: e.target.value,
                          },
                        }))
                      }
                      placeholder="https://<project>.supabase.co/functions/v1/dispatch-notifications"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Recent 3-Channel Outbox: <strong>{notifications.length}</strong> milestone
                  notifications logged across App, Gmail ({draftSettings.email_gateway?.senderEmail ?? 'support.amanat@gmail.com'}), and Telegram.
                </p>
              </div>

              {/* Admin Master Password Update */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-emerald-700" />
                  Update Admin Master Password (Gate 1)
                </h3>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password (min 6 chars)"
                />
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-950 p-4 text-white">
            <p className="text-xs text-emerald-100/85">
              Directly synced to live database (<code>public.app_settings</code>) · Last saved:{' '}
              <strong>{new Date(settings.updated_at).toLocaleString('en-GB')}</strong>
            </p>
            <Button type="submit" variant="gold" size="lg" disabled={savingSettings}>
              <Save className="h-4 w-4" />
              <span>{savingSettings ? 'Saving...' : 'Save All Settings & Accounts'}</span>
            </Button>
          </div>

          {/* Production Go-Live: Flush All Dummy / Seed Data */}
          <Card className="p-6 border-rose-200 bg-rose-50/40 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-extrabold text-rose-950">
                  Production Go-Live: Flush All Dummy / Seed Data
                </h3>
                <p className="text-xs text-rose-900/85 mt-0.5">
                  Permanently deletes all sample campaigns, sample cases, sample verifiers, and
                  demo donations from Supabase so your platform starts 100% clean for real Zakat
                  funding. Your Admin Settings, Social Links, Escrow Accounts, and real Google
                  users are preserved.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Input
                value={flushConfirmText}
                onChange={(e) => setFlushConfirmText(e.target.value)}
                placeholder='Type "FLUSH DEMO DATA" to confirm'
                className="font-mono border-rose-300"
              />
              <Button
                type="button"
                variant="danger"
                size="md"
                disabled={flushing || flushConfirmText.trim() !== 'FLUSH DEMO DATA'}
                onClick={async () => {
                  setFlushing(true);
                  try {
                    await onFlushDummyData();
                    setFlushConfirmText('');
                    setNotice(
                      'All dummy/seed data flushed cleanly! Your live database is now ready for real funding.'
                    );
                  } finally {
                    setFlushing(false);
                  }
                }}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
                <span>{flushing ? 'Flushing...' : 'Flush All Dummy Data'}</span>
              </Button>
            </div>
          </Card>
        </form>
      )}

      <VolunteerPostModal
        welfareCase={volunteerPostCase}
        onClose={() => setVolunteerPostCase(null)}
      />
    </div>
  );
}
