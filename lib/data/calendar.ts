// Calendar event types
export type CalendarEventType = "call" | "meeting" | "task" | "demo";

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string; // YYYY-MM-DD
  time: string;
  duration: string;
  status: "scheduled" | "completed" | "cancelled";
  owner: string;
  createdAt: string;
  relatedTo?: {
    id: string;
    name: string;
    type: "customer" | "lead" | "deal";
  };
  notes?: string;
}

// Event type colors for calendar display
export const eventTypeColors: Record<CalendarEventType, string> = {
  call: "bg-blue-500",
  meeting: "bg-purple-500",
  task: "bg-amber-500",
  demo: "bg-rose-500",
};

// Event type background colors (lighter) for calendar cells
export const eventTypeBgColors: Record<CalendarEventType, string> = {
  call: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  meeting:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  task: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  demo: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
};

// Dot colors for upcoming sidebar
export const eventDotColors: Record<CalendarEventType, string> = {
  call: "bg-blue-500",
  meeting: "bg-purple-500",
  task: "bg-green-500",
  demo: "bg-amber-500",
};

// Mock calendar events for January 2025
export const calendarEvents: CalendarEvent[] = [
  {
    id: "evt-1",
    title: "Call: Acme Corp",
    type: "call",
    date: "2025-01-06",
    time: "09:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "2 hours ago",
    relatedTo: { id: "c1", name: "Acme Corp", type: "customer" },
    notes: "Follow up on Q4 proposal",
  },
  {
    id: "evt-2",
    title: "Team Sync",
    type: "meeting",
    date: "2025-01-07",
    time: "10:00",
    duration: "1 hour",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 day ago",
  },
  {
    id: "evt-3",
    title: "Demo: TechFlow",
    type: "demo",
    date: "2025-01-08",
    time: "09:00",
    duration: "45 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "2 hours ago",
    relatedTo: { id: "l1", name: "TechFlow", type: "lead" },
    notes: "Product demonstration for enterprise features",
  },
  {
    id: "evt-4",
    title: "Follow-up Call",
    type: "call",
    date: "2025-01-08",
    time: "14:00",
    duration: "15 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "3 hours ago",
  },
  {
    id: "evt-5",
    title: "Send Proposal",
    type: "task",
    date: "2025-01-09",
    time: "09:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 day ago",
  },
  {
    id: "evt-6",
    title: "QBR: CloudNine",
    type: "meeting",
    date: "2025-01-10",
    time: "11:00",
    duration: "1 hour",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "2 days ago",
    relatedTo: { id: "c2", name: "CloudNine", type: "customer" },
  },
  {
    id: "evt-7",
    title: "Product Demo",
    type: "demo",
    date: "2025-01-11",
    time: "10:00",
    duration: "45 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 day ago",
  },
  {
    id: "evt-8",
    title: "Discovery Call",
    type: "call",
    date: "2025-01-11",
    time: "14:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "3 hours ago",
    relatedTo: { id: "l2", name: "StartupX", type: "lead" },
  },
  {
    id: "evt-9",
    title: "Sales Standup",
    type: "meeting",
    date: "2025-01-13",
    time: "09:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 week ago",
  },
  {
    id: "evt-10",
    title: "Check-in: Corp",
    type: "call",
    date: "2025-01-14",
    time: "15:00",
    duration: "15 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "2 days ago",
  },
  {
    id: "evt-11",
    title: "Demo: StartupX",
    type: "demo",
    date: "2025-01-15",
    time: "11:00",
    duration: "45 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "3 days ago",
    relatedTo: { id: "l2", name: "StartupX", type: "lead" },
  },
  {
    id: "evt-12",
    title: "Contract Review",
    type: "meeting",
    date: "2025-01-16",
    time: "10:00",
    duration: "1 hour",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "4 days ago",
  },
  {
    id: "evt-13",
    title: "Team Sync",
    type: "meeting",
    date: "2025-01-17",
    time: "10:00",
    duration: "1 hour",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 week ago",
  },
  {
    id: "evt-14",
    title: "Closing Call",
    type: "call",
    date: "2025-01-17",
    time: "14:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "2 days ago",
  },
  {
    id: "evt-15",
    title: "Intro Call: NewCo",
    type: "call",
    date: "2025-01-20",
    time: "09:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 day ago",
    relatedTo: { id: "l3", name: "NewCo", type: "lead" },
  },
  {
    id: "evt-16",
    title: "Pipeline Review",
    type: "task",
    date: "2025-01-21",
    time: "09:00",
    duration: "1 hour",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "3 days ago",
  },
  {
    id: "evt-17",
    title: "Demo: GlobalTech",
    type: "demo",
    date: "2025-01-22",
    time: "11:00",
    duration: "45 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "2 days ago",
  },
  {
    id: "evt-18",
    title: "Prep Renewal",
    type: "task",
    date: "2025-01-23",
    time: "10:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 day ago",
  },
  {
    id: "evt-19",
    title: "QBR: DataSync",
    type: "meeting",
    date: "2025-01-24",
    time: "14:00",
    duration: "1 hour",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "4 days ago",
    relatedTo: { id: "c3", name: "DataSync", type: "customer" },
  },
  {
    id: "evt-20",
    title: "Negotiation Call",
    type: "call",
    date: "2025-01-27",
    time: "09:00",
    duration: "45 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "2 days ago",
  },
  {
    id: "evt-21",
    title: "Team Sync",
    type: "meeting",
    date: "2025-01-28",
    time: "10:00",
    duration: "1 hour",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 week ago",
  },
  {
    id: "evt-22",
    title: "Prep Renewal",
    type: "task",
    date: "2025-01-29",
    time: "09:00",
    duration: "30 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "3 days ago",
  },
  {
    id: "evt-23",
    title: "Demo: Enterprise",
    type: "demo",
    date: "2025-01-30",
    time: "11:00",
    duration: "45 minutes",
    status: "scheduled",
    owner: "Sarah Chen",
    createdAt: "1 day ago",
  },
  {
    id: "evt-24",
    title: "Demo: TechFlow",
    type: "demo",
    date: "2025-01-11",
    time: "09:00",
    duration: "45 min",
    status: "completed",
    owner: "Sarah Chen",
    createdAt: "2 hours ago",
    relatedTo: { id: "l1", name: "MegaCorp", type: "customer" },
    notes:
      "Discussed final pricing and implementation timeline. Client is comparing with two other vendors but we're the front-runner. They need to make a decision by end of month.",
  },
];

// Helper to get events for a specific date
export const getEventsForDate = (date: string): CalendarEvent[] => {
  return calendarEvents.filter((event) => event.date === date);
};

// Helper to get upcoming events from a specific date
export const getUpcomingEvents = (
  fromDate: string,
  limit?: number,
): CalendarEvent[] => {
  const upcoming = calendarEvents
    .filter((event) => event.date >= fromDate && event.status === "scheduled")
    .sort((a, b) => {
      if (a.date === b.date) {
        return a.time.localeCompare(b.time);
      }
      return a.date.localeCompare(b.date);
    });

  return limit ? upcoming.slice(0, limit) : upcoming;
};
