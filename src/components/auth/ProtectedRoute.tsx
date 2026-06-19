import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, SBTARole } from '@/store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: SBTARole[];
  permission?: string;
  redirectTo?: string;
}

export const ProtectedRoute = ({
  children, roles, permission, redirectTo = '/login'
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, hasPermission, hasRole, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (user.status === 'suspended') {
    return <Navigate to="/account-suspended" replace />;
  }

  if (user.status === 'pending_confirmation') {
    return <Navigate to="/pending-confirmation" replace />;
  }

  if (roles && !hasRole(roles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
