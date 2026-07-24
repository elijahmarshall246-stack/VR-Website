(function(){
  var subtabs = document.getElementById('lbSubtabs');
  var overall = document.getElementById('lbOverall');
  var heats   = document.getElementById('lbHeats');
  if (!subtabs || !overall || !heats) return;

  function setSub(which){
    overall.classList.toggle('qf-off', which !== 'overall');
    heats.classList.toggle('qf-off',  which !== 'heats');
    Array.prototype.forEach.call(subtabs.children, function(b){
      b.classList.toggle('active', b.dataset.sub === which);
    });
  }

  Array.prototype.forEach.call(subtabs.children, function(b){
    b.addEventListener('click', function(){ setSub(b.dataset.sub); });
  });

  setSub('overall');

  var tabs   = document.getElementById('lbTabs');
  var filter = document.getElementById('vrClassFilter');
  if (tabs && filter){
    Array.prototype.forEach.call(tabs.children, function(b){
      b.addEventListener('click', function(){
        filter.style.display = (b.dataset.view === '1') ? 'none' : '';
      });
    });
  }
})();
