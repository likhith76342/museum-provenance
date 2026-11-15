import CreateUserForm from '@/components/CreateUserForm';
import UserControls from '@/components/UserControls';
import { Badge } from '@/components/ui/Badge';
import { RoleBadge } from '@/components/ui/badges';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import { requireUser } from '@/lib/auth';
import { withRole } from '@/lib/db';
import type { Role } from '@/lib/types';

type UserRow = {
  user_id: number;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
  curator_id: number | null;
  specialization: string | null;
};

export default async function AdminUsersPage() {
  const user = await requireUser(['admin']);
  const rows = await withRole(user, async (db) => (await db.query<UserRow>(`
    SELECT u.user_id, u.full_name, u.email, u.role, u.is_active, u.created_at,
           c.curator_id, c.specialization
    FROM users u
    LEFT JOIN curators c ON c.user_id = u.user_id
    ORDER BY u.user_id
  `)).rows);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle={`${rows.length} accounts`} />
      <Card title="Create user">
        <CreateUserForm />
      </Card>
      <Table>
        <THead>
          <tr>
            <TH className="text-right">ID</TH>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Active</TH>
            <TH>Created</TH>
            <TH>Curator profile</TH>
            <TH>Change</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.user_id} className={r.is_active ? '' : 'text-stone-400'}>
              <TD className="text-right tabular-nums">{r.user_id}</TD>
              <TD className="min-w-40 font-medium">
                {r.full_name}
                {r.user_id === user.user_id && <span className="ml-1.5 text-xs font-normal text-stone-500">(you)</span>}
              </TD>
              <TD className="font-mono text-xs">{r.email}</TD>
              <TD><RoleBadge role={r.role} /></TD>
              <TD>{r.is_active ? <Badge tone="good">Active</Badge> : <Badge>Inactive</Badge>}</TD>
              <TD className="whitespace-nowrap tabular-nums">
                {r.created_at.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
              </TD>
              <TD className="min-w-40">
                {r.curator_id ? `#${r.curator_id} ${r.specialization}` : <span className="text-stone-400">—</span>}
              </TD>
              <TD>
                {r.user_id === user.user_id ? (
                  <span className="text-xs text-stone-400">Can&apos;t change your own account</span>
                ) : (
                  <UserControls userId={r.user_id} role={r.role} isActive={r.is_active} />
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
