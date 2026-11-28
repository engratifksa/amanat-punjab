import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AdminAuditLog,
  AdminOfficer,
  AdminSessionInfo,
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
import { clearAdminSession, getAdminSession, hasValidAdminSession } from '@/lib/adminAuth';
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
import { ReceiptVerifyModal } from '@/components/ReceiptVerifyModal';
import { SocialShareModal, type ShareableItem } from '@/components/SocialShareModal';
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
  const [adminSession, setAdminSession] = useState<AdminSessionInfo>(() =>
    getAdminSession() ?? { role: 'master_admin', actorName: 'Master Admin', officer: null }
  );
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [showVerifierScanner, setShowVerifierScanner] = useState(false);
  const [verifyQrHash, setVerifyQrHash] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('verify');
  });

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
  const [shareItem, setShareItem] = useState<ShareableItem | null>(null);
  const [highlightedCode, setHighlightedCode] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [campaigns, setCampaigns] = useState<CrowdfundingCampaign[]>([]);
  const [cases, setCases] = useState<WelfareCase[]>([]);
  const [verifications, setVerifications] = useState<FieldVerification[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [officers, setOfficers] = useState<AdminOfficer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
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
    setOfficers(data.officers ?? []);
    setAuditLogs(data.auditLogs ?? []);
    setSettings(data.settings);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Deep-link support: ?campaign=AMN-CF-04 or ?case=AMN-LHR-001
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const campCode = params.get('campaign');
    const caseCode = params.get('case');
    const targetCode = campCode || caseCode;
    if (!targetCode) return;

    setActiveRole('donor');
    setHighlightedCode(targetCode);
    const elId = campCode ? `campaign-${campCode}` : `case-${caseCode}`;
    const timer = window.setTimeout(() => {
      document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
    const clearTimer = window.setTimeout(() => {
      setHighlightedCode(null);
    }, 6500);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [loading]);

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
        applyAsVerifier: false,
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
    setAdminSession({ role: 'master_admin', actorName: 'Master Admin', officer: null });
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
      applyAsVerifier: false,
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
        {settings.app_mode === 'training' && (
          <div className="bg-gradient-to-r from-amber-500 via-gold-500 to-amber-500 text-emerald-950 px-4 py-2 text-center text-xs font-extrabold shadow-sm">
            TRAINING / DEMO MODE ACTIVE — Viewing Sample Dummy Data Only · All Real Live Data Is Safely Isolated
          </div>
        )}
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
              highlightedCode={highlightedCode}
              onDonate={(target) => setDonationTarget(target)}
              onShare={(item) => setShareItem(item)}
            />

            <CasesSection
              cases={cases}
              profiles={profiles}
              language={language}
              activeFilter={caseFilter}
              highlightedCode={highlightedCode}
              onChangeFilter={setCaseFilter}
              onDonate={(target) => setDonationTarget(target)}
              onShare={(item) => setShareItem(item)}
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
            onApplyAsVerifier={async ({ district, tehsil, cnic_number, phone, photo_url }) => {
              if (!currentUser) return;
              const prof = await dataClient.upsertUserProfile({
                auth_user_id: currentUser.id,
                email: currentUser.email,
                full_name: currentUser.full_name,
                district,
                tehsil,
                cnic_number,
                phone,
                photo_url,
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
            adminSession={adminSession}
            officers={officers}
            auditLogs={auditLogs}
            campaigns={campaigns}
            cases={cases}
            verifications={verifications}
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
            onUpdateDonationStatus={async (donationId, status, reason, partialBy) => {
              await dataClient.updateDonationStatus(donationId, status, reason, partialBy);
              await refreshData();
            }}
            onApproveCase={async (caseId) => {
              await dataClient.approveCase(caseId);
              await refreshData();
            }}
            onUpdateCaseStatus={async (caseId, status, reason, partialBy) => {
              await dataClient.updateCaseStatus(caseId, status, reason, partialBy);
              await refreshData();
            }}
            onCreateOfficer={async (payload) => {
              const created = await dataClient.createAdminOfficer(payload);
              await refreshData();
              return created;
            }}
            onUpdateOfficer={async (id, patch, details) => {
              await dataClient.updateAdminOfficer(id, patch, details);
              await refreshData();
            }}
            onResetOfficerPassword={async (id, newPassword) => {
              await dataClient.resetOfficerPassword(id, newPassword);
              await refreshData();
            }}
            onLogAudit={async (entry) => {
              await dataClient.logAdminAudit(entry);
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
            onSetAppMode={async (mode) => {
              const saved = await dataClient.setAppMode(mode);
              setSettings(saved);
              await refreshData();
            }}
            onReseedTrainingData={async () => {
              await dataClient.reseedTrainingData();
              await refreshData();
            }}
            onExportRealBackup={() => dataClient.exportRealDataBackup()}
            onPreviewBackupRestore={(bundle) => dataClient.previewBackupRestore(bundle)}
            onRestoreRealBackup={async (bundle) => {
              const res = await dataClient.restoreRealDataBackup(bundle);
              await refreshData();
              return res;
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
        onAuthenticated={(session) => {
          setAdminSession(session);
          setIsAdminAuthenticated(true);
          setShowAdminAuthModal(false);
          setActiveRole('admin');
        }}
        onAuthenticateOfficer={(username, password) =>
          dataClient.authenticateOfficer(username, password)
        }
        onRequestPasswordRecovery={() => dataClient.requestAdminPasswordRecovery()}
        onCompletePasswordRecovery={async (code, newPassword) => {
          await dataClient.completeAdminPasswordRecovery(code, newPassword);
          await refreshData();
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
        assignedCaseForUser={
          currentUser
            ? cases.find(
                (c) =>
                  c.assigned_verifier_id &&
                  c.beneficiary_account_email?.toLowerCase() ===
                    currentUser.email.trim().toLowerCase() &&
                  c.status === 'pending_field_visit'
              ) ?? null
            : null
        }
        onClose={() => setShowVerifierScanner(false)}
      />

      <ReceiptVerifyModal
        qrHash={verifyQrHash}
        donations={donations}
        campaigns={campaigns}
        cases={cases}
        onClose={() => {
          setVerifyQrHash(null);
          if (window.location.search.includes('verify=')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
      />

      <PaymentModal
        target={donationTarget}
        language={language}
        escrowAccounts={settings.escrow_accounts}
        defaultDonorEmail={currentUser?.email ?? ''}
        onClose={() => setDonationTarget(null)}
        onShareTarget={
          donationTarget
            ? () => {
                if (donationTarget.type === 'campaign') {
                  const found = campaigns.find((c) => c.id === donationTarget.id);
                  if (found) {
                    setShareItem({
                      type: 'campaign',
                      code: found.campaign_code,
                      title_en: found.title_en,
                      title_ur: found.title_ur,
                      summary_en: found.summary_en,
                      summary_ur: found.summary_ur,
                      district: found.district,
                      category: found.category,
                      funding_type: found.funding_type,
                      vendor_name: found.vendor_name,
                      target_amount_pkr: found.target_amount_pkr,
                      collected_amount_pkr: found.collected_amount_pkr,
                      donor_count: found.donor_count,
                    });
                    return;
                  }
                } else {
                  const found = cases.find((c) => c.id === donationTarget.id);
                  if (found) {
                    setShareItem({
                      type: 'case',
                      code: found.case_code,
                      title_en: `${found.case_code} — ${found.district}`,
                      title_ur: `${found.district} میں مستحق خاندان کی امداد (${found.case_code})`,
                      summary_en: found.anonymized_story_en,
                      summary_ur: found.anonymized_story_ur,
                      district: found.district,
                      tehsil: found.tehsil,
                      category: found.category,
                      funding_type: found.funding_type,
                      vendor_name: found.vendor_name,
                      target_amount_pkr: found.target_amount_pkr,
                      collected_amount_pkr: found.raised_amount_pkr,
                    });
                    return;
                  }
                }
                setShareItem({
                  type: donationTarget.type,
                  code: donationTarget.code,
                  title_en: donationTarget.title_en,
                  title_ur: donationTarget.title_ur,
                  summary_en: `Verified Direct Vendor Escrow initiative in ${donationTarget.district}, Punjab.`,
                  summary_ur: `${donationTarget.district}، پنجاب میں تصدیق شدہ براہِ راست وینڈر ایسکرو مہم۔`,
                  district: donationTarget.district,
                  category: 'welfare',
                  funding_type: donationTarget.funding_type,
                  vendor_name: donationTarget.vendor_name,
                  target_amount_pkr: donationTarget.target_amount_pkr,
                  collected_amount_pkr: donationTarget.collected_amount_pkr,
                });
              }
            : undefined
        }
        onSubmitPledge={async (payload) => {
          const created = await dataClient.submitDonationPledge(payload);
          await refreshData();
          return created;
        }}
      />

      <SocialShareModal item={shareItem} onClose={() => setShareItem(null)} />
    </div>
  );
}
