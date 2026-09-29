import { fetchMoodDay, logMood, deleteMoodCheckin, fetchMoodStats, moodOptions } from './api.js';
import { icon } from './data.js';
import { todayStr, addDays, friendlyDate, monthLabel, nowTimeStr, escapeHtml } from './utils.js';
import { showToast, openModal } from './ui-common.js';
import { colorPickerHtml, bindColorPicker, isValidColor } from './ui-color-picker.js';

const PERIODS = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
];
const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const EMOJI_SUGGESTIONS = ['😄', '😊', '🙂', '😌', '🥰', '🤩', '😐', '😴', '😕', '😟', '😰', '😢', '😞', '😠', '🤒', '🙏'];

// Fixed low → mid → high scale for coloring a day's *average*, since an
// average like 3.4 doesn't belong to any single mood's own color.
const SCALE = [
  [1, [232, 132, 154]],
  [3, [232, 194, 91]],
  [5, [108, 196, 160]],
];

function scoreColor(score) {
  const s = Math.max(1, Math.min(5, score));
  for (let i = 0; i < SCALE.length - 1; i++) {
    const [s0, c0] = SCALE[i];
    const [s1, c1] = SCALE[i + 1];
    if (s <= s1) {
      const t = (s - s0) / (s1 - s0);
      const mix = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${mix.join(',')})`;
    }
  }
  return `rgb(${SCALE[SCALE.length - 1][1].join(',')})`;
}

function safeColor(color) {
  return isValidColor(color) ? color : '#8B6FB3';
}

function activeOptions(options) {
  return options.filter((o) => o.active);
}

function nearestOption(options, score) {
  const pool = activeOptions(options).length ? activeOptions(options) : options;
  return pool.reduce((best, o) => (!best || Math.abs(o.score - score) < Math.abs(best.score - score) ? o : best), null);
}

function formatAvg(n) {
  return n === null || n === undefined ? '–' : (Math.round(n * 10) / 10).toFixed(1);
}

function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function checkinRowsHtml(checkins, options, { deletable = true } = {}) {
  if (!checkins.length) return '<div class="empty-state mood-empty">No check-ins yet.</div>';
  return [...checkins]
    .reverse()
    .map((c) => {
      const opt = options.find((o) => o.id === c.option_id);
      return `
        <div class="mood-checkin-row">
          <div class="mood-checkin-time">${escapeHtml(c.time)}</div>
          <div class="mood-checkin-emoji" style="background:${safeColor(opt?.color)}33">${escapeHtml(opt?.emoji || '•')}</div>
          <div class="mood-checkin-info">
            <div class="mood-checkin-label">${escapeHtml(opt?.label || 'Mood')}</div>
            ${c.note ? `<div class="mood-checkin-note">${escapeHtml(c.note)}</div>` : ''}
          </div>
          ${deletable ? `<button class="mood-checkin-del" data-del-checkin="${escapeHtml(String(c.id))}" aria-label="Delete check-in">${icon('trash')}</button>` : ''}
        </div>`;
    })
    .join('');
}

async function confirmDeleteCheckin(id, date) {
  if (String(id).startsWith('local-')) {
    showToast('That check-in is still waiting to sync — try again once you are online.');
    return false;
  }
  try {
    await deleteMoodCheckin(id, date);
    showToast('Check-in removed.');
    return true;
  } catch (e) {
    showToast(`Could not delete: ${e.message}`, 'error');
    return false;
  }
}

function addMoodTileHtml(cls, id) {
  return `
    <button class="${cls} mood-add" id="${id}" aria-label="Add a mood">
      <span class="mood-emoji">${icon('plus')}</span>
      <span class="mood-lbl">Add mood</span>
    </button>`;
}

// ---------- Today page quick card ----------

export async function mountMoodQuickCard(el, { onOpenMood } = {}) {
  const date = todayStr();
  let options = [];
  let checkins = [];

  try {
    const res = await fetchMoodDay(date);
    options = res.options || [];
    checkins = res.checkins || [];
  } catch {
    el.innerHTML = '';
    return; // nice-to-have on Today; the Mood tab shows the real error
  }

  function statusText() {
    if (!checkins.length) return 'Tap how you feel — you can check in as often as you like.';
    const last = checkins[checkins.length - 1];
    const opt = options.find((o) => o.id === last.option_id);
    const n = checkins.length;
    return `${n} check-in${n === 1 ? '' : 's'} today · last ${opt ? `${opt.emoji} ${opt.label}` : ''} at ${last.time}`;
  }

  function render() {
    el.innerHTML = `
      <div class="feature-card mood-quick-card">
        <div class="mood-quick-head">
          <div class="label">${icon('smile')} How are you feeling?</div>
          <button class="mood-quick-link" id="mood-quick-open">Mood ${icon('chevron-right')}</button>
        </div>
        <div class="mood-quick-row">
          ${activeOptions(options)
            .map(
              (o) => `
            <button class="mood-quick-btn" data-option="${o.id}" style="--mood:${safeColor(o.color)}">
              <span class="mood-emoji">${escapeHtml(o.emoji)}</span>
              <span class="mood-lbl">${escapeHtml(o.label)}</span>
            </button>`
            )
            .join('')}
          ${addMoodTileHtml('mood-quick-btn', 'mood-quick-add')}
        </div>
        <div class="mood-quick-status">${escapeHtml(statusText())}</div>
      </div>
    `;
    el.querySelector('#mood-quick-open').addEventListener('click', () => onOpenMood?.());
    el.querySelector('#mood-quick-add').addEventListener('click', () => onOpenMood?.({ addMood: true }));
    el.querySelectorAll('[data-option]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const optionId = Number(btn.dataset.option);
        const opt = options.find((o) => o.id === optionId);
        const time = nowTimeStr();
        btn.disabled = true;
        try {
          const res = await logMood({ date, time, optionId });
          checkins = [...checkins, { id: res.id ?? `local-${Date.now()}`, option_id: optionId, score: opt.score, note: '', time }];
          showToast(res.offline ? `Logged ${opt.emoji} offline — will sync later.` : `Logged ${opt.emoji} ${opt.label}`, res.offline ? 'offline' : '');
          render();
          el.querySelector(`[data-option="${optionId}"]`)?.classList.add('pulse');
        } catch (e) {
          showToast(`Could not log mood: ${e.message}`, 'error');
          btn.disabled = false;
        }
      })
    );
  }

  render();
}

// ---------- Charts ----------

function trendChartHtml(days, options) {
  const points = days.map((d, i) => ({ ...d, i })).filter((d) => d.avg !== null);
  if (points.length === 0) {
    return '<div class="empty-state mood-empty">Log a few check-ins to see your trend.</div>';
  }
  const width = 600;
  const height = 220;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 16;
  const n = days.length;
  const x = (i) => padL + (n === 1 ? (width - padL - padR) / 2 : (i * (width - padL - padR)) / (n - 1));
  const y = (score) => padT + ((5 - score) / 4) * (height - padT - padB);

  const grid = [1, 2, 3, 4, 5]
    .map((s) => `<line x1="${padL}" y1="${y(s)}" x2="${width - padR}" y2="${y(s)}" stroke="#E4D7EE" stroke-width="1" ${s % 2 ? '' : 'stroke-dasharray="4 5"'}/>`)
    .join('');
  const labels = [1, 3, 5]
    .map((s) => {
      const opt = nearestOption(options, s);
      return `<text x="${padL - 12}" y="${y(s) + 8}" text-anchor="end" font-size="22">${escapeHtml(opt?.emoji || String(s))}</text>`;
    })
    .join('');
  const line = points.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ');
  const dots = points
    .map((p) => `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.avg).toFixed(1)}" r="${n > 45 ? 4 : 6}" fill="${scoreColor(p.avg)}" stroke="#fff" stroke-width="2"><title>${shortDate(p.date)}: ${formatAvg(p.avg)}</title></circle>`)
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="mood-chart-svg" role="img" aria-label="Daily average mood">
      ${grid}${labels}
      ${points.length > 1 ? `<path d="${line}" fill="none" stroke="#8B6FB3" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.55"/>` : ''}
      ${dots}
    </svg>
    <div class="mood-chart-axis"><span>${shortDate(days[0].date)}</span><span>${shortDate(days[n - 1].date)}</span></div>
  `;
}

function breakdownHtml(distribution) {
  const rows = distribution.filter((d) => d.active || d.count > 0);
  if (!rows.some((r) => r.count > 0)) return '<div class="empty-state mood-empty">No check-ins in this period yet.</div>';
  return rows
    .map(
      (r) => `
      <div class="stat-bar-row">
        <div class="stat-bar-label">${escapeHtml(r.emoji)} ${escapeHtml(r.label)}</div>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${r.percent}%;background:${safeColor(r.color)}"></div></div>
        <div class="stat-bar-pct">${r.count}</div>
      </div>`
    )
    .join('');
}

// ---------- Mood tab ----------

export function createMoodView() {
  let container = null;
  let date = todayStr();
  let options = [];
  let checkins = [];
  let selectedOptionId = null;
  let periodDays = 30;
  let stats = null;
  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth();
  let monthDays = {};

  async function mount(root) {
    container = root;
    date = todayStr();
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    try {
      await Promise.all([loadDay(), loadStats(), loadMonth()]);
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Couldn't load your moods.<br>${escapeHtml(e.message)}</div>`;
      return;
    }
    render();
  }

  async function loadDay() {
    const res = await fetchMoodDay(date);
    options = res.options || [];
    checkins = res.checkins || [];
    if (res.offline) showToast("You're offline — showing your last saved moods.", 'offline');
  }

  async function loadStats() {
    try {
      const end = todayStr();
      stats = await fetchMoodStats(addDays(end, -(periodDays - 1)), end);
    } catch {
      stats = null;
    }
  }

  async function loadMonth() {
    const pad = (n) => String(n).padStart(2, '0');
    const last = new Date(calYear, calMonth + 1, 0).getDate();
    try {
      const res = await fetchMoodStats(`${calYear}-${pad(calMonth + 1)}-01`, `${calYear}-${pad(calMonth + 1)}-${pad(last)}`);
      monthDays = {};
      for (const d of res.days) monthDays[d.date] = d;
    } catch {
      monthDays = {};
    }
  }

  function render() {
    const active = activeOptions(options);
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Mood</h1>
          <div class="date-sub">How are you feeling?</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-ghost btn-sm" id="manage-moods">${icon('edit')} Edit moods</button>
        </div>
      </div>

      <div class="calendar-card mood-checkin-card">
        <div class="category-title">${icon('smile')} Check in</div>
        <div class="mood-grid">
          ${active
            .map(
              (o) => `
            <button class="mood-option ${o.id === selectedOptionId ? 'selected' : ''}" data-option="${o.id}" style="--mood:${safeColor(o.color)}">
              <span class="mood-emoji">${escapeHtml(o.emoji)}</span>
              <span class="mood-lbl">${escapeHtml(o.label)}</span>
            </button>`
            )
            .join('')}
          ${addMoodTileHtml('mood-option', 'add-mood-tile')}
        </div>
        <textarea id="mood-note" class="mood-note" maxlength="280" placeholder="What's behind it? (optional)"></textarea>
        <button class="btn btn-primary" id="log-mood" ${selectedOptionId ? '' : 'disabled'}>Log mood</button>
      </div>

      <div class="calendar-card">
        <div class="category-title">${icon('calendar')} Today</div>
        <div id="today-checkins">${checkinRowsHtml(checkins, options)}</div>
      </div>

      <div class="radio-group" id="mood-period" style="margin:22px 0 14px;">
        ${PERIODS.map((p) => `<button type="button" class="radio-chip ${p.days === periodDays ? 'selected' : ''}" data-days="${p.days}">${p.label}</button>`).join('')}
      </div>
      ${statsHtml()}
      ${calendarHtml()}
    `;

    container.querySelector('#manage-moods').addEventListener('click', openManageMoods);
    container.querySelector('#add-mood-tile').addEventListener('click', () => openMoodForm(null));

    container.querySelectorAll('.mood-option[data-option]').forEach((btn) =>
      btn.addEventListener('click', () => {
        selectedOptionId = Number(btn.dataset.option);
        container.querySelectorAll('.mood-option[data-option]').forEach((b) => b.classList.toggle('selected', b === btn));
        container.querySelector('#log-mood').disabled = false;
      })
    );
    container.querySelector('#log-mood').addEventListener('click', submitCheckin);
    bindCheckinDeletes(container.querySelector('#today-checkins'), date, async () => {
      checkins = (await fetchMoodDay(date)).checkins || [];
      await Promise.all([loadStats(), loadMonth()]);
      render();
    });

    container.querySelectorAll('[data-days]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        periodDays = Number(btn.dataset.days);
        await loadStats();
        render();
      })
    );
    container.querySelector('#mood-prev-month').addEventListener('click', () => changeMonth(-1));
    const next = container.querySelector('#mood-next-month');
    if (!next.disabled) next.addEventListener('click', () => changeMonth(1));
    container.querySelectorAll('.day-cell[data-date]').forEach((cell) =>
      cell.addEventListener('click', () => openDayDetail(cell.dataset.date))
    );
  }

  function statsHtml() {
    if (!stats) return '<div class="empty-state mood-empty">Stats need a connection the first time.</div>';
    const avgOpt = stats.avg !== null ? nearestOption(options, stats.avg) : null;
    let delta = '';
    if (stats.avg !== null && stats.prevAvg !== null) {
      const diff = Math.round((stats.avg - stats.prevAvg) * 10) / 10;
      delta = diff === 0 ? 'same as before' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)} vs previous`;
    }
    const top = [...stats.distribution].sort((a, b) => b.count - a.count)[0];
    return `
      <div class="stat-row">
        <div class="stat-card">
          <div class="num">${avgOpt ? escapeHtml(avgOpt.emoji) + ' ' : ''}${formatAvg(stats.avg)}</div>
          <div class="lbl">Avg mood /5${delta ? `<br><span class="mood-delta">${delta}</span>` : ''}</div>
        </div>
        <div class="stat-card">
          <div class="num">${stats.daysLogged}<span class="num-sub">/${stats.days.length}</span></div>
          <div class="lbl">Days logged</div>
        </div>
        <div class="stat-card">
          <div class="num">${top && top.count ? escapeHtml(top.emoji) : '–'}</div>
          <div class="lbl">Most often${top && top.count ? `<br>${escapeHtml(top.label)}` : ''}</div>
        </div>
      </div>

      <div class="calendar-card chart-card">
        <div class="category-title">${icon('chart')} Mood trend <span class="title-hint">daily average</span></div>
        ${trendChartHtml(stats.days, options)}
      </div>

      <div class="calendar-card chart-card">
        <div class="category-title">${icon('list')} Mood breakdown <span class="title-hint">${stats.totalCheckins} check-ins</span></div>
        ${breakdownHtml(stats.distribution)}
      </div>
    `;
  }

  function calendarHtml() {
    const first = new Date(calYear, calMonth, 1);
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const leading = (first.getDay() + 6) % 7;
    const today = todayStr();
    let cells = '';
    for (let i = 0; i < leading; i++) cells += '<div class="day-cell empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const info = monthDays[dateStr];
      const hasData = info && info.avg !== null;
      const future = dateStr > today;
      cells += `
        <div class="day-cell ${dateStr === today ? 'today' : ''} ${future ? 'future' : ''}"
             ${hasData ? `data-date="${dateStr}"` : ''}
             style="${hasData ? `background:${scoreColor(info.avg)};color:#fff;cursor:pointer` : ''}"
             ${hasData ? `title="Average ${formatAvg(info.avg)} · ${info.count} check-in${info.count === 1 ? '' : 's'}"` : ''}>
          ${day}
        </div>`;
    }
    const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth();
    return `
      <div class="calendar-card">
        <div class="calendar-nav">
          <button class="icon-btn" id="mood-prev-month">${icon('chevron-left')}</button>
          <div>${monthLabel(calYear, calMonth)}</div>
          <button class="icon-btn" id="mood-next-month" ${isCurrentMonth ? 'disabled style="opacity:.3"' : ''}>${icon('chevron-right')}</button>
        </div>
        <div class="calendar-grid">
          ${DOW_LABELS.map((d) => `<div class="dow">${d}</div>`).join('')}
          ${cells}
        </div>
        <div class="mood-legend">
          <span>Low</span><span class="mood-legend-bar"></span><span>High</span>
        </div>
      </div>
    `;
  }

  async function changeMonth(delta) {
    calMonth += delta;
    if (calMonth < 0) {
      calMonth = 11;
      calYear -= 1;
    } else if (calMonth > 11) {
      calMonth = 0;
      calYear += 1;
    }
    await loadMonth();
    render();
  }

  async function submitCheckin() {
    const btn = container.querySelector('#log-mood');
    const note = container.querySelector('#mood-note').value.trim();
    const opt = options.find((o) => o.id === selectedOptionId);
    if (!opt) return;
    btn.disabled = true;
    const time = nowTimeStr();
    try {
      const res = await logMood({ date, time, optionId: opt.id, note });
      checkins = [...checkins, { id: res.id ?? `local-${Date.now()}`, option_id: opt.id, score: opt.score, note, time }];
      selectedOptionId = null;
      showToast(res.offline ? `Logged ${opt.emoji} offline — will sync later.` : `Logged ${opt.emoji} ${opt.label}`, res.offline ? 'offline' : '');
      if (!res.offline) await Promise.all([loadStats(), loadMonth()]);
      render();
    } catch (e) {
      showToast(`Could not log mood: ${e.message}`, 'error');
      btn.disabled = false;
    }
  }

  function bindCheckinDeletes(listEl, forDate, onDeleted) {
    listEl.querySelectorAll('[data-del-checkin]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const raw = btn.dataset.delCheckin;
        const id = raw.startsWith('local-') ? raw : Number(raw);
        if (await confirmDeleteCheckin(id, forDate)) await onDeleted();
      })
    );
  }

  async function openDayDetail(dateStr) {
    const sheet = openModal(`<h2>${escapeHtml(friendlyDate(dateStr))}</h2><div id="mood-day-body">Loading…</div>`);
    const body = sheet.querySelector('#mood-day-body');
    const show = async () => {
      try {
        const res = await fetchMoodDay(dateStr);
        body.innerHTML = checkinRowsHtml(res.checkins || [], res.options || options);
        bindCheckinDeletes(body, dateStr, async () => {
          await show();
          if (dateStr === date) checkins = (await fetchMoodDay(date)).checkins || [];
          await Promise.all([loadStats(), loadMonth()]);
          render();
        });
      } catch (e) {
        body.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
      }
    };
    await show();
  }

  // ---------- Managing the mood list ----------

  async function refreshAfterOptionsChange() {
    await loadStats();
    render();
    openManageMoods();
  }

  function openManageMoods() {
    const active = activeOptions(options);
    const sheet = openModal(
      `
      <h2>Your moods</h2>
      <p class="modal-hint">The score (1–5) is what the trend chart and averages use.</p>
      ${active
        .map(
          (o, idx) => `
        <div class="manage-item-row">
          <div class="mood-manage-emoji" style="background:${safeColor(o.color)}33">${escapeHtml(o.emoji)}</div>
          <div class="info">
            <div class="lbl">${escapeHtml(o.label)}</div>
            <div class="meta"><span class="mood-dot" style="background:${safeColor(o.color)}"></span> score ${o.score}/5</div>
          </div>
          <div class="actions">
            <button data-move="up" data-id="${o.id}" ${idx === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Move up">${icon('chevron-up')}</button>
            <button data-move="down" data-id="${o.id}" ${idx === active.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Move down">${icon('chevron-down')}</button>
            <button data-edit="${o.id}" aria-label="Edit">${icon('edit')}</button>
            <button data-remove="${o.id}" aria-label="Remove">${icon('trash')}</button>
          </div>
        </div>`
        )
        .join('')}
      <div class="modal-actions">
        <button class="btn btn-primary btn-block" id="add-mood">${icon('plus')} Add a mood</button>
      </div>
    `
    );

    sheet.querySelector('#add-mood').addEventListener('click', () => openMoodForm(null));
    sheet.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => openMoodForm(options.find((o) => o.id === Number(btn.dataset.edit))))
    );
    sheet.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => confirmRemove(options.find((o) => o.id === Number(btn.dataset.remove))))
    );
    sheet.querySelectorAll('[data-move]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const ids = active.map((o) => o.id);
        const idx = ids.indexOf(Number(btn.dataset.id));
        const swap = btn.dataset.move === 'up' ? idx - 1 : idx + 1;
        [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
        try {
          options = await moodOptions.reorder(ids);
          await refreshAfterOptionsChange();
        } catch (e) {
          showToast(`Could not reorder: ${e.message}`, 'error');
        }
      })
    );
  }

  function confirmRemove(opt) {
    const sheet = openModal(`
      <h2>Remove ${escapeHtml(opt.emoji)} ${escapeHtml(opt.label)}?</h2>
      <p>It won't show up for new check-ins. Past check-ins that used it are kept in your history.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-block" id="cancel-remove">Cancel</button>
        <button class="btn btn-danger btn-block" id="confirm-remove">${icon('trash')} Remove</button>
      </div>
    `);
    sheet.querySelector('#cancel-remove').addEventListener('click', openManageMoods);
    sheet.querySelector('#confirm-remove').addEventListener('click', async () => {
      try {
        options = await moodOptions.remove(opt.id);
        if (selectedOptionId === opt.id) selectedOptionId = null;
        await refreshAfterOptionsChange();
      } catch (e) {
        showToast(`Could not remove: ${e.message}`, 'error');
      }
    });
  }

  function openMoodForm(existing) {
    let score = existing?.score ?? 3;
    let color = existing?.color && isValidColor(existing.color) ? existing.color : '#8B6FB3';
    const sheet = openModal(`
      <h2>${existing ? 'Edit mood' : 'Add a mood'}</h2>
      <div class="field">
        <label for="mood-label">Name</label>
        <input id="mood-label" maxlength="40" value="${escapeHtml(existing?.label || '')}" placeholder="e.g. Anxious, Calm, Tired" />
      </div>
      <div class="field">
        <label for="mood-emoji">Emoji</label>
        <input id="mood-emoji" class="mood-emoji-input" maxlength="8" value="${escapeHtml(existing?.emoji || '')}" placeholder="Type or pick one" />
        <div class="emoji-suggestions">
          ${EMOJI_SUGGESTIONS.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Score <span class="label-hint">1 = lowest, 5 = best</span></label>
        <div class="radio-group">
          ${[1, 2, 3, 4, 5].map((s) => `<button type="button" class="radio-chip score-chip ${s === score ? 'selected' : ''}" data-score="${s}">${s}</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Color</label>
        ${colorPickerHtml(color)}
      </div>
      <p class="error-text hidden" id="mood-form-error"></p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-block" id="cancel-mood">Cancel</button>
        <button class="btn btn-primary btn-block" id="save-mood">${existing ? 'Save' : 'Add'}</button>
      </div>
    `);

    const emojiInput = sheet.querySelector('#mood-emoji');
    sheet.querySelectorAll('[data-emoji]').forEach((btn) =>
      btn.addEventListener('click', () => {
        emojiInput.value = btn.dataset.emoji;
      })
    );
    sheet.querySelectorAll('[data-score]').forEach((btn) =>
      btn.addEventListener('click', () => {
        score = Number(btn.dataset.score);
        sheet.querySelectorAll('[data-score]').forEach((b) => b.classList.toggle('selected', b === btn));
      })
    );
    bindColorPicker(sheet.querySelector('.color-picker'), {
      initial: color,
      onChange: (c) => {
        color = c;
      },
    });

    sheet.querySelector('#cancel-mood').addEventListener('click', openManageMoods);
    sheet.querySelector('#save-mood').addEventListener('click', async () => {
      const label = sheet.querySelector('#mood-label').value.trim();
      const emoji = emojiInput.value.trim();
      const errorEl = sheet.querySelector('#mood-form-error');
      errorEl.classList.add('hidden');
      if (!label || !emoji) {
        errorEl.textContent = 'Give it a name and an emoji.';
        errorEl.classList.remove('hidden');
        return;
      }
      try {
        options = await moodOptions.save({ id: existing?.id, label, emoji, color, score });
        await refreshAfterOptionsChange();
      } catch (e) {
        errorEl.textContent = e.message || 'Could not save mood.';
        errorEl.classList.remove('hidden');
      }
    });
  }

  return { mount, openAddMood: () => openMoodForm(null) };
}
