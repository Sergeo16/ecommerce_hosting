'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';

type UserRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt: string;
};

export default function AdminUsersPage() {
  const { user, token } = useAuth();
  const { t } = useLocale();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token || user?.role !== 'SUPER_ADMIN') return;
    setLoading(true);
    const params = new URLSearchParams();
    if (filterRole) params.set('role', filterRole);
    if (filterStatus) params.set('status', filterStatus);
    fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [token, user?.role, filterRole, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED') {
    if (!token) return;
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, status }),
      });
      if (res.ok) load();
    } finally {
      setUpdatingId(null);
    }
  }

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="p-8">
        <p>{t('accessReservedAdmin')}</p>
        <Link href="/dashboard" className="btn btn-ghost mt-4">{t('back')}</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AppLogo className="btn btn-ghost btn-sm text-base" />
          <Link href="/dashboard" className="btn btn-ghost btn-sm">← {t('dashboard')}</Link>
        </div>
        <div className="flex gap-1">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-6">{t('users')}</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="select select-bordered select-sm"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">{t('filterByRole')} — tous</option>
          <option value="CLIENT">CLIENT</option>
          <option value="AFFILIATE">AFFILIATE</option>
          <option value="SUPPLIER">SUPPLIER</option>
          <option value="COURIER">COURIER</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </select>
        <select
          className="select select-bordered select-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">{t('filterByStatus')} — tous</option>
          <option value="ACTIVE">{t('active')}</option>
          <option value="SUSPENDED">{t('suspended')}</option>
          <option value="BLOCKED">{t('blocked')}</option>
        </select>
      </div>

      {loading ? (
        <span className="loading loading-spinner" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nom</th>
                <th>{t('filterByRole')}</th>
                <th>{t('filterByStatus')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono text-sm">{u.email}</td>
                  <td>{u.firstName} {u.lastName}</td>
                  <td><span className="badge badge-ghost">{u.role}</span></td>
                  <td><span className="badge">{u.status}</span></td>
                  <td>
                    {updatingId === u.id ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.status !== 'ACTIVE' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-success"
                            onClick={() => setStatus(u.id, 'ACTIVE')}
                          >
                            {t('active')}
                          </button>
                        )}
                        {u.status !== 'SUSPENDED' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setStatus(u.id, 'SUSPENDED')}
                          >
                            {t('suspended')}
                          </button>
                        )}
                        {u.status !== 'BLOCKED' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-error"
                            onClick={() => setStatus(u.id, 'BLOCKED')}
                          >
                            {t('blocked')}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm opacity-70 mt-2">{total} utilisateur(s)</p>
        </div>
      )}
    </div>
  );
}
