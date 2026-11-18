// 알티노 캠프 — 경기장 공용 모듈
//   Camp.ARENAS      경기장 5종 정의(단계 이름·점수)
//   Camp.results     이 태블릿에 남는 우리 가족 기록(공식 기록은 심판 심사표)
//   Camp.settings    점검 화면에서 맞춘 값(LED 비트, 센서 자리 등) — 모든 화면이 같이 쓴다
//   Camp.challenge   연습/도전 진행 바(단계 4 · 기회 3 · 4분 · 심판 판정)
'use strict';
(function () {
  const POINTS = [10, 20, 35, 55];
  const LIVES = 3;
  const LIMIT_MS = 4 * 60 * 1000;
  const HOLD_MS = 600;                       // 심판 버튼은 꾹 눌러야 판정된다(아이가 실수로 누르는 것 방지)

  const ARENAS = [
    { id: 'c01', no: '①', name: '정지', emoji: '🛑', sub: '버튼 한 번만 꾹 — 정지선에 딱 멈추기',
      levels: ['속도 300 · ±20cm', '속도 300 · ±10cm', '속도 400 · ±10cm', '속도 500 · ±10cm'] },
    { id: 'c02', no: '②', name: '표현', emoji: '😊', sub: '카드와 똑같이 표정과 소리 만들기',
      levels: ['표정 따라 그리기', '표정 + 음 3개', '10초 보고 기억하기', '표정 2장면 + 음 4개'] },
    { id: 'c03', no: '③', name: '암호 전달', emoji: '🔐', sub: '말없이 신호로만 — 우리 가족 암호',
      levels: ['숫자 1개', '숫자 2개', '기호 3개', '숫자 4자리 · 30초'], bonus: { label: '역방향', pts: 10 } },
    { id: 'c04', no: '④', name: '센서 자율주행', emoji: '✋', sub: '손을 따라오고, 스스로 피해 가기',
      levels: ['손 따라오기 · 직선', '손 따라오기 · 한 번 꺾기', '손 따라오기 · S자', '손 없이 장애물 피하기'] },
    { id: 'c05', no: '⑤', name: 'AI 주행', emoji: '🤖', sub: '손짓으로만 운전 — 화면은 만지지 않기',
      levels: ['손짓 2종 → 정지 구역 A', '손짓 3종 → 정지 구역 B', '손짓 4종 · 60초 안', '심판 손짓으로 → B'] },
  ];
  const arenaOf = (id) => ARENAS.find(a => a.id === id);

  // ── 저장 ─────────────────────────────────────────────────────────────
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const results = {
    all() { const r = LS.get('altino.camp.results', {}); return (r && typeof r === 'object') ? r : {}; },
    get(id) { return results.all()[id] || null; },
    // 더 좋은 기록일 때만 바꾼다(단계 높은 쪽, 같으면 빠른 쪽)
    save(id, rec) {
      const all = results.all(), old = all[id];
      const better = !old || rec.level > old.level || (rec.level === old.level && (rec.bonus || 0) > (old.bonus || 0)) ||
        (rec.level === old.level && (rec.bonus || 0) === (old.bonus || 0) && rec.ms && (!old.ms || rec.ms < old.ms));
      if (better) { all[id] = rec; LS.set('altino.camp.results', all); }
      return better;
    },
    clear() { LS.set('altino.camp.results', {}); },
    total() { const all = results.all(); return ARENAS.reduce((s, a) => s + ((all[a.id] && all[a.id].pts) || 0) + ((all[a.id] && all[a.id].bonus) || 0), 0); },
  };
  const DEFAULTS = {
    ledMask: 15,                      // 앞 등(네오 실측값). 라이트는 점검 화면에서 찾아 저장
    irLeft: 'ir1', irCenter: 'ir2', irRight: 'ir3',   // 앞쪽 센서 자리(네오 기준)
    trimStep: 3,                                      // 직진 영점 한 칸(조향 원값 1~10). kit.trim.step() 이 읽는다
  };
  const settings = {
    all() { return Object.assign({}, DEFAULTS, LS.get('altino.camp.settings', {})); },
    get(k) { return settings.all()[k]; },
    set(k, v) { const s = LS.get('altino.camp.settings', {}); s[k] = v; LS.set('altino.camp.settings', s); },
    reset() { LS.set('altino.camp.settings', {}); },
  };

  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  // ── 도전 진행 바 ─────────────────────────────────────────────────────
  // opts: { kit, arena, mount, auto(앱이 스스로 판정하면 true → 심판 버튼 숨김), onChange(state) }
  function challenge(opts) {
    const kit = opts.kit, A = arenaOf(opts.arena), mount = opts.mount;
    const st = { mode: 'practice', level: 1, lives: LIVES, active: false, best: 0, bonus: 0, startAt: 0, lastPassMs: 0 };
    let timerH = null;

    mount.classList.add('chbar');
    mount.innerHTML = '';
    const seg = el('div', 'seg', '<button data-m="practice" class="on">연습</button><button data-m="challenge">도전</button>');
    const levels = el('div', 'levels');
    A.levels.forEach((d, i) => {
      const b = el('button', 'lv', `<span class="t">${i + 1}단계 · ${POINTS[i]}점</span><span class="d">${d}</span>`);
      b.type = 'button'; b.dataset.lv = i + 1;
      b.onclick = () => { if (st.mode === 'practice') { st.level = i + 1; paint(); emit(); } };
      levels.appendChild(b);
    });
    const hearts = el('div', 'hearts');
    const timer = el('div', 'timer', '4:00');
    const trimTag = el('div', 'trimtag', '영점 0');     // 읽기 전용. 영점은 걸음마(t02 ①)에서만 맞춘다
    const startBtn = el('button', 'btn', '도전 시작'); startBtn.type = 'button';
    const judge = el('div', 'judge');
    const okBtn = el('button', 'btn leaf', '<span class="fill"></span>심판 ⭕'); okBtn.type = 'button';
    const noBtn = el('button', 'btn coral', '<span class="fill"></span>심판 ❌'); noBtn.type = 'button';
    judge.append(okBtn, noBtn);
    let bonusBtn = null;
    if (A.bonus) { bonusBtn = el('button', 'btn sun sm', `<span class="fill"></span>${A.bonus.label} +${A.bonus.pts}`); bonusBtn.type = 'button'; judge.appendChild(bonusBtn); }
    mount.append(seg, levels, trimTag, hearts, timer, startBtn, judge);

    // 결과 창
    const modal = el('div', 'modal hidden');
    modal.innerHTML = `<div class="sheet"><div style="font-size:3rem" id="chIco">🏁</div><h2 id="chTitle">도전 끝!</h2>
      <div class="bigscore" id="chScore">0점</div><p class="lead" id="chDetail"></p>
      <p class="lead" style="margin:10px 0 16px">공식 기록은 심판 선생님의 심사표예요.</p>
      <div class="row" style="justify-content:center"><button class="btn big" id="chOk">확인</button></div></div>`;
    document.body.appendChild(modal);
    if (kit) kit.block(modal);
    modal.querySelector('#chOk').onclick = () => { modal.classList.add('hidden'); setMode('practice'); };

    function holdBtn(b, fn) {
      let h = null;
      const down = (e) => { e.preventDefault(); if (b.disabled) return; b.classList.add('holding'); h = setTimeout(() => { b.classList.remove('holding'); h = null; fn(); }, HOLD_MS); };
      const up = () => { if (h) { clearTimeout(h); h = null; } b.classList.remove('holding'); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    }
    holdBtn(okBtn, () => pass());
    holdBtn(noBtn, () => fail());
    if (bonusBtn) holdBtn(bonusBtn, () => { if (!st.active) return; st.bonus = A.bonus.pts; bonusBtn.disabled = true; if (kit) kit.toast(`${A.bonus.label} 보너스 +${A.bonus.pts}점`); });

    seg.addEventListener('click', async (e) => {
      const m = e.target && e.target.dataset && e.target.dataset.m; if (!m || m === st.mode) return;
      if (st.active && kit && !(await kit.confirm({ title: '도전을 그만둘까요?', lines: ['지금까지의 기록으로 끝나요.'], okText: '그만두기', danger: true }))) return;
      if (st.active) { finish('quit'); return; }
      setMode(m);
    });
    startBtn.onclick = () => { if (st.mode === 'challenge' && !st.active) begin(); };

    function setMode(m) {
      st.mode = m; st.active = false; st.level = 1; st.lives = LIVES; st.best = 0; st.bonus = 0; st.lastPassMs = 0;
      clearInterval(timerH); timer.textContent = fmt(LIMIT_MS); timer.classList.remove('low');
      if (bonusBtn) bonusBtn.disabled = false;
      if (kit) { kit.stop(); kit.trim.lock(false); }
      paint(); emit();
    }
    function begin() {
      st.active = true; st.level = 1; st.lives = LIVES; st.best = 0; st.bonus = 0; st.startAt = Date.now(); st.lastPassMs = 0;
      clearInterval(timerH);
      timerH = setInterval(() => {
        const left = LIMIT_MS - (Date.now() - st.startAt);
        timer.textContent = fmt(left); timer.classList.toggle('low', left < 30000);
        if (left <= 0) finish('time');
      }, 250);
      if (kit) { kit.trim.lock(true); kit.signal('start'); }   // 도전 중에는 영점을 바꿀 수 없다
      paint(); emit();
    }
    function pass() {
      if (st.mode !== 'challenge' || !st.active) { if (kit && st.mode === 'practice') { kit.signal('success'); if (st.level < 4) { st.level++; paint(); emit(); } } return; }
      st.best = st.level; st.lastPassMs = Date.now() - st.startAt;
      if (kit) kit.signal('success');
      if (st.level >= 4) { finish('clear'); return; }
      st.level++; paint(); emit();
    }
    function fail() {
      if (st.mode !== 'challenge' || !st.active) { if (kit && st.mode === 'practice') kit.signal('fail'); return; }
      st.lives--; if (kit) kit.signal('fail');
      if (st.lives <= 0) { finish('lives'); return; }
      paint(); emit();
    }
    function finish(why) {
      if (!st.active) return;
      st.active = false; clearInterval(timerH);
      if (kit) { kit.stop(); kit.trim.lock(false); }
      const pts = st.best ? POINTS[st.best - 1] : 0;
      const rec = { level: st.best, pts, bonus: st.bonus, ms: st.lastPassMs, at: Date.now() };
      results.save(A.id, rec);
      if (kit && st.best) kit.record.add({ title: `${A.no} ${A.name} ${st.best}단계`, detail: `${pts + st.bonus}점`, stars: Math.min(3, st.best) });
      modal.querySelector('#chIco').textContent = why === 'clear' ? '🏆' : (st.best ? '🎉' : '💪');
      modal.querySelector('#chTitle').textContent = why === 'clear' ? '4단계까지 모두 성공!' : why === 'time' ? '시간이 다 됐어요' : why === 'lives' ? '기회를 다 썼어요' : '도전 끝!';
      modal.querySelector('#chScore').textContent = (pts + st.bonus) + '점';
      modal.querySelector('#chDetail').textContent = st.best
        ? `${A.no} ${A.name} · ${st.best}단계 성공` + (st.bonus ? ` + 보너스 ${st.bonus}점` : '') + (st.lastPassMs ? ` · ${Math.round(st.lastPassMs / 1000)}초` : '')
        : `${A.no} ${A.name} · 다음엔 꼭 성공할 거예요`;
      modal.classList.remove('hidden');
      paint(); emit();
    }
    function paint() {
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
      levels.querySelectorAll('.lv').forEach(b => {
        const n = +b.dataset.lv;
        b.classList.toggle('cur', n === st.level && !(st.mode === 'challenge' && !st.active));
        b.classList.toggle('done', st.mode === 'challenge' && n <= st.best);
        b.disabled = st.mode !== 'practice';
      });
      if (kit) trimTag.textContent = kit.trim.label();
      const ch = st.mode === 'challenge';
      hearts.style.display = ch ? '' : 'none';
      timer.style.display = ch ? '' : 'none';
      startBtn.style.display = (ch && !st.active) ? '' : 'none';
      judge.style.display = (ch && st.active && !opts.auto) ? '' : (ch && st.active && bonusBtn ? '' : 'none');
      okBtn.style.display = noBtn.style.display = opts.auto ? 'none' : '';
      hearts.innerHTML = Array.from({ length: LIVES }, (_, i) => `<span class="${i < st.lives ? '' : 'off'}">❤️</span>`).join('');
    }
    function emit() { if (typeof opts.onChange === 'function') { try { opts.onChange(api); } catch (e) { console.error(e); } } }

    const api = {
      arena: A,
      get mode() { return st.mode; }, get level() { return st.level; }, get lives() { return st.lives; },
      get active() { return st.active; }, get best() { return st.best; },
      // 연습이거나, 도전이 진행 중일 때만 로봇을 움직여도 된다
      get canPlay() { return st.mode === 'practice' || st.active; },
      pass, fail, finish, setMode,
      elapsed: () => (st.active ? Date.now() - st.startAt : 0),
    };
    paint();
    if (kit) setInterval(() => { trimTag.textContent = kit.trim.label(); }, 2000);   // 로봇이 나중에 연결되거나 바뀌어도 맞게
    setTimeout(emit, 0);
    return api;
  }

  window.Camp = { ARENAS, POINTS, LIVES, LIMIT_MS, arenaOf, results, settings, challenge, fmt };
})();
