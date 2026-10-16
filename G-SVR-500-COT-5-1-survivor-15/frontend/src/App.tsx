import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { queryClient } from '@/lib/queryClient';
import { ToastViewport } from '@/components/ui/Toast';
import { GeoConsentBanner } from '@/components/layout/GeoConsentBanner';
import { ReconnectBanner } from '@/components/layout/ReconnectBanner';
import { ProtectedRoute } from '@/components/guards/ProtectedRoute';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { AppShell } from '@/components/layout/AppShell';
import { ProShell } from '@/components/layout/ProShell';
import { AdminShell } from '@/components/layout/AdminShell';
import { LandingPage } from '@/features/landing/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { PrivacyPage, CguPage, TransparencyPage } from '@/features/legal/LegalPages';
import { NotFoundPage } from '@/features/legal/NotFoundPage';
import { AppMapPage, PublicMapPage } from '@/pages/MapPages';
import { OfferDetailPage } from '@/pages/OfferDetailPage';
import { DashboardPage } from '@/features/candidate/DashboardPage';
import { ApplicationsPage } from '@/features/candidate/ApplicationsPage';
import { ProfilePage } from '@/features/candidate/ProfilePage';
import { NotificationsPage } from '@/features/candidate/NotificationsPage';
import { EmployerDashboard } from '@/features/employer/DashboardPage';
import { EmployerOffersPage } from '@/features/employer/OffersPage';
import { NewOfferPage } from '@/features/employer/NewOfferPage';
import { EmployerApplicationsPage } from '@/features/employer/ApplicationsPage';
import { AdminUsersPage, MetricsPage, ModerationPage } from '@/features/admin/AdminPages';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ReconnectBanner />
        <GeoConsentBanner />
        <ToastViewport />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/carte" element={<PublicMapPage />} />
            <Route path="/offres/:id" element={<OfferDetailPage />} />
            <Route path="/connexion" element={<LoginPage />} />
            <Route path="/inscription" element={<RegisterPage />} />
            <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
            <Route path="/reinitialisation/:token" element={<ResetPasswordPage />} />
            <Route path="/mentions/donnees" element={<PrivacyPage />} />
            <Route path="/cgu" element={<CguPage />} />
            <Route path="/transparence" element={<TransparencyPage />} />

            <Route
              path="/app"
              element={
                <ProtectedRoute roles={['candidate']}>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="carte" element={<AppMapPage />} />
              <Route path="candidatures" element={<ApplicationsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profil" element={<ProfilePage />} />
            </Route>

            <Route
              path="/pro"
              element={
                <ProtectedRoute roles={['employer']}>
                  <ProShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="tableau-de-bord" replace />} />
              <Route path="tableau-de-bord" element={<EmployerDashboard />} />
              <Route path="offres" element={<EmployerOffersPage />} />
              <Route path="offres/nouvelle" element={<NewOfferPage />} />
              <Route path="offres/:id/modifier" element={<NewOfferPage />} />
              <Route path="candidatures" element={<EmployerApplicationsPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <AdminShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="moderation" replace />} />
              <Route path="moderation" element={<ModerationPage />} />
              <Route path="utilisateurs" element={<AdminUsersPage />} />
              <Route path="metriques" element={<MetricsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
