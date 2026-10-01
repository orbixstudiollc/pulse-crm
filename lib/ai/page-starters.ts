export interface PageStarter {
  label: string;
  prompt: string;
}

// Prompts refer to "the selected records"; ids travel only in context.selectedIds.
export function startersFor(pageKey: string, selection: { count: number }): PageStarter[] {
  switch (pageKey) {
    case "leads": {
      const starters: PageStarter[] = [];
      if (selection.count > 0) {
        starters.push(
          { label: "Find leads like these", prompt: "Find leads similar to the selected records." },
          { label: "Score these", prompt: "Score the selected records and explain the ranking." },
        );
      }
      starters.push({
        label: "Find hot leads with no follow-up",
        prompt: "Find hot leads that have no follow-up scheduled.",
      });
      return starters;
    }
    case "lead_detail":
      return [
        { label: "Summarize", prompt: "Summarize this lead and where things stand." },
        { label: "Draft follow-up", prompt: "Draft a follow-up message for this lead." },
      ];
    case "deals":
      return [
        { label: "Which deals are at risk?", prompt: "Which deals are at risk and why?" },
        { label: "Move stale deals", prompt: "Suggest stage changes for stale deals." },
      ];
    case "inbox":
      return [
        { label: "Draft a reply", prompt: "Draft a reply to this thread." },
        { label: "Summarize thread", prompt: "Summarize this thread." },
      ];
    default:
      return [];
  }
}
