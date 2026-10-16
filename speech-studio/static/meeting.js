(() => {
  const $ = (id) => document.getElementById(id);
  const fa = (n) => Number(n).toLocaleString('fa-IR');
  const ts = (t) => {
    t = Math.floor(t);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
  };
  const STATUS = { queued: 'در صف', running: 'در حال پردازش', done: 'تمام شد', error: 'خطا', cancelled: 'لغو شد' };
  const STAGE = { diarize: 'تفکیک گوینده', asr: 'پیاده‌سازی نوبت‌ها' };

  let sel = null, job = null, timer = null, names = {};

  async function api(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error((await r.text()) || r.status);
    return r.json();
  }
  const label = (k) => names[k] || `گوینده ${fa(k + 1)}`;

  async function refreshList() {
    const all = await api('/api/jobs');
    const jobs = all.filter((j) => j.kind === 'meeting');
    const ul = $('mjoblist');
    ul.textContent = '';
    $('mnojobs').hidden = jobs.length > 0;
    for (const j of jobs) {
      const li = document.createElement('li');
      if (j.id === sel) li.className = 'sel';
      const n = document.createElement('span');
      n.className = 'n';
      n.textContent = j.name;
      const s = document.createElement('span');
      s.className = `muted st-${j.status}`;
      s.textContent = STATUS[j.status] || j.status;
      li.append(n, s);
      li.addEventListener('click', () => select(j.id));
      ul.append(li);
    }
  }

  function select(id) {
    sel = id;
    names = {};
    $('mresult').hidden = false;
    clearTimeout(timer);
    poll();
    refreshList();
  }

  async function poll() {
    if (!sel) return;
    const id = sel;
    try { job = await api(`/api/jobs/${id}`); } catch { return; }
    if (id !== sel) return;
    render();
    refreshList();
    if (job.status === 'queued' || job.status === 'running') timer = setTimeout(poll, 3000);
  }

  function nameQuery() {
    const ids = (job.minutes ? job.minutes.speakers : []).map((s) => s.id);
    const max = ids.length ? Math.max(...ids) : -1;
    const arr = [];
    for (let i = 0; i <= max; i++) arr.push(encodeURIComponent((names[i] || '').replace(/,/g, ' ')));
    return arr.join(',');
  }

  function renderDownloads() {
    const q = nameQuery();
    $('mdl-txt').href = `/api/jobs/${job.id}/download?fmt=txt&names=${q}`;
    $('mdl-md').href = `/api/jobs/${job.id}/download?fmt=md&names=${q}`;
  }

  function render() {
    const done = job.status === 'done';
    $('mname').textContent = job.name;
    $('mstatus').textContent = `${STATUS[job.status] || job.status}${job.error ? ' — ' + job.error : ''}`;
    const total = job.total_s || 0;
    $('mbar').style.width = (done ? 100 : total ? Math.min(100, (job.done_s / total) * 100) : 0) + '%';
    $('mprog').textContent = job.status === 'running'
      ? `${STAGE[job.stage] || ''} — ${fa(Math.floor(((job.done_s || 0) / (total || 1)) * 100))}٪`
      : '';
    $('mcancel').hidden = !(job.status === 'queued' || job.status === 'running');
    $('mdl-txt').classList.toggle('off', !done);
    $('mdl-md').classList.toggle('off', !done);
    if (done) { renderDownloads(); renderSpeakers(); renderMinutes(); }
    renderSegs();
  }

  function renderSpeakers() {
    const box = $('mspeakers');
    if (box.dataset.job === job.id) return;
    box.dataset.job = job.id;
    box.textContent = '';
    for (const sp of job.minutes.speakers) {
      const inp = document.createElement('input');
      inp.placeholder = `نام ${label(sp.id)} (${fa(Math.round(sp.share * 100))}٪)`;
      inp.addEventListener('input', () => { names[sp.id] = inp.value.trim(); renderDownloads(); renderSegs(); renderMinutes(); });
      box.append(inp);
    }
  }

  function renderMinutes() {
    const m = job.minutes;
    const box = $('mminutes');
    if (!m) { box.hidden = true; return; }
    box.hidden = false;
    box.textContent = '';
    const add = (title, items, fmtItem) => {
      const h = document.createElement('h3');
      h.textContent = title;
      const ul = document.createElement('ul');
      if (!items.length) { const li = document.createElement('li'); li.className = 'muted'; li.textContent = 'موردی یافت نشد'; ul.append(li); }
      for (const it of items) { const li = document.createElement('li'); li.textContent = fmtItem(it); ul.append(li); }
      box.append(h, ul);
    };
    add('سهم گفتار', m.speakers, (s) => `${label(s.id)}: ${fa(Math.round(s.seconds / 60))} دقیقه (${fa(Math.round(s.share * 100))}٪)`);
    add('تصمیم‌ها', m.decisions, (d) => `[${ts(d.t)}] ${label(d.spk)}: ${d.text}`);
    add('کارها و اقدام‌ها', m.actions, (d) => `[${ts(d.t)}] ${label(d.spk)}: ${d.text}`);
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = m.note;
    box.append(note);
  }

  function renderSegs() {
    const box = $('msegs');
    box.textContent = '';
    const frag = document.createDocumentFragment();
    for (const s of job.segments || []) {
      const d = document.createElement('div');
      d.className = 'seg';
      const t = document.createElement('time');
      t.textContent = ts(s.start);
      const w = document.createElement('span');
      w.className = `spk s${s.speaker % 4}`;
      w.textContent = label(s.speaker);
      const p = document.createElement('span');
      p.textContent = s.text;
      d.append(t, w, p);
      frag.append(d);
    }
    box.append(frag);
  }

  async function upload(file) {
    if (!file) return;
    $('mupmsg').textContent = `در حال ارسال «${file.name}» به سرویس محلی…`;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const j = await api(`/api/meeting?speakers=${$('mspk').value}`, { method: 'POST', body: fd });
      $('mupmsg').textContent = '';
      select(j.id);
    } catch (e) {
      $('mupmsg').textContent = 'خطا: ' + e.message;
    }
  }

  const drop = $('mdrop');
  $('mpick').addEventListener('click', () => $('mfile').click());
  $('mfile').addEventListener('change', (e) => { upload(e.target.files[0]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => upload(e.dataTransfer.files[0]));
  $('mcancel').addEventListener('click', () => api(`/api/jobs/${sel}/cancel`, { method: 'POST' }));
  refreshList();
})();
