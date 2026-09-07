# کپی بخش سریال (مرجع)

> کد **زنده و کامل** در ریپو:
> `public/design/series-page.html` (~1020741 بایت، شامل فونت/CSS مشترک)
>
> این فایل برای خواندن سریع: ساختار HTML + اسکریپت اصلی (بدون فونت base64).

---

## مسیر فایل اصلی

```
public/design/series-page.html
```

---

## ساختار HTML (بدنه)

```html
<body>
<div class="wrap series-page">
<nav class="nav"><a class="brand" href="/">هـ</a><div class="navlinks"><a href="/">🏠 امروز</a><a href="/design/calendar-page.html">📅 تقویم</a><a href="/design/finance-page.html">💰 مالی</a><a href="/design/market-page.html">📈 بازار</a><a href="/design/series-page.html" class="on">🎬 سریال‌ها</a><a href="/design/movies-page.html">🎞 فیلم‌ها</a><a href="/design/spotify-page.html">🎵 موسیقی</a><a href="/design/youtube-page.html">▶️ یوتیوب</a><a href="/design/documents-page.html">📄 مدارک</a><a href="/design/contacts-page.html">👥 مخاطبین</a><a href="/design/settings-page.html">⚙️ تنظیمات</a></div><div class="navtools"><button class="iconbtn" id="modeBtn" type="button">🌙</button><span id="navAuth"></span></div></nav>
<!-- see JS below -->

  <header class="sx-head">
    <h1>🎬 سریال‌ها</h1>
    <p>در حال دیدن جدا از انتظار فصل بعد · بدون تکرار · پوستر و پیشرفت واضح</p>
  </header>

  <div class="sx-bar">
    <input class="sx-search" id="sxSearch" type="search" placeholder="جستجو در آرشیو…" autocomplete="off">
    <button type="button" class="sx-btn primary" id="sxAddBtn">＋ افزودن</button>
    <button type="button" class="sx-btn ghost" id="sxImpBtn">📥 Bingers</button>
  </div>

  <div class="sx-stats" id="sxStats"></div>

  <div class="sx-alert" id="sxAlert">
    <b>🆕 قسمت تازه</b>
    <span class="grow" id="sxAlertText"></span>
    <button type="button" class="sx-btn primary" id="sxAlertSaw" style="min-height:36px;padding:8px 12px">همه را دیدم</button>
  </div>

  <div class="sx-tabs" role="tablist">
    <button type="button" class="sx-tab on" data-t="watching">در حال دیدن <span class="n" id="nW">۰</span></button>
    <button type="button" class="sx-tab" data-t="waiting">در انتظار <span class="n" id="nWait">۰</span></button>
    <button type="button" class="sx-tab" data-t="done">تمام‌شده <span class="n" id="nD">۰</span></button>
    <button type="button" class="sx-tab" data-t="list">واچ‌لیست <span class="n" id="nL">۰</span></button>
  </div>

  <div class="sx-grid" id="sxGrid"></div>
</div>

<div class="sx-ovl" id="sxOvl"></div>
<aside class="sx-drawer left" id="sxDetail" aria-label="جزئیات"></aside>

<aside class="sx-drawer right sx-panel" id="sxAdd" aria-label="افزودن">
  <h3>افزودن سریال</h3>
  <p class="hint">نام انگلیسی را بنویس — از TVMaze پیدا و به واچ‌لیست اضافه می‌شود.</p>
  <input class="sx-search" id="sxAddQ" type="search" placeholder="مثلاً Silo یا Lioness…" style="width:100%;margin-bottom:12px;box-sizing:border-box">
  <div id="sxAddRes"><div class="sx-no">حداقل ۲ حرف بنویس…</div></div>
  <div style="margin-top:18px;text-align:center"><button type="button" class="sx-btn ghost" id="sxAddClose">بستن</button></div>
</aside>

<aside class="sx-drawer right sx-panel" id="sxImport" aria-label="ایمپورت">
  <h3>درون‌ریزی Bingers</h3>
  <p class="hint">CSV خروجی Bingers — تکراری‌ها خودکار رد می‌شوند.</p>
  <div class="sx-file" id="sxLibPick">
    <b>library.csv</b>
    <small id="sxLibName">انتخاب نشده</small>
    <input type="file" id="sxLibFile" accept=".csv,text/csv" style="display:none">
  </div>
  <div class="sx-file" id="sxWatPick">
    <b>watches.csv</b>
    <small id="sxWatName">اختیاری — برای پیشرفت</small>
    <input type="file" id="sxWatFile" accept=".csv,text/csv" style="display:none">
  </div>
  <button type="button" class="sx-btn primary" id="sxDoImport" style="width:100%;margin-top:8px">درون‌ریزی</button>
  <div style="margin-top:14px;text-align:center"><button type="button" class="sx-btn ghost" id="sxImpClose">بستن</button></div>
</aside>

<div id="toast"></div>

<!-- see JS below -->
<!-- see JS below -->
<!-- see JS below -->
<!-- see JS below -->
<!-- see JS below -->
</body>
```



---

## اسکریپت اصلی اپ سریال

