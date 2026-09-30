// G05 · AI 模型暴力摩托 —— 比赛层 (纯 JS, 固定步长, 只在 node 里跑一次)
// 渲染 (Three.js) 与音效/字幕 (build_g05.py) 都只读 sim.json → 画面、声音、口播锚点同源
// 规则: 8 辆摩托跑一条直路; 并排时会出腿/抡棍, 挨打扣血, 血 0 摔车出局;
//       卡车「服务器繁忙」/ 油渍「幻觉」/ 警车「内容审核」 都能让人出局; 冲过终点按先后排名
// 视频 G05 用的就是这份逻辑 (node 里跑 seed 44 出片); 纯 JS 算术, 同一个 seed 在任何浏览器里都是同一局

export const RIDERS = [
  { name: 'GPT', tag: 'GPT', color: '#10b981' }, { name: 'Claude', tag: 'Claude', color: '#f97316' },
  { name: 'Gemini', tag: 'Gemini', color: '#3b82f6' }, { name: 'DeepSeek', tag: 'DeepSeek', color: '#22d3ee' },
  { name: '豆包', tag: '豆包', color: '#ec4899' }, { name: 'Kimi', tag: 'Kimi', color: '#e5e7eb' },
  { name: '通义千问', tag: '千问', color: '#a855f7' }, { name: '智谱GLM', tag: '智谱', color: '#facc15' },
];
export const FPS = 60, SUB = 2, LEN = 1150, ROAD = 8, HP = 4;   // 米; 路面 x ∈ [-ROAD, ROAD]

