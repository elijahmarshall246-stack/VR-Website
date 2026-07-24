(function(){
  var EV = (window.VR_CONFIG && window.VR_CONFIG.live && window.VR_CONFIG.live.events) || {};
  var SHEET_ID   = EV.sheetId || "1ghHvvVe4kNnkVUbYTsBHxrfB2MLH-erhOCvlOBbU3Uc";
  var EVENTS_GID = EV.gid     || "1914616841";
  var all = [];

  
  function gvizEvents(cb){
    var base = "https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?gid="+EVENTS_GID+"&headers=1";
    var cbName = "__erGviz"+Date.now();
    var script = document.createElement("script");
    var done = false;
    function val(cell){ return cell ? (cell.f != null ? cell.f : (cell.v != null ? cell.v : "")) : ""; }
  
    var timer = setTimeout(function(){
      if(done) return; done = true;
      delete window[cbName]; script.remove();
      cb(null, "request timed out — the connection to Google Sheets was blocked or never responded. Try an incognito window with extensions disabled, and confirm you're opening the GitHub Pages URL (you.github.io/...), not the github.com source view.");
    }, 12000);
    window[cbName] = function(resp){
      if(done) return; done = true; clearTimeout(timer);
      delete window[cbName]; script.remove();
      if(!resp || resp.status !== "ok"){
        var msg = (resp && resp.errors && resp.errors[0] && (resp.errors[0].detailed_message || resp.errors[0].message))
                  || "sheet error — ensure it's shared \"Anyone with the link\"";
        cb(null, msg); return;
      }
      var table = resp.table || {};
      var headers = (table.cols || []).map(function(c){ return String(c.label||"").trim().toLowerCase(); });
      var out = [];
      (table.rows || []).forEach(function(row){
        var cells = row.c || [], obj = {};
        headers.forEach(function(h, i){ if(h) obj[h] = val(cells[i]).toString().trim(); });
        if(obj.name || obj.month) out.push(obj);   // same filter the Apps Script used
      });
      cb(out);
    };
    script.onerror = function(){ if(done) return; done = true; clearTimeout(timer); delete window[cbName]; script.remove(); cb(null, "network error — the request to Google Sheets was blocked (check for ad/privacy blockers) or failed to load."); };
    script.src = base + "&tqx=out:json;responseHandler:"+cbName;
    document.head.appendChild(script);
  }


  var EMPTY_HTML = '<div style="width:100%;min-height:260px;display:flex;align-items:center;justify-content:center;text-align:center;color:#888;font-size:16px;font-weight:600;font-family:Arial,sans-serif;padding:40px 20px;box-sizing:border-box;">No upcoming events just yet — watch this space.</div>';

  var TYPES = {
    rallysprint: { bg: "#F1592A", label: "RallySprint" },
    rallycross:  { bg: "#F1592A", label: "RallyCross" },
    social:      { bg: "#FFA600", label: "Social" },
  };

  function getType(type){
    var k = (type||"").toLowerCase().replace(/\s+/g,"");
    return TYPES[k] || { bg:"#F1592A", label: type||"Event" };
  }

  function liveBanner(ev){
    var t = getType(ev.type);
    var isFeatured = (ev.featured||"").toLowerCase() === "yes";
    var isSocial = (ev.type||"").toLowerCase().replace(/\s+/g,"") === "social";
    var bannerBg = isSocial ? "#FFB143" : "#1E1E1E";
    return '<div class="er-card" style="width:100%;max-width:100%;box-sizing:border-box;background:'+bannerBg+';border-radius:12px;padding:22px;font-family:Arial,sans-serif;margin-bottom:0;overflow:hidden;">'


      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">'
        +'<div style="display:inline-flex;align-items:center;gap:8px;background:#CC0000;color:#fff;font-size:14px;font-weight:700;padding:6px 16px;border-radius:99px;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">'
          +'<span class="er-live-dot" style="display:inline-block;width:11px;height:11px;border-radius:50%;background:#fff;"></span>'
          +'LIVE'
        +'</div>'
        +(isFeatured ? '<span style="display:inline-block;background:#F1592A;color:#fff;font-size:13px;font-weight:700;padding:6px 16px;border-radius:99px;letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">FEATURED</span>' : '')
      +'</div>'

      +'<div class="er-live-row" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">'
        +'<div style="display:flex;align-items:center;gap:10px;">'
          +'<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">'
            +'<div style="font-size:30px;font-weight:800;color:#fff;line-height:0.8;font-family:Arial,sans-serif;">'+(ev.day||'—')+'</div>'
            +'<div style="font-size:14px;font-weight:800;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;font-family:Arial,sans-serif;">'+(ev.month||'')+'</div>'
          +'</div>'
          +'<div style="font-size:22px;font-weight:800;color:#fff;line-height:1.2;text-transform:uppercase;font-family:Arial,sans-serif;">'+(ev.name||'Untitled Event')+'</div>'
        +'</div>'
        +(isSocial ? '' : '<a class="er-live-btn" href="'+(ev.link||'https://www.jollyrogercruises.com')+'" target="_blank" style="flex-shrink:0;display:inline-block;background:#F1592A;color:#fff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:99px;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;font-family:Arial,sans-serif;white-space:nowrap;">See Live Results</a>')
      +'</div>'

      +(ev.desc ? '<div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6;margin-bottom:12px;font-family:Arial,sans-serif;">'+ev.desc+'</div>' : '')

      +'<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:10px;font-size:12px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:space-between;">'
      +'<span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:5px;opacity:0.8;"><circle cx="8" cy="8" r="6.5" stroke="#fff" stroke-width="1.4"/><path d="M8 5v3.5l2 1.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>'+(ev.time||'TBA')+(ev.year?' <span style="color:rgba(255,255,255,0.45);margin-left:8px;">'+ev.year+'</span>':'')+' </span>'
      +(ev.type ? '<span style="font-size:12px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;">'+ev.type+'</span>' : '')
      +'</div>'

    +'</div>';
  }

  function cardHTML(ev){
    var t = getType(ev.type);
    var isFeatured = (ev.featured||"").toLowerCase() === "yes";
    var bg = isFeatured ? "#074A77" : t.bg;

    return '<div class="er-card" style="flex:1 1 320px;max-width:460px;background:'+bg+';border-radius:12px;padding:28px;box-sizing:border-box;font-family:Arial,sans-serif;">'

      +(isFeatured ? '<div style="display:inline-block;background:#F1592A;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:12px;font-family:Arial,sans-serif;">FEATURED</div><br>' : '')

      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
        +'<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">'
          +'<div style="font-size:38px;font-weight:800;color:#fff;line-height:0.8;font-family:Arial,sans-serif;">'+(ev.day||'—')+'</div>'
          +'<div style="font-size:14px;font-weight:800;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;font-family:Arial,sans-serif;">'+(ev.month||'')+'</div>'
        +'</div>'
        +'<div style="font-size:26px;font-weight:800;color:#fff;line-height:1.2;text-transform:uppercase;font-family:Arial,sans-serif;">'+(ev.name||'Untitled Event')+'</div>'
      +'</div>'

      +(ev.desc ? '<div style="font-size:14px;color:rgba(255,255,255,0.85);line-height:1.6;margin-bottom:12px;font-family:Arial,sans-serif;">'+ev.desc+'</div>' : '')

      +'<div style="border-top:1px solid rgba(255,255,255,0.2);padding-top:10px;font-size:12px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:space-between;">'
      +'<span><svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:5px;opacity:0.8;"><circle cx="8" cy="8" r="6.5" stroke="#fff" stroke-width="1.4"/><path d="M8 5v3.5l2 1.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>'+(ev.time||'TBA')+(ev.year?' <span style="color:rgba(255,255,255,0.45);margin-left:8px;">'+ev.year+'</span>':'')+' </span>'
      +(ev.type ? '<span style="font-size:12px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;">'+ev.type+'</span>' : '')
      +'</div>'

    +'</div>';
  }

  function renderCards(events){
    var liveEl = document.getElementById("er-live");
    var cardsEl = document.getElementById("er-cards");

    var liveEvents = events.filter(function(e){ return (e.live||'').toLowerCase() === 'yes'; });
    var normalEvents = events.filter(function(e){ return (e.live||'').toLowerCase() !== 'yes'; });

    liveEl.innerHTML = liveEvents.length ? liveEvents.map(liveBanner).join('<div style="height:16px;"></div>') : '';
    if(liveEvents.length) liveEl.style.marginBottom = '16px';
    else liveEl.style.marginBottom = '0';

    if(!normalEvents.length && !liveEvents.length){
      cardsEl.innerHTML = EMPTY_HTML;
      setTimeout(resizeParent, 200);
      return;
    }
    cardsEl.innerHTML = normalEvents.map(cardHTML).join("");
    setTimeout(resizeParent, 200);
  }

  function renderFilters(events){
    var types = [...new Set(events.map(function(e){ return (e.type||"").toLowerCase().replace(/\s+/g,""); }).filter(Boolean))];
    var el = document.getElementById("er-filters");
    el.style.display = "block";
    var base = "font-size:12px;padding:5px 14px;border-radius:99px;cursor:pointer;font-family:Arial,sans-serif;margin:0 6px 6px 0;border:1.5px solid #ccc;background:#fff;color:#555;font-weight:500;";
    var active = "font-size:12px;padding:5px 14px;border-radius:99px;cursor:pointer;font-family:Arial,sans-serif;margin:0 6px 6px 0;border:1.5px solid #F1592A;background:#F1592A;color:#fff;font-weight:500;";
    el.innerHTML = '<button id="fb-all" style="'+active+'" onclick="erF(\'all\')">All</button>'
      + types.map(function(k){
          var t = TYPES[k] || { label: k.charAt(0).toUpperCase()+k.slice(1) };
          return '<button id="fb-'+k+'" style="'+base+'" onclick="erF(\''+k+'\')">'+t.label+'</button>';
        }).join("");
  }

  window.erF = function(type){
    var base = "font-size:12px;padding:5px 14px;border-radius:99px;cursor:pointer;font-family:Arial,sans-serif;margin:0 6px 6px 0;border:1.5px solid #ccc;background:#fff;color:#555;font-weight:500;";
    var active = "font-size:12px;padding:5px 14px;border-radius:99px;cursor:pointer;font-family:Arial,sans-serif;margin:0 6px 6px 0;border:1.5px solid #F1592A;background:#F1592A;color:#fff;font-weight:500;";
    document.querySelectorAll("#er-filters button").forEach(function(b){
      b.style.cssText = b.id === "fb-"+type ? active : base;
    });
    var filtered = type === "all" ? all : all.filter(function(e){
      return (e.type||"").toLowerCase().replace(/\s+/g,"") === type;
    });
    renderCards(filtered);
  };

  function showErr(msg){
    document.getElementById("er-state").innerHTML =
      '<div style="color:#c0392b;font-size:13px;font-family:Arial,sans-serif;">'+msg+'</div>'
      +'<button onclick="erLoad()" style="font-size:12px;color:#F1592A;background:none;border:none;cursor:pointer;text-decoration:underline;margin-top:6px;font-family:Arial,sans-serif;">Try again</button>';
  }

  function resizeParent(){
    window.parent.postMessage({ height: document.getElementById('race-cal').scrollHeight + 40 }, '*');
  }
  window.addEventListener('resize', function(){ setTimeout(resizeParent, 100); });

  window.erLoad = function(){
    var s = document.getElementById("er-state");

    s.style.display = "block";
    s.innerHTML = '<div class="er-spin" style="display:inline-block;width:18px;height:18px;border:2px solid #ddd;border-top-color:#F1592A;border-radius:50%;margin-bottom:8px;"></div><br>Loading events…';
    document.getElementById("er-cards").innerHTML = "";
    document.getElementById("er-live").innerHTML = "";
    document.getElementById("er-filters").style.display = "none";

    gvizEvents(function(rows, err){
      if(err || rows === null){
        showErr("Couldn't load events: " + (err || "unknown error"));
        return;
      }
      if(!rows.length){
        showErr("Sheet empty — check headers: month, day, name, desc, time, type, visible, featured, live");
        return;
      }
      all = rows.filter(function(e){ return (e.visible||'').toLowerCase() === 'yes'; });
      s.style.display = "none";
      if(!all.length){
        document.getElementById("er-cards").innerHTML = EMPTY_HTML;
        setTimeout(resizeParent, 200);
        return;
      }
      renderFilters(all);
      renderCards(all);
    });
  };

  erLoad();
})();
