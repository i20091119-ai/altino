// 프레임 시험 — docs/ALTINO_LITE_ORCHESTRA2.md 8장의 검증용 값과 바이트 단위로 같은지.  node tests/frames.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../webapp/js/protocol.js');
let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
const t = (model, name, f, exp) => { const st = new P.AltinoState(); f(st); const g = P.toHex(P.buildFrame(st, model)).toUpperCase(); ok(g === exp, name + (g === exp ? '' : ' → ' + g)); };
t('lite', '라이트 정지', s => {}, '02 10 02 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03');
t('lite', '라이트 앞으로 300', s => s.go(300, 300), '02 10 5C 01 01 00 01 2C 01 2C 00 00 00 00 00 00 00 00 00 00 00 03');
t('lite', '라이트 뒤로 300', s => s.go(-300, -300), '02 10 A4 01 01 00 FE D3 FE D3 00 00 00 00 00 00 00 00 00 00 00 03');
t('lite', '라이트 조향 왼 100', s => s.steer(-100), '02 10 9D 01 01 9B 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03');
t('lite', '라이트 조향 오른 100', s => s.steer(100), '02 10 66 01 01 64 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03');
t('lite', '라이트 소리 37', s => s.soundSet(37), '02 10 27 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 25 00 03');
t('lite', '라이트 전조등', s => s.ledSet(1), '02 10 03 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 03');
t('lite', '라이트 점 전부 켬', s => { s.displayMode = 0xFF; s.dot.fill(255); }, '02 10 F9 01 01 00 00 00 00 00 FF FF FF FF FF FF FF FF FF 00 00 03');
t('neo', '올뉴(네오) 정지', s => {}, '02 14 02 01 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 03');
t('classic', '구형 정지', s => {}, '02 1C 34 00 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 0A 00 00 01 00 00 03');
t('classic', '구형 앞으로 300', s => s.go(300, 300), '02 1C 8E 00 0A 00 00 01 2C 00 01 2C 00 00 00 00 00 00 00 00 00 0A 00 00 01 00 00 03');
t('classic', '구형 뒤로 300', s => s.go(-300, -300), '02 1C 8E 00 0A 00 00 81 2C 00 81 2C 00 00 00 00 00 00 00 00 00 0A 00 00 01 00 00 03');
t('classic', '구형 조향 왼 100', s => s.steer(-100), '02 1C 18 00 0A E4 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 0A 00 00 01 00 00 03');
t('classic', '구형 소리 37', s => s.soundSet(37), '02 1C 59 00 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 0A 25 00 01 00 00 03');
t('classic', '구형 전조등', s => s.ledSet(3), '02 1C 37 00 0A 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 0A 00 03 01 00 00 03');
t('classic', '구형 점 전부 켬', s => { s.displayMode = 0xFF; s.dot.fill(255); }, '02 1C 2C 00 0A 00 00 00 00 00 00 00 00 FF FF FF FF FF FF FF FF 0A 00 00 01 00 00 03');
ok(['ALTINO-B7CE', 'ALTINO-L12', 'ALTINO-NBF16', 'RNBT-1'].map(P.modelFromName).join() === 'classic,lite,neo,classic', '이름 규칙: 구형·라이트·네오');
// 구형 56바이트 받기: 체크섬(STX 포함) + 센서 자리
{ const f = new Uint8Array(56); f[0] = 2; f[55] = 3; f[7] = 1; f[8] = 0x2C; f[43] = 0; f[44] = 200; f[47] = 3; f[48] = 0x20;
  let s = 0; for (let i = 0; i < 56; i++) if (i !== 2) s += f[i]; f[2] = s & 0xFF;
  P.setModel('classic'); const a = new P.SensorFrameAssembler(); const out = a.push([0x55, 0x66, ...f, ...f]);
  ok(out.length === 2 && out[0].ir1 === 300 && out[0].cds === 200 && out[1].battery === 800, '구형 56바이트 센서 읽기(앞에 잡음이 있어도)'); P.setModel('neo'); }
console.log(fail ? '실패 ' + fail : '모두 통과'); process.exit(fail ? 1 : 0);
