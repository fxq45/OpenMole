#!/usr/bin/env node
// OpenMole M2: 生成白盒地图资源（Tiled JSON + 实体 JSON）
// 输出：
//   assets/maps/minimap_server.json (覆盖)
//   assets/maps/minimap_client.json (覆盖)
//   assets/tilesets/whitebox.png 需另由 scripts/generate-whitebox-tileset.py 生成
// 用法：node scripts/generate-whitebox-map.js

'use strict';

const fs = require('fs');
const path = require('path');

// ===== 地图参数 =====
const TILE = 32;            // 每个 tile 32x32 像素，与 phaserquest 原版一致
// 地图尺寸正好对齐 phaserquest 的 AOI 网格（AOI 宽 34、高 20）→ 2x2 个 AOI、4 块视野区
const W = 68;               // 2 * AOIwidth (34)  = 68 tiles 宽
const H = 40;               // 2 * AOIheight (20) = 40 tiles 高
const MIDX = Math.floor(W / 2);  // 34
const MIDY = Math.floor(H / 2);  // 20

// ===== Tileset 参数 =====
// whitebox.png 是 5x1 网格，每格 32x32px，5 种纯色
// GID 在 Tiled JSON 中从 1 开始（0 = 空 tile）
const GID_LOVE   = 1;       // 白色：爱心广场（左上）
const GID_CASTLE = 2;       // 灰色：摩尔城堡（右上）
const GID_FARM   = 3;       // 绿色：拉姆农场（左下）
const GID_STREET = 4;       // 黄色：淘淘乐街（右下）
const GID_WALL   = 5;       // 深灰：外围墙（碰撞）

// ===== 区域分配（坐标 in tile units） =====
// 四个象限，外围一圈墙；中心交叉处也是墙的延伸是没必要的，白盒先全开放
// 玩家可在 4 个象限间自由穿行，地砖颜色提示当前在哪个区
function getTileGid(x, y) {
    // 外围墙
    if (x === 0 || x === W - 1 || y === 0 || y === H - 1) return GID_WALL;
    // 四象限分配
    const isRight = x >= MIDX;
    const isBottom = y >= MIDY;
    if (!isRight && !isBottom) return GID_LOVE;
    if (isRight && !isBottom) return GID_CASTLE;
    if (!isRight && isBottom) return GID_FARM;
    return GID_STREET;
}

function makeLayer(name, dataFn) {
    const data = new Array(W * H);
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            data[y * W + x] = dataFn(x, y);
        }
    }
    return {
        name,
        type: 'tilelayer',
        width: W,
        height: H,
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        data,
    };
}

// ===== Tileset 配置 =====
const tileset = {
    name: 'tilesheet',                    // 保留 'tilesheet' 名字以兼容 client game.js addTilesetImage('tilesheet', 'tileset')
    firstgid: 1,
    image: '../tilesets/whitebox.png',
    imagewidth: 32 * 5,                   // 5 个 tile 横排
    imageheight: 32,
    tilewidth: TILE,
    tileheight: TILE,
    tilecount: 5,
    columns: 5,
    margin: 0,
    spacing: 0,
    // tileproperties 用 0-based local id；标 `c` 表示碰撞（phaserquest 约定）
    tileproperties: {
        4: { c: '' },                     // local id 4 = GID 5 = WALL
    },
};

// ===== Objectgroup：phaserquest 期望以下 7 个 objectgroup 必须存在 =====
// chests / chestareas / doors / roaming / music / checkpoints / entities
// 白盒阶段除 checkpoints（出生点）外其它都为空
const checkpointPx = {
    // 出生点：地图正中央附近，4 区交界处略偏左上
    x: (MIDX - 2) * TILE,
    y: (MIDY - 2) * TILE,
    width: 4 * TILE,
    height: 4 * TILE,
};

function emptyObjectGroup(name) {
    return {
        name,
        type: 'objectgroup',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects: [],
    };
}

const checkpointsLayer = {
    name: 'checkpoints',
    type: 'objectgroup',
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    objects: [
        {
            id: 1,
            name: 'spawn',
            type: '',
            x: checkpointPx.x,
            y: checkpointPx.y,
            width: checkpointPx.width,
            height: checkpointPx.height,
            rotation: 0,
            visible: true,
            properties: {},
        },
    ],
};

// ===== 组装地图 JSON =====
function buildMap(forServer) {
    // server 端按 GameServer.readMap 逻辑：tilelayers 和 objectgroups 都要有
    // 关键：tilelayer 数量影响 nbGroundLayers 判断（client 端 Game.nbGroundLayers = 4）
    // 我们生成 4 个 tilelayer（layer0..3）确保 nbGroundLayers 判断照常生效，
    // 内容相同：第一层是地砖，其它三层全 0（空 tile）
    const layers = [
        makeLayer('layer0', getTileGid),
        makeLayer('layer1', () => 0),
        makeLayer('layer2', () => 0),
        makeLayer('layer3', () => 0),
        makeLayer('highlayer0', () => 0),
        emptyObjectGroup('chests'),
        emptyObjectGroup('chestareas'),
        emptyObjectGroup('doors'),
        emptyObjectGroup('roaming'),
        emptyObjectGroup('music'),
        checkpointsLayer,
        emptyObjectGroup('entities'),
    ];

    return {
        version: 1,
        tiledversion: '1.0.0',
        orientation: 'orthogonal',
        renderorder: 'right-down',
        width: W,
        height: H,
        tilewidth: TILE,
        tileheight: TILE,
        nextobjectid: 2,
        properties: {},
        layers,
        tilesets: [tileset],
    };
}

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'assets/maps/minimap_server.json');
const clientPath = path.join(repoRoot, 'assets/maps/minimap_client.json');

fs.writeFileSync(serverPath, JSON.stringify(buildMap(true)));
fs.writeFileSync(clientPath, JSON.stringify(buildMap(false)));

console.log(`Generated: ${serverPath} (${W}x${H}, ${W * H} tiles per layer)`);
console.log(`Generated: ${clientPath}`);
console.log(`Spawn area (tile coords): x=${MIDX - 2}..${MIDX + 2}, y=${MIDY - 2}..${MIDY + 2}`);
console.log(`Zones (tile coords):
  爱心广场 (white)  : x=1..${MIDX - 1}, y=1..${MIDY - 1}
  摩尔城堡 (gray)   : x=${MIDX}..${W - 2}, y=1..${MIDY - 1}
  拉姆农场 (green)  : x=1..${MIDX - 1}, y=${MIDY}..${H - 2}
  淘淘乐街 (yellow) : x=${MIDX}..${W - 2}, y=${MIDY}..${H - 2}`);
