/* Per-driver history: every event a driver entered, how they finished, how many
   knockouts they won and their personal-best lap (qualifying or bracket).
   Shared by the Stats page card (top 5) and the full /stats/driver-stats page.
   Depends on window.VRResults. Exposes window.VRDriverStats. */
window.VRDriverStats = (function(){
  var VRR = window.VRResults;

  var ROUND_KEYS   = ['R16','QF','SF','F'];
  var ROUND_LABELS = ['R16','QF','SF'];          // index = ROUND_KEYS index, finals handled separately

  function esc(s){ return String(s).replace(/[&<>"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // Real competitor label for a bracket slot, or '' for a bye/TBD/empty slot.
  function slotName(slot){
    if(!slot) return '';
    var label=slot.driver||slot.car||'';
    if(!label || /^(bye|tbd|\?|—|-)$/i.test(label.trim()) || VRR.isErrText(label)) return '';
    return label;
  }

  /* ---- Car numbers ----------------------------------------------------------
     Shown beside each driver. Not used for matching: numbers get reassigned
     between seasons (Sebastian Thompson and Jacob Mustor swapped #46 and #98),
     so two competitors can share one. Matching stays on the name key. */
  function numKey(v){
    var s=String(v==null?'':v).trim().replace(/^#+/,'').trim().toUpperCase();
    if(!s || VRR.isErrText(s)) return '';
    s=s.replace(/^0+(?=.)/,'');                 // "07" and "7" are one car
    return /^\d{1,4}[A-Z]?$/.test(s) ? s : '';  // anything else isn't a number
  }

  // driver key -> the number that driver ran, learned from every entry carrying
  // both. Events arrive newest-first, so the number they run now is the one
  // shown, even for events where the sheet left the number cell blank.
  function numberIndex(evs){
    var byName={};
    function learn(num, name){
      var nk=numKey(num), dk=VRR.driverKey(name);
      if(nk && dk && byName[dk]==null) byName[dk]=nk;
    }
    (evs||[]).forEach(function(ev){
      var P=ev.parsed||{};
      (P.overall||[]).forEach(function(d){ learn(d.num, d.driver); });
      (P.knockouts||[]).forEach(function(ko){
        ROUND_KEYS.forEach(function(rk){
          ((ko.rounds||{})[rk]||[]).forEach(function(m){
            [m.slot1, m.slot2].forEach(function(s){ if(s) learn(s.car, slotName(s)); });
          });
        });
      });
    });
    return byName;
  }

  /* ---- Aggregation ---------------------------------------------------------
     build(events) -> [{ key, num, name, count, wins, bestMs, bestEvent, events:[…] }]
     A driver "did" an event if they appear in qualifying or in any bracket.
     Events are pre-sorted newest-first by VRResults.loadEvents. */
  function build(evs){
    var numOf=numberIndex(evs);
    var map={};

    function record(name){
      var k=VRR.driverKey(name); if(!k) return null;
      if(!map[k]) map[k]={ key:k, num:numOf[k]||'', name:name, count:0, wins:0, bestMs:null, bestEvent:'', events:[] };
      else map[k].name=VRR.betterName(map[k].name, name);
      return map[k];
    }

    (evs||[]).forEach(function(ev){
      var P=ev.parsed||{}, overall=P.overall||[], kos=P.knockouts||[];
      var per={};   // driver key -> that driver's day: qualifying slot + best bracket run

      overall.forEach(function(d,i){
        if(!d.driver) return;
        var k=VRR.driverKey(d.driver); if(!k) return;
        var slot=per[k];
        if(!slot){ per[k]=slot={ driver:d.driver, pos:i+1, ms:d.ms, koMs:null, cls:d['class']||'', ko:null }; }
        else{
          slot.driver=VRR.betterName(slot.driver, d.driver);
          if(d.ms!=null && (slot.ms==null || d.ms<slot.ms)){ slot.pos=i+1; slot.ms=d.ms; }
        }
      });

      kos.forEach(function(ko){
        var deepest={};                       // driver key -> furthest round index they appear in
        ROUND_KEYS.forEach(function(rk, ri){
          ((ko.rounds||{})[rk]||[]).forEach(function(m){
            [m.slot1, m.slot2].forEach(function(s){
              var label=slotName(s); if(!label) return;
              var k=VRR.driverKey(label); if(!k) return;
              if(!per[k]) per[k]={ driver:label, pos:null, ms:null, koMs:null, cls:'', ko:null };
              else per[k].driver=VRR.betterName(per[k].driver, label);
              if(deepest[k]==null || ri>deepest[k]) deepest[k]=ri;
            });
          });
        });

        // Bracket runs are timed too, so they count towards a personal best.
        // Kept apart from `ms` so an event row still pairs its qualifying
        // position with the qualifying time.
        VRR.koRuns(ko).forEach(function(r){
          var k=VRR.driverKey(r.driver), slot=k?per[k]:null; if(!slot) return;
          if(slot.koMs==null || r.ms<slot.koMs) slot.koMs=r.ms;
        });

        var res=VRR.finalResult(ko);
        var winKey=res?VRR.driverKey(slotName(res.winner)):'';

        Object.keys(deepest).forEach(function(k){
          var ri=deepest[k], rank, label;
          if(ri===3){                          // reached the final
            var won = !!winKey && k===winKey;
            rank = won?5:4; label = won?'Winner':'2nd';
          } else { rank = ri+1; label = ROUND_LABELS[ri]; }
          var cur=per[k].ko;
          if(!cur || rank>cur.rank) per[k].ko={ rank:rank, label:label, cls:ko.name||'' };
        });
      });

      Object.keys(per).forEach(function(k){
        var slot=per[k], d=record(slot.driver); if(!d) return;
        d.count++;
        if(slot.ko && slot.ko.rank===5) d.wins++;
        var bestOfDay=slot.ms;
        if(slot.koMs!=null && (bestOfDay==null || slot.koMs<bestOfDay)) bestOfDay=slot.koMs;
        if(bestOfDay!=null && (d.bestMs==null || bestOfDay<d.bestMs)){ d.bestMs=bestOfDay; d.bestEvent=ev.name; }
        d.events.push({
          name: ev.name, date: ev.date, type: ev.type, slug: ev.slug || VRR.eventSlug(ev),
          pos: slot.pos, ms: slot.ms, ko: slot.ko,
          cls: slot.cls || (slot.ko ? slot.ko.cls : ''),
        });
      });
    });

    return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){
      return b.count-a.count || b.wins-a.wins ||
        (a.bestMs==null ? 1 : b.bestMs==null ? -1 : a.bestMs-b.bestMs) ||
        a.name.localeCompare(b.name);
    });
  }

  /* ---- Rendering ---------------------------------------------------------- */
  function eventHtml(e){
    var badge = e.ko
      ? '<span class="vr-dstat-ev__badge is-r'+e.ko.rank+'">'+esc(e.ko.label)+'</span>'
      : '';
    var meta = [e.date, e.cls].filter(Boolean).join(' · ');
    var qual = e.pos ? ('Q'+e.pos + (e.ms!=null ? ' · '+VRR.fmtTime(e.ms) : ''))
                     : (e.ms!=null ? VRR.fmtTime(e.ms) : '');
    return '<li class="vr-dstat-ev">'+
      '<span class="vr-dstat-ev__main">'+
        '<span class="vr-dstat-ev__name">'+esc(e.name)+'</span>'+
        (meta?'<span class="vr-dstat-ev__meta">'+esc(meta)+'</span>':'')+
      '</span>'+
      '<span class="vr-dstat-ev__res">'+badge+
        (qual?'<span class="vr-dstat-ev__qual">'+esc(qual)+'</span>':'')+
      '</span>'+
      '<a class="vr-dstat-ev__btn" href="/past-events/'+esc(e.slug)+'">'+
        'Results <span aria-hidden="true">→</span></a>'+
    '</li>';
  }

  function rowHtml(d){
    var summary=[
      d.count+(d.count===1?' event':' events'),
      d.wins+(d.wins===1?' win':' wins'),
      d.bestMs!=null ? 'PB '+VRR.fmtTime(d.bestMs) : 'no time set',
    ].join(' · ');

    // The leading figure is the driver's car number, not their rank in the list.
    return '<li class="vr-dstat" data-name="'+esc(d.name.toLowerCase())+'" data-num="'+esc(d.num||'')+'">'+
      '<button class="vr-dstat__head" type="button" aria-expanded="false">'+
        '<span class="vr-dstat__pos"'+(d.num?' title="Car number"':'')+'>'+esc(d.num||'—')+'</span>'+
        '<span class="vr-dstat__id">'+
          '<span class="vr-dstat__name">'+esc(d.name)+'</span>'+
          '<span class="vr-dstat__sub">'+esc(summary)+'</span>'+
        '</span>'+
        '<span class="vr-dstat__chev" aria-hidden="true">▾</span>'+
      '</button>'+
      '<div class="vr-dstat__body" hidden>'+
        '<div class="vr-dstat__metrics">'+
          '<div class="vr-dstat__metric"><span class="vr-dstat__mnum">'+d.count+'</span><span class="vr-dstat__mlbl">Events</span></div>'+
          '<div class="vr-dstat__metric"><span class="vr-dstat__mnum">'+d.wins+'</span><span class="vr-dstat__mlbl">Wins</span></div>'+
          '<div class="vr-dstat__metric vr-dstat__metric--wide">'+
            '<span class="vr-dstat__mnum">'+esc(d.bestMs!=null?VRR.fmtTime(d.bestMs):'—')+'</span>'+
            '<span class="vr-dstat__mlbl">'+esc(d.bestEvent?'Fastest Lap · '+d.bestEvent:'Fastest Lap')+'</span>'+
          '</div>'+
        '</div>'+
        '<ul class="vr-dstat__events">'+d.events.map(eventHtml).join('')+'</ul>'+
      '</div>'+
    '</li>';
  }

  // render(drivers, {limit}) -> list markup ('' rows collapsed by default)
  function render(drivers, opts){
    opts=opts||{};
    drivers=drivers||[];
    if(!drivers.length) return '<div class="vr-stat-empty">No driver data yet.</div>';
    var rows=opts.limit?drivers.slice(0,opts.limit):drivers;
    return '<ol class="vr-dstat-list">'+rows.map(rowHtml).join('')+'</ol>';
  }

  // Delegated expand/collapse for every list inside `root`.
  function wire(root){
    if(!root || root.__vrDstatWired) return;
    root.__vrDstatWired=true;
    root.addEventListener('click', function(e){
      var head=e.target.closest && e.target.closest('.vr-dstat__head');
      if(!head || !root.contains(head)) return;
      var item=head.parentNode, body=item.querySelector('.vr-dstat__body');
      var open=head.getAttribute('aria-expanded')==='true';
      head.setAttribute('aria-expanded', open?'false':'true');
      if(body) body.hidden=open;
      item.classList.toggle('is-open', !open);
    });
  }

  return { build:build, render:render, wire:wire };
})();
