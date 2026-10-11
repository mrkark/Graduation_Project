import sys, json, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kata_defs2 import KATA, build_kata

out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../client/public/kata_data'))
os.makedirs(out_dir, exist_ok=True)

print(f"Exporting 26 kata metadata JSON to: {out_dir}")

for name, meta in KATA.items():
    moves = meta['fn']()
    seq, ev = build_kata(name, moves, start_stance=meta['start'])
    data = {
        'kata': name,
        'confidence': meta['conf'],
        'duration': round(seq.t, 2),
        'movesCount': len(moves),
        'events': [
            {
                'moveNumber': e[0],
                'technique': e[1],
                'form': e[2],
                'startTime': round(e[3], 2),
                'endTime': round(e[4], 2),
                'kiai': bool(e[5])
            }
            for e in ev
        ],
        'kiaiMoves': [e[0] for e in ev if e[5]],
    }
    target_path = os.path.join(out_dir, f"{name}.json")
    with open(target_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    dur = data['duration']
    mc = data['movesCount']
    print(f"✔ Exported {name}.json (duration: {dur}s, moves: {mc})")

print("All 26 kata JSON files exported successfully!")
