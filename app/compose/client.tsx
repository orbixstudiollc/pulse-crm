"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import {
  PaperPlaneTiltIcon,
  CalendarBlankIcon,
  FloppyDiskIcon,
  ImageIcon,
  XIcon,
  WarningCircleIcon,
} from "@/components/ui/Icons";
import {
  PlatformType,
  PLATFORM_CAPABILITIES,
  MediaFile,
  PostContent,
} from "@/lib/postpeer/types";
import { getPostPeerClient } from "@/lib/postpeer/client";

const PLATFORM_ICONS: Record<PlatformType, string> = {
  twitter: "𝕏",
  facebook: "f",
  instagram: "📷",
  linkedin: "in",
  youtube: "▶",
  tiktok: "♪",
  pinterest: "P",
  bluesky: "🦋",
  threads: "@",
};

const PLATFORM_COLORS: Record<PlatformType, string> = {
  twitter: "bg-black text-white",
  facebook: "bg-blue-600 text-white",
  instagram: "bg-gradient-to-br from-purple-600 to-pink-500 text-white",
  linkedin: "bg-blue-700 text-white",
  youtube: "bg-red-600 text-white",
  tiktok: "bg-black text-white",
  pinterest: "bg-red-600 text-white",
  bluesky: "bg-blue-500 text-white",
  threads: "bg-black text-white",
};

