// 선생님용 점검 — 알티노 라이트 실기 확인용. 모터·조향·소리·도트·LED 비트·센서를 하나씩 눌러 본다.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const P = window.AltinoProtocol;
  const kit = AltinoKit.create({ appId: 'c09', title: '점검', kick: false, rawSteer: true, onStatus: info });   // rawSteer: 슬라이더 값을 그대로 보낸다
  const KEYS = ['ir1', 'ir2', 'ir3', 'ir4', 'ir5', 'ir6', 'cds', 'battery'];
  const min = {}, max = {};

  // ── 연결 정보 · 기종 ──
  function info() {
    const st = kit.robotInfo();
    $('rName').textContent = st.name || '–'; $('rAddr').textContent = st.address || '–';
    paintModel();
  }
  function paintModel() { const m = P.getModel(); $('mLite').classList.toggle('on', m === 'lite'); $('mNeo').classList.toggle('on', m === 'neo'); $('mClassic').classList.toggle('on', m === 'classic'); }
  // 고른 기종은 이 로봇 주소에 적어 둔다 → 다른 화면에서도 그 기종으로 보낸다(transport._syncModel)
  function pickModel(m) {
    P.setModel(m); paintModel();
    try { const a = kit.robotInfo().address; if (a) localStorage.setItem('altino.model.' + a, m); } catch (e) {}
    kit.toast(P.modelLabel(m) + ' 프레임으로 보내요');
  }
  $('mNeo').onclick = () => pickModel('neo');
  $('mLite').onclick = () => pickModel('lite');
  $('mClassic').onclick = () => pickModel('classic');

  $('sens').innerHTML = KEYS.map(k => `<tr><td>${k}</td><td><b class="sv" id="s-${k}">–</b> <span class="lead">(최소 <span id="lo-${k}">–</span> · 최대 <span id="hi-${k}">–</span>)</span></td></tr>`).join('');
  let last = { rx: 0, bytes: 0, tx: 0 };
  setInterval(() => {
    const d = kit.debug, s = kit.sensor;
    $('rxHz').textContent = d.rxFrames - last.rx; $('rxBps').textContent = d.rxBytes - last.bytes; $('txHz').textContent = d.txCount - last.tx;
    last = { rx: d.rxFrames, bytes: d.rxBytes, tx: d.txCount };
    $('rxHex').textContent = d.rx ? P.toHex(d.rx) : '–'; $('txHex').textContent = d.tx ? P.toHex(d.tx) : '–';
    for (const k of KEYS) {
      const v = s[k]; if (v == null) continue;
      min[k] = min[k] == null ? v : Math.min(min[k], v); max[k] = max[k] == null ? v : Math.max(max[k], v);
      $('s-' + k).textContent = v; $('lo-' + k).textContent = min[k]; $('hi-' + k).textContent = max[k];
    }
    info(); report(); paintTrim();
  }, 1000);

  // ── 움직임 ──
  let fwd = 0, turn = 0;
  const apply = () => kit.drive(fwd * +$('spd').value, turn * +$('str').value);
  $('spd').addEventListener('input', () => { $('spdVal').textContent = $('spd').value; });
  $('str').addEventListener('input', () => { $('strVal').textContent = $('str').value; });
  kit.hold($('d-up'), () => { fwd = 1; apply(); }, () => { fwd = 0; apply(); });
  kit.hold($('d-down'), () => { fwd = -1; apply(); }, () => { fwd = 0; apply(); });
  kit.hold($('d-left'), () => { turn = -1; apply(); }, () => { turn = 0; apply(); });
  kit.hold($('d-right'), () => { turn = 1; apply(); }, () => { turn = 0; apply(); });

  // ── 소리 ──
  [['도', 37], ['레', 39], ['미', 41], ['파', 42], ['솔', 44], ['라', 46], ['시', 48], ['도↑', 49]].forEach(([n, c]) => {
    const b = document.createElement('button'); b.className = 'btn ghost sm'; b.textContent = n; b.onclick = () => kit.beep(c, 500); $('notes').appendChild(b);
  });
  $('beep').onclick = () => kit.beep(Math.max(0, Math.min(255, +$('code').value | 0)), 600);

  // ── 도트 ──
  $('dotN').onclick = () => kit.dot.number(12);
  $('dotS').onclick = () => kit.dot.icon('smile');
  $('dotA').onclick = () => kit.dot.bytes([0x18, 0x3C, 0x7E, 0x18, 0x98, 0xF8, 0x80, 0x80]);   // 위쪽 화살표 + 왼쪽 아래 ㄴ: 방향 확인용
  $('dotC').onclick = () => kit.dot.clear();
  $('dotCal').onclick = () => kit.dot.calibrate();

  // ── LED 비트 ──
  let mask = 0;
  const setMask = (m) => { mask = m; kit.led(mask); $('mask').textContent = mask; document.querySelectorAll('.bits button').forEach(b => b.classList.toggle('on', !!(mask & +b.dataset.v))); };
  for (let i = 0; i < 16; i++) {
    const v = 1 << i, b = document.createElement('button'); b.textContent = v; b.dataset.v = v;
    b.onclick = () => setMask(mask ^ v);
    $(i < 8 ? 'bitsLo' : 'bitsHi').appendChild(b);
  }
  $('ledSaved').textContent = Camp.settings.get('ledMask');
  $('ledSave').onclick = () => { if (!mask) { kit.toast('켜진 불빛이 없어요'); return; } Camp.settings.set('ledMask', mask); $('ledSaved').textContent = mask; kit.toast('불빛 신호 값 ' + mask + ' 저장'); };

  // ── 센서 자리 ──
  [['irL', 'irLeft'], ['irC', 'irCenter'], ['irR', 'irRight']].forEach(([id, key]) => {
    $(id).innerHTML = ['ir1', 'ir2', 'ir3', 'ir4', 'ir5', 'ir6'].map(k => `<option>${k}</option>`).join('');
    $(id).value = Camp.settings.get(key);
    $(id).onchange = () => { Camp.settings.set(key, $(id).value); kit.toast('센서 자리 저장'); };
  });

  // ── 직진 영점 ──
  // 이 화면은 rawSteer(구형 배율 없음)지만 영점은 더한다 — 여기서 ◀▶ 로 맞춰 보고 바로 달려 볼 수 있게. 원값만 보려면 '영점 끄기'.
  function paintTrim() { $('tzVal').textContent = kit.trim.label(); $('tzStep').textContent = kit.trim.step(); }
  const tz = (ok) => { if (!ok) kit.toast('로봇이 연결돼 있어야 영점을 바꿀 수 있어요'); paintTrim(); };
  $('tzL').onclick = () => tz(kit.trim.nudge(-1));
  $('tzR').onclick = () => tz(kit.trim.nudge(+1));
  $('tzZero').onclick = () => tz(kit.trim.set(0));
  const stepBy = (d) => { Camp.settings.set('trimStep', Math.max(1, Math.min(10, kit.trim.step() + d))); paintTrim(); };
  $('tzStepM').onclick = () => stepBy(-1);
  $('tzStepP').onclick = () => stepBy(+1);
  $('tzOff').onchange = () => kit.trim.off($('tzOff').checked);
  $('tzBias').addEventListener('input', () => { const v = +$('tzBias').value; $('tzBiasVal').textContent = v; kit.trim.bias(v / 100); });
  $('tzFw').onchange = () => kit.trim.fw($('tzFw').checked);

  // ── 프레임 실험 ──
  // 연결·쓰기는 되는데 로봇이 답하지 않을 때(2026-11-17 실기: 쓰기 성공 1078, 받은 묶음 0) 어느 조합이 맞는지 실물로 가른다.
  // 조합: 구형·라이트·네오 프레임 × 쓰기 방식. 조합마다 2.5초 동안 소리(솔)·불빛·도트를 켠 프레임을, 이어서 1.5초 동안 끈 프레임을 보낸다. 바퀴는 돌리지 않는다.
  const EXP = [];
  for (const [kind, name] of [['classic', '구형 28B'], ['lite', '라이트 22B'], ['neo', '네오 26B']])
    for (const split of (kind === 'lite' ? [false, true] : [false]))
      for (const resp of [false, true])
        EXP.push({ kind, split, resp, label: name + (kind === 'lite' ? (split ? ' · 14+8 나눠' : ' · 한 번에') : '') + (resp ? ' · 응답 있는 쓰기' : ' · 응답 없는 쓰기') });
  const exp = { i: -1, timer: null, rx: [], hits: [] };
  function expFrame(v, on) {
    const st = new P.AltinoState();
    if (on) { st.soundSet(44); st.ledSet(v.kind === 'lite' ? 0x0F : 0xFF); st.displayMode = 0xFF; st.dot.set([0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C]); }
    return P.buildFrame(st, v.kind);
  }
  function expStop(msg) {
    clearTimeout(exp.timer); exp.timer = null; exp.i = -1; kit.rawFrames(null);
    try { window.AltinoNative.setTxOptions(true, false); } catch (e) {}
    $('expGo').textContent = '시작'; $('expNo').textContent = '–'; $('expLbl').textContent = msg || '멈췄어요.';
  }
  function expStep(i) {
    if (i >= EXP.length) return expStop('끝났어요. 아래 점검 결과를 복사해 보내 주세요.');
    const v = EXP[i]; exp.i = i;
    const base = kit.debug.rxBytes;
    try { window.AltinoNative.setTxOptions(v.split, v.resp); } catch (e) {}
    $('expNo').textContent = (i + 1) + '/' + EXP.length; $('expLbl').textContent = v.label;
    kit.rawFrames(() => expFrame(v, true));
    exp.timer = setTimeout(() => {
      kit.rawFrames(() => expFrame(v, false));
      exp.timer = setTimeout(() => { exp.rx[i] = kit.debug.rxBytes - base; expStep(i + 1); }, 1500);
    }, 2500);
  }
  $('expGo').onclick = () => {
    if (exp.timer) return expStop();
    if (!kit.connected) { kit.toast('먼저 로봇을 연결해 주세요'); return; }
    exp.rx = []; exp.hits = []; $('expHits').textContent = '–'; $('expGo').textContent = '멈춤'; expStep(0);
  };
  $('expHit').onclick = () => {
    if (exp.i < 0) { kit.toast('실험 중에만 눌러요'); return; }
    if (!exp.hits.includes(exp.i + 1)) exp.hits.push(exp.i + 1);
    $('expHits').textContent = exp.hits.join(', ');
  };

  // ── 점검 결과(복사해서 보내기) ──
  function report() {
    const st = kit.robotInfo(), s = Camp.settings.all(), d = kit.debug;
    let ver = ''; try { ver = JSON.parse(window.AltinoUpdate.info() || '{}').name || ''; } catch (e) {}
    const lines = [
      '[알티노 캠프 앱 점검]', `앱 ${ver || '(브라우저)'} · ${new Date().toLocaleString('ko-KR')}`,
      `로봇 ${st.name || '-'} (${st.address || '-'}) · 프레임 ${P.getModel()} · 연결 ${kit.connected ? 'O' : 'X'}`,
      `받은 프레임 ${d.rxFrames} · 받은 바이트 ${d.rxBytes} · 보낸 프레임 ${d.txCount}`,
      '센서(지금/최소/최대): ' + KEYS.map(k => `${k} ${kit.sensor[k] == null ? '-' : kit.sensor[k]}/${min[k] == null ? '-' : min[k]}/${max[k] == null ? '-' : max[k]}`).join(', '),
      `불빛 신호 값 ${s.ledMask} · 앞 센서 자리 왼 ${s.irLeft} 가운데 ${s.irCenter} 오른 ${s.irRight}`,
      `${kit.trim.label()} · STEP ${kit.trim.step()}` + (kit.trim.off() ? ' · 영점 끔' : '') + (kit.trim.bias() ? ` · 구동 차 ${Math.round(kit.trim.bias() * 100)}%` : '') + (kit.trim.fw() ? ' · [25] 보정' : ''),
      'RX ' + (d.rx ? P.toHex(d.rx) : '-'), 'TX ' + (d.tx ? P.toHex(d.tx) : '-'),
    ];
    // 블루투스 층 진단(앱 1.0.3 두 번째 빌드부터): 고른 특성 · 쓰기 성공 여부 · 받은 묶음 · 서비스 표
    try {
      const g = JSON.parse(window.AltinoNative.getDiag() || '{}');
      lines.push(`BLE MTU ${g.mtu} · 쓰기 ${String(g.write).slice(0, 8)} · 알림 ${String(g.notify).slice(0, 8)} · CCCD ${g.cccd} · 연결 ${g.links}번 · 끊김 ${g.lastDisc}`,
        `쓰기 성공 ${g.wOk} 실패 ${g.wFail}(코드 ${g.lastWStatus}) 거부 ${g.wReject} · 받은 묶음 ${g.rxPkts} (${g.rxBytes}바이트)`,
        'GATT ' + g.gatt);
    } catch (e) {}
    if (exp.rx.length) lines.push('실험(번호:받은 바이트) ' + exp.rx.map((b, i) => (i + 1) + ':' + (b == null ? '-' : b)).join(' ') + ' · 반응한 번호 ' + (exp.hits.join(',') || '없음'),
      '실험 조합 ' + EXP.map((v, i) => (i + 1) + '=' + v.kind + (v.split ? '/나눔' : '/한번') + (v.resp ? '/응답' : '/무응답')).join(' '));
    if (document.activeElement !== $('report')) $('report').value = lines.join('\n');
  }
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('report').value); kit.toast('복사했어요 — 메신저에 붙여 넣어 보내 주세요'); }
    catch (e) { $('report').select(); try { document.execCommand('copy'); kit.toast('복사했어요'); } catch (x) { kit.toast('길게 눌러 직접 복사해 주세요'); } }
  };
  info(); report();
})();
