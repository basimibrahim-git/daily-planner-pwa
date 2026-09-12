import { fetchStats } from './api.js';
import { icon } from './data.js';
import { todayStr, addDays, escapeHtml } from './utils.js';
import { showToast } from './ui-common.js';

const PERIODS = [
  { days: 7, label: '7D' },
  { days: 30, label: '30D' },
  { days: 90, label: '90D' },
];

function trendChartSvg(trend) {
  const width = 600;
  const height = 160;
  const padding = 20;
  const n = trend.length;
  if (n < 2) return `<div class="empty-state">Not enough data yet.</div>`;

  const xStep = (width - padding * 2) / (n - 1);
  const yScale = (height - padding * 2) / 100;
  const coords = trend.map((p, i) => [
    padding + i * xStep,
    height - padding - p.percent * yScale,
  ]);
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' ');
  const area = `${line} L${coords[n - 1][0].toFixed(1)},${height - padding} L${coords[0][0].toFixed(1)},${height - padding} Z`;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#E4D7EE" stroke-width="1"/>
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#E4D7EE" stroke-width="1" stroke-dasharray="4 4"/>
      <path d="${area}" fill="#8B6FB3" opacity="0.18"/>
      <path d="${line}" fill="none" stroke="#6B4E8E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function barList(rows, { emptyText = 'No data yet.' } = {}) {
  if (rows.length === 0) return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  return rows
    .map(
      (r) => `
    <div class="stat-bar-row">
      <div class="stat-bar-label">${escapeHtml(r.label)}</div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${r.percent}%"></div></div>
      <div class="stat-bar-pct">${r.percent}%</div>
    </div>
  `
    )
    .join('');
}

export function createDashboardView() {
  let container = null;
  let periodDays = 30;
  let data = null;

  async function mount(root) {
    container = root;
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    await load();
  }

  async function load() {
    try {
      const end = todayStr();
      const start = addDays(end, -(periodDays - 1));
      data = await fetchStats(start, end);
      if (data.offline) showToast("You're offline — showing your last saved stats.", 'offline');
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Couldn't load stats.<br>${escapeHtml(e.message)}</div>`;
      return;
    }
    render();
  }

  function render() {
    const avgPercent = data.trend.length
      ? Math.round(data.trend.reduce((sum, d) => sum + d.percent, 0) / data.trend.length)
      : 0;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <div class="date-sub">Your activity at a glance</div>
        </div>
      </div>

      <div class="radio-group" id="period-group" style="margin-bottom:16px;">
        ${PERIODS.map((p) => `<button type="button" class="radio-chip ${p.days === periodDays ? 'selected' : ''}" data-days="${p.days}">${p.label}</button>`).join('')}
      </div>

      <div class="stat-row">
        <div class="stat-card">
          <div class="num">${avgPercent}%</div>
          <div class="lbl">Avg completion</div>
        </div>
        <div class="stat-card">
          <div class="num">${data.prayerQuran.currentStreak}</div>
          <div class="lbl">Current streak</div>
        </div>
        <div class="stat-card">
          <div class="num">${data.prayerQuran.bestStreak}</div>
          <div class="lbl">Best streak</div>
        </div>
      </div>

      <div class="calendar-card chart-card">
        <div class="category-title">${icon('chart')} Completion trend</div>
        ${trendChartSvg(data.trend)}
      </div>

      <div class="calendar-card chart-card">
        <div class="category-title">${icon('list')} Category breakdown</div>
        ${barList(
          data.categories.map((c) => ({ label: c.category, percent: c.percent })),
          { emptyText: 'Add some checklist items to see this.' }
        )}
      </div>

      <div class="calendar-card chart-card">
        <div class="category-title">${icon('star')} Per-item ranking</div>
        ${barList(data.items.map((i) => ({ label: i.label, percent: i.percent })))}
      </div>

      <div class="calendar-card chart-card">
        <div class="category-title">${icon('flame')} Prayer & Quran focus</div>
        ${
          data.prayerQuran.items.length === 0
            ? `<div class="empty-state">No items are flagged to count toward your streak yet. Toggle "Counts toward streak" on an item in Manage.</div>`
            : barList(data.prayerQuran.items.map((i) => ({ label: i.label, percent: i.percent })))
        }
        ${data.prayerQuran.items
          .filter((i) => i.countTotal > 0)
          .map(
            (i) => `<div class="date-sub" style="margin-top:4px;">${escapeHtml(i.label)}: ${i.countTotal}${i.unit ? ' ' + escapeHtml(i.unit) : ''} total this period</div>`
          )
          .join('')}
      </div>
    `;

    container.querySelectorAll('[data-days]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        periodDays = Number(btn.dataset.days);
        container.innerHTML = `<div class="empty-state">Loading…</div>`;
        await load();
      })
    );
  }

  return { mount };
}
