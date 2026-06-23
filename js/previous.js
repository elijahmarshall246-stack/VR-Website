(function(){
  var CFG  = (window.VR_CONFIG && window.VR_CONFIG.previous) || {};
  var COLS = CFG.indexColumns || {};
  var WB   = CFG.workbookId || '';
  var configured = WB && !/^TODO/i.test(WB);

  var FETCH_RANGE = 'A1:U240';

  var HEATS = { heatCol:0, runLabels:['Qualifying 1','Qualifying 2','Qualifying 3'],
    blocks:[ {num:2,driver:3,time:4}, {num:7,driver:8,time:9}, {num:12,driver:13,time:14} ] };

  var KO = {
    carCol: { R16:1, QF:5, SF:9, F:13 },
    rounds: {
      R16: [[8,2,4],[1,6,8],[4,10,12],[5,14,16],[6,18,20],[3,22,24],[2,26,28],[7,30,32]],
      QF:  [[4,3,7],[1,11,15],[2,19,23],[3,27,31]],
      SF:  [[2,5,13],[1,21,29]],
      F:   [[1,9,25]],
    },
    winner: { row:17, col:17 },
  };
  var KO_NAMES = ['BimmaCup','BimmaCup Jr.','Touring','AWD'];
  var SENTINEL = 30*60000;
  var SHOW_WINNER = true;

  var el = function(id){ return document.getElementById(id); };
  var board = el('vrPrevBoard'), back = el('vrBack');
  var listView = el('vrPrevList'), typeFilter = el('vrTypeFilter'), eventList = el('vrEventList');
  var loading = el('vrPrevLoading'), empty = el('vrPrevEmpty'), error = el('vrPrevError');
  var list = el('lbList'), grid = el('lbHeatGrid');
  var pdfWrap = el('vrPdfWrap'), pdfLink = el('vrPdfLink');

  var events = [], cache = {}, knockoutData = [], _seq = 0;
  var activeType = '__all', activeClass = '__all';
  var classMap = {}, classList = [];

  function esc(s){ return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}); }
  var cellVal = function(c){ return c ? (c.f!=null ? String(c.f) : (c.v!=null ? String(c.v) : '')) : ''; };
  function norm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

  function parseTime(v){
    if(v==null||v==='') return null;
    if(typeof v==='number'&&!isNaN(v)) return Math.round(v*1000);
    var s=String(v).trim(); if(!s||/^(dnf|dns|dsq|—|-)$/i.test(s)) return null;
    var p=s.split(/[:.]/).map(function(x){return x.trim();});
    if(p.some(function(x){return x===''||isNaN(x);})){ var f=parseFloat(s); return isNaN(f)?null:Math.round(f*1000); }
    var padMs=function(x){return (String(x)+'000').slice(0,3);}; var min=0,sec=0,ms=0;
    if(p.length>=3){ min=+p[0]; sec=+p[1]; ms=+padMs(p[2]); }
    else if(p.length===2){ if(/\./.test(s)&&!/:/.test(s)){ sec=+p[0]; ms=+padMs(p[1]); } else { min=+p[0]; sec=+p[1]; } }
    else sec=+p[0];
    return ((min*60)+sec)*1000+ms;
  }
  function fmtTime(ms){ if(ms==null) return '—'; var t=Math.round(ms);
    var m=Math.floor(t/60000); t-=m*60000; var s=Math.floor(t/1000), mm=t-s*1000;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+':'+String(mm).padStart(3,'0'); }
  function fmtGap(ms){ var s=Math.floor(ms/1000), mm=ms%1000; return '+'+s+'.'+String(mm).padStart(3,'0'); }

  function buildGrid(rows){ return rows.map(function(r){ return (r.c||[]).map(function(x){ return cellVal(x); }); }); }
  function gv(G,r,c){ var row=G[r]; if(!row) return ''; var v=row[c]; return v==null?'':String(v).trim(); }
  function findRow(G, from, test){ for(var r=from;r<G.length;r++){ if(test(G[r]||[], r)) return r; } return -1; }
  function rowHasExact(row, text){ for(var c=0;c<row.length;c++){ if(String(row[c]||'').trim().toLowerCase()===text) return true; } return false; }

  function gviz(tab, range, cb){
    var base='https://docs.google.com/spreadsheets/d/'+WB+'/gviz/tq?sheet='+encodeURIComponent(tab)+
             (range?'&range='+range:'')+'&headers=0';
    var cbName='__vrPrev'+(++_seq);
    var s=document.createElement('script');
    window[cbName]=function(resp){ delete window[cbName]; s.remove();
      cb(resp&&resp.status==='ok'?((resp.table&&resp.table.rows)||[]):null); };
    s.onerror=function(){ delete window[cbName]; s.remove(); cb(null); };
    s.src=base+'&tqx=out:json;responseHandler:'+cbName;
    document.head.appendChild(s);
  }

  function parseHeats(G, start, end){
    var runs=HEATS.runLabels.map(function(l){return {label:l, heats:[]};});
    var curHeat='', rowsByHeat={};
    for(var r=start;r<end;r++){
      var hn=gv(G,r,HEATS.heatCol); if(hn) curHeat=hn;
      if(!curHeat) continue;
      HEATS.blocks.forEach(function(b,bi){
        var num=gv(G,r,b.num), drv=gv(G,r,b.driver);
        if(!drv&&!num) return;
        if(!rowsByHeat[bi]) rowsByHeat[bi]={};
        if(!rowsByHeat[bi][curHeat]) rowsByHeat[bi][curHeat]=[];
        rowsByHeat[bi][curHeat].push({num:num, driver:drv, ms:parseTime(gv(G,r,b.time))});
      });
    }
    HEATS.blocks.forEach(function(b,bi){ var map=rowsByHeat[bi]||{};
      Object.keys(map).forEach(function(hn){ runs[bi].heats.push({heat:hn, entries:map[hn]}); }); });
    return runs;
  }
  function deriveOverall(runs){
    var best={};
    runs.forEach(function(run){ run.heats.forEach(function(h){ h.entries.forEach(function(e){
      if(e.ms==null||e.ms>=SENTINEL) return; var k=String(e.num);
      if(!best[k]||e.ms<best[k].ms) best[k]={num:e.num,driver:e.driver,ms:e.ms,round:run.label};
    });});});
    var rows=Object.keys(best).map(function(k){var d=best[k];return {id:String(d.num),num:d.num,driver:d.driver,ms:d.ms,round:d.round};});
    rows.sort(function(a,b){return a.ms-b.ms;});
    return rows;
  }
  function parseFastestClass(G, start, end){
    classMap={}; var order=[];
    for(var r=start;r<end;r++){
      var cls=gv(G,r,0), drv=gv(G,r,5);
      if(!cls||!drv) continue;
      if(/^class$/i.test(cls)||/^driver(\s*name)?$/i.test(drv)||/^knockouts/i.test(cls)) continue;
      classMap[norm(drv)]=cls;
      if(order.indexOf(cls)===-1) order.push(cls);
    }
    order.sort(function(a,b){return a.localeCompare(b);});
    classList=order;
  }
  function classOf(driver){ return classMap[norm(driver)]||''; }

  function parseKO(G, O, name){
    var slot=function(rr,c){ return {car:gv(G,O+rr,c), driver:gv(G,O+rr,c+1), time:gv(G,O+rr,c+2)}; };
    var rounds={};
    ['R16','QF','SF','F'].forEach(function(rk){
      var col=KO.carCol[rk];
      var l=KO.rounds[rk].map(function(m){ return {match:m[0], slot1:slot(m[1],col), slot2:slot(m[2],col)}; });
      var filled=l.filter(function(m){ return m.slot1.car||m.slot1.driver||m.slot2.car||m.slot2.driver; });
      if(filled.length) rounds[rk]=filled;
    });
    var winnerCar=gv(G, O+KO.winner.row, KO.winner.col);
    var fm=rounds['F'];
    if(fm&&fm.length){ var f=fm[0];
      if(winnerCar){ f.slot1.winner=f.slot1.car===winnerCar; f.slot2.winner=f.slot2.car===winnerCar; }
      else{ var t0=parseTime(f.slot1.time),t1=parseTime(f.slot2.time);
        if(t0!=null&&t1!=null){ f.slot1.winner=t0<=t1; f.slot2.winner=!f.slot1.winner; }
        else if(t0!=null) f.slot1.winner=true; else if(t1!=null) f.slot2.winner=true; } }
    return { name:name, rounds:rounds };
  }
  function knockoutName(G, O, i){
    for(var r=O-1; r>=0 && r>O-6; r--){
      var a=gv(G,r,0);
      if(/^knockouts/i.test(a)){
        var raw=a.replace(/^knockouts/i,'').trim();
        if(/jr/i.test(raw)) return 'BimmaCup Jr.';
        if(/touring/i.test(raw)) return 'Touring';
        if(/awd/i.test(raw)) return 'AWD';
        if(/bimma/i.test(raw)) return 'BimmaCup';
        if(raw) return raw;
      }
    }
    return KO_NAMES[i] || ('Class '+(i+1));
  }

  function renderOverall(rows){
    var leaderMs=rows.length?rows[0].ms:null, html='';
    rows.forEach(function(d,idx){
      var pos=idx+1, cls='lb__row'+(pos===1?' p1':pos===2?' p2':pos===3?' p3':'');
      var gap=d.ms===leaderMs?'FASTEST':fmtGap(d.ms-leaderMs);
      var roundShort=d.round?'QF'+((d.round.match(/\d+/)||[''])[0]):'';
      var roundLbl=roundShort?'<span class="lb__round">'+roundShort+'</span>':'';
      var clazz=classOf(d.driver);
      var classLbl=clazz?'<span class="lb__rowclass">'+esc(clazz)+'</span>':'';
      html+='<div class="'+cls+'" data-id="'+esc(d.id)+'">'+
        '<div class="lb__pos">'+pos+'</div><div class="lb__num">'+esc(String(d.num))+'</div>'+
        '<div class="lb__who"><div style="min-width:0"><div class="lb__name">'+esc(d.driver)+'</div>'+classLbl+'</div></div>'+
        '<div class="lb__end"><span class="lb__trend same">–</span>'+
        '<div class="lb__time'+(d.ms===leaderMs?' best':'')+'">'+fmtTime(d.ms)+'<small>'+gap+'</small></div>'+roundLbl+'</div>'+
        '</div>';
    });
    list.innerHTML=html || '<div style="padding:18px;color:var(--muted);font-family:var(--font-mono);font-size:12px;">No qualifying times for this event.</div>';
  }
  function renderHeats(runs){
    grid.innerHTML='';
    runs.forEach(function(run){
      var runBest=Infinity; run.heats.forEach(function(h){h.entries.forEach(function(e){ if(e.ms!=null&&e.ms<SENTINEL&&e.ms<runBest) runBest=e.ms; });});
      var col=document.createElement('div'); col.className='lb__hcol';
      var html='<div class="lb__hcolhead"><span>'+esc(run.label)+'</span><span class="t">Time</span></div>';
      run.heats.forEach(function(h){
        html+='<div class="lb__heat"><div class="lb__heatno">'+esc(h.heat)+'</div><div class="lb__hpair">';
        var heatBest=h.entries.reduce(function(b,e){return (e.ms!=null&&e.ms<SENTINEL&&(b===null||e.ms<b))?e.ms:b;}, null);
        h.entries.forEach(function(e){
          var dnf=e.ms==null||e.ms>=SENTINEL;
          var isHeatFastest=!dnf&&heatBest!==null&&e.ms===heatBest;
          var cls=dnf?'dnf':(e.ms===runBest?'best':'');
          html+='<div class="lb__hentry'+(isHeatFastest?' heat-best':'')+'"><span class="lb__hnum">'+esc(String(e.num))+'</span>'+
            '<span class="lb__hdrv">'+esc(e.driver)+'</span><span class="lb__htime '+cls+'">'+(dnf?'—':fmtTime(e.ms))+'</span></div>';
        });
        html+='</div></div>';
      });
      col.innerHTML=html; grid.appendChild(col);
    });
  }

  function makeSlot(slot, adv){
    var isBye=slot.car==='Bye'||slot.driver==='Bye'||(!slot.driver&&(slot.car===''||slot.car==='?'));
    var isTbd=!slot.driver&&!isBye;
    var cls='lb__bslot'+(slot.winner?' winner':isBye?' bye':isTbd?' tbd':'');
    var timeDisp=slot.time&&slot.time!==''?'<span class="lb__btime">'+esc(slot.time)+'</span>':'';
    var advBadge=adv?'<span class="lb__badv">ADV</span>':'';
    return '<div class="'+cls+'"><span class="lb__bnum">'+esc(slot.car||'')+'</span><span class="lb__bname">'+
      esc(slot.driver||'TBD')+'</span>'+advBadge+'<span class="lb__bfill"></span>'+timeDisp+'</div>';
  }
  function renderBracket(catData){
    var bracket=el('lbBracket');
    if(!catData||!Object.keys(catData.rounds).length){
      bracket.innerHTML='<div style="padding:20px;color:var(--muted);font-family:var(--font-mono);font-size:12px;">No knockout data for this class.</div>'; return; }
    var ROUND_LABELS={R16:'Round of 16',QF:'Quarter-Finals',SF:'Semi-Finals',F:'Finals'};
    var ROUNDS=['R16','QF','SF','F'], html='';
    ROUNDS.forEach(function(rk){
      var matches=catData.rounds[rk]||[]; if(!matches.length) return;
      html+='<div class="lb__bround"><div class="lb__broundhead">'+(ROUND_LABELS[rk]||rk)+'</div><div class="lb__bmatches">';
      function mkMatch(m){
        var h='<div class="lb__bmatchlabel">'+(rk==='F'?'Final':rk+'#'+m.match)+'</div>';
        var adv1=false, adv2=false;
        if(rk!=='F'){
          var s1Active=!!(m.slot1.car||m.slot1.driver), s2Active=!!(m.slot2.car||m.slot2.driver);
          var s1Absent=!s1Active||m.slot1.car==='Bye'||m.slot1.driver==='Bye';
          var s2Absent=!s2Active||m.slot2.car==='Bye'||m.slot2.driver==='Bye';
          if(s1Active&&s2Absent){ adv1=true; }
          else if(s2Active&&s1Absent){ adv2=true; }
          else{ var t1=parseTime(m.slot1.time),t2=parseTime(m.slot2.time); if(t1!=null&&t2!=null){ adv1=t1<=t2; adv2=!adv1; } }
        }
        return h+makeSlot(m.slot1,adv1)+makeSlot(m.slot2,adv2);
      }
      for(var pi=0; pi<matches.length; pi+=2){
        var m1=matches[pi], m2=matches[pi+1]; if(!m1) continue;
        var hasPair=!!m2;
        html+='<div class="lb__bpair'+(hasPair?'':' single')+'">';
        html+='<div class="lb__bmatch">'+mkMatch(m1)+'</div>';
        if(hasPair) html+='<div class="lb__bmatch">'+mkMatch(m2)+'</div>';
        html+='</div>';
      }
      html+='</div></div>';
    });
    var fm=catData.rounds['F'];
    if(SHOW_WINNER&&fm&&fm.length){
      var f=fm[0];
      var winnerSlot=f.slot1.winner?f.slot1:(f.slot2.winner?f.slot2:null);
      var displaySlot=winnerSlot||{car:'?',driver:'TBD',time:''};
      html+='<div class="lb__bwinner"><div class="lb__bwinnerlabel">Winner</div>';
      html+='<div class="lb__bwinnerslot">'+makeSlot({car:displaySlot.car,driver:displaySlot.driver,time:displaySlot.time,winner:!!winnerSlot})+'</div></div>';
    }
    bracket.innerHTML=html;
  }
  function buildCatButtons(){
    var wrap=el('lbKcatBtns');
    wrap.innerHTML=knockoutData.map(function(c,i){
      return '<button class="lb__kcatbtn'+(i===0?' active':'')+'" data-cat="'+i+'">'+esc(c.name)+'</button>'; }).join('');
    Array.prototype.forEach.call(wrap.children, function(b){ b.onclick=function(){ setCat(+b.dataset.cat); }; });
  }
  function setCat(i){
    Array.prototype.forEach.call(el('lbKcatBtns').children, function(b){ b.classList.toggle('active',+b.dataset.cat===i); });
    renderBracket(knockoutData[i]);
  }

  function buildClassFilter(){
    var bar=el('vrClassFilter'); if(!bar) return;
    if(!classList.length){ bar.classList.remove('is-on'); bar.innerHTML=''; return; }
    var html='<span class="vr-filterlabel">Filter:</span>'+
             '<button class="vr-chip is-active" data-class="__all">All Classes</button>';
    classList.forEach(function(c){ html+='<button class="vr-chip" data-class="'+esc(c)+'">'+esc(c)+'</button>'; });
    bar.innerHTML=html; bar.classList.add('is-on'); activeClass='__all';
    Array.prototype.forEach.call(bar.querySelectorAll('.vr-chip'), function(b){
      b.onclick=function(){
        activeClass=b.dataset.class;
        Array.prototype.forEach.call(bar.querySelectorAll('.vr-chip'), function(x){ x.classList.toggle('is-active', x===b); });
        applyClassFilter();
      };
    });
  }
  function applyClassFilter(){
    document.querySelectorAll('#lbList .lb__row').forEach(function(row){
      var n=row.querySelector('.lb__name');
      var ok=activeClass==='__all'||classOf(n?n.textContent:'')===activeClass;
      row.style.display=ok?'':'none';
    });
    document.querySelectorAll('#lbHeatGrid .lb__hentry').forEach(function(ent){
      var n=ent.querySelector('.lb__hdrv');
      var ok=activeClass==='__all'||classOf(n?n.textContent:'')===activeClass;
      ent.style.display=ok?'':'none';
    });
  }

  function setView(i){
    Array.prototype.forEach.call(el('lbTabs').children, function(b){ b.classList.toggle('active',+b.dataset.view===i); });
    el('lbQualifying').classList.toggle('hide', i!==0);
    el('lbKnockouts').classList.toggle('hide', i!==1);
    el('lbTitleSub').textContent = i===1 ? '· Knockouts' : '· Qualifying';
  }
  Array.prototype.forEach.call(el('lbTabs').children, function(b){ b.addEventListener('click',function(){ setView(+b.dataset.view); }); });

  function render(G){
    var heatsHdr = findRow(G, 0, function(row){ return rowHasExact(row, 'qualifying 1'); });
    var fastTitle = findRow(G, 0, function(row){ return row.some(function(v){ return /^fastest qualifying/i.test(String(v).trim()); }); });
    var koOrigins=[];
    for(var r=0;r<G.length;r++){ if(rowHasExact(G[r]||[], 'round of 16')) koOrigins.push(r); }
    var firstKO = koOrigins.length ? koOrigins[0] : G.length;

    var heatsEnd = fastTitle>=0 ? fastTitle : firstKO;
    var runs = heatsHdr>=0 ? parseHeats(G, heatsHdr+1, heatsEnd) : [];

    classMap={}; classList=[];
    if(fastTitle>=0){
      var fastHdr = findRow(G, fastTitle, function(row){ return rowHasExact(row, 'driver name'); });
      if(fastHdr>=0) parseFastestClass(G, fastHdr+1, firstKO);
    }

    renderOverall(deriveOverall(runs));
    renderHeats(runs);

    knockoutData = koOrigins.map(function(O,i){ return parseKO(G, O, knockoutName(G,O,i)); });
    buildCatButtons();
    var anyKO=knockoutData.some(function(c){ return Object.keys(c.rounds).length; });
    var koTab=el('lbTabs').querySelector('[data-view="1"]');
    if(koTab) koTab.style.display = anyKO ? '' : 'none';
    setCat(0);
    setView(0);

    buildClassFilter();
    applyClassFilter();
  }

  function showOnly(which){
    loading.classList.toggle('is-on', which==='loading');
    empty.classList.toggle('is-on',  which==='empty');
    error.classList.toggle('is-on',  which==='error');
    listView.style.display = which==='list'   ? '' : 'none';
    board.style.display    = which==='detail' ? '' : 'none';
    back.style.display     = which==='detail' ? '' : 'none';
    if(which!=='detail' && pdfWrap) pdfWrap.style.display='none';
    window.scrollTo({top:0, behavior:'auto'});
  }

  function buildTypeFilter(){
    var types=[];
    events.forEach(function(e){ if(e.type && types.indexOf(e.type)===-1) types.push(e.type); });
    types.sort(function(a,b){ return a.localeCompare(b); });
    if(types.length < 2){ typeFilter.style.display='none'; typeFilter.innerHTML=''; return; }
    var html='<span class="vr-filterlabel">Filter:</span>'+
             '<button class="vr-typechip is-active" data-type="__all">All Types</button>';
    types.forEach(function(t){ html+='<button class="vr-typechip" data-type="'+esc(t)+'">'+esc(t)+'</button>'; });
    typeFilter.innerHTML=html; typeFilter.style.display='';
    Array.prototype.forEach.call(typeFilter.querySelectorAll('.vr-typechip'), function(b){
      b.onclick=function(){
        activeType=b.dataset.type;
        Array.prototype.forEach.call(typeFilter.querySelectorAll('.vr-typechip'), function(x){ x.classList.toggle('is-active', x===b); });
        renderEventList();
      };
    });
  }
  function renderEventList(){
    var html='';
    events.forEach(function(ev,i){
      if(activeType!=='__all' && ev.type!==activeType) return;
      html+='<button class="vr-eventcard" type="button" data-i="'+i+'">'+
        '<span class="vr-eventcard__main"><span class="vr-eventcard__name">'+esc(ev.name)+'</span>'+
        (ev.date?'<span class="vr-eventcard__date">'+esc(ev.date)+'</span>':'')+'</span>'+
        '<span class="vr-eventcard__right">'+
          (ev.type?'<span class="vr-eventtype">'+esc(ev.type)+'</span>':'')+
          '<span class="vr-eventcard__go" aria-hidden="true">→</span>'+
        '</span></button>';
    });
    eventList.innerHTML = html || '<div class="vr-state__msg" style="text-align:center;padding:30px 0">No events of this type yet.</div>';
    Array.prototype.forEach.call(eventList.querySelectorAll('.vr-eventcard'), function(b){
      b.onclick=function(){ selectEvent(events[+b.dataset.i]); };
    });
  }

  function enterDetail(ev){
    el('lbTitleName').textContent=ev.name;
    el('lbDate').textContent=ev.date||'';
    showOnly('detail');
    if(pdfWrap){ if(ev.pdf){ pdfLink.href=ev.pdf; pdfWrap.style.display=''; } else pdfWrap.style.display='none'; }
  }
  function selectEvent(ev){
    if(cache[ev.tab]){ render(cache[ev.tab]); enterDetail(ev); return; }
    showOnly('loading');
    gviz(ev.tab, FETCH_RANGE, function(rows){
      if(rows===null){ showOnly('error'); return; }
      var G=buildGrid(rows); cache[ev.tab]=G; render(G); enterDetail(ev);
    });
  }

  function dateMs(cell){
    if(!cell) return NaN; var v=cell.v;
    if(typeof v==='string'){ var m=v.match(/^Date\((\d+),(\d+),(\d+)/); if(m) return new Date(+m[1],+m[2],+m[3]).getTime(); }
    var t=Date.parse(cell.f||(v!=null?String(v):'')); return isNaN(t)?NaN:t;
  }
  function loadIndex(){
    showOnly('loading');
    gviz(CFG.indexTabName||'Index', '', function(rows){
      if(rows===null){ showOnly('error'); return; }
      if(!rows.length){ showOnly('empty'); return; }
      var header=(rows[0].c||[]).map(function(c){ return norm(cellVal(c)); });
      var idx=function(n){ return header.indexOf(norm(n)); };
      var iName=idx(COLS.eventName||'EventName'), iType=idx(COLS.eventType||'EventType'),
          iDate=idx(COLS.date||'Date'), iTab=idx(COLS.tabName||'TabName'), iPdf=idx(COLS.pdfUrl||'PdfUrl');
      if(iName<0||iTab<0){ showOnly('error'); return; }
      events=[];
      for(var r=1;r<rows.length;r++){
        var c=rows[r].c||[];
        var name=cellVal(c[iName]).trim(), tab=cellVal(c[iTab]).trim();
        if(!name||!tab) continue;
        events.push({ name:name, tab:tab,
          type: iType>=0?cellVal(c[iType]).trim():'',
          date: iDate>=0?cellVal(c[iDate]).trim():'',
          dateMs: iDate>=0?dateMs(c[iDate]):NaN,
          pdf: iPdf>=0?cellVal(c[iPdf]).trim():'' });
      }
      if(!events.length){ showOnly('empty'); return; }
      events.sort(function(a,b){ if(isNaN(a.dateMs)&&isNaN(b.dateMs))return 0; if(isNaN(a.dateMs))return 1; if(isNaN(b.dateMs))return -1; return b.dateMs-a.dateMs; });
      activeType='__all';
      buildTypeFilter();
      renderEventList();
      showOnly('list');
    });
  }

  back.addEventListener('click', function(){ showOnly('list'); });
  var retry=el('vrPrevRetry'); if(retry) retry.addEventListener('click', loadIndex);
  if(!configured){ showOnly('empty'); return; }
  loadIndex();
})();
