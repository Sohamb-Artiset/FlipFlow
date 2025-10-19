/**
 * React hook for permission validation
 * 
 * Provides easy access to permission validation in React components
 * with automatic updates when auth state changes.
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  permissionValidator, 
  PermissionResult, 
  ResourceType, 
  ResourceAction, 
  PermissionContext,
  canViewFlipbook,
  canEditFlipbook,
  canDeleteFlipbook,
  canViewAnalytics,
  canUploadFiles
} from '@/lib/permissionValidator';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

/**
 * Hook for checking a single permission
 */
export const usePermission = (
  resource: ResourceType,
  action: ResourceAction,
  context: Omit<PermissionContext, 'user' | 'profile'> = {}
) => {
  const { user, profile } = useAuth();

  const result = useMemo(() => {
    return permissionValidator.validatePermission(resource, action, {
      ...context,
      user,
      profile
    });
  }, [resource, action, user, profile, context]);

  return result;
};

/**
 * Hook for checking multiple permissions at once
 */
export const useMultiplePermissions = (
  checks: Array<{
    resource: ResourceType;
    action: ResourceAction;
    context?: Omit<PermissionContext, 'user' | 'profile'>;
  }>
) => {
  const { user, profile } = useAuth();

  const results = useMemo(() => {
    const checksWithAuth = checks.map(check => ({
      resource: check.resource,
      action: check.action,
      context: {
        ...check.context,
        user,
        profile
      }
    }));

    return permissionValidator.validateMultiplePermissions(checksWithAuth);
  }, [checks, user, profile]);

  return results;
};

/**
 * Hook for flipbook-specific permissions
 */
export const useFlipbookPermissions = (flipbook: Flipbook | null) => {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    return {
      canView: canViewFlipbook(flipbook, user),
      canEdit: canEditFlipbook(flipbook, user),
      canDelete: canDeleteFlipbook(flipbook, user),
      canViewAnalytics: canViewAnalytics(flipbook, user),
      isOwner: flipbook && user ? flipbook.user_id === user.id : false,
      isPublic: flipbook ? flipbook.is_public === true : false
    };
  }, [flipbook, user]);

  return permissions;
};

/**
 * Hook for general user permissions
 */
export const useUserPermissions = () => {
  const { user } = useAuth();

  const permissions = useMemo(() => {
    return {
      canUploadFiles: canUploadFiles(user),
      isAuthenticated: !!user,
      userId: user?.id
    };
  }, [user]);

  return permissions;
};

/**
 * Hook for getting permission error messages
 */
export const usePermissionError = (result: PermissionResult) => {
  const errorMessage = useMemo(() => {
    return permissionValidator.getPermissionErrorMessage(result);
  }, [result]);

  return errorMessage;
};

/**
 * Hook for conditional rendering based on permissions
 */
export const useConditionalRender = (
  resource: ResourceType,
  action: ResourceAction,
  context: Omit<PermissionContext, 'user' | 'profile'> = {}
) => {
  const permission = usePermission(resource, action, context);
  
  return {
    canRender: permission.allowed,
    permission,
    errorMessage: permissionValidator.getPermissionErrorMessage(permission)
  };
};