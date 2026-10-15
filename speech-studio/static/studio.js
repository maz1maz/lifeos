(() => {
  const $ = (id) => document.getElementById(id);
  const fa = (n) => Number(n).toLocaleString('fa-IR');
  const ts = (t) => {
    t = Math.floor(t);
    const p = (x) => String(x).padStart(2, '0');
    return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
  };
  const STATUS = { queued: 'در صف', running: 'در حال پردازش', done: 'تمام شد', error: 'خطا', cancelled: 'لغو شد' };

  let sel = null;       // job id
  let segs = [];        // سگمنت‌های دریافت‌شده
  let timer = null;

  async function api(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error((await r.text()) || r.status);
    return r.json();
  }

  async function health() {
    try {
      const h = await api('/api/health');
      const b = $('model-badge');
      b.textContent = h.model_loaded ? 'مدل آماده است' : 'در حال بارگذاری مدل…';
      b.classList.toggle('ok', h.model_loaded);
      if (!h.model_loaded) setTimeout(health, 2000);
    } catch { setTimeout(health, 3000); }
  }

  async function refreshJobs() {
    const jobs = await api('/api/jobs');
    const ul = $('joblist');
    ul.textContent = '';
    $('nojobs').hidden = jobs.length > 0;
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
    segs = [];
    $('segs').textContent = '';
    $('result').hidden = false;
    clearTimeout(timer);
    poll();
    refreshJobs();
  }

  async function poll() {
    if (!sel) return;
    const id = sel;
    let j;
    try { j = await api(`/api/jobs/${id}?after=${segs.length}`); } catch { return; }
    if (id !== sel) return;
    segs.push(...j.segments);
    render(j);
    refreshJobs();
    if (j.status === 'queued' || j.status === 'running') timer = setTimeout(poll, 1500);
  }

  function render(j) {
    $('rname').textContent = j.name;
    $('rstatus').textContent = `${STATUS[j.status] || j.status}${j.error ? ' — ' + j.error : ''}`;
    const total = j.total_s || 0;
    const pct = total ? Math.min(100, (j.done_s / total) * 100) : 0;
    $('bar').style.width = (j.status === 'done' ? 100 : pct) + '%';
    $('progtext').textContent = total ? `${fa(Math.floor(j.done_s))} از ${fa(Math.floor(total))} ثانیه` : '';
    $('cancel').hidden = !(j.status === 'queued' || j.status === 'running');
    $('dl-txt').href = `/api/jobs/${j.id}/download?fmt=txt`;
    $('dl-srt').href = `/api/jobs/${j.id}/download?fmt=srt`;
    const off = segs.length === 0;
    $('dl-txt').classList.toggle('off', off);
    $('dl-srt').classList.toggle('off', off);
    renderSegs();
  }

  function renderSegs() {
    const q = $('search').value.trim();
    const box = $('segs');
    box.textContent = '';
    let hits = 0;
    const frag = document.createDocumentFragment();
    for (const s of segs) {
      const idx = q ? s.text.indexOf(q) : -1;
      if (q && idx < 0) continue;
      hits++;
      const d = document.createElement('div');
      d.className = 'seg';
      const t = document.createElement('time');
      t.textContent = ts(s.start);
      const p = document.createElement('span');
      if (q) {
        p.append(s.text.slice(0, idx));
        const m = document.createElement('mark');
        m.textContent = q;
        p.append(m, s.text.slice(idx + q.length));
      } else p.textContent = s.text;
      d.append(t, p);
      frag.append(d);
    }
    box.append(frag);
    $('hits').textContent = q ? `${fa(hits)} نتیجه` : `${fa(segs.length)} جمله`;
  }

  async function upload(file) {
    if (!file) return;
    $('upmsg').textContent = `در حال ارسال «${file.name}» به سرویس محلی…`;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const j = await api('/api/transcribe', { method: 'POST', body: fd });
      $('upmsg').textContent = '';
      select(j.id);
    } catch (e) {
      $('upmsg').textContent = 'خطا: ' + e.message;
    }
  }

  const drop = $('drop');
  $('pick').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', (e) => { upload(e.target.files[0]); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => upload(e.dataTransfer.files[0]));
  $('search').addEventListener('input', renderSegs);
  $('cancel').addEventListener('click', async () => { await api(`/api/jobs/${sel}/cancel`, { method: 'POST' }); });

  health();
  refreshJobs();
})();