```javascript


(function(){
  'use strict';
  var faD='۰۱۲۳۴۵۶۷۸۹';
  function fa(n){return String(n).replace(/\d/g,function(d){return faD[d]})}
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
  function toast(m){
    var t=document.getElementById('toast'); if(!t) return;
    t.textContent=m; t.classList.add('show');
    clearTimeout(window._sxT); window._sxT=setTimeout(function(){t.classList.remove('show')},2200);
  }
  function todayISO(){
    try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
    catch(e){ return new Date().toISOString().slice(0,10); }
  }
  function daysTo(dstr){
    if(!dstr) return 9999;
    var t=new Date(todayISO()+'T12:00:00');
    var d=new Date(String(dstr).slice(0,10)+'T12:00:00');
    if(isNaN(d.getTime())) return 9999;
    return Math.round((d-t)/86400000);
  }
  var GMON=['ژانویه','فوریه','مارس','آوریل','مه','ژوئن','ژوئیه','اوت','سپتامبر','اکتبر','نوامبر','دسامبر'];
  function nextWhen(dstr){
    var dt=new Date(String(dstr).slice(0,10)+'T12:00:00');
    if(isNaN(dt.getTime())) return String(dstr);
    return GMON[dt.getMonth()]+' '+fa(dt.getFullYear());
  }
  var GEN={Drama:'درام','Science-Fiction':'علمی‌تخیلی',Thriller:'هیجانی',Crime:'جنایی',Mystery:'رازآلود',Adventure:'ماجراجویی',Fantasy:'فانتزی',Comedy:'کمدی',Horror:'ترسناک',Action:'اکشن',Romance:'عاشقانه',History:'تاریخی',Legal:'حقوقی',War:'جنگی',Western:'وسترن',Music:'موسیقی',Espionage:'جاسوسی',Anthology:'آنتولوژی'};
  function gfa(g){return GEN[g]||g||''}
  function S(k){ return (typeof TV==='object' && TV[k]) ? TV[k] : {}; }
  function seriesKeyFromTitle(title){
    var t=String(title||'').trim().toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9\u0600-\u06ff\s_-]/g,' ').replace(/\s+/g,' ').trim();
    if(!t) return 's_'+Date.now();
    if(typeof TV==='object'){
      if(TV[title]) return title;
      var bare=t.replace(/[^a-z0-9\u0600-\u06ff]/g,'');
      for(var k in TV){
        if(!Object.prototype.hasOwnProperty.call(TV,k)) continue;
        var n=String(TV[k].name||k).toLowerCase();
        if(n===t || n.replace(/[^a-z0-9\u0600-\u06ff]/g,'')===bare) return k;
      }
    }
    return t.replace(/\s+/g,'_');
  }
  function posterSrc(meta, name){
    var img=meta && meta.img ? String(meta.img) : '';
    if(img && (img.indexOf('http')===0 || img.indexOf('data:')===0 || img.indexOf('/')===0)) return img;
    var n=String((meta&&meta.name)||name||'?').trim()||'?';
    var letter=n.charAt(0).toUpperCase();
    var h=0; for(var i=0;i<n.length;i++) h=(h*31+n.charCodeAt(i))>>>0;
    var colors=['#1a73e8','#d93025','#e8710a','#1e8e3e','#a142f4','#e52592','#007b83','#188038'];
    var bg=colors[h%8];
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect fill="'+bg+'" width="100%" height="100%"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-size="160" font-family="Tahoma,sans-serif" font-weight="700">'+letter.replace(/[<>&]/g,'')+'</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  }
  function isShowEnded(meta){
    if(!meta) return false;
    var st=String(meta.status||'').toLowerCase();
    if(!st) return false;
    if(st==='running'||st==='returning series'||st==='in production'||st==='to be determined') return false;
    if(st==='ended'||st==='canceled'||st==='cancelled'||st.indexOf('ended')>=0) return true;
    return false;
  }

  /* STRICT season caps: tot=this season only; + never past aired */
  function seasonCapFromMeta(meta, season){
    season=Number(season)||1;
    var by=meta&&meta.bySeason;
    if(!by) return null;
    var s=by[season]||by[String(season)];
    if(!s) return null;
    var total=Number(s.total)||0;
    var aired=Number(s.aired);
    if(!Number.isFinite(aired)) aired=0;
    aired=Math.max(0, Math.min(aired, total||aired));
    return {total:total, aired:aired, cap:aired, known:true};
  }
  function maxWatchable(w){
    if(!w) return 0;
    if(w.aired!=null && Number.isFinite(Number(w.aired))) return Math.max(0, Number(w.aired));
    if(w.cap!=null && Number.isFinite(Number(w.cap))) return Math.max(0, Number(w.cap));
    var cap=seasonCapFromMeta(S(w.k), w.season||1);
    if(cap&&cap.known) return cap.aired;
    return 0; /* unknown → block */
  }
  function clampCur(w){
    if(!w) return;
    var cap=seasonCapFromMeta(S(w.k), w.season||1);
    if(cap&&cap.known){
      w.tot=cap.total>0?cap.total:Math.max(cap.aired,0);
      w.aired=cap.aired; w.cap=cap.aired; w.seasonKnown=true;
    }
    var mw=maxWatchable(w);
    if(w.seasonKnown || (w.aired!=null && Number.isFinite(Number(w.aired)))){
      w.cur=Math.max(0, Math.min(Number(w.cur)||0, mw));
    } else if(Number(w.tot)>0){
      w.cur=Math.max(0, Math.min(Number(w.cur)||0, Number(w.tot)));
    }
  }
  function canInc(w){
    if(!w) return false;
    clampCur(w);
    if(!w.seasonKnown && (w.aired==null || !Number.isFinite(Number(w.aired)))) return false;
    return (Number(w.cur)||0) < maxWatchable(w);
  }
  function applySeasonPayload(w, d){
    if(!w||!d) return;
    if(typeof TV==='object'){
      if(!TV[w.k]) TV[w.k]={name:d.name||w.k};
      if(d.bySeason) TV[w.k].bySeason=d.bySeason;
      if(d.seasonEpisodes && !TV[w.k].bySeason) TV[w.k].bySeason=d.seasonEpisodes;
      if(d.status||d.showStatus) TV[w.k].status=d.status||d.showStatus;
      if(d.seasons) TV[w.k].seasons=d.seasons;
      if(d.name) TV[w.k].name=d.name;
    }
    var by=d.bySeason||d.seasonEpisodes||{};
    if(d.tvmazeId && !w.tvmazeId) w.tvmazeId=d.tvmazeId;
    var season=Number(w.season)||1;
    var seasons=(d.seasons||Object.keys(by).map(Number).filter(function(n){return n>0})).sort(function(a,b){return a-b});
    if(seasons.length && seasons.indexOf(season)<0){
      season=seasons[0]; w.season=season;
    }
    var s=by[season]||by[String(season)]||{};
    var total=Number(s.total);
    if(!Number.isFinite(total) || total<=0) total=Number(d.totalEpisodes)||0;
    var aired=Number(s.aired);
    if(!Number.isFinite(aired)) aired=(d.airedInSeason!=null?Number(d.airedInSeason):0);
    if(total>0) aired=Math.min(Math.max(0,aired), total);
    else aired=Math.max(0,aired);
    w.tot=total>0?total:aired;
    w.aired=aired; w.cap=aired; w.seasonKnown=true; w._seasonLoaded=true;
    clampCur(w);
    if(w.id){
      patchMovie(w.id,{
        totalEpisodes:w.tot, currentEpisode:w.cur, currentSeason:w.season||1,
        seasonEpisodes:by, airedInSeason:w.aired, showStatus:d.status||d.showStatus,
        tvmazeId:w.tvmazeId||d.tvmazeId||undefined
      });
    }
  }
  function fetchSeasonInfo(w){
    if(!w) return Promise.resolve(null);
    function fromGet(){
      var q=[];
      if(w.tvmazeId) q.push('tvmazeId='+encodeURIComponent(w.tvmazeId));
      var name=(S(w.k).name||w.k||'');
      if(name) q.push('name='+encodeURIComponent(name));
      q.push('season='+encodeURIComponent(w.season||1));
      if(!w.tvmazeId && !name) return Promise.resolve(null);
      return fetch('/api/movies/tvmaze/seasons?'+q.join('&'),{credentials:'include'})
        .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
        .then(function(x){ if(!x.ok||!x.d) return null; applySeasonPayload(w,x.d); return x.d; })
        .catch(function(){return null});
    }
    if(w.id){
      return fetch('/api/movies/'+encodeURIComponent(w.id)+'/refresh-episodes',{
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:'{}'
      }).then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
        .then(function(x){
          if(x.ok&&x.d&&(x.d.bySeason||x.d.seasonEpisodes||x.d.totalEpisodes!=null)){
            applySeasonPayload(w,x.d); return x.d;
          }
          return fromGet();
        }).catch(function(){return fromGet()});
    }
    return fromGet();
  }
  function ensureSeasonTot(w, force){
    if(!w) return Promise.resolve();
    if(!force && w._seasonLoaded && w.seasonKnown && Number(w.tot)>0){ clampCur(w); return Promise.resolve(); }
    return fetchSeasonInfo(w).then(function(){ clampCur(w); });
  }


  var WATCHING=[], DONE=[], LIST=[], tab='watching', q='';

  function upsertMeta(k, it){
    if(typeof TV!=='object') return;
    var title=it.title||it.name||k;
    var img=it.posterUrl||it.poster||it.image||it.img||'';
    var by=it.seasonEpisodes||it.bySeason||null;
    if(!TV[k]){
      TV[k]={name:title,img:img||'',genres:it.genre?String(it.genre).split(/[,،]/).map(function(x){return x.trim()}).filter(Boolean):(it.genres||[]),rating:it.rating||it.tmdbRating||null,year:it.year||'',status:it.showStatus||'',summary:it.note||it.summary||'',cast:it.cast||[],next:it.next||null,network:it.network||'',bySeason:by};
    } else {
      if(title) TV[k].name=TV[k].name||title;
      if(img) TV[k].img=img;
      if(it.showStatus) TV[k].status=it.showStatus;
      if(it.year) TV[k].year=it.year;
      if(it.network) TV[k].network=it.network;
      if(it.note||it.summary) TV[k].summary=TV[k].summary||it.note||it.summary;
      if(by) TV[k].bySeason=by;
    }
  }

  /* Waiting = finished current season AND next season not available yet (or unknown next). Not mixed into watching. */
  function isWaiting(x){
    if(!x) return false;
    clampCur(x);
    var cur=Number(x.cur)||0, tot=Number(x.tot)||0, aired=maxWatchable(x);
    var meta=S(x.k);
    if(aired>0 && cur>=aired && tot>aired) return true;
    if(!(tot>0 && cur>=tot)) return false;
    if(isShowEnded(meta)) return false;
    if(meta.bySeason){
      var ns=(Number(x.season)||1)+1;
      var n=meta.bySeason[ns]||meta.bySeason[String(ns)];
      if(n && (Number(n.total)>0 || Number(n.aired)>0)) return false;
    }
    if(meta.next && meta.next.date) return daysTo(meta.next.date) > 0;
    return true;
  }

  function dedupeAll(){
    function uniq(arr, merge){
      var map={}, order=[];
      arr.forEach(function(x){
        if(!x||!x.k) return;
        if(map[x.k]){ if(merge) map[x.k]=merge(map[x.k],x); }
        else { map[x.k]=x; order.push(x.k); }
      });
      return order.map(function(k){return map[k]});
    }
    DONE=uniq(DONE);
    var doneK={}; DONE.forEach(function(x){doneK[x.k]=1});
    WATCHING=uniq(WATCHING, function(a,b){
      if((b.cur||0)>(a.cur||0)) return b;
      if((b.tot||0)>(a.tot||0) && (b.cur||0)>=(a.cur||0)) return Object.assign({},a,b,{cur:Math.max(a.cur||0,b.cur||0),tot:Math.max(a.tot||0,b.tot||0)});
      return a;
    }).filter(function(x){return !doneK[x.k]});
    var watchK={}; WATCHING.forEach(function(x){watchK[x.k]=1});
    LIST=uniq(LIST).filter(function(x){return !doneK[x.k] && !watchK[x.k]});
  }

  function matchQ(x){
    if(!q) return true;
    var meta=S(x.k);
    var blob=[meta.name||'',x.k,meta.network||'',meta.year||'',x.cur,x.tot,x.season].join(' ').toLowerCase();
    return blob.indexOf(q)>=0;
  }

  function patchMovie(id, body){
    if(!id) return Promise.resolve();
    return fetch('/api/movies/'+encodeURIComponent(id),{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})}).catch(function(){return{ok:false}});
  }

  function cardWatch(x, waiting){
    var meta=S(x.k), name=meta.name||x.k||'سریال';
    clampCur(x);
    var cur=Number(x.cur)||0, tot=Math.max(Number(x.tot)||0,0), mw=maxWatchable(x);
    var pct=tot>0?Math.min(100, Math.round(cur/tot*100)):0;
    var badge='';
    var canAdv=false;
    if(tot>0 && cur>=tot){
      var ns=(Number(x.season)||1)+1;
      var n=meta.bySeason&&(meta.bySeason[ns]||meta.bySeason[String(ns)]);
      if(n&&(Number(n.total)>0||Number(n.aired)>0)) canAdv=true;
    }
    if(waiting){
      if(mw>0 && cur>=mw && tot>mw) badge='<span class="sx-badge wait">پخش '+fa(mw)+' / '+fa(tot)+'</span>';
      else if(meta.next&&meta.next.date){
        var d=daysTo(meta.next.date);
        badge=d>0?'<span class="sx-badge wait">فصل بعد · '+fa(d)+' روز</span>':'<span class="sx-badge new">فصل بعد آماده</span>';
      } else badge='<span class="sx-badge wait">در انتظار</span>';
    } else if(x.newEp) badge='<span class="sx-badge new">قسمت جدید</span>';
    else if(!x.seasonKnown) badge='<span class="sx-badge wait">همگام…</span>';
    var step;
    if(canAdv && !waiting){
      step='<div class="sx-step" data-stop="1" style="flex-direction:column;gap:6px">'
        +'<div style="display:flex;gap:6px;align-items:center;justify-content:center">'
        +'<button type="button" data-dec="'+esc(x.k)+'" '+(cur<=0?'disabled':'')+'>−</button>'
        +'<span class="ep" data-cnt="'+esc(x.k)+'">'+fa(cur)+' / '+fa(tot||0)+'</span>'
        +'<button type="button" data-inc="'+esc(x.k)+'" disabled>+</button></div>'
        +'<button type="button" class="sx-adv" data-adv="'+esc(x.k)+'">فصل '+fa((Number(x.season)||1)+1)+' ←</button></div>';
    } else if(!waiting){
      step='<div class="sx-step" data-stop="1">'
        +'<button type="button" data-dec="'+esc(x.k)+'" '+(cur<=0?'disabled':'')+'>−</button>'
        +'<span class="ep" data-cnt="'+esc(x.k)+'">'+fa(cur)+' / '+fa(tot||0)+'</span>'
        +'<button type="button" data-inc="'+esc(x.k)+'" '+(canInc(x)?'':'disabled')+'>+</button></div>';
    } else {
      step='<div class="meta" style="margin-top:8px;text-align:center;color:#7fe3c3">فصل '+fa(x.season||1)+(tot?(' · '+fa(cur)+'/'+fa(tot)):'')+'</div>';
    }
    var metaLine='فصل '+fa(x.season||1);
    if(tot>0) metaLine+=' · '+fa(cur)+' از '+fa(tot);
    if(x.seasonKnown && (tot===0 || mw<tot)) metaLine+=' <span style="opacity:.8">(پخش '+fa(mw)+')</span>';
    return '<article class="sx-card" data-open="'+esc(x.k)+'" title="'+esc(name)+'">'+badge
      +'<img src="'+esc(posterSrc(meta,name))+'" alt="" loading="lazy" decoding="async">'
      +'<div class="shade"><div class="title">'+esc(name)+'</div>'
      +'<div class="meta">'+metaLine+'</div>'
      +'<div class="bar'+(waiting?' done':'')+'"><i style="width:'+(waiting&&tot&&cur>=tot?100:pct)+'%"></i></div>'
      +step+'</div></article>';
  }
  function cardDone(x){
    var meta=S(x.k), name=meta.name||x.k||'سریال';
    return '<article class="sx-card" data-open="'+esc(x.k)+'" title="'+esc(name)+'">'
      +'<span class="sx-badge done">تمام</span>'
      +'<img src="'+esc(posterSrc(meta,name))+'" alt="" loading="lazy" decoding="async">'
      +'<div class="shade"><div class="title">'+esc(name)+'</div>'
      +'<div class="meta">'+esc(gfa((meta.genres||[])[0]||'')||'سریال')+(meta.year?(' · '+fa(meta.year)):'')+'</div></div></article>';
  }
  function cardList(x){
    var meta=S(x.k), name=meta.name||x.k||'سریال';
    return '<article class="sx-card" data-open="'+esc(x.k)+'" title="'+esc(name)+'">'
      +'<img src="'+esc(posterSrc(meta,name))+'" alt="" loading="lazy" decoding="async">'
      +'<div class="sx-hover"><button type="button" class="go" data-start="'+esc(x.k)+'">شروع</button>'
      +'<button type="button" class="no" data-skip="'+esc(x.k)+'">حذف</button></div>'
      +'<div class="shade"><div class="title">'+esc(name)+'</div>'
      +'<div class="meta">'+esc(gfa((meta.genres||[])[0]||'')||'واچ‌لیست')+(meta.year?(' · '+fa(meta.year)):'')+'</div></div></article>';
  }
  function emptyHtml(kind){
    var m={watching:['🍿','هنوز چیزی نمی‌بینی','از «افزودن» یا واچ‌لیست شروع کن'],waiting:['⏳','چیزی در انتظار فصل بعد نیست',''],done:['✅','سریال تمام‌شده‌ای نداری',''],list:['🔖','واچ‌لیست خالی است','سریال جدید اضافه کن']}[kind]||['📭','خالی',''];
    return '<div class="sx-empty"><b>'+m[0]+'</b>'+m[1]+(m[2]?'<div style="margin-top:6px;color:var(--muted)">'+m[2]+'</div>':'')+'</div>';
  }

  function render(){
    dedupeAll();
    var act=[], wait=[];
    WATCHING.forEach(function(x){ if(!matchQ(x)) return; if(isWaiting(x)) wait.push(x); else act.push(x); });
    var done=DONE.filter(matchQ), list=LIST.filter(matchQ);
    var box=document.getElementById('sxGrid'); if(!box) return;
    var html='';
    if(tab==='watching') html=act.length?act.map(function(x){return cardWatch(x,false)}).join(''):emptyHtml('watching');
    else if(tab==='waiting') html=wait.length?wait.map(function(x){return cardWatch(x,true)}).join(''):emptyHtml('waiting');
    else if(tab==='done') html=done.length?done.map(cardDone).join(''):emptyHtml('done');
    else html=list.length?list.map(cardList).join(''):emptyHtml('list');
    box.innerHTML=html;

    var allAct=WATCHING.filter(function(x){return !isWaiting(x)}).length;
    var allWait=WATCHING.filter(isWaiting).length;
    var nW=document.getElementById('nW'), nWait=document.getElementById('nWait'), nD=document.getElementById('nD'), nL=document.getElementById('nL');
    if(nW) nW.textContent=fa(allAct);
    if(nWait) nWait.textContent=fa(allWait);
    if(nD) nD.textContent=fa(DONE.length);
    if(nL) nL.textContent=fa(LIST.length);

    var st=document.getElementById('sxStats');
    if(st){
      var news=WATCHING.filter(function(x){return x.newEp && !isWaiting(x)}).length;
      st.innerHTML='<div class="sx-stat"><b>'+fa(allAct)+'</b><span>در حال دیدن</span></div>'
        +'<div class="sx-stat"><b style="color:var(--warn)">'+fa(allWait)+'</b><span>در انتظار</span></div>'
        +'<div class="sx-stat"><b style="color:var(--good)">'+fa(news)+'</b><span>قسمت تازه</span></div>'
        +'<div class="sx-stat"><b>'+fa(DONE.length)+'</b><span>تمام‌شده</span></div>';
    }
    var newsList=WATCHING.filter(function(x){return x.newEp && !isWaiting(x)});
    var strip=document.getElementById('sxAlert');
    if(strip){
      if(newsList.length){
        strip.classList.add('show');
        document.getElementById('sxAlertText').textContent=newsList.slice(0,4).map(function(x){return S(x.k).name||x.k}).join(' · ')+(newsList.length>4?(' و '+fa(newsList.length-4)+' دیگر'):'');
      } else strip.classList.remove('show');
    }
    document.querySelectorAll('.sx-tab').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-t')===tab); });
  }

  function applyCur(w,v){
    if(!w) return;
    clampCur(w);
    var tot=Math.max(Number(w.tot)||0,0);
    var mw=maxWatchable(w);
    v=parseInt(v,10);
    if(!Number.isFinite(v)) v=Number(w.cur)||0;
    if(v>(Number(w.cur)||0)){
      if(!w.seasonKnown){
        toast('در حال همگام‌سازی قسمت‌ها…');
        ensureSeasonTot(w,true).then(function(){ render(); });
        return;
      }
      if(v>mw){
        toast(tot>0 && mw>=tot ? 'فصل کامل است' : ('فقط '+fa(mw)+' قسمت پخش شده'));
        v=mw;
      }
    }
    v=Math.max(0,v);
    if(w.seasonKnown) v=Math.min(v, mw);
    if(v===w.cur){ render(); return; }
    var old=w.cur; w.cur=v; if(v>old) w.newEp=false;
    var meta=S(w.k);
    if(tot>0 && v>=tot && isShowEnded(meta)){
      var seas=meta.bySeason||{};
      var maxS=Object.keys(seas).map(Number).filter(function(n){return n>0}).sort(function(a,b){return b-a})[0]||(w.season||1);
      if((w.season||1)>=maxS){
        WATCHING=WATCHING.filter(function(x){return x.k!==w.k});
        if(!DONE.some(function(d){return d.k===w.k})) DONE.push({k:w.k,id:w.id,tvmazeId:w.tvmazeId});
        toast((meta.name||w.k)+' → تمام‌شده');
        patchMovie(w.id,{status:'completed',currentEpisode:v,totalEpisodes:tot,currentSeason:w.season,airedInSeason:w.aired});
        closeDetail(); render(); return;
      }
    }
    patchMovie(w.id,{status:'watching',currentEpisode:v,totalEpisodes:tot||null,currentSeason:w.season||1,airedInSeason:w.aired});
    render();
  }
  function advanceSeason(w){
    if(!w) return;
    var meta=S(w.k);
    var ns=(Number(w.season)||1)+1;
    function go(){
      meta=S(w.k);
      var next=meta.bySeason&&(meta.bySeason[ns]||meta.bySeason[String(ns)]);
      if(!next||!(Number(next.total)>0||Number(next.aired)>0)){
        toast('فصل '+fa(ns)+' وجود ندارد');
        return;
      }
      w.season=ns; w.cur=0;
      w.tot=Number(next.total)||Number(next.aired)||0;
      w.aired=Number(next.aired)||0; w.cap=w.aired; w.seasonKnown=true;
      clampCur(w);
      patchMovie(w.id,{status:'watching',currentSeason:w.season,currentEpisode:0,totalEpisodes:w.tot,airedInSeason:w.aired});
      toast('فصل '+fa(w.season)+' · '+fa(w.tot)+' قسمت · پخش '+fa(w.aired));
      render();
    }
    if(meta.bySeason&&(meta.bySeason[ns]||meta.bySeason[String(ns)])) go();
    else ensureSeasonTot(w,true).then(go);
  }
  function findWatch(k){return WATCHING.find(function(x){return x.k===k})}
  function findList(k){return LIST.find(function(x){return x.k===k})}
  function findDone(k){return DONE.find(function(x){return x.k===k})}

  var ovl=document.getElementById('sxOvl');
  var detail=document.getElementById('sxDetail');
  function openDetail(k){
    var meta=S(k), w=findWatch(k), li=findList(k), dn=findDone(k);
    if(dn&&w) w=null;
    var name=meta.name||k, waiting=w&&isWaiting(w), ended=isShowEnded(meta);
    var chip, upd, acts='';
    if(dn){
      chip='<span class="sx-chip end">تمام‌کرده‌ام</span>';
      upd='این سریال را تمام کرده‌ای.';
      acts='<button type="button" class="p" data-rew="'+esc(k)+'">از اول شروع</button>';
    } else if(w){
      chip='<span class="sx-chip run">'+(waiting?'در انتظار فصل بعد':'در حال دیدن')+'</span>';
      if(waiting){
        if(meta.next&&meta.next.date){
          var d=daysTo(meta.next.date);
          upd=d>0?('فصل '+fa(w.season||1)+' کامل. فصل بعد: '+nextWhen(meta.next.date)+' ('+fa(d)+' روز)'):'فصل بعد رسیده.';
        } else upd='فصل '+fa(w.season||1)+' کامل — منتظر فصل بعد.';
        acts='<button type="button" class="g" data-arch="'+esc(k)+'">پایان سریال</button>';
      } else {
        clampCur(w);
        var mw=maxWatchable(w), tot=Number(w.tot)||0;
        upd='فصل '+fa(w.season||1)+' · قسمت '+fa(w.cur)+' از '+(tot?fa(tot):'؟')
          +(w.seasonKnown?(' · پخش‌شده '+fa(mw)):' · همگام‌سازی…');
        acts='';
        if(tot>0 && w.cur>=tot){
          var ns=(Number(w.season)||1)+1;
          var n=S(k).bySeason&&(S(k).bySeason[ns]||S(k).bySeason[String(ns)]);
          if(n&&(Number(n.total)>0||Number(n.aired)>0))
            acts+='<button type="button" class="p" data-adv="'+esc(k)+'">شروع فصل '+fa(ns)+'</button>';
        } else if(canInc(w)){
          acts+='<button type="button" class="p" data-p1="'+esc(k)+'">+۱ قسمت</button>';
        } else {
          acts+='<button type="button" class="p" disabled>+۱ قسمت</button>';
        }
        acts+='<button type="button" class="g" data-arch="'+esc(k)+'">پایان سریال</button>';
      }
    } else if(li){
      chip='<span class="sx-chip list">واچ‌لیست</span>';
      upd=ended?'پخش تمام شده.':'در واچ‌لیست.';
      acts='<button type="button" class="p" data-start="'+esc(k)+'">شروع کردم</button><button type="button" class="g" data-skip="'+esc(k)+'">حذف</button>';
    } else { chip=''; upd=''; }
    var ps=posterSrc(meta,name);
    detail.innerHTML='<div class="sx-dcover"><button type="button" class="x" id="sxDx">✕</button><img src="'+esc(ps)+'" alt=""></div>'
      +'<img class="sx-dposter" src="'+esc(ps)+'" alt=""><div class="sx-dbody"><h3>'+esc(name)+'</h3>'+chip
      +(upd?'<div class="sx-upd">'+esc(upd)+'</div>':'')
      +'<p class="sx-dsum">'+esc(meta.summary||'خلاصه‌ای نیست.')+'</p>'
      +'<div class="sx-dactions">'+acts+'</div>'
      +'<div class="sx-dmeta">'+(meta.network?('شبکه: '+esc(meta.network)+'<br>'):'')+(meta.year?('سال: '+fa(meta.year)+'<br>'):'')+(meta.genres&&meta.genres.length?('ژانر: '+esc(meta.genres.map(gfa).join(' · '))):'')+'</div></div>';
    detail.classList.add('open'); ovl.classList.add('show');
    var dx=document.getElementById('sxDx'); if(dx) dx.onclick=closeDetail;
  }
  function closeDetail(){
    detail.classList.remove('open');
    if(!document.getElementById('sxAdd').classList.contains('open') && !document.getElementById('sxImport').classList.contains('open')) ovl.classList.remove('show');
  }
  function closeAll(){
    closeDetail();
    document.getElementById('sxAdd').classList.remove('open');
    document.getElementById('sxImport').classList.remove('open');
    ovl.classList.remove('show');
  }

  function startSeries(k){
    var it=findList(k); if(!it){ toast('در لیست نیست'); return; }
    LIST=LIST.filter(function(x){return x.k!==k});
    var row={k:k,cur:0,tot:0,season:1,newEp:false,id:it.id,tvmazeId:it.tvmazeId,tmdbId:it.tmdbId,aired:null,seasonKnown:false};
    WATCHING=WATCHING.filter(function(x){return x.k!==k});
    WATCHING.unshift(row);
    tab='watching'; render();
    toast((S(k).name||k)+' → همگام‌سازی فصل ۱…');
    patchMovie(it.id,{status:'watching',currentEpisode:0,currentSeason:1});
    ensureSeasonTot(row,true).then(function(){
      clampCur(row);
      if(!(row.tot>0)) toast('تعداد قسمت از TVMaze نیامد');
      else toast((S(k).name||k)+' · فصل ۱ · '+fa(row.tot)+' قسمت · پخش‌شده '+fa(row.aired||0));
      patchMovie(it.id,{status:'watching',currentEpisode:0,currentSeason:1,totalEpisodes:row.tot||null,airedInSeason:row.aired,seasonEpisodes:S(k).bySeason||null});
      render();
    });
  }
  function skipSeries(k){
    var it=findList(k);
    LIST=LIST.filter(function(x){return x.k!==k});
    if(it&&it.id) fetch('/api/movies/'+encodeURIComponent(it.id),{method:'DELETE',credentials:'include'}).catch(function(){});
    toast('حذف شد'); render();
  }

  document.getElementById('sxGrid').addEventListener('click', function(e){
    var b;
    if(b=e.target.closest('[data-dec]')){ e.preventDefault(); e.stopPropagation(); var w=findWatch(b.getAttribute('data-dec')); if(w) applyCur(w,w.cur-1); return; }
    if(b=e.target.closest('[data-adv]')){ e.preventDefault(); e.stopPropagation(); var w=findWatch(b.getAttribute('data-adv')); if(w) advanceSeason(w); return; }
    if(b=e.target.closest('[data-inc]')){ e.preventDefault(); e.stopPropagation(); var w=findWatch(b.getAttribute('data-inc')); if(w){ if(!canInc(w)){ if(!w.seasonKnown){ toast('همگام‌سازی…'); ensureSeasonTot(w,true).then(render); } else toast('فقط '+fa(maxWatchable(w))+' قسمت پخش شده'); return; } applyCur(w,w.cur+1);} return; }
    if(b=e.target.closest('[data-cnt]')){ e.preventDefault(); e.stopPropagation(); editCnt(b); return; }
    if(b=e.target.closest('[data-start]')){ e.preventDefault(); e.stopPropagation(); startSeries(b.getAttribute('data-start')); return; }
    if(b=e.target.closest('[data-skip]')){ e.preventDefault(); e.stopPropagation(); skipSeries(b.getAttribute('data-skip')); return; }
    var c=e.target.closest('[data-open]'); if(c) openDetail(c.getAttribute('data-open'));
  });
  detail.addEventListener('click', function(e){
    var b;
    if(b=e.target.closest('[data-adv]')){ var w=findWatch(b.getAttribute('data-adv')); if(w) advanceSeason(w); closeDetail(); return; }
    if(b=e.target.closest('[data-p1]')){ var w=findWatch(b.getAttribute('data-p1')); if(w){ if(!canInc(w)){ toast(w.seasonKnown?('فقط '+fa(maxWatchable(w))+' قسمت پخش شده'):'همگام‌سازی…'); if(!w.seasonKnown) ensureSeasonTot(w,true).then(render); closeDetail(); return; } applyCur(w,w.cur+1);} closeDetail(); return; }
    if(b=e.target.closest('[data-arch]')){
      var key=b.getAttribute('data-arch'); var w=findWatch(key);
      if(w){ WATCHING=WATCHING.filter(function(x){return x.k!==key}); if(!DONE.some(function(d){return d.k===key})) DONE.push({k:key,id:w.id}); patchMovie(w.id,{status:'completed'}); toast((S(key).name||key)+' → تمام‌شده'); render(); }
      closeDetail(); return;
    }
    if(b=e.target.closest('[data-start]')){ startSeries(b.getAttribute('data-start')); closeDetail(); return; }
    if(b=e.target.closest('[data-skip]')){ skipSeries(b.getAttribute('data-skip')); closeDetail(); return; }
    if(b=e.target.closest('[data-rew]')){
      var rk=b.getAttribute('data-rew'); var d0=findDone(rk); var id=d0&&d0.id;
      DONE=DONE.filter(function(x){return x.k!==rk}); WATCHING=WATCHING.filter(function(x){return x.k!==rk});
      var row={k:rk,cur:0,tot:0,season:1,newEp:false,id:id,tvmazeId:(d0&&d0.tvmazeId)||null,aired:null,seasonKnown:false};
      WATCHING.push(row);
      patchMovie(id,{status:'watching',currentEpisode:0,currentSeason:1});
      toast((S(rk).name||rk)+' → از اول'); closeDetail();
      ensureSeasonTot(row,true).then(function(){ clampCur(row); patchMovie(id,{totalEpisodes:row.tot||null,currentSeason:1,currentEpisode:0,airedInSeason:row.aired}); render(); });
      render();
    }
  });
  function editCnt(el){
    var k=el.getAttribute('data-cnt'), w=findWatch(k); if(!w) return;
    clampCur(w);
    if(!w.seasonKnown){ toast('اول همگام‌سازی'); ensureSeasonTot(w,true).then(render); return; }
    var done=false, inp=document.createElement('input');
    inp.type='number'; inp.min='0'; inp.max=String(maxWatchable(w)); inp.value=String(w.cur);
    inp.style.cssText='flex:1;min-width:0;background:rgba(10,14,26,.95);border:1px solid var(--acc);border-radius:8px;color:#fff;font-size:12.5px;text-align:center;font-family:var(--fh);direction:ltr;padding:3px 4px';
    el.replaceWith(inp); inp.focus(); inp.select();
    function commit(){ if(done)return; done=true; applyCur(w, parseInt(inp.value,10)); }
    inp.addEventListener('blur', commit);
    inp.addEventListener('keydown', function(e){ if(e.key==='Enter') commit(); if(e.key==='Escape'){ done=true; render(); } });
  }

  document.querySelectorAll('.sx-tab').forEach(function(btn){
    btn.addEventListener('click', function(){ tab=btn.getAttribute('data-t')||'watching'; render(); });
  });
  var search=document.getElementById('sxSearch');
  if(search){ var deb; search.addEventListener('input', function(){ clearTimeout(deb); deb=setTimeout(function(){ q=String(search.value||'').trim().toLowerCase(); render(); },120); }); }
  document.getElementById('sxAlertSaw').addEventListener('click', function(){
    WATCHING.forEach(function(w){ if(w.newEp && !isWaiting(w) && canInc(w)) applyCur(w, w.cur+1); });
    toast('ثبت شد');
  });
  ovl.addEventListener('click', closeAll);

  var mb=document.getElementById('modeBtn');
  if(mb){
    try{ if(localStorage.getItem('lifeos-mode')==='light'){document.documentElement.dataset.mode='light';mb.textContent='☀️'} }catch(e){}
    mb.addEventListener('click', function(){ var r=document.documentElement,l=r.dataset.mode==='light'; r.dataset.mode=l?'dark':'light'; mb.textContent=l?'🌙':'☀️'; try{localStorage.setItem('lifeos-mode',r.dataset.mode)}catch(e){} });
  }

  /* Add */
  var addDrawer=document.getElementById('sxAdd'), addQ=document.getElementById('sxAddQ'), addRes=document.getElementById('sxAddRes');
  function openAdd(){ addDrawer.classList.add('open'); ovl.classList.add('show'); setTimeout(function(){ if(addQ) addQ.focus(); },150); }
  function closeAdd(){ addDrawer.classList.remove('open'); if(!detail.classList.contains('open')&&!document.getElementById('sxImport').classList.contains('open')) ovl.classList.remove('show'); }
  document.getElementById('sxAddBtn').addEventListener('click', openAdd);
  document.getElementById('sxAddClose').addEventListener('click', closeAdd);
  function alreadyHave(title, tvmazeId){
    var k=seriesKeyFromTitle(title);
    if(WATCHING.concat(DONE,LIST).some(function(x){return x.k===k})) return true;
    if(tvmazeId && WATCHING.concat(DONE,LIST).some(function(x){return String(x.tvmazeId||'')===String(tvmazeId)})) return true;
    return false;
  }
  var searchTimer=null;
  if(addQ) addQ.addEventListener('input', function(){
    clearTimeout(searchTimer);
    var t=addQ.value.trim();
    if(t.length<2){ addRes.innerHTML='<div class="sx-no">حداقل ۲ حرف…</div>'; return; }
    searchTimer=setTimeout(function(){ searchTv(t); }, 280);
  });
  function searchTv(t){
    addRes.innerHTML='<div class="sx-no">جستجو…</div>';
    fetch('/api/movies/tvmaze/search?q='+encodeURIComponent(t),{credentials:'include'})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
      .then(function(x){
        if(!x.ok){ addRes.innerHTML='<div class="sx-no">ناموفق</div>'; return; }
        var items=(x.d&&(x.d.items||x.d.results||x.d))||[];
        if(!Array.isArray(items)) items=[];
        items=items.map(function(it){
          var show=it.show||it;
          return {
            id: show.tvmazeId||show.id||it.tvmazeId||it.id,
            name: show.name||it.name||'',
            year: show.year||(show.premiered||it.premiered||'').toString().slice(0,4),
            img: show.posterUrl||it.posterUrl||(show.image&&(show.image.medium||show.image.original))||'',
            status: show.status||it.status||'',
            genres: show.genres||it.genres||[]
          };
        }).filter(function(it){return it.name && it.id});
        if(!items.length){ addRes.innerHTML='<div class="sx-no">نتیجه‌ای نبود</div>'; return; }
        addRes.innerHTML=items.slice(0,12).map(function(it){
          var have=alreadyHave(it.name,it.id);
          return '<div class="sx-hit"><img src="'+esc(posterSrc({img:it.img,name:it.name},it.name))+'" alt=""><div class="t"><b>'+esc(it.name)+'</b><small>'+esc([it.year,it.status].filter(Boolean).join(' · '))+'</small></div>'
            +'<button type="button" '+(have?'disabled':'')+' data-tv="'+esc(String(it.id))+'">'+(have?'هست':'افزودن')+'</button></div>';
        }).join('');
      }).catch(function(){ addRes.innerHTML='<div class="sx-no">خطای شبکه</div>'; });
  }
  addRes.addEventListener('click', function(e){
    var b=e.target.closest('[data-tv]'); if(!b||b.disabled) return;
    b.disabled=true; b.textContent='…';
    fetch('/api/movies/from-tvmaze',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({tvmazeId:Number(b.getAttribute('data-tv')),status:'watchlist'})})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
      .then(function(x){
        if(!x.ok){ toast((x.d&&x.d.error)||'خطا'); b.disabled=false; b.textContent='افزودن'; return; }
        toast(x.d&&x.d.already?'قبلاً بود':'به واچ‌لیست اضافه شد');
        loadFromApi().then(function(){ tab='list'; render(); closeAdd(); });
      }).catch(function(){ toast('شبکه'); b.disabled=false; b.textContent='افزودن'; });
  });

  /* Import */
  var impDrawer=document.getElementById('sxImport');
  function openImport(){ impDrawer.classList.add('open'); ovl.classList.add('show'); }
  function closeImport(){ impDrawer.classList.remove('open'); if(!detail.classList.contains('open')&&!addDrawer.classList.contains('open')) ovl.classList.remove('show'); }
  document.getElementById('sxImpBtn').addEventListener('click', openImport);
  document.getElementById('sxImpClose').addEventListener('click', closeImport);
  var libFileObj=null, watFileObj=null;
  function fileToBase64(file){ return new Promise(function(res,rej){ var fr=new FileReader(); fr.onload=function(){ var s=String(fr.result||''); var i=s.indexOf(','); res(i>=0?s.slice(i+1):s); }; fr.onerror=function(){rej(new Error('file'));}; fr.readAsDataURL(file); }); }
  document.getElementById('sxLibPick').addEventListener('click', function(){ document.getElementById('sxLibFile').click(); });
  document.getElementById('sxWatPick').addEventListener('click', function(){ document.getElementById('sxWatFile').click(); });
  document.getElementById('sxLibFile').addEventListener('change', function(e){ libFileObj=e.target.files&&e.target.files[0]; document.getElementById('sxLibName').textContent=libFileObj?libFileObj.name:'انتخاب نشده'; });
  document.getElementById('sxWatFile').addEventListener('change', function(e){ watFileObj=e.target.files&&e.target.files[0]; document.getElementById('sxWatName').textContent=watFileObj?watFileObj.name:'اختیاری'; });
  document.getElementById('sxDoImport').addEventListener('click', function(){
    if(!libFileObj){ toast('library.csv لازم است'); return; }
    var btn=this; btn.disabled=true; btn.textContent='…';
    Promise.all([fileToBase64(libFileObj), watFileObj?fileToBase64(watFileObj):Promise.resolve(null)])
      .then(function(arr){
        var body={libraryCsvBase64:arr[0]}; if(arr[1]) body.watchesCsvBase64=arr[1];
        return fetch('/api/movies/import-bingers/preview',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
          .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d}})})
          .then(function(prev){
            if(!prev.ok) throw new Error((prev.d&&prev.d.error)||'پیش‌نمایش ناموفق');
            var items=(prev.d&&prev.d.items)||[];
            var fresh=items.filter(function(it){ return it && !it.duplicate; });
            var dups=items.length-fresh.length;
            if(!fresh.length){
              btn.disabled=false; btn.textContent='درون‌ریزی';
              toast(dups?'همه تکراری بودند ('+fa(dups)+')':'چیزی برای ورود نیست');
              return null;
            }
            return fetch('/api/movies/import-bingers/commit',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:fresh})})
              .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d,dups:dups}})});
          });
      })
      .then(function(x){
        btn.disabled=false; btn.textContent='درون‌ریزی';
        if(x===null) return;
        if(!x||!x.ok){ toast((x&&x.d&&x.d.error)||'ناموفق'); return; }
        var d=x.d||{};
        toast(fa(d.imported||0)+' وارد شد · '+fa((d.skipped||0)+(x.dups||0))+' تکراری رد');
        loadFromApi().then(function(){ render(); closeImport(); });
      }).catch(function(e){ btn.disabled=false; btn.textContent='درون‌ریزی'; toast(e.message||'شبکه'); });
  });

  function loadFromApi(){
    return fetch('/api/movies?status=',{credentials:'include'})
      .then(function(r){ if(r.status===401){ location.href='/design/login-page.html'; return null; } return r.json(); })
      .then(function(d){
        if(!d||!Array.isArray(d.items)) return;
        WATCHING=[]; DONE=[]; LIST=[];
        var seenId={}, seenKey={};
        d.items.filter(function(it){ var ty=it.type||'series'; return ty==='series'||ty==='tv'; }).forEach(function(it){
          if(it.id && seenId[it.id]) return;
          if(it.id) seenId[it.id]=1;
          var title=it.title||'بدون‌عنوان';
          var k=seriesKeyFromTitle(title);
          upsertMeta(k, it);
          var st=it.status||'watchlist';
          var cur=Number(it.currentEpisode)||0;
          var season=Number(it.currentSeason)||1;
          var tot=Number(it.totalEpisodes)||0;
          var by=it.seasonEpisodes||null;
          var aired=it.airedInSeason!=null?Number(it.airedInSeason):null;
          if(by && (by[season]||by[String(season)])){
            var bs=by[season]||by[String(season)];
            tot=Number(bs.total)||Number(bs.aired)||tot;
            if(bs.aired!=null) aired=Number(bs.aired);
          }
          var row={k:k,cur:cur,tot:tot>0?tot:0,season:season,newEp:!!it.newEpisodeAvailable||!!it.newEpisode,id:it.id,tvmazeId:it.tvmazeId||null,tmdbId:it.tmdbId||null,aired:aired,seasonKnown:!!(by&&(by[season]||by[String(season)]))};
          if(row.seasonKnown) clampCur(row);
          if(st==='completed'||st==='dropped'){
            if(seenKey[k]==='done') return;
            WATCHING=WATCHING.filter(function(x){return x.k!==k});
            LIST=LIST.filter(function(x){return x.k!==k});
            if(!DONE.some(function(x){return x.k===k})) DONE.push({k:k,id:it.id,tvmazeId:row.tvmazeId,tmdbId:row.tmdbId});
            seenKey[k]='done';
          } else if(st==='watching'){
            if(seenKey[k]==='done') return;
            LIST=LIST.filter(function(x){return x.k!==k});
            if(seenKey[k]==='watching'){
              var ex=WATCHING.find(function(x){return x.k===k});
              if(ex){ if(cur>ex.cur) ex.cur=cur; if(tot>0) ex.tot=tot; if(aired!=null) ex.aired=aired; ex.season=season; if(!ex.id) ex.id=it.id; }
              return;
            }
            WATCHING.push(row); seenKey[k]='watching';
          } else {
            if(seenKey[k]) return;
            LIST.push({k:k,id:it.id,tvmazeId:row.tvmazeId,tmdbId:row.tmdbId});
            seenKey[k]='list';
          }
        });
        dedupeAll();
        WATCHING.slice().forEach(function(w){
          if(w.tot>0 && w.cur>=w.tot && isShowEnded(S(w.k))){
            var seas=(S(w.k).bySeason)||{};
            var maxS=Object.keys(seas).map(Number).filter(function(n){return n>0}).sort(function(a,b){return b-a})[0];
            if(maxS && (w.season||1)<maxS) return;
            WATCHING=WATCHING.filter(function(x){return x.k!==w.k});
            if(!DONE.some(function(d){return d.k===w.k})) DONE.push({k:w.k,id:w.id});
            patchMovie(w.id,{status:'completed'});
          }
        });
        render();
        /* Always re-sync every watching show from TVMaze */
        var chain=Promise.resolve();
        WATCHING.forEach(function(w){
          chain=chain.then(function(){ return ensureSeasonTot(w, true); });
        });
        chain.then(function(){ WATCHING.forEach(clampCur); render(); });
      }).catch(function(e){ console.error(e); toast('بارگذاری ناموفق'); });
  }

  fetch('/api/me',{credentials:'include'}).then(function(r){return r.json()}).then(function(d){
    var b=document.getElementById('navAuth'); if(!b) return;
    if(d&&d.user){
      b.innerHTML='<span class="navuser">'+esc(d.user.name||d.user.email||'')+'</span> <button type="button" class="navout" id="navOut">خروج</button>';
      var o=document.getElementById('navOut');
      if(o) o.onclick=function(){ fetch('/api/auth/logout',{method:'POST',credentials:'include'}).finally(function(){ location.href='/design/login-page.html'; }); };
    } else b.innerHTML='<a class="navin" href="/design/login-page.html">ورود</a>';
  }).catch(function(){});

  loadFromApi();
})();


```

---

## خانه — تکهٔ مرتبط

در `public/index.html`:

- کارت `.epcard` با `#epList` / `#epGoAll`
- `var EPS` + `renderEps()` + load از `dash.watchingSeries`

---

*برای اجرای واقعی همان `series-page.html` را باز کن / deploy کن.*
