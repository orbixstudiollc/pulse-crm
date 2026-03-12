import type { PageContext } from "./types";

export function getSuggestionsForContext(ctx?: PageContext): string[] {
  if (!ctx?.page) {
    return [
      "Summarize my pipeline",
      "Score my top leads",
      "Draft an email to...",
      "What deals need attention?",
    ];
  }

  const page = ctx.page.toLowerCase();

  if (page.includes("sales") || page.includes("deal")) {
    if (ctx.entityId) {
      return [
        "Analyze this deal and suggest next steps",
        "Draft a follow-up email for this deal",
        "What's the risk level of this deal?",
        "Who else should I involve?",
      ];
    }
    return [
      "Summarize my pipeline",
      "Which deals are at risk?",
      "What's my forecasted revenue?",
      "Show deals closing this month",
    ];
  }

  if (page.includes("lead")) {
    if (ctx.entityId) {
      return [
        "Score this lead",
        "Draft an outreach email for this lead",
        "What's the best approach for this lead?",
        "Find similar leads",
      ];
    }
    return [
      "Score my top leads",
      "Find leads matching my ICP",
      "Draft a cold outreach email",
      "Which leads haven't been contacted?",
    ];
  }

  if (page.includes("customer")) {
    if (ctx.entityId) {
      return [
        "Summarize this customer's history",
        "Any upsell opportunities here?",
        "Draft a check-in email",
        "Show this customer's deals",
      ];
    }
    return [
      "Show customers at risk of churning",
      "Who are my top customers?",
      "Find upsell opportunities",
      "Customer health overview",
    ];
  }

  if (page.includes("contact")) {
    return [
      "Find contacts by company",
      "Who are my key decision makers?",
      "Draft a personalized email",
      "Show contacts without recent activity",
    ];
  }

  if (page.includes("sequence")) {
    return [
      "Suggest a sequence strategy",
      "Write a 3-step email sequence",
      "Which sequences are performing best?",
      "Optimize my subject lines",
    ];
  }

  if (page.includes("analytic")) {
    return [
      "Weekly performance summary",
      "Compare this month vs last",
      "What's my conversion rate?",
      "Revenue forecast for this quarter",
    ];
  }

  if (page.includes("competitor")) {
    return [
      "Compare my top competitors",
      "Generate a battle card",
      "How do we differentiate?",
      "What are our weaknesses?",
    ];
  }

  if (page.includes("icp")) {
    return [
      "Analyze my ICP accuracy",
      "Which leads best match my ICP?",
      "Suggest ICP improvements",
      "Compare ICP to actual wins",
    ];
  }

  return [
    "Summarize my pipeline",
    "Score my top leads",
    "Draft an email to...",
    "Prepare for my next meeting",
  ];
}
