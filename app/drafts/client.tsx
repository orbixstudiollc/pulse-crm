"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { PlatformIcon } from "@/components/postpeer/PlatformIcon";
import {
  ListIcon,
  FunnelSimpleIcon,
  PlusIcon,
  TrashIcon,
  PencilSimpleIcon,
  CalendarBlankIcon,
  ClockIcon,
  FloppyDiskIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import { Post, PlatformType } from "@/lib/postpeer/types";
import { toast } from "sonner";

type ViewMode = "grid" | "list";
type SortMode = "newest" | "oldest";

interface Draft extends Post {
  lastEdited: string;
}

const STORAGE_KEY = "pulse-crm-drafts";

export function DraftsPageClient() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<PlatformType | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [loading, setLoading] = useState(true);

  // Load drafts from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDrafts(parsed);
      }
    } catch (error) {
      console.error("Failed to load drafts:", error);
      toast.error("Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  // Save drafts to localStorage whenever they change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      } catch (error) {
        console.error("Failed to save drafts:", error);
        toast.error("Failed to save drafts");
      }
    }
  }, [drafts, loading]);

  // Filter and sort drafts
  const filteredDrafts = useMemo(() => {
    let filtered = drafts;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((draft) =>
        draft.content.text.toLowerCase().includes(query)
      );
    }

    // Platform filter
    if (filterPlatform !== "all") {
      filtered = filtered.filter((draft) =>
        draft.content.platforms.includes(filterPlatform)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.lastEdited).getTime();
      const dateB = new Date(b.lastEdited).getTime();
      return sortMode === "newest" ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [drafts, searchQuery, filterPlatform, sortMode]);

  const handleDelete = (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    toast.success("Draft deleted");
  };

  const handleEdit = (draftId: string) => {
    // Navigate to composer with draft data
    toast.info("Opening composer...");
    // TODO: Implement navigation to composer with draft data
  };

  const handleScheduleNow = (draftId: string) => {
    // Navigate to scheduler with draft data
    toast.info("Opening scheduler...");
    // TODO: Implement scheduling logic
  };

  const handleNewDraft = () => {
    // Navigate to composer
    toast.info("Opening composer...");
    // TODO: Implement navigation to composer
  };

  const platformOptions: { value: PlatformType | "all"; label: string }[] = [
    { value: "all", label: "All Platforms" },
    { value: "twitter", label: "Twitter" },
    { value: "facebook", label: "Facebook" },
    { value: "instagram", label: "Instagram" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "youtube", label: "YouTube" },
    { value: "tiktok", label: "TikTok" },
    { value: "pinterest", label: "Pinterest" },
    { value: "bluesky", label: "Bluesky" },
    { value: "threads", label: "Threads" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b border-accent mx-auto mb-4" />
          <p className="text-sm text-fg-secondary">Loading drafts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-fg">
            Drafts
          </h1>
          <p className="text-sm text-fg-secondary mt-1">
            {filteredDrafts.length} {filteredDrafts.length === 1 ? "draft" : "drafts"}
          </p>
        </div>
        <Button
          onClick={handleNewDraft}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          New Draft
        </Button>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardBody>
          <div className="flex flex-col lg:flex-row gap-2">
            {/* Search */}
            <div className="flex-1">
              <SearchInput
                placeholder="Search drafts by content..."
                value={searchQuery}
                onChange={setSearchQuery}
                showShortcut={false}
                aria-label="Search drafts"
              />
            </div>

            {/* Platform Filter */}
            <div className="flex items-center gap-2">
              <FunnelSimpleIcon className="h-4 w-4 text-fg-muted" />
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value as PlatformType | "all")}
                className="h-8 rounded-md border border-line bg-surface px-2.5 text-sm text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                aria-label="Filter by platform"
              >
                {platformOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-fg-muted" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-8 rounded-md border border-line bg-surface px-2.5 text-sm text-fg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                aria-label="Sort drafts"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>

            {/* View Toggle */}
            <div className="inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                  viewMode === "grid"
                    ? "bg-surface text-fg"
                    : "text-fg-secondary hover:text-fg"
                )}
                aria-label="Grid view"
              >
                <div className="grid grid-cols-2 gap-1 h-4 w-4">
                  <div className="bg-current rounded-sm" />
                  <div className="bg-current rounded-sm" />
                  <div className="bg-current rounded-sm" />
                  <div className="bg-current rounded-sm" />
                </div>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-sm transition-colors",
                  viewMode === "list"
                    ? "bg-surface text-fg"
                    : "text-fg-secondary hover:text-fg"
                )}
                aria-label="List view"
              >
                <ListIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Drafts List/Grid */}
      {filteredDrafts.length === 0 ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-subtle mb-4">
                <FloppyDiskIcon className="h-5 w-5 text-fg-secondary" />
              </div>
              <h3 className="text-base font-semibold text-fg mb-1">
                {searchQuery || filterPlatform !== "all"
                  ? "No drafts found"
                  : "No drafts yet"}
              </h3>
              <p className="text-sm text-fg-secondary max-w-xs mb-6">
                {searchQuery || filterPlatform !== "all"
                  ? "Try adjusting your filters or search term"
                  : "Save your first draft by creating a post and saving it for later"}
              </p>
              {!searchQuery && filterPlatform === "all" && (
                <Button onClick={handleNewDraft} leftIcon={<PlusIcon className="h-4 w-4" />}>
                  Create Your First Draft
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-4"
          )}
        >
          <AnimatePresence mode="popLayout">
            {filteredDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                viewMode={viewMode}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSchedule={handleScheduleNow}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

interface DraftCardProps {
  draft: Draft;
  viewMode: ViewMode;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSchedule: (id: string) => void;
}

function DraftCard({ draft, viewMode, onEdit, onDelete, onSchedule }: DraftCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    } else {
      onDelete(draft.id);
      setShowDeleteConfirm(false);
    }
  };

  const timeAgo = getTimeAgo(draft.lastEdited);
  const contentPreview = draft.content.text.substring(0, 150);
  const hasMedia = draft.content.media.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card hover className={cn(viewMode === "list" && "flex-row")}>
        <CardBody className={cn(viewMode === "list" && "flex items-start gap-4")}>
          {/* Content */}
          <div className={cn("flex-1 space-y-3", viewMode === "list" && "space-y-2")}>
            {/* Text Preview */}
            <p className="text-sm text-fg line-clamp-3">
              {contentPreview}
              {draft.content.text.length > 150 && "..."}
            </p>

            {/* Media Badge */}
            {hasMedia && (
              <div className="flex items-center gap-1.5 text-xs text-fg-secondary">
                <div className="w-1 h-1 rounded-full bg-accent-strong" />
                <span>
                  {draft.content.media.length}{" "}
                  {draft.content.media.length === 1 ? "attachment" : "attachments"}
                </span>
              </div>
            )}

            {/* Platforms */}
            <div className="flex flex-wrap gap-2">
              {draft.content.platforms.map((platform) => (
                <PlatformIcon key={platform} platform={platform} size="sm" />
              ))}
            </div>

            {/* Last Edited */}
            <div className="flex items-center gap-1.5 text-xs text-fg-secondary">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>Edited {timeAgo}</span>
            </div>
          </div>

          {/* Actions */}
          <div className={cn("flex gap-2", viewMode === "grid" && "pt-2 border-t border-divider")}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(draft.id)}
              leftIcon={<PencilSimpleIcon className="h-4 w-4" />}
              className="flex-1"
              aria-label="Continue editing"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSchedule(draft.id)}
              leftIcon={<CalendarBlankIcon className="h-4 w-4" />}
              className="flex-1"
              aria-label="Schedule now"
            >
              Schedule
            </Button>
            <Button
              size="sm"
              variant={showDeleteConfirm ? "danger" : "ghost"}
              onClick={handleDelete}
              aria-label={showDeleteConfirm ? "Click again to confirm deletion" : "Delete draft"}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
  return `${Math.floor(seconds / 31536000)}y ago`;
}
