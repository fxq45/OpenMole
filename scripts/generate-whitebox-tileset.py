#!/usr/bin/env python3
"""
OpenMole M2: 生成白盒地图 tileset PNG（5 个 32x32 纯色方块横排）

输出：assets/tilesets/whitebox.png
用法：python3 scripts/generate-whitebox-tileset.py

颜色 → 区域映射（必须与 scripts/generate-whitebox-map.js 中的 GID 顺序一致）：
    GID 1: 白色 → 爱心广场
    GID 2: 灰色 → 摩尔城堡
    GID 3: 绿色 → 拉姆农场
    GID 4: 黄色 → 淘淘乐街
    GID 5: 深色 → 外围墙 (碰撞)
"""

from PIL import Image, ImageDraw
import os

TILE = 32
N_TILES = 5
COLORS = [
    (240, 240, 240),  # 爱心广场 白
    (170, 170, 175),  # 摩尔城堡 灰
    (160, 220, 170),  # 拉姆农场 绿
    (240, 224, 144),  # 淘淘乐街 黄
    (60, 60, 70),     # 外围墙 深色
]

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
