/* Shared results parser for Vaucluse Raceway event tabs.
   Extracts qualifying times + knockout outcomes from a single event grid so
   pages (e.g. the stats page) can aggregate without re-implementing the sheet
   layout. Mirrors the parsing used by js/previous.js; kept standalone so the
   working past-events page is not disturbed. Exposes window.VRResults. */
window.VRResults = (function(){
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

  function cellVal(c){ return c ? (c.f!=null ? String(c.f) : (c.v!=null ? String(c.v) : '')) : ''; }
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
    buildGrid: buildGrid,
    parseTime: parseTime,
    fmtTime: fmtTime,
    cellVal: cellVal,
    norm: norm,
  };
})();
