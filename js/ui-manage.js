import { fetchItems, items as itemsApi } from './api.js';
import { icon } from './data.js';
import { escapeHtml } from './utils.js';
import { showToast, openModal, closeModal } from './ui-common.js';
import { openItemForm } from './ui-item-form.js';

export function createManageView() {
  let container = null;
  let items = [];

  async function mount(root) {
    container = root;
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    await load();
  }

  async function load() {
    try {
      const res = await fetchItems();
      items = res.items;
      if (res.offline) showToast("You're offline — item changes need a connection.", 'offline');
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Couldn't load items.<br>${escapeHtml(e.message)}</div>`;
      return;
    }
    render();
  }

  function groups() {
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

  function metaFor(item) {
    let controls = 'free text';
    if (item.type === 'standard') {
      const bits = [];
      if (item.has_checkbox) bits.push('checkbox');
      if (item.has_counter) bits.push('counter');
      controls = bits.join(' + ') || 'no controls';
    }
    const parts = [controls];
    if (item.target_value) parts.push(`target ${item.target_value}${item.unit ? ' ' + item.unit : ''}`);
    if (item.counts_toward_streak) parts.push(`${icon('flame', 'icon')} streak`);
    return parts.join(' · ');
  }

  function render() {
    const g = groups();
    const categories = g.map((grp) => grp.category);
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Manage</h1>
          <div class="date-sub">Your checklist items</div>
        </div>
      </div>
      ${
        g.length === 0
          ? '<div class="empty-state">No items yet. Tap + to add your first one.</div>'
          : g
              .map(
                (grp) => `
        <div class="manage-category">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <h3>${escapeHtml(grp.category)}</h3>
            <button class="icon-btn" data-add-to="${escapeHtml(grp.category)}" style="width:30px;height:30px;box-shadow:none;" aria-label="Add item to ${escapeHtml(grp.category)}">${icon('plus')}</button>
          </div>
          ${grp.items
            .map(
              (item, idx) => `
            <div class="manage-item-row">
              <div class="item-icon">${icon(item.icon)}</div>
              <div class="info">
                <div class="lbl">${escapeHtml(item.label)}</div>
                <div class="meta">${metaFor(item)}</div>
              </div>
              <div class="actions">
                <button data-move="up" data-id="${item.id}" ${idx === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Move up">${icon('chevron-up')}</button>
                <button data-move="down" data-id="${item.id}" ${idx === grp.items.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Move down">${icon('chevron-down')}</button>
                <button data-edit="${item.id}" aria-label="Edit">${icon('edit')}</button>
                <button data-delete="${item.id}" aria-label="Delete">${icon('trash')}</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
              )
              .join('')
      }
      <button class="fab" id="add-item-fab" aria-label="Add item">${icon('plus')}</button>
    `;

    container.querySelector('#add-item-fab').addEventListener('click', () =>
      openItemForm({ categories, onSaved: load })
    );
    container.querySelectorAll('[data-add-to]').forEach((btn) =>
      btn.addEventListener('click', () => openItemForm({ categories, presetCategory: btn.dataset.addTo, onSaved: load }))
    );
    container.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () =>
        openItemForm({ existing: items.find((i) => i.id === Number(btn.dataset.edit)), categories, onSaved: load })
      )
    );
    container.querySelectorAll('[data-delete]').forEach((btn) =>
      btn.addEventListener('click', () => confirmDelete(Number(btn.dataset.delete)))
    );
    container.querySelectorAll('[data-move]').forEach((btn) =>
      btn.addEventListener('click', () => move(Number(btn.dataset.id), btn.dataset.move))
    );
  }

  async function move(id, direction) {
    const g = groups();
    const grp = g.find((grp) => grp.items.some((i) => i.id === id));
    if (!grp) return;
    const idx = grp.items.findIndex((i) => i.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= grp.items.length) return;
    [grp.items[idx], grp.items[swapIdx]] = [grp.items[swapIdx], grp.items[idx]];

    const flattened = g.flatMap((grp) => grp.items);
    items = flattened;
    render();

    try {
      await itemsApi.reorder(flattened.map((i) => i.id));
    } catch (e) {
      showToast(`Could not save order: ${e.message}`, 'error');
      await load();
    }
  }

  async function confirmDelete(id) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const sheet = openModal(`
      <h2>Delete item?</h2>
      <p>"${escapeHtml(item.label)}" will be removed from your checklist. Past history for it is kept.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-block" id="cancel-del">Cancel</button>
        <button class="btn btn-danger btn-block" id="confirm-del">Delete</button>
      </div>
    `);
    sheet.querySelector('#cancel-del').addEventListener('click', closeModal);
    sheet.querySelector('#confirm-del').addEventListener('click', async () => {
      try {
        await itemsApi.remove(id);
        closeModal();
        await load();
      } catch (e) {
        showToast(`Could not delete: ${e.message}`, 'error');
      }
    });
  }

  return { mount };
}
