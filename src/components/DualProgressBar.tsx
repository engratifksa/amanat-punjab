import { useTranslation } from 'react-i18next';
import { formatPKR } from '@/lib/utils';

interface DualProgressBarProps {
  target: number;
  collected: number;
  pledged: number;
  compact?: boolean;
}

export function DualProgressBar({
  target,
  collected,
  pledged,
  compact = false,
}: DualProgressBarProps) {
  const { t } = useTranslation();
  const safeTarget = Math.max(1, target);
  const confirmedPct = Math.min(100, Math.round((collected / safeTarget) * 100));
  const pledgedPct = Math.min(
    Math.max(0, 100 - confirmedPct),
    Math.round((pledged / safeTarget) * 100)
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
          <span className="font-bold text-emerald-950">{formatPKR(collected)}</span>
          <span className="text-slate-500">({confirmedPct}%)</span>
        </div>
        <div className="text-slate-600 font-medium">
          {t('campaigns.target')}:{' '}
          <span className="font-bold text-slate-900">{formatPKR(target)}</span>
        </div>
      </div>

      {/* Dual-layer progress bar: Solid Emerald (confirmed) + Warm Gold (pending pledge) */}
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-emerald-950/10 flex"
        role="progressbar"
        aria-valuenow={confirmedPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-800 to-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `${confirmedPct}%` }}
          title={`${t('campaigns.collected')}: ${formatPKR(collected)}`}
        />
        {pledgedPct > 0 && (
          <div
            className="h-full bg-gradient-to-r from-gold-500 to-gold-400 transition-all duration-700 ease-out"
            style={{ width: `${pledgedPct}%` }}
            title={`${t('campaigns.pledged')}: ${formatPKR(pledged)}`}
          />
        )}
      </div>

      {!compact && pledged > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gold-700">
          <span className="h-2 w-2 rounded-full bg-gold-500 inline-block animate-pulse" />
          <span>
            +{formatPKR(pledged)} {t('campaigns.pledged')}
          </span>
        </div>
      )}
    </div>
  );
}
