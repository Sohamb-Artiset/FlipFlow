import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

interface StatsCardProps {
  flipbooks: Flipbook[];
}

export const StatsCard = React.memo<StatsCardProps>(({ flipbooks }) => {
  const stats = useMemo(() => ({
    totalFlipbooks: flipbooks.length,
    totalViews: flipbooks.reduce((sum, fb) => sum + (fb.view_count || 0), 0),
    publicFlipbooks: flipbooks.filter(fb => fb.is_public).length,
  }), [flipbooks]);

  return (
    <Card className="mt-8">
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-primary">
              {stats.totalFlipbooks}
            </div>
            <div className="text-sm text-muted-foreground">
              Total Flipbooks
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {stats.totalViews}
            </div>
            <div className="text-sm text-muted-foreground">
              Total Views
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {stats.publicFlipbooks}
            </div>
            <div className="text-sm text-muted-foreground">
              Public Flipbooks
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StatsCard.displayName = 'StatsCard';