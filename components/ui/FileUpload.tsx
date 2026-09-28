"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { UploadIcon, XIcon, ImageIcon, FileTextIcon } from "./Icons";
import { Button } from "./Button";

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  value?: File[];
  onChange?: (files: File[]) => void;
  label?: string;
  helperText?: string;
  error?: string;
  showPreviews?: boolean;
  className?: string;
}

export function FileUpload({
  accept,
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = false,
  value = [],
  onChange,
  label,
  helperText,
  error,
  showPreviews = true,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File size exceeds ${formatFileSize(maxSize)}`;
    }

    if (accept) {
      const acceptedTypes = accept.split(",").map((type) => type.trim());
      const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;
      const mimeType = file.type;

      const isValid = acceptedTypes.some((type) => {
        if (type.startsWith(".")) {
          return fileExtension === type.toLowerCase();
        }
        if (type.endsWith("/*")) {
          const baseType = type.split("/")[0];
          return mimeType.startsWith(baseType);
        }
        return mimeType === type;
      });

      if (!isValid) {
        return `File type not accepted. Allowed: ${accept}`;
      }
    }

    return null;
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach((file) => {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      // In a real app, you'd show these errors to the user
      console.error("File validation errors:", errors);
    }

    if (validFiles.length > 0) {
      const newFiles = multiple ? [...value, ...validFiles] : validFiles;
      onChange?.(newFiles);

      // Simulate upload progress
      validFiles.forEach((file) => {
        simulateUploadProgress(file.name);
      });
    }
  };

  const simulateUploadProgress = (fileName: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress((prev) => ({ ...prev, [fileName]: progress }));

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setUploadProgress((prev) => {
            const { [fileName]: _, ...rest } = prev;
            return rest;
          });
        }, 500);
      }
    }, 100);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index);
    onChange?.(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5" />;
    }
    return <FileTextIcon className="h-5 w-5" />;
  };

  const getPreviewUrl = (file: File): string | null => {
    if (file.type.startsWith("image/")) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <label className="block text-sm font-medium text-fg">
          {label}
        </label>
      )}

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-150",
          isDragging
            ? "border-accent bg-accent-surface"
            : error
              ? "border-danger bg-subtle"
              : "border-line bg-subtle hover:border-fg-muted",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-page"
        )}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="sr-only"
          aria-describedby={
            error ? "file-error" : helperText ? "file-helper" : undefined
          }
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isDragging
                ? "bg-accent-surface text-accent-on-surface"
                : "bg-muted text-fg-secondary"
            )}
          >
            <UploadIcon className="h-5 w-5" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-fg">
              {isDragging ? (
                "Drop files here"
              ) : (
                <>
                  <span className="text-accent-strong">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </>
              )}
            </p>
            <p className="text-xs text-fg-secondary">
              {accept || "Any file type"} up to {formatFileSize(maxSize)}
            </p>
          </div>
        </div>
      </div>

      {helperText && !error && (
        <p
          id="file-helper"
          className="text-xs text-fg-secondary"
        >
          {helperText}
        </p>
      )}

      {error && (
        <p id="file-error" className="text-xs text-danger">
          {error}
        </p>
      )}

      {/* File Previews */}
      {showPreviews && value.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-fg">
            {value.length} {value.length === 1 ? "file" : "files"} selected
          </p>
          <AnimatePresence>
            {value.map((file, index) => {
              const previewUrl = getPreviewUrl(file);
              const progress = uploadProgress[file.name];

              return (
                <motion.div
                  key={`${file.name}-${index}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="flex items-center gap-3 p-2.5 rounded-md border border-line bg-surface"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="w-10 h-10 rounded-md object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-fg-secondary">
                      {getFileIcon(file)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-fg-secondary">
                      {formatFileSize(file.size)}
                    </p>

                    {progress !== undefined && (
                      <div className="mt-1.5 w-full bg-active rounded-full h-1 overflow-hidden">
                        <motion.div
                          className="h-full bg-accent-strong"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-muted transition-colors duration-150"
                    aria-label={`Remove ${file.name}`}
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
