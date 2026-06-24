(function(){
  var CFG = (window.VR_CONFIG && window.VR_CONFIG.live && window.VR_CONFIG.live.classFilter) || {};
  var bar = document.getElementById('vrClassFilter');
  if (!bar) return;
  if (!CFG.enabled || !CFG.gid){ return; }

  var sheetId   = (window.VR_CONFIG.live && window.VR_CONFIG.live.sheetId) || '';
  var driverToClass = {};
  var activeClass = '__all';
  var _seq = 0;

  function norm(s){ return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase(); }

  function colIndex(v){
    if (typeof v === 'number') return v;
    var s = String(v).trim();
    if (/^[A-Za-z]+$/.test(s)){
      var n = 0; s = s.toUpperCase();
      for (var i=0;i<s.length;i++) n = n*26 + (s.charCodeAt(i)-64);
      return n - 1;
    }
    var p = parseInt(s,10); return isNaN(p) ? 0 : p;
  }

  function gvizRows(cb){
    var base = 'https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq?gid=' + CFG.gid +
               '&headers=0' + (CFG.range ? '&range=' + encodeURIComponent(CFG.range) : '');
    var cbName = '__vrClassCb' + (++_seq);
    var s = document.createElement('script');
    window[cbName] = function(resp){
      delete window[cbName]; s.remove();
      cb(resp && resp.status === 'ok' ? ((resp.table && resp.table.rows) || []) : null);
    };
    s.onerror = function(){ delete window[cbName]; s.remove(); cb(null); };
    s.src = base + '&tqx=out:json;responseHandler:' + cbName;
    document.head.appendChild(s);
  }
  var cellVal = function(c){ return c ? (c.f != null ? c.f : (c.v != null ? String(c.v) : '')) : ''; };

  function buildChips(classes){
    var html = '<span class="vr-filterlabel">Filter:</span>';
    html += '<button class="vr-chip is-active" data-class="__all">' +
            (CFG.allLabel || 'All') + '</button>';
    classes.forEach(function(c){
      html += '<button class="vr-chip" data-class="' + c.replace(/"/g,'&quot;') + '">' + c + '</button>';
    });
    bar.innerHTML = html;
    bar.classList.add('is-on');
    var chips = bar.querySelectorAll('.vr-chip');
    Array.prototype.forEach.call(chips, function(btn){
      btn.addEventListener('click', function(){
        activeClass = btn.dataset.class;
        Array.prototype.forEach.call(chips, function(b){
          b.classList.toggle('is-active', b === btn);
        });
        applyFilter();
      });
    });
  }

  function classOf(driver){ return driverToClass[norm(driver)] || ''; }

  function stampClasses(){
    document.querySelectorAll('#lbList .lb__row').forEach(function(row){
      var nameEl = row.querySelector('.lb__name'); if (!nameEl) return;
      var holder = nameEl.parentNode;  // the min-width:0 wrapper under .lb__who
      var cls = classOf(nameEl.textContent);
      var tag = holder.querySelector('.lb__rowclass');
      if (cls){
        if (!tag){ tag = document.createElement('span'); tag.className = 'lb__rowclass'; holder.appendChild(tag); }
        if (tag.textContent !== cls) tag.textContent = cls;
      } else if (tag){ tag.remove(); }
    });
  }

  function matches(driver){
    if (activeClass === '__all') return true;
    return driverToClass[norm(driver)] === activeClass;
  }
  function applyFilter(){
    document.querySelectorAll('#lbList .lb__row').forEach(function(row){
      var nameEl = row.querySelector('.lb__name');
      row.style.display = matches(nameEl ? nameEl.textContent : '') ? '' : 'none';
    });
    document.querySelectorAll('#lbHeatGrid .lb__hentry').forEach(function(ent){
      var nameEl = ent.querySelector('.lb__hdrv');
      ent.style.display = matches(nameEl ? nameEl.textContent : '') ? '' : 'none';
    });
  }

  function watch(){
    var targets = ['lbList','lbHeatGrid'].map(function(id){ return document.getElementById(id); }).filter(Boolean);
    if (!targets.length) return;
    var pending = false, obs;
    function connect(){ targets.forEach(function(t){ obs.observe(t, {childList:true, subtree:true}); }); }
    function run(){ pending = false; obs.disconnect(); stampClasses(); if (activeClass !== '__all') applyFilter(); connect(); }
    obs = new MutationObserver(function(){ if (pending) return; pending = true; requestAnimationFrame(run); });
    connect();
    run();
  }

  gvizRows(function(rows){
    if (!rows || !rows.length){ return; }
    var dIdx = colIndex(CFG.driverColumn), cIdx = colIndex(CFG.classColumn);
    var classSet = [];
    rows.forEach(function(r){
      var cells = r.c || [];
      var driver = String(cellVal(cells[dIdx])).trim();
      var cls    = String(cellVal(cells[cIdx])).trim();
      if (!driver || !cls) return;
      if (/^class(es)?$/i.test(cls) || /^(category|categories)$/i.test(cls) ||
          /^driver(\s*name)?$/i.test(driver) || /^name$/i.test(driver)) return;
      driverToClass[norm(driver)] = cls;
      if (classSet.indexOf(cls) === -1) classSet.push(cls);
    });
    if (!classSet.length){ return; }
    classSet.sort(function(a,b){ return a.localeCompare(b); });
    buildChips(classSet);
    watch();
  });
})();
