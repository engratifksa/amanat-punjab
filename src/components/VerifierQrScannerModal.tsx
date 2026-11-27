import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import {
  Camera,
  X,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Upload,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { Profile } from '@/types/amanat';
import { verifyDynamicVerifierInput, type VerifierScanResult } from '@/lib/dynamicQr';
import { Badge, Button, Input } from './ui/primitives';

interface VerifierQrScannerModalProps {
  isOpen: boolean;
  profiles: Profile[];
  onClose: () => void;
}

export function VerifierQrScannerModal({
  isOpen,
  profiles,
  onClose,
}: VerifierQrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [result, setResult] = useState<VerifierScanResult | null>(null);

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setResult(null);
      setCameraError(null);
      setManualInput('');
    }
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen) return null;

  const evaluatePayload = async (raw: string) => {
    const res = await verifyDynamicVerifierInput(raw, profiles);
    setResult(res);
    stopCamera();
  };

  const startCamera = async () => {
    setCameraError(null);
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          scanLoop();
        }
      }, 120);
    } catch {
      setCameraError(
        'Camera permission unavailable on this device/browser. You can verify using the visitor\'s live 6-digit code below or upload a QR image.'
      );
    }
  };

  const scanLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imgData.data, imgData.width, imgData.height);
        if (decoded?.data) {
          evaluatePayload(decoded.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  };

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(data.data, data.width, data.height);
        if (decoded?.data) {
          evaluatePayload(decoded.data);
        } else {
          setCameraError('No QR code detected in that image. Try camera scan or 6-digit code.');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await evaluatePayload(manualInput.trim());
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-emerald-950/75 p-3 sm:p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Verify Amanat Field Verifier Scanner"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden rounded-3xl bg-white shadow-glass-lg border border-emerald-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 bg-emerald-950 px-5 py-4 text-white shrink-0">
          <div>
            <Badge
              variant="gold"
              className="mb-1.5 bg-gold-500/20 text-gold-200 border-gold-400/30"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Anti-Scam Live Verifier Scanner
            </Badge>
            <h2 className="text-base sm:text-lg font-extrabold">
              Verify Field Verifier (QR / 6-Digit Code)
            </h2>
            <p className="text-[11px] text-emerald-100/85 mt-0.5">
              فیلڈ ویریفائر کی تصدیق — اصلی کیو آر کوڈ ہر 60 سیکنڈ بعد بدلتا ہے
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Scanner"
            className="rounded-xl bg-white/10 p-1.5 hover:bg-white/20 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Verification Result Banner */}
          {result && (
            <div
              className={`rounded-2xl border-2 p-4 space-y-2 ${
                result.valid
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                  : 'border-rose-500 bg-rose-50 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-2 font-extrabold text-sm">
                {result.valid ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                    <span>AUTHORIZED AMANAT FIELD VERIFIER</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0" />
                    <span>UNVERIFIED / POSSIBLE SCAM ALERT</span>
                  </>
                )}
              </div>
              {result.valid && result.verifier && (
                <div className="rounded-xl bg-white p-3 border border-emerald-200 text-xs space-y-1">
                  <p className="text-sm font-extrabold text-emerald-950">
                    {result.verifier.full_name}
                  </p>
                  <p className="text-slate-600">
                    {result.verifier.verifier_badge_title} · {result.verifier.tehsil},{' '}
                    {result.verifier.district}
                  </p>
                  <p className="font-mono text-[11px] text-emerald-800">
                    Badge ID: {result.verifier.id}
                  </p>
                </div>
              )}
              <p className="text-xs font-semibold leading-relaxed">{result.messageEn}</p>
              <p dir="rtl" className="text-xs font-semibold leading-loose">
                {result.messageUr}
              </p>
            </div>
          )}

          {/* Live Camera View */}
          {cameraActive ? (
            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-700 bg-black">
              <video ref={videoRef} playsInline muted className="h-60 w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-gold-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={stopCamera}
                className="absolute bottom-3 end-3"
              >
                Stop Camera
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button type="button" variant="primary" size="md" onClick={startCamera}>
                <Camera className="h-4 w-4" />
                <span>Start Live Camera Scan</span>
              </Button>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-900/20 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-50">
                <Upload className="h-4 w-4 text-gold-600" />
                <span>Scan QR Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadQrImage}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {cameraError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* 6-Digit Live Code / QR String Fallback */}
          <form onSubmit={handleManualVerify} className="space-y-2.5 pt-2 border-t border-slate-200">
            <label className="block text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-emerald-700" />
              <span>Or Enter Visitor&apos;s Live 6-Digit Code (Refreshes Every 60s)</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. 482910 or AMANAT-VF|..."
                className="font-mono"
              />
              <Button type="submit" variant="gold" size="md" className="shrink-0">
                Verify
              </Button>
            </div>
          </form>

          {/* Bilingual Anti-Scam Reminder */}
          <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 text-[11px] text-emerald-950 space-y-1">
            <p className="font-bold">
              Safety Rule: Never accept a screenshot or printed QR code. Amanat Field Verifiers
              NEVER ask families for cash, commission, or registration fees.
            </p>
            <p dir="rtl" className="text-emerald-900">
              حفاظتی ہدایت: کبھی بھی اسکرین شاٹ یا پرنٹ شدہ کیو آر کوڈ قبول نہ کریں۔ امانت کے
              ویریفائرز کبھی بھی نقد رقم یا فیس نہیں مانگتے۔
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
