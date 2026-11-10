import CreateUserForm from '@/components/CreateUserForm';
import UserControls from '@/components/UserControls';
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
      <h1 className="text-2xl font-semibold">Users</h1>
      <CreateUserForm />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">ID</th>
            <th className="p-2">Name</th>
            <th className="p-2">Email</th>
            <th className="p-2">Role</th>
            <th className="p-2">Active</th>
            <th className="p-2">Created</th>
            <th className="p-2">Curator profile</th>
            <th className="p-2">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} className={`border-b ${r.is_active ? '' : 'text-gray-400'}`}>
              <td className="p-2">{r.user_id}</td>
              <td className="p-2">{r.full_name}</td>
              <td className="p-2">{r.email}</td>
              <td className="p-2">{r.role}</td>
              <td className="p-2">{r.is_active ? 'yes' : 'no'}</td>
              <td className="p-2">{r.created_at.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}</td>
              <td className="p-2">{r.curator_id ? `#${r.curator_id} ${r.specialization}` : '—'}</td>
              <td className="p-2">
                {r.user_id === user.user_id ? (
                  <span className="text-gray-400">(you)</span>
                ) : (
                  <UserControls userId={r.user_id} role={r.role} isActive={r.is_active} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
