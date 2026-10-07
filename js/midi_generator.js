const PPQ = 480, $ = id => document.getElementById(id);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const DURS = [["Half note",960],["Quarter note",480],["Eighth note",240],["Triplet (1/3 of a Quarter note)",160],["Sixteenth note",120]];
const DEFAULT_DURS = {normal:[480,240], fast:[240,160], slow:[960,480]};
const TYPE_LABEL = {normal:"Normal", fast:"Fast", slow:"Slow"};
const SCALE_LABEL = {low:"Low", medium:"Medium", high:"High"};
const DEFAULT_SCALE = [57,60,62,64,67,69,72,74,76,79];
const DEFAULT_STRUCT = [[0,"normal","low"],[1,"normal","medium"],[6,"fast","high"],[2,"normal","medium"],[2,"normal","high"],[3,"normal","high"],[2,"slow","medium"],[2,"normal","high"],[3,"normal","medium"],[4,"slow","medium"],[4,"normal","medium"],[5,"normal","high"],[4,"normal","high"],[4,"slow","high"],[6,"normal","high"],[2,"normal","medium"],[2,"normal","high"],[3,"normal","high"],[2,"slow","medium"],[2,"normal","high"],[3,"normal","medium"],[4,"slow","medium"],[4,"normal","medium"],[5,"normal","high"],[4,"normal","high"],[4,"slow","high"],[6,"normal","high"]];

const sel = new Set(DEFAULT_SCALE);
let song = null, ctx = null, endTimer = null;

/* ---------- Piano ---------- */
const LOW = 48, HIGH = 83, isBlack = n => [1,3,6,8,10].includes(n % 12);
function buildPiano() {
    const whites = []; for (let n = LOW; n <= HIGH; n++) if (!isBlack(n)) whites.push(n);
    const W = 100 / whites.length; let wi = 0;
    const p = $("piano");
    for (let n = LOW; n <= HIGH; n++) {
        const k = document.createElement("div");
        k.className = "k " + (isBlack(n) ? "b" : "w") + (sel.has(n) ? " on" : "");
        if (isBlack(n)) { k.style.left = (wi * W - W * 0.35) + "%"; k.style.width = (W * 0.7) + "%"; }
        else { k.style.left = (wi * W) + "%"; k.style.width = W + "%"; wi++; if (n % 12 === 0) k.textContent = "C" + (n / 12 - 1); }
        k.title = NAMES[n % 12] + (Math.floor(n / 12) - 1);
        k.onclick = () => { sel.has(n) ? sel.delete(n) : sel.add(n); k.classList.toggle("on"); refreshRanges(); };
        p.appendChild(k);
    }
}
const noteName = n => NAMES[n % 12] + (Math.floor(n / 12) - 1);

/* ---------- Registers ---------- */
function ranges(S) {
    const N = S.length, a = Math.min(N - 2, +$("le").value), b = Math.min(N - 1, +$("me").value);
    const r = {low: S.slice(0, a), medium: S.slice(a, b), high: S.slice(b)};
    for (const k in r) if (!r[k].length) r[k] = S;   // if a register is empty, use the whole scale
    return r;
}
function refreshRanges() {
    const S = [...sel].sort((a, b) => a - b), N = S.length;
    for (const id of ["le", "me"]) { $(id).max = Math.max(1, N); if (+$(id).value > N) $(id).value = N; }
    $("leV").textContent = $("le").value; $("meV").textContent = $("me").value;
    if (N < 3) { $("rangeInfo").textContent = "Choose at least 3 notes."; return; }
    const r = ranges(S), f = a => a.map(noteName).join(" ");
    $("rangeInfo").textContent = `Lows: ${f(r.low)}  |  Mediums: ${f(r.medium)}  |  Highs: ${f(r.high)}`;
}

/* ---------- Durations ---------- */
function buildDurations() {
    for (const t of ["normal", "fast", "slow"]) {
        const fs = document.createElement("fieldset");
        fs.innerHTML = `<legend>${TYPE_LABEL[t]}</legend>` + DURS.map(([name, v]) =>
        `<label><input type="checkbox" data-t="${t}" value="${v}" ${DEFAULT_DURS[t].includes(v) ? "checked" : ""}> ${name}</label>`).join("");
        $("dur").appendChild(fs);
    }
}
const durations = t => [...document.querySelectorAll(`input[data-t="${t}"]:checked`)].map(c => +c.value);

/* ---------- Rows of structure ---------- */
function addRow(id = 0, type = "normal", scale = "medium") {
    const r = document.createElement("div"); r.className = "row";
    const opts = (o, cur) => Object.entries(o).map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("");
    r.innerHTML = `<input type="number" class="id" min="0" max="99" value="${id}" aria-label="Pattern">
        <select class="ty" aria-label="Duration">${opts(TYPE_LABEL, type)}</select>
        <select class="sc" aria-label="Register">${opts(SCALE_LABEL, scale)}</select>
        <button type="button" aria-label="Remove row">×</button>`;
    r.querySelector("button").onclick = () => r.remove();
    $("rows").appendChild(r);
}

