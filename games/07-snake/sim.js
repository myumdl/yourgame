// G07 · 编程语言贪吃蛇大逃杀 —— 比赛层 (纯 JS, 固定步长, 只在 node 里跑一次; 渲染/音效/字幕都只读 sim.json)
// 规则: 10 条语言蛇在同一片场地里吃豆子变长; 头撞到别人的身体 = 出局 (身体化成豆子); 撞墙 = 出局; 最后活着的赢。
//       场地随时间收缩 (安全区), 逼着相遇。seed 决定出生点/豆子/每条蛇的性格 (贪吃 vs 谨慎 vs 挑衅)。
// 视频 G07 用的就是这份逻辑 (node 里跑 seed 125 出片); 纯 JS 算术, 同一个 seed 在任何浏览器里都是同一局

export const LANGS = [
  { name: 'Python', tag: 'Python', color: '#3b82f6' }, { name: 'Java', tag: 'Java', color: '#f97316' },
  { name: 'JavaScript', tag: 'JS', color: '#facc15' }, { name: 'C++', tag: 'C++', color: '#a855f7' },
  { name: 'Go', tag: 'Go', color: '#22d3ee' }, { name: 'Rust', tag: 'Rust', color: '#ef4444' },
  { name: 'PHP', tag: 'PHP', color: '#ec4899' }, { name: 'C', tag: 'C', color: '#94a3b8' },
  { name: 'TypeScript', tag: 'TS', color: '#60a5fa' }, { name: 'Whitespace', tag: 'Whitespace', color: '#ffffff', ghost: true },   // 评论区点名; 空白语言 = 半透明幽灵蛇
];
export const FPS = 60, SUB = 2, W = 1080, H = 1500, R = 14, SEG = 10;   // 场地 (像素); 蛇头半径; 身体采样间隔 (像素)

