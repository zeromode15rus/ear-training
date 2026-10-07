// Проверка подбора вопросов из ear-progress.js: запускать «node tools/check-picker.js».
// Ученик знает I, уверенно держит vi и стабильно путает IV с V. Подбор обязан
// сместиться к спутанной паре, не бросив освоенное совсем и не повторяя вопрос подряд.
// Генератор случайных чисел подменён на детерминированный — прогон воспроизводим.

var assert = require('assert');
var path = require('path');

var seed = 20260924;
Math.random = function(){                       // LCG, чтобы результат не плавал между запусками
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

var store = {};
global.window = { localStorage: {
  getItem: function(k){ return k in store ? store[k] : null; },
  setItem: function(k, v){ store[k] = v; },
  removeItem: function(k){ delete store[k]; }
}};
require(path.join(__dirname, '..', 'ear-progress.js'));
var P = global.window.EarProgress;

var ITEMS = ['I', 'IV', 'V', 'vi'];
var SKILL = { I:0.98, IV:0.35, V:0.40, vi:0.75 };   // доля верных ответов «ученика»

function answerAs(key){
  if(Math.random() < SKILL[key]) return key;
  if(key === 'IV') return 'V';                      // путаница направленная: IV слышится как V
  if(key === 'V') return 'IV';
  return ITEMS[Math.floor(Math.random() * ITEMS.length)];
}

function run(times, nextKey){
  var seen = { I:0, IV:0, V:0, vi:0 }, prev = null;
  for(var i = 0; i < times; i++){
    var key = nextKey(prev);
    seen[key]++;
    var given = answerAs(key);
    P.record('sim', { key:key, label:key, correct:given === key, answerKey:given, answerLabel:given });
    prev = key;
  }
  return seen;
}

// 1. Набираем историю вслепую — иначе подбирать не из чего.
run(100, function(){ return ITEMS[Math.floor(Math.random() * ITEMS.length)]; });

var before = P.entries('sim').reduce(function(acc, e){ acc[e.label] = e.strength; return acc; }, {});
assert.ok(before.I > before.IV, 'освоенная I должна быть сильнее спутанной IV');
assert.ok(before.I > before.V, 'освоенная I должна быть сильнее спутанной V');

// 2. Теперь вопросы выбирает сам модуль.
var seen = run(400, function(prev){ return P.pick('sim', ITEMS, { avoid: prev }); });
var total = ITEMS.reduce(function(a, k){ return a + seen[k]; }, 0);
var share = {};
ITEMS.forEach(function(k){ share[k] = seen[k] / total; });

var weakPair = share.IV + share.V;
assert.ok(weakPair > 0.60, 'спутанная пара IV+V должна занимать больше 60% вопросов, вышло ' + (weakPair * 100).toFixed(1) + '%');
assert.ok(share.I < 0.20, 'освоенная I должна просесть ниже 20%, вышло ' + (share.I * 100).toFixed(1) + '%');
assert.ok(share.I > 0.05, 'освоенная I не должна пропасть совсем, вышло ' + (share.I * 100).toFixed(1) + '%');

// 3. Вопрос не должен повторяться подряд чаще, чем изредка.
var repeats = 0, prev = null;
for(var i = 0; i < 2000; i++){
  var k = P.pick('sim', ITEMS, { avoid: prev });
  if(k === prev) repeats++;
  prev = k;
}
assert.ok(repeats / 2000 < 0.10, 'повторов подряд должно быть меньше 10%, вышло ' + (repeats / 20).toFixed(1) + '%');

// 4. Матрица путаницы обязана назвать именно эту пару.
var conf = P.confusions('sim', 2).map(function(c){ return c.from + '→' + c.to; });
assert.ok(conf.indexOf('IV→V') >= 0 || conf.indexOf('V→IV') >= 0,
  'в двух главных путаницах должна быть пара IV/V, вышло: ' + conf.join(', '));

// 5. Слабые места — по возрастанию силы навыка.
var weak = P.weak('sim', 4).map(function(w){ return w.label; });
assert.ok(weak[0] === 'IV' || weak[0] === 'V', 'самым слабым должен быть IV или V, вышло ' + weak[0]);
assert.strictEqual(weak[weak.length - 1], 'I', 'самой крепкой должна быть I');

console.log('доля вопросов после подбора:');
ITEMS.forEach(function(k){
  console.log('  ' + (k + '   ').slice(0, 3) + ' ' + (share[k] * 100).toFixed(1) + '%  (вслепую было бы 25%)');
});
console.log('повторов подряд: ' + (repeats / 20).toFixed(1) + '%');
console.log('путаницы: ' + conf.join(', '));
console.log('\nвсе проверки пройдены');
