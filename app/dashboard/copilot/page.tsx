import { getConversations, getMemoryItems, getCopilotTasks } from "@/lib/actions/copilot";
import { CopilotClient } from "./client";

export default async function CopilotPage() {
  const [convResult, memoryResult, tasksResult] = await Promise.all([
    getConversations(),
    getMemoryItems(),
    getCopilotTasks(),
  ]);

  return (
    <CopilotClient
      initialConversations={convResult.data || []}
      initialMemory={memoryResult.data || []}
      initialTasks={tasksResult.data || []}
    />
  );
}
