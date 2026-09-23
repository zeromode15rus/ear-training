// Общие гриф и теория для тренажёров «Лады» и «Импровизация».
(function(){
  'use strict';

  function mod(n, m){ return ((n % m) + m) % m; }

  // ---------- теория ----------
  var SHARP = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  var FLAT  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
  var KEY_NAMES = ['C','D♭','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  var RU = ['До','Ре-бемоль','Ре','Ми-бемоль','Ми','Фа','Фа-диез','Соль','Ля-бемоль','Ля','Си-бемоль','Си'];

  // Лады по яркости: каждый следующий отличается от предыдущего одной пониженной ступенью.
  var MODES = [
    { id:'lydian',     name:'Лидийский',       steps:[0,2,4,6,7,9,11], char:[3], charLabel:'♯4', family:'major',
      relation:'мажор с повышенной IV ступенью', vamp:[[0,'maj'],[2,'maj']], vampName:'I – II',
      songs:'заставка «Симпсонов», Flying in a Blue Dream (Дж. Сатриани)' },
    { id:'ionian',     name:'Ионийский (мажор)', steps:[0,2,4,5,7,9,11], char:[6], charLabel:'♮7', family:'major',
      relation:'обычный мажор — точка отсчёта', vamp:[[0,'maj'],[5,'maj'],[7,'maj']], vampName:'I – IV – V',
      songs:'большинство поп-песен; «Ода к радости»' },
    { id:'mixolydian', name:'Миксолидийский',  steps:[0,2,4,5,7,9,10], char:[6], charLabel:'♭7', family:'major',
      relation:'мажор с пониженной VII ступенью', vamp:[[0,'maj'],[10,'maj']], vampName:'I – ♭VII',
      songs:'Norwegian Wood (The Beatles), Sweet Home Alabama' },
    { id:'dorian',     name:'Дорийский',       steps:[0,2,3,5,7,9,10], char:[5], charLabel:'♮6', family:'minor',
      relation:'минор с натуральной (высокой) VI ступенью', vamp:[[0,'min'],[5,'maj']], vampName:'i – IV',
      songs:'Scarborough Fair, Oye Como Va, So What (М. Дэвис)' },
    { id:'aeolian',    name:'Эолийский (минор)', steps:[0,2,3,5,7,8,10], char:[5], charLabel:'♭6', family:'minor',
      relation:'натуральный минор — точка отсчёта', vamp:[[0,'min'],[8,'maj'],[10,'maj']], vampName:'i – ♭VI – ♭VII',
      songs:'огромная часть рока и баллад в миноре' },
    { id:'phrygian',   name:'Фригийский',      steps:[0,1,3,5,7,8,10], char:[1], charLabel:'♭2', family:'minor',
      relation:'минор с пониженной II ступенью', vamp:[[0,'min'],[1,'maj']], vampName:'i – ♭II',
      songs:'фламенко, испанский колорит, многие метал-риффы' },
    { id:'locrian',    name:'Локрийский',      steps:[0,1,3,5,6,8,10], char:[4], charLabel:'♭5', family:'dim',
      relation:'минор с пониженными II и V ступенями', vamp:[[0,'dim'],[1,'maj']], vampName:'i° – ♭II',
      songs:'почти не бывает опорным ладом — неустойчивая тоника' }
  ];
  function modeById(id){ for(var i = 0; i < MODES.length; i++) if(MODES[i].id === id) return MODES[i]; return MODES[1]; }

  var SCALES = {
    ionian:{ name:'Мажор (ионийский)', steps:MODES[1].steps },
    dorian:{ name:'Дорийский', steps:MODES[3].steps },
    phrygian:{ name:'Фригийский', steps:MODES[5].steps },
    lydian:{ name:'Лидийский', steps:MODES[0].steps },
    mixolydian:{ name:'Миксолидийский', steps:MODES[2].steps },
    aeolian:{ name:'Натуральный минор (эолийский)', steps:MODES[4].steps },
    locrian:{ name:'Локрийский', steps:MODES[6].steps },
    harmonic:{ name:'Гармонический минор', steps:[0,2,3,5,7,8,11] },
    majpent:{ name:'Мажорная пентатоника', steps:[0,2,4,7,9] },
    minpent:{ name:'Минорная пентатоника', steps:[0,3,5,7,10] },
    blues:{ name:'Блюзовая гамма', steps:[0,3,5,6,7,10] }
  };

  var QUALITY = {
    maj:{ iv:[0,4,7], sfx:'' }, min:{ iv:[0,3,7], sfx:'m' }, dim:{ iv:[0,3,6], sfx:'°' },
    '7':{ iv:[0,4,7,10], sfx:'7' }, m7:{ iv:[0,3,7,10], sfx:'m7' }, maj7:{ iv:[0,4,7,11], sfx:'maj7' },
    m7b5:{ iv:[0,3,6,10], sfx:'m7♭5' }
  };

  // Бемоли или диезы: по родительскому мажору тональности (тоника минус сдвиг лада).
  function useFlats(tonicPc, steps){
    var family3 = steps && steps.indexOf(3) >= 0 && steps.indexOf(4) < 0;
    var parent = family3 ? mod(tonicPc + 3, 12) : tonicPc;
    return [5,10,3,8,1].indexOf(parent) >= 0;
  }
  function noteName(pc, flats){ return (flats ? FLAT : SHARP)[mod(pc, 12)]; }
  function chordName(rootPc, quality, flats){ return noteName(rootPc, flats) + QUALITY[quality].sfx; }

  // Интервал от корня аккорда → роль для цвета на грифе.
  function chordRole(iv){
    iv = mod(iv, 12);
    if(iv === 0) return 'r';
    if(iv === 3 || iv === 4) return 't3';
    if(iv === 6 || iv === 7 || iv === 8) return 't5';
    if(iv === 10 || iv === 11 || iv === 9) return 't7';
    return '';
  }

  // Аккорд для аккомпанемента: плотное расположение, плавное голосоведение, бас отдельно.
  function voiceChord(rootPc, quality, prevAvg){
    var pcs = QUALITY[quality].iv.map(function(i){ return mod(rootPc + i, 12); });
    var best = null;
    for(var inv = 0; inv < pcs.length; inv++){
      var order = pcs.slice(inv).concat(pcs.slice(0, inv));
      for(var base = 50; base <= 62; base++){
        if(mod(base, 12) !== order[0]) continue;
        var v = [base], last = base;
        for(var q = 1; q < order.length; q++){ var m = last + mod(order[q] - last, 12); if(m === last) m += 12; v.push(m); last = m; }
        if(v[v.length - 1] > 74) continue;
        var avg = v.reduce(function(a, b){ return a + b; }, 0) / v.length;
        var d = Math.abs(avg - (prevAvg || 60));
        if(!best || d < best.d) best = { v:v, d:d, avg:avg };
      }
    }
    var bass = 28 + mod(rootPc - 4, 12);   // бас: от E1 (28) до D♯2
    return { notes: best.v, avg: best.avg, bass: bass, pcs: pcs };
  }

  // ---------- CAGED (для позиций) ----------
  var OPEN = [40, 45, 50, 55, 59, 64];   // струны 6→1
  var MAX_FRET = 15;
  var SHAPE_ORDER = ['C','A','G','E','D'];
  var SHAPES = {
    major: { C:{ frets:[null,3,2,0,1,0], root:0 }, A:{ frets:[null,0,2,2,2,0], root:9 }, G:{ frets:[3,2,0,0,0,3], root:7 },
             E:{ frets:[0,2,2,1,0,0], root:4 }, D:{ frets:[null,null,0,2,3,2], root:2 } },
    minor: { C:{ frets:[null,3,1,0,1,null], root:0 }, A:{ frets:[null,0,2,2,1,0], root:9 }, G:{ frets:[3,1,0,0,3,3], root:7 },
             E:{ frets:[0,2,2,0,0,0], root:4 }, D:{ frets:[null,null,0,2,3,1], root:2 } }
  };
  function cagedVoicing(quality, shape, rootPc, up){
    var sh = SHAPES[quality][shape];
    var shift = mod(rootPc - sh.root, 12) + (up ? 12 : 0);
    var frets = sh.frets.map(function(f){ return f === null ? null : f + shift; });
    var used = frets.filter(function(f){ return f !== null; });
    var lo = Math.min.apply(null, used), hi = Math.max.apply(null, used);
    if(hi > MAX_FRET) return null;
    return { shape:shape, frets:frets, lo:lo, hi:hi };
  }
  // Пять позиций гаммы вокруг форм тонического трезвучия, снизу вверх.
  function positions(tonicPc, minor){
    var q = minor ? 'minor' : 'major';
    var list = SHAPE_ORDER.map(function(n){ return cagedVoicing(q, n, tonicPc, false); }).filter(Boolean);
    list.sort(function(a, b){ return a.lo - b.lo; });
    return list.map(function(v){
      return { shape:v.shape, lo:Math.max(0, v.lo - 1), hi:Math.min(MAX_FRET, v.hi + 1), label:'форма ' + v.shape + ' · лады ' + Math.max(0, v.lo - 1) + '–' + Math.min(MAX_FRET, v.hi + 1) };
    });
  }

  // Все места на грифе для набора высот (pc) в окне ладов.
  function scaleDots(tonicPc, steps, lo, hi){
    var out = [];
    for(var s = 0; s < 6; s++){
      for(var f = lo; f <= hi; f++){
        var iv = mod(OPEN[s] + f - tonicPc, 12);
        var d = steps.indexOf(iv);
        if(d < 0) continue;
        out.push({ s:s, f:f, iv:iv, deg:d, midi: OPEN[s] + f });
      }
    }
    return out;
  }

  // Где взять ноту midi на грифе: ближе к центру окна (или к предыдущему ладу).
  function placeMidi(midi, lo, hi, near){
    var best = null;
    for(var s = 0; s < 6; s++){
      var f = midi - OPEN[s];
      if(f < 0 || f > MAX_FRET) continue;
      var outside = f < lo ? lo - f : f > hi ? f - hi : 0;
      var score = outside * 10 + Math.abs(f - (near !== undefined ? near : (lo + hi) / 2));
      if(!best || score < best.score) best = { s:s, f:f, score:score };
    }
    return best;
  }

  // Ступень от тоники в виде «♭3», «♯4», «5».
  var IV_LABEL = ['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7'];
  function ivLabel(iv, steps){
    iv = mod(iv, 12);
    if(iv === 6 && steps && steps.indexOf(7) < 0 && steps.indexOf(6) >= 0) return '♭5';
    if(iv === 6 && steps && steps.indexOf(5) < 0) return '♯4';
    return IV_LABEL[iv];
  }

  // ---------- рисование грифа ----------
  var NUT_X = 52, END_X = 988, TOP_Y = 28, STR_GAP = 30;
  function fretX(n){
    var k = (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -MAX_FRET / 12));
    return NUT_X + (END_X - NUT_X) * k;
  }
  function noteX(f){ return f === 0 ? NUT_X - 24 : (fretX(f - 1) + fretX(f)) / 2; }
  function stringY(s){ return TOP_Y + (5 - s) * STR_GAP; }
  function el(tag, attrs, text){
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function(k){ e.setAttribute(k, attrs[k]); });
    if(text !== undefined) e.textContent = text;
    return e;
  }

  // opts: { regions:[{lo,hi,label,active}], dots:[{s,f,cls,label}] } — точки рисуются в порядке списка.
  function draw(svg, opts){
    svg.innerHTML = '';
    var bottom = stringY(0);
    svg.appendChild(el('rect', { class:'wood', x:NUT_X, y:TOP_Y - 12, width:END_X - NUT_X, height:bottom - TOP_Y + 24, rx:3 }));
    (opts.regions || []).forEach(function(r){
      var x1 = r.lo === 0 ? NUT_X - 40 : fretX(r.lo - 1) + 2;
      var x2 = fretX(r.hi) - 2;
      var g = el('g', { class:'region' + (r.active ? ' active' : '') });
      g.appendChild(el('rect', { x:x1, y:TOP_Y - 12, width:Math.max(8, x2 - x1), height:bottom - TOP_Y + 24, rx:6 }));
      if(r.label) g.appendChild(el('text', { x:(x1 + x2) / 2, y:TOP_Y - 17 }, r.label));
      svg.appendChild(g);
    });
    [3,5,7,9,15].forEach(function(n){ svg.appendChild(el('circle', { class:'inlay', cx:noteX(n), cy:(stringY(2) + stringY(3)) / 2, r:7 })); });
    svg.appendChild(el('circle', { class:'inlay', cx:noteX(12), cy:(stringY(1) + stringY(2)) / 2, r:7 }));
    svg.appendChild(el('circle', { class:'inlay', cx:noteX(12), cy:(stringY(3) + stringY(4)) / 2, r:7 }));
    for(var n = 1; n <= MAX_FRET; n++) svg.appendChild(el('line', { class:'fret', x1:fretX(n), x2:fretX(n), y1:TOP_Y - 12, y2:bottom + 12 }));
    svg.appendChild(el('line', { class:'nut', x1:NUT_X, x2:NUT_X, y1:TOP_Y - 13, y2:bottom + 13 }));
    for(var s = 0; s < 6; s++){
      svg.appendChild(el('line', { class:'string', x1:NUT_X - 40, x2:END_X, y1:stringY(s), y2:stringY(s), 'stroke-width': 0.8 + (5 - s) * 0.3 }));
    }
    [1,3,5,7,9,12,15].forEach(function(n){ svg.appendChild(el('text', { class:'fretnum', x:noteX(n), y:bottom + 32 }, n)); });
    (opts.dots || []).forEach(function(d){
      var g = el('g', { class:'dot ' + (d.cls || '') });
      g.appendChild(el('circle', { cx:noteX(d.f), cy:stringY(d.s), r:d.r || 12 }));
      if(d.label) g.appendChild(el('text', { x:noteX(d.f), y:stringY(d.s) + 0.5 }, d.label));
      svg.appendChild(g);
    });
  }

  window.EarFret = {
    mod: mod, SHARP: SHARP, FLAT: FLAT, KEY_NAMES: KEY_NAMES, RU: RU,
    MODES: MODES, modeById: modeById, SCALES: SCALES, QUALITY: QUALITY,
    useFlats: useFlats, noteName: noteName, chordName: chordName, chordRole: chordRole, voiceChord: voiceChord,
    OPEN: OPEN, MAX_FRET: MAX_FRET, cagedVoicing: cagedVoicing, positions: positions,
    scaleDots: scaleDots, placeMidi: placeMidi, ivLabel: ivLabel, draw: draw
  };
})();
