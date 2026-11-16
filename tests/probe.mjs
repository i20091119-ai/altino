// 기종 찾기 시험 — 구형 알티노(ALTINO-B7CE: 28바이트에만 56바이트로 답함).  node tests/probe.mjs
//  ① 이름만으로 바로 구형을 고르는지  ② 예전에 잘못 적어 둔 기종(lite)이 있어도 답이 없으면 구형을 찾아 고쳐 적는지
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/usr/lib/node_modules/playwright')); }
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), WEB = path.join(ROOT, 'webapp');
const STUB = fs.readFileSync(path.join(ROOT, 'tests', 'stub.js'), 'utf8');
const server = http.createServer((q, r) => { const p = path.join(WEB, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200); fs.createReadStream(p).pipe(r); }).listen(0);
const base = 'http://localhost:' + server.address().port;
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const br = await chromium.launch();
const ROBOT = `window.__STUB_CFG={connected:true,address:'AA:BB:CC:DD:B7:CE',name:'ALTINO-B7CE'};` + STUB + `
  // 구형 흉내: 28바이트(02 1C … 03, 체크섬 맞음)를 받을 때만 56바이트로 답한다
  const _send = window.AltinoNative.sendFrame;
  window.AltinoNative.sendFrame = (b64) => { _send(b64); const s = atob(b64); const c = (i) => s.charCodeAt(i);
    let sum = 0; for (let i = 1; i < s.length; i++) if (i !== 2) sum += c(i);
    if (s.length === 28 && c(0) === 2 && c(1) === 0x1C && c(27) === 3 && (sum & 0xFF) === c(2)) { const f = new Uint8Array(56); f[0]=2; f[55]=3; f[8]=77; f[47]=3; f[48]=0x20;
      let k = 0; for (let i = 0; i < 56; i++) if (i !== 2) k += f[i]; f[2] = k & 0xFF;
      let o=''; for (const b of f) o += String.fromCharCode(b); setTimeout(() => window.__altinoOnData && window.__altinoOnData(btoa(o)), 5); }
    return true; };`;
const KEY = 'altino.model.AA:BB:CC:DD:B7:CE';
{ console.log('■ ① 이름으로 구형');
  const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(ROBOT);
  const p = await ctx.newPage(); await p.goto(base + '/check.html');
  ok(await p.evaluate(() => AltinoProtocol.getModel()) === 'classic', '이름 ALTINO-B7CE → 구형');
  await p.waitForFunction(() => window.__altinoKit.debug.rxFrames > 3, null, { timeout: 5000 });
  ok(await p.evaluate(() => window.__altinoKit.sensor.ir1) === 77, '56바이트 답에서 센서 값을 읽음');
  ok(await p.evaluate(() => window.__txFrames.slice(-1)[0].length) === 28, '28바이트로 보냄');
  await ctx.close(); }
{ console.log('■ ② 잘못 적어 둔 기종 고치기');
  const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(`try{ if(!sessionStorage.getItem('seeded')){ localStorage.setItem('${KEY}','lite'); sessionStorage.setItem('seeded','1'); } }catch(e){}` + ROBOT);
  const p = await ctx.newPage(); await p.goto(base + '/check.html');
  ok(await p.evaluate(() => AltinoProtocol.getModel()) === 'lite', '처음에는 적어 둔 대로 라이트');
  await p.waitForFunction(() => AltinoProtocol.getModel() === 'classic' && window.__altinoKit.debug.rxFrames > 0, null, { timeout: 9000 });
  ok(true, '답이 없자 다른 기종을 차례로 보내 구형에서 답을 받음'); await p.waitForTimeout(400);
  ok(await p.evaluate((k) => localStorage.getItem(k), KEY) === 'classic', '기종을 로봇 주소에 고쳐 적음');
  await p.goto(base + '/t01.html'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => AltinoProtocol.getModel()) === 'classic', '다른 화면에서도 바로 구형');
  await ctx.close(); }
await br.close(); server.close(); console.log(fail ? '실패 ' + fail : '모두 통과'); process.exit(fail ? 1 : 0);
