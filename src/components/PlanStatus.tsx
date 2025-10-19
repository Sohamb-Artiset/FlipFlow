import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'> & {
  plan?: string | null;
};

interface PlanStatusProps {
  profile: Profile;
  flipbookCount: number;
}

export const PlanStatus = React.memo<PlanStatusProps>(({ profile, flipbookCount }) => {
  const isPremium = (profile.plan || 'free') === 'premium';
  const isFree = !isPremium;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <h3 className="font-semibold text-sm">Current Plan</h3>
              <p className="text-muted-foreground text-sm">
                {isPremium ? 'Premium Plan' : 'Free Plan'}
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <h3 className="font-semibold text-sm">Flipbook Usage</h3>
              <p className="text-muted-foreground text-sm">
                {isPremium 
                  ? `${flipbookCount} flipbooks (Unlimited)` 
                  : `${flipbookCount}/3 flipbooks used`
                }
              </p>
            </div>
          </div>
          {isFree && flipbookCount >= 2 && (
            <div className="text-right">
              {flipbookCount === 2 ? (
                <Badge variant="secondary" className="text-amber-600">
                  1 remaining
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Limit reached
                </Badge>
              )}
            </div>
          )}
          {isPremium && (
            <Badge variant="default" className="bg-green-600">
              Premium
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

PlanStatus.displayName = 'PlanStatus';