// ============================================================
// Shared fetch helper for the unified /admin portal.
//
// Deliberately a standalone copy of the `api` object in App.tsx rather than
// an import from it — the legacy #manage admin path and this new /admin
// path are kept independent so neither can accidentally share mutable
// module state, and either can be safely removed later without touching
// the other (the old #manage path is slated for removal in Phase 4).
// ============================================================

const checkOk = async (r: Response) => {
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try { const b = await r.json(); msg = b.error ?? msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
};

export const adminApi = {
  get:  (path: string)            => fetch(path).then(checkOk),
  post: (path: string, body: any) => fetch(path, { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(checkOk),
  put:  (path: string, body: any) => fetch(path, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(checkOk),
  del:  (path: string)            => fetch(path, { method: 'DELETE' }).then(checkOk),
};
