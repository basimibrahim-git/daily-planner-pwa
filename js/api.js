import { queueAdd, queueAll, queueRemove, cacheSet, cacheGet } from './db-local.js';

const API_BASE = 'api/';

function isNetworkError(e) {
  return e instanceof TypeError || e?.message === 'Failed to fetch' || e?.name === 'AbortError';
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (e) {
    throw e; // network error, left as TypeError for isNetworkError() to catch upstream
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const auth = {
  status: () => request('auth.php'),
  setup: (password) =>
    request('auth.php', { method: 'POST', body: JSON.stringify({ action: 'setup', password }) }),
  login: (password) =>
    request('auth.php', { method: 'POST', body: JSON.stringify({ action: 'login', password }) }),
  logout: () => request('auth.php', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }),
  changePassword: (currentPassword, newPassword) =>
    request('auth.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'change-password', currentPassword, newPassword }),
    }),
};

export async function fetchEntries(date) {
  try {
    const data = await request(`entries.php?date=${encodeURIComponent(date)}`);
    await cacheSet(`entries:${date}`, data);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet(`entries:${date}`);
      if (cached) return { ...cached, offline: true };
    }
    throw e;
  }
}

export async function setEntry(date, itemId, value) {
  const cached = (await cacheGet(`entries:${date}`)) || { date, items: [], entries: {}, note: '' };
  cached.entries = { ...cached.entries, [itemId]: value };
  await cacheSet(`entries:${date}`, cached);

  try {
    await request('entries.php', {
      method: 'POST',
      body: JSON.stringify({ date, item_id: itemId, value }),
    });
    return { offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      await queueAdd({ type: 'set-entry', payload: { date, item_id: itemId, value } });
      return { offline: true };
    }
    throw e;
  }
}

export async function setNote(date, note) {
  const cached = (await cacheGet(`entries:${date}`)) || { date, items: [], entries: {}, note: '' };
  cached.note = note;
  await cacheSet(`entries:${date}`, cached);

  try {
    await request('entries.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'note', date, note }),
    });
    return { offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      await queueAdd({ type: 'note', payload: { date, note } });
      return { offline: true };
    }
    throw e;
  }
}

export async function fetchItems() {
  try {
    const data = await request('items.php');
    await cacheSet('items', data.items);
    return { items: data.items, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet('items');
      if (cached) return { items: cached, offline: true };
    }
    throw e;
  }
}

// Item management (add/edit/delete/reorder) requires a live connection —
// it's an occasional setup task, not part of the daily offline check-in flow.
export const items = {
  create: (item) => request('items.php', { method: 'POST', body: JSON.stringify(item) }),
  update: (id, fields) =>
    request('items.php', { method: 'PUT', body: JSON.stringify({ id, ...fields }) }),
  remove: (id) => request(`items.php?id=${id}`, { method: 'DELETE' }),
  reorder: (order) =>
    request('items.php', { method: 'POST', body: JSON.stringify({ action: 'reorder', order }) }),
};

export async function fetchHistory(start, end) {
  const key = `history:${start}:${end}`;
  try {
    const data = await request(`history.php?start=${start}&end=${end}`);
    await cacheSet(key, data);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet(key);
      if (cached) return { ...cached, offline: true };
    }
    throw e;
  }
}

export async function fetchTodaysDua() {
  try {
    const data = await request('dua.php');
    await cacheSet('dua:today', data);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet('dua:today');
      if (cached) return { ...cached, offline: true };
    }
    throw e;
  }
}

export async function fetchFavoriteDuas() {
  try {
    const data = await request('dua.php?action=favorites');
    await cacheSet('dua:favorites', data);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet('dua:favorites');
      if (cached) return { ...cached, offline: true };
    }
    throw e;
  }
}

export const duaFavorite = {
  add: (duaId) =>
    request('dua.php', { method: 'POST', body: JSON.stringify({ action: 'favorite', dua_id: duaId }) }),
  remove: (duaId) =>
    request('dua.php', { method: 'POST', body: JSON.stringify({ action: 'unfavorite', dua_id: duaId }) }),
};

export async function fetchStats(start, end) {
  const key = `stats:${start}:${end}`;
  try {
    const data = await request(`stats.php?start=${start}&end=${end}`);
    await cacheSet(key, data);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet(key);
      if (cached) return { ...cached, offline: true };
    }
    throw e;
  }
}

export async function fetchGratitude(limit = 200) {
  try {
    const data = await request(`gratitude.php?limit=${limit}`);
    await cacheSet('gratitude:list', data);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet('gratitude:list');
      if (cached) return { ...cached, offline: true };
    }
    throw e;
  }
}

