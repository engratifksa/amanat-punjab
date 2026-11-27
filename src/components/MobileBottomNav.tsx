import { useTranslation } from 'react-i18next';
import { Heart, HandHelping, ClipboardCheck, Lock, ShieldCheck } from 'lucide-react';
import type { UserRole } from '@/types/amanat';
import { cn } from '@/lib/utils';

export function MobileBottomNav({
  activeRole,
  isAdminAuthenticated,
  onChangeRole,
  onRequestAdminAccess,
}: {
  activeRole: UserRole;
  isAdminAuthenticated: boolean;
  onChangeRole: (role: UserRole) => void;
  onRequestAdminAccess: () => void;
}) {
  const { t } = useTranslation();

  const items: Array<{ role: UserRole; icon: typeof Heart }> = [
    { role: 'donor', icon: Heart },
    { role: 'beneficiary', icon: HandHelping },
    { role: 'verifier', icon: ClipboardCheck },
    { role: 'admin', icon: isAdminAuthenticated ? ShieldCheck : Lock },
  ];

  return (
    <nav
      aria-label="Mobile Role Navigation"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-emerald-900/15 bg-white/95 backdrop-blur-xl pb-safe shadow-glass-lg"
    >
      <div className="grid grid-cols-4 px-2 pt-2">
        {items.map(({ role, icon: Icon }) => {
          const active = activeRole === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => (role === 'admin' ? onRequestAdminAccess() : onChangeRole(role))}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-bold transition-colors',
                active
                  ? 'text-emerald-900 bg-emerald-50'
                  : 'text-slate-500 hover:text-emerald-800'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-gold-600')} />
              <span className="truncate max-w-full px-1">{t(`roles.${role}`)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
