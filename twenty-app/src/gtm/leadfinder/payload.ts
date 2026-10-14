import { ProspeoError } from 'src/gtm/prospeo/client';

// The same handler serves the AI tool trigger (payload = the tool input) and
// the HTTP route (payload = a request event whose body is the input).

type Obj = Record<string, unknown>;

export function toolOrRouteInput<T extends Obj>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    const p = payload as Obj;
    if ('requestContext' in p && 'body' in p) {
      const body = p.body;
      if (typeof body === 'string') {
        try {
          return (JSON.parse(body) ?? {}) as T;
        } catch {
          return {} as T;
        }
      }
      return ((body as T | null) ?? {}) as T;
    }
    return p as T;
  }
  return {} as T;
}

export type FailureResult = { ok: false; error: string; code?: string };

export function failure(err: unknown): FailureResult {
  if (err instanceof ProspeoError) return { ok: false, error: err.message, code: err.code };
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}
