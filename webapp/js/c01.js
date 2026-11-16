// ① 정지 경기장 — 전진 버튼 한 번만(누르는 동안 주행), 정지선에 멈추기
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const SPEEDS = [300, 300, 400, 500];
  const kit = AltinoKit.create({ appId: 'c01', title: '정지 경기장' });
  let locked = false, downAt = 0, tickH = null;

  const ch = Camp.challenge({ kit, arena: 'c01', mount: $('chbar'), onChange: () => { unlock(); paint(); } });
  const speed = () => SPEEDS[ch.level - 1];

  function paint() {
    $('spd').textContent = speed();
    $('go').disabled = locked || !ch.canPlay;
    $('again').classList.toggle('hidden', !(locked && ch.mode === 'practice'));
    if (!ch.canPlay) $('state').textContent = '위에서 [도전 시작]을 눌러요';
    else if (locked) $('state').textContent = ch.mode === 'challenge' ? '심판 선생님의 판정을 기다려요' : '어디에 멈췄나요? 다시 해 봐요';
    else $('state').textContent = '누르고 있는 동안만 달려요';
  }
  function unlock() { locked = false; clearInterval(tickH); }

  kit.hold($('go'),
    () => {
      if (locked || !ch.canPlay) return;
      downAt = Date.now(); kit.drive(speed(), 0);
      clearInterval(tickH); tickH = setInterval(() => { $('held').textContent = ((Date.now() - downAt) / 1000).toFixed(1); }, 100);
      $('state').textContent = '달리는 중… 정지선에서 손을 떼요!';
    },
    () => {
      kit.drive(0, 0); clearInterval(tickH);
      if (!downAt) return;
      $('held').textContent = ((Date.now() - downAt) / 1000).toFixed(1); downAt = 0;
      locked = true; paint();
    });
  $('again').onclick = () => { unlock(); paint(); };
  paint();
})();
