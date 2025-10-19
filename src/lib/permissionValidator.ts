/**
 * Client-side permission validation system
 * Provides RLS policy validation and permission checks for better UX
 * 
 * This module mirrors server-side RLS policies to provide immediate feedback
 * and prevent unnecessary API calls that would fail due to permission issues.
 */

import { User } from '@supabase/supabase-js';
import { Tables, Enums } from '@/integrations/supabase/types';

// Profile type with plan information
type Profile = Tables<'profiles'> & {
  plan?: string | null;
};

// Flipbook type
type Flipbook = Tables<'flipbooks'>;

// User role type
type UserRole = Enums<'app_role'>;

// Permission check result
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiresAuth?: boolean;
  requiresOwnership?: boolean;
  requiresRole?: UserRole;
  suggestedAction?: string;
}

// Permission context for validation
export interface PermissionContext {
  user?: User | null;
  profile?: Profile | null;
  targetUserId?: string;
  flipbook?: Flipbook | null;
  isPublicAccess?: boolean;
}

// Resource types that can be validated
export type ResourceType = 'flipbook' | 'profile' | 'flipbook_view' | 'user_role' | 'storage_object';

// Action types for each resource
export type ResourceAction = 
  | 'select' | 'insert' | 'update' | 'delete'
  | 'view' | 'create' | 'edit' | 'remove'
  | 'upload' | 'download';

/**
 * Client-side Permission Validator
 * 
 * Validates permissions based on RLS policies to provide immediate feedback
 * and improve user experience by preventing unauthorized actions.
 */
export class PermissionValidator {
  private static instance: PermissionValidator;
  
  private constructor() {}
  
  /**
   * Get singleton instance of PermissionValidator
   */
  public static getInstance(): PermissionValidator {
    if (!PermissionValidator.instance) {
      PermissionValidator.instance = new PermissionValidator();
    }
    return PermissionValidator.instance;
  }

  /**
   * Validate permission for a specific resource and action
   * 
   * @param resource - Type of resource being accessed
   * @param action - Action being performed
   * @param context - Permission context with user and resource data
   * @returns PermissionResult indicating if action is allowed
   */
  public validatePermission(
    resource: ResourceType,
    action: ResourceAction,
    context: PermissionContext
  ): PermissionResult {
    // Handle unauthenticated users first
    if (!context.user) {
      return this.handleUnauthenticatedAccess(resource, action, context);
    }

    // Validate based on resource type and action
    switch (resource) {
      case 'flipbook':
        return this.validateFlipbookPermission(action, context);
      
      case 'profile':
        return this.validateProfilePermission(action, context);
      
      case 'flipbook_view':
        return this.validateFlipbookViewPermission(action, context);
      
      case 'user_role':
        return this.validateUserRolePermission(action, context);
      
      case 'storage_object':
        return this.validateStoragePermission(action, context);
      
      default:
        return {
          allowed: false,
          reason: 'Unknown resource type',
          suggestedAction: 'Contact support if this error persists'
        };
    }
  }

  /**
   * Check if user owns a specific flipbook
   */
  public isFlipbookOwner(flipbook: Flipbook | null, userId: string | undefined): boolean {
    if (!flipbook || !userId) return false;
    return flipbook.user_id === userId;
  }

  /**
   * Check if flipbook is publicly accessible
   */
  public isFlipbookPublic(flipbook: Flipbook | null): boolean {
    if (!flipbook) return false;
    return flipbook.is_public === true;
  }

  /**
   * Check if user has admin role (would need to be fetched from user_roles table)
   */
  public hasAdminRole(userRoles: UserRole[] = []): boolean {
    return userRoles.includes('admin');
  }

  /**
   * Validate flipbook permissions based on RLS policies
   */
  private validateFlipbookPermission(action: ResourceAction, context: PermissionContext): PermissionResult {
    const { user, flipbook } = context;
    
    if (!user) {
      return {
        allowed: false,
        reason: 'Authentication required',
        requiresAuth: true,
        suggestedAction: 'Please sign in to access this flipbook'
      };
    }

    switch (action) {
      case 'select':
      case 'view':
        // RLS: flipbooks_select_owner OR flipbooks_select_public
        if (this.isFlipbookOwner(flipbook, user.id)) {
          return { allowed: true };
        }
        
        if (this.isFlipbookPublic(flipbook)) {
          return { allowed: true };
        }
        
        return {
          allowed: false,
          reason: 'Flipbook is private and you are not the owner',
          requiresOwnership: true,
          suggestedAction: 'Contact the flipbook owner for access'
        };
      
      case 'insert':
      case 'create':
        // RLS: flipbooks_insert_owner (user_id = auth.uid())
        return { allowed: true }; // Any authenticated user can create
      
      case 'update':
      case 'edit':
        // RLS: flipbooks_update_owner (user_id = auth.uid())
        if (this.isFlipbookOwner(flipbook, user.id)) {
          return { allowed: true };
        }
        
        return {
          allowed: false,
          reason: 'Only the flipbook owner can edit this flipbook',
          requiresOwnership: true,
          suggestedAction: 'You can only edit flipbooks you created'
        };
      
      case 'delete':
      case 'remove':
        // RLS: flipbooks_delete_owner (user_id = auth.uid())
        if (this.isFlipbookOwner(flipbook, user.id)) {
          return { allowed: true };
        }
        
        return {
          allowed: false,
          reason: 'Only the flipbook owner can delete this flipbook',
          requiresOwnership: true,
          suggestedAction: 'You can only delete flipbooks you created'
        };
      
      default:
        return {
          allowed: false,
          reason: 'Unknown flipbook action',
          suggestedAction: 'Contact support if this error persists'
        };
    }
  }

