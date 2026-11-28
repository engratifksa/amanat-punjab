import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import imageCompression from 'browser-image-compression';

export const DEFAULT_PUBLIC_APP_URL = 'https://amanat-punjab.vercel.app';

export function getPublicAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return DEFAULT_PUBLIC_APP_URL;
}

export function maskCnic(cnic?: string | null): string {
  if (!cnic) return 'Not Provided';
  const digits = cnic.replace(/\D/g, '');
  if (digits.length >= 13) {
    return `${digits.slice(0, 5)}-*******-${digits.slice(12, 13)}`;
  }
  if (digits.length >= 6) {
    return `${digits.slice(0, 5)}-****-${digits.slice(-1)}`;
  }
  return cnic;
}

export function formatCnicInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function normalizeCnicDigits(cnic?: string | null): string {
  if (!cnic) return '';
  return cnic.replace(/\D/g, '');
}

export function normalizeTxRef(ref?: string | null): string {
  if (!ref) return '';
  return ref.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString('en-PK')}`;
}

export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate).getTime();
  const now = Date.now();
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export async function compressImageToDataUrl(file: File): Promise<string> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.25,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    });
    return await fileToDataUrl(compressed);
  } catch {
    return await fileToDataUrl(file);
  }
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function detectLowPowerOrSaveData(): boolean {
  if (typeof window === 'undefined') return true;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory && nav.deviceMemory <= 2) return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
  } catch {
    return true;
  }
  return false;
}
