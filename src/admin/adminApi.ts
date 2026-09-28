// ============================================================
// Shared fetch helper for the unified /admin portal.
//
// Deliberately a standalone copy of the `api` object in App.tsx rather than
// an import from it — the legacy #manage admin path and this new /admin
// path are kept independent so neither can accidentally share mutable
// module state, and either can be safely removed later without touching
// the other (the old #manage path is slated for removal in Phase 4).
// ============================================================

export class AdminApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

const checkOk = async (r: Response) => {
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    let code: string | undefined;
    try {
      const b = await r.json();
      msg = b.error ?? msg;
      code = b.code;
    } catch {}
    throw new AdminApiError(msg, r.status, code);
  }
  return r.json();
};

export const adminApi = {
  get:  (path: string)            => fetch(path).then(checkOk),
  post: (path: string, body: any) => fetch(path, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(checkOk),
  put:  (path: string, body: any) => fetch(path, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(checkOk),
  del:  (path: string)            => fetch(path, { method: 'DELETE' }).then(checkOk),
};
