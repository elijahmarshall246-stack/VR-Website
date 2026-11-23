/* Home page: fills "Latest results" with the newest events from the Index tab.
   Depends on window.VRResults (js/results-parse.js). */
(function(){
  var list = document.getElementById('vrLatestList');
  var VRR = window.VRResults;
  if (!list || !VRR || !VRR.loadIndex) return;

  var SHOW = 3;
  var DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function fmtDate(ev){
    if (isNaN(ev.dateMs)) return ev.date || '';
    var d = new Date(ev.dateMs);
    return DAYS[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear();
  }
  function dayBlock(ev){
    if (isNaN(ev.dateMs)) return '<span class="vr-latest__day">—</span>';
    var d = new Date(ev.dateMs);
    return '<span class="vr-latest__day">'+d.getDate()+'</span>'+
           '<span class="vr-latest__mon">'+MONTHS[d.getMonth()]+' '+String(d.getFullYear()).slice(2)+'</span>';
  }

  VRR.loadIndex(function(events){
    if (!events || !events.length){
      list.innerHTML = '<p class="vr-latest__empty">'+
        (events ? 'No past results have been published yet.'
                : 'Couldn’t load the latest results. <a href="/past-events">Browse past events</a>.')+'</p>';
      return;
    }
    list.innerHTML = events.slice(0, SHOW).map(function(ev, i){
      return '<a class="vr-latest__card'+(i===0?' is-newest':'')+'" href="/past-events?event='+encodeURIComponent(ev.slug)+'">'+
        '<span class="vr-latest__date" aria-hidden="true">'+dayBlock(ev)+'</span>'+
        '<span class="vr-latest__main">'+
          (i===0 ? '<span class="vr-latest__tag">Most recent</span>' : '')+
          '<span class="vr-latest__name">'+esc(ev.name)+'</span>'+
          '<span class="vr-latest__meta">'+esc([ev.type, fmtDate(ev)].filter(Boolean).join(' · '))+'</span>'+
        '</span>'+
        '<span class="vr-latest__go" aria-hidden="true">→</span>'+
      '</a>';
    }).join('');
  });
})();
