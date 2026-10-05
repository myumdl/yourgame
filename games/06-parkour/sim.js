// G06 · 编程语言跑酷淘汰赛 (第 2 场) —— 比赛层 (纯 JS, 固定步长, 只在 node 里跑一次)
// 渲染 (Three.js) 与音效/字幕 (build_g06.py) 都只读 sim.json → 画面、声音、口播锚点同源
// 规则: 8 门语言在 8 条道的跑道上冲刺; 跨栏失误会摔一跤; 「内存泄漏」坑掉进去出局; 「git revert」传送带送回上游 45 米;
//       「JIT」加速垫提速; ★淘汰赛: 领先者每过一个检查点 (3 个), 当时跑最后的那个被淘汰 (地板翻开 = 编译失败); 冲线按先后排名
// 视频 G06 用的就是这份逻辑 (node 里跑 seed 459 出片); 纯 JS 算术, 同一个 seed 在任何浏览器里都是同一局

export const LANGS = [
  { name: 'Python', tag: 'Python', color: '#3b82f6' }, { name: 'Java', tag: 'Java', color: '#f97316' },
  { name: 'JavaScript', tag: 'JS', color: '#facc15' }, { name: 'C++', tag: 'C++', color: '#a855f7' },
  { name: 'Go', tag: 'Go', color: '#22d3ee' }, { name: 'Rust', tag: 'Rust', color: '#ef4444' },
  { name: 'PHP', tag: 'PHP', color: '#ec4899' }, { name: 'C', tag: 'C', color: '#e5e7eb' },
];
export const FPS = 60, SUB = 2, LEN = 760, TRACK = 8.5, LANES = [-7, -5, -3, -1, 1, 3, 5, 7], CP = [200, 400, 600];

