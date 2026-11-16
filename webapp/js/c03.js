// ③ 암호 전달 경기장 — 학생이 카드의 숫자·기호를 가족 암호(불빛·소리·도트 모양)로 보낸다. 판정은 심판.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const kit = AltinoKit.create({ appId: 'c03', title: '암호 전달 경기장' });
  const SYMBOLS = [['🛑', '정지'], ['▶', '출발'], ['⚠', '위험'], ['⬅', '왼쪽'], ['➡', '오른쪽'], ['🆘', '도움']];
  const F = (s) => s.trim().split(/\s+/).map(r => parseInt(r.replace(/#/g, '1').replace(/\./g, '0'), 2));
  const SHAPES = [
    ['●', F('........ ..####.. .######. .######. .######. .######. ..####.. ........')],
    ['■', F('........ .######. .######. .######. .######. .######. .######. ........')],
    ['▲', F('........ ...##... ...##... ..####.. ..####.. .######. .######. ........')],
    ['✚', F('...##... ...##... ...##... ######## ######## ...##... ...##... ...##...')],
    ['♥', F('........ .##..##. ######## ######## .######. ..####.. ...##... ........')],
    ['✕', F('#......# .#....#. ..#..#.. ...##... ...##... ..#..#.. .#....#. #......#')],
  ];
  const L4_LIMIT = 30;
  let card = [], shown = false, limitH = null, left = 0, lastKey = '';

  const ch = Camp.challenge({ kit, arena: 'c03', mount: $('chbar'), onChange: (c) => {
    const key = c.mode + c.level + c.active; if (key !== lastKey) { lastKey = key; newCard(); } else paint();
  } });
  const rnd = (n) => Math.floor(Math.random() * n);

  function newCard() {
    const lv = ch.level;
    if (lv === 1) card = [String(rnd(10))];
    else if (lv === 2) card = [String(rnd(10)), String(rnd(10))];
    else if (lv === 3) { const idx = []; while (idx.length < 3) { const k = rnd(6); if (!idx.includes(k)) idx.push(k); } card = idx.map(k => SYMBOLS[k]); }
    else card = Array.from({ length: 4 }, () => String(rnd(10)));
    shown = false; clearInterval(limitH); $('limit').style.display = 'none';
    $('log').innerHTML = '<span class="lead">보낸 신호가 여기에 차례로 보여요</span>';
    kit.dot.clear(); kit.led(0);
    paint();
  }
  function paint() {
    $('code').innerHTML = shown
      ? card.map(c => Array.isArray(c) ? `<span>${c[0]}<small>${c[1]}</small></span>` : `<span>${c}</span>`).join('')
      : '<div class="cover">[카드 보기]를 누르면 보여요</div>';
    $('show').disabled = shown || !ch.canPlay;
    $('show').textContent = ch.level === 4 ? '👀 카드 보기 (30초 시작)' : '👀 카드 보기';
  }
  $('show').onclick = () => {
    if (!ch.canPlay) { kit.toast('위에서 [도전 시작]을 눌러요'); return; }
    shown = true; paint();
    if (ch.level === 4) {
      left = L4_LIMIT; $('limit').style.display = ''; $('limitN').textContent = left;
      limitH = setInterval(() => { left--; $('limitN').textContent = Math.max(0, left); if (left <= 0) { clearInterval(limitH); kit.signal('notice'); kit.toast('⏱ 30초가 지났어요 — 심판 선생님이 판정해요', 3000); } }, 1000);
    }
  };
  $('draw').onclick = () => { if (ch.mode === 'challenge' && ch.active) { kit.toast('도전 중에는 카드를 바꿀 수 없어요'); return; } newCard(); };

  function log(sym) {
    const lg = $('log'); if (lg.querySelector('.lead')) lg.innerHTML = '';
    const s = document.createElement('span'); s.textContent = sym; lg.appendChild(s);
    while (lg.children.length > 24) lg.removeChild(lg.firstChild);
  }
  const ledOn = (ms) => { kit.led(Camp.settings.get('ledMask')); setTimeout(() => kit.led(0), ms); };
  const ACT = {
    l1: () => { ledOn(300); log('💡'); }, l2: () => { ledOn(1000); log('💡━'); },
    s1: () => { kit.beep(37, 250); log('🔈'); }, s2: () => { kit.beep(37, 900); log('🔈━'); },
    s3: () => { kit.beep(49, 250); log('🔔'); }, s4: () => { kit.beep(49, 900); log('🔔━'); },
  };
  document.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
    if (!ch.canPlay) { kit.toast('위에서 [도전 시작]을 눌러요'); return; }
    ACT[b.dataset.k]();
  }));
  SHAPES.forEach(([sym, rows]) => {
    const b = document.createElement('button'); b.className = 'btn ghost shape'; b.textContent = sym;
    b.onclick = () => { if (!ch.canPlay) { kit.toast('위에서 [도전 시작]을 눌러요'); return; } kit.dot.bytes(rows); log(sym); };
    $('shapes').appendChild(b);
  });
  const off = document.createElement('button'); off.className = 'btn ghost shape'; off.textContent = '끔'; off.style.fontSize = '1rem';
  off.onclick = () => { kit.dot.clear(); log('▫'); };
  $('shapes').appendChild(off);
  $('clearLog').onclick = () => { $('log').innerHTML = '<span class="lead">보낸 신호가 여기에 차례로 보여요</span>'; };
})();
