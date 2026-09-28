# Taos Pride 2026 — GoDaddy Deployment Guide

This covers a first-time deployment. For updates after the site is live, jump to **Updating the site** at the bottom.

---

## Before you start — one-time local step

Open Terminal in this project folder and run:

```bash
npm run build
```

This generates the `dist/` folder. Do this before every upload session to make sure what you upload is current.

---

## Step 1 — Create the MySQL database

1. Log into **GoDaddy cPanel** → scroll to the **Databases** section → **MySQL Databases**

2. Under **Create New Database**, type a short name like `tp2026` → click **Create Database**
   GoDaddy prepends your account name automatically, so it becomes something like `yourname_tp2026`.
   **Write this down.**

3. Scroll to **MySQL Users → Add New User**. Pick a strong password.
   GoDaddy names it `yourname_tpuser` (or whatever you typed).
   **Write the username and password down.**

4. Scroll to **Add User To Database** → pick both names → click **Add**

5. On the next screen → tick **ALL PRIVILEGES** → **Make Changes**

---

## Step 2 — Import the database schema

1. cPanel → **phpMyAdmin**
2. Click your database name in the left sidebar
3. Click the **Import** tab → **Choose File** → select **`database/schema.sql`** from this project folder
4. Leave all settings at defaults → click **Go**

You'll see a string of green success messages. Any red errors mean you either didn't click the database name first, or you have a syntax problem — check that you're using the right file.

---

## Step 3 — Set the password securely

Generate a password hash locally. The helper prompts without echoing the password
and never writes the password to disk or shell history:

```bash
php tools/hash_admin_password.php
```

Copy the resulting `$2y$...` hash. Then, in phpMyAdmin, click the **SQL** tab and
run this block after replacing `PASTE-PASSWORD-HASH-HERE`:

```sql
-- Single unified admin password — this one login covers the main site
-- admin, the board portal, and gallery admin.
INSERT INTO site_settings (setting_key, setting_value)
VALUES ('admin_password_hash', 'PASTE-PASSWORD-HASH-HERE')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- Plaintext and retired board credentials must not remain in site_settings.
DELETE FROM site_settings
WHERE setting_key IN (
  'admin_password_plain',
  'board_password_plain',
  'board_password_hash'
);

-- Vault PIN (4-digit number, default is 1969 — change if you want). This is
-- a SECOND gate on top of the admin login above, specifically for the
-- Board → Secure Vault section — it does not stand in for the admin
-- password.
INSERT INTO site_settings (setting_key, setting_value)
VALUES ('vault_pin', '1969')
ON DUPLICATE KEY UPDATE setting_value = '1969';
```

Use a unique password of at least 16 characters. This one credential unlocks site
content, the board roster/documents, and gallery management—not just event editing.
The vault PIN can stay as `1969` or you can change it here.

Click **Go** and confirm the statements complete without an error.

---

## Step 4 — Edit `api/config.php`

### 4a — Database credentials

Open **`api/config.php`** in any text editor. Fill in the three database lines with the values from Step 1:

```php
define('DB_NAME', 'yourname_tp2026');      // full DB name from Step 1
define('DB_USER', 'yourname_tpuser');      // full DB username from Step 1
define('DB_PASS', 'your-db-password');     // the password you chose in Step 1
```

The CORS line should already say:

```php
define('CORS_ORIGIN', 'https://taospride.org');
```

If it still says `'*'`, change it now.

Save `api/config.php`. **This file contains your database credentials — don't share it or commit it to git.**

---

## Step 5 — Upload via FTP

Use **FileZilla** (free) or any FTP client.

**Connection settings:**
- Host: `ftp.taospride.org` (or find it in cPanel → FTP Accounts)
- Username / Password: your cPanel login credentials
- Port: `21`

On the server side, navigate into `public_html/`. Upload the following:

---

### 5a — Main React app (from `dist/`)

| Upload this (local) | To here (server) |
|---------------------|-----------------|
| `dist/index.html` | `public_html/index.html` |
| `dist/assets/` *(whole folder)* | `public_html/assets/` |
| `dist/TaosPrideLogo.png` | `public_html/TaosPrideLogo.png` |

---

### 5b — Board portal (from `dist/board/`)

Create the folder `public_html/board/` on the server if it doesn't exist, then upload:

| Upload this (local) | To here (server) |
|---------------------|-----------------|
| `dist/board/index.html` | `public_html/board/index.html` |
| `dist/board/.htaccess` | `public_html/board/.htaccess` |

> **Note:** `.htaccess` is a hidden file. In FileZilla go to **Server → Force Showing Hidden Files** so you can see and upload it.

---

### 5c — Root routing file

| Upload this (local) | To here (server) |
|---------------------|-----------------|
| `.htaccess` *(project root, not from dist/)* | `public_html/.htaccess` |

> Without this file every page refresh returns a 404.

---

### 5d — PHP API (from `api/`)

Upload the **entire `api/` folder** to `public_html/api/`. Make sure all six files land there:

