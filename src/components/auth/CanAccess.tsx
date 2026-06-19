import { usePermission } from '@/hooks/usePermission';
import { SBTARole } from '@/store/authStore';

interface CanAccessProps {
  permission?: string;
  roles?: SBTARole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const CanAccess = ({ permission, roles, children, fallback = null }: CanAccessProps) => {
  const { hasPermission, hasRole } = usePermission();

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (roles && !hasRole(roles)) return <>{fallback}</>;

  return <>{children}</>;
};
