import {
  fetchItems, fetchEntries, fetchHistory, setEntry, setNote, auth,
  fetchTodaysDua, fetchFavoriteDuas, duaFavorite,
} from './api.js';
import { renderChecklistHtml, bindChecklist, computeStats } from './ui-checklist.js';
import { mountMoodQuickCard } from './ui-mood.js';
import { icon, QUOTES, todayIndex } from './data.js';
import { todayStr, addDays, friendlyDate, debounce, escapeHtml } from './utils.js';
import { showToast, openModal, closeModal } from './ui-common.js';
import { canInstall, promptInstall } from './install.js';
import { openItemForm } from './ui-item-form.js';

export function createTodayView({ onLogout, onOpenHistory, onOpenMood }) {
  let container = null;
  let date = todayStr();
  let items = [];
  let entries = {};
  let note = '';
  let streak = 0;
  let lastOfflineToast = 0;
  let screen = 'overview'; // 'overview' | 'category' | 'favorites'
  let activeCategory = null;
  let todaysDua = null;
  let favoriteDuas = [];

  async function saveNote() {
    try {
      const res = await setNote(date, note);
      if (res.offline) maybeToastOffline();
    } catch (e) {
      showToast(`Could not save note: ${e.message}`, 'error');
    }
  }
  const debouncedSaveNote = debounce(saveNote, 700);

  function maybeToastOffline() {
    const now = Date.now();
    if (now - lastOfflineToast > 5000) {
      lastOfflineToast = now;
      showToast("You're offline — saved on this device, will sync later.", 'offline');
    }
  }

  async function mount(root) {
    container = root;
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    await load();
  }

  async function load() {
    try {
      const [itemsRes, entriesRes] = await Promise.all([fetchItems(), fetchEntries(date)]);
      items = itemsRes.items;
      entries = entriesRes.entries || {};
      note = entriesRes.note || '';
      if (itemsRes.offline || entriesRes.offline) {
        showToast("You're offline — showing your last saved planner.", 'offline');
      }
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Couldn't load your planner.<br>${escapeHtml(e.message || '')}</div>`;
      return;
    }
    try {
      const duaRes = await fetchTodaysDua();
      todaysDua = duaRes.dua;
    } catch {
      todaysDua = null; // the dua card is a nice-to-have; don't block the checklist over it
    }
    render();
    loadStreak();
  }

  async function loadStreak() {
    try {
      const end = todayStr();
      const start = addDays(end, -59);
      const hist = await fetchHistory(start, end);
      streak = hist.currentStreak || 0;
      const badge = container.querySelector('#streak-count');
      if (badge) badge.textContent = String(streak);
    } catch {
      /* streak is a nice-to-have; ignore failures */
    }
  }

  function categoryGroups() {
    const map = new Map();
    const order = [];
    for (const item of items) {
      if (!map.has(item.category)) {
        map.set(item.category, []);
        order.push(item.category);
      }
      map.get(item.category).push(item);
    }
    return order.map((cat) => ({ category: cat, items: map.get(cat) }));
  }

  function render() {
    if (screen === 'category') {
      renderCategoryScreen();
    } else if (screen === 'favorites') {
      renderFavoritesScreen();
    } else {
      renderOverview();
    }
  }

  function renderOverview() {
    const stats = computeStats(items, entries);
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (stats.percent / 100) * circumference;
    const quote = QUOTES[todayIndex(QUOTES.length)];
    const isToday = date === todayStr();
    const groups = categoryGroups();

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Daily Planner</h1>
          <div class="date-sub">
            <button class="date-nav-btn" id="prev-day" aria-label="Previous day">${icon('chevron-left')}</button>
            <button class="date-link" id="open-history-date" title="Open History calendar">${escapeHtml(isToday ? 'Today · ' : '')}${escapeHtml(friendlyDate(date))}</button>
            <button class="date-nav-btn" id="next-day" ${isToday ? 'disabled' : ''} aria-label="Next day">${icon('chevron-right')}</button>
          </div>
        </div>
        <div class="header-actions">
          <div class="streak-badge">${icon('flame')}<span id="streak-count">${streak}</span></div>
          <button class="icon-btn" id="open-settings">${icon('settings')}</button>
        </div>
      </div>

      <div class="progress-card">
        <div class="progress-ring-wrap">
          <svg width="82" height="82" viewBox="0 0 82 82">
            <circle cx="41" cy="41" r="${radius}" stroke="#E7DBF5" stroke-width="8" fill="none"/>
            <circle cx="41" cy="41" r="${radius}" stroke="#8B6FB3" stroke-width="8" fill="none" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
          </svg>
          <div class="ring-pct">${stats.percent}%</div>
        </div>
        <div class="progress-copy">
          <div class="lead">${stats.done} of ${stats.total} done</div>
          <div class="sub">${stats.percent === 100 ? 'Everything checked off — beautiful.' : 'Keep going, one item at a time.'}</div>
        </div>
      </div>

      ${isToday ? '<div id="mood-quick"></div>' : ''}

      ${renderDuaCardHtml()}

      <div class="category-grid">
        ${
          groups.length === 0
            ? '<div class="empty-state">No checklist items yet. Add some from the Manage tab.</div>'
            : groups
                .map((g) => {
                  const s = computeStats(g.items, entries);
                  return `
              <button class="category-card ${s.percent === 100 ? 'done' : ''}" data-category="${escapeHtml(g.category)}">
                <div class="cc-icon">${icon(g.items[0]?.icon || 'star')}</div>
                <div class="cc-info">
                  <div class="cc-name">${escapeHtml(g.category)}</div>
                  <div class="cc-progress"><div class="cc-bar" style="width:${s.percent}%"></div></div>
                  <div class="cc-stat">${s.done}/${s.total} done</div>
                </div>
                <div class="cc-chevron">${icon('chevron-right')}</div>
              </button>
            `;
                })
                .join('')
        }
      </div>

      <div class="feature-card quote-card">
        <div class="label">Remember</div>
        <div class="quote-text">${escapeHtml(quote)}</div>
      </div>

      <div class="feature-card notes-card">
        <div class="category-title">${icon('edit')} Notes</div>
        <textarea id="notes-input" placeholder="Anything else on your mind today...">${escapeHtml(note)}</textarea>
      </div>
    `;

    const moodEl = container.querySelector('#mood-quick');
    if (moodEl) mountMoodQuickCard(moodEl, { onOpenMood });

    container.querySelectorAll('.category-card').forEach((card) =>
      card.addEventListener('click', () => {
        activeCategory = card.dataset.category;
        screen = 'category';
        render();
      })
    );

    bindDuaCard();

    container.querySelector('#notes-input').addEventListener('input', (e) => {
      note = e.target.value;
      debouncedSaveNote();
    });

    container.querySelector('#prev-day').addEventListener('click', () => changeDate(addDays(date, -1)));
    const nextBtn = container.querySelector('#next-day');
    if (!nextBtn.disabled) {
      nextBtn.addEventListener('click', () => changeDate(addDays(date, 1)));
    }
    container.querySelector('#open-history-date').addEventListener('click', () => onOpenHistory?.());

    container.querySelector('#open-settings').addEventListener('click', openSettings);
  }

  function renderDuaCardHtml() {
    if (!todaysDua) {
      return `
        <div class="feature-card dua-card">
          <div class="label">${icon('heart')} Today's Dua</div>
          <div class="translation" style="font-style:normal;">No duas yet — run the one-time dua import (see README) to fill this in.</div>
        </div>
      `;
    }
    return `
      <div class="feature-card dua-card">
        <div class="dua-card-header">
          <div class="label">${icon('heart')} Today's Dua</div>
          <div class="dua-actions">
            <button class="dua-icon-btn" id="dua-saved-btn" aria-label="Saved duas">${icon('bookmark')}</button>
            <button class="dua-icon-btn ${todaysDua.isFavorite ? 'active' : ''}" id="dua-fav-btn" aria-label="Save this dua">${icon('heart')}</button>
          </div>
        </div>
        <div class="arabic">${todaysDua.arabic}</div>
        <div class="translation">${escapeHtml(todaysDua.translation)}</div>
        <button class="dua-info-link" id="dua-info-btn">More info ${icon('chevron-right')}</button>
      </div>
    `;
  }

  function bindDuaCard() {
    container.querySelector('#dua-saved-btn')?.addEventListener('click', openFavoritesScreen);
    container.querySelector('#dua-fav-btn')?.addEventListener('click', async () => {
      const nowFav = await toggleFavorite(todaysDua);
      todaysDua = { ...todaysDua, isFavorite: nowFav };
      const btn = container.querySelector('#dua-fav-btn');
      btn?.classList.toggle('active', nowFav);
    });
    container.querySelector('#dua-info-btn')?.addEventListener('click', () => showDuaInfoModal(todaysDua));
  }

  async function toggleFavorite(dua) {
    const wasFav = !!dua.isFavorite;
    try {
      if (wasFav) {
        await duaFavorite.remove(dua.id);
      } else {
        await duaFavorite.add(dua.id);
      }
      showToast(wasFav ? 'Removed from saved duas.' : 'Saved to your duas.');
      return !wasFav;
    } catch (e) {
      showToast(`Could not update favorite: ${e.message}`, 'error');
      return wasFav;
    }
  }

  function showDuaInfoModal(dua) {
    const sheet = openModal(`
      <h2>${escapeHtml(dua.category)}</h2>
      <div class="arabic" style="margin-bottom:12px;">${dua.arabic}</div>
      ${dua.transliteration ? `<div class="translation" style="margin-bottom:10px;"><em>${escapeHtml(dua.transliteration)}</em></div>` : ''}
      <div class="translation" style="font-style:normal;">${escapeHtml(dua.translation)}</div>
      <div class="date-sub" style="margin-top:14px;">Repeat ${escapeHtml(String(dua.repeat_count ?? 1))}x · Source: ${escapeHtml(dua.source || 'Hisnul Muslim')}</div>
      <div class="modal-actions">
        <button class="btn ${dua.isFavorite ? 'btn-danger' : 'btn-primary'} btn-block" id="modal-fav-toggle">
          ${icon('heart')} ${dua.isFavorite ? 'Remove from Saved' : 'Save this Dua'}
        </button>
      </div>
    `);
    sheet.querySelector('#modal-fav-toggle').addEventListener('click', async () => {
      const nowFav = await toggleFavorite(dua);
      dua.isFavorite = nowFav;
      if (todaysDua && todaysDua.id === dua.id) {
        todaysDua = { ...todaysDua, isFavorite: nowFav };
      }
      closeModal();
      if (screen === 'favorites') openFavoritesScreen();
      else if (screen === 'overview') render();
    });
  }

  async function openFavoritesScreen() {
    screen = 'favorites';
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    try {
      const res = await fetchFavoriteDuas();
      favoriteDuas = res.favorites || [];
      if (res.offline) showToast("You're offline — showing your last saved list.", 'offline');
    } catch (e) {
      showToast(`Could not load saved duas: ${e.message}`, 'error');
      favoriteDuas = [];
    }
    render();
  }

  function renderFavoritesScreen() {
    container.innerHTML = `
      <div class="back-row">
        <button id="back-to-overview-fav">${icon('chevron-left')} Today</button>
      </div>
      <div class="page-header">
        <div>
          <h1 style="font-size:28px;">Saved Duas</h1>
          <div class="date-sub">${favoriteDuas.length} saved</div>
        </div>
      </div>
      ${
        favoriteDuas.length === 0
          ? '<div class="empty-state">No saved duas yet. Tap the heart on Today\'s Dua to save one.</div>'
          : favoriteDuas
              .map(
                (d) => `
        <div class="feature-card dua-card" data-fav-id="${d.id}" style="cursor:pointer;">
          <div class="label">${escapeHtml(d.category)}</div>
          <div class="arabic">${d.arabic}</div>
          <div class="translation">${escapeHtml(d.translation)}</div>
        </div>
      `
              )
              .join('')
      }
    `;

    container.querySelector('#back-to-overview-fav').addEventListener('click', () => {
      screen = 'overview';
      render();
    });

    container.querySelectorAll('[data-fav-id]').forEach((card) =>
      card.addEventListener('click', () => {
        const dua = favoriteDuas.find((d) => d.id === Number(card.dataset.favId));
        if (dua) showDuaInfoModal({ ...dua, isFavorite: true });
      })
    );
  }

  function renderCategoryScreen() {
    const categoryItems = items.filter((i) => i.category === activeCategory);
    const s = computeStats(categoryItems, entries);

    container.innerHTML = `
      <div class="back-row">
        <button id="back-to-overview">${icon('chevron-left')} Categories</button>
      </div>
      <div class="page-header">
        <div>
          <h1 style="font-size:28px;">${escapeHtml(activeCategory)}</h1>
          <div class="date-sub">${s.done}/${s.total} done today</div>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="add-to-category" aria-label="Add item to ${escapeHtml(activeCategory)}">${icon('plus')}</button>
        </div>
      </div>
      <div id="checklist-container"></div>
    `;

    container.querySelector('#back-to-overview').addEventListener('click', () => {
      screen = 'overview';
      activeCategory = null;
      render();
    });

    container.querySelector('#add-to-category').addEventListener('click', () => {
      const categories = [...new Set(items.map((i) => i.category))];
      openItemForm({
        categories,
        presetCategory: activeCategory,
        onSaved: async () => {
          await load();
        },
      });
    });

    bindCategoryChecklist(categoryItems);
  }

  function bindCategoryChecklist(categoryItems) {
    const checklistEl = container.querySelector('#checklist-container');
    checklistEl.innerHTML = renderChecklistHtml(categoryItems, entries, { editable: date <= todayStr() });
    bindChecklist(checklistEl, {
      getItems: () => items,
      getEntries: () => entries,
      onChange: async (item, value) => {
        entries = { ...entries, [item.id]: value };
        renderCategoryScreen();
        try {
          const res = await setEntry(date, item.id, value);
          if (res.offline) maybeToastOffline();
        } catch (e) {
          showToast(`Could not save: ${e.message}`, 'error');
        }
      },
      onNoteChange: async (item, value) => {
        entries = { ...entries, [item.id]: value };
        try {
          const res = await setEntry(date, item.id, value);
          if (res.offline) maybeToastOffline();
        } catch (e) {
          showToast(`Could not save note: ${e.message}`, 'error');
        }
      },
    });
  }

  async function changeDate(newDate) {
    if (newDate > todayStr()) return;
    date = newDate;
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    await load();
  }

  function openSettings() {
    const sheet = openModal(`
      <h2>Settings</h2>
      ${canInstall() ? `<button class="install-btn" id="install-btn">${icon('download')} Install Daily Planner as an app</button>` : ''}
      <div class="field">
        <label>Change password</label>
        <input type="password" id="cur-pw" placeholder="Current password" autocomplete="current-password" style="margin-bottom:8px;" />
        <input type="password" id="new-pw" placeholder="New password" autocomplete="new-password" />
      </div>
      <p class="error-text hidden" id="settings-error"></p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-block" id="save-pw-btn">Update Password</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-danger btn-block" id="logout-btn">${icon('logout')} Log Out</button>
      </div>
    `);

    sheet.querySelector('#install-btn')?.addEventListener('click', async () => {
      await promptInstall();
      closeModal();
    });

    sheet.querySelector('#save-pw-btn').addEventListener('click', async () => {
      const cur = sheet.querySelector('#cur-pw').value;
      const next = sheet.querySelector('#new-pw').value;
      const errorEl = sheet.querySelector('#settings-error');
      errorEl.classList.add('hidden');
      try {
        await auth.changePassword(cur, next);
        showToast('Password updated.');
        closeModal();
      } catch (e) {
        errorEl.textContent = e.message || 'Could not update password.';
        errorEl.classList.remove('hidden');
      }
    });

    sheet.querySelector('#logout-btn').addEventListener('click', async () => {
      try {
        await auth.logout();
      } catch {
        /* ignore — proceed to lock the app locally regardless */
      }
      closeModal();
      onLogout();
    });
  }

  return { mount };
}
