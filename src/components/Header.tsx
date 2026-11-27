import { useTranslation } from 'react-i18next';
import { Download, Globe, ShieldCheck, CheckCircle2, Lock, Unlock, UserCircle2, LogOut } from 'lucide-react';
import type { AuthUserSession, NotificationRecord, UserRole } from '@/types/amanat';
import { Button } from './ui/primitives';
import { AmanatLogo } from './AmanatLogo';
import { NotificationBell } from './NotificationBell';
import { cn } from '@/lib/utils';

interface HeaderProps {
  activeRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  isAdminAuthenticated: boolean;
  onRequestAdminAccess: () => void;
  language: 'en' | 'ur';
  onToggleLanguage: () => void;
  canInstallPWA: boolean;
  isPWAInstalled: boolean;
  onInstallPWA: () => void;
  dataMode: 'supabase' | 'dexie';
  notifications: NotificationRecord[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  currentUser: AuthUserSession | null;
  onOpenUserAuth: (role?: 'donor' | 'beneficiary' | 'verifier') => void;
  onSignOutUser: () => void;
}

const PUBLIC_ROLES: UserRole[] = ['donor', 'beneficiary', 'verifier'];

export function Header({
  activeRole,
  onChangeRole,
  isAdminAuthenticated,
  onRequestAdminAccess,
  language,
  onToggleLanguage,
  canInstallPWA,
  isPWAInstalled,
  onInstallPWA,
  dataMode,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  currentUser,
  onOpenUserAuth,
  onSignOutUser,
}: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-900/10 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Brand Logo */}
        <a
          href="#top"
          onClick={() => onChangeRole('donor')}
          className="flex items-center gap-2 sm:gap-2.5 group min-w-0 shrink"
        >
          <AmanatLogo className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105" />
          <div className="leading-tight min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-emerald-950 truncate">
                {t('appName')}
              </span>
              <span className="text-xs sm:text-sm font-bold text-gold-600 shrink-0">
                {t('appNameUr')}
              </span>
            </div>
            <div className="hidden xs:flex sm:flex items-center gap-1 text-[10px] font-semibold text-slate-500">
              <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
              <span className="truncate">
                {dataMode === 'supabase' ? 'Supabase Live' : 'Dexie Local PWA'}
              </span>
            </div>
          </div>
        </a>

        {/* Desktop Section Links (shown in Donor view) */}
        {activeRole === 'donor' && (
          <nav className="hidden xl:flex items-center gap-5 text-sm font-semibold text-slate-700">
            <a href="#campaigns" className="hover:text-emerald-800 transition-colors">
              {t('nav.campaigns')}
            </a>
            <a href="#cases" className="hover:text-emerald-800 transition-colors">
              {t('nav.cases')}
            </a>
            <a href="#pipeline" className="hover:text-emerald-800 transition-colors">
              {t('nav.pipeline')}
            </a>
          </nav>
        )}

        {/* Public Role Switcher Pill (Donor | Beneficiary | Field Verifier) */}
        <div
          className="hidden md:flex items-center rounded-full bg-emerald-950/5 p-1 border border-emerald-900/10"
          role="tablist"
          aria-label="Workspace Role Switcher"
        >
          {PUBLIC_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={activeRole === role}
              onClick={() => onChangeRole(role)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-bold transition-all',
                activeRole === role
                  ? 'bg-emerald-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-emerald-900'
              )}
            >
              {t(`roles.${role}`)}
            </button>
          ))}
        </div>

        {/* Right Controls: User Sign-In + Notification Bell + Discreet Protected Admin Lock + Language Toggle + PWA Install */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {currentUser ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-emerald-900/15 bg-emerald-50/80 px-2 py-1 text-xs font-bold text-emerald-950">
              <UserCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span className="hidden sm:inline max-w-[100px] truncate">
                {currentUser.full_name}
              </span>
              <button
                type="button"
                onClick={onSignOutUser}
                title="Sign Out"
                aria-label="Sign Out User"
                className="rounded p-0.5 text-slate-500 hover:text-rose-600"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenUserAuth('donor')}
              className="border-emerald-900/20 px-2 sm:px-3"
              aria-label="Sign In"
            >
              <UserCircle2 className="h-3.5 w-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          )}

          <NotificationBell
            notifications={notifications}
            activeRole={activeRole}
            language={language}
            onMarkRead={onMarkNotificationRead}
            onMarkAllRead={onMarkAllNotificationsRead}
          />

          <button
            type="button"
            onClick={onRequestAdminAccess}
            aria-label="Admin Portal Login"
            title="Restricted Admin Board (2FA Protected)"
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all',
              activeRole === 'admin'
                ? 'border-emerald-900 bg-emerald-900 text-white shadow-sm'
                : isAdminAuthenticated
                ? 'border-emerald-600/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                : 'border-slate-200 bg-white/90 text-slate-600 hover:border-emerald-800/30 hover:text-emerald-950'
            )}
          >
            {isAdminAuthenticated ? (
              <Unlock className="h-3.5 w-3.5 text-gold-500" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-slate-500" />
            )}
            <span className="hidden md:inline">{t('roles.admin')}</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={onToggleLanguage}
            aria-label="Toggle Language"
            className="font-bold border-emerald-900/20 px-2 sm:px-3"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-700" />
            <span>{language === 'en' ? 'اردو' : 'EN'}</span>
          </Button>

          {isPWAInstalled ? (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('nav.installed')}
            </span>
          ) : (
            <Button
              variant="gold"
              size="sm"
              onClick={onInstallPWA}
              className="px-2 sm:px-3"
              aria-label="Install App"
              title={canInstallPWA ? 'Install Amanat PWA' : 'Install or Add to Home Screen'}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('nav.install')}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
