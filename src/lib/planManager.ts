/**
 * Centralized Plan Management System
 * 
 * This module provides a unified interface for plan validation, limit enforcement,
 * and upgrade prompts across the entire application. It implements security-first
 * fallbacks and consistent messaging for plan-related operations.
 */

import { PlanType, getPlanConfig, canCreateFlipbook, getRemainingFlipbooks } from './plans';

// Action types that can be validated against plan limits
export type PlanAction = 
  | 'create_flipbook'
  | 'update_flipbook'
  | 'delete_flipbook'
  | 'access_analytics'
  | 'export_flipbook'
  | 'custom_branding'
  | 'share_flipbook'
  | 'publish_flipbook'
  | 'advanced_features';

// Validation result interface
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired: boolean;
  currentUsage?: number;
  limit?: number;
  remaining?: number;
}

// Upgrade prompt configuration
export interface UpgradePrompt {
  title: string;
  message: string;
  actionText: string;
  variant: 'info' | 'warning' | 'destructive';
  showUsage: boolean;
}

// Plan manager context for operations
export interface PlanContext {
  userId?: string;
  currentFlipbookCount: number;
  profile?: {
    plan?: string | null;
    id: string;
  } | null;
}

/**
 * Centralized Plan Manager Class
 * 
 * Provides a single source of truth for all plan-related validations,
 * limit enforcement, and upgrade messaging across the application.
 */
export class PlanManager {
  private static instance: PlanManager;
  
  private constructor() {}
  
  /**
   * Get singleton instance of PlanManager
   */
  public static getInstance(): PlanManager {
    if (!PlanManager.instance) {
      PlanManager.instance = new PlanManager();
    }
    return PlanManager.instance;
  }

  /**
   * Validate if a user can perform a specific action based on their plan
   * 
   * @param action - The action to validate
   * @param context - Current user and usage context
   * @returns ValidationResult with detailed information
   */
  public validateAction(action: PlanAction, context: PlanContext): ValidationResult {
    // Security-first approach: default to free plan if profile unavailable
    const userPlan = this.getUserPlan(context.profile);
    const planConfig = getPlanConfig(userPlan);

    switch (action) {
      case 'create_flipbook':
        return this.validateFlipbookCreation(userPlan, context.currentFlipbookCount);
      
      case 'update_flipbook':
      case 'delete_flipbook':
        // These actions are generally allowed for existing flipbooks
        return {
          allowed: true,
          upgradeRequired: false,
        };
      
      case 'access_analytics':
      case 'export_flipbook':
      case 'custom_branding':
      case 'advanced_features':
        // Premium features
        return this.validatePremiumFeature(userPlan, action);
      
      case 'share_flipbook':
      case 'publish_flipbook':
        // These actions are generally allowed for all plans
        return {
          allowed: true,
          upgradeRequired: false,
        };
      
      default:
        // Unknown action - deny by default for security
        return {
          allowed: false,
          reason: 'Unknown action type',
          upgradeRequired: true,
        };
    }
  }

  /**
   * Get appropriate upgrade prompt for a given plan and action
   * 
   * @param plan - User's current plan
   * @param action - Action that requires upgrade
   * @param context - Additional context for personalized messaging
   * @returns UpgradePrompt configuration
   */
  public getUpgradePrompt(plan: PlanType, action: PlanAction, context?: PlanContext): UpgradePrompt {
    const planConfig = getPlanConfig(plan);
    
    switch (action) {
      case 'create_flipbook':
        return {
          title: 'Flipbook Limit Reached',
          message: `You've reached the maximum of ${planConfig.maxFlipbooks} flipbooks for the ${planConfig.displayName}. Upgrade to Premium for unlimited flipbooks and advanced features.`,
          actionText: 'Upgrade to Premium',
          variant: 'warning',
          showUsage: true,
        };
      
      case 'access_analytics':
        return {
          title: 'Premium Feature',
          message: 'Advanced analytics are available with Premium. Get detailed insights into your flipbook performance and reader engagement.',
          actionText: 'Upgrade to Premium',
          variant: 'info',
          showUsage: false,
        };
      
      case 'export_flipbook':
        return {
          title: 'Premium Feature',
          message: 'Export your flipbooks in multiple formats with Premium. Download as PDF, images, or share with custom branding.',
          actionText: 'Upgrade to Premium',
          variant: 'info',
          showUsage: false,
        };
      
      case 'custom_branding':
        return {
          title: 'Premium Feature',
          message: 'Remove FlipFlow branding and add your own logo with Premium. Create a professional, branded experience for your readers.',
          actionText: 'Upgrade to Premium',
          variant: 'info',
          showUsage: false,
        };
      
      case 'advanced_features':
        return {
          title: 'Premium Feature',
          message: 'Advanced features like fullscreen mode and enhanced controls are available with Premium. Upgrade for the complete flipbook experience.',
          actionText: 'Upgrade to Premium',
          variant: 'info',
          showUsage: false,
        };
      
      default:
        return {
          title: 'Upgrade Required',
          message: 'This feature requires a Premium subscription. Upgrade now to unlock all features.',
          actionText: 'Upgrade to Premium',
          variant: 'info',
          showUsage: false,
        };
    }
  }

