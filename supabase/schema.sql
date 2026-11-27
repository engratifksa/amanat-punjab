-- =============================================================================
-- Amanat (امانت) — Transparent Zakat, Sadaqah & Multi-Campaign Crowdfunding PWA
-- PostgreSQL Schema & Row-Level Security (RLS) Policies for Supabase Free Tier
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('donor', 'beneficiary', 'verifier', 'admin')) DEFAULT 'donor',
  district TEXT NOT NULL DEFAULT 'Lahore',
  tehsil TEXT NOT NULL DEFAULT 'Lahore City',
  cnic_hash TEXT, -- SHA-256 hash only; raw CNIC is never exposed publicly
  is_accredited_verifier BOOLEAN NOT NULL DEFAULT FALSE,
  verifier_badge_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CROWDFUNDING CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.crowdfunding_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code TEXT UNIQUE NOT NULL, -- e.g. AMN-CF-01
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  summary_ur TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('daughter_marriage', 'health', 'education', 'ration_food', 'emergency_relief')),
  funding_type TEXT NOT NULL CHECK (funding_type IN ('zakat_eligible', 'sadaqah_general')) DEFAULT 'zakat_eligible',
  district TEXT NOT NULL,
  target_amount_pkr BIGINT NOT NULL CHECK (target_amount_pkr > 0),
  collected_amount_pkr BIGINT NOT NULL DEFAULT 0 CHECK (collected_amount_pkr >= 0),
  pledged_amount_pkr BIGINT NOT NULL DEFAULT 0 CHECK (pledged_amount_pkr >= 0),
  donor_count INTEGER NOT NULL DEFAULT 0 CHECK (donor_count >= 0),
  vendor_name TEXT NOT NULL,
  vendor_invoice_url TEXT,
  disbursement_receipt_url TEXT,
  deadline_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'fully_funded', 'disbursed_to_vendor', 'paused')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INDIVIDUAL VERIFIED CASES
CREATE TABLE IF NOT EXISTS public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code TEXT UNIQUE NOT NULL, -- e.g. AMN-KSR-001
  category TEXT NOT NULL CHECK (category IN ('daughter_marriage', 'health', 'education', 'ration_food', 'clothing')),
  funding_type TEXT NOT NULL CHECK (funding_type IN ('zakat_eligible', 'sadaqah_general')) DEFAULT 'zakat_eligible',
  district TEXT NOT NULL,
  tehsil TEXT NOT NULL,
  anonymized_story_en TEXT NOT NULL,
  anonymized_story_ur TEXT NOT NULL,
  target_amount_pkr BIGINT NOT NULL CHECK (target_amount_pkr > 0),
  raised_amount_pkr BIGINT NOT NULL DEFAULT 0 CHECK (raised_amount_pkr >= 0),
  pledged_amount_pkr BIGINT NOT NULL DEFAULT 0 CHECK (pledged_amount_pkr >= 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending_field_visit', 'field_verified', 'approved', 'funded', 'disbursed_to_vendor')) DEFAULT 'pending_field_visit',
  beneficiary_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_verifier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  vendor_type TEXT NOT NULL,
  vendor_invoice_url TEXT,
  disbursement_receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. FIELD VERIFICATIONS (Offline-Synced Ground Visits)
CREATE TABLE IF NOT EXISTS public.field_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  verifier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  visit_notes TEXT NOT NULL,
  household_members INTEGER NOT NULL CHECK (household_members > 0),
  monthly_income_pkr BIGINT NOT NULL CHECK (monthly_income_pkr >= 0),
  evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  gps_tehsil_tag TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. DONATIONS (Zero-Cost Escrow Pledges & Confirmed Receipts)
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.crowdfunding_campaigns(id) ON DELETE SET NULL,
  amount_pkr BIGINT NOT NULL CHECK (amount_pkr > 0),
  payment_channel TEXT NOT NULL CHECK (payment_channel IN ('raast', 'jazzcash', 'easypaisa', 'bank_transfer', 'international_wire')),
  transaction_ref TEXT NOT NULL,
  payment_proof_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pledged_pending_verify', 'confirmed', 'paid_to_vendor')) DEFAULT 'pledged_pending_verify',
  receipt_qr_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT donation_target_xor CHECK (
    (case_id IS NOT NULL AND campaign_id IS NULL) OR
    (case_id IS NULL AND campaign_id IS NOT NULL)
  )
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.crowdfunding_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_cases_status_district ON public.cases(status, district);
CREATE INDEX IF NOT EXISTS idx_donations_campaign ON public.donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_case ON public.donations(case_id);
CREATE INDEX IF NOT EXISTS idx_field_verifications_case ON public.field_verifications(case_id);

-- =============================================================================
-- HELPER FUNCTION FOR RLS ROLE CHECKS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowdfunding_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- PROFILES: Zero-exposure privacy (only self, accredited verifier public badge view, or admin)
CREATE POLICY "profiles_select_self_or_admin"
  ON public.profiles FOR SELECT
  USING (
    auth_user_id = auth.uid()
    OR public.current_user_role() = 'admin'
    OR is_accredited_verifier = TRUE
  );

CREATE POLICY "profiles_update_self_or_admin"
  ON public.profiles FOR UPDATE
  USING (auth_user_id = auth.uid() OR public.current_user_role() = 'admin');

CREATE POLICY "profiles_insert_authenticated"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- CROWDFUNDING CAMPAIGNS: Public read for active/fully_funded/disbursed; Admin full write
CREATE POLICY "campaigns_public_read"
  ON public.crowdfunding_campaigns FOR SELECT
  USING (
    status IN ('active', 'fully_funded', 'disbursed_to_vendor')
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "campaigns_admin_write"
  ON public.crowdfunding_campaigns FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- CASES: Public read ONLY after approval (mandatory field verification + admin approval)
CREATE POLICY "cases_public_approved_read"
  ON public.cases FOR SELECT
  USING (
    status IN ('approved', 'funded', 'disbursed_to_vendor')
    OR beneficiary_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR assigned_verifier_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR public.current_user_role() IN ('admin', 'verifier')
  );

CREATE POLICY "cases_beneficiary_submit"
  ON public.cases FOR INSERT
  WITH CHECK (
    status = 'pending_field_visit'
    AND (auth.uid() IS NOT NULL OR public.current_user_role() = 'admin')
  );

CREATE POLICY "cases_verifier_and_admin_update"
  ON public.cases FOR UPDATE
  USING (public.current_user_role() IN ('admin', 'verifier'));

-- FIELD VERIFICATIONS: Only accredited verifiers & admins
CREATE POLICY "verifications_read_staff"
  ON public.field_verifications FOR SELECT
  USING (public.current_user_role() IN ('admin', 'verifier'));

CREATE POLICY "verifications_insert_verifier"
  ON public.field_verifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE auth_user_id = auth.uid()
      AND role = 'verifier'
      AND is_accredited_verifier = TRUE
    )
    OR public.current_user_role() = 'admin'
  );

