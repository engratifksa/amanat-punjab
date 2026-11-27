import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Tilt from 'react-parallax-tilt';
import {
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  Stethoscope,
  GraduationCap,
  Wheat,
  Gem,
} from 'lucide-react';
import { Button } from './ui/primitives';

/** Luxury Dotted-Emerald Pakistan/Punjab Globe + Smoothly Orbiting Editorial Gold Ring */
function PakistanGlobeWithRing({
  onSelectCategory,
}: {
  onSelectCategory: (cat: string) => void;
}) {
  const { t } = useTranslation();

  const ringNodes = [
    {
      id: 'health',
      label: t('hero.nodes.health'),
      icon: Stethoscope,
      angleDeg: -38,
    },
    {
      id: 'education',
      label: t('hero.nodes.education'),
      icon: GraduationCap,
      angleDeg: 18,
    },
    {
      id: 'ration_food',
      label: t('hero.nodes.ration_food'),
      icon: Wheat,
      angleDeg: 78,
    },
    {
      id: 'daughter_marriage',
      label: t('hero.nodes.daughter_marriage'),
      icon: Gem,
      angleDeg: 218,
    },
  ];

  return (
    <div className="relative flex h-[290px] w-[290px] sm:h-[330px] sm:w-[330px] items-center justify-center select-none">
      {/* Whisper-thin luminous golden orbital ring */}
      <div className="pointer-events-none absolute inset-4 rounded-full border border-gold-300/45 shadow-[0_0_28px_rgba(245,158,11,0.16)]" />
      <div className="pointer-events-none absolute inset-10 rounded-full border border-emerald-400/15" />

      {/* Geographically Accurate Pakistan (Emerald) & Punjab (Gold) Dotted-Emerald Globe */}
      <div className="relative h-48 w-48 sm:h-56 sm:w-56 rounded-full overflow-hidden">
        <img
          src="https://lizwbjvngqdqntqhnude.supabase.co/storage/v1/object/public/amanat-media/hero-globe.jpg"
          alt="Impact globe highlighting Pakistan and Punjab"
          className="h-full w-full object-cover scale-[1.16] pointer-events-none select-none"
          style={{
            WebkitMaskImage:
              'radial-gradient(circle, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 76%)',
            maskImage:
              'radial-gradient(circle, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 76%)',
          }}
        />
        {/* Soft emerald light wash from the lantern bathing the left side of the globe */}
        <motion.div
          animate={{ opacity: [0.32, 0.52, 0.32] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 12% 52%, rgba(52, 211, 153, 0.48), rgba(16, 185, 129, 0.14) 45%, transparent 72%)',
            mixBlendMode: 'screen',
          }}
        />
      </div>

      {/* Smoothly Orbiting Ring with Upright Editorial Category Medallions */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute inset-0"
      >
        {ringNodes.map((node) => {
          const Icon = node.icon;
          const rad = (node.angleDeg * Math.PI) / 180;
          const radiusPct = 44.5;
          const leftPct = 50 + Math.cos(rad) * radiusPct;
          const topPct = 50 + Math.sin(rad) * radiusPct;

          return (
            <div
              key={node.id}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
            >
              <motion.button
                type="button"
                animate={{ rotate: -360 }}
                transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
                onClick={() => onSelectCategory(node.id)}
                className="group flex flex-col items-center gap-1 focus:outline-none"
                title={node.label}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold-300/90 bg-gradient-to-br from-amber-50 via-white to-amber-100/95 text-emerald-950 shadow-[0_6px_20px_rgba(2,44,34,0.55),0_0_12px_rgba(245,158,11,0.28)] transition-all duration-200 group-hover:scale-110 group-hover:from-gold-400 group-hover:to-gold-500 group-hover:text-white">
                  <Icon className="h-[18px] w-[18px] stroke-[2.2]" />
                </span>
                <span className="text-[11px] font-bold tracking-wide text-amber-50/95 drop-shadow-[0_2px_6px_rgba(2,44,34,0.95)] group-hover:text-gold-300 transition-colors">
                  {node.label}
                </span>
              </motion.button>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}

export function HeroSection({
  onExploreCases,
  onRequestAssistance,
  onSelectCategory,
}: {
  onExploreCases: () => void;
  onRequestAssistance: () => void;
  onSelectCategory: (cat: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#022C22] via-[#043A2C] to-[#022C22] text-white">
      {/* Subtle architectural emerald & champagne-gold ambience */}
      <div
        className="pointer-events-none absolute -top-24 start-1/4 h-96 w-96 rounded-full bg-gold-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 end-0 h-80 w-80 rounded-full bg-emerald-400/12 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-16">
        {/* Left Column */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-6 space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/35 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-gold-200 backdrop-blur-md">
            <ShieldCheck className="h-4 w-4 text-gold-400 shrink-0" />
            <span>{t('hero.badge')}</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.05rem] leading-[1.15]">
            {t('hero.headline')}
          </h1>

          <p className="max-w-xl text-sm sm:text-base text-emerald-100/90 leading-relaxed">
            {t('hero.subcopy')}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button variant="gold" size="lg" onClick={onExploreCases}>
              <span>{t('hero.ctaExplore')}</span>
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onRequestAssistance}
              className="bg-white/10 text-white border-white/25 hover:bg-white/20"
            >
              <HeartHandshake className="h-4 w-4 text-gold-300" />
              <span>{t('hero.ctaRequest')}</span>
            </Button>
          </div>
        </motion.div>

        {/* Right Column: Luxury Classic Emerald Lantern emitting green light across the Pakistan/Punjab Globe */}
        <div className="lg:col-span-6">
          <Tilt
            tiltMaxAngleX={4}
            tiltMaxAngleY={4}
            glareEnable
            glareMaxOpacity={0.06}
            glareColor="#34D399"
            className="rounded-3xl"
          >
            <div
              dir="ltr"
              className="relative flex flex-col sm:flex-row items-center justify-center rounded-3xl border border-gold-400/20 bg-[#01261C] px-3 py-5 sm:px-5 sm:py-6 shadow-glass-lg overflow-hidden min-h-[370px]"
            >
              {/* Radiant Emerald Light Emission pouring from the Lantern across the Globe */}
              <motion.div
                animate={{ opacity: [0.6, 0.9, 0.6], scale: [0.97, 1.06, 0.97] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute top-1/2 left-[24%] sm:left-[28%] -translate-x-1/2 -translate-y-1/2 h-[340px] w-[440px] rounded-full blur-2xl"
                style={{
                  background:
                    'radial-gradient(ellipse at 35% 50%, rgba(52, 211, 153, 0.44), rgba(16, 185, 129, 0.18) 48%, transparent 74%)',
                }}
                aria-hidden="true"
              />

              {/* Left: Classic Luxury Champagne-Gold & Emerald-Glass Lantern */}
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 h-[255px] w-[205px] sm:h-[315px] sm:w-[235px] shrink-0 sm:-me-6 flex items-center justify-center"
              >
                <img
                  src="https://lizwbjvngqdqntqhnude.supabase.co/storage/v1/object/public/amanat-media/hero-lantern.jpg"
                  alt="Classic illuminated emerald and gold Islamic lantern"
                  className="h-full w-full object-contain pointer-events-none select-none mix-blend-lighten drop-shadow-[0_0_28px_rgba(16,185,129,0.45)]"
                  style={{
                    WebkitMaskImage:
                      'radial-gradient(ellipse 48% 54% at 50% 50%, rgba(0,0,0,1) 48%, rgba(0,0,0,0) 78%)',
                    maskImage:
                      'radial-gradient(ellipse 48% 54% at 50% 50%, rgba(0,0,0,1) 48%, rgba(0,0,0,0) 78%)',
                  }}
                />
              </motion.div>

              {/* Right: Dotted-Emerald Pakistan/Punjab Globe + Smoothly Orbiting Ring */}
              <div className="relative z-10 flex items-center justify-center">
                <PakistanGlobeWithRing onSelectCategory={onSelectCategory} />
              </div>
            </div>
          </Tilt>
        </div>
      </div>
    </section>
  );
}
