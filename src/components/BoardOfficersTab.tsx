import React, { useState } from 'react';
import {
  UserPlus,
  ShieldCheck,
  KeyRound,
  Ban,
  CheckCircle2,
  Download,
  History,
  MapPin,
} from 'lucide-react';
import type { AdminAuditLog, AdminOfficer, OfficerPermissionTier } from '@/types/amanat';
import { PUNJAB_DISTRICTS } from '@/lib/seedData';
import { formatCnicInput, formatPKR } from '@/lib/utils';
import { exportAuditLogsCsv } from '@/lib/csvExport';
import { Badge, Button, Card, Input, Select } from './ui/primitives';

interface BoardOfficersTabProps {
  officers: AdminOfficer[];
  auditLogs: AdminAuditLog[];
  onCreateOfficer: (payload: {
    full_name: string;
    cnic_number: string;
    phone: string;
    email: string;
    username: string;
    password: string;
    permission_tier: OfficerPermissionTier;
    district_scope: string;
    max_approval_pkr: number | null;
  }) => Promise<AdminOfficer>;
  onUpdateOfficer: (
    id: string,
    patch: Partial<
      Pick<AdminOfficer, 'is_active' | 'permission_tier' | 'district_scope' | 'max_approval_pkr'>
    >,
    auditDetails: string
  ) => Promise<void>;
  onResetOfficerPassword: (id: string, newPassword: string) => Promise<void>;
  onNotice: (msg: string) => void;
}

