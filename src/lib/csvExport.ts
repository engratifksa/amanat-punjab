import type {
  AdminAuditLog,
  CrowdfundingCampaign,
  Donation,
  WelfareCase,
} from '@/types/amanat';

function csvCell(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsvFile(filename: string, headers: string[], rows: unknown[][]) {
  const bom = '\uFEFF'; // UTF-8 BOM so Urdu & English open cleanly in Excel
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((r) => r.map(csvCell).join(',')),
  ];
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSingleCampaignCsv(
  campaign: CrowdfundingCampaign,
  donations: Donation[]
) {
  const related = donations.filter((d) => d.campaign_id === campaign.id);
  const headers = [
    'Campaign Code',
    'Campaign Title',
    'District',
    'Funding Type',
    'Escrow Vendor',
    'Target PKR',
    'Confirmed Collected PKR',
    'Pending Pledged PKR',
    'Status',
    'Donation ID',
    'Donation Amount PKR',
    'Payment Channel',
    'Transaction Ref',
    'Donation Status',
    'Donor Email',
    'QR Receipt Hash',
    'Donation Date',
  ];

  const rows: unknown[][] =
    related.length > 0
      ? related.map((d) => [
          campaign.campaign_code,
          campaign.title_en,
          campaign.district,
          campaign.funding_type,
          campaign.vendor_name,
          campaign.target_amount_pkr,
          campaign.collected_amount_pkr,
          campaign.pledged_amount_pkr,
          campaign.status,
          d.id,
          d.amount_pkr,
          d.payment_channel,
          d.transaction_ref,
          d.status,
          d.donor_email ?? 'Anonymous',
          d.receipt_qr_hash,
          d.created_at,
        ])
      : [
          [
            campaign.campaign_code,
            campaign.title_en,
            campaign.district,
            campaign.funding_type,
            campaign.vendor_name,
            campaign.target_amount_pkr,
            campaign.collected_amount_pkr,
            campaign.pledged_amount_pkr,
            campaign.status,
            '',
            0,
            '',
            '',
            '',
            '',
            '',
            campaign.created_at,
          ],
        ];

  downloadCsvFile(`Amanat-Campaign-${campaign.campaign_code}.csv`, headers, rows);
}

export function exportAllCampaignsCsv(campaigns: CrowdfundingCampaign[]) {
  const headers = [
    'Campaign Code',
    'Title (EN)',
    'Title (UR)',
    'Category',
    'Funding Type',
    'District',
    'Target PKR',
    'Confirmed Collected PKR',
    'Pending Pledged PKR',
    'Donor Count',
    'Escrow Vendor',
    'Deadline',
    'Status',
    'Created At',
  ];
  const rows = campaigns.map((c) => [
    c.campaign_code,
    c.title_en,
    c.title_ur,
    c.category,
    c.funding_type,
    c.district,
    c.target_amount_pkr,
    c.collected_amount_pkr,
    c.pledged_amount_pkr,
    c.donor_count,
    c.vendor_name,
    c.deadline_date,
    c.status,
    c.created_at,
  ]);
  downloadCsvFile(`Amanat-All-Campaigns-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportFullAuditLedgerCsv(
  campaigns: CrowdfundingCampaign[],
  cases: WelfareCase[],
  donations: Donation[]
) {
  const headers = [
    'Donation ID',
    'Target Type',
    'Target Code',
    'Amount PKR',
    'Payment Channel',
    'Transaction Ref',
    'Status',
    'Donor Email',
    'QR Receipt Hash',
    'Created At',
  ];
  const rows = donations.map((d) => {
    const camp = d.campaign_id ? campaigns.find((c) => c.id === d.campaign_id) : null;
    const cs = d.case_id ? cases.find((c) => c.id === d.case_id) : null;
    return [
      d.id,
      camp ? 'Crowdfunding Campaign' : 'Individual Case',
      camp?.campaign_code ?? cs?.case_code ?? 'N/A',
      d.amount_pkr,
      d.payment_channel,
      d.transaction_ref,
      d.status,
      d.donor_email ?? 'Anonymous',
      d.receipt_qr_hash,
      d.created_at,
    ];
  });
  downloadCsvFile(`Amanat-Full-Audit-Ledger-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}

export function exportAuditLogsCsv(logs: AdminAuditLog[]) {
  const headers = ['Timestamp', 'Actor Name', 'Actor Role', 'Action', 'Target Code', 'Details'];
  const rows = logs.map((l) => [
    l.created_at,
    l.actor_name,
    l.actor_role,
    l.action,
    l.target_code,
    l.details,
  ]);
  downloadCsvFile(`Amanat-Admin-Audit-Trail-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
}
