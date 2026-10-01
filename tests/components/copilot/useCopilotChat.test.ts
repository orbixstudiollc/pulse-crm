// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { HttpChatTransportInitOptions, UIMessage } from "ai";

const listConversationMessages = vi.fn<(id: string) => Promise<UIMessage[]>>();
vi.mock("@/lib/actions/copilot-conversations", () => ({
  listConversationMessages: (id: string) => listConversationMessages(id),
}));

// The real transport, with its constructor options captured so the hook's own
// prepareSendMessagesRequest can be called directly.
const transportOptions: HttpChatTransportInitOptions<UIMessage>[] = [];
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  class CapturingTransport extends actual.DefaultChatTransport<UIMessage> {
    constructor(options: HttpChatTransportInitOptions<UIMessage>) {
      transportOptions.push(options);
      super(options);
    }
  }
  return { ...actual, DefaultChatTransport: CapturingTransport };
});

import { approvalResponsesFromLastAssistant, useCopilotChat } from "@/components/features/Copilot/useCopilotChat";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CONV_ID = "11111111-1111-4111-8111-111111111111";
const BODY_KEYS = ["approvals", "context", "conversationId", "message", "pageKey"];

type Hook = ReturnType<typeof useCopilotChat>;
type HookArgs = Parameters<typeof useCopilotChat>[0];

let root: Root | null = null;
let hook: Hook;

function Harness(props: HookArgs) {
  const result = useCopilotChat(props);
  useEffect(() => {
    hook = result;
  });
  return null;
}

function render(props: HookArgs) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(createElement(Harness, props)));
}

function sseResponse(chunks: object[], headers: Record<string, string> = {}): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1", ...headers },
  });
}

function textReply(messageId: string, text: string, extra: object[] = []): object[] {
  return [
    { type: "start", messageId },
    ...extra,
    { type: "start-step" },
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
    { type: "finish-step" },
    { type: "finish" },
  ];
}

