import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AppSettings,
  AuthUserSession,
  CrowdfundingCampaign,
  Donation,
  DonationTarget,
  FieldVerification,
  NotificationRecord,
  Profile,
  UserRole,
  WelfareCase,
} from '@/types/amanat';
import { dataClient, supabase } from '@/lib/dataClient';
import { DEFAULT_APP_SETTINGS } from '@/lib/seedData';
import { clearAdminSession, hasValidAdminSession } from '@/lib/adminAuth';
import { applyDocumentDirection } from '@/i18n';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { TransparencyStrip } from '@/components/TransparencyStrip';
import { CampaignsSection } from '@/components/CampaignsSection';
import { CasesSection, type CaseFilterKey } from '@/components/CasesSection';
import { EscrowPipeline } from '@/components/EscrowPipeline';
import { PaymentModal } from '@/components/PaymentModal';
import { BeneficiaryWorkspace } from '@/components/BeneficiaryWorkspace';
import { VerifierWorkspace } from '@/components/VerifierWorkspace';
import { AdminWorkspace } from '@/components/AdminWorkspace';
import { AdminAuthModal } from '@/components/AdminAuthModal';
import { UserAuthModal, PENDING_OAUTH_KEY } from '@/components/UserAuthModal';
import { DonorDashboard } from '@/components/DonorDashboard';
import { VerifierQrScannerModal } from '@/components/VerifierQrScannerModal';
import { SocialBar } from '@/components/SocialBar';
import { MobileBottomNav } from '@/components/MobileBottomNav';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const USER_SESSION_KEY = 'amanat_user_session_v1';

