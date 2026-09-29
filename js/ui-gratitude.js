import { fetchGratitude, addGratitude, randomGratitude, deleteGratitude, photoUrl } from './api.js';
import { cacheGet } from './db-local.js';
import { icon } from './data.js';
import { escapeHtml } from './utils.js';
import { showToast, openModal, closeModal } from './ui-common.js';
import { colorPickerHtml, bindColorPicker, isValidColor } from './ui-color-picker.js';

const PALETTE = ['#F0729A', '#E8B84B', '#6FB3E0', '#5FC9A8', '#A98FD9', '#F0956B', '#F0D45A', '#C7568C'];
const MAX_VISUAL_PAPERS = 26; // the jar is visually "full" around this many notes

// Deterministic pseudo-random generator so a given paper's jitter/rotation stays
// stable across re-renders instead of reshuffling every time you add a new one.
function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function paperGlyph(index) {
  const rand = seededRandom(index * 97 + 13);
  const color = PALETTE[index % PALETTE.length];
  const jarLeft = 88;
  const jarRight = 212;
  const jarBottom = 352;
  const jarTop = 130;
  const bandHeight = (jarBottom - jarTop) * 0.86;

  // Normalized against the jar's total CAPACITY (not the current count), so a
  // handful of notes sit low and it genuinely climbs toward the top as you add
  // more — rather than always spanning the full height regardless of count.
  const capped = Math.min(index, MAX_VISUAL_PAPERS - 1);
  const stackPos = capped / (MAX_VISUAL_PAPERS - 1);

  const jitterX = (rand() - 0.5) * (jarRight - jarLeft) * 0.5;
  const jitterY = (rand() - 0.5) * 8;
  const x = (jarLeft + jarRight) / 2 + jitterX;
  const y = jarBottom - 26 - stackPos * bandHeight + jitterY;
  const rot = (rand() - 0.5) * 40;
  const w = 40;
  const h = 26;
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rot.toFixed(1)})">
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="${color}" stroke="rgba(74,59,92,0.3)" stroke-width="1.2"/>
    <path d="M ${-w / 2} ${-h / 2} L ${-w / 2 + 10} 0 L ${-w / 2} ${h / 2} Z" fill="rgba(255,255,255,0.4)"/>
  </g>`;
}

function sparkleAccents(count) {
  if (count < 10) return '';
  const spots = [
    [252, 90, 0.9],
    [40, 150, 1.3],
    [262, 230, 1.0],
    [30, 260, 0.85],
  ];
  return spots
    .map(
      ([x, y, s], i) => `
      <g class="jar-sparkle" style="animation-delay:${i * 0.6}s" transform="translate(${x},${y}) scale(${s})">
        <path d="M0,-9 C0.6,-3 3,-0.6 9,0 C3,0.6 0.6,3 0,9 C-0.6,3 -3,0.6 -9,0 C-3,-0.6 -0.6,-3 0,-9Z" fill="#D9B26A" opacity="0.85"/>
      </g>`
    )
    .join('');
}

function jarSvg(count) {
  const visualTotal = Math.min(count, MAX_VISUAL_PAPERS);
  const papers = Array.from({ length: visualTotal }, (_, i) => paperGlyph(i)).join('');
  const jarPath =
    'M115,55 C115,55 103,72 97,98 C80,114 62,146 62,188 L62,322 C62,352 84,372 116,372 L184,372 C216,372 238,352 238,322 L238,188 C238,146 220,114 203,98 C197,72 185,55 185,55 Z';

  return `
    <svg class="jar-svg" viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="glassGrad" cx="35%" cy="25%" r="80%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
          <stop offset="55%" stop-color="#FBF8FF" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#E6DCF3" stop-opacity="0.5"/>
        </radialGradient>
        <linearGradient id="lidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFFDF9"/>
          <stop offset="100%" stop-color="#F1E7D8"/>
        </linearGradient>
        <clipPath id="jarClip"><path d="${jarPath}"/></clipPath>
      </defs>

      <ellipse cx="150" cy="382" rx="72" ry="10" fill="rgba(139,111,179,0.18)"/>

      ${sparkleAccents(count)}

      <path d="${jarPath}" fill="url(#glassGrad)" stroke="rgba(139,111,179,0.45)" stroke-width="3"/>
      <g clip-path="url(#jarClip)">${papers}</g>
      <path d="${jarPath}" fill="none" stroke="rgba(139,111,179,0.45)" stroke-width="3"/>
      <path d="M95,110 C85,150 82,220 82,290" fill="none" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="9" stroke-linecap="round"/>
      <path d="M205,130 C213,160 216,210 214,260" fill="none" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round"/>

      <rect x="93" y="14" width="114" height="16" rx="7" fill="url(#lidGrad)" stroke="rgba(139,111,179,0.4)" stroke-width="2"/>
      <rect x="95" y="26" width="110" height="32" rx="11" fill="url(#lidGrad)" stroke="rgba(139,111,179,0.4)" stroke-width="2.5"/>
      <line x1="95" y1="38" x2="205" y2="38" stroke="rgba(139,111,179,0.25)" stroke-width="2"/>
      <line x1="95" y1="48" x2="205" y2="48" stroke="rgba(139,111,179,0.25)" stroke-width="2"/>
    </svg>
  `;
}

// A small stylized hand+sleeve, reused for both dropping a note in and picking
// one out. Deliberately simple/flat (matches the app's icon style) rather than
// anatomically detailed.
function handSvg() {
  return `
    <svg class="hand-svg" viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="0" width="40" height="34" rx="15" fill="#F3C6D6" stroke="rgba(155,58,85,0.25)" stroke-width="1.5"/>
      <rect x="34" y="24" width="32" height="6" rx="3" fill="#D9B26A" opacity="0.8"/>
      <path d="M35,26 C24,26 19,42 22,58 C14,69 11,86 18,102 C23,114 32,120 41,121 L59,121 C68,120 77,114 82,102 C89,86 86,69 78,58 C81,42 76,26 65,26 Z"
            fill="#F0D9C4" stroke="rgba(120,90,70,0.35)" stroke-width="1.5"/>
      <path d="M19,54 C9,55 4,69 9,82 C12,90 20,93 26,88 C22,78 22,66 27,59 Z"
            fill="#F0D9C4" stroke="rgba(120,90,70,0.35)" stroke-width="1.5"/>
      <path d="M38,104 L37,118 M50,107 L50,120 M62,104 L63,118" stroke="rgba(120,90,70,0.3)" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;
}

