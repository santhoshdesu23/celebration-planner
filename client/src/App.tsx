import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/lib/authContext';
import { PageLayout } from '@/components/layout/PageLayout';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { CreateEventPage } from '@/pages/CreateEventPage';
import { EventsListPage } from '@/pages/EventsListPage';
import { EventDashboardPage } from '@/pages/EventDashboardPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PageLayout />}>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/create" element={<CreateEventPage />} />
          <Route path="/guest-plan" element={<EventDashboardPage isGuest />} />

          {/* Protected routes */}
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <EventsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id"
            element={
              <ProtectedRoute>
                <EventDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* 404 fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
