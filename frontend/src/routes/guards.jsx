import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * These guards are a UX convenience only. The backend independently
 * enforces authorization on every request (see SecurityConfig.java) —
 * a student calling an admin API directly will always get a 403
 * regardless of what this component allows through.
 */
export function ProtectedRoute() {
  const { user, loading, openAuthModal } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      openAuthModal('login', location.pathname + location.search);
    }
  }, [loading, user, location, openAuthModal]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { user, loading, openAuthModal } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      openAuthModal('login', location.pathname + location.search);
    }
  }, [loading, user, location, openAuthModal]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user?.role?.toLowerCase());
  if (!isStaff) return <Navigate to="/student" replace />;
  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (user) {
    const isStaff = ['admin', 'super_admin', 'superadmin', 'content_creator', 'creator', 'readonly_admin', 'read_only_admin'].includes(user?.role?.toLowerCase());
    return <Navigate to={isStaff ? '/admin' : '/student'} replace />;
  }
  return <Outlet />;
}
