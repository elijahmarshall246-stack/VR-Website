(function(){
  var CFG  = (window.VR_CONFIG && window.VR_CONFIG.previous) || {};
  var COLS = CFG.indexColumns || {};
  var WB   = CFG.workbookId || '';
  var configured = WB && !/^TODO/i.test(WB);
  var VRR  = window.VRResults;

  var FETCH_RANGE = 'A1:U240';
  var TOP_N = 5;            // rows shown in each leaderboard
  var MIN_APPEAR = 2;       // min events entered to qualify for the win-rate board

  // Categories to report, chosen from the dropdown. Each key must equal the
  // normalised event type from the Index sheet. Categories with no events yet
  // render a "coming soon" state.
  var DISCIPLINES = [
    { key:'rallysprint',        label:'RallySprint'         },
    { key:'reverserallysprint', label:'Reverse RallySprint' },
    { key:'rallycross',         label:'Rallycross'          },
    { key:'stagerally',         label:'Stage Rally'         },
  ];

  var el = function(id){ return document.getElementById(id); };
  var loading = el('vrStatsLoading'), error = el('vrStatsError'),
      content = el('vrStatsContent'), body = el('vrStatsBody'), progress = el('vrStatsProgress');

  var _seq = 0;
  function gviz(tab, range, cb){
    var base='https://docs.google.com/spreadsheets/d/'+WB+'/gviz/tq?sheet='+encodeURIComponent(tab)+
             (range?'&range='+range:'')+'&headers=0';
    var cbName='__vrStats'+(++_seq);
    var s=document.createElement('script');
    window[cbName]=function(resp){ delete window[cbName]; s.remove();
      cb(resp&&resp.status==='ok'?((resp.table&&resp.table.rows)||[]):null); };
    s.onerror=function(){ delete window[cbName]; s.remove(); cb(null); };
    s.src=base+'&tqx=out:json;responseHandler:'+cbName;
    document.head.appendChild(s);
  }

  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  function yearOf(dateStr){ var m=String(dateStr||'').match(/\b(?:19|20)\d{2}\b/); return m?+m[0]:null; }

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
    if(!label || /^(bye|tbd|\?|—|-)$/i.test(label.trim())) return '';
    return label;
  }

  function showOnly(which){
    loading.classList.toggle('is-on', which==='loading');
    error.classList.toggle('is-on',  which==='error');
    content.style.display = which==='content' ? '' : 'none';
  }

  // ---- Index ----------------------------------------------------------------
  function loadIndex(cb){
    gviz(CFG.indexTabName||'Index', '', function(rows){
      if(rows===null){ cb(null); return; }
      var header=(rows[0].c||[]).map(function(c){ return VRR.norm(VRR.cellVal(c)); });
      var idx=function(n){ return header.indexOf(VRR.norm(n)); };
      var iName=idx(COLS.eventName||'EventName'), iType=idx(COLS.eventType||'EventType'),
          iDate=idx(COLS.date||'Date'), iTab=idx(COLS.tabName||'TabName');
      if(iName<0||iTab<0){ cb(null); return; }
      var events=[];
      for(var r=1;r<rows.length;r++){
        var c=rows[r].c||[];
        var name=VRR.cellVal(c[iName]).trim(), tab=VRR.cellVal(c[iTab]).trim();
        if(!name||!tab) continue;
        var date=iDate>=0?VRR.cellVal(c[iDate]).trim():'';
        events.push({ name:name, tab:tab,
          type: iType>=0?VRR.cellVal(c[iType]).trim():'',
          date: date, year: yearOf(date) });
      }
      cb(events);
    });
  }

  function fetchAll(events, done){
    var total=events.length, got=0;
    if(!total){ done(); return; }
    if(progress) progress.textContent='0 / '+total;
    events.forEach(function(ev){
      gviz(ev.tab, FETCH_RANGE, function(rows){
        ev.parsed = rows ? VRR.parseEvent(VRR.buildGrid(rows)) : { overall:[], knockouts:[] };
        got++; if(progress) progress.textContent=got+' / '+total;
        if(got===total) done();
      });
    });
  }

  // ---- Aggregation ----------------------------------------------------------
  function computeStats(evs){
    var names={};                               // norm -> display name
    function nm(d){ var k=VRR.norm(d); if(k && !names[k]) names[k]=d; return k; }

    var fastest=null, fastestByClass={};
    var wins={}, podiums={}, appearances={}, classTitles={}, years={};

    evs.forEach(function(ev){
      var P = ev.parsed || {};
      if(ev.year) years[ev.year]=1;

      var seen={};
      (P.overall||[]).forEach(function(d){
        if(!d.driver) return;
        var k=nm(d.driver);
        if(k && !seen[k]){ seen[k]=1; appearances[k]=(appearances[k]||0)+1; }
        if(d.ms!=null){
          var canon=canonClass(d['class']);
          if(!fastest || d.ms<fastest.ms) fastest={ms:d.ms,driver:d.driver,event:ev.name,date:ev.date,cls:canon};
          if(canon && (!fastestByClass[canon] || d.ms<fastestByClass[canon].ms)) fastestByClass[canon]={ms:d.ms,driver:d.driver,event:ev.name,date:ev.date};
        }
      });

      (P.knockouts||[]).forEach(function(ko){
        var res=VRR.finalResult(ko); if(!res) return;
        var wLabel=slotName(res.winner); if(!wLabel) return;   // undecided/placeholder final → skip
        var wk=nm(wLabel);
        wins[wk]=(wins[wk]||0)+1;
        podiums[wk]=(podiums[wk]||0)+1;
        var ctitle=canonClass(ko.name);
        if(ctitle){ classTitles[ctitle]=classTitles[ctitle]||{}; classTitles[ctitle][wk]=(classTitles[ctitle][wk]||0)+1; }
        var ru=slotName(res.runnerUp);
        if(ru){ podiums[nm(ru)]=(podiums[nm(ru)]||0)+1; }
      });
    });

    function board(counts){
      return Object.keys(counts).map(function(k){ return {key:k, name:names[k], count:counts[k]}; })
        .sort(function(a,b){ return b.count-a.count || a.name.localeCompare(b.name); });
    }
    var winBoard=board(wins);
    var winRate=Object.keys(appearances).filter(function(k){ return appearances[k]>=MIN_APPEAR; })
      .map(function(k){ return {key:k, name:names[k], apps:appearances[k], wins:wins[k]||0, rate:(wins[k]||0)/appearances[k]}; })
      .sort(function(a,b){ return b.rate-a.rate || b.wins-a.wins || a.name.localeCompare(b.name); });
    var appBoard=Object.keys(appearances).map(function(k){ return {key:k, name:names[k], count:appearances[k]}; })
      .sort(function(a,b){ return b.count-a.count || a.name.localeCompare(b.name); });

    var classTitleTop={};
    Object.keys(classTitles).forEach(function(cn){
      var b=board(classTitles[cn]); classTitleTop[cn]=b.length?b[0]:null;
    });

    return {
      events: evs.length,
      drivers: Object.keys(appearances).length,
      seasons: Object.keys(years).length,
      fastest: fastest,
      fastestByClass: fastestByClass,
      wins: winBoard,
      podiums: board(podiums),
      appearances: appBoard,
      winRate: winRate,
      classTitles: classTitleTop,
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
  function rateBoard(rows){
    if(!rows.length) return '<div class="vr-stat-empty">No data yet.</div>';
    return '<ol class="vr-stat-board">'+rows.slice(0,TOP_N).map(function(r,i){
      return '<li class="vr-stat-board__row'+(i===0?' is-top':'')+'">'+
        '<span class="vr-stat-board__pos">'+(i+1)+'</span>'+
        '<span class="vr-stat-board__name">'+esc(r.name)+
          '<small class="vr-stat-board__sub">'+r.wins+'W / '+r.apps+' events</small></span>'+
        '<span class="vr-stat-board__val">'+Math.round(r.rate*100)+'<small>%</small></span>'+
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
  // Static fastest-time hero: overall fastest lap on record only.
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

    var grid='<div class="vr-stat-grid">'+
      card('Fastest Time by Class', byClass, true)+
      card('Most Wins', leaderboard(S.wins,'wins'))+
      card('Most Podiums', leaderboard(S.podiums,'pod'))+
      card('Best Win Rate', rateBoard(S.winRate))+
      card('Most Active', leaderboard(S.appearances,'events'))+
      card('Class Titles', titles, true)+
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

    var sel=el('vrStatDisc');
    sel.addEventListener('change', function(){
      Array.prototype.forEach.call(body.querySelectorAll('.vr-stat-panel'), function(p){
        p.hidden = p.getAttribute('data-disc')!==sel.value;
      });
    });
  }

  function run(){
    showOnly('loading');
    loadIndex(function(events){
      if(events===null){ showOnly('error'); return; }
      fetchAll(events, function(){
        var stats={};
        DISCIPLINES.forEach(function(disc){
          var evs=events.filter(function(e){ return VRR.norm(e.type)===disc.key; });
          stats[disc.key] = evs.length ? computeStats(evs) : null;
        });
        renderPage(stats);
        showOnly('content');
      });
    });
  }

  var retry=el('vrStatsRetry'); if(retry) retry.addEventListener('click', run);
  if(!configured || !VRR){ showOnly('error'); return; }
  run();
})();
