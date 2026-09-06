(function(){
  /* Spreadsheet error values leak out of the sheet as ordinary text; read them
     as blank so #REF! / #N/A never render on the board. */
  const VR_ERR_RE = /^#(ref|n\/?a|name|value|div\/0|null|num|spill|getting_data)[!?]?$/i;
  const noErr = v => VR_ERR_RE.test(String(v==null?'':v).trim()) ? '' : v;

  /* The round header row ("Round of 16" …) is what every bracket read is
     anchored to — see loadOneKnockoutTab. Every class tab carries it on row 5;
     finding it anywhere else means gviz dropped blank rows above it and the
     whole block needs shifting to compensate. */
  const KO_HEADER_RE = /round\s*of\s*16/i;
  const KO_HEADER_ROW = 5;

  /* =================================================================
     CONFIG
     ================================================================= */
  const CONFIG = {
    sheetId: '1KmJvICKMVe44DewudUdgdW9AhC_Rif83u6CwELpvZls',
    pollSeconds: 10,

    qfTvSideBySide: true,
    qfTvCycleMs: 12000,   
    eventsSheetId: '1ghHvvVe4kNnkVUbYTsBHxrfB2MLH-erhOCvlOBbU3Uc',
    eventsGid:   '1914616841',  
    settingsGid: '1288723697',   
    knockouts: {
      showWinner: false,  
      categories: [
        { name: 'BimmaCup', gid: '2038855303',
          rounds: {
            R16: [
              { match:8, slot1:'H7', slot2:'H9' },
              { match:1, slot1:'H11',  slot2:'H13'  },
              { match:4, slot1:'H15',  slot2:'H17'  },
              { match:5, slot1:'H19', slot2:'H21' },
              { match:6, slot1:'H23', slot2:'H25' },
              { match:3, slot1:'H27',  slot2:'H29'  },
              { match:2, slot1:'H31',  slot2:'H33'  },
              { match:7, slot1:'H35', slot2:'H37' },
            ],
            QF: [
              { match:4, slot1:'L8',  slot2:'L12'  },
              { match:1, slot1:'L16',  slot2:'L20'  },
              { match:2, slot1:'L24',  slot2:'L28'  },
              { match:3, slot1:'L32',  slot2:'L36'  },
              
            ],
            SF: [
              { match:2, slot1:'P10',  slot2:'P18'  },
              { match:1, slot1:'P26',  slot2:'P34'  },
            ],
            F:  [{ match:1, slot1:'T14', slot2:'T30' }],
            W:  'X22',
          }
        },
        { name: 'BimmaCup Jr.', gid: '1123204078',
          rounds: {
            R16: [
              { match:8, slot1:'C7',   slot2:'C9'   },
              { match:1, slot1:'C11',  slot2:'C13'  },
              { match:4, slot1:'C15',  slot2:'C17'  },
              { match:5, slot1:'C19',  slot2:'C21'  },
              { match:6, slot1:'C23',  slot2:'C25'  },
              { match:3, slot1:'C27',  slot2:'C29'  },
              { match:2, slot1:'C31',  slot2:'C33'  },
              { match:7, slot1:'C35',  slot2:'C37'  },
            ],
            QF: [
              { match:4, slot1:'G8',   slot2:'G12'  },
              { match:1, slot1:'G16',  slot2:'G20'  },
              { match:2, slot1:'G24',  slot2:'G28'  },
              { match:3, slot1:'G32',  slot2:'G36'  },
            ],
            SF: [
              { match:2, slot1:'K10',  slot2:'K18'  },
              { match:1, slot1:'K26',  slot2:'K34'  },
            ],
            F:  [{ match:1, slot1:'O14', slot2:'O30' }],
            W:  'S22',
          }
        },
        { name: 'Touring', gid: '1830775932',
          rounds: {
            R16: [
              { match:8, slot1:'C7',   slot2:'C9'   },
              { match:1, slot1:'C11',  slot2:'C13'  },
              { match:4, slot1:'C15',  slot2:'C17'  },
              { match:5, slot1:'C19',  slot2:'C21'  },
              { match:6, slot1:'C23',  slot2:'C25'  },
              { match:3, slot1:'C27',  slot2:'C29'  },
              { match:2, slot1:'C31',  slot2:'C33'  },
              { match:7, slot1:'C35',  slot2:'C37'  },
            ],
            QF: [
              { match:4, slot1:'G8',   slot2:'G12'  },
              { match:1, slot1:'G16',  slot2:'G20'  },
              { match:2, slot1:'G24',  slot2:'G28'  },
              { match:3, slot1:'G32',  slot2:'G36'  },
            ],
            SF: [
              { match:2, slot1:'K10',  slot2:'K18'  },
              { match:1, slot1:'K26',  slot2:'K34'  },
            ],
            F:  [{ match:1, slot1:'O14', slot2:'O30' }],
            W:  'S22',
          }
        },
        { name: 'AWD', gid: '2111958111',
          rounds: {
            R16: [
              { match:8, slot1:'H7',   slot2:'H9'   },
              { match:1, slot1:'H11',  slot2:'H13'  },
              { match:4, slot1:'H15',  slot2:'H17'  },
              { match:5, slot1:'H19',  slot2:'H21'  },
              { match:6, slot1:'H23',  slot2:'H25'  },
              { match:3, slot1:'H27',  slot2:'H29'  },
              { match:2, slot1:'H31',  slot2:'H33'  },
              { match:7, slot1:'H35',  slot2:'H37'  },
            ],
            QF: [
              { match:4, slot1:'L8',   slot2:'L12'  },
              { match:1, slot1:'L16',  slot2:'L20'  },
              { match:2, slot1:'L24',  slot2:'L28'  },
              { match:3, slot1:'L32',  slot2:'L36'  },
            ],
            SF: [
              { match:2, slot1:'P10',  slot2:'P18'  },
              { match:1, slot1:'P26',  slot2:'P34'  },
            ],
            F:  [{ match:1, slot1:'T14', slot2:'T30' }],
            W:  'X22',
          }
        },
      ],
    },


    heats: {
      gid: '1005565792',
      range: 'B5:V66',
      runLabels: ['Qualifying 1','Qualifying 2','Qualifying 3','Qualifying 4'],

      heatCol: 0,
      blocks: [
        { num: 2, driver: 3, time: 4 },
        { num: 7, driver: 8, time: 9 },
        { num: 12, driver: 13, time: 14 },
        { num: 17, driver: 18, time: 19 },
      ],
      entriesPerHeat: 2,              
    },
  };
  const SENTINEL_MS = 30*60000;   

  /* ===== TIME HELPERS ===== */
  function parseTimeRaw(v){
    if(v==null||v==='') return null;
    if(typeof v==='number'&&!isNaN(v)) return Math.round(v*1000);
    const s=String(v).trim(); if(!s||/^(dnf|dns|dsq|—|-)$/i.test(s)) return null;
    const p=s.split(/[:.]/).map(x=>x.trim());
    if(p.some(x=>x===''||isNaN(x))){ const f=parseFloat(s); return isNaN(f)?null:Math.round(f*1000); }
    const padMs=x=>(String(x)+'000').slice(0,3); let min=0,sec=0,ms=0;
    if(p.length>=3){ min=+p[0]; sec=+p[1]; ms=+padMs(p[2]); }
    else if(p.length===2){ if(/\./.test(s)&&!/:/.test(s)){ sec=+p[0]; ms=+padMs(p[1]); } else { min=+p[0]; sec=+p[1]; } }
    else sec=+p[0];
    return ((min*60)+sec)*1000+ms;
  }
  /* A lap can never take zero time. When the timing gear faults it writes
     0:00:000, which would otherwise sort straight to the top of the leaderboard
     and stand as the fastest lap on record — it did exactly that at one event.
     Treat any non-positive result as no time at all; every caller already
     handles null, so this one guard covers sorting, records, personal bests and
     the bracket ADV/winner comparisons at once. */
  function parseTime(v){ const n=parseTimeRaw(v); return (typeof n==='number'&&isFinite(n)&&n>0) ? n : null; }
  /* The raw cell text is rendered verbatim in brackets, so a zero time has to be
     recognised there too — "0:00:000", "00:00.000", "0". Kept separate from
     parseTime so genuine DNF/DNS text still shows. */
  function isZeroTime(v){ const s=String(v==null?'':v).trim(); return /^[0:.]+$/.test(s) && s.indexOf('0')>=0; }
  function fmtTime(ms){ if(ms==null) return '—'; let t=Math.round(ms);
    const m=Math.floor(t/60000); t-=m*60000; const s=Math.floor(t/1000), mm=t-s*1000;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+':'+String(mm).padStart(3,'0'); }
  function fmtGap(ms){ const s=Math.floor(ms/1000), mm=ms%1000; return '+'+s+'.'+String(mm).padStart(3,'0'); }

  /* ===== STATE ===== */
  let _gvizSeq=0; 
  let activeView=0, lastChange=Date.now(), lastDataStr='', tvOn=false;
  let prevPos={}, prevOverallMs={}, prevHeatMs={};
  const el=id=>document.getElementById(id), root=el('lb'), list=el('lbList'), grid=el('lbHeatGrid');

  [...el('lbTabs').children].forEach(b=>b.onclick=()=>setView(+b.dataset.view));
  function setView(i){ activeView=i; [...el('lbTabs').children].forEach(b=>b.classList.toggle('active',+b.dataset.view===i));
    el('lbQualifying').classList.toggle('hide',i!==0); el('lbKnockouts').classList.toggle('hide',i!==1);
    el('lbTitleSub').textContent = i===1 ? '· Knockouts' : '· Qualifying'; }

  function avatarColor(n){let h=0;for(let i=0;i<n.length;i++)h=n.charCodeAt(i)+((h<<5)-h);return`hsl(${Math.abs(h)%360} 70% 62%)`;}
  function initials(n){return n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();}

  /* ===== DERIVE OVERALL FROM HEATS ===== */
  function deriveOverall(runs){
    const best={};
    runs.forEach(run=> run.heats.forEach(h=> h.entries.forEach(e=>{
      if(e.ms==null||e.ms>=SENTINEL_MS) return; const k=String(e.num);
      if(!best[k]||e.ms<best[k].ms) best[k]={num:e.num,driver:e.driver,ms:e.ms,round:run.label,heat:h.heat};
    })));
    const rows=Object.values(best).map(d=>({id:String(d.num),num:d.num,driver:d.driver,ms:d.ms,round:d.round,heat:d.heat,
      _changed: prevOverallMs[String(d.num)]!=null && prevOverallMs[String(d.num)]!==d.ms}));
    rows.sort((a,b)=>a.ms-b.ms);
    rows.forEach(r=> prevOverallMs[String(r.num)]=r.ms);
    return rows;
  }

  /* ===== RENDER OVERALL (with FLIP) ===== */
  function renderOverall(rows){
    list.style.zoom=''; 
    const first={}; [...list.children].forEach(r=> first[r.dataset.id]=r.getBoundingClientRect().top);
    const leaderMs=rows[0]?.ms ?? null;
    list.innerHTML='';
    rows.forEach((d,idx)=>{
      const pos=idx+1, prev=prevPos[d.id];
      let trend='same', sym='–';
      if(prev!=null&&prev>pos){trend='up'; sym='▲'+(prev-pos);} else if(prev!=null&&prev<pos){trend='down'; sym='▼'+(pos-prev);}
      const row=document.createElement('div');
      row.className='lb__row'+(pos===1?' p1':pos===2?' p2':pos===3?' p3':''); row.dataset.id=d.id;
      const gap=d.ms===leaderMs?'FASTEST':fmtGap(d.ms-leaderMs);
      const roundShort=d.round?'QF'+((d.round.match(/\d+/)||[''])[0]):'';
      const roundLbl=roundShort?`<span class="lb__round">${roundShort}</span>`:'';
      row.innerHTML=`<div class="lb__pos">${pos}</div><div class="lb__num">${d.num}</div>`+
        `<div class="lb__who"><div style="min-width:0"><div class="lb__name">${d.driver}</div></div></div>`+
        `<div class="lb__end"><span class="lb__trend ${trend}">${sym}</span>`+
        `<div class="lb__time${d.ms===leaderMs?' best':''}">${fmtTime(d.ms)}<small>${gap}</small></div>${roundLbl}</div>`;
      list.appendChild(row);
      if(d._changed) row.classList.add('flash');
      prevPos[d.id]=pos;
    });
    [...list.children].forEach((r,i)=>{ const f=first[r.dataset.id];
      if(f!=null){ const dy=f-r.getBoundingClientRect().top; if(dy){ r.style.transform=`translateY(${dy}px)`; r.style.transition='none';
        requestAnimationFrame(()=>{ r.style.transition='transform .55s cubic-bezier(.2,.8,.2,1)'; r.style.transform=''; }); } }
      else { r.style.opacity='0'; r.style.transform='translateY(8px)';
        requestAnimationFrame(()=>{ r.style.transition='all .4s ease '+(i*0.03)+'s'; r.style.opacity=''; r.style.transform=''; }); }
    });
    if(tvOn) scaleTvList();
  }

  /* ===== RENDER HEATS GRID ===== */
  function renderHeats(runs){
    grid.innerHTML='';
    // Column count follows the runs that actually have data (3 or 4).
    grid.style.setProperty('--hcols', String(Math.max(1,runs.length)));
    runs.forEach(run=>{
      let runBest=Infinity; run.heats.forEach(h=>h.entries.forEach(e=>{ if(e.ms!=null&&e.ms<SENTINEL_MS&&e.ms<runBest) runBest=e.ms; }));
      const col=document.createElement('div'); col.className='lb__hcol';
      let html=`<div class="lb__hcolhead"><span>${run.label}</span><span class="t">Time</span></div>`;
      run.heats.forEach(h=>{
        html+=`<div class="lb__heat"><div class="lb__heatno">${h.heat}</div><div class="lb__hpair">`;
        const heatBest=h.entries.reduce((b,e)=>(e.ms!=null&&e.ms<SENTINEL_MS&&(b===null||e.ms<b))?e.ms:b, null);
        h.entries.forEach(e=>{
          const key=run.label+'|'+e.num, changed=prevHeatMs[key]!=null&&prevHeatMs[key]!==e.ms; prevHeatMs[key]=e.ms;
          const dnf=e.ms==null||e.ms>=SENTINEL_MS;
          const isHeatFastest=!dnf&&heatBest!==null&&e.ms===heatBest;
          const cls=dnf?'dnf':(e.ms===runBest?'best':'');
          html+=`<div class="lb__hentry${changed?' flash':''}${isHeatFastest?' heat-best':''}"><span class="lb__hnum">${e.num}</span>`+
            `<span class="lb__hdrv">${e.driver}</span><span class="lb__htime ${cls}">${dnf?'—':fmtTime(e.ms)}</span></div>`;
        });
        html+=`</div></div>`;
      });
      col.innerHTML=html; grid.appendChild(col);
    });
  }

  function hideLoading(){
    const s=el('lbSpinner'); if(s) s.classList.add('done');
    const v=el('lbViews'); if(v) v.classList.remove('loading');
  }

  function markUpdated(ok,dataChanged){
    if(dataChanged){ lastChange=Date.now(); const u=el('lbUpdated'); u.classList.add('flash'); setTimeout(()=>u.classList.remove('flash'),350); }
    el('lbErr').style.display=ok?'none':'block'; }
  setInterval(()=>{ const s=Math.round((Date.now()-lastChange)/1000);
    let txt; if(s<2) txt='just now'; else if(s<60) txt='updated '+s+'s ago';
    else { const m=Math.floor(s/60), r=s%60; txt='updated '+m+'m'+(r?' '+r+'s':'')+' ago'; }
    el('lbUpdatedTxt').textContent=txt; },1000);

  /* ===== LIVE ===== */
  function loadLive(cb){
    const h=CONFIG.heats;
    const base=`https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?gid=${h.gid}`+(h.range?`&range=${h.range}`:'');
    const cbName='__gvizCb'+Date.now();
    const script=document.createElement('script');
    window[cbName]=function(resp){
      delete window[cbName]; script.remove();
      if(resp.status!=='ok'){
        const msg=(resp.errors&&resp.errors[0]&&(resp.errors[0].detailed_message||resp.errors[0].message))||'unknown error';
        el('lbErr').textContent='Sheet error: '+msg+' — ensure sheet is shared ("Anyone with link") and published to the web (File > Share > Publish to web).'; hideLoading(); markUpdated(false,false); return;
      }
      const rows=resp.table.rows||[];
      const getVal=(r,c)=>{ if(c==null) return ''; const cell=rows[r]&&rows[r].c&&rows[r].c[c]; if(!cell) return ''; return noErr(cell.f!=null?cell.f:(cell.v!=null?String(cell.v):'')); };
      const runs=h.runLabels.map(l=>({label:l, heats:[]}));
      let curHeat=''; const rowsByHeat={};
      /* The heat-number column is only authoritative while it still lines up
         with the entry rows — one number on the first row of each heat, carried
         down to the rest. A regenerated sheet can leave that column offset, with
         the numbers sitting on blank rows below the entry list; every entry row
         then failed the `!curHeat` guard below, the parse returned nothing and
         the whole board went blank. Fall back to numbering heats by position in
         that case: heats are fixed blocks of entriesPerHeat consecutive rows, so
         a well-formed sheet produces exactly the same grouping either way. */
      const rowHasEntry=r=>h.blocks.some(b=>
        String(getVal(r,b.driver)||'').trim()||String(getVal(r,b.num)||'').trim());
      let heatColOk=false;
      for(let r=0;r<rows.length;r++){
        if(String(getVal(r,h.heatCol)||'').trim()&&rowHasEntry(r)){ heatColOk=true; break; }
      }
      const perHeat=Math.max(1,h.entriesPerHeat||2);
      const seen={};
      for(let r=0;r<rows.length;r++){
        const hn=String(getVal(r,h.heatCol)||'').trim(); if(hn) curHeat=hn;
        if(heatColOk&&!curHeat) continue;
        h.blocks.forEach((b,bi)=>{
          const num=String(getVal(r,b.num)||'').trim(), drv=String(getVal(r,b.driver)||'').trim();
          if(!drv&&!num) return;
          if(!rowsByHeat[bi]){ rowsByHeat[bi]={}; seen[bi]=0; }
          const key=heatColOk?curHeat:String(Math.floor(seen[bi]/perHeat)+1);
          seen[bi]++;
          if(!rowsByHeat[bi][key]) rowsByHeat[bi][key]=[];
          rowsByHeat[bi][key].push({num,driver:drv,ms:parseTime(getVal(r,b.time))});
        });
      }
      h.blocks.forEach((b,bi)=>{ const map=rowsByHeat[bi]||{};
        Object.keys(map).forEach(hn=>runs[bi].heats.push({heat:hn,entries:map[hn]})); });
      /* Every run needs rows to earn a column. The LAST run — Qualifying 4 —
         additionally needs at least one actual time: the sheet is usually
         pre-loaded with the full entry list, so at an event that only runs three
         rounds it had names in it from the start and rendered as a permanently
         blank column.

         The extra condition is deliberately limited to the last run. Q1-Q3 show
         as soon as they have rows, so a round that is staging or part-way
         through its first heat is never hidden. Live board only — past events
         and stats keep the rows-only rule for every round. */
      const lastRun=h.runLabels.length-1;
      cb(runs.filter((run,i)=>run.heats.length &&
        (i!==lastRun || run.heats.some(ht=>ht.entries.some(e=>e.ms!=null)))));
    };
    script.onerror=function(){ delete window[cbName]; script.remove();
      el('lbErr').textContent='Could not reach data'; hideLoading(); markUpdated(false,false); };
    script.src=base+'&tqx=out:json;responseHandler:'+cbName;
    document.head.appendChild(script);
  }

  /* ===== EVENTS / SETTINGS SHEET  ===== */
 
  function gvizRows(gid, cb){
    const base=`https://docs.google.com/spreadsheets/d/${CONFIG.eventsSheetId}/gviz/tq?gid=${gid}&headers=0`;
    const cbName='__gvizCfg'+(++_gvizSeq);
    const script=document.createElement('script');
    window[cbName]=function(resp){ delete window[cbName]; script.remove();
      cb(resp&&resp.status==='ok'?((resp.table&&resp.table.rows)||[]):null); };
    script.onerror=function(){ delete window[cbName]; script.remove(); cb(null); };
    script.src=base+'&tqx=out:json;responseHandler:'+cbName;
    document.head.appendChild(script);
  }
  const cellVal=c=>noErr(c?(c.f!=null?c.f:(c.v!=null?String(c.v):'')):'');


  function loadLiveStatus(){
    gvizRows(CONFIG.eventsGid, rows=>{
      if(!rows){ el('lbLive').style.display='none'; el('lbUpdated').style.display='none'; return; }
      const headers=(rows[0]&&rows[0].c||[]).map(c=>String(cellVal(c)).trim().toLowerCase());
      const liveIdx=headers.indexOf('live'); const typeIdx=headers.indexOf('type'); let live=false;
      if(liveIdx>=0) for(let r=1;r<rows.length;r++){
        const cells=rows[r].c||[];
        const isLive=String(cellVal(cells[liveIdx])).trim().toLowerCase()==='yes';
        const isRallySprint=typeIdx>=0 && String(cellVal(cells[typeIdx])).trim().toLowerCase()==='rallysprint';
        if(isLive&&isRallySprint){ live=true; break; }
      }
      el('lbLive').style.display=live?'':'none';
      el('lbUpdated').style.display=live?'':'none';
    });
  }

  function loadSettings(cb){
    gvizRows(CONFIG.settingsGid, rows=>{
      const out={};
      if(rows) rows.forEach(r=>{
        const cells=r.c||[]; const k=String(cellVal(cells[0])).trim();
        if(k) out[k.toLowerCase().replace(/[^a-z0-9]/g,'')]=String(cellVal(cells[1])).trim();
      });
      cb(out);
    });
  }
  function applySettings(s){
    const truthy=v=>/^(yes|true|1|on)$/i.test(String(v||'').trim());
    if(s.title){ const t=el('lbTitleName'); if(t) t.textContent=s.title; }
    if(s.date){ const d=el('lbDate'); if(d) d.textContent=s.date; }
    if('showwinner' in s) CONFIG.knockouts.showWinner=truthy(s.showwinner);
    if('qftvsidebyside' in s) CONFIG.qfTvSideBySide=truthy(s.qftvsidebyside);

    CONFIG.knockouts.categories=CONFIG.knockouts.categories.filter(cat=>{
      const key='show'+cat.name.toLowerCase().replace(/[^a-z0-9]/g,'');
      return (key in s)?truthy(s[key]):true;
    });
  }

  /* ===== ORCHESTRATION ===== */
  function cycle(isInit){
    const done=runs=>{
      const str=JSON.stringify(runs.map(r=>r.heats.map(h=>h.entries.map(e=>[e.num,e.driver,e.ms]))));
      const changed=str!==lastDataStr; lastDataStr=str;
      // Only re-render when the data actually changed — otherwise the 10s poll
      // rebuilds the list every time and re-triggers the row animation ("jump").
      if(changed||isInit){ renderHeats(runs); renderOverall(deriveOverall(runs)); }
      hideLoading();
      if(!isInit) markUpdated(true,changed);
    };
    loadLive(done);
  }
  function start(){ cycle(true); markUpdated(true,true); loadLiveStatus();
    setInterval(()=>{ cycle(false); loadLiveStatus(); }, CONFIG.pollSeconds*1000); }

  /* ===== TV "OVERALL FASTEST" AUTO-FIT =====
      */
  function scaleTvList(){
    list.style.zoom='';
    list.classList.remove('tvcols');
    list.style.removeProperty('height');
    list.style.removeProperty('--tvcols');
    if(!tvOn) return;
    requestAnimationFrame(()=>{
      const listRect=list.getBoundingClientRect();
 
      const credit=root.querySelector('.lb__credit');
      const limitBottom=credit?credit.getBoundingClientRect().top-8
                              :el('lbViews').getBoundingClientRect().bottom-4;
      const availH=limitBottom-listRect.top;
      const listH=list.scrollHeight;
      if(!(listH>availH&&availH>0)) return;  
      if(root.classList.contains('tvsolo')){
        const cols=Math.max(2, Math.ceil(listH/availH));
        list.style.setProperty('--tvcols', cols);
        list.style.height=availH+'px';
        list.classList.add('tvcols');
      } else {
        list.style.zoom=String(Math.max(0.55,availH/listH).toFixed(3));
      }
    });
  }

  /* ===== TV MODE (both views) ===== */
  let tvHideTimer=null, tvQfCat=0, tvQfInterval=null;
  const tvExit=el('lbTvExit');
  function showTvExit(){ tvExit?.classList.add('show'); clearTimeout(tvHideTimer); tvHideTimer=setTimeout(()=>tvExit?.classList.remove('show'),3000); }

  function setTvQf(i){ tvQfCat=i;
    el('lbOverall').classList.toggle('qf-hidden', i!==0);
    el('lbHeats').classList.toggle('qf-hidden', i!==1);
    if(i===0 && tvOn) requestAnimationFrame(scaleTvList); }
  function startQfCycle(){
    root.classList.add('tvsolo'); setTvQf(0);
    clearInterval(tvQfInterval);
    tvQfInterval=setInterval(()=>setTvQf((tvQfCat+1)%2), CONFIG.qfTvCycleMs);
  }
  function stopQfCycle(){
    clearInterval(tvQfInterval); tvQfInterval=null;
    root.classList.remove('tvsolo');
    el('lbOverall').classList.remove('qf-hidden'); el('lbHeats').classList.remove('qf-hidden');
  }
  function enterTV(){ tvOn=true; root.classList.add('tv'); el('lbTitleSub').textContent='· Qualifying';
    if(CONFIG.qfTvSideBySide) stopQfCycle(); else startQfCycle();
    showTvExit(); requestAnimationFrame(scaleTvList); if(root.requestFullscreen) root.requestFullscreen().catch(()=>{}); }
  function exitTV(keepFs){ tvOn=false; root.classList.remove('tv'); stopQfCycle(); list.style.zoom=''; clearTimeout(tvHideTimer); tvExit?.classList.remove('show'); if(!keepFs && document.fullscreenElement) document.exitFullscreen().catch(()=>{}); }
  document.addEventListener('mousemove',()=>{ if(tvOn||ktvOn) showTvExit(); });

  { const b=el('lbTvBtn'); if(b) b.onclick=enterTV; }
  if(tvExit) tvExit.onclick=()=>{ exitTV(); exitKnockoutTV(); };
  /* Enter toggles between Qualifying TV and Knockout TV without leaving fullscreen */
  function toggleTvMode(){
    if(tvOn){ exitTV(true); enterKnockoutTV(); }
    else if(ktvOn){ exitKnockoutTV(true); setView(0); enterTV(); }
  }
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ exitTV(); exitKnockoutTV(); }
    else if(e.key==='Enter' && (tvOn||ktvOn)){ e.preventDefault(); toggleTvMode(); }
  });

  /* ===== KNOCKOUTS ===== */
  let activeCat=0, knockoutData=null, lastKnockoutStr='';
  let ktvOn=false, ktvCat=0, ktvInterval=null;

  /* --- 'H5' → { col:7, row:4 } (both 0-based) --- */
  function cellToIndex(ref){
    const m=ref.match(/^([A-Za-z]+)(\d+)$/); if(!m) return null;
    let col=0; for(const ch of m[1].toUpperCase()) col=col*26+(ch.charCodeAt(0)-64);
    return {col:col-1, row:+m[2]-1};
  }
  /* --- 0-based col index → letter(s): 7 → 'H' --- */
  function colLetter(n){ let s='',k=n+1;
    while(k>0){s=String.fromCharCode(65+(k-1)%26)+s; k=Math.floor((k-1)/26);} return s; }

  /* --- JSONP fetch for one class tab ---
     Deliberately sent WITHOUT a `range`. gviz omits any row that is blank
     across the range it was asked for — not just at the edges, anywhere in the
     middle — and gives no row numbers back, so a narrow range around the
     bracket silently loses rows the moment part of that bracket is empty and
     every row below it shifts up. Reading the whole tab keeps those rows alive
     on the strength of the helper columns either side of the bracket, which the
     knockout results never touch. Costs ~22KB per class instead of ~6KB. */
  function loadOneRound(gid, cb){
    const base=`https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?gid=${gid}`;
    const cbName='__gvizKo'+(++_gvizSeq);
    const script=document.createElement('script');
    window[cbName]=function(resp){ delete window[cbName]; script.remove(); cb(resp.status==='ok'?(resp.table||null):null); };
    script.onerror=function(){ delete window[cbName]; script.remove(); cb(null); };
    script.src=base+'&headers=0&tq=select%20*&tqx=out:json;responseHandler:'+cbName;
    document.head.appendChild(script);
  }


  function loadOneKnockoutTab(catCfg, cb){
    const ROUND_KEYS=['R16','QF','SF','F'];
    if(!catCfg.gid || !catCfg.rounds){ cb({name:catCfg.name, rounds:{}}); return; }

    /* The whole tab comes back, so a cell's row index is simply its sheet row
       minus one — unless gviz dropped a blank row above it, which shifts every
       row below up. Re-finding the round header tells us by how much. */
    let fetchedRows=[], colIdx=null, rowShift=0;
    function readCell(ref){
      if(!ref) return ''; const p=cellToIndex(ref); if(!p) return '';
      const c=colIdx?colIdx[colLetter(p.col)]:null; if(c==null) return '';
      const r=p.row+rowShift; if(r<0) return '';
      const row=fetchedRows[r]; if(!row||!row.c||row.c[c]==null) return '';
      const cell=row.c[c]; return noErr(String(cell.f!=null?cell.f:(cell.v!=null?cell.v:'')).trim());
    }
    function colShift(ref,n){ const p=cellToIndex(ref); if(!p) return ''; return colLetter(p.col+n)+(p.row+1); }
    // Bracket slots print their time cell verbatim, so a faulted 0:00:000 has to
    // be blanked here as well as ignored by parseTime.
    function slotTime(ref){ const v=readCell(colShift(ref,2)); return isZeroTime(v) ? '' : v; }
    function cellText(row,c){ return c==null?'':String(c.f!=null?c.f:(c.v!=null?c.v:'')).trim(); }

    loadOneRound(catCfg.gid, table=>{
      fetchedRows=(table&&table.rows)||[];

      // Map columns by the ids gviz reports rather than by position, so a
      // column can never drift either.
      colIdx={}; ((table&&table.cols)||[]).forEach((c,i)=>{ if(c&&c.id) colIdx[c.id]=i; });

      const hIdx=fetchedRows.findIndex(row=>((row&&row.c)||[]).some(c=>
        c && KO_HEADER_RE.test(cellText(row,c))));
      rowShift = hIdx>=0 ? hIdx-(KO_HEADER_ROW-1) : 0;

      /* Last line of defence. The sheet labels its own final two rows above the
         first finalist, one column right of the car number. If that label is in
         the response but not where the config expects it, rows have gone
         missing below the header and nothing under them lines up — better to
         say so than to render names against the wrong matches. Tabs that carry
         no labels at all (Touring) simply skip the check. */
      let misaligned=false;
      const fdef=(catCfg.rounds.F||[])[0], fp=fdef&&fdef.slot1?cellToIndex(fdef.slot1):null;
      if(fp){
        const seen=fetchedRows.some(row=>((row&&row.c)||[]).some(c=>c&&/^final$/i.test(cellText(row,c))));
        if(seen && !/^final$/i.test(readCell(colLetter(fp.col+1)+(fp.row-1)))) misaligned=true;
      }

      const roundResults={};
      ROUND_KEYS.forEach(rk=>{
        const defs=catCfg.rounds[rk]; if(!Array.isArray(defs)) return;
        roundResults[rk]=defs.map(d=>({match:d.match,
          slot1:{car:readCell(d.slot1), driver:readCell(colShift(d.slot1,1)), time:slotTime(d.slot1)},
          slot2:{car:readCell(d.slot2), driver:readCell(colShift(d.slot2,1)), time:slotTime(d.slot2)}}));
      });

      let winnerCar='';
      if(typeof catCfg.rounds.W==='string') winnerCar=readCell(catCfg.rounds.W);

      /* Keep the bracket skeleton intact. Dropping the matches the sheet hasn't
         filled in yet collapses a round from eight slots to however many have
         run, and because every column divides its height evenly the survivors
         stop lining up with the round they feed — one half-run R16 drags the
         whole bracket out of alignment. So skip the rounds before the first one
         carrying data (a field that starts at the quarter-finals has no round of
         16), then render every round from there on in full, empty slots and all.
         The Finals column stays on screen as TBD while the semis are running. */
      const hasData=rk=>(roundResults[rk]||[]).some(m=>m.slot1.car||m.slot1.driver||m.slot2.car||m.slot2.driver);
      const firstLive=ROUND_KEYS.findIndex(hasData);
      const rounds={};
      if(firstLive>=0) ROUND_KEYS.slice(firstLive).forEach(rk=>{
        if(roundResults[rk]) rounds[rk]=roundResults[rk];
      });

      const fm=rounds['F'];
      if(fm&&fm.length){
        const final=fm[0];
        if(winnerCar){ final.slot1.winner=final.slot1.car===winnerCar; final.slot2.winner=final.slot2.car===winnerCar; }
        else{ const t0=parseTime(final.slot1.time),t1=parseTime(final.slot2.time);
          if(t0!=null&&t1!=null){final.slot1.winner=t0<=t1; final.slot2.winner=!final.slot1.winner;}
          else if(t0!=null) final.slot1.winner=true; else if(t1!=null) final.slot2.winner=true; }
      }

      cb({name:catCfg.name, rounds, misaligned});
    });
  }

  function loadKnockouts(cb){
    const cats=CONFIG.knockouts.categories; const results=new Array(cats.length).fill(null); let remaining=cats.length;
    cats.forEach((catCfg,i)=>{ loadOneKnockoutTab(catCfg, data=>{ results[i]=data;
      if(--remaining===0) cb(results.every(r=>r===null)?null:results); }); });
  }


  function makeSlot(slot, adv){
    const isBye=slot.car==='Bye'||slot.driver==='Bye'||(!slot.driver&&(slot.car===''||slot.car==='?'));
    const isTbd=!slot.driver&&!isBye;
    let cls='lb__bslot'+(slot.winner?' winner':isBye?' bye':isTbd?' tbd':'');
    const carDisp=slot.car||'';
    const nameDisp=slot.driver||'TBD';
    const timeDisp=slot.time&&slot.time!==''?`<span class="lb__btime">${slot.time}</span>`:'';
    const advBadge=adv?`<span class="lb__badv">ADV</span>`:'';
    return `<div class="${cls}"><span class="lb__bnum">${carDisp}</span><span class="lb__bname">${nameDisp}</span>${advBadge}<span class="lb__bfill"></span>${timeDisp}</div>`;
  }


  function renderBracket(catData){
    const bracket=el('lbBracket');
    const note=msg=>{ bracket.innerHTML=`<div class="lb__bempty">${msg}</div>`; };
    if(!catData){ note('No data yet — check the sheet is published and that the cell ranges in CONFIG still match the tab layout.'); return; }
    if(catData.misaligned){ note('Bracket rows do not line up with the sheet — the tab layout has moved from what CONFIG expects.'); return; }
    const ROUND_LABELS={R16:'Round of 16', QF:'Quarter-Finals', SF:'Semi-Finals', F:'Finals'};
    const ROUNDS=['R16','QF','SF','F'];
    let html='';
    ROUNDS.forEach(rk=>{
      const matches=catData.rounds[rk]||[];
      if(!matches.length) return;
      html+=`<div class="lb__bround"><div class="lb__broundhead">${ROUND_LABELS[rk]||rk}</div><div class="lb__bmatches">`;
      function mkMatch(m){
        let h=`<div class="lb__bmatchlabel">${rk==='F'?'Final':`${rk}#${m.match}`}</div>`;
        let adv1=false, adv2=false;
        if(rk!=='F'){
          const s1Active=!!(m.slot1.car||m.slot1.driver);
          const s2Active=!!(m.slot2.car||m.slot2.driver);
          const s1Absent=!s1Active||m.slot1.car==='Bye'||m.slot1.driver==='Bye';
          const s2Absent=!s2Active||m.slot2.car==='Bye'||m.slot2.driver==='Bye';
          if(s1Active&&s2Absent){ adv1=true; }
          else if(s2Active&&s1Absent){ adv2=true; }
          else{ const t1=parseTime(m.slot1.time),t2=parseTime(m.slot2.time);
            if(t1!=null&&t2!=null){ adv1=t1<=t2; adv2=!adv1; } }
        }
        return h+makeSlot(m.slot1,adv1)+makeSlot(m.slot2,adv2);
      }
      for(let pi=0; pi<matches.length; pi+=2){
        const m1=matches[pi], m2=matches[pi+1];
        if(!m1) continue;
        const hasPair=!!m2;
        html+=`<div class="lb__bpair${hasPair?'':' single'}">`;
        html+=`<div class="lb__bmatch">${mkMatch(m1)}</div>`;
        if(hasPair) html+=`<div class="lb__bmatch">${mkMatch(m2)}</div>`;
        html+=`</div>`;
      }
      html+=`</div></div>`;
    });
    if(!html){ note('Bracket not started yet.'); return; }

    // Winner column
    const finalsMatches=catData.rounds['F'];
    if(CONFIG.knockouts.showWinner&&finalsMatches&&finalsMatches.length){
      const final=finalsMatches[0];
      const winnerSlot=final.slot1.winner?final.slot1:(final.slot2.winner?final.slot2:null);
      const displaySlot=winnerSlot||{car:'?',driver:'TBD',time:''};
      html+=`<div class="lb__bwinner"><div class="lb__bwinnerlabel">Winner</div>`;
      html+=`<div class="lb__bwinnerslot">${makeSlot({...displaySlot,winner:!!winnerSlot})}</div></div>`;
    }
    bracket.innerHTML=html;
  }

 
  function setCat(i){
    activeCat=i;
    [...el('lbKcatBtns').children].forEach(b=>b.classList.toggle('active',+b.dataset.cat===i));
    if(knockoutData) renderBracket(knockoutData[i]);
  }

  function buildCatButtons(){
    const wrap=el('lbKcatBtns');
    wrap.innerHTML=CONFIG.knockouts.categories.map((cat,i)=>
      `<button class="lb__kcatbtn${i===0?' active':''}" data-cat="${i}">${cat.name}</button>`).join('');
    [...wrap.children].forEach(b=>b.onclick=()=>setCat(+b.dataset.cat));
  }

  function knockoutCycle(){
    loadKnockouts(cats=>{
      if(!cats) return;
      const str=JSON.stringify(cats);
      const changed=str!==lastKnockoutStr; lastKnockoutStr=str;
      knockoutData=cats;
      if(changed){
        if(ktvOn) renderBracket(knockoutData[ktvCat]);
        else renderBracket(knockoutData[activeCat]);
      }
    });
  }
  function startKnockouts(){
    knockoutCycle();
    setInterval(knockoutCycle, CONFIG.pollSeconds*1000);
  }


  function setKtvCat(i){
    const label=el('lbKtvLabel');
    label.style.opacity='0';
    setTimeout(()=>{
      ktvCat=i;
      if(knockoutData&&knockoutData[i]) renderBracket(knockoutData[i]);
      label.textContent=(knockoutData&&knockoutData[i])?knockoutData[i].name:'';
      label.style.opacity='1';
    },300);
  }
  function enterKnockoutTV(){
    ktvOn=true;
    setView(1);
    root.classList.add('ktv');
    setKtvCat(0);
    showTvExit();
    ktvInterval=setInterval(()=>{
      const next=(ktvCat+1)%((knockoutData&&knockoutData.length)||1);
      setKtvCat(next);
    },12000);
    if(root.requestFullscreen) root.requestFullscreen().catch(()=>{});
  }
  function exitKnockoutTV(keepFs){
    if(!ktvOn) return;
    ktvOn=false;
    clearInterval(ktvInterval); ktvInterval=null;
    root.classList.remove('ktv');
    el('lbKtvLabel').style.opacity='0';
    clearTimeout(tvHideTimer); tvExit?.classList.remove('show');
    if(!keepFs && document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  }
  { const b=el('lbKtvBtn'); if(b) b.onclick=enterKnockoutTV; }

  /* ===== BOOT: load settings first, apply, then start everything ===== */
  function boot(){
    buildCatButtons();   
    start();
    startKnockouts();
  }
  loadSettings(s=>{ applySettings(s); boot(); });
})();