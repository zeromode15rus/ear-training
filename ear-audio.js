// Общий звуковой движок тренажёров: сэмплы настоящих инструментов на Tone.js.
// Сэмплы грузятся по требованию; пока грузятся или если сети нет — играет синтезатор.
(function(){
  var SALAMANDER = 'https://tonejs.github.io/audio/salamander/';
  var GLEITZ = 'https://gleitz.github.io/midi-js-soundfonts/';
  var FLAT_NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  var SHARP_S = { 0:'C', 3:'Ds', 6:'Fs', 9:'A' };

  // volume подобран так, чтобы все инструменты звучали примерно одинаково громко (около −16 дБ на выходе).
  var INSTRUMENTS = {
    piano:   { label:'Рояль',                    kind:'salamander', volume:1,  release:1.2, strum:0.006 },
    epiano:  { label:'Электропиано (Rhodes)',    kind:'gleitz', bank:'FluidR3_GM', name:'electric_piano_1',      volume:10, release:1.0, strum:0.008 },
    nylon:   { label:'Гитара (нейлон)',          kind:'gleitz', bank:'MusyngKite', name:'acoustic_guitar_nylon', volume:15, release:1.0, strum:0.028 },
    steel:   { label:'Гитара (стальные струны)', kind:'gleitz', bank:'MusyngKite', name:'acoustic_guitar_steel', volume:12, release:1.0, strum:0.026 },
    strings: { label:'Струнный ансамбль',        kind:'gleitz', bank:'MusyngKite', name:'string_ensemble_1',     volume:11, release:0.9, strum:0 },
    organ:   { label:'Орган',                    kind:'gleitz', bank:'FluidR3_GM', name:'drawbar_organ',         volume:8,  release:0.3, strum:0 },
    choir:   { label:'Хор',                      kind:'gleitz', bank:'FluidR3_GM', name:'choir_aahs',            volume:14, release:0.8, strum:0 },
    flute:   { label:'Флейта',                   kind:'gleitz', bank:'MusyngKite', name:'flute',                 volume:10, release:0.4, strum:0 },
    bass:    { label:'Бас-гитара',               kind:'gleitz', bank:'FluidR3_GM', name:'electric_bass_finger',  volume:10, release:0.3, strum:0, octaves:[1,5] },
    synth:   { label:'Синтезатор (без интернета)', kind:'synth', strum:0 }
  };
  var ORDER = ['piano','epiano','nylon','steel','strings','organ','choir','flute','bass','synth'];

  var master = null, fallbackSynth = null, dronePad = null, click = null, drums = null, recBus = null;
  var samplers = {}, ready = {}, waiters = {};
  var statusListener = null;
  var droneNotes = null;

  function hasTone(){ return typeof Tone !== 'undefined'; }
  function midiToFreq(m){ return 440 * Math.pow(2, (m - 69) / 12); }

  function sampleUrls(inst){
    // Сэмпл через каждые три полутона (C, D#, F#, A) в октавах 1–7: Sampler дотягивает остальные ноты.
    var urls = {};
    var range = inst.octaves || [1, 7];
    for(var oct = range[0]; oct <= range[1]; oct++){
      [0,3,6,9].forEach(function(pc){
        urls[(oct + 1) * 12 + pc] = (inst.kind === 'salamander' ? SHARP_S[pc] : FLAT_NAMES[pc]) + oct + '.mp3';
      });
    }
    return urls;
  }

  function status(text){ if(statusListener) statusListener(text); }

  function initGraph(){
    if(!hasTone() || master) return;
    var limiter = new Tone.Limiter(-1).toDestination();
    var comp = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.01, release: 0.25 }).connect(limiter);
    var reverb = new Tone.Reverb({ decay: 2.4, preDelay: 0.02, wet: 0.22 }).connect(comp);
    master = new Tone.EQ3({ low: 0, mid: -1, high: -1.5 }).connect(reverb);

    fallbackSynth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'custom', partials: [1, 0.55, 0.35, 0.22, 0.14, 0.10, 0.06, 0.04, 0.025, 0.015] },
      envelope: { attack: 0.002, decay: 1.8, sustain: 0.05, release: 1.6 },
      filter: { type: 'lowpass', Q: 1, rolloff: -24 },
      filterEnvelope: { attack: 0.001, decay: 0.6, sustain: 0.15, release: 1.2, baseFrequency: 280, octaves: 5.2 }
    });
    fallbackSynth.volume.value = -10;
    fallbackSynth.connect(master);

    // Бурдон — отдельный тянущийся голос: рояль и гитара затухают и держать тонику не могут.
    dronePad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', count: 3, spread: 14 },
      envelope: { attack: 0.8, decay: 0.3, sustain: 0.9, release: 1.8 }
    });
    dronePad.volume.value = -16;
    dronePad.connect(master);

    // Метроном идёт мимо реверба, чтобы щелчок был сухим и точным.
    click = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 }
    });
    click.volume.value = -10;
    click.connect(comp);

    // Простая синтезированная ударная установка — сэмплы барабанов не нужны.
    var drumBus = new Tone.Gain(0.9).connect(comp);
    var kick = new Tone.MembraneSynth({ pitchDecay: 0.03, octaves: 6, envelope: { attack: 0.001, decay: 0.32, sustain: 0 } }).connect(drumBus);
    kick.volume.value = -4;
    var snareFilter = new Tone.Filter(1800, 'highpass').connect(drumBus);
    var snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(snareFilter);
    snare.volume.value = -12;
    var snareBody = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).connect(drumBus);
    snareBody.volume.value = -14;
    var hatFilter = new Tone.Filter(8000, 'highpass').connect(drumBus);
    var hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } }).connect(hatFilter);
    hat.volume.value = -20;
    var ohat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.22, sustain: 0 } }).connect(hatFilter);
    ohat.volume.value = -22;
    drums = {
      kick: function(t, v){ kick.triggerAttackRelease('C1', 0.3, t, v); },
      snare: function(t, v){ snare.triggerAttackRelease(0.15, t, v); snareBody.triggerAttackRelease('G2', 0.08, t, v); },
      rim: function(t, v){ snareBody.triggerAttackRelease('E4', 0.03, t, (v || 1) * 0.6); },
      hat: function(t, v){ hat.triggerAttackRelease(0.03, t, v); },
      ohat: function(t, v){ ohat.triggerAttackRelease(0.2, t, v); }
    };

    // Шина записи: всё, что звучит, плюс микрофон (если включён).
    recBus = new Tone.Gain(1);
    limiter.connect(recBus);
  }

  function load(id){
    initGraph();
    var inst = INSTRUMENTS[id];
    if(!hasTone() || !inst || inst.kind === 'synth') return Promise.resolve();
    if(waiters[id]) return waiters[id];
    status('Загружаю «' + inst.label + '»…');
    waiters[id] = new Promise(function(resolve){
      var baseUrl = inst.kind === 'salamander' ? SALAMANDER : GLEITZ + inst.bank + '/' + inst.name + '-mp3/';
      samplers[id] = new Tone.Sampler({
        urls: sampleUrls(inst),
        baseUrl: baseUrl,
        release: inst.release,
        onload: function(){ ready[id] = true; status(''); resolve(); },
        onerror: function(){ ready[id] = 'error'; status('Не удалось загрузить «' + inst.label + '» — играет синтезатор'); resolve(); }
      });
      samplers[id].volume.value = inst.volume;
      samplers[id].connect(master);
    });
    return waiters[id];
  }

  function voice(id){
    if(INSTRUMENTS[id] && INSTRUMENTS[id].kind !== 'synth' && ready[id] === true) return samplers[id];
    return fallbackSynth;
  }

  function start(){
    if(!hasTone()) return;
    Tone.start();
    initGraph();
  }

  // Мгновенно сыграть ноты (без транспорта): аккорд, отдельная нота.
  function hit(id, midis, dur, opts){
    opts = opts || {};
    start();
    return load(id).then(function(){
      var v = voice(id);
      var strum = opts.strum !== undefined ? opts.strum : (v === fallbackSynth ? 0 : INSTRUMENTS[id].strum || 0);
      var notes = midis.slice().sort(function(a, b){ return a - b; });
      if(opts.down === false) notes.reverse();
      var t = Tone.now() + 0.05 + (opts.delay || 0);
      notes.forEach(function(m, i){
        v.triggerAttackRelease(midiToFreq(m), dur, t + i * strum, humanVel(i, notes.length, opts.vel));
      });
    });
  }

  function humanVel(i, n, base){
    // Живое исполнение: бас чуть громче, верхний голос чуть ярче, небольшой разброс.
    var v = (base || 0.62) + (i === 0 ? 0.08 : 0) + (i === n - 1 && n > 1 ? 0.05 : 0) + (Math.random() - 0.5) * 0.08;
    return Math.max(0.05, Math.min(1, v));
  }

  // Вызвать fn в момент звучания time. Tone.Draw завязан на requestAnimationFrame и теряет события,
  // когда браузер придерживает кадры, поэтому обычный таймер.
  function atTime(fn, time, token){
    var ms = Math.max(0, (time - Tone.now()) * 1000);
    setTimeout(function(){ if(token === playToken) fn(); }, ms);
  }

  // Воспроизведение по транспорту, чтобы его можно было остановить.
  // events: { time, dur, inst, midi:[...], vel, strum, click:'accent'|'beat', onStart:fn }
  var playToken = 0;
  function play(events, opts){
    opts = opts || {};
    start();
    stop();
    var token = ++playToken;
    var ids = {};
    events.forEach(function(ev){ if(ev.inst) ids[ev.inst] = true; });
    return Promise.all(Object.keys(ids).map(load)).then(function(){
      if(token !== playToken) return;
      var T = Tone.Transport;
      var end = 0;
      events.forEach(function(ev){
        end = Math.max(end, ev.time + (ev.dur || 0));
        T.schedule(function(time){
          // Одноголосые синтезаторы (барабаны, метроном) падают, если два удара пришли в один момент —
          // так бывает при быстром перезапуске. Лишний удар просто пропускаем.
          if(ev.drum && drums && drums[ev.drum]){ try{ drums[ev.drum](time, ev.vel || 0.8); }catch(e){} }
          if(ev.click){
            try{ click.triggerAttackRelease(ev.click === 'accent' ? 1760 : 1175, 0.03, time, ev.click === 'accent' ? 0.9 : 0.55); }catch(e){}
          }
          if(ev.midi && ev.midi.length){
            var v = voice(ev.inst);
            var strum = ev.strum !== undefined ? ev.strum : (v === fallbackSynth ? 0 : INSTRUMENTS[ev.inst].strum || 0);
            var notes = ev.midi.slice().sort(function(a, b){ return a - b; });
            notes.forEach(function(m, i){
              v.triggerAttackRelease(midiToFreq(m), ev.dur, time + i * strum, humanVel(i, notes.length, ev.vel));
            });
          }
          if(ev.onStart){ atTime(ev.onStart, time, token); }
        }, ev.time);
      });
      if(opts.onEnd){
        // endAt — точный момент конца (например, конец последнего такта), иначе — конец последнего события + tail.
        T.schedule(function(time){ atTime(opts.onEnd, time, token); }, opts.endAt !== undefined ? opts.endAt : end + (opts.tail || 0));
      }
      T.start('+0.08');
    });
  }

  function stop(){
    if(!hasTone()) return;
    playToken++;
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    Object.keys(samplers).forEach(function(id){ samplers[id].releaseAll(); });
    if(fallbackSynth) fallbackSynth.releaseAll();
  }

  function drone(midis){
    start();
    if(droneNotes){ dronePad.triggerRelease(droneNotes.map(midiToFreq)); droneNotes = null; }
    if(midis && midis.length){
      droneNotes = midis.slice();
      dronePad.triggerAttack(droneNotes.map(midiToFreq));
    }
  }

  function fillSelect(select, value, only){
    select.innerHTML = '';
    (only || ORDER).forEach(function(id){
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = INSTRUMENTS[id].label;
      select.appendChild(opt);
    });
    select.value = INSTRUMENTS[value] ? value : (only || ORDER)[0];
    return select.value;
  }

  // ---- запись: подложка + микрофон ----
  var mic = null, recorder = null;
  function recordingSupported(){ return hasTone() && Tone.Recorder && Tone.Recorder.supported && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function startRecording(){
    start();
    if(!recordingSupported()) return Promise.reject(new Error('Запись не поддерживается этим браузером'));
    var ready = mic ? Promise.resolve() : (function(){
      mic = new Tone.UserMedia();
      return mic.open().then(function(){ mic.connect(recBus); });   // в колонки микрофон не идёт — только в запись
    })();
    return ready.then(function(){
      recorder = new Tone.Recorder();
      recBus.connect(recorder);
      recorder.start();
    });
  }
  function stopRecording(){
    if(!recorder) return Promise.resolve(null);
    var r = recorder; recorder = null;
    return r.stop().then(function(blob){ recBus.disconnect(r); r.dispose(); return blob; });
  }

  window.EarAudio = {
    INSTRUMENTS: INSTRUMENTS,
    ORDER: ORDER,
    init: function(ids){ initGraph(); (ids || []).forEach(load); },
    start: start,
    load: load,
    hit: hit,
    play: play,
    stop: stop,
    drone: drone,
    isDroneOn: function(){ return !!droneNotes; },
    fillSelect: fillSelect,
    onStatus: function(fn){ statusListener = fn; },
    midiToFreq: midiToFreq,
    recordingSupported: recordingSupported,
    startRecording: startRecording,
    stopRecording: stopRecording
  };
})();
