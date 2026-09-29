export const QUICK_COLORS = ['#4A3B5C', '#8B6FB3', '#E86A92', '#D9B26A', '#5FA8D3', '#4CAF8C'];

const HEX_RADIUS = 6; // rings out from center — 6 gives a 13-wide middle row, like a classic hex color wheel
const HEX_SIZE = 11; // circumradius of each small hex cell, in SVG units

// Builds a hexagon-shaped grid of hexagon cells (axial coordinates), each
// colored by its position: hue sweeps around the center, lightness goes from
// pale in the middle to rich/saturated toward the outer ring.
function buildHexCells() {
  const dx = Math.sqrt(3) * HEX_SIZE;
  const dy = 1.5 * HEX_SIZE;
  const cells = [];
  for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q++) {
    const r1 = Math.max(-HEX_RADIUS, -q - HEX_RADIUS);
    const r2 = Math.min(HEX_RADIUS, -q + HEX_RADIUS);
    for (let r = r1; r <= r2; r++) {
      cells.push({ x: dx * (q + r / 2), y: dy * r });
    }
  }
  const maxDist = Math.max(...cells.map((c) => Math.hypot(c.x, c.y)));
  for (const c of cells) {
    const dist = maxDist ? Math.hypot(c.x, c.y) / maxDist : 0;
    const hue = ((Math.atan2(c.y, c.x) * 180) / Math.PI + 360) % 360;
    const lightness = Math.round(90 - dist * 52);
    c.color = `hsl(${hue.toFixed(0)}, 82%, ${lightness}%)`;
  }
  return cells;
}

function hexPoints(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function hexPickerSvg() {
  const cells = buildHexCells();
  const pad = HEX_SIZE + 1;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) + pad - minX;
  const h = Math.max(...ys) + pad - minY;
  const polys = cells
    .map((c) => `<polygon class="hex-cell" points="${hexPoints(c.x, c.y, HEX_SIZE - 0.6)}" fill="${c.color}" data-color="${c.color}"></polygon>`)
    .join('');
  return `<svg class="hex-picker-svg" viewBox="${minX} ${minY} ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${polys}</svg>`;
}

// Same rule as api/lib.php isValidColor(): colors end up in style attributes.
export function isValidColor(color) {
  return /^(#[0-9a-fA-F]{6}|hsl\(\d{1,3}, ?\d{1,3}%, ?\d{1,3}%\))$/.test(color || '');
}

export function colorPickerHtml(initial = QUICK_COLORS[0]) {
  return `
    <div class="color-picker">
      <div class="cp-row">
        ${QUICK_COLORS.map(
          (c) => `<button type="button" class="cp-swatch ${c === initial ? 'selected' : ''}" data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`
        ).join('')}
        <button type="button" class="cp-current" aria-label="Choose any color" title="Choose any color">
          <span class="cp-current-dot" style="background:${initial}"></span>
        </button>
      </div>
      <div class="cp-popover hidden"></div>
    </div>
  `;
}

// Updates what the picker shows without firing onChange.
export function setPickerColor(pickerEl, color) {
  pickerEl.querySelector('.cp-current-dot').style.background = color;
  pickerEl.querySelectorAll('.cp-swatch').forEach((b) => b.classList.toggle('selected', b.dataset.color === color));
}

export function bindColorPicker(pickerEl, { initial = QUICK_COLORS[0], onChange }) {
  const dot = pickerEl.querySelector('.cp-current-dot');
  const popover = pickerEl.querySelector('.cp-popover');

  function setColor(next) {
    dot.style.background = next;
    pickerEl.querySelectorAll('.cp-swatch').forEach((b) => b.classList.toggle('selected', b.dataset.color === next));
    onChange(next);
  }

  function outsideClick(e) {
    if (!pickerEl.contains(e.target)) togglePopover(false);
  }

  function togglePopover(show) {
    if (show && !popover.dataset.built) {
      popover.innerHTML = hexPickerSvg();
      popover.dataset.built = '1';
    }
    popover.classList.toggle('hidden', !show);
    if (show) setTimeout(() => document.addEventListener('click', outsideClick), 0);
    else document.removeEventListener('click', outsideClick);
  }

  pickerEl.querySelectorAll('.cp-swatch').forEach((btn) => btn.addEventListener('click', () => setColor(btn.dataset.color)));
  pickerEl.querySelector('.cp-current').addEventListener('click', () => togglePopover(popover.classList.contains('hidden')));
  popover.addEventListener('click', (e) => {
    const cell = e.target.closest('.hex-cell');
    if (!cell) return;
    setColor(cell.dataset.color);
    togglePopover(false);
  });

  dot.style.background = initial;
}
