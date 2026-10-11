import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TwentyWorkflow } from "@/lib/twenty/workflows/types";
const mocks = vi.hoisted(() => ({ connection: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/twenty/connections", () => ({ requireTwentyConnection: mocks.connection }));
vi.mock("@/lib/twenty/client", () => ({ getTwentyClient: () => ({ list: mocks.list }) }));
import { pollTwentyWorkflow } from "@/lib/twenty/workflows/poller";
const base: TwentyWorkflow = { id: "workflow", organization_id: "org", connection_id: "connection", connection_revision: 1, owner_id: "owner", kind: "company_link", enabled: true, config: {}, checkpoint: {}, lease_token: "lease", lease_until: "2026-10-11T11:00:00Z" };
function database() {
  const update = vi.fn();
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const chain: Record<string, unknown> = {};
  for (const method of ["eq", "gt"]) chain[method] = vi.fn(() => chain);
  chain.update = update.mockReturnValue(chain);
  chain.select = vi.fn(async () => ({ data: [{ id: "workflow" }], error: null }));
  return { db: { from: () => chain, rpc }, rpc, update };
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.connection.mockResolvedValue({ revision: 1 });
  mocks.list.mockResolvedValue({ records: [], endCursor: null, hasNextPage: false });
});
describe("Twenty polling checkpoints", () => {
  it("initializes without enqueuing historical people", async () => {
    const { db, rpc, update } = database(); await pollTwentyWorkflow(db as never, base);
    expect(mocks.list).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ checkpoint: { initialized: true, updatedAfter: expect.any(String) } }));
  });
  it("uses the activation checkpoint, preserves a page cursor, and advances only after durable observations", async () => {
    mocks.list.mockResolvedValue({ records: [{ id: "record", updatedAt: "2026-10-11T10:00:00Z" }], endCursor: "next-page", hasNextPage: true });
    const { db, rpc, update } = database();
    await pollTwentyWorkflow(db as never, { ...base, checkpoint: { initialized: true, updatedAfter: "2026-10-11T09:00:00Z", after: "previous-page" } });
    expect(mocks.list).toHaveBeenCalledWith("person", { limit: 50, after: "previous-page", updatedAfter: "2026-10-11T09:00:00Z" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ checkpoint: { initialized: true, updatedAfter: "2026-10-11T09:00:00Z", after: "next-page", highWater: "2026-10-11T10:00:00.000Z" } }));
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
  });
  it("keeps the completed high-water mark inclusive so equal timestamps can replay safely", async () => {
    mocks.list.mockResolvedValue({ records: [{ id: "record", updatedAt: "2026-10-11T10:00:00Z" }], endCursor: null, hasNextPage: false });
    const { db, update } = database();
    await pollTwentyWorkflow(db as never, { ...base, checkpoint: { initialized: true, updatedAfter: "2026-10-11T09:00:00Z" } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ checkpoint: { initialized: true, updatedAfter: "2026-10-11T10:00:00.000Z", after: null } }));
  });
  it("captures mailbox baseline state without historical jobs and starts incremental scanning from its baseline", async () => {
    mocks.list.mockResolvedValue({ records: [{ id: "mailbox", updatedAt: "2026-10-01T10:00:00Z", status: "ACTIVE", healthScore: 95, spamPlacementRate: 0.02 }], endCursor: null, hasNextPage: false });
    const { db, rpc, update } = database();
    await pollTwentyWorkflow(db as never, { ...base, kind: "mailbox_ready", checkpoint: { baselineStartedAt: "2026-10-11T09:00:00Z" } });
    expect(mocks.list).toHaveBeenCalledWith("mailbox", { limit: 50, after: undefined });
    expect(rpc).toHaveBeenCalledWith("twenty_observe_record", expect.objectContaining({ p_ready: true, p_baseline: true }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ checkpoint: { initialized: true, updatedAfter: "2026-10-11T09:00:00Z", after: null } }));
  });
  it("does not advance checkpoints after an enqueue failure", async () => {
    mocks.list.mockResolvedValue({ records: [{ id: "record", updatedAt: "2026-10-11T10:00:00Z" }], endCursor: null, hasNextPage: false });
    const { db, rpc, update } = database(); rpc.mockResolvedValue({ data: false, error: { message: "database unavailable" } as never });
    await expect(pollTwentyWorkflow(db as never, { ...base, checkpoint: { initialized: true, updatedAfter: "2026-10-11T09:00:00Z" } })).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
  it("refuses pagination without a cursor and rejects a changed connection", async () => {
    mocks.list.mockResolvedValue({ records: [], endCursor: null, hasNextPage: true });
    const { db, update } = database();
    await expect(pollTwentyWorkflow(db as never, { ...base, checkpoint: { initialized: true } })).rejects.toThrow(/invalid_pagination/);
    expect(update).not.toHaveBeenCalled();
    mocks.connection.mockResolvedValue({ revision: 2 });
    await expect(pollTwentyWorkflow(db as never, base)).rejects.toThrow(/connection_changed/);
  });
});
