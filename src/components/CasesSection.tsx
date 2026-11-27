import { useTranslation } from 'react-i18next';
import Tilt from 'react-parallax-tilt';
import { Building2, CheckCircle2, MapPin, ShieldCheck, BadgeCheck } from 'lucide-react';
import type { DonationTarget, Profile, WelfareCase } from '@/types/amanat';
import { Badge, Button } from './ui/primitives';
import { DualProgressBar } from './DualProgressBar';
import { cn } from '@/lib/utils';

export type CaseFilterKey =
  | 'all'
  | 'zakat_eligible'
  | 'daughter_marriage'
  | 'health'
  | 'education'
  | 'ration_food'
  | 'clothing';

const FILTER_KEYS: CaseFilterKey[] = [
  'all',
  'zakat_eligible',
  'daughter_marriage',
  'health',
  'education',
  'ration_food',
  'clothing',
];

interface CasesSectionProps {
  cases: WelfareCase[];
  profiles: Profile[];
  language: 'en' | 'ur';
  activeFilter: CaseFilterKey;
  onChangeFilter: (f: CaseFilterKey) => void;
  onDonate: (target: DonationTarget) => void;
}

export function CasesSection({
  cases,
  profiles,
  language,
  activeFilter,
  onChangeFilter,
  onDonate,
}: CasesSectionProps) {
  const { t } = useTranslation();

  // Strict privacy & anti-fraud rule: only approved, funded, or disbursed cases appear publicly
  const publicCases = cases.filter((c) =>
    ['approved', 'funded', 'disbursed_to_vendor'].includes(c.status)
  );

  const filtered = publicCases.filter((c) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'zakat_eligible') return c.funding_type === 'zakat_eligible';
    return c.category === activeFilter;
  });

  const getVerifier = (id: string | null) =>
    profiles.find((p) => p.id === id) ?? null;

  return (
    <section id="cases" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Badge variant="emerald" className="mb-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t('cases.badge')}
        </Badge>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-950">
          {t('cases.title')}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          {t('cases.subtitle')}
        </p>
      </div>

      {/* Category & Zakat Filter Pills */}
      <div className="mb-7 flex flex-wrap gap-2">
        {FILTER_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChangeFilter(key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-bold transition-all border',
              activeFilter === key
                ? 'bg-emerald-900 text-white border-emerald-900 shadow-sm'
                : 'bg-white/90 text-slate-700 border-emerald-900/15 hover:bg-emerald-50'
            )}
          >
            {t(`cases.filters.${key}`)}
          </button>
        ))}
      </div>

      {/* Individual Cases 3D-Tilt Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => {
          const verifier = getVerifier(c.assigned_verifier_id);
          const isClosed =
            c.status === 'disbursed_to_vendor' ||
            c.status === 'funded' ||
            c.raised_amount_pkr >= c.target_amount_pkr;

          return (
            <Tilt
              key={c.id}
              tiltMaxAngleX={5}
              tiltMaxAngleY={5}
              glareEnable
              glareMaxOpacity={0.07}
              className="h-full"
            >
              <article className="glass-card flex h-full flex-col justify-between rounded-3xl p-5 hover:shadow-glass-lg transition-shadow">
                <div className="space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-extrabold text-emerald-900 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                      {c.case_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          c.funding_type === 'zakat_eligible' ? 'emerald' : 'gold'
                        }
                      >
                        {t(`funding.${c.funding_type}`)}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                      {c.district} · {c.tehsil}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-800">{t(`categories.${c.category}`)}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {language === 'ur' ? c.anonymized_story_ur : c.anonymized_story_en}
                  </p>

                  {/* Accredited Field Verifier Badge */}
                  {verifier && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 border border-teal-200/80 px-2.5 py-1.5 text-[11px] font-semibold text-teal-900">
                      <BadgeCheck className="h-4 w-4 text-teal-700 shrink-0" />
                      <span className="truncate">
                        {t('cases.verifiedBy')}: {verifier.verifier_badge_title ?? verifier.full_name}
                      </span>
                    </div>
                  )}

                  <div className="rounded-2xl bg-slate-50/90 p-3 border border-slate-200/70">
                    <DualProgressBar
                      target={c.target_amount_pkr}
                      collected={c.raised_amount_pkr}
                      pledged={c.pledged_amount_pkr}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-3 pt-3.5 border-t border-slate-200/70">
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <Building2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="truncate">
                      <span className="font-bold text-emerald-950">{c.vendor_type}:</span>{' '}
                      {c.vendor_name}
                    </div>
                  </div>

                  {isClosed ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {t('cases.paidToVendor')}
                    </Button>
                  ) : (
                    <Button
                      variant="gold"
                      className="w-full"
                      onClick={() =>
                        onDonate({
                          type: 'case',
                          id: c.id,
                          code: c.case_code,
                          title_en: `${c.case_code} — ${c.district} (${c.vendor_type})`,
                          title_ur: `${c.case_code} — ${c.district}`,
                          district: c.district,
                          vendor_name: c.vendor_name,
                          vendor_invoice_url: c.vendor_invoice_url,
                          funding_type: c.funding_type,
                          target_amount_pkr: c.target_amount_pkr,
                          collected_amount_pkr: c.raised_amount_pkr,
                          pledged_amount_pkr: c.pledged_amount_pkr,
                          status: c.status,
                        })
                      }
                    >
                      {t('cases.donateTrack')}
                    </Button>
                  )}
                </div>
              </article>
            </Tilt>
          );
        })}
      </div>
    </section>
  );
}
