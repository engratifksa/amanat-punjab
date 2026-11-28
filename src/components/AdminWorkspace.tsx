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
  Lock,
  Pencil,
  X,
  Database,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { VolunteerPostModal } from './VolunteerPostModal';
import { TelegramGuideModal } from './TelegramGuideModal';
import { BoardOfficersTab } from './BoardOfficersTab';
import {
  parseAndVerifyBackupJson,
  triggerBackupDownload,
  type AmanatBackupBundle,
  type BackupRestorePreview,
  type BackupRestoreResult,
} from '@/lib/backupRestore';
import {
  exportAllCampaignsCsv,
  exportFullAuditLedgerCsv,
  exportSingleCampaignCsv,
} from '@/lib/csvExport';
import type {
  AdminAuditLog,
  AdminOfficer,
  AdminSessionInfo,
  AppDataMode,
  AppSettings,
  CampaignCategory,
  CampaignStatus,
  CaseStatus,
  CrowdfundingCampaign,
  Donation,
  DonationStatus,
  FieldVerification,
  FundingType,
  NotificationRecord,
  OfficerPermissionTier,
  Profile,
  WelfareCase,
} from '@/types/amanat';
import { PUNJAB_DISTRICTS, makeInvoiceDataUrl } from '@/lib/seedData';
import { formatPKR, cn } from '@/lib/utils';
import { generateSecureOtp, hashAdminPassword, sendTelegramOtp } from '@/lib/adminAuth';
import { Badge, Button, Card, Input, Select, Textarea } from './ui/primitives';
import { DualProgressBar } from './DualProgressBar';

interface AdminWorkspaceProps {
  adminSession: AdminSessionInfo;
  officers: AdminOfficer[];
  auditLogs: AdminAuditLog[];
  campaigns: CrowdfundingCampaign[];
  cases: WelfareCase[];
  verifications?: FieldVerification[];
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
  onUpdateDonationStatus: (
    donationId: string,
    status: DonationStatus,
    rejectionReason?: string,
    partialApprovedBy?: string | null
  ) => Promise<void>;
  onApproveCase: (caseId: string) => Promise<void>;
  onUpdateCaseStatus: (
    caseId: string,
    status: CaseStatus,
    rejectionReason?: string,
    partialApprovedBy?: string | null
  ) => Promise<void>;
  onCreateOfficer: (payload: {
    full_name: string;
    cnic_number: string;
    phone: string;
    email: string;
    username: string;
    password: string;
    permission_tier: OfficerPermissionTier;
    district_scope: string;
    max_approval_pkr: number | null;
  }) => Promise<AdminOfficer>;
  onUpdateOfficer: (
    id: string,
    patch: Partial<
      Pick<AdminOfficer, 'is_active' | 'permission_tier' | 'district_scope' | 'max_approval_pkr'>
    >,
    auditDetails: string
  ) => Promise<void>;
  onResetOfficerPassword: (id: string, newPassword: string) => Promise<void>;
  onLogAudit: (entry: {
    actor_name: string;
    actor_role: 'master_admin' | 'officer_partial' | 'officer_full';
    action: string;
    target_code: string;
    details?: string;
  }) => Promise<void>;
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
  onSetAppMode: (mode: AppDataMode) => Promise<void>;
  onReseedTrainingData: () => Promise<void>;
  onExportRealBackup: () => Promise<AmanatBackupBundle>;
  onPreviewBackupRestore: (bundle: AmanatBackupBundle) => Promise<BackupRestorePreview>;
  onRestoreRealBackup: (bundle: AmanatBackupBundle) => Promise<BackupRestoreResult>;
  onLogoutAdmin: () => void;
}

