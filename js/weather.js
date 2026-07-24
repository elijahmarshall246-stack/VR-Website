(function(){

  var W = (window.VR_CONFIG && window.VR_CONFIG.weather) || {};
  var CFG = {
    label1:   W.label1   || "VAUCLUSE RACEWAY",
    label2:   W.label2   || "CURRENT WEATHER",
    lat:      W.lat      != null ? W.lat : 13.17,
    lon:      W.lon      != null ? W.lon : -59.58,
    timezone: W.timezone || "America/Barbados",
    unit:     W.unit     || "celsius"
  };

  var ICONS={
    sun:'<svg viewBox="0 0 56 56" fill="none"><circle cx="28" cy="28" r="10" fill="#111"/><g stroke="#111" stroke-width="2.2" stroke-linecap="round"><line x1="28" y1="6" x2="28" y2="12"/><line x1="28" y1="44" x2="28" y2="50"/><line x1="6" y1="28" x2="12" y2="28"/><line x1="44" y1="28" x2="50" y2="28"/><line x1="12.7" y1="12.7" x2="16.8" y2="16.8"/><line x1="39.2" y1="39.2" x2="43.3" y2="43.3"/><line x1="43.3" y1="12.7" x2="39.2" y2="16.8"/><line x1="16.8" y1="39.2" x2="12.7" y2="43.3"/></g></svg>',
    partly:'<svg viewBox="0 0 56 56" fill="none"><circle cx="22" cy="22" r="10" fill="#111" opacity=".2"/><g stroke="#111" stroke-width="1.8" stroke-linecap="round" opacity=".28"><line x1="22" y1="7" x2="22" y2="11"/><line x1="7" y1="22" x2="11" y2="22"/><line x1="11.5" y1="11.5" x2="14.3" y2="14.3"/><line x1="33.7" y1="11.5" x2="30.9" y2="14.3"/></g><path d="M10 34 Q10 26 18 26 Q20 18 30 20 Q38 20 38 28 Q44 28 44 34 Q44 42 36 42 H18 Q10 42 10 34Z" fill="#111"/></svg>',
    cloud:'<svg viewBox="0 0 56 56" fill="none"><path d="M10 34 Q10 26 18 26 Q20 18 30 20 Q38 20 38 28 Q44 28 44 34 Q44 42 36 42 H18 Q10 42 10 34Z" fill="#111"/></svg>',
    drizzle:'<svg viewBox="0 0 56 56" fill="none"><path d="M10 30 Q10 22 18 22 Q20 14 30 16 Q38 16 38 24 Q44 24 44 30 Q44 37 36 37 H18 Q10 37 10 30Z" fill="#111"/><g stroke="#111" stroke-width="2" stroke-linecap="round"><line x1="20" y1="42" x2="17" y2="50"/><line x1="28" y1="42" x2="25" y2="50"/><line x1="36" y1="42" x2="33" y2="50"/></g></svg>',
    rain:'<svg viewBox="0 0 56 56" fill="none"><path d="M10 30 Q10 22 18 22 Q20 14 30 16 Q38 16 38 24 Q44 24 44 30 Q44 37 36 37 H18 Q10 37 10 30Z" fill="#111"/><g stroke="#111" stroke-width="2.5" stroke-linecap="round"><line x1="19" y1="42" x2="15" y2="53"/><line x1="28" y1="42" x2="24" y2="53"/><line x1="37" y1="42" x2="33" y2="53"/></g></svg>',
    thunder:'<svg viewBox="0 0 56 56" fill="none"><path d="M10 28 Q10 20 18 20 Q20 12 30 14 Q38 14 38 22 Q44 22 44 28 Q44 35 36 35 H18 Q10 35 10 28Z" fill="#111"/><polygon points="32,35 24,46 29,46 25,55 37,40 32,40" fill="#111"/></svg>',
    snow:'<svg viewBox="0 0 56 56" fill="none"><path d="M10 30 Q10 22 18 22 Q20 14 30 16 Q38 16 38 24 Q44 24 44 30 Q44 37 36 37 H18 Q10 37 10 30Z" fill="#111"/><g stroke="#111" stroke-width="2.5" stroke-linecap="round"><line x1="20" y1="43" x2="20" y2="50"/><line x1="17" y1="46.5" x2="23" y2="46.5"/><line x1="28" y1="43" x2="28" y2="50"/><line x1="25" y1="46.5" x2="31" y2="46.5"/><line x1="36" y1="43" x2="36" y2="50"/><line x1="33" y1="46.5" x2="39" y2="46.5"/></g></svg>',
    showers:'<svg viewBox="0 0 56 56" fill="none"><path d="M10 34 Q10 26 18 26 Q20 18 30 20 Q38 20 38 28 Q44 28 44 34 Q44 42 36 42 H18 Q10 42 10 34Z" fill="#111" opacity=".18"/><path d="M16 38 Q16 32 22 32 Q24 26 32 28 Q38 28 38 34 Q42 34 42 38 Q42 44 36 44 H22 Q16 44 16 38Z" fill="#111"/><g stroke="#111" stroke-width="2" stroke-linecap="round"><line x1="22" y1="48" x2="20" y2="54"/><line x1="29" y1="48" x2="27" y2="54"/><line x1="36" y1="48" x2="34" y2="54"/></g></svg>'
  };

  function decode(code){
    if(code===0)  return{icon:"sun"};
    if(code<=2)   return{icon:"partly"};
    if(code<=3)   return{icon:"cloud"};
    if(code<=49)  return{icon:"cloud"};
    if(code<=55)  return{icon:"drizzle"};
    if(code<=65)  return{icon:"rain"};
    if(code<=77)  return{icon:"snow"};
    if(code<=82)  return{icon:"showers"};
    if(code<=86)  return{icon:"snow"};
    if(code<=99)  return{icon:"thunder"};
    return{icon:"cloud"};
  }

  function run(){
    var tu=CFG.unit==='fahrenheit'?'fahrenheit':'celsius';
    var url='https://api.open-meteo.com/v1/forecast?latitude='+CFG.lat+'&longitude='+CFG.lon+'&current=temperature_2m,weather_code&temperature_unit='+tu+'&timezone='+encodeURIComponent(CFG.timezone);
    fetch(url).then(function(r){return r.json();}).then(function(d){
      var c=d.current;
      var cond=decode(c.weather_code);
      var temp=Math.round(c.temperature_2m);
      var u=CFG.unit==='fahrenheit'?'°F':'°C';
      var w=document.getElementById('vwr-widget');
      if(!w)return;
      w.innerHTML=
        '<div class="vwr-labels"><div class="vwr-l1">'+CFG.label1+'</div><div class="vwr-l2">'+CFG.label2+'</div></div>'+
        '<div class="vwr-right"><div class="vwr-icon">'+ICONS[cond.icon]+'</div><div class="vwr-t">'+temp+u+'</div></div>';
    }).catch(function(){});
  }

  run();
  setInterval(run,10*60*1000);
})();
