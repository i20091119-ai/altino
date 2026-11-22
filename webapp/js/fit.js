// 작은 태블릿 맞춤 — 화면은 가로 1280×800 기준으로 짰고 스크롤이 없다. 그보다 작은 화면에서는 아래·오른쪽이 잘렸다(2026-11-22 캠프 현장).
// 화면이 기준보다 작으면 뷰포트 너비를 키워 전체를 같은 비율로 줄여 보여 준다. 가로·세로 둘 다 들어오게 너비를 정한다:
//   너비 = max(1280, 800 × 가로/세로)  →  세로는 항상 800 이상이 된다.
// 기준보다 큰 화면과 PC 브라우저는 건드리지 않는다. <head> 에서 가장 먼저 불러야 깜빡임이 없다.
(function () {
  'use strict';
  var BASE_W = 1280, BASE_H = 800;
  function fit() {
    var w = window.innerWidth || 0, h = window.innerHeight || 0;
    if (!w || !h) { w = Math.max(screen.width, screen.height); h = Math.min(screen.width, screen.height); }
    if (!w || !h || w < h) return;                      // 세로로 든 화면은 그대로 둔다
    if (w >= BASE_W && h >= BASE_H) return;             // 충분히 크다
    var m = document.querySelector('meta[name="viewport"]'); if (!m) return;
    var tw = Math.max(BASE_W, Math.ceil(BASE_H * w / h));
    m.setAttribute('content', 'width=' + tw + ', user-scalable=no');
    window.__fit = { from: w + 'x' + h, width: tw };    // 점검 화면이 보여 준다
  }
  try { fit(); } catch (e) {}
})();
