// 기종 찾기 시험 — 이름으로는 네오로 보이는데 실제로는 라이트(22바이트에만 답함)인 로봇.
// 연결 뒤 몇 초 안에 라이트 프레임으로 바꿔 보내고, 그 기종을 주소별로 적어 두는지 본다.  node tests/probe.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/usr/lib/node_modules/playwright')); }
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), WEB = path.join(ROOT, 'webapp');
const STUB = fs.readFileSync(path.join(ROOT, 'tests', 'stub.js'), 'utf8');
const server = http.createServer((q, r) => { const p = path.join(WEB, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200); fs.createReadStream(p).pipe(r); }).listen(0);
const base = 'http://localhost:' + server.address().port;
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const br = await chromium.launch(); const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(`window.__STUB_CFG={connected:true,address:'AA:BB:CC:DD:B7:CE',name:'ALTINO-B7CE'};` + STUB + `
  // 라이트 흉내: 22바이트 센서 요청([4]=3)을 받을 때만 22바이트로 답한다(조종 프레임에는 답하지 않음)
  const _send = window.AltinoNative.sendFrame;
  window.AltinoNative.sendFrame = (b64) => { _send(b64); const s = atob(b64);
    if (s.length === 22 && s.charCodeAt(1) === 0x10 && s.charCodeAt(4) === 3) { const f = new Uint8Array(22); f[0]=2; f[3]=1; f[4]=1; f[19]=3; f[20]=0x20; f[21]=3;
      let o=''; for (const b of f) o += String.fromCharCode(b); setTimeout(() => window.__altinoOnData && window.__altinoOnData(btoa(o)), 5); }
    return true; };`);
const p = await ctx.newPage(); await p.goto(base + '/check.html');
ok(await p.evaluate(() => AltinoProtocol.getModel()) === 'neo', '처음에는 이름대로 네오');
await p.waitForFunction(() => AltinoProtocol.getModel() === 'lite' && window.__altinoKit.debug.rxFrames > 0, null, { timeout: 8000 });
ok(true, '답이 없자 라이트로 바꿔 답을 받음'); await p.waitForTimeout(400);
ok(await p.evaluate(() => localStorage.getItem('altino.model.AA:BB:CC:DD:B7:CE')) === 'lite', '기종을 로봇 주소에 적어 둠');
await p.goto(base + '/t01.html'); await p.waitForTimeout(400);
ok(await p.evaluate(() => AltinoProtocol.getModel()) === 'lite', '다른 화면에서도 바로 라이트');
ok(await p.evaluate(() => window.__txFrames.slice(-1)[0].length) === 22, '22바이트로 보냄');
await br.close(); server.close(); console.log(fail ? '실패 ' + fail : '모두 통과'); process.exit(fail ? 1 : 0);
