// makeHelpers(env): every helper the API routes use (auth/PBKDF2, Tehran/Jalali dates, bank-SMS and free-text
// parsers, storage v2 on D1, Google Calendar, football, bets/poker, Telegram, AI…), closed over the Worker env.
// Split out of worker.js in 2026-10; the code itself is unchanged.

// در سطح ماژول (نه داخل makeHelpers) تا بین درخواست‌های مختلف روی همون Worker isolate باقی بمونه
let _usStocksCache = { at: 0, items: null };

// Football sources (varzesh3, footba11, ESPN, TheSportsDB, SofaScore) can hang for a minute or more from
// Cloudflare; with no deadline every league request waited 40–120 s (live logs, 2026-10). Calls to those hosts
// get an 8 s deadline so the next source in the fallback chain gets its turn. Other hosts are untouched.
const FOOTBALL_HOSTS = /(^|\.)(varzesh3\.com|footba11\.co|espn\.com|thesportsdb\.com|sofascore\.com)$/i;
const fetch = (url, options) => {
  let host = ''; try { host = new URL(typeof url === 'string' ? url : url.url).hostname; } catch {}
  if (FOOTBALL_HOSTS.test(host) && !(options && options.signal)) options = { ...(options || {}), signal: AbortSignal.timeout(8000) };
  return globalThis.fetch(url, options);
};
// League match lists, cached per isolate and in the colo cache: every Today page load asks for all 14 leagues.
// 10 min normally, 2 min while a match is live.
const LEAGUE_RANGE_MEM = new Map();


