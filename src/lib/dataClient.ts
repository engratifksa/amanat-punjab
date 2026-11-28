import Dexie, { type EntityTable } from 'dexie';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminAuditLog,
  AdminOfficer,
  AppDataMode,
  OfficerPermissionTier,
  Profile,
  CrowdfundingCampaign,
  WelfareCase,
  FieldVerification,
  Donation,
  CampaignCategory,
  CaseCategory,
  FundingType,
  PaymentChannel,
  CampaignStatus,
  AppSettings,
  NotificationRecord,
  NotificationSubscription,
} from '@/types/amanat';
import {
  buildBackupBundle,
  type AmanatBackupBundle,
  type BackupRestorePreview,
  type BackupRestoreResult,
} from './backupRestore';
import {
  SEED_PROFILES,
  SEED_CAMPAIGNS,
  SEED_CASES,
  SEED_VERIFICATIONS,
  SEED_DONATIONS,
  DEFAULT_APP_SETTINGS,
  makeInvoiceDataUrl,
} from './seedData';
import { DEFAULT_INITIAL_PASSWORD, generateSecureOtp, hashAdminPassword } from './adminAuth';
import {
  createNotificationRecord,
  detectCrossedMajorMilestone,
  dispatchMultiChannelNotification,
  type BuildMilestoneNotificationArgs,
} from './notifications';
import { generateQrSecretHex } from './dynamicQr';
import { maskCnic, normalizeCnicDigits, normalizeTxRef, sha256Hex } from './utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL.trim().length > 10 &&
    SUPABASE_ANON_KEY.trim().length > 10
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : null;

export async function uploadMediaToStorage(
  dataUrl: string | null | undefined,
  folder: string
): Promise<string | null> {
  if (!dataUrl) return null;
  if (!supabase || !dataUrl.startsWith('data:image/')) return dataUrl;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    const filePath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('amanat-media')
      .upload(filePath, blob, { contentType: blob.type, upsert: false });
    if (error) return dataUrl;
    const { data } = supabase.storage.from('amanat-media').getPublicUrl(filePath);
    return data.publicUrl || dataUrl;
  } catch {
    return dataUrl;
  }
}

class AmanatLocalDB extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  crowdfunding_campaigns!: EntityTable<CrowdfundingCampaign, 'id'>;
  cases!: EntityTable<WelfareCase, 'id'>;
  field_verifications!: EntityTable<FieldVerification, 'id'>;
  donations!: EntityTable<Donation, 'id'>;
  app_settings!: EntityTable<AppSettings, 'id'>;
  notifications!: EntityTable<NotificationRecord, 'id'>;
  notification_subscriptions!: EntityTable<NotificationSubscription, 'id'>;

  constructor() {
    super('AmanatPunjabPWA_v1');
    this.version(1).stores({
      profiles: 'id, role, district, is_accredited_verifier',
      crowdfunding_campaigns: 'id, campaign_code, status, category, district, created_at',
      cases: 'id, case_code, status, category, district, assigned_verifier_id, created_at',
      field_verifications: 'id, case_id, verifier_id, verified_at',
      donations: 'id, case_id, campaign_id, status, receipt_qr_hash, created_at',
    });
    this.version(2).stores({
      profiles: 'id, role, district, is_accredited_verifier',
      crowdfunding_campaigns: 'id, campaign_code, status, category, district, created_at',
      cases: 'id, case_code, status, category, district, assigned_verifier_id, created_at',
      field_verifications: 'id, case_id, verifier_id, verified_at',
      donations: 'id, case_id, campaign_id, status, receipt_qr_hash, created_at',
      app_settings: 'id',
    });
    this.version(3).stores({
      profiles: 'id, role, district, is_accredited_verifier',
      crowdfunding_campaigns: 'id, campaign_code, status, category, district, created_at',
      cases: 'id, case_code, status, category, district, assigned_verifier_id, created_at',
      field_verifications: 'id, case_id, verifier_id, verified_at',
      donations: 'id, case_id, campaign_id, status, receipt_qr_hash, created_at',
      app_settings: 'id',
      notifications: 'id, event_type, audience, target_code, case_id, campaign_id, read, created_at',
      notification_subscriptions: 'id, role, case_id, campaign_id, created_at',
    });
  }
}

export const localDb = new AmanatLocalDB();

let seedPromise: Promise<void> | null = null;

