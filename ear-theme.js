// Переключатель темы: «как в системе» → светлая → тёмная → панель → детская.
// Подключается в начале страницы, чтобы не мигало.
(function(){
  var KEY = 'ear-theme';
  var ORDER = [null, 'light', 'dark', 'panel', 'kid'];
  var root = document.documentElement;

  // Шрифты тем тянем только когда тема включена — остальным они ни к чему.
  var loaded = {};
  function font(key, href){
    if(loaded[key]) return;
    loaded[key] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }
  function kidFonts(){
    font('kid', 'https://fonts.googleapis.com/css2?family=Comfortaa:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap');
  }
  function panelFonts(){
    font('panel', 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  }

  function apply(t){
    if(t === 'light' || t === 'dark' || t === 'kid' || t === 'panel') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    if(t === 'kid') kidFonts();
    if(t === 'panel') panelFonts();
  }

  var saved = null;
  try{ saved = window.localStorage.getItem(KEY); }catch(e){}
  apply(saved);

  var PAW = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<ellipse cx="12" cy="17" rx="6.4" ry="5.2"/><circle cx="4.6" cy="9.4" r="2.6"/>' +
    '<circle cx="9.2" cy="6.2" r="2.8"/><circle cx="14.8" cy="6.2" r="2.8"/><circle cx="19.4" cy="9.4" r="2.6"/></svg>';

  // Три кота под шапкой. В разметку кладём всегда, показывает их только детская тема.
  function cat(x, fur, opts){
    var d = fur + '-dark';
    return '<g transform="translate(' + x + ' 0)' + (opts.flip ? ' scale(-1 1) translate(-100 0)' : '') + '">' +
      '<path class="' + fur + ' ' + (opts.wag ? 'tail-wag' : '') + '" d="M78 106 C 102 108 110 84 98 70 L 90 74 C 98 86 92 98 76 96 Z"/>' +
      '<path class="' + fur + '" d="M50 44 C 70 44 84 78 84 100 C 84 112 70 118 50 118 C 30 118 16 112 16 100 C 16 78 30 44 50 44 Z"/>' +
      (opts.bib ? '<path class="bib" d="M50 74 C 60 74 66 92 66 104 C 66 112 58 116 50 116 C 42 116 34 112 34 104 C 34 92 40 74 50 74 Z"/>' : '') +
      (opts.stripes ? '<g class="' + d + '"><rect x="28" y="84" width="16" height="5" rx="2.5"/>' +
        '<rect x="56" y="84" width="16" height="5" rx="2.5"/><rect x="31" y="98" width="13" height="5" rx="2.5"/>' +
        '<rect x="56" y="98" width="13" height="5" rx="2.5"/></g>' : '') +
      '<ellipse class="' + (opts.socks ? 'bib' : fur) + '" cx="36" cy="113" rx="10" ry="6"/>' +
      '<ellipse class="' + (opts.socks ? 'bib' : fur) + '" cx="64" cy="113" rx="10" ry="6"/>' +
      '<path class="' + fur + '" d="M26 30 L 22 4 L 46 20 Z"/><path class="' + fur + '" d="M74 30 L 78 4 L 54 20 Z"/>' +
      '<path class="ear-in" d="M29 27 L 27 12 L 41 21 Z"/><path class="ear-in" d="M71 27 L 73 12 L 59 21 Z"/>' +
      '<circle class="' + fur + '" cx="50" cy="44" r="27"/>' +
      (opts.stripes ? '<g class="' + d + '"><rect x="44" y="18" width="4.5" height="12" rx="2.2"/>' +
        '<rect x="51.5" y="18" width="4.5" height="12" rx="2.2"/></g>' : '') +
      (opts.eyesClosed
        ? '<path class="whisker" style="stroke-width:2.6;opacity:1" d="M35 45 q5 -6 10 0"/>' +
          '<path class="whisker" style="stroke-width:2.6;opacity:1" d="M55 45 q5 -6 10 0"/>'
        : '<circle class="face" cx="40" cy="44" r="3.8"/><circle class="face" cx="60" cy="44" r="3.8"/>') +
      '<path class="nose" d="M50 54 l 4 -3.6 h -8 Z"/>' +
      '<path class="whisker" d="M50 55 v 3 M50 58 q -4 3 -7 1 M50 58 q 4 3 7 1"/>' +
      '<path class="whisker" d="M40 55 h -14 M40 59 h -13 M60 55 h 14 M60 59 h 13"/>' +
      '</g>';
  }

  // Детская тема: на плитках вместо римских цифр — До-Ре-Ми. Клики завязаны на dataset, текст менять безопасно.
  var RU = { C:'До', D:'Ре', E:'Ми', F:'Фа', G:'Соль', A:'Ля', B:'Си' };
  function ruNote(name){
    var m = /^([A-G])([#b]?)/.exec(name || '');
    if(!m) return null;
    return RU[m[1]] + (m[2] === '#' ? '-диез' : m[2] === 'b' ? '-бемоль' : '');
  }
  var relabeling = false;
  function relabel(){
    if(relabeling) return;
    relabeling = true;
    try{ doRelabel(); } finally { relabeling = false; }
  }
  function doRelabel(){
    var kid = root.getAttribute('data-theme') === 'kid';
    Array.prototype.forEach.call(document.querySelectorAll('.degree-tile'), function(tile){
      var roman = tile.querySelector('.roman'), chord = tile.querySelector('.chordname');
      if(!roman || !chord) return;
      if(kid){
        var ru = ruNote(chord.textContent);
        if(!ru || tile.dataset.kidLabel === '1') return;
        tile.dataset.kidRoman = roman.textContent;
        tile.dataset.kidChord = chord.textContent;
        tile.dataset.kidLabel = '1';
        roman.textContent = ru;
        chord.textContent = tile.dataset.kidRoman + ' · ' + tile.dataset.kidChord;
      }else if(tile.dataset.kidLabel === '1'){
        roman.textContent = tile.dataset.kidRoman;
        chord.textContent = tile.dataset.kidChord;
        delete tile.dataset.kidLabel;
      }
    });
  }
  // Плитки страница перерисовывает сама — ловим это наблюдателем, а не правкой её кода.
  function watchTiles(){
    relabel();
    if(!window.MutationObserver) return;
    new MutationObserver(function(){ relabel(); }).observe(document.body, { childList:true, subtree:true });
  }

  function cats(){
    var box = document.createElement('div');
    box.className = 'kid-cats';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<svg viewBox="0 0 340 132">' +
      cat(0,   'fur-a', { stripes:true, wag:true }) +
      cat(120, 'fur-b', { bib:true, socks:true, eyesClosed:true }) +
      cat(240, 'fur-c', { bib:true, socks:true, flip:true }) +
      '<path class="ground" d="M4 126 H 336"/></svg>';
    return box;
  }

  document.addEventListener('DOMContentLoaded', function(){
    var nav = document.querySelector('.site-nav');
    if(!nav) return;

    var anchor = document.querySelector('.hero') || nav;
    anchor.parentNode.insertBefore(cats(), anchor.nextSibling);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    function label(){
      var t = root.getAttribute('data-theme');
      btn.innerHTML = t === 'dark' ? '☾ Тёмная'
        : t === 'light' ? '☀ Светлая'
        : t === 'kid' ? PAW + 'Детская'
        : t === 'panel' ? '▣ Панель'
        : '◐ Как в системе';
      btn.title = 'Тема оформления — нажмите, чтобы переключить';
    }
    btn.addEventListener('click', function(){
      var t = root.getAttribute('data-theme');
      var next = ORDER[(ORDER.indexOf(t || null) + 1) % ORDER.length];
      apply(next);
      try{ if(next) window.localStorage.setItem(KEY, next); else window.localStorage.removeItem(KEY); }catch(e){}
      label();
      relabel();
    });
    label();
    nav.appendChild(btn);
    watchTiles();
  });
})();
