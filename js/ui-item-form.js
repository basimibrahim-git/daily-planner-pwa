import { items as itemsApi } from './api.js';
import { icon, AVAILABLE_ICONS } from './data.js';
import { escapeHtml } from './utils.js';
import { openModal, closeModal } from './ui-common.js';

// Shared add/edit form for a checklist item, used by both the Manage tab and the
// "+" on a category screen (which pre-fills the category so you don't retype it).
export function openItemForm({ existing = null, categories = [], presetCategory = '', onSaved }) {
  const isEdit = !!existing;
  const type = existing?.type || 'standard';
  const hasCheckbox = existing ? !!existing.has_checkbox : true;
  const hasCounter = existing ? !!existing.has_counter : true;

  const sheet = openModal(`
    <h2>${isEdit ? 'Edit Item' : 'Add Item'}</h2>
    <div class="field">
      <label for="f-category">Category</label>
      <input id="f-category" list="category-options" value="${escapeHtml(existing?.category || presetCategory || '')}" placeholder="e.g. Health & Body" />
      <datalist id="category-options">
        ${categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('')}
      </datalist>
    </div>
    <div class="field">
      <label for="f-label">Label</label>
      <input id="f-label" value="${escapeHtml(existing?.label || '')}" placeholder="e.g. Evening Walk" />
    </div>
    <div class="field">
      <label>Type</label>
      <div class="radio-group" id="type-group">
        <button type="button" class="radio-chip ${type === 'standard' ? 'selected' : ''}" data-type="standard">Checkbox / Counter</button>
        <button type="button" class="radio-chip ${type === 'text' ? 'selected' : ''}" data-type="text">Free text</button>
      </div>
    </div>
    <div class="field" id="controls-fields" style="${type === 'standard' ? '' : 'display:none'}">
      <label>Show on this item</label>
      <div class="radio-group" style="margin-bottom:12px;">
        <button type="button" class="radio-chip ${hasCheckbox ? 'selected' : ''}" id="has-checkbox-toggle">${icon('check')} Checkbox</button>
        <button type="button" class="radio-chip ${hasCounter ? 'selected' : ''}" id="has-counter-toggle">${icon('plus')} Counter</button>
      </div>
      <div id="counter-fields" style="${hasCounter ? '' : 'display:none'}">
        <label for="f-target">Target (optional)</label>
        <input id="f-target" value="${escapeHtml(existing?.target_value || '')}" placeholder="e.g. 3" style="margin-bottom:8px;" />
        <label for="f-unit">Unit (optional)</label>
        <input id="f-unit" value="${escapeHtml(existing?.unit || '')}" placeholder="e.g. L, pages, min" />
      </div>
    </div>
    <div class="field">
      <label>Icon</label>
      <div class="icon-picker" id="icon-picker">
        ${AVAILABLE_ICONS.map(
          (name) => `<button type="button" data-icon="${name}" class="${name === (existing?.icon || 'star') ? 'selected' : ''}">${icon(name)}</button>`
        ).join('')}
      </div>
    </div>
    <div class="field">
      <label>Streak</label>
      <button type="button" class="radio-chip ${existing?.counts_toward_streak ? 'selected' : ''}" id="streak-toggle">
        ${icon('flame')} Counts toward streak
      </button>
    </div>
    <p class="error-text hidden" id="form-error"></p>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-block" id="cancel-form">Cancel</button>
      <button class="btn btn-primary btn-block" id="save-form">${isEdit ? 'Save' : 'Add'}</button>
    </div>
  `);

  let selectedType = type;
  let selectedIcon = existing?.icon || 'star';
  let countsTowardStreak = !!existing?.counts_toward_streak;
  let selectedHasCheckbox = hasCheckbox;
  let selectedHasCounter = hasCounter;

  sheet.querySelector('#streak-toggle').addEventListener('click', (e) => {
    countsTowardStreak = !countsTowardStreak;
    e.currentTarget.classList.toggle('selected', countsTowardStreak);
  });

  sheet.querySelector('#has-checkbox-toggle').addEventListener('click', (e) => {
    selectedHasCheckbox = !selectedHasCheckbox;
    e.currentTarget.classList.toggle('selected', selectedHasCheckbox);
  });

  sheet.querySelector('#has-counter-toggle').addEventListener('click', (e) => {
    selectedHasCounter = !selectedHasCounter;
    e.currentTarget.classList.toggle('selected', selectedHasCounter);
    sheet.querySelector('#counter-fields').style.display = selectedHasCounter ? '' : 'none';
  });

  sheet.querySelectorAll('[data-type]').forEach((btn) =>
    btn.addEventListener('click', () => {
      selectedType = btn.dataset.type;
      sheet.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('selected', b === btn));
      sheet.querySelector('#controls-fields').style.display = selectedType === 'standard' ? '' : 'none';
    })
  );

  sheet.querySelectorAll('[data-icon]').forEach((btn) =>
    btn.addEventListener('click', () => {
      selectedIcon = btn.dataset.icon;
      sheet.querySelectorAll('[data-icon]').forEach((b) => b.classList.toggle('selected', b === btn));
    })
  );

  sheet.querySelector('#cancel-form').addEventListener('click', closeModal);
  sheet.querySelector('#save-form').addEventListener('click', async () => {
    const category = sheet.querySelector('#f-category').value.trim();
    const label = sheet.querySelector('#f-label').value.trim();
    const errorEl = sheet.querySelector('#form-error');
    errorEl.classList.add('hidden');

    if (!category || !label) {
      errorEl.textContent = 'Category and label are required.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (selectedType === 'standard' && !selectedHasCheckbox && !selectedHasCounter) {
      errorEl.textContent = 'Turn on at least one of Checkbox or Counter.';
      errorEl.classList.remove('hidden');
      return;
    }

    const payload = {
      category,
      label,
      icon: selectedIcon,
      type: selectedType,
      has_checkbox: selectedType === 'standard' ? selectedHasCheckbox : false,
      has_counter: selectedType === 'standard' ? selectedHasCounter : false,
      target_value: selectedType === 'standard' && selectedHasCounter ? sheet.querySelector('#f-target').value.trim() || null : null,
      unit: selectedType === 'standard' && selectedHasCounter ? sheet.querySelector('#f-unit').value.trim() || null : null,
      counts_toward_streak: countsTowardStreak,
    };

    try {
      if (isEdit) {
        await itemsApi.update(existing.id, payload);
      } else {
        await itemsApi.create(payload);
      }
      closeModal();
      await onSaved?.();
    } catch (e) {
      errorEl.textContent = e.message || 'Could not save item.';
      errorEl.classList.remove('hidden');
    }
  });
}
