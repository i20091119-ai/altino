// 캠프 앱 화면 시험 — 모든 화면이 오류 없이 뜨는지 + 경기장 핵심 흐름(가짜 로봇)
//   node tests/camp.mjs            (스크린샷은 tests/shots/ 에)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'webapp'), SHOTS = path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const STUB = fs.readFileSync(path.join(ROOT, 'tests', 'stub.js'), 'utf8');
const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(WEB, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(WEB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, r));
const BASE = 'http://localhost:' + server.address().port;
const br = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
let fail = 0;
const ok = (c, msg) => { if (c) console.log('  ✓ ' + msg); else { fail++; console.log('  ✗ ' + msg); } };

async function open(pg, native) {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['camera'] });
  if (native) await ctx.addInitScript(STUB);
  const p = await ctx.newPage(); p._errs = []; p._bad = [];
  p.on('pageerror', e => p._errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') p._errs.push('console: ' + m.text()); });
  p.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) p._bad.push(r.url().replace(BASE, '')); });
  await p.goto(BASE + '/' + pg); await p.waitForTimeout(600);
  return p;
}
const holdEl = async (p, sel, ms) => { const b = await p.locator(sel).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); };

// 1) 모든 화면이 뜨는가 (브라우저 / 태블릿 흉내)
const pages = fs.readdirSync(WEB).filter(f => f.endsWith('.html')).sort();
console.log('■ 화면 열기');
for (const pg of pages) for (const native of [false, true]) {
  const p = await open(pg, native);
  ok(!p._errs.length && !p._bad.length, `${pg} (${native ? '태블릿' : '브라우저'})` + (p._errs.length ? ' — ' + p._errs.join(' | ') : '') + (p._bad.length ? ' — 404 ' + p._bad.join(',') : ''));
  if (!native) await p.screenshot({ path: path.join(SHOTS, pg.replace('.html', '.png')) });
  await p.context().close();
}