  /**
   * Validate profile permissions based on RLS policies
   */
  private validateProfilePermission(action: ResourceAction, context: PermissionContext): PermissionResult {
    const { user, targetUserId } = context;
    
    if (!user) {
      return {
        allowed: false,
        reason: 'Authentication required',
        requiresAuth: true,
        suggestedAction: 'Please sign in to access profiles'
      };
    }

    const isOwnProfile = targetUserId === user.id;

    switch (action) {
      case 'select':
      case 'view':
        // RLS: profiles_select_self (id = auth.uid())
        if (isOwnProfile) {
          return { allowed: true };
        }
        
        return {
          allowed: false,
          reason: 'You can only view your own profile',
          requiresOwnership: true,
          suggestedAction: 'You can only access your own profile data'
        };
      
      case 'insert':
      case 'create':
        // RLS: profiles_insert_self (id = auth.uid())
        if (isOwnProfile) {
          return { allowed: true };
        }
        
        return {
          allowed: false,
          reason: 'You can only create your own profile',
          requiresOwnership: true,
          suggestedAction: 'Profile creation is automatic during sign-up'
        };
      
      case 'update':
      case 'edit':
        // RLS: profiles_update_self (id = auth.uid())
        if (isOwnProfile) {
          return { allowed: true };
        }
        
        return {
          allowed: false,
          reason: 'You can only update your own profile',
          requiresOwnership: true,
          suggestedAction: 'You can only edit your own profile'
        };
      
      default:
        return {
          allowed: false,
          reason: 'Profile deletion is not allowed',
          suggestedAction: 'Contact support to delete your account'
        };
    }
  }

  /**
   * Validate flipbook view permissions based on RLS policies
   */
  private validateFlipbookViewPermission(action: ResourceAction, context: PermissionContext): PermissionResult {
    const { user, flipbook } = context;

    switch (action) {
      case 'select':
      case 'view':
        // RLS: flipbook_views_select_owner (owner of the flipbook can see views)
        if (user && this.isFlipbookOwner(flipbook, user.id)) {
          return { allowed: true };
        }
        
        return {
          allowed: false,
          reason: 'Only flipbook owners can view analytics',
          requiresOwnership: true,
          suggestedAction: 'You can only view analytics for your own flipbooks'
        };
      
      case 'insert':
      case 'create':
        // RLS: flipbook_views_insert_owner OR flipbook_views_insert_public
        if (user && this.isFlipbookOwner(flipbook, user.id)) {
          return { allowed: true };
        }
        
        if (this.isFlipbookPublic(flipbook)) {
          return { allowed: true }; // Anyone can record views for public flipbooks
        }
        
        return {
          allowed: false,
          reason: 'Cannot record view for private flipbook',
          suggestedAction: 'Flipbook must be public or you must be the owner'
        };
      
      default:
        return {
          allowed: false,
          reason: 'Only view creation and reading are allowed',
          suggestedAction: 'View records cannot be modified or deleted'
        };
    }
  }

  /**
   * Validate user role permissions based on RLS policies
   */
  private validateUserRolePermission(action: ResourceAction, context: PermissionContext): PermissionResult {
    const { user, targetUserId } = context;
    
    if (!user) {
      return {
        allowed: false,
        reason: 'Authentication required',
        requiresAuth: true,
        suggestedAction: 'Please sign in to access role information'
      };
    }

    const isOwnRoles = targetUserId === user.id;

    switch (action) {
      case 'select':
      case 'view':
        // RLS: user_roles_select_self (user_id = auth.uid()) OR user_roles_all_admin
        if (isOwnRoles) {
          return { allowed: true };
        }
        
        // Note: Admin check would require fetching user roles first
        return {
          allowed: false,
          reason: 'You can only view your own roles',
          requiresOwnership: true,
          suggestedAction: 'Contact an administrator for role information'
        };
      
      case 'insert':
      case 'update':
      case 'delete':
        // RLS: user_roles_all_admin (has_role('admin'::app_role, auth.uid()))
        return {
          allowed: false,
          reason: 'Role management requires admin privileges',
          requiresRole: 'admin',
          suggestedAction: 'Contact an administrator to modify roles'
        };
      
      default:
        return {
          allowed: false,
          reason: 'Unknown role action',
          suggestedAction: 'Contact support if this error persists'
        };
    }
  }

