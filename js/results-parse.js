/* Shared results parser for Vaucluse Raceway event tabs.
   Extracts qualifying times + knockout outcomes from a single event grid so
   pages (e.g. the stats page) can aggregate without re-implementing the sheet
   layout. Mirrors the parsing used by js/previous.js; kept standalone so the
   working past-events page is not disturbed. Exposes window.VRResults. */
window.VRResults = (function(){
  var HEATS = { heatCol:0, runLabels:['Qualifying 1','Qualifying 2','Qualifying 3','Qualifying 4'],
    blocks:[ {num:2,driver:3,time:4}, {num:7,driver:8,time:9}, {num:12,driver:13,time:14}, {num:17,driver:18,time:19} ] };

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

  // Spreadsheet error values (#REF!, #N/A, …) leak out of the sheet as ordinary
  // text and would otherwise show up as drivers, classes and event names.
  // Read them as blank everywhere. Car numbers like "#12" are left alone.
  var ERR_RE=/^#(ref|n\/?a|name|value|div\/0|null|num|spill|getting_data)[!?]?$/i;
  function isErrText(s){ return ERR_RE.test(String(s==null?'':s).trim()); }

  function cellVal(c){
    var v = c ? (c.f!=null ? String(c.f) : (c.v!=null ? String(c.v) : '')) : '';
    return isErrText(v) ? '' : v;
  }
  function norm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

  /* ===== Driver identity =====================================================
     The sheets carry the same competitor under more than one spelling — a stray
     leading or middle initial ("M Jason Downey" vs "Jason Downey", "G Allan
     Kinch" vs "Allan Kinch") would otherwise split one driver into two on every
     leaderboard. Key drivers on their name minus single-letter tokens, but only
     while a first + last name survives, so a genuine "J Downey" is never
     collapsed into a different Downey. */
  function nameTokens(name){
    return String(name||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  }
  function coreTokens(name){
    var t=nameTokens(name);
    if(t.length<3) return t;
    var kept=t.filter(function(x){ return x.length>1; });
    return kept.length>=2 ? kept : t;
  }
  function driverKey(name){ return isErrText(name) ? '' : coreTokens(name).join(''); }

  // Which spelling to show for a merged driver: the one carrying no stray
  // initials, then the one that isn't shouting, then whichever we saw first.
  function betterName(cur, next){
    if(!cur) return next;
    if(!next) return cur;
    var dc=nameTokens(cur).length-coreTokens(cur).length,
        dn=nameTokens(next).length-coreTokens(next).length;
    if(dn!==dc) return dn<dc ? next : cur;
    var lcCur=/[a-z]/.test(cur), lcNext=/[a-z]/.test(next);
    if(lcNext&&!lcCur) return next;
    return cur;
  }

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

  function buildGrid(rows){ return rows.map(function(r){ return (r.c||[]).map(function(x){ return cellVal(x); }); }); }
  function gv(G,r,c){ var row=G[r]; if(!row) return ''; var v=row[c]; return v==null?'':String(v).trim(); }
  function findRow(G, from, test){ for(var r=from;r<G.length;r++){ if(test(G[r]||[], r)) return r; } return -1; }
  function rowHasExact(row, text){ for(var c=0;c<row.length;c++){ if(String(row[c]||'').trim().toLowerCase()===text) return true; } return false; }

  // Parse one event grid → { overall:[{num,driver,ms,round,class}], knockouts:[{name,rounds}], classList }
  function parseEvent(G){
    var carNames={}, classMap={}, classList=[];
    function classOf(driver){ return classMap[norm(driver)]||''; }

    function parseHeats(start, end){
      var runs=HEATS.runLabels.map(function(l){return {label:l, heats:[]};});
      var curHeat='', rowsByHeat={};
      for(var r=start;r<end;r++){
        var hn=gv(G,r,HEATS.heatCol); if(hn) curHeat=hn;
        if(!curHeat) continue;
        HEATS.blocks.forEach(function(b,bi){
          var num=gv(G,r,b.num), drv=gv(G,r,b.driver);
          if(!drv&&!num) return;
          if(num&&drv&&!carNames[num]) carNames[num]=drv;
          if(!rowsByHeat[bi]) rowsByHeat[bi]={};
          if(!rowsByHeat[bi][curHeat]) rowsByHeat[bi][curHeat]=[];
          rowsByHeat[bi][curHeat].push({num:num, driver:drv, ms:parseTime(gv(G,r,b.time))});
        });
      }
      HEATS.blocks.forEach(function(b,bi){ var map=rowsByHeat[bi]||{};
        Object.keys(map).forEach(function(hn){ runs[bi].heats.push({heat:hn, entries:map[hn]}); }); });
      // Events that don't run a Qualifying 4 leave those columns empty; drop the
      // run so nothing downstream sees a phantom round.
      return runs.filter(function(run){ return run.heats.length; });
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
    function parseFastestClass(start, end){
      classMap={}; var order=[];
      for(var r=start;r<end;r++){
        var cls=gv(G,r,0), drv=gv(G,r,5), car=gv(G,r,4);
        if(!cls||!drv) continue;
        if(/^class$/i.test(cls)||/^driver(\s*name)?$/i.test(drv)||/^knockouts/i.test(cls)) continue;
        if(car&&!carNames[car]) carNames[car]=drv;
        classMap[norm(drv)]=cls;
        if(order.indexOf(cls)===-1) order.push(cls);
      }
      order.sort(function(a,b){return a.localeCompare(b);});
      classList=order;
    }
    function knockoutName(O, i){
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
    function parseKO(O, name, end){
      if(end==null) end=G.length;
      var EMPTY={car:'',driver:'',time:''};
      var slot=function(rr,c){ var R=O+rr; if(R>=end) return EMPTY;
        var car=gv(G,R,c), driver=gv(G,R,c+1);
        if(car&&!driver&&carNames[car]) driver=carNames[car];
        return {car:car, driver:driver, time:gv(G,R,c+2)}; };
      var rounds={};
      ['R16','QF','SF','F'].forEach(function(rk){
        var col=KO.carCol[rk];
        var l=KO.rounds[rk].map(function(m){ return {match:m[0], slot1:slot(m[1],col), slot2:slot(m[2],col)}; });
        var filled=l.filter(function(m){ return m.slot1.car||m.slot1.driver||m.slot2.car||m.slot2.driver; });
        if(filled.length) rounds[rk]=filled;
      });
      var winnerRow=O+KO.winner.row;
      var winnerCar=winnerRow<end ? gv(G, winnerRow, KO.winner.col) : '';
      var fm=rounds['F'];
      if(fm&&fm.length){ var f=fm[0];
        if(winnerCar){ f.slot1.winner=f.slot1.car===winnerCar; f.slot2.winner=f.slot2.car===winnerCar; }
        else{ var t0=parseTime(f.slot1.time),t1=parseTime(f.slot2.time);
          if(t0!=null&&t1!=null){ f.slot1.winner=t0<=t1; f.slot2.winner=!f.slot1.winner; }
          else if(t0!=null) f.slot1.winner=true; else if(t1!=null) f.slot2.winner=true; } }
      return { name:name, rounds:rounds };
    }

    var heatsHdr = findRow(G, 0, function(row){ return rowHasExact(row, 'qualifying 1'); });
    var fastTitle = findRow(G, 0, function(row){ return row.some(function(v){ return /^fastest qualifying/i.test(String(v).trim()); }); });
    var koHeaders=[];
    for(var r=0;r<G.length;r++){ if(/^knockouts/i.test(String((G[r]||[])[0]||'').trim())) koHeaders.push(r); }
    var firstKO = koHeaders.length ? koHeaders[0] : G.length;

    var heatsEnd = fastTitle>=0 ? fastTitle : firstKO;
    var runs = heatsHdr>=0 ? parseHeats(heatsHdr+1, heatsEnd) : [];

    if(fastTitle>=0){
      var fastHdr = findRow(G, fastTitle, function(row){ return rowHasExact(row, 'driver name'); });
      if(fastHdr>=0) parseFastestClass(fastHdr+1, firstKO);
    }

    var overall = deriveOverall(runs).map(function(d){ d.class = classOf(d.driver); return d; });
    var knockouts = koHeaders.map(function(hr,i){
      var end = i+1<koHeaders.length ? koHeaders[i+1] : G.length;
      return parseKO(hr+1, knockoutName(hr+1, i), end);
    }).filter(function(c){ return Object.keys(c.rounds).length; });

    return { overall: overall, knockouts: knockouts, classList: classList };
  }

  /* ===== Event index loading =================================================
     Reads the Index tab, then every event tab, and hands back fully parsed
     events. Shared by the stats pages so they agree on dates, slugs and
     parsing. (js/previous.js keeps its own copy — it predates this module and
     is left untouched.) */
  var FETCH_RANGE = 'A1:U240';
  var _seq = 0;

  function gviz(wb, tab, range, cb){
    var base='https://docs.google.com/spreadsheets/d/'+wb+'/gviz/tq?sheet='+encodeURIComponent(tab)+
             (range?'&range='+range:'')+'&headers=0';
    var cbName='__vrRes'+(++_seq);
    var s=document.createElement('script');
    window[cbName]=function(resp){ delete window[cbName]; s.remove();
      cb(resp&&resp.status==='ok'?((resp.table&&resp.table.rows)||[]):null); };
    s.onerror=function(){ delete window[cbName]; s.remove(); cb(null); };
    s.src=base+'&tqx=out:json;responseHandler:'+cbName;
    document.head.appendChild(s);
  }

  var MONTHS={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  // The Index "Date" column is human-written text ("2nd May, 2026"), which
  // Date.parse chokes on because of the ordinal suffix.
  function parseDateText(s){
    s=String(s==null?'':s).trim(); if(!s) return NaN;
    var m=s.match(/^Date\((\d+),(\d+),(\d+)/);              // gviz typed date (month already 0-based)
    if(m) return new Date(+m[1],+m[2],+m[3]).getTime();
    var t=s.replace(/(\d+)(st|nd|rd|th)/gi,'$1');           // "2nd May, 2026" -> "2 May, 2026"
    m=t.match(/(\d{1,2})[\s\/.-]+([A-Za-z]{3,})[,\s\/.-]+(\d{4})/);
    if(m){ var d1=MONTHS[m[2].slice(0,3).toLowerCase()];
      if(d1!=null) return new Date(+m[3],d1,+m[1]).getTime(); }
    m=t.match(/([A-Za-z]{3,})[\s\/.-]+(\d{1,2})[,\s\/.-]+(\d{4})/);
    if(m){ var d2=MONTHS[m[1].slice(0,3).toLowerCase()];
      if(d2!=null) return new Date(+m[3],d2,+m[2]).getTime(); }
    m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m) return new Date(+m[1],+m[2]-1,+m[3]).getTime();
    m=t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);  // day first
    if(m){ var y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[2]-1,+m[1]).getTime(); }
    var p=Date.parse(t); return isNaN(p)?NaN:p;
  }
  function dateMsOf(cell){
    if(!cell) return NaN;
    var byVal=parseDateText(cell.v);
    return isNaN(byVal) ? parseDateText(cell.f) : byVal;
  }
  // Fallback: the sheet's real date column has a blank header, so it can't be
  // found by name — pick up any cell in the row holding a typed gviz date.
  function scanDate(cells){
    for(var i=0;i<(cells||[]).length;i++){
      var v=cells[i]&&cells[i].v;
      if(typeof v==='string'&&/^Date\(\d+,\d+,\d+/.test(v)) return parseDateText(v);
    }
    return NaN;
  }

  function pad2(n){ return String(n).padStart(2,'0'); }
  function slugify(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  // Must match js/previous.js exactly — these slugs are the /past-events links.
  function eventSlug(ev){
    var base=slugify(ev.name);
    if(ev && !isNaN(ev.dateMs)){ var d=new Date(ev.dateMs);
      return base+'-'+pad2(d.getDate())+pad2(d.getMonth()+1)+pad2(d.getFullYear()%100); }
    return base;
  }

  // Event types reported by the stats pages. Each key must equal the normalised
  // EventType from the Index sheet.
  var DISCIPLINES = [
    { key:'rallysprint',        label:'RallySprint'         },
    { key:'reverserallysprint', label:'Reverse RallySprint' },
    { key:'rallycross',         label:'Rallycross'          },
    { key:'stagerally',         label:'Stage Rally'         },
  ];

  // loadEvents({onProgress:fn(done,total)}, cb) -> cb(events|null)
  // Each event: {name, tab, type, date, dateMs, year, slug, parsed}
  function loadEvents(opts, cb){
    opts=opts||{};
    var CFG=(window.VR_CONFIG&&window.VR_CONFIG.previous)||{};
    var COLS=CFG.indexColumns||{}, WB=CFG.workbookId||'';
    if(!WB||/^TODO/i.test(WB)){ cb(null); return; }

    gviz(WB, CFG.indexTabName||'Index', '', function(rows){
      if(rows===null||!rows.length){ cb(rows===null?null:[]); return; }
      var header=(rows[0].c||[]).map(function(c){ return norm(cellVal(c)); });
      var idx=function(n){ return header.indexOf(norm(n)); };
      var iName=idx(COLS.eventName||'EventName'), iType=idx(COLS.eventType||'EventType'),
          iDate=idx(COLS.date||'Date'), iTab=idx(COLS.tabName||'TabName');
      if(iName<0||iTab<0){ cb(null); return; }

      var events=[];
      for(var r=1;r<rows.length;r++){
        var c=rows[r].c||[];
        var name=cellVal(c[iName]).trim(), tab=cellVal(c[iTab]).trim();
        if(!name||!tab) continue;
        var dm = iDate>=0?dateMsOf(c[iDate]):NaN;
        if(isNaN(dm)) dm = scanDate(c);
        var dstr = iDate>=0?cellVal(c[iDate]).trim():'';
        var yr = !isNaN(dm) ? new Date(dm).getFullYear()
                            : (dstr.match(/\b(?:19|20)\d{2}\b/)||[null])[0];
        if(yr!=null) yr=+yr;
        var ev={ name:name, tab:tab,
          type: iType>=0?cellVal(c[iType]).trim():'',
          date: dstr, dateMs: dm, year: yr };
        ev.slug=eventSlug(ev);
        events.push(ev);
      }
      events.sort(function(a,b){
        if(isNaN(a.dateMs)&&isNaN(b.dateMs)) return 0;
        if(isNaN(a.dateMs)) return 1; if(isNaN(b.dateMs)) return -1;
        return b.dateMs-a.dateMs;
      });

      var total=events.length, got=0;
      if(!total){ cb(events); return; }
      if(opts.onProgress) opts.onProgress(0,total);
      events.forEach(function(ev){
        gviz(WB, ev.tab, FETCH_RANGE, function(tabRows){
          ev.parsed = tabRows ? parseEvent(buildGrid(tabRows)) : { overall:[], knockouts:[] };
          got++; if(opts.onProgress) opts.onProgress(got,total);
          if(got===total) cb(events);
        });
      });
    });
  }

  /* Every timed run inside a knockout bracket → [{driver,car,ms,round}].
     Bracket slots carry the same raw time strings qualifying does, so lap
     records can draw on them too. Byes/placeholders, slots where the sheet
     never named a driver, and the 30-minute non-time sentinel are skipped. */
  function koRuns(ko){
    var out=[];
    ['R16','QF','SF','F'].forEach(function(rk){
      ((((ko||{}).rounds)||{})[rk]||[]).forEach(function(m){
        [m.slot1, m.slot2].forEach(function(s){
          if(!s) return;
          var name=String(s.driver||'').trim();
          if(!name || /^(bye|tbd|\?|—|-)$/i.test(name) || isErrText(name)) return;
          var ms=parseTime(s.time);
          if(ms==null || ms<=0 || ms>=SENTINEL) return;
          out.push({ driver:name, car:s.car||'', ms:ms, round:rk });
        });
      });
    });
    return out;
  }

  // Winner + runner-up (top 2) of a knockout final, or null if undecided.
  function finalResult(ko){
    var fm = ko.rounds && ko.rounds['F'];
    if(!fm || !fm.length) return null;
    var f = fm[0];
    var winner = f.slot1.winner ? f.slot1 : (f.slot2.winner ? f.slot2 : null);
    if(!winner) return null;
    var runnerUp = f.slot1.winner ? f.slot2 : f.slot1;
    return { winner: winner, runnerUp: runnerUp };
  }

  return {
    parseEvent: parseEvent,
    finalResult: finalResult,
    koRuns: koRuns,
    buildGrid: buildGrid,
    parseTime: parseTime,
    fmtTime: fmtTime,
    cellVal: cellVal,
    norm: norm,
    isErrText: isErrText,
    driverKey: driverKey,
    betterName: betterName,
    loadEvents: loadEvents,
    eventSlug: eventSlug,
    DISCIPLINES: DISCIPLINES,
  };
})();
