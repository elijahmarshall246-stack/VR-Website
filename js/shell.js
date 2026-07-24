(function(){
  var CFG = window.VR_CONFIG || {};
  var LINKS = CFG.links || {};
  var MAIN = LINKS.mainSite || 'https://vaucluseraceway.com';

  var footerEl = document.getElementById('vrFooter');
  if (footerEl){
    footerEl.className = 'vr-footer';
    footerEl.innerHTML =
      '<div class="vr-footer__bar"><div class="vr-container vr-footer__bar-grid">'+
        '<p class="vr-footer__credit">Site Designed and Developed By <a href="https://www.emdesignsbb.com" target="_blank" rel="noopener">EMDesigns</a></p>'+
        '<ul class="vr-footer__links">'+
          '<li><a href="'+MAIN+'/#home">Home</a></li>'+
          '<li><a href="'+MAIN+'/#about">About</a></li>'+
          '<li><a href="'+MAIN+'/#bimmacup">BimmaCup</a></li>'+
          '<li><a href="'+MAIN+'/#contact">Contact</a></li>'+
        '</ul>'+
        '<div class="vr-footer__copy">© <span id="vrYear"></span> Vaucluse Raceway Motorsport Club | All Rights Reserved</div>'+
      '</div></div>';
  }

  var y = document.getElementById('vrYear');
  if (y) y.textContent = new Date().getFullYear();

  (function(){
    var EV = (CFG.live && CFG.live.events) || {};
    var noLive = document.getElementById('vrNoLive');
    var liveBoard = document.getElementById('vrLiveBoard');
    var liveLoading = document.getElementById('vrLiveLoading');
    var onIndex = !!liveBoard;
    var _seq = 0;

    function cv(c){ return c ? (c.f!=null ? c.f : (c.v!=null ? String(c.v) : '')) : ''; }
    function fetchRows(cb){
      if (!EV.sheetId){ cb(null); return; }
      var base='https://docs.google.com/spreadsheets/d/'+EV.sheetId+'/gviz/tq?gid='+(EV.gid||'0')+'&headers=0';
      var cbName='__vrLiveCb'+(++_seq);
      var s=document.createElement('script');
      window[cbName]=function(resp){ delete window[cbName]; s.remove(); cb(resp&&resp.status==='ok'?((resp.table&&resp.table.rows)||[]):null); };
      s.onerror=function(){ delete window[cbName]; s.remove(); cb(null); };
      s.src=base+'&tqx=out:json;responseHandler:'+cbName;
      document.head.appendChild(s);
    }
    function isLiveFrom(rows){
      if (!rows || !rows.length) return false;
      var hdr=(rows[0].c||[]).map(function(c){ return String(cv(c)).trim().toLowerCase(); });
      var li=hdr.indexOf('live'), ti=hdr.indexOf('type');
      if (li<0) return false;
      for (var r=1;r<rows.length;r++){
        var c=rows[r].c||[];
        var live=String(cv(c[li])).trim().toLowerCase()==='yes';
        var rally=ti>=0 && String(cv(c[ti])).trim().toLowerCase()==='rallysprint';
        if (live && rally) return true;
      }
      return false;
    }
    function apply(isLive){
      document.body.classList.toggle('vr-live', isLive);
      if (!onIndex) return;
      if (liveLoading) liveLoading.classList.remove('is-on');
      if (isLive){ if (noLive) noLive.classList.remove('is-on'); liveBoard.style.display=''; }
      else { liveBoard.style.display='none'; if (noLive) noLive.classList.add('is-on'); }
    }
    function poll(){ fetchRows(function(rows){ apply(rows===null ? false : isLiveFrom(rows)); }); }
    poll();
    setInterval(poll, 30000);
  })();

  // Section-nav dropdowns (Stats → Stats / Drivers). Hover handles pointer users
  // via CSS; this adds click-toggle for touch and Escape-to-close for keyboards.
  Array.prototype.forEach.call(document.querySelectorAll('[data-navdrop]'), function(drop){
    var trigger = drop.querySelector('.vr-navdrop__trigger');
    if (!trigger) return;
    function close(){ drop.classList.remove('is-open'); trigger.setAttribute('aria-expanded','false'); }
    trigger.addEventListener('click', function(e){
      e.preventDefault();
      var open = drop.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    drop.addEventListener('keydown', function(e){
      if (e.key === 'Escape'){ close(); trigger.focus(); }
    });
    document.addEventListener('click', function(e){
      if (!drop.contains(e.target)) close();
    });
  });

  var btn  = document.getElementById('hamburger-btn');
  var menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;

  function setOpen(open){
    btn.classList.toggle('open', open);
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  window.addEventListener('scroll', function(){
    if (window.scrollY > 120){ btn.classList.add('scrolled-away'); setOpen(false); }
    else { btn.classList.remove('scrolled-away'); }
  });
  btn.addEventListener('click', function(){ setOpen(!menu.classList.contains('open')); });
  menu.querySelectorAll('a').forEach(function(link){ link.addEventListener('click', function(){ setOpen(false); }); });
  document.addEventListener('click', function(e){
    if (menu.classList.contains('open') && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)){ setOpen(false); }
  });
})();
