import React from 'react';
import { PermissionProvider } from 'permzplus/react';
import { useUser } from '@/hooks/use-user';
import { policy } from '@/lib/permissions';

/**
 * Bridges the Firebase-based role from useUser() into the PermzPlus
 * PermissionProvider. Must sit inside AuthProvider so useUser() has access
 * to the authenticated user.
 *
 * When no role is resolved (unauthenticated or loading), an empty role string
 * is passed — all permission checks will return false until the role loads.
 */
export const PermissionsWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { highestRole, user } = useUser();
  const role = highestRole ?? user?.role ?? '';

  return (
    <PermissionProvider engine={policy} role={role}>
      {children}
    </PermissionProvider>
  );
};
