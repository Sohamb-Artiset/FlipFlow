-- Add cover customization fields to flipbooks table
-- This migration adds cover customization fields to the existing flipbooks table
ALTER TABLE flipbooks 
ADD COLUMN show_covers BOOLEAN DEFAULT true,
ADD COLUMN cover_overlay_enabled BOOLEAN DEFAULT true,
ADD COLUMN cover_overlay_text TEXT,
ADD COLUMN cover_overlay_color TEXT DEFAULT 'rgba(0, 0, 0, 0.5)',
ADD COLUMN cover_text_color TEXT DEFAULT '#ffffff';

-- Add comment to document the new fields
COMMENT ON COLUMN flipbooks.show_covers IS 'Enable/disable cover feature for the flipbook';
COMMENT ON COLUMN flipbooks.cover_overlay_enabled IS 'Show/hide overlay on covers when covers are enabled';
COMMENT ON COLUMN flipbooks.cover_overlay_text IS 'Custom title/text for cover overlay';
COMMENT ON COLUMN flipbooks.cover_overlay_color IS 'Overlay background color with opacity (CSS rgba format)';
COMMENT ON COLUMN flipbooks.cover_text_color IS 'Text color for cover overlay (CSS color format)';
