// Shared lifecycle for API, calendar/planner ticks and Telegram reminder actions.
// Callers persist the whole change in one storage write.
export function validTaskDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value + 'T12:00:00Z'))
    && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}

export function taskInputError(data, { creating = false, reminder = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'اطلاعات معتبر نیست.';
  if ((creating || data.title !== undefined) && (typeof data.title !== 'string' || !data.title.trim())) return 'عنوان را وارد کنید.';
  if (data._rowSave !== undefined && (!data._rowSave || !/^[a-zA-Z0-9-]{8,80}$/.test(data._rowSave.client || '') || !Number.isSafeInteger(data._rowSave.seq) || data._rowSave.seq < 1)) return 'شناسهٔ ذخیره معتبر نیست.';
  if (data.done !== undefined && typeof data.done !== 'boolean') return 'وضعیت انجام باید درست یا نادرست باشد.';
  if (data.recurrence !== undefined && data.recurrence !== null && data.recurrence !== '' && !['daily', 'weekly', 'monthly'].includes(data.recurrence)) return 'تکرار نامعتبر است.';
  if (data.date !== undefined && !(!reminder && data.date === '') && !validTaskDate(data.date)) return 'تاریخ معتبر نیست.';
  if (data.deadline && !validTaskDate(data.deadline)) return 'مهلت معتبر نیست.';
  if ((data.startTime || data.time) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.startTime || data.time)) return 'ساعت معتبر نیست.';
  return null;
}

export function nextTaskDate(date, recurrence) {
  const d = new Date(date + 'T12:00:00Z');
  if (recurrence === 'monthly') {
    const day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else d.setUTCDate(d.getUTCDate() + (recurrence === 'weekly' ? 7 : 1));
  return d.toISOString().slice(0, 10);
}

function advance(db, collection, row, options, nextTask = null) {
  if (!row.recurrence || row.recurrenceNextId) return;
  const date = nextTaskDate(row.date || options.today(), row.recurrence);
  const series = row.recurrenceSeriesId || row.id;
  // Legacy rows have no series id. Reuse an existing next occurrence rather than
  // producing another copy when an old task is unticked and checked again.
  const candidates = db[collection].filter(x => x.userId === row.userId && x.id !== row.id && x.date === date &&
    (x.recurrenceSourceId === row.id || (x.recurrenceSeriesId === series) ||
      (!row.recurrenceSeriesId && !x.recurrenceSeriesId && x.title === row.title && x.recurrence === row.recurrence &&
        (x.projectId || null) === (row.projectId || null) && (collection !== 'reminders' || (x.taskId || null) === (nextTask?.id || null)))));
  const existing = candidates.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id)))[0];
  row.recurrenceSeriesId = series;
  row.recurrenceNextId = existing?.id || `${collection}-next:${series}:${date}`;
  if (existing) return;
  const common = { id: row.recurrenceNextId, userId: row.userId, recurrenceSeriesId: series, recurrenceSourceId: row.id,
    title: row.title, date, done: false, recurrence: row.recurrence, createdAt: Date.now() };
  if (collection === 'tasks') db.tasks.push({ ...common, priority: row.priority || 'medium', deadline: null,
    projectId: row.projectId || null, parentTaskId: null, notes: row.notes || '', tags: row.tags || [],
    startTime: row.startTime || null, durationMinutes: row.durationMinutes || null });
  else db.reminders.push({ ...common, time: row.time || null, leadMinutes: row.leadMinutes || 0,
    whenLabel: options.label(date), taskId: nextTask?.id || null });
}

function mark(row, done) {
  const changed = !!row.done !== done;
  row.done = done;
  if (done) { if (changed || !row.doneAt) row.doneAt = Date.now(); }
  else { delete row.doneAt; delete row.notifiedAt; delete row.leadSentAt; }
  return changed;
}

