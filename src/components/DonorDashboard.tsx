import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, CheckCircle2, Clock, ShieldCheck, LogOut, Heart } from 'lucide-react';
import type {
  AuthUserSession,
  CrowdfundingCampaign,
  Donation,
  WelfareCase,
} from '@/types/amanat';
import { formatPKR, getPublicAppUrl } from '@/lib/utils';
import { downloadAmanatCertificatePDF } from '@/lib/pdfReceipt';
import { Badge, Button, Card } from './ui/primitives';
import { DonorDigitalCard } from './DigitalCards';

interface DonorDashboardProps {
  user: AuthUserSession;
  donations: Donation[];
  campaigns: CrowdfundingCampaign[];
  cases: WelfareCase[];
  onSignOut: () => void;
  onExploreDrives: () => void;
}

export function DonorDashboard({
  user,
  donations,
  campaigns,
  cases,
  onSignOut,
  onExploreDrives,
}: DonorDashboardProps) {
  const qrRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const myDonations = donations.filter(
    (d) =>
      (d.donor_email && d.donor_email.toLowerCase() === user.email.toLowerCase()) ||
      d.donor_id === user.id
  );

  const totalGiven = myDonations.reduce((acc, d) => acc + d.amount_pkr, 0);
  const confirmedCount = myDonations.filter((d) => d.status !== 'pledged_pending_verify').length;

  const resolveTarget = (d: Donation) => {
    if (d.campaign_id) {
      const c = campaigns.find((x) => x.id === d.campaign_id);
      if (c) {
        return {
          type: 'campaign' as const,
          id: c.id,
          code: c.campaign_code,
          title_en: c.title_en,
          title_ur: c.title_ur,
          district: c.district,
          vendor_name: c.vendor_name,
          vendor_invoice_url: c.vendor_invoice_url,
          funding_type: c.funding_type,
          target_amount_pkr: c.target_amount_pkr,
          collected_amount_pkr: c.collected_amount_pkr,
          pledged_amount_pkr: c.pledged_amount_pkr,
          status: c.status,
        };
      }
    }
    const cs = cases.find((x) => x.id === d.case_id);
    return {
      type: 'case' as const,
      id: cs?.id ?? 'case',
      code: cs?.case_code ?? 'AMN-CASE',
      title_en: cs ? `${cs.case_code} — ${cs.district}` : 'Verified Welfare Case',
      title_ur: cs?.case_code ?? 'AMN-CASE',
      district: cs?.district ?? 'Punjab',
      vendor_name: cs?.vendor_name ?? 'Verified Escrow Vendor',
      vendor_invoice_url: cs?.vendor_invoice_url ?? '',
      funding_type: cs?.funding_type ?? ('zakat_eligible' as const),
      target_amount_pkr: cs?.target_amount_pkr ?? d.amount_pkr,
      collected_amount_pkr: cs?.raised_amount_pkr ?? d.amount_pkr,
      pledged_amount_pkr: cs?.pledged_amount_pkr ?? 0,
      status: cs?.status ?? 'approved',
    };
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <Card className="p-6 border-emerald-900/15 bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/40 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="emerald" className="mb-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Personal Donor Escrow Dashboard
            </Badge>
            <h2 className="text-xl font-extrabold text-emerald-950">
              Assalam-o-Alaikum, {user.full_name}
            </h2>
            <p className="text-xs text-slate-600">{user.email} · Track all your Zakat/Sadaqah escrow receipts</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="gold" size="sm" onClick={onExploreDrives}>
              <Heart className="h-3.5 w-3.5" />
              Explore Active Drives
            </Button>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>

        <DonorDigitalCard
          user={user}
          totalGivenPkr={totalGiven}
          donationCount={myDonations.length}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 border border-emerald-900/10">
            <p className="text-[11px] font-bold text-slate-500">My Total Contributions</p>
            <p className="mt-1 text-xl font-extrabold text-emerald-950">{formatPKR(totalGiven)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 border border-emerald-900/10">
            <p className="text-[11px] font-bold text-slate-500">Contributions Logged</p>
            <p className="mt-1 text-xl font-extrabold text-emerald-950">{myDonations.length}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 border border-emerald-900/10">
            <p className="text-[11px] font-bold text-slate-500">Confirmed / Paid to Vendor</p>
            <p className="mt-1 text-xl font-extrabold text-emerald-700">{confirmedCount}</p>
          </div>
        </div>

        {myDonations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-900/20 bg-white/70 p-5 text-center text-xs text-slate-600">
            Your signed-in contributions will appear here automatically with 1-click QR PDF Certificates &amp; live 5-Stage Escrow status.
          </div>
        ) : (
          <div className="space-y-2.5">
            {myDonations.map((d) => {
              const target = resolveTarget(d);
              return (
                <div
                  key={d.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-extrabold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                        {target.code}
                      </span>
                      <span className="font-extrabold text-emerald-950 text-sm">
                        {formatPKR(d.amount_pkr)}
                      </span>
                      <Badge variant={d.status === 'pledged_pending_verify' ? 'gold' : 'emerald'}>
                        {d.status === 'pledged_pending_verify' ? (
                          <>
                            <Clock className="h-3 w-3" /> Pending Verify
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> {d.status.replace(/_/g, ' ')}
                          </>
                        )}
                      </Badge>
                    </div>
                    <p className="text-slate-600">
                      Ref: <strong>{d.transaction_ref}</strong> · Vendor: {target.vendor_name}
                    </p>
                  </div>

                  <div
                    ref={(el) => {
                      qrRefs.current[d.id] = el;
                    }}
                    className="hidden"
                    aria-hidden="true"
                  >
                    <QRCodeCanvas
                      value={`${getPublicAppUrl()}/?verify=${d.receipt_qr_hash}&ref=${encodeURIComponent(d.transaction_ref)}&pkr=${d.amount_pkr}`}
                      size={180}
                      fgColor="#064E3B"
                      level="M"
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const canvas =
                        qrRefs.current[d.id]?.querySelector('canvas') ?? null;
                      downloadAmanatCertificatePDF(d, target, canvas);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF Certificate
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}
