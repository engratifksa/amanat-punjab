import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Banknote, Building2, ShieldCheck, Percent } from 'lucide-react';
import { formatPKR } from '@/lib/utils';

interface TransparencyStripProps {
  totalVerifiedAidPkr: number;
  accreditedVerifiersCount: number;
}

export function TransparencyStrip({
  totalVerifiedAidPkr,
  accreditedVerifiersCount,
}: TransparencyStripProps) {
  const { t } = useTranslation();

  const metrics = [
    {
      label: t('stats.totalAid'),
      value: formatPKR(totalVerifiedAidPkr),
      icon: Banknote,
      color: 'text-emerald-700 bg-emerald-100',
    },
    {
      label: t('stats.directVendor'),
      value: '100%',
      icon: Building2,
      color: 'text-gold-700 bg-gold-100',
    },
    {
      label: t('stats.verifiers'),
      value: String(accreditedVerifiersCount),
      icon: ShieldCheck,
      color: 'text-teal-700 bg-teal-100',
    },
    {
      label: t('stats.adminFee'),
      value: '0%',
      icon: Percent,
      color: 'text-emerald-800 bg-emerald-100',
    },
  ];

  return (
    <section className="relative z-10 -mt-6 mx-auto max-w-7xl px-4 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-3.5"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${m.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-extrabold text-emerald-950 truncate">
                  {m.value}
                </p>
                <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                  {m.label}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