  /**
   * Enforce plan limits before allowing an operation
   * 
   * @param action - Action to enforce limits for
   * @param context - Current user and usage context
   * @returns boolean indicating if operation should proceed
   */
  public enforceLimit(action: PlanAction, context: PlanContext): boolean {
    const validation = this.validateAction(action, context);
    return validation.allowed;
  }

  /**
   * Get user's current plan with security-first fallback
   * 
   * @param profile - User profile data (may be null/undefined)
   * @returns PlanType with fallback to 'free'
   */
  private getUserPlan(profile?: { plan?: string | null } | null): PlanType {
    if (!profile || !profile.plan) {
      return 'free'; // Security-first: default to most restrictive plan
    }
    
    // Validate plan value
    const validPlans: PlanType[] = ['free', 'premium'];
    if (validPlans.includes(profile.plan as PlanType)) {
      return profile.plan as PlanType;
    }
    
    // Invalid plan value - fallback to free for security
    return 'free';
  }

  /**
   * Validate flipbook creation against plan limits
   */
  private validateFlipbookCreation(plan: PlanType, currentCount: number): ValidationResult {
    const planConfig = getPlanConfig(plan);
    const canCreate = canCreateFlipbook(plan, currentCount);
    const remaining = getRemainingFlipbooks(plan, currentCount);

    return {
      allowed: canCreate,
      reason: canCreate ? undefined : `Maximum of ${planConfig.maxFlipbooks} flipbooks reached for ${planConfig.displayName}`,
      upgradeRequired: !canCreate && plan === 'free',
      currentUsage: currentCount,
      limit: planConfig.maxFlipbooks === Infinity ? undefined : planConfig.maxFlipbooks,
      remaining: remaining === Infinity ? undefined : remaining,
    };
  }

  /**
   * Validate premium feature access
   */
  private validatePremiumFeature(plan: PlanType, action: PlanAction): ValidationResult {
    const isPremium = plan === 'premium';
    
    return {
      allowed: isPremium,
      reason: isPremium ? undefined : `${action.replace('_', ' ')} requires Premium subscription`,
      upgradeRequired: !isPremium,
    };
  }

  /**
   * Get usage summary for a user's current plan
   * 
   * @param context - Current user and usage context
   * @returns Usage summary object
   */
  public getUsageSummary(context: PlanContext) {
    const userPlan = this.getUserPlan(context.profile);
    const planConfig = getPlanConfig(userPlan);
    const remaining = getRemainingFlipbooks(userPlan, context.currentFlipbookCount);

    return {
      plan: userPlan,
      planDisplayName: planConfig.displayName,
      currentFlipbooks: context.currentFlipbookCount,
      maxFlipbooks: planConfig.maxFlipbooks === Infinity ? 'Unlimited' : planConfig.maxFlipbooks,
      remainingFlipbooks: remaining === Infinity ? 'Unlimited' : remaining,
      isAtLimit: !canCreateFlipbook(userPlan, context.currentFlipbookCount),
      isPremium: userPlan === 'premium',
    };
  }
}

// Export singleton instance for easy access
export const planManager = PlanManager.getInstance();

// Convenience functions for common operations
export const validatePlanAction = (action: PlanAction, context: PlanContext): ValidationResult => {
  return planManager.validateAction(action, context);
};

export const getPlanUpgradePrompt = (plan: PlanType, action: PlanAction, context?: PlanContext): UpgradePrompt => {
  return planManager.getUpgradePrompt(plan, action, context);
};

export const enforcePlanLimit = (action: PlanAction, context: PlanContext): boolean => {
  return planManager.enforceLimit(action, context);
};

export const getPlanUsageSummary = (context: PlanContext) => {
  return planManager.getUsageSummary(context);
};