/* ---------- Generate ---------- */
function genPattern(durs, silP) {
    const total = PPQ * 4, p = []; let acc = 0;
    while (acc < total) {
        let t = rnd(durs), sil;
        if (acc + t > total) { t = total - acc; sil = true; } else sil = Math.random() < silP;
        p.push({silence: sil, t}); acc += t;
    }
    return p;
}
// Notes that rise to the highs and then drop to lows
function genSequence(p, range) {
    let dir = "up", prev = range[0];
    for (const e of p) {
        if (e.silence) continue;
        let c = range.filter(n => dir === "up" ? n > prev : n < prev);
        if (!c.length) { dir = dir === "up" ? "down" : "up"; c = range.filter(n => dir === "up" ? n > prev : n < prev); }
        if (!c.length) c = range;
        e.note = rnd(c);
        if (e.note === range[range.length - 1]) dir = "down"; else if (e.note === range[0]) dir = "up";
        prev = e.note;
    }
}
function build() {
    const S = [...sel].sort((a, b) => a - b);
    if (S.length < 3) throw new Error("Choose at least 3 notes on the piano.");
    const D = {}; for (const t of ["normal", "fast", "slow"]) { D[t] = durations(t); }
    const rows = [...document.querySelectorAll("#rows .row")].map(r => ({id: Math.min(99, Math.max(0, +r.querySelector(".id").value || 0)), type: r.querySelector(".ty").value, scale: r.querySelector(".sc").value}));
    if (!rows.length) throw new Error("Add at least one row to the structure.");
    for (const r of rows) if (!D[r.type].length) throw new Error(`Check at least one duration for "${TYPE_LABEL[r.type]}".`);
    const R = ranges(S), silP = +$("sil").value, base = {}, seqs = {}, track = [];
    let gap = 0;   // pending silence continues to the next pattern
    for (const it of rows) {
        if (!(it.id in base)) base[it.id] = genPattern(D[it.type], silP);
        const key = it.id + it.type;
        if (!seqs[key]) {
        const p = base[it.id].map(e => ({...e})), r = R[it.scale];
        if (it.type === "fast") genSequence(p, r); else p.forEach(e => { if (!e.silence) e.note = rnd(r); });
        seqs[key] = p;
        }
        for (const e of seqs[key]) {
        if (e.silence) { gap += e.t; continue; }
        track.push({gap, t: e.t, note: e.note, vel: 80 + Math.floor(Math.random() * 21)});
        gap = 0;
        }
    }
    return {track, bpm: +$("bpm").value, prog: +$("prog").value};
}

/* ---------- Write MIDI file ---------- */
const vlq = n => { const b = [n & 127]; while (n >>= 7) b.unshift((n & 127) | 128); return b; };
const chunk = (id, d) => [...id, (d.length >>> 24) & 255, (d.length >> 16) & 255, (d.length >> 8) & 255, d.length & 255, ...d];
function toMidi({track, bpm, prog}) {
    const us = Math.round(60000000 / bpm);
    const t0 = [0, 0xFF, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xFF, 0x2F, 0];
    const t1 = [0, 0xC0, prog];
    for (const e of track) t1.push(...vlq(e.gap), 0x90, e.note, e.vel, ...vlq(e.t), 0x80, e.note, 0);
    t1.push(0, 0xFF, 0x2F, 0);
    const head = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, PPQ >> 8, PPQ & 255];
    return new Uint8Array([...head, ...chunk([0x4D, 0x54, 0x72, 0x6B], t0), ...chunk([0x4D, 0x54, 0x72, 0x6B], t1)]);
}

/* ---------- Preview with WebAudio ---------- */
function stop() {
    clearTimeout(endTimer);
    if (ctx) { ctx.close(); ctx = null; }
    $("stop").disabled = true;
}
function play() {
    stop();
    ctx = new AudioContext();
    const k = 60 / (song.bpm * PPQ); let t = ctx.currentTime + 0.1;
    for (const e of song.track) {
        t += e.gap * k;
        const d = e.t * k, o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "triangle"; o.frequency.value = 440 * 2 ** ((e.note - 69) / 12);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(e.vel / 400, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95);
        o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + d);
        t += d;
    }
    $("stop").disabled = false;
    endTimer = setTimeout(stop, (t - ctx.currentTime) * 1000 + 300);
}

/* ---------- Events ---------- */
function status(msg, err) { const s = $("status"); s.textContent = msg; s.className = err ? "err" : ""; }
$("gen").onclick = () => {
    try {
        stop(); song = build(); song.bytes = toMidi(song);
        const secs = song.track.reduce((a, e) => a + e.gap + e.t, 0) * 60 / (song.bpm * PPQ);
        status(`Listo: ${song.track.length} notas, unos ${Math.round(secs)} s.`);
        $("play").disabled = $("dl").disabled = false;
    } catch (e) { status(e.message, true); }
};
$("play").onclick = play;
$("stop").onclick = stop;
$("dl").onclick = () => {
    let name = ($("fname").value.trim() || "mid-sample").replace(/[\\/:*?"<>|]/g, "_");
    if (!/\.mid$/i.test(name)) name += ".mid";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([song.bytes], {type: "audio/midi"}));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    status(`Descargado: ${name}`);
};
$("add").onclick = () => addRow(0);
$("bpm").oninput = e => $("bpmV").textContent = e.target.value;
$("sil").oninput = e => $("silV").textContent = (+e.target.value).toFixed(2);
$("le").oninput = $("me").oninput = refreshRanges;

buildPiano(); buildDurations(); DEFAULT_STRUCT.forEach(r => addRow(...r)); refreshRanges();