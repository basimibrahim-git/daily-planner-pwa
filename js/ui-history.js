import { fetchItems, fetchEntries, fetchHistory, setEntry } from './api.js';
import { renderChecklistHtml, bindChecklist, bindChecklistDoodles } from './ui-checklist.js';
import { icon } from './data.js';
import { todayStr, addDays, friendlyDate, monthLabel, escapeHtml } from './utils.js';
import { showToast, openModal } from './ui-common.js';

const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function heatStyle(percent) {
  if (percent >= 100) return { bg: 'var(--purple-deep)', color: '#fff' };
  if (percent >= 67) return { bg: '#B79BDB', color: '#fff' };
  if (percent >= 34) return { bg: '#D9C6EF', color: 'var(--purple-deep)' };
  if (percent > 0) return { bg: '#EFE3FA', color: 'var(--purple-ink)' };
  return { bg: 'var(--cream-soft)', color: 'var(--purple-ink)' };
}

export function createHistoryView() {
  let container = null;
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed
  let monthDays = {}; // date -> {percent, done, total}
  let streakStats = { currentStreak: 0, bestStreak: 0 };
  let calendarDirty = false;

  async function mount(root) {
    container = root;
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    await Promise.all([loadMonth(), loadStreaks()]);
    render();
  }

  async function loadMonth() {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    try {
      const data = await fetchHistory(startStr, endStr);
      monthDays = {};
      for (const d of data.days) monthDays[d.date] = d;
      if (data.offline) showToast("You're offline — showing your last saved history.", 'offline');
    } catch (e) {
      showToast(`Could not load history: ${e.message}`, 'error');
    }
  }

  async function loadStreaks() {
    try {
      const end = todayStr();
      const start = addDays(end, -89);
      const data = await fetchHistory(start, end);
      streakStats = { currentStreak: data.currentStreak || 0, bestStreak: data.bestStreak || 0 };
    } catch {
      /* non-critical */
    }
  }

  function render() {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7; // Monday = 0

    let cells = '';
    for (let i = 0; i < leading; i++) cells += `<div class="day-cell empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isFuture = dateStr > todayStr();
      const isToday = dateStr === todayStr();
      const info = monthDays[dateStr];
      const { bg, color } = isFuture ? { bg: 'transparent', color: 'var(--purple-ink)' } : heatStyle(info ? info.percent : 0);
      cells += `
        <div class="day-cell ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
             data-date="${isFuture ? '' : dateStr}"
             style="background:${bg};color:${color};${isFuture ? 'cursor:default' : 'cursor:pointer'}">
          ${day}
        </div>`;
    }

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>History</h1>
          <div class="date-sub">Your check-in record</div>
        </div>
      </div>

      <div class="stat-row">
        <div class="stat-card">
          <div class="num">${streakStats.currentStreak}</div>
          <div class="lbl">Current streak</div>
        </div>
        <div class="stat-card">
          <div class="num">${streakStats.bestStreak}</div>
          <div class="lbl">Best streak</div>
        </div>
      </div>

      <div class="calendar-card">
        <div class="calendar-nav">
          <button class="icon-btn" id="prev-month">${icon('chevron-left')}</button>
          <div>${monthLabel(year, month)}</div>
          <button class="icon-btn" id="next-month" ${sameMonth(year, month, now) ? 'disabled style="opacity:.3"' : ''}>${icon('chevron-right')}</button>
        </div>
        <div class="calendar-grid">
          ${DOW_LABELS.map((d) => `<div class="dow">${d}</div>`).join('')}
          ${cells}
        </div>
      </div>
    `;

    container.querySelector('#prev-month').addEventListener('click', () => changeMonth(-1));
    const nextBtn = container.querySelector('#next-month');
    if (!nextBtn.disabled) nextBtn.addEventListener('click', () => changeMonth(1));

    container.querySelectorAll('.day-cell[data-date]:not([data-date=""])').forEach((cell) => {
      cell.addEventListener('click', () => openDayDetail(cell.dataset.date));
    });
  }

  function sameMonth(y, m, refDate) {
    return y === refDate.getFullYear() && m === refDate.getMonth();
  }

  async function changeMonth(delta) {
    month += delta;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    await loadMonth();
    render();
  }

  async function openDayDetail(dateStr) {
    const sheet = openModal(
      `<h2>${escapeHtml(friendlyDate(dateStr))}</h2><div id="day-detail-body">Loading…</div>`,
      {
        onClose: () => {
          if (calendarDirty) {
            calendarDirty = false;
            loadMonth().then(render);
          }
        },
      }
    );

    const body = sheet.querySelector('#day-detail-body');
    let dayItems = [];
    let dayEntries = {};

    try {
      const [itemsRes, entriesRes] = await Promise.all([fetchItems(), fetchEntries(dateStr)]);
      dayItems = itemsRes.items;
      dayEntries = entriesRes.entries || {};
    } catch (e) {
      body.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
      return;
    }

    const editable = dateStr <= todayStr();

    function renderBody() {
      body.innerHTML = renderChecklistHtml(dayItems, dayEntries, { editable });
    }
    renderBody();

    bindChecklist(body, {
      getItems: () => dayItems,
      getEntries: () => dayEntries,
      onChange: async (item, value) => {
        dayEntries = { ...dayEntries, [item.id]: value };
        renderBody();
        calendarDirty = true;
        try {
          await setEntry(dateStr, item.id, value);
        } catch (e) {
          showToast(`Could not save: ${e.message}`, 'error');
        }
      },
      onNoteChange: async (item, value) => {
        dayEntries = { ...dayEntries, [item.id]: value };
        try {
          await setEntry(dateStr, item.id, value);
        } catch (e) {
          showToast(`Could not save note: ${e.message}`, 'error');
        }
      },
    });
    bindChecklistDoodles(body, {
      getItems: () => dayItems,
      getEntries: () => dayEntries,
      onNoteChange: async (item, value) => {
        dayEntries = { ...dayEntries, [item.id]: value };
        try {
          await setEntry(dateStr, item.id, value);
        } catch (e) {
          showToast(`Could not save doodle: ${e.message}`, 'error');
        }
      },
    });
  }

  return { mount };
}