export function runRace(seed, opt = {}) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const GATE = opt.gate ?? 1.5, TMAX = opt.tmax ?? 70, dt = 1 / FPS / SUB, N = LANGS.length;
  let t = 0, n = 0, leader = -1, fid = 0;
  const ev = { gate: GATE, out: [], eat: [], lead: [], near: [], shrink: [], fs: [], fe: [] };   // fs: 豆子出现 [id,t,x,y]; fe: 被吃 [id,t,蛇]
  const foods = []; const addFood = (x, y) => { const f = { id: fid++, x: +x.toFixed(1), y: +y.toFixed(1), v: 1 }; foods.push(f); ev.fs.push([f.id, +t.toFixed(3), f.x, f.y]); };
  const spawnFood = (k0) => { for (let k = 0; k < k0; k++) addFood(60 + rnd() * (W - 120), 60 + rnd() * (H - 120)); };
  spawnFood(70);
  const order = LANGS.map((_, i) => i); for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const B = LANGS.map((L, i) => {
    const g = order.indexOf(i); const a = (g / N) * Math.PI * 2; const cx = W / 2 + Math.cos(a) * 380, cy = H / 2 + Math.sin(a) * 520;
    const h0 = a + Math.PI / 2 + (rnd() - 0.5) * 0.6;
    const path0 = Array.from({ length: 8 }, (_, q) => [+(cx - Math.cos(h0) * (q + 1) * SEG).toFixed(1), +(cy - Math.sin(h0) * (q + 1) * SEG).toFixed(1)]);   // 出生就带身体 (首帧=封面要看得见蛇)
    return { i, x: cx, y: cy, h: h0, len: 12, path: path0, path0: path0.slice(), st: 'r', v: 150 + rnd() * 25, turn: 4.2 + rnd() * 1.8, greed: 0.4 + rnd() * 0.6,
      fear: 0.25 + rnd() * 0.45, aggro: 0.2 + rnd() * 0.8, sight: 160 + rnd() * 120, wob: rnd() * 6.28, outT: null, kills: 0, eaten: 0 };
  });
  const frames = [];
  const alive = () => B.filter(b => b.st === 'r');
  const segsOf = (b) => b.path;                       // 身体采样点 (最新在前)
  while (t < TMAX) {
    for (let k = 0; k < SUB; k++, n++) {
      t = n * dt;
      const shrink = Math.min(0.78, Math.max(0, (t - 8) / 54));   // 8s 起安全区收缩, 50s 收到最小
      const late = Math.min(1, Math.max(0, (t - 6) / 34));            // 6→40s: 越来越饿 (恐惧降, 挑衅升)
      const bx0 = 40 + shrink * 330, by0 = 40 + shrink * 480, bx1 = W - bx0, by1 = H - by0;
      for (const b of B) {
        if (b.st !== 'r' || t < GATE) continue;
        // 目标: 最近的豆子 (贪吃) + 避开他人身体 (恐惧) + 挑衅: 往对手头前方插 (aggro)
        let tx = 0, ty = 0, wsum = 0;
        let best = null, bd = 1e9;
        for (const f of foods) { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd && d < b.sight * 2) { bd = d; best = f; } }
        if (best) { const d = Math.max(1, bd); tx += (best.x - b.x) / d * b.greed; ty += (best.y - b.y) / d * b.greed; wsum += b.greed; }
        for (const o of B) {
          if (o.st !== 'r' || o === b) continue;
          for (let q = 0; q < o.path.length; q += 3) { const p = o.path[q]; const d = Math.hypot(p[0] - b.x, p[1] - b.y); if (d < b.sight) { const w = b.fear * (1.3 - 0.9 * late) * (1 - d / b.sight) * 2.2; tx -= (p[0] - b.x) / d * w; ty -= (p[1] - b.y) / d * w; wsum += w; } }
          if (b.aggro * (0.6 + 0.8 * late) > 0.3 && b.len >= o.len) { const ax = o.x + Math.cos(o.h) * 110, ay = o.y + Math.sin(o.h) * 110; const d = Math.hypot(ax - b.x, ay - b.y); if (d < b.sight * 1.8) { const w = b.aggro * 1.4; tx += (ax - b.x) / d * w; ty += (ay - b.y) / d * w; wsum += w; } }
        }
        // 墙/安全区: 离边界近就往中心
        const mx = Math.min(b.x - bx0, bx1 - b.x), my = Math.min(b.y - by0, by1 - b.y); const m = Math.min(mx, my);
        if (m < 240) { const w = (1 - m / 240) * 6.0; const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2; const d = Math.hypot(cx - b.x, cy - b.y) || 1; tx += (cx - b.x) / d * w; ty += (cy - b.y) / d * w; wsum += w; }
        let want = wsum > 0 ? Math.atan2(ty, tx) : b.h + Math.sin(t * 0.7 + b.wob) * 0.4;
        let dh = Math.atan2(Math.sin(want - b.h), Math.cos(want - b.h)); dh = Math.max(-b.turn * dt, Math.min(b.turn * dt, dh)); b.h += dh;
        const vv = b.v * (1 + 0.25 * late); b.x += Math.cos(b.h) * vv * dt; b.y += Math.sin(b.h) * vv * dt;
        // 身体采样
        const last = b.path[0]; if (!last || Math.hypot(last[0] - b.x, last[1] - b.y) >= SEG) { b.path.unshift([+b.x.toFixed(1), +b.y.toFixed(1)]); const maxN = Math.max(2, Math.round(b.len * 20 / SEG)); if (b.path.length > maxN) b.path.length = maxN; }
        // 吃豆
        for (let q = foods.length - 1; q >= 0; q--) { const f = foods[q]; if (Math.hypot(f.x - b.x, f.y - b.y) < R + 8) { b.len += f.v * 2; b.eaten++; foods.splice(q, 1); ev.eat.push({ t: +t.toFixed(3), i: b.i }); ev.fe.push([f.id, +t.toFixed(3), b.i]); } }
        // 撞墙 / 安全区
        if (b.x < bx0 || b.x > bx1 || b.y < by0 || b.y > by1) { b.st = 'o'; b.outT = t; ev.out.push({ t: +t.toFixed(3), i: b.i, by: -1, cause: 'wall', x: +b.x.toFixed(1), y: +b.y.toFixed(1) }); }
      }
      // 撞身体判定 (头 vs 他人身体, 跳过对方最前 2 个点)
      for (const b of B) {
        if (b.st !== 'r' || t < GATE) continue;
        for (const o of B) {
          if (o.st !== 'r' || o === b) continue;
          const pts = segsOf(o);
          for (let q = 2; q < pts.length; q++) { const p = pts[q]; if (Math.hypot(p[0] - b.x, p[1] - b.y) < R * 1.6) { b.st = 'o'; b.outT = t; o.kills++; ev.out.push({ t: +t.toFixed(3), i: b.i, by: o.i, cause: 'body', x: +b.x.toFixed(1), y: +b.y.toFixed(1) }); break; } }
          if (b.st !== 'r') break;
        }
        if (b.st !== 'r') { for (let q = 0; q < b.path.length; q += 2) addFood(b.path[q][0], b.path[q][1]); }
      }
      if (foods.length < 40 && n % (FPS * SUB) === 0) spawnFood(8);
      // 近身 (擦边 < 2R*2 但没撞): 记一次 (剧情用)
    }
    const al = alive(); const lead = al.length ? al.reduce((a, b) => (b.len > a.len ? b : a)).i : leader;
    if (lead !== leader && t > GATE + 1) { ev.lead.push({ t: +t.toFixed(3), i: lead }); leader = lead; }
    frames.push({ s: B.map(b => [+b.x.toFixed(1), +b.y.toFixed(1), +b.h.toFixed(3), b.len, b.st === 'r' ? 1 : 0, b.path.length]), f: foods.length });
    if (al.length <= 1 && t > GATE) { const w = al[0]; if (w) ev.out.push({ t: +t.toFixed(3), i: w.i, by: -1, cause: 'win' }); break; }
  }
  // 身体轨迹: 渲染端需要每帧身体; 为省体积, 存每条蛇"采样点历史"一次 (按时间增量), 渲染端按帧 path 长度回放
  const trails = B.map(b => []);   // 渲染侧重建: 每帧 path = 该蛇历史采样点里最新的 path_len 个 → 需要全历史点, 单独记
  return { seed, FPS, W, H, R, SEG, GATE, langs: LANGS, frames, ev, path0: B.map(b => b.path0), result: { order: ev.out.map(e => e.i).reverse(), kills: B.map(b => b.kills), eaten: B.map(b => b.eaten) }, T: frames.length / FPS, _B: B.map(b => ({ i: b.i, len: b.len })) };
}