export function runRace(seed, opt = {}) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const GATE = opt.gate ?? 1.0, TMAX = opt.tmax ?? 60, dt = 1 / FPS / SUB, N = LANGS.length;
  // ── 赛道上的东西 (seed 决定) ──
  const hurdles = []; for (let z = 70; z < LEN - 60; z += 95 + rnd() * 35) hurdles.push({ z: +z.toFixed(1) });
  const holes = []; for (let k = 0; k < 3; k++) { const l = 1 + ((rnd() * 6) | 0); holes.push({ z: +(130 + k * 200 + rnd() * 110).toFixed(1), x: LANES[l], w: 2.6 }); }
  const belts = []; for (let k = 0; k < 2; k++) { const l = ((rnd() * 7) | 0); belts.push({ z: +(240 + k * 260 + rnd() * 100).toFixed(1), x: LANES[l] + 1, w: 3.2, len: 7 }); }
  const pads = []; for (let k = 0; k < 2; k++) { const l = ((rnd() * 8) | 0); pads.push({ z: +(100 + k * 300 + rnd() * 160).toFixed(1), x: LANES[l], w: 1.9, len: 5 }); }
  const order = LANGS.map((_, i) => i); for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const B = LANGS.map((L, i) => {
    const lane = order.indexOf(i);
    return { i, z: 0, x: LANES[lane], y: 0, v: 0, vx: 0, st: 'r', vmax: 25.5 + rnd() * 1.6, acc: 9 + rnd() * 3, skill: 0.72 + rnd() * 0.24,   // skill: 跨栏成功率
      react: 7 + rnd() * 9, seen: new Set(), ph: rnd() * 6.28, tx: LANES[lane], stumble: -9, boost: -9, jumpT: -9, revT: -9, outT: null, finT: null, wave: rnd() * 6.28, wf: 0.25 + rnd() * 0.35 };
  });
  const ev = { gate: GATE, hurdle: [], fall: [], revert: [], boost: [], elim: [], finish: [], pass: [] };
  const frames = []; let t = 0, n = 0, doneAt = null, cpDone = 0;
  const running = () => B.filter(b => b.st === 'r');
  while (t < TMAX) {
    for (let k = 0; k < SUB; k++, n++) {
      t = n * dt;
      for (const b of B) {
        if (b.st !== 'r') { b.ph += dt * 2; continue; }
        if (t < GATE) continue;
        // 目标速度: vmax × 体力波动 (每人不同相位), 加速垫 +8, 摔跤后 0.8s 慢
        let vt = b.vmax * (1 + 0.06 * Math.sin(t * b.wf + b.wave));
        if (t - b.boost < 1.3) vt += 8;
        if (t - b.stumble < 0.9) vt *= 0.3;
        b.v += Math.max(-40, Math.min(b.acc, (vt - b.v) * 3)) * dt;
        // 坑: 前方 react 米内同道有坑 → 尝试换道 (skill 高的早换; 相邻道有坑就再看一道), 换不及就掉
        // 坑 / 传送带: 前方 react 米内同道有障碍 → 第一眼按 skill 决定看没看见 (看见就换道, 没看见就直冲)
        const dodge = (obs, key) => {
          for (const h of obs) {
            const dz = h.z - b.z, id = key + h.z;
            if (dz > 0 && dz < b.react && Math.abs(h.x - b.tx) < h.w / 2 + 0.6 && !b.seen.has(id)) {
              b.seen.add(id);
              if (rnd() < b.skill) { const cands = [b.tx - 2, b.tx + 2].filter(x => Math.abs(x) <= 7 && !obs.some(q => Math.abs(q.z - h.z) < 12 && Math.abs(q.x - x) < q.w / 2 + 0.6)); if (cands.length) b.tx = cands[(rnd() * cands.length) | 0]; }
            }
          }
        };
        dodge(holes, 'h'); dodge(belts, 'b');
        for (const h of holes) { const dz = h.z - b.z; if (dz > -0.3 && dz < 0.3 && Math.abs(h.x - b.x) < h.w / 2 + 0.25 && b.y < 0.3) { b.st = 'f'; b.outT = t; ev.fall.push({ t: +t.toFixed(3), i: b.i, z: h.z, x: h.x }); } }
        // 传送带: 踩上去送回 45 米, 回去后换一条道再跑 (否则会反复踩同一条带)
        for (const bt of belts) if (Math.abs(bt.z - b.z) < bt.len / 2 && Math.abs(bt.x - b.x) < bt.w / 2 && t - b.revT > 3) {
          b.revT = t; b.z = Math.max(5, b.z - 45); b.v *= 0.6; ev.revert.push({ t: +t.toFixed(3), i: b.i, z: bt.z });
          const cands = LANES.filter(x => Math.abs(x - bt.x) > bt.w / 2 + 0.8); b.tx = cands[(rnd() * cands.length) | 0];
        }
        // 加速垫
        for (const p of pads) if (Math.abs(p.z - b.z) < p.len / 2 && Math.abs(p.x - b.x) < p.w / 2 && t - b.boost > 2) { b.boost = t; ev.boost.push({ t: +t.toFixed(3), i: b.i }); }
        // 跨栏: 到栏前 1.2 米起跳 (0.55s 抛物线); 失误 (1-skill) → 摔跤
        for (const h of hurdles) { const dz = h.z - b.z; if (dz > 0 && dz < 1.2 && t - b.jumpT > 1.0) { b.jumpT = t; const ok = rnd() < b.skill; ev.hurdle.push({ t: +t.toFixed(3), i: b.i, ok }); if (!ok) { b.stumble = t + 0.3; } } }
        const jt = t - b.jumpT; b.y = jt >= 0 && jt < 0.55 ? 1.1 * Math.sin(jt / 0.55 * Math.PI) : 0;
        // 横向: 朝目标道平滑
        b.vx += Math.max(-30, Math.min(30, (b.tx - b.x) * 12 - b.vx * 4)) * dt; b.x += b.vx * dt;
        b.z += b.v * dt; b.ph += b.v * dt * 1.35;   // 步频随速度
        if (b.z >= LEN && b.finT === null) { b.finT = t; b.st = 'd'; ev.finish.push({ t: +t.toFixed(3), i: b.i }); }
      }
      // ★ 检查点淘汰: 领先者过 CP[cpDone] 的瞬间, 当时 running 里最后一名出局 (至少留 2 人)
      if (cpDone < CP.length) {
        const run = running().sort((a, b2) => b2.z - a.z);
        if (run.length && run[0].z >= CP[cpDone]) {
          ev.pass.push({ t: +t.toFixed(3), i: run[0].i, cp: cpDone });
          if (run.length > 2) { const last = run[run.length - 1]; last.st = 'e'; last.outT = t; ev.elim.push({ t: +t.toFixed(3), i: last.i, cp: cpDone, z: +last.z.toFixed(1) }); }
          cpDone++;
        }
      }
    }
    frames.push({ r: B.map(b => [+b.z.toFixed(2), +b.x.toFixed(2), +b.y.toFixed(2), +b.v.toFixed(1), b.st, +b.ph.toFixed(2)]) });
    const alive = running().length;
    if (!alive && doneAt === null) doneAt = t;
    if (doneAt !== null && t > doneAt + 2.5) break;
    if (ev.finish.length >= 1 && t > ev.finish[0].t + 6) break;
  }
  const outs = [...ev.fall.map(e => ({ t: e.t, i: e.i })), ...ev.elim.map(e => ({ t: e.t, i: e.i }))].sort((a, b) => a.t - b.t);
  const rank = frames.map((f, fi) => {
    const tt = fi / FPS;
    const done = ev.finish.filter(e => e.t <= tt).map(e => e.i);
    const out = outs.filter(e => e.t <= tt).map(e => e.i).reverse();
    const run = LANGS.map((_, i) => i).filter(i => !done.includes(i) && !out.includes(i)).sort((a, b) => f.r[b][0] - f.r[a][0]);
    return [...done, ...run, ...out];
  });
  return { seed, FPS, GATE, LEN, TRACK, LANES, CP, langs: LANGS, hurdles, holes, belts, pads, frames, rank, ev, T: frames.length / FPS,
    result: { finish: ev.finish.map(e => e.i), out: outs.map(e => e.i), dnf: B.filter(b => b.st === 'r').map(b => b.i) } };
}

