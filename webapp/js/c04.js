// ④ 센서 자율주행 경기장 — 1~3단계 손 따라오기 / 4단계 손 없이 장애물 피하기
// 센서 값의 방향(가까우면 커지는지 작아지는지)이 기종마다 달라서, '빈 곳'과 '손 10cm'를 재서 그 사이를 0~1 로 본다.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const SPEED = 300, STEER = 57, AVOID_STEER = 100, RUN_LIMIT_MS = 60000;
  const kit = AltinoKit.create({ appId: 'c04', title: '센서 자율주행 경기장', onSensor: onSensor, onRunEnd: endRun });
  let cal = kit.store.get('cal', null);              // { base:{L,C,R}, hand:{L,C,R} }
  let lastKey = '';

  const ch = Camp.challenge({ kit, arena: 'c04', mount: $('chbar'), onChange: (c) => {
    const key = c.mode + c.level + c.active; if (key !== lastKey) { lastKey = key; kit.stop(); } paint();
  } });

  const map = () => { const s = Camp.settings.all(); return { L: s.irLeft, C: s.irCenter, R: s.irRight }; };
  const read = (s) => { const m = map(); return { L: s[m.L], C: s[m.C], R: s[m.R] }; };
  const ready = () => !!(cal && cal.base && cal.hand && Math.abs(cal.hand.C - cal.base.C) >= 15);
  // 세기: 빈 곳 = 0, 손 10cm = 1 (더 가까우면 1 보다 커진다)
  function strength(s) {
    if (!ready()) return { L: 0, C: 0, R: 0 };
    const v = read(s), d = cal.hand.C - cal.base.C;
    const f = (k) => (v[k] == null ? 0 : Math.max(-0.2, Math.min(2.5, (v[k] - cal.base[k]) / d)));
    return { L: f('L'), C: f('C'), R: f('R') };
  }
  function onSensor(s) {
    const v = read(s), st = strength(s);
    for (const k of ['L', 'C', 'R']) {
      $('v' + k).textContent = v[k] == null ? '–' : v[k];
      $('b' + k).style.width = Math.max(0, Math.min(100, st[k] * 80)) + '%';
    }
  }

  // ── 센서 맞추기: 1초 동안 평균 ──
  async function measure() {
    const acc = { L: 0, C: 0, R: 0 }; let n = 0;
    for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 100)); const v = read(kit.sensor); if (v.C != null) { acc.L += v.L; acc.C += v.C; acc.R += v.R; n++; } }
    if (!n) return null;
    return { L: Math.round(acc.L / n), C: Math.round(acc.C / n), R: Math.round(acc.R / n) };
  }
  $('calBase').onclick = async () => {
    if (kit.running) return;
    $('calSay').textContent = '재는 중… 알티노 앞을 비워 두세요';
    const m = await measure(); if (!m) { $('calSay').textContent = '⚠ 센서 값이 안 와요. 연결을 확인해 주세요'; return; }
    cal = { base: m, hand: cal && cal.hand || null }; kit.store.set('cal', cal); kit.signal('notice'); paint();
  };
  $('calHand').onclick = async () => {
    if (kit.running) return;
    if (!cal || !cal.base) { kit.toast('①을 먼저 눌러 주세요'); return; }
    $('calSay').textContent = '재는 중… 손바닥을 10cm 앞에 대고 있어요';
    const m = await measure(); if (!m) { $('calSay').textContent = '⚠ 센서 값이 안 와요. 연결을 확인해 주세요'; return; }
    if (Math.abs(m.C - cal.base.C) < 15) { $('calSay').textContent = '⚠ 값이 거의 안 변했어요. 손을 가운데 센서 바로 앞에 대고 다시 눌러 주세요'; kit.signal('fail'); return; }
    cal.hand = m; kit.store.set('cal', cal); kit.signal('success'); paint();
  };

  // ── 1~3단계: 손 따라오기 ──
  function follow() {
    return kit.run(async (r) => {
      let steer = 0;
      while (r.alive()) {
        const s = strength(r.sensor), top = Math.max(s.L, s.C, s.R);
        if (!r.fresh()) { r.drive(0, 0); say('📡', '센서 신호를 기다려요'); }
        else if (top < 0.3) { r.drive(0, 0); steer = 0; say('👀', '손을 찾고 있어요'); }
        else if (s.C > 1.15) { r.drive(0, 0); say('🤚', '너무 가까워요 — 손을 조금 멀리'); }
        else {
          const diff = s.R - s.L;
          if (Math.abs(diff) > 0.2) steer = Math.sign(diff) * STEER; else if (Math.abs(diff) < 0.1) steer = 0;
          r.drive(SPEED, steer); say(steer < 0 ? '↖' : steer > 0 ? '↗' : '⬆', '손을 따라가요');
        }
        if (!await r.sleep(100)) return;
      }
    });
  }
  // ── 4단계: 손 없이 장애물 피하기 (기준값 = 얼마나 가까워지면 피할지) ──
  function avoid() {
    const T = (+$('th').value) / 100;
    return kit.run(async (r) => {
      const t0 = Date.now(); let dir = 0;
      while (r.alive() && Date.now() - t0 < RUN_LIMIT_MS) {
        const s = strength(r.sensor), top = Math.max(s.L, s.C, s.R);
        if (!r.fresh()) { r.drive(0, 0); say('📡', '센서 신호를 기다려요'); }
        else if (s.C > 1.7) {                       // 코앞: 뒤로 물러났다가 다시
          const back = dir || (s.L > s.R ? 1 : -1);
          say('↩', '너무 가까워요 — 뒤로!'); r.drive(-320, -back * AVOID_STEER);
          if (!await r.sleep(700)) return; dir = back; continue;
        } else if (top > T) {
          if (!dir) dir = (s.L > s.R) ? 1 : -1;     // 왼쪽이 더 가까우면 오른쪽으로. 한 번 정한 방향은 비켜 갈 때까지 유지
          r.drive(SPEED, dir * AVOID_STEER); say(dir > 0 ? '↗' : '↖', '장애물을 피해요');
        } else { dir = 0; r.drive(SPEED, 0); say('⬆', '앞으로 가요'); }
        $('tip').textContent = `남은 시간 ${Math.max(0, Math.ceil((RUN_LIMIT_MS - (Date.now() - t0)) / 1000))}초`;
        if (!await r.sleep(100)) return;
      }
      r.drive(0, 0);
    });
  }
  function say(ico, text) { $('ico').textContent = ico; $('say').textContent = text; }

  $('start').onclick = () => {
    if (!ch.canPlay) { kit.toast('위에서 [도전 시작]을 눌러요'); return; }
    if (!ready()) { kit.toast('센서를 먼저 맞춰 주세요 (① → ②)'); return; }
    const ok = ch.level === 4 ? avoid() : follow();
    if (!ok) { kit.toast('이미 움직이는 중이에요'); return; }
    $('start').classList.add('hidden'); $('stop').classList.remove('hidden');
  };
  $('stop').onclick = () => kit.stop();
  function endRun() { $('start').classList.remove('hidden'); $('stop').classList.add('hidden'); paint(); }
  $('th').addEventListener('input', () => { $('thVal').textContent = $('th').value; kit.store.set('th', +$('th').value); });
  $('th').value = kit.store.num('th', 60, 30, 120); $('thVal').textContent = $('th').value;

  function paint() {
    const l4 = ch.level === 4;
    $('calBase').classList.toggle('done', !!(cal && cal.base));
    $('calHand').classList.toggle('done', ready());
    if (ready()) $('calSay').textContent = `맞췄어요 ✓ (빈 곳 ${cal.base.C} · 손 ${cal.hand.C}) — 자리를 옮기면 다시 맞춰요`;
    $('thBox').classList.toggle('hidden', !l4); $('thSay').classList.toggle('hidden', !l4);
    if (!kit.running) {
      say(l4 ? '🚧' : '✋', !ready() ? '센서를 먼저 맞춰 주세요' : !ch.canPlay ? '위에서 [도전 시작]을 눌러요' : l4 ? '기준값을 정하고 출발!' : '시작을 누르고 손을 앞에 대요');
      $('tip').textContent = l4 ? '출발하면 손을 대지 않아요. 벽과 장애물을 스스로 피해 출구까지!' : '손을 알티노 앞에 두고 천천히 움직여요. 손이 없으면 멈춰요.';
      $('start').textContent = l4 ? '🚗 출발' : '▶ 시작';
    }
  }
  paint();
})();
