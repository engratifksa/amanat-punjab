import { createPortal } from 'react-dom';
import { X, CheckCircle2, Clock, ShieldCheck, Building2, AlertTriangle } from 'lucide-react';
import type { CrowdfundingCampaign, Donation, WelfareCase } from '@/types/amanat';
import { formatPKR } from '@/lib/utils';
import { Badge, Button } from './ui/primitives';

interface ReceiptVerifyModalProps {
  qrHash: string | null;
  donations: Donation[];
  campaigns: CrowdfundingCampaign[];
  cases: WelfareCase[];
  onClose: () => void;
}

export function ReceiptVerifyModal({
  qrHash,
  donations,
  campaigns,
  cases,
  onClose,
}: ReceiptVerifyModalProps) {
  if (!qrHash) return null;

  const donation = donations.find(
    (d) => d.receipt_qr_hash.toLowerCase() === qrHash.trim().toLowerCase()
  );

  const campaign = donation?.campaign_id
    ? campaigns.find((c) => c.id === donation.campaign_id)
    : null;
  const welfareCase = donation?.case_id
    ? cases.find((c) => c.id === donation.case_id)
    : null;

  const targetCode = campaign?.campaign_code ?? welfareCase?.case_code ?? 'AMANAT';
  const targetTitle =
    campaign?.title_en ??
    (welfareCase ? `${welfareCase.case_code} — ${welfareCase.district}` : 'Verified Escrow');
  const vendorName = campaign?.vendor_name ?? welfareCase?.vendor_name ?? 'Verified Vendor';
  const paidReceipt =
    campaign?.disbursement_receipt_url ?? welfareCase?.disbursement_receipt_url ?? null;

  return createPortal(
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-emerald-950/75 p-3 sm:p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Live Escrow Receipt Verification"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-glass-lg border border-emerald-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 bg-emerald-950 px-5 py-4 text-white">
          <div>
            <Badge
              variant="gold"
              className="mb-1.5 bg-gold-500/20 text-gold-200 border-gold-400/35"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Live Amanat Escrow Ledger Verification
            </Badge>
            <h2 className="text-base font-extrabold">Certificate QR Verification</h2>
            <p className="font-mono text-xs text-emerald-200 mt-0.5">{qrHash}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Receipt Verification"
            className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {donation ? (
            <>
              <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="text-sm font-extrabold text-emerald-950">
                    Authentic Amanat Escrow Record Found
                  </p>
                  <p className="text-emerald-900">
                    Contribution of <strong>{formatPKR(donation.amount_pkr)}</strong> verified on
                    the live Amanat ledger.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-alabaster p-4 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Initiative:</span>
                  <span className="font-bold text-slate-900 text-end">
                    {targetCode} · {targetTitle}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Transaction Ref:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {donation.transaction_ref} ({donation.payment_channel.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between gap-2 items-center">
                  <span className="text-slate-500 font-semibold">Live Escrow Status:</span>
                  <Badge
                    variant={
                      donation.status === 'pledged_pending_verify' ? 'gold' : 'emerald'
                    }
                  >
                    {donation.status === 'pledged_pending_verify' ? (
                      <>
                        <Clock className="h-3 w-3" /> Pledged · Pending Board Audit
                      </>
                    ) : (
                      donation.status.replace(/_/g, ' ').toUpperCase()
                    )}
                  </Badge>
                </div>
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-emerald-700" /> Escrow Vendor:
                  </span>
                  <span className="font-bold text-emerald-950 text-end">{vendorName}</span>
                </div>
              </div>

              {paidReceipt && (
                <div className="space-y-1.5">
                  <p className="text-xs font-extrabold text-emerald-950">
                    Signed Paid Vendor Receipt
                  </p>
                  <img
                    src={paidReceipt}
                    alt="Paid Vendor Receipt"
                    className="w-full max-h-44 object-contain rounded-xl border border-emerald-200 bg-white"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-2.5 text-xs text-amber-950">
              <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">Certificate Not Found on Live Ledger</p>
                <p className="mt-1">
                  No escrow donation matches QR hash <code className="font-mono">{qrHash}</code>.
                  Please double-check the certificate link or contact{' '}
                  <strong>support@amanatpunjab.org</strong>.
                </p>
              </div>
            </div>
          )}

          <Button variant="primary" size="md" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
