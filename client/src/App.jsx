import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { AuthGate, RequireAuth, RedirectIfAuthenticated, RequireAdmin } from './layouts/RouteGuards';
import MainLayout from './layouts/MainLayout';

import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import KataListPage from './pages/KataListPage';
import KataDetailPage from './pages/KataDetailPage';
import KataFormPage from './pages/KataFormPage';
import BunkaiListPage from './pages/BunkaiListPage';
import BunkaiDetailPage from './pages/BunkaiDetailPage';
import BunkaiFormPage from './pages/BunkaiFormPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import ChatPage from './pages/ChatPage';
import MotionLabPage from './pages/MotionLabPage';

import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminKataPage from './pages/admin/AdminKataPage';
import AdminBunkaiPage from './pages/admin/AdminBunkaiPage';
import AdminLogsPage from './pages/admin/AdminLogsPage';
import AdminBackupsPage from './pages/admin/AdminBackupsPage';

import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // Раздел 2 ТЗ: при первом открытии сайта проверяем, авторизован ли пользователь,
  // пытаясь обменять httpOnly refresh-cookie на access-токен.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <AuthGate>
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
            <Route path="/bunkai/create" element={<BunkaiFormPage />} />
            <Route path="/bunkai/:id" element={<BunkaiDetailPage />} />
            <Route path="/bunkai/:id/edit" element={<BunkaiFormPage />} />

            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/motion-lab" element={<MotionLabPage />} />

            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="kata" element={<AdminKataPage />} />
                <Route path="bunkai" element={<AdminBunkaiPage />} />
                <Route path="logs" element={<AdminLogsPage />} />
                <Route path="backups" element={<AdminBackupsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthGate>
  );
}
