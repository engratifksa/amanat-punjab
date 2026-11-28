import type {
  AppSettings,
  CrowdfundingCampaign,
  Donation,
  FieldVerification,
  NotificationRecord,
  NotificationSubscription,
  Profile,
  WelfareCase,
} from '@/types/amanat';

export const BACKUP_SCHEMA_VERSION = 'amanat-backup-v1';

export interface AmanatBackupPayload {
  app_settings: AppSettings | null;
  profiles: Profile[];
  crowdfunding_campaigns: CrowdfundingCampaign[];
  cases: WelfareCase[];
  field_verifications: FieldVerification[];
  donations: Donation[];
  notification_subscriptions: NotificationSubscription[];
  notifications: NotificationRecord[];
}

export interface AmanatBackupCounts {
  profiles: number;
  crowdfunding_campaigns: number;
  cases: number;
  field_verifications: number;
  donations: number;
  notification_subscriptions: number;
  notifications: number;
}

export interface AmanatBackupBundle {
  schema_version: typeof BACKUP_SCHEMA_VERSION;
  exported_at: string;
  source_mode: 'real';
  checksum_sha256: string;
  counts: AmanatBackupCounts;
  data: AmanatBackupPayload;
}

export interface BackupTableDiff {
  totalInBackup: number;
  newCount: number;
  existingCount: number;
}

export interface BackupRestorePreview {
  exportedAt: string;
  checksumVerified: boolean;
  hasSettings: boolean;
  tables: {
    profiles: BackupTableDiff;
    crowdfunding_campaigns: BackupTableDiff;
    cases: BackupTableDiff;
    field_verifications: BackupTableDiff;
    donations: BackupTableDiff;
    notifications: BackupTableDiff;
  };
}

export interface BackupRestoreResult {
  restoredCounts: AmanatBackupCounts;
  settingsRestored: boolean;
}

export async function computePayloadChecksum(data: AmanatBackupPayload): Promise<string> {
  const canonical = JSON.stringify(data);
  const bytes = new TextEncoder().encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildBackupBundle(
  data: AmanatBackupPayload
): Promise<AmanatBackupBundle> {
  // Guarantee strictly real data only (never include is_demo = true rows in a real backup)
  const cleanData: AmanatBackupPayload = {
    app_settings: data.app_settings,
    profiles: data.profiles.filter((r) => !r.is_demo).map((r) => ({ ...r, is_demo: false })),
    crowdfunding_campaigns: data.crowdfunding_campaigns
      .filter((r) => !r.is_demo)
      .map((r) => ({ ...r, is_demo: false })),
    cases: data.cases.filter((r) => !r.is_demo).map((r) => ({ ...r, is_demo: false })),
    field_verifications: data.field_verifications
      .filter((r) => !r.is_demo)
      .map((r) => ({ ...r, is_demo: false })),
    donations: data.donations.filter((r) => !r.is_demo).map((r) => ({ ...r, is_demo: false })),
    notification_subscriptions: data.notification_subscriptions ?? [],
    notifications: data.notifications
      .filter((r) => !(r as NotificationRecord & { is_demo?: boolean }).is_demo)
      .map((r) => ({ ...r })),
  };

  const checksum_sha256 = await computePayloadChecksum(cleanData);

  return {
    schema_version: BACKUP_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    source_mode: 'real',
    checksum_sha256,
    counts: {
      profiles: cleanData.profiles.length,
      crowdfunding_campaigns: cleanData.crowdfunding_campaigns.length,
      cases: cleanData.cases.length,
      field_verifications: cleanData.field_verifications.length,
      donations: cleanData.donations.length,
      notification_subscriptions: cleanData.notification_subscriptions.length,
      notifications: cleanData.notifications.length,
    },
    data: cleanData,
  };
}

export async function parseAndVerifyBackupJson(
  rawJson: string
): Promise<{ bundle: AmanatBackupBundle; checksumVerified: boolean }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid JSON file. Please select a valid Amanat backup (.json) file.');
  }

  const obj = parsed as Partial<AmanatBackupBundle>;
  if (
    !obj ||
    obj.schema_version !== BACKUP_SCHEMA_VERSION ||
    !obj.data ||
    !Array.isArray(obj.data.profiles) ||
    !Array.isArray(obj.data.crowdfunding_campaigns) ||
    !Array.isArray(obj.data.cases) ||
    !Array.isArray(obj.data.donations)
  ) {
    throw new Error(
      'Unrecognized backup format. Expected an Amanat Live Backup file (amanat-backup-v1).'
    );
  }

  const expectedChecksum = await computePayloadChecksum(obj.data);
  const checksumVerified =
    Boolean(obj.checksum_sha256) && obj.checksum_sha256 === expectedChecksum;

  if (!checksumVerified) {
    throw new Error(
      'Backup integrity check failed (SHA-256 mismatch). The file may be corrupted or modified.'
    );
  }

  return {
    bundle: obj as AmanatBackupBundle,
    checksumVerified,
  };
}

export function triggerBackupDownload(bundle: AmanatBackupBundle): void {
  const stamp = new Date(bundle.exported_at)
    .toISOString()
    .replace(/[:T]/g, '-')
    .slice(0, 16);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Amanat-Live-Backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