export function runRace(seed, opt = {}) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const GATE = opt.gate ?? 1.0, TMAX = opt.tmax ?? 50, dt = 1 / FPS / SUB, N = RIDERS.length;
  const LANES = [-6, -2, 2, 6];
  // ── 路上的东西 (seed 决定位置) ──
  const trucks = [], cars = [], oils = [];
  for (let k = 0; k < 3; k++) trucks.push({ z: 190 + k * 300 + rnd() * 80, x: LANES[(rnd() * 4) | 0], v: 20 + rnd() * 4, len: 12, w: 1.3 });
  for (let k = 0; k < 4; k++) cars.push({ z: 120 + k * 230 + rnd() * 90, x: LANES[(rnd() * 4) | 0], v: 24 + rnd() * 5, len: 4.6, w: 1.05 });
  for (let k = 0; k < 3; k++) oils.push({ z: 280 + k * 280 + rnd() * 80, x: -6 + rnd() * 12, r: 1.9 });
  const traffic = [...trucks.map(o => ({ ...o, kind: 'truck' })), ...cars.map(o => ({ ...o, kind: 'car' }))];
  const police = { z: -60, x: 0, v: 0, on: false, tgt: -1, t0: 0, along: 0, done: false, stopAt: null };
  const POLICE_T = 11 + rnd() * 5;                                  // 警车出动时刻
  // ── 发车格: 2 排 × 4, 位置由 seed 打乱 ──
  const order = RIDERS.map((_, i) => i); for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const B = RIDERS.map((R, i) => {
    const g = order.indexOf(i);
    return { i, z: g < 4 ? 0 : -5, x: LANES[g % 4] + (g < 4 ? -1 : 1), v: 0, vx: 0, hp: HP, st: 'r', vmax: 46 + rnd() * 1.2, noise: 0, tx: LANES[g % 4],
      cd: 0, atk: null, wob: -9, react: 25, reT: 0, skid: -9, lean: 0, finT: null, crashT: null, spin: 0, aggro: 0.25 + rnd() * 0.5, stopT: null };
  });
  const ev = { gate: GATE, attacks: [], crash: [], oil: [], finish: [], police: [], near: [] };
  const frames = []; let t = 0, n = 0, doneAt = null;
  const free = (b, x) => {                                          // 这个 x 前方 react 米内有没有障碍 (返回最近距离)
    let d = 1e9;
    for (const o of traffic) { const dz = o.z - o.len / 2 - b.z; if (dz > -o.len && dz < b.react && Math.abs(o.x - x) < o.w + 1.2) d = Math.min(d, dz); }
    return d;
  };
  while (t < TMAX) {
    for (let k = 0; k < SUB; k++, n++) {
      t = n * dt;
      for (const o of traffic) o.z += o.v * dt;
      // 警车: 从后方追上来, 盯住当时中游的一辆, 并排 1.2s 拦下
      if (!police.on && !police.done && t > POLICE_T) {
        const run = B.filter(b => b.st === 'r').sort((a, b) => b.z - a.z);
        if (run.length >= 4) { const pick = run[1 + ((rnd() * Math.min(4, run.length - 1)) | 0)]; police.on = true; police.tgt = pick.i; police.z = pick.z - 70; police.x = pick.x; police.v = pick.v + 14; police.t0 = t; ev.police.push({ t: +t.toFixed(3), i: pick.i, kind: 'chase' }); }
      }
      if (police.on) {
        const b = B[police.tgt];
        if (b.st !== 'r') { police.on = false; police.done = true; }
        else {
          const side = b.x > 0 ? -2.4 : 2.4; const want = b.z - 0.5;
          police.v += Math.max(-25, Math.min(25, (want - police.z) * 3 + (b.v - police.v) * 2)) * dt; police.z += police.v * dt;
          police.x += Math.max(-8, Math.min(8, (b.x + side - police.x) * 3)) * dt;
          if (Math.abs(police.z - want) < 3 && Math.abs(police.x - b.x) < 3.4) police.along += dt; else police.along = Math.max(0, police.along - dt * 0.5);
          if (police.along > 1.2) { b.st = 'p'; b.stopT = t; police.on = false; police.done = true; police.stopAt = t; ev.police.push({ t: +t.toFixed(3), i: b.i, kind: 'stop' }); ev.crash.push({ t: +t.toFixed(3), i: b.i, cause: 'police' }); }
        }
      } else if (police.done && police.stopAt !== null) { police.v = Math.max(0, police.v - 30 * dt); police.z += police.v * dt; }
      for (const b of B) {
        if (b.st === 'c') { b.v = Math.max(0, b.v - 16 * dt); b.z += b.v * dt; b.x += b.vx * dt; b.vx *= 1 - 2 * dt; b.x = Math.max(-ROAD - 2, Math.min(ROAD + 2, b.x)); b.spin += b.v * dt * 0.6; continue; }
        if (b.st === 'p') { b.v = Math.max(0, b.v - 22 * dt); b.z += b.v * dt; continue; }
        if (b.st === 'd') { b.v = Math.max(18, b.v - 8 * dt); b.z += b.v * dt; continue; }
        if (t < GATE) continue;
        // 油门: 目标速度 = 个体上限 + 慢变噪声 + 尾流 (跟在别人后面 4~14m 且同一条线 → 更快, 让车群咬住)
        if (n % 24 === 0) b.noise = Math.max(-3.5, Math.min(3.5, b.noise + (rnd() - 0.5) * 2.4));
        let draft = 0; for (const o of B) if (o !== b && o.st === 'r') { const dz = o.z - b.z; if (dz > 4 && dz < 14 && Math.abs(o.x - b.x) < 1.6) draft = 2.6; }
        const hurt = (HP - b.hp) * 0.6, wob = t - b.wob < 0.5 ? 5 : 0, sk = t - b.skid < 0.8 ? 8 : 0;
        const vt = b.vmax + b.noise + draft - hurt - wob - sk;
        b.v += Math.max(-14, Math.min(t - GATE < 3 ? 16 : 7, (vt - b.v) * 1.5)) * dt; b.z += b.v * dt;
        // 转向: 前方有障碍 → 换到最空的一条道; 否则偶尔换道 / 有攻击欲时贴向身边对手
        if (t >= b.reT) { b.reT = t + 1.2 + rnd() * 1.6; b.react = 8 + rnd() * 42;
          if (rnd() < 0.35) b.tx = LANES[(rnd() * 4) | 0];
          if (rnd() < b.aggro) { let best = null, bd = 9; for (const o of B) if (o !== b && o.st === 'r') { const dz = Math.abs(o.z - b.z); if (dz < bd) { bd = dz; best = o; } } if (best) b.tx = best.x + (best.x > b.x ? -1.7 : 1.7); }
        }
        if (t - b.wob > 0.45 && t - b.skid > 0.6 && free(b, b.x) < b.react) {   // 刚挨打 / 打滑时顾不上看路
        let bx = b.tx, bdist = -1; for (const L of LANES) { const d = Math.min(free(b, L), 999) - Math.abs(L - b.x) * 0.8; if (d > bdist) { bdist = d; bx = L; } } b.tx = bx; }
        b.vx += Math.max(-30, Math.min(30, ((b.tx - b.x) * 2.2 - b.vx) * 4)) * dt; b.vx = Math.max(-7, Math.min(7, b.vx)); b.x += b.vx * dt;
        if (Math.abs(b.x) > ROAD - 0.6) { b.x = Math.sign(b.x) * (ROAD - 0.6); b.vx *= -0.3; }
        b.lean = -b.vx / 9;
        // 撞车 (卡车 / 轿车) = 出局
        for (const o of traffic) if (Math.abs(o.z - b.z) < o.len / 2 + 1 && Math.abs(o.x - b.x) < o.w + 0.35) {
          b.st = 'c'; b.crashT = t; b.vx = (b.x > o.x ? 1 : -1) * 6; b.v = Math.min(b.v, o.v + 4); ev.crash.push({ t: +t.toFixed(3), i: b.i, cause: o.kind }); break;
        }
        if (b.st !== 'r') continue;
        // 油渍 = 打滑: 扣 1 血; 速度高 + 运气差 → 直接摔
        for (const o of oils) if (!o['h' + b.i] && Math.sqrt((o.x - b.x) ** 2 + ((o.z - b.z) * 0.6) ** 2) < o.r) {
          o['h' + b.i] = 1; b.skid = t; b.hp--; b.vx += (rnd() - 0.5) * 12; ev.oil.push({ t: +t.toFixed(3), i: b.i });
          if (b.hp <= 0 || (b.v > 45 && rnd() < 0.12)) { b.st = 'c'; b.crashT = t; b.hp = 0; ev.crash.push({ t: +t.toFixed(3), i: b.i, cause: 'oil' }); }
        }
        if (b.st !== 'r') continue;
        // 出手: 并排时有概率出腿 / 抡棍, 0.25s 后结算
        if (b.atk && t - b.atk.t0 >= 0.25 && !b.atk.done) {
          b.atk.done = true; const v = B[b.atk.j]; const ok = v.st === 'r' && Math.abs(v.z - b.z) < 2.8 && Math.abs(v.x - b.x) < 3.0 && rnd() < 0.55;
          ev.attacks.push({ t: +b.atk.t0.toFixed(3), hit: +t.toFixed(3), a: b.i, b: v.i, type: b.atk.type, side: b.atk.side, ok });
          if (ok) { v.hp--; v.wob = t; v.vx += b.atk.side * 5; v.v -= 5;
            if (v.hp <= 0) { v.st = 'c'; v.crashT = t; v.vx = b.atk.side * 7; ev.crash.push({ t: +t.toFixed(3), i: v.i, cause: b.atk.type, by: b.i }); } }
        }
        if (b.atk && t - b.atk.t0 > 0.55) b.atk = null;
        b.cd -= dt;
        if (!b.atk && b.cd <= 0 && t > GATE + 3.5) for (const o of B) if (o !== b && o.st === 'r' && Math.abs(o.z - b.z) < 2.2 && Math.abs(o.x - b.x) < 2.6 && Math.abs(o.x - b.x) > 0.8) {
          if (rnd() < 0.05 * (0.5 + b.aggro)) { b.atk = { t0: t, j: o.i, type: rnd() < 0.55 ? 'kick' : 'club', side: Math.sign(o.x - b.x) }; b.cd = 1.1 + rnd() * 0.8; }
          break;
        }
      }
      // 车与车太近 → 横向推开 (不穿模)
      for (const a of B) for (const c of B) if (a.i < c.i && a.st === 'r' && c.st === 'r' && Math.abs(a.z - c.z) < 2.0 && Math.abs(a.x - c.x) < 0.9) { const d = (a.x < c.x ? -1 : 1) * 0.02; a.x += d; c.x -= d; }
      for (const b of B) if (b.st === 'r' && b.z >= LEN) { b.st = 'd'; b.finT = t; ev.finish.push({ t: +t.toFixed(3), i: b.i }); }
    }
    frames.push({
      b: B.map(b => [+b.z.toFixed(2), +b.x.toFixed(2), +b.v.toFixed(1), +b.lean.toFixed(3), b.st, b.hp, b.atk ? (b.atk.type === 'kick' ? 1 : 2) : 0, b.atk ? +Math.min(1, (t - b.atk.t0) / 0.55).toFixed(2) : 0, b.atk ? b.atk.side : 0, +b.spin.toFixed(2)]),
      tr: traffic.map(o => [+o.z.toFixed(2), o.x]), po: [+police.z.toFixed(2), +police.x.toFixed(2), police.on ? 1 : police.done ? 2 : 0],
    });
    const alive = B.filter(b => b.st === 'r').length;
    if (!alive && doneAt === null) doneAt = t;
    if (doneAt !== null && t > doneAt + 2.5) break;
  }
  const outT = {}; for (const c of ev.crash) outT[c.i] = c.t;
  const rank = frames.map((f, fi) => {
    const tt = fi / FPS; const done = ev.finish.filter(e => e.t <= tt).map(e => e.i);
    const out = ev.crash.filter(e => e.t <= tt).map(e => e.i).reverse();
    const run = RIDERS.map((_, i) => i).filter(i => !done.includes(i) && !out.includes(i)).sort((a, b) => f.b[b][0] - f.b[a][0]);
    return [...done, ...run, ...out];
  });
  return { seed, FPS, LEN, ROAD, HP, GATE, riders: RIDERS, trucks, cars, oils, traffic: traffic.map(o => ({ kind: o.kind, len: o.len, w: o.w })), frames, rank, ev,
    result: { finish: ev.finish.map(e => e.i), out: ev.crash.map(e => e.i), dnf: B.filter(b => b.st === 'r').map(b => b.i) }, T: frames.length / FPS };
}

