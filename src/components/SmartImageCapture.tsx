import React, { useRef, useState } from 'react';
import { Camera, Upload, Crop, CheckCircle2, Trash2 } from 'lucide-react';
import { compressImageToDataUrl } from '@/lib/utils';
import { Button } from './ui/primitives';

type CropPreset = 'original' | '4:3' | '16:10' | '1:1';

async function cropAndCompressDataUrl(
  rawDataUrl: string,
  preset: CropPreset
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;

      if (preset !== 'original') {
        const targetRatio =
          preset === '1:1' ? 1 : preset === '4:3' ? 4 / 3 : 16 / 10;
        const currentRatio = img.width / img.height;
        if (currentRatio > targetRatio) {
          sw = img.height * targetRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / targetRatio;
          sy = (img.height - sh) / 2;
        }
      }

      const maxDim = 1100;
      const scale = Math.min(1, maxDim / Math.max(sw, sh));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

interface SmartImageCaptureProps {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  helperText?: string;
}

export function SmartImageCapture({
  label,
  value,
  onChange,
  helperText = 'Auto-compressed & croppable — works with mobile camera or gallery',
}: SmartImageCaptureProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [rawSource, setRawSource] = useState<string | null>(null);
  const [preset, setPreset] = useState<CropPreset>('4:3');
  const [processing, setProcessing] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      setRawSource(compressed);
      const cropped = await cropAndCompressDataUrl(compressed, preset);
      onChange(cropped);
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  const handleChangeCrop = async (nextPreset: CropPreset) => {
    setPreset(nextPreset);
    const base = rawSource ?? value;
    if (!base) return;
    setProcessing(true);
    try {
      const cropped = await cropAndCompressDataUrl(base, nextPreset);
      onChange(cropped);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <label className="block text-xs font-bold text-slate-700">{label}</label>

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => cameraRef.current?.click()}
          disabled={processing}
          className="border-emerald-900/20 bg-emerald-50/50 text-emerald-950"
        >
          <Camera className="h-4 w-4 text-emerald-700 shrink-0" />
          <span>{processing ? 'Processing...' : 'Take Photo'}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => uploadRef.current?.click()}
          disabled={processing}
        >
          <Upload className="h-4 w-4 text-gold-600 shrink-0" />
          <span>Upload Photo</span>
        </Button>

        {/* Mobile rear camera capture input */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        {/* Standard gallery / file upload input */}
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      <p className="text-[11px] text-slate-500">{helperText}</p>

      {value && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-900">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
              Auto-Compressed &amp; Cropped Ready
            </span>
            <div className="flex items-center gap-1">
              <Crop className="h-3 w-3 text-slate-500 me-0.5" />
              {(['original', '4:3', '16:10', '1:1'] as CropPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleChangeCrop(p)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                    preset === p
                      ? 'bg-emerald-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50'
                  }`}
                >
                  {p === 'original' ? 'Full' : p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setRawSource(null);
                  onChange(null);
                }}
                aria-label="Remove photo"
                className="ms-1 rounded p-1 text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <img
            src={value}
            alt="Compressed preview"
            className="max-h-40 w-full rounded-xl object-contain bg-white border border-slate-200"
          />
        </div>
      )}
    </div>
  );
}
