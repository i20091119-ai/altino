// 캠프 홈 — 경기장 5종 + 수업 6개 + 우리 가족 점수
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const kit = AltinoKit.create({ appId: 'c00', title: '캠프 홈' });

  const LESSONS = [
    { id: 't01', em: '🎒', nm: '입학하기', sb: '깨우기 · 이름 짓기' },
    { id: 't02', em: '👣', nm: '걸음마', sb: '속도와 멈추기' },
    { id: 't03', em: '😊', nm: '표정 만들기', sb: '도트 8×8' },
    { id: 't04', em: '🎵', nm: '노래 가르치기', sb: '음높이 · 가락' },
    { id: 't05', em: '💡', nm: '비밀 신호', sb: '불빛 · 소리 암호' },
    { id: 't06', em: '✋', nm: '손길 알아채기', sb: '센서 · 따라오기' },
  ];

  function render() {
    const all = Camp.results.all();
    $('arenas').innerHTML = Camp.ARENAS.map((a, i) => {
      const r = all[a.id];
      const st = r && r.level ? `⭐ ${r.level}단계 · ${r.pts + (r.bonus || 0)}점` : '아직 도전 전';
      return `<a class="arena a${i + 1}" href="${a.id}.html"><span class="no">${a.no}</span><span class="em">${a.emoji}</span>
        <span class="nm">${a.name}</span><span class="sb">${a.sub}</span><span class="st">${st}</span></a>`;
    }).join('');
    $('lessons').innerHTML = LESSONS.map(l =>
      `<a class="lesson" href="${l.id}.html"><span class="em">${l.em}</span><span class="nm">${l.nm}</span><span class="sb">${l.sb}</span></a>`).join('');
    $('total').textContent = Camp.results.total();
  }

  $('famName').value = kit.team.get();
  $('famName').addEventListener('change', (e) => { kit.team.set(e.target.value); kit.toast('👥 ' + (kit.team.get() || '이름을 지웠어요')); });
  $('resetBtn').onclick = async () => {
    if (!await kit.confirm({ title: '이 태블릿의 기록을 지울까요?', lines: ['경기장 연습 기록이 모두 지워져요.'], okText: '지우기', danger: true })) return;
    Camp.results.clear(); render(); kit.toast('기록을 지웠어요');
  };
  render();
  window.addEventListener('pageshow', render);
})();
