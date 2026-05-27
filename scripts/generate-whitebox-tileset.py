#!/usr/bin/env python3
"""
OpenMole M3: 生成白盒地图 tileset PNG（7 个 32x32 纯色方块横排）

输出：assets/tilesets/whitebox.png
用法：python3 scripts/generate-whitebox-tileset.py

颜色 → 区域映射（必须与 scripts/generate-whitebox-map.js 中的 GID 顺序一致）：
    GID 1: 白色   → 爱心广场（户外左上）
    GID 2: 灰色   → 摩尔城堡（户外右上）
    GID 3: 绿色   → 拉姆农场（户外左下）
    GID 4: 黄色   → 淘淘乐街（户外右下）
    GID 5: 深色   → 墙 (碰撞)
    GID 6: 浅蓝   → 玩家小屋室内（M3 新增）
    GID 7: 棕色   → 门 (可走，触发传送，M3 新增)
"""

from PIL import Image, ImageDraw
import os

TILE = 32
COLORS = [
    (240, 240, 240),  # 1 爱心广场 白
    (170, 170, 175),  # 2 摩尔城堡 灰
    (160, 220, 170),  # 3 拉姆农场 绿
    (240, 224, 144),  # 4 淘淘乐街 黄
    (60, 60, 70),     # 5 墙 深色
    (175, 200, 230),  # 6 玩家小屋 浅蓝（M3）
    (175, 110, 60),   # 7 门 棕（M3）
]
N_TILES = len(COLORS)

img = Image.new("RGB", (TILE * N_TILES, TILE), (0, 0, 0))
draw = ImageDraw.Draw(img)
for i, color in enumerate(COLORS):
    draw.rectangle(
        [i * TILE, 0, (i + 1) * TILE - 1, TILE - 1],
        fill=color,
        outline=(0, 0, 0, 80),  # 1px black border 用以可视化 tile 边界
    )

out_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "tilesets")
out_path = os.path.abspath(os.path.join(out_dir, "whitebox.png"))
os.makedirs(out_dir, exist_ok=True)
img.save(out_path)
print(f"Generated: {out_path}  ({img.size[0]}x{img.size[1]}, {N_TILES} tiles)")
