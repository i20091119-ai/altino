"""⑤ AI 주행용 MobileNet(v1 0.25, 224) 가중치를 앱 안에 넣는 파일로 만든다.
태블릿은 캠프장에서 인터넷이 없을 수 있고, WebView 의 file:// 에서는 fetch 로 모델 파일을 못 읽는다.
그래서 모델 구조(JSON)와 가중치(base64)를 자바스크립트 파일 하나(webapp/js/ai/mobilenet_data.js)에 담는다.
분류 머리(conv_preds 이후)는 쓰지 않으므로 잘라 낸다 — 남는 출력은 256차원 특징(global_average_pooling2d_1).

  사용: python3 tools/make_mobilenet.py <model.json 과 shard 들이 있는 폴더>
  원본: https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json (Apache-2.0)
"""
import base64, json, os, sys
src = sys.argv[1]
m = json.load(open(os.path.join(src, 'model.json')))
topo = m['modelTopology']
cfg = topo['model_config']['config'] if 'model_config' in topo else topo['config']
names = [l['name'] for l in cfg['layers']]
cut = names.index('global_average_pooling2d_1') + 1
dropped = set(names[cut:])
cfg['layers'] = cfg['layers'][:cut]
cfg['output_layers'] = [['global_average_pooling2d_1', 0, 0]]
specs, blob = [], bytearray()
for g in m['weightsManifest']:
    data = b''.join(open(os.path.join(src, p), 'rb').read() for p in g['paths'])
    off = 0
    for w in g['weights']:
        n = 4
        for d in w['shape']: n *= d
        chunk = data[off:off + n]; off += n
        if w['name'].split('/')[0] in dropped: continue
        specs.append(w); blob += chunk
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'webapp', 'js', 'ai', 'mobilenet_data.js')
with open(out, 'w') as f:
    f.write('// MobileNet v1 0.25 224 (Apache-2.0, tfjs-models) — tools/make_mobilenet.py 가 만든 파일. 손으로 고치지 않는다.\n')
    f.write('window.CAMP_MOBILENET=' + json.dumps({'topology': topo, 'specs': specs, 'b64': base64.b64encode(bytes(blob)).decode()}, separators=(',', ':')) + ';\n')
print('layers', cut, 'weights', len(specs), 'bytes', len(blob), '->', os.path.getsize(out))
