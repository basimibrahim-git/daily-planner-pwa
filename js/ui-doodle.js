const QUICK_COLORS = ['#4A3B5C', '#8B6FB3', '#E86A92', '#D9B26A', '#5FA8D3', '#4CAF8C'];
const LOGICAL_W = 300;
const LOGICAL_H = 140;

const HEX_RADIUS = 6; // rings out from center — 6 gives a 13-wide middle row, like a classic hex color wheel
const HEX_SIZE = 11; // circumradius of each small hex cell, in SVG units

// Builds a hexagon-shaped grid of hexagon cells (axial coordinates), each
// colored by its position: hue sweeps around the center, lightness goes from
// pale in the middle to rich/saturated toward the outer ring — the same
// "pick any color from a honeycomb wheel" idea as a standard hex color picker.
function buildHexCells() {
  const dx = Math.sqrt(3) * HEX_SIZE;
  const dy = 1.5 * HEX_SIZE;
  const cells = [];
  for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q++) {
    const r1 = Math.max(-HEX_RADIUS, -q - HEX_RADIUS);
    const r2 = Math.min(HEX_RADIUS, -q + HEX_RADIUS);
    for (let r = r1; r <= r2; r++) {
      const x = dx * (q + r / 2);
      const y = dy * r;
      cells.push({ x, y });
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
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const polys = cells
    .map(
      (c) =>
        `<polygon class="hex-cell" points="${hexPoints(c.x, c.y, HEX_SIZE - 0.6)}" fill="${c.color}" data-color="${c.color}"><title>${c.color}</title></polygon>`
    )
    .join('');
  return `<svg class="hex-picker-svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" xmlns="http://www.w3.org/2000/svg">${polys}</svg>`;
}

export function doodlePadHtml(key) {
  return `
    <div class="doodle-pad" data-doodle-key="${key}">
      <div class="doodle-pad-label">Doodle</div>
      <canvas class="doodle-canvas" width="${LOGICAL_W}" height="${LOGICAL_H}"></canvas>
      <div class="doodle-toolbar">
        <div class="doodle-colors">
          ${QUICK_COLORS.map(
            (c, i) => `<button type="button" class="doodle-color ${i === 0 ? 'selected' : ''}" data-color="${c}" style="background:${c}" aria-label="Color"></button>`
          ).join('')}
          <button type="button" class="doodle-color-current" aria-label="Choose any color" title="Choose any color">
            <span class="doodle-color-current-dot" style="background:${QUICK_COLORS[0]}"></span>
          </button>
        </div>
        <button type="button" class="doodle-clear">Clear</button>
      </div>
      <div class="doodle-hex-popover hidden"></div>
    </div>
  `;
}

// Wires drawing on a single canvas. Call once per canvas after it's in the DOM.
// onChange(dataUrlOrNull) fires once per completed stroke (pointerup) and once
// on clear — never mid-stroke, so callers don't need to worry about excessive writes.
export function bindDoodlePad(padEl, { initialDataUrl, onChange }) {
  const canvas = padEl.querySelector('.doodle-canvas');
  const ctx = canvas.getContext('2d');
  const currentDot = padEl.querySelector('.doodle-color-current-dot');
  let color = QUICK_COLORS[0];
  let drawing = false;
  let hasStroke = false;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;

  if (initialDataUrl) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, LOGICAL_W, LOGICAL_H);
    img.src = initialDataUrl;
  }

  function setColor(next, presetBtn = null) {
    color = next;
    if (currentDot) currentDot.style.background = next;
    padEl.querySelectorAll('.doodle-color').forEach((b) => b.classList.toggle('selected', b === presetBtn));
  }

  function posFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    hasStroke = false;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer to capture (e.g. synthetic events) — drawing still works without it */
    }
    const { x, y } = posFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const { x, y } = posFromEvent(e);
    ctx.strokeStyle = color;
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStroke = true;
  });

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    if (hasStroke) onChange(canvas.toDataURL('image/png'));
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  padEl.querySelectorAll('.doodle-color').forEach((btn) =>
    btn.addEventListener('click', () => setColor(btn.dataset.color, btn))
  );

  const popover = padEl.querySelector('.doodle-hex-popover');
  const wrap = padEl.closest('.item-note-wrap');

  function outsideClick(e) {
    if (!padEl.contains(e.target)) togglePopover(false);
  }

  function togglePopover(show) {
    if (show && !popover.dataset.built) {
      popover.innerHTML = hexPickerSvg();
      popover.dataset.built = '1';
    }
    popover.classList.toggle('hidden', !show);
    wrap?.classList.toggle('picker-open', show);
    if (show) {
      setTimeout(() => document.addEventListener('click', outsideClick), 0);
    } else {
      document.removeEventListener('click', outsideClick);
    }
  }

  padEl.querySelector('.doodle-color-current').addEventListener('click', () => {
    togglePopover(popover.classList.contains('hidden'));
  });

  popover.addEventListener('click', (e) => {
    const cell = e.target.closest('.hex-cell');
    if (!cell) return;
    setColor(cell.dataset.color);
    togglePopover(false);
  });

  padEl.querySelector('.doodle-clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
    onChange(null);
  });
}
