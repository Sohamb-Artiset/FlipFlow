/**
 * Plan configuration constants and types for subscription plan limits
 */

// Plan type definition
export type PlanType = 'free' | 'premium';

// Plan configuration interface
export interface PlanConfig {
  maxFlipbooks: number;
  displayName: string;
}

// Plan limits configuration constant
export const PLAN_LIMITS: Record<PlanType, PlanConfig> = {
  free: {
    maxFlipbooks: 3,
    displayName: 'Free Plan'
  },
  premium: {
    maxFlipbooks: Infinity,
    displayName: 'Premium Plan'
  }
} as const;

// Profile type with plan information (extends the base profile from Supabase)
export interface ProfileWithPlan {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: PlanType;
  created_at: string | null;
  updated_at: string | null;
}

// Utility function to get plan configuration
export function getPlanConfig(plan: PlanType): PlanConfig {
  return PLAN_LIMITS[plan];
}

// Utility function to check if a plan allows unlimited flipbooks
export function isUnlimitedPlan(plan: PlanType): boolean {
  return PLAN_LIMITS[plan].maxFlipbooks === Infinity;
}

// Utility function to check if user can create more flipbooks
export function canCreateFlipbook(plan: PlanType, currentCount: number): boolean {
  const config = getPlanConfig(plan);
  return currentCount < config.maxFlipbooks;
}

// Utility function to get remaining flipbooks for a plan
export function getRemainingFlipbooks(plan: PlanType, currentCount: number): number {
  const config = getPlanConfig(plan);
  if (config.maxFlipbooks === Infinity) {
    return Infinity;
  }
  return Math.max(0, config.maxFlipbooks - currentCount);
}