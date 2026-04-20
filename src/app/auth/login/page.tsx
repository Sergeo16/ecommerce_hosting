'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const { t } = useLocale();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success(t('loginSuccess') ?? 'Connexion réussie.');
      router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('loginError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 py-8 px-4 overflow-x-hidden">
      <div className="absolute top-4 left-4 z-10">
        <AppLogo className="btn btn-ghost text-lg btn-sm sm:btn-md" />
      </div>
      <div className="absolute top-4 right-4 flex flex-nowrap gap-2 justify-end items-center z-10">
        <ThemeSwitcher />
        <LocaleSwitcher />
      </div>
      <div className="card w-full max-w-md bg-base-100 shadow-xl mx-auto min-w-0">
        <div className="card-body p-4 sm:p-6">
          <h1 className="card-title text-xl sm:text-2xl break-words">{t('signIn')}</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder={t('email')}
              className="input input-bordered w-full min-w-0"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 255))}
              required
              maxLength={255}
              autoComplete="email"
            />
            <input
              type="password"
              placeholder={t('password')}
              className="input input-bordered w-full min-w-0"
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 128))}
              required
              maxLength={128}
              autoComplete="current-password"
            />
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? t('signInLoading') : t('signInButton')}
            </button>
          </form>
          <p className="text-sm mt-2 break-words">
            {t('noAccount')} <Link href="/auth/register" className="link">{t('signUp')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