export default function App() {
  const { t, i18n } = useTranslation();
  const [activeRole, setActiveRole] = useState<UserRole>('donor');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() =>
    hasValidAdminSession()
  );
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [showVerifierScanner, setShowVerifierScanner] = useState(false);

  const [currentUser, setCurrentUser] = useState<AuthUserSession | null>(() => {
    try {
      const raw = localStorage.getItem(USER_SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthUserSession) : null;
    } catch {
      return null;
    }
  });
  const [authModalRole, setAuthModalRole] = useState<'donor' | 'beneficiary' | 'verifier' | null>(
    null
  );

  const [language, setLanguage] = useState<'en' | 'ur'>('en');
  const [caseFilter, setCaseFilter] = useState<CaseFilterKey>('all');
  const [donationTarget, setDonationTarget] = useState<DonationTarget | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [campaigns, setCampaigns] = useState<CrowdfundingCampaign[]>([]);
  const [cases, setCases] = useState<WelfareCase[]>([]);
  const [verifications, setVerifications] = useState<FieldVerification[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(true);

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  const refreshData = useCallback(async () => {
    const data = await dataClient.loadAll();
    setProfiles(data.profiles);
    setCampaigns(data.campaigns);
    setCases(data.cases);
    setVerifications(data.verifications);
    setDonations(data.donations);
    setNotifications(data.notifications);
    setSettings(data.settings);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Listen for real Supabase Google OAuth callbacks & session restoration
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;
      const pendingRaw = localStorage.getItem(PENDING_OAUTH_KEY);
      const pending = pendingRaw
        ? (JSON.parse(pendingRaw) as {
            role?: 'donor' | 'beneficiary' | 'verifier';
            district?: string;
            tehsil?: string;
            fullName?: string;
          })
        : {};
      localStorage.removeItem(PENDING_OAUTH_KEY);

      const fullName =
        pending.fullName ||
        (session.user.user_metadata?.full_name as string | undefined) ||
        session.user.email?.split('@')[0] ||
        'Amanat User';

      const prof = await dataClient.upsertUserProfile({
        auth_user_id: session.user.id,
        email: session.user.email ?? '',
        full_name: fullName,
        role: pending.role,
        district: pending.district,
        tehsil: pending.tehsil,
        applyAsVerifier: pending.role === 'verifier',
      });
      await refreshData();

      const resolvedRole: 'donor' | 'beneficiary' | 'verifier' =
        pending.role ??
        (prof.role === 'verifier' || prof.is_accredited_verifier
          ? 'verifier'
          : prof.role === 'beneficiary'
          ? 'beneficiary'
          : 'donor');

      const authSession: AuthUserSession = {
        id: session.user.id,
        email: session.user.email ?? '',
        full_name: prof.full_name || fullName,
        role: resolvedRole,
        provider: 'google',
        district: prof.district || pending.district || 'Lahore',
        tehsil: prof.tehsil || pending.tehsil || 'Lahore City',
        profile_id: prof.id,
      };
      setCurrentUser(authSession);
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(authSession));
      if (pending.role) {
        setActiveRole(pending.role);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshData]);

  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#admin') {
        if (hasValidAdminSession()) {
          setIsAdminAuthenticated(true);
          setActiveRole('admin');
        } else {
          setShowAdminAuthModal(true);
        }
      } else if (window.location.hash === '#volunteer') {
        setAuthModalRole('verifier');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleRequestAdminAccess = () => {
    if (hasValidAdminSession()) {
      setIsAdminAuthenticated(true);
      setActiveRole('admin');
    } else {
      setIsAdminAuthenticated(false);
      setShowAdminAuthModal(true);
    }
  };

  const handleLogoutAdmin = () => {
    clearAdminSession();
    setIsAdminAuthenticated(false);
    setActiveRole('donor');
    if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const handleUserAuthenticated = async (session: AuthUserSession) => {
    const prof = await dataClient.upsertUserProfile({
      email: session.email,
      full_name: session.full_name,
      role: session.role,
      district: session.district,
      tehsil: session.tehsil,
      applyAsVerifier: session.role === 'verifier',
    });
    const enriched: AuthUserSession = {
      ...session,
      full_name: prof.full_name || session.full_name,
      profile_id: prof.id,
    };
    await refreshData();
    setCurrentUser(enriched);
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(enriched));
    setAuthModalRole(null);
    setActiveRole(enriched.role);
  };

  const handleSignOutUser = () => {
    supabase?.auth.signOut().catch(() => {});
    setCurrentUser(null);
    localStorage.removeItem(USER_SESSION_KEY);
    if (activeRole !== 'admin') setActiveRole('donor');
  };

  const handleToggleLanguage = () => {
    const next = language === 'en' ? 'ur' : 'en';
    setLanguage(next);
    i18n.changeLanguage(next);
    applyDocumentDirection(next);
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setIsPWAInstalled(true);
      setDeferredPrompt(null);
    } else {
      alert(
        'Amanat is PWA-ready! Use your browser menu ("Install App" / "Add to Home Screen") to install offline.'
      );
    }
  };

  const totalVerifiedAidPkr =
    campaigns.reduce((acc, c) => acc + c.collected_amount_pkr, 0) +
    cases.reduce((acc, c) => acc + c.raised_amount_pkr, 0);

  const accreditedVerifiersCount = profiles.filter(
    (p) => p.role === 'verifier' && p.is_accredited_verifier
  ).length;

  return (
    <div id="top" className="min-h-screen islamic-grid-bg pb-24 md:pb-10 flex flex-col">
      <Header
        activeRole={activeRole}
        onChangeRole={(role) => {
          if (role === 'admin') {
            handleRequestAdminAccess();
          } else {
            setActiveRole(role);
          }
        }}
        isAdminAuthenticated={isAdminAuthenticated}
        onRequestAdminAccess={handleRequestAdminAccess}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        canInstallPWA={Boolean(deferredPrompt)}
        isPWAInstalled={isPWAInstalled}
        onInstallPWA={handleInstallPWA}
        dataMode={dataClient.mode}
        notifications={notifications}
        onMarkNotificationRead={async (id) => {
          await dataClient.markNotificationRead(id);
          await refreshData();
        }}
        onMarkAllNotificationsRead={async () => {
          await dataClient.markAllNotificationsRead();
          await refreshData();
        }}
        currentUser={currentUser}
        onOpenUserAuth={(role) => setAuthModalRole(role ?? 'donor')}
        onSignOutUser={handleSignOutUser}
        onOpenVerifierScanner={() => setShowVerifierScanner(true)}
      />

      <main className="flex-1">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-sm font-bold text-emerald-900">
            Loading Amanat Escrow Ledger...
          </div>
        ) : activeRole === 'donor' ? (
          <>
            <HeroSection
              onExploreCases={() => {
                document.getElementById('cases')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onRequestAssistance={() => setActiveRole('beneficiary')}
              onSelectCategory={(cat) => {
                setCaseFilter(cat as CaseFilterKey);
                document.getElementById('cases')?.scrollIntoView({ behavior: 'smooth' });
              }}
              onOpenVerifierScanner={() => setShowVerifierScanner(true)}
            />

            <TransparencyStrip
              totalVerifiedAidPkr={totalVerifiedAidPkr}
              accreditedVerifiersCount={accreditedVerifiersCount}
            />

            {currentUser && (
              <DonorDashboard
                user={currentUser}
                donations={donations}
                campaigns={campaigns}
                cases={cases}
                onSignOut={handleSignOutUser}
                onExploreDrives={() => {
                  document.getElementById('campaigns')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            )}

            <CampaignsSection
              campaigns={campaigns}
              language={language}
              onDonate={(target) => setDonationTarget(target)}
            />

            <CasesSection
              cases={cases}
              profiles={profiles}
              language={language}
              activeFilter={caseFilter}
              onChangeFilter={setCaseFilter}
              onDonate={(target) => setDonationTarget(target)}
            />

            <EscrowPipeline />
          </>
        ) : activeRole === 'beneficiary' ? (
          <BeneficiaryWorkspace
            currentUser={currentUser}
            onOpenAuth={() => setAuthModalRole('beneficiary')}
            onOpenVerifierScanner={() => setShowVerifierScanner(true)}
            cases={cases}
            profiles={profiles}
            onSubmitCase={async (payload) => {
              const created = await dataClient.submitBeneficiaryCase(payload);
              await refreshData();
              return created;
            }}
          />
        ) : activeRole === 'verifier' ? (
          <VerifierWorkspace
            currentUser={currentUser}
            profiles={profiles}
            onOpenAuth={() => setAuthModalRole('verifier')}
            onApplyAsVerifier={async (district, tehsil) => {
              if (!currentUser) return;
              const prof = await dataClient.upsertUserProfile({
                auth_user_id: currentUser.id,
                email: currentUser.email,
                full_name: currentUser.full_name,
                district,
                tehsil,
                role: 'verifier',
                applyAsVerifier: true,
              });
              const updated = { ...currentUser, profile_id: prof.id, district, tehsil };
              setCurrentUser(updated);
              localStorage.setItem(USER_SESSION_KEY, JSON.stringify(updated));
              await refreshData();
            }}
            cases={cases}
            verifications={verifications}
            onSubmitVerification={async (payload) => {
              await dataClient.submitFieldVerification(payload);
              await refreshData();
            }}
            onSyncOffline={async () => {
              const count = await dataClient.syncOfflineVerifications();
              await refreshData();
              return count;
            }}
          />
        ) : isAdminAuthenticated ? (
          <AdminWorkspace
            campaigns={campaigns}
            cases={cases}
            donations={donations}
            profiles={profiles}
            notifications={notifications}
            settings={settings}
            onCreateCampaign={async (payload) => {
              const created = await dataClient.createCampaign(payload);
              await refreshData();
              return created;
            }}
            onUpdateCampaignStatus={async (id, status) => {
              await dataClient.updateCampaignStatus(id, status);
              await refreshData();
            }}
            onConfirmDonation={async (donationId) => {
              await dataClient.confirmDonation(donationId);
              await refreshData();
            }}
            onApproveCase={async (caseId) => {
              await dataClient.approveCase(caseId);
              await refreshData();
            }}
            onAssignVerifier={async (caseId, verifierId) => {
              await dataClient.assignVerifierToCase(caseId, verifierId);
              await refreshData();
            }}
            onToggleVerifier={async (profileId, accredited) => {
              await dataClient.toggleVerifierAccreditation(profileId, accredited);
              await refreshData();
            }}
            onUploadCampaignReceipt={async (id, receiptUrl) => {
              await dataClient.uploadCampaignPaidReceipt(id, receiptUrl);
              await refreshData();
            }}
            onUploadCaseReceipt={async (id, receiptUrl) => {
              await dataClient.uploadCasePaidReceipt(id, receiptUrl);
              await refreshData();
            }}
            onSaveSettings={async (nextSettings) => {
              const saved = await dataClient.saveAppSettings(nextSettings);
              setSettings(saved);
            }}
            onSendTestNotification={async () => {
              await dataClient.sendTestMilestoneNotification();
              await refreshData();
            }}
            onDeleteCampaign={async (id) => {
              await dataClient.deleteCampaign(id);
              await refreshData();
            }}
            onDeleteCase={async (id) => {
              await dataClient.deleteCase(id);
              await refreshData();
            }}
            onDeleteDonation={async (id) => {
              await dataClient.deleteDonation(id);
              await refreshData();
            }}
            onDeleteProfile={async (id) => {
              await dataClient.deleteProfile(id);
              await refreshData();
            }}
            onFlushDummyData={async () => {
              await dataClient.flushAllDummyData();
              await refreshData();
            }}
            onLogoutAdmin={handleLogoutAdmin}
          />
        ) : null}
      </main>

      <footer className="mt-10 border-t border-emerald-900/10 bg-white/80 py-8 text-center text-xs font-medium text-slate-500">
        <div className="mx-auto max-w-7xl px-4 space-y-4">
          <SocialBar links={settings.social_links} />
          <div>
            <p className="font-bold text-emerald-950">
              {t('appName')} ({t('appNameUr')}) — {t('tagline')}
            </p>
            <p className="mt-1">{t('footer.zeroCost')}</p>
          </div>
        </div>
      </footer>

      <MobileBottomNav
        activeRole={activeRole}
        isAdminAuthenticated={isAdminAuthenticated}
        onChangeRole={setActiveRole}
        onRequestAdminAccess={handleRequestAdminAccess}
      />

      <AdminAuthModal
        isOpen={showAdminAuthModal}
        settings={settings}
        onClose={() => setShowAdminAuthModal(false)}
        onAuthenticated={() => {
          setIsAdminAuthenticated(true);
          setShowAdminAuthModal(false);
          setActiveRole('admin');
        }}
      />

      <UserAuthModal
        isOpen={authModalRole !== null}
        defaultRole={authModalRole ?? 'donor'}
        onClose={() => setAuthModalRole(null)}
        onSuccess={handleUserAuthenticated}
      />

      <VerifierQrScannerModal
        isOpen={showVerifierScanner}
        profiles={profiles}
        onClose={() => setShowVerifierScanner(false)}
      />

      <PaymentModal
        target={donationTarget}
        language={language}
        escrowAccounts={settings.escrow_accounts}
        defaultDonorEmail={currentUser?.email ?? ''}
        onClose={() => setDonationTarget(null)}
        onSubmitPledge={async (payload) => {
          const created = await dataClient.submitDonationPledge(payload);
          await refreshData();
          return created;
        }}
      />
    </div>
  );
}