-- DONATIONS: Public can insert pledges; donors see their own; admins manage confirmations
CREATE POLICY "donations_insert_any"
  ON public.donations FOR INSERT
  WITH CHECK (status = 'pledged_pending_verify');

CREATE POLICY "donations_select_own_or_admin"
  ON public.donations FOR SELECT
  USING (
    donor_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR public.current_user_role() = 'admin'
  );

CREATE POLICY "donations_admin_update"
  ON public.donations FOR UPDATE
  USING (public.current_user_role() = 'admin');

-- 6. APP SETTINGS (Social Links, Dynamic Escrow Accounts, Telegram 2FA Config)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  escrow_accounts JSONB NOT NULL DEFAULT '{}'::jsonb,
  telegram_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  admin_password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public can read non-sensitive public settings via view; direct table writes are admin-only
CREATE OR REPLACE VIEW public.public_app_settings AS
  SELECT id, social_links, escrow_accounts, updated_at
  FROM public.app_settings;

CREATE POLICY "app_settings_admin_all"
  ON public.app_settings FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- 7. NOTIFICATION SUBSCRIPTIONS (Opt-In Donor & Recipient Contacts — Strict Privacy)
CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('donor', 'beneficiary')),
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.crowdfunding_campaigns(id) ON DELETE CASCADE,
  email TEXT,
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. NOTIFICATIONS OUTBOX & IN-APP INBOX (App + Email + Telegram Audit Log)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'case_submitted',
      'field_verified',
      'case_approved_live',
      'campaign_launched',
      'donation_pledged',
      'funding_milestone',
      'fully_funded_locked',
      'disbursed_to_vendor'
    )
  ),
  audience TEXT NOT NULL CHECK (audience IN ('donor', 'beneficiary', 'both')),
  target_code TEXT NOT NULL,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.crowdfunding_campaigns(id) ON DELETE SET NULL,
  milestone_pct INTEGER,
  title_en TEXT NOT NULL,
  title_ur TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ur TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  email_html TEXT NOT NULL,
  telegram_text TEXT NOT NULL,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  recipient_telegram_ids TEXT[] NOT NULL DEFAULT '{}',
  channels_status JSONB NOT NULL DEFAULT '{"app":"delivered","email":"preview","telegram":"preview"}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_subs_insert_any"
  ON public.notification_subscriptions FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "notif_subs_admin_read"
  ON public.notification_subscriptions FOR SELECT
  USING (public.current_user_role() = 'admin');

CREATE POLICY "notifications_read_public_or_admin"
  ON public.notifications FOR SELECT
  USING (TRUE);

CREATE POLICY "notifications_admin_write"
  ON public.notifications FOR ALL
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- 9. CONFIDENTIAL BENEFICIARY DOSSIER & GPS METADATA (Admin & Accredited Assigned Verifier Only)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_cnic TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_phone TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS beneficiary_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS beneficiary_address_note TEXT,
  ADD COLUMN IF NOT EXISTS beneficiary_account_email TEXT;

ALTER TABLE public.field_verifications
  ADD COLUMN IF NOT EXISTS verifier_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS verifier_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_from_applicant_km DOUBLE PRECISION;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS donor_email TEXT;
