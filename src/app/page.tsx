'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppLogo } from '@/components/AppLogo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useLocale } from '@/context/LocaleContext';

export default function HomePage() {
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* Navbar : une seule ligne, menu burger sur mobile (options en overlay au premier plan) */}
      <header className="border-b border-base-300 bg-base-100/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm overflow-visible w-full max-w-full">
        <div className="container mx-auto px-3 sm:px-5 w-full max-w-full min-w-0 overflow-x-hidden">
          <div className="navbar min-h-12 sm:min-h-14 py-0 gap-1 sm:gap-3 md:gap-4 flex-nowrap w-full max-w-full min-w-0">
            {/* Logo : visible en entier sur petit écran (pas de troncature) */}
            <div className="navbar-start min-w-0 flex-1 sm:flex-initial sm:flex-none pl-0 pr-1 sm:pr-2">
              <AppLogo className="btn btn-ghost text-sm sm:text-xl font-bold tracking-tight px-1.5 sm:px-3 py-2 normal-case hover:opacity-90 no-underline overflow-visible text-left w-full sm:w-auto max-w-full" />
            </div>

            {/* Centre : lien Catalogue (caché sur mobile, dans le menu) */}
            <nav className="navbar-center flex-1 justify-center hidden md:flex flex-nowrap min-w-0" aria-label="Navigation principale">
              <Link href="/catalog" className="link link-hover font-medium text-base-content opacity-90 hover:opacity-100 whitespace-nowrap">
                {t('catalog')}
              </Link>
            </nav>

            {/* Droite : thème + langue + Connexion + Dashboard (comme sur /catalog) */}
            <div className="navbar-end shrink-0 flex-nowrap gap-2 sm:gap-3 pr-2 sm:pr-4 pl-2">
              <div className="hidden md:flex items-center flex-nowrap gap-2">
                <ThemeSwitcher />
                <LocaleSwitcher />
              </div>
              <Link href="/auth/login" className="btn btn-ghost btn-sm hidden sm:inline-flex whitespace-nowrap">
                {t('login')}
              </Link>
              <Link href="/dashboard" className="btn btn-primary btn-sm sm:btn-md shadow-md hidden md:inline-flex whitespace-nowrap flex-shrink-0 px-3 sm:px-4 ml-0.5">
                {t('dashboard')}
              </Link>

              {/* Mobile : bouton menu — ouvre une modal (contenu au premier plan, pas de scroll dans la barre) */}
              <div className="md:hidden flex-shrink-0">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={() => setMenuOpen(true)}
                  aria-expanded={menuOpen}
                  aria-label="Menu"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal menu mobile : overlay plein écran, choix au premier plan */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMenu} aria-hidden />
          <div className="relative bg-base-100 rounded-2xl shadow-2xl w-full max-w-sm py-4 overflow-y-auto max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 pb-3 border-b border-base-300">
              <span className="font-semibold text-lg text-base-content">Menu</span>
              <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={closeMenu} aria-label="Fermer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <nav className="flex flex-col py-2">
              <Link href="/catalog" className="px-4 py-3 hover:bg-base-200 text-left font-medium text-base-content" onClick={closeMenu}>{t('catalog')}</Link>
              <Link href="/auth/login" className="px-4 py-3 hover:bg-base-200 text-left font-medium text-base-content" onClick={closeMenu}>{t('login')}</Link>
              <Link href="/auth/register" className="px-4 py-3 hover:bg-base-200 text-left font-medium text-base-content" onClick={closeMenu}>{t('register')}</Link>
              <div className="border-t border-base-300 my-2" />
              <div className="px-4 py-3 flex items-center flex-nowrap gap-2">
                <ThemeSwitcher />
                <LocaleSwitcher />
              </div>
              <div className="px-4 pt-3">
                <Link href="/dashboard" className="btn btn-primary w-full" onClick={closeMenu}>{t('dashboard')}</Link>
              </div>
            </nav>
          </div>
        </div>
      )}

      <main className="max-w-full overflow-hidden">
        {/* Hero : accroche et actions principales */}
        <section
          className="container mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-24 text-center"
          aria-labelledby="hero-title"
        >
          <h1 id="hero-title" className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-5 sm:mb-6 tracking-tight break-words text-base-content">
            {t('heroTitle')}
          </h1>
          <p className="text-base sm:text-lg text-base-content/80 mb-8 sm:mb-10">
            {t('heroLead')}
          </p>

          {/* 4 rôles en cartes : clients, vendeurs, affiliés, livreurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-4xl mx-auto mb-10 sm:mb-12">
            {[
              { emoji: '🛍️', roleKey: 'heroRoleClient', descKey: 'heroClient' },
              { emoji: '🏪', roleKey: 'heroRoleSeller', descKey: 'heroSeller' },
              { emoji: '🤝', roleKey: 'heroRoleAffiliate', descKey: 'heroAffiliate' },
              { emoji: '🚚', roleKey: 'heroRoleCourier', descKey: 'heroCourier' },
            ].map((item) => (
              <div
                key={item.roleKey}
                className="group relative bg-base-200/70 hover:bg-base-200 border border-base-300/60 hover:border-primary/30 rounded-2xl p-4 sm:p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                <span className="text-2xl sm:text-3xl block mb-2" aria-hidden>
                  {item.emoji}
                </span>
                <h3 className="font-semibold text-base sm:text-lg text-base-content mb-1">
                  {t(item.roleKey as keyof typeof t)}
                </h3>
                <p className="text-sm text-base-content/85 leading-snug">
                  {t(item.descKey as keyof typeof t)}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-10 sm:mb-12">
            <p className="text-sm sm:text-base text-base-content/80 max-w-xl mx-auto leading-relaxed">
              « {t('heroTagline')} »
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
            <Link href="/catalog" className="btn btn-primary btn-lg shadow-lg w-full sm:w-auto min-w-[200px]">
              {t('seeCatalog')}
            </Link>
            <Link href="/auth/register" className="btn btn-outline btn-lg w-full sm:w-auto min-w-[200px]">
              {t('becomePartner')}
            </Link>
          </div>
        </section>

        {/* Pourquoi nous rejoindre : avantages en grille */}
        <section
          className="bg-base-200/80 py-16 sm:py-20 lg:py-24"
          aria-labelledby="why-join-title"
        >
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
            <header className="text-center mb-12 sm:mb-16">
              <p className="text-sm sm:text-base uppercase tracking-widest opacity-70 mb-2">🌟</p>
              <h2 id="why-join-title" className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-base-content mb-3">
                {t('whyJoinTitle')}
              </h2>
              <p className="text-lg sm:text-xl text-base-content/90 max-w-xl mx-auto">
                {t('whyJoinIntro')}
              </p>
            </header>

            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 list-none p-0 m-0">
              {[
                { emoji: '🔒', titleKey: 'whyJoinSecureTitle', descKey: 'whyJoinSecureDesc' },
                { emoji: '💰', titleKey: 'whyJoinRevenueTitle', descKey: 'whyJoinRevenueDesc' },
                { emoji: '📈', titleKey: 'whyJoinCommissionsTitle', descKey: 'whyJoinCommissionsDesc' },
                { emoji: '🚚', titleKey: 'whyJoinDeliveryTitle', descKey: 'whyJoinDeliveryDesc' },
                { emoji: '🤝', titleKey: 'whyJoinAffiliationTitle', descKey: 'whyJoinAffiliationDesc' },
                { emoji: '🌍', titleKey: 'whyJoinOpportunityTitle', descKey: 'whyJoinOpportunityDesc' },
              ].map((item) => (
                <li key={item.titleKey}>
                  <article className="h-full bg-base-100 rounded-2xl p-6 sm:p-7 shadow-sm border border-base-300/50 hover:shadow-md hover:border-primary/20 transition-all duration-200 text-left">
                    <div className="text-3xl sm:text-4xl mb-4" aria-hidden>
                      {item.emoji}
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-base-content mb-2">
                      {t(item.titleKey as keyof typeof t)}
                    </h3>
                    <p className="text-sm sm:text-base text-base-content/80 leading-relaxed">
                      {t(item.descKey as keyof typeof t)}
                    </p>
                  </article>
                </li>
              ))}
            </ul>

            <div className="mt-12 sm:mt-16 text-center">
              <Link href="/auth/register" className="btn btn-primary btn-lg shadow-md">
                {t('register')}
              </Link>
            </div>
          </div>
        </section>

        {/* CTA finale : accroche intuitive + actions */}
        <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center border-t border-base-300">
          <p className="text-base sm:text-lg text-base-content/85 mb-6 max-w-md mx-auto font-medium">
            {t('ctaFooterTagline')}
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
            <Link href="/catalog" className="btn btn-ghost btn-lg">{t('seeCatalog')}</Link>
            <Link href="/auth/register" className="btn btn-ghost btn-lg">{t('becomePartner')}</Link>
          </div>
        </section>
      </main>
    </>
  );
}
