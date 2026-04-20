import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocaleProvider } from '@/context/LocaleContext';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { AffiliateRefTracker } from '@/components/AffiliateRefTracker';
import { AdminMaintenanceBanner } from '@/components/AdminMaintenanceBanner';
import { ToastContainerWrapper } from '@/components/ToastContainerWrapper';

export const metadata: Metadata = {
  title: 'Africa Marketplace — E-commerce & Livraison',
  description: 'Marketplace SaaS + Affiliation + Livraison pour l\'Afrique (Bénin)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-base-100 text-base-content overflow-x-hidden w-full max-w-full">
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <CartProvider>
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg" /></div>}>
              <MaintenanceGate>
                <AffiliateRefTracker />
                <AdminMaintenanceBanner />
                {children}
                <ToastContainerWrapper />
              </MaintenanceGate>
            </Suspense>
              </CartProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