// Photos go up as multipart form data and need a live connection; text-only
// notes use JSON and queue for later when offline, like checklist entries.
export async function addGratitude(text, style, photos = []) {
  if (photos.length) {
    const form = new FormData();
    form.append('text', text);
    form.append('style', JSON.stringify(style));
    photos.forEach((blob, i) => form.append('photos[]', blob, `photo-${i}.jpg`));
    let res;
    try {
      res = await fetch(API_BASE + 'gratitude.php', { method: 'POST', credentials: 'same-origin', body: form });
    } catch (e) {
      if (isNetworkError(e)) throw new Error('Photos need a connection — try again when you are online.');
      throw e;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return { offline: false, count: data.count, id: data.id };
  }

  const cached = (await cacheGet('gratitude:list')) || { entries: [], count: 0 };
  const optimistic = { id: `local-${Date.now()}`, text, style, photos: [], created_at: new Date().toISOString() };
  const nextCached = { entries: [optimistic, ...cached.entries], count: cached.count + 1 };

  try {
    const res = await request('gratitude.php', { method: 'POST', body: JSON.stringify({ text, style }) });
    optimistic.id = res.id;
    await cacheSet('gratitude:list', nextCached);
    return { offline: false, count: res.count, id: res.id };
  } catch (e) {
    if (isNetworkError(e)) {
      await cacheSet('gratitude:list', nextCached);
      await queueAdd({ type: 'gratitude-add', payload: { text, style } });
      return { offline: true, count: nextCached.count };
    }
    throw e;
  }
}

export function photoUrl(photoId) {
  return `${API_BASE}photo.php?id=${encodeURIComponent(photoId)}`;
}

export async function randomGratitude() {
  return request('gratitude.php?action=random');
}

export async function deleteGratitude(id) {
  const res = await request(`gratitude.php?id=${id}`, { method: 'DELETE' });
  const cached = await cacheGet('gratitude:list');
  if (cached) {
    await cacheSet('gratitude:list', {
      entries: cached.entries.filter((e) => e.id !== id),
      count: res.count,
    });
  }
  return res;
}

export async function fetchMoodDay(date) {
  const key = `mood:day:${date}`;
  try {
    const data = await request(`mood.php?date=${encodeURIComponent(date)}`);
    await cacheSet(key, data);
    await cacheSet('mood:options', data.options);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet(key);
      const options = await cacheGet('mood:options');
      if (cached || options) {
        return { date, options: options || cached.options, checkins: cached?.checkins || [], offline: true };
      }
    }
    throw e;
  }
}

export async function logMood({ date, time, optionId, note = '' }) {
  const payload = { date, time, option_id: optionId, note };
  const key = `mood:day:${date}`;
  const cached = (await cacheGet(key)) || { date, options: (await cacheGet('mood:options')) || [], checkins: [] };

  try {
    const res = await request('mood.php', { method: 'POST', body: JSON.stringify({ action: 'checkin', ...payload }) });
    const option = cached.options.find((o) => o.id === optionId);
    cached.checkins = [...cached.checkins, { id: res.id, option_id: optionId, score: option?.score ?? 0, note, time }];
    await cacheSet(key, cached);
    return { offline: false, id: res.id };
  } catch (e) {
    if (isNetworkError(e)) {
      const option = cached.options.find((o) => o.id === optionId);
      cached.checkins = [
        ...cached.checkins,
        { id: `local-${Date.now()}`, option_id: optionId, score: option?.score ?? 0, note, time },
      ];
      await cacheSet(key, cached);
      await queueAdd({ type: 'mood-checkin', payload });
      return { offline: true };
    }
    throw e;
  }
}

export async function deleteMoodCheckin(id, date) {
  await request(`mood.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  const key = `mood:day:${date}`;
  const cached = await cacheGet(key);
  if (cached) {
    cached.checkins = cached.checkins.filter((c) => c.id !== id);
    await cacheSet(key, cached);
  }
}

export async function fetchMoodStats(start, end) {
  const key = `mood:stats:${start}:${end}`;
  try {
    const data = await request(`mood.php?action=stats&start=${start}&end=${end}`);
    await cacheSet(key, data);
    return { ...data, offline: false };
  } catch (e) {
    if (isNetworkError(e)) {
      const cached = await cacheGet(key);
      if (cached) return { ...cached, offline: true };
    }
    throw e;
  }
}

// Editing the mood list needs a live connection, like managing checklist items.
async function moodOptionsCall(body) {
  const res = await request('mood.php', { method: 'POST', body: JSON.stringify(body) });
  await cacheSet('mood:options', res.options);
  return res.options;
}

export const moodOptions = {
  save: (option) => moodOptionsCall({ action: 'option-save', ...option }),
  remove: (id) => moodOptionsCall({ action: 'option-remove', id }),
  reorder: (order) => moodOptionsCall({ action: 'option-reorder', order }),
};

export async function pendingCount() {
  const all = await queueAll();
  return all.length;
}

let flushing = false;

export async function flushQueue() {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    const pending = await queueAll();
    for (const action of pending) {
      try {
        if (action.type === 'set-entry') {
          await request('entries.php', { method: 'POST', body: JSON.stringify(action.payload) });
        } else if (action.type === 'note') {
          await request('entries.php', {
            method: 'POST',
            body: JSON.stringify({ action: 'note', ...action.payload }),
          });
        } else if (action.type === 'gratitude-add') {
          await request('gratitude.php', { method: 'POST', body: JSON.stringify(action.payload) });
        } else if (action.type === 'mood-checkin') {
          await request('mood.php', { method: 'POST', body: JSON.stringify({ action: 'checkin', ...action.payload }) });
        }
        await queueRemove(action.id);
        synced++;
      } catch (e) {
        if (isNetworkError(e)) {
          break; // still offline (or just went offline mid-flush) — stop, retry later
        }
        // Server rejected it outright (e.g. bad data) — drop it so it doesn't block the queue forever.
        console.warn('[planner] dropping unsyncable queued action', action, e);
        await queueRemove(action.id);
      }
    }
  } finally {
    flushing = false;
  }
  return synced;
}

export { isNetworkError };
