import { useTranslation } from 'react-i18next';
import {
  MapPin,
  ClipboardCheck,
  Wallet,
  Building2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from './ui/primitives';

const STAGE_ICONS = [MapPin, ClipboardCheck, Wallet, Building2, QrCode];

export function EscrowPipeline() {
  const { t } = useTranslation();
  const stages = t('pipeline.stages', { returnObjects: true }) as Array<{
    title: string;
    desc: string;
  }>;

  return (
    <section id="pipeline" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="rounded-3xl bg-emerald-950 p-6 sm:p-10 text-white shadow-glass-lg border border-gold-400/20">
        <div className="mb-8 max-w-2xl">
          <Badge variant="gold" className="mb-3 bg-gold-500/20 text-gold-200 border-gold-400/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('pipeline.badge')}
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold">{t('pipeline.title')}</h2>
          <p className="mt-2 text-sm text-emerald-100/85">{t('pipeline.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {stages.map((stage, idx) => {
            const Icon = STAGE_ICONS[idx] ?? ShieldCheck;
            return (
              <div
                key={stage.title}
                className="relative rounded-2xl bg-white/10 p-4 border border-white/10 backdrop-blur-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 text-white shadow-gold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-mono text-xs font-extrabold text-gold-300">
                    0{idx + 1}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white">{stage.title}</h3>
                <p className="mt-1.5 text-xs text-emerald-100/80 leading-relaxed">
                  {stage.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
