import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dev session — persisted to data/.session so server restarts don't log you out
const DEV_PASSWORD = process.env.DEV_ADMIN_PASSWORD;
const SESSION_FILE = path.join(process.cwd(), "data", ".session");

const readSession = async (): Promise<boolean> => {
  try { return (await fs.readFile(SESSION_FILE, "utf-8")).trim() === "1"; } catch { return false; }
};
const writeSession = async (v: boolean) => {
  await fs.writeFile(SESSION_FILE, v ? "1" : "0");
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  const DATA_DIR = path.join(process.cwd(), "data");
  await fs.mkdir(DATA_DIR, { recursive: true });

  const readJSON = async (name: string): Promise<any[]> => {
    try {
      return JSON.parse(await fs.readFile(path.join(DATA_DIR, `${name}.json`), "utf-8"));
    } catch { return []; }
  };

  const writeJSON = async (name: string, data: any[]) => {
    await fs.writeFile(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
  };

  // ── Auth ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    if (!DEV_PASSWORD) {
      return res.status(503).json({ error: "DEV_ADMIN_PASSWORD is not configured" });
    }
    if (req.body?.password === DEV_PASSWORD) {
      await writeSession(true);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  app.post("/api/auth/logout", async (_req, res) => {
    await writeSession(false);
    res.json({ success: true });
  });

  app.get("/api/auth/check", async (_req, res) => {
    res.json({ authenticated: await readSession() });
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  app.get("/api/settings", async (_req, res) => {
    const raw = await readJSON("settings");
    const out: Record<string, string> = {};
    for (const row of raw) out[row.setting_key] = row.setting_value;
    // Defaults if file doesn't exist yet
    if (!out.phase) out.phase = "LIVE_EVENT";
    res.json(out);
  });

  app.post("/api/settings", async (req, res) => {
    const existing = await readJSON("settings");
    const map: Record<string, string> = {};
    for (const r of existing) map[r.setting_key] = r.setting_value;
    for (const [k, v] of Object.entries(req.body)) map[k] = v as string;
    const rows = Object.entries(map).map(([k, v]) => ({ setting_key: k, setting_value: v }));
    await writeJSON("settings", rows);
    res.json({ success: true });
  });

  // ── Events ────────────────────────────────────────────────────────────────
  app.get("/api/events", async (_req, res) => {
    // Mirrors api/index.php's `ORDER BY sort_order ASC, id ASC` — the mock
    // JSON store's array order isn't otherwise meaningful.
    const events = await readJSON("events");
    events.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.id).localeCompare(String(b.id)));
    res.json(events);
  });

  app.post("/api/events", async (req, res) => {
    const events = await readJSON("events");
    const newEvent = { id: Date.now().toString(), ...req.body };
    events.push(newEvent);
    await writeJSON("events", events);
    res.status(201).json(newEvent);
  });

  // Bulk reorder — mirrors api/index.php's handle_events_reorder(). Must be
  // registered before the PUT /api/events/:id route below isn't an issue
  // (different HTTP verb), but kept here for readability alongside it.
  app.post("/api/events/reorder", async (req, res) => {
    const events = await readJSON("events");
    const ids: string[] = req.body?.ids ?? [];
    ids.forEach((id, i) => {
      const ev = events.find((e) => String(e.id) === String(id));
      if (ev) ev.sortOrder = i;
    });
    await writeJSON("events", events);
    res.json({ success: true });
  });

  app.put("/api/events/:id", async (req, res) => {
    const events = await readJSON("events");
    const idx = events.findIndex((e) => String(e.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    events[idx] = { ...events[idx], ...req.body, id: events[idx].id };
    await writeJSON("events", events);
    res.json(events[idx]);
  });

  app.delete("/api/events/:id", async (req, res) => {
    const events = await readJSON("events");
    await writeJSON("events", events.filter((e) => String(e.id) !== req.params.id));
    res.json({ success: true });
  });

  // Event sub-resources (performers, costs, materials, staff) — stored per-event in JSON
  const subResource = (resource: string) => {
    app.get(`/api/events/:id/${resource}`, async (req, res) => {
      const items = await readJSON(`${resource}_${req.params.id}`);
      res.json(items);
    });
    app.post(`/api/events/:id/${resource}`, async (req, res) => {
      const items = await readJSON(`${resource}_${req.params.id}`);
      const newItem = { id: Date.now(), ...req.body };
      items.push(newItem);
      await writeJSON(`${resource}_${req.params.id}`, items);
      res.status(201).json(newItem);
    });
    app.put(`/api/events/:id/${resource}/:subId`, async (req, res) => {
      const items = await readJSON(`${resource}_${req.params.id}`);
      const idx = items.findIndex((i: any) => String(i.id) === req.params.subId);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
        await writeJSON(`${resource}_${req.params.id}`, items);
      }
      res.json({ success: true });
    });
    app.delete(`/api/events/:id/${resource}/:subId`, async (req, res) => {
      const items = await readJSON(`${resource}_${req.params.id}`);
      await writeJSON(`${resource}_${req.params.id}`, items.filter((i: any) => String(i.id) !== req.params.subId));
      res.json({ success: true });
    });
  };

  subResource("performers");
  subResource("costs");
  subResource("materials");
  subResource("staff");
  subResource("marketing");

  // ── Meetings ──────────────────────────────────────────────────────────────
  app.get("/api/meetings", async (_req, res) => {
    res.json(await readJSON("meetings"));
  });

  app.post("/api/meetings", async (req, res) => {
    const meetings = await readJSON("meetings");
    const newMeeting = { id: Date.now().toString(), ...req.body };
    meetings.push(newMeeting);
    await writeJSON("meetings", meetings);
    res.status(201).json(newMeeting);
  });

  app.put("/api/meetings/:id", async (req, res) => {
    const meetings = await readJSON("meetings");
    const idx = meetings.findIndex((m) => String(m.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    meetings[idx] = { ...meetings[idx], ...req.body, id: meetings[idx].id };
    await writeJSON("meetings", meetings);
    res.json(meetings[idx]);
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    const meetings = await readJSON("meetings");
    await writeJSON("meetings", meetings.filter((m) => String(m.id) !== req.params.id));
    res.json({ success: true });
  });

  // Meeting sub-resources
  const meetingSub = (resource: string) => {
    app.get(`/api/meetings/:id/${resource}`, async (req, res) => {
      res.json(await readJSON(`meeting_${resource}_${req.params.id}`));
    });
    app.post(`/api/meetings/:id/${resource}`, async (req, res) => {
      const items = await readJSON(`meeting_${resource}_${req.params.id}`);
      const newItem = { id: Date.now(), ...req.body };
      items.push(newItem);
      await writeJSON(`meeting_${resource}_${req.params.id}`, items);
      res.status(201).json(newItem);
    });
    app.put(`/api/meetings/:id/${resource}/:subId`, async (req, res) => {
      const items = await readJSON(`meeting_${resource}_${req.params.id}`);
      const idx = items.findIndex((i: any) => String(i.id) === req.params.subId);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
        await writeJSON(`meeting_${resource}_${req.params.id}`, items);
      }
      res.json({ success: true });
    });
    app.delete(`/api/meetings/:id/${resource}/:subId`, async (req, res) => {
      const items = await readJSON(`meeting_${resource}_${req.params.id}`);
      await writeJSON(`meeting_${resource}_${req.params.id}`, items.filter((i: any) => String(i.id) !== req.params.subId));
      res.json({ success: true });
    });
  };

  meetingSub("agenda");
  meetingSub("decisions");

  // ── Suggestion box ────────────────────────────────────────────────────────
  // Mirrors handle_suggestions()/handle_suggestion_promote() in api/index.php.
  app.get("/api/suggestions", async (req, res) => {
    const all = await readJSON("suggestions");
    const status = req.query.status as string | undefined;
    res.json(status ? all.filter((s: any) => s.status === status) : all);
  });

  app.post("/api/suggestions", async (req, res) => {
    // Mirrors the honeypot + rate limit in handle_suggestions() in api/index.php.
    if (req.body?.website?.trim()) return res.status(201).json({ success: true });
    if (!req.body?.message?.trim()) return res.status(400).json({ error: "A message is required" });

    const all = await readJSON("suggestions");
    const ip = req.ip || "unknown";
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentCount = all.filter((s: any) => s.ipAddress === ip && new Date(s.createdAt).getTime() > oneHourAgo).length;
    if (recentCount >= 5) {
      return res.status(429).json({ error: "You've submitted several suggestions recently — please wait a bit before sending more." });
    }

    all.push({
      id: Date.now(),
      message: req.body.message.trim(),
      submitterName: req.body.submitterName || null,
      submitterEmail: req.body.submitterEmail || null,
      ipAddress: ip,
      status: "new",
      createdAt: new Date().toISOString(),
    });
    await writeJSON("suggestions", all);
    res.status(201).json({ success: true });
  });

  app.put("/api/suggestions/:id", async (req, res) => {
    const all = await readJSON("suggestions");
    const idx = all.findIndex((s: any) => String(s.id) === req.params.id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], status: req.body.status, reviewedMeetingId: req.body.reviewedMeetingId ?? null, reviewedAt: new Date().toISOString() };
      await writeJSON("suggestions", all);
    }
    res.json({ success: true });
  });

  app.delete("/api/suggestions/:id", async (req, res) => {
    const all = await readJSON("suggestions");
    await writeJSON("suggestions", all.filter((s: any) => String(s.id) !== req.params.id));
    res.json({ success: true });
  });

  app.post("/api/suggestions/:id/promote", async (req, res) => {
    const all = await readJSON("suggestions");
    const idx = all.findIndex((s: any) => String(s.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Suggestion not found" });
    const suggestion = all[idx];
    const meetingId = req.body.meetingId;
    if (!meetingId) return res.status(400).json({ error: "meetingId is required" });

    const agendaKey = `meeting_agenda_${meetingId}`;
    const agendaItems = await readJSON(agendaKey);
    const title = suggestion.message.length > 80 ? suggestion.message.slice(0, 77) + "…" : suggestion.message;
    const newItem = {
      id: Date.now(),
      title,
      description: suggestion.message,
      presenter: suggestion.submitterName || "Community suggestion",
      status: "pending",
      itemOrder: agendaItems.length,
    };
    agendaItems.push(newItem);
    await writeJSON(agendaKey, agendaItems);

    all[idx] = { ...suggestion, status: "reviewed", reviewedMeetingId: meetingId, reviewedAt: new Date().toISOString() };
    await writeJSON("suggestions", all);

    res.status(201).json({ agendaItemId: newItem.id });
  });

  // ── Photo Albums ─────────────────────────────────────────────────────────
  app.get("/api/photos", async (_req, res) => {
    res.json(await readJSON("photos"));
  });

  app.post("/api/photos", async (req, res) => {
    const photos = await readJSON("photos");
    const item = { id: Date.now().toString(), visible: true, photoCount: 0, ...req.body };
    photos.push(item);
    await writeJSON("photos", photos);
    res.json(item);
  });

  app.put("/api/photos/:id", async (req, res) => {
    const photos = await readJSON("photos");
    const idx = photos.findIndex((p: any) => String(p.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    photos[idx] = { ...photos[idx], ...req.body, id: photos[idx].id };
    await writeJSON("photos", photos);
    res.json(photos[idx]);
  });

  app.delete("/api/photos/:id", async (req, res) => {
    const photos = await readJSON("photos");
    await writeJSON("photos", photos.filter((p: any) => String(p.id) !== req.params.id));
    res.json({ success: true });
  });

  // ── Sponsors ──────────────────────────────────────────────────────────────
  app.get("/api/sponsors", async (_req, res) => {
    res.json(await readJSON("sponsors"));
  });

  app.post("/api/sponsors", async (req, res) => {
    const sponsors = await readJSON("sponsors");
    const newSponsor = { id: Date.now().toString(), ...req.body };
    sponsors.push(newSponsor);
    await writeJSON("sponsors", sponsors);
    res.status(201).json(newSponsor);
  });

  app.put("/api/sponsors/:id", async (req, res) => {
    const sponsors = await readJSON("sponsors");
    const idx = sponsors.findIndex((s) => String(s.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    sponsors[idx] = { ...sponsors[idx], ...req.body, id: sponsors[idx].id };
    await writeJSON("sponsors", sponsors);
    res.json(sponsors[idx]);
  });

  app.delete("/api/sponsors/:id", async (req, res) => {
    const sponsors = await readJSON("sponsors");
    await writeJSON("sponsors", sponsors.filter((s) => String(s.id) !== req.params.id));
    res.json({ success: true });
  });

  // ── Applications ─────────────────────────────────────────────────────────
  app.post("/api/apply/:type", async (req, res) => {
    const allowed = ["volunteer", "vendor", "performer", "parade", "sponsor"];
    if (!allowed.includes(req.params.type)) return res.status(400).json({ error: "Invalid type" });
    const all = await readJSON("applications");
    const newApp = { id: Date.now(), submittedAt: new Date().toISOString(), type: req.params.type, status: "new", ...req.body };
    all.push(newApp);
    await writeJSON("applications", all);
    res.json({ success: true, id: newApp.id });
  });

  app.get("/api/applications", async (req, res) => {
    const all = await readJSON("applications");
    const { type, status } = req.query as Record<string, string>;
    let filtered = all;
    if (type) filtered = filtered.filter((a) => a.type === type);
    if (status) filtered = filtered.filter((a) => a.status === status);
    res.json(filtered.reverse());
  });

  app.put("/api/applications/:id", async (req, res) => {
    const all = await readJSON("applications");
    const idx = all.findIndex((a) => String(a.id) === req.params.id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...req.body, id: all[idx].id };
      await writeJSON("applications", all);
    }
    res.json({ success: true });
  });

  // ── Newsletter ────────────────────────────────────────────────────────────
  app.get("/api/newsletter", async (_req, res) => {
    res.json(await readJSON("newsletter"));
  });

  app.post("/api/newsletter", async (req, res) => {
    if (!req.body?.email) return res.status(400).json({ error: "Email required" });
    const subs = await readJSON("newsletter");
    if (!subs.find((s: any) => s.email === req.body.email)) {
      subs.push({ id: Date.now(), email: req.body.email, name: req.body.name || "", subscribedAt: new Date().toISOString() });
      await writeJSON("newsletter", subs);
    }
    res.json({ success: true });
  });

  app.delete("/api/newsletter/:id", async (req, res) => {
    const subs = await readJSON("newsletter");
    await writeJSON("newsletter", subs.filter((s: any) => String(s.id) !== req.params.id));
    res.json({ success: true });
  });

  // ── Contribution notifications ────────────────────────────────────────────
  app.get("/api/contributions", async (_req, res) => {
    const all = await readJSON("contributions");
    res.json([...all].reverse());
  });

  app.post("/api/contribute", async (req, res) => {
    if (!req.body?.email) return res.status(400).json({ error: "Email required" });
    const contributions = await readJSON("contributions");
    contributions.push({ id: Date.now(), submittedAt: new Date().toISOString(), ...req.body });
    await writeJSON("contributions", contributions);
    res.json({ success: true });
  });

  // ── Dashboard stats ───────────────────────────────────────────────────────
  app.get("/api/dashboard", async (_req, res) => {
    const [events, meetings, apps] = await Promise.all([
      readJSON("events"), readJSON("meetings"), readJSON("applications"),
    ]);
    res.json({
      eventsTotal:      events.length,
      eventsConfirmed:  events.filter((e) => e.status === "CONFIRMED").length,
      meetingsUpcoming: meetings.filter((m) => !m.isPast).length,
      meetingsPast:     meetings.filter((m) => m.isPast).length,
      applicationsNew:  apps.filter((a) => a.status === "new").length,
      applicationsTotal: apps.length,
      byApplicationType: {
        volunteer: apps.filter((a) => a.type === "volunteer").length,
        vendor:    apps.filter((a) => a.type === "vendor").length,
        performer: apps.filter((a) => a.type === "performer").length,
        parade:    apps.filter((a) => a.type === "parade").length,
      },
    });
  });

  // ── Legacy compat ─────────────────────────────────────────────────────────
  app.get("/api/data/:type", async (req, res) => {
    res.json(await readJSON(req.params.type));
  });

  app.post("/api/data/:type", async (req, res) => {
    await writeJSON(req.params.type, req.body);
    res.json({ success: true });
  });

  // ── Health ────────────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // ── Vite / static ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Dev server → http://localhost:${PORT}`));
}

startServer();
