import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/authContext';
import { Sparkles } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-plum flex items-center justify-center shadow-lg animate-pulse">
          <Sparkles className="text-gold-300 animate-spin" size={24} />
        </div>
        <p className="text-sm font-medium text-charcoal-light">Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children ? <>{children}</> : null;
}