export function BoardOfficersTab({
  officers,
  auditLogs,
  onCreateOfficer,
  onUpdateOfficer,
  onResetOfficerPassword,
  onNotice,
}: BoardOfficersTabProps) {
  const [fullName, setFullName] = useState('');
  const [cnic, setCnic] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tier, setTier] = useState<OfficerPermissionTier>('partial_approve');
  const [districtScope, setDistrictScope] = useState('all');
  const [maxCapPkr, setMaxCapPkr] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (cnic.replace(/\D/g, '').length < 13) {
      setFormError('Please enter a valid 13-digit CNIC number (e.g. 35202-1234567-1).');
      return;
    }
    setCreating(true);
    try {
      const capNum =
        tier === 'full_approve' && maxCapPkr.trim() ? Math.max(1000, Number(maxCapPkr)) : null;
      const created = await onCreateOfficer({
        full_name: fullName,
        cnic_number: cnic,
        phone,
        email,
        username,
        password,
        permission_tier: tier,
        district_scope: districtScope,
        max_approval_pkr: capNum,
      });
      setFullName('');
      setCnic('');
      setPhone('');
      setEmail('');
      setUsername('');
      setPassword('');
      setMaxCapPkr('');
      onNotice(
        `Created Board Officer "${created.full_name}" (username: ${created.username}). Welcome email dispatched to ${created.email}.`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create Board Officer.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Create New Board Officer */}
      <Card className="lg:col-span-5 p-6 space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-gold-600" />
            Create Board Officer (Sub-Admin)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Board Officers can ONLY access <strong>Individual Cases &amp; Donations</strong>. None
            can delete entries, approve Field Verifiers, or view Settings/Escrow accounts.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Full Name *</label>
              <Input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Tariq Mahmood"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">CNIC Number *</label>
              <Input
                required
                value={cnic}
                onChange={(e) => setCnic(formatCnicInput(e.target.value))}
                placeholder="35202-1234567-1"
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Contact Phone *</label>
              <Input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Official Email *</label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@gmail.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Login Username *
              </label>
              <Input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="e.g. tariq.kasur"
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                Initial Password * (min 6)
              </label>
              <Input
                required
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">
              Authorization Tier *
            </label>
            <Select
              value={tier}
              onChange={(e) => setTier(e.target.value as OfficerPermissionTier)}
            >
              <option value="partial_approve">
                Tier 1: Reject &amp; Partial Approval (Master Admin gives final sign-off)
              </option>
              <option value="full_approve">
                Tier 2: Reject &amp; Full Approval (+ Read-Only Verifiers view)
              </option>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">
                District Scope (Optional)
              </label>
              <Select value={districtScope} onChange={(e) => setDistrictScope(e.target.value)}>
                <option value="all">All Punjab Districts</option>
                {Object.keys(PUNJAB_DISTRICTS).map((d) => (
                  <option key={d} value={d}>
                    {d} Only
                  </option>
                ))}
              </Select>
            </div>
            {tier === 'full_approve' && (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Max Auto-Approve Cap (PKR)
                </label>
                <Input
                  type="number"
                  min={1000}
                  step={5000}
                  value={maxCapPkr}
                  onChange={(e) => setMaxCapPkr(e.target.value)}
                  placeholder="Blank = Unlimited"
                />
              </div>
            )}
          </div>

          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
              {formError}
            </div>
          )}

          <Button type="submit" variant="primary" size="md" className="w-full" disabled={creating}>
            <ShieldCheck className="h-4 w-4" />
            <span>{creating ? 'Creating Officer...' : 'Create Board Officer Account'}</span>
          </Button>
        </form>
      </Card>

      {/* Right: Officers Roster + Immutable Audit Activity Log */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="p-6 space-y-3.5">
          <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            Active &amp; Revoked Board Officers ({officers.length})
          </h2>

          {officers.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              No Board Officers created yet. Use the form on the left to delegate case &amp;
              donation reviews safely as Amanat scales.
            </p>
          ) : (
            <div className="space-y-3">
              {officers.map((off) => (
                <div
                  key={off.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-extrabold text-emerald-950">
                          {off.full_name}
                        </span>
                        <span className="font-mono text-[11px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          @{off.username}
                        </span>
                        <Badge variant={off.is_active ? 'emerald' : 'rose'}>
                          {off.is_active ? 'ACTIVE' : 'REVOKED'}
                        </Badge>
                        <Badge variant={off.permission_tier === 'full_approve' ? 'gold' : 'slate'}>
                          {off.permission_tier === 'full_approve'
                            ? 'Tier 2: Full Approver'
                            : 'Tier 1: Partial Approver'}
                        </Badge>
                      </div>
                      <p className="text-slate-600">
                        CNIC: <span className="font-mono font-bold">{off.cnic_number}</span> ·{' '}
                        {off.phone} · {off.email}
                      </p>
                      <p className="text-[11px] text-emerald-800 font-semibold flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Scope: {off.district_scope === 'all' ? 'All Punjab' : off.district_scope}
                        </span>
                        {off.permission_tier === 'full_approve' && (
                          <span>
                            · Approval Cap:{' '}
                            {off.max_approval_pkr
                              ? formatPKR(off.max_approval_pkr)
                              : 'Unlimited'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const nextTier: OfficerPermissionTier =
                          off.permission_tier === 'full_approve'
                            ? 'partial_approve'
                            : 'full_approve';
                        await onUpdateOfficer(
                          off.id,
                          { permission_tier: nextTier },
                          `Changed @${off.username} tier to ${nextTier}`
                        );
                        onNotice(`Updated @${off.username} to ${nextTier.replace('_', ' ')}.`);
                      }}
                    >
                      Switch to{' '}
                      {off.permission_tier === 'full_approve' ? 'Tier 1 (Partial)' : 'Tier 2 (Full)'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const nextPw = window.prompt(
                          `Enter new password for Board Officer @${off.username} (min 6 chars):`
                        );
                        if (!nextPw) return;
                        if (nextPw.trim().length < 6) {
                          window.alert('Password must be at least 6 characters.');
                          return;
                        }
                        await onResetOfficerPassword(off.id, nextPw.trim());
                        onNotice(`Password reset cleanly for @${off.username}.`);
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset Password
                    </Button>

                    <Button
                      type="button"
                      variant={off.is_active ? 'danger' : 'primary'}
                      size="sm"
                      onClick={async () => {
                        await onUpdateOfficer(
                          off.id,
                          { is_active: !off.is_active },
                          off.is_active
                            ? `Revoked access for @${off.username}`
                            : `Reactivated @${off.username}`
                        );
                        onNotice(
                          off.is_active
                            ? `Revoked access for @${off.username}.`
                            : `Reactivated Board Officer @${off.username}.`
                        );
                      }}
                    >
                      {off.is_active ? (
                        <>
                          <Ban className="h-3.5 w-3.5" />
                          Revoke Access
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Reactivate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Immutable Audit Activity Log */}
        <Card className="p-6 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-emerald-950 flex items-center gap-2">
              <History className="h-5 w-5 text-gold-600" />
              Immutable Audit Activity Log ({auditLogs.length})
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={auditLogs.length === 0}
              onClick={() => exportAuditLogsCsv(auditLogs)}
            >
              <Download className="h-3.5 w-3.5" />
              Export Audit CSV
            </Button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
              All approvals, partial approvals, rejections, officer changes, and password resets
              will appear here with actor &amp; timestamp.
            </p>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs space-y-0.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-emerald-950">{log.actor_name}</span>
                      <Badge
                        variant={log.actor_role === 'master_admin' ? 'emerald' : 'gold'}
                      >
                        {log.action}
                      </Badge>
                      <span className="font-mono font-bold text-slate-700">{log.target_code}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.created_at).toLocaleString('en-GB')}
                    </span>
                  </div>
                  {log.details && <p className="text-[11px] text-slate-600">{log.details}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
