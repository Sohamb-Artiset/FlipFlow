import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, X, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { validatePDFFile, formatFileSize } from '@/lib/pdfProcessor';
import { uploadPDF } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FlipbookUploadProps {
  onUploadComplete?: () => void;
}

export const FlipbookUpload = ({ onUploadComplete }: FlipbookUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    if (!file) return;

    // Validate the file
    const validation = validatePDFFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);
    setTitle(file.name.replace('.pdf', ''));
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const handleUpload = async () => {
    if (!selectedFile || !user) {
      setError('Please select a file and ensure you are logged in');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Ensure user profile exists - critical for RLS policies
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || null,
        });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        throw new Error(`Profile setup failed: ${profileError.message}. Please try logging out and back in.`);
      }

      // Generate a unique ID for the flipbook
      const flipbookId = crypto.randomUUID();

      // Upload PDF to storage
      setUploadProgress(25);
      const { data: pdfUrl, error: uploadError } = await uploadPDF(
        selectedFile,
        user.id,
        flipbookId
      );

      if (uploadError || !pdfUrl) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError || 'Unknown error'}`);
      }

      setUploadProgress(50);

      // Create flipbook record in database
      const { error: dbError } = await supabase
        .from('flipbooks')
        .insert({
          id: flipbookId,
          user_id: user.id,
          title: title || selectedFile.name.replace('.pdf', ''),
          description: description || null,
          pdf_url: pdfUrl,
          is_public: true,
        });

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw new Error(`Database save failed: ${dbError.message || 'Unknown error'}`);
      }

      setUploadProgress(100);

      toast({
        title: 'Success!',
        description: 'Your flipbook has been created successfully.',
      });

      // Reset form
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setError(null);
      setIsOpen(false);
      
      // Trigger callback to refresh dashboard
      onUploadComplete?.();

    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload flipbook');
      
      // Show detailed error to user
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload flipbook',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Create Flipbook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Flipbook</DialogTitle>
          <DialogDescription>
            Upload a PDF file to create an interactive flipbook
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          {!selectedFile ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">
                {isDragActive
                  ? 'Drop the PDF file here'
                  : 'Drag & drop a PDF file here, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 100MB
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  disabled={isUploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Flipbook Details */}
          {selectedFile && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter flipbook title"
                  disabled={isUploading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter flipbook description"
                  disabled={isUploading}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Create Flipbook
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
