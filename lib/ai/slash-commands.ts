export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  promptTemplate: string;
  category: "pipeline" | "leads" | "email" | "analytics" | "general";
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "pipeline",
    label: "Pipeline Summary",
    description: "Get pipeline overview and insights",
    icon: "ChartBar",
    promptTemplate:
      "Give me a summary of my current pipeline including deal count, total value, and stage distribution.",
    category: "pipeline",
  },
  {
    id: "deal-advice",
    label: "Deal Advice",
    description: "Get advice on the current deal",
    icon: "Lightbulb",
    promptTemplate:
      "Analyze the current deal and give me advice on how to move it forward. What should I focus on?",
    category: "pipeline",
  },
  {
    id: "score-leads",
    label: "Score Top Leads",
    description: "Score and rank your best leads",
    icon: "Target",
    promptTemplate:
      "Score my top leads and rank them by conversion potential. Which ones should I focus on?",
    category: "leads",
  },
  {
    id: "find-leads",
    label: "Find Prospects",
    description: "Find matching leads from your CRM",
    icon: "MagnifyingGlass",
    promptTemplate:
      "Find leads in my CRM that match my ICP and haven't been contacted recently. Show me the best prospects.",
    category: "leads",
  },
  {
    id: "gen-email",
    label: "Generate Email",
    description: "Draft a personalized outreach email",
    icon: "Envelope",
    promptTemplate: "Draft a personalized outreach email for ",
    category: "email",
  },
  {
    id: "campaign-ideas",
    label: "Campaign Ideas",
    description: "Generate outreach campaign strategies",
    icon: "Megaphone",
    promptTemplate:
      "Suggest 3 email campaign ideas based on my current leads and pipeline data.",
    category: "email",
  },
  {
    id: "weekly-analytics",
    label: "Weekly Analytics",
    description: "This week's sales performance",
    icon: "ChartLineUp",
    promptTemplate:
      "Give me a weekly analytics summary of my sales performance including deals closed, pipeline changes, and key metrics.",
    category: "analytics",
  },
  {
    id: "audit",
    label: "Audit Workspace",
    description: "Audit your CRM data quality",
    icon: "ShieldCheck",
    promptTemplate:
      "Audit my CRM workspace. Look for stale deals, missing information, and data quality issues. Suggest improvements.",
    category: "general",
  },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const lower = query.toLowerCase().replace("/", "");
  if (!lower) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(lower) ||
      cmd.id.includes(lower) ||
      cmd.category.includes(lower),
  );
}
