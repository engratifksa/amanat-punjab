import Dexie, { type EntityTable } from 'dexie';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
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
  SEED_PROFILES,
  SEED_CAMPAIGNS,
  SEED_CASES,
  SEED_VERIFICATIONS,
  SEED_DONATIONS,
  DEFAULT_APP_SETTINGS,
  makeInvoiceDataUrl,
} from './seedData';
import { DEFAULT_INITIAL_PASSWORD, hashAdminPassword } from './adminAuth';
import {
  createNotificationRecord,
  detectCrossedMajorMilestone,
  dispatchMultiChannelNotification,
  type BuildMilestoneNotificationArgs,
} from './notifications';

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
  if (supabase) {
    const query = supabase.from('notification_subscriptions').select('*');
    if (partial.campaign_id) {
      const { data } = await query.eq('campaign_id', partial.campaign_id);
      subs = (data ?? []) as NotificationSubscription[];
    } else if (partial.case_id) {
      const { data } = await query.eq('case_id', partial.case_id);
      subs = (data ?? []) as NotificationSubscription[];
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

  const emails = [
    ...extraEmails,
    ...filteredSubs.map((s) => s.email ?? ''),
    senderEmail,
  ].filter(Boolean);

  const telegramIds = [
    ...extraTelegramIds,
    ...filteredSubs.map((s) => s.telegram_chat_id ?? ''),
  ].filter(Boolean);

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
      const [profilesRes, campsRes, casesRes, verRes, donRes, settingsRes, notifRes] =
        await Promise.all([
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
        ]);
      const defaultHash = await hashAdminPassword(DEFAULT_INITIAL_PASSWORD);
      const settings =
        (settingsRes.data as AppSettings | null) ?? {
          ...DEFAULT_APP_SETTINGS,
          admin_password_hash: defaultHash,
        };
      return {
        profiles: (profilesRes.data ?? []) as Profile[],
        campaigns: (campsRes.data ?? []) as CrowdfundingCampaign[],
        cases: (casesRes.data ?? []) as WelfareCase[],
        verifications: (verRes.data ?? []) as FieldVerification[],
        donations: (donRes.data ?? []) as Donation[],
        notifications: (notifRes.data ?? []) as NotificationRecord[],
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
    const settings: AppSettings = savedSettings ?? {
      ...DEFAULT_APP_SETTINGS,
      admin_password_hash: defaultHash,
    };

    return { profiles, campaigns, cases, verifications, donations, notifications, settings };
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
    return await emitNotification({
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
    });
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
    if (supabase) {
      const { error } = await supabase
        .from('crowdfunding_campaigns')
        .update({ disbursement_receipt_url: receiptUrl, status: 'disbursed_to_vendor' })
        .eq('id', id);
      if (error) throw error;
      return;
    }
    await localDb.crowdfunding_campaigns.update(id, {
      disbursement_receipt_url: receiptUrl,
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
      beneficiary_id: 'prof-ben-1',
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
    };

    if (supabase) {
      const { data, error } = await supabase.from('cases').insert(newCase).select().single();
      if (error) throw error;
      return data as WelfareCase;
    }

    await localDb.cases.put(newCase);
    await saveSubscription({
      role: 'beneficiary',
      case_id: newCase.id,
      campaign_id: null,
      email: input.recipient_email ?? null,
      telegram_chat_id: input.recipient_telegram_id ?? null,
    });
    await emitNotification(
      {
        event_type: 'case_submitted',
        audience: 'beneficiary',
        target_code: newCase.case_code,
        case_id: newCase.id,
        campaign_id: null,
        title_en: `Confidential Request Logged (${newCase.case_code})`,
        title_ur: `خفیہ درخواست درج ہو گئی (${newCase.case_code})`,
        body_en: `Your request for PKR ${newCase.target_amount_pkr.toLocaleString('en-PK')} via ${newCase.vendor_name} has been assigned to an Accredited Field Verifier in ${newCase.district}.`,
        body_ur: `آپ کی درخواست (${newCase.case_code}) فیلڈ ویریفیکیشن کے لیے ضلع ${newCase.district} کے مستند ویریفائر کو تفویض کر دی گئی ہے۔`,
        vendor_name: newCase.vendor_name,
        district: newCase.district,
        collected_pkr: 0,
        target_pkr: newCase.target_amount_pkr,
      },
      input.recipient_email ? [input.recipient_email] : [],
      input.recipient_telegram_id ? [input.recipient_telegram_id] : []
    );
    return newCase;
  },

  async assignVerifierToCase(caseId: string, verifierId: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      await supabase
        .from('cases')
        .update({ status: 'pending_field_visit', assigned_verifier_id: verifierId })
        .eq('id', caseId);
      return;
    }
    await localDb.cases.update(caseId, {
      status: 'pending_field_visit',
      assigned_verifier_id: verifierId,
    });
    const c = await localDb.cases.get(caseId);
    const v = await localDb.profiles.get(verifierId);
    if (c) {
      await emitNotification({
        event_type: 'case_submitted',
        audience: 'beneficiary',
        target_code: c.case_code,
        case_id: c.id,
        campaign_id: null,
        title_en: `Field Verifier Assigned (${c.case_code})`,
        title_ur: `فیلڈ ویریفائر تفویض کر دیا گیا (${c.case_code})`,
        body_en: `Admin approved your request for ground verification. Accredited Field Verifier ${v?.full_name ?? 'Local Volunteer'} (${c.district}) will contact you soon.`,
        body_ur: `ایڈمن نے آپ کی درخواست فیلڈ تصدیق کے لیے منظور کر لی ہے۔ مستند فیلڈ ویریفائر جلد آپ سے رابطہ کریں گے۔`,
        vendor_name: c.vendor_name,
        district: c.district,
      });
    }
  },

  async registerVerifierProfile(input: {
    full_name: string;
    email: string;
    district: string;
    tehsil: string;
    phone?: string;
  }): Promise<Profile> {
    await ensureLocalSeeded();
    if (supabase) {
      const { data: existingList } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'verifier')
        .ilike('full_name', input.full_name.trim())
        .limit(1);
      if (existingList && existingList.length > 0) {
        return existingList[0] as Profile;
      }
      const prof: Profile = {
        id: generateId('prof-ver'),
        full_name: input.full_name.trim(),
        phone: input.phone?.trim() || input.email,
        role: 'verifier',
        district: input.district,
        tehsil: input.tehsil,
        cnic_hash: `google:${input.email}`,
        is_accredited_verifier: false,
        verifier_badge_title: `Pending Admin Approval — ${input.district}`,
      };
      const { data, error } = await supabase.from('profiles').insert(prof).select().single();
      if (error) throw error;
      return data as Profile;
    }

    const existing = await localDb.profiles
      .filter(
        (p) => p.role === 'verifier' && p.full_name.toLowerCase() === input.full_name.toLowerCase()
      )
      .first();
    if (existing) return existing;

    const prof: Profile = {
      id: generateId('prof-ver'),
      full_name: input.full_name.trim(),
      phone: input.phone?.trim() || input.email,
      role: 'verifier',
      district: input.district,
      tehsil: input.tehsil,
      cnic_hash: `google:${input.email}`,
      is_accredited_verifier: false,
      verifier_badge_title: `Pending Admin Approval — ${input.district}`,
    };
    await localDb.profiles.put(prof);
    return prof;
  },

  async submitFieldVerification(input: CreateVerificationInput): Promise<FieldVerification> {
    await ensureLocalSeeded();
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
      verified_at: new Date().toISOString(),
      synced: !input.isOffline,
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
    await ensureLocalSeeded();
    if (supabase) {
      const { error } = await supabase.from('cases').update({ status: 'approved' }).eq('id', caseId);
      if (error) throw error;
      return;
    }
    await localDb.cases.update(caseId, { status: 'approved' });
  },

  async uploadCasePaidReceipt(caseId: string, receiptUrl: string): Promise<void> {
    await ensureLocalSeeded();
    if (supabase) {
      const { error } = await supabase
        .from('cases')
        .update({ disbursement_receipt_url: receiptUrl, status: 'disbursed_to_vendor' })
        .eq('id', caseId);
      if (error) throw error;
      return;
    }
    await localDb.cases.update(caseId, {
      disbursement_receipt_url: receiptUrl,
      status: 'disbursed_to_vendor',
    });
    const caseDonations = await localDb.donations.where('case_id').equals(caseId).toArray();
    for (const d of caseDonations) {
      if (d.status === 'confirmed') {
        await localDb.donations.update(d.id, { status: 'paid_to_vendor' });
      }
    }
  },

  async toggleVerifierAccreditation(profileId: string, accredited: boolean): Promise<void> {
    await ensureLocalSeeded();
    const badge = accredited ? 'Accredited Field Verifier — Punjab' : 'Pending Accreditation';
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ is_accredited_verifier: accredited, verifier_badge_title: badge })
        .eq('id', profileId);
      if (error) throw error;
      return;
    }
    await localDb.profiles.update(profileId, {
      is_accredited_verifier: accredited,
      verifier_badge_title: badge,
    });
  },

  async submitDonationPledge(input: CreateDonationInput): Promise<Donation> {
    await ensureLocalSeeded();
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
      status: 'pledged_pending_verify',
      receipt_qr_hash: generateReceiptHash(input.target_code),
      created_at: new Date().toISOString(),
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
          const newCollected = camp.collected_amount_pkr + don.amount_pkr;
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
        }
      } else if (don.case_id) {
        const { data: c } = await supabase.from('cases').select('*').eq('id', don.case_id).single();
        if (c) {
          const newRaised = c.raised_amount_pkr + don.amount_pkr;
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
};