// 2) ① 정지: 도전 시작 → 전진 누름 → 심판 성공 4번 → 55점
console.log('■ ① 정지 도전 흐름');
{
  const p = await open('c01.html', false);
  await p.click('.seg [data-m="challenge"]'); await p.click('text=도전 시작');
  for (let lv = 1; lv <= 4; lv++) {
    const spd = await p.textContent('#spd');
    ok(spd === String([300, 300, 400, 500][lv - 1]), `${lv}단계 속도 ${spd}`);
    await holdEl(p, '#go', 400); await p.waitForTimeout(250);
    const m = await p.evaluate(() => { const k = window.__altinoKit; return k.state.motorA; });
    ok(m === 0, '손을 떼면 멈춤');
    ok(await p.locator('#go').isDisabled(), '한 번 떼면 잠김');
    await holdEl(p, '.judge .leaf', 800);
  }
  await p.waitForTimeout(300);
  ok((await p.textContent('#chScore')) === '55점', '4단계 성공 → 55점');
  await p.screenshot({ path: path.join(SHOTS, 'c01_result.png') });
  const saved = await p.evaluate(() => Camp.results.get('c01'));
  ok(saved && saved.level === 4 && saved.pts === 55, '기록 저장');
  await p.context().close();
}
// 3) ② 표현: 정답을 그대로 그려 제출 → 성공 / 엉뚱하게 그리면 실패
console.log('■ ② 표현 자동 판정');
{
  const p = await open('c02.html', false);
  await p.waitForTimeout(200);
  const r1 = await p.evaluate(async () => { document.getElementById('submit').click(); await new Promise(r => setTimeout(r, 900)); return document.getElementById('result').textContent; });
  ok(r1.includes('❌'), '빈 그림 제출 → 실패: ' + r1);
  await p.screenshot({ path: path.join(SHOTS, 'c02_fail.png') });
  await p.context().close();
}
// 4) ③ 암호: 카드 보기·신호 버튼
console.log('■ ③ 암호 신호');
{
  const p = await open('c03.html', false);
  await p.click('#show');
  const n = await p.locator('#code span').count(); ok(n === 1, '1단계 카드 1장');
  await p.click('[data-k="l1"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => window.__altinoKit.state.led) === 15, '불빛 켜짐(15)');
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__altinoKit.state.led) === 0, '불빛 꺼짐');
  await p.click('#shapes button >> nth=4'); 
  ok(await p.evaluate(() => window.__altinoKit.state.displayMode) === 0xFF, '도트 모양 출력');
  await p.screenshot({ path: path.join(SHOTS, 'c03_shown.png') });
  await p.context().close();
}
// 5) ④ 센서: 빈 곳·손 재기 → 따라오기
console.log('■ ④ 센서 따라오기');
{
  const p = await open('c04.html', false);
  await p.evaluate(() => { window.ALTINO_MOCK = { ir1: 1200, ir2: 1200, ir3: 1200 }; });
  await p.waitForTimeout(300); await p.click('#calBase'); await p.waitForTimeout(1300);
  await p.evaluate(() => { window.ALTINO_MOCK = { ir1: 900, ir2: 300, ir3: 900 }; });
  await p.waitForTimeout(300); await p.click('#calHand'); await p.waitForTimeout(1300);
  ok((await p.textContent('#calSay')).includes('맞췄어요'), '센서 맞추기 완료');
  await p.evaluate(() => { window.ALTINO_MOCK = { ir1: 1100, ir2: 700, ir3: 1100 }; });
  await p.click('#start'); await p.waitForTimeout(700);
  let st = await p.evaluate(() => { const k = window.__altinoKit; return [k.state.motorA, k.state.steering]; });
  ok(st[0] > 0 && st[1] === 0, '손이 앞에 있으면 직진 ' + st);
  await p.evaluate(() => { window.ALTINO_MOCK = { ir1: 1150, ir2: 800, ir3: 500 }; }); await p.waitForTimeout(500);
  st = await p.evaluate(() => { const k = window.__altinoKit; return [k.state.motorA, k.state.steering]; });
  ok(st[0] > 0 && st[1] > 0, '손이 오른쪽이면 오른쪽으로 ' + st);
  await p.evaluate(() => { window.ALTINO_MOCK = { ir1: 1200, ir2: 1200, ir3: 1200 }; }); await p.waitForTimeout(500);
  st = await p.evaluate(() => window.__altinoKit.state.motorA);
  ok(st === 0, '손이 없으면 멈춤');
  await p.screenshot({ path: path.join(SHOTS, 'c04_run.png') });
  await p.click('#stop');
  await p.context().close();
}
// 6) ⑤ AI: 모델 준비 → 가르치기 → 알아보기
console.log('■ ⑤ AI 손짓');
{
  const p = await open('c05.html', false);
  await p.waitForFunction(() => window.CampAI && CampAI.ready, null, { timeout: 60000 });
  ok(true, 'AI 모델 준비');
  await p.waitForFunction(() => document.getElementById('video').videoWidth > 0, null, { timeout: 15000 });
  ok(true, '카메라 켜짐');
  await holdEl(p, '#tc-go', 1500); await holdEl(p, '#tc-stop', 1500);
  const cnt = await p.evaluate(() => [CampAI.count('go'), CampAI.count('stop')]);
  ok(cnt[0] >= 5 && cnt[1] >= 5, '가르치기 ' + cnt);
  await p.waitForTimeout(800);
  const nm = await p.textContent('#nowNm'); ok(nm && !nm.includes('가르쳐'), '알아보기: ' + nm);
  await p.click('#start'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => window.__altinoKit.running), '운전 시작');
  await p.screenshot({ path: path.join(SHOTS, 'c05_run.png') });
  await p.click('#stop'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__altinoKit.state.motorA) === 0, '멈춰 → 정지');
  const kb = await p.evaluate(() => (localStorage.getItem('altino.c05.knn') || '').length); ok(kb > 1000, '배운 손짓 저장 ' + kb + '자');
  ok(!p._errs.length, '오류 없음' + (p._errs.length ? ' — ' + p._errs.join(' | ') : ''));
  await p.context().close();
}
await br.close(); server.close();
console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
