/* RallyCross live board for /happening-now.
   Shown instead of the RallySprint board when js/shell.js routes to 'rx'
   (a live "RallyCross" row in the Live Calendar, or ?event=rx).

   Data: MASTER Streaming RX → "Web" tab, three tables read with gviz JSONP,
   each with &headers=1 and its own &range, columns looked up BY HEADER LABEL:
     Qualifying  Round | Heat | Class | No | Driver | Time | P
     Knockouts   Class | Race | Start | GridTime | No | Driver | Time | Finish
     Settings    Setting | Value   (DriversPerHeat, Class1 … ClassN)
   Ids / gids / ranges live in window.VR_CONFIG.rx (config.js).

   Everything renders into #rx… elements so the RallySprint scripts (board.js,
   classfilter.js, qualtabs.js), which work on #lb…, never touch this board. */
(function(){
  const RX=(window.VR_CONFIG&&window.VR_CONFIG.rx)||{};
  const el=id=>document.getElementById(id);
  const root=el('rx');
  if(!root) return;

  /* ===== HELPERS (same rules as board.js) ===== */
  const VR_ERR_RE=/^#(ref|n\/?a|name|value|div\/0|null|num|spill|getting_data)[!?]?$/i;
  const noErr=v=>VR_ERR_RE.test(String(v==null?'':v).trim()) ? '' : v;
  const SENTINEL_MS=30*60000;   // 30:00+ = placeholder / penalty → DNF, never fastest
  const norm=s=>String(s==null?'':s).toLowerCase().replace(/[^a-z0-9]/g,'');
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
  function parseTime(v){ const n=parseTimeRaw(v); return (typeof n==='number'&&isFinite(n)&&n>0) ? n : null; }
  function fmtTime(ms){ if(ms==null) return '—'; let t=Math.round(ms);
    const m=Math.floor(t/60000); t-=m*60000; const s=Math.floor(t/1000), mm=t-s*1000;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+':'+String(mm).padStart(3,'0'); }
  function fmtGap(ms){ const s=Math.floor(ms/1000), mm=ms%1000; return '+'+s+'.'+String(mm).padStart(3,'0'); }
  const isValid=ms=>ms!=null&&ms<SENTINEL_MS;
  // What a time cell shows: a formatted time, DNF for sentinel values, any
  // other text the sheet carries (DNS, DSQ…) as-is, or a dash when not run.
  function timeDisp(txt,ms){
    if(ms!=null&&ms>=SENTINEL_MS) return {text:'DNF', cls:'dnf'};
    if(ms!=null) return {text:fmtTime(ms), cls:''};
    const t=String(txt||'').trim();
    if(t&&!/^[0:.]+$/.test(t)) return {text:t.toUpperCase(), cls:'dnf'};
    return {text:'—', cls:'dnf'};
  }
  const numOr=(v,d)=>{ const n=parseFloat(String(v||'').replace(/[^0-9.]/g,'')); return isNaN(n)?d:n; };
  const isNumeric=v=>/^\s*\d+\s*$/.test(String(v==null?'':v));

  /* ===== GVIZ (JSONP, same mechanism as board.js) =====
     cb(table|null, errorMessage). A private sheet answers with a Google
     sign-in page, which loads as a broken script and never calls back — the
     timeout turns that into a readable error instead of a forever-spinner. */
  let _seq=0;
  function gviz(sheetId, params, cb){
    const cbName='__rxGviz'+(++_seq);
    const s=document.createElement('script');
    let done=false;
    const finish=(table,err)=>{ if(done) return; done=true; clearTimeout(timer);
      window[cbName]=function(){}; setTimeout(()=>{ try{ delete window[cbName]; }catch(e){} },60000);
      s.remove(); cb(table,err); };
    const timer=setTimeout(()=>finish(null,'timeout'),15000);
    window[cbName]=resp=>{
      if(resp&&resp.status==='ok') finish(resp.table||{cols:[],rows:[]},null);
      else finish(null,(resp&&resp.errors&&resp.errors[0]&&(resp.errors[0].detailed_message||resp.errors[0].message))||'sheet error');
    };
    s.onerror=()=>finish(null,'network');
    s.src=`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params}&tqx=out:json;responseHandler:${cbName}`;
    document.head.appendChild(s);
  }
  const cellText=(row,i)=>{ const c=row&&row.c&&row.c[i]; return c?String(noErr(c.f!=null?c.f:(c.v!=null?c.v:''))).trim():''; };

  /* Table → [{key:value}] using the header labels. If gviz didn't pick the
     header row up as labels, fall back to reading it from the first row. */
  function records(table, want){
    let rows=(table&&table.rows)||[];
    const keys=Object.keys(want);
    const indexFrom=labels=>{ const idx={}; keys.forEach(k=>{ idx[k]=labels.indexOf(norm(want[k])); }); return idx; };
    const found=idx=>keys.filter(k=>idx[k]>=0).length;
    let idx=indexFrom(((table&&table.cols)||[]).map(c=>norm(c&&c.label)));
    if(found(idx)<keys.length && rows.length){
      const first=rows[0], alt=indexFrom(((first&&first.c)||[]).map((c,i)=>norm(cellText(first,i))));
      if(found(alt)>found(idx)){ idx=alt; rows=rows.slice(1); }
    }
    return rows.map(r=>{ const o={}; keys.forEach(k=>{ o[k]=idx[k]>=0?cellText(r,idx[k]):''; }); return o; });
  }

  /* ===== PARSE ===== */
  // → [{label:'Q1', n:1, heats:[{heat:'1', entries:[…]}]}], rounds with rows only.
  function parseQualifying(recs){
    const runs={};
    recs.forEach((r,i)=>{
      const round=String(r.round||'').toUpperCase().replace(/\s+/g,'');
      const m=round.match(/^Q(\d+)$/); if(!m) return;
      if(!r.driver&&!r.num) return;
      const run=runs[round]||(runs[round]={label:round, n:+m[1], heats:{}});
      const hk=String(r.heat||'').trim()||'—';
      (run.heats[hk]||(run.heats[hk]=[])).push({num:r.num, driver:r.driver, cls:r.cls,
        timeTxt:r.time, ms:parseTime(r.time), p:String(r.p||'').trim(), _i:i});
    });
    return Object.values(runs).sort((a,b)=>a.n-b.n).map(run=>({label:run.label, n:run.n,
      heats:Object.keys(run.heats).sort((a,b)=>numOr(a,1e9)-numOr(b,1e9)||a.localeCompare(b)).map(hk=>{
        const entries=run.heats[hk];
        // Finishing order once positions are in; sheet order until then. Cars
        // with a time but no P yet sit after the placed cars, ahead of unrun ones.
        const rank=e=>isNumeric(e.p)?+e.p:(e.ms!=null?1e6:1e9);
        if(entries.some(e=>isNumeric(e.p)))
          entries.sort((a,b)=>rank(a)-rank(b)||a._i-b._i);
        return {heat:hk, entries:entries.map(({_i,...e})=>e)};
      })}));
  }

  const RACE_ORDER=['QF1','QF2','QF3','QF4','SF1','SF2','BFINAL','AFINAL'];
  function raceName(key, raw){
    let m=key.match(/^QF(\d+)$/); if(m) return 'Quarter-Final '+m[1];
    m=key.match(/^SF(\d+)$/); if(m) return 'Semi-Final '+m[1];
    if(key==='BFINAL') return 'B Final';
    if(key==='AFINAL') return 'A Final';
    return raw||key;
  }
  // → {classOrder:[…], byClass:{cls:[race…]}} with races in running order.
  function parseKnockouts(recs){
    const byClass={}, classOrder=[];
    recs.forEach((r,i)=>{
      const cls=String(r.cls||'').trim(), rawRace=String(r.race||'').trim();
      if(!cls||!rawRace) return;
      if(!r.driver&&!r.num) return;
      if(!byClass[cls]){ byClass[cls]={}; classOrder.push(cls); }
      const key=rawRace.toUpperCase().replace(/\s+/g,'');
      const race=byClass[cls][key]||(byClass[cls][key]={key, name:raceName(key,rawRace), entries:[], _i:i});
      race.entries.push({start:String(r.start||'').trim(), num:r.num, driver:r.driver,
        gridTxt:r.grid, gridMs:parseTime(r.grid), timeTxt:r.time, ms:parseTime(r.time),
        finish:String(r.finish||'').trim(), _i:i});
    });
    const out={};
    classOrder.forEach(cls=>{
      const races=Object.values(byClass[cls]);
      races.sort((a,b)=>{ const ia=RACE_ORDER.indexOf(a.key), ib=RACE_ORDER.indexOf(b.key);
        return (ia<0?99:ia)-(ib<0?99:ib)||a._i-b._i; });
      out[cls]=races.map(race=>{
        const hasFinish=race.entries.some(e=>e.finish);
        const run=hasFinish||race.entries.some(e=>e.ms!=null||String(e.timeTxt||'').trim());
        const finRank=e=>isNumeric(e.finish)?+e.finish:(e.finish?500:1000);
        race.entries.sort(hasFinish
          ? (a,b)=>finRank(a)-finRank(b)||numOr(a.start,1e9)-numOr(b.start,1e9)||a._i-b._i
          : (a,b)=>numOr(a.start,1e9)-numOr(b.start,1e9)||a._i-b._i);
        return {key:race.key, name:race.name, run,
          entries:race.entries.map(({_i,...e})=>Object.assign(e,{winner:isNumeric(e.finish)&&+e.finish===1}))};
      });
    });
    return {classOrder, byClass:out};
  }

  function parseKeyValues(rows, keyCol, valCol){
    const out={};
    (rows||[]).forEach(r=>{ const k=norm(r[keyCol]); if(k) out[k]=String(r[valCol]||'').trim(); });
    return out;
  }

  /* ===== STATE ===== */
  const state={ runs:[], ko:{classOrder:[],byClass:{}}, sheet:{}, settings:{},
    view:0, sub:'overall', cls:'__all', round:null, roundPicked:false, koCls:null,
    archive:false };   // true on Past Events: finished event, wording changes
  let lastDataStr='', lastChange=Date.now(), isLive=false, started=false, hadData=false;
  const prevOverall={}, prevHeat={}, prevKo={};

  /* ===== DERIVE OVERALL FASTEST ===== */
  function deriveOverall(runs, cls){
    const best={};
    runs.forEach(run=>run.heats.forEach(h=>h.entries.forEach(e=>{
      if(!isValid(e.ms)) return;
      if(cls!=='__all'&&e.cls!==cls) return;
      const k=String(e.num||e.driver);
      if(!best[k]||e.ms<best[k].ms) best[k]={id:k, num:e.num, driver:e.driver, cls:e.cls, ms:e.ms, round:run.label};
    })));
    return Object.values(best).sort((a,b)=>a.ms-b.ms);
  }

  /* ===== RENDER: OVERALL ===== */
  function renderOverall(flashOn){
    const list=el('rxList');
    const rows=deriveOverall(state.runs, state.cls);
    if(!rows.length){ list.innerHTML='<div class="lb__bempty">No qualifying times yet.</div>'; return; }
    const leader=rows[0].ms;
    list.innerHTML=rows.map((d,i)=>{
      const pos=i+1;
      const changed=flashOn&&prevOverall[d.id]!=null&&prevOverall[d.id]!==d.ms;
      const gap=d.ms===leader?'FASTEST':fmtGap(d.ms-leader);
      return `<div class="lb__row${pos===1?' p1':pos===2?' p2':pos===3?' p3':''}${changed?' flash':''}" data-id="${esc(d.id)}">`+
        `<div class="lb__pos">${pos}</div><div class="lb__num">${esc(d.num)}</div>`+
        `<div class="lb__who"><div style="min-width:0"><div class="lb__name">${esc(d.driver)}</div>`+
          (d.cls?`<span class="lb__rowclass">${esc(d.cls)}</span>`:'')+`</div></div>`+
        `<div class="lb__end"><div class="lb__time${d.ms===leader?' best':''}">${fmtTime(d.ms)}<small>${gap}</small></div>`+
        `<span class="lb__round">${esc(d.round)}</span></div></div>`;
    }).join('');
    deriveOverall(state.runs,'__all').forEach(d=>{ prevOverall[d.id]=d.ms; });
  }

  /* ===== RENDER: BY HEATS ===== */
  function pickDefaultRound(){
    const labels=state.runs.map(r=>r.label);
    if(state.roundPicked&&labels.indexOf(state.round)>=0) return;
    // Latest round with a time in it; otherwise the first round.
    let pick=labels[0]||null;
    state.runs.forEach(r=>{ if(r.heats.some(h=>h.entries.some(e=>e.ms!=null))) pick=r.label; });
    state.round=pick;
  }
  function renderHeats(flashOn){
    const grid=el('rxHeatGrid'), sw=el('rxRoundSwitch');
    if(!state.runs.length){
      sw.innerHTML=''; grid.style.setProperty('--hcols','1');
      grid.innerHTML='<div class="lb__bempty">No heats yet.</div>'; return;
    }
    pickDefaultRound();
    sw.innerHTML=state.runs.map(r=>
      `<button type="button" class="lb__subtab${r.label===state.round?' active':''}" data-round="${esc(r.label)}">${esc(r.label)}</button>`).join('');
    grid.style.setProperty('--hcols', String(state.runs.length));
    grid.innerHTML=state.runs.map(run=>{
      const heats=run.heats.map(h=>({heat:h.heat, entries:h.entries.filter(e=>state.cls==='__all'||e.cls===state.cls)}))
        .filter(h=>h.entries.length);
      let roundBest=Infinity;
      heats.forEach(h=>h.entries.forEach(e=>{ if(isValid(e.ms)&&e.ms<roundBest) roundBest=e.ms; }));
      let html=`<div class="lb__hcol rx-hcol${run.label===state.round?' is-active':''}" data-round="${esc(run.label)}">`+
        `<div class="lb__hcolhead"><span>Qualifying ${run.n}</span><span class="t">Time · P</span></div>`;
      if(!heats.length) html+='<div class="lb__bempty">No cars in this class.</div>';
      heats.forEach((h,hi)=>{
        html+=`<div class="lb__heat rx-heat${hi%2?' alt':''}"><div class="lb__heatno">${esc(h.heat)}</div><div class="lb__hpair">`;
        h.entries.forEach(e=>{
          const key=run.label+'|'+(e.num||e.driver);
          const changed=flashOn&&prevHeat[key]!==undefined&&prevHeat[key]!==e.ms;
          prevHeat[key]=e.ms;
          const t=timeDisp(e.timeTxt,e.ms);
          const best=isValid(e.ms)&&e.ms===roundBest;
          const p1=isNumeric(e.p)&&+e.p===1;
          html+=`<div class="lb__hentry rx-hentry${p1?' rx-p1':''}${changed?' flash':''}">`+
            `<span class="lb__hnum">${esc(e.num)}</span><span class="lb__hdrv">${esc(e.driver)}</span>`+
            `<span class="lb__htime ${best?'best':t.cls}">${esc(t.text)}</span>`+
            `<span class="rx-p">${e.p?esc(e.p):''}</span></div>`;
        });
        html+='</div></div>';
      });
      return html+'</div>';
    }).join('');
  }

  /* ===== RENDER: KNOCKOUTS ===== */
  /* Class order from the Web tab's settings table: Class1, Class2 … ClassN
     (any number, gaps allowed; the older KO1Class / KO2Class names still work). */
  function settingsClasses(){
    const found=[];
    Object.keys(state.sheet).forEach(k=>{
      const m=/^class(\d+)$/.exec(k)||/^ko(\d+)class$/.exec(k);
      if(m&&state.sheet[k]) found.push({n:+m[1], c:state.sheet[k]});
    });
    return found.sort((a,b)=>a.n-b.n).map(x=>x.c);
  }
  // Settings classes first (in their order), then anything else, de-duplicated.
  function orderClasses(fromData, sortRest){
    const list=[];
    const add=c=>{ if(c&&!list.some(x=>norm(x)===norm(c))) list.push(c); };
    settingsClasses().forEach(add);
    const nSettings=list.length;
    fromData.forEach(add);
    if(sortRest){ const rest=list.splice(nSettings).sort((a,b)=>a.localeCompare(b)); list.push(...rest); }
    return list;
  }
  const classShown=c=>{ const k='show'+norm(c); return (k in state.settings)?/^(yes|true|1|on)$/i.test(state.settings[k]):true; };
  function koClasses(){
    // A "Show <Class> = No" row in the VR settings tab hides that class.
    return orderClasses(state.ko.classOrder,false).filter(classShown);
  }
  function racesFor(cls){
    const key=Object.keys(state.ko.byClass).find(c=>norm(c)===norm(cls));
    return key?state.ko.byClass[key]:[];
  }
  function raceCard(cls, race, races){
    let entries=race.entries.slice();
    const isA=race.key==='AFINAL';
    // The B Final winner takes A Final grid spot 7 — hold the spot until known.
    if(isA&&races.some(r=>r.key==='BFINAL')&&!entries.some(e=>numOr(e.start,0)===7)&&!race.run)
      entries.push({start:'7', num:'', driver:'B Final winner', gridTxt:'', gridMs:null, timeTxt:'', ms:null, finish:'', placeholder:true});
    let rows='';
    entries.forEach(e=>{
      const key=cls+'|'+race.key+'|'+(e.num||e.driver);
      const sig=(e.ms==null?'':e.ms)+'|'+e.finish;
      const changed=!e.placeholder&&prevKo[key]!==undefined&&prevKo[key]!==sig&&state._flashKo;
      if(!e.placeholder) prevKo[key]=sig;
      const g=timeDisp(e.gridTxt,e.gridMs), t=timeDisp(e.timeTxt,e.ms);
      rows+=`<tr class="${e.winner?'is-winner':''}${e.placeholder?' is-placeholder':''}${changed?' flash':''}">`+
        `<td class="c rx-start">${esc(e.start)}</td>`+
        `<td class="c rx-num">${esc(e.num)}</td>`+
        `<td class="rx-drv">${esc(e.driver)}${e.winner?' <span class="rx-win">Winner</span>':''}</td>`+
        `<td class="r rx-mono rx-col-grid${g.cls?' rx-muted':''}">${e.placeholder?'':esc(g.text)}</td>`+
        `<td class="r rx-mono${t.cls?' rx-muted':''}">${e.placeholder?'':esc(t.text)}</td>`+
        `<td class="c rx-fin">${esc(e.finish)}</td></tr>`;
    });
    return `<article class="rx-race${/FINAL$/.test(race.key)?' rx-race--final':''}${race.run?'':' is-pending'}">`+
      `<header class="rx-race__head"><h3 class="rx-race__name">${esc(race.name)}</h3>`+
        (race.run?'':`<span class="rx-race__tag">${state.archive?'No results recorded':'Not run yet'}</span>`)+`</header>`+
      `<div class="rx-race__scroll"><table class="rx-race__table"><thead><tr>`+
        `<th class="c">Start</th><th class="c">No.</th><th>Driver</th><th class="r rx-col-grid">Grid time</th><th class="r">Time</th><th class="c">Finish</th>`+
      `</tr></thead><tbody>${rows}</tbody></table></div>`+
      (isA&&races.some(r=>r.key==='BFINAL')?'<p class="rx-race__note">B Final winner starts 7th</p>':'')+
    `</article>`;
  }
  function renderKnockouts(flashOn){
    const btns=el('rxKcatBtns'), out=el('rxRaces');
    const classes=koClasses();
    if(!classes.length){ btns.innerHTML=''; out.innerHTML='<div class="lb__bempty">Knockouts haven’t started yet.</div>'; return; }
    if(!state.koCls||!classes.some(c=>norm(c)===norm(state.koCls))) state.koCls=classes[0];
    btns.innerHTML=classes.map(c=>
      `<button type="button" class="lb__kcatbtn${norm(c)===norm(state.koCls)?' active':''}" data-cls="${esc(c)}">${esc(c)}</button>`).join('');
    state._flashKo=flashOn;
    // Keep the flash memory current for every class, not just the one on screen.
    classes.forEach(c=>{ if(norm(c)!==norm(state.koCls)) racesFor(c).forEach(r=>raceCard(c,r,racesFor(c))); });
    const races=racesFor(state.koCls);
    if(!races.length){ out.innerHTML='<div class="lb__bempty">No knockout races for this class yet.</div>'; return; }
    const groups=[
      {cls:'rx-racegroup--pair', races:races.filter(r=>/^QF/.test(r.key))},
      {cls:'rx-racegroup--pair', races:races.filter(r=>/^SF/.test(r.key))},
      {cls:'', races:races.filter(r=>r.key==='BFINAL')},
      {cls:'', races:races.filter(r=>r.key==='AFINAL')},
      {cls:'', races:races.filter(r=>!/^(QF|SF)/.test(r.key)&&r.key!=='BFINAL'&&r.key!=='AFINAL')},
    ].filter(g=>g.races.length);
    out.innerHTML=groups.map(g=>`<div class="rx-racegroup ${g.cls}">${g.races.map(r=>raceCard(state.koCls,r,races)).join('')}</div>`).join('');
  }

  /* ===== CLASS FILTER (qualifying) ===== */
  function renderClassFilter(){
    const bar=el('rxClassFilter');
    const classes=[];
    state.runs.forEach(r=>r.heats.forEach(h=>h.entries.forEach(e=>{ if(e.cls&&classes.indexOf(e.cls)<0) classes.push(e.cls); })));
    if(classes.length<2){ bar.classList.remove('is-on'); bar.innerHTML=''; state.cls='__all'; return; }
    // Settings order (Class1…ClassN) first, the rest A–Z; only classes with cars.
    const ordered=orderClasses(classes,true).map(c=>classes.find(x=>norm(x)===norm(c))).filter(Boolean);
    classes.length=0; classes.push(...ordered);
    if(state.cls!=='__all'&&classes.indexOf(state.cls)<0) state.cls='__all';
    bar.innerHTML='<span class="vr-filterlabel">Filter:</span>'+
      [['__all','All Classes']].concat(classes.map(c=>[c,c])).map(([v,t])=>
        `<button type="button" class="vr-chip${state.cls===v?' is-active':''}" data-class="${esc(v)}">${esc(t)}</button>`).join('');
    bar.classList.add('is-on');
  }

  function renderAll(flashOn){
    renderClassFilter();
    renderOverall(flashOn);
    renderHeats(flashOn);
    renderKnockouts(flashOn);
    updateFilterVisibility();
  }

  /* ===== VIEW CONTROLS ===== */
  function setView(i){
    state.view=i;
    [...el('rxTabs').children].forEach(b=>b.classList.toggle('active',+b.dataset.view===i));
    el('rxQualifying').classList.toggle('hide',i!==0);
    el('rxKnockouts').classList.toggle('hide',i!==1);
    el('rxTitleSub').textContent=i===1?'· Knockouts':'· Qualifying';
    updateFilterVisibility();
  }
  function updateFilterVisibility(){ el('rxClassFilter').style.display=state.view===1?'none':''; }
  function setSub(which){
    state.sub=which;
    el('rxOverall').classList.toggle('qf-off',which!=='overall');
    el('rxHeats').classList.toggle('qf-off',which!=='heats');
    [...el('rxSubtabs').children].forEach(b=>b.classList.toggle('active',b.dataset.sub===which));
  }
  function wire(){
    [...el('rxTabs').children].forEach(b=>b.addEventListener('click',()=>setView(+b.dataset.view)));
    [...el('rxSubtabs').children].forEach(b=>b.addEventListener('click',()=>setSub(b.dataset.sub)));
    el('rxClassFilter').addEventListener('click',e=>{
      const b=e.target.closest('.vr-chip'); if(!b) return;
      state.cls=b.dataset.class; renderClassFilter(); renderOverall(false); renderHeats(false);
    });
    el('rxRoundSwitch').addEventListener('click',e=>{
      const b=e.target.closest('[data-round]'); if(!b) return;
      state.round=b.dataset.round; state.roundPicked=true;
      [...el('rxRoundSwitch').children].forEach(x=>x.classList.toggle('active',x===b));
      [...el('rxHeatGrid').querySelectorAll('.rx-hcol')].forEach(c=>c.classList.toggle('is-active',c.dataset.round===state.round));
    });
    el('rxKcatBtns').addEventListener('click',e=>{
      const b=e.target.closest('[data-cls]'); if(!b) return;
      state.koCls=b.dataset.cls; renderKnockouts(false);
    });
    setSub('overall');
  }

  /* ===== STATUS: spinner, error line, "updated Xs ago", Live badge ===== */
  function hideLoading(){ el('rxSpinner').classList.add('done'); el('rxViews').classList.remove('loading'); }
  function showError(msg){
    const e=el('rxErr');
    if(msg){ e.textContent=msg; e.style.display='block'; } else e.style.display='none';
  }
  function markChanged(){ lastChange=Date.now(); const u=el('rxUpdated'); u.classList.add('flash'); setTimeout(()=>u.classList.remove('flash'),350); }
  function setLive(on){ isLive=on; el('rxLive').style.display=on?'':'none'; el('rxUpdated').style.display=on?'':'none'; }
  setInterval(()=>{ if(!started) return; const s=Math.round((Date.now()-lastChange)/1000);
    let txt; if(s<2) txt='just now'; else if(s<60) txt='updated '+s+'s ago';
    else { const m=Math.floor(s/60), r=s%60; txt='updated '+m+'m'+(r?' '+r+'s':'')+' ago'; }
    el('rxUpdatedTxt').textContent=txt; },1000);

  /* ===== FETCH CYCLE ===== */
  function sheetId(){
    // A "Sheet ID" row in the settings tab can point the board at a different
    // copy of the streaming sheet; config.js is the default.
    const s=state.settings.sheetid;
    return (s&&/^[A-Za-z0-9_-]{25,}$/.test(s))?s:RX.sheetId;
  }
  /* Fetch the three Web tables from one tab. `where` picks the tab: 'gid=…'
     for the live sheet, 'sheet=<name>' for an archived copy.
     cb({q,k,s}, error) — error only when neither results table arrived. */
  function fetchTables(sheet, where, cb){
    const ranges=RX.ranges||{};
    const got={}; let left=3, failed=null;
    const done=()=>{ if(--left) return; cb(got, (!got.q&&!got.k)?(failed||'empty'):null); };
    const fetch=(key,range)=>gviz(sheet, `${where}&headers=1&range=${encodeURIComponent(range)}`, (table,err)=>{
      if(table) got[key]=table; else failed=failed||err; done(); });
    fetch('q', ranges.qualifying||'A1:G');
    fetch('k', ranges.knockouts||'I1:P');
    fetch('s', ranges.settings||'R1:S');
  }
  const errorText=err=>(err==='timeout'||err==='network')
    ? 'Couldn’t reach the RallyCross results sheet. Check it is shared as “Anyone with the link can view”.'
    : 'RallyCross sheet error: '+err;

  // Parse fetched tables into state. Missing tables keep their previous value.
  // Returns true when the data differs from the last call.
  function applyTables(got){
    const runs=got.q?parseQualifying(records(got.q,{round:'Round',heat:'Heat',cls:'Class',num:'No',driver:'Driver',time:'Time',p:'P'})):state.runs;
    const ko=got.k?parseKnockouts(records(got.k,{cls:'Class',race:'Race',start:'Start',grid:'GridTime',num:'No',driver:'Driver',time:'Time',finish:'Finish'})):state.ko;
    const sheet=got.s?parseKeyValues(records(got.s,{k:'Setting',v:'Value'}),'k','v'):state.sheet;
    const str=JSON.stringify([runs,ko,sheet]);
    const changed=str!==lastDataStr; lastDataStr=str;
    state.runs=runs; state.ko=ko; state.sheet=sheet;
    return changed;
  }

  function cycle(isInit){
    fetchTables(sheetId(), `gid=${RX.gid}`, (got,err)=>{
      hideLoading();
      if(err){ showError(errorText(err)); return; }
      showError(null);
      const changed=applyTables(got);
      if(changed||isInit){ renderAll(hadData); hadData=true; }
      if(changed&&!isInit) markChanged();
    });
  }

  /* ===== SETTINGS TAB (VR Website Settings → RallyCross Live Results Settings) ===== */
  function loadSettings(cb){
    const D=RX.defaults||{};
    const apply=s=>{
      state.settings=s;
      el('rxTitleName').textContent=s.title||D.title||'RallyCross';
      el('rxDate').textContent=s.date||D.date||'';
      cb();
    };
    if(!RX.settingsSheetId||!RX.settingsGid||/^TODO/i.test(RX.settingsGid)){ apply({}); return; }
    gviz(RX.settingsSheetId, `gid=${RX.settingsGid}&headers=0`, table=>{
      const out={};
      ((table&&table.rows)||[]).forEach(r=>{ const k=norm(cellText(r,0)); if(k) out[k]=cellText(r,1); });
      apply(out);
    });
  }

  /* ===== LIVE BOOT — /happening-now only, when js/shell.js routes to RallyCross ===== */
  let wired=false;
  function wireOnce(){ if(!wired){ wired=true; wire(); } }
  function boot(){
    started=true;
    wireOnce();
    loadSettings(()=>{
      if(/knock/i.test(state.settings.display||'')) setView(1); else setView(0);
      cycle(true);
      setInterval(()=>cycle(false), Math.max(5,+RX.pollSeconds||10)*1000);
    });
  }
  const isLivePage=!!el('rxLiveBoard');
  if(isLivePage&&window.VRRoute){
    window.VRRoute.on((route,liveType)=>{
      setLive(window.VRRoute.isRxType ? window.VRRoute.isRxType(liveType) : liveType==='rallycross');
      if(route==='rx'&&!started) boot();
    });
  }

  /* ===== ARCHIVE — Past Events shows a saved copy of the Web tab, once, no polling =====
     load(workbookId, tabName, {title, date}, cb(ok)) */
  function loadArchived(workbookId, tab, meta, cb){
    wireOnce();
    el('rxTitleName').textContent=(meta&&meta.title)||'RallyCross';
    el('rxDate').textContent=(meta&&meta.date)||'';
    el('rxSpinner').classList.remove('done'); el('rxViews').classList.add('loading');
    fetchTables(workbookId, 'sheet='+encodeURIComponent(tab), (got,err)=>{
      hideLoading();
      if(err){ cb(false, errorText(err)); return; }
      showError(null);
      // A fresh event: forget the previous one's picks and flash memory.
      state.cls='__all'; state.round=null; state.roundPicked=false; state.koCls=null;
      lastDataStr='';
      state.archive=true;
      applyTables(got);
      renderAll(false);
      // Index row added but the tab has nothing in Web format yet.
      if(!state.runs.length&&!state.ko.classOrder.length) showError('Results for this event haven’t been added yet.');
      setSub('overall'); setView(0);
      cb(true);
    });
  }

  window.VRRxBoard={ load:loadArchived,
    // Exposed for testing in the console / node.
    parseQualifying, parseKnockouts, deriveOverall, records, parseTime, timeDisp };
})();
