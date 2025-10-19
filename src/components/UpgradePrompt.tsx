/**
 * Reusable Upgrade Prompt Component
 * 
 * Provides consistent upgrade messaging and UI across the application
 * when users hit plan limits or try to access premium features.
 */

import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Crown, ArrowRight, Zap } from 'lucide-react';
import { UpgradePrompt as UpgradePromptConfig } from '@/lib/planManager';

interface UpgradePromptProps {
  config: UpgradePromptConfig;
  currentUsage?: number;
  limit?: number;
  onUpgrade?: () => void;
  className?: string;
  compact?: boolean;
}

export const UpgradePrompt = ({ 
  config, 
  currentUsage, 
  limit, 
  onUpgrade,
  className = '',
  compact = false 
}: UpgradePromptProps) => {
  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      // Default behavior: navigate to pricing page
      window.location.href = '/pricing';
    }
  };

  const getVariantStyles = () => {
    switch (config.variant) {
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'destructive':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (config.variant) {
      case 'warning':
        return <Zap className="h-4 w-4" />;
      case 'destructive':
        return <Crown className="h-4 w-4" />;
      case 'info':
      default:
        return <Crown className="h-4 w-4" />;
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-3 rounded-lg border ${getVariantStyles()} ${className}`}>
        <div className="flex items-center space-x-2">
          {getIcon()}
          <span className="text-sm font-medium">{config.title}</span>
          {config.showUsage && currentUsage !== undefined && limit !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {currentUsage}/{limit}
            </Badge>
          )}
        </div>
        <Button 
          size="sm" 
          onClick={handleUpgrade}
          className="ml-2"
        >
          Upgrade
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Alert className={`${getVariantStyles()} ${className}`}>
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="flex-1 space-y-2">
          <AlertTitle className="flex items-center justify-between">
            <span>{config.title}</span>
            {config.showUsage && currentUsage !== undefined && limit !== undefined && (
              <Badge variant="secondary">
                {currentUsage}/{limit} used
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription className="text-sm">
            {config.message}
          </AlertDescription>
          <div className="pt-2">
            <Button 
              onClick={handleUpgrade}
              size="sm"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Crown className="mr-2 h-4 w-4" />
              {config.actionText}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
};

/**
 * Inline upgrade prompt for use in forms and smaller spaces
 */
export const InlineUpgradePrompt = ({ 
  config, 
  onUpgrade,
  className = '' 
}: Pick<UpgradePromptProps, 'config' | 'onUpgrade' | 'className'>) => {
  return (
    <UpgradePrompt 
      config={config}
      onUpgrade={onUpgrade}
      className={className}
      compact={true}
    />
  );
};

/**
 * Usage indicator component for showing current plan usage
 */
interface UsageIndicatorProps {
  current: number;
  limit: number | 'unlimited';
  label: string;
  className?: string;
}

export const UsageIndicator = ({ 
  current, 
  limit, 
  label,
  className = '' 
}: UsageIndicatorProps) => {
  const isUnlimited = limit === 'unlimited' || limit === Infinity;
  const percentage = isUnlimited ? 0 : Math.min((current / (limit as number)) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {current}{isUnlimited ? '' : `/${limit}`}
          {isUnlimited && <Badge variant="secondary" className="ml-2 text-xs">Unlimited</Badge>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
};