export function ComposeClient() {
  const [content, setContent] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const togglePlatform = (platform: PlatformType) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const getCharacterLimit = () => {
    if (selectedPlatforms.length === 0) return null;
    const limits = selectedPlatforms.map(
      (p) => PLATFORM_CAPABILITIES[p].maxTextLength
    );
    return Math.min(...limits);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadFiles(files);
  };

  const uploadFiles = async (files: File[]) => {
    if (media.length + files.length > 10) {
      toast.error("Maximum 10 media files allowed");
      return;
    }

    setUploading(true);
    try {
      const client = getPostPeerClient();
      const uploadPromises = files.map(async (file) => {
        const result = await client.uploadMedia(file);
        const mediaFile: MediaFile = {
          id: result.id,
          type: file.type.startsWith("video") ? "video" : "image",
          url: result.url,
          file,
          size: file.size,
          mimeType: file.type,
        };
        return mediaFile;
      });

      const uploadedMedia = await Promise.all(uploadPromises);
      setMedia((prev) => [...prev, ...uploadedMedia]);
      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload media"
      );
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const validateForm = (): string | null => {
    if (!content.trim()) {
      return "Post content is required";
    }
    if (selectedPlatforms.length === 0) {
      return "Select at least one platform";
    }
    const limit = getCharacterLimit();
    if (limit && content.length > limit) {
      return `Content exceeds ${limit} character limit`;
    }
    return null;
  };

  const handlePublish = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const client = getPostPeerClient();
      const postContent: PostContent = {
        text: content,
        media,
        platforms: selectedPlatforms,
      };

      const result = await client.createPost(postContent);

      const successMessages: string[] = [];
      const platformUrls: Record<string, string> = {};

      if (result.results) {
        result.results.forEach((r) => {
          if (r.status === "success" && r.postUrl) {
            platformUrls[r.platform] = r.postUrl;
            successMessages.push(r.platform);
          }
        });
      }

      if (successMessages.length > 0) {
        toast.success(
          `Published to ${successMessages.join(", ")}`,
          {
            description: Object.entries(platformUrls)
              .map(([platform, url]) => `${platform}: ${url}`)
              .join("\n"),
            duration: 10000,
          }
        );
      }

      setContent("");
      setSelectedPlatforms([]);
      setMedia([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to publish post"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!scheduledAt) {
      toast.error("Please select a date and time");
      return;
    }

    setLoading(true);
    try {
      const client = getPostPeerClient();
      const postContent: PostContent = {
        text: content,
        media,
        platforms: selectedPlatforms,
        scheduledAt,
        timezone,
      };

      await client.schedulePost(postContent);
      toast.success("Post scheduled successfully");

      setContent("");
      setSelectedPlatforms([]);
      setMedia([]);
      setScheduledAt("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule post"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!content.trim()) {
      toast.error("Post content is required");
      return;
    }

    try {
      localStorage.setItem(
        "compose-draft",
        JSON.stringify({
          content,
          selectedPlatforms,
          media,
          scheduledAt,
          savedAt: new Date().toISOString(),
        })
      );
      toast.success("Draft saved");
    } catch (error) {
      toast.error("Failed to save draft");
    }
  };

  const charLimit = getCharacterLimit();
  const isOverLimit = charLimit ? content.length > charLimit : false;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">
          Create Post
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
          Compose and publish to multiple platforms
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {/* Content Editor */}
          <div>
            <label
              htmlFor="content"
              className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2"
            >
              Post Content
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full min-h-[120px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-0 resize-none"
              aria-label="Post content"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {selectedPlatforms.length > 0 && charLimit && (
                  <span
                    className={
                      isOverLimit
                        ? "text-red-600 dark:text-red-400 font-medium"
                        : ""
                    }
                  >
                    {content.length} / {charLimit} characters
                    {isOverLimit && (
                      <WarningCircleIcon className="inline-block w-4 h-4 ml-1" />
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Platform Selector */}
          <div>
            <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">
              Select Platforms
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {(Object.keys(PLATFORM_CAPABILITIES) as PlatformType[]).map(
                (platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      selectedPlatforms.includes(platform)
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                    }`}
                    aria-label={`${selectedPlatforms.includes(platform) ? "Deselect" : "Select"} ${platform}`}
                    aria-pressed={selectedPlatforms.includes(platform)}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${PLATFORM_COLORS[platform]}`}
                    >
                      {PLATFORM_ICONS[platform]}
                    </div>
                    <span className="text-xs font-medium text-neutral-950 dark:text-neutral-50 capitalize">
                      {platform}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          {/* Media Uploader */}
          <div>
            <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">
              Media (Optional)
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                dragActive
                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
                aria-label="Upload media files"
              />
              <div className="text-center">
                <ImageIcon className="w-12 h-12 mx-auto text-neutral-400 dark:text-neutral-500 mb-3" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                  Drag and drop media files here, or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                  >
                    browse
                  </button>
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Up to 10 images or videos
                </p>
              </div>
            </div>

            {media.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                {media.map((item) => (
                  <div key={item.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                      {item.type === "image" ? (
                        <img
                          src={item.url}
                          alt="Uploaded media"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400">
                          <span className="text-2xl">▶</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMedia(item.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove media"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2 mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                <Spinner size="sm" />
                Uploading...
              </div>
            )}
          </div>

          {/* Schedule Picker */}
          <div>
            <label
              htmlFor="schedule"
              className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2"
            >
              Schedule (Optional)
            </label>
            <input
              type="datetime-local"
              id="schedule"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-0"
              aria-label="Schedule date and time"
            />
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Timezone: {timezone}
            </p>
          </div>

          {/* Preview Tabs */}
          {selectedPlatforms.length > 0 && content && (
            <div>
              <label className="block text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-2">
                Preview
              </label>
              <Tabs key={selectedPlatforms.join(",")} defaultValue={selectedPlatforms[0]}>
                <TabsList>
                  {selectedPlatforms.map((platform) => (
                    <TabsTrigger key={platform} value={platform}>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {selectedPlatforms.map((platform) => (
                  <TabsContent key={platform} value={platform}>
                    <div className="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${PLATFORM_COLORS[platform]}`}
                        >
                          {PLATFORM_ICONS[platform]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-950 dark:text-neutral-50 whitespace-pre-wrap break-words">
                            {content}
                          </p>
                          {media.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              {media.slice(0, PLATFORM_CAPABILITIES[platform].maxImages).map((item) => (
                                <div
                                  key={item.id}
                                  className="aspect-square rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800"
                                >
                                  {item.type === "image" && (
                                    <img
                                      src={item.url}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={loading || !content.trim()}
              className="sm:order-1"
            >
              <FloppyDiskIcon className="w-4 h-4" />
              Save Draft
            </Button>
            {scheduledAt && (
              <Button
                onClick={handleSchedule}
                disabled={loading || uploading || isOverLimit}
                className="sm:order-3"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <CalendarBlankIcon className="w-4 h-4" />
                    Schedule Post
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handlePublish}
              disabled={loading || uploading || isOverLimit || !selectedPlatforms.length}
              className="sm:order-2 sm:ml-auto"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  Publishing...
                </>
              ) : (
                <>
                  <PaperPlaneTiltIcon className="w-4 h-4" />
                  Publish Now
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
