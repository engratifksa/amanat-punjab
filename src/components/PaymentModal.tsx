import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import { QRCodeCanvas } from 'qrcode.react';
import {
  X,
  Copy,
  Check,
  FileText,
  Download,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Share2,
  Sparkles,
} from 'lucide-react';
import type {
  Donation,
  DonationTarget,
  EscrowAccounts,
  PaymentChannel,
} from '@/types/amanat';
import { ESCROW_PAYMENT_CHANNELS, makeInvoiceDataUrl } from '@/lib/seedData';
import { formatPKR, getPublicAppUrl, cn } from '@/lib/utils';
import { downloadAmanatCertificatePDF } from '@/lib/pdfReceipt';
import { Badge, Button, Input } from './ui/primitives';
import { SmartImageCapture } from './SmartImageCapture';
import { TelegramGuideModal } from './TelegramGuideModal';

interface PaymentModalProps {
  target: DonationTarget | null;
  language: 'en' | 'ur';
  escrowAccounts?: EscrowAccounts;
  defaultDonorEmail?: string;
  onClose: () => void;
  onShareTarget?: () => void;
  onSubmitPledge: (payload: {
    case_id: string | null;
    campaign_id: string | null;
    target_code: string;
    amount_pkr: number;
    payment_channel: PaymentChannel;
    transaction_ref: string;
    payment_proof_url: string | null;
    donor_email?: string;
    donor_telegram_id?: string;
  }) => Promise<Donation>;
  existingDonation?: Donation | null;
}

const CHANNELS: PaymentChannel[] = [
  'raast',
  'jazzcash',
  'easypaisa',
  'bank_transfer',
  'international_wire',
];

