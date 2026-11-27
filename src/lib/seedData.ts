import type {
  Profile,
  CrowdfundingCampaign,
  WelfareCase,
  FieldVerification,
  Donation,
  AppSettings,
} from '@/types/amanat';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Pre-generated clean SVG data URIs for verified vendor pro-forma invoices & receipts
export function makeInvoiceDataUrl(
  title: string,
  vendor: string,
  amountPkr: number,
  refNo: string,
  paid = false
): string {
  const safeTitle = escapeXml(title);
  const safeVendor = escapeXml(vendor);
  const safeRef = escapeXml(refNo);
  const statusColor = paid ? '#059669' : '#D97706';
  const statusLabel = paid ? 'PAID TO VENDOR' : 'VERIFIED PRO-FORMA INVOICE';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="280" viewBox="0 0 520 280">
    <rect width="520" height="280" rx="16" fill="#F8FAF9" stroke="#CBD5E1" stroke-width="2"/>
    <rect width="520" height="58" rx="16" fill="#064E3B"/>
    <text x="24" y="36" fill="#FFFFFF" font-family="sans-serif" font-size="16" font-weight="700">AMANAT DIRECT VENDOR ESCROW</text>
    <rect x="315" y="16" width="185" height="26" rx="13" fill="${statusColor}"/>
    <text x="407" y="33" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="10" font-weight="700">${statusLabel}</text>
    <text x="24" y="92" fill="#64748B" font-family="sans-serif" font-size="11">NAMED ESCROW VENDOR</text>
    <text x="24" y="114" fill="#0F172A" font-family="sans-serif" font-size="16" font-weight="700">${safeVendor}</text>
    <text x="24" y="148" fill="#64748B" font-family="sans-serif" font-size="11">PURPOSE / SCOPE</text>
    <text x="24" y="170" fill="#1E293B" font-family="sans-serif" font-size="14">${safeTitle}</text>
    <line x1="24" y1="194" x2="496" y2="194" stroke="#E2E8F0" stroke-width="1.5"/>
    <text x="24" y="222" fill="#64748B" font-family="sans-serif" font-size="11">VERIFIED AMOUNT (PKR)</text>
    <text x="24" y="248" fill="#064E3B" font-family="sans-serif" font-size="22" font-weight="800">PKR ${amountPkr.toLocaleString()}</text>
    <text x="496" y="222" text-anchor="end" fill="#64748B" font-family="sans-serif" font-size="11">REFERENCE</text>
    <text x="496" y="246" text-anchor="end" fill="#334155" font-family="monospace" font-size="13" font-weight="700">${safeRef}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SEED_PROFILES: Profile[] = [
  {
    id: 'prof-ver-1',
    full_name: 'Haji Muhammad Tariq',
    phone: '+92-300-XXXX101',
    role: 'verifier',
    district: 'Kasur',
    tehsil: 'Chunian',
    cnic_hash: 'sha256:9f84a2c1e0',
    is_accredited_verifier: true,
    verifier_badge_title: 'Senior Accredited Field Verifier — Kasur',
  },
  {
    id: 'prof-ver-2',
    full_name: 'Dr. Amna Bibi',
    phone: '+92-321-XXXX204',
    role: 'verifier',
    district: 'Lahore',
    tehsil: 'Model Town',
    cnic_hash: 'sha256:4b12e8d9a3',
    is_accredited_verifier: true,
    verifier_badge_title: 'Medical & Welfare Field Verifier — Lahore',
  },
  {
    id: 'prof-ver-3',
    full_name: 'Ustad Bilal Ahmed',
    phone: '+92-333-XXXX318',
    role: 'verifier',
    district: 'Faisalabad',
    tehsil: 'Jaranwala',
    cnic_hash: 'sha256:7d31c4f6b2',
    is_accredited_verifier: true,
    verifier_badge_title: 'Community Accredited Verifier — Faisalabad',
  },
  {
    id: 'prof-ver-4',
    full_name: 'Sadia Noreen',
    phone: '+92-301-XXXX440',
    role: 'verifier',
    district: 'Multan',
    tehsil: 'Shujabad',
    cnic_hash: 'sha256:2e90a1b5c8',
    is_accredited_verifier: false,
    verifier_badge_title: 'Pending Accreditation — South Punjab',
  },
  {
    id: 'prof-ben-1',
    full_name: 'Applicant Household #104',
    phone: '+92-302-XXXX991',
    role: 'beneficiary',
    district: 'Kasur',
    tehsil: 'Pattoki',
    cnic_hash: 'sha256:aa10f92c11',
    is_accredited_verifier: false,
    verifier_badge_title: null,
  },
  {
    id: 'prof-adm-1',
    full_name: 'Amanat Shariah & Audit Board',
    phone: '+92-42-XXXX000',
    role: 'admin',
    district: 'Lahore',
    tehsil: 'Gulberg',
    cnic_hash: 'sha256:00admin001',
    is_accredited_verifier: true,
    verifier_badge_title: 'Verification Board Chair',
  },
];

export const SEED_CAMPAIGNS: CrowdfundingCampaign[] = [
  {
    id: 'camp-1',
    campaign_code: 'AMN-CF-01',
    title_en: 'Kasur 5-Daughters Collective Marriage Drive',
    title_ur: 'قصور 5 مستحق بیٹیوں کی اجتماعی شادی مہم',
    summary_en:
      'Dignified household essentials, nikah arrangements, and basic furniture for 5 orphan & daily-wage families in Kasur Tehsil — paid directly to verified furniture & textile vendors.',
    summary_ur:
      'تحصیل قصور کے 5 یتیم اور مزدور خاندانوں کی بیٹیوں کے لیے باوقار گھریلو سامان اور نکاح کے انتظامات — ادائیگی براہ راست تصدیق شدہ دکاندار کو۔',
    category: 'daughter_marriage',
    funding_type: 'zakat_eligible',
    district: 'Kasur',
    target_amount_pkr: 1250000,
    collected_amount_pkr: 875000,
    pledged_amount_pkr: 150000,
    donor_count: 34,
    vendor_name: 'Al-Madina Home Essentials & Furniture, Kasur',
    vendor_invoice_url: makeInvoiceDataUrl(
      '5x Complete Essential Bridal & Household Kits',
      'Al-Madina Home Essentials & Furniture, Kasur',
      1250000,
      'INV-KSR-2026-881'
    ),
    disbursement_receipt_url: null,
    deadline_date: '2026-12-28',
    status: 'active',
    created_at: '2026-11-05T09:00:00Z',
  },
  {
    id: 'camp-2',
    campaign_code: 'AMN-CF-02',
    title_en: 'Lahore Dialysis & Lifesaving Meds Pool',
    title_ur: 'لاہور ڈائیلاسز اور جان بچانے والی ادویات فنڈ',
    summary_en:
      'Monthly hemodialysis sessions, EPO injections, and lab diagnostics for 18 kidney patients from low-income neighborhoods in Lahore — settled strictly via hospital pharmacy invoices.',
    summary_ur:
      'لاہور کے کم آمدنی والے 18 گردوں کے مریضوں کے لیے ماہانہ ڈائیلاسز سیشنز اور ادویات — تمام ادائیگیاں براہ راست ہسپتال فارمیسی کو۔',
    category: 'health',
    funding_type: 'zakat_eligible',
    district: 'Lahore',
    target_amount_pkr: 900000,
    collected_amount_pkr: 640000,
    pledged_amount_pkr: 95000,
    donor_count: 47,
    vendor_name: 'Services Hospital Charity Dialysis & Pharmacy Desk',
    vendor_invoice_url: makeInvoiceDataUrl(
      '180 Dialysis Sessions + Renal Meds Batch',
      'Services Hospital Charity Dialysis & Pharmacy Desk',
      900000,
      'INV-LHR-2026-412'
    ),
    disbursement_receipt_url: null,
    deadline_date: '2026-12-19',
    status: 'active',
    created_at: '2026-11-08T11:30:00Z',
  },
  {
    id: 'camp-3',
    campaign_code: 'AMN-CF-03',
    title_en: 'Faisalabad 100-Widow Monthly Ration Drive',
    title_ur: 'فیصل آباد 100 بیوہ خاندانوں کی ماہانہ راشن مہم',
    summary_en:
      'Nutritious 1-month staple ration packs (flour, lentils, cooking oil, tea, sugar, milk) for 100 field-verified widow-headed households across Faisalabad and Jaranwala.',
    summary_ur:
      'فیصل آباد اور جڑانوالہ کے 100 تصدیق شدہ بیوہ خاندانوں کے لیے ایک ماہ کا مکمل راشن پیک — ادائیگی براہ راست ہول سیل غلہ منڈی کو۔',
    category: 'ration_food',
    funding_type: 'zakat_eligible',
    district: 'Faisalabad',
    target_amount_pkr: 750000,
    collected_amount_pkr: 750000,
    pledged_amount_pkr: 0,
    donor_count: 62,
    vendor_name: 'Lyallpur Wholesale Grain & Ration Depot',
    vendor_invoice_url: makeInvoiceDataUrl(
      '100x Monthly Staple Family Ration Packs',
      'Lyallpur Wholesale Grain & Ration Depot',
      750000,
      'INV-FSD-2026-309'
    ),
    disbursement_receipt_url: makeInvoiceDataUrl(
      '100x Ration Packs Dispatched & Signed',
      'Lyallpur Wholesale Grain & Ration Depot',
      750000,
      'RCPT-FSD-2026-309',
      true
    ),
    deadline_date: '2026-12-12',
    status: 'fully_funded',
    created_at: '2026-11-01T08:15:00Z',
  },
];

export const SEED_CASES: WelfareCase[] = [
  {
    id: 'case-1',
    case_code: 'AMN-KSR-001',
    category: 'daughter_marriage',
    funding_type: 'zakat_eligible',
    district: 'Kasur',
    tehsil: 'Chunian',
    anonymized_story_en:
      'Widowed mother of 4 children seeks dignified nikah essentials for her eldest daughter. Ground visit confirmed zero savings and single daily-wage earner in household.',
    anonymized_story_ur:
      'چار بچوں کی بیوہ والدہ کو اپنی بڑی بیٹی کی باوقار رخصتی کے لیے ضروری گھریلو سامان کی ضرورت ہے۔ فیلڈ وزٹ میں مستحق ہونے کی مکمل تصدیق ہو چکی ہے۔',
    target_amount_pkr: 240000,
    raised_amount_pkr: 165000,
    pledged_amount_pkr: 25000,
    status: 'approved',
    beneficiary_id: 'prof-ben-1',
    assigned_verifier_id: 'prof-ver-1',
    vendor_name: 'Rehman Furniture & Crockery Mart, Chunian',
    vendor_type: 'Wedding Essentials Vendor',
    vendor_invoice_url: makeInvoiceDataUrl(
      'Essential Household & Bridal Kit (AMN-KSR-001)',
      'Rehman Furniture & Crockery Mart, Chunian',
      240000,
      'INV-KSR-001'
    ),
    disbursement_receipt_url: null,
    created_at: '2026-11-10T10:00:00Z',
  },
  {
    id: 'case-2',
    case_code: 'AMN-LHR-014',
    category: 'health',
    funding_type: 'zakat_eligible',
    district: 'Lahore',
    tehsil: 'Shalimar',
    anonymized_story_en:
      'Rickshaw driver requires urgent cataract & retinal surgery to restore eyesight and resume supporting his 3 school-going children. Hospital pro-forma verified.',
    anonymized_story_ur:
      'رکشہ ڈرائیور کو بینائی بچانے کے لیے فوری آنکھوں کے آپریشن کی ضرورت ہے تاکہ وہ اپنے تین بچوں کی کفالت جاری رکھ سکیں۔ ہسپتال کا بل تصدیق شدہ ہے۔',
    target_amount_pkr: 135000,
    raised_amount_pkr: 95000,
    pledged_amount_pkr: 15000,
    status: 'approved',
    beneficiary_id: null,
    assigned_verifier_id: 'prof-ver-2',
    vendor_name: 'Al-Shifa Trust Eye Hospital, Lahore',
    vendor_type: 'Hospital',
    vendor_invoice_url: makeInvoiceDataUrl(
      'Bilateral Cataract & Retinal Procedure',
      'Al-Shifa Trust Eye Hospital, Lahore',
      135000,
      'INV-LHR-014'
    ),
    disbursement_receipt_url: null,
    created_at: '2026-11-11T14:20:00Z',
  },
  {
    id: 'case-3',
    case_code: 'AMN-FSD-008',
    category: 'education',
    funding_type: 'sadaqah_general',
    district: 'Faisalabad',
    tehsil: 'Jaranwala',
    anonymized_story_en:
      'Merit-holding BS Computer Science student from a textile-worker family needs two semesters of tuition and exam fees paid directly to the university accounts office.',
    anonymized_story_ur:
      'ٹیکسٹائل مزدور کے ہونہار طالبعلم کو بی ایس کمپیوٹر سائنس کے دو سمسٹر کی فیس کے لیے تعاون درکار ہے۔ فیس براہ راست یونیورسٹی اکاؤنٹ میں جمع ہوگی۔',
    target_amount_pkr: 92000,
    raised_amount_pkr: 58000,
    pledged_amount_pkr: 12000,
    status: 'approved',
    beneficiary_id: null,
    assigned_verifier_id: 'prof-ver-3',
    vendor_name: 'GC University Faisalabad — Fee Challan Desk',
    vendor_type: 'University / School',
    vendor_invoice_url: makeInvoiceDataUrl(
      'Semester 5 & 6 Official Tuition Challan',
      'GC University Faisalabad — Fee Challan Desk',
      92000,
      'INV-FSD-008'
    ),
    disbursement_receipt_url: null,
    created_at: '2026-11-12T09:45:00Z',
  },
  {
    id: 'case-4',
    case_code: 'AMN-MLT-019',
    category: 'ration_food',
    funding_type: 'zakat_eligible',
    district: 'Multan',
    tehsil: 'Shujabad',
    anonymized_story_en:
      'Elderly couple caring for two orphaned grandchildren needs 6 months of verified grocery credit at a neighborhood wholesale karyana store.',
    anonymized_story_ur:
      'دو یتیم پوتوں کی کفالت کرنے والے بزرگ جوڑے کو 6 ماہ کے بنیادی راشن کے لیے تعاون درکار ہے جو مقامی کریانہ اسٹور سے فراہم کیا جائے گا۔',
    target_amount_pkr: 66000,
    raised_amount_pkr: 44000,
    pledged_amount_pkr: 5000,
    status: 'approved',
    beneficiary_id: null,
    assigned_verifier_id: 'prof-ver-1',
    vendor_name: 'Bismillah Wholesale Karyana Store, Shujabad',
    vendor_type: 'Ration Store',
    vendor_invoice_url: makeInvoiceDataUrl(
      '6-Month Staple Ration Voucher Credit',
      'Bismillah Wholesale Karyana Store, Shujabad',
      66000,
      'INV-MLT-019'
    ),
    disbursement_receipt_url: null,
    created_at: '2026-11-13T16:10:00Z',
  },
  {
    id: 'case-5',
    case_code: 'AMN-RWP-022',
    category: 'clothing',
    funding_type: 'sadaqah_general',
    district: 'Rawalpindi',
    tehsil: 'Murree',
    anonymized_story_en:
      'Winter coats, warm bedding, and school sweaters for 9 children across two mountain-village daily-wage households ahead of peak December snowfall.',
    anonymized_story_ur:
      'دسمبر کی شدید سردی سے پہلے پہاڑی علاقے کے دو مزدور خاندانوں کے 9 بچوں کے لیے گرم کپڑے، بستر اور اسکول سوئٹرز۔',
    target_amount_pkr: 54000,
    raised_amount_pkr: 54000,
    pledged_amount_pkr: 0,
    status: 'disbursed_to_vendor',
    beneficiary_id: null,
    assigned_verifier_id: 'prof-ver-2',
    vendor_name: 'Pothohar Woollens & Winter Garments, Rawalpindi',
    vendor_type: 'Clothing Vendor',
    vendor_invoice_url: makeInvoiceDataUrl(
      'Winter Garments & Bedding Bundle (9 Children)',
      'Pothohar Woollens & Winter Garments, Rawalpindi',
      54000,
      'INV-RWP-022'
    ),
    disbursement_receipt_url: makeInvoiceDataUrl(
      'Paid Receipt — Winter Clothing Delivered',
      'Pothohar Woollens & Winter Garments, Rawalpindi',
      54000,
      'RCPT-RWP-022',
      true
    ),
    created_at: '2026-11-02T07:30:00Z',
  },
  {
    id: 'case-6',
    case_code: 'AMN-BWP-005',
    category: 'health',
    funding_type: 'zakat_eligible',
    district: 'Bahawalpur',
    tehsil: 'Ahmadpur East',
    anonymized_story_en:
      '6-year-old thalassemia patient requires 12 months of iron-chelation medicine and safe blood-transfusion filters supplied directly via accredited pharmacy.',
    anonymized_story_ur:
      'تھیلیسیمیا کے شکار 6 سالہ بچے کے لیے 12 ماہ کی ادویات اور فلٹرز جو براہ راست تصدیق شدہ فارمیسی سے فراہم کیے جائیں گے۔',
    target_amount_pkr: 118000,
    raised_amount_pkr: 72000,
    pledged_amount_pkr: 10000,
    status: 'approved',
    beneficiary_id: null,
    assigned_verifier_id: 'prof-ver-3',
    vendor_name: 'Victoria Hospital Accredited Pharmacy, Bahawalpur',
    vendor_type: 'Pharmacy',
    vendor_invoice_url: makeInvoiceDataUrl(
      '12-Month Thalassemia Chelation & Filter Pack',
      'Victoria Hospital Accredited Pharmacy, Bahawalpur',
      118000,
      'INV-BWP-005'
    ),
    disbursement_receipt_url: null,
    created_at: '2026-11-15T12:00:00Z',
  },
  {
    id: 'case-7',
    case_code: 'AMN-SKP-011',
    category: 'education',
    funding_type: 'zakat_eligible',
    district: 'Sheikhupura',
    tehsil: 'Muridke',
    anonymized_story_en:
      'Orphaned siblings in grades 8 and 10 need annual school fees, textbooks, and uniforms. Awaiting final field verifier visit and admin approval.',
    anonymized_story_ur:
      'آٹھویں اور دسویں جماعت کے دو یتیم بہن بھائیوں کی سالانہ اسکول فیس اور کتابیں۔ فیلڈ ویریفیکیشن جاری ہے۔',
    target_amount_pkr: 48000,
    raised_amount_pkr: 0,
    pledged_amount_pkr: 0,
    status: 'pending_field_visit',
    beneficiary_id: 'prof-ben-1',
    assigned_verifier_id: 'prof-ver-1',
    vendor_name: 'Allied Public High School, Muridke',
    vendor_type: 'School',
    vendor_invoice_url: makeInvoiceDataUrl(
      'Annual School Fee & Books Challan',
      'Allied Public High School, Muridke',
      48000,
      'INV-SKP-011'
    ),
    disbursement_receipt_url: null,
    created_at: '2026-11-24T08:00:00Z',
  },
  {
    id: 'case-8',
    case_code: 'AMN-GUJ-009',
    category: 'ration_food',
    funding_type: 'zakat_eligible',
    district: 'Gujranwala',
    tehsil: 'Wazirabad',
    anonymized_story_en:
      'Field visit completed for a paralyzed factory worker household of 6. Ready for Verification Board approval and public listing.',
    anonymized_story_ur:
      'فالج کے شکار مزدور کے 6 افراد کے خاندان کا فیلڈ وزٹ مکمل ہو چکا ہے۔ بورڈ کی منظوری کے بعد پبلک لسٹ میں شامل کیا جائے گا۔',
    target_amount_pkr: 72000,
    raised_amount_pkr: 0,
    pledged_amount_pkr: 0,
    status: 'field_verified',
    beneficiary_id: null,
    assigned_verifier_id: 'prof-ver-3',
    vendor_name: 'Chenab Wholesale Ration Store, Wazirabad',
    vendor_type: 'Ration Store',
    vendor_invoice_url: makeInvoiceDataUrl(
      '6-Month Family Ration Estimate',
      'Chenab Wholesale Ration Store, Wazirabad',
      72000,
      'INV-GUJ-009'
    ),
    disbursement_receipt_url: null,
    created_at: '2026-11-25T13:10:00Z',
  },
];

export const SEED_VERIFICATIONS: FieldVerification[] = [
  {
    id: 'ver-1',
    case_id: 'case-1',
    verifier_id: 'prof-ver-1',
    visit_notes:
      'Visited home in Chunian. Verified widowed mother status, 4 dependents, rent-only mud-brick room, and matched vendor furniture quotation.',
    household_members: 5,
    monthly_income_pkr: 19000,
    evidence_urls: [
      makeInvoiceDataUrl(
        'Field Inspection & Vendor Quote Matched',
        'Rehman Furniture & Crockery Mart, Chunian',
        240000,
        'FV-KSR-001'
      ),
    ],
    gps_tehsil_tag: 'Kasur / Chunian (30.96°N, 73.98°E)',
    verified_at: '2026-11-10T15:30:00Z',
    synced: true,
  },
  {
    id: 'ver-2',
    case_id: 'case-8',
    verifier_id: 'prof-ver-3',
    visit_notes:
      'Home visit in Wazirabad confirmed medical discharge papers for paralysis, zero monthly income, and verified karyana store quotation.',
    household_members: 6,
    monthly_income_pkr: 8500,
    evidence_urls: [
      makeInvoiceDataUrl(
        'Field Inspection Report — Wazirabad',
        'Chenab Wholesale Ration Store, Wazirabad',
        72000,
        'FV-GUJ-009'
      ),
    ],
    gps_tehsil_tag: 'Gujranwala / Wazirabad (32.44°N, 74.12°E)',
    verified_at: '2026-11-25T16:40:00Z',
    synced: true,
  },
];

export const SEED_DONATIONS: Donation[] = [
  {
    id: 'don-1',
    donor_id: null,
    case_id: null,
    campaign_id: 'camp-1',
    amount_pkr: 150000,
    payment_channel: 'raast',
    transaction_ref: 'RAAST-88412990',
    payment_proof_url: null,
    status: 'pledged_pending_verify',
    receipt_qr_hash: 'AMN-QR-CF01-88412',
    created_at: '2026-11-26T09:15:00Z',
  },
  {
    id: 'don-2',
    donor_id: null,
    case_id: 'case-1',
    campaign_id: null,
    amount_pkr: 25000,
    payment_channel: 'jazzcash',
    transaction_ref: 'JC-77120451',
    payment_proof_url: null,
    status: 'pledged_pending_verify',
    receipt_qr_hash: 'AMN-QR-KSR1-77120',
    created_at: '2026-11-26T14:20:00Z',
  },
  {
    id: 'don-3',
    donor_id: null,
    case_id: 'case-5',
    campaign_id: null,
    amount_pkr: 54000,
    payment_channel: 'bank_transfer',
    transaction_ref: 'MEEZAN-3310984',
    payment_proof_url: null,
    status: 'paid_to_vendor',
    receipt_qr_hash: 'AMN-QR-RWP22-33109',
    created_at: '2026-11-04T11:00:00Z',
  },
];

export const PUNJAB_DISTRICTS: Record<string, string[]> = {
  Lahore: ['Lahore City', 'Model Town', 'Shalimar', 'Raiwind', 'Cantt'],
  Kasur: ['Kasur', 'Chunian', 'Pattoki', 'Kot Radha Kishan'],
  Faisalabad: ['Faisalabad City', 'Jaranwala', 'Samundri', 'Tandlianwala'],
  Multan: ['Multan City', 'Shujabad', 'Jalalpur Pirwala'],
  Rawalpindi: ['Rawalpindi', 'Murree', 'Taxila', 'Gujar Khan'],
  Bahawalpur: ['Bahawalpur', 'Ahmadpur East', 'Hasilpur', 'Yazman'],
  Gujranwala: ['Gujranwala', 'Wazirabad', 'Kamoke', 'Nowshera Virkan'],
  Sheikhupura: ['Sheikhupura', 'Muridke', 'Ferozewala', 'Safdarabad'],
  Sialkot: ['Sialkot', 'Daska', 'Pasrur', 'Sambrial'],
};

export const ESCROW_PAYMENT_CHANNELS = {
  raast: {
    label: 'Raast Instant ID (0% Fee)',
    accountTitle: 'Amanat Direct Escrow Trust',
    value: '03001234567',
  },
  jazzcash: {
    label: 'JazzCash Merchant Escrow',
    accountTitle: 'Amanat Welfare Escrow',
    value: '0301-8899412',
  },
  easypaisa: {
    label: 'EasyPaisa Direct Escrow',
    accountTitle: 'Amanat Welfare Escrow',
    value: '0345-8899412',
  },
  bank_transfer: {
    label: 'Meezan Bank (Islamic Escrow)',
    accountTitle: 'Amanat Direct Vendor Escrow',
    value: 'PK36MEZN0002140104829104',
  },
  international_wire: {
    label: 'Overseas SWIFT / Roshan Digital',
    accountTitle: 'Amanat Direct Vendor Escrow',
    value: 'SWIFT: MEZNPKKA · PK36MEZN0002140104829104',
  },
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'global',
  social_links: {
    tiktok: 'https://tiktok.com/@amanatpunjab',
    facebook: 'https://facebook.com/amanatpunjab',
    x: 'https://x.com/amanatpunjab',
    youtube: 'https://youtube.com/@amanatpunjab',
    whatsapp: 'https://wa.me/923001234567',
    email: 'support.amanat@gmail.com',
    telegram: 'https://t.me/amanatpunjab',
  },
  escrow_accounts: ESCROW_PAYMENT_CHANNELS,
  telegram_config: {
    botToken: '',
    chatId: '',
    requireRealTelegramOtp: false,
  },
  email_gateway: {
    senderEmail: 'support.amanat@gmail.com',
    senderName: 'Amanat — Sacred Trust (امانت)',
    gmailAppPasswordConfigured: false,
    edgeFunctionUrl: '',
  },
  admin_password_hash: '', // Populated on first seed via SHA-256 of DEFAULT_INITIAL_PASSWORD
  updated_at: '2026-11-27T08:00:00Z',
};
