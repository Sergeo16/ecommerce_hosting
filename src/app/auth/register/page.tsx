'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role') ?? 'client';
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [role, setRole] = useState<'CLIENT' | 'AFFILIATE' | 'SUPPLIER' | 'COURIER'>(
    roleParam === 'affiliate' ? 'AFFILIATE' : roleParam === 'supplier' ? 'SUPPLIER' : roleParam === 'courier' ? 'COURIER' : 'CLIENT'
  );
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const isSupplier = role === 'SUPPLIER';
  const isCourier = role === 'COURIER';

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError(t('locationError'));
      return;
    }
    setLocationError(null);
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setAddressCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'fr,en', 'User-Agent': 'AfricaMarketplace-Register/1.0' } }
          );
          const data = await res.json();
          if (data?.address) {
            const a = data.address;
            const parts = [a.road, a.house_number, a.street, a.village, a.town, a.city].filter(Boolean);
            setAddress(parts.slice(0, 3).join(', ') || data.display_name?.slice(0, 300) || '');
            setCity([a.city, a.town, a.village].find(Boolean) || '');
          } else {
            setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          }
          setLocationError(null);
        } catch {
          setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          setLocationError(null);
        }
        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        setLocationError(err.code === 1 ? t('locationDenied') : t('locationError'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t('passwordMinError') ?? 'Mot de passe : minimum 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('passwordMismatch') ?? 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!validateEmail(email.trim())) {
      toast.error(t('emailInvalid') ?? 'Adresse email invalide.');
      return;
    }
    if (isSupplier) {
      if (!companyName.trim()) {
        toast.error(t('companyNameRequiredSupplier'));
        return;
      }
      if (!phone.trim()) {
        toast.error(t('phoneRequiredSupplier'));
        return;
      }
      const hasAddressText = address.trim().length > 0 && city.trim().length > 0;
      if (!hasAddressText && !addressCoords) {
        toast.error(t('addressRequiredSupplier'));
        return;
      }
    }
    if (isCourier && !phone.trim()) {
      toast.error(t('phoneRequiredCourier') ?? 'Le numéro de téléphone est obligatoire pour les livreurs.');
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        email,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
      };
      if (isSupplier) {
        body.companyName = companyName.trim();
        body.address = address.trim() || undefined;
        body.city = city.trim() || undefined;
        if (addressCoords) {
          body.addressLat = addressCoords.lat;
          body.addressLng = addressCoords.lng;
        }
      } else {
        body.address = address.trim() || undefined;
        body.city = city.trim() || undefined;
        if (addressCoords) {
          body.addressLat = addressCoords.lat;
          body.addressLng = addressCoords.lng;
        }
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: { error?: string } = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {
        data = { error: t('registerError') };
      }
      if (!res.ok) throw new Error(data.error ?? t('registerError'));
      await login(email, password);
      toast.success(t('registerSuccess') ?? 'Inscription réussie. Bienvenue !');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('registerError'));
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
          <h1 className="card-title text-xl sm:text-2xl break-words">{t('signUp')}</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-control">
              <label className="label">{t('iAm')}</label>
              <select
                className="select select-bordered w-full max-w-full"
                value={role}
                onChange={(e) => setRole(e.target.value as 'CLIENT' | 'AFFILIATE' | 'SUPPLIER' | 'COURIER')}
              >
                <option value="CLIENT">{t('roleClient')}</option>
                <option value="AFFILIATE">{t('roleAffiliate')}</option>
                <option value="SUPPLIER">{t('roleSupplier')}</option>
                <option value="COURIER">{t('roleCourier')}</option>
              </select>
            </div>
            {isSupplier && (
              <input
                type="text"
                placeholder={`${t('companyName')} *`}
                className="input input-bordered w-full min-w-0"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value.slice(0, 200))}
                required={isSupplier}
                maxLength={200}
                autoComplete="organization"
              />
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder={isSupplier ? t('firstNameOptional') : t('firstName')}
                className="input input-bordered flex-1 min-w-0"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.slice(0, 100))}
                required={!isSupplier}
                maxLength={100}
                autoComplete="given-name"
              />
              <input
                type="text"
                placeholder={isSupplier ? t('lastNameOptional') : t('lastName')}
                className="input input-bordered flex-1 min-w-0"
                value={lastName}
                onChange={(e) => setLastName(e.target.value.slice(0, 100))}
                required={!isSupplier}
                maxLength={100}
                autoComplete="family-name"
              />
            </div>
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
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">{t('passwordMin')}</span>
              </label>
              <div className="join w-full flex">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('passwordMin')}
                  className="input input-bordered join-item flex-1 min-w-0"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.slice(0, 128))}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-square join-item shrink-0"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? t('hidePassword') : t('showPassword')}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text">{t('confirmPassword')}</span>
              </label>
              <div className="join w-full flex">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('confirmPassword')}
                  className="input input-bordered join-item flex-1 min-w-0"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.slice(0, 128))}
                  required
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-square join-item shrink-0"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  title={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                  aria-label={showConfirmPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>
            <input
              type="tel"
              placeholder={isSupplier || isCourier ? `${t('phoneLabel')} *` : t('phone')}
              className="input input-bordered w-full min-w-0"
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, 20))}
              required={isSupplier || isCourier}
              maxLength={20}
              autoComplete="tel"
            />
            {isSupplier && (
              <>
                <div className="divider text-sm">{t('supplierAddressLabel')} *</div>
                <div className="flex flex-wrap gap-2 items-start">
                  <input
                    type="text"
                    placeholder={t('address')}
                    className="input input-bordered flex-1 min-w-0"
                    value={address}
                    onChange={(e) => setAddress(e.target.value.slice(0, 300))}
                    maxLength={300}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-1 shrink-0"
                    onClick={handleUseMyLocation}
                    disabled={locationLoading}
                    title={t('useMyLocation')}
                  >
                    {locationLoading ? <span className="loading loading-spinner loading-sm" /> : '📍'}
                    <span className="hidden sm:inline">{t('useMyLocation')}</span>
                  </button>
                </div>
                {addressCoords && (
                  <p className="text-sm text-success">✓ {t('locationSuccess')}: {addressCoords.lat.toFixed(5)}, {addressCoords.lng.toFixed(5)}</p>
                )}
                {locationError && <p className="text-sm text-error">{locationError}</p>}
                <input
                  type="text"
                  placeholder={t('city')}
                  className="input input-bordered w-full min-w-0"
                  value={city}
                  onChange={(e) => setCity(e.target.value.slice(0, 100))}
                  maxLength={100}
                />
              </>
            )}
            {!isSupplier && (
              <>
                <div className="divider text-sm">{t('addressOptional')}</div>
                <div className="flex flex-wrap gap-2 items-start">
                  <input
                    type="text"
                    placeholder={t('address')}
                    className="input input-bordered flex-1 min-w-0"
                    value={address}
                    onChange={(e) => setAddress(e.target.value.slice(0, 300))}
                    maxLength={300}
                    autoComplete="street-address"
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm gap-1 shrink-0"
                    onClick={handleUseMyLocation}
                    disabled={locationLoading}
                    title={t('useMyLocation')}
                  >
                    {locationLoading ? <span className="loading loading-spinner loading-sm" /> : '📍'}
                    <span className="hidden sm:inline">{t('useMyLocation')}</span>
                  </button>
                </div>
                {addressCoords && (
                  <p className="text-sm text-success">✓ {t('locationSuccess')}: {addressCoords.lat.toFixed(5)}, {addressCoords.lng.toFixed(5)}</p>
                )}
                {locationError && <p className="text-sm text-error">{locationError}</p>}
                <input
                  type="text"
                  placeholder={t('city')}
                  className="input input-bordered w-full min-w-0"
                  value={city}
                  onChange={(e) => setCity(e.target.value.slice(0, 100))}
                  maxLength={100}
                  autoComplete="address-level2"
                />
              </>
            )}
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? t('signUp') + '...' : t('signUp')}
            </button>
          </form>
          <p className="text-sm mt-2 break-words">
            {t('hasAccount')} <Link href="/auth/login" className="link">{t('signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
