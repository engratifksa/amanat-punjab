export type UserRole = 'donor' | 'beneficiary' | 'verifier' | 'admin';

export type AppDataMode = 'real' | 'training';

export type CampaignCategory =
  | 'daughter_marriage'
  | 'health'
  | 'education'
  | 'ration_food'
  | 'emergency_relief';

export type CaseCategory =
  | 'daughter_marriage'
  | 'health'
  | 'education'
  | 'ration_food'
  | 'clothing';

export type FundingType = 'zakat_eligible' | 'sadaqah_general';

export type CampaignStatus =
  | 'draft'
  | 'active'
  | 'fully_funded'
  | 'disbursed_to_vendor'
  | 'paused';

export type CaseStatus =
  | 'draft'
  | 'pending_admin_review'
  | 'pending_field_visit'
  | 'field_verified'
  | 'approved'
  | 'funded'
  | 'disbursed_to_vendor'
  | 'rejected';

export type PaymentChannel =
  | 'raast'
  | 'jazzcash'
  | 'easypaisa'
  | 'bank_transfer'
  | 'international_wire';

export type DonationStatus =
  | 'pledged_pending_verify'
  | 'confirmed'
  | 'paid_to_vendor'
  | 'rejected';

export interface Profile {
  id: string;
  auth_user_id?: string | null;
  email?: string | null;
  full_name: string;
  phone: string;
  role: UserRole;
  district: string;
  tehsil: string;
  cnic_hash: string;
  is_accredited_verifier: boolean;
  verifier_applied?: boolean;
  verifier_badge_title: string | null;
  verifier_qr_secret?: string | null;
  photo_url?: string | null;
  cnic_number?: string | null;
  is_demo?: boolean;
}

export interface CrowdfundingCampaign {
  id: string;
  campaign_code: string;
  title_en: string;
  title_ur: string;
  summary_en: string;
  summary_ur: string;
  category: CampaignCategory;
  funding_type: FundingType;
  district: string;
  target_amount_pkr: number;
  collected_amount_pkr: number;
  pledged_amount_pkr: number;
  donor_count: number;
  vendor_name: string;
  vendor_invoice_url: string;
  disbursement_receipt_url: string | null;
  deadline_date: string;
  status: CampaignStatus;
  created_at: string;
  is_demo?: boolean;
}

export interface WelfareCase {
  id: string;
  case_code: string;
  category: CaseCategory;
  funding_type: FundingType;
  district: string;
  tehsil: string;
  anonymized_story_en: string;
  anonymized_story_ur: string;
  target_amount_pkr: number;
  raised_amount_pkr: number;
  pledged_amount_pkr: number;
  status: CaseStatus;
  beneficiary_id: string | null;
  assigned_verifier_id: string | null;
  vendor_name: string;
  vendor_type: string;
  vendor_invoice_url: string;
  disbursement_receipt_url: string | null;
  created_at: string;
  // Strictly Confidential — NEVER shown on public donor cards; visible only to Admin & Approved Assigned Field Verifier
  beneficiary_name?: string;
  beneficiary_cnic?: string;
  beneficiary_phone?: string;
  beneficiary_lat?: number | null;
  beneficiary_lng?: number | null;
  beneficiary_address_note?: string;
  beneficiary_account_email?: string;
  rejection_reason?: string | null;
  visit_handshake_pin?: string | null;
  prior_application_count?: number;
  prior_served_pkr?: number;
  prior_case_codes?: string | null;
  is_demo?: boolean;
}

export interface FieldVerification {
  id: string;
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
  verified_at: string;
  synced?: boolean;
  handshake_pin_verified?: boolean;
  is_demo?: boolean;
}

export interface Donation {
  id: string;
  donor_id: string | null;
  donor_email?: string | null;
  case_id: string | null;
  campaign_id: string | null;
  amount_pkr: number;
  payment_channel: PaymentChannel;
  transaction_ref: string;
  payment_proof_url: string | null;
  status: DonationStatus;
  receipt_qr_hash: string;
  created_at: string;
  donor_note?: string;
  rejection_reason?: string | null;
  payment_proof_hash?: string | null;
  normalized_tx_ref?: string | null;
  is_demo?: boolean;
}

export interface AuthUserSession {
  id: string;
  email: string;
  full_name: string;
  role: 'donor' | 'beneficiary' | 'verifier';
  provider: 'google' | 'email';
  district: string;
  tehsil: string;
  profile_id?: string;
}

export interface DonationTarget {
  type: 'campaign' | 'case';
  id: string;
  code: string;
  title_en: string;
  title_ur: string;
  district: string;
  vendor_name: string;
  vendor_invoice_url: string;
  funding_type: FundingType;
  target_amount_pkr: number;
  collected_amount_pkr: number;
  pledged_amount_pkr: number;
  status: string;
}

export interface SocialLinks {
  tiktok: string;
  facebook: string;
  x: string;
  youtube: string;
  whatsapp: string;
  email: string;
  telegram: string;
}

export interface EscrowAccountEntry {
  label: string;
  accountTitle: string;
  value: string;
}

export interface EscrowAccounts {
  raast: EscrowAccountEntry;
  jazzcash: EscrowAccountEntry;
  easypaisa: EscrowAccountEntry;
  bank_transfer: EscrowAccountEntry;
  international_wire: EscrowAccountEntry;
}

export interface TelegramSecurityConfig {
  botToken: string;
  chatId: string;
  requireRealTelegramOtp: boolean;
}

export interface EmailGatewayConfig {
  senderEmail: string;
  senderName: string;
  gmailAppPasswordConfigured: boolean;
  edgeFunctionUrl: string;
}

export interface AppSettings {
  id: 'global';
  app_mode?: AppDataMode;
  social_links: SocialLinks;
  escrow_accounts: EscrowAccounts;
  telegram_config: TelegramSecurityConfig;
  email_gateway?: EmailGatewayConfig;
  admin_password_hash: string;
  updated_at: string;
}

export type NotificationEventType =
  | 'case_submitted'
  | 'field_verified'
  | 'case_approved_live'
  | 'campaign_launched'
  | 'donation_pledged'
  | 'funding_milestone'
  | 'fully_funded_locked'
  | 'disbursed_to_vendor';

export type NotificationAudience = 'donor' | 'beneficiary' | 'both';

export type ChannelDeliveryState = 'delivered' | 'queued' | 'preview' | 'failed';

export interface NotificationSubscription {
  id: string;
  role: 'donor' | 'beneficiary';
  case_id: string | null;
  campaign_id: string | null;
  email: string | null;
  telegram_chat_id: string | null;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  event_type: NotificationEventType;
  audience: NotificationAudience;
  target_code: string;
  case_id: string | null;
  campaign_id: string | null;
  milestone_pct: number | null;
  title_en: string;
  title_ur: string;
  body_en: string;
  body_ur: string;
  email_subject: string;
  email_html: string;
  telegram_text: string;
  recipient_emails: string[];
  recipient_telegram_ids: string[];
  channels_status: {
    app: ChannelDeliveryState;
    email: ChannelDeliveryState;
    telegram: ChannelDeliveryState;
  };
  read: boolean;
  created_at: string;
}
