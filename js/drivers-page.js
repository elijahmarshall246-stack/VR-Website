/* /stats/driver-stats — the full driver directory behind the Stats page card.
   Every driver from every event, whatever the category, plus a search box. */
(function(){
  var VRR  = window.VRResults;
  var VRDS = window.VRDriverStats;

  var el = function(id){ return document.getElementById(id); };
  var loading = el('vrDsLoading'), error = el('vrDsError'),
      content = el('vrDsContent'), progress = el('vrDsProgress'),
      search  = el('vrDsSearch'),  countEl  = el('vrDsCount'),
      listWrap = el('vrDsList');

  function showOnly(which){
    loading.classList.toggle('is-on', which==='loading');
    error.classList.toggle('is-on',  which==='error');
    content.style.display = which==='content' ? '' : 'none';
  }

  function renderList(drivers){
    listWrap.innerHTML=VRDS.render(drivers);
    countEl.textContent = drivers.length
      ? drivers.length+(drivers.length===1?' driver':' drivers')
      : '';
    applySearch();
  }

  function applySearch(){
    var q=(search.value||'').trim().toLowerCase();
    var rows=listWrap.querySelectorAll('.vr-dstat'), shown=0;
    Array.prototype.forEach.call(rows, function(row){
      var ok=!q || (row.getAttribute('data-name')||'').indexOf(q)>=0;
      row.style.display=ok?'':'none';
      if(ok) shown++;
    });
    var none=el('vrDsNoMatch');
    if(none) none.style.display = (q && !shown) ? '' : 'none';
  }

  function run(){
    showOnly('loading');
    VRR.loadEvents({ onProgress:function(done,total){
      if(progress) progress.textContent=done+' / '+total;
    }}, function(events){
      if(events===null){ showOnly('error'); return; }
      // Full directory is browsed by name, so list it alphabetically rather
      // than by events entered (which is how the Stats-page card ranks them).
      var drivers=VRDS.build(events).slice().sort(function(a,b){
        return a.name.localeCompare(b.name, undefined, {sensitivity:'base'});
      });
      renderList(drivers);
      VRDS.wire(listWrap);
      showOnly('content');
    });
  }

  if(search) search.addEventListener('input', applySearch);
  var retry=el('vrDsRetry'); if(retry) retry.addEventListener('click', run);
  if(!VRR || !VRDS){ showOnly('error'); return; }
  run();
})();
