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

  // Header weather — markup lives in each page's header; this only fills in the
  // icon + temperature from Open-Meteo (same source as the standalone
  // weather.html embed used on the Carrd site). Refreshes every 10 minutes.
  (function(){
    var iconEl = document.getElementById('vrWeatherIcon');
    var tempEl = document.getElementById('vrWeatherTemp');
    if (!iconEl || !tempEl) return;
    var W = CFG.weather || {};
    var lat = W.lat != null ? W.lat : 13.17, lon = W.lon != null ? W.lon : -59.58;
    var tz = W.timezone || 'America/Barbados';
    var unit = W.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    var sym = unit === 'fahrenheit' ? '°F' : '°C';
    tempEl.textContent = '--' + sym;

    var CLOUD = '<path d="M10 34 Q10 26 18 26 Q20 18 30 20 Q38 20 38 28 Q44 28 44 34 Q44 42 36 42 H18 Q10 42 10 34Z" fill="#111"/>';
    var CLOUD_HI = '<path d="M10 30 Q10 22 18 22 Q20 14 30 16 Q38 16 38 24 Q44 24 44 30 Q44 37 36 37 H18 Q10 37 10 30Z" fill="#111"/>';
    var ICONS = {
      sun: '<circle cx="28" cy="28" r="10" fill="#111"/><g stroke="#111" stroke-width="2.2" stroke-linecap="round"><line x1="28" y1="6" x2="28" y2="12"/><line x1="28" y1="44" x2="28" y2="50"/><line x1="6" y1="28" x2="12" y2="28"/><line x1="44" y1="28" x2="50" y2="28"/><line x1="12.7" y1="12.7" x2="16.8" y2="16.8"/><line x1="39.2" y1="39.2" x2="43.3" y2="43.3"/><line x1="43.3" y1="12.7" x2="39.2" y2="16.8"/><line x1="16.8" y1="39.2" x2="12.7" y2="43.3"/></g>',
      partly: '<circle cx="22" cy="22" r="10" fill="#111" opacity=".2"/><g stroke="#111" stroke-width="1.8" stroke-linecap="round" opacity=".28"><line x1="22" y1="7" x2="22" y2="11"/><line x1="7" y1="22" x2="11" y2="22"/><line x1="11.5" y1="11.5" x2="14.3" y2="14.3"/><line x1="33.7" y1="11.5" x2="30.9" y2="14.3"/></g>' + CLOUD,
      cloud: CLOUD,
      drizzle: CLOUD_HI + '<g stroke="#111" stroke-width="2" stroke-linecap="round"><line x1="20" y1="42" x2="17" y2="50"/><line x1="28" y1="42" x2="25" y2="50"/><line x1="36" y1="42" x2="33" y2="50"/></g>',
      rain: CLOUD_HI + '<g stroke="#111" stroke-width="2.5" stroke-linecap="round"><line x1="19" y1="42" x2="15" y2="53"/><line x1="28" y1="42" x2="24" y2="53"/><line x1="37" y1="42" x2="33" y2="53"/></g>',
      thunder: '<path d="M10 28 Q10 20 18 20 Q20 12 30 14 Q38 14 38 22 Q44 22 44 28 Q44 35 36 35 H18 Q10 35 10 28Z" fill="#111"/><polygon points="32,35 24,46 29,46 25,55 37,40 32,40" fill="#111"/>',
      snow: CLOUD_HI + '<g stroke="#111" stroke-width="2.5" stroke-linecap="round"><line x1="20" y1="43" x2="20" y2="50"/><line x1="17" y1="46.5" x2="23" y2="46.5"/><line x1="28" y1="43" x2="28" y2="50"/><line x1="25" y1="46.5" x2="31" y2="46.5"/><line x1="36" y1="43" x2="36" y2="50"/><line x1="33" y1="46.5" x2="39" y2="46.5"/></g>',
      showers: '<path d="M10 34 Q10 26 18 26 Q20 18 30 20 Q38 20 38 28 Q44 28 44 34 Q44 42 36 42 H18 Q10 42 10 34Z" fill="#111" opacity=".18"/><path d="M16 38 Q16 32 22 32 Q24 26 32 28 Q38 28 38 34 Q42 34 42 38 Q42 44 36 44 H22 Q16 44 16 38Z" fill="#111"/><g stroke="#111" stroke-width="2" stroke-linecap="round"><line x1="22" y1="48" x2="20" y2="54"/><line x1="29" y1="48" x2="27" y2="54"/><line x1="36" y1="48" x2="34" y2="54"/></g>'
    };
    function iconFor(code){
      if (code === 0) return 'sun';
      if (code <= 2) return 'partly';
      if (code <= 49) return 'cloud';
      if (code <= 55) return 'drizzle';
      if (code <= 65) return 'rain';
      if (code <= 77) return 'snow';
      if (code <= 82) return 'showers';
      if (code <= 86) return 'snow';
      if (code <= 99) return 'thunder';
      return 'cloud';
    }
    function load(){
      var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,weather_code&temperature_unit=' + unit + '&timezone=' + encodeURIComponent(tz);
      fetch(url).then(function(r){ return r.json(); }).then(function(d){
        var c = d && d.current;
        if (!c || c.temperature_2m == null) return;
        iconEl.innerHTML = '<svg viewBox="0 0 56 56" fill="none">' + ICONS[iconFor(c.weather_code)] + '</svg>';
        tempEl.textContent = Math.round(c.temperature_2m) + sym;
      }).catch(function(){});
    }
    load();
    setInterval(load, 10 * 60 * 1000);
  })();

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