export function makeHelpers(env) {
  const GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI = env.GOOGLE_REDIRECT_URI, GOOGLE_CALENDAR_REDIRECT_URI = env.GOOGLE_CALENDAR_REDIRECT_URI,
        API_FOOTBALL_KEY = env.API_FOOTBALL_KEY, TMDB_API_KEY = env.TMDB_API_KEY, TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN,
        SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI = env.SPOTIFY_REDIRECT_URI,
        YOUTUBE_REDIRECT_URI = env.YOUTUBE_REDIRECT_URI, AI_PROVIDER_API_KEY = env.AI_PROVIDER_API_KEY, AI_PROVIDER_BASE_URL = env.AI_PROVIDER_BASE_URL || '', AI_MODEL = env.AI_MODEL || 'claude-sonnet-5',
        AI_PROVIDER2_API_KEY = env.AI_PROVIDER2_API_KEY, AI_PROVIDER2_BASE_URL = env.AI_PROVIDER2_BASE_URL || '', AI_MODEL2 = env.AI_MODEL2 || '',
        RAPIDAPI_KEY = env.RAPIDAPI_KEY, STOCK_API_KEY = env.STOCK_API_KEY;
  const GOOGLE_CALENDAR_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.app.created';
  const GOOGLE_CALENDAR_AUTH_URL = env.GOOGLE_CALENDAR_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth', GOOGLE_CALENDAR_TOKEN_URL = env.GOOGLE_CALENDAR_TOKEN_URL || 'https://oauth2.googleapis.com/token', GOOGLE_CALENDAR_API_BASE = env.GOOGLE_CALENDAR_API_BASE || 'https://www.googleapis.com/calendar/v3', GOOGLE_CALENDAR_USERINFO_URL = env.GOOGLE_CALENDAR_USERINFO_URL || 'https://www.googleapis.com/oauth2/v2/userinfo';

  function migrateCurrencyToRial(x){if(x._meta&&x._meta.currencyUnit==='IRR')return false;const scale=v=>typeof v==='number'&&isFinite(v)?Math.round(v*10*100)/100:v,fields=(rows,names,when)=>{for(const r of rows||[])if(!when||when(r))for(const n of names)if(r[n]!==undefined)r[n]=scale(r[n])};fields(x.transactions,['amount']);fields(x.accounts,['openingBalance']);fields(x.budgets,['limit']);fields(x.subscriptions,['amount']);for(const r of x.debts||[])if(r.currency!=='USD'){r.amount=scale(r.amount);r.currency='IRR'}fields(x.pokerSessions,['buyIn','cashOut']);fields(x.trips,['budget']);fields(x.investmentTx,['price','fee','amount'],r=>r.assetType==='gold'||r.assetType==='other');for(const r of x.assetPrices||[])if(r.currency==='IRT'||r.assetType==='gold'||r.assetType==='other'){r.price=scale(r.price);r.currency='IRR'}for(const s of x.portfolioSnapshots||[]){if(s.totals&&s.totals.IRT){let total=s.totals.IRT;for(const k of ['value','costBasis','unrealizedPnl','realizedPnl','dividends','fees'])if(total[k]!==undefined)total[k]=scale(total[k]);s.totals.IRR=total;delete s.totals.IRT}}x._meta=x._meta||{};x._meta.currencyUnit='IRR';x._meta.currencyMigratedAt=new Date().toISOString();return true}

  // Storage v2 --------------------------------------------------------------
  // Legacy releases stored the complete app in kv/db. That means one growing
  // user collection could make *all* writes fail at D1's per-row size limit.
  // V2 groups user-owned arrays by user, then splits every array into small,
  // deterministic JSON chunks. These constants leave ample headroom below the
  // documented 2 MB D1 row-value limit.
  const STATE_V2_PREFIX='state:v2:', STATE_V2_META='state:v2:meta', LEGACY_DB_KEY='db', MAX_STATE_SHARD_BYTES=1600000;
  const stateTextBytes=text=>new TextEncoder().encode(text).byteLength;
  const stateKeyPart=value=>encodeURIComponent(String(value));
  const stateKeyValue=name=>STATE_V2_PREFIX+'g:v:'+stateKeyPart(name);
  const stateKeyArray=(name,part)=>STATE_V2_PREFIX+'g:a:'+stateKeyPart(name)+':'+part;
  const stateKeyUser=(userId,name,part)=>STATE_V2_PREFIX+'u:'+stateKeyPart(userId)+':'+stateKeyPart(name)+':'+part;
  const stateKeyCol=(userId,name,part)=>STATE_V2_PREFIX+'c:'+stateKeyPart(userId)+':'+stateKeyPart(name)+':'+part;
  const emptyState=()=>({users:[],sessions:[],transactions:[],tasks:[],inbox:[],daily:[]});
  function normalizeState(x){
    x=x&&typeof x==='object'?x:emptyState();
    x.investments ??= []; x.accounts ??= []; x.budgets ??= []; x.projects ??= []; x.timeEntries ??= []; x.habits ??= []; x.habitLogs ??= [];
    x.subscriptions ??= []; x.debts ??= []; x.footballTeams ??= []; x.matches ??= []; x.news ??= []; x.movies ??= []; x.timers ??= [];
    x.exercise ??= []; x.weeklyNotes ??= []; x.mediaLog ??= []; x.investmentTx ??= []; x.assetPrices ??= []; x.priceAlerts ??= []; x.portfolioSnapshots ??= []; x.assetPriceHistory ??= []; x.newsSources ??= []; x.contacts ??= []; x.contactLogs ??= []; x.learning ??= []; x.bookmarks ??= []; x.shoppingItems ??= []; x.trips ??= []; x.tripChecklist ??= []; x.documents ??= []; x.betDays ??= []; x.goals ??= []; x.wins ??= []; x.decisions ??= []; x.lifeReviews ??= []; x.pokerSessions ??= []; x.reminders ??= []; x.telegramLinkCodes ??= []; x.daily ??= []; x.tasks ??= []; x.inbox ??= [];
    x.col??={};
    return x;
  }
  function isUserOwnedArray(rows){return Array.isArray(rows)&&rows.length>0&&rows.every(row=>row&&typeof row==='object'&&typeof row.userId==='string'&&row.userId)}
  function appendStateArray(out,keyFor,rows){
    let part=0,pieces=[],size=2;
    const flush=()=>{out.set(keyFor(part++),'['+pieces.join(',')+']');pieces=[];size=2};
    for(const row of rows){let text=JSON.stringify(row);if(text===undefined)text='null';let bytes=stateTextBytes(text)+(pieces.length?1:0);if(bytes+2>MAX_STATE_SHARD_BYTES)throw new Error('یک مورد داده‌ای از حد امن ذخیره‌سازی بزرگ‌تر است.');if(pieces.length&&size+bytes>MAX_STATE_SHARD_BYTES)flush();pieces.push(text);size+=stateTextBytes(text)+(pieces.length>1?1:0)}
    if(pieces.length||!rows.length)flush();
  }
  function serializeState(db){
    const out=new Map(),addValue=(key,value)=>{let text=JSON.stringify(value);if(text===undefined)return;if(stateTextBytes(text)>MAX_STATE_SHARD_BYTES)throw new Error('یک بخش از داده‌ها از حد امن ذخیره‌سازی بزرگ‌تر است.');out.set(key,text)},addRows=(keyFor,rows)=>appendStateArray(out,keyFor,Array.isArray(rows)?rows:[]),addOwned=(keyFor,rows)=>{let groups=new Map();for(const row of rows){let uid=String(row.userId);let list=groups.get(uid);if(!list)groups.set(uid,list=[]);list.push(row)}for(const [uid,list]of groups)addRows(part=>keyFor(uid,part),list)};
    for(const [name,value]of Object.entries(db)){
      if(name==='col'&&value&&typeof value==='object'){
        for(const [colName,rows]of Object.entries(value)){
          if(isUserOwnedArray(rows))addOwned((uid,part)=>stateKeyCol(uid,colName,part),rows);
          else addRows(part=>stateKeyArray('col:'+colName,part),rows);
        }
      }else if(Array.isArray(value)){
        if(isUserOwnedArray(value))addOwned((uid,part)=>stateKeyUser(uid,name,part),value);
        else addRows(part=>stateKeyArray(name,part),value);
      }else addValue(stateKeyValue(name),value);
    }
    return out;
  }
  function attachStorageState(db,mode,chunks){
    Object.defineProperties(db,{__storageMode:{value:mode,writable:true,configurable:true},__storageChunks:{value:chunks,writable:true,configurable:true}});
    return db;
  }
  async function runStateBatch(statements){
    if(!statements.length)return;
    if(typeof env.DB.batch==='function')return env.DB.batch(statements);
    for(const statement of statements)await statement.run();
  }
  async function stateMarker(){return env.DB.prepare('SELECT value FROM kv WHERE key=?').bind(STATE_V2_META).first()}
  async function readStateRows(){let r=await env.DB.prepare('SELECT key,value FROM kv WHERE key LIKE ?').bind(STATE_V2_PREFIX+'%').all();return r&&r.results||[]}
  function rebuildState(rows){
    let db=emptyState(),arrays=new Map(),putArray=(name,part,items)=>{let list=arrays.get(name);if(!list)arrays.set(name,list=[]);list.push({part,items})};
    for(const row of rows){
      let key=String(row.key||''),value=JSON.parse(row.value);
      if(key.startsWith(STATE_V2_PREFIX+'g:v:')){db[decodeURIComponent(key.slice((STATE_V2_PREFIX+'g:v:').length))]=value;continue}
      if(key.startsWith(STATE_V2_PREFIX+'g:a:')){let parts=key.slice((STATE_V2_PREFIX+'g:a:').length).split(':'),part=Number(parts.pop()),name=decodeURIComponent(parts.join(':'));putArray(name.startsWith('col:')?name:'root:'+name,part,value);continue}
      if(key.startsWith(STATE_V2_PREFIX+'u:')){let parts=key.slice((STATE_V2_PREFIX+'u:').length).split(':'),part=Number(parts.pop()),name=decodeURIComponent(parts.pop());putArray('root:'+name,part,value);continue}
      if(key.startsWith(STATE_V2_PREFIX+'c:')){let parts=key.slice((STATE_V2_PREFIX+'c:').length).split(':'),part=Number(parts.pop()),name=decodeURIComponent(parts.pop());putArray('col:'+name,part,value)}
    }
    for(const [name,chunks]of arrays){let items=chunks.sort((a,b)=>a.part-b.part).flatMap(x=>Array.isArray(x.items)?x.items:[]);if(name.startsWith('col:')){db.col??={};db.col[name.slice(4)]=items}else db[name.slice(5)]=items}
    return normalizeState(db);
  }
  function stateUpsert(key,value,at){return env.DB.prepare('INSERT INTO kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').bind(key,value,at)}
  async function activateStateV2(db){
    let chunks=serializeState(db),at=Date.now(),statements=[];
    for(const [key,value]of chunks)statements.push(stateUpsert(key,value,at));
    // The unique marker is committed in the same D1 batch as the shards and
    // legacy-row deletion. A racing request sees either legacy or a complete v2
    // snapshot, never a half-migrated one.
    statements.push(env.DB.prepare('INSERT INTO kv (key,value,updated_at) VALUES (?,?,?)').bind(STATE_V2_META,JSON.stringify({version:2,migratedAt:at,shards:chunks.size}),at));
    statements.push(env.DB.prepare('DELETE FROM kv WHERE key=?').bind(LEGACY_DB_KEY));
    await runStateBatch(statements);
    return attachStorageState(db,'v2',chunks);
  }
  // Blu bank «انتقال به سپرده / دریافت از سپرده (بنام …)» rows were imported as transfers between own accounts
  // (to a made-up «سپرده‌های بانکی» account). They are payments to / from people: out = expense in «انتقال»
  // (kept apart from spending like other transfers), in = income marked «درآمد لحاظ نشود». Runs once per state.
  function fixDepositTransfers(db){if(db._meta&&db._meta.depositXferFixed)return false;db._meta=db._meta||{};let n=0,DEP='سپرده‌های بانکی';for(const t of db.transactions||[]){if(t.kind!=='transfer'||(t.account!==DEP&&t.toAccount!==DEP))continue;if(t.toAccount===DEP){t.kind='expense'}else{t.kind='income';t.account=t.toAccount||'بدون حساب';t.notIncome=true}delete t.toAccount;t.category='انتقال';n++}db._meta.depositXferFixed=true;return true}
  async function read(){
    // /api/bundle reads the state once and hands it to each sub-request (reading it is the slow part)
    if(env&&env.__sharedDb)return env.__sharedDb;
    let marker=await stateMarker();
    if(marker){let rows=await readStateRows(),db=attachStorageState(rebuildState(rows),'v2',new Map(rows.filter(r=>r.key!==STATE_V2_META).map(r=>[r.key,r.value])));let mig=migrateCurrencyToRial(db);if(fixDepositTransfers(db))mig=true;if(mig)await write(db);return db}
    let legacy=await env.DB.prepare('SELECT value FROM kv WHERE key=?').bind(LEGACY_DB_KEY).first(),db=normalizeState(legacy?JSON.parse(legacy.value):emptyState());
    migrateCurrencyToRial(db);
    try{return await activateStateV2(db)}catch(error){
      // A simultaneous first request may have created the unique marker. In
      // that case discard this stale legacy snapshot and load the winner.
      if(await stateMarker())return read();
      throw error;
    }
  }
  // Optimistic concurrency. Two requests that read the same snapshot used to
  // overwrite each other's shard: e.g. a slow proxied save (seyfikhani panel)
  // landing after the next edits wiped a whole project checklist except a tick
  // or two. Every shard a write touches is now checked, inside the same D1
  // batch, against the value it was read with; on a mismatch the batch rolls
  // back, the fresh state is re-read and this request's own changes are
  // replayed onto it (3-way merge: rows by id, then field by field).
  const GUARD_SAME="INSERT INTO kv (key,value,updated_at) SELECT ?,'',0 WHERE NOT EXISTS (SELECT 1 FROM kv WHERE key=? AND value=?)";
  const GUARD_ABSENT="INSERT INTO kv (key,value,updated_at) SELECT ?,'',0 WHERE EXISTS (SELECT 1 FROM kv WHERE key=?)";
  function mergeState(base,ours,theirs){
    let o=JSON.stringify(ours),b=JSON.stringify(base);
    if(o===b)return theirs;
    let t=JSON.stringify(theirs);
    if(t===b||t===o)return ours;
    const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),hasIds=v=>Array.isArray(v)&&v.every(r=>isObj(r)&&r.id!=null);
    if(hasIds(base)&&hasIds(ours)&&hasIds(theirs)){
      let bm=new Map(base.map(r=>[String(r.id),r])),om=new Map(ours.map(r=>[String(r.id),r])),seen=new Set(),out=[];
      for(const r of theirs){let k=String(r.id),br=bm.get(k),or=om.get(k);seen.add(k);if(br&&!or)continue;out.push(!or?r:br?mergeState(br,or,r):or)}
      for(const r of ours){let k=String(r.id);if(!seen.has(k)&&!bm.has(k))out.push(r)}
      return out;
    }
    if(isObj(base)&&isObj(ours)&&isObj(theirs)){
      let out={};for(const k of new Set([...Object.keys(theirs),...Object.keys(ours),...Object.keys(base)])){let v=mergeState(base[k],ours[k],theirs[k]);if(v!==undefined)out[k]=v}
      return out;
    }
    return ours;
  }
  async function write(db){
    if(db.__storageMode!=='v2'){
      await stateUpsert(LEGACY_DB_KEY,JSON.stringify(db),Date.now()).run();
      return;
    }
    for(let attempt=0;;attempt++){
      let next=serializeState(db),before=db.__storageChunks||new Map(),at=Date.now(),guards=[],statements=[];
      const guard=key=>{let old=before.get(key);guards.push(old===undefined?env.DB.prepare(GUARD_ABSENT).bind(STATE_V2_META,key):env.DB.prepare(GUARD_SAME).bind(STATE_V2_META,key,old))};
      for(const [key,value]of next)if(before.get(key)!==value){guard(key);statements.push(stateUpsert(key,value,at))}
      for(const key of before.keys())if(!next.has(key)){guard(key);statements.push(env.DB.prepare('DELETE FROM kv WHERE key=?').bind(key))}
      try{await runStateBatch([...guards,...statements]);attachStorageState(db,'v2',next);return}
      catch(error){
        if(attempt>=5||!/UNIQUE/i.test(String(error&&error.message||error)))throw error;
        let fresh=await read(),base=rebuildState([...before].map(([key,value])=>({key,value}))),merged=mergeState(base,db,fresh);
        for(const k of Object.keys(db))if(!(k in merged))delete db[k];
        Object.assign(db,merged);attachStorageState(db,'v2',fresh.__storageChunks);
      }
    }
  }
  function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, max-age=0' }); res.end(JSON.stringify(data)) }
  async function body(req) { try { let t = await req.text(); return t ? JSON.parse(t) : {} } catch (e) { throw e } }
  function cookie(req) { return Object.fromEntries((req.headers.get('cookie') || '').split(';').filter(Boolean).map(x => x.trim().split('='))) }
  function sidCookie(sid){return 'sid='+sid+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000; Secure'}
  // Workers' Web Crypto PBKDF2 hard-caps iterations at 100,000 (Node's
  // crypto.pbkdf2Sync, used by server.js, has no such cap and uses 130,000).
  // This means password hashes from the Node server and this Worker are NOT
  // interchangeable — an account migrated from server.js needs its password
  // reset once on this deployment before it can log in here.
  const HASH_ITERATIONS = 100000;
  async function hash(password, salt) {
    let enc = new TextEncoder();
    let keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    let bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: HASH_ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);
    return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  function id() { return crypto.randomUUID() }
  function randHex(n) { let b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join('') }
  function timingSafeEqualHex(a, b) { if (a.length !== b.length) return false; let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i); return out === 0 }
  function b64(str) { return btoa(str) }
  function bytesFromBase64(b64str) { let bin = atob(b64str); let bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return bytes }
  function textFromBase64(b64str) { return new TextDecoder('utf-8').decode(bytesFromBase64(b64str)) }
  function today(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch(e){return new Date().toISOString().slice(0,10)}}

  const _rateMap = new Map();
  function clientIp(req){try{let h=req.headers;return (h.get&&(h.get('cf-connecting-ip')||h.get('x-forwarded-for'))||h['cf-connecting-ip']||h['x-forwarded-for']||'').toString().split(',')[0].trim()||'ip'}catch(e){return 'ip'}}
  function checkRateLimit(bucket, maxN, windowMs){maxN=maxN||5;windowMs=windowMs||900000;let now=Date.now(),e=_rateMap.get(bucket);if(!e||now>e.resetAt){e={count:0,resetAt:now+windowMs};_rateMap.set(bucket,e)}e.count++;if(e.count>maxN)return{ok:false,retrySec:Math.max(1,Math.ceil((e.resetAt-now)/1000))};return{ok:true,retrySec:0}}
  function clearRateLimit(bucket){_rateMap.delete(bucket)}
  function genLinkCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let b=new Uint8Array(8);crypto.getRandomValues(b);let out='';for(let i=0;i<8;i++)out+=a[b[i]%a.length];return out}
  async function hashPin(pin, salt){let enc=new TextEncoder();let keyMaterial=await crypto.subtle.importKey('raw',enc.encode(String(pin)),'PBKDF2',false,['deriveBits']);let bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(String(salt)),iterations:100000,hash:'SHA-256'},keyMaterial,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('')}

  class AuthError extends Error { }
  function me(req, db) { let sid = cookie(req).sid; let s = db.sessions.find(x => x.id === sid); let u = s && db.users.find(x => x.id === s.userId); return u && !u.disabled ? u : undefined }
  function auth(req, res, db) { let u = me(req, db); if (!u) { json(res, 401, { error: 'ابتدا وارد حساب شوید.' }); throw new AuthError() } return u }
  function accountBalances(db,userId){let balances={};db.transactions.filter(x=>x.userId===userId).forEach(x=>{let a=x.account||'بدون حساب';if(x.kind==='transfer'){balances[a]=(balances[a]||0)-x.amount;let b=x.toAccount||'بدون حساب';balances[b]=(balances[b]||0)+x.amount}else balances[a]=(balances[a]||0)+(x.kind==='income'?x.amount:-x.amount)});return db.accounts.filter(x=>x.userId===userId&&!x.archived).map(x=>{let balance=(x.openingBalance||0)+(balances[x.name]||0),r={...x,balance};if(x.smsBalance!=null)r.smsDiff=Number(x.smsBalance)-balance;return r})}
  // حسابی که پیامک‌های بانک به آن می‌نشینند: علامت‌خورده با sms، وگرنه حسابی به اسم «بلو».
  function bankSmsAccount(db,userId){let acc=(db.accounts||[]).filter(x=>x.userId===userId&&!x.archived);return acc.find(x=>x.sms)||acc.find(x=>/بلو|blu/i.test(x.name))||null}
  function jalaliToGregorianIso(jy,jm,jd){let gy;if(jy>979){gy=1600;jy-=979}else{gy=621}let days=(365*jy)+(Math.floor(jy/33)*8)+Math.floor(((jy%33)+3)/4)+78+jd+((jm<7)?(jm-1)*31:((jm-7)*30)+186);gy+=400*Math.floor(days/146097);days%=146097;if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++}gy+=4*Math.floor(days/1461);days%=1461;if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365}let gd=days+1,isLeap=(gy%4===0&&gy%100!==0)||(gy%400===0),sal=[0,31,isLeap?29:28,31,30,31,30,31,31,30,31,30,31],gm;for(gm=1;gm<=12;gm++){if(gd<=sal[gm])break;gd-=sal[gm]}return gy+'-'+String(gm).padStart(2,'0')+'-'+String(gd).padStart(2,'0')}
  function parseCsvRows(text){text=String(text||'');if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);text=text.replace(/^\uFEFF/,'');/* strip UTF-8 BOM leftovers */if(text.charCodeAt(0)===0xEF&&text.length>2){/* binary mistaken as latin1 rare */}let rows=[],row=[],field='',inQuotes=false;for(let i=0;i<text.length;i++){let c=text[i];if(inQuotes){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else inQuotes=false}else field+=c}else{if(c==='"')inQuotes=true;else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field);if(row.length>1||(row[0]&&String(row[0]).trim()))rows.push(row);row=[];field=''}else if(c==='\r'){}else field+=c}}if(field.length||row.length){row.push(field);if(row.length>1||(row[0]&&String(row[0]).trim()))rows.push(row)}/* strip BOM on first cell of first row */if(rows.length&&rows[0].length)rows[0][0]=String(rows[0][0]||'').replace(/^\uFEFF/,'');return rows}
  function findBankHeaderRow(rows){for(let i=0;i<rows.length;i++){let r=rows[i],cells=r.map(c=>String(c||''));if(cells.some(c=>/تاریخ/.test(c))&&cells.some(c=>/شرح/.test(c))&&cells.some(c=>/واریز|برداشت|بدهکار|بستانکار|مبلغ/.test(c)))return i}return -1}
  function bankColIndex(header,patterns){for(let i=0;i<header.length;i++){let cell=String(header[i]||'');if(patterns.some(p=>p.test(cell)))return i}return -1}
  function parseBankAmount(v,amountUnit){if(v==null)return 0;let s=enNum(String(v)).replace(/[,٬\s]/g,''),n=parseFloat(s);if(!isFinite(n)||n===0)return 0;return Math.round(n*(amountUnit==='IRT'?10:1))}
  function detectBankStatementAmountUnit(rows,hIdx){let heading=(rows.slice(0,hIdx+1).flat().map(x=>String(x||'')).join(' '));return /تومان|\bIRT\b/i.test(heading)?'IRT':'IRR'}
  function parseBankStatementRows(rows,amountUnit){let hIdx=findBankHeaderRow(rows);if(hIdx===-1)throw new Error('ساختار فایل شناخته نشد؛ ستون‌های تاریخ/شرح/مبلغ پیدا نشدن.');let unit=(amountUnit==='IRT'||amountUnit==='IRR')?amountUnit:detectBankStatementAmountUnit(rows,hIdx),header=rows[hIdx],col={date:bankColIndex(header,[/تاریخ/]),desc:bankColIndex(header,[/شرح/]),type:bankColIndex(header,[/نوع تراکنش|نوع/]),credit:bankColIndex(header,[/واریز|بستانکار/]),debit:bankColIndex(header,[/برداشت|بدهکار/]),doc:bankColIndex(header,[/شماره سند|شماره تراکنش/])};if(col.date===-1||col.desc===-1||(col.credit===-1&&col.debit===-1))throw new Error('ستون تاریخ، شرح یا مبلغ در فایل پیدا نشد.');let out=[];for(let i=hIdx+1;i<rows.length;i++){let r=rows[i];if(!r||!r.length)continue;let dateRaw=String(r[col.date]||'').trim(),desc=String(r[col.desc]||'').trim(),credit=col.credit!==-1?parseBankAmount(r[col.credit],unit):0,debit=col.debit!==-1?parseBankAmount(r[col.debit],unit):0;if(!dateRaw&&!desc&&!credit&&!debit)continue;let dm=enNum(dateRaw).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);if(!dm)continue;let date=jalaliToGregorianIso(Number(dm[1]),Number(dm[2]),Number(dm[3])),type=col.type!==-1?String(r[col.type]||'').trim():'',doc=col.doc!==-1?String(r[col.doc]||'').trim():'',isTransfer=false,toPerson=/^(انتقال به سپرده|دریافت از سپرده)$/.test(type),kind=credit>0?'income':(debit>0?'expense':null);if(!kind)continue;let amount=kind==='income'?credit:debit,beneficiary=(desc.match(/بنام:?\s*([^\-\n]+)/)||[])[1],title=type||(kind==='income'?'واریز بانکی':'برداشت بانکی');if(beneficiary)title+=' (بنام '+beneficiary.trim().replace(/\*/g,' ')+')';let category=isTransfer?'انتقال':(suggestCategoryKeyword(desc)||suggestCategoryKeyword(type)||'متفرقه');out.push({date,title,amount,kind:isTransfer?'transfer':kind,category:toPerson?'انتقال':category,...(toPerson&&kind==='income'?{notIncome:true}:{}),bankRef:doc?(doc+':'+amount+':'+date):null,rawType:type})}out.amountUnit=unit;return out}

    function txMatchKey(date,amount,kind){return String(date||'')+'|'+Math.round(Number(amount)||0)+'|'+String(kind||'')}
  // «کدام ردیف صورت‌حساب قبلاً وارد شده؟» — نه فقط با شمارهٔ سند بانکی: ردیف‌هایی که
  // دستی (یا از تلگرام/ثبت سریع) با همان تاریخ و مبلغ وارد شده‌اند هم باید شناخته شوند،
  // وگرنه درون‌ریزی دوباره‌شان می‌کند. هر «کلید» یک‌بار بیشتر مصرف نمی‌شود تا دو خرید
  // هم‌مبلغ در یک روز هر دو ثبت شوند (نه اینکه یکی «تکراری» حساب شود).
  function matchBankStatementItems(items,userTxs){let exact=new Map(),dayAmt=new Map(),near=new Map();const add=(m,k)=>m.set(k,(m.get(k)||0)+1),take=(m,k)=>{let n=m.get(k)||0;if(n<=0)return false;m.set(k,n-1);return true};for(const t of userTxs){let d=String(t.date||''),a=Math.round(Number(t.amount)||0);add(exact,txMatchKey(d,a,t.kind));add(dayAmt,d+'|'+a);for(const off of[-1,1]){let nd=addDaysIso(d,off);add(near,nd+'|'+a+'|'+String(t.kind||''))}}let already=0,nearCount=0,out=[];for(const it of items){if(it&&it.duplicate){out.push(it);continue}let d=String(it.date||''),a=Math.round(Number(it.amount)||0),k=txMatchKey(d,a,it.kind),lk=d+'|'+a;if(take(exact,k)){take(dayAmt,lk);already++;out.push(Object.assign({},it,{duplicate:true,dupReason:'same-date'}));continue}if(take(dayAmt,lk)){already++;out.push(Object.assign({},it,{duplicate:true,dupReason:'same-day-kind'}));continue}if(take(near,k)){nearCount++;out.push(Object.assign({},it,{nearDuplicate:true,dupReason:'near-date'}));continue}out.push(Object.assign({},it,{dupReason:null}))}return{items:out,alreadyCount:already,nearCount:nearCount,newCount:items.length-already}}
  function tehranJalaliParts(dateIso){try{let f=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric',day:'numeric'}),base=dateIso?new Date(String(dateIso).slice(0,10)+'T12:00:00Z'):new Date(),p={};for(const x of f.formatToParts(base))if(x.type!=='literal')p[x.type]=x.value;return{y:Number(p.year),m:Number(p.month),d:Number(p.day)}}catch(e){return null}}
  function jalaliMonthLabel(y,m){try{let iso=jalaliToGregorianIso(Number(y),Number(m),15);return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',month:'long'}).format(new Date(iso+'T12:00:00Z'))}catch(e){return String(y)+'/'+String(m)}}
  function jalaliDateLabel(dateIso){try{return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',day:'numeric',month:'long',year:'numeric'}).format(new Date(String(dateIso).slice(0,10)+'T12:00:00Z'))}catch(e){return String(dateIso)}}
  // یادآوری اول هر ماه شمسی: «صورت‌حساب بانکی ماه قبل را وارد کن». اگر همان ماه قبلاً
  // درون‌ریزی شده باشد (ردیفی با شمارهٔ سند در آن بازه) یادآوری ساخته نمی‌شود.
  async function ensureStatementReminder(db,dateIso,onlyUserId){let d0=String(dateIso||today()).slice(0,10),jp=tehranJalaliParts(d0);if(!jp||jp.d!==1)return{created:0,checked:false};const prev=jp.m===1?{y:jp.y-1,m:12}:{y:jp.y,m:jp.m-1},from=jalaliToGregorianIso(prev.y,prev.m,1),to=addDaysIso(jalaliToGregorianIso(jp.y,jp.m,1),-1),tag='bank-import:'+prev.y+'-'+String(prev.m).padStart(2,'0'),label=jalaliMonthLabel(prev.y,prev.m);db.reminders??=[];db.transactions??=[];let created=0;for(const user of db.users){if(onlyUserId&&user.id!==onlyUserId)continue;if(db.reminders.some(r=>r.userId===user.id&&r.auto===tag))continue;if(db.transactions.some(x=>x.userId===user.id&&x.bankRef&&x.date>=from&&x.date<=to))continue;db.reminders.push({id:id(),userId:user.id,title:'📥 صورت‌حساب بانکی «'+label+'» را وارد کن',date:d0,time:null,done:false,whenLabel:jalaliDateLabel(d0),createdAt:Date.now(),auto:tag,note:'بازهٔ '+from+' تا '+to+' — صفحهٔ مالی → ورود صورت‌حساب بانکی (Excel/CSV). ردیف‌هایی که قبلاً وارد کرده‌ای خودکار تشخیص داده می‌شوند و فقط جاافتاده‌ها اضافه می‌شوند.'});created++;if(TELEGRAM_BOT_TOKEN&&user.telegramUserId){try{await tgSend(user.telegramUserId,'📥 اول ماه است!\nصورت‌حساب بانکی «'+label+'» ('+from+' تا '+to+') را وارد کن تا تراکنش‌های جاافتاده پیدا شوند.\nصفحهٔ مالی → «ورود صورت‌حساب بانکی»',{reply_markup:tgMainKeyboard()})}catch(e){}}}return{created,checked:true,month:label,from,to,tag}}
  function betDaysOf(db,userId){return (db.betDays||[]).filter(x=>x.userId===userId)}
  function betAutoStart(db,userId,date){let prev=null;for(const x of (db.betDays||[])){if(x.userId!==userId||x.date>=date)continue;if(!prev||x.date>prev.date)prev=x}return prev?Number(prev.balance)||0:0}
  function betLatest(db,userId){let last=null;for(const x of (db.betDays||[])){if(x.userId!==userId)continue;if(!last||x.date>last.date)last=x}return last}
  // بخش «بت» (دلاری): هر روز مبلغی که ابتدای روز در حساب بت داشتم (خودکار از موجودی دیروز
// می‌آید)، واریز/برداشت اختیاری (پول تازه‌ای که اضافه/کم می‌کنم) و موجودی پایان روز.
// سود/زیان آن روز = موجودی پایان − مبلغ ابتدای روز − واریز + برداشت؛ پس پول اضافه‌شده
// اشتباهی «برد» حساب نمی‌شود. این بخش هیچ تراکنشی نمی‌سازد.
function betRollup(all,month){let items=[],prev=null,st={month:month||null,days:0,profit:0,wins:0,losses:0,pushes:0,deposits:0,withdrawals:0,winRate:0,best:null,worst:null,lastBalance:null};for(const d of (all||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.createdAt||0)-Number(b.createdAt||0))){let start=d.start!=null&&isFinite(Number(d.start))?Number(d.start):(prev!=null?prev:0),dep=Number(d.deposit)||0,wd=Number(d.withdraw)||0,bal=Number(d.balance)||0,result=Math.round((bal-start-dep+wd)*100)/100,row={id:d.id,date:d.date,start:start,deposit:dep,withdraw:wd,balance:bal,note:d.note||'',result:result,usdRate:Number(d.usdRate)||null};prev=bal;if(!month||(typeof month==='object'?(String(d.date)>=month.from&&String(d.date)<=month.to):String(d.date).startsWith(month))){items.push(row);st.days++;st.profit=Math.round((st.profit+result)*100)/100;st.deposits=Math.round((st.deposits+dep)*100)/100;st.withdrawals=Math.round((st.withdrawals+wd)*100)/100;if(result>0)st.wins++;else if(result<0)st.losses++;else st.pushes++;if(result!==0){if(!st.best||result>st.best.result)st.best=row;if(!st.worst||result<st.worst.result)st.worst=row}}}st.winRate=(st.wins+st.losses)?Math.round(st.wins/(st.wins+st.losses)*100):0;st.lastBalance=prev;return{items:items,stats:st}}
  function filterTransactions(db,userId,u){let from=u.searchParams.get('from'),to=u.searchParams.get('to'),month=u.searchParams.get('month'),account=u.searchParams.get('account'),category=u.searchParams.get('category'),minAmount=u.searchParams.get('minAmount'),maxAmount=u.searchParams.get('maxAmount');if(!from&&!to){month=month||today().slice(0,7);from=month+'-01';to=month+'-31'}return db.transactions.filter(x=>x.userId===userId&&x.date>=from&&x.date<=(to||from)&&(!account||x.account===account)&&(!category||x.category===category)&&(!minAmount||x.amount>=Number(minAmount))&&(!maxAmount||x.amount<=Number(maxAmount))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt)}
  function csvEscape(v){v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
  function nextRecurDate(date,rec){if(rec==='jmonthly'){let j=jParts(date);if(!j)return addDaysIso(date,30);let y=j.jy,m=j.jm+1;if(m>12){m=1;y++}let maxD=m<=6?31:m<12?30:(jalaliToGregorianIso(y+1,1,1)===addDaysIso(jalaliToGregorianIso(y,12,30),1)?30:29);return jalaliToGregorianIso(y,m,Math.min(j.jd,maxD))}let next=new Date(date+'T12:00:00');if(rec==='weekly')next.setDate(next.getDate()+7);else if(rec==='monthly')next.setMonth(next.getMonth()+1);else if(rec==='yearly')next.setFullYear(next.getFullYear()+1);else next.setDate(next.getDate()+1);return next.toISOString().slice(0,10)}
  function recurringChains(db,userId){let chains={};db.transactions.forEach(x=>{if(x.userId===userId&&x.recurrenceId)(chains[x.recurrenceId]=chains[x.recurrenceId]||[]).push(x)});return Object.values(chains).map(list=>{list.sort((a,b)=>b.date.localeCompare(a.date));return list})}
  function advanceRecurringTransactions(db,userId){let changed=false,t=today();for(const list of recurringChains(db,userId)){let latest=list[0];if(!latest.recurrence)continue;let guard=0,nextDate=nextRecurDate(latest.date,latest.recurrence);while(nextDate<=t&&guard++<24){if(!list.some(x=>x.date===nextDate)){let r={id:id(),userId,title:latest.title,amount:latest.amount,category:latest.category,kind:latest.kind,account:latest.account,date:nextDate,recurrence:latest.recurrence,recurrenceId:latest.recurrenceId,receipt:null,auto:true,createdAt:Date.now()};db.transactions.push(r);list.unshift(r);changed=true}nextDate=nextRecurDate(nextDate,latest.recurrence)}}return changed}
  function recurringList(db,userId){return recurringChains(db,userId).filter(l=>l[0].recurrence).map(l=>{let x=l[0];return{recurrenceId:x.recurrenceId,title:x.title,amount:x.amount,kind:x.kind,category:x.category,account:x.account,recurrence:x.recurrence,lastDate:x.date,nextDate:nextRecurDate(x.date,x.recurrence),count:l.length}}).sort((a,b)=>a.nextDate.localeCompare(b.nextDate))}
  function enNum(v){return String(v).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))}
  function tehranParts(d){try{let f=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false});let parts={};for(const p of f.formatToParts(d||new Date()))if(p.type!=='literal')parts[p.type]=p.value;return parts}catch(e){let x=d||new Date();return{year:String(x.getFullYear()),month:String(x.getMonth()+1).padStart(2,'0'),day:String(x.getDate()).padStart(2,'0'),weekday:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][x.getDay()],hour:String(x.getHours()).padStart(2,'0'),minute:String(x.getMinutes()).padStart(2,'0')}}}
  function addDaysIso(iso,n){let d=new Date(String(iso).slice(0,10)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Number(n||0));return d.toISOString().slice(0,10)}
  /* Google Calendar — least-privilege OAuth: read the user's visible calendars,
     and write only to the secondary calendar created by LifeOS. Managed events
     carry private metadata so synchronization is idempotent and deletions only
     ever touch events created by this app. */
  function googleCalendarConfigured(){return !!(GOOGLE_CLIENT_ID&&GOOGLE_CLIENT_SECRET&&GOOGLE_CALENDAR_REDIRECT_URI)}
  function googleCalendarStateCookie(state,maxAge){return 'google_calendar_state='+String(state||'')+'; HttpOnly; SameSite=Lax; Path=/; Max-Age='+String(maxAge==null?600:maxAge)+'; Secure'}
  function googleCalendarErrorMessage(e){let s=String(e&&e.message||e||'خطای ناشناخته');if(/has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(s))return 'Google Calendar API روی پروژهٔ گوگل فعال نیست؛ آن را در Google Cloud فعال کن و دوباره همگام‌سازی را بزن.';if(/invalid_grant|invalid credentials|unauthenticated|token.*expired/i.test(s))return 'مجوز گوگل منقضی یا لغو شده؛ تقویم را دوباره وصل کن.';return s.slice(0,320)}
  function googleCalendarAuthUrl(state){let q=new URLSearchParams({client_id:GOOGLE_CLIENT_ID||'',redirect_uri:GOOGLE_CALENDAR_REDIRECT_URI||'',response_type:'code',scope:GOOGLE_CALENDAR_SCOPES,access_type:'offline',include_granted_scopes:'true',prompt:'consent select_account',state:String(state||'')});return GOOGLE_CALENDAR_AUTH_URL+'?'+q.toString()}
  async function googleCalendarFetchJson(url,options){let o=Object.assign({},options||{});if(!o.signal&&typeof AbortSignal!=='undefined'&&AbortSignal.timeout)o.signal=AbortSignal.timeout(15000);let r=await fetch(url,o),text=await r.text(),data=null;if(text){try{data=JSON.parse(text)}catch(e){data={message:text.slice(0,500)}}}if(!r.ok){let msg=data&&data.error&&(data.error.message||data.error_description||data.error)||data&&data.error_description||data&&data.message||('Google HTTP '+r.status),err=new Error(String(msg));err.googleStatus=r.status;err.googleCode=data&&data.error&&data.error.status||data&&data.error||null;throw err}return data}
  async function googleCalendarApi(accessToken,apiPath,options){let o=Object.assign({},options||{}),headers=Object.assign({Accept:'application/json',Authorization:'Bearer '+accessToken},o.headers||{});if(o.body&&typeof o.body!=='string'){headers['Content-Type']='application/json';o.body=JSON.stringify(o.body)}o.headers=headers;let base=String(GOOGLE_CALENDAR_API_BASE||'').replace(/\/$/,'');return googleCalendarFetchJson(base+(String(apiPath||'').startsWith('/')?'':'/')+String(apiPath||''),o)}
  async function exchangeGoogleCalendarCode(code){return googleCalendarFetchJson(GOOGLE_CALENDAR_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(code||''),client_id:GOOGLE_CLIENT_ID||'',client_secret:GOOGLE_CLIENT_SECRET||'',redirect_uri:GOOGLE_CALENDAR_REDIRECT_URI||'',grant_type:'authorization_code'})})}
  async function googleCalendarAccessToken(user){if(!googleCalendarConfigured())throw new Error('تنظیمات Google Calendar کامل نیست.');if(!user||!user.googleCalendarRefreshToken){let e=new Error('Google Calendar وصل نیست.');e.googleStatus=401;throw e}let tok=await googleCalendarFetchJson(GOOGLE_CALENDAR_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:user.googleCalendarRefreshToken,client_id:GOOGLE_CLIENT_ID||'',client_secret:GOOGLE_CLIENT_SECRET||''})});if(!tok||!tok.access_token){let e=new Error(tok&&tok.error_description||'دسترسی Google Calendar منقضی شده؛ دوباره وصل کن.');e.googleStatus=401;throw e}return tok.access_token}
  async function googleCalendarAccount(accessToken){try{return await googleCalendarFetchJson(GOOGLE_CALENDAR_USERINFO_URL,{headers:{Accept:'application/json',Authorization:'Bearer '+accessToken}})||{}}catch(e){return{}}}
  async function ensureGoogleLifeosCalendar(user,accessToken){if(user.googleCalendarId){try{await googleCalendarApi(accessToken,'/calendars/'+encodeURIComponent(user.googleCalendarId));return user.googleCalendarId}catch(e){if(e.googleStatus!==403&&e.googleStatus!==404&&e.googleStatus!==410)throw e;user.googleCalendarId=null}}
    let list=await googleCalendarApi(accessToken,'/users/me/calendarList?maxResults=250&showDeleted=false'),found=(list.items||[]).find(x=>x&&x.accessRole==='owner'&&x.summary==='LifeOS'&&String(x.description||'').includes('[LifeOS managed]'));
    if(found&&found.id){user.googleCalendarId=found.id;return found.id}
    let made=await googleCalendarApi(accessToken,'/calendars',{method:'POST',body:{summary:'LifeOS',description:'تقویم اختصاصی همگام‌سازی هسته · [LifeOS managed]',timeZone:'Asia/Tehran'}});if(!made||!made.id)throw new Error('ساخت تقویم اختصاصی LifeOS در گوگل ناموفق بود.');user.googleCalendarId=made.id;return made.id}
  function googleCalendarLocalState(item,type){let time=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(type==='task'?item.startTime:item.time||''))?String(type==='task'?item.startTime:item.time).slice(0,5):'',duration=time?(type==='task'?Math.max(5,Math.min(1440,Number(item.durationMinutes)||30)):30):0;return[1,String(item.title||'').trim().slice(0,240),String(item.date||'').slice(0,10),time,duration,item.done?1:0]}
  function googleCalendarStateString(item,type){return JSON.stringify(googleCalendarLocalState(item,type))}
  function googleCalendarEventState(event,type){let summary=String(event&&event.summary||'').trim(),done=/^✅\s*/u.test(summary),title=summary.replace(/^(?:✅|📋|🔔)\s*/u,'').trim().slice(0,240),start=event&&event.start||{},end=event&&event.end||{},date='',time='',duration=0;if(start.date){date=String(start.date).slice(0,10)}else if(start.dateTime){let p=tehranParts(new Date(start.dateTime));date=p.year+'-'+p.month+'-'+p.day;time=(p.hour==='24'?'00':p.hour)+':'+p.minute;if(type==='task'&&end.dateTime){let n=Math.round((new Date(end.dateTime)-new Date(start.dateTime))/60000);duration=isFinite(n)&&n>0?Math.max(5,Math.min(1440,n)):30}else duration=30}return[1,title,date,time,duration,done?1:0]}
  function googleCalendarApplyEvent(item,event,type){let s=googleCalendarEventState(event,type);if(s[1])item.title=s[1];if(/^\d{4}-\d{2}-\d{2}$/.test(s[2]))item.date=s[2];if(type==='task'){item.startTime=s[3]||null;item.durationMinutes=s[3]?s[4]:null}else{item.time=s[3]||null;item.whenLabel=item.date}item.done=!!s[5];item.updatedAt=Date.now()}
  function googleCalendarEnd(date,time,minutes){let a=String(time).split(':').map(Number),n=(a[0]||0)*60+(a[1]||0)+Number(minutes||30),plus=Math.floor(n/1440);n=((n%1440)+1440)%1440;return{date:addDaysIso(date,plus),time:String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}}
  function googleCalendarEventPayload(item,type){let s=googleCalendarLocalState(item,type),time=s[3],start,end;if(time){let z=googleCalendarEnd(s[2],time,s[4]);start={dateTime:s[2]+'T'+time+':00+03:30',timeZone:'Asia/Tehran'};end={dateTime:z.date+'T'+z.time+':00+03:30',timeZone:'Asia/Tehran'}}else{start={date:s[2]};end={date:addDaysIso(s[2],1)}}let isReminder=type==='reminder';return{summary:(s[5]?'✅ ':(isReminder?'🔔 ':'📋 '))+s[1],description:'همگام‌شده از هسته (LifeOS) · '+(isReminder?'یادآوری':'کار'),start,end,transparency:s[5]?'transparent':'opaque',colorId:s[5]?'8':(isReminder?'5':'2'),reminders:isReminder&&time?{useDefault:false,overrides:[{method:'popup',minutes:0}]}:{useDefault:true},extendedProperties:{private:{lifeosManaged:'1',lifeosType:type,lifeosId:String(item.id),lifeosSnapshot:JSON.stringify(s)}}}}
  function googleCalendarComparableEvent(event){let p=event&&event.extendedProperties&&event.extendedProperties.private||{};return JSON.stringify({summary:event&&event.summary||'',description:event&&event.description||'',start:event&&event.start||{},end:event&&event.end||{},transparency:event&&event.transparency||'opaque',colorId:String(event&&event.colorId||''),reminders:event&&event.reminders||{},snapshot:p.lifeosSnapshot||''})}
  function googleCalendarComparablePayload(payload){return JSON.stringify({summary:payload.summary||'',description:payload.description||'',start:payload.start||{},end:payload.end||{},transparency:payload.transparency||'opaque',colorId:String(payload.colorId||''),reminders:payload.reminders||{},snapshot:payload.extendedProperties&&payload.extendedProperties.private&&payload.extendedProperties.private.lifeosSnapshot||''})}
  async function googleCalendarManagedEvents(accessToken,calendarId){let items=[],page='';for(let i=0;i<10;i++){let q='/calendars/'+encodeURIComponent(calendarId)+'/events?showDeleted=false&singleEvents=false&maxResults=2500&privateExtendedProperty='+encodeURIComponent('lifeosManaged=1')+(page?'&pageToken='+encodeURIComponent(page):''),d=await googleCalendarApi(accessToken,q);items.push(...(d.items||[]));page=d.nextPageToken||'';if(!page)break}return items}
  async function syncGoogleCalendar(db,user,providedAccessToken){let accessToken=providedAccessToken||await googleCalendarAccessToken(user),calendarId=await ensureGoogleLifeosCalendar(user,accessToken),remote=await googleCalendarManagedEvents(accessToken,calendarId),byKey=new Map(),duplicates=[];for(const event of remote){let p=event&&event.extendedProperties&&event.extendedProperties.private||{},key=p.lifeosType+':'+p.lifeosId;if(!p.lifeosId||!['task','reminder'].includes(p.lifeosType)){duplicates.push(event);continue}if(byKey.has(key))duplicates.push(event);else byKey.set(key,event)}let local=[...(db.tasks||[]).filter(x=>x.userId===user.id&&!x.isReminder&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||''))).map(item=>({item,type:'task'})),...(db.reminders||[]).filter(x=>x.userId===user.id&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||''))).map(item=>({item,type:'reminder'}))],stats={created:0,updated:0,deleted:0,imported:0,conflicts:0,unchanged:0,pending:0,errors:0};let errors=[],operations=0,maxOperations=35;
    for(const row of local){let key=row.type+':'+row.item.id,event=byKey.get(key);byKey.delete(key);try{if(event){let priv=event.extendedProperties&&event.extendedProperties.private||{},before=priv.lifeosSnapshot||'',localState=googleCalendarStateString(row.item,row.type),eventState=JSON.stringify(googleCalendarEventState(event,row.type));if(before&&eventState!==before&&localState===before){googleCalendarApplyEvent(row.item,event,row.type);stats.imported++}else if(before&&eventState!==before&&localState!==before)stats.conflicts++;let payload=googleCalendarEventPayload(row.item,row.type);if(googleCalendarComparableEvent(event)===googleCalendarComparablePayload(payload)){stats.unchanged++;continue}if(operations>=maxOperations){stats.pending++;continue}operations++;try{await googleCalendarApi(accessToken,'/calendars/'+encodeURIComponent(calendarId)+'/events/'+encodeURIComponent(event.id)+'?sendUpdates=none',{method:'PATCH',body:payload});stats.updated++}catch(e){if(e.googleStatus!==404&&e.googleStatus!==410)throw e;await googleCalendarApi(accessToken,'/calendars/'+encodeURIComponent(calendarId)+'/events?sendUpdates=none',{method:'POST',body:payload});stats.created++}}else{if(operations>=maxOperations){stats.pending++;continue}operations++;await googleCalendarApi(accessToken,'/calendars/'+encodeURIComponent(calendarId)+'/events?sendUpdates=none',{method:'POST',body:googleCalendarEventPayload(row.item,row.type)});stats.created++}}catch(e){stats.errors++;errors.push(googleCalendarErrorMessage(e))}}
    for(const event of [...byKey.values(),...duplicates]){if(operations>=maxOperations){stats.pending++;continue}operations++;try{await googleCalendarApi(accessToken,'/calendars/'+encodeURIComponent(calendarId)+'/events/'+encodeURIComponent(event.id)+'?sendUpdates=none',{method:'DELETE'});stats.deleted++}catch(e){if(e.googleStatus!==404&&e.googleStatus!==410){stats.errors++;errors.push(googleCalendarErrorMessage(e))}}}
    let now=new Date().toISOString();user.googleCalendarLastSyncAt=now;user.googleCalendarLastError=errors[0]||null;user.googleCalendarPending=stats.pending;if(!errors.length)user.googleCalendarLastSuccessfulSyncAt=now;return{ok:!errors.length,complete:stats.pending===0,calendarName:'LifeOS',calendarId,stats,error:errors[0]||null}}
  function googleCalendarLocalFeed(db,user,from,to){let out=[];for(const x of(db.tasks||[])){if(x.userId!==user.id||x.isReminder||!x.date||x.date<from||x.date>to)continue;let time=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(x.startTime||''))?String(x.startTime):null;out.push({id:'task:'+x.id,source:'lifeos',kind:'task',title:x.title||'کار',date:x.date,startDate:x.date,endDate:addDaysIso(x.date,1),time,allDay:!time,done:!!x.done,durationMinutes:x.durationMinutes||null})}for(const x of(db.reminders||[])){if(x.userId!==user.id||!x.date||x.date<from||x.date>to)continue;let time=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(x.time||''))?String(x.time):null;out.push({id:'reminder:'+x.id,source:'lifeos',kind:'reminder',title:x.title||'یادآوری',date:x.date,startDate:x.date,endDate:addDaysIso(x.date,1),time,allDay:!time,done:!!x.done})}return out}
  function googleCalendarNormalizedEvent(event,cal){let start=event&&event.start||{},end=event&&event.end||{},allDay=!!start.date,date='',time=null,endDate=null;if(allDay){date=String(start.date||'').slice(0,10);endDate=String(end.date||addDaysIso(date,1)).slice(0,10)}else if(start.dateTime){let p=tehranParts(new Date(start.dateTime));date=p.year+'-'+p.month+'-'+p.day;time=(p.hour==='24'?'00':p.hour)+':'+p.minute;if(end.dateTime){let ep=tehranParts(new Date(end.dateTime));endDate=ep.year+'-'+ep.month+'-'+ep.day}else endDate=date}if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;return{id:'google:'+String(cal.id||'')+':'+String(event.id||''),source:'google',kind:'google',title:event.summary||'رویداد بدون عنوان',date,startDate:date,endDate:endDate||date,time,allDay,done:false,calendarName:cal.summaryOverride||cal.summary||'Google Calendar',color:event.colorId||cal.backgroundColor||'#4285f4',url:event.htmlLink||null}}
  async function listGoogleCalendarEvents(user,accessToken,from,to){
    let cals=await googleCalendarApi(accessToken,'/users/me/calendarList?maxResults=250&showDeleted=false');
    // older LifeOS calendars (left from a previous connection) only hold stale copies of LifeOS items: never list them
    let allVisible=(cals.items||[]).filter(x=>x&&!x.deleted&&(x.primary||x.selected!==false)&&x.accessRole!=='none'&&(x.id===user.googleCalendarId||!String(x.description||'').includes('[LifeOS managed]'))).sort((a,b)=>(b.primary?1:0)-(a.primary?1:0));
    let visible=allVisible.slice(0,12),items=[],failed=0,truncated=allVisible.length>visible.length;
    let timeMin=new Date(from+'T00:00:00+03:30').toISOString(),timeMax=new Date(addDaysIso(to,1)+'T00:00:00+03:30').toISOString();
    await mapConcurrent(visible,4,async cal=>{try{
      let q='/calendars/'+encodeURIComponent(cal.id)+'/events?showDeleted=false&singleEvents=true&orderBy=startTime&maxResults=500&timeZone='+encodeURIComponent('Asia/Tehran')+'&timeMin='+encodeURIComponent(timeMin)+'&timeMax='+encodeURIComponent(timeMax),d=await googleCalendarApi(accessToken,q);
      if(d.nextPageToken)truncated=true;
      for(const event of(d.items||[])){let priv=event.extendedProperties&&event.extendedProperties.private||{};if(priv.lifeosManaged==='1')continue;/* a LifeOS copy, wherever it ended up */let n=googleCalendarNormalizedEvent(event,cal);if(n)items.push(n)}
    }catch(e){failed++}});
    items.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time||'').localeCompare(String(b.time||'')));
    return{items:items.slice(0,1000),calendars:visible.length,partial:failed>0||truncated}
  }
  async function calendarFeed(db,user,from,to){let items=googleCalendarLocalFeed(db,user,from,to),connected=!!user.googleCalendarRefreshToken,googleError=null,googleCalendars=0,partial=false;if(connected){try{let token=await googleCalendarAccessToken(user),g=await listGoogleCalendarEvents(user,token,from,to);items.push(...g.items);googleCalendars=g.calendars;partial=g.partial}catch(e){googleError=googleCalendarErrorMessage(e)}}for(const c of colOf(db,'courses').filter(x=>x.userId===user.id))for(const x of courseSessions(c))if(x.date>=from&&x.date<=to)items.push({id:c.id+'-'+x.n,kind:'session',source:'lifeos',title:'🎓 '+(c.name||'کلاس')+' · جلسهٔ '+x.n.toLocaleString('fa-IR'),date:x.date,time:x.time,courseId:c.id,n:x.n,done:x.date<today()});for(const c of projectDues(db,user,from,to))items.push({id:c.id,kind:'card',source:'lifeos',title:c.title,date:c.due,done:false,projectId:c.projectId,project:c.project,color:c.color,prio:c.prio});items.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.time||'').localeCompare(String(b.time||'')));return{connected,calendarName:'LifeOS',items,googleCalendars,partial,googleError,lastSyncAt:user.googleCalendarLastSuccessfulSyncAt||user.googleCalendarLastSyncAt||null,pending:user.googleCalendarPending||0}}
  async function syncAllGoogleCalendars(db){if(!googleCalendarConfigured())return{changed:false,attempted:0,failed:0};let attempted=0,failed=0,changed=false;for(const user of(db.users||[])){if(!user.googleCalendarRefreshToken)continue;attempted++;try{await syncGoogleCalendar(db,user)}catch(e){failed++;user.googleCalendarLastSyncAt=new Date().toISOString();user.googleCalendarLastError=googleCalendarErrorMessage(e)}changed=true}return{changed,attempted,failed}}

  function weekdayIndexTehran(iso){let p=tehranParts(new Date(String(iso).slice(0,10)+'T12:00:00Z'));return({Sat:0,Sun:1,Mon:2,Tue:3,Wed:4,Thu:5,Fri:6})[p.weekday]||0}
  function nextWeekdayIso(fromIso,targetIdx,weekOffset){weekOffset=weekOffset|0;let cur=weekdayIndexTehran(fromIso),delta=(targetIdx-cur+7)%7;return addDaysIso(fromIso,delta+7*weekOffset)}
  function parsePersianAmount(token){if(token==null)return null;let s=enNum(String(token)).trim().replace(/,/g,'').replace(/٬/g,'').replace(/٫/g,'.');s=s.replace(/(\d)\s*[/]\s*(\d+)/g,'$1.$2');let mult=1,body=s.replace(/تومان|تومن|ریال/ig,'').trim();if(/میلیون/i.test(body)||/\d(?:\.\d+)?\s*م\b/i.test(body)||/\d(?:\.\d+)?م(?:\s|$)/i.test(body)||/\d(?:\.\d+)?\s*م$/i.test(body)){mult=1e6;s=body.replace(/میلیون/ig,'').replace(/\s*م\b/i,'').replace(/م$/i,'').replace(/\s+/g,'')}else if(/هزار/i.test(body)){mult=1e3;s=body.replace(/هزار/ig,'').replace(/\s+/g,'')}else s=body.replace(/\s+/g,'');s=s.replace(/تومان|تومن|ریال/ig,'').replace(/\s+/g,'').trim();let n=parseFloat(s);if(!isFinite(n)||n<=0)return null;let toman=/تومان|تومن/i.test(String(token));return Math.round(n*mult*(toman?10:1))}
  function extractAmountFromText(rawText){let t=enNum(stripRefNumbers(stripBalanceNotes(rawText))).replace(/\d{4}[./]\d{1,2}[./]\d{1,2}/g,' ').replace(/\d{1,2}:\d{2}(?::\d{2})?/g,' ').replace(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g,' ');let res=null;const U='(?:تومان|تومن|ریال|ريال|Rial|IRR)';function tryOne(re){let m=t.match(re);if(!m)return;let a=parsePersianAmount(m[0]);if(a&&a>0){if(!res||m[0].length>=res.raw.length)res={amount:a,index:m.index,length:m[0].length,raw:m[0]}}}tryOne(new RegExp('(\\d+(?:[./٫]\\d+)?)\\s*میلیون(?:\\s*'+U+')?'));tryOne(new RegExp('(\\d+(?:[./٫]\\d+)?)\\s*م(?:\\s*'+U+')?(?=\\s|$|[^\\u0600-\\u06ffa-zA-Z0-9])'));tryOne(new RegExp('(\\d+(?:[./٫]\\d+)?)\\s*هزار(?:\\s*'+U+')?'));tryOne(new RegExp('(\\d{1,3}(?:[,٬]\\d{3}){1,3})(?:\\s*'+U+')?'));tryOne(new RegExp('(\\d{4,12})(?:\\s*'+U+')?'));tryOne(new RegExp('(\\d+(?:[./٫]\\d+)?)\\s*'+U));if(res&&!/ریال|ريال|Rial|IRR/i.test(res.raw)){let tail=t.slice(res.index+res.length).split('\n')[0],head=t.slice(0,res.index);if(/^[\s،,:]*ریال/.test(tail)||/(?:ریال|ريال|irr|rial)\s*[:،,=]?\s*$/i.test(head)){res.rialSuffix=true;res.raw=res.raw+' ریال'}}return res}
  function extractTimeFromText(t){t=enNum(t);let m=t.match(/ساعت\s*(\d{1,2})(?:[:：.](\d{2}))?\s*(صبح|ظهر|بعدازظهر|بعد\s*از\s*ظهر|عصر|شب)?/);if(!m)m=t.match(/\b(\d{1,2})[:：.](\d{2})\s*(صبح|ظهر|بعدازظهر|بعد\s*از\s*ظهر|عصر|شب)?/);if(!m)return null;let h=Number(m[1]),mi=m[2]?Number(m[2]):0,suf=(m[3]||'').replace(/\s+/g,'');if(h>23||mi>59)return null;if(/بعدازظهر|عصر|شب/.test(suf)&&h>0&&h<12)h+=12;if(suf==='ظهر'&&h<12)h=12;if(suf==='صبح'&&h===12)h=0;if(!suf&&h>=1&&h<=6)h+=12;return{time:String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0'),index:m.index,length:m[0].length}}
  function extractDateFromText(t,baseIso){t=enNum(String(t));baseIso=baseIso||today();if(/امروز/.test(t))return{date:baseIso,label:'امروز'};if(/پس\s*فردا|پسفردا/.test(t))return{date:addDaysIso(baseIso,2),label:'پس‌فردا'};if(/فردا/.test(t))return{date:addDaysIso(baseIso,1),label:'فردا'};let dm=t.match(/(\d+)\s*روز\s*(?:دیگر|دیگه)/);if(dm)return{date:addDaysIso(baseIso,Number(dm[1])),label:dm[1]+' روز دیگر'};let weekOffset=0;if(/دو\s*هفته\s*(?:ی\s*)?(?:بعد|آینده|دیگه)/.test(t))weekOffset=2;else if(/هفته\s*(?:ی\s*)?(?:بعد|آینده)|هفته‌ی?\s*دیگه/.test(t))weekOffset=1;const wds=[[/سه‌شنبه|سه\s*شنبه/,3,'سه‌شنبه'],[/چهارشنبه|چهار\s*شنبه/,4,'چهارشنبه'],[/پنج‌شنبه|پنجشنبه|پنج\s*شنبه/,5,'پنج‌شنبه'],[/یکشنبه|یک\s*شنبه/,1,'یکشنبه'],[/دوشنبه|دو\s*شنبه/,2,'دوشنبه'],[/شنبه/,0,'شنبه'],[/جمعه/,6,'جمعه']];for(const[re,idx,name]of wds){if(re.test(t))return{date:nextWeekdayIso(baseIso,idx,weekOffset),label:(weekOffset?('هفته بعد '):'')+name}}if(weekOffset===1)return{date:addDaysIso(baseIso,7),label:'هفته بعد'};if(weekOffset===2)return{date:addDaysIso(baseIso,14),label:'دو هفته بعد'};return null}
  function stripBalanceNotes(t){return String(t||'').replace(/(?:موجودی(?:\s*حساب)?|مانده(?:\s*حساب)?|balance)\s*[:：=]?\s*\d[\d.,،٬]*\s*(?:ریال|ريال|تومان|تومن|IRR|Rial)?/gi,' ')}
  function stripRefNumbers(t){return String(t||'').replace(/(?:شناسه\s*(?:پرداخت|تراکنش|پیگیری)?|شماره\s*(?:سند|پیگیری|تراکنش|مرجع|کارت|حساب)|کد\s*(?:رهگیری|پیگیری|تراکنش)|رهگیری|پیگیری)\s*[:：=]?\s*\d[\d.,،٬]*/gi,' ')}
  // «یادم بنداز …» / «دیدم …» are the command words, not part of the title.
  const REMINDER_WORDS=/(?:^|\s)(?:یادم\s*(?:بنداز|بیار|باشه)|یادت\s*باشه|بهم\s*یادآوری\s*کن|یادآوری\s*کن|یادآوری|remind\s*me(?:\s*to)?)(?:\s+که)?(?=\s|$)/gi;
  const cleanReminderTitle=s=>cleanTitle(String(s||'').replace(REMINDER_WORDS,' '));
  const cleanSeriesTitle=s=>cleanTitle(String(s||'').replace(/^سریال\s+/,'').replace(/^(?:امروز|دیشب|الان)\s+/,'').replace(/^(?:دیدم|دیدیم|تماشا\s*کردم|نگاه\s*کردم)\s+/,'').replace(/^سریال\s+/,''));
  function cleanTitle(s){return String(s||'').replace(/[،,.\-–—:؛]+$/g,'').replace(/^(?:که|رو|را|و|با|برای|در|به)\s+/,'').replace(/\s+/g,' ').trim()}
  // فاز ۳ — قالب پیام‌های بانکی: کپی اپ بانک («مبلغ: / بابت: / تاریخ:») و متن پیامک بانک (ریال/واریز).
  // مبلغ ریالی بانک بدون تبدیل ذخیره می‌شه و خط «موجودی:» نادیده گرفته می‌شه (ولی به‌صورت balance برمی‌گرده تا موجودی حساب با بانک تطبیق داده بشه).
  // پیامک‌ها: بلو («… ریال از حساب شما پرید/به حساب شما نشست»، «سود»، «قلک») و قالب علامت‌دار بانک‌ها («برداشت: ۱٬۲۰۰٬۰۰۰ / مانده: …»، «-۱٬۲۰۰٬۰۰۰»).
  const BANK_OUT='(?:پرید|کسر\\s*شد|برداشت\\s*شد|خارج\\s*شد|کم\\s*شد|منتقل\\s*شد)';
  const BANK_IN='(?:واریز\\s*شد|نشست|افزوده\\s*شد|اضافه\\s*شد|افزایش\\s*یافت|منتقل\\s*شد)';
  function bankSmsMeta(t){
    let bal=t.match(/(?:موجودی|مانده)(?:\s*(?:حساب|قابل\s*برداشت))?\s*[:：=]?\s*(-?\d[\d,،٬]*)/),balance=bal?Number(bal[1].replace(/[،,٬]/g,'')):null;
    let tm=t.match(/(?:^|[^\d:])(\d{1,2}):(\d{2})(?::\d{2})?(?!\d)/),time=tm&&Number(tm[1])<24?String(tm[1]).padStart(2,'0')+':'+tm[2]:null;
    return{balance:isFinite(balance)?balance:null,time};
  }
  function parseBankMessage(t,base){
    const orig=t,meta=bankSmsMeta(orig);
    t=stripRefNumbers(stripBalanceNotes(t)); // «موجودی: …» و شمارهٔ پیگیری مبلغ نیستند
    const mFor=t.match(/بابت:?\s*([^\n]+?)(?:\s+(?:از|به)\s*(?:حساب|قلک|کارت|کیف\s*پول)\s*شما[^\n]*)?$/m); // «بابت X از حساب شما پرید» → X
    const mAmt=t.match(/مبلغ\s*[:：=]?\s*([\d.,،٬٫\s]+?)\s*(تومان|تومن|ریال)/);
    // «X ریال [سود|بابت پرداخت قبض تلفن همراه] از/به حساب|قلک|کارت شما …» — تا هشت کلمه بین «ریال» و «از/به» مجاز است.
    const mSms=t.match(new RegExp('(\\d[\\d.,،٬]*)\\s*(?:ریال|ريال)\\s*(?:[^\\s\\d]+\\s+){0,8}?(از|به)\\s*(حساب|قلک|کارت|کیف\\s*پول)\\s*(?:شما)?[^\\n\\d]{0,40}?(?:'+BANK_OUT+'|'+BANK_IN+')'));
    const mSms2=t.match(new RegExp('(?:از|به)\\s*(?:حساب|کارت)\\s*شما\\s*(?:'+BANK_OUT+'|'+BANK_IN+')[^\\d]{0,30}?(\\d[\\d.,،٬]*)\\s*(?:ریال|ريال)'));
    // قالب علامت‌دار: سطری با «برداشت/واریز/انتقال/خرید…:» یا علامت ±؛ فقط وقتی متن واقعاً پیامک بانک است (مانده/موجودی/حساب).
    const bankCtx=/(?:مانده|موجودی|حساب|بانک|کارت)/.test(orig);
    const mSign=bankCtx&&!(mSms||mSms2||mAmt)?t.match(/(?:^|\n)[ \t]*(برداشت|واریز|انتقال|خرید|پرداخت|سود|کارمزد|قسط|دریافت|عودت)?[^\n\d+\-]{0,20}?[:：]?[ \t]*([+\-])?[ \t]*(\d{1,3}(?:[,،٬]\d{3})+|\d{4,})[ \t]*(?:ریال|ريال)?[ \t]*([+\-])?[ \t]*(?:\n|$)/):null;
    const mSignOk=mSign&&(mSign[1]||mSign[2]||mSign[4])?mSign:null;
    if(!(mFor||mAmt||mSms||mSms2||mSignOk))return null;
    let amount=null,kind="expense",dir=null,transfer=null;
    if(mSms){amount=Number(String(mSms[1]).replace(/[،,٬\s]/g,""));let tail=t.slice(mSms.index);dir=new RegExp('^[^\\n]*?(?:از\\s*(?:حساب|کارت|کیف\\s*پول)\\s*شما|'+BANK_OUT.replace('|منتقل\\s*شد','')+')').test(tail)&&!/^[^\n]*?به\s*(?:حساب|کارت)\s*شما/.test(tail)?'out':'in';if(mSms[3]==='قلک')transfer=mSms[2]==='از'?'fromPiggy':'toPiggy'} // خط خودِ بانک («… ریال از حساب شما پرید») بر سرصفحهٔ «مبلغ: … ریال» مقدم است
    else if(mSms2){amount=Number(String(mSms2[1]).replace(/[،,٬\s]/g,""));dir=/^(?:از)/.test(mSms2[0])?'out':'in'}
    else if(mAmt){amount=Number(String(mAmt[1]).replace(/[،,٬\s]/g,"").replace(/٫/g,"."));if(/تومان|تومن/.test(mAmt[2]))amount=Math.round(amount*10)}
    else if(mSignOk){amount=Number(String(mSignOk[3]).replace(/[،,٬\s]/g,""));let sg=mSignOk[2]||mSignOk[4],w=mSignOk[1]||'';dir=sg?(sg==='-'?'out':'in'):(/واریز|سود|دریافت|عودت/.test(w)?'in':'out')}
    if(amount==null||!isFinite(amount)||amount<=0)return null;
    // «واریز به: شماره‌حساب مقصد» در رسید انتقال، پولِ خروجی است؛ فقط وقتی صراحتاً
    // به حساب خود کاربر نشسته باشد آن را درآمد می‌دانیم.
    const outgoingTransfer=/(?:انتقال\s+از\s+(?:بانک|حساب)|واریز\s+به\s*[:：]?\s*(?:IR[-\s]?\d|شماره|حساب|کارت)|از\s+حساب\s+شما\s*(?:پرید|کسر|برداشت|خارج|کم))/i.test(t);
    const incomingDeposit=/(?:به\s+حساب\s+شما\s*(?:واریز\s*شد|نشست|افزوده\s*شد|اضافه\s*شد|افزایش\s*یافت)|(?:دریافت|حقوق|سود|بستانکار|افزایش\s+موجودی))/i.test(t);
    if(dir)kind=dir==='in'?'income':'expense';
    else if(!outgoingTransfer&&incomingDeposit)kind="income";
    const mRecipient=t.match(/(?:به\s*نام|نام\s*(?:صاحب\s*)?(?:حساب|کارت)|ذی[\s‌-]?نفع)\s*[:：]?\s*([^\n]+)/i);
    const recipient=mRecipient?cleanTitle(mRecipient[1]):'';
    let title=mFor?cleanTitle(mFor[1]):null;
    if(outgoingTransfer&&recipient&&recipient.length>=2)title='انتقال به '+recipient;
    // پیامک بلو: سطر دوم نوع تراکنش است («برداشت پول»، «انتقال پل»، «خرید»، «سود»…).
    if(!title||title.length<2){const lines=t.split('\n').map(x=>x.trim()).filter(Boolean);if(/^(?:بلو|blu)$/i.test(lines[0]||'')&&lines[1]&&!/\d|عزیز/.test(lines[1]))title=cleanTitle(lines[1])}
    if(!title||title.length<2){const mTr=t.match(/(?:انتقال پول|خرید|پرداخت|برداشت|واریز)[^\n]*/);title=mTr?cleanTitle(mTr[0].replace(/\d[\d.,،٬]*\s*(?:ریال|تومان|تومن)?/g,' ').replace(/[:：+\-]+/g,' ')):null}
    if((!title||title.length<2)&&mSignOk&&mSignOk[1])title=mSignOk[1];
    if(transfer)title=transfer==='fromPiggy'?'برداشت از قلک':'واریز به قلک';
    else if(!title||title.length<2)title=kind==="income"?"واریز بانکی":"تراکنش بانکی";
    let date=base;
    const mJ=t.match(/(?:^|[^\d])(1[34]\d{2})[./\-](\d{1,2})[./\-](\d{1,2})(?!\d)/);
    if(mJ){try{date=jalaliToGregorianIso(Number(mJ[1]),Number(mJ[2]),Number(mJ[3]))}catch(e){}}
    else{const MO={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};const mE=t.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})/);if(mE){const mm=MO[mE[1].slice(0,3).toLowerCase()];if(mm)date=mE[3]+"-"+String(mm).padStart(2,"0")+"-"+String(Number(mE[2])).padStart(2,"0")}}
    const cat=transfer?'انتقال':suggestCategoryKeyword(title)||suggestCategoryKeyword(t)||"متفرقه";
    let r={type:"transaction",amount,title,category:cat,kind:transfer?'transfer':kind,date,bank:true};
    if(transfer)r.transfer=transfer;
    if(meta.time)r.time=meta.time;
    if(meta.balance!=null)r.balance=meta.balance;
    return r;
  }
  function parseLifeText(text){let raw=String(text||'').trim();if(!raw)return[];let t=enNum(raw).replace(/ي/g,'ی').replace(/ك/g,'ک');let actions=[],base=today();let bankAct=parseBankMessage(t,base);if(bankAct)return[bankAct];let isBankText=/(?:از حساب شما|به حساب شما|موجودی\s*[:：]|مانده\s*[:：]|شماره سند|شناسه پرداخت|کسر شد|برداشت شد|واریز شد)/.test(t);if(isBankText&&extractAmountFromText(t)==null)return[]; // نوتیف بانکی بدون مبلغ — چیزی برای ثبت نیست
      let gt=parseGambleText(t,base);if(gt){if(gt.session)actions.push(gt.session);else actions.push({type:'gambleNote',text:raw,gamble:gt.gamble})}let s1=t.match(/(?:سریال\s+)?(.+?)\s*(?:رو|را)?\s*(?:تا\s*)?فصل\s*(\d+)[^\d]{0,14}قسمت\s*(\d+)/);if(s1)actions.push({type:'series',title:cleanSeriesTitle(s1[1]),season:Number(s1[2]),episode:Number(s1[3])});else{let s2=t.match(/(?:سریال\s+)?(.+?)\s*(?:رو|را)?\s*(?:تا\s*)?قسمت\s*(\d+)[^\d]{0,14}فصل\s*(\d+)/);if(s2)actions.push({type:'series',title:cleanSeriesTitle(s2[1]),season:Number(s2[3]),episode:Number(s2[2])})}let mood=t.match(/(?:حالم|حال|مود|mood)\s*(?:بود)?\s*[=:]?\s*(\d{1,2})\b/);if(mood){let v=Number(mood[1]);if(v>=0&&v<=10)actions.push({type:'mood',value:v})}let sleep=t.match(/(\d+(?:\.\d+)?)\s*ساعت\s*(?:خواب(?:یدم)?)/)||t.match(/خواب(?:م)?\s*[=:]?\s*(\d+(?:\.\d+)?)/);if(sleep)actions.push({type:'sleep',value:sleep[1]+' ساعت'});if(!/خواب/.test(t)){let w=t.match(/(\d+(?:\.\d+)?)\s*ساعت\s+(?:روی\s+)?([^\d]+?)(?:\s+کار(?:\s*کردم)?)?$/);if(!w)w=t.match(/(\d+(?:\.\d+)?)\s*ساعت\s*کار(?:\s*کردم)?/);if(w&&!/قرار|یادآوری|یادم|ساعت\s*\d/.test(t)){let minutes=Math.round(Number(w[1])*60),title=cleanTitle(w[2]||'کار');title=(title||'').replace(/\s*کار\s*کردم$/,'').trim();if(!title||/^(کردم|کردیم|کار)$/.test(title))title='کار';actions.push({type:'time',minutes,title})}}let dateInfo=extractDateFromText(t,base),timeInfo=extractTimeFromText(t),amt=extractAmountFromText(t);let hasApptWord=/(?:قرار|یادآوری|یادم\s*باشه|یادم\s*نره|جلسه(?:‌ام|ام)?|ملاقات|ویزیت)/.test(t);let hasApptHint=!!(dateInfo&&timeInfo)||!!(dateInfo&&/(?:دکتر|پزشک|دندان|بیمارستان|بانک|اداره|فرودگاه|مسافر|تحویل|ملاقات)/.test(t));let isReminder=hasApptWord||hasApptHint;let moneyWord=/(?:خرید(?:م|ی)?|خریدم|خرج(?:یدم|م)?|پرداخت|هزینه|تومان|تومن|ریال|میلیون|هزار|\d(?:[./٫]\d+)?\s*م\b|\d(?:[./٫]\d+)?م\b)/.test(t);if(amt&&amt.amount>=1000)moneyWord=true;if(isReminder){let title=t;title=title.replace(/یادم\s*باشه(?:\s*که)?|یادم\s*نره(?:\s*که)?|یادآوری(?:\s*کن)?|قرار(?:ه|ه؟|\s*دارم|\s*ه)?|جلسه(?:‌ام|ام)?|ملاقات|ویزیت/g,' ');title=title.replace(/امروز|فردا|پس\s*فردا|پسفردا|این\s*هفته|دو\s*هفته\s*(?:ی\s*)?(?:بعد|آینده|دیگه)|هفته\s*(?:ی\s*)?(?:بعد|آینده)|هفته‌ی?\s*دیگه/g,' ');title=title.replace(/سه‌شنبه|سه\s*شنبه|چهارشنبه|چهار\s*شنبه|پنج‌شنبه|پنجشنبه|پنج\s*شنبه|یکشنبه|یک\s*شنبه|دوشنبه|دو\s*شنبه|شنبه|جمعه/g,' ');title=title.replace(/ساعت\s*\d{1,2}(?:[:：.]\d{2})?\s*(?:صبح|ظهر|بعدازظهر|بعد\s*از\s*ظهر|عصر|شب)?/g,' ');title=title.replace(/\d{1,2}[:：.]\d{2}/g,' ');title=title.replace(/\d+\s*روز\s*(?:دیگر|دیگه)/g,' ');title=cleanReminderTitle(title);if(!title||title.length<2)title='یادآوری';actions.push({type:'reminder',title,date:(dateInfo&&dateInfo.date)||base,time:timeInfo?timeInfo.time:null,whenLabel:(dateInfo&&dateInfo.label)||((dateInfo&&dateInfo.date)||base)})}let taskM=t.match(/^(?:کار|تسک|todo)\s*[:：\-]?\s*(.+)$/i);if(taskM){let title=cleanTitle(taskM[1].replace(/امروز|فردا|ساعت\s*\d{1,2}(?:[:：.]\d{2})?/g,' '));if(title)actions.push({type:'task',title,date:(dateInfo&&dateInfo.date)||base,startTime:timeInfo?timeInfo.time:null})}if(amt&&moneyWord&&!gt&&!(isReminder&&amt.amount<=24&&!/(?:خرید|خرج|پرداخت|تومان|تومن|میلیون|هزار|\d(?:[./٫]\d+)?\s*م\b)/.test(t))){let amount=amt.amount,title=(t.slice(0,amt.index)+' '+t.slice(amt.index+amt.length));title=title.replace(/(?:خرید(?:م|ی)?|خریدم|خرج(?:یدم|م)?|پرداخت(?:م| کردم)?|هزینه(?:ی|ٔ)?|دادم)\s*/g,' ');title=title.replace(/(?:به مبلغ|به قیمت|به ارزش|مبلغ|قیمت)\s*/g,' ');title=title.replace(/(?:تومان|تومن|ریال)\s*/g,' ');title=title.replace(/(?:موجودی|مانده)\s*[:：=]?\s*[\d.,،٬]*\s*(?:ریال|تومان|تومن)?/g,' ');title=cleanTitle(title);if(!title||title.length<2)title='هزینه ثبت‌شده از متن';let cat=suggestCategoryKeyword(title)||suggestCategoryKeyword(t)||'متفرقه';if(/عینک/.test(t)&&cat==='متفرقه')cat='پوشاک';let kind=/(?:دریافت|واریز|حقوق|درآمد)/.test(t)?'income':'expense';actions.push({type:'transaction',amount,title,category:cat,kind})}if(!actions.length&&dateInfo){let title=t;title=title.replace(/امروز|فردا|پس\s*فردا|این\s*هفته|هفته\s*(?:بعد|آینده)|سه‌شنبه|سه\s*شنبه|چهارشنبه|پنج‌شنبه|پنجشنبه|یکشنبه|دوشنبه|شنبه|جمعه|ساعت\s*\d{1,2}(?:[:：.]\d{2})?/g,' ');title=cleanReminderTitle(title);if(title.length>=2)actions.push({type:'reminder',title,date:dateInfo.date,time:timeInfo?timeInfo.time:null,whenLabel:dateInfo.label})}let seen=new Set(),out=[];for(const a of actions){let k=[a.type,a.title||'',a.amount||a.value||'',a.date||'',a.time||a.startTime||''].join('|');if(seen.has(k))continue;seen.add(k);out.push(a)}return out}
  function normTitle(s){return String(s||'').toLowerCase().replace(/[‌\s]+/g,' ').trim()}
  function seasonStatsFromEpisodes(eps){
    const today=new Date().toISOString().slice(0,10);
    const by={};
    for(const ep of (eps||[])){
      const s=Number(ep.season);
      if(!Number.isFinite(s) || s<=0) continue;
      if(!by[s]) by[s]={total:0,aired:0};
      by[s].total++;
      const ad=ep.airdate || (ep.airstamp?String(ep.airstamp).slice(0,10):'');
      if(ad && ad<=today) by[s].aired++;
    }
    return by;
  }
  function seasonTotAired(by, season){
    const s=by[Number(season)]||by[String(season)];
    if(!s) return {total:0,aired:0,cap:0};
    const total=s.total||0;
    const aired=Math.min(s.aired||0, total);
    const cap = aired>0 ? aired : 0;
    return {total, aired, cap, displayTotal: total||aired||0};
  }
  async function fetchTvMazeShowFull(tvmazeId, name){
    let show=null;
    if(tvmazeId){
      let r=await fetch('https://api.tvmaze.com/shows/'+encodeURIComponent(tvmazeId)+'?embed=episodes');
      if(r.ok) show=await r.json();
    }
    if(!show && name){
      let r=await fetch('https://api.tvmaze.com/singlesearch/shows?q='+encodeURIComponent(name)+'&embed=episodes');
      if(r.ok) show=await r.json();
    }
    return show;
  }
  function progressFromShow(show, preferredSeason, preferredEp){
    const eps=(show && show._embedded && show._embedded.episodes)||[];
    const by=seasonStatsFromEpisodes(eps);
    const seasons=Object.keys(by).map(Number).filter(n=>n>0).sort((a,b)=>a-b);
    let season=Number(preferredSeason)||0;
    if(!season || !by[season]) season=seasons[0]||1;
    const st=seasonTotAired(by, season);
    let ep=preferredEp==null?null:Number(preferredEp);
    if(ep!=null && Number.isFinite(ep)){
      ep=Math.max(0, Math.min(ep, st.cap || st.displayTotal || 0));
    }
    return {
      bySeason: by,
      seasons,
      currentSeason: season,
      totalEpisodes: st.displayTotal || null,
      airedInSeason: st.aired,
      capInSeason: st.cap,
      currentEpisode: ep,
      showStatus: (show && show.status)||'',
      nextSeason: seasons.find(s=>s>season)||null,
      nextSeasonReady: (function(){
        const ns=seasons.find(s=>s>season);
        if(!ns) return false;
        return (by[ns]&&by[ns].aired>0)||false;
      })()
    };
  }
  async function ensureSeriesTvMazeData(row){
    let seas=Number(row.currentSeason)||1;
    let hasSeason=row.seasonEpisodes&&(row.seasonEpisodes[seas]||row.seasonEpisodes[String(seas)]);
    if(hasSeason&&row.posterUrl&&row.note)return row;
    try{
      let show=await fetchTvMazeShowFull(row.tvmazeId, row.title);
      if(show){
        if(!row.tvmazeId)row.tvmazeId=show.id;
        if(!hasSeason){
          let prog=progressFromShow(show, seas, null);
          row.seasonEpisodes=prog.bySeason;
        }
        /* وضعیت پخش (Ended/Running) باید هر بار که واقعاً یه فچ تازه از TVMaze می‌گیریم به‌روز بشه،
           نه فقط وقتی فصل فعلی هنوز ناشناخته‌ست — وگرنه سریالی که فصل‌هاش قبلاً سینک شده هیچ‌وقت
           نمی‌فهمه که در واقعیت تمام شده و برای همیشه توی «در حال دیدن»/«در انتظار» می‌مونه */
        row.showStatus=(show.status)||row.showStatus;
        if(!row.posterUrl)row.posterUrl=(show.image&&(show.image.original||show.image.medium))||row.posterUrl||null;
        if(!row.note)row.note=String(show.summary||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()||row.note||'';
        if(!row.genre&&show.genres&&show.genres.length)row.genre=show.genres[0];
        if(!row.network)row.network=(show.network&&show.network.name)||(show.webChannel&&show.webChannel.name)||row.network||'';
        if(!row.year&&show.premiered)row.year=String(show.premiered).slice(0,4);
        if(row.tmdbRating==null&&show.rating&&show.rating.average!=null)row.tmdbRating=show.rating.average;
      }
    }catch(e){}
    return row;
  }
  function clampEpisodeAgainstSeason(row, season, episode){
    season=Number(season)||1;
    let ep=episode==null?null:Number(episode);
    const by=row&&row.seasonEpisodes;
    let cap=null, tot=null;
    if(by&&by[season]){
      tot=Number(by[season].total)||0;
      const aired=Number(by[season].aired);
      cap=Number.isFinite(aired)?aired:(tot||0);
    } else if(row&&row.airedInSeason!=null){
      cap=Number(row.airedInSeason);
      tot=Number(row.totalEpisodes)||cap;
    } else if(row&&row.totalEpisodes!=null){
      tot=Number(row.totalEpisodes);
    }
    if(ep==null) return {episode:null, total:tot, cap:cap};
    ep=Math.max(0, ep);
    if(cap!=null && Number.isFinite(cap)) ep=Math.min(ep, Math.max(0,cap));
    else if(tot!=null && Number.isFinite(tot) && tot>0) ep=Math.min(ep, tot);
    return {episode:ep, total:tot, cap:cap};
  }
  async function applySeriesAction(db,userId,a){let title=String(a.title||'').trim();if(!title)return null;let nt=normTitle(title),existing=db.movies.find(x=>x.userId===userId&&x.type==='series'&&(normTitle(x.title).includes(nt)||nt.includes(normTitle(x.title))));if(existing){if(a.season)existing.currentSeason=Number(a.season);if(a.episode)existing.currentEpisode=Number(a.episode);if(existing.status!=='completed')existing.status='watching';await ensureSeriesTvMazeData(existing);let cl=clampEpisodeAgainstSeason(existing,Number(existing.currentSeason)||1,existing.currentEpisode);if(cl.total!=null&&cl.total>0)existing.totalEpisodes=cl.total;if(cl.cap!=null)existing.airedInSeason=cl.cap;if(existing.currentEpisode!=null)existing.currentEpisode=cl.episode;return{label:existing.title,created:false}}let created={id:id(),userId,title,type:'series',status:'watching',rating:null,progress:'',currentSeason:a.season?Number(a.season):null,currentEpisode:a.episode?Number(a.episode):null,totalEpisodes:null,date:today(),note:'',tags:'',platform:'',language:'',watchedWith:'',spoiler:'',genre:'',director:'',durationMinutes:null,tmdbId:null,posterUrl:null,tmdbRating:null,createdAt:Date.now()};if(TMDB_API_KEY){try{let r=await fetch('https://api.themoviedb.org/3/search/tv?query='+encodeURIComponent(title)+'&language=fa',{headers:{Authorization:'Bearer '+TMDB_API_KEY}}),data=await r.json(),top=(data.results||[])[0];if(top){created.title=top.name||title;created.tmdbId=top.id;created.posterUrl=top.poster_path?'https://image.tmdb.org/t/p/w342'+top.poster_path:null;created.tmdbRating=top.vote_average||null}}catch(e){}}await ensureSeriesTvMazeData(created);if(created.currentSeason==null&&created.seasonEpisodes){let seasons=Object.keys(created.seasonEpisodes).map(Number).filter(n=>n>0).sort((x,y)=>x-y);if(seasons.length)created.currentSeason=seasons[0]}let cl2=clampEpisodeAgainstSeason(created,Number(created.currentSeason)||1,created.currentEpisode);if(cl2.total!=null&&cl2.total>0)created.totalEpisodes=cl2.total;if(cl2.cap!=null)created.airedInSeason=cl2.cap;if(created.currentEpisode!=null)created.currentEpisode=cl2.episode;db.movies.push(created);return{label:created.title,created:true}}
  function normCsvHeader(h){return String(h||'').replace(/^\uFEFF/,'').replace(/[\u200e\u200f\ufeff]/g,'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^\w\u0600-\u06ff]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')}
  function csvHeaderIndex(header, names){let map={};(header||[]).forEach((h,i)=>{let k=normCsvHeader(h);if(k&&map[k]===undefined)map[k]=i});for(const n of (Array.isArray(names)?names:[names])){let k=normCsvHeader(n);if(map[k]!==undefined)return map[k]}return -1}
  function parseBingersLibrary(rows){let header=(rows[0]||[]).map(h=>String(h||'').replace(/^\uFEFF/,'').trim());let ti=csvHeaderIndex(header,['title','name','show_title','show','series','series_title']);let yi=csvHeaderIndex(header,['year','premiered','first_air_date']);let tmdbI=csvHeaderIndex(header,['tmdb_id','tmdbid','tmdb']);let tvdbI=csvHeaderIndex(header,['tvdb_id','tvdbid','tvdb','thetvdb']);let statusI=csvHeaderIndex(header,['list_status','status','type','list','watch_status','state']);let typeI=csvHeaderIndex(header,['media_type','item_type','kind']);let addedI=csvHeaderIndex(header,['added_at','added','date_added','created_at']);if(ti===-1)throw new Error('ساختار library.csv شناخته نشد (ستون title). هدر: '+(header.slice(0,8).join(', ')||'خالی'));if(statusI===-1)throw new Error('ساختار library.csv شناخته نشد (ستون status/list_status/type). هدر: '+header.slice(0,12).join(', '));let statusMap={watching:'watching',for_later:'watchlist',watchlist:'watchlist',completed:'completed',complete:'completed',finished:'completed',dropped:'dropped',on_hold:'watchlist',paused:'watchlist',plan_to_watch:'watchlist','for later':'watchlist'};return rows.slice(1).filter(r=>r&&r.length>1&&String(r[ti]||'').trim()).filter(r=>{if(typeI<0)return true;let ty=normCsvHeader(r[typeI]||'');return !ty||ty==='series'||ty==='tv'||ty==='show'||ty==='tv_show'||ty==='tvshow'}).map(r=>{let rawSt=String(r[statusI]||'').trim();let stKey=normCsvHeader(rawSt).replace(/-/g,'_');return{title:String(r[ti]).trim(),year:(yi>=0?(r[yi]||''):'')||'',tmdbId:tmdbI>=0&&r[tmdbI]?r[tmdbI]:null,tvdbId:tvdbI>=0&&r[tvdbI]?r[tvdbI]:null,status:statusMap[stKey]||statusMap[rawSt.toLowerCase()]||'watchlist',addedAt:addedI>=0?(r[addedI]||''):''}})}
  function parseBingersWatches(rows){let header=(rows[0]||[]).map(h=>String(h||'').replace(/^\uFEFF/,'').trim());let ti=csvHeaderIndex(header,['title','name','show_title','show','series']);let si=csvHeaderIndex(header,['season_number','season','s','season_num']);let ei=csvHeaderIndex(header,['episode_number','episode','e','episode_num','ep']);if(ti===-1)return{};let byTitle={};rows.slice(1).filter(r=>r&&r.length>1&&String(r[ti]||'').trim()).forEach(r=>{let t=String(r[ti]).trim(),s=Number(si>=0?r[si]:0)||0,e=Number(ei>=0?r[ei]:0)||0,b=byTitle[t]=byTitle[t]||{maxSeason:0,maxEpisode:0,count:0};b.count++;if(s>b.maxSeason){b.maxSeason=s;b.maxEpisode=e}else if(s===b.maxSeason&&e>b.maxEpisode)b.maxEpisode=e});return byTitle}
  async function fetchTvMazeNextEpisode(show){try{let tvShow=null;if(show.tvdbId){let r=await fetch('https://api.tvmaze.com/lookup/shows?thetvdb='+encodeURIComponent(show.tvdbId));if(r.ok){let j=await r.json();if(j&&j.id)tvShow=j}}if(!tvShow){let r=await fetch('https://api.tvmaze.com/singlesearch/shows?q='+encodeURIComponent(show.title));if(r.ok){let j=await r.json();if(j&&j.id)tvShow=j}}if(!tvShow)return null;let r2=await fetch('https://api.tvmaze.com/shows/'+tvShow.id+'?embed[]=previousepisode&embed[]=nextepisode');if(!r2.ok)return null;let full=await r2.json();return{previous:(full._embedded&&full._embedded.previousepisode)||null,next:(full._embedded&&full._embedded.nextepisode)||null}}catch(e){return null}}
  async function mapConcurrent(items,limit,fn){let i=0,results=new Array(items.length);async function worker(){while(i<items.length){let idx=i++;results[idx]=await fn(items[idx])}}await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return results}
  async function aiCompleteOne(apiKey,baseUrl,model,system,userMsg,maxTokens){
    apiKey=String(apiKey||'').trim();baseUrl=String(baseUrl||'').trim().replace(/\/+$/,'');model=String(model||'').trim();
    if(!apiKey)return null;
    if(baseUrl){
      // OpenAI-compatible /chat/completions — Groq, Gemini, OpenRouter و مشابه
      // مقادیر trim می‌شوند چون wrangler secret put از طریق echo/پایپ معمولاً یک \n اضافه ته مقدار می‌ذاره
      // reasoning_effort:'low' جلوی مدل‌های استدلالی (مثل openai/gpt-oss-* روی Groq یا nvidia/nemotron روی OpenRouter) رو می‌گیره که کل سقف توکن رو صرف «فکرکردن» کنن و جواب خالی/ناتموم برگردونن؛ ارائه‌دهنده‌هایی که این پارامتر رو نمی‌شناسن معمولاً نادیده‌اش می‌گیرن.
      let resp=await fetch(baseUrl+'/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify({model,max_tokens:maxTokens||800,reasoning_effort:'low',messages:[{role:'system',content:system},{role:'user',content:typeof userMsg==='string'?userMsg:[{type:'text',text:userMsg.text},{type:'image_url',image_url:{url:userMsg.image}}]}]})});
      let txt=await resp.text();
      if(!resp.ok)throw new Error('خطای مدل ('+resp.status+') url='+(baseUrl+'/chat/completions')+' model='+model+' keyLen='+apiKey.length+' ct='+resp.headers.get('content-type')+' len='+resp.headers.get('content-length')+' body:'+txt.slice(0,300));
      let r;try{r=txt?JSON.parse(txt):{}}catch(e){throw new Error('پاسخ نامعتبر از مدل: '+txt.slice(0,300))}
      return(r.choices&&r.choices[0]&&r.choices[0].message&&r.choices[0].message.content)||''
    }
    let r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model,max_tokens:maxTokens||800,system,messages:[{role:'user',content:typeof userMsg==='string'?userMsg:(()=>{let m=/^data:(image\/[a-z+]+);base64,(.+)$/.exec(userMsg.image||'');return[{type:'image',source:{type:'base64',media_type:m?m[1]:'image/jpeg',data:m?m[2]:''}},{type:'text',text:userMsg.text}]})()}]})}).then(r=>r.json());
    if(r.error)throw new Error(r.error.message||'خطای مدل هوش مصنوعی');
    return(r.content&&r.content[0]&&r.content[0].text)||''
  }
  // Cloudflare's own model (binding AI): used when both keyed providers are missing or refuse the Worker
  async function workersAiComplete(system,userMsg,maxTokens){if(!env.AI)return null;let r=await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast',{messages:[{role:'system',content:system},{role:'user',content:userMsg}],max_tokens:Math.min(maxTokens||800,2048)});return String(r&&(r.response??r.result?.response)||'').trim()}
  // a keyed provider that refused (401/403) is skipped for an hour, so answers go straight to Workers AI instead of
  // waiting on two doomed calls first (the keys stay set; they're tried again later in case access comes back)
  const AI_DOWN=globalThis.__lifeosAiDown||(globalThis.__lifeosAiDown=new Map());
  const aiSkip=n=>(AI_DOWN.get(n)||0)>Date.now(),aiMarkDown=(n,e)=>{if(/\((401|403)\)/.test(String(e&&e.message||'')))AI_DOWN.set(n,Date.now()+3600e3)};
  async function aiComplete(system,userMsg,maxTokens){
    // دو ارائه‌دهنده همزمان فعال: اول AI_PROVIDER_* (پیش‌فرض/اصلی) امتحان می‌شه؛
    // اگه خطا داد (سهمیه/ریت‌لیمیت/قطعی سرویس) و AI_PROVIDER2_* هم تنظیم باشه، خودکار سراغ اون می‌ره.
    // Technical details (status, provider body) go to the Worker log only; people see a short Persian message.
    const short=e=>String(e&&e.message||e).replace(/keyLen=\d+ ?/,'').slice(0,240);
    let first=null;
    if(!aiSkip(1))try{
      let out=await aiCompleteOne(AI_PROVIDER_API_KEY,AI_PROVIDER_BASE_URL,AI_MODEL,system,userMsg,maxTokens);
      if(out!=null)return out;
    }catch(e){first=e;aiMarkDown(1,e);console.log('ai provider 1 failed:',short(e))}
    let second=null;
    if(AI_PROVIDER2_API_KEY&&!aiSkip(2)){try{return await aiCompleteOne(AI_PROVIDER2_API_KEY,AI_PROVIDER2_BASE_URL,AI_MODEL2,system,userMsg,maxTokens)}catch(e){second=e;aiMarkDown(2,e);console.log('ai provider 2 failed:',short(e))}}
    if(env.AI){try{let out=await workersAiComplete(system,userMsg,maxTokens);if(out)return out}catch(e){console.log('workers ai failed:',short(e))}}
    if(first||second)throw new Error('سرویس هوش مصنوعی الان جواب نداد؛ کمی بعد دوباره امتحان کن.');
    return null
  }
  async function aiExtractActions(text){if(!AI_PROVIDER_API_KEY&&!env.AI)return[];let sys='اعمال را از متن کوتاه فارسی کاربر استخراج کن و فقط آرایه JSON برگردان. ساختارها: {"type":"transaction","amount":عدد ریال,"title":"...","category":"خوراک|حمل‌ونقل|قبض|سلامت|تفریح|پوشاک|آموزش|مسکن|متفرقه","kind":"expense|income"} یا {"type":"time","minutes":عدد,"title":"..."} یا {"type":"mood","value":0-10} یا {"type":"sleep","value":"N ساعت"} یا {"type":"series","title":"...","season":عدد,"episode":عدد} یا {"type":"task","title":"...","date":"YYYY-MM-DD","startTime":"HH:MM"|null} یا {"type":"reminder","title":"...","date":"YYYY-MM-DD","time":"HH:MM"|null,"whenLabel":"..."} یا {"type":"investment","assetType":"crypto|stock|gold|dollar|euro|other","symbol":"نماد کریپتو/سهم — برای طلا/دلار/یورو لازم نیست","txType":"buy|sell","quantity":عدد (برای دلار/یورو = مقدار ارز),"price":عدد (قیمت هر واحد؛ طلا/سایر به ریال، کریپتو/سهم به دلار؛ برای دلار/یورو لازم نیست بنویسی)} — برای هر متنی که «خریدم/فروختم» به‌همراه دلار، یورو، طلا، سکه، کریپتو (بیت‌کوین و…) یا سهام باشد از این نوع استفاده کن، نه transaction. مبلغ‌های فارسی: «۲/۵ م» یا «2.5م» = 2500000، «۵۰ هزار» = 50000. پیش‌فرض ریال است؛ اگر کنار مبلغ «تومان» نوشته شده بود آن را در ۱۰ ضرب کن و ریال بده (1,500,000 تومان = 15,000,000 ریال). عدد «موجودی» را هرگز مبلغ نگیر. تاریخ نسبی را به میلادی ISO با تقویم تهران تبدیل کن. اگر چیزی نبود [] برگردان.';try{let out=await aiComplete(sys,text,500);let m=out&&out.match(/\[[\s\S]*\]/);if(!m)return[];let arr=JSON.parse(m[0]);return Array.isArray(arr)?arr.filter(a=>a&&typeof a==='object'&&['transaction','time','mood','sleep','series','task','reminder','investment'].includes(a.type)):[]}catch(e){return[]}}
  function pearson(xs,ys){let n=xs.length;if(n<3)return null;let mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n,num=0,dx2=0,dy2=0;for(let i=0;i<n;i++){let dx=xs[i]-mx,dy=ys[i]-my;num+=dx*dy;dx2+=dx*dx;dy2+=dy*dy}let den=Math.sqrt(dx2*dy2);return den===0?null:num/den}
  function correlationLabel(r){if(r===null)return{strength:'داده کافی نیست',direction:null};let a=Math.abs(r),direction=r>=0?'مثبت':'منفی',strength=a<0.2?'ناچیز':a<0.5?'ضعیف':a<0.7?'متوسط':'قوی';return{strength,direction}}
  function parseSleepHours(v){if(!v)return null;let m=String(v).match(/(\d+(?:\.\d+)?)/);return m?Number(m[1]):null}
  const CATEGORY_KEYWORDS=[['خوراک',/نان|رستوران|شام|ناهار|صبحانه|غذا|کافه|سوپرمارکت|میوه|قصاب|نانوایی|فست\s?فود/],['حمل‌ونقل',/تاکسی|اسنپ|تپسی|بنزین|پمپ\s?بنزین|مترو|اتوبوس|پارکینگ|تعمیر\s?ماشین|بلیط|مسافرت/],['قبض',/قبض|برق|آب و فاضلاب|گاز|اینترنت|تلفن|شارژ\s?خط|بیمه/],['سلامت',/دکتر|پزشک|دارو|داروخانه|بیمارستان|درمانگاه|دندانپزشک|آزمایشگاه/],['تفریح',/سینما|کنسرت|بازی|فیلم|پارک|تفریح|بولینگ|بیلیارد/],['پوشاک',/لباس|کفش|پوشاک|مانتو|شلوار|کاپشن|عینک|کیف/],['آموزش',/کتاب|دوره|کلاس|آموزش|شهریه|دانشگاه/],['مسکن',/اجاره|رهن|شارژ\s?ساختمان|مسکن/]];
  function isIncomeTx(x){return !!x&&x.kind==='income'&&!x.notIncome} /* «درآمد لحاظ نشود»: ماندهٔ حساب دست‌نخورده می‌ماند، آمار درآمد نه */
  function gambleKind(t){if(/(?:^|[\s#_،,.:;|])پوکر|poker|کازینو|casino|بلک\s?جک|blackjack|رولت|roulette|تگزاس/i.test(t))return'poker';if(/(?:^|[\s#_،,.:;|])بت(?:م|ه|هام|ها|های)?(?:[\s#_،,.:;|]|$)|(?:سایت|حساب|اکانت)\s*بت|شرط\s?بندی|شرط‌بندی|betting/i.test(t))return'bet';return null}
  // پوکر/بت هرگز نباید تراکنش بسازد (پولش یا دلاری است که جدا ثبت می‌شود یا ریالی که خودش
// به حساب بانک می‌آید). اگر متن شکل «ورودی/خروجی» داشته باشد به سشن پوکر تبدیل می‌شود،
// وگرنه فقط یک یادداشت در Inbox می‌ماند — بدون هیچ اثر روی تراکنش‌ها و ماندهٔ حساب.
function parseGambleText(t,base){let kind=gambleKind(t);if(!kind)return null;let nums=[],m,re=/(\d[\d.,،٬٫]*)\s*(میلیارد|میلیون|ملیون|هزار|تومان|تومن|ریال|م\b)?/g;while((m=re.exec(t))){let a=parsePersianAmount(m[0]);if(a&&a>=1000)nums.push({amount:a,index:m.index,len:m[0].length})}if(kind==='bet'&&nums.length===0){let re2=/(\d[\d.,،٬٫]*)/g,m2;while((m2=re2.exec(t))){let b=parsePersianAmount(m2[0]);if(b!=null&&b>0)nums.push({amount:b,index:m2.index,len:m2[0].length})}}let session=null;if(kind==='poker'){let inRe=/(?:ورودی|ورود|buy\s?-?\s?in|بای\s?این|خرید|استیک)/i,outRe=/(?:خروجی|خروج|cash\s?-?\s?out|کش\s?اوت|نتیجه)/i,ki=t.search(inRe),ko=t.search(outRe),bi=null,co=null;if(ki>=0&&ko>=0&&ki!==ko){let kA=Math.min(ki,ko),kB=Math.max(ki,ko),lead=[],segA=[],segB=[];for(const n of nums){if(n.index<kA)lead.push(n);else if(n.index<kB)segA.push(n);else segB.push(n)}let last=a=>a.length?a[a.length-1].amount:null;if(ki<ko){bi=last(lead)||last(segA)||last(segB);co=last(segB)||last(segA)||last(lead)}else{co=last(lead)||last(segA)||last(segB);bi=last(segB)||last(segA)||last(lead)}}if(bi&&co){let dinfo=extractDateFromText(t,base);session={type:'poker',date:(dinfo&&dinfo.date)||base,buyIn:bi,cashOut:co,location:/آنلاین|online|vpn/i.test(t)?'آنلاین':'خانه دوستان'}}}if(kind==='bet'&&nums.length===1&&/(?:موجودی|مانده|balance)/i.test(t)&&!/ورودی|خروجی|ورود|خروج/.test(t)){let dinfo=extractDateFromText(t,base);session={type:'betDay',date:(dinfo&&dinfo.date)||base,balance:nums[0].amount}}return{gamble:kind,session}}
  function catKey(title){return String(title||'').replace(/[0-9۰-۹٠-٩]+/g,' ').replace(/[\-_.,،:;/\\()\[\]#*+|]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase().slice(0,60)}
  // Bank titles like «خرید از فروشگاه ۱۲۳۴» lose their only distinguishing part (the digits) in catKey,
// so a key made only of generic bank words would lump every store together — never learn/apply those.
const CAT_GENERIC_WORDS=new Set('خرید از فروشگاه فروشگاهی کالا پرداخت برداشت پول انتقال کارت به واریز اینترنتی اینترنت پایانه pos ترمینال هزینه ثبت‌شده ثبت شده متن شاپرک حساب شما پرید بانک بلو و با بابت تراکنش دریافت ساتنا پایا خدمات وجه'.split(' '));
function catKeyGeneric(key){let w=String(key||'').split(' ').filter(Boolean);return !w.length||w.every(x=>CAT_GENERIC_WORDS.has(x))}
function learnedCategory(db,userId,title){let key=catKey(title);if(!key||catKeyGeneric(key))return null;let r=(db.catRules||[]).find(x=>x.userId===userId&&x.key===key);return r?r.cat:null}
  function suggestCategoryKeyword(title){let t=String(title||'');for(const[cat,re]of CATEGORY_KEYWORDS)if(re.test(t))return cat;return null}
  // ---------------------------------------------------------------------------
  // دسته‌بندی مجدد گروهی تراکنش‌ها («متفرقه»ها)
  //
  // سه لایه، همه قطعی و آفلاین (بدون AI، بدون کلید):
  //   ۱) نقشهٔ کلیدواژهٔ غنی‌شده (دسته‌های قبلی + سفر/هدیه/حیوانات + تفکیک بیمه و شارژ)
  //   ۲) قانون «بلندترین کلیدواژهٔ تطبیق‌شده برنده است» تا ترتیب دسته‌ها نتیجه را
  //      خراب نکند: «شارژ ساختمان» → مسکن (نه قبض که «شارژ» دارد)،
  //      «بیمه شخص ثالث» → حمل‌ونقل (نه قبض که «بیمه» دارد).
  //   ۳) کلیدواژه‌های دلخواه خود کاربر که از UI می‌آید (مثلاً نام یک فروشگاه محلی).
  // تطبیق روی متن نرمال‌شده انجام می‌شود: رقم فارسی/عربی → انگلیسی، ي→ی، ك→ک،
  // نیم‌فاصله → فاصله، حذف اعراب و فاصله‌های اضافی.
  // ---------------------------------------------------------------------------
  const INCOME_KEYWORDS = [
    ['حقوق', /حقوق|دستمزد|مزایا|پاداش|عیدی|سنوات|حق\s?الزحمه|کارانه/],
    ['درآمد', /درآمد|فروش|دریافت|واریز|اجاره\s?بها|سود|بهره|سپرده|رفاند|بازگشت\s?وجه|برگشت\s?از\s?خرید|یارانه|مهریه|ارث|طلب|دیون/],
  ];
  // نام‌های متفاوتی که کاربرها/درون‌ریزی بانک برای یک دسته می‌نویسند → نام رسمی.
  const CATEGORY_SYNONYMS = [
    [/^(خوراک|خورد\s*و\s*خوراک|مواد\s*غذایی|غذا)$/, 'خوراک'],
    [/^(حمل|حمل\s*و\s*نقل|رفت\s*و\s*آمد|ترابری|تردد)$/, 'حمل‌ونقل'],
    [/^(قبض|قبوض|قبض\s*و\s*شارژ|صورتحساب|صورت\s*حساب)$/, 'قبض'],
    [/^(سلامت|بهداشت|درمان|پزشکی)$/, 'سلامت'],
    [/^(تفریح|سرگرمی)$/, 'تفریح'],
    [/^(پوشاک|لباس)$/, 'پوشاک'],
    [/^(آموزش|تحصیل|تحصیلات)$/, 'آموزش'],
    [/^(مسکن|خانه)$/, 'مسکن'],
    [/^(سفر|مسافرت)$/, 'سفر'],
    [/^(هدیه|کمک|خیریه)$/, 'هدیه و کمک'],
    [/^(حیوانات|حیوان\s*خانگی|پت)$/, 'حیوانات خانگی'],
    [/^(متفرقه|سایر|عمومی|دیگر)$/, 'متفرقه'],
    [/^(درآمد|دریافتی)$/, 'درآمد'],
  ];
  // دسته‌های جدید و کلیدواژه‌های تکمیلی. ترتیب مهم نیست (قانون بلندترین تطبیق)،
  // فقط در تساویِ طول، موردی که زودتر ثبت شده برنده است.
  const EXTRA_CATEGORY_RULES = [
    ['مسکن', /شارژ\s?ساختمان|شارژ\s?آپارتمان|شارژ\s?مجتمع|مدیر\s?ساختمان|آسانسور|نظافت\s?ساختمان|نگهبانی|تعمیرات\s?منزل|تعمیر\s?خانه|رنگ\s?ساختمان|ابزار|یراق|کاشی|سرامیک|مبل|فرش|موکت|لوازم\s?خانگی|یخچال|لباسشویی|کولر|پکیج|بخاری|بازسازی|املاک|کمیسیون\s?املاک|پرداخت\s?به\s?مدیر/],
    ['قبض', /آب\s?بها|برق|گاز|قبض|مالیات|عوارض|جریمه|خلافی|شارژ\s?خط|شارژ\s?سیم|شارژ\s?موبایل|شارژ\s?اعتبار|اینترنت|بسته\s?اینترنتی|مخابرات|همراه\s?اول|ایرانسل|رایتل|شاتل|آسیاتک|پارس\s?پک|های\s?وب/],
    ['حمل‌ونقل', /بیمه\s?شخص\s?ثالث|بیمه\s?ثالث|بیمه\s?خودرو|بیمه\s?ماشین|بنزین|گازوئیل|سی\s?ان\s?جی|گاز\s?خودرو|سوخت|کارواش|تعمیر\s?ماشین|تعمیر\s?خودرو|تعمیرگاه|مکانیک|باک|کرایه|بلیط|اتوبوس|مترو|قطار|راه\s?آهن|دربست|وانت|باربری|الوپیک|پیک|تپسی|اسنپ|پارکینگ|عوارضی/],
    ['سلامت', /بیمه\s?درمان|بیمه\s?سلامت|بیمه\s?تکمیلی|تکمیلی|دندان|دندانپزشک|داروخانه|دارو|پزشک|دکتر|درمانگاه|بیمارستان|آزمایش|سونوگرافی|فیزیوتراپی|روانپزشک|روانشناس|مشاوره|کلینیک|ویزیت|تزریقات|واکسن|عینک|لنز|سمعک|پرستار/],
    ['خوراک', /اسنپ\s?فود|دیجی\s?کالا\s?جت|سوپر\s?مارکت|مینی\s?مارکت|هایپر|هایپر\s?استار|تره\s?بار|جانبو|افق\s?کوروش|قنادی|شیرینی|بستنی|آبمیوه|پیتزا|ساندویچ|کباب|تهیه\s?غذا|بیرون\s?بر|تحویل\s?غذا|لواشک|نوشیدنی|نوشابه|لبنیات|سبزیجات|صیفیجات|خواروبار|بقالی|مارکت|رستوران|کافه/],
    ['سفر', /سفر|مسافرت|هتل|اقامتگاه|بوم\s?گردی|ویلا|تور|بلیط\s?هواپیما|بلیط\s?قطار|پرواز|فرودگاه|مسافرخانه|رزرو\s?هتل|علی\s?بابا|فلای\s?تودی|قایق|تفریح\s?دریایی/],
    ['هدیه و کمک', /هدیه|کادو|پیشکش|صدقه|کمک|خیریه|نذری|وقف|اعانه|گل\s?فروشی|دسته\s?گل|محرم|خیرات|حمایت\s?از/],
    ['حیوانات خانگی', /حیوان\s?خانگی|گربه|سگ|پت\s?شاپ|دامپزشک|غذای\s?حیوان|آکواریوم|پرنده|ماهی\s?زینتی/],
    ['پوشاک', /کفش|کتونی|کلاه|شال|روسری|تی\s?شرت|بلوز|دامن|لباس\s?زیر|جوراب|کمربند|ساعت\s?مچی|زیورآلات|طلا|نقره|جواهر|حلقه|دستبند|گردنبند|انگشتر|عطر|ادکلن|لوازم\s?آرایش|آرایشی|شامپو|خمیردندان|صابون|مانتو|شلوار|کاپشن|پالتو|کیف/],
    ['آموزش', /کتاب|دوره|کلاس|آموزش|شهریه|دانشگاه|مدرسه|معلم|کنکور|قلم\s?چی|یادگیری|لپ\s?تاپ|آزمون|مقاله|ثبت\s?نام\s?کلاس|آموزشگاه/],
    ['تفریح', /سینما|تئاتر|کنسرت|گیم|بازی|پلی\s?استیشن|نتفلیکس|فیلیمو|نماوا|اسپاتیفای|اشتراک|پارک|شهربازی|اتاق\s?فرار|استخر|باشگاه|ورزش|دوچرخه|تفریحی|گردش|کوهنوردی|بیلیارد|بولینگ/],
  ];
  // source رگولارها را به فهرست کلیدواژهٔ ساده تبدیل می‌کنیم (بدون ساخت RegExp
  // پویا: سریع‌تر است و کلیدواژهٔ دلخواه کاربر هرگز به‌عنوان الگو اجرا نمی‌شود).
  function keywordAlts(re) { return String(re.source).split('|').map(function (s) { return s.trim() }).filter(Boolean) }
  function keywordToLiteral(w) {
    return String(w || '')
      .replace(/\\s\*/g, ' ')
      .replace(/\\s\+/g, ' ')
      .replace(/\\s\?/g, ' ')
      .replace(/\\s/g, ' ')
      .replace(/[\\()[\]{}.^$*+?|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function normalizeCatText(s) {
    return enNum(String(s || ''))
      .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/ؤ/g, 'و').replace(/ة/g, 'ه')
      .replace(/[\u200c\u200f\u200e\ufeff\u200d]/g, ' ')
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function normalizeCategoryName(s) { let t = String(s || '').trim(); if (!t) return null; for (const [re, to] of CATEGORY_SYNONYMS) if (re.test(t)) return to; return t }
  const CATEGORY_RULE_WORDS = (function () {
    let out = [];
    for (const [cat, re] of CATEGORY_KEYWORDS) for (const a of keywordAlts(re)) { let w = normalizeCatText(keywordToLiteral(a)); if (w.length > 1) out.push({ cat, word: w }) }
    for (const [cat, re] of EXTRA_CATEGORY_RULES) for (const a of keywordAlts(re)) { let w = normalizeCatText(keywordToLiteral(a)); if (w.length > 1) out.push({ cat, word: w }) }
    return out;
  })();
  const INCOME_RULE_WORDS = (function () {
    let out = [];
    for (const [cat, re] of INCOME_KEYWORDS) for (const a of keywordAlts(re)) { let w = normalizeCatText(keywordToLiteral(a)); if (w.length > 1) out.push({ cat, word: w }) }
    return out;
  })();
  // بلندترین کلیدواژهٔ تطبیق‌شده برنده است؛ در تساوی، موردِ زودتر ثبت‌شده.
  function matchCategoryByText(text, extraRules) {
    let t = normalizeCatText(text);
    if (!t) return null;
    let best = null, rank = 0;
    for (const r of CATEGORY_RULE_WORDS) {
      if (t.indexOf(r.word) >= 0 && (!best || r.word.length > best.len || (r.word.length === best.len && rank < best.rank))) best = { cat: r.cat, len: r.word.length, rank, word: r.word };
      rank++;
    }
    if (Array.isArray(extraRules)) for (let i = 0; i < extraRules.length; i++) {
      let r = extraRules[i]; if (!r) continue;
      let w = normalizeCatText(String(r.word || r.keyword || ''));
      if (w.length < 2) continue;
      if (t.indexOf(w) >= 0 && (!best || w.length >= best.len)) best = { cat: normalizeCategoryName(String(r.cat || r.category || 'متفرقه')) || 'متفرقه', len: w.length, rank: -1, word: w };
    }
    if (!best) return null;
    return { category: best.cat, keyword: best.word, matched: best.len };
  }
  // خروجی: {category, keyword, reason} — اگر category null باشد یعنی «تغییری لازم نیست».
  // reason یکی از: transfer | income-keyword | income-default | keyword | same | no-match
  function categorizeTransaction(t, extraRules) {
    let title = normalizeCatText(t && t.title), kind = String((t && t.kind) || 'expense');
    let cur = normalizeCategoryName(t && t.category) || 'متفرقه';
    if (kind === 'transfer') return { category: null, keyword: null, reason: 'transfer' };
    let text = title;
    if (t && Array.isArray(t.tags) && t.tags.length) text += ' ' + normalizeCatText(t.tags.join(' '));
    if (kind === 'income') {
      for (const r of INCOME_RULE_WORDS) if (text.indexOf(r.word) >= 0) {
        if (r.cat === cur) return { category: null, keyword: r.word, reason: 'same' };
        return { category: r.cat, keyword: r.word, reason: 'income-keyword' };
      }
      if (cur === 'درآمد') return { category: null, keyword: null, reason: 'same' };
      return { category: 'درآمد', keyword: null, reason: 'income-default' };
    }
    let hit = matchCategoryByText(text, extraRules);
    if (hit && hit.category && hit.category !== cur && normalizeCategoryName(hit.category) !== cur) return { category: hit.category, keyword: hit.keyword, reason: 'keyword' };
    return { category: null, keyword: hit ? hit.keyword : null, reason: hit ? 'same' : 'no-match' };
  }
  function decodeXmlEntities(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&apos;/g,"'").replace(/\s+/g,' ').trim()}
  function extractTag(block,tag){let m=block.match(new RegExp('<'+tag+'[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'));return m?m[1]:''}
  function extractAttr(block,tag,attr){let m=block.match(new RegExp('<'+tag+'[^>]*\\b'+attr+'=["\']([^"\']*)["\']','i'));return m?m[1]:''}
  function parseFeed(xml){let itemBlocks=xml.match(/<item\b[\s\S]*?<\/item>/gi),isAtom=false;if(!itemBlocks){itemBlocks=xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[];isAtom=true}let items=[];for(const block of itemBlocks){let title=decodeXmlEntities(extractTag(block,'title'));let link=isAtom?(extractAttr(block,'link','href')||decodeXmlEntities(extractTag(block,'link'))):decodeXmlEntities(extractTag(block,'link'));let summaryRaw=extractTag(block,'description')||extractTag(block,'summary')||extractTag(block,'content:encoded')||extractTag(block,'content');let summary=decodeXmlEntities(summaryRaw).slice(0,600);let pubDate=decodeXmlEntities(extractTag(block,'pubDate')||extractTag(block,'published')||extractTag(block,'updated'));let guid=decodeXmlEntities(extractTag(block,'guid')||extractTag(block,'id'))||link;if(title)items.push({title,link,summary,pubDate,guid:guid||link||title})}return items}
  function isMostlyLatin(text){let t=String(text||'').replace(/[^A-Za-z؀-ۿ]/g,'');if(!t)return false;let latin=(t.match(/[A-Za-z]/g)||[]).length;return latin/t.length>0.6}
  function textSimilarityScore(a,b){let wa=new Set(String(a||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2)),wb=new Set(String(b||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>2));let common=0;for(const w of wa)if(wb.has(w))common++;return common}
  // Some feed hosts (Google News above all) never answer Cloudflare's servers. rss2json.com fetches the feed from its
  // own servers and returns JSON; it's turned back into minimal RSS so parseFeed and sync work unchanged.
  const xmlEsc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  async function feedViaProxy(feedUrl){let ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),10000);try{let r=await fetch('https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(feedUrl),{signal:ctl.signal});if(!r.ok)throw new Error('proxy HTTP '+r.status);let j=await r.json();if(j.status!=='ok'||!Array.isArray(j.items))throw new Error('proxy: '+String(j.message||'no items').slice(0,60));
    return '<?xml version="1.0"?><rss><channel><title>'+xmlEsc(j.feed&&j.feed.title)+'</title>'+j.items.map(it=>'<item><title>'+xmlEsc(it.title)+'</title><link>'+xmlEsc(it.link)+'</link><guid>'+xmlEsc(it.guid||it.link)+'</guid><description>'+xmlEsc(String(it.description||'').replace(/<[^>]+>/g,' ').slice(0,600))+'</description><pubDate>'+xmlEsc(it.pubDate)+'</pubDate></item>').join('')+'</channel></rss>'}finally{clearTimeout(t)}}
  // In-app reader: fetch the article page and keep its paragraphs (the <article> part when there is one).
  // Scripts, menus and footers are dropped; very short lines (bylines, buttons) too. Returns paragraphs or throws.
  async function extractArticle(url){
    let u;try{u=new URL(url)}catch(e){throw new Error('لینک خبر معتبر نیست.')}if(!/^https?:$/.test(u.protocol))throw new Error('لینک خبر معتبر نیست.');
    if(u.hostname==='news.google.com')throw new Error('این خبر از Google News آمده و متنش فقط در سایت اصلی خوانده می‌شود.');
    let ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),10000),html;
    try{let r=await fetch(u.href,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Accept':'text/html'},signal:ctl.signal,redirect:'follow'});if(!r.ok)throw new Error('سایت خبر جواب نداد (HTTP '+r.status+').');html=(await r.text()).slice(0,2000000)}
    catch(e){throw new Error(e&&e.name==='AbortError'?'سایت خبر دیر جواب داد.':(e.message||'سایت خبر در دسترس نبود.'))}finally{clearTimeout(t)}
    html=html.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi,' ');
    let scope=(html.match(/<article\b[\s\S]*?<\/article>/gi)||[]).sort((a,b)=>b.length-a.length)[0]||(html.match(/<body\b[\s\S]*<\/body>/i)||[html])[0];
    let paras=[],seen=new Set();for(const m of scope.matchAll(/<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)){let txt=decodeXmlEntities(m[2]).replace(/\s+/g,' ').trim();if(txt.length<(m[1].toLowerCase()==='p'?40:25)||seen.has(txt))continue;if(/^(share|tweet|copyright|©|اشتراک|کپی|برچسب|تگ‌ها|منبع:)/i.test(txt))continue;seen.add(txt);paras.push(m[1].toLowerCase()==='p'?txt:'## '+txt);if(paras.length>=80)break}
    while(paras.length&&paras[paras.length-1].startsWith('## '))paras.pop();
    if(paras.filter(x=>!x.startsWith('## ')).length<2)throw new Error('متن کامل این خبر خوانده نشد.');
    let img=(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)||[])[1]||'';
    return{paras,image:/^https:\/\//.test(img)?img:''}}
  // Sites without any feed (e.g. varzesh3): read headline links straight from the page. A headline = a link on the
  // same site whose path carries an article id (4+ digits) or /news|article|post/, with 20–220 characters of text.
  function parseHtmlHeadlines(html,baseUrl){let base;try{base=new URL(baseUrl)}catch(e){return[]}let seen=new Set(),out=[];
    for(const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){let href=(m[1].match(/href\s*=\s*["']([^"'#]+)["']/i)||[])[1];if(!href)continue;let u;try{u=new URL(href.replace(/&amp;/g,'&'),base)}catch(e){continue}
      if(u.hostname.replace(/^www\./,'')!==base.hostname.replace(/^www\./,'')||!/^https?:$/.test(u.protocol))continue;if(!/\/\d{4,}(\/|$|-)|\/(news|article|articles|post|story|fa\/news)\//i.test(u.pathname))continue;
      let text=decodeXmlEntities(m[2].replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();if(text.length<20){text=decodeXmlEntities((m[1].match(/title\s*=\s*["']([^"']+)["']/i)||[])[1]||'').trim()}
      if(text.length<20||text.length>220)continue;let key=u.origin+u.pathname;if(seen.has(key))continue;seen.add(key);out.push({title:text,link:u.href,summary:'',guid:key});if(out.length>=40)break}
    return out}
  async function syncOneNewsSource(db,userId,src){let added=0;try{let xml;if(src.proxy==='rss2json')xml=await feedViaProxy(src.url);else{let r=await fetch(src.url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Accept':'application/rss+xml, application/xml, text/xml, text/html;q=0.9'}});if(!r.ok)throw new Error('HTTP '+r.status);xml=await r.text()}let parsed=src.kind==='html'?parseHtmlHeadlines(xml,src.url):parseFeed(xml);if(src.kind==='html'&&!parsed.length)throw new Error('تیتری در صفحه پیدا نشد.');let existingGuids=new Set(db.news.filter(x=>x.userId===userId&&x.source===src.name).map(x=>x.guid).filter(Boolean));for(const it of parsed.slice(0,30)){if(!it.guid||existingGuids.has(it.guid))continue;db.news.push({id:id(),userId,title:it.title,source:src.name,category:src.category,url:it.link||'',summary:it.summary||'',date:today(),saved:false,guid:it.guid,createdAt:Date.now()});existingGuids.add(it.guid);added++}src.lastSyncAt=Date.now();src.lastError=null;return{source:src.name,ok:true,found:parsed.length,added}}catch(e){src.lastError=e.message;return{source:src.name,ok:false,error:e.message,added:0}}}
  function periodRange(period,periodKey){if(period==='jmonthly'){let y=Number(periodKey.slice(0,4)),m=Number(periodKey.slice(5,7)),ny=m===12?y+1:y,nm=m===12?1:m+1;return{from:jalaliToGregorianIso(y,m,1),to:addDaysIso(jalaliToGregorianIso(ny,nm,1),-1)}}if(period==='yearly')return{from:periodKey+'-01-01',to:periodKey+'-12-31'};if(period==='monthly'){let days=new Date(Number(periodKey.slice(0,4)),Number(periodKey.slice(5,7)),0).getDate();return{from:periodKey+'-01',to:periodKey+'-'+String(days).padStart(2,'0')}}let end=new Date(periodKey+'T12:00:00');end.setDate(end.getDate()+6);return{from:periodKey,to:end.toISOString().slice(0,10)}}
  function computeGoalProgress(db,userId,goal){let{from,to}=periodRange(goal.period,goal.periodKey);if(goal.linkedType==='habit'){return db.habitLogs.filter(l=>l.habitId===goal.linkedId&&l.done&&l.date>=from&&l.date<=to).length}if(goal.linkedType==='finance'){return db.transactions.filter(x=>x.userId===userId&&x.category===goal.linkedId&&x.date>=from&&x.date<=to&&x.kind==='expense').reduce((n,x)=>n+x.amount,0)}if(goal.linkedType==='learning'){let item=db.learning.find(x=>x.id===goal.linkedId&&x.userId===userId);return item&&item.progressTotal?Math.round(item.progressCurrent/item.progressTotal*100):0}return goal.manualValue||0}
  function nextAnnualOccurrence(dateStr){let m=String(dateStr||'').match(/(\d{2})-(\d{2})$/);if(!m)return null;let mo=Number(m[1]),da=Number(m[2]),y=new Date().getFullYear(),cand=new Date(Date.UTC(y,mo-1,da)),t=new Date();t.setUTCHours(0,0,0,0);if(cand<t)cand=new Date(Date.UTC(y+1,mo-1,da));return cand.toISOString().slice(0,10)}
  // A news source can be any site address: if the page isn't a feed, look for <link rel="alternate" …rss/atom>
  // in its HTML, then the usual paths (/feed, /rss…). Returns {feedUrl,title,count} or throws a Persian message.
  async function discoverFeed(raw){
    let start;try{start=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw)}catch(e){throw new Error('آدرس سایت معتبر نیست.')}
    if(!/^https?:$/.test(start.protocol))throw new Error('فقط آدرس http یا https.');
    const UA={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8'};
    const why=[],note=(u,m)=>{let h='';try{h=new URL(u).hostname.replace(/^www\./,'')}catch(e){}why.push(h+': '+m)};
    const get=async u=>{let ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),8000);try{let r=await fetch(u,{headers:UA,signal:ctl.signal,redirect:'follow'});if(!r.ok){note(u,'HTTP '+r.status);return null}let txt=(await r.text()).slice(0,1500000);return{url:r.url||u,txt}}catch(e){note(u,e&&e.name==='AbortError'?'timeout':String(e&&e.message||e).slice(0,60));return null}finally{clearTimeout(t)}};
    const viaProxy=async u=>{try{return{url:u,txt:await feedViaProxy(u),proxy:'rss2json'}}catch(e){note('rss2json',String(e.message||e).slice(0,60));return null}};
    const asFeed=page=>{if(!page||!/<(rss|feed|rdf:RDF)\b/i.test(page.txt.slice(0,3000)))return null;let items=parseFeed(page.txt);if(!items.length)return null;let head=page.txt.split(/<(item|entry)\b/i)[0],title=decodeXmlEntities((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();return{feedUrl:page.url,title,count:items.length,...(page.proxy?{proxy:page.proxy}:{})}};
    // a Google News page (topic, search, section) → the same page as RSS: news.google.com/rss/…
    if(start.hostname==='news.google.com'&&!start.pathname.startsWith('/rss/')&&/^\/(topics|search|stories|headlines)\b/.test(start.pathname)){start=new URL('/rss'+start.pathname+start.search,start.origin)}
    const host=start.hostname.replace(/^www\./,'');
    // big sites that block bots but publish official feeds elsewhere
    const KNOWN={'nytimes.com':/international|world/i.test(start.pathname)?'https://rss.nytimes.com/services/xml/rss/nyt/World.xml':'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml','bbc.com':'https://feeds.bbci.co.uk/news/world/rss.xml','bbc.co.uk':'https://feeds.bbci.co.uk/news/rss.xml','theguardian.com':'https://www.theguardian.com/world/rss','aljazeera.com':'https://www.aljazeera.com/xml/rss/all.xml','cnn.com':'http://rss.cnn.com/rss/edition.rss'};
    // last resort for any site that blocks us or has no feed: Google News limited to that site
    const viaGoogle=async()=>{let fa=/\.ir$/i.test(host)||/[\u0600-\u06FF]/.test(raw),q='https://news.google.com/rss/search?q='+encodeURIComponent('site:'+host)+(fa?'&hl=fa&gl=IR&ceid=IR:fa':'&hl=en-US&gl=US&ceid=US:en'),pg=null,g=asFeed(await viaProxy(q))||asFeed(pg=await get(q));if(pg&&!g)note(q,'not a feed: '+pg.txt.slice(0,80).replace(/\s+/g,' '));if(!g)return null;return{feedUrl:q,title:host+' (Google News)',count:g.count,via:'gnews'}};
    if(KNOWN[host]){let kp=await get(KNOWN[host]),k=asFeed(kp)||asFeed(await viaProxy(KNOWN[host]));if(k)return k;if(kp)note(KNOWN[host],'not a feed')}
    if(start.hostname==='news.google.com'){let gp=asFeed(await viaProxy(start.href))||asFeed(await get(start.href));if(gp){if(/google news/i.test(gp.title)||!gp.title)gp.title=(gp.title||'Google News').replace(/ - Google News$/i,'')+' (Google News)';return gp}throw new Error('فید Google News خوانده نشد. ('+why.slice(0,3).join('، ')+')')}
    let first=await get(start.href);if(!first){let g=await viaGoogle();if(g)return g;console.log('news discover failed',raw,why.join(' | '));throw new Error('سایت در دسترس نبود یا درخواست را رد کرد. ('+why.slice(0,3).join('، ')+')')}
    let f=asFeed(first);if(f)return f;
    let cands=[];for(const m of first.txt.matchAll(/<link\b[^>]*>/gi)){let tag=m[0];if(!/rel=["']?alternate/i.test(tag)||!/type=["']?application\/(rss|atom)\+xml/i.test(tag))continue;let href=(tag.match(/href=["']([^"']+)["']/i)||[])[1];if(href){try{cands.push(new URL(href.replace(/&amp;/g,'&'),first.url).href)}catch(e){}}}
    let origin=new URL(first.url).origin;for(const path of ['/feed','/rss','/rss.xml','/feed.xml','/atom.xml','/index.xml','/feeds/posts/default'])cands.push(origin+path);
    for(const c of [...new Set(cands)].slice(0,9)){let pg=await get(c),ff=asFeed(pg);if(ff){if(!ff.title){let t=(first.txt.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1];ff.title=t?decodeXmlEntities(t).trim():''}return ff}}
    // no feed at all: fall back to the page's own headline links if there are enough of them
    let heads=parseHtmlHeadlines(first.txt,first.url);if(heads.length>=5){let t=(first.txt.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1];return{feedUrl:first.url,title:t?decodeXmlEntities(t).replace(/\s+/g,' ').trim():'',count:heads.length,kind:'html'}}
    let g=await viaGoogle();if(g)return g;
    console.log('news discover failed',raw,why.join(' | '));
    throw new Error('در این سایت فید خبری (RSS) پیدا نشد و تیتر خبری هم در صفحه دیده نشد.'+(why.length?' ('+why.slice(-3).join('، ')+')':''));
  }
  async function syncAllNewsSources(db){let results=[],changed=false;for(const user of db.users){for(const src of db.newsSources.filter(x=>x.userId===user.id&&x.active)){let r=await syncOneNewsSource(db,user.id,src);if(r.added)changed=true;results.push(r)}}return{changed,results}}
  async function rapidApiGet(host,path){if(!RAPIDAPI_KEY)return null;let r=await fetch('https://'+host+path,{headers:{'x-rapidapi-key':RAPIDAPI_KEY,'x-rapidapi-host':host}}),data=await r.json();if(!r.ok)throw new Error((data&&(data.message||data.error))||'خطا در دریافت داده از RapidAPI');return data}
  async function apiFootballFetch(path,params){let qs='?'+new URLSearchParams(params||{});if(API_FOOTBALL_KEY){let r=await fetch('https://v3.football.api-sports.io'+path+qs,{headers:{'x-apisports-key':API_FOOTBALL_KEY}}),data=await r.json();if(!r.ok)throw new Error(data.message||'خطا در دریافت داده از API-Football');return data}if(RAPIDAPI_KEY)return rapidApiGet('api-football-v1.p.rapidapi.com','/v3'+path+qs);return null}
  function currentFootballSeason(){let d=new Date(),y=d.getUTCFullYear(),m=d.getUTCMonth()+1;return(m>=7?y:y-1)+'-'+(m>=7?y+1:y)}
  const FREE_LEAGUES=[{id:'eng.1',tsdb:'4328',name:'لیگ برتر انگلیس',country:'انگلیس',season:currentFootballSeason()},{id:'esp.1',tsdb:'4335',name:'لالیگا',country:'اسپانیا',season:currentFootballSeason()},{id:'ita.1',tsdb:'4332',name:'سری آ',country:'ایتالیا',season:currentFootballSeason()},{id:'ger.1',tsdb:'4331',name:'بوندس‌لیگا',country:'آلمان',season:currentFootballSeason()},{id:'fra.1',tsdb:'4334',name:'لیگ ۱',country:'فرانسه',season:currentFootballSeason()},{id:'tur.1',tsdb:'4339',name:'سوپر لیگ ترکیه',country:'ترکیه',season:currentFootballSeason()},{id:'por.1',tsdb:'4344',name:'پریمیرا لیگا پرتغال',country:'پرتغال',season:currentFootballSeason()},{id:'uefa.champions',tsdb:'4480',name:'لیگ قهرمانان اروپا',country:'اروپا',season:currentFootballSeason()},{id:'uefa.europa',tsdb:'4481',name:'لیگ اروپا',country:'اروپا',season:currentFootballSeason()},{id:'uefa.nations',tsdb:'4490',name:'لیگ ملت‌های اروپا',country:'اروپا',season:currentFootballSeason()},{id:'afc.champions',tsdb:'4719',name:'لیگ نخبگان آسیا',country:'آسیا',season:currentFootballSeason()},{id:'ksa.1',tsdb:'4668',name:'لیگ حرفه‌ای عربستان',country:'عربستان',season:currentFootballSeason()},{id:'irn.1',tsdb:'4742',name:'لیگ برتر خلیج فارس',country:'ایران',season:currentFootballSeason()}];
  async function fetchEspnScoreboard(espnCode,date){let q=(date?'?dates='+date.replace(/-/g,''):''),hosts=['https://site.api.espn.com','https://site.web.api.espn.com'],last=null;for(let h of hosts){try{let r=await fetch(h+'/apis/site/v2/sports/soccer/'+espnCode+'/scoreboard'+q,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Accept':'application/json'}});if(!r.ok){last='HTTP '+r.status;continue}let data=await r.json();if(data&&data.events)return data;last='خالی'}catch(e){last=e.message}}throw new Error('ESPN: '+(last||'ناموفق'))}
  const ESPN_LEAGUE_IDS=['eng.1','esp.1','ita.1','ger.1','fra.1','tur.1','por.1','uefa.champions','uefa.europa','afc.champions','uefa.nations'];
  const BROWSER_UA={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'};
  async function fetchVarzesh3Livescore(){let r=await fetch('https://www.varzesh3.com/livescore',{headers:BROWSER_UA});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}
  function findKeyDeep(obj,key,depth){
    if(depth>25||!obj||typeof obj!=='object')return null;
    if(!Array.isArray(obj)&&obj[key]!==undefined)return obj[key];
    if(Array.isArray(obj)){for(const v of obj){let r=findKeyDeep(v,key,depth+1);if(r)return r}}
    else{for(const k in obj){let r=findKeyDeep(obj[k],key,depth+1);if(r)return r}}
    return null;
  }
  function extractVarzesh3TodayLeagues(html){
    let marker='self.__next_f.push(',parts=html.split(marker);
    for(let i=1;i<parts.length;i++){
      let candidate=parts[i],scriptEndIdx=candidate.indexOf('</script>');
      if(scriptEndIdx!==-1)candidate=candidate.slice(0,scriptEndIdx);
      candidate=candidate.trim();
      if(candidate.endsWith(');'))candidate=candidate.slice(0,-2);
      else if(candidate.endsWith(')'))candidate=candidate.slice(0,-1);
      let arr;try{arr=JSON.parse(candidate)}catch(e){continue}
      if(!Array.isArray(arr)||typeof arr[1]!=='string')continue;
      let inner=arr[1],colonIdx=inner.indexOf(':');
      if(colonIdx<0)continue;
      let data;try{data=JSON.parse(inner.slice(colonIdx+1))}catch(e){continue}
      let tabs=findKeyDeep(data,'tabs',0);
      if(tabs&&Array.isArray(tabs)){
        let todayTab=tabs.find(t=>t.title==='امروز')||tabs.find(t=>(t.leagues||[]).length);
        if(todayTab)return todayTab.leagues||[];
      }
    }
    return[];
  }
  function mapVarzesh3Match(m,leagueName){
    let hs=m.goals?m.goals.host:null,gs=m.goals?m.goals.guest:null,status='upcoming';
    if(m.isLive)status='live';else if(m.goals!=null&&/نهایی|پایان/.test(m.statusTitle||''))status='finished';
    return{fixtureId:m.id,home:(m.host&&m.host.name)||'',away:(m.guest&&m.guest.name)||'',homeLogo:(m.host&&m.host.logo)||null,awayLogo:(m.guest&&m.guest.logo)||null,league:leagueName||'',date:m.startOnUtc||null,status,score:(hs??'-')+' - '+(gs??'-')};
  }
  const NON_FOOTBALL_SPORT_RE=/هندبال|والیبال|بسکتبال|فوتسال|هاکی|کشتی|تنیس|راگبی|شنا|بدمینتون|کبدی|دو و میدانی/;
  async function fetchVarzesh3LeagueDay(v3id,wantDate){
    let html=await fetchVarzesh3Livescore(),leagues=extractVarzesh3TodayLeagues(html),league=leagues.find(l=>l.id===v3id);
    if(!league||NON_FOOTBALL_SPORT_RE.test(league.title||''))return[];
    let out=[];
    (league.dates||[]).forEach(d=>{
      let dm=(d.date||'').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/),isoDate=dm?jalaliToGregorianIso(Number(dm[1]),Number(dm[2]),Number(dm[3])):null;
      if(wantDate&&isoDate!==wantDate)return;
      (d.matches||[]).forEach(m=>out.push(mapVarzesh3Match(m,league.title)));
    });
    return out;
  }
  function mapEspnStandings(data){let entries=(data.children&&data.children[0]&&data.children[0].standings&&data.children[0].standings.entries)||[];return entries.map(e=>{let st={};(e.stats||[]).forEach(s=>st[s.name]=s.value);return{rank:st.rank||0,team:(e.team&&e.team.displayName)||'',logo:(e.team&&e.team.logos&&e.team.logos[0]&&e.team.logos[0].href)||null,played:st.gamesPlayed||0,win:st.wins||0,draw:st.ties||0,loss:st.losses||0,gf:st.pointsFor||0,ga:st.pointsAgainst||0,gd:st.pointDifferential||0,pts:st.points||0}}).sort((a,b)=>a.rank-b.rank)}
  function mapTsdbStandings(data){return(data.table||[]).map(t=>({rank:Number(t.intRank)||0,team:t.strTeam||'',logo:t.strBadge?String(t.strBadge).replace(/\/tiny$/,''):null,played:Number(t.intPlayed)||0,win:Number(t.intWin)||0,draw:Number(t.intDraw)||0,loss:Number(t.intLoss)||0,gf:Number(t.intGoalsFor)||0,ga:Number(t.intGoalsAgainst)||0,gd:Number(t.intGoalDifference)||0,pts:Number(t.intPoints)||0}))}
  const ESPN_UA={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Accept':'application/json'};
  const VARZESH3_LEAGUE_IDS={'ger.1':1,'esp.1':2,'eng.1':3,'ita.1':4,'fra.1':5,'irn.1':6,'uefa.champions':25,'uefa.europa':29,'afc.champions':26,'por.1':55,'ksa.1':326,'tur.1':35,'uefa.nations':318};
  async function fetchVarzesh3LeaguePage(v3id){let r=await fetch('https://www.varzesh3.com/football/league/'+v3id+'/x',{headers:BROWSER_UA});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}
  // فرم ۵ بازی آخر: API جدول ورزش۳ برای هر تیم recentMatches داره (قدیمی→جدید؛ 1=برد، 2=باخت، 3=مساوی)
  async function attachVarzesh3Form(v3id,html,items){
    let m=String(html).match(new RegExp('leagues\\/'+v3id+'\\/seasons\\/(\\d+)\\/'));if(!m)return;
    let r=await fetch('https://web-api.varzesh3.com/v2.0/football/leagues/'+v3id+'/seasons/'+m[1]+'/standing',{headers:Object.assign({},BROWSER_UA,{Accept:'application/json',Referer:'https://www.varzesh3.com/',Origin:'https://www.varzesh3.com'})});
    if(!r.ok)return;let data=await r.json(),map={1:'W',2:'L',3:'D'},byName={};
    (data.teams||[]).forEach(t=>{byName[t.name]=t});
    items.forEach(it=>{let t=byName[it.team];if(!t||!Array.isArray(t.recentMatches))return;let rm=t.recentMatches.filter(x=>map[x.resultType]).slice(-5);it.form=rm.map(x=>map[x.resultType]).join('');it.formTips=rm.map(x=>String(x.tooltip||'').trim());it.formDates=rm.map(x=>{let v=x.date||x.matchDate||x.startDate||x.dateTime||x.startTime||null,t=v?Date.parse(v):NaN;return isFinite(t)?new Date(t).toISOString():null})});
  }
  // every captioned table on the page (group stages have one per group: «جدول گروه ۱»…); with more than one
  // table each row gets group = its caption without «جدول»
  function parseVarzesh3Standings(html){
    let all=[],tables=[],from=0,capIdx;
    while((capIdx=html.indexOf('<caption',from))!==-1){let tableStart=html.lastIndexOf('<table',capIdx),tableEnd=html.indexOf('</table>',capIdx);if(tableStart===-1||tableEnd===-1)break;tables.push({cap:html.slice(capIdx,html.indexOf('</caption>',capIdx)).replace(/<[^>]*>/g,'').replace(/^\s*جدول\s*/,'').trim(),table:html.slice(tableStart,tableEnd+8)});from=tableEnd+8}
    for(const t of tables){let rows=parseVarzesh3StandingsTable(t.table);if(tables.length>1)rows.forEach(r=>{r.group=t.cap||null});all.push(...rows)}
    return all;
  }
  function parseVarzesh3StandingsTable(table){
    let rowRe=/<tr class="[^"]*"><td[^>]*>(\d+)<\/td><td[^>]*><\/td><td[^>]*><a[^>]*href="\/football\/team\/(\d+)\/[^"]*"><img[^>]*src="([^"]*)"[^>]*\/><span[^>]*>([^<]*)<\/span><\/a><\/td><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<!--\s*-->-<!--\s*-->(\d+)<\/td><td[^>]*>(-?\d+)<\/td><td[^>]*>(-?\d+)<\/td>/g,out=[],m;
    while((m=rowRe.exec(table)))out.push({rank:Number(m[1]),team:m[4],logo:m[3],played:Number(m[5]),win:Number(m[6]),draw:Number(m[7]),loss:Number(m[8]),gf:Number(m[9]),ga:Number(m[10]),gd:Number(m[11]),pts:Number(m[12])});
    return out;
  }
  // صفحهٔ جدول ورزش۳ فقط جدوله؛ زیرصفحهٔ «بازی-ها»ی همون لیگ (همون Next.js، همون شناسهٔ لیگ)
  // چند هفتهٔ بازی‌های تمام‌شده و آینده رو با تیم/گل/ساعت واقعی یکجا می‌ده — خیلی کامل‌تر از
  // eventsnextleague/eventspastleagueِ TheSportsDB که فقط ۱ بازی هرکدوم رو داشت.
  async function fetchVarzesh3LeagueMatchesPage(v3id){let r=await fetch('https://www.varzesh3.com/football/league/'+v3id+'/x/بازی-ها',{headers:BROWSER_UA});if(!r.ok)throw new Error('HTTP '+r.status);return await r.text()}
  function extractVarzesh3Weeks(html){
    let marker='self.__next_f.push(',parts=html.split(marker);
    for(let i=1;i<parts.length;i++){
      let candidate=parts[i],scriptEndIdx=candidate.indexOf('</script>');
      if(scriptEndIdx!==-1)candidate=candidate.slice(0,scriptEndIdx);
      candidate=candidate.trim();
      if(candidate.endsWith(');'))candidate=candidate.slice(0,-2);
      else if(candidate.endsWith(')'))candidate=candidate.slice(0,-1);
      let arr;try{arr=JSON.parse(candidate)}catch(e){continue}
      if(!Array.isArray(arr)||typeof arr[1]!=='string')continue;
      let inner=arr[1],colonIdx=inner.indexOf(':');
      if(colonIdx<0)continue;
      let data;try{data=JSON.parse(inner.slice(colonIdx+1))}catch(e){continue}
      let weeks=findKeyDeep(data,'weeks',0);
      if(weeks&&Array.isArray(weeks.items)&&weeks.items.length)return weeks.items;
    }
    return[]
  }
  function mapVarzesh3WeekMatch(m,leagueName,dateJalali){
    let dm=(dateJalali||'').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/),isoDate=dm?jalaliToGregorianIso(Number(dm[1]),Number(dm[2]),Number(dm[3])):null;
    if(!isoDate)return null;
    let status=m.isLive?'live':(m.goals?'finished':'upcoming');
    return{fixtureId:m.id,home:(m.host&&m.host.name)||'',away:(m.guest&&m.guest.name)||'',homeLogo:(m.host&&m.host.logo)||null,awayLogo:(m.guest&&m.guest.logo)||null,league:leagueName||'',/* Varzesh3 times are Tehran time; without one keep noon UTC (used to always be noon, so every match read 15:30) */date:/^\d{1,2}:\d{2}$/.test(String(m.time||''))?isoDate+'T'+String(m.time).padStart(5,'0')+':00+03:30':isoDate+'T12:00:00Z',time:m.time||null,status,score:m.goals?(m.goals.host??'-')+' - '+(m.goals.guest??'-'):'- - -'}
  }
  async function fetchVarzesh3LeagueMatches(v3id,leagueName){
    let html=await fetchVarzesh3LeagueMatchesPage(v3id),weeks=extractVarzesh3Weeks(html),out=[];
    weeks.forEach(week=>{(week.dates||[]).forEach(d=>{(d.matches||[]).forEach(m=>{let mapped=mapVarzesh3WeekMatch(m,leagueName,d.date);if(mapped)out.push(mapped)})})});
    return out
  }
  async function fetchFreeLeagueStandings(league){let v3id=VARZESH3_LEAGUE_IDS[league.id];if(v3id){try{let html=await fetchVarzesh3LeaguePage(v3id),items=parseVarzesh3Standings(html);if(items.length){try{await attachVarzesh3Form(v3id,html,items)}catch(e){}if(league.id==='uefa.nations'){/* tier A from Varzesh3, tiers B–D from footba11 */items.forEach(r=>{r.group='سطح A'+(r.group?' · '+r.group:'')});try{items=items.concat((await fetchFootba11Standings(league)).filter(r=>!/^سطح A/.test(r.group||'')))}catch(e){}}return items}}catch(e){}}try{let items=await fetchFootba11Standings(league);if(items.length)return items}catch(e){}if(ESPN_LEAGUE_IDS.includes(league.id)){try{let r=await fetch('https://site.api.espn.com/apis/v2/sports/soccer/'+league.id+'/standings',{headers:ESPN_UA});if(r.ok){let data=await r.json(),items=mapEspnStandings(data);if(items.length)return items}}catch(e){}}try{let data=await fetchTheSportsDb('/lookuptable.php?l='+league.tsdb);let items=mapTsdbStandings(data);if(items.length)return items}catch(e){}try{let data=await fetchTheSportsDb('/lookuptable.php?l='+league.tsdb+'&s='+league.season);return mapTsdbStandings(data)}catch(e){return[]}}
  // eventsseason.php نیازمند حدس دقیق فرمت فصل و پوشش کامل تقویمه؛ eventsnextleague/eventspastleague
  // همون چیزیه که این UI لازم داره (چند بازی بعدی/قبلی لیگ) و بدون فصل، همیشه چیزی برمی‌گردونه.
  async function fetchTheSportsDbNextPast(tsdbId){
    let [nextData,pastData]=await Promise.all([
      fetchTheSportsDb('/eventsnextleague.php?id='+tsdbId).catch(()=>({})),
      fetchTheSportsDb('/eventspastleague.php?id='+tsdbId).catch(()=>({})),
    ]);
    let next=(nextData.events||[]).map(mapTheSportsDbEvent);
    let past=(pastData.results||pastData.events||[]).map(mapTheSportsDbEvent);
    return[...next,...past]
  }
  // دامنهٔ سی‌ویک‌روزه یک‌جا برای اسکوربرد ESPN خیلی بزرگه و معمولاً خالی برمی‌گرده؛
  // تکه‌تکه‌کردنش به بازه‌های هفتگی (همون چیزی که خودِ سایت ESPN هم نشون می‌ده) واقعاً جواب می‌ده.
  async function fetchEspnScoreboardRange(espnCode,fromDate,toDate){
    let chunks=[],cur=new Date(fromDate+'T00:00:00Z'),end=new Date(toDate+'T00:00:00Z');
    while(cur<=end){
      let chunkEnd=new Date(cur);chunkEnd.setUTCDate(chunkEnd.getUTCDate()+6);
      if(chunkEnd>end)chunkEnd=new Date(end);
      chunks.push([cur.toISOString().slice(0,10),chunkEnd.toISOString().slice(0,10)]);
      cur=new Date(cur);cur.setUTCDate(cur.getUTCDate()+7);
    }
    let hosts=['https://site.api.espn.com','https://site.web.api.espn.com'];
    let results=await Promise.all(chunks.map(async([a,b])=>{
      let q='?dates='+a.replace(/-/g,'')+'-'+b.replace(/-/g,'');
      for(let h of hosts){
        try{let r=await fetch(h+'/apis/site/v2/sports/soccer/'+espnCode+'/scoreboard'+q,{headers:ESPN_UA});if(r.ok){let data=await r.json();if((data.events||[]).length)return data.events}}catch(e){}
      }
      return[]
    }));
    return results.flat()
  }
  // ── footba11.co (Persian, covers every competition incl. all Nations League tiers) ──
  const F11_LEAGUES={'eng.1':{ids:[1]},'esp.1':{ids:[8]},'ita.1':{ids:[17]},'ger.1':{ids:[12]},'fra.1':{ids:[22]},'uefa.nations':{ids:[267,599,600,601],tiers:true},'uefa.champions':{region:'اروپا',rx:/^لیگ قهرمانان$/},'uefa.europa':{region:'اروپا',rx:/^لیگ اروپا$/},'tur.1':{region:'ترکیه',rx:/سوپر ?لیگ/},'por.1':{region:'پرتغال',rx:/^(لیگ برتر|لیگا)/},'irn.1':{region:'ایران',rx:/^لیگ برتر/},'ksa.1':{region:'عربستان',rx:/^(لیگ برتر|لیگ حرفه)/},'afc.champions':{region:'آسیا',rx:/^لیگ (نخبگان|قهرمانان)/}};
  const F11_DAY=new Map(),F11_TIDS={};
  function f11Match(g,m){let sc=m.time&&m.time.statusCode,hs=m.homeScore||{},as=m.awayScore||{},has=hs.current!=null&&as.current!=null,st=sc===1||sc===0||!has?'upcoming':(sc>=6?'finished':'live');let sa=m.time&&m.time.starting_at||{},ts=sa.timestamp?new Date(sa.timestamp*1000).toISOString():((sa.date||'')+'T12:00:00Z');let tier=(g.tournament.name.match(/ملت‌ها\s+([A-D])$/)||[])[1];return{fixtureId:'f11-'+m.id,home:(m.home&&m.home.name)||'',away:(m.away&&m.away.name)||'',homeLogo:(m.home&&m.home.logo)||null,awayLogo:(m.away&&m.away.logo)||null,league:g.tournament.name,group:[tier?('سطح '+tier):'',g.stage&&g.stage.type==='group'?g.stage.name:''].filter(Boolean).join(' · ')||null,round:(g.round&&g.round.name)||null,date:ts,time:sa.time||null,status:st,score:has?(hs.current+' - '+as.current):'- - -',elapsed:(m.time&&m.time.elapsed)||null}}
  async function f11Day(iso){let jp=jParts(iso);if(!jp)return[];let key=jp.jy+'-'+String(jp.jm).padStart(2,'0')+'-'+String(jp.jd).padStart(2,'0'),t=today(),ttl=iso<t?6*3600e3:iso===t?120e3:1800e3,c=F11_DAY.get(key);if(c&&Date.now()-c.at<ttl)return c.list;let r=await fetch('https://footba11.co/json/livescore?date='+key,{headers:Object.assign({},BROWSER_UA,{Accept:'application/json','X-Requested-With':'XMLHttpRequest',Referer:'https://footba11.co/'})});if(!r.ok)throw new Error('f11 '+r.status);let j=await r.json(),list=(j.list||[]).map(g=>({tid:g.tournament&&g.tournament.id,tname:(g.tournament&&g.tournament.name)||'',region:(g.region&&g.region.name)||'',matches:(g.matches||[]).map(m=>f11Match(g,m))}));F11_DAY.set(key,{at:Date.now(),list});if(F11_DAY.size>60)F11_DAY.delete(F11_DAY.keys().next().value);return list}
  function f11Pick(leagueId,groups){let cfg=F11_LEAGUES[leagueId];if(!cfg)return[];let out=[];for(const g of groups){let ok=cfg.ids?cfg.ids.includes(g.tid):(g.region===cfg.region&&cfg.rx.test(g.tname));if(ok){(F11_TIDS[leagueId]=F11_TIDS[leagueId]||new Set()).add(g.tid);out.push(...g.matches)}}return out}
  async function fetchFootba11Range(league,fromDate,toDate){if(!F11_LEAGUES[league.id])return[];let t=today(),days=[];/* footba11 is one request per day: ±21 days = 43 requests (kept under the Workers 50-subrequest cap; days are cached per isolate) */for(let d=addDaysIso(t,-21);d<=addDaysIso(t,21);d=addDaysIso(d,1))if(d>=fromDate&&d<=toDate)days.push(d);let all=[];await mapConcurrent(days,5,async d=>{try{all.push(...f11Pick(league.id,await f11Day(d)))}catch(e){}});let seen=new Set();return all.filter(m=>!seen.has(m.fixtureId)&&seen.add(m.fixtureId)).map(m=>Object.assign(m,{league:league.name+(m.group?' · '+m.group:'')}))}
  function parseFootba11Standings(html,tierLabel){let out=[],names={};for(const m of html.matchAll(/<option value="standings_(\d+)"[^>]*>\s*([^<]+?)\s*<\/option>/g))names[m[1]]=m[2];let ids=[...html.matchAll(/id="standings_(\d+)_overall"/g)].map(m=>m[1]);for(const sid of ids){let a=html.indexOf('id="standings_'+sid+'_overall"'),b=html.indexOf('id="standings_'+sid+'_home"',a);let block=html.slice(a,b>a?b:a+200000);let grp=[tierLabel,names[sid]||''].filter(Boolean).join(' · ')||null;for(const part of block.split('standings-row" data-teamid="').slice(1)){let num=cls=>{let m=part.match(new RegExp('standings-value '+cls+'">\\s*(-?\\d+)'));return m?Number(m[1]):0};let team=(part.match(/standings-team[\s\S]*?<a [^>]*>\s*([^<]+?)\s*<\/a>/)||[])[1];if(!team)continue;let logo=(part.match(/data-lazy="([^"]+)"/)||part.match(/<img[^>]*src="(https?:[^"]+)"/)||[])[1]||null;let g=(part.match(/standings-value goals">\s*(\d+):(\d+)/)||[]);let form=[...part.matchAll(/<a [^>]*title="([^"]*)"[^>]*>\s*<span class="form ([wdl])"/g)].map(x=>({d:x[1].split(',')[0],r:x[2].toUpperCase(),tip:x[1].replace(/^[^,]*,[^ ]* /,'')}));form.sort((x,y)=>x.d.localeCompare(y.d));let gf=Number(g[1]||0),ga=Number(g[2]||0);out.push({rank:Number((part.match(/standings-rank[^>]*>\s*<span>(\d+)/)||[])[1]||0),team,logo,played:num('played'),win:num('wins'),draw:num('draws'),loss:num('losses'),gf,ga,gd:gf-ga,pts:num('points'),group:grp,form:form.slice(-5).map(x=>x.r).join(''),formTips:form.slice(-5).map(x=>x.tip)})}}return out}
  async function fetchFootba11Standings(league){let cfg=F11_LEAGUES[league.id];if(!cfg)return[];let tids=cfg.ids||[...(F11_TIDS[league.id]||[])];if(!tids.length){try{await fetchFootba11Range(league,addDaysIso(today(),-4),addDaysIso(today(),10));tids=[...(F11_TIDS[league.id]||[])]}catch(e){}}let rows=[];for(const tid of tids.slice(0,4)){try{let r=await fetch('https://footba11.co/tournament/'+tid,{headers:BROWSER_UA});if(!r.ok)continue;let html=await r.text(),tier=cfg.tiers?('سطح '+['A','B','C','D'][cfg.ids.indexOf(tid)]):'';rows.push(...parseFootba11Standings(html,tier))}catch(e){}}return rows}
  // Finished matches rebuilt from standings rows' formTips (oldest→newest per team). Each match shows up in both
  // teams' lists: kept once (unordered pair + score). Without a real date they carry approx:true, a «round» label
  // («آخرین بازی», «بازی قبلی», …) and a stand-in date one week per step back, used only for ordering.
  function resultsFromForm(rows,leagueName){
    let seen=new Set(),out=[],logo=n=>((rows||[]).find(x=>x.team===n)||{}).logo||null,t0=Date.parse(today()+'T12:00:00Z');
    for(const r of rows||[]){let tips=r.formTips||[],dates=r.formDates||[],n=tips.length;
      tips.forEach((tip,i)=>{let m=String(tip).match(/\((\d+)\s*-\s*(\d+)\)\s*(.+)/);if(!m)return;let a=Number(m[1]),b=Number(m[2]),opp=m[3].trim(),back=n-1-i,key=r.team<opp?r.team+'|'+opp+'|'+a+'-'+b:opp+'|'+r.team+'|'+b+'-'+a;if(seen.has(key))return;seen.add(key);
        let real=dates[i]||null;out.push({fixtureId:'v3f-'+key,home:r.team,away:opp,homeLogo:r.logo||null,awayLogo:logo(opp),league:leagueName||'',date:real||new Date(t0-back*7*864e5).toISOString(),status:'finished',score:a+' - '+b,approx:!real,round:back===0?'آخرین بازی':back===1?'بازی قبلی':(back).toLocaleString('fa-IR')+' بازی قبل‌تر'})})}
    return out;
  }
  async function cachedLeagueRange(league,fromDate,toDate){
    const key='https://pdmaz-cache.local/league/'+encodeURIComponent(league.id)+'/'+fromDate+'/'+toDate,now=Date.now();
    const mem=LEAGUE_RANGE_MEM.get(key);if(mem&&mem.until>now)return mem.items;
    const cache=typeof caches!=='undefined'&&caches.default?caches.default:null;
    if(cache){try{const hit=await cache.match(key);if(hit){const items=await hit.json();LEAGUE_RANGE_MEM.set(key,{items,until:now+60000});return items}}catch(e){}}
    const items=await fetchFreeLeagueRange(league,fromDate,toDate);
    if(items.length){const ttl=items.some(m=>m.status==='live')?120:600;LEAGUE_RANGE_MEM.set(key,{items,until:now+ttl*1000});if(LEAGUE_RANGE_MEM.size>100)LEAGUE_RANGE_MEM.clear();
      if(cache){try{await cache.put(key,new Response(JSON.stringify(items),{headers:{'content-type':'application/json','cache-control':'max-age='+ttl}}))}catch(e){}}}
    return items;
  }
  async function fetchFreeLeagueRange(league,fromDate,toDate){
    let out=[],v3id=VARZESH3_LEAGUE_IDS[league.id];
    if(v3id){try{let items=await fetchVarzesh3LeagueMatches(v3id,league.name);if(items.length)out=items}catch(e){}}
    let fromF11=false;
    // Varzesh3's matches page lists only the current and coming weeks: past results come from footba11 (also
    // Persian names; one request per day, so only the last 21 days up to today)
    if(out.length&&league.id!=='uefa.nations'&&F11_LEAGUES[league.id]&&out.filter(m=>m.status==='finished').length<2){try{let key=m=>String(m.date).slice(0,10)+'|'+m.home+'|'+m.away,seen=new Set(out.map(key)),past=(await fetchFootba11Range(league,fromDate,today())).filter(m=>m.status==='finished'&&!seen.has(key(m)));out=out.concat(past);fromF11=true}catch(e){}}
    // still no results (footba11 doesn't cover e.g. the Iranian/Saudi leagues or the Champions League): rebuild
    // them from the Varzesh3 table's last-5 per team («(1-0) پرسپولیس» = this team 1, opponent 0)
    if(out.length&&v3id&&league.id!=='uefa.nations'&&out.filter(m=>m.status==='finished').length<2){try{out=out.concat(resultsFromForm(await fetchFreeLeagueStandings(league),league.name))}catch(e){}}
    // UEFA Nations League: Varzesh3 (318) only has tier A; tiers B–D still come from footba11
    if(out.length&&league.id==='uefa.nations'){out.forEach(m=>{m.group=m.group||'سطح A'});try{let rest=(await fetchFootba11Range(league,fromDate,toDate)).filter(m=>!/^سطح A/.test(m.group||''));out=out.concat(rest);fromF11=true}catch(e){}}
    if(!out.length){try{let items=await fetchFootba11Range(league,fromDate,toDate);if(items.length){out=items;fromF11=true}}catch(e){}}
    if(!out.length&&ESPN_LEAGUE_IDS.includes(league.id)){try{let events=await fetchEspnScoreboardRange(league.id,fromDate,toDate);out=events.map(ev=>mapEspnEvent(ev,league.name))}catch(e){}}
    if(!out.length){try{let data=await fetchTheSportsDb('/eventsseason.php?id='+league.tsdb+'&s='+league.season);out=(data.events||[]).filter(e=>e.dateEvent>=fromDate&&e.dateEvent<=toDate).map(mapTheSportsDbEvent)}catch(e){}}
    if(!fromF11&&(out.filter(m=>m.status!=='finished').length<2||out.filter(m=>m.status==='finished').length<2)){try{let extra=await fetchTheSportsDbNextPast(league.tsdb);let seen=new Set(out.map(m=>m.fixtureId));extra.forEach(m=>{if(!seen.has(m.fixtureId)){out.push(m);seen.add(m.fixtureId)}})}catch(e){}}
    return out.sort((a,b)=>String(a.date).localeCompare(String(b.date)))
  }
  async function fetchFreeLeagueDay(league,date){let v3id=VARZESH3_LEAGUE_IDS[league.id];if(v3id){try{let items=await fetchVarzesh3LeagueDay(v3id,date);if(items.length)return items}catch(e){}}if(F11_LEAGUES[league.id]){try{let items=f11Pick(league.id,await f11Day(date)).map(m=>Object.assign(m,{league:league.name+(m.group?' · '+m.group:'')}));if(items.length)return items}catch(e){}}if(ESPN_LEAGUE_IDS.includes(league.id)){try{let data=await fetchEspnScoreboard(league.id,date);let items=(data.events||[]).map(ev=>mapEspnEvent(ev,league.name));if(items.length)return items}catch(e){}}let data=await fetchTheSportsDb('/eventsseason.php?id='+league.tsdb+'&s='+league.season);return(data.events||[]).filter(e=>e.dateEvent===date).map(mapTheSportsDbEvent)}
  async function fetchTheSportsDb(path){let r=await fetch('https://www.thesportsdb.com/api/v1/json/123'+path,{headers:BROWSER_UA}),data=await r.json();if(!r.ok)throw new Error('HTTP '+r.status);return data}
  function mapEspnEvent(ev,leagueName){let comp=(ev.competitions&&ev.competitions[0])||{},home=(comp.competitors||[]).find(c=>c.homeAway==='home')||{},away=(comp.competitors||[]).find(c=>c.homeAway==='away')||{},state=comp.status&&comp.status.type&&comp.status.type.state,statusMap={pre:'upcoming',in:'live',post:'finished'};return{fixtureId:ev.id,home:(home.team&&home.team.displayName)||'',away:(away.team&&away.team.displayName)||'',homeLogo:(home.team&&home.team.logo)||null,awayLogo:(away.team&&away.team.logo)||null,league:leagueName||'',date:ev.date,status:statusMap[state]||state||'upcoming',score:(home.score??'-')+' - '+(away.score??'-')}}
  function mapTheSportsDbEvent(e){let status=(e.strStatus||'').toUpperCase(),statusVal;if(status==='FT'||status==='MATCH FINISHED'||status==='AET'||status==='PEN'||status==='AW')statusVal='finished';else if(!status||status==='NS'||status==='TBD'||/POSTPON|CANCEL|SUSPEND|ABANDON/.test(status))statusVal='upcoming';else statusVal='live';let rawDate=e.strTimestamp||(e.dateEvent+'T'+(e.strTime||'00:00:00')),date=/Z$|[+-]\d\d:?\d\d$/.test(rawDate)?rawDate:rawDate+'Z';return{fixtureId:e.idEvent,home:e.strHomeTeam||'',away:e.strAwayTeam||'',homeLogo:e.strHomeTeamBadge||null,awayLogo:e.strAwayTeamBadge||null,league:e.strLeague||'',date,status:statusVal,score:(e.intHomeScore??'-')+' - '+(e.intAwayScore??'-')}}
  async function xbetGet(path,params){if(!RAPIDAPI_KEY)return null;return rapidApiGet('1xbet-api.p.rapidapi.com',path+'?'+new URLSearchParams({mode:'line',lng:'en',...params}))}
  async function sofaGet(path){if(!RAPIDAPI_KEY)return null;return rapidApiGet('sportapi7.p.rapidapi.com',path)}
  const COINGECKO_IDS={BTC:'bitcoin',ETH:'ethereum',USDT:'tether',USDC:'usd-coin',BNB:'binancecoin',SOL:'solana',XRP:'ripple',ADA:'cardano',DOGE:'dogecoin',TON:'the-open-network',DOT:'polkadot',MATIC:'matic-network',POL:'polygon-ecosystem-token',LTC:'litecoin',TRX:'tron',AVAX:'avalanche-2',LINK:'chainlink',ATOM:'cosmos',SHIB:'shiba-inu',UNI:'uniswap',XLM:'stellar',BCH:'bitcoin-cash',NEAR:'near',ETC:'ethereum-classic',XMR:'monero'};
  // Stocks: a Persian ticker (عیار، فولاد…) trades in rial on the Tehran exchange, a Latin one (AAPL) in dollars.
  function assetCurrency(assetType,symbol){if(assetType==='euro')return'EUR';if(assetType==='stock')return /[\u0600-\u06FF]/.test(String(symbol||''))?'IRR':'USD';return assetType==='crypto'||assetType==='dollar'?'USD':'IRR'}
  async function fetchCryptoPriceUsd(symbol){let cgId=COINGECKO_IDS[String(symbol).toUpperCase()];if(!cgId)return null;let r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+cgId+'&vs_currencies=usd'),data=await r.json();return data[cgId]&&data[cgId].usd!=null?data[cgId].usd:null}
  async function fetchStockPriceUsd(symbol){if(!STOCK_API_KEY)return null;let r=await fetch('https://api.twelvedata.com/price?symbol='+encodeURIComponent(symbol)+'&apikey='+STOCK_API_KEY),data=await r.json();return data.price?Number(data.price):null}
  // توجه: سقف پلن رایگان Twelve Data هشت credit در دقیقه‌ست؛ هر نماد یک credit می‌گیره، پس این لیست را از هشت‌تا بیشتر نکن
  const US_STOCKS=[{symbol:'AAPL',name:'اپل'},{symbol:'MSFT',name:'مایکروسافت'},{symbol:'GOOGL',name:'گوگل'},{symbol:'AMZN',name:'آمازون'},{symbol:'NVDA',name:'انویدیا'},{symbol:'META',name:'متا'},{symbol:'TSLA',name:'تسلا'},{symbol:'NFLX',name:'نتفلیکس'}];
  async function fetchUsStocksQuote(){
    if(_usStocksCache.items&&Date.now()-_usStocksCache.at<5*60*1000)return _usStocksCache.items;
    let symbols=US_STOCKS.map(s=>s.symbol).join(',');
    let r=await fetch('https://api.twelvedata.com/quote?symbol='+encodeURIComponent(symbols)+'&apikey='+STOCK_API_KEY);
    let data=await r.json();
    if(data&&data.status==='error')throw new Error(data.message||'خطا در دریافت قیمت سهام');
    let items=US_STOCKS.map(s=>{
      let q=data[s.symbol];
      if(!q||q.status==='error'||(q.close==null&&q.price==null))return{symbol:s.symbol,name:s.name,price:null,changePercent:null};
      return{symbol:s.symbol,name:s.name,price:Number(q.close!=null?q.close:q.price),changePercent:q.percent_change!=null?Number(q.percent_change):null};
    });
    _usStocksCache={at:Date.now(),items};
    return items;
  }
  // Tehran Stock Exchange last price (rial) from TSETMC's public JSON API: symbol → insCode (cached per isolate)
  // → closing-price info. Persian Yeh/Kaf variants are normalised so «شکیمیا» matches «شكيميا».
  const TSE_CODES=new Map();
  const faNorm=v=>String(v||'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[‌\s]+/g,'').trim();
  async function tseGet(path){let ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),8000);try{let r=await fetch('https://cdn.tsetmc.com/api/'+path,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Accept':'application/json','Referer':'https://tsetmc.com/','Origin':'https://tsetmc.com'},signal:ctl.signal});if(!r.ok)throw new Error('TSETMC HTTP '+r.status);return await r.json()}catch(e){throw new Error(e&&e.name==='AbortError'?'TSETMC جواب نداد (timeout).':(e.message||'TSETMC در دسترس نبود.'))}finally{clearTimeout(t)}}
  // shakhesban.com (tgju's market site) answers from outside Iran, unlike TSETMC: read the symbol's row from its
  // market search table — 5th cell = last trade, 8th = closing price. Halted duplicates («متوقف») are skipped.
  async function fetchShakhesbanPrice(symbol){
    let ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),9000),html;
    try{let r=await fetch('https://www.shakhesban.com/markets/all?search='+encodeURIComponent(symbol),{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36','Accept':'text/html'},signal:ctl.signal});if(!r.ok)throw new Error('shakhesban HTTP '+r.status);html=await r.text()}
    catch(e){throw new Error(e&&e.name==='AbortError'?'سایت قیمت بورس دیر جواب داد.':(e.message||'سایت قیمت بورس در دسترس نبود.'))}finally{clearTimeout(t)}
    let want=faNorm(symbol),num=v=>{let n=Number(String(v||'').replace(/<[^>]+>/g,'').replace(/[,\s]/g,''));return n>0?n:null},rows=[];
    for(const m of html.matchAll(/<tr data-symbol="([^"]*)">([\s\S]*?)<\/tr>/g)){if(faNorm(decodeXmlEntities(m[1]))!==want)continue;let cells=[...m[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x=>x[1]);rows.push({halted:/متوقف/.test(cells[2]||''),last:num(cells[4]),close:num(cells[7]),name:decodeXmlEntities(cells[1]||'').trim()})}
    let row=rows.find(x=>!x.halted&&(x.last||x.close))||rows.find(x=>x.last||x.close);
    if(!row)throw new Error('نماد «'+symbol+'» پیدا نشد.');
    return{price:row.last||row.close,closing:row.close,name:row.name}}
  async function fetchTsePrice(symbol,knownCode){
    try{let r=await fetchShakhesbanPrice(symbol);return{...r,code:knownCode||null}}catch(e){console.log('shakhesban',symbol,e.message);if(/پیدا نشد/.test(e.message))throw e}

    let want=faNorm(symbol),code=knownCode||TSE_CODES.get(want);
    if(!code){let j=await tseGet('Instrument/GetInstrumentSearch/'+encodeURIComponent(symbol)),list=(j&&j.instrumentSearch)||[];let hit=list.find(x=>faNorm(x.lVal18AFC)===want&&!x.lVal18AFC.match(/\d/))||list.find(x=>faNorm(x.lVal18AFC)===want);if(!hit)throw new Error('نماد «'+symbol+'» در بورس تهران پیدا نشد.');code=String(hit.insCode);TSE_CODES.set(want,code)}
    let j=await tseGet('ClosingPrice/GetClosingPriceInfo/'+code),c=j&&j.closingPriceInfo;if(!c)throw new Error('قیمت «'+symbol+'» از TSETMC نیامد.');
    let price=Number(c.pDrCotVal)||Number(c.pClosing);if(!(price>0))throw new Error('قیمت «'+symbol+'» صفر برگشت (نماد بسته است؟).');
    return{price,closing:Number(c.pClosing)||null,code}}
  // cron: refresh every Tehran-exchange stock someone holds (one lookup per symbol, shared by users)
  // TSE trades Sat–Wed 09:00–12:30 Tehran; prices are fetched from 08:55 to 13:00 (the last runs catch the closing price).
  function tseMarketOpen(now){let p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(now||new Date()).map(x=>[x.type,x.value])),m=Number(p.hour)*60+Number(p.minute);return!['Thu','Fri'].includes(p.weekday)&&m>=535&&m<=780}
  // one price per symbol per Tehran day (the last fetch of the day = the closing price); the portfolio trend uses it
  // for past days instead of the last trade price. Kept ~2 years per user and symbol.
  function recordDailyClose(db,userId,symbol,price){if(!userId||!(price>0))return;db.assetPriceHistory??=[];let d=today(),row=db.assetPriceHistory.find(x=>x.userId===userId&&x.symbol===symbol&&x.date===d);if(row){row.price=price;return}db.assetPriceHistory.push({id:id(),userId,symbol,date:d,price});let mine=db.assetPriceHistory.filter(x=>x.userId===userId&&x.symbol===symbol);if(mine.length>800){let cut=new Set(mine.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,mine.length-800).map(x=>x.id));db.assetPriceHistory=db.assetPriceHistory.filter(x=>!cut.has(x.id))}}
  async function refreshTsePrices(db,force){if(!force&&!tseMarketOpen())return false;let changed=false,bySym=new Map();for(const p of db.assetPrices)if(p.assetType==='stock'&&p.currency==='IRR'&&/[؀-ۿ]/.test(p.symbol)){if(!bySym.has(p.symbol))bySym.set(p.symbol,[]);bySym.get(p.symbol).push(p)}
    for(const [sym,rows] of bySym){try{let r=await fetchTsePrice(sym,rows.find(x=>x.tseCode)?.tseCode);for(const row of rows){row.price=r.price;row.currency='IRR';row.closing=r.closing;if(r.code)row.tseCode=r.code;row.source='bourse';row.updatedAt=Date.now();recordDailyClose(db,row.userId,sym,r.closing||r.price)}changed=true}catch(e){console.log('tse price',sym,e.message)}}
    return changed}
  // Machine translation English → Persian without the AI keys (both AI providers can refuse the Worker):
  // Google's free endpoint first, then MyMemory. Returns one string per input ('' where both failed).
  async function translateToFa(texts){
    const why=[];
    const one=async t=>{t=String(t||'').slice(0,480);if(!t)return'';
      // Cloudflare's own translation model (binding AI in wrangler.jsonc): no outside service to block the Worker
      if(env.AI)try{let r=await env.AI.run('@cf/meta/m2m100-1.2b',{text:t,source_lang:'en',target_lang:'fa'}),s=String(r&&r.translated_text||'').trim();if(s)return s}catch(e){why.push('workers-ai '+e.message)}
      try{let r=await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=fa&dt=t&q='+encodeURIComponent(t));if(r.ok&&/json/.test(r.headers.get('content-type')||'')){let j=await r.json(),s=(j&&j[0]||[]).map(x=>x&&x[0]||'').join('').trim();if(s)return s}else why.push('google '+r.status)}catch(e){why.push('google '+e.message)}
      try{let r=await fetch('https://api.mymemory.translated.net/get?langpair=en|fa&q='+encodeURIComponent(t));if(r.ok){let j=await r.json(),s=String(j&&j.responseData&&j.responseData.translatedText||'').trim();if(s&&!/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(s))return s;why.push('mymemory '+s.slice(0,60))}else why.push('mymemory '+r.status)}catch(e){why.push('mymemory '+e.message)}
      return''};
    const out=await Promise.all((texts||[]).map(one));if(why.length)console.log('translateToFa',why.slice(0,6).join(' | '));return out}
  // Broker order history (easytrader / Mofid «تاریخچه سفارشات» export): columns found by header name. Only orders with
  // a filled volume count (edited/deleted/expired ones have 0); a partly filled order counts for what was filled.
  function brokerOrderRows(rows){
    let hi=rows.findIndex(r=>r.some(c=>/سمت/.test(String(c)))&&r.some(c=>/نماد/.test(String(c))));if(hi<0)throw new Error('ستون‌های «سمت سفارش» و «نماد» پیدا نشد؛ فایل «تاریخچه سفارشات» کارگزاری را بده.');
    let h=rows[hi].map(c=>String(c).trim()),col=re=>h.findIndex(c=>re.test(c));
    let cDate=col(/^تاریخ/),cTime=col(/^ساعت/),cSide=col(/سمت/),cSym=col(/^نماد/),cPrice=col(/^قیمت/),cFill=col(/انجام\s*شده|معامله\s*شده/),cVol=col(/^حجم/);
    if(cDate<0||cPrice<0||(cFill<0&&cVol<0))throw new Error('ستون تاریخ، قیمت یا حجم پیدا نشد.');
    let num=v=>Number(String(v??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[,٬\s]/g,''))||0,out=[];
    for(const r of rows.slice(hi+1)){let qty=num(r[cFill>=0?cFill:cVol]),price=num(r[cPrice]),sym=faNorm(r[cSym]).replace(/\s+/g,''),m=String(r[cDate]||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
      if(!qty||!price||!sym||!m)continue;let jy=+m[1],date=jy>1700?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:jalaliToGregorianIso(jy,+m[2],+m[3]),side=/فروش|sell/i.test(String(r[cSide]))?'sell':'buy',time=cTime>=0?String(r[cTime]||''):'';
      out.push({date,time,jdate:`${m[1]}/${m[2].padStart(2,'0')}/${m[3].padStart(2,'0')}`,side,symbol:sym,quantity:qty,price,ref:['broker',date,time,side,sym,qty,price].join('|')})}
    return out}
  // Several files (exports are capped, e.g. 100 orders each) are merged; an order present in two files counts once.
  function parseBrokerOrders(...sets){
    let out=[],seen=new Set();for(const rows of sets)for(const t of brokerOrderRows(rows))if(!seen.has(t.ref)){seen.add(t.ref);out.push(t)}
    out.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    // per symbol: what the file alone says, and how many shares were already held before its first order
    let sums={};for(const t of out){let x=sums[t.symbol]||(sums[t.symbol]={symbol:t.symbol,buys:0,sells:0,buyQty:0,sellQty:0,net:0,minRun:0,first:t.date,firstPrice:t.price,last:t.date});x[t.side==='buy'?'buys':'sells']++;x[t.side==='buy'?'buyQty':'sellQty']+=t.quantity;x.net+=t.side==='buy'?t.quantity:-t.quantity;x.minRun=Math.min(x.minRun,x.net);x.last=t.date}
    return{trades:out,symbols:Object.values(sums).map(x=>({...x,heldBefore:-x.minRun})).sort((a,b)=>b.last.localeCompare(a.last))}}
  async function refreshAllCryptoPrices(db){let symbols=new Set();db.investmentTx.forEach(t=>{if(t.assetType==='crypto'&&COINGECKO_IDS[t.symbol])symbols.add(t.symbol)});if(!symbols.size)return false;let ids=[...symbols].map(s=>COINGECKO_IDS[s]);let r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+ids.join(',')+'&vs_currencies=usd'),data=await r.json();let changed=false;for(const sym of symbols){let cgId=COINGECKO_IDS[sym],price=data[cgId]&&data[cgId].usd;if(price==null)continue;let userIds=new Set(db.investmentTx.filter(t=>t.symbol===sym&&t.assetType==='crypto').map(t=>t.userId));for(const uid of userIds){let row=db.assetPrices.find(p=>p.userId===uid&&p.symbol===sym);if(row){row.price=price;row.currency='USD';row.source='live';row.updatedAt=Date.now()}else db.assetPrices.push({id:id(),userId:uid,symbol:sym,assetType:'crypto',price,currency:'USD',source:'live',updatedAt:Date.now()});changed=true}}return changed}
  function computeHoldings(db,userId){let txs=db.investmentTx.filter(x=>x.userId===userId).slice().sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt-b.createdAt);let bySymbol={};for(const t of txs){let s=bySymbol[t.symbol]=bySymbol[t.symbol]||{symbol:t.symbol,assetType:t.assetType,currency:(t.currency==='IRR'||t.currency==='USD')?t.currency:assetCurrency(t.assetType,t.symbol),quantity:0,avgCost:0,realizedPnl:0,dividends:0,fees:0};if(t.type==='buy'){let newQty=s.quantity+t.quantity;s.avgCost=newQty>0?((s.quantity*s.avgCost)+(t.quantity*t.price)+(t.fee||0))/newQty:0;s.quantity=newQty}else if(t.type==='sell'){s.realizedPnl+=t.quantity*(t.price-s.avgCost)-(t.fee||0);s.quantity-=t.quantity}else if(t.type==='dividend'){s.dividends+=t.amount||0}else if(t.type==='fee'){s.fees+=t.amount||0}}let priceMap={};db.assetPrices.filter(x=>x.userId===userId).forEach(p=>priceMap[p.symbol]=p);return Object.values(bySymbol).filter(s=>s.quantity>1e-9||s.realizedPnl||s.dividends||s.fees).map(s=>{let priceRow=priceMap[s.symbol],currentPrice=(s.assetType==='dollar'||s.assetType==='euro')?1:(priceRow?priceRow.price:s.avgCost),marketValue=s.quantity*currentPrice,costBasis=s.quantity*s.avgCost;return{...s,currentPrice,marketValue,costBasis,unrealizedPnl:marketValue-costBasis,priceUpdatedAt:priceRow?priceRow.updatedAt:null,priceSource:priceRow?priceRow.source:null}})}
  function portfolioTotals(holdings){let totals={};for(const h of holdings){let t=totals[h.currency]=totals[h.currency]||{value:0,cost:0,unrealizedPnl:0,realizedPnl:0,dividends:0,fees:0};t.value+=h.marketValue;t.cost+=h.costBasis;t.unrealizedPnl+=h.unrealizedPnl;t.realizedPnl+=h.realizedPnl;t.dividends+=h.dividends;t.fees+=h.fees}return totals}
  function evaluateAlerts(db,userId,holdings){let msgs=[];for(const a of db.priceAlerts.filter(a=>a.userId===userId&&a.active)){let h=holdings.find(x=>x.symbol===a.symbol);if(!h)continue;let met=false,text='';if(a.condition==='price_above'&&h.currentPrice>=a.value){met=true;text=`قیمت ${a.symbol} به ${a.value.toLocaleString('fa-IR')} ${h.currency} یا بالاتر رسید (اکنون ${h.currentPrice.toLocaleString('fa-IR')}).`}else if(a.condition==='price_below'&&h.currentPrice<=a.value){met=true;text=`قیمت ${a.symbol} به ${a.value.toLocaleString('fa-IR')} ${h.currency} یا پایین‌تر رسید (اکنون ${h.currentPrice.toLocaleString('fa-IR')}).`}else if(a.condition==='pnl_pct_above'||a.condition==='pnl_pct_below'){let pct=h.costBasis?(h.unrealizedPnl/h.costBasis*100):0;if(a.condition==='pnl_pct_above'&&pct>=a.value){met=true;text=`سود ${a.symbol} به ${pct.toFixed(1)}٪ رسید (هدف ${a.value}٪).`}else if(a.condition==='pnl_pct_below'&&pct<=a.value){met=true;text=`زیان ${a.symbol} به ${pct.toFixed(1)}٪ رسید (هدف ${a.value}٪).`}}if(met)msgs.push({icon:'💰',text,alert:a})}return msgs}

  async function applyParsedActions(db,user,actions,defaultDate,receiptFileId){let d=defaultDate||today();let done=[],daily=db.daily.find(x=>x.userId===user.id&&x.date===d),receiptUsed=false;db.tasks??=[];db.reminders??=[];db.transactions??=[];db.timeEntries??=[];db.daily??=[];db.movies??=[];for(const a of actions){if(a.type==='transaction'&&Number(a.amount)>0){let amount=Number(a.amount),title=String(a.title||'هزینه ثبت‌شده از متن'),category=String(a.category||suggestCategoryKeyword(title)||'متفرقه'),kind=a.kind==='income'?'income':a.kind==='transfer'&&a.transfer?'transfer':'expense',date=a.date||d,acc=a.bank?bankSmsAccount(db,user.id):null,account=acc?acc.name:'بدون حساب';let r={id:id(),userId:user.id,title,amount,category,kind,account,date,createdAt:Date.now()};if(kind==='transfer'){if(a.transfer==='fromPiggy'){r.account='قلک';r.toAccount=account}else r.toAccount='قلک'}if(a.bank){r.source='sms';if(a.time)r.time=a.time;if(a.balance!=null)r.smsBalance=Number(a.balance)}if(receiptFileId&&!receiptUsed){r.receiptTgId=receiptFileId;r.receiptMime='image/jpeg';r.receipt='/uploads/'+id()+'.jpg';receiptUsed=true}db.transactions.push(r);done.push((kind==='income'?'درآمد ':kind==='transfer'?'انتقال ':'هزینه ')+amount.toLocaleString('fa-IR')+' ریال'+(title&&title!=='هزینه ثبت‌شده از متن'?' («'+title+'»)':'')+(acc?' · '+acc.name:'')+(r.receiptTgId?' 🧾':''));if(acc&&a.balance!=null){let at=date+' '+(a.time||'00:00');if(!acc.smsBalanceAt||at>=acc.smsBalanceAt){acc.smsBalance=Number(a.balance);acc.smsBalanceAt=at}if(!acc.smsSynced){let cur=accountBalances(db,user.id).find(x=>x.id===acc.id);acc.openingBalance=Number(acc.openingBalance||0)+Number(acc.smsBalance)-Number(cur.balance);acc.smsSynced=true;acc.rialFixed=true;done.push('موجودی «'+acc.name+'» با بانک هماهنگ شد')}}}if(a.type==='time'&&Number(a.minutes)>0){let minutes=Math.round(Number(a.minutes)),title=String(a.title||'کار');db.timeEntries.push({id:id(),userId:user.id,title,projectId:null,minutes,date:a.date||d,createdAt:Date.now()});done.push('کار '+minutes+' دقیقه'+(title?' · '+title:''))}if(a.type==='mood'||a.type==='sleep'){let date=a.date||d;daily=db.daily.find(x=>x.userId===user.id&&x.date===date);if(!daily){daily={id:id(),userId:user.id,date,mood:7,energy:7,sleep:'',note:''};db.daily.push(daily)}if(a.type==='mood'&&Number(a.value)>=0&&Number(a.value)<=10){daily.mood=Number(a.value);done.push('مود '+Number(a.value))}else if(a.type==='sleep'&&a.value){daily.sleep=String(a.value);done.push('خواب '+String(a.value))}}if(a.type==='betDay'){db.betDays??=[];let date=a.date||d,prev=betDaysOf(db,user.id).some(x=>x.date<date),r=db.betDays.find(x=>x.userId===user.id&&x.date===date);if(!r){r={id:id(),userId:user.id,date:date,start:prev?betAutoStart(db,user.id,date):(Number(a.balance)||0),deposit:0,withdraw:0,balance:0,note:'ثبت از متن',createdAt:Date.now()};db.betDays.push(r)}r.balance=Number(a.balance)||0;r.updatedAt=Date.now();let day=betRollup(betDaysOf(db,user.id),date.slice(0,7)).items.find(x=>x.date===date)||null;done.push('🎯 بت '+date+' — موجودی $'+r.balance+(day?(' · '+(day.result>=0?'برد $':'باخت $')+Math.abs(day.result)):''))}if(a.type==='poker'){db.pokerSessions??=[];let bi=Number(a.buyIn)||0,co=Number(a.cashOut)||0;db.pokerSessions.push({id:id(),userId:user.id,date:a.date||d,buyIn:bi,cashOut:co,location:a.location||'',note:'ثبت از متن',createdAt:Date.now()});let pr=co-bi;done.push('🃏 سشن پوکر ثبت شد (ورود '+bi.toLocaleString('fa-IR')+' · خروج '+co.toLocaleString('fa-IR')+' — '+(pr>=0?'برد ':'باخت ')+Math.abs(pr).toLocaleString('fa-IR')+') و در تراکنش‌ها نیامد')}if(a.type==='gambleNote'){db.inbox??=[];let tx=String(a.text||'').trim();if(tx)db.inbox.push({id:id(),userId:user.id,text:tx,archived:false,createdAt:Date.now()});done.push('📥 متن '+(a.gamble==='bet'?'بت':'پوکر')+' در Inbox ذخیره شد — در تراکنش‌ها ثبت نمی‌شود')}if(a.type==='series'){let r=await applySeriesAction(db,user.id,a);if(r)done.push((r.created?'سریال جدید: ':'سریال: ')+r.label+(a.season?' فصل '+a.season:'')+(a.episode?' قسمت '+a.episode:''))}if(a.type==='investment'){db.investmentTx??=[];db.assetPrices??=[];let assetType=['crypto','stock','gold','dollar','euro','other'].includes(a.assetType)?a.assetType:'other',isFace=assetType==='dollar'||assetType==='euro',symbol=assetType==='dollar'?'USD':assetType==='euro'?'EUR':String(a.symbol||'').trim().toUpperCase(),txType=a.txType==='sell'?'sell':'buy',quantity=Number(a.quantity),price=isFace?1:Number(a.price);if(symbol&&quantity>0&&(isFace||price>0)){let date=a.date||d,r={id:id(),userId:user.id,symbol,assetType,type:txType,quantity,price,fee:0,amount:0,date,note:'ثبت از متن',createdAt:Date.now()};db.investmentTx.push(r);if(txType==='buy'&&!isFace&&!db.assetPrices.some(p=>p.userId===user.id&&p.symbol===symbol))db.assetPrices.push({id:id(),userId:user.id,symbol,assetType,price,currency:assetCurrency(assetType),source:'manual',updatedAt:Date.now()});done.push('📈 '+(txType==='buy'?'خرید ':'فروش ')+symbol+' — '+quantity+(isFace?'':' × '+price.toLocaleString('fa-IR')))}}if(a.type==='task'&&String(a.title||'').trim()){let title=String(a.title).trim(),date=a.date||d,startTime=a.startTime||a.time||null;db.tasks.push({id:id(),userId:user.id,title,date,done:false,priority:'medium',deadline:date,projectId:null,parentTaskId:null,recurrence:null,startTime,durationMinutes:null,createdAt:Date.now()});done.push('کار «'+title+'»'+(date!==d?' برای '+date:'')+(startTime?' ساعت '+startTime:''))}if(a.type==='reminder'&&String(a.title||'').trim()){let title=String(a.title).trim(),date=a.date||d,time=a.time||null;db.reminders.push({id:id(),userId:user.id,title,date,time,done:false,whenLabel:a.whenLabel||date,createdAt:Date.now()});db.tasks.push({id:id(),userId:user.id,title:(time?('⏰ '+time+' · '):'🔔 ')+title,date,done:false,priority:'high',deadline:date,projectId:null,parentTaskId:null,recurrence:null,startTime:time,durationMinutes:null,createdAt:Date.now(),isReminder:true});done.push('یادآوری «'+title+'» · '+(a.whenLabel||date)+(time?' ساعت '+time:''))}}return done}

  function tgApi(method,params){if(!TELEGRAM_BOT_TOKEN)return Promise.resolve(null);return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params||{})}).then(r=>r.json())}
  function tgSend(chatId,text,extra){let payload=Object.assign({chat_id:chatId,text:String(text||'').slice(0,4000)},extra||{});return tgApi('sendMessage',payload)}
  function tgMainKeyboard(){return{keyboard:[[{text:'/امروز'},{text:'/کارها'},{text:'/یادآوری‌ها'}],[{text:'/موجودی'},{text:'/پرتفوی'},{text:'/گزارش_ماه'}]],resize_keyboard:true,is_persistent:true}}
  // Telegram doubles as file storage on this deployment (no R2 needed): a
  // receipt/document upload is sent to the owner's own bot chat as a document,
  // and we keep only its file_id — /uploads/<key> resolves that id back to
  // bytes on read (see handleUploadGet in footer.js) instead of an R2 GET.
  async function tgSendDocument(chatId,bytes,filename,mime,caption){
    if(!TELEGRAM_BOT_TOKEN||!chatId)return null;
    let fd=new FormData();
    fd.append('chat_id',String(chatId));
    if(caption)fd.append('caption',caption.slice(0,1024));
    fd.append('document',new Blob([bytes],{type:mime||'application/octet-stream'}),filename||'file');
    let r=await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,{method:'POST',body:fd}),data=await r.json();
    if(!data.ok)throw new Error(data.description||'ارسال فایل به تلگرام ناموفق بود.');
    return (data.result.document&&data.result.document.file_id)||null;
  }
  // Strips live credentials before a DB snapshot leaves the server (Telegram
  // chat storage is not a vault): password hash, PIN hash and OAuth refresh
  // tokens and live sessions are excluded — restoring from backup means reset
  // password once and reconnect Spotify/YouTube/Calendar, which is a fair trade
  // for not shipping usable credentials off-server.
  function redactForBackup(db){let clone=JSON.parse(JSON.stringify(db));(clone.users||[]).forEach(u=>{delete u.password;delete u.salt;delete u.pinHash;delete u.pinSalt;delete u.resetCode;delete u.spotifyRefreshToken;delete u.youtubeRefreshToken;delete u.googleCalendarRefreshToken});clone.sessions=[];clone.telegramLinkCodes=[];return clone}
  // Only this user's rows (every top-level array whose items carry userId, plus generic collections) — never other users' data.
  function userSnapshot(db,user){let out={exportedAt:new Date().toISOString(),app:'LifeOS'},skip=new Set(['users','sessions','telegramLinkCodes','meta','col']);for(const [k,v] of Object.entries(db)){if(skip.has(k)||!Array.isArray(v))continue;if(v.some(x=>x&&typeof x==='object'&&'userId' in x))out[k]=v.filter(x=>x&&x.userId===user.id)}if(Array.isArray(db.habitLogs)){let hs=new Set((db.habits||[]).filter(h=>h.userId===user.id).map(h=>h.id));out.habitLogs=db.habitLogs.filter(l=>hs.has(l.habitId))}out.col={};for(const [n,list] of Object.entries(db.col||{}))if(Array.isArray(list))out.col[n]=list.filter(x=>x.userId===user.id);let u=redactForBackup({users:[user]}).users[0];delete u.pushSubs;delete u.pushQueue;out.user=u;return out}
  function backupDue(user,d){let f=user.backupFreq||'weekly';if(f==='off')return false;if(!user.tgLastBackup)return true;if(f==='daily')return user.tgLastBackup!==d;return user.tgLastBackup<=addDaysIso(d,-7)}
  async function backupDbToTelegram(db){
    if(!TELEGRAM_BOT_TOKEN)return false;
    let d=today(),due=db.users.filter(u=>u.telegramUserId&&backupDue(u,d)&&tehranHourNow()>=(u.tgMorningHour!=null?Number(u.tgMorningHour):9));
    if(!due.length)return false;
    let changed=false;
    for(const user of due){
      try{let bytes=new TextEncoder().encode(JSON.stringify(userSnapshot(db,user),null,1));await tgSendDocument(user.telegramUserId,bytes,'lifeos-backup-'+d+'.json','application/json','🗄 بکاپ خودکار '+((user.backupFreq||'weekly')==='daily'?'روزانه':'هفتگی')+' LifeOS — '+d);user.tgLastBackup=d;changed=true}
      catch(e){console.error('telegram backup failed',e)}
    }
    return changed;
  }
  function tgFmtDate(iso){try{return new Intl.DateTimeFormat('fa-IR',{timeZone:'Asia/Tehran',year:'numeric',month:'short',day:'numeric',weekday:'short'}).format(new Date(iso+'T12:00:00Z'))}catch(e){return iso}}
  function tgCmdName(text){let c=(text||'').trim().split(/\s+/)[0]||'';c=c.split('@')[0];return c}
  async function handleTelegramMessage(db,msg){
    let fromId=String(msg.from&&msg.from.id),chatId=msg.chat.id,text=(msg.text||msg.caption||'').trim();
    let photoFileId=msg.photo&&msg.photo.length?msg.photo[msg.photo.length-1].file_id:null;
    db.telegramLinkCodes ??= [];
    db.reminders ??= [];
    db.tasks ??= [];
    // One-time link: /start CODE or bare CODE
    let linkCode = null;
    let startM = text.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
    if (startM && startM[1]) linkCode = String(startM[1]).trim();
    else if (/^[A-Za-z0-9]{6,12}$/.test(text) && !text.startsWith('/')) linkCode = text.trim();
    if (linkCode) {
      let code = enNum(linkCode).toUpperCase().replace(/[^A-Z0-9]/g,'');
      let row = db.telegramLinkCodes.find(c => c.code === code && !c.usedAt && c.expiresAt > Date.now());
      if (!row) {
        // if already linked user sending code by mistake, fall through
        let already = db.users.find(u => u.telegramUserId === fromId);
        if (!already) return tgSend(chatId, 'کد اتصال نامعتبر یا منقضی است.\\nاز تنظیمات lifeos یک کد تازه بساز.');
      } else {
        let owner = db.users.find(u => u.id === row.userId);
        if (!owner) return tgSend(chatId, 'حساب متصل به این کد پیدا نشد.');
        // detach this telegram from any other user
        db.users.forEach(u => { if (u.telegramUserId === fromId && u.id !== owner.id) u.telegramUserId = null; });
        owner.telegramUserId = fromId;
        row.usedAt = Date.now();
        row.usedBy = fromId;
        // invalidate other open codes for this user
        db.telegramLinkCodes.forEach(c => { if (c.userId === owner.id && c.code !== code && !c.usedAt) c.expiresAt = 0; });
        await write(db);
        return tgSend(chatId, '✅ تلگرام به حساب «' + (owner.name || owner.email || '') + '» وصل شد.\\n/start برای راهنما', { reply_markup: tgMainKeyboard() });
      }
    }
    let user = db.users.find(u => u.telegramUserId === fromId);
    if (!user) return tgSend(chatId, 'این تلگرام به هیچ حسابی وصل نیست.\\n\\n۱) در lifeos → تنظیمات → «ساخت کد اتصال»\\n۲) همان کد را اینجا بفرست یا /start CODE');

    db.reminders??=[];db.tasks??=[];
    let d=today();
    if(text.startsWith('/')){
      let cmd=tgCmdName(text),arg=text.slice(cmd.length).trim();
      if(cmd==='/start'||cmd==='/help'||cmd==='/کمک'||cmd==='/راهنما'){
        return tgSend(chatId,'سلام'+(user.name?(' '+user.name):'')+' 👋\nمن دستیار lifeos هستم.\n\n'+'فرمان‌ها:\n/امروز /کارها /یادآوری‌ها /موجودی /پرتفوی /گزارش_ماه /انجام\n\nمتن آزاد بفرست، مثلاً:\n• خرید عینک ۲/۵ م\n• سه‌شنبه هفته بعد قرار دکتر ساعت ۳\n• ۵۰ هزار ناهار\n• حالم ۸، ۷ ساعت خوابیدم\n• کار خرید نان\n\nگزارش خودکار: صبح ۹ و شب ۲۳ (تهران)\nدستی: /گزارش_صبح /گزارش_شب',{reply_markup:tgMainKeyboard()});
      }
      if(cmd==='/خرید'||cmd==='/لیست'||cmd==='/shop'){
        if(arg){let n=shopAdd(db,user,arg.split(/[،,\n]+/));await write(db);return tgSend(chatId,'🛒 '+n.toLocaleString('fa-IR')+' قلم به لیست خرید اضافه شد.')}
        let open=shopList(db,user).filter(x=>!x.done);await write(db);
        return tgSend(chatId,open.length?('🛒 لیست خرید:\n'+open.map((x,i)=>(i+1)+'. '+x.text).join('\n')+'\n\nافزودن: /خرید نان، شیر'):'🛒 لیست خرید خالی است.\nافزودن: /خرید نان، شیر');
      }
      if(cmd==='/امروز'){
        let tasks=db.tasks.filter(x=>x.userId===user.id&&x.date===d),done=tasks.filter(x=>x.done).length;
        let expense=db.transactions.filter(x=>x.userId===user.id&&x.date===d&&x.kind==='expense').reduce((n,x)=>n+x.amount,0);
        let daily=db.daily.find(x=>x.userId===user.id&&x.date===d);
        let rems=db.reminders.filter(x=>x.userId===user.id&&x.date===d&&!x.done);
        let lines=['📅 امروز '+tgFmtDate(d),`✅ کارها: ${done} از ${tasks.length}`,`💸 هزینه: ${expense.toLocaleString('fa-IR')} ریال`,`🙂 حال: ${daily?daily.mood+'/10':'ثبت نشده'}`];
        if(rems.length){lines.push('🔔 یادآوری امروز:');rems.slice(0,8).forEach(r=>lines.push('• '+(r.time?r.time+' · ':'')+r.title))}
        if(tasks.filter(x=>!x.done).length){lines.push('⬜ مانده:');tasks.filter(x=>!x.done).slice(0,8).forEach((t,i)=>lines.push(`${i+1}. ${t.title}`))}
        return tgSend(chatId,lines.join('\n'),{reply_markup:tgMainKeyboard()});
      }
      if(cmd==='/کارها'||cmd==='/tasks'){
        let tasks=db.tasks.filter(x=>x.userId===user.id&&x.date===d).sort((a,b)=>(a.done-b.done)||String(a.startTime||'').localeCompare(String(b.startTime||'')));
        if(!tasks.length)return tgSend(chatId,'کاری برای امروز ثبت نشده.\nبفرست: کار خرید نان');
        let lines=['✅ کارهای امروز:'];
        tasks.forEach((t,i)=>lines.push(`${t.done?'✅':'⬜'} ${i+1}. ${(t.startTime?t.startTime+' · ':'')}${t.title}`));
        lines.push('','برای تیک: /انجام 1');
        return tgSend(chatId,lines.join('\n'));
      }
      if(cmd==='/یادآوری‌ها'||cmd==='/reminders'||cmd==='/یادآوری'){
        let to=addDaysIso(d,7);
        let rems=db.reminders.filter(x=>x.userId===user.id&&!x.done&&x.date>=d&&x.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||String(a.time||'').localeCompare(String(b.time||'')));
        let subs=db.subscriptions.filter(x=>x.userId===user.id&&!x.archived&&x.nextDate>=d&&x.nextDate<=to);
        let debts=db.debts.filter(x=>x.userId===user.id&&!x.settled&&x.dueDate&&x.dueDate>=d&&x.dueDate<=to);
        let lines=['🔔 سررسید ۷ روز آینده:'];
        if(!rems.length&&!subs.length&&!debts.length)lines.push('چیزی نیست.');
        rems.forEach(r=>lines.push(`• ${tgFmtDate(r.date)}${r.time?' '+r.time:''} — ${r.title}${r.notes?'\n  '+r.notes:''}`));
        subs.forEach(s=>lines.push(`• 💳 ${s.nextDate} — اشتراک ${s.name||s.title||''}`));
        debts.forEach(x=>lines.push(`• 📌 ${x.dueDate} — بدهی/طلب ${x.title||x.name||''}`));
        return tgSend(chatId,lines.join('\n'));
      }
      if(cmd==='/موجودی'){
        let accounts=db.accounts.filter(x=>x.userId===user.id&&!x.archived),balances={};
        db.transactions.filter(x=>x.userId===user.id).forEach(x=>{let a=x.account||'بدون حساب';if(x.kind==='transfer'){balances[a]=(balances[a]||0)-x.amount;let b=x.toAccount||'بدون حساب';balances[b]=(balances[b]||0)+x.amount}else balances[a]=(balances[a]||0)+(x.kind==='income'?x.amount:-x.amount)});
        let lines=accounts.map(a=>`${a.name}: ${((a.openingBalance||0)+(balances[a.name]||0)).toLocaleString('fa-IR')} ریال`);
        return tgSend(chatId,lines.length?lines.join('\n'):'حسابی ثبت نشده.');
      }
      if(cmd==='/پرتفوی'){
        let totals=portfolioTotals(computeHoldings(db,user.id)),lines=Object.entries(totals).map(([cur,t])=>`${cur}: ارزش ${t.value.toLocaleString('fa-IR')} · سود/زیان ${(t.unrealizedPnl+t.realizedPnl+t.dividends-t.fees).toLocaleString('fa-IR')}`);
        return tgSend(chatId,lines.length?lines.join('\n'):'هنوز دارایی‌ای ثبت نشده.');
      }
      if(cmd==='/گزارش_ماه'){
        let month=d.slice(0,7),t=db.transactions.filter(x=>x.userId===user.id&&x.date.startsWith(month)),expense=t.filter(x=>x.kind==='expense').reduce((n,x)=>n+x.amount,0),income=t.filter(isIncomeTx).reduce((n,x)=>n+x.amount,0);
        return tgSend(chatId,`گزارش ${month}:\nدرآمد: ${income.toLocaleString('fa-IR')}\nهزینه: ${expense.toLocaleString('fa-IR')}\nمانده: ${(income-expense).toLocaleString('fa-IR')}`);
      }

      if(cmd==='/گزارش_صبح'||cmd==='/صبح'){
        let w=await fetchTehranWeatherBrief(user.weather);
        let r=await tgSend(chatId,await buildMorningBrief(db,user,d,w),{reply_markup:tgMainKeyboard()});await tgSendHardWord(user);return r;
      }
      if(cmd==='/گزارش_شب'||cmd==='/شب'){
        return tgSend(chatId,await buildEveningReport(db,user,d),{reply_markup:tgMainKeyboard()});
      }

      if(cmd==='/انجام'||cmd==='/done'){
        let n=Number((enNum(arg).match(/\d+/)||[0])[0]);
        let tasks=db.tasks.filter(x=>x.userId===user.id&&x.date===d&&!x.done);
        if(!n||n<1||n>tasks.length)return tgSend(chatId,tasks.length?('شماره کار را بگو، مثلاً /انجام 1\n'+tasks.map((t,i)=>`${i+1}. ${t.title}`).join('\n')):'کار باز برای امروز نیست.');
        let t=tasks[n-1];t.done=true;
        let rem=db.reminders.find(r=>r.userId===user.id&&r.date===d&&!r.done&&(r.title===t.title||t.title.includes(r.title)));
        if(rem)rem.done=true;
        await write(db);
        return tgSend(chatId,'✅ انجام شد: '+t.title);
      }
      return tgSend(chatId,'فرمان‌ها:\n/امروز /کارها /یادآوری‌ها /موجودی /پرتفوی /گزارش_ماه /انجام\n\nمتن آزاد بفرست، مثلاً:\n• خرید عینک ۲/۵ م\n• سه‌شنبه هفته بعد قرار دکتر ساعت ۳\n• ۵۰ هزار ناهار\n• حالم ۸، ۷ ساعت خوابیدم\n• کار خرید نان\n\nگزارش خودکار: صبح ۹ و شب ۲۳ (تهران)\nدستی: /گزارش_صبح /گزارش_شب',{reply_markup:tgMainKeyboard()});
    }
    let actions=parseLifeText(text);
    if(!actions.length&&AI_PROVIDER_API_KEY){try{actions=await aiExtractActions(text)}catch(e){}}
    let hasTxAction=actions.some(a=>a.type==='transaction');
    let done=await applyParsedActions(db,user,actions,d,photoFileId);
    await write(db);
    let reply=done.length?('ثبت شد:\n• '+done.join('\n• ')):'چیزی قابل تشخیص نبود.\n'+'فرمان‌ها:\n/امروز /کارها /یادآوری‌ها /موجودی /پرتفوی /گزارش_ماه /انجام\n\nمتن آزاد بفرست، مثلاً:\n• خرید عینک ۲/۵ م\n• سه‌شنبه هفته بعد قرار دکتر ساعت ۳\n• ۵۰ هزار ناهار\n• حالم ۸، ۷ ساعت خوابیدم\n• کار خرید نان\n\nگزارش خودکار: صبح ۹ و شب ۲۳ (تهران)\nدستی: /گزارش_صبح /گزارش_شب';
    if(photoFileId&&!hasTxAction)reply+='\n\n🧾 عکس رو گرفتم ولی چون کپشنش مبلغ‌دار نبود به هیچ تراکنشی وصلش نکردم. با کپشنی مثل «ناهار ۱۵۰۰۰۰۰ ریال» دوباره بفرست.';
    return tgSend(chatId,reply,{reply_markup:tgMainKeyboard()});
  }

  const WMO_FA={0:['صاف','☀️'],1:['کمی ابری','🌤'],2:['نیمه‌ابری','⛅'],3:['ابری','☁️'],45:['مه','🌫'],48:['مه','🌫'],51:['نم‌نم','🌦'],53:['نم‌نم','🌦'],55:['نم‌نم','🌦'],61:['باران سبک','🌧'],63:['باران','🌧'],65:['باران شدید','🌧'],71:['برف سبک','🌨'],73:['برف','🌨'],75:['برف','❄️'],80:['رگبار','🌦'],81:['رگبار','🌦'],82:['رگبار شدید','🌦'],95:['رعدوبرق','⛈'],96:['رعدوبرق','⛈'],99:['رعدوبرق','⛈']};
  function tehranHourNow(){let p=tehranParts(new Date());return Number(p.hour)}
  function tehranMinuteNow(){let p=tehranParts(new Date());return Number(p.minute)}
  // فاز ۲ — شهر انتخابی: مختصات از user.weather؛ بدون آن تهران. کش ۳۰ دقیقه‌ای بر اساس مختصات.
  async function fetchTehranWeatherBrief(loc){
    const _wc=fetchTehranWeatherBrief._cache||(fetchTehranWeatherBrief._cache={});
    const lat=loc&&isFinite(Number(loc.lat))?Number(loc.lat):35.69, lon=loc&&isFinite(Number(loc.lon))?Number(loc.lon):51.39, wkey=lat+','+lon;
    if(_wc[wkey]&&Date.now()-_wc[wkey].at<30*60*1000)return _wc[wkey].d;
    try{
      let [w,aq]=await Promise.all([
        fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,weather_code,relative_humidity_2m,apparent_temperature,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=2').then(r=>r.json()),
        fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude='+lat+'&longitude='+lon+'&current=european_aqi,pm2_5&timezone=auto').then(r=>r.json()).catch(()=>null)
      ]);
      if(!w||!w.current)return null;
      let code=w.current.weather_code,pair=WMO_FA[code]||['—','🌡'];
      let aqi=aq&&aq.current?aq.current.european_aqi:null;
      let aqiLabel=aqi==null?null:(aqi<=40?'خوب':aqi<=60?'متوسط':aqi<=80?'ضعیف':'ناسالم');
      let out={
        temp:Math.round(w.current.temperature_2m),
        feel:Math.round(w.current.apparent_temperature),
        hum:Math.round(w.current.relative_humidity_2m),
        wind:Math.round(w.current.wind_speed_10m),
        icon:pair[1], desc:pair[0],
        tmax:w.daily&&w.daily.temperature_2m_max?Math.round(w.daily.temperature_2m_max[0]):null,
        tmin:w.daily&&w.daily.temperature_2m_min?Math.round(w.daily.temperature_2m_min[0]):null,
        pop:w.daily&&w.daily.precipitation_probability_max?w.daily.precipitation_probability_max[0]:null,
        sunrise:(w.daily&&w.daily.sunrise&&w.daily.sunrise[0]||'').slice(11,16),
        sunset:(w.daily&&w.daily.sunset&&w.daily.sunset[0]||'').slice(11,16),
        aqi, aqiLabel
      };
      _wc[wkey]={at:Date.now(),d:out};
      return out;
    }catch(e){return null}
  }
  function formatWeatherLine(w){
    if(!w)return null;
    let s=w.icon+' تهران: '+w.temp+'° ('+w.desc+')';
    if(w.tmin!=null&&w.tmax!=null)s+=' · '+w.tmin+'°…'+w.tmax+'°';
    if(w.feel!=null)s+=' · حس '+w.feel+'°';
    if(w.pop!=null&&w.pop>0)s+=' · احتمال باران '+w.pop+'٪';
    if(w.aqi!=null)s+=' · هوا '+(w.aqiLabel||'')+' ('+w.aqi+')';
    if(w.sunrise&&w.sunset)s+='\n🌅 '+w.sunrise+' · 🌇 '+w.sunset;
    return s;
  }
  function debtLine(x,d){let dd=Math.round((Date.parse(x.dueDate+'T00:00:00Z')-Date.parse(d+'T00:00:00Z'))/864e5),when=dd<0?('⛔ '+(-dd).toLocaleString('fa-IR')+' روز گذشته'):dd===0?'⚠️ امروز':(dd.toLocaleString('fa-IR')+' روز دیگر');let amt=(x.currency==='USD'?(Number(x.amount)||0).toLocaleString('fa-IR')+' دلار':(Number(x.amount)||0).toLocaleString('fa-IR')+' ریال');return (x.type==='payable'?'🔴 بدهی به ':'🟢 طلب از ')+(x.person||'?')+' · '+amt+' · '+when}
  function jParts(iso){try{let p=Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(String(iso).slice(0,10)+'T12:00:00Z')).map(x=>[x.type,x.value]));return{jy:parseInt(p.year),jm:parseInt(p.month),jd:parseInt(p.day)}}catch(e){return null}}
  const J_MONTHS=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  function fmtShortRial(n){let a=Math.abs(n),f=v=>v.toLocaleString('fa-IR',{maximumFractionDigits:v>=100?0:v>=10?1:2});return (n<0?'−':'')+(a>=1e9?f(a/1e9)+' میلیارد':a>=1e6?f(a/1e6)+' میلیون':a.toLocaleString('fa-IR'))+' ریال'}
  function monthStats(db,userId,from,to){let all=db.transactions.filter(x=>x.userId===userId&&x.date>=from&&x.date<=to),isX=x=>x.kind==='expense'&&normalizeCategoryName(x.category)==='انتقال',exp=all.filter(x=>x.kind==='expense'&&!isX(x)),income=all.filter(isIncomeTx).reduce((n,x)=>n+x.amount,0),expense=exp.reduce((n,x)=>n+x.amount,0),cats={};exp.forEach(x=>{let c=x.category||'متفرقه';cats[c]=(cats[c]||0)+x.amount});return{income,expense,cats,count:all.length,misc:exp.filter(x=>(normalizeCategoryName(x.category)||'متفرقه')==='متفرقه').length}}
  function buildMonthlyReport(db,user,jy,jm){
    let from=jalaliToGregorianIso(jy,jm,1),nm=jm===12?[jy+1,1]:[jy,jm+1],to=addDaysIso(jalaliToGregorianIso(nm[0],nm[1],1),-1);
    let pm=jm===1?[jy-1,12]:[jy,jm-1],pfrom=jalaliToGregorianIso(pm[0],pm[1],1),pto=addDaysIso(from,-1);
    let st=monthStats(db,user.id,from,to),prev=monthStats(db,user.id,pfrom,pto),bal=st.income-st.expense;
    let L=['📊 گزارش ماهانه · '+J_MONTHS[jm-1]+' '+jy.toLocaleString('fa-IR',{useGrouping:false}),''];
    L.push('💰 درآمد: '+fmtShortRial(st.income));
    let chg=prev.expense?Math.round((st.expense-prev.expense)/prev.expense*100):null;
    L.push('💸 هزینه: '+fmtShortRial(st.expense)+(chg!=null?(' ('+(chg>=0?'▲ ':'▼ ')+Math.abs(chg).toLocaleString('fa-IR')+'٪ نسبت به '+J_MONTHS[pm[1]-1]+')'):''));
    L.push('⚖️ مانده: '+fmtShortRial(bal)+(st.income?(' · پس‌انداز '+Math.round(bal/st.income*100).toLocaleString('fa-IR')+'٪'):''));
    let top=Object.entries(st.cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(top.length){L.push('');L.push('🏷 بیشترین هزینه‌ها:');top.forEach(([c,a])=>L.push('• '+c+' — '+fmtShortRial(a)+' ('+Math.round(a/Math.max(1,st.expense)*100).toLocaleString('fa-IR')+'٪)'))}
    let key=jy+'-'+String(jm).padStart(2,'0'),bs=(db.budgets||[]).filter(x=>x.userId===user.id&&x.month===key);
    let over=bs.filter(b=>b.category!=='__total__'&&(st.cats[b.category]||0)>b.limit),tot=bs.find(b=>b.category==='__total__');
    if(tot)L.push((st.expense>tot.limit?'🚨':'✅')+' سقف کل: '+fmtShortRial(st.expense)+' از '+fmtShortRial(tot.limit));
    if(over.length){L.push('🚨 بیش از سقف:');over.forEach(b=>L.push('• '+b.category+' — '+fmtShortRial((st.cats[b.category]||0)-b.limit)+' بیشتر'))}
    if(st.misc)L.push('📦 '+st.misc.toLocaleString('fa-IR')+' هزینه بدون دسته — در صفحهٔ مالی دسته‌بندی کن.');
    let d=today(),debts=(db.debts||[]).filter(x=>x.userId===user.id&&!x.settled&&x.dueDate&&x.dueDate<=addDaysIso(d,30)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    if(debts.length){L.push('');L.push('📌 سررسیدهای ۳۰ روز آینده:');debts.slice(0,6).forEach(x=>L.push('• '+debtLine(x,d)))}
    return L.join('\n');
  }
  // Admin = emails in the ADMIN_EMAILS secret (comma-separated); without it, the first account ever created.
  function isAdmin(db,user){if(!user)return false;let list=String(env.ADMIN_EMAILS||'').split(/[,\s]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);if(list.length)return list.includes(String(user.email||'').toLowerCase());let first=(db.users||[]).slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))[0];return !!first&&first.id===user.id}
  function adminOverview(db){
    let now=Date.now(),day=864e5,cnt=(arr,uid)=>Array.isArray(arr)?arr.reduce((n,x)=>n+(x&&x.userId===uid?1:0),0):0;
    let users=(db.users||[]).map(u=>{let col=Object.values(db.col||{}).reduce((n,l)=>n+cnt(l,u.id),0),mods=u.modules?Object.entries(u.modules).filter(([,v])=>v).map(([k])=>k):null;
      let items={tasks:cnt(db.tasks,u.id),reminders:cnt(db.reminders,u.id),transactions:cnt(db.transactions,u.id),notes:cnt(db.inbox,u.id),movies:cnt(db.movies,u.id),contacts:cnt(db.contacts,u.id),documents:cnt(db.documents,u.id),poker:cnt(db.pokerSessions,u.id),col};
      let total=Object.values(items).reduce((a,b)=>a+b,0);
      return {id:u.id,name:u.name||'',displayName:u.displayName||'',email:u.email||'',createdAt:u.createdAt||null,lastSeenAt:u.lastSeenAt||null,lastLoginAt:u.lastLoginAt||null,sessions:(db.sessions||[]).filter(s=>s.userId===u.id).length,telegram:!!u.telegramUserId,push:(u.pushSubs||[]).length,google:!!u.googleId,calendar:!!u.googleCalendarRefreshToken,modules:mods,items,total,admin:isAdmin(db,u),disabled:!!u.disabled,disabledAt:u.disabledAt||null,locked:u.lockedModules||[]}}).sort((a,b)=>(b.lastSeenAt||b.createdAt||0)-(a.lastSeenAt||a.createdAt||0));
    let seen=d=>users.filter(u=>u.lastSeenAt&&now-u.lastSeenAt<d*day).length,joined=d=>users.filter(u=>u.createdAt&&now-u.createdAt<d*day).length;
    let weeks=Array.from({length:12},(_,i)=>{let to=now-(11-i)*7*day,from=to-7*day;return {from:new Date(from).toISOString().slice(0,10),signups:users.filter(u=>u.createdAt&&u.createdAt>from&&u.createdAt<=to).length,active:users.filter(u=>u.lastSeenAt&&u.lastSeenAt>from&&u.lastSeenAt<=to).length}});
    let logicalBytes=0;try{logicalBytes=new TextEncoder().encode(JSON.stringify(db)).length}catch(e){}
    let shardBytes=[...(db.__storageChunks||new Map()).values()].map(value=>stateTextBytes(value)),largestShard=Math.max(0,...shardBytes),isSharded=db.__storageMode==='v2';
    let modCount={};users.forEach(u=>(u.modules||['همه']).forEach(m=>modCount[m]=(modCount[m]||0)+1));
    return {totals:{users:users.length,active1:seen(1),active7:seen(7),active30:seen(30),new7:joined(7),new30:joined(30),telegram:users.filter(u=>u.telegram).length,push:users.filter(u=>u.push).length,sessions:(db.sessions||[]).length,dbBytes:isSharded?largestShard:logicalBytes,dbLimit:2000000,dbLogicalBytes:logicalBytes,dbShards:shardBytes.length,storageMode:isSharded?'sharded':'legacy'},weeks,modules:modCount,users,generatedAt:now,adminSource:String(env.ADMIN_EMAILS||'').trim()?'env':'first-user'}
  }
  function tehDay(ms){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms))}catch(e){return ''}}
  function buildProjectsWeekly(db,user,d){
    let from=addDaysIso(d,-6),nx=addDaysIso(d,7),projects=((db.col||{}).projects||[]).filter(x=>x.userId===user.id&&!x.archived),cards=((db.col||{}).cards||[]).filter(x=>x.userId===user.id);
    if(!projects.length)return '';
    let n=v=>Number(v||0).toLocaleString('fa-IR'),L=['📁 گزارش هفتگی پروژه‌ها · '+tgFmtDate(from)+' تا '+tgFmtDate(d),''],tot=0;
    for(const pr of projects){
      let cs=cards.filter(c=>c.projectId===pr.id),done=cs.filter(c=>c.col==='done'),pct=cs.length?Math.round(done.length/cs.length*100):0;
      let wk=done.filter(c=>c.doneAt&&tehDay(c.doneAt)>=from&&tehDay(c.doneAt)<=d),late=cs.filter(c=>c.col!=='done'&&c.due&&c.due<d),soon=cs.filter(c=>c.col!=='done'&&c.due&&c.due>=d&&c.due<=nx),doing=cs.filter(c=>c.col==='doing'||c.col==='review');
      tot+=wk.length;
      let bar='▰'.repeat(Math.round(pct/10))+'▱'.repeat(10-Math.round(pct/10));
      L.push('▪️ '+pr.name+(pr.client?' ('+pr.client+')':''));
      L.push('   '+bar+' '+n(pct)+'٪ · '+n(done.length)+' از '+n(cs.length)+' کارت');
      L.push('   ✅ این هفته: '+n(wk.length)+(doing.length?' · 🔄 در جریان: '+n(doing.length):'')+(late.length?' · ⛔ عقب: '+n(late.length):''));
      if(pr.deadline){let dd=Math.round((Date.parse(pr.deadline)-Date.parse(d))/864e5);L.push('   ⏳ مهلت: '+tgFmtDate(pr.deadline)+(dd<0?' — '+n(-dd)+' روز گذشته':' — '+n(dd)+' روز مانده'))}
      if(soon.length)L.push('   ➡️ هفتهٔ بعد: '+soon.slice(0,4).map(c=>c.title).join('، ')+(soon.length>4?' …':''));
      if(wk.length)L.push('   ✔️ انجام‌شده‌ها: '+wk.slice(0,4).map(c=>c.title).join('، ')+(wk.length>4?' …':''));
      L.push('');
    }
    L.push('جمع کارت‌های انجام‌شدهٔ هفته: '+n(tot));
    return L.join('\n');
  }
  // Monthly loss limit for poker + bet (bet converted with the last dollar rate the app reported). Alerts once per Jalali month.
  function funMonth(db,user,d){let j=jParts(d);if(!j)return null;let from=jalaliToGregorianIso(j.jy,j.jm,1),nm=j.jm===12?[j.jy+1,1]:[j.jy,j.jm+1],to=addDaysIso(jalaliToGregorianIso(nm[0],nm[1],1),-1),rate=Number((db.meta||{}).usdRate)||0;
    let poker=(db.pokerSessions||[]).filter(x=>x.userId===user.id&&x.date>=from&&x.date<=to).reduce((n,x)=>n+(Number(x.cashOut)-Number(x.buyIn)),0);
    let betUsd=betRollup(betDaysOf(db,user.id),{from,to}).stats.profit||0;
    return {key:j.jy+'-'+j.jm,from,to,poker,betUsd,rate,net:poker+(rate?betUsd*rate:0)}}
  async function funCheck(db,user){let lim=Number(user.funLossLimit)||0;if(!lim)return false;let m=funMonth(db,user,today());if(!m||m.net>-lim)return false;if(user.funAlertKey===m.key)return false;user.funAlertKey=m.key;
    let t='🚨 حد ضرر ماهانهٔ پوکر و بت رد شد\nضرر این ماه: '+fmtShortRial(-m.net)+' از سقف '+fmtShortRial(lim)+'\nپوکر: '+fmtShortRial(m.poker)+' · بت: '+(m.betUsd>=0?'+':'−')+'$'+Math.abs(m.betUsd).toLocaleString('fa-IR',{maximumFractionDigits:2})+'\nبهتره این ماه دیگه بازی نکنی.';
    try{if(TELEGRAM_BOT_TOKEN&&user.telegramUserId)await tgSend(user.telegramUserId,t)}catch(e){}
    try{if(user.pushSubs&&user.pushSubs.length&&user.pushOn!==false)await sendWebPush(db,user,{title:'🚨 حد ضرر ماهانه رد شد',body:'ضرر این ماه: '+fmtShortRial(-m.net),url:'/?page=finance&tab=fun'})}catch(e){}
    return true}
  function buildWeeklyReport(db,user,d){
    let from=addDaysIso(d,-6),to=d,L=['🗓 مرور هفته · '+tgFmtDate(from)+' تا '+tgFmtDate(to),''];
    let tasks=db.tasks.filter(x=>x.userId===user.id&&x.date>=from&&x.date<=to&&!x.isReminder),done=tasks.filter(x=>x.done);
    L.push('✅ کارها: '+done.length.toLocaleString('fa-IR')+' از '+tasks.length.toLocaleString('fa-IR')+(tasks.length?(' ('+Math.round(done.length/tasks.length*100).toLocaleString('fa-IR')+'٪)'):''));
    let habits=(db.habits||[]).filter(x=>x.userId===user.id&&!x.archived);
    if(habits.length){L.push('🔥 عادت‌ها:');habits.forEach(h=>{let n=(db.habitLogs||[]).filter(l=>l.habitId===h.id&&l.done&&l.date>=from&&l.date<=to).length;L.push('• '+(h.icon||'✓')+' '+h.name+' — '+n.toLocaleString('fa-IR')+' از ۷ '+'●'.repeat(n)+'○'.repeat(Math.max(0,7-n)))})}
    let st=monthStats(db,user.id,from,to);L.push('💸 هزینهٔ هفته: '+fmtShortRial(st.expense)+(st.income?(' · درآمد '+fmtShortRial(st.income)):''));
    let top=Object.entries(st.cats).sort((a,b)=>b[1]-a[1]).slice(0,3);if(top.length)L.push('  └ '+top.map(([c,a])=>c+' '+fmtShortRial(a)).join(' · '));
    let wm=(db.timeEntries||[]).filter(x=>x.userId===user.id&&x.date>=from&&x.date<=to).reduce((n,x)=>n+(x.minutes||0),0);if(wm)L.push('⏱ کار ثبت‌شده: '+Math.floor(wm/60).toLocaleString('fa-IR')+' ساعت');
    let nx=addDaysIso(d,7),rec=recurringList(db,user.id).filter(r=>r.nextDate<=nx),debts=(db.debts||[]).filter(x=>x.userId===user.id&&!x.settled&&x.dueDate&&x.dueDate<=nx);
    if(rec.length||debts.length){L.push('');L.push('➡️ هفتهٔ بعد:');rec.forEach(r=>L.push('• 🔁 '+r.title+' · '+fmtShortRial(r.amount)+' · '+tgFmtDate(r.nextDate)));debts.forEach(x=>L.push('• '+debtLine(x,d)))}
    let open=db.tasks.filter(x=>x.userId===user.id&&!x.done&&x.deadline&&x.deadline<d);if(open.length)L.push('⛔ '+open.length.toLocaleString('fa-IR')+' کار عقب‌افتاده');
    return L.join('\n');
  }

  // ── Reminder notifications: Telegram (with ✓ / snooze / tomorrow buttons) + Web Push ──
  const LEAD_FA={10:'۱۰ دقیقه',30:'نیم ساعت',60:'یک ساعت',180:'سه ساعت',1440:'یک روز'};
  function remDue(r){return Date.parse(r.date+'T'+(r.time||'09:00')+':00+03:30')}
  function tehranHmAfter(ms){let p=tehranParts(new Date(Date.now()+ms));return{date:p.year+'-'+p.month+'-'+p.day,time:(p.hour==='24'?'00':p.hour)+':'+p.minute}}
  function remKeyboard(r){return{inline_keyboard:[[{text:'✓ انجام شد',callback_data:'rem:d:'+r.id},{text:'⏰ ۱۵ دقیقه بعد',callback_data:'rem:s:'+r.id},{text:'📅 فردا',callback_data:'rem:t:'+r.id}]]}}
  function b64u(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  async function vapidKeys(db){db.meta??={};if(db.meta.vapid&&db.meta.vapid.publicKey)return db.meta.vapid;let kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);let pub=await crypto.subtle.exportKey('raw',kp.publicKey),jwk=await crypto.subtle.exportKey('jwk',kp.privateKey);db.meta.vapid={publicKey:b64u(pub),privateJwk:jwk,created:Date.now()};db.__dirty=true;return db.meta.vapid}
  async function sendWebPush(db,user,note){let subs=user.pushSubs||[];if(!subs.length)return false;user.pushQueue=[...(user.pushQueue||[]).filter(x=>Date.now()-x.at<86400e3),{id:id(),at:Date.now(),...note}].slice(-20);let v=await vapidKeys(db),key=await crypto.subtle.importKey('jwk',v.privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']),keep=[];for(const sub of subs){try{let aud=new URL(sub.endpoint).origin,enc=o=>b64u(new TextEncoder().encode(JSON.stringify(o))),unsigned=enc({typ:'JWT',alg:'ES256'})+'.'+enc({aud,exp:Math.floor(Date.now()/1000)+12*3600,sub:'mailto:lifeos@localhost'}),sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(unsigned)),jwt=unsigned+'.'+b64u(sig);let r=await fetch(sub.endpoint,{method:'POST',headers:{TTL:'3600',Urgency:'high',Authorization:'vapid t='+jwt+', k='+v.publicKey,'Content-Length':'0'}});if(r.status!==404&&r.status!==410)keep.push(sub)}catch(e){keep.push(sub)}}user.pushSubs=keep;return true}
  async function notifyUser(db,user,text,note,reminder){let sent=false;if(user.telegramUserId&&user.tgRemindersOn!==false){let r=await tgSend(user.telegramUserId,text,reminder?{reply_markup:remKeyboard(reminder)}:{});if(r&&r.ok)sent=true}if(user.pushSubs&&user.pushSubs.length&&user.pushOn!==false){try{if(await sendWebPush(db,user,note))sent=true}catch(e){}}return sent}
  function courseSessions(c){let N=Math.max(0,Math.min(60,Number(c.sessions)||0)),days=(Array.isArray(c.days)?c.days:[]).map(Number);if(!c.startDate||!days.length||!N)return[];let skip=new Set(c.skip||[]),mv=c.moves||{},out=[],d=c.startDate,g=800;while(out.length<N&&g-->0){let wd=new Date(d+'T12:00:00Z').getUTCDay();if(days.includes(wd)&&!skip.has(d)){let m=mv[d]||{};out.push({n:out.length+1,orig:d,date:m.date||d,time:m.time||c.time||''})}d=addDaysIso(d,1)}return out}
  async function checkCourseSessions(db){let now=Date.now(),changed=false;for(const user of db.users){if(user.disabled||!(user.telegramUserId||(user.pushSubs||[]).length))continue;for(const c of colOf(db,'courses')){if(c.userId!==user.id||c.status==='done'||!c.time)continue;for(const x of courseSessions(c)){if(!x.time)continue;let due=Date.parse(x.date+'T'+x.time+':00+03:30'),key=x.date+'#'+x.n;if(!isFinite(due)||now<due-60*60e3||now>=due||(c.notifiedSessions||[]).includes(key))continue;let n=colOf(db,'students').filter(s=>s.courseId===c.id&&s.status!=='withdrawn').length;c.notifiedSessions=[...(c.notifiedSessions||[]),key].slice(-20);changed=true;await notifyUser(db,user,'🎓 کلاس «'+(c.name||'')+'» — جلسهٔ '+x.n.toLocaleString('fa-IR')+'\n⏰ ساعت '+x.time+' (کمتر از یک ساعت دیگر) · '+n.toLocaleString('fa-IR')+' دانشجو',{title:'🎓 '+(c.name||'کلاس'),body:'جلسهٔ '+x.n.toLocaleString('fa-IR')+' · ساعت '+x.time,url:'/?page=courses'})}}}return changed}
  async function checkReminderNotifications(db){let now=Date.now(),changed=false;for(const user of db.users){if(!(user.telegramUserId&&TELEGRAM_BOT_TOKEN)&&!(user.pushSubs&&user.pushSubs.length))continue;for(const r of db.reminders){if(r.userId!==user.id||r.done||!r.time||!r.date)continue;let due=remDue(r),detail=r.notes||r.note?'\n'+(r.notes||r.note):'';if(!isFinite(due))continue;let lead=Number(r.leadMinutes)||0;if(lead>0&&!r.leadSentAt&&now>=due-lead*60e3&&now<due-60e3){let txt='⏳ '+(LEAD_FA[lead]||(lead+' دقیقه'))+' دیگر: '+r.title+'\n⏰ ساعت '+r.time+(r.date!==today()?' · '+jalaliDateLabel(r.date):'')+detail;if(await notifyUser(db,user,txt,{title:'⏳ '+r.title,body:(LEAD_FA[lead]||lead+' دقیقه')+' دیگر · ساعت '+r.time,rid:r.id,url:'/?page=planner'},r)){r.leadSentAt=now;changed=true}}if(!r.notifiedAt&&now>=due&&now-due<3*3600e3){let txt='🔔 یادآوری: '+r.title+'\n⏰ '+r.time+detail;if(await notifyUser(db,user,txt,{title:'🔔 '+r.title,body:'ساعت '+r.time,rid:r.id,url:'/?page=planner'},r)){r.notifiedAt=now;changed=true}}}}if(await checkCourseSessions(db))changed=true;if(db.__dirty){delete db.__dirty;changed=true}return changed}
  function reminderAct(db,user,r,act){if(act==='d'){r.done=true;r.doneAt=Date.now();if(r.taskId){let t=db.tasks.find(x=>x.id===r.taskId&&x.userId===user.id);if(t)t.done=true}if(r.recurrence){let nx=r.recurrence==='weekly'?addDaysIso(r.date,7):r.recurrence==='monthly'?nextRecurDate(r.date,'monthly'):addDaysIso(r.date,1);if(!db.reminders.some(x=>x.userId===user.id&&x.title===r.title&&x.date===nx))db.reminders.push({id:id(),userId:user.id,title:r.title,date:nx,time:r.time,leadMinutes:r.leadMinutes||0,done:false,whenLabel:jalaliDateLabel(nx),recurrence:r.recurrence,createdAt:Date.now()})}return '✓ انجام شد'}if(act==='s'){let n=tehranHmAfter(15*60e3);r.date=n.date;r.time=n.time;delete r.notifiedAt;delete r.leadSentAt;return '⏰ ساعت '+n.time+' دوباره یادآوری می‌کنم'}if(act==='t'){let base=r.date>=today()?r.date:today();r.date=addDaysIso(base,1);delete r.notifiedAt;delete r.leadSentAt;return '📅 فردا '+(r.time||'')+' یادآوری می‌کنم'}return null}
  async function handleTelegramCallback(db,cq){let data=String(cq.data||''),m=data.match(/^rem:([dst]):(.+)$/),fromId=String(cq.from&&cq.from.id);let user=db.users.find(u=>String(u.telegramUserId||'')===fromId);let vl=data.match(/^vl:(.+)$/);if(vl&&user){let ok=await vocabLearn(user.id,vl[1]);await tgApi('answerCallbackQuery',{callback_query_id:cq.id,text:ok?'عالی! دیگر جزو واژه‌های سخت نیست.':'این واژه پیدا نشد.'});if(ok&&cq.message)await tgApi('editMessageText',{chat_id:cq.message.chat.id,message_id:cq.message.message_id,text:String(cq.message.text||'')+'\n\n✅ یاد گرفتم'});return ok}if(!m||!user){await tgApi('answerCallbackQuery',{callback_query_id:cq.id,text:'این دکمه دیگر معتبر نیست.'});return false}let r=db.reminders.find(x=>x.id===m[2]&&x.userId===user.id);if(!r){await tgApi('answerCallbackQuery',{callback_query_id:cq.id,text:'یادآوری پیدا نشد.'});return false}let msg=reminderAct(db,user,r,m[1]);await write(db);await tgApi('answerCallbackQuery',{callback_query_id:cq.id,text:msg||'انجام شد'});if(cq.message){await tgApi('editMessageText',{chat_id:cq.message.chat.id,message_id:cq.message.message_id,text:String(cq.message.text||'')+'\n\n'+(msg||'')})}return true}

  // ── generic per-user collections for the life / work modules ──
  const COLS=['health','vehicles','carlogs','shopping','projects','cards','projectContracts','projectFinancials','projectSupplies','projectProcesses','customers','deals','learning','focus','ygoals','journal','trips','courses','students'];
  // course students: paid = payments − refunds; remaining = fee − paid (0 once withdrawn)
  function studentMoney(st){let pay=(st.payments||[]),paid=pay.reduce((n,x)=>n+(x.kind==='refund'?-1:1)*(Number(x.amount)||0),0),fee=Number(st.fee)||0;return {paid,fee,remaining:st.status==='withdrawn'?0:Math.max(0,fee-paid)}}
  function courseDues(db,user,d,days){let soon=addDaysIso(d,days),courses=Object.fromEntries(colOf(db,'courses').filter(x=>x.userId===user.id).map(c=>[c.id,c]));return colOf(db,'students').filter(x=>x.userId===user.id&&x.dueDate&&x.dueDate<=soon&&x.status!=='withdrawn').map(x=>({id:x.id,name:x.name||'',course:(courses[x.courseId]||{}).name||'',courseId:x.courseId,dueDate:x.dueDate,remaining:studentMoney(x).remaining})).filter(x=>x.remaining>0).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))}
  function colOf(db,name){db.col??={};db.col[name]??=[];return db.col[name]}
  function cleanItem(d){let o={};for(const [k,v] of Object.entries(d||{})){if(/^(id|userId|createdAt|updatedAt|_.*)$/.test(k))continue;if(typeof v==='string')o[k]=v.slice(0,8000);else if(typeof v==='number'||typeof v==='boolean'||v===null)o[k]=v;else if(Array.isArray(v)||typeof v==='object')o[k]=JSON.parse(JSON.stringify(v).slice(0,20000)||'null')}return o}
  function shopList(db,user){user.shopCode??=randHex(8);return colOf(db,'shopping').filter(x=>x.userId===user.id)}
  function shopAdd(db,user,texts){let list=colOf(db,'shopping'),n=0;for(let t of texts){t=String(t||'').trim().slice(0,80);if(!t)continue;if(list.some(x=>x.userId===user.id&&!x.done&&x.text===t))continue;list.push({id:id(),userId:user.id,text:t,done:false,createdAt:Date.now(),updatedAt:Date.now()});n++}return n}
  function projectDues(db,user,from,to){let projs=Object.fromEntries(colOf(db,'projects').filter(x=>x.userId===user.id&&!x.archived).map(p=>[p.id,p]));return colOf(db,'cards').filter(c=>c.userId===user.id&&c.due&&c.col!=='done'&&projs[c.projectId]&&(!from||c.due>=from)&&c.due<=to).map(c=>({id:c.id,title:c.title||'',due:c.due,prio:c.prio||'n',owner:c.owner||'',col:c.col||'todo',projectId:c.projectId,project:projs[c.projectId].name||'',color:projs[c.projectId].color||'#d8a44c'})).sort((a,b)=>a.due.localeCompare(b.due)||(a.prio==='h'?-1:0)-(b.prio==='h'?-1:0))}
  function lifeDueLines(db,user,d){let out=[],soon=addDaysIso(d,7),mine=n=>colOf(db,n).filter(x=>x.userId===user.id);for(const v of mine('vehicles')){for(const [k,l] of [['insuranceUntil','بیمه'],['inspectionUntil','معاینهٔ فنی'],['nextServiceDate','سرویس']])if(v[k]&&v[k]<=soon)out.push('🚗 '+l+' '+(v.name||'خودرو')+' · '+(v[k]<d?'گذشته':tgFmtDate(v[k])));}for(const c of mine('customers'))if(c.nextFollowUp&&c.nextFollowUp<=d)out.push('📞 پیگیری '+(c.name||'مشتری')+(c.company?' ('+c.company+')':'')+(c.nextFollowUp<d?' — عقب افتاده':''));for(const dl of mine('deals'))if(dl.followUp&&dl.followUp<=d&&!['won','lost'].includes(dl.stage))out.push('💼 پیگیری معامله: '+(dl.title||''));for(const t of mine('trips'))if(t.from&&t.from>=d&&t.from<=soon)out.push('✈️ سفر '+(t.title||t.dest||'')+' · '+tgFmtDate(t.from));for(const x of courseDues(db,user,d,3))out.push('🎓 شهریهٔ '+x.name+(x.course?' ('+x.course+')':'')+' · '+fmtShortRial(x.remaining)+' · '+(x.dueDate<d?'سررسید گذشته':tgFmtDate(x.dueDate)));return out}
  async function buildMorningBrief(db,user,d,weather){
    let lines=[];
    lines.push('🌅 صبح بخیر'+(user.name?(' '+user.name):'')+'!');
    lines.push('📅 '+tgFmtDate(d));
    let wl=formatWeatherLine(weather); if(wl) lines.push(wl);
    let tasks=db.tasks.filter(x=>x.userId===user.id&&x.date===d).sort((a,b)=>String(a.startTime||'').localeCompare(String(b.startTime||'')));
    let open=tasks.filter(x=>!x.done);
    let rems=db.reminders.filter(x=>x.userId===user.id&&!x.done&&x.date===d).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||'')));
    lines.push('');
    lines.push('📋 برنامه امروز:');
    if(!open.length&&!rems.length) lines.push('• برنامهٔ خاصی ثبت نشده — بفرست مثلاً «کار خرید نان»');
    rems.forEach(r=>lines.push('🔔 '+(r.time?r.time+' · ':'')+r.title+(r.notes?'\n   '+r.notes:'')));
    open.filter(t=>!t.isReminder).slice(0,10).forEach(t=>lines.push('⬜ '+(t.startTime?t.startTime+' · ':'')+t.title));
    let matchesToday=(user.modules&&user.modules.football===false)?[]:db.matches.filter(x=>x.userId===user.id&&x.date===d);
    if(matchesToday.length){
      lines.push(''); lines.push('⚽ بازی‌ها:');
      matchesToday.forEach(m=>lines.push('• '+(m.time?m.time+' · ':'')+(m.home||'?')+' - '+(m.away||'?')+(m.status==='live'?' 🔴':'')));
    }
    let soon=addDaysIso(d,3);
    let subs=db.subscriptions.filter(x=>x.userId===user.id&&!x.archived&&x.nextDate>=d&&x.nextDate<=soon);
    let debts=db.debts.filter(x=>x.userId===user.id&&!x.settled&&x.dueDate&&x.dueDate<=addDaysIso(d,7)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
    let nearRems=db.reminders.filter(x=>x.userId===user.id&&!x.done&&x.date>d&&x.date<=soon),recs=recurringList(db,user.id).filter(r=>r.nextDate<=soon);
    if(subs.length||debts.length||nearRems.length||recs.length){
      lines.push(''); lines.push('⏰ سررسیدهای نزدیک:');
      subs.forEach(s=>lines.push('• 💳 '+s.nextDate+' — '+(s.name||s.title||'اشتراک')));
      debts.forEach(x=>lines.push('• '+debtLine(x,d)));recs.forEach(r=>lines.push('• 🔁 '+r.title+' · '+(Number(r.amount)||0).toLocaleString('fa-IR')+' ریال · '+(r.nextDate===d?'امروز':tgFmtDate(r.nextDate))));
      nearRems.slice(0,4).forEach(r=>lines.push('• 🔔 '+r.date+(r.time?' '+r.time:'')+' — '+r.title));
    }
    if(!user.modules||user.modules.vocab!==false){let vs=await vocabRead(user.id),sm=vocabSummary(vs,d);if(sm&&(sm.due||sm.newLeft)){lines.push('');lines.push('📘 زبان: '+sm.due.toLocaleString('fa-IR')+' کارت برای مرور · '+sm.newLeft.toLocaleString('fa-IR')+' واژهٔ نو'+(sm.streak?' · 🔥 '+sm.streak.toLocaleString('fa-IR')+' روز پیوسته':''))}let wd=vs?await wordOfDay(user.id,d,vs):null;if(wd){lines.push('🔤 واژهٔ روز: '+wd.w+(wd.p?' '+wd.p:'')+' — '+wd.fa);if(wd.e)lines.push('   «'+wd.e+'»'+(wd.ef?'\n   '+wd.ef:''))}}
    let pc=projectDues(db,user,'',d);if(pc.length){let late=pc.filter(x=>x.due<d).length;lines.push('');lines.push('🗂 '+pc.length.toLocaleString('fa-IR')+' کار پروژه برای امروز'+(late?' · '+late.toLocaleString('fa-IR')+' عقب‌افتاده':'')+':');pc.slice(0,6).forEach(x=>lines.push('• '+(x.prio==='h'?'❗ ':'')+x.title+' ('+x.project+')'+(x.due<d?' — عقب':'')));if(pc.length>6)lines.push('• …و '+(pc.length-6).toLocaleString('fa-IR')+' کار دیگر')}
    let life=lifeDueLines(db,user,d);if(life.length){lines.push('');lines.push('📌 پیگیری‌ها و موعدها:');life.slice(0,8).forEach(x=>lines.push('• '+x))}
    let tmr=addDaysIso(d,1);
    let tmrRems=db.reminders.filter(x=>x.userId===user.id&&!x.done&&x.date===tmr);
    let tmrTasks=db.tasks.filter(x=>x.userId===user.id&&!x.done&&x.date===tmr&&!x.isReminder);
    if(tmrRems.length||tmrTasks.length){
      lines.push(''); lines.push('➡️ فردا:');
      tmrRems.slice(0,3).forEach(r=>lines.push('• '+(r.time?r.time+' · ':'')+r.title));
      tmrTasks.slice(0,3).forEach(t=>lines.push('• '+t.title));
    }
    lines.push(''); let docsExp=(db.documents||[]).filter(x=>x.userId===user.id&&x.expiryDate&&x.expiryDate>=d&&x.expiryDate<=soon);if(docsExp.length){lines.push('');lines.push('📄 مدارک در حال انقضا:');docsExp.slice(0,5).forEach(x=>lines.push('• '+x.expiryDate+' — '+(x.title||'سند')));}
    lines.push('موفق باشی 💪 — /امروز برای جزئیات');
    return lines.join('\n');
  }
  // «✨» line on the Telegram morning/evening report: a short personal note written by the AI from the report
  // itself. Only with an AI key and Settings → «یادداشت هوشمند» on; 12 s budget, and the report goes out without
  // it on any failure.
  async function withAiNote(user,text,kind){
    if(!AI_PROVIDER_API_KEY||user.tgAiOn===false)return text;
    const sys=kind==='morning'?'تو دستیار شخصی اپ «هِسته» هستی. از روی برنامهٔ امروز کاربر که پایین آمده، ۲ جملهٔ کوتاه، گرم و عملی به فارسی بنویس: مهم‌ترین تمرکز امروز و یک پیشنهاد کوچک. فقط از همین داده استفاده کن؛ بدون عنوان و بدون تکرار فهرست.':'تو دستیار شخصی اپ «هِسته» هستی. از روی گزارش امروز کاربر که پایین آمده، ۲ جملهٔ کوتاه و مهربان به فارسی بنویس: یک جمع‌بندی منصفانه از روز و یک پیشنهاد برای فردا. فقط از همین داده استفاده کن؛ بدون عنوان.';
    try{const note=await Promise.race([aiComplete(sys,text,160),new Promise(r=>setTimeout(()=>r(null),12000))]);const t=String(note||'').trim();return t?text+'\n\n✨ '+t:text}catch(e){return text}
  }
  async function buildEveningReport(db,user,d){
    let lines=[];
    lines.push('🌙 گزارش شب · '+tgFmtDate(d));
    let tasks=db.tasks.filter(x=>x.userId===user.id&&x.date===d);
    let done=tasks.filter(x=>x.done), open=tasks.filter(x=>!x.done);
    lines.push('✅ کارها: '+done.length+' از '+tasks.length+(tasks.length?(' ('+Math.round(100*done.length/Math.max(1,tasks.length))+'٪)'):''));
    if(open.length){ lines.push('⬜ مانده:'); open.slice(0,8).forEach((t,i)=>lines.push('  '+(i+1)+'. '+(t.startTime?t.startTime+' · ':'')+t.title)); lines.push('تیک: /انجام 1'); }
    else if(tasks.length) lines.push('همه کارها انجام شد 🎉');
    let remsOpen=db.reminders.filter(x=>x.userId===user.id&&x.date===d&&!x.done);
    if(remsOpen.length){ lines.push('🔔 یادآوری باز:'); remsOpen.forEach(r=>lines.push('• '+(r.time?r.time+' · ':'')+r.title)); }
    let txs=db.transactions.filter(x=>x.userId===user.id&&x.date===d);
    let expense=txs.filter(x=>x.kind==='expense').reduce((n,x)=>n+x.amount,0);
    let income=txs.filter(isIncomeTx).reduce((n,x)=>n+x.amount,0);
    lines.push('💸 هزینه: '+expense.toLocaleString('fa-IR')+' ریال'+(income?(' · درآمد '+income.toLocaleString('fa-IR')):''));
    if(txs.filter(x=>x.kind==='expense').length){
      let by={}; txs.filter(x=>x.kind==='expense').forEach(x=>by[x.category||'متفرقه']=(by[x.category||'متفرقه']||0)+x.amount);
      let top=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,3);
      if(top.length) lines.push('  └ '+top.map(([c,a])=>c+' '+a.toLocaleString('fa-IR')).join(' · '));
    }
    let daily=db.daily.find(x=>x.userId===user.id&&x.date===d);
    if(daily) lines.push('🙂 حال '+(daily.mood!=null?daily.mood+'/10':'—')+(daily.sleep?(' · 😴 '+daily.sleep):''));
    else lines.push('📝 روزنگار امروز خالی است — بفرست: «حالم ۸» یا «۷ ساعت خوابیدم»');
    let workMin=db.timeEntries.filter(x=>x.userId===user.id&&x.date===d).reduce((n,x)=>n+(x.minutes||0),0);
    if(workMin) lines.push('⏱ کار ثبت‌شده: '+Math.floor(workMin/60)+'س '+(workMin%60)+'د');
    let tmr=addDaysIso(d,1);
    let tmrItems=[
      ...db.reminders.filter(x=>x.userId===user.id&&!x.done&&x.date===tmr).map(r=>'🔔 '+(r.time?r.time+' · ':'')+r.title),
      ...db.tasks.filter(x=>x.userId===user.id&&!x.done&&x.date===tmr&&!x.isReminder).map(t=>'⬜ '+t.title)
    ];
    if(tmrItems.length){ lines.push(''); lines.push('➡️ فردا:'); tmrItems.slice(0,6).forEach(x=>lines.push('• '+x)); }
    lines.push(''); lines.push('شب بخیر 🌙');
    return lines.join('\n');
  }
  function feeReminderText(st,c){let m=studentMoney(st);return 'سلام '+(st.name||'')+' عزیز 🌿\nمبلغ باقی‌ماندهٔ شهریهٔ دورهٔ «'+(c.name||'')+'» '+Math.round(m.remaining).toLocaleString('fa-IR')+' ریال است'+(st.dueDate?' و سررسید آن '+tgFmtDate(st.dueDate)+' است':'')+'.'+(c.cardNo?'\nلطفاً به کارت '+c.cardNo+(c.cardName?' به نام '+c.cardName:'')+' واریز کنید و رسید را بفرستید.':'')+'\nممنون از همراهی‌ات 🙏'}
  function waNumber(p){p=String(p||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g,'').replace(/^98/,'0').replace(/^9/,'09');return p.length>=10?'98'+p.replace(/^0/,''):''}
  function feeRemindersDue(db,user,d){let soon=addDaysIso(d,2),cs=Object.fromEntries(colOf(db,'courses').filter(x=>x.userId===user.id).map(c=>[c.id,c]));return colOf(db,'students').filter(s=>s.userId===user.id&&cs[s.courseId]&&s.status!=='withdrawn'&&s.dueDate&&s.dueDate>=d&&s.dueDate<=soon&&s.feeRemindedFor!==s.dueDate&&studentMoney(s).remaining>0).map(s=>({s,c:cs[s.courseId]}))}
  async function sendFeeReminders(db,user,d){let n=0;for(const {s,c} of feeRemindersDue(db,user,d).slice(0,10)){let m=studentMoney(s),left=Math.round((Date.parse(s.dueDate)-Date.parse(d))/864e5),wa=waNumber(s.phone),txt='🎓 سررسید شهریه '+(left===0?'امروز':left===1?'فردا':'۲ روز دیگر')+'\n'+(s.name||'')+' · «'+(c.name||'')+'»\nمانده: '+fmtShortRial(m.remaining)+' · '+tgFmtDate(s.dueDate)+(wa?'':'\n(شماره ندارد)'),kb=wa?{reply_markup:{inline_keyboard:[[{text:'💬 پیام واتساپ به '+(s.name||'دانشجو'),url:'https://wa.me/'+wa+'?text='+encodeURIComponent(feeReminderText(s,c))}]]}}:{};let r=await tgSend(user.telegramUserId,txt,kb);if(r&&r.ok){s.feeRemindedFor=s.dueDate;n++}}return n}
  function buildCoursesMonthly(db,user,jy,jm){let from=jalaliToGregorianIso(jy,jm,1),nm=jm===12?[jy+1,1]:[jy,jm+1],to=addDaysIso(jalaliToGregorianIso(nm[0],nm[1],1),-1),now=today();let cs=colOf(db,'courses').filter(c=>c.userId===user.id),sts=colOf(db,'students').filter(s=>s.userId===user.id);let rows=[],T={got:0,rem:0,owe:0};for(const c of cs){let list=sts.filter(s=>s.courseId===c.id),act=list.filter(s=>s.status!=='withdrawn');let got=0;for(const s of list)for(const p of s.payments||[])if(p.date>=from&&p.date<=to)got+=(p.kind==='refund'?-1:1)*(Number(p.amount)||0);let owing=act.map(s=>({s,m:studentMoney(s)})).filter(o=>o.m.remaining>0).sort((a,b)=>b.m.remaining-a.m.remaining),rem=owing.reduce((n,o)=>n+o.m.remaining,0);let held=courseSessions(c).filter(x=>x.date>=from&&x.date<=to&&x.date<=now),marks=0;for(const x of held)marks+=act.filter(s=>(s.attendance||[]).includes(x.n)).length;if(c.status==='done'&&!got&&!rem)continue;if(!act.length&&!got)continue;T.got+=got;T.rem+=rem;T.owe+=owing.length;let L=['🎓 '+(c.name||'دوره')+' · '+act.length.toLocaleString('fa-IR')+' دانشجو','  💰 دریافتی این ماه: '+fmtShortRial(got),'  ⏳ مانده: '+(rem?fmtShortRial(rem)+' · '+owing.length.toLocaleString('fa-IR')+' بدهکار':'همه تسویه ✅')];if(owing.length)L.push('  '+owing.slice(0,3).map(o=>(o.s.name||'')+' '+fmtShortRial(o.m.remaining)+(o.s.dueDate&&o.s.dueDate<now?' ⛔':'')).join('، ')+(owing.length>3?' …':''));if(held.length&&act.length)L.push('  🙋 حضور: '+Math.round(marks/(held.length*act.length)*100).toLocaleString('fa-IR')+'٪ در '+held.length.toLocaleString('fa-IR')+' جلسه');rows.push(L.join('\n'))}if(!rows.length)return '';return ['📚 گزارش ماهانهٔ دوره‌ها · '+J_MONTHS[jm-1]+' '+jy.toLocaleString('fa-IR',{useGrouping:false}),'','💰 دریافتی کل: '+fmtShortRial(T.got)+'  ·  ⏳ مانده: '+fmtShortRial(T.rem)+(T.owe?' ('+T.owe.toLocaleString('fa-IR')+' نفر)':''),'',rows.join('\n\n')].join('\n')}
  async function vocabRead(uid){try{let r=await env.DB.prepare("SELECT value FROM kv WHERE key=?").bind('vocab:'+uid).first();return r?JSON.parse(r.value):null}catch(e){return null}}
  async function vocabWrite(uid,state){await env.DB.prepare("INSERT INTO kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind('vocab:'+uid,JSON.stringify(state),Date.now()).run()}
  function vocabSummary(st,d,now){if(!st||!st.cards)return null;now=now||Date.now();let cards=Object.values(st.cards),days=st.days||{},dn=Number((st.settings||{}).dailyNew)||15,t=days[d]||{r:0,n:0};let streak=0,x=days[d]&&(days[d].r||days[d].n)?d:addDaysIso(d,-1);while(days[x]&&(days[x].r||days[x].n)){streak++;x=addDaysIso(x,-1)}let week={r:0,n:0},last=[];for(let i=13;i>=0;i--){let k=addDaysIso(d,-i),v=days[k]||{r:0,n:0};if(i<7){week.r+=v.r||0;week.n+=v.n||0}last.push({date:k,r:v.r||0,n:v.n||0})}return{due:cards.filter(c=>c.b&&c.due<=now).length,newLeft:Math.max(0,dn-(t.n||0)),dailyNew:dn,learning:cards.filter(c=>c.b>0&&c.b<6).length,mastered:cards.filter(c=>c.b>=6).length,started:cards.length,today:{r:t.r||0,n:t.n||0},streak,week,days:last,quiz:st.quiz||null}}
  let VOCAB_WORDS=null;
  async function vocabWords(){if(VOCAB_WORDS)return VOCAB_WORDS;try{let r=await env.ASSETS.fetch(new Request('https://assets.local/vocab/words.json'));if(!r.ok)return null;VOCAB_WORDS=await r.json();return VOCAB_WORDS}catch(e){return null}}
  // a random card the user found hard («نمی‌دانستم»/«سخت بود», not yet mastered); null when there is none yet
  async function hardWord(st){let cards=st&&st.cards?Object.entries(st.cards).filter(([,c])=>c&&c.bad>0&&(c.b||0)<6):[];if(!cards.length)return null;let rows=await vocabWords();if(!rows||!rows.length)return null;let idx=new Map(rows.map(r=>[r[0],r]));cards=cards.filter(([w])=>idx.has(w));if(!cards.length)return null;let [w,c]=cards[Math.floor(Math.random()*cards.length)],r=idx.get(w);return{w,fa:(r[1]||[]).slice(0,2).join('، '),p:r[4]||'',e:r[6]||'',ef:r[9]||'',bad:c.bad||0,total:cards.length}}
  // morning extra: one random hard word as its own message, with a «یاد گرفتم» button (callback vl:<word>)
  async function tgSendHardWord(user){if(user.modules&&user.modules.vocab===false)return null;let hw=await hardWord(await vocabRead(user.id));if(!hw)return null;return tgSend(user.telegramUserId,'🧠 واژهٔ سخت: '+hw.w+(hw.p?' '+hw.p:'')+' — '+hw.fa+(hw.e?'\n   «'+hw.e+'»'+(hw.ef?'\n   '+hw.ef:''):''),{reply_markup:{inline_keyboard:[[{text:'✅ یاد گرفتم',callback_data:('vl:'+hw.w).slice(0,64)}]]}})}
  // mark a word as learned: top box, due far away, no longer «hard»
  async function vocabLearn(uid,w){let st=await vocabRead(uid);if(!st||!st.cards||!st.cards[w])return false;let c=st.cards[w];c.b=6;c.bad=0;c.good=(c.good||0)+1;c.last=Date.now();c.due=Date.now()+180*864e5;st.savedAt=Date.now();await vocabWrite(uid,st);return true}
  async function wordOfDay(uid,d,st){let rows=await vocabWords();if(!rows||!rows.length)return null;let pool=rows.filter(r=>r[8]<6.4&&['B1','B2','C1'].includes(r[3])&&r[6]&&(r[1]||[]).length&&!(st&&st.cards&&st.cards[r[0]]&&st.cards[r[0]].b>=6));if(!pool.length)return null;let h=0;for(const ch of d+uid)h=(h*31+ch.charCodeAt(0))>>>0;let r=pool[h%pool.length];return{w:r[0],fa:(r[1]||[]).slice(0,2).join('، '),p:r[4]||'',e:r[6]||'',ef:r[9]||''}}
  async function tgCheckReports(db){
    if(!TELEGRAM_BOT_TOKEN)return false;
    let d=today(), changed=false, hh=tehranHourNow();
    db.reminders??=[]; db.tasks??=[];
    for(const user of db.users){
      if(!user.telegramUserId)continue;
      let morningH=user.tgMorningHour!=null?Number(user.tgMorningHour):9;
      let eveningH=user.tgEveningHour!=null?Number(user.tgEveningHour):23;
      if(user.tgReports===false)continue;
      if(hh===morningH&&user.tgMorningOn!==false&&user.tgLastMorning!==d){
        let text=await withAiNote(user,await buildMorningBrief(db,user,d,await fetchTehranWeatherBrief(user.weather)),'morning');
        let r=await tgSend(user.telegramUserId,text,{reply_markup:tgMainKeyboard()});
        if(r&&r.ok){user.tgLastMorning=d; changed=true; await tgSendHardWord(user)}
      }
      let jp=jParts(d);
      if(jp&&jp.jd===1&&hh===morningH&&user.tgMonthlyOn!==false){let pm=jp.jm===1?[jp.jy-1,12]:[jp.jy,jp.jm-1],key=pm[0]+'-'+pm[1];if(user.tgLastMonthly!==key){let r=await tgSend(user.telegramUserId,buildMonthlyReport(db,user,pm[0],pm[1]));if(r&&r.ok){user.tgLastMonthly=key;changed=true}}}
      if(jp&&jp.jd===1&&hh===morningH&&user.tgCoursesMonthlyOn!==false){let pm=jp.jm===1?[jp.jy-1,12]:[jp.jy,jp.jm-1],key=pm[0]+'-'+pm[1];if(user.tgLastCoursesMonthly!==key){let t=buildCoursesMonthly(db,user,pm[0],pm[1]);if(!t){user.tgLastCoursesMonthly=key;changed=true}else{let r=await tgSend(user.telegramUserId,t);if(r&&r.ok){user.tgLastCoursesMonthly=key;changed=true}}}}
      if(hh>=morningH&&user.tgFeeRemindOn!==false&&user.tgLastFeeCheck!==d){user.tgLastFeeCheck=d;changed=true;await sendFeeReminders(db,user,d)}
      let wd=new Date(d+'T12:00:00Z').getUTCDay();
      if(wd===5&&hh===eveningH&&user.tgWeeklyOn!==false&&user.tgLastWeekly!==d){let r=await tgSend(user.telegramUserId,buildWeeklyReport(db,user,d));if(r&&r.ok){user.tgLastWeekly=d;changed=true}}
      if(wd===5&&hh===eveningH&&user.tgProjectsOn!==false&&user.tgLastProjects!==d){let t=buildProjectsWeekly(db,user,d);if(!t){user.tgLastProjects=d;changed=true}else{let r=await tgSend(user.telegramUserId,t);if(r&&r.ok){user.tgLastProjects=d;changed=true}}}
      if(hh===eveningH&&user.tgEveningOn!==false&&user.tgLastEvening!==d){
        let text=await withAiNote(user,await buildEveningReport(db,user,d),'evening');
        let r=await tgSend(user.telegramUserId,text,{reply_markup:tgMainKeyboard()});
        if(r&&r.ok){user.tgLastEvening=d; changed=true}
      }
    }
    return changed;
  }

  async function refreshPricesAndAlerts(db){let changed=await refreshAllCryptoPrices(db).catch(()=>false);if(await refreshTsePrices(db).catch(()=>false))changed=true;let now=Date.now();for(const user of db.users){let holdings=computeHoldings(db,user.id);for(const t of evaluateAlerts(db,user.id,holdings)){let a=t.alert;if(!a.lastNotifiedAt||now-a.lastNotifiedAt>6*3600*1000){a.lastNotifiedAt=now;changed=true;if(TELEGRAM_BOT_TOKEN&&user.telegramUserId)await tgSend(user.telegramUserId,'🔔 '+t.text)}}}return changed}

  return { read, write, json, body, cookie, sidCookie, hash, id, randHex, timingSafeEqualHex, b64, bytesFromBase64, textFromBase64, today, AuthError, auth, me, accountBalances, bankSmsAccount,
    jalaliToGregorianIso, jalaliDateLabel, parseCsvRows, findBankHeaderRow, bankColIndex, parseBankAmount, parseBankStatementRows,
    filterTransactions, csvEscape, advanceRecurringTransactions, enNum, addDaysIso, parsePersianAmount, extractAmountFromText, extractDateFromText, extractTimeFromText, parseLifeText, applyParsedActions, normTitle, applySeriesAction, parseBingersLibrary, parseBingersWatches, fetchTvMazeNextEpisode, mapConcurrent, aiComplete, aiExtractActions, pearson, correlationLabel, seasonStatsFromEpisodes, seasonTotAired, fetchTvMazeShowFull, progressFromShow, ensureSeriesTvMazeData, clampEpisodeAgainstSeason,
    parseSleepHours, suggestCategoryKeyword, catKey, catKeyGeneric, learnedCategory, isIncomeTx, stripBalanceNotes, stripRefNumbers, matchBankStatementItems, ensureStatementReminder, betRollup, betAutoStart, betLatest, betDaysOf, normalizeCategoryName, categorizeTransaction, decodeXmlEntities, extractTag, extractAttr, parseFeed, isMostlyLatin, textSimilarityScore, syncOneNewsSource, syncAllNewsSources, periodRange, computeGoalProgress, nextAnnualOccurrence, rapidApiGet, apiFootballFetch, FREE_LEAGUES, ESPN_LEAGUE_IDS, fetchEspnScoreboard, fetchTheSportsDb, fetchFreeLeagueDay, mapEspnEvent, mapTheSportsDbEvent, fetchVarzesh3Livescore, mapEspnStandings, mapTsdbStandings, fetchVarzesh3LeaguePage, parseVarzesh3Standings, fetchFreeLeagueStandings, fetchFreeLeagueRange, cachedLeagueRange, withAiNote, xbetGet, sofaGet, assetCurrency, fetchCryptoPriceUsd, fetchStockPriceUsd, fetchUsStocksQuote,
    discoverFeed, extractArticle, parseBrokerOrders,recordDailyClose,fixDepositTransfers,translateToFa, fetchTsePrice, refreshTsePrices, tseMarketOpen, refreshAllCryptoPrices, computeHoldings, portfolioTotals, evaluateAlerts, checkRateLimit, clearRateLimit, clientIp, hashPin, genLinkCode, tgApi, tgSend, tgSendDocument, redactForBackup, userSnapshot, backupDbToTelegram, buildProjectsWeekly, funCheck, funMonth, isAdmin, adminOverview, studentMoney, courseDues, projectDues, courseSessions, buildCoursesMonthly, feeRemindersDue, sendFeeReminders, vocabRead, vocabWrite, vocabSummary, wordOfDay, hardWord, tgSendHardWord, vocabLearn, handleTelegramMessage, tgCheckReports, COLS, colOf, cleanItem, shopList, shopAdd, lifeDueLines, checkReminderNotifications, handleTelegramCallback, reminderAct, sendWebPush, vapidKeys, notifyUser, fetchTehranWeatherBrief, buildMorningBrief, buildMonthlyReport, buildWeeklyReport, monthStats, recurringList, nextRecurDate, jParts, buildEveningReport, tehranHourNow, refreshPricesAndAlerts,
    googleCalendarConfigured, googleCalendarStateCookie, googleCalendarErrorMessage, googleCalendarAuthUrl, exchangeGoogleCalendarCode, googleCalendarAccount, syncGoogleCalendar, calendarFeed, syncAllGoogleCalendars, GOOGLE_CALENDAR_SCOPES,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_CALENDAR_REDIRECT_URI, API_FOOTBALL_KEY, TMDB_API_KEY, TELEGRAM_BOT_TOKEN,
    SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI, YOUTUBE_REDIRECT_URI, AI_PROVIDER_API_KEY: AI_PROVIDER_API_KEY || (env.AI ? 'workers-ai' : ''), AI_MODEL, RAPIDAPI_KEY, STOCK_API_KEY };
}
