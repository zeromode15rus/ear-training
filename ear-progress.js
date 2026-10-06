// Память тренажёров: журнал ответов, слабые места, матрица путаницы, подбор следующего вопроса.
// Всё лежит в localStorage этого устройства и никуда не уходит.
(function(){
  var KEY = 'ear-progress-v1';
  var RECENT = 10;        // сколько последних ответов держим по каждому вопросу
  var DAYS_KEEP = 400;

  var mem = null;         // запасной склад, если localStorage недоступен
  var cache = null;

  function blank(){ return { v:1, items:{}, conf:{}, days:{}, first:Date.now() }; }

  function load(){
    if(cache) return cache;
    var raw = null;
    try{ raw = window.localStorage.getItem(KEY); }catch(e){ raw = mem; }
    if(!raw){ cache = blank(); return cache; }
    try{
      var d = JSON.parse(raw);
      cache = (d && d.v === 1 && d.items) ? d : blank();
    }catch(e){ cache = blank(); }
    return cache;
  }

  function save(){
    var raw = JSON.stringify(cache);
    mem = raw;
    try{ window.localStorage.setItem(KEY, raw); }catch(e){}
  }

  function today(){
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function id(trainer, key){ return trainer + '|' + key; }

  // ---------- запись ----------

  function record(trainer, q){
    if(!trainer || !q || !q.key) return;
    var d = load();
    var k = id(trainer, q.key);
    var it = d.items[k] || (d.items[k] = { n:0, c:0, r:[], t:0, lab:'' });
    it.n++;
    if(q.correct) it.c++;
    it.r.push(q.correct ? 1 : 0);
    if(it.r.length > RECENT) it.r.splice(0, it.r.length - RECENT);
    it.t = Date.now();
    if(q.label) it.lab = q.label;

    if(!q.correct && q.answerKey && q.answerKey !== q.key){
      var ck = id(trainer, q.key) + '>' + q.answerKey;
      d.conf[ck] = (d.conf[ck] || 0) + 1;
      if(q.answerLabel){
        var ak = id(trainer, q.answerKey);
        if(!d.items[ak]) d.items[ak] = { n:0, c:0, r:[], t:0, lab:q.answerLabel };
        else if(!d.items[ak].lab) d.items[ak].lab = q.answerLabel;
      }
    }

    var day = d.days[today()] || (d.days[today()] = { n:0, c:0, tr:{} });
    day.n++;
    if(q.correct) day.c++;
    var t = day.tr[trainer] || (day.tr[trainer] = [0, 0]);
    t[0]++;
    if(q.correct) t[1]++;

    prune(d);
    save();
  }

  function prune(d){
    var keys = Object.keys(d.days);
    if(keys.length > DAYS_KEEP){
      keys.sort();
      keys.slice(0, keys.length - DAYS_KEEP).forEach(function(k){ delete d.days[k]; });
    }
  }

  // ---------- сила навыка и подбор ----------

  // Доля верных по последним ответам: свежие весят больше. Пока ответов мало,
  // подмешиваем нейтральные 0.5, чтобы один удачный тык не выглядел освоенным навыком.
  function strength(it){
    if(!it || !it.n) return 0;
    var r = it.r, sum = 0, w = 0;
    for(var i = 0; i < r.length; i++){
      var weight = 1 + i * 0.35;             // последний ответ весомее первого
      sum += r[i] * weight;
      w += weight;
    }
    var seen = Math.min(it.n, RECENT);
    var prior = 2;                            // сглаживание
    return (sum + 0.5 * prior) / (w + prior) * Math.min(1, 0.55 + seen * 0.09);
  }

  function daysSince(ts){
    if(!ts) return 999;
    return (Date.now() - ts) / 86400000;
  }

  function weightOf(trainer, key, avoid){
    var d = load();
    var it = d.items[id(trainer, key)];
    if(!it || !it.n) return 1.0;                        // новое показываем охотно
    var s = strength(it);
    var w = Math.pow(1 - s, 1.5) + 0.15;                // слабое — чаще
    w *= 1 + Math.min(1, daysSince(it.t) / 14) * 0.5;   // давно не встречалось — чуть чаще
    if(key === avoid) w *= 0.15;                        // не повторять вопрос подряд
    return w;
  }

  // items — массив ключей либо объектов {key,label}. explore — доля равномерного выбора.
  function pick(trainer, items, opts){
    opts = opts || {};
    if(!items || !items.length) return null;
    var keys = items.map(function(x){ return typeof x === 'string' ? x : x.key; });
    var explore = opts.explore === undefined ? 0.25 : opts.explore;

    if(keys.length === 1) return keys[0];
    if(Math.random() < explore){
      var r = keys[Math.floor(Math.random() * keys.length)];
      if(r === opts.avoid) r = keys[(keys.indexOf(r) + 1) % keys.length];
      return r;
    }

    var w = keys.map(function(k){ return weightOf(trainer, k, opts.avoid); });
    var total = w.reduce(function(a, b){ return a + b; }, 0);
    if(!(total > 0)) return keys[Math.floor(Math.random() * keys.length)];
    var x = Math.random() * total;
    for(var i = 0; i < keys.length; i++){
      x -= w[i];
      if(x <= 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  // ---------- выжимки для интерфейса ----------

  function entries(trainer){
    var d = load(), out = [];
    Object.keys(d.items).forEach(function(k){
      var p = k.indexOf('|');
      var tr = k.slice(0, p);
      if(trainer && tr !== trainer) return;
      var it = d.items[k];
      if(!it.n) return;
      out.push({ trainer:tr, key:k.slice(p + 1), label:it.lab || k.slice(p + 1),
                 n:it.n, c:it.c, acc:it.c / it.n, strength:strength(it), last:it.t });
    });
    return out;
  }

  function weak(trainer, limit){
    return entries(trainer)
      .sort(function(a, b){ return a.strength - b.strength; })
      .slice(0, limit || 5);
  }

  function confusions(trainer, limit){
    var d = load(), out = [];
    Object.keys(d.conf).forEach(function(k){
      var arrow = k.indexOf('>');
      var left = k.slice(0, arrow), right = k.slice(arrow + 1);
      var p = left.indexOf('|');
      var tr = left.slice(0, p);
      if(trainer && tr !== trainer) return;
      var fromKey = left.slice(p + 1);
      var from = d.items[left], to = d.items[id(tr, right)];
      out.push({ trainer:tr, n:d.conf[k],
                 from: (from && from.lab) || fromKey,
                 to: (to && to.lab) || right });
    });
    return out.sort(function(a, b){ return b.n - a.n; }).slice(0, limit || 5);
  }

  function stats(trainer){
    var e = entries(trainer), n = 0, c = 0;
    e.forEach(function(x){ n += x.n; c += x.c; });
    return { answered:n, correct:c, acc: n ? c / n : 0, items:e.length };
  }

  // Активность за последние dayCount дней, от старых к новым.
  function days(dayCount, trainer){
    var d = load(), out = [], now = new Date();
    now.setHours(12, 0, 0, 0);
    for(var i = dayCount - 1; i >= 0; i--){
      var dt = new Date(now.getTime() - i * 86400000);
      var k = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
      var rec = d.days[k];
      var n = 0, c = 0;
      if(rec){
        if(trainer){ var t = rec.tr[trainer]; if(t){ n = t[0]; c = t[1]; } }
        else { n = rec.n; c = rec.c; }
      }
      out.push({ date:k, n:n, c:c });
    }
    return out;
  }

  // Подряд идущие дни с занятиями, считая от сегодня (вчера тоже годится — день ещё не кончился).
  function streak(){
    var d = days(400), i = d.length - 1, s = 0;
    if(i >= 0 && !d[i].n) i--;          // сегодня ещё не занимались — смотрим со вчера
    for(; i >= 0 && d[i].n; i--) s++;
    return s;
  }

  function exportJson(){ return JSON.stringify(load()); }

  function importJson(text){
    var d = JSON.parse(text);
    if(!d || d.v !== 1 || !d.items) throw new Error('Не похоже на выгрузку прогресса');
    cache = d;
    save();
    return true;
  }

  function reset(trainer){
    var d = load();
    if(!trainer){ cache = blank(); save(); return; }
    Object.keys(d.items).forEach(function(k){ if(k.indexOf(trainer + '|') === 0) delete d.items[k]; });
    Object.keys(d.conf).forEach(function(k){ if(k.indexOf(trainer + '|') === 0) delete d.conf[k]; });
    Object.keys(d.days).forEach(function(k){
      var rec = d.days[k];
      var t = rec.tr[trainer];
      if(!t) return;
      rec.n -= t[0]; rec.c -= t[1];
      delete rec.tr[trainer];
      if(rec.n <= 0) delete d.days[k];
    });
    save();
  }

  window.EarProgress = {
    record:record, pick:pick, stats:stats, weak:weak, confusions:confusions,
    days:days, streak:streak, entries:entries, strength:strength,
    exportJson:exportJson, importJson:importJson, reset:reset
  };
})();
