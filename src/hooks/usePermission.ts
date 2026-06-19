import { useAuthStore } from '@/store/authStore';

export const usePermission = () => {
  const { hasPermission, hasRole, user } = useAuthStore();
  return { hasPermission, hasRole, user, role: user?.role };
};
