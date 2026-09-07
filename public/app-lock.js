/*! lifeos app lock */
(function(){
  if(window.__lifeosLock)return; window.__lifeosLock=1;
  var KEY='lifeos-pin-unlocked';
  function unlocked(){try{return sessionStorage.getItem(KEY)==='1'}catch(e){return false}}
  function setUnlocked(){try{sessionStorage.setItem(KEY,'1')}catch(e){}}
  function el(tag,css,html){var n=document.createElement(tag);if(css)n.style.cssText=css;if(html!=null)n.innerHTML=html;return n}
  function showLock(){
    if(document.getElementById('lifeosPinLock'))return;
    var ov=el('div','position:fixed;inset:0;z-index:99999;background:rgba(6,10,18,.92);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)');
    ov.id='lifeosPinLock';
    ov.innerHTML='<div style="width:min(340px,92vw);background:var(--panel,#141a24);border:1.5px solid var(--border2,rgba(255,255,255,.1));border-radius:22px;padding:28px 22px;text-align:center;font-family:inherit;color:var(--text,#e8eef7)">'+
      '<div style="font-size:36px;margin-bottom:8px">🔐</div>'+
      '<div style="font-weight:800;font-size:20px;margin-bottom:6px">قفل lifeos</div>'+
      '<div style="color:var(--muted,#9aa6b2);font-size:13.5px;margin-bottom:16px;line-height:1.6">PIN خودت را وارد کن</div>'+
      '<input id="lifeosPinIn" type="password" inputmode="numeric" maxlength="8" autocomplete="one-time-code" placeholder="••••" style="width:100%;text-align:center;letter-spacing:.3em;font-size:22px;padding:12px;border-radius:14px;border:1.5px solid var(--border,rgba(255,255,255,.12));background:var(--panel2,#0d121a);color:inherit;font-family:inherit;margin-bottom:12px">'+
      '<button id="lifeosPinGo" type="button" style="width:100%;padding:12px;border:none;border-radius:14px;background:var(--acc,#22d3ee);color:#062028;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit">باز کردن</button>'+
      '<div id="lifeosPinErr" style="color:var(--bad,#f87171);font-size:13px;margin-top:10px;min-height:18px"></div>'+
      '</div>';
    document.body.appendChild(ov);
    var inp=document.getElementById('lifeosPinIn');
    var go=document.getElementById('lifeosPinGo');
    var err=document.getElementById('lifeosPinErr');
    function tryUnlock(){
      var pin=(inp.value||'').replace(/\D/g,'');
      if(pin.length<4){err.textContent='PIN را کامل وارد کن';return}
      go.disabled=true;err.textContent='…';
      fetch('/api/security/pin/verify',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin})})
        .then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j}})})
        .then(function(x){
          if(!x.ok){err.textContent=(x.j&&x.j.error)||'نادرست';go.disabled=false;inp.value='';inp.focus();return}
          setUnlocked();ov.remove();
        }).catch(function(){err.textContent='خطای شبکه';go.disabled=false});
    }
    go.onclick=tryUnlock;
    inp.addEventListener('keydown',function(e){if(e.key==='Enter')tryUnlock()});
    setTimeout(function(){try{inp.focus()}catch(e){}},100);
  }
  function boot(){
    if(unlocked())return;
    // login page skip
    if(/login-page/.test(location.pathname))return;
    fetch('/api/me',{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(d){
      if(!d||!d.user)return;
      if(!d.user.pinEnabled)return;
      showLock();
    }).catch(function(){});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
