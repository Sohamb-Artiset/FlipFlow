import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { uploadAsset } from '@/lib/storage';
import { Tables } from '@/integrations/supabase/types';

type Flipbook = Tables<'flipbooks'>;

interface FlipbookCustomizationProps {
  flipbook: Flipbook;
  onUpdate: (updates: Partial<Flipbook>) => void;
  onSave: (updates: Partial<Flipbook>) => Promise<void>;
  isSaving?: boolean;
}

export const FlipbookCustomization = ({ 
  flipbook, 
  onUpdate, 
  onSave, 
  isSaving = false 
}: FlipbookCustomizationProps) => {
  const [title, setTitle] = useState(flipbook.title);
  const [description, setDescription] = useState(flipbook.description || '');
  const [backgroundColor, setBackgroundColor] = useState(flipbook.background_color || '#ffffff');
  const [isPublic, setIsPublic] = useState(flipbook.is_public ?? true);
  const [logoUrl, setLogoUrl] = useState(flipbook.logo_url || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleTitleChange = (value: string) => {
    setTitle(value);
    onUpdate({ title: value });
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    onUpdate({ description: value || null });
  };

  const handleBackgroundColorChange = (color: string) => {
    setBackgroundColor(color);
    onUpdate({ background_color: color });
  };

  const handlePublicToggle = (checked: boolean) => {
    setIsPublic(checked);
    onUpdate({ is_public: checked });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5MB limit for logos)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('Logo file size must be less than 5MB');
      return;
    }

    setIsUploadingLogo(true);
    setError(null);

    try {
      // Upload logo to storage
      const { data: uploadedUrl, error: uploadError } = await uploadAsset(
        file,
        flipbook.user_id,
        'logo'
      );

      if (uploadError || !uploadedUrl) {
        throw new Error(uploadError || 'Failed to upload logo');
      }

      setLogoUrl(uploadedUrl);
      onUpdate({ logo_url: uploadedUrl });

      toast({
        title: 'Success',
        description: 'Logo uploaded successfully',
      });

    } catch (err: any) {
      console.error('Error uploading logo:', err);
      setError(err.message || 'Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeLogo = () => {
    setLogoUrl('');
    onUpdate({ logo_url: null });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setError(null);
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        background_color: backgroundColor,
        is_public: isPublic,
        logo_url: logoUrl || null,
      });

      toast({
        title: 'Success',
        description: 'Flipbook updated successfully',
      });
    } catch (err: any) {
      console.error('Error saving flipbook:', err);
      setError(err.message || 'Failed to save changes');
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Set the title and description for your flipbook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter flipbook title"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Enter flipbook description"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of your flipbook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backgroundColor">Background Color</Label>
            <div className="flex items-center space-x-3">
              <Input
                id="backgroundColor"
                type="color"
                value={backgroundColor}
                onChange={(e) => handleBackgroundColorChange(e.target.value)}
                className="w-16 h-10 p-1 border rounded"
              />
              <Input
                value={backgroundColor}
                onChange={(e) => handleBackgroundColorChange(e.target.value)}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div className="space-y-3">
              {logoUrl ? (
                <div className="flex items-center space-x-3">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="w-16 h-16 object-contain border rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Current logo</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={removeLogo}
                      className="mt-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No logo uploaded
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>
            Control who can view your flipbook
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Public Access</Label>
              <p className="text-sm text-muted-foreground">
                Allow anyone with the link to view this flipbook
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={handlePublicToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
          {isSaving ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