export async function ensureLocalSeeded(): Promise<void> {
  if (isSupabaseConfigured) return;
  if (!seedPromise) {
    seedPromise = (async () => {
      const campCount = await localDb.crowdfunding_campaigns.count();
      if (campCount === 0) {
        await localDb.transaction(
          'rw',
          [
            localDb.profiles,
            localDb.crowdfunding_campaigns,
            localDb.cases,
            localDb.field_verifications,
            localDb.donations,
          ],
          async () => {
            await localDb.profiles.bulkPut(SEED_PROFILES);
            await localDb.crowdfunding_campaigns.bulkPut(SEED_CAMPAIGNS);
            await localDb.cases.bulkPut(SEED_CASES);
            await localDb.field_verifications.bulkPut(SEED_VERIFICATIONS);
            await localDb.donations.bulkPut(SEED_DONATIONS);
          }
        );
      }
      const existingSettings = await localDb.app_settings.get('global');
      if (!existingSettings) {
        const defaultHash = await hashAdminPassword(DEFAULT_INITIAL_PASSWORD);
        await localDb.app_settings.put({
          ...DEFAULT_APP_SETTINGS,
          admin_password_hash: defaultHash,
        });
      } else if (
        !existingSettings.email_gateway ||
        existingSettings.social_links.email === 'trust@amanat.pk'
      ) {
        await localDb.app_settings.put({
          ...existingSettings,
          social_links: {
            ...existingSettings.social_links,
            email:
              existingSettings.social_links.email === 'trust@amanat.pk'
                ? 'support.amanat@gmail.com'
                : existingSettings.social_links.email,
          },
          email_gateway: existingSettings.email_gateway ?? DEFAULT_APP_SETTINGS.email_gateway,
        });
      }

      const notifCount = await localDb.notifications.count();
      if (notifCount === 0) {
        const welcome = createNotificationRecord({
          event_type: 'funding_milestone',
          audience: 'both',
          target_code: 'AMN-CF-01',
          case_id: null,
          campaign_id: 'camp-1',
          milestone_pct: 50,
          title_en: '50% Milestone Crossed — Kasur 5-Daughters Marriage Drive',
          title_ur: '50% ہدف مکمل — قصور 5 بیٹیوں کی اجتماعی شادی مہم',
          body_en:
            'Alhamdulillah! Verified escrow donations crossed 50% (PKR 875,000 of PKR 1,250,000). Funds are ring-fenced for Al-Madina Home Essentials & Furniture, Kasur.',
          body_ur:
            'الحمدللہ! تصدیق شدہ عطیات 50 فیصد سے تجاوز کر چکے ہیں (875,000 روپے از 1,250,000 روپے)۔ رقم براہِ راست وینڈر ایسکرو میں محفوظ ہے۔',
          vendor_name: 'Al-Madina Home Essentials & Furniture, Kasur',
          district: 'Kasur',
          collected_pkr: 875000,
          target_pkr: 1250000,
          senderEmail: 'support.amanat@gmail.com',
          recipient_emails: ['support.amanat@gmail.com'],
          recipient_telegram_ids: [],
        });
        await localDb.notifications.put(welcome);
      }
    })();
  }
  return seedPromise;
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function generateReceiptHash(code: string): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AMN-QR-${code.replace(/[^A-Z0-9]/gi, '').slice(-5)}-${rand}`;
}

export interface CreateCampaignInput {
  title_en: string;
  title_ur: string;
  summary_en: string;
  summary_ur: string;
  category: CampaignCategory;
  funding_type: FundingType;
  district: string;
  target_amount_pkr: number;
  vendor_name: string;
  vendor_invoice_url?: string;
  deadline_date: string;
}

export interface CreateCaseInput {
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
  // Strictly confidential — visible only to Admin & Approved Assigned Field Verifier
  beneficiary_name?: string;
  beneficiary_cnic?: string;
  beneficiary_phone?: string;
  beneficiary_lat?: number | null;
  beneficiary_lng?: number | null;
  beneficiary_address_note?: string;
  beneficiary_account_email?: string;
}

export interface CreateDonationInput {
  case_id: string | null;
  campaign_id: string | null;
  target_code: string;
  amount_pkr: number;
  payment_channel: PaymentChannel;
  transaction_ref: string;
  payment_proof_url: string | null;
  donor_email?: string;
  donor_telegram_id?: string;
}

export interface CreateVerificationInput {
  case_id: string;
  verifier_id: string;
  visit_notes: string;
  household_members: number;
  monthly_income_pkr: number;
  evidence_urls: string[];
  gps_tehsil_tag: string;
  verifier_lat?: number | null;
  verifier_lng?: number | null;
  distance_from_applicant_km?: number | null;
  handshake_pin_verified?: boolean;
  isOffline: boolean;
}

async function getActiveSettings(): Promise<AppSettings> {
  const defaultHash = await hashAdminPassword(DEFAULT_INITIAL_PASSWORD);
  if (supabase) {
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'global')
      .maybeSingle();
    return (
      (data as AppSettings | null) ?? {
        ...DEFAULT_APP_SETTINGS,
        admin_password_hash: defaultHash,
      }
    );
  }
  const saved = await localDb.app_settings.get('global');
  return (
    saved ?? {
      ...DEFAULT_APP_SETTINGS,
      admin_password_hash: defaultHash,
    }
  );
}

async function saveSubscription(sub: Omit<NotificationSubscription, 'id' | 'created_at'>) {
  if (!sub.email && !sub.telegram_chat_id) return;
  const record: NotificationSubscription = {
    ...sub,
    id: generateId('sub'),
    created_at: new Date().toISOString(),
  };
  if (supabase) {
    await supabase.from('notification_subscriptions').insert(record);
    return;
  }
  await localDb.notification_subscriptions.put(record);
}

async function emitNotification(
  partial: Omit<
    BuildMilestoneNotificationArgs,
    'senderEmail' | 'recipient_emails' | 'recipient_telegram_ids'
  >,
  extraEmails: string[] = [],
  extraTelegramIds: string[] = []
): Promise<NotificationRecord> {
  const settings = await getActiveSettings();
  const senderEmail =
    settings.email_gateway?.senderEmail ||
    settings.social_links.email ||
    'support.amanat@gmail.com';

  let subs: NotificationSubscription[] = [];
  const dbDiscoveredEmails: string[] = [];

  if (supabase) {
    const query = supabase.from('notification_subscriptions').select('*');
    if (partial.campaign_id) {
      const { data } = await query.eq('campaign_id', partial.campaign_id);
      subs = (data ?? []) as NotificationSubscription[];
      if (partial.audience === 'donor' || partial.audience === 'both') {
        const { data: dons } = await supabase
          .from('donations')
          .select('donor_email')
          .eq('campaign_id', partial.campaign_id);
        for (const d of (dons ?? []) as Array<{ donor_email?: string | null }>) {
          if (d.donor_email) dbDiscoveredEmails.push(d.donor_email);
        }
      }
    } else if (partial.case_id) {
      const { data } = await query.eq('case_id', partial.case_id);
      subs = (data ?? []) as NotificationSubscription[];
      if (partial.audience === 'donor' || partial.audience === 'both') {
        const { data: dons } = await supabase
          .from('donations')
          .select('donor_email')
          .eq('case_id', partial.case_id);
        for (const d of (dons ?? []) as Array<{ donor_email?: string | null }>) {
          if (d.donor_email) dbDiscoveredEmails.push(d.donor_email);
        }
      }
      if (partial.audience === 'beneficiary' || partial.audience === 'both') {
        const { data: cRow } = await supabase
          .from('cases')
          .select('beneficiary_account_email')
          .eq('id', partial.case_id)
          .maybeSingle();
        if (cRow && (cRow as { beneficiary_account_email?: string | null }).beneficiary_account_email) {
          dbDiscoveredEmails.push(
            (cRow as { beneficiary_account_email: string }).beneficiary_account_email
          );
        }
      }
    }
  } else {
    if (partial.campaign_id) {
      subs = await localDb.notification_subscriptions
        .where('campaign_id')
        .equals(partial.campaign_id)
        .toArray();
    } else if (partial.case_id) {
      subs = await localDb.notification_subscriptions
        .where('case_id')
        .equals(partial.case_id)
        .toArray();
    }
  }

  const filteredSubs = subs.filter((s) => {
    if (partial.audience === 'both') return true;
    return s.role === partial.audience;
  });

  const emails = Array.from(
    new Set(
      [
        ...extraEmails,
        ...dbDiscoveredEmails,
        ...filteredSubs.map((s) => s.email ?? ''),
        senderEmail,
      ]
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@'))
    )
  );

  const telegramIds = Array.from(
    new Set(
      [...extraTelegramIds, ...filteredSubs.map((s) => s.telegram_chat_id ?? '')]
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );

  const record = createNotificationRecord({
    ...partial,
    senderEmail,
    recipient_emails: emails,
    recipient_telegram_ids: telegramIds,
  });

  record.channels_status = await dispatchMultiChannelNotification(record, settings);

  if (supabase) {
    await supabase.from('notifications').insert(record);
  } else {
    await localDb.notifications.put(record);
  }
  return record;
}

export const dataClient = {
  mode: isSupabaseConfigured ? ('supabase' as const) : ('dexie' as const),

  async loadAll() {
    await ensureLocalSeeded();
    if (supabase) {
      const [
        profilesRes,
        campsRes,
        casesRes,
        verRes,
        donRes,
        settingsRes,
        notifRes,
        officersRes,
        auditRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase
          .from('crowdfunding_campaigns')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('cases').select('*').order('created_at', { ascending: false }),
        supabase
          .from('field_verifications')
          .select('*')
          .order('verified_at', { ascending: false }),
        supabase.from('donations').select('*').order('created_at', { ascending: false }),
        supabase.from('app_settings').select('*').eq('id', 'global').maybeSingle(),
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase.from('admin_officers').select('*').order('created_at', { ascending: false }),
        supabase
          .from('admin_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(120),
      ]);
      const defaultHash = await hashAdminPassword(DEFAULT_INITIAL_PASSWORD);
      const rawSettings =
        (settingsRes.data as AppSettings | null) ?? {
          ...DEFAULT_APP_SETTINGS,
          admin_password_hash: defaultHash,
        };
      const activeMode: AppDataMode = rawSettings.app_mode === 'training' ? 'training' : 'real';
      const settings: AppSettings = { ...rawSettings, app_mode: activeMode };
      const wantDemo = activeMode === 'training';

      const allProfiles = (profilesRes.data ?? []) as Profile[];
      const allCampaigns = (campsRes.data ?? []) as CrowdfundingCampaign[];
      const allCases = (casesRes.data ?? []) as WelfareCase[];
      const allVerifications = (verRes.data ?? []) as FieldVerification[];
      const allDonations = (donRes.data ?? []) as Donation[];
      const allNotifications = (notifRes.data ?? []) as Array<
        NotificationRecord & { is_demo?: boolean }
      >;

      return {
        // In training mode, include real signed-in users (Google or Email) so anyone can test roles seamlessly
        profiles: wantDemo
          ? allProfiles.filter((p) => Boolean(p.is_demo) || Boolean(p.auth_user_id) || Boolean(p.email))
          : allProfiles.filter((p) => !p.is_demo),
        campaigns: allCampaigns.filter((c) => Boolean(c.is_demo) === wantDemo),
        cases: allCases.filter((c) => Boolean(c.is_demo) === wantDemo),
        verifications: allVerifications.filter((v) => Boolean(v.is_demo) === wantDemo),
        donations: allDonations.filter((d) => Boolean(d.is_demo) === wantDemo),
        notifications: allNotifications.filter((n) => Boolean(n.is_demo) === wantDemo),
        officers: (officersRes.data ?? []) as AdminOfficer[],
        auditLogs: (auditRes.data ?? []) as AdminAuditLog[],
        settings,
      };
    }

    const [profiles, campaigns, cases, verifications, donations, savedSettings, notifications] =
      await Promise.all([
        localDb.profiles.toArray(),
        localDb.crowdfunding_campaigns.orderBy('created_at').reverse().toArray(),
        localDb.cases.orderBy('created_at').reverse().toArray(),
        localDb.field_verifications.orderBy('verified_at').reverse().toArray(),
        localDb.donations.orderBy('created_at').reverse().toArray(),
        localDb.app_settings.get('global'),
        localDb.notifications.orderBy('created_at').reverse().toArray(),
      ]);

    const defaultHash = await hashAdminPassword(DEFAULT_INITIAL_PASSWORD);
    const rawSettings: AppSettings = savedSettings ?? {
      ...DEFAULT_APP_SETTINGS,
      admin_password_hash: defaultHash,
    };
    const activeMode: AppDataMode = rawSettings.app_mode === 'training' ? 'training' : 'real';
    const settings: AppSettings = { ...rawSettings, app_mode: activeMode };
    const wantDemo = activeMode === 'training';

    return {
      profiles: wantDemo
        ? profiles.filter((p) => Boolean(p.is_demo) || Boolean(p.auth_user_id))
        : profiles.filter((p) => !p.is_demo),
      campaigns: campaigns.filter((c) => Boolean(c.is_demo) === wantDemo),
      cases: cases.filter((c) => Boolean(c.is_demo) === wantDemo),
      verifications: verifications.filter((v) => Boolean(v.is_demo) === wantDemo),
      donations: donations.filter((d) => Boolean(d.is_demo) === wantDemo),
      notifications,
      officers: [] as AdminOfficer[],
      auditLogs: [] as AdminAuditLog[],
      settings,
    };
  },

  async markNotificationRead(id: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      return;
    }
    await localDb.notifications.update(id, { read: true });
  },

  async markAllNotificationsRead(): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      await supabase.from('notifications').update({ read: true }).eq('read', false);
      return;
    }
    const unread = await localDb.notifications.filter((n) => !n.read).toArray();
    for (const item of unread) {
      await localDb.notifications.update(item.id, { read: true });
    }
  },

  async sendTestMilestoneNotification(): Promise<NotificationRecord> {
    await ensureLocalSeeded();
    const activeSettings = await getActiveSettings();
    const adminTg = activeSettings.telegram_config.chatId?.trim()
      ? [activeSettings.telegram_config.chatId.trim()]
      : [];
    return await emitNotification(
      {
        event_type: 'funding_milestone',
        audience: 'both',
        target_code: 'AMN-TEST-75',
        case_id: null,
        campaign_id: 'camp-1',
        milestone_pct: 75,
        title_en: '75% Major Milestone Reached — Test Broadcast',
        title_ur: '75% اہم ہدف مکمل — آزمائشی اطلاع',
        body_en:
          'Your 3-channel Amanat notification pipeline (In-App, Gmail support.amanat@gmail.com, and Telegram) is active and ready for major milestone updates.',
        body_ur:
          'امانت کا سہ فریقی اطلاعی نظام (ایپ، جی میل اور ٹیلیگرام) فعال ہے اور اہم اہداف کی تکمیل پر خودکار پیغامات بھیجے گا۔',
        vendor_name: 'Al-Madina Home Essentials & Furniture, Kasur',
        district: 'Kasur',
        collected_pkr: 937500,
        target_pkr: 1250000,
      },
      [],
      adminTg
    );
  },

  async saveAppSettings(nextSettings: AppSettings): Promise<AppSettings> {
    await ensureLocalSeeded();
    const updated: AppSettings = {
      ...nextSettings,
      id: 'global',
      updated_at: new Date().toISOString(),
    };
    if (supabase) {
      const { data, error } = await supabase
        .from('app_settings')
        .upsert(updated)
        .select()
        .single();
      if (error) throw error;
      return data as AppSettings;
    }
    await localDb.app_settings.put(updated);
    return updated;
  },

  async createCampaign(input: CreateCampaignInput): Promise<CrowdfundingCampaign> {
    await ensureLocalSeeded();
    const existingCount = supabase
      ? (await supabase.from('crowdfunding_campaigns').select('id', { count: 'exact', head: true })).count ?? 3
      : await localDb.crowdfunding_campaigns.count();

    const code = `AMN-CF-${String(existingCount + 1).padStart(2, '0')}`;
    const invoiceUrl =
      input.vendor_invoice_url && input.vendor_invoice_url.trim().length > 0
        ? input.vendor_invoice_url
        : makeInvoiceDataUrl(input.title_en, input.vendor_name, input.target_amount_pkr, `INV-${code}`);

    const activeSettings = await getActiveSettings();
    const isDemoMode = activeSettings.app_mode === 'training';

    const campaign: CrowdfundingCampaign = {
      id: generateId('camp'),
      campaign_code: code,
      title_en: input.title_en.trim(),
      title_ur: input.title_ur.trim() || input.title_en.trim(),
      summary_en: input.summary_en.trim(),
      summary_ur: input.summary_ur.trim() || input.summary_en.trim(),
      category: input.category,
      funding_type: input.funding_type,
      district: input.district,
      target_amount_pkr: input.target_amount_pkr,
      collected_amount_pkr: 0,
      pledged_amount_pkr: 0,
      donor_count: 0,
      vendor_name: input.vendor_name.trim(),
      vendor_invoice_url: invoiceUrl,
      disbursement_receipt_url: null,
      deadline_date: input.deadline_date,
      status: 'active',
      created_at: new Date().toISOString(),
      is_demo: isDemoMode,
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('crowdfunding_campaigns')
        .insert(campaign)
        .select()
        .single();
      if (error) throw error;
      await emitNotification({
        event_type: 'campaign_launched',
        audience: 'both',
        target_code: campaign.campaign_code,
        case_id: null,
        campaign_id: campaign.id,
        title_en: `New Verified Crowdfunding Drive Live: ${campaign.title_en}`,
        title_ur: `نئی تصدیق شدہ مہم شروع ہو گئی: ${campaign.title_ur}`,
        body_en: `Target PKR ${campaign.target_amount_pkr.toLocaleString('en-PK')} for ${campaign.district}, Punjab. Funds settle strictly via ${campaign.vendor_name}.`,
        body_ur: `ہدف ${campaign.target_amount_pkr.toLocaleString('en-PK')} روپے (${campaign.district})۔ ادائیگی براہِ راست ${campaign.vendor_name} کو ہوگی۔`,
        vendor_name: campaign.vendor_name,
        district: campaign.district,
        collected_pkr: 0,
        target_pkr: campaign.target_amount_pkr,
      });
      return data as CrowdfundingCampaign;
    }

    await localDb.crowdfunding_campaigns.put(campaign);
    await emitNotification({
      event_type: 'campaign_launched',
      audience: 'both',
      target_code: campaign.campaign_code,
      case_id: null,
      campaign_id: campaign.id,
      title_en: `New Verified Crowdfunding Drive Live: ${campaign.title_en}`,
      title_ur: `نئی تصدیق شدہ مہم شروع ہو گئی: ${campaign.title_ur}`,
      body_en: `Target PKR ${campaign.target_amount_pkr.toLocaleString('en-PK')} for ${campaign.district}, Punjab. Funds settle strictly via ${campaign.vendor_name}.`,
      body_ur: `ہدف ${campaign.target_amount_pkr.toLocaleString('en-PK')} روپے (${campaign.district})۔ ادائیگی براہِ راست ${campaign.vendor_name} کو ہوگی۔`,
      vendor_name: campaign.vendor_name,
      district: campaign.district,
      collected_pkr: 0,
      target_pkr: campaign.target_amount_pkr,
    });
    return campaign;
  },

  async updateCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      const { error } = await supabase
        .from('crowdfunding_campaigns')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      return;
    }
    await localDb.crowdfunding_campaigns.update(id, { status });
  },

  async uploadCampaignPaidReceipt(id: string, receiptUrl: string): Promise<void> {
    await ensureLocalSeeded();
    const uploadedReceipt = await uploadMediaToStorage(receiptUrl, 'receipts');
    const finalReceipt = uploadedReceipt ?? receiptUrl;
    if (supabase) {
      const { error } = await supabase
        .from('crowdfunding_campaigns')
        .update({ disbursement_receipt_url: finalReceipt, status: 'disbursed_to_vendor' })
        .eq('id', id);
      if (error) throw error;
      await supabase
        .from('donations')
        .update({ status: 'paid_to_vendor' })
        .eq('campaign_id', id)
        .eq('status', 'confirmed');
      const { data: camp } = await supabase
        .from('crowdfunding_campaigns')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (camp) {
        const c = camp as CrowdfundingCampaign;
        await emitNotification({
          event_type: 'disbursed_to_vendor',
          audience: 'both',
          target_code: c.campaign_code,
          case_id: null,
          campaign_id: c.id,
          milestone_pct: 100,
          title_en: `Paid to Vendor — ${c.title_en}`,
          title_ur: `وینڈر کو ادائیگی مکمل — ${c.title_ur}`,
          body_en: `Alhamdulillah! PKR ${c.collected_amount_pkr.toLocaleString('en-PK')} has been paid directly to ${c.vendor_name}. The signed Paid Vendor Receipt is now archived on Amanat.`,
          body_ur: `الحمدللہ! ${c.collected_amount_pkr.toLocaleString('en-PK')} روپے براہِ راست ${c.vendor_name} کو ادا کر دیے گئے ہیں اور رسید امانت پر محفوظ کر لی گئی ہے۔`,
          vendor_name: c.vendor_name,
          district: c.district,
          collected_pkr: c.collected_amount_pkr,
          target_pkr: c.target_amount_pkr,
        });
      }
      return;
    }
    await localDb.crowdfunding_campaigns.update(id, {
      disbursement_receipt_url: finalReceipt,
      status: 'disbursed_to_vendor',
    });
    const camp = await localDb.crowdfunding_campaigns.get(id);
    const campDonations = await localDb.donations.where('campaign_id').equals(id).toArray();
    for (const d of campDonations) {
      if (d.status === 'confirmed') {
        await localDb.donations.update(d.id, { status: 'paid_to_vendor' });
      }
    }
    if (camp) {
      await emitNotification({
        event_type: 'disbursed_to_vendor',
        audience: 'both',
        target_code: camp.campaign_code,
        case_id: null,
        campaign_id: camp.id,
        milestone_pct: 100,
        title_en: `Paid to Vendor — ${camp.title_en}`,
        title_ur: `وینڈر کو ادائیگی مکمل — ${camp.title_ur}`,
        body_en: `Alhamdulillah! PKR ${camp.collected_amount_pkr.toLocaleString('en-PK')} has been paid directly to ${camp.vendor_name}. The signed Paid Vendor Receipt is now archived.`,
        body_ur: `الحمدللہ! ${camp.collected_amount_pkr.toLocaleString('en-PK')} روپے براہِ راست ${camp.vendor_name} کو ادا کر دیے گئے ہیں اور رسید محفوظ کر لی گئی ہے۔`,
        vendor_name: camp.vendor_name,
        district: camp.district,
        collected_pkr: camp.collected_amount_pkr,
        target_pkr: camp.target_amount_pkr,
      });
    }
  },

  async submitBeneficiaryCase(input: CreateCaseInput): Promise<WelfareCase> {
    await ensureLocalSeeded();
    const activeSettings = await getActiveSettings();
    const isDemoMode = activeSettings.app_mode === 'training';

    // Smart CNIC Governance: 1 active request per CNIC + Repeat-Applicant tracking
    const cnicDigits = normalizeCnicDigits(input.beneficiary_cnic);
    let priorApplicationCount = 0;
    let priorServedPkr = 0;
    let priorCaseCodes: string | null = null;
    let daysSinceLastServed: number | null = null;

    if (cnicDigits.length === 13) {
      const allModeCases: WelfareCase[] = supabase
        ? (((await supabase.from('cases').select('*').eq('is_demo', isDemoMode)).data ??
            []) as WelfareCase[])
        : (await localDb.cases.toArray()).filter((c) => Boolean(c.is_demo) === isDemoMode);

      const sameCnicCases = allModeCases.filter(
        (c) => normalizeCnicDigits(c.beneficiary_cnic) === cnicDigits
      );

      const ACTIVE_STATUSES = new Set([
        'pending_admin_review',
        'pending_field_visit',
        'field_verified',
        'approved',
        'funded',
      ]);
      const activeExisting = sameCnicCases.find((c) => ACTIVE_STATUSES.has(c.status));
      if (activeExisting) {
        const statusLabel = activeExisting.status.replace(/_/g, ' ').toUpperCase();
        throw new Error(
          `Active Request Already Open (${activeExisting.case_code} — ${statusLabel}): Only one active request per CNIC is allowed at a time so our limited resources can fairly serve other deserving families. You may apply again once your current case is completed. | اس شناختی کارڈ پر پہلے سے ایک درخواست (${activeExisting.case_code}) زیرِ کار ہے۔`
        );
      }

      if (sameCnicCases.length > 0) {
        priorApplicationCount = sameCnicCases.length;
        priorServedPkr = sameCnicCases
          .filter((c) => c.status === 'disbursed_to_vendor')
          .reduce((sum, c) => sum + (c.raised_amount_pkr || c.target_amount_pkr), 0);
        priorCaseCodes = sameCnicCases.map((c) => c.case_code).join(', ');
        const latestPrior = sameCnicCases.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        if (latestPrior) {
          daysSinceLastServed = Math.max(
            0,
            Math.floor((Date.now() - new Date(latestPrior.created_at).getTime()) / 86_400_000)
          );
        }
      }
    }

    const uploadedInvoice = await uploadMediaToStorage(input.vendor_invoice_url, 'invoices');
    const count = supabase
      ? (await supabase.from('cases').select('id', { count: 'exact', head: true })).count ?? 8
      : await localDb.cases.count();
    const distCode = input.district.slice(0, 3).toUpperCase();
    const caseCode = `AMN-${distCode}-${String(count + 1).padStart(3, '0')}`;
    const invoiceUrl =
      uploadedInvoice && uploadedInvoice.trim().length > 0
        ? uploadedInvoice
        : makeInvoiceDataUrl(
            `Verified Assistance (${caseCode})`,
            input.vendor_name,
            input.target_amount_pkr,
            `INV-${caseCode}`
          );

    const newCase: WelfareCase = {
      id: generateId('case'),
      case_code: caseCode,
      category: input.category,
      funding_type: input.funding_type,
      district: input.district,
      tehsil: input.tehsil,
      anonymized_story_en: input.anonymized_story_en.trim(),
      anonymized_story_ur: input.anonymized_story_ur.trim() || input.anonymized_story_en.trim(),
      target_amount_pkr: input.target_amount_pkr,
      raised_amount_pkr: 0,
      pledged_amount_pkr: 0,
      status: 'pending_admin_review',
      beneficiary_id: null,
      assigned_verifier_id: null,
      vendor_name: input.vendor_name.trim(),
      vendor_type: input.vendor_type.trim() || 'Verified Vendor',
      vendor_invoice_url: invoiceUrl,
      disbursement_receipt_url: null,
      created_at: new Date().toISOString(),
      beneficiary_name: input.beneficiary_name?.trim(),
      beneficiary_cnic: input.beneficiary_cnic?.trim(),
      beneficiary_phone: input.beneficiary_phone?.trim(),
      beneficiary_lat: input.beneficiary_lat ?? null,
      beneficiary_lng: input.beneficiary_lng ?? null,
      beneficiary_address_note: input.beneficiary_address_note?.trim(),
      beneficiary_account_email: input.beneficiary_account_email?.trim(),
      prior_application_count: priorApplicationCount,
      prior_served_pkr: priorServedPkr,
      prior_case_codes: priorCaseCodes,
      is_demo: isDemoMode,
    };

    let createdCase: WelfareCase = newCase;
    if (supabase) {
      const { data, error } = await supabase.from('cases').insert(newCase).select().single();
      if (error) throw error;
      createdCase = data as WelfareCase;
    } else {
      await localDb.cases.put(newCase);
    }

    await saveSubscription({
      role: 'beneficiary',
      case_id: createdCase.id,
      campaign_id: null,
      email: input.recipient_email ?? null,
      telegram_chat_id: input.recipient_telegram_id ?? null,
    });

    const nthLabel =
      priorApplicationCount > 0 ? ` (Application #${priorApplicationCount + 1})` : '';
    await emitNotification(
      {
        event_type: 'case_submitted',
        audience: 'beneficiary',
        target_code: createdCase.case_code,
        case_id: createdCase.id,
        campaign_id: null,
        title_en: `Confidential Request Logged (${createdCase.case_code})${nthLabel}`,
        title_ur: `خفیہ درخواست درج ہو گئی (${createdCase.case_code})`,
        body_en:
          priorApplicationCount > 0
            ? `Your request (${createdCase.case_code}) for PKR ${createdCase.target_amount_pkr.toLocaleString('en-PK')} via ${createdCase.vendor_name} has been logged. Note: This is your #${priorApplicationCount + 1} application on Amanat (prior cases: ${priorCaseCodes}). Our Verification Board reviews repeat applications carefully to ensure fair distribution.`
            : `Your request for PKR ${createdCase.target_amount_pkr.toLocaleString('en-PK')} via ${createdCase.vendor_name} has been routed to the Verification Board in ${createdCase.district}.`,
        body_ur:
          priorApplicationCount > 0
            ? `آپ کی درخواست (${createdCase.case_code}) درج ہو گئی ہے۔ نوٹ: یہ امانت پر آپ کی ${priorApplicationCount + 1} ویں درخواست ہے؛ ویریفیکیشن بورڈ منصفانہ تقسیم کے لیے اس کا خصوصی جائزہ لے گا۔`
            : `آپ کی درخواست (${createdCase.case_code}) فیلڈ ویریفیکیشن کے لیے ضلع ${createdCase.district} کے بورڈ کو ارسال کر دی گئی ہے۔`,
        vendor_name: createdCase.vendor_name,
        district: createdCase.district,
        collected_pkr: 0,
        target_pkr: createdCase.target_amount_pkr,
      },
      input.recipient_email ? [input.recipient_email] : [],
      input.recipient_telegram_id ? [input.recipient_telegram_id] : []
    );

    // Notify Admin Board specifically when a previously served/applied CNIC submits a repeat request
    if (priorApplicationCount > 0) {
      const adminTg = activeSettings.telegram_config.chatId?.trim()
        ? [activeSettings.telegram_config.chatId.trim()]
        : [];
      await emitNotification(
        {
          event_type: 'case_submitted',
          audience: 'both',
          target_code: createdCase.case_code,
          case_id: createdCase.id,
          campaign_id: null,
          title_en: `REPEAT APPLICANT ALERT: ${createdCase.case_code} (Application #${priorApplicationCount + 1})`,
          title_ur: `دوبارہ درخواست کا الرٹ: ${createdCase.case_code}`,
          body_en: `CNIC ${maskCnic(input.beneficiary_cnic)} (${input.beneficiary_name || 'Applicant'}) has applied before. Prior Cases: ${priorCaseCodes} · Previously Disbursed: PKR ${priorServedPkr.toLocaleString('en-PK')}${daysSinceLastServed !== null ? ` · Last applied ${daysSinceLastServed} day(s) ago` : ''}. Please review carefully in Admin Board.`,
          body_ur: `شناختی کارڈ ${maskCnic(input.beneficiary_cnic)} پہلے بھی درخواست دے چکا ہے (سابقہ کیس: ${priorCaseCodes}، سابقہ امداد: ${priorServedPkr.toLocaleString('en-PK')} روپے)۔ ایڈمن بورڈ میں جائزہ لیں۔`,
          vendor_name: createdCase.vendor_name,
          district: createdCase.district,
        },
        [],
        adminTg
      );
    }

    return createdCase;
  },

  async assignVerifierToCase(caseId: string, verifierId: string): Promise<void> {
    await ensureLocalSeeded();
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const visitPin = String(1000 + (arr[0] % 9000));

    if (supabase) {
      await supabase
        .from('cases')
        .update({
          status: 'pending_field_visit',
          assigned_verifier_id: verifierId,
          visit_handshake_pin: visitPin,
        })
        .eq('id', caseId);
      const { data: c } = await supabase.from('cases').select('*').eq('id', caseId).maybeSingle();
      const { data: v } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', verifierId)
        .maybeSingle();
      if (c) {
        const benEmails = (c as WelfareCase).beneficiary_account_email
          ? [(c as WelfareCase).beneficiary_account_email!]
          : [];
        const verifierProfile = v as Profile | null;
        const maskedCnic = maskCnic(verifierProfile?.cnic_number);
        await emitNotification(
          {
            event_type: 'case_submitted',
            audience: 'beneficiary',
            target_code: (c as WelfareCase).case_code,
            case_id: (c as WelfareCase).id,
            campaign_id: null,
            title_en: `Field Verifier Assigned (${(c as WelfareCase).case_code}) — Visit PIN: ${visitPin}`,
            title_ur: `فیلڈ ویریفائر تفویض کر دیا گیا (${(c as WelfareCase).case_code}) — خفیہ پن: ${visitPin}`,
            body_en: `Accredited Field Verifier ${verifierProfile?.full_name ?? 'Local Volunteer'} (CNIC: ${maskedCnic}, ${(c as WelfareCase).district}) will visit your household. YOUR SECRET 4-DIGIT VISIT PIN: ${visitPin}. SAFETY GUIDE: Match the visitor's face to their photo in your Beneficiary Portal and scan their live 60-second QR ID Card FIRST. Share PIN ${visitPin} ONLY after confirming their identity. Never accept screenshots and NEVER pay any cash or fee.`,
            body_ur: `مستند فیلڈ ویریفائر ${verifierProfile?.full_name ?? 'مقامی رضاکار'} (شناختی کارڈ: ${maskedCnic}) جلد آپ کے گھر کا دورہ کریں گے۔ آپ کا خفیہ 4 ہندسوں والا وزٹ پن: ${visitPin}۔ حفاظتی ہدایت: پہلے اپنے پورٹل میں ان کی تصویر میچ کریں اور 60 سیکنڈ والا لائیو کیو آر کوڈ اسکین کریں، پھر ہی یہ پن بتائیں۔ کبھی بھی اسکرین شاٹ قبول نہ کریں اور ہرگز کوئی نقد رقم یا فیس نہ دیں۔`,
            vendor_name: (c as WelfareCase).vendor_name,
            district: (c as WelfareCase).district,
          },
          benEmails
        );
        if (verifierProfile?.email || verifierProfile?.telegram_chat_id) {
          await emitNotification(
            {
              event_type: 'case_submitted',
              audience: 'both',
              target_code: (c as WelfareCase).case_code,
              case_id: (c as WelfareCase).id,
              campaign_id: null,
              title_en: `New Field Verification Assigned (${(c as WelfareCase).case_code}) — ${(c as WelfareCase).district}`,
              title_ur: `نیا فیلڈ وزٹ تفویض کیا گیا (${(c as WelfareCase).case_code})`,
              body_en: `Assalam-o-Alaikum ${verifierProfile.full_name}, you have been assigned to verify Case ${(c as WelfareCase).case_code} in ${(c as WelfareCase).tehsil}, ${(c as WelfareCase).district} (Vendor: ${(c as WelfareCase).vendor_name}). Open your Field Verifier Portal on Amanat to view confidential address & GPS pin, and show your live 60-second Dynamic QR ID Card to the family during your visit.`,
              body_ur: `السلام علیکم ${verifierProfile.full_name}، آپ کو کیس ${(c as WelfareCase).case_code} (${(c as WelfareCase).tehsil}، ${(c as WelfareCase).district}) کی تصدیق تفویض کی گئی ہے۔ امانت فیلڈ ویریفائر پورٹل کھول کر خفیہ پتہ دیکھیں اور دورے کے دوران خاندان کو اپنا 60 سیکنڈ والا لائیو کیو آر کارڈ دکھائیں۔`,
              vendor_name: (c as WelfareCase).vendor_name,
              district: (c as WelfareCase).district,
            },
            verifierProfile.email ? [verifierProfile.email] : [],
            verifierProfile.telegram_chat_id ? [verifierProfile.telegram_chat_id] : []
          );
        }
      }
      return;
    }
    await localDb.cases.update(caseId, {
      status: 'pending_field_visit',
      assigned_verifier_id: verifierId,
    });
    const c = await localDb.cases.get(caseId);
    const v = await localDb.profiles.get(verifierId);
    if (c) {
      await emitNotification(
        {
          event_type: 'case_submitted',
          audience: 'beneficiary',
          target_code: c.case_code,
          case_id: c.id,
          campaign_id: null,
          title_en: `Field Verifier Assigned (${c.case_code}) — How to Verify Visitor`,
          title_ur: `فیلڈ ویریفائر تفویض کر دیا گیا (${c.case_code}) — کیو آر تصدیق کا طریقہ`,
          body_en: `Accredited Field Verifier ${v?.full_name ?? 'Local Volunteer'} (${c.district}) will visit your household. SAFETY GUIDE: Before sharing your CNIC, open Amanat → tap "Verify Verifier (Scan QR)" and scan their live 60-second QR ID Card (or enter their live 6-digit code). Never accept screenshots and NEVER pay any fee or cash.`,
          body_ur: `مستند فیلڈ ویریفائر ${v?.full_name ?? 'مقامی رضاکار'} جلد آپ کے گھر کا دورہ کریں گے۔ حفاظتی ہدایت: اپنا شناختی کارڈ دکھانے سے پہلے امانت ایپ میں "Verify Verifier (Scan QR)" کھول کر ان کے فون پر موجود 60 سیکنڈ والا لائیو کیو آر کوڈ اسکین کریں۔ کبھی بھی اسکرین شاٹ قبول نہ کریں اور ہرگز کوئی فیس یا نقد رقم نہ دیں۔`,
          vendor_name: c.vendor_name,
          district: c.district,
        },
        c.beneficiary_account_email ? [c.beneficiary_account_email] : []
      );
    }
  },

  async upsertUserProfile(input: {
    auth_user_id?: string | null;
    email: string;
    full_name: string;
    role?: 'donor' | 'beneficiary' | 'verifier';
    district?: string;
    tehsil?: string;
    phone?: string | null;
    cnic_number?: string | null;
    photo_url?: string | null;
    telegram_chat_id?: string | null;
    applyAsVerifier?: boolean;
  }): Promise<Profile> {
    await ensureLocalSeeded();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.full_name.trim() || cleanEmail.split('@')[0] || 'Amanat User';
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validAuthUuid =
      input.auth_user_id && UUID_RE.test(input.auth_user_id) ? input.auth_user_id : null;
    const activeSettings = await getActiveSettings();
    const isDemoMode = activeSettings.app_mode === 'training';
    const uploadedPhoto = input.photo_url
      ? await uploadMediaToStorage(input.photo_url, 'verifier-photos')
      : null;

    if (supabase) {
      // 1. Lookup by valid UUID auth_user_id first, then email, then full_name
      let existing: Profile | null = null;
      if (validAuthUuid) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', validAuthUuid)
          .maybeSingle();
        if (data) existing = data as Profile;
      }
      if (!existing && cleanEmail) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .limit(1);
        if (data && data.length > 0) existing = data[0] as Profile;
      }
      if (!existing) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .ilike('full_name', cleanName)
          .limit(1);
        if (data && data.length > 0) existing = data[0] as Profile;
      }

      if (existing) {
        const patch: Partial<Profile> = {
          email: existing.email || cleanEmail,
          auth_user_id: existing.auth_user_id || validAuthUuid || null,
        };
        if (input.telegram_chat_id?.trim()) {
          patch.telegram_chat_id = input.telegram_chat_id.trim();
        }
        if (input.applyAsVerifier) {
          patch.role = 'verifier';
          patch.verifier_applied = true;
          if (input.district) patch.district = input.district;
          if (input.tehsil) patch.tehsil = input.tehsil;
          if (input.phone) patch.phone = input.phone;
          if (input.cnic_number) patch.cnic_number = input.cnic_number;
          if (uploadedPhoto) patch.photo_url = uploadedPhoto;
          if (!existing.is_accredited_verifier) {
            patch.verifier_badge_title = `Pending Admin Approval — ${input.district || existing.district}`;
          }
        }
        const { data, error } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        return (data as Profile) ?? { ...existing, ...patch };
      }

      const newProf: Profile = {
        id: generateId(input.applyAsVerifier ? 'prof-ver' : 'prof-usr'),
        auth_user_id: validAuthUuid,
        email: cleanEmail,
        full_name: cleanName,
        phone: input.phone || cleanEmail,
        role: input.applyAsVerifier ? 'verifier' : input.role ?? 'donor',
        district: input.district || 'Lahore',
        tehsil: input.tehsil || 'Lahore City',
        cnic_hash: `google:${cleanEmail}`,
        cnic_number: input.cnic_number || null,
        photo_url: uploadedPhoto || null,
        telegram_chat_id: input.telegram_chat_id?.trim() || null,
        is_accredited_verifier: false,
        verifier_applied: Boolean(input.applyAsVerifier),
        verifier_badge_title: input.applyAsVerifier
          ? `Pending Admin Approval — ${input.district || 'Lahore'}`
          : null,
        verifier_qr_secret: null,
        is_demo: isDemoMode && !validAuthUuid,
      };
      const { data, error } = await supabase.from('profiles').insert(newProf).select().single();
      if (error) throw error;
      return data as Profile;
    }

    // Local Dexie fallback
    const existing = await localDb.profiles
      .filter(
        (p) =>
          (p.email && p.email.toLowerCase() === cleanEmail) ||
          p.full_name.toLowerCase() === cleanName.toLowerCase()
      )
      .first();

    if (existing) {
      const patch: Partial<Profile> = { email: existing.email || cleanEmail };
      if (input.applyAsVerifier) {
        patch.role = 'verifier';
        patch.verifier_applied = true;
        if (input.district) patch.district = input.district;
        if (input.tehsil) patch.tehsil = input.tehsil;
      }
      await localDb.profiles.update(existing.id, patch);
      return { ...existing, ...patch };
    }

    const newProf: Profile = {
      id: generateId(input.applyAsVerifier ? 'prof-ver' : 'prof-usr'),
      email: cleanEmail,
      full_name: cleanName,
      phone: cleanEmail,
      role: input.applyAsVerifier ? 'verifier' : input.role ?? 'donor',
      district: input.district || 'Lahore',
      tehsil: input.tehsil || 'Lahore City',
      cnic_hash: `google:${cleanEmail}`,
      is_accredited_verifier: false,
      verifier_applied: Boolean(input.applyAsVerifier),
      verifier_badge_title: input.applyAsVerifier
        ? `Pending Admin Approval — ${input.district || 'Lahore'}`
        : null,
      verifier_qr_secret: null,
    };
    await localDb.profiles.put(newProf);
    return newProf;
  },

  async registerVerifierProfile(input: {
    full_name: string;
    email: string;
    district: string;
    tehsil: string;
    phone?: string;
    auth_user_id?: string | null;
  }): Promise<Profile> {
    return this.upsertUserProfile({
      auth_user_id: input.auth_user_id,
      email: input.email,
      full_name: input.full_name,
      district: input.district,
      tehsil: input.tehsil,
      role: 'verifier',
      applyAsVerifier: true,
    });
  },

  async submitFieldVerification(input: CreateVerificationInput): Promise<FieldVerification> {
    await ensureLocalSeeded();
    const activeSettings = await getActiveSettings();
    const isDemoMode = activeSettings.app_mode === 'training';
    const verification: FieldVerification = {
      id: generateId('ver'),
      case_id: input.case_id,
      verifier_id: input.verifier_id,
      visit_notes: input.visit_notes.trim(),
      household_members: input.household_members,
      monthly_income_pkr: input.monthly_income_pkr,
      evidence_urls: input.evidence_urls,
      gps_tehsil_tag: input.gps_tehsil_tag.trim(),
      verifier_lat: input.verifier_lat ?? null,
      verifier_lng: input.verifier_lng ?? null,
      distance_from_applicant_km: input.distance_from_applicant_km ?? null,
      handshake_pin_verified: Boolean(input.handshake_pin_verified),
      verified_at: new Date().toISOString(),
      synced: !input.isOffline,
      is_demo: isDemoMode,
    };

    if (supabase && !input.isOffline) {
      const { data, error } = await supabase
        .from('field_verifications')
        .insert({
          case_id: verification.case_id,
          verifier_id: verification.verifier_id,
          visit_notes: verification.visit_notes,
          household_members: verification.household_members,
          monthly_income_pkr: verification.monthly_income_pkr,
          evidence_urls: verification.evidence_urls,
          gps_tehsil_tag: verification.gps_tehsil_tag,
          verifier_lat: verification.verifier_lat,
          verifier_lng: verification.verifier_lng,
          distance_from_applicant_km: verification.distance_from_applicant_km,
          handshake_pin_verified: verification.handshake_pin_verified,
          is_demo: isDemoMode,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from('cases').update({ status: 'field_verified' }).eq('id', input.case_id);
      return data as FieldVerification;
    }

    await localDb.field_verifications.put(verification);
    await localDb.cases.update(input.case_id, {
      status: 'field_verified',
      assigned_verifier_id: input.verifier_id,
    });
    return verification;
  },

  async syncOfflineVerifications(): Promise<number> {
    await ensureLocalSeeded();
    const unsynced = await localDb.field_verifications.filter((v) => v.synced === false).toArray();
    for (const item of unsynced) {
      if (supabase) {
        await supabase.from('field_verifications').insert({
          case_id: item.case_id,
          verifier_id: item.verifier_id,
          visit_notes: item.visit_notes,
          household_members: item.household_members,
          monthly_income_pkr: item.monthly_income_pkr,
          evidence_urls: item.evidence_urls,
          gps_tehsil_tag: item.gps_tehsil_tag,
        });
        await supabase.from('cases').update({ status: 'field_verified' }).eq('id', item.case_id);
      }
      await localDb.field_verifications.update(item.id, { synced: true });
    }
    return unsynced.length;
  },

  async approveCase(caseId: string): Promise<void> {
    await this.updateCaseStatus(caseId, 'approved');
  },

  async updateCaseStatus(
    caseId: string,
    status: WelfareCase['status'],
    rejectionReason?: string,
    partialApprovedBy?: string | null
  ): Promise<void> {
    await ensureLocalSeeded();
    const cleanReason = status === 'rejected' ? rejectionReason?.trim() || null : null;
    const partialBy = status === 'partial_approved' ? partialApprovedBy ?? 'Board Officer' : null;
    if (supabase) {
      const { error } = await supabase
        .from('cases')
        .update({ status, rejection_reason: cleanReason, partial_approved_by: partialBy })
        .eq('id', caseId);
      if (error) throw error;
      const { data: c } = await supabase.from('cases').select('*').eq('id', caseId).maybeSingle();
      if (c) {
        const wc = c as WelfareCase;
        if (status === 'approved') {
          await emitNotification(
            {
              event_type: 'case_approved_live',
              audience: 'beneficiary',
              target_code: wc.case_code,
              case_id: wc.id,
              campaign_id: null,
              title_en: `Case Approved & Live for Funding (${wc.case_code})`,
              title_ur: `آپ کا کیس منظور ہو کر فنڈنگ کے لیے لائیو ہو گیا (${wc.case_code})`,
              body_en: `Alhamdulillah! After ground verification, your request (${wc.case_code}) for PKR ${wc.target_amount_pkr.toLocaleString('en-PK')} via ${wc.vendor_name} is now LIVE on Amanat with 100% privacy protection.`,
              body_ur: `الحمدللہ! فیلڈ تصدیق کے بعد آپ کی درخواست (${wc.case_code}) مکمل رازداری کے ساتھ امانت پر فنڈنگ کے لیے لائیو کر دی گئی ہے۔`,
              vendor_name: wc.vendor_name,
              district: wc.district,
              collected_pkr: wc.raised_amount_pkr,
              target_pkr: wc.target_amount_pkr,
            },
            wc.beneficiary_account_email ? [wc.beneficiary_account_email] : []
          );
        } else if (status === 'rejected') {
          await emitNotification(
            {
              event_type: 'case_submitted',
              audience: 'beneficiary',
              target_code: wc.case_code,
              case_id: wc.id,
              campaign_id: null,
              title_en: `Update on Your Request (${wc.case_code}) — Not Approved`,
              title_ur: `آپ کی درخواست (${wc.case_code}) کے بارے میں اطلاع`,
              body_en: `After review, your request (${wc.case_code}) could not be approved at this time.${cleanReason ? ` Reason: ${cleanReason}` : ''} You may submit an updated application with complete vendor documentation if applicable.`,
              body_ur: `جائزے کے بعد فی الحال آپ کی درخواست (${wc.case_code}) منظور نہیں ہو سکی۔${cleanReason ? ` وجہ: ${cleanReason}` : ''} مکمل وینڈر بل کے ساتھ دوبارہ درخواست دی جا سکتی ہے۔`,
              vendor_name: wc.vendor_name,
              district: wc.district,
            },
            wc.beneficiary_account_email ? [wc.beneficiary_account_email] : []
          );
        }
      }
      return;
    }

    await localDb.cases.update(caseId, { status, rejection_reason: cleanReason });
    const wc = await localDb.cases.get(caseId);
    if (wc && status === 'approved') {
      await emitNotification(
        {
          event_type: 'case_approved_live',
          audience: 'beneficiary',
          target_code: wc.case_code,
          case_id: wc.id,
          campaign_id: null,
          title_en: `Case Approved & Live for Funding (${wc.case_code})`,
          title_ur: `آپ کا کیس منظور ہو کر فنڈنگ کے لیے لائیو ہو گیا (${wc.case_code})`,
          body_en: `Alhamdulillah! After ground verification, your request (${wc.case_code}) for PKR ${wc.target_amount_pkr.toLocaleString('en-PK')} via ${wc.vendor_name} is now LIVE on Amanat with 100% privacy protection.`,
          body_ur: `الحمدللہ! فیلڈ تصدیق کے بعد آپ کی درخواست (${wc.case_code}) مکمل رازداری کے ساتھ امانت پر فنڈنگ کے لیے لائیو کر دی گئی ہے۔`,
          vendor_name: wc.vendor_name,
          district: wc.district,
          collected_pkr: wc.raised_amount_pkr,
          target_pkr: wc.target_amount_pkr,
        },
        wc.beneficiary_account_email ? [wc.beneficiary_account_email] : []
      );
    } else if (wc && status === 'rejected') {
      await emitNotification(
        {
          event_type: 'case_submitted',
          audience: 'beneficiary',
          target_code: wc.case_code,
          case_id: wc.id,
          campaign_id: null,
          title_en: `Update on Your Request (${wc.case_code}) — Not Approved`,
          title_ur: `آپ کی درخواست (${wc.case_code}) کے بارے میں اطلاع`,
          body_en: `After review, your request (${wc.case_code}) could not be approved at this time.${cleanReason ? ` Reason: ${cleanReason}` : ''}`,
          body_ur: `جائزے کے بعد فی الحال آپ کی درخواست (${wc.case_code}) منظور نہیں ہو سکی۔${cleanReason ? ` وجہ: ${cleanReason}` : ''}`,
          vendor_name: wc.vendor_name,
          district: wc.district,
        },
        wc.beneficiary_account_email ? [wc.beneficiary_account_email] : []
      );
    }
  },

  async updateDonationStatus(
    donationId: string,
    nextStatus: Donation['status'],
    rejectionReason?: string,
    partialApprovedBy?: string | null
  ): Promise<void> {
    await ensureLocalSeeded();
    const isCounted = (s: Donation['status']) => s === 'confirmed' || s === 'paid_to_vendor';
    const isPledged = (s: Donation['status']) =>
      s === 'pledged_pending_verify' || s === 'partial_approved';
    const cleanReason = nextStatus === 'rejected' ? rejectionReason?.trim() || null : null;
    const partialBy =
      nextStatus === 'partial_approved' ? partialApprovedBy ?? 'Board Officer' : null;

    if (supabase) {
      const { data: don } = await supabase
        .from('donations')
        .select('*')
        .eq('id', donationId)
        .maybeSingle();
      if (!don) return;
      const prevStatus = (don as Donation).status;
      if (prevStatus === nextStatus) return;

      if (
        (prevStatus === 'pledged_pending_verify' || prevStatus === 'partial_approved') &&
        nextStatus === 'confirmed'
      ) {
        if (prevStatus === 'partial_approved') {
          await supabase
            .from('donations')
            .update({ status: 'pledged_pending_verify', partial_approved_by: null })
            .eq('id', donationId);
        }
        await this.confirmDonation(donationId);
        return;
      }

      const { error } = await supabase
        .from('donations')
        .update({
          status: nextStatus,
          rejection_reason: cleanReason,
          partial_approved_by: partialBy,
        })
        .eq('id', donationId);
      if (error) throw error;

      const amt = (don as Donation).amount_pkr;
      const collectedDelta =
        (isCounted(nextStatus) ? amt : 0) - (isCounted(prevStatus) ? amt : 0);
      const pledgedDelta =
        (isPledged(nextStatus) ? amt : 0) - (isPledged(prevStatus) ? amt : 0);
      const donorCountDelta =
        (isCounted(nextStatus) ? 1 : 0) - (isCounted(prevStatus) ? 1 : 0);

      let targetCode = 'AMANAT';
      let vendorName = 'Amanat Escrow Vendor';
      let district = 'Punjab';

      if ((don as Donation).campaign_id) {
        const { data: camp } = await supabase
          .from('crowdfunding_campaigns')
          .select('*')
          .eq('id', (don as Donation).campaign_id)
          .maybeSingle();
        if (camp) {
          const c = camp as CrowdfundingCampaign;
          targetCode = c.campaign_code;
          vendorName = c.vendor_name;
          district = c.district;
          const nextCollected = Math.max(0, c.collected_amount_pkr + collectedDelta);
          const nextPledged = Math.max(0, c.pledged_amount_pkr + pledgedDelta);
          const nextDonors = Math.max(0, c.donor_count + donorCountDelta);
          await supabase
            .from('crowdfunding_campaigns')
            .update({
              collected_amount_pkr: nextCollected,
              pledged_amount_pkr: nextPledged,
              donor_count: nextDonors,
              status:
                c.status === 'fully_funded' && nextCollected < c.target_amount_pkr
                  ? 'active'
                  : nextCollected >= c.target_amount_pkr && c.status === 'active'
                  ? 'fully_funded'
                  : c.status,
            })
            .eq('id', c.id);
        }
      } else if ((don as Donation).case_id) {
        const { data: cs } = await supabase
          .from('cases')
          .select('*')
          .eq('id', (don as Donation).case_id)
          .maybeSingle();
        if (cs) {
          const wc = cs as WelfareCase;
          targetCode = wc.case_code;
          vendorName = wc.vendor_name;
          district = wc.district;
          const nextRaised = Math.max(0, wc.raised_amount_pkr + collectedDelta);
          const nextPledged = Math.max(0, wc.pledged_amount_pkr + pledgedDelta);
          await supabase
            .from('cases')
            .update({
              raised_amount_pkr: nextRaised,
              pledged_amount_pkr: nextPledged,
              status:
                wc.status === 'funded' && nextRaised < wc.target_amount_pkr
                  ? 'approved'
                  : nextRaised >= wc.target_amount_pkr && wc.status === 'approved'
                  ? 'funded'
                  : wc.status,
            })
            .eq('id', wc.id);
        }
      }

      if (nextStatus === 'rejected' && (don as Donation).donor_email) {
        await emitNotification(
          {
            event_type: 'donation_pledged',
            audience: 'donor',
            target_code: targetCode,
            case_id: (don as Donation).case_id,
            campaign_id: (don as Donation).campaign_id,
            title_en: `Contribution Could Not Be Verified (Ref: ${(don as Donation).transaction_ref})`,
            title_ur: `آپ کے عطیے کی تصدیق نہ ہو سکی (ریفرنس: ${(don as Donation).transaction_ref})`,
            body_en: `We could not verify your transfer reference (${(don as Donation).transaction_ref}) for PKR ${amt.toLocaleString('en-PK')}.${cleanReason ? ` Note: ${cleanReason}` : ''} Please double-check your payment receipt or reply to support.amanat@gmail.com.`,
            body_ur: `آپ کا ٹرانزیکشن ریفرنس (${(don as Donation).transaction_ref}) تصدیق نہیں ہو سکا۔${cleanReason ? ` وجہ: ${cleanReason}` : ''} براہِ کرم اپنی رسید چیک کریں یا support.amanat@gmail.com پر رابطہ کریں۔`,
            vendor_name: vendorName,
            district,
          },
          [(don as Donation).donor_email!]
        );
      }
      return;
    }

    const don = await localDb.donations.get(donationId);
    if (!don || don.status === nextStatus) return;
    if (don.status === 'pledged_pending_verify' && nextStatus === 'confirmed') {
      await this.confirmDonation(donationId);
      return;
    }
    const prevStatus = don.status;
    await localDb.donations.update(donationId, {
      status: nextStatus,
      rejection_reason: cleanReason,
    });
    const amt = don.amount_pkr;
    const collectedDelta =
      (isCounted(nextStatus) ? amt : 0) - (isCounted(prevStatus) ? amt : 0);
    const pledgedDelta =
      (isPledged(nextStatus) ? amt : 0) - (isPledged(prevStatus) ? amt : 0);
    const donorCountDelta =
      (isCounted(nextStatus) ? 1 : 0) - (isCounted(prevStatus) ? 1 : 0);

    if (don.campaign_id) {
      const c = await localDb.crowdfunding_campaigns.get(don.campaign_id);
      if (c) {
        await localDb.crowdfunding_campaigns.update(c.id, {
          collected_amount_pkr: Math.max(0, c.collected_amount_pkr + collectedDelta),
          pledged_amount_pkr: Math.max(0, c.pledged_amount_pkr + pledgedDelta),
          donor_count: Math.max(0, c.donor_count + donorCountDelta),
        });
      }
    } else if (don.case_id) {
      const wc = await localDb.cases.get(don.case_id);
      if (wc) {
        await localDb.cases.update(wc.id, {
          raised_amount_pkr: Math.max(0, wc.raised_amount_pkr + collectedDelta),
          pledged_amount_pkr: Math.max(0, wc.pledged_amount_pkr + pledgedDelta),
        });
      }
    }
  },

  async uploadCasePaidReceipt(caseId: string, receiptUrl: string): Promise<void> {
    await ensureLocalSeeded();
    const uploadedReceipt = await uploadMediaToStorage(receiptUrl, 'receipts');
    const finalReceipt = uploadedReceipt ?? receiptUrl;
    if (supabase) {
      const { error } = await supabase
        .from('cases')
        .update({ disbursement_receipt_url: finalReceipt, status: 'disbursed_to_vendor' })
        .eq('id', caseId);
      if (error) throw error;
      await supabase
        .from('donations')
        .update({ status: 'paid_to_vendor' })
        .eq('case_id', caseId)
        .eq('status', 'confirmed');
      const { data: c } = await supabase.from('cases').select('*').eq('id', caseId).maybeSingle();
      if (c) {
        const wc = c as WelfareCase;
        await emitNotification(
          {
            event_type: 'disbursed_to_vendor',
            audience: 'both',
            target_code: wc.case_code,
            case_id: wc.id,
            campaign_id: null,
            milestone_pct: 100,
            title_en: `Paid to Vendor — Case ${wc.case_code}`,
            title_ur: `وینڈر کو ادائیگی مکمل — کیس ${wc.case_code}`,
            body_en: `Alhamdulillah! PKR ${wc.raised_amount_pkr.toLocaleString('en-PK')} for Case ${wc.case_code} has been settled directly with ${wc.vendor_name}. The signed Paid Vendor Receipt is now archived.`,
            body_ur: `الحمدللہ! کیس ${wc.case_code} کی رقم (${wc.raised_amount_pkr.toLocaleString('en-PK')} روپے) براہِ راست ${wc.vendor_name} کو ادا کر دی گئی ہے اور رسید محفوظ کر لی گئی ہے۔`,
            vendor_name: wc.vendor_name,
            district: wc.district,
            collected_pkr: wc.raised_amount_pkr,
            target_pkr: wc.target_amount_pkr,
          },
          wc.beneficiary_account_email ? [wc.beneficiary_account_email] : []
        );
      }
      return;
    }
    await localDb.cases.update(caseId, {
      disbursement_receipt_url: finalReceipt,
      status: 'disbursed_to_vendor',
    });
    const caseDonations = await localDb.donations.where('case_id').equals(caseId).toArray();
    for (const d of caseDonations) {
      if (d.status === 'confirmed') {
        await localDb.donations.update(d.id, { status: 'paid_to_vendor' });
      }
    }
    const wc = await localDb.cases.get(caseId);
    if (wc) {
      await emitNotification(
        {
          event_type: 'disbursed_to_vendor',
          audience: 'both',
          target_code: wc.case_code,
          case_id: wc.id,
          campaign_id: null,
          milestone_pct: 100,
          title_en: `Paid to Vendor — Case ${wc.case_code}`,
          title_ur: `وینڈر کو ادائیگی مکمل — کیس ${wc.case_code}`,
          body_en: `Alhamdulillah! PKR ${wc.raised_amount_pkr.toLocaleString('en-PK')} for Case ${wc.case_code} has been settled directly with ${wc.vendor_name}. The signed Paid Vendor Receipt is now archived.`,
          body_ur: `الحمدللہ! کیس ${wc.case_code} کی رقم (${wc.raised_amount_pkr.toLocaleString('en-PK')} روپے) براہِ راست ${wc.vendor_name} کو ادا کر دی گئی ہے اور رسید محفوظ کر لی گئی ہے۔`,
          vendor_name: wc.vendor_name,
          district: wc.district,
          collected_pkr: wc.raised_amount_pkr,
          target_pkr: wc.target_amount_pkr,
        },
        wc.beneficiary_account_email ? [wc.beneficiary_account_email] : []
      );
    }
  },

  async toggleVerifierAccreditation(profileId: string, accredited: boolean): Promise<void> {
    await ensureLocalSeeded();
    const badge = accredited ? 'Accredited Field Verifier — Punjab' : 'Pending Accreditation';
    const qrSecret = accredited ? generateQrSecretHex() : null;
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_accredited_verifier: accredited,
          verifier_badge_title: badge,
          verifier_qr_secret: qrSecret,
        })
        .eq('id', profileId);
      if (error) throw error;
      if (accredited) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .maybeSingle();
        const vp = prof as Profile | null;
        if (vp?.email || vp?.telegram_chat_id) {
          await emitNotification(
            {
              event_type: 'field_verified',
              audience: 'both',
              target_code: vp.id,
              case_id: null,
              campaign_id: null,
              title_en: `Approved! Your Amanat Accredited Field Verifier ID Card Is Active`,
              title_ur: `مبارکباد! آپ کا امانت فیلڈ ویریفائر ڈیجیٹل کارڈ فعال ہو گیا ہے`,
              body_en: `Assalam-o-Alaikum ${vp.full_name}, the Amanat Verification Board has approved your Field Verifier accreditation for ${vp.tehsil}, ${vp.district}. Sign in to Amanat → Field Verifier tab to access your live 60-second anti-scam Dynamic QR ID Card and assigned household visits.`,
              body_ur: `السلام علیکم ${vp.full_name}، امانت ایڈمن بورڈ نے آپ کی فیلڈ ویریفائر منظوری مکمل کر لی ہے۔ اب آپ امانت ایپ کے فیلڈ ویریفائر پورٹل میں اپنا 60 سیکنڈ والا لائیو کیو آر کارڈ اور تفویض شدہ کیسز دیکھ سکتے ہیں۔`,
              vendor_name: 'Amanat Verification Board',
              district: vp.district,
            },
            vp.email ? [vp.email] : [],
            vp.telegram_chat_id ? [vp.telegram_chat_id] : []
          );
        }
      }
      return;
    }
    await localDb.profiles.update(profileId, {
      is_accredited_verifier: accredited,
      verifier_badge_title: badge,
      verifier_qr_secret: qrSecret,
    });
  },

  async deleteCampaign(id: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      await supabase.from('crowdfunding_campaigns').delete().eq('id', id);
      return;
    }
    await localDb.crowdfunding_campaigns.delete(id);
  },

  async deleteCase(id: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      await supabase.from('cases').delete().eq('id', id);
      return;
    }
    await localDb.cases.delete(id);
  },

  async deleteDonation(id: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      await supabase.from('donations').delete().eq('id', id);
      return;
    }
    await localDb.donations.delete(id);
  },

  async deleteProfile(id: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      await supabase.from('profiles').delete().eq('id', id);
      return;
    }
    await localDb.profiles.delete(id);
  },

  async setAppMode(mode: AppDataMode): Promise<AppSettings> {
    const current = await getActiveSettings();
    const updated: AppSettings = {
      ...current,
      app_mode: mode,
      updated_at: new Date().toISOString(),
    };
    if (supabase) {
      const { error } = await supabase.from('app_settings').upsert(updated, { onConflict: 'id' });
      if (error) throw error;
    }
    await localDb.app_settings.put(updated);
    return updated;
  },

  async flushAllDummyData(): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      // Strictly delete ONLY is_demo = true rows — Real Data (is_demo = false) is 100% untouched!
      await supabase.from('donations').delete().eq('is_demo', true);
      await supabase.from('field_verifications').delete().eq('is_demo', true);
      await supabase.from('notifications').delete().eq('is_demo', true);
      await supabase.from('cases').delete().eq('is_demo', true);
      await supabase.from('crowdfunding_campaigns').delete().eq('is_demo', true);
      await supabase.from('profiles').delete().eq('is_demo', true);
      return;
    }

    const demoDons = (await localDb.donations.toArray()).filter((x) => x.is_demo).map((x) => x.id);
    const demoVers = (await localDb.field_verifications.toArray()).filter((x) => x.is_demo).map((x) => x.id);
    const demoCases = (await localDb.cases.toArray()).filter((x) => x.is_demo).map((x) => x.id);
    const demoCamps = (await localDb.crowdfunding_campaigns.toArray()).filter((x) => x.is_demo).map((x) => x.id);
    const demoProfs = (await localDb.profiles.toArray()).filter((x) => x.is_demo).map((x) => x.id);

    await localDb.donations.bulkDelete(demoDons);
    await localDb.field_verifications.bulkDelete(demoVers);
    await localDb.cases.bulkDelete(demoCases);
    await localDb.crowdfunding_campaigns.bulkDelete(demoCamps);
    await localDb.profiles.bulkDelete(demoProfs);
  },

  async reseedTrainingData(): Promise<void> {
    await ensureLocalSeeded();
    const demoProfiles = SEED_PROFILES.map((p) => ({ ...p, is_demo: true }));
    const demoCampaigns = SEED_CAMPAIGNS.map((c) => ({ ...c, is_demo: true }));
    const demoCases = SEED_CASES.map((c) => ({ ...c, is_demo: true }));
    const demoVerifications = SEED_VERIFICATIONS.map((v) => ({ ...v, is_demo: true }));
    const demoDonations = SEED_DONATIONS.map((d) => ({ ...d, is_demo: true }));

    if (supabase) {
      await supabase.from('profiles').upsert(demoProfiles, { onConflict: 'id' });
      await supabase.from('crowdfunding_campaigns').upsert(demoCampaigns, { onConflict: 'id' });
      await supabase.from('cases').upsert(demoCases, { onConflict: 'id' });
      await supabase.from('field_verifications').upsert(demoVerifications, { onConflict: 'id' });
      await supabase.from('donations').upsert(demoDonations, { onConflict: 'id' });
      return;
    }

    await localDb.profiles.bulkPut(demoProfiles);
    await localDb.crowdfunding_campaigns.bulkPut(demoCampaigns);
    await localDb.cases.bulkPut(demoCases);
    await localDb.field_verifications.bulkPut(demoVerifications);
    await localDb.donations.bulkPut(demoDonations);
  },

  async exportRealDataBackup(): Promise<AmanatBackupBundle> {
    await ensureLocalSeeded();
    if (supabase) {
      const [settingsRes, profRes, campRes, caseRes, verRes, donRes, subRes, notifRes] =
        await Promise.all([
          supabase.from('app_settings').select('*').eq('id', 'global').maybeSingle(),
          supabase.from('profiles').select('*').eq('is_demo', false),
          supabase.from('crowdfunding_campaigns').select('*').eq('is_demo', false),
          supabase.from('cases').select('*').eq('is_demo', false),
          supabase.from('field_verifications').select('*').eq('is_demo', false),
          supabase.from('donations').select('*').eq('is_demo', false),
          supabase.from('notification_subscriptions').select('*'),
          supabase.from('notifications').select('*').eq('is_demo', false),
        ]);

      return buildBackupBundle({
        app_settings: (settingsRes.data as AppSettings | null) ?? null,
        profiles: (profRes.data ?? []) as Profile[],
        crowdfunding_campaigns: (campRes.data ?? []) as CrowdfundingCampaign[],
        cases: (caseRes.data ?? []) as WelfareCase[],
        field_verifications: (verRes.data ?? []) as FieldVerification[],
        donations: (donRes.data ?? []) as Donation[],
        notification_subscriptions: (subRes.data ?? []) as NotificationSubscription[],
        notifications: (notifRes.data ?? []) as NotificationRecord[],
      });
    }

    const [settings, profiles, campaigns, cases, verifications, donations, subs, notifications] =
      await Promise.all([
        localDb.app_settings.get('global'),
        localDb.profiles.toArray(),
        localDb.crowdfunding_campaigns.toArray(),
        localDb.cases.toArray(),
        localDb.field_verifications.toArray(),
        localDb.donations.toArray(),
        localDb.notification_subscriptions.toArray(),
        localDb.notifications.toArray(),
      ]);

    return buildBackupBundle({
      app_settings: settings ?? null,
      profiles: profiles.filter((r) => !r.is_demo),
      crowdfunding_campaigns: campaigns.filter((r) => !r.is_demo),
      cases: cases.filter((r) => !r.is_demo),
      field_verifications: verifications.filter((r) => !r.is_demo),
      donations: donations.filter((r) => !r.is_demo),
      notification_subscriptions: subs,
      notifications,
    });
  },

  async previewBackupRestore(bundle: AmanatBackupBundle): Promise<BackupRestorePreview> {
    const current = await this.exportRealDataBackup();

    const diffByKeys = <T extends { id: string }>(
      incoming: T[],
      existing: T[],
      extraKey?: (item: T) => string | null | undefined
    ) => {
      const existingIds = new Set(existing.map((e) => e.id));
      const existingAlt = new Set(
        existing
          .map((e) => (extraKey ? extraKey(e)?.toLowerCase() : null))
          .filter(Boolean) as string[]
      );
      let existingCount = 0;
      let newCount = 0;
      for (const item of incoming) {
        const alt = extraKey ? extraKey(item)?.toLowerCase() : null;
        if (existingIds.has(item.id) || (alt && existingAlt.has(alt))) {
          existingCount += 1;
        } else {
          newCount += 1;
        }
      }
      return { totalInBackup: incoming.length, newCount, existingCount };
    };

    return {
      exportedAt: bundle.exported_at,
      checksumVerified: true,
      hasSettings: Boolean(bundle.data.app_settings),
      tables: {
        profiles: diffByKeys(bundle.data.profiles, current.data.profiles, (p) => p.email),
        crowdfunding_campaigns: diffByKeys(
          bundle.data.crowdfunding_campaigns,
          current.data.crowdfunding_campaigns,
          (c) => c.campaign_code
        ),
        cases: diffByKeys(bundle.data.cases, current.data.cases, (c) => c.case_code),
        field_verifications: diffByKeys(
          bundle.data.field_verifications,
          current.data.field_verifications
        ),
        donations: diffByKeys(
          bundle.data.donations,
          current.data.donations,
          (d) => d.receipt_qr_hash
        ),
        notifications: diffByKeys(bundle.data.notifications, current.data.notifications),
      },
    };
  },

  async restoreRealDataBackup(bundle: AmanatBackupBundle): Promise<BackupRestoreResult> {
    await ensureLocalSeeded();
    const d = bundle.data;

    // Normalize every restored row as strictly Real Data (is_demo = false)
    const profiles = d.profiles.map((r) => ({ ...r, is_demo: false }));
    const campaigns = d.crowdfunding_campaigns.map((r) => ({ ...r, is_demo: false }));
    const cases = d.cases.map((r) => ({ ...r, is_demo: false }));
    const verifications = d.field_verifications.map((r) => ({ ...r, is_demo: false }));
    const donations = d.donations.map((r) => ({ ...r, is_demo: false }));
    const subs = d.notification_subscriptions ?? [];
    const notifications = d.notifications.map((r) => ({ ...r, is_demo: false }));

    if (supabase) {
      // Deduplicate against secondary unique keys before upserting so zero duplicates ever occur
      const { data: existingCamps } = await supabase
        .from('crowdfunding_campaigns')
        .select('id, campaign_code');
      const campCodeToId = new Map<string, string>(
        ((existingCamps ?? []) as Array<{ id: string; campaign_code: string }>).map((x) => [
          x.campaign_code.toLowerCase(),
          x.id,
        ])
      );
      const dedupCampaigns = campaigns.map((c) => {
        const existingId = campCodeToId.get(c.campaign_code.toLowerCase());
        return existingId && existingId !== c.id ? { ...c, id: existingId } : c;
      });

      const { data: existingCases } = await supabase.from('cases').select('id, case_code');
      const caseCodeToId = new Map<string, string>(
        ((existingCases ?? []) as Array<{ id: string; case_code: string }>).map((x) => [
          x.case_code.toLowerCase(),
          x.id,
        ])
      );
      const dedupCases = cases.map((c) => {
        const existingId = caseCodeToId.get(c.case_code.toLowerCase());
        return existingId && existingId !== c.id ? { ...c, id: existingId } : c;
      });

      const { data: existingDons } = await supabase
        .from('donations')
        .select('id, receipt_qr_hash');
      const qrToId = new Map<string, string>(
        ((existingDons ?? []) as Array<{ id: string; receipt_qr_hash: string }>).map((x) => [
          x.receipt_qr_hash.toLowerCase(),
          x.id,
        ])
      );
      const dedupDonations = donations.map((don) => {
        const existingId = qrToId.get(don.receipt_qr_hash.toLowerCase());
        return existingId && existingId !== don.id ? { ...don, id: existingId } : don;
      });

      // Strict FK-safe upsert order
      if (d.app_settings) {
        const { error } = await supabase
          .from('app_settings')
          .upsert({ ...d.app_settings, id: 'global' }, { onConflict: 'id' });
        if (error) throw error;
      }
      if (profiles.length > 0) {
        const { error } = await supabase.from('profiles').upsert(profiles, { onConflict: 'id' });
        if (error) throw error;
      }
      if (dedupCampaigns.length > 0) {
        const { error } = await supabase
          .from('crowdfunding_campaigns')
          .upsert(dedupCampaigns, { onConflict: 'id' });
        if (error) throw error;
      }
      if (dedupCases.length > 0) {
        const { error } = await supabase.from('cases').upsert(dedupCases, { onConflict: 'id' });
        if (error) throw error;
      }
      if (verifications.length > 0) {
        const { error } = await supabase
          .from('field_verifications')
          .upsert(verifications, { onConflict: 'id' });
        if (error) throw error;
      }
      if (dedupDonations.length > 0) {
        const { error } = await supabase
          .from('donations')
          .upsert(dedupDonations, { onConflict: 'id' });
        if (error) throw error;
      }
      if (subs.length > 0) {
        await supabase.from('notification_subscriptions').upsert(subs, { onConflict: 'id' });
      }
      if (notifications.length > 0) {
        await supabase.from('notifications').upsert(notifications, { onConflict: 'id' });
      }

      return {
        restoredCounts: {
          profiles: profiles.length,
          crowdfunding_campaigns: dedupCampaigns.length,
          cases: dedupCases.length,
          field_verifications: verifications.length,
          donations: dedupDonations.length,
          notification_subscriptions: subs.length,
          notifications: notifications.length,
        },
        settingsRestored: Boolean(d.app_settings),
      };
    }

    if (d.app_settings) await localDb.app_settings.put({ ...d.app_settings, id: 'global' });
    if (profiles.length > 0) await localDb.profiles.bulkPut(profiles);
    if (campaigns.length > 0) await localDb.crowdfunding_campaigns.bulkPut(campaigns);
    if (cases.length > 0) await localDb.cases.bulkPut(cases);
    if (verifications.length > 0) await localDb.field_verifications.bulkPut(verifications);
    if (donations.length > 0) await localDb.donations.bulkPut(donations);
    if (subs.length > 0) await localDb.notification_subscriptions.bulkPut(subs);
    if (notifications.length > 0) await localDb.notifications.bulkPut(notifications);

    return {
      restoredCounts: {
        profiles: profiles.length,
        crowdfunding_campaigns: campaigns.length,
        cases: cases.length,
        field_verifications: verifications.length,
        donations: donations.length,
        notification_subscriptions: subs.length,
        notifications: notifications.length,
      },
      settingsRestored: Boolean(d.app_settings),
    };
  },

  async submitDonationPledge(input: CreateDonationInput): Promise<Donation> {
    await ensureLocalSeeded();
    const activeSettings = await getActiveSettings();
    const isDemoMode = activeSettings.app_mode === 'training';

    // 3-Layer Donor Anti-Duplicate Shield (Normalized Tx Ref + Receipt Image SHA-256 Fingerprint)
    const normRef = normalizeTxRef(input.transaction_ref);
    const proofHash = input.payment_proof_url ? await sha256Hex(input.payment_proof_url) : null;

    const existingDonations: Donation[] = supabase
      ? (((await supabase.from('donations').select('*').eq('is_demo', isDemoMode)).data ??
          []) as Donation[])
      : (await localDb.donations.toArray()).filter((d) => Boolean(d.is_demo) === isDemoMode);

    const activeNonRejected = existingDonations.filter((d) => d.status !== 'rejected');

    if (normRef) {
      const dupRef = activeNonRejected.find(
        (d) =>
          (d.normalized_tx_ref && d.normalized_tx_ref === normRef) ||
          normalizeTxRef(d.transaction_ref) === normRef
      );
      if (dupRef) {
        const when = new Date(dupRef.created_at).toLocaleDateString('en-GB');
        const st = dupRef.status.replace(/_/g, ' ').toUpperCase();
        throw new Error(
          `Duplicate Transaction Reference: "${input.transaction_ref.trim()}" was already submitted on ${when} for PKR ${dupRef.amount_pkr.toLocaleString('en-PK')} (Status: ${st}). You can download your existing QR Certificate from your Donor Dashboard instead of submitting again. | یہ ٹرانزیکشن ریفرنس پہلے ہی درج ہو چکا ہے۔`
        );
      }
    }

    if (proofHash) {
      const dupReceipt = activeNonRejected.find(
        (d) => d.payment_proof_hash && d.payment_proof_hash === proofHash
      );
      if (dupReceipt) {
        throw new Error(
          `Duplicate Payment Receipt Detected: This exact receipt image was already uploaded with Transaction Ref "${dupReceipt.transaction_ref}" (PKR ${dupReceipt.amount_pkr.toLocaleString('en-PK')}). Please upload a new transfer receipt. | یہ رسید پہلے ہی اپ لوڈ کی جا چکی ہے۔`
        );
      }
    }

    const uploadedProof = await uploadMediaToStorage(input.payment_proof_url, 'payment-proofs');
    const donation: Donation = {
      id: generateId('don'),
      donor_id: null,
      donor_email: input.donor_email?.trim() || null,
      case_id: input.case_id,
      campaign_id: input.campaign_id,
      amount_pkr: input.amount_pkr,
      payment_channel: input.payment_channel,
      transaction_ref: input.transaction_ref.trim(),
      payment_proof_url: uploadedProof,
      payment_proof_hash: proofHash,
      normalized_tx_ref: normRef,
      status: 'pledged_pending_verify',
      receipt_qr_hash: generateReceiptHash(input.target_code),
      created_at: new Date().toISOString(),
      is_demo: isDemoMode,
    };

    if (supabase) {
      const { data, error } = await supabase.from('donations').insert(donation).select().single();
      if (error) throw error;
      if (input.campaign_id) {
        const { data: camp } = await supabase
          .from('crowdfunding_campaigns')
          .select('pledged_amount_pkr')
          .eq('id', input.campaign_id)
          .single();
        if (camp) {
          await supabase
            .from('crowdfunding_campaigns')
            .update({ pledged_amount_pkr: camp.pledged_amount_pkr + input.amount_pkr })
            .eq('id', input.campaign_id);
        }
      } else if (input.case_id) {
        const { data: c } = await supabase
          .from('cases')
          .select('pledged_amount_pkr')
          .eq('id', input.case_id)
          .single();
        if (c) {
          await supabase
            .from('cases')
            .update({ pledged_amount_pkr: c.pledged_amount_pkr + input.amount_pkr })
            .eq('id', input.case_id);
        }
      }
      return data as Donation;
    }

    await localDb.donations.put(donation);
    await saveSubscription({
      role: 'donor',
      case_id: input.case_id,
      campaign_id: input.campaign_id,
      email: input.donor_email ?? null,
      telegram_chat_id: input.donor_telegram_id ?? null,
    });
    let vendorForPledge = 'Verified Escrow Vendor';
    let districtForPledge = 'Punjab';
    if (input.campaign_id) {
      const camp = await localDb.crowdfunding_campaigns.get(input.campaign_id);
      if (camp) {
        vendorForPledge = camp.vendor_name;
        districtForPledge = camp.district;
        await localDb.crowdfunding_campaigns.update(camp.id, {
          pledged_amount_pkr: camp.pledged_amount_pkr + input.amount_pkr,
        });
      }
    } else if (input.case_id) {
      const c = await localDb.cases.get(input.case_id);
      if (c) {
        vendorForPledge = c.vendor_name;
        districtForPledge = c.district;
        await localDb.cases.update(c.id, {
          pledged_amount_pkr: c.pledged_amount_pkr + input.amount_pkr,
        });
      }
    }

    await emitNotification(
      {
        event_type: 'donation_pledged',
        audience: 'donor',
        target_code: input.target_code,
        case_id: input.case_id,
        campaign_id: input.campaign_id,
        title_en: `Pledge Received — PKR ${input.amount_pkr.toLocaleString('en-PK')}`,
        title_ur: `آپ کا عطیہ درج ہو گیا — ${input.amount_pkr.toLocaleString('en-PK')} روپے`,
        body_en: `JazakAllah Khair! Your pledge (Ref: ${donation.transaction_ref}) is logged for verification. You will receive automatic updates at 25%, 50%, 75%, 100%, and Paid Vendor Receipt.`,
        body_ur: `جزاک اللہ خیر! آپ کا عطیہ (ریفرنس: ${donation.transaction_ref}) تصدیق کے لیے درج ہو چکا ہے۔ اہم اہداف مکمل ہونے پر آپ کو خودکار اطلاع ملے گی۔`,
        vendor_name: vendorForPledge,
        district: districtForPledge,
      },
      input.donor_email ? [input.donor_email] : [],
      input.donor_telegram_id ? [input.donor_telegram_id] : []
    );

    return donation;
  },

  async confirmDonation(donationId: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      const { data: don } = await supabase
        .from('donations')
        .select('*')
        .eq('id', donationId)
        .single();
      if (!don || don.status !== 'pledged_pending_verify') return;
      await supabase.from('donations').update({ status: 'confirmed' }).eq('id', donationId);

      if (don.campaign_id) {
        const { data: camp } = await supabase
          .from('crowdfunding_campaigns')
          .select('*')
          .eq('id', don.campaign_id)
          .single();
        if (camp) {
          const prevCollected = camp.collected_amount_pkr;
          const newCollected = prevCollected + don.amount_pkr;
          const newPledged = Math.max(0, camp.pledged_amount_pkr - don.amount_pkr);
          const newStatus =
            newCollected >= camp.target_amount_pkr ? 'fully_funded' : camp.status;
          await supabase
            .from('crowdfunding_campaigns')
            .update({
              collected_amount_pkr: newCollected,
              pledged_amount_pkr: newPledged,
              donor_count: camp.donor_count + 1,
              status: newStatus,
            })
            .eq('id', camp.id);

          // 1. Direct Confirmation Email to the Donor
          if (don.donor_email) {
            await emitNotification(
              {
                event_type: 'donation_pledged',
                audience: 'donor',
                target_code: camp.campaign_code,
                case_id: null,
                campaign_id: camp.id,
                title_en: `Contribution Confirmed — PKR ${don.amount_pkr.toLocaleString('en-PK')} (${camp.campaign_code})`,
                title_ur: `آپ کا عطیہ تصدیق ہو گیا — ${don.amount_pkr.toLocaleString('en-PK')} روپے`,
                body_en: `JazakAllah Khair! Your contribution of PKR ${don.amount_pkr.toLocaleString('en-PK')} (Ref: ${don.transaction_ref}, QR Hash: ${don.receipt_qr_hash}) for "${camp.title_en}" has been verified and confirmed in Amanat's Direct Vendor Escrow ledger.`,
                body_ur: `جزاک اللہ خیر! مہم "${camp.title_ur}" کے لیے آپ کا ${don.amount_pkr.toLocaleString('en-PK')} روپے کا عطیہ (ریفرنس: ${don.transaction_ref}) امانت ایسکرو لیجر میں تصدیق کر لیا گیا ہے۔`,
                vendor_name: camp.vendor_name,
                district: camp.district,
                collected_pkr: newCollected,
                target_pkr: camp.target_amount_pkr,
              },
              [don.donor_email]
            );
          }

          // 2. Broadcast 25% / 50% / 75% / 100% Major Milestone to ALL Donors
          const crossed = detectCrossedMajorMilestone(
            prevCollected,
            newCollected,
            camp.target_amount_pkr
          );
          if (crossed !== null) {
            const isFull = crossed === 100;
            await emitNotification({
              event_type: isFull ? 'fully_funded_locked' : 'funding_milestone',
              audience: 'both',
              target_code: camp.campaign_code,
              case_id: null,
              campaign_id: camp.id,
              milestone_pct: crossed,
              title_en: isFull
                ? `100% Fully Funded! ${camp.title_en}`
                : `${crossed}% Milestone Crossed — ${camp.title_en}`,
              title_ur: isFull
                ? `100% ہدف مکمل! ${camp.title_ur}`
                : `${crossed}% اہم ہدف مکمل — ${camp.title_ur}`,
              body_en: isFull
                ? `Alhamdulillah! Verified escrow reached 100% (PKR ${newCollected.toLocaleString('en-PK')}). Direct vendor payout to ${camp.vendor_name} is now being initiated.`
                : `Great news! Confirmed escrow just crossed ${crossed}% (PKR ${newCollected.toLocaleString('en-PK')} of PKR ${camp.target_amount_pkr.toLocaleString('en-PK')}) for ${camp.vendor_name}.`,
              body_ur: isFull
                ? `الحمدللہ! مہم کا 100 فیصد ہدف (${newCollected.toLocaleString('en-PK')} روپے) مکمل ہو گیا۔ اب ${camp.vendor_name} کو براہِ راست ادائیگی کی جا رہی ہے۔`
                : `خوشخبری! مہم نے ${crossed} فیصد ہدف (${newCollected.toLocaleString('en-PK')} روپے از ${camp.target_amount_pkr.toLocaleString('en-PK')} روپے) عبور کر لیا ہے۔`,
              vendor_name: camp.vendor_name,
              district: camp.district,
              collected_pkr: newCollected,
              target_pkr: camp.target_amount_pkr,
            });
          }
        }
      } else if (don.case_id) {
        const { data: c } = await supabase.from('cases').select('*').eq('id', don.case_id).single();
        if (c) {
          const prevRaised = c.raised_amount_pkr;
          const newRaised = prevRaised + don.amount_pkr;
          const newPledged = Math.max(0, c.pledged_amount_pkr - don.amount_pkr);
          const newStatus = newRaised >= c.target_amount_pkr ? 'funded' : c.status;
          await supabase
            .from('cases')
            .update({
              raised_amount_pkr: newRaised,
              pledged_amount_pkr: newPledged,
              status: newStatus,
            })
            .eq('id', c.id);

          // 1. Direct Confirmation Email to the Donor
          if (don.donor_email) {
            await emitNotification(
              {
                event_type: 'donation_pledged',
                audience: 'donor',
                target_code: c.case_code,
                case_id: c.id,
                campaign_id: null,
                title_en: `Contribution Confirmed — PKR ${don.amount_pkr.toLocaleString('en-PK')} (${c.case_code})`,
                title_ur: `آپ کا عطیہ تصدیق ہو گیا — ${don.amount_pkr.toLocaleString('en-PK')} روپے`,
                body_en: `JazakAllah Khair! Your contribution of PKR ${don.amount_pkr.toLocaleString('en-PK')} (Ref: ${don.transaction_ref}, QR Hash: ${don.receipt_qr_hash}) for Case ${c.case_code} (${c.district}) has been verified and confirmed.`,
                body_ur: `جزاک اللہ خیر! کیس ${c.case_code} کے لیے آپ کا ${don.amount_pkr.toLocaleString('en-PK')} روپے کا عطیہ (ریفرنس: ${don.transaction_ref}) تصدیق کر لیا گیا ہے۔`,
                vendor_name: c.vendor_name,
                district: c.district,
                collected_pkr: newRaised,
                target_pkr: c.target_amount_pkr,
              },
              [don.donor_email]
            );
          }

          // 2. Broadcast 25% / 50% / 75% / 100% Major Milestone to ALL Donors & Beneficiary
          const crossed = detectCrossedMajorMilestone(prevRaised, newRaised, c.target_amount_pkr);
          if (crossed !== null) {
            const isFull = crossed === 100;
            await emitNotification({
              event_type: isFull ? 'fully_funded_locked' : 'funding_milestone',
              audience: 'both',
              target_code: c.case_code,
              case_id: c.id,
              campaign_id: null,
              milestone_pct: crossed,
              title_en: isFull
                ? `100% Funded! Case ${c.case_code} Ready for Vendor Payout`
                : `${crossed}% Milestone Crossed — Case ${c.case_code}`,
              title_ur: isFull
                ? `100% فنڈنگ مکمل! کیس ${c.case_code}`
                : `${crossed}% اہم ہدف مکمل — کیس ${c.case_code}`,
              body_en: isFull
                ? `Alhamdulillah! Case ${c.case_code} (${c.district}) reached 100% (PKR ${newRaised.toLocaleString('en-PK')}). Direct settlement with ${c.vendor_name} is underway.`
                : `Funding for Case ${c.case_code} (${c.district}) crossed ${crossed}% — PKR ${newRaised.toLocaleString('en-PK')} of PKR ${c.target_amount_pkr.toLocaleString('en-PK')} confirmed.`,
              body_ur: isFull
                ? `الحمدللہ! کیس ${c.case_code} کا 100 فیصد ہدف مکمل ہو گیا ہے۔ اب ${c.vendor_name} کو براہِ راست ادائیگی کی جا رہی ہے۔`
                : `کیس ${c.case_code} کی تصدیق شدہ فنڈنگ ${crossed} فیصد (${newRaised.toLocaleString('en-PK')} روپے) سے تجاوز کر گئی ہے۔`,
              vendor_name: c.vendor_name,
              district: c.district,
              collected_pkr: newRaised,
              target_pkr: c.target_amount_pkr,
            });
          }
        }
      }
      return;
    }

    const don = await localDb.donations.get(donationId);
    if (!don || don.status !== 'pledged_pending_verify') return;

    await localDb.donations.update(donationId, { status: 'confirmed' });

    if (don.campaign_id) {
      const camp = await localDb.crowdfunding_campaigns.get(don.campaign_id);
      if (camp) {
        const prevCollected = camp.collected_amount_pkr;
        const newCollected = prevCollected + don.amount_pkr;
        const newPledged = Math.max(0, camp.pledged_amount_pkr - don.amount_pkr);
        const newStatus =
          newCollected >= camp.target_amount_pkr ? 'fully_funded' : camp.status;
        await localDb.crowdfunding_campaigns.update(camp.id, {
          collected_amount_pkr: newCollected,
          pledged_amount_pkr: newPledged,
          donor_count: camp.donor_count + 1,
          status: newStatus,
        });

        const crossed = detectCrossedMajorMilestone(
          prevCollected,
          newCollected,
          camp.target_amount_pkr
        );
        if (crossed !== null) {
          const isFull = crossed === 100;
          await emitNotification({
            event_type: isFull ? 'fully_funded_locked' : 'funding_milestone',
            audience: 'both',
            target_code: camp.campaign_code,
            case_id: null,
            campaign_id: camp.id,
            milestone_pct: crossed,
            title_en: isFull
              ? `100% Fully Funded! ${camp.title_en}`
              : `${crossed}% Milestone Crossed — ${camp.title_en}`,
            title_ur: isFull
              ? `100% ہدف مکمل! ${camp.title_ur}`
              : `${crossed}% اہم ہدف مکمل — ${camp.title_ur}`,
            body_en: isFull
              ? `Alhamdulillah! Verified escrow reached 100% (PKR ${newCollected.toLocaleString('en-PK')}). Direct vendor payout to ${camp.vendor_name} is now being initiated.`
              : `Great news! Confirmed escrow just crossed ${crossed}% (PKR ${newCollected.toLocaleString('en-PK')} of PKR ${camp.target_amount_pkr.toLocaleString('en-PK')}) for ${camp.vendor_name}.`,
            body_ur: isFull
              ? `الحمدللہ! مہم کا 100 فیصد ہدف (${newCollected.toLocaleString('en-PK')} روپے) مکمل ہو گیا۔ اب ${camp.vendor_name} کو براہِ راست ادائیگی کی جا رہی ہے۔`
              : `خوشخبری! مہم نے ${crossed} فیصد ہدف (${newCollected.toLocaleString('en-PK')} روپے از ${camp.target_amount_pkr.toLocaleString('en-PK')} روپے) عبور کر لیا ہے۔`,
            vendor_name: camp.vendor_name,
            district: camp.district,
            collected_pkr: newCollected,
            target_pkr: camp.target_amount_pkr,
          });
        }
      }
    } else if (don.case_id) {
      const c = await localDb.cases.get(don.case_id);
      if (c) {
        const prevRaised = c.raised_amount_pkr;
        const newRaised = prevRaised + don.amount_pkr;
        const newPledged = Math.max(0, c.pledged_amount_pkr - don.amount_pkr);
        const newStatus = newRaised >= c.target_amount_pkr ? 'funded' : c.status;
        await localDb.cases.update(c.id, {
          raised_amount_pkr: newRaised,
          pledged_amount_pkr: newPledged,
          status: newStatus,
        });

        const crossed = detectCrossedMajorMilestone(prevRaised, newRaised, c.target_amount_pkr);
        if (crossed !== null) {
          const isFull = crossed === 100;
          await emitNotification({
            event_type: isFull ? 'fully_funded_locked' : 'funding_milestone',
            audience: 'both',
            target_code: c.case_code,
            case_id: c.id,
            campaign_id: null,
            milestone_pct: crossed,
            title_en: isFull
              ? `100% Funded! Case ${c.case_code} Ready for Vendor Payout`
              : `${crossed}% Milestone Crossed — Case ${c.case_code}`,
            title_ur: isFull
              ? `100% فنڈنگ مکمل! کیس ${c.case_code}`
              : `${crossed}% اہم ہدف مکمل — کیس ${c.case_code}`,
            body_en: isFull
              ? `Alhamdulillah! Case ${c.case_code} (${c.district}) reached 100% (PKR ${newRaised.toLocaleString('en-PK')}). Direct settlement with ${c.vendor_name} is underway.`
              : `Funding for Case ${c.case_code} (${c.district}) crossed ${crossed}% — PKR ${newRaised.toLocaleString('en-PK')} of PKR ${c.target_amount_pkr.toLocaleString('en-PK')} confirmed.`,
            body_ur: isFull
              ? `الحمدللہ! کیس ${c.case_code} کا 100 فیصد ہدف مکمل ہو گیا ہے۔ اب ${c.vendor_name} کو براہِ راست ادائیگی کی جا رہی ہے۔`
              : `کیس ${c.case_code} کی تصدیق شدہ فنڈنگ ${crossed} فیصد (${newRaised.toLocaleString('en-PK')} روپے) سے تجاوز کر گئی ہے۔`,
            vendor_name: c.vendor_name,
            district: c.district,
            collected_pkr: newRaised,
            target_pkr: c.target_amount_pkr,
          });
        }
      }
    }
  },

  async logAdminAudit(entry: {
    actor_name: string;
    actor_role: 'master_admin' | 'officer_partial' | 'officer_full';
    action: string;
    target_code: string;
    details?: string;
  }): Promise<void> {
    const record: AdminAuditLog = {
      id: generateId('aud'),
      actor_name: entry.actor_name,
      actor_role: entry.actor_role,
      action: entry.action,
      target_code: entry.target_code,
      details: entry.details ?? '',
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      await supabase.from('admin_audit_logs').insert(record);
    }
  },

  async requestAdminPasswordRecovery(): Promise<{ sentTo: string }> {
    const settings = await getActiveSettings();
    const recoveryEmail =
      settings.email_gateway?.senderEmail?.trim() ||
      settings.social_links.email?.trim() ||
      'support.amanat@gmail.com';
    const code = generateSecureOtp();
    const codeHash = await hashAdminPassword(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (supabase) {
      const { error } = await supabase
        .from('app_settings')
        .update({
          recovery_code_hash: codeHash,
          recovery_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'global');
      if (error) throw error;
    } else {
      await localDb.app_settings.put({
        ...settings,
        recovery_code_hash: codeHash,
        recovery_expires_at: expiresAt,
      });
    }

    const adminTg = settings.telegram_config.chatId?.trim()
      ? [settings.telegram_config.chatId.trim()]
      : [];

    await emitNotification(
      {
        event_type: 'case_submitted',
        audience: 'both',
        target_code: 'ADMIN-RESET',
        case_id: null,
        campaign_id: null,
        title_en: `Amanat Master Password Recovery Code: ${code}`,
        title_ur: `امانت ایڈمن پاس ورڈ ری سیٹ کوڈ: ${code}`,
        body_en: `A Master Admin Password recovery was requested. Your single-use 6-digit recovery code is ${code} (expires in 10 minutes). Return to https://amanat-punjab.vercel.app/#admin to enter this code and set a new password. If you did not request this, ignore this email.`,
        body_ur: `امانت ایڈمن ماسٹر پاس ورڈ ری سیٹ کی درخواست موصول ہوئی ہے۔ آپ کا 6 ہندسوں والا کوڈ ${code} ہے جو 10 منٹ تک کارآمد ہے۔`,
        vendor_name: 'Amanat Security Board',
        district: 'Punjab',
      },
      [recoveryEmail],
      adminTg
    );

    return { sentTo: recoveryEmail };
  },

  async completeAdminPasswordRecovery(code: string, newPassword: string): Promise<void> {
    const cleanCode = code.trim();
    const cleanPass = newPassword.trim();
    if (cleanCode.length !== 6) {
      throw new Error('Please enter the exact 6-digit recovery code sent to support.amanat@gmail.com.');
    }
    if (cleanPass.length < 6) {
      throw new Error('New Master Password must be at least 6 characters.');
    }

    const settings = await getActiveSettings();
    if (!settings.recovery_code_hash || !settings.recovery_expires_at) {
      throw new Error('No active recovery request found. Please request a new recovery code.');
    }
    if (Date.now() > new Date(settings.recovery_expires_at).getTime()) {
      throw new Error('Recovery code expired (10-minute limit). Please request a new code.');
    }

    const enteredHash = await hashAdminPassword(cleanCode);
    if (enteredHash !== settings.recovery_code_hash) {
      throw new Error('Invalid 6-digit recovery code. Please check support.amanat@gmail.com.');
    }

    const nextPassHash = await hashAdminPassword(cleanPass);
    if (supabase) {
      const { error } = await supabase
        .from('app_settings')
        .update({
          admin_password_hash: nextPassHash,
          recovery_code_hash: null,
          recovery_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'global');
      if (error) throw error;
    } else {
      await localDb.app_settings.put({
        ...settings,
        admin_password_hash: nextPassHash,
        recovery_code_hash: null,
        recovery_expires_at: null,
        updated_at: new Date().toISOString(),
      });
    }

    await this.logAdminAudit({
      actor_name: 'Master Admin',
      actor_role: 'master_admin',
      action: 'MASTER_PASSWORD_RECOVERED',
      target_code: 'ADMIN-AUTH',
      details: 'Master password reset via 6-digit email recovery code.',
    });

    const recoveryEmail =
      settings.email_gateway?.senderEmail?.trim() || 'support.amanat@gmail.com';
    await emitNotification(
      {
        event_type: 'case_submitted',
        audience: 'both',
        target_code: 'ADMIN-AUTH',
        case_id: null,
        campaign_id: null,
        title_en: 'Amanat Master Password Updated Successfully',
        title_ur: 'امانت ایڈمن ماسٹر پاس ورڈ کامیابی سے تبدیل ہو گیا',
        body_en:
          'Your Amanat Verification Board Master Password was just reset via email recovery. You can now sign in with your new password.',
        body_ur: 'آپ کا امانت ایڈمن ماسٹر پاس ورڈ کامیابی سے تبدیل کر دیا گیا ہے۔',
        vendor_name: 'Amanat Security Board',
        district: 'Punjab',
      },
      [recoveryEmail]
    );
  },

  async authenticateOfficer(username: string, password: string): Promise<AdminOfficer> {
    const cleanUser = username.trim().toLowerCase();
    const passHash = await hashAdminPassword(password);
    if (!supabase) {
      throw new Error('Board Officer login requires live Supabase connection.');
    }
    const { data, error } = await supabase
      .from('admin_officers')
      .select('*')
      .ilike('username', cleanUser)
      .maybeSingle();
    if (error || !data) {
      throw new Error('Invalid Board Officer username or password.');
    }
    const officer = data as AdminOfficer;
    if (!officer.is_active) {
      throw new Error('This Board Officer account has been suspended/revoked by Master Admin.');
    }
    if (officer.password_hash !== passHash) {
      throw new Error('Invalid Board Officer username or password.');
    }
    return officer;
  },

  async createAdminOfficer(input: {
    full_name: string;
    cnic_number: string;
    phone: string;
    email: string;
    username: string;
    password: string;
    permission_tier: OfficerPermissionTier;
    district_scope: string;
    max_approval_pkr: number | null;
    telegram_chat_id?: string | null;
  }): Promise<AdminOfficer> {
    if (!supabase) throw new Error('Supabase required to create Board Officers.');
    const cleanUsername = input.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (cleanUsername.length < 3) {
      throw new Error('Username must be at least 3 characters (letters, numbers, ., _, -).');
    }
    if (input.password.trim().length < 6) {
      throw new Error('Initial password must be at least 6 characters.');
    }
    const password_hash = await hashAdminPassword(input.password.trim());
    const officer: AdminOfficer = {
      id: generateId('off'),
      full_name: input.full_name.trim(),
      cnic_number: input.cnic_number.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      username: cleanUsername,
      password_hash,
      permission_tier: input.permission_tier,
      district_scope: input.district_scope || 'all',
      max_approval_pkr: input.max_approval_pkr,
      telegram_chat_id: input.telegram_chat_id?.trim() || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('admin_officers')
      .insert(officer)
      .select()
      .single();
    if (error) {
      if (error.message.toLowerCase().includes('unique') || error.code === '23505') {
        throw new Error(`Username "${cleanUsername}" is already taken. Choose another username.`);
      }
      throw error;
    }

    await this.logAdminAudit({
      actor_name: 'Master Admin',
      actor_role: 'master_admin',
      action: 'CREATED_OFFICER',
      target_code: cleanUsername,
      details: `${officer.full_name} · Tier: ${officer.permission_tier} · Scope: ${officer.district_scope}${officer.max_approval_pkr ? ` · Cap: PKR ${officer.max_approval_pkr.toLocaleString('en-PK')}` : ''}`,
    });

    // Send Welcome strictly to the Board Officer's Email & Telegram ID (never Admin's Telegram!)
    if (officer.email || officer.telegram_chat_id) {
      await emitNotification(
        {
          event_type: 'case_submitted',
          audience: 'both',
          target_code: cleanUsername.toUpperCase(),
          case_id: null,
          campaign_id: null,
          title_en: 'Welcome — Your Amanat Board Officer Account Is Active',
          title_ur: 'خوش آمدید — آپ کا امانت بورڈ آفیسر اکاؤنٹ فعال ہو گیا ہے',
          body_en: `Assalam-o-Alaikum ${officer.full_name}, Master Admin has created your Board Officer account on Amanat. Login at https://amanat-punjab.vercel.app/#admin (select "Board Officer" tab). Username: ${cleanUsername} · Role: ${officer.permission_tier === 'full_approve' ? 'Full Approver & Reject' : 'Partial Approver & Reject'} · Coverage: ${officer.district_scope === 'all' ? 'All Punjab' : officer.district_scope}. Please get your initial password directly from Master Admin.`,
          body_ur: `السلام علیکم ${officer.full_name}، آپ کا امانت بورڈ آفیسر اکاؤنٹ (${cleanUsername}) فعال کر دیا گیا ہے۔`,
          vendor_name: 'Amanat Verification Board',
          district: officer.district_scope === 'all' ? 'Punjab' : officer.district_scope,
        },
        officer.email ? [officer.email] : [],
        officer.telegram_chat_id ? [officer.telegram_chat_id] : []
      );
    }

    return data as AdminOfficer;
  },

  async updateAdminOfficer(
    id: string,
    patch: Partial<
      Pick<
        AdminOfficer,
        'is_active' | 'permission_tier' | 'district_scope' | 'max_approval_pkr' | 'telegram_chat_id'
      >
    >,
    auditDetails: string
  ): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.from('admin_officers').update(patch).eq('id', id);
    if (error) throw error;
    await this.logAdminAudit({
      actor_name: 'Master Admin',
      actor_role: 'master_admin',
      action: patch.is_active === false ? 'REVOKED_OFFICER' : 'UPDATED_OFFICER',
      target_code: id,
      details: auditDetails,
    });
  },

  async resetOfficerPassword(id: string, newPassword: string): Promise<void> {
    if (!supabase) return;
    if (newPassword.trim().length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }
    const password_hash = await hashAdminPassword(newPassword.trim());
    const { error } = await supabase
      .from('admin_officers')
      .update({ password_hash })
      .eq('id', id);
    if (error) throw error;
    await this.logAdminAudit({
      actor_name: 'Master Admin',
      actor_role: 'master_admin',
      action: 'RESET_OFFICER_PASSWORD',
      target_code: id,
      details: 'Master Admin reset Board Officer password.',
    });
  },
};
