/**
 * Permission Guard Component
 * 
 * Provides consistent permission checking and error handling across the application.
 * Renders children only if permissions are satisfied, otherwise shows appropriate error UI.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Eye, Shield, AlertTriangle } from 'lucide-react';
import { usePermission, useConditionalRender } from '@/hooks/usePermissions';
import { ResourceType, ResourceAction, PermissionContext } from '@/lib/permissionValidator';

interface PermissionGuardProps {
  resource: ResourceType;
  action: ResourceAction;
  context?: Omit<PermissionContext, 'user' | 'profile'>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  className?: string;
}

/**
 * Permission Guard - Conditionally renders children based on permissions
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  resource,
  action,
  context = {},
  children,
  fallback,
  showError = true,
  className = ''
}) => {
  const { canRender, permission, errorMessage } = useConditionalRender(resource, action, context);

  if (canRender) {
    return <>{children}</>;
  }

  // Use custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Don't show error UI if showError is false
  if (!showError) {
    return null;
  }

  // Default permission error UI
  return (
    <PermissionErrorDisplay 
      permission={permission}
      errorMessage={errorMessage}
      className={className}
    />
  );
};

/**
 * Permission Error Display Component
 */
interface PermissionErrorDisplayProps {
  permission: any;
  errorMessage: string;
  className?: string;
}

export const PermissionErrorDisplay: React.FC<PermissionErrorDisplayProps> = ({
  permission,
  errorMessage,
  className = ''
}) => {
  const getErrorIcon = () => {
    if (permission.requiresAuth) return <Lock className="w-8 h-8 text-muted-foreground" />;
    if (permission.requiresOwnership) return <Shield className="w-8 h-8 text-muted-foreground" />;
    if (permission.requiresRole) return <AlertTriangle className="w-8 h-8 text-muted-foreground" />;
    return <Eye className="w-8 h-8 text-muted-foreground" />;
  };

  const getErrorTitle = () => {
    if (permission.requiresAuth) return "Authentication Required";
    if (permission.requiresOwnership) return "Access Restricted";
    if (permission.requiresRole) return "Insufficient Privileges";
    return "Permission Denied";
  };

  const getErrorDescription = () => {
    if (permission.requiresAuth) {
      return "Please sign in to access this content.";
    }
    if (permission.requiresOwnership) {
      return "You don't have permission to access this resource. Only the owner can perform this action.";
    }
    if (permission.requiresRole) {
      return `This action requires ${permission.requiresRole} privileges. Contact an administrator for access.`;
    }
    return errorMessage || "You don't have permission to perform this action.";
  };

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          {getErrorIcon()}
          <div>
            <h3 className="font-semibold">{getErrorTitle()}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {getErrorDescription()}
            </p>
          </div>
          {permission.requiresAuth && (
            <Button onClick={() => window.location.href = '/auth'}>
              Sign In
            </Button>
          )}
          {permission.suggestedAction && !permission.requiresAuth && (
            <p className="text-xs text-muted-foreground">
              {permission.suggestedAction}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Inline Permission Alert - For smaller permission warnings
 */
interface InlinePermissionAlertProps {
  permission: any;
  errorMessage: string;
  variant?: 'default' | 'destructive';
  className?: string;
}

export const InlinePermissionAlert: React.FC<InlinePermissionAlertProps> = ({
  permission,
  errorMessage,
  variant = 'default',
  className = ''
}) => {
  const getIcon = () => {
    if (permission.requiresAuth) return <Lock className="w-4 h-4" />;
    if (permission.requiresOwnership) return <Shield className="w-4 h-4" />;
    if (permission.requiresRole) return <AlertTriangle className="w-4 h-4" />;
    return <Eye className="w-4 h-4" />;
  };

  return (
    <Alert variant={variant} className={className}>
      {getIcon()}
      <AlertDescription>
        {errorMessage}
        {permission.suggestedAction && (
          <span className="block text-xs mt-1 opacity-75">
            {permission.suggestedAction}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Hook for easy permission guarding in components
 */
export const usePermissionGuard = (
  resource: ResourceType,
  action: ResourceAction,
  context: Omit<PermissionContext, 'user' | 'profile'> = {}
) => {
  const permission = usePermission(resource, action, context);
  
  return {
    canAccess: permission.allowed,
    permission,
    PermissionGuard: ({ children, ...props }: Omit<PermissionGuardProps, 'resource' | 'action' | 'context'>) => (
      <PermissionGuard 
        resource={resource} 
        action={action} 
        context={context} 
        {...props}
      >
        {children}
      </PermissionGuard>
    )
  };
};