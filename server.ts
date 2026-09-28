import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dev session — persisted to data/.session so server restarts don't log you out
const DEV_PASSWORD = process.env.DEV_ADMIN_PASSWORD;
let activeDevPassword = DEV_PASSWORD;
let devPasswordMigrationRequired = process.env.DEV_FORCE_PASSWORD_MIGRATION === "1";
const SESSION_FILE = path.join(process.cwd(), "data", ".session");

const readSession = async (req: express.Request): Promise<boolean> => {
  const cookie = req.headers.cookie?.split(";")
    .map(part => part.trim())
    .find(part => part.startsWith("tp_dev_session="))
    ?.slice("tp_dev_session=".length);
  if (!cookie) return false;
  try {
    const saved = (await fs.readFile(SESSION_FILE, "utf-8")).trim();
    return saved.length === cookie.length && crypto.timingSafeEqual(Buffer.from(saved), Buffer.from(cookie));
  } catch { return false; }
};
const writeSession = async (res: express.Response, authenticated: boolean) => {
  if (!authenticated) {
    await fs.writeFile(SESSION_FILE, "");
    res.setHeader("Set-Cookie", "tp_dev_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  await fs.writeFile(SESSION_FILE, token);
  res.setHeader("Set-Cookie", `tp_dev_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  const requireDevAuth: express.RequestHandler = async (req, res, next) => {
    if (!(await readSession(req))) return res.status(401).json({ error: "Unauthorized" });
    next();
  };

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
    if (!activeDevPassword) {
      return res.status(503).json({ error: "DEV_ADMIN_PASSWORD is not configured" });
    }
    if (devPasswordMigrationRequired) {
      return res.status(409).json({
        error: "A one-time password security upgrade is required.",
        code: "password_migration_required",
      });
    }
    if (req.body?.password === activeDevPassword) {
      await writeSession(res, true);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Invalid password" });
    }
  });

  app.post("/api/auth/migrate-password", async (req, res) => {
    if (!devPasswordMigrationRequired || !activeDevPassword) {
      return res.status(409).json({ error: "The password security upgrade is not available." });
    }
    if (req.body?.currentPassword !== activeDevPassword) {
      return res.status(401).json({ error: "The current password is incorrect." });
    }
    if (typeof req.body?.newPassword !== "string" || req.body.newPassword.length < 16 || req.body.newPassword.length > 256) {
      return res.status(422).json({ error: "The new password must be between 16 and 256 characters." });
    }
    activeDevPassword = req.body.newPassword;
    devPasswordMigrationRequired = false;
    await writeSession(res, true);
    res.json({ success: true });
  });

  app.post("/api/auth/logout", async (_req, res) => {
    await writeSession(res, false);
    res.json({ success: true });
  });

  app.get("/api/auth/check", async (req, res) => {
    res.json({ authenticated: await readSession(req) });
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  const isPublicSettingKey = (key: string) => [
    "phase", "hero_preset", "event_year", "festival_start", "festival_end", "tagline",
    "show_meetings_section", "sponsorship_open", "sponsorship_state", "contribution_settings",
  ].includes(key)
    || /^hero_(planning|active|live)_(image|line1|line2|sub|ctaLabel|ctaHref)$/.test(key)
    || /^participate_(volunteer|vendor|performer|parade)$/.test(key);

  app.get("/api/settings", async (_req, res) => {
    const raw = await readJSON("settings");
    const out: Record<string, string> = {};
    for (const row of raw) {
      if (isPublicSettingKey(row.setting_key)) out[row.setting_key] = row.setting_value;
    }
    // Defaults if file doesn't exist yet
    if (!out.hero_preset) out.hero_preset = out.phase || "LIVE_EVENT";
    res.json(out);
  });

  app.post("/api/settings", requireDevAuth, async (req, res) => {
    const existing = await readJSON("settings");
    const map: Record<string, string> = {};
    for (const r of existing) map[r.setting_key] = r.setting_value;
    for (const [k, v] of Object.entries(req.body)) {
      if (isPublicSettingKey(k)) map[k] = v as string;
    }
    const rows = Object.entries(map).map(([k, v]) => ({ setting_key: k, setting_value: v }));
    await writeJSON("settings", rows);
    res.json({ success: true });
  });

  // ── Events ────────────────────────────────────────────────────────────────
  app.get("/api/event-series", async (req, res) => {
    if (req.query.admin === "1" && !(await readSession(req))) return res.status(401).json({ error: "Unauthorized" });
    const series = await readJSON("event-series");
    const visible = req.query.admin === "1"
      ? series
      : series.filter((s: any) => (s.publicationStatus ?? "published") === "published");
    visible.sort((a: any, b: any) => Number(b.featured ?? 0) - Number(a.featured ?? 0)
      || String(b.startAt ?? "").localeCompare(String(a.startAt ?? "")));
    res.json(visible);
  });

  app.post("/api/event-series", requireDevAuth, async (req, res) => {
    const series = await readJSON("event-series");
    const newSeries = {
      id: Date.now().toString(),
      timezone: "America/Denver",
      publicationStatus: "draft",
      featured: false,
      ...req.body,
    };
    series.push(newSeries);
    await writeJSON("event-series", series);
    res.status(201).json(newSeries);
  });

  app.put("/api/event-series/:id", requireDevAuth, async (req, res) => {
    const series = await readJSON("event-series");
    const idx = series.findIndex((s) => String(s.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    series[idx] = { ...series[idx], ...req.body, id: series[idx].id };
    await writeJSON("event-series", series);
    res.json(series[idx]);
  });

  app.delete("/api/event-series/:id", requireDevAuth, async (req, res) => {
    const series = await readJSON("event-series");
    await writeJSON("event-series", series.filter((s) => String(s.id) !== req.params.id));
    const events = await readJSON("events");
    for (const event of events) {
      if (String(event.seriesId) === req.params.id) event.seriesId = null;
    }
    await writeJSON("events", events);
    res.json({ success: true });
  });

  app.get("/api/events", async (req, res) => {
    if (req.query.admin === "1" && !(await readSession(req))) return res.status(401).json({ error: "Unauthorized" });
    // Mirrors api/index.php's `ORDER BY sort_order ASC, id ASC` — the mock
    // JSON store's array order isn't otherwise meaningful.
    const events = await readJSON("events");
    const series = await readJSON("event-series");
    const seriesById = new Map(series.map((s: any) => [String(s.id), s]));
    const visible = req.query.admin === "1"
      ? events
      : events.filter((e: any) => {
          if ((e.publicationStatus ?? "published") !== "published") return false;
          if (!e.seriesId) return true;
          return (seriesById.get(String(e.seriesId))?.publicationStatus ?? "published") === "published";
        });
    visible.sort((a: any, b: any) => String(a.startAt ?? a.eventDateSort ?? "9999").localeCompare(String(b.startAt ?? b.eventDateSort ?? "9999"))
      || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      || String(a.id).localeCompare(String(b.id)));
    res.json(visible.map((event: any) => {
      const parent = event.seriesId ? seriesById.get(String(event.seriesId)) : null;
      const normalized = { publicationStatus: "published", featured: false, timezone: "America/Denver", ...event };
      return parent ? { ...normalized, seriesTitle: parent.title, seriesSlug: parent.slug } : normalized;
    }));
  });

  app.post("/api/events", requireDevAuth, async (req, res) => {
    const events = await readJSON("events");
    const newEvent = {
      id: Date.now().toString(),
      timezone: "America/Denver",
      publicationStatus: "draft",
      featured: false,
      ...req.body,
    };
    events.push(newEvent);
    await writeJSON("events", events);
    res.status(201).json(newEvent);
  });

  // Bulk reorder — mirrors api/index.php's handle_events_reorder(). Must be
  // registered before the PUT /api/events/:id route below isn't an issue
  // (different HTTP verb), but kept here for readability alongside it.
  app.post("/api/events/reorder", requireDevAuth, async (req, res) => {
    const events = await readJSON("events");
    const ids: string[] = req.body?.ids ?? [];
    ids.forEach((id, i) => {
      const ev = events.find((e) => String(e.id) === String(id));
      if (ev) ev.sortOrder = i;
    });
    await writeJSON("events", events);
    res.json({ success: true });
  });

  app.put("/api/events/:id", requireDevAuth, async (req, res) => {
    const events = await readJSON("events");
    const idx = events.findIndex((e) => String(e.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    events[idx] = { ...events[idx], ...req.body, id: events[idx].id };
    await writeJSON("events", events);
    res.json(events[idx]);
  });

  app.delete("/api/events/:id", requireDevAuth, async (req, res) => {
    const events = await readJSON("events");
    await writeJSON("events", events.filter((e) => String(e.id) !== req.params.id));
    res.json({ success: true });
  });

  // Event sub-resources (performers, costs, materials, staff) — stored per-event in JSON
  const subResource = (resource: string) => {
    app.get(`/api/events/:id/${resource}`, async (req, res) => {
      const items = await readJSON(`${resource}_${req.params.id}`);
      if (resource === "performers" && req.query.admin !== "1") {
        return res.json(items.filter((item: any) => item.confirmed).map((item: any) => ({
          id: item.id,
          eventId: item.eventId,
          name: item.name,
          type: item.type,
          bio: item.bio,
          confirmed: true,
          performanceTime: item.performanceTime,
          sortOrder: item.sortOrder,
        })));
      }
      if (!(await readSession(req))) return res.status(401).json({ error: "Unauthorized" });
      res.json(items);
    });
    app.post(`/api/events/:id/${resource}`, requireDevAuth, async (req, res) => {
      const items = await readJSON(`${resource}_${req.params.id}`);
      const newItem = { id: Date.now(), ...req.body };
      items.push(newItem);
      await writeJSON(`${resource}_${req.params.id}`, items);
      res.status(201).json(newItem);
    });
    app.put(`/api/events/:id/${resource}/:subId`, requireDevAuth, async (req, res) => {
      const items = await readJSON(`${resource}_${req.params.id}`);
      const idx = items.findIndex((i: any) => String(i.id) === req.params.subId);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
        await writeJSON(`${resource}_${req.params.id}`, items);
      }
      res.json({ success: true });
    });
    app.delete(`/api/events/:id/${resource}/:subId`, requireDevAuth, async (req, res) => {
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

  app.post("/api/meetings", requireDevAuth, async (req, res) => {
    const meetings = await readJSON("meetings");
    const newMeeting = { id: Date.now().toString(), ...req.body };
    meetings.push(newMeeting);
    await writeJSON("meetings", meetings);
    res.status(201).json(newMeeting);
  });

  app.put("/api/meetings/:id", requireDevAuth, async (req, res) => {
    const meetings = await readJSON("meetings");
    const idx = meetings.findIndex((m) => String(m.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    meetings[idx] = { ...meetings[idx], ...req.body, id: meetings[idx].id };
    await writeJSON("meetings", meetings);
    res.json(meetings[idx]);
  });

  app.delete("/api/meetings/:id", requireDevAuth, async (req, res) => {
    const meetings = await readJSON("meetings");
    await writeJSON("meetings", meetings.filter((m) => String(m.id) !== req.params.id));
    res.json({ success: true });
  });

  // Meeting sub-resources
  const meetingSub = (resource: string) => {
    app.get(`/api/meetings/:id/${resource}`, async (req, res) => {
      res.json(await readJSON(`meeting_${resource}_${req.params.id}`));
    });
    app.post(`/api/meetings/:id/${resource}`, requireDevAuth, async (req, res) => {
      const items = await readJSON(`meeting_${resource}_${req.params.id}`);
      const newItem = { id: Date.now(), ...req.body };
      items.push(newItem);
      await writeJSON(`meeting_${resource}_${req.params.id}`, items);
      res.status(201).json(newItem);
    });
    app.put(`/api/meetings/:id/${resource}/:subId`, requireDevAuth, async (req, res) => {
      const items = await readJSON(`meeting_${resource}_${req.params.id}`);
      const idx = items.findIndex((i: any) => String(i.id) === req.params.subId);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
        await writeJSON(`meeting_${resource}_${req.params.id}`, items);
      }
      res.json({ success: true });
    });
    app.delete(`/api/meetings/:id/${resource}/:subId`, requireDevAuth, async (req, res) => {
      const items = await readJSON(`meeting_${resource}_${req.params.id}`);
      await writeJSON(`meeting_${resource}_${req.params.id}`, items.filter((i: any) => String(i.id) !== req.params.subId));
      res.json({ success: true });
    });
  };

  meetingSub("agenda");
  meetingSub("decisions");

  // ── Suggestion box ────────────────────────────────────────────────────────
  // Mirrors handle_suggestions()/handle_suggestion_promote() in api/index.php.
  app.get("/api/suggestions", requireDevAuth, async (req, res) => {
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

  app.put("/api/suggestions/:id", requireDevAuth, async (req, res) => {
    const all = await readJSON("suggestions");
    const idx = all.findIndex((s: any) => String(s.id) === req.params.id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], status: req.body.status, reviewedMeetingId: req.body.reviewedMeetingId ?? null, reviewedAt: new Date().toISOString() };
      await writeJSON("suggestions", all);
    }
    res.json({ success: true });
  });

  app.delete("/api/suggestions/:id", requireDevAuth, async (req, res) => {
    const all = await readJSON("suggestions");
    await writeJSON("suggestions", all.filter((s: any) => String(s.id) !== req.params.id));
    res.json({ success: true });
  });

  app.post("/api/suggestions/:id/promote", requireDevAuth, async (req, res) => {
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

  app.post("/api/photos", requireDevAuth, async (req, res) => {
    const photos = await readJSON("photos");
    const item = { id: Date.now().toString(), visible: true, photoCount: 0, ...req.body };
    photos.push(item);
    await writeJSON("photos", photos);
    res.json(item);
  });

  app.put("/api/photos/:id", requireDevAuth, async (req, res) => {
    const photos = await readJSON("photos");
    const idx = photos.findIndex((p: any) => String(p.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    photos[idx] = { ...photos[idx], ...req.body, id: photos[idx].id };
    await writeJSON("photos", photos);
    res.json(photos[idx]);
  });

  app.delete("/api/photos/:id", requireDevAuth, async (req, res) => {
    const photos = await readJSON("photos");
    await writeJSON("photos", photos.filter((p: any) => String(p.id) !== req.params.id));
    res.json({ success: true });
  });

  // ── Sponsors ──────────────────────────────────────────────────────────────
  app.get("/api/sponsors", async (_req, res) => {
    res.json(await readJSON("sponsors"));
  });

  app.post("/api/sponsors", requireDevAuth, async (req, res) => {
    const sponsors = await readJSON("sponsors");
    const newSponsor = { id: Date.now().toString(), ...req.body };
    sponsors.push(newSponsor);
    await writeJSON("sponsors", sponsors);
    res.status(201).json(newSponsor);
  });

  app.put("/api/sponsors/:id", requireDevAuth, async (req, res) => {
    const sponsors = await readJSON("sponsors");
    const idx = sponsors.findIndex((s) => String(s.id) === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    sponsors[idx] = { ...sponsors[idx], ...req.body, id: sponsors[idx].id };
    await writeJSON("sponsors", sponsors);
    res.json(sponsors[idx]);
  });

  app.delete("/api/sponsors/:id", requireDevAuth, async (req, res) => {
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

  app.get("/api/applications", requireDevAuth, async (req, res) => {
    const all = await readJSON("applications");
    const { type, status } = req.query as Record<string, string>;
    let filtered = all;
    if (type) filtered = filtered.filter((a) => a.type === type);
    if (status) filtered = filtered.filter((a) => a.status === status);
    res.json(filtered.reverse());
  });

  app.put("/api/applications/:id", requireDevAuth, async (req, res) => {
    const all = await readJSON("applications");
    const idx = all.findIndex((a) => String(a.id) === req.params.id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...req.body, id: all[idx].id };
      await writeJSON("applications", all);
    }
    res.json({ success: true });
  });

  // ── Newsletter ────────────────────────────────────────────────────────────
  app.get("/api/newsletter", requireDevAuth, async (_req, res) => {
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

  app.delete("/api/newsletter/:id", requireDevAuth, async (req, res) => {
    const subs = await readJSON("newsletter");
    await writeJSON("newsletter", subs.filter((s: any) => String(s.id) !== req.params.id));
    res.json({ success: true });
  });

  // ── Contribution notifications ────────────────────────────────────────────
  app.get("/api/contributions", async (req, res) => {
    if (!(await readSession(req))) return res.status(401).json({ error: "Unauthorized" });
    const all = await readJSON("contributions");
    res.json([...all].reverse());
  });

  app.post("/api/contribute", async (req, res) => {
    if (req.body?.website?.trim()) return res.json({ success: true });
    const email = String(req.body?.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "A valid email is required" });
    const allowedMethods = ["paypal", "venmo", "square", "stripe", "check"];
    const method = String(req.body?.method || "").toLowerCase().trim();
    if (method && !allowedMethods.includes(method)) return res.status(400).json({ error: "Invalid contribution method" });
    const amount = req.body?.amount === null || req.body?.amount === "" || req.body?.amount === undefined
      ? null : Number(req.body.amount);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000)) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    const contributions = await readJSON("contributions");
    contributions.push({
      id: Date.now(),
      submittedAt: new Date().toISOString(),
      name: String(req.body?.name || "").trim().slice(0, 190),
      email,
      amount,
      method: method || null,
      message: String(req.body?.message || "").trim().slice(0, 4000),
    });
    await writeJSON("contributions", contributions);
    res.json({ success: true });
  });

  // ── Dashboard stats ───────────────────────────────────────────────────────
  app.get("/api/dashboard", requireDevAuth, async (_req, res) => {
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
  app.get("/api/data/:type", requireDevAuth, async (req, res) => {
    res.json(await readJSON(req.params.type));
  });

  app.post("/api/data/:type", requireDevAuth, async (req, res) => {
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