function sentBody(fetchMock: ReturnType<typeof vi.fn>, call: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[call][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

function toolPart(callId: string, approval: Record<string, unknown>, state: string) {
  return { type: "tool-update_lead", toolCallId: callId, state, input: { id: "x" }, approval };
}

/** A stored assistant turn that stopped on two approval cards. */
function pendingTurn(): UIMessage[] {
  return [
    { id: "u1", role: "user", parts: [{ type: "text", text: "Mark both leads hot" }] },
    {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        toolPart("call-1", { id: "ap-1" }, "approval-requested"),
        toolPart("call-2", { id: "ap-2" }, "approval-requested"),
      ],
    } as UIMessage,
  ];
}

beforeEach(() => {
  transportOptions.length = 0;
  listConversationMessages.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("approvalResponsesFromLastAssistant", () => {
  it("returns only the responded approvals of the last assistant message", () => {
    const messages = [
      {
        id: "a0",
        role: "assistant",
        parts: [toolPart("old", { id: "ap-old", approved: true }, "approval-responded")],
      },
      { id: "u1", role: "user", parts: [{ type: "text", text: "go" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "step-start" },
          toolPart("c1", { id: "ap-1", approved: true }, "approval-responded"),
          toolPart("c2", { id: "ap-2" }, "approval-requested"),
          toolPart("c3", { id: "ap-3", approved: false, reason: "wrong lead" }, "approval-responded"),
          { ...toolPart("c4", { id: "ap-4", approved: false }, "output-denied") },
          { type: "text", text: "done" },
        ],
      },
    ] as UIMessage[];

    expect(approvalResponsesFromLastAssistant(messages)).toEqual([
      { approvalId: "ap-1", approved: true },
      { approvalId: "ap-3", approved: false, reason: "wrong lead" },
    ]);
  });

  it("returns nothing when there is no assistant message", () => {
    expect(approvalResponsesFromLastAssistant([{ id: "u", role: "user", parts: [] }])).toEqual([]);
  });
});

describe("prepareSendMessagesRequest", () => {
  it("sends exactly conversationId, pageKey, context, message and approvals, never history", async () => {
    const context = { page: "leads", entityType: "lead" as const };
    render({ conversationId: CONV_ID, pageKey: "leads", initialMessages: [], context });
    const prepare = transportOptions.at(-1)!.prepareSendMessagesRequest!;

    const common = { id: "chat", requestMetadata: undefined, body: {}, credentials: undefined, headers: undefined, api: "/api/ai/chat" };
    const withMessage = await prepare({
      ...common,
      trigger: "submit-message",
      messageId: undefined,
      messages: [...pendingTurn(), { id: "u2", role: "user", parts: [{ type: "text", text: "Hello" }] }],
    });
    expect(Object.keys(withMessage.body!).sort()).toEqual(BODY_KEYS);
    expect(withMessage.body).toEqual({
      conversationId: CONV_ID,
      pageKey: "leads",
      context,
      message: { text: "Hello" },
      approvals: [],
    });

    const answered = pendingTurn();
    answered[1].parts = [
      { type: "step-start" },
      toolPart("call-1", { id: "ap-1", approved: true }, "approval-responded"),
    ] as UIMessage["parts"];
    const withApprovals = await prepare({ ...common, trigger: "submit-message", messageId: "a1", messages: answered });
    const approvalsBody = withApprovals.body as Record<string, unknown>;
    expect(Object.keys(approvalsBody).sort()).toEqual(BODY_KEYS);
    expect(approvalsBody.message).toBeUndefined();
    expect(approvalsBody.approvals).toEqual([{ approvalId: "ap-1", approved: true }]);
  });
});

describe("useCopilotChat over fetch", () => {
  it("posts a message without history, learns the conversation id and shows notices", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse(
          textReply("a1", "Hi there", [{ type: "data-notice", data: { code: "no_tools", message: "No CRM tools here." } }]),
          { "x-conversation-id": CONV_ID },
        ),
      )
      .mockResolvedValueOnce(sseResponse(textReply("a2", "Again"), { "x-conversation-id": CONV_ID }));
    vi.stubGlobal("fetch", fetchMock);
    render({ conversationId: null, pageKey: "dashboard", initialMessages: [] });

    await act(async () => hook.sendText("Hello"));
    await vi.waitFor(() => expect(hook.status).toBe("ready"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/ai/chat");
    const first = sentBody(fetchMock, 0);
    expect(first).not.toHaveProperty("messages");
    expect(first).toEqual({ pageKey: "dashboard", message: { text: "Hello" }, approvals: [] });
    expect(hook.conversationId).toBe(CONV_ID);
    expect(hook.notice).toBe("No CRM tools here.");
    expect(hook.messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    await act(async () => hook.sendText("More"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const second = sentBody(fetchMock, 1);
    expect(second).not.toHaveProperty("messages");
    expect(second).toEqual({ conversationId: CONV_ID, pageKey: "dashboard", message: { text: "More" }, approvals: [] });
  });

  it("sends the approvals once every card is answered, with no message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([
        { type: "start", messageId: "a1" },
        { type: "tool-output-available", toolCallId: "call-1", output: { ok: true } },
        { type: "tool-output-denied", toolCallId: "call-2" },
        { type: "finish" },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    render({ conversationId: CONV_ID, initialMessages: pendingTurn() });

    await act(async () => hook.approve("ap-1"));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => hook.deny("ap-2", "Not this one"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = sentBody(fetchMock, 0);
    expect(body).not.toHaveProperty("messages");
    expect(body).not.toHaveProperty("message");
    expect(body).toEqual({
      conversationId: CONV_ID,
      approvals: [
        { approvalId: "ap-1", approved: true },
        { approvalId: "ap-2", approved: false, reason: "Not this one" },
      ],
    });
    await vi.waitFor(() => expect(hook.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reloads the conversation from the server once after 400 invalid_approval", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ error: "invalid_approval", approvalId: "ap-1" }, { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const serverState: UIMessage[] = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Mark both leads hot" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Already resolved elsewhere." }] },
    ];
    listConversationMessages.mockResolvedValue(serverState);
    render({ conversationId: CONV_ID, initialMessages: pendingTurn() });

    await act(async () => hook.approve("ap-1"));
    await act(async () => hook.approve("ap-2"));
    await vi.waitFor(() => expect(hook.status).toBe("error"));
    await vi.waitFor(() => expect(hook.messages).toEqual(serverState));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(listConversationMessages).toHaveBeenCalledTimes(1);
    expect(listConversationMessages).toHaveBeenCalledWith(CONV_ID);
  });

  it("reloads after 409 turn_in_progress but not after other errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error: "empty_turn" }, { status: 400 }))
      .mockResolvedValueOnce(Response.json({ error: "turn_in_progress" }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    listConversationMessages.mockResolvedValue(pendingTurn());
    render({ conversationId: CONV_ID, initialMessages: [] });

    await act(async () => hook.sendText("first"));
    await vi.waitFor(() => expect(hook.status).toBe("error"));
    expect(listConversationMessages).not.toHaveBeenCalled();

    await act(async () => hook.sendText("second"));
    await vi.waitFor(() => expect(listConversationMessages).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(hook.messages).toEqual(pendingTurn()));
  });
});