| File | Purpose |
|------|---------|
| `api/index.php` | Main REST API router |
| `api/board.php` | Board portal API handlers |
| `api/gallery.php` | Public and admin gallery API handlers using the main site database |
| `api/config.php` | DB credentials and shared API configuration *(the file you edited in Step 4)* |
| `api/.htaccess` | Routes all `/api/*` requests to `index.php` |
| `api/php.ini` | Raises PHP upload/memory limits to 64 MB |

---

### 5e — Upload directories

These two folders store uploaded files. They must exist on the server and be writable.

PHP creates them automatically on first upload **if** the `api/` directory is writable (it is on GoDaddy shared hosting). But creating them now avoids any first-upload error:

1. In FileZilla, right-click inside `public_html/api/` → **Create directory** → name it `board_uploads`
2. Repeat for `vault_uploads`

Each folder already has an `.htaccess` file that blocks direct browser access — upload those too:

| Upload this (local) | To here (server) |
|---------------------|-----------------|
| `api/board_uploads/.htaccess` | `public_html/api/board_uploads/.htaccess` |

The `vault_uploads/` `.htaccess` is created by PHP automatically on first vault file upload. If you want to pre-create it: create the folder and inside it upload a file named `.htaccess` containing just: `Deny from all`

---

## Step 6 — Verify everything works

Open a browser and check these URLs:

| URL | Expected result |
|-----|----------------|
| `https://taospride.org` | Taos Pride home page loads |
| `https://taospride.org/api/health` | `{"status":"ok"}` |
| `https://taospride.org/admin` | **Unified** admin login screen (this is the main one to use going forward) |
| `https://taospride.org/#manage` | Old admin login screen — still works, same password, kept as a fallback |
| `https://taospride.org/board/` | Old board portal login screen — still works, **same unified password now**, not a separate one |

**Test the unified admin (`/admin`) — this is the one that matters:**
- Log in with the admin password you set in Step 3
- Click through Site's tabs (Overview, Events, Meetings, Applications, Sponsors, Photo Albums, Communications, Hero Banner, Get Involved) and confirm data loads
- Switch to **Board** → click through Members, Positions, Committees, Tasks, Documents, Alumni
- Click **Secure Vault** — enter PIN `1969` (or whatever you set) — this is the one section still asking for a second credential, by design
- Switch to **Gallery** → confirm Years/Events load and photo uploads work
- Click **Sign Out**, then confirm `/admin` asks for the password again — and that a Board tab that was open in another tab also gets logged out (this confirms the single-session fix is working; historically logging out of the main admin could leave a stale board session behind)

**Spot-check the old fallback paths still work** (`/#manage`, `/board/`) — same password as above for both now.

---

## Complete file layout on GoDaddy after deploy

```
public_html/
├── .htaccess                    ← SPA routing + /api passthrough
├── index.html                   ← Main React app
├── TaosPrideLogo.png
├── assets/
│   ├── board-XXXXXXXX.js        ← Board portal JavaScript
│   ├── main-XXXXXXXX.js         ← Main site JavaScript
│   ├── index-XXXXXXXX.js        ← Shared vendor bundle
│   └── index-XXXXXXXX.css       ← Shared CSS
├── board/
│   ├── .htaccess                ← Board SPA routing
│   └── index.html               ← Board portal entry point
└── api/
    ├── .htaccess                ← Routes /api/* to index.php
    ├── index.php                ← API router
    ├── board.php                ← Board portal API
    ├── gallery.php               ← Gallery public/admin API handlers
    ├── config.php               ← DB credentials + gallery service key (KEEP PRIVATE)
    ├── php.ini                  ← Upload/memory limits
    ├── board_uploads/
    │   └── .htaccess            ← Blocks direct access
    └── vault_uploads/
        └── .htaccess            ← Blocks direct access
```

---

## Changing passwords after go-live

Run these in phpMyAdmin → SQL tab:

**Change the admin password** (this is the only password for Site, Board, and Gallery):

First generate a new hash with `php tools/hash_admin_password.php`, then run:

```sql
UPDATE site_settings SET setting_value = 'PASTE-NEW-PASSWORD-HASH-HERE'
WHERE setting_key = 'admin_password_hash';

DELETE FROM site_settings WHERE setting_key = 'admin_password_plain';
```

**Change the vault PIN** (separate, extra gate just for Board → Secure Vault):
```sql
UPDATE site_settings SET setting_value = '5678'
WHERE setting_key = 'vault_pin';
```

There is no board password to change anymore. Remove any legacy board rows:
```sql
DELETE FROM site_settings WHERE setting_key IN ('board_password_plain', 'board_password_hash');
```

---

## Updating the site after go-live

### Frontend change (React/design)
```bash
npm run build
```
Then upload the updated files from `dist/` via FTP — overwrite what's there.
The `assets/` folder changes filenames on every build, so upload the whole folder each time.

### PHP API change
Upload only the changed `.php` file inside `api/` — no build step needed.

### New database column or table
Run the `ALTER TABLE` or `CREATE TABLE` statement directly in phpMyAdmin → SQL tab.
**Never re-import the full `schema.sql` against an existing database** — it will conflict with live data.