// 剧情打分: 领先易主 / 出局 3~5 个 (死法多样) / 领先者出事 / 警车拦的是前三 / 冲线接近 / 最后阶段前两名互殴
export function score(r) {
  const R_ = r.rank, F = r.FPS, f = r.ev.finish; if (f.length < 2) return { v: -1e9 };
  let changes = 0; for (let i = 1; i < R_.length; i++) if (R_[i][0] !== R_[i - 1][0] && i / F > r.GATE + 3) changes++;
  const at = (tt) => R_[Math.min(R_.length - 1, Math.max(0, Math.floor(tt * F)))];
  const win = f[0].i, second = f[1].i, T1 = f[0].t, gap12 = f[1].t - f[0].t;
  const outs = r.ev.crash.length, causes = new Set(r.ev.crash.map(c => c.cause)).size;
  const leaderOut = r.ev.crash.filter(c => at(c.t - 0.3)[0] === c.i).length;
  const duel = r.ev.attacks.filter(a => a.t > T1 - 7 && a.t < T1 && [win, second].includes(a.a) && [win, second].includes(a.b)).length;
  const duelHit = r.ev.attacks.filter(a => a.ok && a.t > T1 - 7 && a.t < T1 && [win, second].includes(a.a) && [win, second].includes(a.b)).length;
  const policeTop = r.ev.police.filter(p => p.kind === 'stop' && at(p.t - 1.5).indexOf(p.i) <= 2).length;
  const winMid = at(T1 * 0.55).indexOf(win), hits = r.ev.attacks.filter(a => a.ok).length, winHp = r.frames[Math.floor(T1 * F)].b[win][5];
  const v = Math.min(changes, 10) * 1.2 + winMid * 2.5 + leaderOut * 7 + (outs >= 3 && outs <= 5 ? 8 : outs === 2 ? 0 : -10) + causes * 3
    + Math.min(duel, 3) * 4 + duelHit * 3 + policeTop * 6 + (r.ev.police.some(p => p.kind === 'stop') ? 5 : -5)
    + (gap12 < 0.3 ? 14 : gap12 < 0.8 ? 8 : gap12 < 1.5 ? 2 : -4) + (winHp === 1 ? 6 : 0) + Math.min(hits, 12) * 0.5
    - Math.max(0, Math.abs(T1 - 27) - 3) * 1.5 - r.result.dnf.length * 20;
  return { v: +v.toFixed(1), changes, win: r.riders[win].name, second: r.riders[second].name, winMid, winHp, T1: +T1.toFixed(2), gap12: +gap12.toFixed(2),
    outs: r.ev.crash.map(c => r.riders[c.i].name + ':' + c.cause), leaderOut, duel, duelHit, hits, police: r.ev.police.map(p => p.kind + ':' + r.riders[p.i].name).join(' ') };
}