// 剧情打分: 领先易主次数 / 冠军逆袭 / 领先者掉坑或被淘汰 / 冲线接近 / 时长适中 / 有人被 revert / Python 走到最后有加分 (上一场它卡在起点, 评论区有人报名 Python)
export function score(r) {
  const R_ = r.rank, F = r.FPS; let changes = 0; for (let i = 1; i < R_.length; i++) if (R_[i][0] !== R_[i - 1][0] && i / F > r.GATE + 1.5) changes++;
  const f = r.ev.finish; if (f.length < 2) return { v: -1e9 };
  const at = (tt) => R_[Math.min(R_.length - 1, Math.floor(tt * F))];
  const win = f[0].i, winMid = at(f[0].t * 0.5).indexOf(win);
  const gap12 = f[1].t - f[0].t;
  const leaderFell = r.ev.fall.filter(e => at(e.t - 0.3)[0] === e.i).length;
  const leaderRev = r.ev.revert.filter(e => at(e.t - 0.3)[0] === e.i).length;
  const py = r.langs.findIndex(L => L.name === 'Python'), pyPos = f.findIndex(e => e.i === py);
  const T1 = f[0].t;
  const v = Math.min(changes, 8) * 1.5 + winMid * 2.5 + leaderFell * 10 + leaderRev * 8 + Math.min(r.ev.revert.length, 3) * 2
    + (r.ev.fall.length >= 1 && r.ev.fall.length <= 2 ? 6 : -6) + (gap12 < 0.3 ? 14 : gap12 < 0.8 ? 7 : 0)
    + (r.ev.hurdle.filter(h => !h.ok).length >= 2 ? 3 : 0) + (pyPos >= 0 && pyPos <= 2 ? 5 : 0) - Math.max(0, Math.abs(T1 - 30) - 4) * 1.5 - r.result.dnf.length * 20;
  return { v: +v.toFixed(1), changes, win: r.langs[win].name, winMid, gap12: +gap12.toFixed(2), T1: +T1.toFixed(1),
    top3: f.slice(0, 3).map(e => r.langs[e.i].name + '@' + e.t.toFixed(1)).join(' '),
    fall: r.ev.fall.map(e => r.langs[e.i].name + '@' + e.t.toFixed(1)), elim: r.ev.elim.map(e => r.langs[e.i].name + '@cp' + (e.cp + 1) + '/' + e.t.toFixed(1)),
    revert: r.ev.revert.map(e => r.langs[e.i].name + '@' + e.t.toFixed(1)), stumble: r.ev.hurdle.filter(h => !h.ok).map(h => r.langs[h.i].name + '@' + h.t.toFixed(1)), py: pyPos, dnf: r.result.dnf.length };
}
