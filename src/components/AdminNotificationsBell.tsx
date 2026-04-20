'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: { orderId?: string; orderNumber?: string } | null;
  readAt: string | null;
  createdAt: string;
};

export function AdminNotificationsBell({ token }: { token: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
  }, [open]);

  const fetchNotifs = useCallback(async (unreadOnly = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?unreadOnly=${unreadOnly}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotifs(false);
    const iv = setInterval(() => fetchNotifs(false), 60000);
    return () => clearInterval(iv);
  }, [fetchNotifs]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target) && !document.getElementById('notifications-dropdown-portal')?.contains(target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [open]);

  async function markRead(id: string) {
    if (!token) return;
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchNotifs(false);
  }

  const dropdown = open && typeof document !== 'undefined' && createPortal(
    <div
      id="notifications-dropdown-portal"
      className="fixed z-[200] w-80 sm:w-96 max-h-[70vh] overflow-y-auto shadow-xl bg-base-100 border border-base-300 rounded-box py-2"
      role="menu"
      style={{ top: position.top, right: position.right, left: 'auto' }}
    >
      <div className="px-4 py-2 border-b border-base-300 font-semibold flex justify-between items-center">
        <span>Notifications</span>
        <Link href="/dashboard/admin/orders" className="link link-primary text-sm" onClick={() => setOpen(false)}>
          Voir les commandes
        </Link>
      </div>
      {loading ? (
        <div className="p-4 text-center text-base-content/70">Chargement...</div>
      ) : notifications.length === 0 ? (
        <div className="p-4 text-center text-base-content/70">Aucune notification</div>
      ) : (
        <ul className="divide-y divide-base-300">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`px-4 py-3 hover:bg-base-200 cursor-pointer ${!n.readAt ? 'bg-primary/5' : ''}`}
              onClick={() => {
                if (!n.readAt) markRead(n.id);
                if (n.data?.orderId) window.location.href = `/dashboard/admin/orders?highlight=${n.data.orderId}`;
                setOpen(false);
              }}
            >
              <p className="font-medium text-sm">{n.title}</p>
              {n.body && <p className="text-xs text-base-content/70 mt-0.5 line-clamp-2">{n.body}</p>}
              <p className="text-xs opacity-60 mt-1">
                {new Date(n.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  );

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square indicator"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-label="Notifications"
        >
          {unreadCount > 0 && (
            <span className="indicator-item badge badge-primary badge-sm min-w-4">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m-6 0H9" />
          </svg>
        </button>
      </div>
      {dropdown}
    </>
  );
}
