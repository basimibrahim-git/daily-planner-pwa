import { icon } from './data.js';
import { escapeHtml } from './utils.js';

// 'standard' items store their entry value as JSON:
// {"checked":0|1,"count":number,"note":string}.
// 'text' items store their entry value as a plain string. Encoding/decoding is kept
// entirely inside this module so callers just pass a string to setEntry either way.
function decodeStandardValue(raw) {
  if (raw === undefined || raw === null || raw === '') return { checked: 0, count: 0, note: '' };
  try {
    const parsed = JSON.parse(raw);
    return {
      checked: parsed && parsed.checked ? 1 : 0,
      count: parsed && typeof parsed.count === 'number' ? parsed.count : Number(parsed?.count) || 0,
      note: parsed && typeof parsed.note === 'string' ? parsed.note : '',
    };
  } catch {
    return { checked: 0, count: 0, note: '' };
  }
}

function encodeStandardValue(v) {
  return JSON.stringify({
    checked: v.checked ? 1 : 0,
    count: v.count || 0,
    note: v.note || '',
  });
}

// Mirrors api/lib.php's isEntryDone(): the checkbox is authoritative when shown;
// otherwise a counter-only item is done once it reaches its target (or is > 0
// with no target); an item with neither control just can't be "done".
export function isItemDone(item, rawValue) {
  if (item.type === 'text') return String(rawValue ?? '').trim() !== '';
  const { checked, count } = decodeStandardValue(rawValue);
  if (item.has_checkbox) return checked === 1;
  if (item.has_counter) {
    const target = item.target_value ? parseFloat(item.target_value) : null;
    return target ? count >= target : count > 0;
  }
  return false;
}

export function computeStats(items, entries) {
  const total = items.length;
  const done = items.filter((it) => isItemDone(it, entries[it.id])).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
}

export function stepFor(unit) {
  if (!unit) return 1;
  const u = unit.toLowerCase();
  if (u === 'l' || u.startsWith('liter')) return 0.5;
  if (u === 'g' || u.startsWith('gram')) return 5;
  if (u.startsWith('min')) return 5;
  return 1;
}

function formatNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function renderItemRow(item, rawValue, editable) {
  const disabledAttr = editable ? '' : 'disabled';

  if (item.type === 'text') {
    const done = isItemDone(item, rawValue);
    return `
      <div class="item-row ${done ? 'done' : ''}" data-item-id="${item.id}">
        <div class="item-icon">${icon(item.icon)}</div>
        <div class="item-label">${escapeHtml(item.label)}</div>
        <input class="text-item-input" data-action="text-input" data-item-id="${item.id}" value="${escapeHtml(rawValue || '')}" ${disabledAttr} placeholder="Add a note" />
      </div>
    `;
  }

  const { checked, count, note } = decodeStandardValue(rawValue);
  const target = item.target_value ? parseFloat(item.target_value) : null;
  const unit = item.unit ? escapeHtml(item.unit) : '';
  const targetLabel = target ? `/${formatNum(target)}${unit ? ' ' + unit : ''}` : unit ? ` ${unit}` : '';
  const done = isItemDone(item, rawValue);

  const counterHtml = item.has_counter
    ? `
      <div class="stepper">
        <button data-action="counter-dec" data-item-id="${item.id}" ${disabledAttr} aria-label="Decrease">${icon('minus')}</button>
        <div class="value">${formatNum(count)}<span class="unit">${targetLabel}</span></div>
        <button data-action="counter-inc" data-item-id="${item.id}" ${disabledAttr} aria-label="Increase">${icon('plus')}</button>
      </div>
    `
    : '';

  const checkboxHtml = item.has_checkbox
    ? `<button class="checkbox-btn ${checked ? 'checked' : ''}" data-action="toggle-check" data-item-id="${item.id}" ${disabledAttr} aria-label="Mark ${escapeHtml(item.label)} done">${icon('check')}</button>`
    : '';

  return `
    <div class="item-block" data-item-id="${item.id}">
      <div class="item-row ${done ? 'done' : ''}">
        <div class="item-icon">${icon(item.icon)}</div>
        <div class="item-label">${escapeHtml(item.label)}</div>
        ${counterHtml}
        ${checkboxHtml}
        <button class="note-toggle-btn ${note ? 'has-note' : ''}" data-action="toggle-note" data-item-id="${item.id}" aria-label="Add details for ${escapeHtml(item.label)}">${icon('edit')}</button>
      </div>
      <div class="item-note-wrap collapsed" data-note-wrap="${item.id}">
        <textarea class="item-note-input" data-action="note-input" data-item-id="${item.id}" ${disabledAttr} placeholder="What did you do? Add any details here...">${escapeHtml(note)}</textarea>
      </div>
    </div>
  `;
}

