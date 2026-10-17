// Unsent answers, flags, highlights and notes of an IELTS run, kept in this browser until the hand-in.
const key = id => `lifeos-ielts-${id}`;
export const loadDraft = id => { try { return JSON.parse(localStorage.getItem(key(id)) || '{}') || {}; } catch { return {}; } };
export const saveDraft = (id, d) => { try { localStorage.setItem(key(id), JSON.stringify(d)); } catch {} };
export const dropDraft = id => { try { localStorage.removeItem(key(id)); } catch {} };
