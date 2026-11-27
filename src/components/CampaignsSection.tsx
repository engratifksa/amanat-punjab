import { useTranslation } from 'react-i18next';
import Tilt from 'react-parallax-tilt';
import {
  Building2,
  Clock,
  Lock,
  MapPin,
  Share2,
  Sparkles,
  Users,
  CheckCircle2,
} from 'lucide-react';
import type { CrowdfundingCampaign, DonationTarget } from '@/types/amanat';
import { Badge, Button } from './ui/primitives';
import { DualProgressBar } from './DualProgressBar';
import { cn, daysUntil } from '@/lib/utils';
import type { ShareableItem } from './SocialShareModal';

interface CampaignsSectionProps {
  campaigns: CrowdfundingCampaign[];
  language: 'en' | 'ur';
  highlightedCode?: string | null;
  onDonate: (target: DonationTarget) => void;
  onShare: (item: ShareableItem) => void;
}

export function CampaignsSection({
  campaigns,
  language,
  highlightedCode,
  onDonate,
  onShare,
}: CampaignsSectionProps) {
  const { t } = useTranslation();
  const visibleCampaigns = campaigns.filter(
    (c) =>
      c.status === 'active' ||
      c.status === 'fully_funded' ||
      c.status === 'disbursed_to_vendor'
  );

  return (
    <section id="campaigns" className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="gold" className="mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            {t('campaigns.badge')}
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-950">
            {t('campaigns.title')}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            {t('campaigns.subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleCampaigns.map((camp) => {
          const isLocked =
            camp.status === 'fully_funded' ||
            camp.status === 'disbursed_to_vendor' ||
            camp.collected_amount_pkr >= camp.target_amount_pkr;
          const remainingDays = daysUntil(camp.deadline_date);

          const isHighlighted =
            highlightedCode?.toLowerCase() === camp.campaign_code.toLowerCase();

          const buildShareItem = (): ShareableItem => ({
            type: 'campaign',
            code: camp.campaign_code,
            title_en: camp.title_en,
            title_ur: camp.title_ur,
            summary_en: camp.summary_en,
            summary_ur: camp.summary_ur,
            district: camp.district,
            category: camp.category,
            funding_type: camp.funding_type,
            vendor_name: camp.vendor_name,
            target_amount_pkr: camp.target_amount_pkr,
            collected_amount_pkr: camp.collected_amount_pkr,
            donor_count: camp.donor_count,
            is_completed: isLocked,
          });

          return (
            <Tilt
              key={camp.id}
              tiltMaxAngleX={6}
              tiltMaxAngleY={6}
              glareEnable
              glareMaxOpacity={0.08}
              className="h-full"
            >
              <article
                id={`campaign-${camp.campaign_code}`}
                className={cn(
                  'glass-card flex h-full flex-col justify-between rounded-3xl p-6 transition-all hover:shadow-glass-lg border-emerald-900/15 scroll-mt-24',
                  isHighlighted && 'ring-4 ring-gold-400 shadow-glass-lg border-gold-500'
                )}
              >
                <div className="space-y-4">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                      {camp.campaign_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          camp.funding_type === 'zakat_eligible' ? 'emerald' : 'gold'
                        }
                      >
                        {t(`funding.${camp.funding_type}`)}
                      </Badge>
                      <Badge variant="slate">{t(`categories.${camp.category}`)}</Badge>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h3 className="text-lg font-extrabold text-emerald-950 leading-snug">
                      {language === 'ur' ? camp.title_ur : camp.title_en}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {language === 'ur' ? camp.summary_ur : camp.summary_en}
                    </p>
                  </div>

                  {/* Meta Row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                      {camp.district}, Punjab
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-gold-600" />
                      {camp.donor_count} {t('campaigns.donors')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      {isLocked
                        ? t('campaigns.ended')
                        : `${remainingDays} ${t('campaigns.daysLeft')}`}
                    </span>
                  </div>

                  {/* Dual-layer Target vs Collected Progress Bar */}
                  <div className="rounded-2xl bg-emerald-50/60 p-3.5 border border-emerald-900/5">
                    <DualProgressBar
                      target={camp.target_amount_pkr}
                      collected={camp.collected_amount_pkr}
                      pledged={camp.pledged_amount_pkr}
                    />
                  </div>
                </div>

                {/* Vendor Escrow Target & Action */}
                <div className="mt-5 space-y-3 pt-4 border-t border-slate-200/70">
                  <div className="flex items-start gap-2 text-xs text-slate-700">
                    <Building2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-950">
                        {t('campaigns.escrowVendor')}:
                      </span>{' '}
                      {camp.vendor_name}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {camp.status === 'disbursed_to_vendor' ? (
                      <Button variant="outline" className="flex-1" disabled>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {t('campaigns.disbursed')}
                      </Button>
                    ) : isLocked ? (
                      <Button variant="outline" className="flex-1" disabled>
                        <Lock className="h-4 w-4 text-emerald-700" />
                        {t('campaigns.fullyFunded')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        className="flex-1"
                        onClick={() =>
                          onDonate({
                            type: 'campaign',
                            id: camp.id,
                            code: camp.campaign_code,
                            title_en: camp.title_en,
                            title_ur: camp.title_ur,
                            district: camp.district,
                            vendor_name: camp.vendor_name,
                            vendor_invoice_url: camp.vendor_invoice_url,
                            funding_type: camp.funding_type,
                            target_amount_pkr: camp.target_amount_pkr,
                            collected_amount_pkr: camp.collected_amount_pkr,
                            pledged_amount_pkr: camp.pledged_amount_pkr,
                            status: camp.status,
                          })
                        }
                      >
                        {t('campaigns.contribute')}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => onShare(buildShareItem())}
                      aria-label={`Share ${camp.campaign_code} on social media`}
                      title="Share Campaign (EN + Urdu Poster)"
                      className="shrink-0 border-emerald-900/20 text-emerald-900 hover:bg-emerald-50 px-3.5"
                    >
                      <Share2 className="h-4 w-4 text-emerald-700" />
                      <span>{language === 'ur' ? 'شیئر' : 'Share'}</span>
                    </Button>
                  </div>
                </div>
              </article>
            </Tilt>
          );
        })}
      </div>
    </section>
  );
}