export function PaymentModal({
  target,
  language,
  escrowAccounts,
  defaultDonorEmail = '',
  onClose,
  onShareTarget,
  onSubmitPledge,
  existingDonation = null,
}: PaymentModalProps) {
  const activeAccounts = escrowAccounts ?? ESCROW_PAYMENT_CHANNELS;
  const { t } = useTranslation();
  const [channel, setChannel] = useState<PaymentChannel>('raast');
  const [amount, setAmount] = useState<string>('25000');
  const [txRef, setTxRef] = useState<string>('');
  const [donorEmail, setDonorEmail] = useState<string>(defaultDonorEmail);
  const [donorTelegramId, setDonorTelegramId] = useState<string>('');
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedDonation, setCompletedDonation] = useState<Donation | null>(
    existingDonation
  );
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultDonorEmail) setDonorEmail(defaultDonorEmail);
  }, [defaultDonorEmail]);

  if (!target) return null;

  const activeDonation = completedDonation;
  const remaining = Math.max(
    1000,
    target.target_amount_pkr - target.collected_amount_pkr
  );

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard?.writeText(val).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0 || !txRef.trim()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await onSubmitPledge({
        case_id: target.type === 'case' ? target.id : null,
        campaign_id: target.type === 'campaign' ? target.id : null,
        target_code: target.code,
        amount_pkr: numericAmount,
        payment_channel: channel,
        transaction_ref: txRef.trim(),
        payment_proof_url: proofUrl,
        donor_email: donorEmail.trim() || undefined,
        donor_telegram_id: donorTelegramId.trim() || undefined,
      });
      setCompletedDonation(created);
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#064E3B', '#10B981', '#F59E0B', '#FDE68A'],
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Could not record contribution. Please check your transaction reference and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!activeDonation) return;
    const canvas = qrWrapperRef.current?.querySelector('canvas') ?? null;
    downloadAmanatCertificatePDF(activeDonation, target, canvas);
  };

  const stageIndex = !activeDonation
    ? 2
    : activeDonation.status === 'paid_to_vendor'
    ? 5
    : activeDonation.status === 'confirmed'
    ? 4
    : 3;

  const trackerStages = [
    'Field Verified',
    'Board Audited',
    'Donor Pledge Logged',
    'Escrow Confirmed',
    'Paid to Vendor',
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative my-auto w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white shadow-glass-lg border border-emerald-900/15 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 bg-emerald-950 px-6 py-5 text-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-gold-300 bg-white/10 px-2 py-0.5 rounded">
                {target.code}
              </span>
              <Badge variant="gold" className="bg-gold-500/20 text-gold-200 border-gold-400/30">
                {t(`funding.${target.funding_type}`)}
              </Badge>
            </div>
            <h3 className="mt-2 text-lg font-extrabold">
              {language === 'ur' ? target.title_ur : target.title_en}
            </h3>
            <p className="text-xs text-emerald-100/80 flex items-center gap-1.5 mt-1">
              <Building2 className="h-3.5 w-3.5 text-gold-300" />
              {target.vendor_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto p-6 space-y-6">
          {!activeDonation ? (
            <>
              {/* Verified Vendor Pro-Forma Invoice Preview */}
              <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/40 p-4">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-emerald-700" />
                    {t('payment.proForma')}
                  </span>
                  <span className="text-slate-600">
                    Remaining: {formatPKR(remaining)}
                  </span>
                </div>
                <img
                  src={
                    target.vendor_invoice_url && target.vendor_invoice_url.trim().length > 0
                      ? target.vendor_invoice_url
                      : makeInvoiceDataUrl(
                          target.title_en,
                          target.vendor_name,
                          target.target_amount_pkr,
                          `INV-${target.code}`
                        )
                  }
                  alt={`Pro-forma invoice for ${target.vendor_name}`}
                  className="w-full max-h-44 object-contain rounded-xl border border-slate-200 bg-white"
                />
              </div>

              {/* 1-Tap Copy Payment Channels */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {t('payment.channelLabel')}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CHANNELS.map((ch) => {
                    const info = activeAccounts[ch];
                    const selected = channel === ch;
                    return (
                      <div
                        key={ch}
                        onClick={() => setChannel(ch)}
                        className={cn(
                          'cursor-pointer rounded-xl border p-3 transition-all',
                          selected
                            ? 'border-emerald-700 bg-emerald-50/80 ring-2 ring-emerald-600/20'
                            : 'border-slate-200 bg-white hover:border-emerald-300'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-emerald-950">
                            {info.label}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(ch, info.value);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-900/10 px-2 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-900/20"
                          >
                            {copiedKey === ch ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-700" />
                                {t('payment.copied')}
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                {t('payment.copy')}
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-0.5 text-[11px] font-semibold text-emerald-800">
                          {info.accountTitle}
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700 break-all">
                          {info.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pledge Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      {t('payment.amountLabel')}
                    </label>
                    <Input
                      type="number"
                      min={500}
                      step={500}
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="25000"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[5000, 15000, 25000, 50000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(String(preset))}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-emerald-100 hover:text-emerald-900"
                        >
                          {preset.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      {t('payment.refLabel')}
                    </label>
                    <Input
                      type="text"
                      required
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder="e.g. RAAST-9920418"
                    />
                  </div>
                </div>

                {/* Optional 3-Channel Milestone Notification Opt-In */}
                <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/40 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-extrabold text-emerald-950">
                      Receive 25% / 50% / 75% / 100% Milestone &amp; Paid Vendor Receipt Updates (Optional)
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowTelegramGuide(true)}
                      className="text-[11px] font-extrabold text-sky-700 hover:text-sky-900 underline"
                    >
                      How to get Telegram ID?
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Input
                      type="email"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      placeholder="Your Email (sent from notifications@amanatpunjab.org)"
                    />
                    <Input
                      type="text"
                      value={donorTelegramId}
                      onChange={(e) => setDonorTelegramId(e.target.value)}
                      placeholder="Telegram Chat ID (e.g. 987654321)"
                    />
                  </div>
                </div>

                <SmartImageCapture
                  label={t('payment.proofLabel')}
                  value={proofUrl}
                  onChange={(val) => {
                    setProofUrl(val);
                    setSubmitError(null);
                  }}
                  helperText="Take a photo of your transfer receipt or upload from gallery (auto-compressed, croppable & SHA-256 duplicate-checked)"
                />

                {submitError && (
                  <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-900 leading-relaxed">
                    {submitError}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  className="w-full"
                  disabled={submitting}
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span>{submitting ? 'Recording...' : t('payment.submit')}</span>
                </Button>
              </form>
            </>
          ) : (
            /* Post-Donation 5-Stage Fund Tracker & QR PDF Certificate */
            <div className="space-y-6">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-base font-extrabold text-emerald-950">
                    {t('payment.successTitle')}
                  </h4>
                  <p className="text-xs text-emerald-900/80 mt-0.5">
                    {t('payment.successSub')}
                  </p>
                </div>
              </div>

              {/* 5-Stage End-to-End Fund Tracker */}
              <div>
                <h5 className="mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  {t('payment.trackerTitle')}
                </h5>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                  {trackerStages.map((label, i) => {
                    const done = i < stageIndex;
                    const current = i === stageIndex - 1;
                    return (
                      <div
                        key={label}
                        className={cn(
                          'rounded-xl border p-2.5 text-center',
                          done
                            ? 'bg-emerald-900 text-white border-emerald-900'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        )}
                      >
                        <div className="mb-1 flex justify-center">
                          {done ? (
                            <CheckCircle2 className="h-4 w-4 text-gold-400" />
                          ) : (
                            <Clock className="h-4 w-4" />
                          )}
                        </div>
                        <p className="text-[11px] font-bold leading-tight">{label}</p>
                        {current && (
                          <span className="mt-1 inline-block rounded bg-gold-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR & Certificate Card */}
              <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-emerald-900/15 bg-alabaster p-5">
                <div
                  ref={qrWrapperRef}
                  className="rounded-2xl bg-white p-3 shadow-sm border border-slate-200 shrink-0"
                >
                  <QRCodeCanvas
                    value={`${getPublicAppUrl()}/?verify=${activeDonation.receipt_qr_hash}&ref=${encodeURIComponent(activeDonation.transaction_ref)}&pkr=${activeDonation.amount_pkr}`}
                    size={126}
                    fgColor="#064E3B"
                    level="M"
                  />
                </div>
                <div className="space-y-1.5 text-xs flex-1">
                  <p className="font-mono text-xs font-extrabold text-emerald-900">
                    QR HASH: {activeDonation.receipt_qr_hash}
                  </p>
                  <p className="text-slate-700">
                    <strong>Amount:</strong> {formatPKR(activeDonation.amount_pkr)}
                  </p>
                  <p className="text-slate-700">
                    <strong>Reference:</strong> {activeDonation.transaction_ref} (
                    {activeDonation.payment_channel.toUpperCase()})
                  </p>
                  <p className="text-slate-700">
                    <strong>Escrow Status:</strong>{' '}
                    <span className="font-bold text-gold-700">
                      {activeDonation.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </p>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <Button variant="primary" size="md" onClick={handleDownloadPdf}>
                      <Download className="h-4 w-4" />
                      <span>{t('payment.downloadCert')}</span>
                    </Button>
                    <Button variant="outline" size="md" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>

              {/* Post-Donation Multiply Your Reward (Sadaqah Jariyah) Share Prompt */}
              {onShareTarget && (
                <div className="rounded-2xl border border-gold-300 bg-gradient-to-r from-gold-50 via-amber-50/70 to-emerald-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-gold-600 shrink-0" />
                      JazakAllah Khair! Multiply Your Reward (Sadaqah Jariyah)
                    </p>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Share this verified drive on WhatsApp or Social Media with a ready-to-post
                      English &amp; Urdu message and poster so friends and family can also help.
                    </p>
                  </div>
                  <Button
                    variant="gold"
                    size="md"
                    type="button"
                    onClick={onShareTarget}
                    className="shrink-0"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>Share Drive</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <TelegramGuideModal
        isOpen={showTelegramGuide}
        onClose={() => setShowTelegramGuide(false)}
      />
    </div>
  );
}