export function renderChecklistHtml(items, entries, { editable = true } = {}) {
  const groups = [];
  const byCat = new Map();
  for (const item of items) {
    if (!byCat.has(item.category)) {
      const g = { category: item.category, items: [] };
      byCat.set(item.category, g);
      groups.push(g);
    }
    byCat.get(item.category).items.push(item);
  }

  if (groups.length === 0) {
    return `<div class="empty-state">No checklist items yet. Add some from the Manage tab.</div>`;
  }

  return groups
    .map(
      (g) => `
    <div class="category">
      <div class="category-title">${escapeHtml(g.category)}</div>
      ${g.items.map((item) => renderItemRow(item, entries[item.id], editable)).join('')}
    </div>
  `
    )
    .join('');
}

// Attaches delegated listeners once to a stable container element. Re-render
// by replacing container.innerHTML — the listeners stay bound to the container.
// onChange(item, newValue) is for checkbox/counter taps (callers typically
// re-render immediately). onNoteChange(item, newNote) fires only on blur, and
// callers should NOT re-render the DOM for it (the textarea already reflects
// what was typed) — just persist it.
export function bindChecklist(container, { getItems, getEntries, onChange, onNoteChange }) {
  container.addEventListener('click', (e) => {
    const noteBtn = e.target.closest('[data-action="toggle-note"]');
    if (noteBtn) {
      const wrap = container.querySelector(`[data-note-wrap="${noteBtn.dataset.itemId}"]`);
      wrap?.classList.toggle('collapsed');
      if (!wrap?.classList.contains('collapsed')) {
        wrap?.querySelector('textarea')?.focus();
      }
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const itemId = Number(btn.dataset.itemId);
    const action = btn.dataset.action;
    const item = getItems().find((i) => i.id === itemId);
    if (!item) return;
    const entries = getEntries();

    if (action === 'toggle-check') {
      const current = decodeStandardValue(entries[itemId]);
      onChange(item, encodeStandardValue({ ...current, checked: current.checked ? 0 : 1 }));
    } else if (action === 'counter-inc' || action === 'counter-dec') {
      const step = stepFor(item.unit);
      const current = decodeStandardValue(entries[itemId]);
      let nextCount = action === 'counter-inc' ? current.count + step : current.count - step;
      nextCount = Math.max(0, Math.round(nextCount * 100) / 100);
      onChange(item, encodeStandardValue({ ...current, count: nextCount }));
    }
  });

  container.addEventListener('change', (e) => {
    const input = e.target.closest('[data-action="text-input"]');
    if (!input) return;
    const itemId = Number(input.dataset.itemId);
    const item = getItems().find((i) => i.id === itemId);
    if (!item) return;
    onChange(item, input.value);
  });

  container.addEventListener(
    'blur',
    (e) => {
      const textarea = e.target.closest?.('[data-action="note-input"]');
      if (!textarea) return;
      const itemId = Number(textarea.dataset.itemId);
      const item = getItems().find((i) => i.id === itemId);
      if (!item) return;
      const current = decodeStandardValue(getEntries()[itemId]);
      if (current.note === textarea.value) return; // unchanged, skip a write
      onNoteChange?.(item, encodeStandardValue({ ...current, note: textarea.value }));
    },
    true // capture, since 'blur' doesn't bubble
  );
}
