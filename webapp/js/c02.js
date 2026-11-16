// ② 표현 경기장 — 카드의 표정(도트 8×8)과 소리를 똑같이 만들어 알티노에 출력. 판정은 앱이 한다.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const kit = AltinoKit.create({ appId: 'c02', title: '표현 경기장' });
  const TOLERANCE = 2;                     // 틀린 칸 2개까지는 성공
  const PEEK_MS = 10000, L4_LIMIT = 60;

  const F = (s) => s.trim().split(/\s+/).map(r => parseInt(r.replace(/#/g, '1').replace(/\./g, '0'), 2));
  const FACES = [
    { name: '웃음',   rows: F('........ .##..##. .##..##. ........ ........ #......# .#....#. ..####..') },
    { name: '슬픔',   rows: F('........ .##..##. .##..##. ........ ........ ..####.. .#....#. #......#') },
    { name: '놀람',   rows: F('........ .##..##. .##..##. ........ ...##... ..#..#.. ..#..#.. ...##...') },
    { name: '윙크',   rows: F('........ .##..... .##..### ........ ........ #......# .#....#. ..####..') },
    { name: '무표정', rows: F('........ .##..##. .##..##. ........ ........ ........ .######. ........') },
    { name: '화남',   rows: F('#......# .#....#. ..#..#.. .##..##. ........ ........ ..####.. .#....#.') },
    { name: '졸림',   rows: F('........ ........ ###..### ........ ........ ...##... ...##... ........') },
    { name: '메롱',   rows: F('........ .##..##. .##..##. ........ .######. ...##... ...##... ........') },
  ];
  const NOTES = [
    { n: '도', code: 37, c: '#ff6f7d' }, { n: '레', code: 39, c: '#ff9a3d' }, { n: '미', code: 41, c: '#f6b81a' }, { n: '파', code: 42, c: '#2fbf9b' },
    { n: '솔', code: 44, c: '#3a9be0' }, { n: '라', code: 46, c: '#6d6ee8' }, { n: '시', code: 48, c: '#a57fd8' }, { n: '높은도', code: 49, c: '#f0619a' },
  ];
  const noteOf = (code) => NOTES.find(x => x.code === code);
  // 단계별 과제: 표정 수, 음 수, 기억(가림), 제한 시간
  const SPEC = [
    { faces: 1, notes: 0, pool: 5 }, { faces: 1, notes: 3, pool: 5 },
    { faces: 1, notes: 3, pool: 8, peek: true }, { faces: 2, notes: 4, pool: 8, limit: L4_LIMIT },
  ];

  let target = { faces: [], notes: [] };
  let mine = [new Array(8).fill(0), new Array(8).fill(0)];
  let myNotes = [];
  let scene = 0, hidden = false, peeked = false, peekH = null, limitH = null, limitLeft = 0, busy = false;

  // 단계·모드가 바뀔 때만 새 카드(실패해서 기회만 줄었을 때는 틀린 칸을 잠깐 보여 준 뒤 verdict 가 새 카드를 뽑는다)
  let lastKey = '';
  const ch = Camp.challenge({ kit, arena: 'c02', mount: $('chbar'), auto: true, onChange: (c) => {
    const key = c.mode + c.level + c.active; if (key === lastKey) { paint(); return; } lastKey = key; newCard();
  } });
  const spec = () => SPEC[ch.level - 1];
  const rnd = (n) => Math.floor(Math.random() * n);

  function newCard() {
    const sp = spec();
    const idx = []; while (idx.length < sp.faces) { const k = rnd(sp.pool); if (!idx.includes(k)) idx.push(k); }
    target = { faces: idx.map(k => FACES[k]), notes: Array.from({ length: sp.notes }, () => NOTES[[0, 1, 2, 4, 7][rnd(5)]].code) };
    mine = [new Array(8).fill(0), new Array(8).fill(0)]; myNotes = []; scene = 0;
    hidden = !!sp.peek; peeked = false; clearTimeout(peekH); clearInterval(limitH);
    $('result').textContent = ''; $('result').className = 'result';
    if (sp.limit && ch.canPlay) startLimit(sp.limit); else $('limit').style.display = 'none';
    kit.dot.clear();
    paint();
  }
  function startLimit(sec) {
    limitLeft = sec; $('limit').style.display = ''; $('limitN').textContent = limitLeft;
    limitH = setInterval(() => {
      limitLeft--; $('limitN').textContent = Math.max(0, limitLeft);
      if (limitLeft <= 0) { clearInterval(limitH); verdict(false, '⏱ 시간이 다 됐어요'); }
    }, 1000);
  }

  function dotsHtml(rows, cls, miss) {
    let h = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const on = (rows[r] >> (7 - c)) & 1, m = miss && ((miss[r] >> (7 - c)) & 1);
      h += `<i class="${on ? 'on' : ''}${m ? ' miss' : ''}" data-r="${r}" data-c="${c}"></i>`;
    }
    return `<div class="dots ${cls || ''}">${h}</div>`;
  }
  function paint(miss) {
    const sp = spec();
    $('targets').innerHTML = target.faces.map((f, i) =>
      `<div class="t">${hidden ? '<div class="cover">❓</div>' : dotsHtml(f.rows, 'sm')}<span>${sp.faces > 1 ? '장면 ' + (i + 1) + ' · ' : ''}${hidden ? '가려졌어요' : f.name}</span></div>`).join('');
    $('tnotes').innerHTML = hidden ? '' : target.notes.map(c => `<span class="note" style="background:${noteOf(c).c}">${noteOf(c).n}</span>`).join('');
    $('peek').classList.toggle('hidden', !(sp.peek && !peeked));
    $('tabs').innerHTML = sp.faces > 1 ? [0, 1].map(i => `<button class="chip ${i === scene ? 'on' : ''}" data-s="${i}">장면 ${i + 1}</button>`).join('') : '';
    $('grid').outerHTML = dotsHtml(mine[scene], '', miss && miss[scene]).replace('class="dots ', 'id="grid" class="dots ');
    bindGrid();
    $('slots').innerHTML = Array.from({ length: sp.notes }, (_, i) => {
      const c = myNotes[i], n = c && noteOf(c);
      return `<span class="slot ${n ? 'fill' : ''}" style="${n ? 'background:' + n.c : ''}">${n ? n.n : ''}</span>`;
    }).join('') || '<span class="lead">이 단계는 소리가 없어요</span>';
    $('pal').style.display = sp.notes ? '' : 'none';
    $('clearNotes').style.display = sp.notes ? '' : 'none';
    $('submit').disabled = !ch.canPlay || busy;
    $('send').disabled = busy;
  }
  // 그리기: 누른 칸의 반대 상태로 칠하고, 끌면 같은 상태로 이어 칠한다
  function bindGrid() {
    const g = $('grid'); let paintTo = null;
    const at = (e) => { const t = document.elementFromPoint(e.clientX, e.clientY); return (t && t.dataset && t.dataset.r != null && g.contains(t)) ? t : null; };
    const set = (cell) => {
      const r = +cell.dataset.r, c = +cell.dataset.c, bit = 1 << (7 - c);
      if (paintTo) mine[scene][r] |= bit; else mine[scene][r] &= ~bit;
      cell.classList.toggle('on', !!paintTo); cell.classList.remove('miss');
    };
    g.addEventListener('pointerdown', (e) => {
      const cell = at(e); if (!cell) return; e.preventDefault();
      paintTo = !cell.classList.contains('on'); set(cell);
      try { g.setPointerCapture(e.pointerId); } catch (x) {}
    });
    g.addEventListener('pointermove', (e) => { if (paintTo == null) return; const cell = at(e); if (cell) set(cell); });
    const end = () => { paintTo = null; };
    g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  }
  $('tabs').addEventListener('click', (e) => { const s = e.target.dataset && e.target.dataset.s; if (s != null) { scene = +s; paint(); } });
  $('clear').onclick = () => { mine[scene] = new Array(8).fill(0); paint(); };
  $('calib').onclick = () => kit.dot.calibrate();
  $('clearNotes').onclick = () => { myNotes = []; paint(); };
  NOTES.forEach(n => {
    const b = document.createElement('button'); b.textContent = n.n; b.style.background = n.c;
    b.onclick = () => { kit.beep(n.code, 300); if (myNotes.length < spec().notes) { myNotes.push(n.code); paint(); } };
    $('pal').appendChild(b);
  });
  $('draw').onclick = async () => {
    if (ch.mode === 'challenge' && ch.active) { kit.toast('도전 중에는 카드를 바꿀 수 없어요'); return; }
    newCard();
  };
  $('peek').onclick = () => {
    peeked = true; hidden = false; paint();
    kit.toast('10초 동안 잘 기억해요!');
    peekH = setTimeout(() => { hidden = true; paint(); kit.signal('notice'); }, PEEK_MS);
  };

  // 알티노에 출력: 표정(장면이 둘이면 차례로) → 소리
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  async function play() {
    const sp = spec();
    for (let i = 0; i < sp.faces; i++) { kit.dot.bytes(mine[i]); await sleep(sp.faces > 1 ? 1200 : 300); }
    for (const c of myNotes) { kit.beep(c, 350); await sleep(450); }
  }
  $('send').onclick = async () => { if (busy) return; busy = true; paint(); await play(); busy = false; paint(); };

  const popcnt = (x) => { let n = 0; while (x) { n += x & 1; x >>= 1; } return n; };
  function compare() {
    const sp = spec(); let wrong = 0; const miss = [new Array(8).fill(0), new Array(8).fill(0)];
    for (let i = 0; i < sp.faces; i++) for (let r = 0; r < 8; r++) { const d = (mine[i][r] ^ target.faces[i].rows[r]) & 0xFF; miss[i][r] = d; wrong += popcnt(d); }
    let noteBad = 0;
    for (let i = 0; i < sp.notes; i++) if (myNotes[i] !== target.notes[i]) noteBad++;
    return { wrong, noteBad, miss, ok: wrong <= TOLERANCE * sp.faces && noteBad === 0 };
  }
  function verdict(ok, msg, miss) {
    clearInterval(limitH); clearTimeout(peekH);
    hidden = false;
    $('result').textContent = msg; $('result').className = 'result ' + (ok ? 'ok' : 'no');
    paint(miss);
    if (ok) setTimeout(() => ch.pass(), 900);
    else { ch.fail(); if (ch.canPlay) setTimeout(() => newCard(), 2600); }
  }
  $('submit').onclick = async () => {
    if (busy || !ch.canPlay) return;
    if (spec().peek && !peeked) { kit.toast('먼저 카드를 보세요'); return; }
    busy = true; paint();
    await play();
    busy = false;
    const r = compare();
    const parts = [`틀린 칸 ${r.wrong}개`]; if (spec().notes) parts.push(r.noteBad ? `틀린 음 ${r.noteBad}개` : '소리 정답');
    verdict(r.ok, (r.ok ? '⭕ 성공! ' : '❌ 아쉬워요 · ') + parts.join(' · '), r.miss);
  };

})();
