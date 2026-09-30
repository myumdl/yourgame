# yourgame · 用代码写游戏, 视频里一步步长出来

每条视频对应一款**能玩的**单文件 3D 小游戏: 一个 HTML 文件, 打开就能玩, 只依赖仓库里自带的 Three.js, 不用装任何东西。

视频里演示的就是这里的代码 (视频版为了逐帧渲染做了确定性改写: 固定随机种子 + 自动玩家, 玩法逻辑一致)。

## 游戏

| # | 游戏 | 玩 | 操作 | 对应视频 | 行数 |
|---|------|----|------|---------|------|
| 01 | 3D 跑酷 | [games/01-runner](games/01-runner/index.html) | ← → 变道 · 空格 起跳 | G01「120 行代码写一个 3D 跑酷」 | ~120 |
| 02 | 3D 俄罗斯方块 | [games/02-tetris](games/02-tetris/index.html) | ← → 移动 · ↑ 旋转 · ↓ 加速 · 空格 直落 | G02「200 行代码写一个 3D 俄罗斯方块」 | ~200 |
| 03 | 3D 打砖块 | [games/03-breakout](games/03-breakout/index.html) | ← → 或 鼠标 移动挡板 · 空格 开始 | G03「150 行代码写一个 3D 打砖块」 | ~150 |
| 04 | 编程语言弹珠赛 | [games/04-marble-race](games/04-marble-race/index.html) | 点一门语言下注 · 开赛 / 回放视频那一局 | G04「8 门编程语言弹珠赛」 | ~160 |
| 05 | AI 大模型暴力摩托 | [games/05-ai-moto](games/05-ai-moto/index.html) | 点一个模型下注 · 开赛 / 回放视频那一局 | G05「8 个 AI 大模型暴力摩托」 | ~260 (画面 118 + 比赛 sim.js 148) |

在线试玩 (GitHub Pages): https://myumdl.github.io/yourgame/

## 本地运行

浏览器直接打开 `index.html` 会被 ES module 的跨域规则挡住, 起一个静态服务即可:

```bash
git clone https://github.com/myumdl/yourgame.git
cd yourgame
python3 -m http.server 8080      # 或 npx serve
# 打开 http://localhost:8080/
```

## 结构

```
yourgame/
├── index.html            游戏大厅
├── games/
│   ├── 01-runner/        3D 跑酷 (单文件)
│   ├── 02-tetris/        3D 俄罗斯方块 (单文件)
│   ├── 03-breakout/      3D 打砖块 (单文件)
│   ├── 04-marble-race/   编程语言弹珠赛 (单文件 + replay-g04.json 视频那一局的轨迹)
│   └── 05-ai-moto/       AI 大模型暴力摩托 (index.html 画面 + sim.js 比赛逻辑; 纯 JS 算术, seed 44 在任何浏览器都是视频那一局)
└── vendor/               Three.js r181 + matter-js 0.20 本地副本 (+ 用到的 addons), 零外网依赖
```

## 每款游戏的骨架 (视频里的"九步")

1. 舞台: 场景 / 相机 / 灯
2. 场地: 跑道 或 井
3. 主角: 一个方块
4. 动起来: 每一帧推进
5. 输入: 跳 / 旋转 / 移动
6. 规则: 障碍 / 满行
7. 判定: 碰撞 / 消行
8. 计分
9. 难度: 越玩越快

一定要先把碰撞检测写对, 再做旋转和加速。

## 弹珠赛说明 (04)

- 物理用 matter-js (2D), 画面用 Three.js (3D 外观)。赛道关卡: `while(true)` 死循环转盘 / **内存泄漏** 坑 (掉进去出局) / **git revert** 坑 (掉进去回到上游) / 依赖地狱漏斗; 两个坑的翻板按周期开合, 掉不掉看时机。
- 每局随机。物理是固定步长, **同一个浏览器里**同一个 seed 结果相同 (控制台 `__race(123)` 连跑两次一致); 但不同 JS 引擎的浮点运算有细微差别, 弹珠赛又是混沌系统, 十几秒后就会分叉 —— 所以视频那一局 (离线在 Node 里跑的 seed 14) 不靠重算, 而是把真实轨迹存成 `replay-g04.json`, 点「回放视频那一局」按轨迹播放。
- 换选手: 改文件顶部 `LANGS` (名字 + 颜色); 改赛道: `course()` 里每一行是一段坡 / 一个坑。

## 换皮肤

颜色都在文件顶部: 跑酷改 `player` / `obsMat` 的颜色, 俄罗斯方块改 `SHAPES[k].col` 那一行, 打砖块改 `COLORS` 那一行 (六排砖六种颜色)。

## 许可

MIT · Three.js 版权归 three.js authors (MIT) · matter-js 版权归 Liam Brummitt (MIT)。
