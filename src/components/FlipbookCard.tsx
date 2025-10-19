import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Edit, Share2, Trash2, Lock } from 'lucide-react';
import { useFlipbookPermissions } from '@/hooks/usePermissions';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

interface FlipbookCardProps {
  flipbook: Flipbook;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  formatDate: (date: string) => string;
  isDeleting: boolean;
}

export const FlipbookCard = React.memo<FlipbookCardProps>(({ 
  flipbook, 
  onDelete, 
  onShare, 
  formatDate, 
  isDeleting 
}) => {
  // Check permissions for this specific flipbook
  const permissions = useFlipbookPermissions(flipbook);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-1 line-clamp-2">
              {flipbook.title}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {flipbook.description || 'No description'}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={flipbook.is_public ? "default" : "secondary"}>
              {flipbook.is_public ? "Public" : "Private"}
            </Badge>
            {permissions.isOwner && (
              <Badge variant="outline" className="text-xs">
                Owner
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Eye className="w-4 h-4" />
              <span>{flipbook.view_count || 0} views</span>
            </div>
            <span>{formatDate(flipbook.created_at!)}</span>
          </div>

          {/* Actions with permission checks */}
          <div className="flex space-x-2">
            {/* View action - always allowed for owner, check permissions for others */}
            {permissions.canView ? (
              <Link to={`/flipbook/${flipbook.id}`} className="flex-1" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full">
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="w-full flex-1" disabled>
                <Lock className="w-4 h-4 mr-2" />
                Private
              </Button>
            )}
            
            {/* Edit action - only for owners */}
            {permissions.canEdit ? (
              <Link to={`/flipbook/${flipbook.id}/edit`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" className="w-full flex-1" disabled title="Only owners can edit">
                <Lock className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            
            {/* Share action - only for public flipbooks or owners */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShare(flipbook.id)}
              disabled={!permissions.canView}
              title={!permissions.canView ? "Cannot share private flipbook" : "Share flipbook"}
            >
              <Share2 className="w-4 h-4" />
            </Button>
            
            {/* Delete action - only for owners */}
            {permissions.canDelete ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(flipbook.id)}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
                title="Delete flipbook"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Only owners can delete"
              >
                <Lock className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Permission warning for non-owners */}
          {!permissions.isOwner && (
            <Alert className="mt-2">
              <Lock className="w-4 h-4" />
              <AlertDescription className="text-xs">
                Limited access - you are not the owner of this flipbook
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

FlipbookCard.displayName = 'FlipbookCard';