export function AdminWorkspace({
  adminSession,
  officers,
  auditLogs,
  campaigns,
  cases,
  verifications = [],
  donations,
  profiles,
  notifications,
  settings,
  onCreateCampaign,
  onUpdateCampaignStatus,
  onConfirmDonation,
  onUpdateDonationStatus,
  onApproveCase,
  onUpdateCaseStatus,
  onCreateOfficer,
  onUpdateOfficer,
  onResetOfficerPassword,
  onLogAudit,
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
  onSetAppMode,
  onReseedTrainingData,
  onExportRealBackup,
  onPreviewBackupRestore,
  onRestoreRealBackup,
  onLogoutAdmin,
}: AdminWorkspaceProps) {
  const { t } = useTranslation();
  const isMasterAdmin = adminSession.role === 'master_admin';
  const activeOfficer = adminSession.officer ?? null;
  const isFullApprover = isMasterAdmin || activeOfficer?.permission_tier === 'full_approve';
  const canViewVerifiers = isMasterAdmin || activeOfficer?.permission_tier === 'full_approve';
  const canManageVerifiers = isMasterAdmin;
  const canDelete = isMasterAdmin;
  const actorRole: 'master_admin' | 'officer_partial' | 'officer_full' = isMasterAdmin
    ? 'master_admin'
    : activeOfficer?.permission_tier === 'full_approve'
    ? 'officer_full'
    : 'officer_partial';

  const exceedsOfficerCap = (amountPkr: number) =>
    !isMasterAdmin &&
    activeOfficer?.permission_tier === 'full_approve' &&
    Boolean(activeOfficer.max_approval_pkr) &&
    amountPkr > (activeOfficer.max_approval_pkr ?? Infinity);

  const [tab, setTab] = useState<'crowdfunding' | 'audit' | 'officers' | 'settings'>(
    isMasterAdmin ? 'crowdfunding' : 'audit'
  );
  const [donationFilter, setDonationFilter] = useState<'all' | DonationStatus>('all');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isMasterAdmin && tab !== 'audit') {
      setTab('audit');
    }
  }, [isMasterAdmin, tab]);

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
  const [unlockedSections, setUnlockedSections] = useState<{
    social: boolean;
    telegram: boolean;
    escrow: boolean;
    gateway: boolean;
    password: boolean;
  }>({
    social: false,
    telegram: false,
    escrow: false,
    gateway: false,
    password: false,
  });

  const anySectionUnlocked = Object.values(unlockedSections).some(Boolean);

  const unlockSection = (key: keyof typeof unlockedSections) => {
    setUnlockedSections((prev) => ({ ...prev, [key]: true }));
  };

  const cancelSection = (key: keyof typeof unlockedSections) => {
    setDraftSettings((prev) => {
      if (key === 'social') return { ...prev, social_links: settings.social_links };
      if (key === 'telegram') return { ...prev, telegram_config: settings.telegram_config };
      if (key === 'escrow') return { ...prev, escrow_accounts: settings.escrow_accounts };
      if (key === 'gateway') return { ...prev, email_gateway: settings.email_gateway };
      return prev;
    });
    if (key === 'password') setNewPassword('');
    setUnlockedSections((prev) => ({ ...prev, [key]: false }));
  };

  const saveSection = async (key: keyof typeof unlockedSections) => {
    if (key === 'escrow') {
      const ok = window.confirm(
        'Confirm updating live Direct Escrow Payment Accounts (Raast, JazzCash, EasyPaisa, IBAN, SWIFT)? These numbers will immediately appear to donors.'
      );
      if (!ok) return;
    }
    setSavingSettings(true);
    try {
      let nextHash = draftSettings.admin_password_hash;
      if (key === 'password' && newPassword.trim().length >= 6) {
        nextHash = await hashAdminPassword(newPassword.trim());
      }
      await onSaveSettings({
        ...draftSettings,
        admin_password_hash: nextHash,
      });
      if (key === 'password') setNewPassword('');
      setUnlockedSections((prev) => ({ ...prev, [key]: false }));
      setNotice('Saved changes to Supabase and re-locked section for safety.');
    } finally {
      setSavingSettings(false);
    }
  };
  const [volunteerPostCase, setVolunteerPostCase] = useState<WelfareCase | null>(null);
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);
  const [flushConfirmText, setFlushConfirmText] = useState('');
  const [flushing, setFlushing] = useState(false);
  const [switchingMode, setSwitchingMode] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [pendingRestoreBundle, setPendingRestoreBundle] = useState<AmanatBackupBundle | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupRestorePreview | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  const activeDataMode: AppDataMode = settings.app_mode === 'training' ? 'training' : 'real';

  const handleDownloadBackup = async () => {
    setBackingUp(true);
    try {
      const bundle = await onExportRealBackup();
      triggerBackupDownload(bundle);
      setNotice(
        `Downloaded SHA-256 verified Real Data Backup (${bundle.counts.crowdfunding_campaigns} campaigns, ${bundle.counts.cases} cases, ${bundle.counts.donations} donations, ${bundle.counts.profiles} profiles).`
      );
    } finally {
      setBackingUp(false);
    }
  };

  const handleSelectBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreError(null);
    setPendingRestoreBundle(null);
    setRestorePreview(null);
    setRestoreConfirmText('');
    try {
      const text = await file.text();
      const { bundle } = await parseAndVerifyBackupJson(text);
      const preview = await onPreviewBackupRestore(bundle);
      setPendingRestoreBundle(bundle);
      setRestorePreview(preview);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Failed to parse backup file.');
    }
  };

  const handleExecuteRestore = async () => {
    if (!pendingRestoreBundle || restoreConfirmText.trim() !== 'RESTORE LIVE DATA') return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await onRestoreRealBackup(pendingRestoreBundle);
      setPendingRestoreBundle(null);
      setRestorePreview(null);
      setRestoreConfirmText('');
      setNotice(
        `Zero-Duplicate Restore complete! Synced ${res.restoredCounts.crowdfunding_campaigns} campaigns, ${res.restoredCounts.cases} cases, ${res.restoredCounts.donations} donations, and ${res.restoredCounts.profiles} profiles.`
      );
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  // District scoping for Board Officers (All Punjab for Master Admin or district_scope === 'all')
  const scopedCases =
    activeOfficer && activeOfficer.district_scope !== 'all'
      ? cases.filter(
          (c) => c.district.toLowerCase() === activeOfficer.district_scope.toLowerCase()
        )
      : cases;

  const scopedDonations =
    activeOfficer && activeOfficer.district_scope !== 'all'
      ? donations.filter((d) => {
          const cs = cases.find((c) => c.id === d.case_id);
          const camp = campaigns.find((c) => c.id === d.campaign_id);
          return (
            cs?.district.toLowerCase() === activeOfficer.district_scope.toLowerCase() ||
            camp?.district.toLowerCase() === activeOfficer.district_scope.toLowerCase()
          );
        })
      : donations;

  const pendingDonations = scopedDonations.filter(
    (d) => d.status === 'pledged_pending_verify' || d.status === 'partial_approved'
  );
  const incomingTriageCases = scopedCases.filter((c) => c.status === 'pending_admin_review');
  const fieldVerifiedCases = scopedCases.filter(
    (c) => c.status === 'field_verified' || c.status === 'partial_approved'
  );
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
      setUnlockedSections({
        social: false,
        telegram: false,
        escrow: false,
        gateway: false,
        password: false,
      });
      setNotice(
        'Saved Social Media Links, Escrow Payment Accounts & Telegram 2FA Settings! All sections re-locked.'
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
        `✅ *Amanat Telegram 2FA Test*\n\nConnection verified! Sample OTP: \`${sampleCode}\``,
        true
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
              {isMasterAdmin
                ? '2FA Verified Master Admin'
                : `Board Officer: ${adminSession.actorName} (${
                    isFullApprover ? 'Tier 2: Full Approver' : 'Tier 1: Partial Approver'
                  })`}
            </Badge>
            <button
              type="button"
              onClick={onLogoutAdmin}
              className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold text-rose-100 hover:bg-rose-500/35 transition"
            >
              <LogOut className="h-3 w-3" />
              Lock / Sign Out
            </button>

            {/* 2-Stage Mode Switch: Master Admin ONLY */}
            {isMasterAdmin && (
            <div
              className="inline-flex items-center rounded-full bg-black/30 p-0.5 border border-white/15"
              role="group"
              aria-label="Data Mode Switch"
            >
              <button
                type="button"
                disabled={switchingMode}
                onClick={async () => {
                  if (activeDataMode === 'real') return;
                  setSwitchingMode(true);
                  try {
                    await onSetAppMode('real');
                    setNotice('Switched to LIVE (Real Data) Mode — dummy training data hidden.');
                  } finally {
                    setSwitchingMode(false);
                  }
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-extrabold transition-all',
                  activeDataMode === 'real'
                    ? 'bg-emerald-500 text-white shadow'
                    : 'text-emerald-200 hover:text-white'
                )}
              >
                LIVE (Real)
              </button>
              <button
                type="button"
                disabled={switchingMode}
                onClick={async () => {
                  if (activeDataMode === 'training') return;
                  setSwitchingMode(true);
                  try {
                    await onSetAppMode('training');
                    setNotice(
                      'Switched to TRAINING (Dummy Mode) — real live data is safely isolated.'
                    );
                  } finally {
                    setSwitchingMode(false);
                  }
                }}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-extrabold transition-all',
                  activeDataMode === 'training'
                    ? 'bg-amber-400 text-emerald-950 shadow'
                    : 'text-emerald-200 hover:text-white'
                )}
              >
                TRAINING (Dummy)
              </button>
            </div>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">{t('admin.title')}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-emerald-100/85">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Admin Sub-tabs */}
        <div className="flex flex-wrap rounded-2xl bg-white/10 p-1.5 border border-white/15 gap-1">
          {isMasterAdmin && (
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
              Crowdfunding Drives ({campaigns.length})
            </button>
          )}
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
            Individual Cases &amp; Donations ({scopedCases.length} / {scopedDonations.length})
          </button>
          {isMasterAdmin && (
            <button
              type="button"
              onClick={() => setTab('officers')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all',
                tab === 'officers'
                  ? 'bg-gold-500 text-white shadow-gold'
                  : 'text-emerald-100 hover:bg-white/10'
              )}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Officers &amp; Audit ({officers.length})</span>
            </button>
          )}
          {isMasterAdmin && (
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
          )}
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

      {tab === 'crowdfunding' && isMasterAdmin ? (
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
                    <div className="flex flex-wrap items-center gap-2">
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
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                          camp.status === 'active' ||
                            camp.status === 'fully_funded' ||
                            camp.status === 'disbursed_to_vendor'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        )}
                      >
                        {camp.status === 'active' ||
                        camp.status === 'fully_funded' ||
                        camp.status === 'disbursed_to_vendor'
                          ? 'LIVE ON LANDING PAGE (COLLECTIVE DRIVES)'
                          : 'HIDDEN FROM LANDING PAGE'}
                      </span>
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
          <Card className="lg:col-span-7 p-6 space-y-5">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-gold-600" />
                  Donor Contributions Ledger ({scopedDonations.length})
                </h2>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  {pendingDonations.length} Pending / Partial
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'all', label: `All (${scopedDonations.length})` },
                    {
                      id: 'pledged_pending_verify',
                      label: `Pledged (${scopedDonations.filter((d) => d.status === 'pledged_pending_verify').length})`,
                    },
                    {
                      id: 'partial_approved',
                      label: `Partial Approved (${scopedDonations.filter((d) => d.status === 'partial_approved').length})`,
                    },
                    {
                      id: 'confirmed',
                      label: `Confirmed (${scopedDonations.filter((d) => d.status === 'confirmed').length})`,
                    },
                    {
                      id: 'rejected',
                      label: `Rejected (${scopedDonations.filter((d) => d.status === 'rejected').length})`,
                    },
                    {
                      id: 'paid_to_vendor',
                      label: `Paid (${scopedDonations.filter((d) => d.status === 'paid_to_vendor').length})`,
                    },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setDonationFilter(f.id)}
                    className={cn(
                      'rounded-full px-3 py-1 text-[11px] font-bold border transition-all',
                      donationFilter === f.id
                        ? 'bg-emerald-900 text-white border-emerald-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {scopedDonations.filter((d) => donationFilter === 'all' || d.status === donationFilter)
              .length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                No donor contributions match this status filter.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {scopedDonations
                  .filter((d) => donationFilter === 'all' || d.status === donationFilter)
                  .map((d) => {
                    const overCap = exceedsOfficerCap(d.amount_pkr);
                    return (
                    <div
                      key={d.id}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4',
                        d.status === 'pledged_pending_verify' || d.status === 'partial_approved'
                          ? 'border-gold-200 bg-gold-50/40'
                          : d.status === 'rejected'
                          ? 'border-rose-200 bg-rose-50/40'
                          : 'border-emerald-200 bg-emerald-50/30'
                      )}
                    >
                      <div className="space-y-1 text-xs min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-emerald-950 text-sm">
                            {formatPKR(d.amount_pkr)}
                          </span>
                          <Badge
                            variant={
                              d.status === 'confirmed' || d.status === 'paid_to_vendor'
                                ? 'emerald'
                                : d.status === 'rejected'
                                ? 'rose'
                                : 'gold'
                            }
                          >
                            {d.status.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                          <span className="font-mono font-bold text-slate-700">
                            {d.payment_channel.toUpperCase()} · {d.transaction_ref}
                          </span>
                        </div>
                        {d.status === 'partial_approved' && d.partial_approved_by && (
                          <p className="text-[11px] font-extrabold text-amber-900">
                            Partial Approved by {d.partial_approved_by} — Awaiting Master Admin Final Sign-Off
                          </p>
                        )}
                        <p className="text-slate-600 font-medium">{getDonationTargetLabel(d)}</p>
                        <p className="font-mono text-[11px] text-slate-500">
                          QR: {d.receipt_qr_hash}
                          {d.donor_email ? ` · ${d.donor_email}` : ''}
                        </p>
                        {d.status === 'rejected' && d.rejection_reason && (
                          <p className="text-[11px] font-semibold text-rose-800">
                            Reason: {d.rejection_reason}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {isMasterAdmin ? (
                          <Select
                            value={d.status}
                            onChange={async (e) => {
                              const next = e.target.value as DonationStatus;
                              let reason: string | undefined;
                              if (next === 'rejected') {
                                const input = window.prompt(
                                  `Optional rejection reason for Ref ${d.transaction_ref} (sent politely to donor):`,
                                  'Transaction reference could not be verified on bank/wallet statement.'
                                );
                                if (input === null) return;
                                reason = input;
                              }
                              await onUpdateDonationStatus(d.id, next, reason, adminSession.actorName);
                              await onLogAudit({
                                actor_name: adminSession.actorName,
                                actor_role: actorRole,
                                action: `DONATION_${next.toUpperCase()}`,
                                target_code: d.transaction_ref,
                                details: reason || `${formatPKR(d.amount_pkr)}`,
                              });
                              setNotice(
                                `Updated ${d.transaction_ref} to ${next.replace(/_/g, ' ').toUpperCase()} — ledger totals synced!`
                              );
                            }}
                            className="h-8 text-[11px] font-bold py-1 px-2 w-auto"
                            aria-label={`Change status for donation ${d.transaction_ref}`}
                          >
                            <option value="pledged_pending_verify">Pledged (Pending)</option>
                            <option value="partial_approved">Partial Approved</option>
                            <option value="confirmed">Approved (Confirmed)</option>
                            <option value="rejected">Rejected</option>
                            <option value="paid_to_vendor">Paid to Vendor</option>
                          </Select>
                        ) : (
                          <>
                            {(d.status === 'pledged_pending_verify' ||
                              d.status === 'partial_approved') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={async () => {
                                  const canFinal = isFullApprover && !overCap;
                                  const next: DonationStatus = canFinal
                                    ? 'confirmed'
                                    : 'partial_approved';
                                  await onUpdateDonationStatus(
                                    d.id,
                                    next,
                                    undefined,
                                    adminSession.actorName
                                  );
                                  await onLogAudit({
                                    actor_name: adminSession.actorName,
                                    actor_role: actorRole,
                                    action: canFinal
                                      ? 'CONFIRMED_DONATION'
                                      : 'PARTIAL_APPROVED_DONATION',
                                    target_code: d.transaction_ref,
                                    details: overCap
                                      ? `${formatPKR(d.amount_pkr)} exceeded officer cap — routed to Master Admin`
                                      : `${formatPKR(d.amount_pkr)}`,
                                  });
                                  setNotice(
                                    canFinal
                                      ? `Approved ${formatPKR(d.amount_pkr)} (Ref: ${d.transaction_ref})!`
                                      : `Partial Approved ${d.transaction_ref} — queued for Master Admin final sign-off!`
                                  );
                                }}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isFullApprover && !overCap ? 'Approve' : 'Partial Approve'}
                              </Button>
                            )}
                            {d.status !== 'rejected' && d.status !== 'paid_to_vendor' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const input = window.prompt(
                                    `Rejection reason for Ref ${d.transaction_ref}:`,
                                    'Transaction reference could not be verified.'
                                  );
                                  if (input === null) return;
                                  await onUpdateDonationStatus(d.id, 'rejected', input);
                                  await onLogAudit({
                                    actor_name: adminSession.actorName,
                                    actor_role: actorRole,
                                    action: 'REJECTED_DONATION',
                                    target_code: d.transaction_ref,
                                    details: input,
                                  });
                                  setNotice(`Rejected donation ${d.transaction_ref}.`);
                                }}
                              >
                                Reject
                              </Button>
                            )}
                          </>
                        )}

                        {isMasterAdmin &&
                          (d.status === 'pledged_pending_verify' ||
                            d.status === 'partial_approved') && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={async () => {
                                await onUpdateDonationStatus(d.id, 'confirmed');
                                await onLogAudit({
                                  actor_name: adminSession.actorName,
                                  actor_role: actorRole,
                                  action: 'CONFIRMED_DONATION',
                                  target_code: d.transaction_ref,
                                  details: formatPKR(d.amount_pkr),
                                });
                                setNotice(
                                  `Confirmed ${formatPKR(d.amount_pkr)} (Ref: ${d.transaction_ref}) — progress bar & donor count updated!`
                                );
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {d.status === 'partial_approved' ? 'Final Approve' : 'Approve'}
                            </Button>
                          )}

                        {canDelete && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={async () => {
                              if (!window.confirm(`Delete donation ref ${d.transaction_ref}?`))
                                return;
                              await onDeleteDonation(d.id);
                              await onLogAudit({
                                actor_name: adminSession.actorName,
                                actor_role: actorRole,
                                action: 'DELETED_DONATION',
                                target_code: d.transaction_ref,
                                details: formatPKR(d.amount_pkr),
                              });
                              setNotice(`Deleted donation ${d.transaction_ref}.`);
                            }}
                            title="Delete Donation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                  })}
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-extrabold text-emerald-900">
                            {c.case_code} · {c.district} / {c.tehsil} ({formatPKR(c.target_amount_pkr)})
                          </span>
                          {(c.prior_application_count ?? 0) > 0 && (
                            <Badge variant="rose">
                              REPEAT APPLICANT · #{(c.prior_application_count ?? 0) + 1} (Prior:{' '}
                              {c.prior_case_codes || 'Yes'} · Served{' '}
                              {formatPKR(c.prior_served_pkr ?? 0)})
                            </Badge>
                          )}
                        </div>
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
                fieldVerifiedCases.map((c) => {
                  const latestVer = verifications.find((v) => v.case_id === c.id);
                  const overCap = exceedsOfficerCap(c.target_amount_pkr);
                  const canFinal = isFullApprover && !overCap;
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"
                    >
                      <div className="text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-extrabold text-emerald-900">
                            {c.case_code} · {c.district} ({formatPKR(c.target_amount_pkr)})
                          </span>
                          {c.status === 'partial_approved' && (
                            <Badge variant="gold">
                              Partial Approved by {c.partial_approved_by || 'Officer'}
                            </Badge>
                          )}
                          {latestVer?.handshake_pin_verified && (
                            <Badge variant="emerald">Mutual PIN Verified</Badge>
                          )}
                          {latestVer?.distance_from_applicant_km !== null &&
                            latestVer?.distance_from_applicant_km !== undefined && (
                              <Badge
                                variant={
                                  latestVer.distance_from_applicant_km <= 1 ? 'emerald' : 'gold'
                                }
                              >
                                GPS: {latestVer.distance_from_applicant_km.toFixed(2)} km
                              </Badge>
                            )}
                        </div>
                        <p className="text-slate-700">{c.anonymized_story_en}</p>
                        <p className="text-slate-500">Vendor: {c.vendor_name}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            if (canFinal) {
                              await onApproveCase(c.id);
                              await onLogAudit({
                                actor_name: adminSession.actorName,
                                actor_role: actorRole,
                                action: 'APPROVED_CASE',
                                target_code: c.case_code,
                                details: `${c.district} · ${formatPKR(c.target_amount_pkr)}`,
                              });
                              setNotice(
                                `Approved & published ${c.case_code} to the public donor feed!`
                              );
                            } else {
                              await onUpdateCaseStatus(
                                c.id,
                                'partial_approved',
                                undefined,
                                adminSession.actorName
                              );
                              await onLogAudit({
                                actor_name: adminSession.actorName,
                                actor_role: actorRole,
                                action: 'PARTIAL_APPROVED_CASE',
                                target_code: c.case_code,
                                details: overCap
                                  ? `Amount ${formatPKR(c.target_amount_pkr)} exceeds officer cap — awaiting Master Admin`
                                  : `Partial approved by ${adminSession.actorName}`,
                              });
                              setNotice(
                                `Partial Approved ${c.case_code} — queued for Master Admin final sign-off!`
                              );
                            }
                          }}
                        >
                          {isMasterAdmin && c.status === 'partial_approved'
                            ? 'Final Approve & Publish'
                            : canFinal
                            ? t('admin.approvePublish')
                            : 'Partial Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const reason = window.prompt(
                              `Rejection reason for ${c.case_code}:`,
                              'Eligibility or vendor quotation could not be confirmed.'
                            );
                            if (reason === null) return;
                            await onUpdateCaseStatus(c.id, 'rejected', reason);
                            await onLogAudit({
                              actor_name: adminSession.actorName,
                              actor_role: actorRole,
                              action: 'REJECTED_CASE',
                              target_code: c.case_code,
                              details: reason,
                            });
                            setNotice(`Rejected ${c.case_code}.`);
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <div className="lg:col-span-5 space-y-6">
            {canViewVerifiers && (
            <Card className="p-6 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-700" />
                  {t('admin.verifiersList')}
                </h2>
                {!canManageVerifiers && <Badge variant="slate">View Only</Badge>}
              </div>
              {verifiers.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {v.photo_url ? (
                      <img
                        src={v.photo_url}
                        alt={v.full_name}
                        className="h-11 w-11 rounded-xl object-cover border border-emerald-300 shrink-0"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-900/10 text-emerald-900 font-extrabold text-xs shrink-0">
                        {v.full_name
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="text-xs min-w-0">
                      <p className="font-extrabold text-slate-900 truncate">{v.full_name}</p>
                      <p className="text-slate-500 truncate">
                        {v.district} · {v.tehsil}
                      </p>
                      <p className="font-mono text-[10px] text-emerald-800 truncate">
                        CNIC: {v.cnic_number || 'Pending'} {v.phone ? `· ${v.phone}` : ''}
                      </p>
                    </div>
                  </div>
                  {canManageVerifiers ? (
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
                  ) : (
                    <Badge variant={v.is_accredited_verifier ? 'emerald' : 'gold'}>
                      {v.is_accredited_verifier ? 'Accredited' : 'Pending'}
                    </Badge>
                  )}
                </div>
              ))}
            </Card>
            )}

            <Card className="p-6 space-y-3">
              <div>
                <h2 className="text-sm font-extrabold text-emerald-950 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-gold-600" />
                  All Individual Cases Control ({scopedCases.length})
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Controls Landing Page → <strong>Field-Verified Individual Cases</strong>.
                  {isMasterAdmin
                    ? ' Change status (Approved, Partial, Pending, Rejected, Paid) or delete any entry.'
                    : ' Scoped Board Officer view — Approve/Partial Approve or Reject (Deletion restricted to Master Admin).'}
                </p>
              </div>
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {scopedCases.map((c) => {
                  const isPublicLive = ['approved', 'funded', 'disbursed_to_vendor'].includes(
                    c.status
                  );
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-extrabold text-emerald-900">
                              {c.case_code}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                                isPublicLive
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : c.status === 'rejected'
                                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              )}
                            >
                              {isPublicLive
                                ? 'LIVE ON LANDING PAGE'
                                : c.status === 'rejected'
                                ? 'REJECTED (HIDDEN)'
                                : 'HIDDEN (IN REVIEW)'}
                            </span>
                            {(c.prior_application_count ?? 0) > 0 && (
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-amber-100 text-amber-950 border border-amber-300">
                                REPEAT #{(c.prior_application_count ?? 0) + 1} · Served{' '}
                                {formatPKR(c.prior_served_pkr ?? 0)}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-slate-600 mt-0.5">
                            {c.district} · {c.vendor_name} ({formatPKR(c.target_amount_pkr)})
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {isMasterAdmin ? (
                          <Select
                            value={c.status}
                            onChange={async (e) => {
                              const next = e.target.value as CaseStatus;
                              let reason: string | undefined;
                              if (next === 'rejected') {
                                const input = window.prompt(
                                  `Optional rejection reason for ${c.case_code} (sent politely to beneficiary):`,
                                  'Incomplete vendor quotation or eligibility could not be confirmed.'
                                );
                                if (input === null) return;
                                reason = input;
                              }
                              await onUpdateCaseStatus(c.id, next, reason, adminSession.actorName);
                              await onLogAudit({
                                actor_name: adminSession.actorName,
                                actor_role: actorRole,
                                action: `CASE_${next.toUpperCase()}`,
                                target_code: c.case_code,
                                details: reason || c.district,
                              });
                              setNotice(
                                `Updated ${c.case_code} to ${next.replace(/_/g, ' ').toUpperCase()}!`
                              );
                            }}
                            className="h-8 text-[11px] font-bold py-1 px-2 flex-1 min-w-[140px]"
                            aria-label={`Change status for case ${c.case_code}`}
                          >
                            <option value="pending_admin_review">Pending Admin Review</option>
                            <option value="pending_field_visit">Pending Field Visit</option>
                            <option value="field_verified">Field Verified</option>
                            <option value="partial_approved">Partial Approved (Officer)</option>
                            <option value="approved">Approved (Live on Landing)</option>
                            <option value="funded">Funded</option>
                            <option value="disbursed_to_vendor">Paid to Vendor</option>
                            <option value="rejected">Rejected</option>
                          </Select>
                        ) : (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={c.status === 'approved' || c.status === 'disbursed_to_vendor'}
                              onClick={async () => {
                                const overCap = exceedsOfficerCap(c.target_amount_pkr);
                                const canFinal = isFullApprover && !overCap;
                                const next: CaseStatus = canFinal ? 'approved' : 'partial_approved';
                                await onUpdateCaseStatus(
                                  c.id,
                                  next,
                                  undefined,
                                  adminSession.actorName
                                );
                                await onLogAudit({
                                  actor_name: adminSession.actorName,
                                  actor_role: actorRole,
                                  action: canFinal ? 'APPROVED_CASE' : 'PARTIAL_APPROVED_CASE',
                                  target_code: c.case_code,
                                  details: formatPKR(c.target_amount_pkr),
                                });
                                setNotice(
                                  canFinal
                                    ? `Approved ${c.case_code} live!`
                                    : `Partial Approved ${c.case_code} — awaiting Master Admin final sign-off!`
                                );
                              }}
                            >
                              {isFullApprover && !exceedsOfficerCap(c.target_amount_pkr)
                                ? 'Approve Live'
                                : 'Partial Approve'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={c.status === 'rejected' || c.status === 'disbursed_to_vendor'}
                              onClick={async () => {
                                const reason = window.prompt(
                                  `Rejection reason for ${c.case_code}:`,
                                  'Incomplete vendor quotation or eligibility could not be confirmed.'
                                );
                                if (reason === null) return;
                                await onUpdateCaseStatus(c.id, 'rejected', reason);
                                await onLogAudit({
                                  actor_name: adminSession.actorName,
                                  actor_role: actorRole,
                                  action: 'REJECTED_CASE',
                                  target_code: c.case_code,
                                  details: reason,
                                });
                                setNotice(`Rejected ${c.case_code}.`);
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {isMasterAdmin && (c.status === 'approved' || c.status === 'funded') && (
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
                        )}

                        {canDelete && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={async () => {
                              if (!window.confirm(`Delete case ${c.case_code}?`)) return;
                              await onDeleteCase(c.id);
                              await onLogAudit({
                                actor_name: adminSession.actorName,
                                actor_role: actorRole,
                                action: 'DELETED_CASE',
                                target_code: c.case_code,
                                details: c.district,
                              });
                              setNotice(`Deleted case ${c.case_code}.`);
                            }}
                            title="Delete Case"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      ) : tab === 'officers' && isMasterAdmin ? (
        <BoardOfficersTab
          officers={officers}
          auditLogs={auditLogs}
          onCreateOfficer={onCreateOfficer}
          onUpdateOfficer={onUpdateOfficer}
          onResetOfficerPassword={onResetOfficerPassword}
          onNotice={setNotice}
        />
      ) : isMasterAdmin ? (
        /* Dedicated Settings, Social Media, Escrow Accounts & Telegram 2FA Tab */
        <form onSubmit={handleSaveAllSettings} className="space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-950 flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Accidental-Edit Protection Active:</strong> All links, accounts, and 2FA
              fields are locked read-only by default. Tap <strong>Edit</strong> on any section to
              modify, then <strong>Save</strong> or <strong>Cancel</strong>.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 1. Social Media & Direct Contact Bar + Telegram 2FA Setup */}
            <Card
              className={cn(
                'p-6 space-y-5 transition-all',
                (unlockedSections.social || unlockedSections.telegram) &&
                  'ring-2 ring-gold-400 border-gold-400'
              )}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-emerald-700" />
                    Social Media &amp; Contact Links
                  </h2>
                  {unlockedSections.social ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={savingSettings}
                        onClick={() => saveSection('social')}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cancelSection('social')}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => unlockSection('social')}
                    >
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      <Pencil className="h-3.5 w-3.5 text-emerald-700" />
                      Edit Links
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Leave any field blank to hide that icon from the public social bar.
                </p>

                <fieldset
                  disabled={!unlockedSections.social}
                  className={cn(
                    'grid grid-cols-1 gap-3 sm:grid-cols-2 transition-opacity',
                    !unlockedSections.social && 'opacity-75 [&_input]:bg-slate-100 [&_input]:text-slate-600 [&_input]:cursor-not-allowed'
                  )}
                >
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
                    placeholder="support.amanat@gmail.com"
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
                </fieldset>
              </div>

              {/* Telegram 2FA OTP Setup */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-sky-600" />
                    Telegram 2FA OTP Bot Setup (Gate 2)
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTelegramGuide(true)}
                    >
                      Guide
                    </Button>
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
                    {unlockedSections.telegram ? (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={savingSettings}
                          onClick={() => saveSection('telegram')}
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => cancelSection('telegram')}
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => unlockSection('telegram')}
                      >
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                        <Pencil className="h-3.5 w-3.5 text-emerald-700" />
                        Edit 2FA
                      </Button>
                    )}
                  </div>
                </div>

                <fieldset
                  disabled={!unlockedSections.telegram}
                  className={cn(
                    'space-y-3 transition-opacity',
                    !unlockedSections.telegram && 'opacity-75 [&_input]:bg-slate-100 [&_input]:text-slate-600 [&_input]:cursor-not-allowed'
                  )}
                >
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
                  Enable Live Telegram 2FA OTP (uncheck to fall back safely to Local Setup OTP)
                </label>
                </fieldset>
              </div>
            </Card>

            {/* 2. Escrow Payment Accounts + Admin Password */}
            <Card
              className={cn(
                'p-6 space-y-5 transition-all',
                (unlockedSections.escrow ||
                  unlockedSections.gateway ||
                  unlockedSections.password) &&
                  'ring-2 ring-gold-400 border-gold-400'
              )}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-gold-600" />
                    Direct Escrow Payment Accounts
                  </h2>
                  {unlockedSections.escrow ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={savingSettings}
                        onClick={() => saveSection('escrow')}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cancelSection('escrow')}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => unlockSection('escrow')}
                    >
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      <Pencil className="h-3.5 w-3.5 text-emerald-700" />
                      Edit Accounts
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Updates Raast, JazzCash, EasyPaisa, Meezan Bank, and Overseas SWIFT everywhere
                  instantly.
                </p>

                <fieldset
                  disabled={!unlockedSections.escrow}
                  className={cn(
                    'space-y-3 transition-opacity',
                    !unlockedSections.escrow && 'opacity-75 [&_input]:bg-slate-100 [&_input]:text-slate-600 [&_input]:cursor-not-allowed'
                  )}
                >
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
                </fieldset>
              </div>

              {/* Gmail Notification Gateway (support.amanat@gmail.com) + Test Broadcast */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-emerald-950">
                    Gmail Notification Gateway (25% · 50% · 75% · 100%)
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
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
                      Test Alert
                    </Button>
                    {unlockedSections.gateway ? (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={savingSettings}
                          onClick={() => saveSection('gateway')}
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => cancelSection('gateway')}
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => unlockSection('gateway')}
                      >
                        <Lock className="h-3.5 w-3.5 text-slate-500" />
                        <Pencil className="h-3.5 w-3.5 text-emerald-700" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
                <fieldset
                  disabled={!unlockedSections.gateway}
                  className={cn(
                    'grid grid-cols-1 gap-3 sm:grid-cols-2 transition-opacity',
                    !unlockedSections.gateway && 'opacity-75 [&_input]:bg-slate-100 [&_input]:text-slate-600 [&_input]:cursor-not-allowed'
                  )}
                >
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
                </fieldset>
                <p className="text-[11px] text-slate-500">
                  Recent 3-Channel Outbox: <strong>{notifications.length}</strong> milestone
                  notifications logged across App, Gmail ({draftSettings.email_gateway?.senderEmail ?? 'support.amanat@gmail.com'}), and Telegram.
                </p>
              </div>

              {/* Admin Master Password Update */}
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-emerald-700" />
                    Update Admin Master Password (Gate 1)
                  </h3>
                  {unlockedSections.password ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={savingSettings || newPassword.trim().length < 6}
                        onClick={() => saveSection('password')}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cancelSection('password')}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => unlockSection('password')}
                    >
                      <Lock className="h-3.5 w-3.5 text-slate-500" />
                      <Pencil className="h-3.5 w-3.5 text-emerald-700" />
                      Change Password
                    </Button>
                  )}
                </div>
                <fieldset
                  disabled={!unlockedSections.password}
                  className={cn(
                    'transition-opacity',
                    !unlockedSections.password && 'opacity-75 [&_input]:bg-slate-100 [&_input]:text-slate-600 [&_input]:cursor-not-allowed'
                  )}
                >
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password (min 6 chars)"
                  />
                </fieldset>
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-emerald-950 p-4 text-white">
            <p className="text-xs text-emerald-100/85">
              Directly synced to live database (<code>public.app_settings</code>) · Last saved:{' '}
              <strong>{new Date(settings.updated_at).toLocaleString('en-GB')}</strong>
            </p>
            <Button
              type="submit"
              variant="gold"
              size="lg"
              disabled={savingSettings || !anySectionUnlocked}
            >
              <Save className="h-4 w-4" />
              <span>
                {savingSettings
                  ? 'Saving...'
                  : anySectionUnlocked
                  ? 'Save All Unlocked Changes'
                  : 'All Sections Locked (Safe)'}
              </span>
            </Button>
          </div>

          {/* Enterprise Backup & Zero-Duplicate Restore (Real Data Only) */}
          <Card className="p-6 border-emerald-900/15 bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Database className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-extrabold text-emerald-950">
                    Database Backup &amp; Zero-Duplicate Restore (Real Data Only)
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Exports strictly <strong>Real Live Data</strong> (excluding all dummy training
                    records) with a <strong>SHA-256 integrity checksum</strong>. Restore uses
                    foreign-key-safe UPSERT matching IDs &amp; unique codes so zero duplicates are
                    ever created.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={backingUp}
                  onClick={handleDownloadBackup}
                >
                  <Download className="h-4 w-4" />
                  <span>{backingUp ? 'Exporting...' : 'Download Live Backup (.json)'}</span>
                </Button>

                <label className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-900/20 bg-white px-3.5 py-2 text-xs font-extrabold text-emerald-900 hover:bg-emerald-50 cursor-pointer shadow-sm transition-colors">
                  <Upload className="h-4 w-4 text-emerald-700" />
                  <span>Restore From Backup (.json)</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleSelectBackupFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {restoreError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800">
                {restoreError}
              </div>
            )}

            {restorePreview && pendingRestoreBundle && (
              <div className="rounded-2xl border border-emerald-300 bg-white p-4 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="emerald">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      SHA-256 Checksum Verified
                    </Badge>
                    <span className="text-xs font-semibold text-slate-600">
                      Backup from {new Date(restorePreview.exportedAt).toLocaleString('en-GB')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingRestoreBundle(null);
                      setRestorePreview(null);
                      setRestoreConfirmText('');
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {(
                    [
                      ['Campaigns', restorePreview.tables.crowdfunding_campaigns],
                      ['Cases', restorePreview.tables.cases],
                      ['Donations', restorePreview.tables.donations],
                      ['Profiles', restorePreview.tables.profiles],
                      ['Field Visits', restorePreview.tables.field_verifications],
                      ['Alerts', restorePreview.tables.notifications],
                    ] as const
                  ).map(([label, diff]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-0.5"
                    >
                      <p className="font-extrabold text-emerald-950">{label}</p>
                      <p className="text-[11px] text-emerald-700 font-bold">
                        +{diff.newCount} New
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {diff.existingCount} Upsert (No Dup)
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Input
                    value={restoreConfirmText}
                    onChange={(e) => setRestoreConfirmText(e.target.value)}
                    placeholder='Type "RESTORE LIVE DATA" to confirm zero-duplicate restore'
                    className="font-mono border-emerald-300"
                  />
                  <Button
                    type="button"
                    variant="gold"
                    size="md"
                    disabled={restoring || restoreConfirmText.trim() !== 'RESTORE LIVE DATA'}
                    onClick={handleExecuteRestore}
                    className="shrink-0"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{restoring ? 'Restoring...' : 'Confirm & Restore'}</span>
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Production Go-Live: Flush / Re-Seed Dummy Training Data Only */}
          <Card className="p-6 border-rose-200 bg-rose-50/40 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 max-w-2xl">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-extrabold text-rose-950">
                    Training / Dummy Data Controls (100% Isolated From Real Data)
                  </h3>
                  <p className="text-xs text-rose-900/85 mt-0.5">
                    Flushing deletes <strong>strictly dummy/training rows</strong> (<code>is_demo = true</code>)
                    and <strong>never touches a single Real Live record</strong>. You can also
                    re-seed sample training data anytime for team onboarding.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={reseeding}
                onClick={async () => {
                  setReseeding(true);
                  try {
                    await onReseedTrainingData();
                    setNotice(
                      'Sample Training Data re-seeded cleanly (is_demo = true). Switch to TRAINING mode to view it.'
                    );
                  } finally {
                    setReseeding(false);
                  }
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>{reseeding ? 'Seeding...' : 'Re-Seed Training Data'}</span>
              </Button>
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
      ) : null}

      <VolunteerPostModal
        welfareCase={volunteerPostCase}
        onClose={() => setVolunteerPostCase(null)}
      />

      <TelegramGuideModal
        isOpen={showTelegramGuide}
        onClose={() => setShowTelegramGuide(false)}
      />
    </div>
  );
}
