import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { AuthGate, RequireAuth, RedirectIfAuthenticated, RequireAdmin, RequireAdminOrModerator } from './layouts/RouteGuards';
import MainLayout from './layouts/MainLayout';

// Lazy loading для максимальной производительности (Google Lighthouse 90+)
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const KataListPage = lazy(() => import('./pages/KataListPage'));
const KataDetailPage = lazy(() => import('./pages/KataDetailPage'));
const KataFormPage = lazy(() => import('./pages/KataFormPage'));
const BunkaiListPage = lazy(() => import('./pages/BunkaiListPage'));
const BunkaiDetailPage = lazy(() => import('./pages/BunkaiDetailPage'));
const BunkaiFormPage = lazy(() => import('./pages/BunkaiFormPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const DojoPage = lazy(() => import('./pages/DojoPage'));
const KarateStudioPage = lazy(() => import('./pages/KarateStudioPage'));

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminKataPage = lazy(() => import('./pages/admin/AdminKataPage'));
const AdminBunkaiPage = lazy(() => import('./pages/admin/AdminBunkaiPage'));
const AdminCommentsPage = lazy(() => import('./pages/admin/AdminCommentsPage'));
const AdminLogsPage = lazy(() => import('./pages/admin/AdminLogsPage'));
const AdminAnimationsPage = lazy(() => import('./pages/admin/AdminAnimationsPage'));
const AdminBackupsPage = lazy(() => import('./pages/admin/AdminBackupsPage'));

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function PageSkeleton() {
  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--gold, #d4a24c)',
      }}
    >
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>⛩️</div>
        <div style={{ fontSize: '0.85rem', letterSpacing: '0.08em', color: 'var(--text-muted, #a8a29e)' }}>
          Склоняем поклон перед залом Додзё…
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // Раздел 2 ТЗ: при первом открытии сайта проверяем, авторизован ли пользователь,
  // пытаясь обменять httpOnly refresh-cookie на access-токен.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <AuthGate>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Единственные страницы, разрешённые guest (раздел 2 ТЗ) */}
          <Route
            path="/register"
            element={
              <RedirectIfAuthenticated>
                <RegisterPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route element={<MainLayout />}>
            <Route path="/karate-studio" element={<KarateStudioPage />} />
            <Route path="/motion-lab" element={<Navigate to="/karate-studio" replace />} />
            <Route path="/aimocap" element={<Navigate to="/karate-studio" replace />} />
            <Route path="/mocap" element={<Navigate to="/karate-studio" replace />} />
            <Route path="/studio" element={<KarateStudioPage />} />
          </Route>
          <Route path="/phone-camera" element={<Navigate to="/karate-studio" replace />} />

          {/* Все остальные маршруты требуют авторизации — иначе редирект на /register */}
          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />

              <Route path="/kata" element={<KataListPage />} />
              <Route
                path="/kata/create"
                element={
                  <RequireAdmin>
                    <KataFormPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/kata/new"
                element={
                  <RequireAdmin>
                    <KataFormPage />
                  </RequireAdmin>
                }
              />
              <Route path="/kata/:id" element={<KataDetailPage />} />
              <Route
                path="/kata/:id/edit"
                element={
                  <RequireAdmin>
                    <KataFormPage />
                  </RequireAdmin>
                }
              />

              <Route path="/bunkai" element={<BunkaiListPage />} />
              <Route path="/bunkai/new" element={<BunkaiFormPage />} />
              <Route path="/bunkai/create" element={<BunkaiFormPage />} />
              <Route path="/bunkai/studio" element={<BunkaiFormPage />} />
              <Route path="/bunkai/:id" element={<BunkaiDetailPage />} />
              <Route path="/bunkai/:id/edit" element={<BunkaiFormPage />} />

              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/dojos" element={<DojoPage />} />

              <Route element={<RequireAdminOrModerator />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route
                    path="users"
                    element={
                      <RequireAdmin>
                        <AdminUsersPage />
                      </RequireAdmin>
                    }
                  />
                  <Route path="bunkai" element={<AdminBunkaiPage />} />
                  <Route path="comments" element={<AdminCommentsPage />} />
                  <Route
                    path="kata"
                    element={
                      <RequireAdmin>
                        <AdminKataPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="logs"
                    element={
                      <RequireAdmin>
                        <AdminLogsPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="animations"
                    element={
                      <RequireAdmin>
                        <AdminAnimationsPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="backups"
                    element={
                      <RequireAdmin>
                        <AdminBackupsPage />
                      </RequireAdmin>
                    }
                  />
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AuthGate>
  );
}
