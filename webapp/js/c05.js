// ⑤ AI 주행 경기장 — 손짓 4종(전진·정지·왼쪽·오른쪽)을 태블릿 카메라로 가르치고, 알아본 손짓으로 운전한다.
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const SPEED = 300, TURN = 100, MIN_CONF = 0.6, PREDICT_MS = 200, STALE_MS = 800;
  const CLASSES = [
    { id: 'go', ic: '▲', nm: '전진', hint: '손바닥 펴기' }, { id: 'stop', ic: '■', nm: '정지', hint: '주먹 · 손 내리기' },
    { id: 'left', ic: '◀', nm: '왼쪽', hint: '왼쪽 가리키기' }, { id: 'right', ic: '▶', nm: '오른쪽', hint: '오른쪽 가리키기' },
  ];
  const kit = AltinoKit.create({ appId: 'c05', title: 'AI 주행 경기장', onRunEnd: endRun });
  const video = $('video');
  let facing = kit.store.get('facing', 'user'), stream = null, pred = null, predAt = 0, lastCls = '', sameN = 0, lastKey = '';

  const ch = Camp.challenge({ kit, arena: 'c05', mount: $('chbar'), onChange: (c) => {
    const key = c.mode + c.level + c.active; if (key !== lastKey) { lastKey = key; kit.stop(); } paint();
  } });

  // ── 손짓 칸 ──
  CLASSES.forEach(c => {
    const d = document.createElement('div'); d.className = 'cl'; d.id = 'cl-' + c.id;
    d.innerHTML = `<div class="ic">${c.ic}</div><div class="nm">${c.nm}</div><div class="ct">${c.hint} · <b id="ct-${c.id}">0</b>장</div>
      <button class="btn teach" id="tc-${c.id}">📸 꾹 눌러 가르치기</button><button class="del" id="dl-${c.id}">지우기</button>`;
    $('cls').appendChild(d);
    let h = null;
    const snap = () => { if (!CampAI.ready || kit.running) return; const n = CampAI.add(c.id, video); if (n) $('ct-' + c.id).textContent = n; };
    const down = (e) => { e.preventDefault(); if (h) return; $('tc-' + c.id).classList.add('pressed'); snap(); h = setInterval(snap, 160); };
    const up = () => { if (!h) return; clearInterval(h); h = null; $('tc-' + c.id).classList.remove('pressed'); save(); };
    const b = d.querySelector('.teach');
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    d.querySelector('.del').onclick = async () => {
      if (!CampAI.count(c.id)) return;
      if (!await kit.confirm({ title: `'${c.nm}' 손짓을 지울까요?`, lines: [`${CampAI.count(c.id)}장을 지워요.`], okText: '지우기', danger: true })) return;
      CampAI.clear(c.id); $('ct-' + c.id).textContent = 0; save();
    };
  });
  function save() { try { kit.store.set('knn', CampAI.dump()); } catch (e) { kit.toast('⚠ 저장 공간이 모자라요'); } }
  function restore() { CampAI.restore(kit.store.get('knn', {})); CLASSES.forEach(c => { $('ct-' + c.id).textContent = CampAI.count(c.id); }); }

  // ── 카메라 ──
  async function openCam() {
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('camMsg').textContent = '⚠ 이 기기에서는 카메라를 쓸 수 없어요'; return false; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 320 }, height: { ideal: 240 } }, audio: false });
      video.srcObject = stream; await video.play();
      video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
      return true;
    } catch (e) { $('camMsg').textContent = '⚠ 카메라를 켤 수 없어요. 카메라 권한을 허용해 주세요.'; $('camMsg').style.display = ''; return false; }
  }
  $('flip').onclick = async () => { facing = facing === 'user' ? 'environment' : 'user'; kit.store.set('facing', facing); await openCam(); };

  // ── 알아보기 루프 ──
  function loop() {
    try {
      if (CampAI.ready && video.videoWidth) {
        const p = CampAI.predict(video);
        if (p) {
          sameN = (p.cls === lastCls) ? sameN + 1 : 1; lastCls = p.cls;
          // 같은 손짓이 두 번 이어지고 확신이 있을 때만 믿는다. 아니면 '정지'
          pred = (p.conf >= MIN_CONF && sameN >= 2) ? p.cls : 'stop'; predAt = Date.now();
          const c = CLASSES.find(x => x.id === p.cls);
          $('nowIc').textContent = c.ic; $('nowNm').textContent = c.nm + (p.conf < MIN_CONF ? ' (잘 모르겠어요)' : '');
          $('nowBar').style.width = Math.round(p.conf * 100) + '%';
          CLASSES.forEach(x => $('cl-' + x.id).classList.toggle('hit', x.id === p.cls && p.conf >= MIN_CONF));
        } else { pred = null; $('nowIc').textContent = '?'; $('nowNm').textContent = '손짓을 가르쳐 주세요'; $('nowBar').style.width = '0%'; }
      }
    } catch (e) { console.error(e); }
    setTimeout(loop, PREDICT_MS);
  }

  // ── 운전 ──
  const CMD = { go: ['▲', '전진', SPEED, 0], stop: ['■', '멈춤', 0, 0], left: ['◀', '왼쪽', SPEED, -TURN], right: ['▶', '오른쪽', SPEED, TURN] };
  function show(id) { const c = CMD[id] || CMD.stop; $('cmd').textContent = c[0]; $('cmdNm').textContent = c[1]; }
  $('start').onclick = () => {
    if (!ch.canPlay) { kit.toast('위에서 [도전 시작]을 눌러요'); return; }
    if (CampAI.count('go') < 5 || CampAI.count('stop') < 5) { kit.toast('전진과 정지를 5장 이상씩 가르쳐 주세요'); return; }
    const ok = kit.run(async (r) => {
      while (r.alive()) {
        const id = (pred && Date.now() - predAt < STALE_MS) ? pred : 'stop';
        const c = CMD[id] || CMD.stop; r.drive(c[2], c[3]); show(id);
        if (!await r.sleep(100)) return;
      }
    });
    if (!ok) return;
    $('start').classList.add('hidden'); $('stop').classList.remove('hidden');
    $('tip').textContent = '손짓으로만! 멈추려면 정지 손짓이나 [멈춰] 버튼.';
  };
  $('stop').onclick = () => kit.stop();
  function endRun() { $('start').classList.remove('hidden'); $('stop').classList.add('hidden'); show('stop'); paint(); }
  function paint() {
    const need = ['전진·정지', '전진·정지·왼쪽', '전진·정지·왼쪽·오른쪽', '전진·정지·왼쪽·오른쪽 (심판 손으로)'][ch.level - 1];
    if (!kit.running) $('tip').textContent = `이 단계에 필요한 손짓: ${need}. 운전을 시작하면 화면은 만지지 않아요.`;
  }

  (async () => {
    restore();
    try { await CampAI.load(); } catch (e) { console.error(e); $('camMsg').textContent = '⚠ AI를 준비하지 못했어요: ' + (e && e.message || e); return; }
    if (await openCam()) $('camMsg').style.display = 'none';
    loop();
  })();
  paint();
})();
