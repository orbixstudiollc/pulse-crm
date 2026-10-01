// Request body of POST /api/ai/chat (Copilot 2.0).
//
// The client sends only a human action: a new message, or its answers to
// pending approvals. It never sends history, tool parts or tool results; the
// server loads the conversation's history itself (lib/ai/history.ts). Every
// object is strict, so a body carrying `messages`, `parts` or any other extra
// key is rejected instead of silently stripped.

import { z } from "zod";

export const CHAT_ENTITY_TYPES = ["lead", "deal", "customer", "competitor", "contact", "thread"] as const;

export const chatRequestSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    pageKey: z.string().max(64).optional(),
    message: z.object({ text: z.string().min(1).max(8000) }).strict().optional(),
    approvals: z
      .array(
        z
          .object({
            approvalId: z.string().min(1).max(128),
            approved: z.boolean(),
            reason: z.string().max(500).optional(),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    context: z
      .object({
        page: z.string().max(64).optional(),
        entityType: z.enum(CHAT_ENTITY_TYPES).optional(),
        entityId: z.string().uuid().optional(),
        selectedIds: z.array(z.string().uuid()).max(50).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatRequestContext = NonNullable<ChatRequest["context"]>;
