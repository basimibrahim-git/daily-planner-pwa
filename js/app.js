import { renderAuth } from './ui-auth.js';
import { createTodayView } from './ui-today.js';
import { createHistoryView } from './ui-history.js';
import { createManageView } from './ui-manage.js';
import { createDashboardView } from './ui-dashboard.js';
import { createGratitudeView } from './ui-gratitude.js';
import { createMoodView } from './ui-mood.js';
import { NAV_ITEMS, icon } from './data.js';
import { flushQueue } from './api.js';
import { showToast } from './ui-common.js';

const appRoot = document.getElementById('app');
let currentViewId = 'today';
let views = {};

function buildShell() {
  appRoot.innerHTML = `
    <div class="shell">
      <nav class="sidenav">
        <div class="brand">Planner</div>
        ${NAV_ITEMS.map((n) => `<button data-nav="${n.id}">${icon(n.icon)} ${n.label}</button>`).join('')}
        <div class="nav-spacer"></div>
      </nav>
      <main class="main" id="main-content"></main>
      <nav class="bottomnav">
        ${NAV_ITEMS.map((n) => `<button data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></button>`).join('')}
      </nav>
    </div>
  `;

  document.querySelectorAll('[data-nav]').forEach((btn) =>
    btn.addEventListener('click', () => switchView(btn.dataset.nav))
  );

  views = {
    today: createTodayView({
      onLogout: showAuth,
      onOpenHistory: () => switchView('history'),
      onOpenMood: async ({ addMood = false } = {}) => {
        await switchView('mood');
        if (addMood) views.mood.openAddMood();
      },
    }),
    history: createHistoryView(),
    dashboard: createDashboardView(),
    gratitude: createGratitudeView(),
    mood: createMoodView(),
    manage: createManageView(),
  };

  switchView('today');
}

async function switchView(id) {
  currentViewId = id;
  document.querySelectorAll('[data-nav]').forEach((btn) => btn.classList.toggle('active', btn.dataset.nav === id));
  const main = document.getElementById('main-content');
  await views[id].mount(main);
}

function showAuth() {
  renderAuth(appRoot, { onAuthed: buildShell });
}

showAuth();

// Bump this whenever service-worker.js changes. The query string is what
// actually matters here — this host puts a year-long `immutable`
// Cache-Control on every static file and a CDN in front of it honors that
// literally, so a plain, unversioned request for service-worker.js can keep
// hitting an old edge-cached copy indefinitely regardless of what's on the
// origin. A URL that's never been requested before is what forces a real
// fetch through to origin; updateViaCache alone only affects the browser's
// own local cache; it has no say over an upstream CDN.
const SW_VERSION = 9;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`service-worker.js?v=${SW_VERSION}`, { updateViaCache: 'none' })
      .catch(() => {});
  });

  // Once a new service worker takes over, the freshest app-shell files are
  // guaranteed to be in its cache — reload once so the page actually uses them
  // instead of whatever was already parsed from the old one.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}

window.addEventListener('online', async () => {
  const synced = await flushQueue();
  if (synced > 0) {
    showToast('Back online — synced your changes.');
    if (views[currentViewId]) switchView(currentViewId);
  }
});

flushQueue();
setInterval(() => {
  if (navigator.onLine) flushQueue();
}, 30000);