export function setTaskCompletion(db, userId, task, done, options) {
  const changed = mark(task, done);
  if (done && changed) advance(db, 'tasks', task, options);
  const nextTask = task.recurrence && db.tasks.find(x => x.userId === userId && x.id === task.recurrenceNextId);
  for (const r of [...db.reminders]) {
    if (r.userId !== userId || r.taskId !== task.id) continue;
    const reminderChanged = mark(r, done);
    if (done && reminderChanged) advance(db, 'reminders', r, options, nextTask);
  }
}

export function setReminderCompletion(db, userId, reminder, done, options) {
  const task = reminder.taskId && db.tasks.find(x => x.userId === userId && x.id === reminder.taskId);
  if (task) return setTaskCompletion(db, userId, task, done, options);
  const changed = mark(reminder, done);
  if (done && changed) advance(db, 'reminders', reminder, options);
}

export function deleteTaskTree(db, userId, taskId) {
  const dead = new Set([taskId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of db.tasks) if (t.userId === userId && dead.has(t.parentTaskId) && !dead.has(t.id)) { dead.add(t.id); grew = true; }
  }
  const reminders = new Set(db.reminders.filter(r => r.userId === userId && dead.has(r.taskId)).map(r => r.id));
  db.tasks = db.tasks.filter(t => !(t.userId === userId && dead.has(t.id)));
  db.reminders = db.reminders.filter(r => !(r.userId === userId && reminders.has(r.id)));
  db.attachments = (db.attachments || []).filter(a => !(a.userId === userId &&
    ((a.ownerType === 'task' && dead.has(a.ownerId)) || (a.ownerType === 'reminder' && reminders.has(a.ownerId)))));
}

export function deleteReminder(db, userId, reminderId) {
  db.reminders = db.reminders.filter(r => !(r.userId === userId && r.id === reminderId));
  db.attachments = (db.attachments || []).filter(a => !(a.userId === userId && a.ownerType === 'reminder' && a.ownerId === reminderId));
}
// A replayed browser queue can overlap the old document's keepalive request.
// Compare sequence numbers per browser tab, including during storage conflict merges.
export function acceptRowSave(db, userId, row, kind, data) {
  const meta = data._rowSave;
  if (!meta) return true;
  const task = kind === 'reminder' && row.taskId ? db.tasks.find(t => t.id === row.taskId && t.userId === userId) : kind === 'task' ? row : null;
  const canonical = task || row;
  if (Math.max(canonical._saveVersions?.[meta.client] || 0, row._saveVersions?.[meta.client] || 0) >= meta.seq) return false;
  const fields = ['done', 'mit'].filter(k => data[k] !== undefined);
  if (!fields.length) return true;
  const stamp = (target, changed) => {
    const versions = { ...(target._saveVersions || {}) };
    delete versions[meta.client]; versions[meta.client] = meta.seq;
    const keys = Object.keys(versions); for (const key of keys.slice(0, Math.max(0, keys.length - 32))) delete versions[key];
    target._saveVersions = versions;
    target._saveIntent = { ...meta, fields: changed };
  };
  stamp(canonical, fields);
  if (task && data.done !== undefined) {
    for (const r of db.reminders) if (r.userId === userId && r.taskId === task.id) stamp(r, ['done']);
  } else if (row !== canonical) stamp(row, fields);
  return true;
}

export function mergeRowSave(base, ours, theirs, out) {
  const intent = ours._saveIntent;
  if (!ours.id || !ours.userId || !intent || intent.seq <= (base._saveVersions?.[intent.client] || 0)) return out;
  const source = (theirs._saveVersions?.[intent.client] || 0) >= intent.seq ? theirs : ours;
  const fields = new Set(intent.fields || []);
  if (fields.has('done')) for (const key of ['doneAt', 'notifiedAt', 'leadSentAt']) fields.add(key);
  for (const key of fields) { if (source[key] === undefined) delete out[key]; else out[key] = source[key]; }
  out._saveVersions = { ...(out._saveVersions || {}) };
  for (const [client, seq] of Object.entries(theirs._saveVersions || {})) out._saveVersions[client] = Math.max(seq, out._saveVersions[client] || 0);
  out._saveIntent = source._saveIntent;
  return out;
}
