(function(){
  var VRR  = window.VRResults;
  var VRDS = window.VRDriverStats;

  var TOP_N = 5;            // rows shown in each leaderboard

  // Categories to report, chosen from the dropdown. Categories with no events
  // yet render a "coming soon" state.
  var DISCIPLINES = (VRR && VRR.DISCIPLINES) || [];

  var el = function(id){ return document.getElementById(id); };
  var loading = el('vrStatsLoading'), error = el('vrStatsError'),
      content = el('vrStatsContent'), body = el('vrStatsBody'), progress = el('vrStatsProgress');

  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }

  // Only these classes are shown; historical/misspelled labels are aliased in,
  // and anything not listed is excluded from the class stats entirely.
  var CLASS_ALIASES = {
    bimmacup:    'BimmaCup',
    bimmacupjr:  'BimmaCup Jr.',
    bcjunior:    'BimmaCup Jr.',   // 2023 spelling
    touring:     'Touring',
    awd:         'AWD',
    modified4wd: 'AWD',            // 2021 spelling
  };
  var CLASS_ORDER = ['BimmaCup','BimmaCup Jr.','Touring','AWD'];
  function canonClass(raw){ return raw ? (CLASS_ALIASES[VRR.norm(raw)] || null) : null; }
  function classSort(a,b){ var ia=CLASS_ORDER.indexOf(a), ib=CLASS_ORDER.indexOf(b);
    return (ia<0?99:ia)-(ib<0?99:ib) || a.localeCompare(b); }

  // Real competitor label for a bracket slot, or '' for a bye/TBD/empty slot.
  function slotName(slot){
    if(!slot) return '';
    var label=slot.driver||slot.car||'';
    if(!label || /^(bye|tbd|\?|—|-)$/i.test(label.trim()) || VRR.isErrText(label)) return '';
    return label;
  }

  function showOnly(which){
    loading.classList.toggle('is-on', which==='loading');
    error.classList.toggle('is-on',  which==='error');
    content.style.display = which==='content' ? '' : 'none';
  }

  // ---- Aggregation ----------------------------------------------------------
  function computeStats(evs){
    var names={};                               // driver key -> display name
    function nm(d){ var k=VRR.driverKey(d); if(k) names[k]=VRR.betterName(names[k], d); return k; }

    var fastest=null, fastestByClass={};
    var wins={}, podiums={}, classTitles={}, years={};

    evs.forEach(function(ev){
      var P = ev.parsed || {};
      if(ev.year) years[ev.year]=1;
      var clsOf={};                               // driver key -> class from qualifying

      // Lap records come from every timed run of the day — qualifying heats and
      // knockout runs alike — so a record set in a bracket still counts.
      function record(ms, driver, canon){
        if(ms==null) return;
        var k=nm(driver);                         // registers the best spelling
        if(!fastest || ms<fastest.ms) fastest={ms:ms,key:k,driver:driver,event:ev.name,date:ev.date,cls:canon};
        if(canon && (!fastestByClass[canon] || ms<fastestByClass[canon].ms)) fastestByClass[canon]={ms:ms,key:k,driver:driver,event:ev.name,date:ev.date};
      }

      (P.overall||[]).forEach(function(d){
        if(!d.driver) return;
        var k=nm(d.driver);                       // registers the best spelling
        if(d['class'] && !clsOf[k]) clsOf[k]=d['class'];
        record(d.ms, d.driver, canonClass(d['class']));
      });

      (P.knockouts||[]).forEach(function(ko){
        // The bracket usually names its own class; fall back to the driver's
        // qualifying class for a bracket titled something we don't recognise.
        var koCls=canonClass(ko.name);
        VRR.koRuns(ko).forEach(function(r){
          record(r.ms, r.driver, koCls || canonClass(clsOf[VRR.driverKey(r.driver)]));
        });

        var res=VRR.finalResult(ko); if(!res) return;
        var wLabel=slotName(res.winner); if(!wLabel) return;   // undecided/placeholder final → skip
        var wk=nm(wLabel);
        wins[wk]=(wins[wk]||0)+1;
        podiums[wk]=(podiums[wk]||0)+1;
        if(koCls){ classTitles[koCls]=classTitles[koCls]||{}; classTitles[koCls][wk]=(classTitles[koCls][wk]||0)+1; }
        var ru=slotName(res.runnerUp);
        if(ru){ podiums[nm(ru)]=(podiums[nm(ru)]||0)+1; }
      });
    });

    function board(counts){
      return Object.keys(counts).map(function(k){ return {key:k, name:names[k], count:counts[k]}; })
        .sort(function(a,b){ return b.count-a.count || a.name.localeCompare(b.name); });
    }
    var winBoard=board(wins);

    // Records were captured with whatever spelling that event used — show the
    // merged driver's preferred name instead.
    function resolve(rec){ if(rec && rec.key && names[rec.key]) rec.driver=names[rec.key]; }
    resolve(fastest);
    Object.keys(fastestByClass).forEach(function(cn){ resolve(fastestByClass[cn]); });

    // Per-driver histories double as the appearance counts, so "Most Active"
    // and the Driver Stats card can never disagree.
    var drivers=VRDS.build(evs);
    var appBoard=drivers.map(function(d){ return {key:d.key, name:d.name, count:d.count}; })
      .sort(function(a,b){ return b.count-a.count || a.name.localeCompare(b.name); });

    var classTitleTop={};
    Object.keys(classTitles).forEach(function(cn){
      var b=board(classTitles[cn]); classTitleTop[cn]=b.length?b[0]:null;
    });

    return {
      events: evs.length,
      drivers: drivers.length,
      seasons: Object.keys(years).length,
      fastest: fastest,
      fastestByClass: fastestByClass,
      wins: winBoard,
      podiums: board(podiums),
      appearances: appBoard,
      classTitles: classTitleTop,
      driverStats: drivers,
    };
  }

  // ---- Rendering ------------------------------------------------------------
  function leaderboard(rows, unit){
    if(!rows.length) return '<div class="vr-stat-empty">No data yet.</div>';
    return '<ol class="vr-stat-board">'+rows.slice(0,TOP_N).map(function(r,i){
      return '<li class="vr-stat-board__row'+(i===0?' is-top':'')+'">'+
        '<span class="vr-stat-board__pos">'+(i+1)+'</span>'+
        '<span class="vr-stat-board__name">'+esc(r.name)+'</span>'+
        '<span class="vr-stat-board__val">'+r.count+'<small>'+unit+'</small></span>'+
      '</li>';
    }).join('')+'</ol>';
  }
  function card(title, inner, wide){
    return '<div class="vr-stat-card'+(wide?' vr-stat-card--wide':'')+'">'+
      '<div class="vr-stat-card__title">'+esc(title)+'</div>'+inner+'</div>';
  }
  function heroSlide(variant, label, rec, showClass){
    var meta=esc([rec.event, rec.date].filter(Boolean).join(' · '));
    return '<div class="vr-stat-hero vr-stat-hero--'+variant+'">'+
      '<div class="vr-stat-hero__label">'+esc(label)+'</div>'+
      '<div class="vr-stat-hero__time">'+esc(VRR.fmtTime(rec.ms))+'</div>'+
      '<div class="vr-stat-hero__driver">'+esc(rec.driver||'—')+
        (showClass&&rec.cls?' <span class="vr-stat-hero__class">'+esc(rec.cls)+'</span>':'')+'</div>'+
      (meta?'<div class="vr-stat-hero__meta">'+meta+'</div>':'')+
    '</div>';
  }
  // Static fastest-time hero: overall fastest lap on record only (any session).
  function buildHero(S){
    if(!S.fastest){
      return '<div class="vr-stat-hero vr-stat-hero--overall"><div class="vr-stat-hero__label">Fastest Time on Record</div><div class="vr-stat-hero__time">—</div></div>';
    }
    return heroSlide('overall','Fastest Time on Record', S.fastest, true);
  }

  function renderDiscipline(disc, S){
    if(!S || !S.events){
      return '<section class="vr-stat-disc">'+
        '<div class="vr-stat-comingsoon">No <strong>'+esc(disc.label)+
        '</strong> results yet — stats will appear here once events are published.</div></section>';
    }

    var totals='<div class="vr-stat-totals">'+
      '<div class="vr-stat-total"><span class="vr-stat-total__num">'+S.events+'</span><span class="vr-stat-total__lbl">Events</span></div>'+
      '<div class="vr-stat-total"><span class="vr-stat-total__num">'+S.drivers+'</span><span class="vr-stat-total__lbl">Drivers</span></div>'+
      '<div class="vr-stat-total"><span class="vr-stat-total__num">'+S.seasons+'</span><span class="vr-stat-total__lbl">Seasons</span></div>'+
    '</div>';

    var hero=buildHero(S);

    var classNames=Object.keys(S.fastestByClass).sort(classSort);
    var byClass = classNames.length
      ? '<div class="vr-stat-classgrid">'+classNames.map(function(cn){
          var r=S.fastestByClass[cn];
          return '<div class="vr-stat-classrec"><div class="vr-stat-classrec__cls">'+esc(cn)+'</div>'+
            '<div class="vr-stat-classrec__time">'+esc(VRR.fmtTime(r.ms))+'</div>'+
            '<div class="vr-stat-classrec__who">'+esc(r.driver||'—')+'</div></div>';
        }).join('')+'</div>'
      : '<div class="vr-stat-empty">No class times yet.</div>';

    var titleNames=Object.keys(S.classTitles).sort(classSort);
    var titles = titleNames.length
      ? '<ul class="vr-stat-titles">'+titleNames.map(function(cn){
          var t=S.classTitles[cn];
          return '<li class="vr-stat-titles__row"><span class="vr-stat-titles__cls">'+esc(cn)+'</span>'+
            '<span class="vr-stat-titles__name">'+(t?esc(t.name):'—')+'</span>'+
            (t?'<span class="vr-stat-titles__val">'+t.count+'<small>'+(t.count===1?'win':'wins')+'</small></span>':'')+'</li>';
        }).join('')+'</ul>'
      : '<div class="vr-stat-empty">No titles yet.</div>';

    // Driver Stats: top few by events entered for this category, expandable.
    // /stats/driver-stats lists every driver across every category.
    var ds=S.driverStats||[];
    var driverInner=VRDS.render(ds, {limit:TOP_N})+
      (ds.length
        ? '<a class="vr-dstat-all" href="/stats/drivers">'+
            'See all drivers <span aria-hidden="true">→</span></a>'
        : '');

    var grid='<div class="vr-stat-grid">'+
      card('Fastest Time by Class', byClass, true)+
      card('Most Wins', leaderboard(S.wins,'wins'))+
      card('Most Podiums', leaderboard(S.podiums,'pod'))+
      card('Most Active', leaderboard(S.appearances,'events'))+
      card('Class Titles', titles)+
      card('Driver Stats', driverInner, true)+
    '</div>';

    return '<section class="vr-stat-disc">'+totals+hero+grid+'</section>';
  }

  function renderPage(stats){
    // Default to the first category that actually has data.
    var initial=(DISCIPLINES.filter(function(d){ return stats[d.key]; })[0]||DISCIPLINES[0]).key;

    var options=DISCIPLINES.map(function(d){
      var has=!!stats[d.key];
      return '<option value="'+d.key+'"'+(d.key===initial?' selected':'')+'>'+
        esc(d.label)+(has?'':' — coming soon')+'</option>';
    }).join('');
    var picker='<div class="vr-stat-picker"><label class="vr-filterselect">'+
      '<span class="vr-filterlabel">Category</span>'+
      '<select id="vrStatDisc" aria-label="Choose a category">'+options+'</select></label></div>';

    var panels=DISCIPLINES.map(function(d){
      return '<div class="vr-stat-panel" data-disc="'+d.key+'"'+(d.key===initial?'':' hidden')+'>'+
        renderDiscipline(d, stats[d.key])+'</div>';
    }).join('');

    body.innerHTML=picker+panels;
    VRDS.wire(body);

    var sel=el('vrStatDisc');
    sel.addEventListener('change', function(){
      Array.prototype.forEach.call(body.querySelectorAll('.vr-stat-panel'), function(p){
        p.hidden = p.getAttribute('data-disc')!==sel.value;
      });
    });
  }

  function run(){
    showOnly('loading');
    VRR.loadEvents({ onProgress:function(done,total){
      if(progress) progress.textContent=done+' / '+total;
    }}, function(events){
      if(events===null){ showOnly('error'); return; }
      var stats={};
      DISCIPLINES.forEach(function(disc){
        var evs=events.filter(function(e){ return VRR.norm(e.type)===disc.key; });
        stats[disc.key] = evs.length ? computeStats(evs) : null;
      });
      renderPage(stats);
      showOnly('content');
    });
  }

  var retry=el('vrStatsRetry'); if(retry) retry.addEventListener('click', run);
  if(!VRR || !VRDS){ showOnly('error'); return; }
  run();
})();
