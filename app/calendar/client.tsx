"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/dashboard";
import { PlatformIcon } from "@/components/postpeer";
import { cn } from "@/lib/utils";
import { Post, PlatformType } from "@/lib/postpeer/types";
import { toast } from "sonner";
import {
  CaretLeft,
  CaretRight,
  Plus,
  FunnelSimple,
} from "@phosphor-icons/react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "month" | "week" | "day";

interface CalendarPost extends Post {
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PLATFORM_COLORS: Record<PlatformType, string> = {
  twitter: "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300",
  facebook: "bg-blue-600/20 border-blue-600 text-blue-700 dark:text-blue-300",
  instagram: "bg-pink-500/20 border-pink-500 text-pink-700 dark:text-pink-300",
  linkedin: "bg-sky-600/20 border-sky-600 text-sky-700 dark:text-sky-300",
  youtube: "bg-red-600/20 border-red-600 text-red-700 dark:text-red-300",
  tiktok: "bg-neutral-900/20 border-neutral-900 text-neutral-900 dark:text-neutral-100",
  pinterest: "bg-red-500/20 border-red-500 text-red-700 dark:text-red-300",
  bluesky: "bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300",
  threads: "bg-neutral-900/20 border-neutral-900 text-neutral-900 dark:text-neutral-100",
};

// ── Helper Functions ───────────────────────────────────────────────────────────

function parseScheduledDate(post: Post): { date: string; time: string } | null {
  if (!post.content.scheduledAt) return null;

  try {
    const scheduled = new Date(post.content.scheduledAt);
    const date = scheduled.toISOString().split("T")[0];
    const hours = String(scheduled.getHours()).padStart(2, "0");
    const minutes = String(scheduled.getMinutes()).padStart(2, "0");
    const time = `${hours}:${minutes}`;
    return { date, time };
  } catch {
    return null;
  }
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CalendarPageClient({
  initialMonth,
  initialYear,
}: {
  initialMonth: number;
  initialYear: number;
}) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType | "all">("all");
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Fetch posts from PostPeer API
  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      try {
        // TODO: Implement actual API call to PostPeer
        // For now, use mock data
        const mockPosts: CalendarPost[] = [
          {
            id: "1",
            content: {
              text: "New product launch announcement! 🚀",
              media: [],
              platforms: ["twitter", "linkedin"],
              scheduledAt: `${currentYear}-${String(currentMonth).padStart(2, "0")}-15T10:00:00Z`,
            },
            status: "scheduled",
            createdAt: new Date().toISOString(),
            scheduledDate: `${currentYear}-${String(currentMonth).padStart(2, "0")}-15`,
            scheduledTime: "10:00",
          },
          {
            id: "2",
            content: {
              text: "Behind the scenes of our team culture",
              media: [],
              platforms: ["instagram", "facebook"],
              scheduledAt: `${currentYear}-${String(currentMonth).padStart(2, "0")}-20T14:30:00Z`,
            },
            status: "scheduled",
            createdAt: new Date().toISOString(),
            scheduledDate: `${currentYear}-${String(currentMonth).padStart(2, "0")}-20`,
            scheduledTime: "14:30",
          },
        ];
        setPosts(mockPosts);
      } catch (error) {
        console.error("Failed to fetch posts:", error);
        toast.error("Failed to load scheduled posts");
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, [currentMonth, currentYear]);

  // Filter posts by platform
  const filteredPosts = useMemo(() => {
    if (selectedPlatform === "all") return posts;
    return posts.filter((post) =>
      post.content.platforms.includes(selectedPlatform)
    );
  }, [posts, selectedPlatform]);

  // Calendar grid calculation
  const month = currentMonth - 1;
  const year = currentYear;
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const getPostsForDay = (day: number): CalendarPost[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredPosts.filter((post) => post.scheduledDate === dateStr);
  };

  const today = new Date();

  // Navigation
  const goToPreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth() + 1);
    setCurrentYear(now.getFullYear());
  };

  // Handle post click
  const handlePostClick = (post: CalendarPost) => {
    setSelectedPost(post);
  };

  // Handle date click (for adding new post)
  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    toast.info(`Add new post for ${dateStr}`);
    // TODO: Open post creation modal with pre-filled date
  };

  // Handle drag-drop reschedule
  const handleReschedule = async (postId: string, newDate: string) => {
    try {
      // TODO: Implement API call to update post schedule
      toast.success("Post rescheduled successfully");

      // Update local state
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, scheduledDate: newDate }
            : post
        )
      );
    } catch (error) {
      console.error("Failed to reschedule post:", error);
      toast.error("Failed to reschedule post");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <PageHeader title="Content Calendar">
        <div className="flex items-center gap-2">
          {/* Platform Filter */}
          <div className="relative">
            <Button
              variant="outline"
              leftIcon={<FunnelSimple size={18} weight="bold" />}
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              aria-label="Filter by platform"
            >
              {selectedPlatform === "all" ? "All Platforms" : selectedPlatform}
            </Button>

            {showFilterDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFilterDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-56 z-20 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-lg py-2">
                  <button
                    onClick={() => {
                      setSelectedPlatform("all");
                      setShowFilterDropdown(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors",
                      selectedPlatform === "all" && "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                    )}
                  >
                    All Platforms
                  </button>
                  {(["twitter", "facebook", "instagram", "linkedin", "youtube", "tiktok", "pinterest", "bluesky", "threads"] as PlatformType[]).map((platform) => (
                    <button
                      key={platform}
                      onClick={() => {
                        setSelectedPlatform(platform);
                        setShowFilterDropdown(false);
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors flex items-center gap-2",
                        selectedPlatform === platform && "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                      )}
                    >
                      <PlatformIcon platform={platform} size="sm" />
                      <span className="capitalize">{platform}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Button
            leftIcon={<Plus size={20} weight="bold" />}
            onClick={() => toast.info("Create new post")}
            aria-label="Create new post"
          >
            New Post
          </Button>
        </div>
      </PageHeader>

      {/* View Mode Toggle & Navigation */}
      <div className="flex items-center justify-between mb-6">
        {/* Calendar Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            aria-label="Previous month"
          >
            <CaretLeft size={16} weight="bold" className="text-neutral-600 dark:text-neutral-400" />
          </button>

          <div className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 min-w-[160px] text-center">
            <span className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
              {MONTHS[month]} {year}
            </span>
          </div>

          <button
            onClick={goToNextMonth}
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
            aria-label="Next month"
          >
            <CaretRight size={16} weight="bold" className="text-neutral-600 dark:text-neutral-400" />
          </button>

          <Button
            variant="outline"
            onClick={goToToday}
            size="sm"
          >
            Today
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          {(["month", "week", "day"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
                viewMode === mode
                  ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 shadow-sm"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid (Month View) */}
      {viewMode === "month" && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
            {DAYS.map((day) => (
              <div
                key={day}
                className="px-3 py-3 text-center text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide border-r border-neutral-200 dark:border-neutral-800 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayPosts = day ? getPostsForDay(day) : [];
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[120px] p-3 border-r border-b border-neutral-200 dark:border-neutral-800 transition-colors",
                    "[&:nth-child(7n)]:border-r-0",
                    !day && "bg-neutral-50/50 dark:bg-neutral-900/30",
                    day && "hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 cursor-pointer"
                  )}
                  onClick={() => day && handleDateClick(day)}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full",
                            isToday
                              ? "bg-indigo-600 text-white"
                              : "text-neutral-950 dark:text-neutral-50"
                          )}
                        >
                          {day}
                        </span>
                        {dayPosts.length > 0 && (
                          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                            {dayPosts.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {dayPosts.slice(0, 3).map((post) => {
                          const primaryPlatform = post.content.platforms[0];
                          return (
                            <button
                              key={post.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostClick(post);
                              }}
                              className={cn(
                                "w-full px-2 py-1.5 rounded-md text-xs font-medium text-left transition-all hover:shadow-sm border-l-2",
                                PLATFORM_COLORS[primaryPlatform]
                              )}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("postId", post.id);
                              }}
                            >
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <PlatformIcon platform={primaryPlatform} size="sm" />
                                <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                                  {formatTime(post.scheduledTime)}
                                </span>
                              </div>
                              <p className="truncate text-neutral-900 dark:text-neutral-100">
                                {post.content.text}
                              </p>
                            </button>
                          );
                        })}
                        {dayPosts.length > 3 && (
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 pl-2 pt-0.5">
                            +{dayPosts.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View (Placeholder) */}
      {viewMode === "week" && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-center">
          <p className="text-neutral-500 dark:text-neutral-400">
            Week view coming soon
          </p>
        </div>
      )}

      {/* Day View (Placeholder) */}
      {viewMode === "day" && (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-center">
          <p className="text-neutral-500 dark:text-neutral-400">
            Day view coming soon
          </p>
        </div>
      )}

      {/* Post Detail Modal (Simple overlay) */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 max-w-lg w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                Scheduled Post
              </h3>
              <button
                onClick={() => setSelectedPost(null)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Platforms
                </label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPost.content.platforms.map((platform) => (
                    <div
                      key={platform}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800"
                    >
                      <PlatformIcon platform={platform} size="sm" />
                      <span className="text-xs font-medium capitalize text-neutral-700 dark:text-neutral-300">
                        {platform}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Scheduled For
                </label>
                <p className="text-sm text-neutral-950 dark:text-neutral-50 mt-1">
                  {selectedPost.scheduledDate} at {formatTime(selectedPost.scheduledTime)}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Content
                </label>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1 whitespace-pre-wrap">
                  {selectedPost.content.text}
                </p>
              </div>

              <div className="flex gap-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast.info("Edit post");
                    setSelectedPost(null);
                  }}
                  fullWidth
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    toast.info("Delete post");
                    setSelectedPost(null);
                  }}
                  fullWidth
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      )}
    </div>
  );
}
