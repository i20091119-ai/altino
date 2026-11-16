// ⑤ AI 주행 — 손짓 배우기(티처블머신과 같은 방식: MobileNet 특징 + 가까운 이웃 찾기). 전부 태블릿 안에서 돈다(인터넷 불필요).
//   CampAI.load()            모델 준비(첫 실행 2~5초)
//   CampAI.add(cls, video)   지금 화면을 cls 의 본보기로 추가
//   CampAI.predict(video)    → { cls, conf } (본보기가 없으면 null)
//   CampAI.count(cls) / clear(cls) / dump() / restore(obj)
'use strict';
window.CampAI = (function () {
  const K = 5, MAX_PER_CLASS = 40;
  let model = null;
  const ex = {};                                    // cls → [Float32Array(정규화된 256차원)]

  async function load() {
    if (model) return;
    if (!window.tf || !window.CAMP_MOBILENET) throw new Error('AI 파일이 없어요');
    await tf.ready();
    const d = window.CAMP_MOBILENET, bin = atob(d.b64), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    model = await tf.loadLayersModel(tf.io.fromMemory({ modelTopology: d.topology, weightSpecs: d.specs, weightData: buf.buffer }));
    tf.tidy(() => model.predict(tf.zeros([1, 224, 224, 3])).dataSync());   // 첫 추론이 느리므로 미리 한 번
  }
  function embed(video) {
    if (!model || !video.videoWidth) return null;
    const v = tf.tidy(() => {
      let img = tf.browser.fromPixels(video);
      const h = img.shape[0], w = img.shape[1], s = Math.min(h, w);
      img = img.slice([(h - s) >> 1, (w - s) >> 1, 0], [s, s, 3]);
      img = tf.image.resizeBilinear(img, [224, 224]);
      return model.predict(img.toFloat().div(127.5).sub(1).expandDims(0)).dataSync().slice();
    });
    let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i];
    n = Math.sqrt(n) || 1; for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
  }
  function add(cls, video) {
    const v = embed(video); if (!v) return 0;
    const a = ex[cls] || (ex[cls] = []);
    if (a.length >= MAX_PER_CLASS) a.shift();
    a.push(v); return a.length;
  }
  function predict(video) {
    const classes = Object.keys(ex).filter(c => ex[c].length);
    if (!classes.length) return null;
    const v = embed(video); if (!v) return null;
    const sims = [];
    for (const c of classes) for (const e of ex[c]) { let d = 0; for (let i = 0; i < v.length; i++) d += v[i] * e[i]; sims.push([d, c]); }
    sims.sort((a, b) => b[0] - a[0]);
    const k = Math.min(K, sims.length), votes = {};
    for (let i = 0; i < k; i++) votes[sims[i][1]] = (votes[sims[i][1]] || 0) + 1;
    let best = null; for (const c in votes) if (!best || votes[c] > votes[best]) best = c;
    return { cls: best, conf: votes[best] / k, sim: sims[0][0] };
  }
  const count = (cls) => (ex[cls] ? ex[cls].length : 0);
  const clear = (cls) => { if (cls) delete ex[cls]; else for (const c in ex) delete ex[c]; };
  const dump = () => { const o = {}; for (const c in ex) o[c] = ex[c].map(v => Array.from(v, x => Math.round(x * 1000) / 1000)); return o; };
  const restore = (o) => { clear(); for (const c in (o || {})) ex[c] = o[c].map(a => Float32Array.from(a)); };
  return { load, add, predict, count, clear, dump, restore, get ready() { return !!model; } };
})();