function buildHandActor(paperColor) {
  const el = document.createElement('div');
  el.className = 'hand-actor';
  el.innerHTML = `${handSvg()}<div class="hand-paper" style="background:${paperColor}"></div>`;
  document.body.appendChild(el);
  return el;
}

// Hand dips down from the input, folds the note twice, carries it to the jar
// mouth, tips it in, then withdraws. Resolves once the jar should update.
function playAddAnimation(originRect, jarRect, paperColor) {
  return new Promise((resolve) => {
    const actor = buildHandActor(paperColor);
    const startX = originRect.left + originRect.width / 2 - 35;
    const startY = originRect.top + originRect.height / 2 - 70;
    actor.style.left = `${startX}px`;
    actor.style.top = `${startY}px`;

    const targetX = jarRect.left + jarRect.width / 2 - 35;
    const targetY = jarRect.top + jarRect.height * 0.18 - 70;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const duration = 1900;

    const actorAnim = actor.animate(
      [
        { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1, offset: 0 },
        { transform: 'translate(2px,-8px) rotate(-4deg) scale(1)', opacity: 1, offset: 0.28 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) rotate(4deg) scale(0.92)`, opacity: 1, offset: 0.62 },
        { transform: `translate(${dx}px, ${dy}px) rotate(28deg) scale(0.85)`, opacity: 1, offset: 0.82 },
        { transform: `translate(${dx * 1.05}px, ${dy - 45}px) rotate(12deg) scale(0.8)`, opacity: 0, offset: 1 },
      ],
      { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
    );

    const paperEl = actor.querySelector('.hand-paper');
    paperEl.animate(
      [
        { transform: 'scaleX(1) scaleY(1)', opacity: 1, offset: 0 },
        { transform: 'scaleX(0.55) scaleY(0.9)', opacity: 1, offset: 0.28 },
        { transform: 'scaleX(0.28) scaleY(0.75)', opacity: 1, offset: 0.5 },
        { transform: 'scaleX(0.28) scaleY(0.75)', opacity: 1, offset: 0.8 },
        { transform: 'scaleX(0.28) scaleY(0.75)', opacity: 0, offset: 0.86 },
      ],
      { duration, easing: 'ease-in-out', fill: 'forwards' }
    );

    setTimeout(resolve, duration * 0.82);
    actorAnim.onfinish = () => actor.remove();
  });
}

// Hand reaches down into the jar, grabs a note, and pulls it out and up while
// it unfolds. Resolves once the reveal card should appear.
function playPickAnimation(jarRect) {
  return new Promise((resolve) => {
    const actor = buildHandActor(PALETTE[0]);
    const startX = jarRect.left + jarRect.width / 2 - 35;
    const startY = jarRect.top + jarRect.height * 0.1 - 70;
    actor.style.left = `${startX}px`;
    actor.style.top = `${startY}px`;

    const duration = 1500;
    const actorAnim = actor.animate(
      [
        { transform: 'translate(0,-70px) rotate(-10deg) scale(0.85)', opacity: 0, offset: 0 },
        { transform: 'translate(0,-6px) rotate(-4deg) scale(0.92)', opacity: 1, offset: 0.32 },
        { transform: 'translate(0,14px) rotate(0deg) scale(0.98)', opacity: 1, offset: 0.48 },
        { transform: 'translate(0,10px) rotate(0deg) scale(1.06)', opacity: 1, offset: 0.54 },
        { transform: 'translate(0,-45px) rotate(8deg) scale(0.95)', opacity: 1, offset: 0.8 },
        { transform: 'translate(0,-95px) rotate(12deg) scale(0.85)', opacity: 0, offset: 1 },
      ],
      { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
    );

    const paperEl = actor.querySelector('.hand-paper');
    paperEl.animate(
      [
        { transform: 'scale(0)', opacity: 0, offset: 0 },
        { transform: 'scale(0)', opacity: 0, offset: 0.5 },
        { transform: 'scale(0.35)', opacity: 1, offset: 0.56 },
        { transform: 'scale(0.75)', opacity: 1, offset: 0.8 },
        { transform: 'scale(1)', opacity: 1, offset: 1 },
      ],
      { duration, easing: 'ease-out', fill: 'forwards' }
    );

    setTimeout(resolve, duration * 0.86);
    actorAnim.onfinish = () => actor.remove();
  });
}


const FONTS = [
  { key: 'caveat', label: 'Handwritten', family: "'Caveat', cursive", scale: 1.25 },
  { key: 'patrick', label: 'Marker', family: "'Patrick Hand', cursive", scale: 1.1 },
  { key: 'dancing', label: 'Script', family: "'Dancing Script', cursive", scale: 1.2 },
  { key: 'quicksand', label: 'Rounded', family: "'Quicksand', sans-serif", scale: 1 },
  { key: 'typewriter', label: 'Typewriter', family: "'Special Elite', monospace", scale: 0.95 },
  { key: 'playfair', label: 'Classic', family: "'Playfair Display', serif", scale: 1 },
];
const SIZES = [
  { key: 's', label: 'S', px: 15 },
  { key: 'm', label: 'M', px: 19 },
  { key: 'l', label: 'L', px: 24 },
  { key: 'xl', label: 'XL', px: 30 },
];
const DEFAULT_STYLE = { font: 'caveat', size: 'm', color: '#4A3B5C', bold: 0, italic: 0 };
const STYLE_STORAGE_KEY = 'planner:gratitude-style';
const MAX_PHOTOS = 3;
const MAX_PHOTO_DIM = 1600;

function styleCss(style) {
  const s = { ...DEFAULT_STYLE, ...(style || {}) };
  const font = FONTS.find((f) => f.key === s.font) || FONTS[0];
  const size = SIZES.find((z) => z.key === s.size) || SIZES[1];
  const color = isValidColor(s.color) ? s.color : DEFAULT_STYLE.color;
  return [
    `font-family:${font.family}`,
    `font-size:${Math.round(size.px * font.scale)}px`,
    `color:${color}`,
    `font-weight:${s.bold ? 700 : 500}`,
    `font-style:${s.italic ? 'italic' : 'normal'}`,
  ].join(';');
}

function loadLastStyle() {
  try {
    const saved = JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY) || 'null');
    return saved ? { ...DEFAULT_STYLE, ...saved } : { ...DEFAULT_STYLE };
  } catch {
    return { ...DEFAULT_STYLE };
  }
}

function saveLastStyle(style) {
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style));
  } catch {
    /* just a convenience; fine to lose */
  }
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable image'));
    };
    img.src = url;
  });
}

// Shrinks a phone photo to at most MAX_PHOTO_DIM on its longest side and
// re-encodes it as JPEG, so uploads stay a few hundred KB instead of several MB.
async function compressImage(file) {
  let source;
  try {
    source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    source = await loadImageElement(file);
  }
  const w = source.width;
  const h = source.height;
  const scale = Math.min(1, MAX_PHOTO_DIM / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('could not encode image');
  return blob;
}

function openLightbox(src) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<img src="${escapeHtml(src)}" alt="Gratitude photo" /><button class="lightbox-close" aria-label="Close">${icon('x')}</button>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
}

export function createGratitudeView() {
  let container = null;
  let entries = [];
  let count = 0;
  let style = loadLastStyle();
  let pendingPhotos = []; // [{ blob, url }]

  async function mount(root) {
    container = root;
    container.innerHTML = `<div class="empty-state">Loading…</div>`;
    await load();
  }

  async function load() {
    try {
      const res = await fetchGratitude();
      entries = res.entries || [];
      count = res.count ?? entries.length;
      if (res.offline) showToast("You're offline — showing your last saved jar.", 'offline');
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Couldn't load your jar.<br>${escapeHtml(e.message)}</div>`;
      return;
    }
    render();
  }

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Gratitude Jar</h1>
          <div class="date-sub">Little notes worth keeping</div>
        </div>
      </div>

      <div class="jar-wrap" id="jar-wrap">${jarSvg(count)}</div>
      <div class="gratitude-count">${count} thing${count === 1 ? '' : 's'} you're grateful for</div>

      <div class="gratitude-compose">
        <div class="gratitude-input-row">
          <textarea id="gratitude-input" rows="1" placeholder="I'm grateful for..." maxlength="500" style="${styleCss(style)}"></textarea>
          <button class="gratitude-add-btn" id="gratitude-add" aria-label="Add to jar">${icon('plus')}</button>
        </div>
        <div class="photo-previews" id="photo-previews"></div>
        <div class="compose-tools">
          <button type="button" class="tool-btn" id="toggle-style" aria-expanded="false"><span class="tool-aa">Aa</span> Style</button>
          <button type="button" class="tool-btn" id="add-photo">${icon('image')} Photo <span class="tool-count" id="photo-count"></span></button>
          <input type="file" id="photo-input" accept="image/*" multiple hidden />
        </div>
        <div class="style-panel hidden" id="style-panel">
          <div class="style-label">Font</div>
          <div class="font-chips">
            ${FONTS.map(
              (f) => `<button type="button" class="font-chip ${f.key === style.font ? 'selected' : ''}" data-font="${f.key}" style="font-family:${f.family}">${f.label}</button>`
            ).join('')}
          </div>
          <div class="style-label">Size &amp; emphasis</div>
          <div class="radio-group">
            ${SIZES.map(
              (z) => `<button type="button" class="radio-chip ${z.key === style.size ? 'selected' : ''}" data-size="${z.key}">${z.label}</button>`
            ).join('')}
            <span class="chip-divider"></span>
            <button type="button" class="radio-chip ${style.bold ? 'selected' : ''}" data-toggle="bold" aria-label="Bold"><b>B</b></button>
            <button type="button" class="radio-chip ${style.italic ? 'selected' : ''}" data-toggle="italic" aria-label="Italic"><i>I</i></button>
          </div>
          <div class="style-label">Color</div>
          ${colorPickerHtml(style.color)}
        </div>
      </div>

      <button class="btn btn-ghost btn-block" id="gratitude-random">${icon('shuffle')} Pick one from the jar</button>
    `;

    const input = container.querySelector('#gratitude-input');
    const addBtn = container.querySelector('#gratitude-add');

    const submit = () => addFlow(input, addBtn);
    addBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });
    input.addEventListener('input', () => autoGrow(input));

    bindStylePanel(input);
    bindPhotoPicker();
    renderPhotoPreviews();

    container.querySelector('#gratitude-random').addEventListener('click', randomFlow);
  }

  function autoGrow(input) {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 3, 180)}px`;
  }

  function bindStylePanel(input) {
    const panel = container.querySelector('#style-panel');
    const toggle = container.querySelector('#toggle-style');
    toggle.addEventListener('click', () => {
      const open = panel.classList.toggle('hidden') === false;
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    });

    const apply = () => {
      input.setAttribute('style', styleCss(style));
      autoGrow(input);
      saveLastStyle(style);
    };

    panel.querySelectorAll('[data-font]').forEach((btn) =>
      btn.addEventListener('click', () => {
        style = { ...style, font: btn.dataset.font };
        panel.querySelectorAll('[data-font]').forEach((b) => b.classList.toggle('selected', b === btn));
        apply();
      })
    );
    panel.querySelectorAll('[data-size]').forEach((btn) =>
      btn.addEventListener('click', () => {
        style = { ...style, size: btn.dataset.size };
        panel.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('selected', b === btn));
        apply();
      })
    );
    panel.querySelectorAll('[data-toggle]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const key = btn.dataset.toggle;
        style = { ...style, [key]: style[key] ? 0 : 1 };
        btn.classList.toggle('selected', !!style[key]);
        apply();
      })
    );
    bindColorPicker(panel.querySelector('.color-picker'), {
      initial: style.color,
      onChange: (color) => {
        style = { ...style, color };
        apply();
      },
    });
  }

  function bindPhotoPicker() {
    const fileInput = container.querySelector('#photo-input');
    container.querySelector('#add-photo').addEventListener('click', () => {
      if (pendingPhotos.length >= MAX_PHOTOS) {
        showToast(`Up to ${MAX_PHOTOS} photos per note.`);
        return;
      }
      fileInput.click();
    });
    fileInput.addEventListener('change', async () => {
      const files = [...fileInput.files];
      fileInput.value = '';
      const room = MAX_PHOTOS - pendingPhotos.length;
      if (files.length > room) showToast(`Only ${MAX_PHOTOS} photos per note — added the first ${room}.`);
      for (const file of files.slice(0, room)) {
        try {
          const blob = await compressImage(file);
          pendingPhotos.push({ blob, url: URL.createObjectURL(blob) });
        } catch {
          showToast("Couldn't read that photo — try a JPEG or PNG.", 'error');
        }
      }
      renderPhotoPreviews();
    });
  }

  function renderPhotoPreviews() {
    const wrap = container.querySelector('#photo-previews');
    const countEl = container.querySelector('#photo-count');
    if (!wrap) return;
    wrap.innerHTML = pendingPhotos
      .map(
        (p, i) => `
        <div class="photo-thumb">
          <img src="${p.url}" alt="Attached photo ${i + 1}" />
          <button type="button" class="photo-remove" data-remove="${i}" aria-label="Remove photo">${icon('x')}</button>
        </div>`
      )
      .join('');
    countEl.textContent = pendingPhotos.length ? `${pendingPhotos.length}/${MAX_PHOTOS}` : '';
    wrap.querySelectorAll('[data-remove]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const [removed] = pendingPhotos.splice(Number(btn.dataset.remove), 1);
        URL.revokeObjectURL(removed.url);
        renderPhotoPreviews();
      })
    );
  }

  async function addFlow(input, addBtn) {
    const text = input.value.trim();
    if (!text && pendingPhotos.length === 0) return;
    addBtn.disabled = true;

    const photos = pendingPhotos;
    const noteStyle = { ...style };
    const jarWrap = container.querySelector('#jar-wrap');
    const animPromise = jarWrap
      ? playAddAnimation(addBtn.getBoundingClientRect(), jarWrap.getBoundingClientRect(), PALETTE[count % PALETTE.length])
      : Promise.resolve();
    input.value = '';
    autoGrow(input);
    pendingPhotos = [];
    renderPhotoPreviews();

    const [, res] = await Promise.all([
      animPromise,
      addGratitude(text, noteStyle, photos.map((p) => p.blob)).catch((e) => {
        showToast(`Could not save: ${e.message}`, 'error');
        return null;
      }),
    ]);

    if (res) {
      count = res.count;
      entries = [
        { id: res.id ?? `pending-${Date.now()}`, text, style: noteStyle, photos: [], created_at: new Date().toISOString() },
        ...entries,
      ];
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      if (res.offline) showToast("You're offline — saved on this device, will sync later.", 'offline');
      updateJarDisplay();
    } else {
      // Put the note back so nothing typed or attached is lost.
      input.value = text;
      autoGrow(input);
      pendingPhotos = photos;
      renderPhotoPreviews();
    }
    addBtn.disabled = false;
  }

  function updateJarDisplay() {
    const jarWrap = container.querySelector('#jar-wrap');
    if (jarWrap) {
      jarWrap.innerHTML = jarSvg(count);
      jarWrap.classList.remove('bounce');
      void jarWrap.offsetWidth; // restart animation
      jarWrap.classList.add('bounce');
    }
    const countEl = container.querySelector('.gratitude-count');
    if (countEl) countEl.textContent = `${count} thing${count === 1 ? '' : 's'} you're grateful for`;
  }

  async function randomFlow() {
    if (count === 0) {
      showToast('Add a few things to your jar first.');
      return;
    }

    const jarWrap = container.querySelector('#jar-wrap');
    const animPromise = jarWrap ? playPickAnimation(jarWrap.getBoundingClientRect()) : Promise.resolve();

    let entry = null;
    try {
      const res = await randomGratitude();
      entry = res.entry;
    } catch (e) {
      const cached = await cacheGet('gratitude:list');
      if (cached && cached.entries && cached.entries.length) {
        entry = cached.entries[Math.floor(Math.random() * cached.entries.length)];
        showToast("You're offline — picked from your last saved jar.", 'offline');
      } else {
        showToast(`Could not pick from the jar: ${e.message}`, 'error');
        return;
      }
    }

    await animPromise;

    if (!entry) {
      showToast('Your jar is empty.');
      return;
    }

    showReveal(entry);
  }

  function showReveal(entry) {
    const photos = entry.photos || [];
    const sheet = openModal(`
      <div class="gratitude-reveal">
        <div class="fold-icon">${icon('jar')}</div>
        ${entry.text ? `<div class="reveal-text" style="${styleCss(entry.style)}">${escapeHtml(entry.text)}</div>` : ''}
        ${
          photos.length
            ? `<div class="reveal-photos count-${photos.length}">
                ${photos.map((id) => `<button type="button" class="reveal-photo" data-photo="${id}"><img src="${photoUrl(id)}" alt="Gratitude photo" loading="lazy" /></button>`).join('')}
              </div>`
            : ''
        }
        <div class="reveal-date">${entry.created_at ? new Date(entry.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-block" id="close-reveal">Close</button>
          <button class="btn btn-primary btn-block" id="another-reveal">${icon('shuffle')} Pick Another</button>
        </div>
        <button class="reveal-delete-link" id="delete-reveal">${icon('trash')} Delete this one</button>
      </div>
    `);
    sheet.querySelectorAll('[data-photo]').forEach((btn) =>
      btn.addEventListener('click', () => openLightbox(photoUrl(btn.dataset.photo)))
    );
    sheet.querySelector('#close-reveal').addEventListener('click', closeModal);
    sheet.querySelector('#another-reveal').addEventListener('click', async () => {
      closeModal();
      await randomFlow();
    });
    sheet.querySelector('#delete-reveal').addEventListener('click', () => showDeleteConfirm(entry, sheet));
  }

  function showDeleteConfirm(entry, sheet) {
    const what = entry.text ? `"${escapeHtml(entry.text)}"` : 'This note';
    const photoNote = entry.photos?.length ? ' along with its photos' : '';
    sheet.innerHTML = `
      <h2>Delete this one?</h2>
      <p>${what} will be removed from your jar${photoNote} for good.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-block" id="cancel-delete">Cancel</button>
        <button class="btn btn-danger btn-block" id="confirm-delete">${icon('trash')} Delete</button>
      </div>
    `;
    sheet.querySelector('#cancel-delete').addEventListener('click', () => showReveal(entry));
    sheet.querySelector('#confirm-delete').addEventListener('click', async () => {
      try {
        const res = await deleteGratitude(entry.id);
        count = res.count;
        entries = entries.filter((e) => e.id !== entry.id);
        updateJarDisplay();
        closeModal();
        showToast('Removed from your jar.');
      } catch (e) {
        showToast(`Could not delete: ${e.message}`, 'error');
      }
    });
  }

  return { mount };
}
