// Inline line-icon set (24x24 viewBox, stroke-based so CSS can recolor via currentColor).
export const ICONS = {
  moon: '<path d="M17.5 13.5A7.5 7.5 0 0 1 10.5 6a7.5 7.5 0 1 0 7 7.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8"/>',
  sunset: '<path d="M4 15.5h16M6.5 15.5a5.5 5.5 0 0 1 11 0"/><path d="M12 4.5v4M8 6l1.6 1.6M16 6l-1.6 1.6"/><path d="M2.5 19h19"/>',
  star: '<path d="M12 3.5l2.4 5 5.5.6-4 3.8 1 5.4L12 15.8l-4.9 2.5 1-5.4-4-3.8 5.5-.6Z"/>',
  book: '<path d="M4 5.2c2-1 5-1 7 0v13.6c-2-1-5-1-7 0Z"/><path d="M20 5.2c-2-1-5-1-7 0v13.6c2-1 5-1 7 0Z"/>',
  'book-open': '<path d="M12 6.5c-1.6-1.3-4.3-1.8-7-1.5v12c2.7-.3 5.4.2 7 1.5 1.6-1.3 4.3-1.8 7-1.5v-12c-2.7-.3-5.4.2-7 1.5Z"/><path d="M12 6.5v12"/>',
  heart: '<path d="M12 19.5s-7.5-4.5-9.3-9A5 5 0 0 1 12 7a5 5 0 0 1 9.3 3.5C19.5 15 12 19.5 12 19.5Z"/>',
  droplet: '<path d="M12 3.5s6 6.6 6 10.8A6 6 0 1 1 6 14.3C6 10.1 12 3.5 12 3.5Z"/>',
  dumbbell: '<path d="M6 9v6M4.5 10.5v3M18 9v6M19.5 10.5v3M6 12h12"/>',
  shoe: '<path d="M3.5 17.5v-4.2c0-.9.6-1.6 1.4-1.9l6-2c.6-.2 1.2 0 1.6.5l1.3 1.6c.9 1 2.2 1.6 3.6 1.6h2.1c.6 0 1 .5 1 1v3.4c0 .6-.4 1-1 1Z"/><path d="M3.5 17.5h17"/>',
  sparkle: '<path d="M12 3.5c.4 3 1.7 4.3 4.7 4.7-3 .4-4.3 1.7-4.7 4.7-.4-3-1.7-4.3-4.7-4.7 3-.4 4.3-1.7 4.7-4.7Z"/><path d="M18.5 14.5c.2 1.5.9 2.2 2.4 2.4-1.5.2-2.2.9-2.4 2.4-.2-1.5-.9-2.2-2.4-2.4 1.5-.2 2.2-.9 2.4-2.4Z"/>',
  'no-food': '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  bulb: '<path d="M9 18.5h6M10 21h4M8 14.5A5.5 5.5 0 1 1 16 14.5c-.9.9-1.4 1.7-1.4 2.5H9.4c0-.8-.5-1.6-1.4-2.5Z"/>',
  basket: '<path d="M4.5 10h15l-1.4 8.4a1.5 1.5 0 0 1-1.5 1.3H7.4a1.5 1.5 0 0 1-1.5-1.3Z"/><path d="M8 10a4 4 0 0 1 8 0M4 10h16"/>',
  chat: '<path d="M4 5.5h16v10.5H9.5L6 19.5V16H4Z"/>',
  check: '<polyline points="5,13 10,18 19,7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8 3.5v3M16 3.5v3"/>',
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/>',
  list: '<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9 7h11M9 12h11M9 17h11"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/>',
  logout: '<path d="M10 19.5H5.5v-15H10"/><path d="M20 12H10M17 8.5 20.5 12 17 15.5"/>',
  flame: '<path d="M12 3.5c1 3 4.5 4.6 4.5 8.7a4.5 4.5 0 1 1-9 0c0-1.4.6-2.3 1.3-3.2-.1 1 .2 1.8 1 2.2-.4-2.6.6-4.6 2.2-7.7Z"/>',
  edit: '<path d="M4 20l.9-3.6L15.6 5.7a1.7 1.7 0 0 1 2.4 0l1.3 1.3a1.7 1.7 0 0 1 0 2.4L8.6 20.1 4 20Z"/>',
  trash: '<path d="M5 7h14M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M7.5 7l.7 12.2A1.5 1.5 0 0 0 9.7 20.5h4.6a1.5 1.5 0 0 0 1.5-1.3L16.5 7"/>',
  x: '<path d="M5 5l14 14M19 5 5 19"/>',
  'wifi-off': '<path d="M3 8.5c2.5-2 5.7-3.2 9-3.2 1.5 0 3 .2 4.3.7M20.9 11.7A13 13 0 0 0 17 9.6M6 12.4a9 9 0 0 1 4-2.1M8.6 15.4a5 5 0 0 1 6.7-.1"/><circle cx="12" cy="19" r="1"/><path d="M2.5 3l19 19"/>',
  download: '<path d="M12 3.5v11.5M7.5 11l4.5 4.5L16.5 11"/><path d="M5 19.5h14"/>',
  'chevron-left': '<polyline points="14.5,5 8,12 14.5,19"/>',
  'chevron-right': '<polyline points="9.5,5 16,12 9.5,19"/>',
  'chevron-up': '<polyline points="5,14.5 12,8 19,14.5"/>',
  'chevron-down': '<polyline points="5,9.5 12,16 19,9.5"/>',
  chart: '<path d="M4 20V10M12 20V4M20 20v-7"/><path d="M2.5 20h19"/>',
  jar: '<path d="M8 3.5h8v2.8c1.4.3 2 1 2 2.4v10.3a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8.7c0-1.4.6-2.1 2-2.4Z"/><path d="M6 11.5h12"/>',
  shuffle: '<path d="M3 7h3.5L14 17h3.5M14 7h3.5L20 9.5M17.5 4.5 20 7l-2.5 2.5M3 17h3.5L10 12M17.5 19.5 20 17l-2.5-2.5"/>',
  bookmark: '<path d="M6 4h12v16l-6-4-6 4Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
};

export function icon(name, cls = 'icon') {
  const inner = ICONS[name] || ICONS.star;
  return `<svg class="${cls}" viewBox="0 0 24 24">${inner}</svg>`;
}

export const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: 'home' },
  { id: 'history', label: 'History', icon: 'calendar' },
  { id: 'dashboard', label: 'Dashboard', icon: 'chart' },
  { id: 'gratitude', label: 'Gratitude', icon: 'jar' },
  { id: 'manage', label: 'Manage', icon: 'list' },
];

export const AVAILABLE_ICONS = [
  'moon', 'sun', 'sunset', 'star', 'book', 'book-open', 'heart', 'droplet',
  'dumbbell', 'shoe', 'sparkle', 'no-food', 'bulb', 'basket', 'chat', 'flame',
];

export const QUOTES = [
  'You are allowed to be both a masterpiece and a work in progress simultaneously.',
  'Small, consistent steps taken daily outlast one big burst of motivation.',
  'Progress is quiet most days. Show up anyway.',
  'A gentle routine, kept often, beats a perfect routine kept rarely.',
  'You do not need to finish today. You just need to begin it.',
  'Every checked box today is a seed for who you are becoming.',
  'Rest is part of the routine, not a break from it.',
  'Consistency is a form of self-respect.',
];

export function todayIndex(length) {
  const start = new Date(Date.UTC(new Date().getFullYear(), 0, 0));
  const now = new Date();
  const diff = now - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return dayOfYear % length;
}