export function score(r) {
  const outs = r.ev.out.filter(e => e.cause !== 'win'); if (outs.length < r.langs.length - 1) return { v: -1e9, note: 'no winner' };
  const win = r.ev.out.find(e => e.cause === 'win'); const T1 = win ? win.t : r.T;
  const byKill = outs.filter(e => e.cause === 'body').length, byWall = outs.filter(e => e.cause === 'wall').length;
  const leadChanges = r.ev.lead.length;
  const py = r.langs.findIndex(L => L.name === 'Python'); const pyPos = r.result.order.indexOf(py);
  const gaps = outs.map((e, k) => (k ? e.t - outs[k - 1].t : e.t)); const evenly = Math.min(...gaps.slice(1)) > 1.2 ? 6 : -6;   // 淘汰别扎堆
  const lastDuel = outs.length >= 2 ? outs[outs.length - 1].t - outs[outs.length - 2].t : 0;
  const v = byKill * 3 - byWall * 2.5 + Math.min(leadChanges, 8) * 1.5 + evenly + (lastDuel > 3 ? 8 : 0) + (pyPos >= 0 && pyPos <= 2 ? 3 : 0) - Math.max(0, Math.abs(T1 - 32) - 5) * 1.5;
  return { v: +v.toFixed(1), T1: +T1.toFixed(1), byKill, byWall, leadChanges, lastDuel: +lastDuel.toFixed(1), win: win ? r.langs[win.i].name : '-',
    order: r.result.order.map(i => r.langs[i].tag).join('>'), outs: outs.map(e => r.langs[e.i].tag + '@' + e.t.toFixed(1) + (e.cause === 'body' ? '←' + r.langs[e.by].tag : '|墙')).join(' ') };
}
