-- Add explicit image output format (PNG / JPEG) for first-class rasters.
CREATE TYPE "RenderingImageFormat" AS ENUM ('PNG', 'JPEG');

ALTER TABLE "rendering_events" ADD COLUMN "imageOutputFormat" "RenderingImageFormat" NOT NULL DEFAULT 'PNG';
