# yourgame · 用代码写游戏, 视频里一步步长出来

每条视频对应一款**能玩的**单文件 3D 小游戏: 一个 HTML 文件, 打开就能玩, 只依赖仓库里自带的 Three.js, 不用装任何东西。

视频里演示的就是这里的代码 (视频版为了逐帧渲染做了确定性改写: 固定随机种子 + 自动玩家, 玩法逻辑一致)。

## 游戏

| # | 游戏 | 玩 | 操作 | 对应视频 | 行数 |
|---|------|----|------|---------|------|
| 01 | 3D 跑酷 | [games/01-runner](games/01-runner/index.html) | ← → 变道 · 空格 起跳 | G01「120 行代码写一个 3D 跑酷」 | ~120 |
| 02 | 3D 俄罗斯方块 | [games/02-tetris](games/02-tetris/index.html) | ← → 移动 · ↑ 旋转 · ↓ 加速 · 空格 直落 | G02「200 行代码写一个 3D 俄罗斯方块」 | ~200 |

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
│   └── 02-tetris/        3D 俄罗斯方块 (单文件)
└── vendor/               Three.js r181 本地副本 (+ 用到的 addons), 零外网依赖
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

## 换皮肤

颜色都在文件顶部: 跑酷改 `player` / `obsMat` 的颜色, 俄罗斯方块改 `SHAPES[k].col` 那一行。

## 许可

MIT · Three.js 版权归 three.js authors (MIT)。
