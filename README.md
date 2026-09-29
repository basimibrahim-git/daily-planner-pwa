# Daily Planner

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![PWA](https://img.shields.io/badge/PWA-installable-8B6FB3.svg)
![Stack](https://img.shields.io/badge/stack-PHP%20%2B%20MySQL%20%2B%20vanilla%20JS-6B4E8E.svg)

A soft, illustrated daily planner PWA — prayers, Quran, water, habits, chores,
a daily dua with favorites, notes, a history calendar with streaks, a
Dashboard of activity charts, a Gratitude Jar (with styled text and photos),
and a Mood tracker with its own dashboard. Installable on phone and tablet,
works offline for checking things off (syncs once you're back online).

No build step: plain HTML/CSS/JS on the frontend, PHP + MySQL on the backend.
Clone it, fill in a database connection, upload — no bundler, no `npm install`.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Installing as an app](#installing-as-an-app)
- [Deploying updates](#deploying-updates)
- [Offline behavior](#offline-behavior)
- [How streaks are calculated](#how-streaks-are-calculated)
- [Project structure](#project-structure)
- [Backups](#backups)
- [Security notes](#security-notes)
- [License](#license)

## Features

- **Today**: organized as tappable category cards — tap one to open just
  that category's checklist. Each item can show a checkbox, a counter (with
  an optional target/unit like "0/3 L"), or both — you choose per item in
  Manage. Tap the note icon on any item to jot free-text details for that
  day (e.g. what you actually did for "House Chores"). A "How are you
  feeling?" card logs your mood in one tap. Tap the date next to the day
  arrows to jump straight to the History calendar. A dua card rotates daily,
  sourced from your own `duas` table — heart it to save it, and view all
  your saved duas from the bookmark icon.
- **History**: a month calendar heatmap of overall completion, with
  current/best streak, and tap any day to view or backfill it.
- **Dashboard**: a completion trend chart, category breakdown, per-item
  ranking, and a dedicated Prayer & Quran section, over a 7/30/90-day window.
- **Gratitude Jar**: type something you're grateful for and watch a hand
  fold it and drop it into an illustrated glass jar that fills up as you add
  more. Style your note word by word — tap any word in the preview to give
  it its own font (six to choose from), size (S–XL), bold/italic and color
  from a color wheel, or tap **Mix fonts** to give every word a different
  font — and attach up to 3 photos (resized on your device before upload). Pick a random one back out any time and watch
  it get pulled out and unfolded — photos open full-screen — with the option
  to delete it for good.
- **Mood**: check in as often as you like with Poor / Neutral / Good, or
  your own moods (name, emoji, color and a 1–5 score), plus an optional note.
  Its dashboard shows your daily-average trend, a breakdown by mood, and a
  month calendar colored by each day's average, over 7/30/90 days.
- **Manage**: add/edit/delete/reorder items, per category, including which
  controls (checkbox/counter) each one shows and which count toward your streak.

## Tech stack

- **Frontend**: plain HTML/CSS/JavaScript, native ES modules — no framework,
  no bundler, no build step. A hand-rolled service worker handles offline
  caching and background sync.
- **Backend**: PHP (PDO/MySQL), session-based auth, no framework.
- **Database**: MySQL.

This is a deliberate choice for the target environment — cheap shared PHP
hosting (e.g. Hostinger) — not a statement against frameworks in general.

## Getting started

### 1. Create the database

Using any MySQL host (Hostinger's hPanel, phpMyAdmin, a local MySQL server,
etc.), create a database and import [`sql/schema.sql`](sql/schema.sql).

### 2. Configure the backend

Copy the sample config and fill in your real database details:

```bash
cp api/config.sample.php api/config.php
```

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');
define('APP_SECRET', 'change-this-to-a-long-random-string');
```

`APP_SECRET` just needs to be any long random string — it isn't a password
you need to remember, it's used internally. `api/config.php` is gitignored
since it holds real credentials; never commit it.

### 3. Upload / deploy

Upload everything (keeping the folder structure) to your web root, or a
subfolder if you want the planner at a sub-path (e.g. `public_html/planner`).
Include the `uploads/` folder with its `.htaccess` — gratitude photos are
stored there, and that file blocks direct links to them (they're only served
to you after login, via `api/photo.php`). PHP needs write access to it.

### Upgrading an existing install

Just upload the new files — there's no SQL to run. The first request after a
deploy upgrades the database by itself (see
[`api/migrations.php`](api/migrations.php); the current version is kept in
`app_config.schema_version`). Every step is safe to re-run. Upgrading to
schema version 2 permanently removes saved doodles, a feature that no longer
exists.

### 4. First run

Visit the site in your browser. The first time, it will ask you to **create a
password** — that becomes your single login for the app (there are no
separate user accounts). Once set, it also seeds your checklist with a
starter set of items (prayers, Quran & dhikr, water, exercise, chores, etc.)
which you can freely edit, delete, add to, and reorder from the **Manage** tab.

### 5. The dua library

The rotating "Today's Dua" and its favorites come from your own `duas`
table, not a live third-party call — it's a curated set of duas originally
pulled from the free, public [Hisnul Muslim (Fortress of the Muslim)](https://www.hisnmuslim.com)
collection and imported straight into the database once. To seed this table
on a fresh database, write a small one-off PHP script that inserts a
`category`/`arabic`/`transliteration`/`translation` row per dua (see the
`duas` table shape in `sql/schema.sql`) — it's intentionally not bundled
here since it's a one-time job, not part of the running app.

## Installing as an app

Open the site on your phone or tablet in Chrome/Safari, then use the
browser's "Add to Home Screen" option (or the **Install** button under
Settings ⚙️ in the app, when the browser offers it). It will launch full-screen
like a native app.

## Deploying updates

Because this is a PWA with a service worker, a browser that has already
visited the site is running a cached copy of it — just uploading new files
isn't automatically enough for it to notice.

Some hosts (Hostinger among them) stamp every static file (`.js`, `.css`,
images, fonts) with a year-long `Cache-Control: public, max-age=31536000,
immutable`, and if you're behind a CDN like Cloudflare, it can honor that
literally — serving an old cached copy indefinitely regardless of how many
times you've re-uploaded a newer one to the origin. This isn't something
`.htaccess` can override after the fact; once a CDN has a copy marked
`immutable`, only a genuinely different URL (or a manual purge) gets it to
re-fetch from origin. So:

- `service-worker.js` and `index.html` are served with `Cache-Control:
  no-cache` (see `.htaccess`) so they're never cached long-term going
  forward.
- The service worker itself is registered with a version query string
  (`service-worker.js?v=N` in `js/app.js` — bump `SW_VERSION` there whenever
  `service-worker.js` changes) so the *very first* fetch of it can't be
  served from an old edge-cached copy either.
- Once that updated service worker is running, it transparently appends a
  cache-busting query to every same-origin file it fetches on your behalf
  (tied to `CACHE_NAME` in `service-worker.js` — bump that on any deploy that
  changes cached files), so the whole app shell — not just the service
  worker file — reliably reaches origin on each new version, with no
  per-file bookkeeping needed.
- The app also reloads itself once when a new service worker takes control,
  so an update reaches you without needing to know to hard-refresh.

If you ever see stale content right after deploying anyway, it means the
browser in front of you is still running a service worker from before one of
the above was in place — that can only happen once. Do a hard refresh
(Ctrl+Shift+R / Cmd+Shift+R), or DevTools → Application → Service Workers →
Unregister, then reload. If a CDN is specifically holding onto an old
`service-worker.js` (check its response headers for a cache-hit indicator and
a very old `CACHE_NAME` inside the file), purge the cache for that URL (or
the whole zone) from your host/CDN dashboard for immediate relief instead of
waiting.

## Offline behavior

- The app shell (HTML/CSS/JS/icons/fonts) is cached, so it still opens
  without a connection.
- Checking items off, adjusting counters, editing per-item notes, editing
  the daily notes, and logging a mood all work offline — changes are queued
  on your device and synced automatically the next time you're online.
- Adding, editing, deleting, or reordering checklist items (the **Manage**
  tab) needs a live connection, since that's typically a one-time setup task
  rather than part of daily use.
- Adding a text-only Gratitude Jar entry works offline too (it queues and
  syncs like checklist entries); notes with photos need a connection. Picking
  a random one falls back to your last-synced jar contents when offline.
- Favoriting a dua, editing your mood list, and deleting a mood check-in
  need a live connection.

## How streaks are calculated

The streak counter is scoped to a subset of your checklist — by default, the
5 daily prayers plus Quran Recitation — not every item. Any item can be
included or excluded via its **"Counts toward streak"** toggle in the Manage
tab's add/edit form. A day only extends the streak if every item flagged
that way was completed (for a counter-only item with no checkbox, reaching
its target counts as complete). The overall completion ring and the History
calendar's heatmap are unaffected by this — they always reflect *all* active
items.

If you add or remove streak-flagged items later, streak calculations look at
your *current* set against past entries — so adding a new one today won't
retroactively "break" a streak from before it existed, but very old days
won't have an entry for items that didn't exist yet either. This is a
simple, good-enough approach for a personal habit tracker rather than a
fully historical item-versioning system.

## Project structure

```
index.html               App shell
manifest.json            PWA manifest
service-worker.js        Offline app-shell caching + background cache-busting
.htaccess                No-cache headers for the update-detection files
css/style.css            All styling (soft purple/cream theme)
js/                       Frontend logic (no build step, native ES modules)
api/                      PHP backend (session auth + MySQL via PDO)
  config.sample.php         Copy to config.php and fill in real credentials
  auth.php                  Login/setup/logout/change-password
  items.php                 Checklist item CRUD + reorder
  entries.php               Daily checkbox/counter/note/text values + day notes
  history.php               Calendar heatmap data + streak
  stats.php                 Dashboard chart data
  gratitude.php             Gratitude Jar entries (list/add/random/delete, styles, photo uploads)
  photo.php                 Serves a gratitude photo to a logged-in user
  mood.php                  Mood options, check-ins, and mood dashboard stats
  dua.php                   Today's dua, favorites
  lib.php                   Shared helpers (date validation, done/streak math)
  migrations.php            Automatic database upgrades, run on the first request after a deploy
uploads/                  Gratitude photos (gitignored; .htaccess blocks direct access)
fonts/                    Self-hosted fonts (app UI + gratitude note fonts)
sql/schema.sql            Database schema to import for a fresh install
```

## Backups

Back up **both** the MySQL database and the `uploads/` folder — the database
only records which photo belongs to which note; the image files themselves
live in `uploads/gratitude/`.

## Changing your password

Settings (⚙️ icon, top right of Today) → Change Password.

## Security notes

- `api/.htaccess` blocks direct browser access to `config.php`, `db.php`,
  `bootstrap.php`, `lib.php`, and `migrations.php`.
- `api/config.php` is gitignored — only the placeholder `config.sample.php`
  is committed.
- Photo uploads are checked to be real JPEG/PNG/WebP images (max 3 per note),
  stored under random filenames, and never reachable by a direct URL.
- The password is stored as a bcrypt hash (`password_hash`/`password_verify`),
  never in plain text.
- The login session cookie is `httponly` and marked `secure` automatically
  when served over HTTPS.

## License

MIT — see [LICENSE](LICENSE).

Dua content is sourced from the free, public [Hisnul Muslim (Fortress of the
Muslim)](https://www.hisnmuslim.com) collection.

The bundled fonts in `fonts/` are from [Google Fonts](https://fonts.google.com)
and keep their own open licenses (SIL Open Font License; Special Elite is
Apache 2.0).
