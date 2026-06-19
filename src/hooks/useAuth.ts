import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

export function useAuth(allowedRoles?: UserRole[]) {
  const { user, initialized } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      navigate('/login');
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      navigate('/unauthorized');
    }
  }, [user, initialized, allowedRoles, navigate]);

  return { user, initialized };
}
