import { getMemoryItems, getCopilotTasks } from "@/lib/actions/copilot";
import { listConversationMessages, listConversations } from "@/lib/actions/copilot-conversations";
import { getArtifact, listArtifacts } from "@/lib/actions/copilot-artifacts";
import { listPendingApprovalsAction } from "@/lib/actions/copilot-approvals";
import { getCopilotSettings } from "@/lib/actions/copilot-settings";
import { getAssistantBrief } from "@/lib/actions/copilot-brief";
import { CopilotClient, type CopilotView } from "./client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIEWS: readonly CopilotView[] = ["chat", "artifacts", "memory", "tasks", "settings"];

type SearchParams = { [key: string]: string | string[] | undefined };

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CopilotPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const prompt = single(params.prompt)?.trim() || null;
  const requestedChat = single(params.c);
  const requestedArtifact = single(params.artifact);
  const requestedView = single(params.view);

  const [conversations, memoryResult, tasksResult, pending, artifacts, settings, brief] = await Promise.all([
    listConversations(),
    getMemoryItems(),
    getCopilotTasks(),
    listPendingApprovalsAction(),
    listArtifacts(),
    // The settings view shows an error state when this cannot be read; it must not break the chat page.
    getCopilotSettings().catch((error) => {
      console.error("Copilot: loading settings failed:", error);
      return null;
    }),
    // The start screen renders without its "Today" counts when they cannot be read.
    getAssistantBrief().catch((error) => {
      console.error("Copilot: loading the brief failed:", error);
      return null;
    }),
  ]);

  // ?c=<id> opens that chat if it is one of this user's; a ?prompt= starts a new one instead.
  const conversationId =
    !prompt && requestedChat && conversations.some((conversation) => conversation.id === requestedChat)
      ? requestedChat
      : null;
  const messages = conversationId ? await listConversationMessages(conversationId) : [];

  // ?artifact=<id> (task result notification) opens that artifact, even when it is not in the first page.
  let initialArtifactId: string | null = null;
  let initialArtifacts = artifacts;
  if (requestedArtifact && UUID.test(requestedArtifact)) {
    const artifact = artifacts.find((item) => item.id === requestedArtifact) ?? (await getArtifact(requestedArtifact));
    if (artifact) {
      initialArtifactId = artifact.id;
      if (!artifacts.some((item) => item.id === artifact.id)) initialArtifacts = [artifact, ...artifacts];
    }
  }

  // ?view=approvals (approval notification) is the chat page with the pending approvals strip open.
  const approvalsOpen = requestedView === "approvals";
  const view: CopilotView = initialArtifactId
    ? "artifacts"
    : VIEWS.find((candidate) => candidate === requestedView) ?? "chat";

  return (
    <CopilotClient
      // A link to this page with other params (a notification) starts a fresh client; the prompt is excluded because the client strips it itself.
      key={[conversationId, requestedArtifact, requestedView].join("|")}
      initialConversations={conversations}
      initialConversationId={conversationId}
      initialMessages={messages}
      initialMemory={memoryResult.data || []}
      initialTasks={tasksResult.data || []}
      initialPending={pending}
      initialArtifacts={initialArtifacts}
      initialArtifactId={initialArtifactId}
      initialSettings={settings}
      initialView={view}
      initialPrompt={prompt}
      approvalsOpen={approvalsOpen}
      brief={brief}
    />
  );
}
