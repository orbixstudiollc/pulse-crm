"use client";

import { useCallback, useRef, useState } from "react";
import { MediaFile, PLATFORM_CAPABILITIES, PlatformType } from "@/lib/postpeer/types";
import { ImageIcon, XIcon, UploadSimpleIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface MediaUploaderProps {
  media: MediaFile[];
  selectedPlatforms: PlatformType[];
  onChange: (media: MediaFile[]) => void;
  onUpload: (files: File[]) => Promise<MediaFile[]>;
  className?: string;
}

export function MediaUploader({
  media,
  selectedPlatforms,
  onChange,
  onUpload,
  className,
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getMaxFiles = () => {
    if (selectedPlatforms.length === 0) return 10;
    return Math.min(
      ...selectedPlatforms.map((p) => PLATFORM_CAPABILITIES[p].maxImages),
    );
  };

  const validateFiles = (files: File[]): string | null => {
    if (selectedPlatforms.length === 0) {
      return "Please select platforms first";
    }

    const maxFiles = getMaxFiles();
    if (media.length + files.length > maxFiles) {
      return `Maximum ${maxFiles} files allowed for selected platforms`;
    }

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) {
        return "Only image and video files are allowed";
      }

      for (const platform of selectedPlatforms) {
        const capability = PLATFORM_CAPABILITIES[platform];
        const ext = file.name.split(".").pop()?.toLowerCase() || "";

        if (isImage) {
          if (!capability.supportsImages) {
            return `${platform} does not support images`;
          }
          if (!capability.supportedImageFormats.includes(ext)) {
            return `${platform} does not support .${ext} images`;
          }
          if (file.size > capability.maxImageSize) {
            const maxMB = Math.round(capability.maxImageSize / 1024 / 1024);
            return `Image too large for ${platform} (max ${maxMB}MB)`;
          }
        }

        if (isVideo) {
          if (!capability.supportsVideo) {
            return `${platform} does not support videos`;
          }
          if (!capability.supportedVideoFormats.includes(ext)) {
            return `${platform} does not support .${ext} videos`;
          }
          if (file.size > capability.maxVideoSize) {
            const maxMB = Math.round(capability.maxVideoSize / 1024 / 1024);
            return `Video too large for ${platform} (max ${maxMB}MB)`;
          }
        }
      }
    }

    return null;
  };

  const handleFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      const validationError = validateFiles(files);
      if (validationError) {
        setError(validationError);
        return;
      }

      setUploading(true);
      try {
        const uploaded = await onUpload(files);
        onChange([...media, ...uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [media, selectedPlatforms, onChange, onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const removeFile = (id: string) => {
    onChange(media.filter((m) => m.id !== id));
  };

  const maxFiles = getMaxFiles();
  const canUpload = media.length < maxFiles && selectedPlatforms.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-8 transition-colors",
            isDragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20"
              : "border-neutral-300 dark:border-neutral-700",
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Drop files here or click to upload
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Max {maxFiles} files · Images and videos
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileInput}
              disabled={uploading}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              leftIcon={<UploadSimpleIcon />}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer"
            >
              Choose Files
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800"
            >
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={item.url}
                  className="w-full h-full object-cover"
                  poster={item.thumbnail}
                />
              )}
              <button
                onClick={() => removeFile(item.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XIcon className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-white text-xs">
                {item.type === "video"
                  ? `${Math.round((item.duration || 0) / 60)}:${String(Math.round((item.duration || 0) % 60)).padStart(2, "0")}`
                  : `${Math.round(item.size / 1024)}KB`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