  /**
   * Validate storage object permissions based on RLS policies
   */
  private validateStoragePermission(action: ResourceAction, context: PermissionContext): PermissionResult {
    const { user } = context;

    switch (action) {
      case 'select':
      case 'view':
      case 'download':
        // RLS: pdfs_select_public, assets_select_public (public read access)
        return { allowed: true }; // Public read access for all storage objects
      
      case 'insert':
      case 'upload':
      case 'update':
      case 'delete':
        // RLS: *_owner policies (auth.uid() = first folder in path)
        if (!user) {
          return {
            allowed: false,
            reason: 'Authentication required for file operations',
            requiresAuth: true,
            suggestedAction: 'Please sign in to upload or modify files'
          };
        }
        
        return { allowed: true }; // Authenticated users can manage their own files
      
      default:
        return {
          allowed: false,
          reason: 'Unknown storage action',
          suggestedAction: 'Contact support if this error persists'
        };
    }
  }

  /**
   * Handle access attempts by unauthenticated users
   */
  private handleUnauthenticatedAccess(
    resource: ResourceType,
    action: ResourceAction,
    context: PermissionContext
  ): PermissionResult {
    // Allow public read access to public flipbooks
    if (resource === 'flipbook' && (action === 'select' || action === 'view')) {
      if (this.isFlipbookPublic(context.flipbook)) {
        return { allowed: true };
      }
    }
    
    // Allow public read access to storage objects
    if (resource === 'storage_object' && (action === 'select' || action === 'view' || action === 'download')) {
      return { allowed: true };
    }
    
    // Allow recording views for public flipbooks
    if (resource === 'flipbook_view' && (action === 'insert' || action === 'create')) {
      if (this.isFlipbookPublic(context.flipbook)) {
        return { allowed: true };
      }
    }

    // All other actions require authentication
    return {
      allowed: false,
      reason: 'Authentication required',
      requiresAuth: true,
      suggestedAction: 'Please sign in to perform this action'
    };
  }

  /**
   * Get user-friendly error message for permission denial
   */
  public getPermissionErrorMessage(result: PermissionResult): string {
    if (result.allowed) {
      return '';
    }

    if (result.requiresAuth) {
      return 'Please sign in to continue.';
    }

    if (result.requiresOwnership) {
      return 'You don\'t have permission to access this resource.';
    }

    if (result.requiresRole) {
      return `This action requires ${result.requiresRole} privileges.`;
    }

    return result.reason || 'Permission denied.';
  }

  /**
   * Check multiple permissions at once
   */
  public validateMultiplePermissions(
    checks: Array<{
      resource: ResourceType;
      action: ResourceAction;
      context: PermissionContext;
    }>
  ): { [key: string]: PermissionResult } {
    const results: { [key: string]: PermissionResult } = {};
    
    checks.forEach((check, index) => {
      const key = `${check.resource}_${check.action}_${index}`;
      results[key] = this.validatePermission(check.resource, check.action, check.context);
    });
    
    return results;
  }
}

// Export singleton instance for easy access
export const permissionValidator = PermissionValidator.getInstance();

// Convenience functions for common permission checks
export const canViewFlipbook = (flipbook: Flipbook | null, user: User | null): boolean => {
  const result = permissionValidator.validatePermission('flipbook', 'view', {
    user,
    flipbook
  });
  return result.allowed;
};

export const canEditFlipbook = (flipbook: Flipbook | null, user: User | null): boolean => {
  const result = permissionValidator.validatePermission('flipbook', 'edit', {
    user,
    flipbook
  });
  return result.allowed;
};

export const canDeleteFlipbook = (flipbook: Flipbook | null, user: User | null): boolean => {
  const result = permissionValidator.validatePermission('flipbook', 'delete', {
    user,
    flipbook
  });
  return result.allowed;
};

export const canViewAnalytics = (flipbook: Flipbook | null, user: User | null): boolean => {
  const result = permissionValidator.validatePermission('flipbook_view', 'view', {
    user,
    flipbook
  });
  return result.allowed;
};

export const canUploadFiles = (user: User | null): boolean => {
  const result = permissionValidator.validatePermission('storage_object', 'upload', {
    user
  });
  return result.allowed;
};