**If you're updating an already-live site to get event sorting**, run this once (new installs
get it automatically via `schema.sql`):
```sql
ALTER TABLE events ADD COLUMN event_date_sort DATE NULL
  COMMENT 'Real date used for automatic chronological sorting' AFTER event_date;
```

**If you're updating an already-live site to unify the board login**, back up first
(`mysqldump`), then after confirming `/admin` and `/board/` both work with the single
admin password:
```sql
DELETE FROM site_settings WHERE setting_key IN ('board_password_plain', 'board_password_hash');
```

**Security migration for installations that ever stored a plaintext admin password:**

1. Generate a new hash with `php tools/hash_admin_password.php`.
2. Write the new `admin_password_hash` in phpMyAdmin.
3. Delete `admin_password_plain`, `board_password_plain`, and `board_password_hash`.
4. Upload the updated `api/index.php` and `api/board.php`.
5. Verify `/api/settings` contains no key with `password`, `secret`, `token`, or `pin`
   in its name, then verify `/admin` login in a private browser window.

Set the hash before uploading the hash-only PHP files so the deployment does not lock
out the administrators between steps.

**If you're updating an already-live site to get login rate limiting**, run this once (new
installs get it automatically via `schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS login_attempts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  ip_address    VARCHAR(45) NOT NULL,
  scope         VARCHAR(20) NOT NULL DEFAULT 'admin',
  success       TINYINT(1)  NOT NULL DEFAULT 0,
  attempted_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_scope_time (ip_address, scope, attempted_at)
);
```
After 8 failed attempts from the same IP within 15 minutes, `/api/auth/login` and
`/api/board/auth/login` both return `429` for a while (they share one counter — same
credential). The Vault PIN gets the same treatment but reuses the existing
`vault_access_log` table instead, so nothing extra is needed for that one.

**If you're updating an already-live site to get the suggestion box**, run this once (new
installs get it automatically via `schema.sql`):
```sql
CREATE TABLE IF NOT EXISTS suggestions (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  message             TEXT         NOT NULL,
  submitter_name      VARCHAR(200),
  submitter_email     VARCHAR(200),
  ip_address          VARCHAR(45),
  status              ENUM('new','reviewed','archived') DEFAULT 'new',
  reviewed_meeting_id INT          NULL,
  created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  reviewed_at         TIMESTAMP    NULL,
  FOREIGN KEY (reviewed_meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
);
```
The public Meetings section's "Have a suggestion?" form posts here (no login needed);
the Meetings admin tab shows a "Suggestions to Review" panel on any upcoming meeting,
where each one can be promoted straight into a real numbered agenda item or dismissed.
The form is lightly hardened against spam: a hidden honeypot field (bots tend to
autofill it, real visitors never see it — if it's non-empty the server pretends success
but doesn't save anything) and a per-IP limit of 5 submissions per hour.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| White screen or 404 on page refresh | `.htaccess` missing or mod_rewrite off | Re-upload `public_html/.htaccess`; GoDaddy has mod_rewrite on by default |
| `/api/health` returns 404 | `api/.htaccess` not uploaded | Re-upload the full `api/` folder |
| `/api/health` returns 500 | Wrong DB credentials in `config.php` | Fix the three DB lines; check PHP error log in cPanel → Logs |
| Admin login says invalid password (any of `/admin`, `/#manage`, `/board/`) | Password hash not set in DB | Generate a hash and re-run the `admin_password_hash` SQL from Step 3 |
| Login says "Too many failed attempts" (`429`) | Rate limiting tripped — 8 failed attempts from the same IP within 15 minutes | Working as intended; wait 15 minutes, or clear it early with `DELETE FROM login_attempts WHERE ip_address = 'THE_IP';` (or `vault_access_log` for a locked-out Vault PIN) |
| Board portal — `/board/` loads main site instead | `board/.htaccess` not uploaded | Upload `dist/board/.htaccess` → `public_html/board/.htaccess`; enable hidden files in FileZilla first |
| File upload fails in Documents or Vault | `board_uploads/` or `vault_uploads/` not writable | Create the folders manually in FileZilla if PHP didn't auto-create them |
| Vault PIN doesn't work | Wrong PIN in DB | Run the vault PIN SQL from Step 3 to reset it |
| `/admin/gallery` shows errors but Site and Board tabs work fine | Gallery tables are missing from the main database | Import the gallery section of `database/schema.sql`, then retry |
| `/admin/gallery` photo upload fails specifically (years/events work) | Upload exceeds a PHP size limit or `gallery-photos/` is not writable | Check `api/php.ini` and the permissions on `public_html/gallery-photos/` |
| Logging out of `/admin` didn't also log out an open Board tab elsewhere | Old cached JS bundle | Hard-refresh the Board tab — this was a real bug in the pre-unification code, fixed as part of the single-session work, but a stale cached bundle can still show old behavior |
| Logo missing or returns 403 | PNG missing or server permissions deny reads | Upload `dist/TaosPrideLogo.png` → `public_html/TaosPrideLogo.png`, set the file to `0644` and `public_html` to `0755`, then verify `https://taospride.org/TaosPrideLogo.png` directly |
| Old JS/CSS after an update | Browser cache | Hard-refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) |
