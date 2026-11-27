import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ShieldCheck, Download, RefreshCw, AlertOctagon, Award, HeartHandshake } from 'lucide-react';
import type { AuthUserSession, Profile, WelfareCase } from '@/types/amanat';
import {
  QR_STEP_SECONDS,
  generateDynamicVerifierToken,
  getSecondsRemainingInWindow,
} from '@/lib/dynamicQr';
import { formatPKR } from '@/lib/utils';
import { AmanatLogo } from './AmanatLogo';
import { Badge, Button } from './ui/primitives';

/** 1. Anti-Scam Dynamic Time-Based Field Verifier Digital ID Card (Refreshes every 60s) */
export function VerifierDynamicIdCard({ verifier }: { verifier: Profile }) {
  const [qrPayload, setQrPayload] = useState<string>('');
  const [sixDigitCode, setSixDigitCode] = useState<string>('------');
  const [secondsLeft, setSecondsLeft] = useState<number>(getSecondsRemainingInWindow());

  useEffect(() => {
    let active = true;
    const secret = verifier.verifier_qr_secret || `fallback-secret-${verifier.id}`;

    const refresh = async () => {
      const rem = getSecondsRemainingInWindow();
      const token = await generateDynamicVerifierToken(verifier.id, secret);
      if (!active) return;
      setSecondsLeft(rem);
      setQrPayload(token.qrPayload);
      setSixDigitCode(token.sixDigitCode);
    };

    refresh();
    const timer = setInterval(refresh, 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [verifier.id, verifier.verifier_qr_secret]);

  const progressPct = Math.round((secondsLeft / QR_STEP_SECONDS) * 100);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#022C22] via-[#064E3B] to-[#022C22] p-5 sm:p-6 text-white shadow-glass-lg border border-gold-400/35">
      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Live Dynamic QR Code Box */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="rounded-2xl bg-white p-3 shadow-lg border-2 border-gold-400">
            {qrPayload ? (
              <QRCodeCanvas value={qrPayload} size={136} fgColor="#022C22" level="M" />
            ) : (
              <div className="h-[136px] w-[136px] animate-pulse rounded bg-slate-200" />
            )}
          </div>
          <div className="w-full space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full bg-gradient-to-r from-gold-400 to-emerald-400 transition-all duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="flex items-center justify-center gap-1 text-[10px] font-bold text-gold-200">
              <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Live QR refreshes in {secondsLeft}s</span>
            </p>
          </div>
        </div>

        {/* Accredited Verifier Credentials */}
        <div className="flex-1 space-y-2.5 text-center sm:text-start">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <AmanatLogo className="h-7 w-7" />
            <Badge
              variant="gold"
              className="bg-gold-500/20 text-gold-200 border-gold-400/40"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              OFFICIAL ACCREDITED FIELD VERIFIER ID
            </Badge>
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-white">{verifier.full_name}</h3>
            <p className="text-xs font-semibold text-emerald-200">
              {verifier.verifier_badge_title || `Accredited Field Verifier — ${verifier.district}`}
            </p>
            <p className="mt-0.5 text-xs text-emerald-100/80">
              Coverage: <strong>{verifier.tehsil}, {verifier.district}</strong> · ID:{' '}
              <span className="font-mono text-gold-300">{verifier.id}</span>
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-1.5 text-xs">
            <span className="text-emerald-200 font-semibold">Live 6-Digit Code:</span>
            <span className="font-mono text-base font-extrabold tracking-[0.2em] text-gold-300">
              {sixDigitCode}
            </span>
          </div>

          <p className="flex items-center justify-center sm:justify-start gap-1.5 text-[11px] text-amber-200/90">
            <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-gold-400" />
            <span>
              Screenshot-proof anti-scam badge: Ask the family to scan this live QR using Amanat
              Scanner.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** 2. Donor Digital Stewardship Card */
export function DonorDigitalCard({
  user,
  totalGivenPkr,
  donationCount,
}: {
  user: AuthUserSession;
  totalGivenPkr: number;
  donationCount: number;
}) {
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownloadCard = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `Amanat-Donor-QR-${user.full_name.replace(/\s+/g, '-')}.png`;
    a.click();
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#022C22] via-[#064E3B] to-[#065F46] p-4 sm:p-5 text-white border border-gold-400/35 shadow-glass flex flex-col sm:flex-row items-center gap-4">
      <div
        ref={qrRef}
        className="rounded-xl bg-white p-2.5 shadow shrink-0 border border-gold-300"
      >
        <QRCodeCanvas
          value={`AMANAT-DONOR|${user.email}|PKR:${totalGivenPkr}|COUNT:${donationCount}`}
          size={92}
          fgColor="#064E3B"
          level="M"
        />
      </div>
      <div className="flex-1 text-center sm:text-start space-y-1">
        <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gold-300">
          <Award className="h-3.5 w-3.5" />
          <span>Amanat Digital Donor Card · امانت</span>
        </div>
        <h3 className="text-base font-extrabold">{user.full_name}</h3>
        <p className="text-[11px] text-emerald-100/80">{user.email}</p>
        <p className="text-xs font-bold text-gold-200">
          Verified Impact: {formatPKR(totalGivenPkr)} ({donationCount} contributions)
        </p>
      </div>
      <Button
        variant="gold"
        size="sm"
        onClick={handleDownloadCard}
        className="shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Save QR Card</span>
      </Button>
    </div>
  );
}

/** 3. Beneficiary Confidential Digital Case Card */
export function BeneficiaryDigitalCard({
  welfareCase,
  assignedVerifierName,
}: {
  welfareCase: WelfareCase;
  assignedVerifierName?: string | null;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-950 to-emerald-900 p-4 text-white border border-gold-400/30 flex items-center gap-3.5">
      <div className="rounded-xl bg-white p-2 shrink-0">
        <QRCodeCanvas
          value={`AMANAT-CASE|${welfareCase.case_code}|${welfareCase.district}|${welfareCase.status}`}
          size={68}
          fgColor="#064E3B"
          level="M"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5 text-xs">
        <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gold-300">
          <HeartHandshake className="h-3.5 w-3.5" />
          <span>Beneficiary Case Pass</span>
        </div>
        <p className="font-mono text-sm font-extrabold text-white">{welfareCase.case_code}</p>
        <p className="text-[11px] text-emerald-100/85 truncate">
          {welfareCase.district} · {welfareCase.vendor_name}
        </p>
        {assignedVerifierName && (
          <p className="text-[11px] text-gold-200 font-semibold truncate">
            Assigned Verifier: {assignedVerifierName}
          </p>
        )}
      </div>
    </div>
  );
}
