#!/usr/bin/env node
// OpenMole M3: 生成白盒地图资源（Tiled JSON + 实体 JSON）
// 输出：
//   assets/maps/minimap_server.json (覆盖)
//   assets/maps/minimap_client.json (覆盖)
//   assets/tilesets/whitebox.png 需另由 scripts/generate-whitebox-tileset.py 生成
// 用法：node scripts/generate-whitebox-map.js

'use strict';

const fs = require('fs');
const path = require('path');

// ===== 地图参数 =====
// 每个 tile 32x32 像素，与 phaserquest 原版一致
const TILE = 32;

// M3 地图布局（横向三段）：
//   x=0..67   户外 4 区域（爱心广场/摩尔城堡/拉姆农场/淘淘乐街）+ 自己的外圈墙
//   x=68..102 走廊：35 列纯墙，宽度 > 1 AOI（34 tile），保证户外/室内不在彼此可见 AOI 内
//   x=103..121 玩家小屋（共享室内场景）+ 自己的外圈墙
// AOI 默认 34×20，所以地图整体 122×40 对应 AOI 网格 4×2 = 8 个 AOI：
//   row0: AOI 0(户外左上) | AOI 1(户外右上) | AOI 2(走廊) | AOI 3(室内)
//   row1: AOI 4(户外左下) | AOI 5(户外右下) | AOI 6(走廊) | AOI 7(室内)
// 户外 AOI 1/5 与室内 AOI 3/7 之间相隔 AOI 2/6（走廊），listAdjacentAOIs 不互相覆盖，
// 因此玩家在户外/室内之间是 AOI 严格隔离的：互看不到对方实体。
const W = 122;
const H = 40;

// 户外区
const OUT_LEFT  = 0;
const OUT_RIGHT = 67;  // 户外右外墙
const OUT_MIDX  = 34;  // 4 象限分隔
const OUT_MIDY  = 20;

// 走廊（全墙）
const COR_LEFT  = 68;
const COR_RIGHT = 102;

// 室内（玩家小屋）
const IN_LEFT   = 103;
const IN_RIGHT  = 121;
const IN_TOP    = 9;   // 小屋顶墙
const IN_BOTTOM = 29;  // 小屋底墙
// 室内地板可走范围：x=104..120, y=10..28

// 门坐标（tile）：户外门、室内门
const DOOR_OUT_X = 67;
const DOOR_OUT_Y = 19;
const DOOR_IN_X  = 103;
const DOOR_IN_Y  = 19;
// 传送目的地（落点必须可走、且不是另一扇门，避免循环传送）
const DEST_FROM_OUT = { x: 104, y: 19 };  // 户外门 → 室内地板入口
const DEST_FROM_IN  = { x: 66,  y: 19 };  // 室内门 → 户外摩尔城堡内

// ===== Tileset 参数 =====
// whitebox.png 是 7x1 网格，每格 32x32px，7 种纯色
// GID 在 Tiled JSON 中从 1 开始（0 = 空 tile）
const GID_LOVE   = 1; // 白：爱心广场（户外左上）
const GID_CASTLE = 2; // 灰：摩尔城堡（户外右上）
const GID_FARM   = 3; // 绿：拉姆农场（户外左下）
const GID_STREET = 4; // 黄：淘淘乐街（户外右下）
const GID_WALL   = 5; // 深灰：墙（碰撞）
const GID_INDOOR = 6; // 浅蓝：玩家小屋地板
const GID_DOOR   = 7; // 棕：门（可走，触发传送）

// ===== Tile 分配函数 =====
function getTileGid(x, y) {
    // 1. 门优先（覆盖墙）
    if (x === DOOR_OUT_X && y === DOOR_OUT_Y) return GID_DOOR;
    if (x === DOOR_IN_X  && y === DOOR_IN_Y)  return GID_DOOR;

    // 2. 地图最外圈墙
    if (x === 0 || x === W - 1 || y === 0 || y === H - 1) return GID_WALL;

    // 3. 户外段（x <= OUT_RIGHT）
    if (x <= OUT_RIGHT) {
        // 户外右外墙
        if (x === OUT_RIGHT) return GID_WALL;
        // 户外 4 象限
        const isRight  = x >= OUT_MIDX;
        const isBottom = y >= OUT_MIDY;
        if (!isRight && !isBottom) return GID_LOVE;
        if ( isRight && !isBottom) return GID_CASTLE;
        if (!isRight &&  isBottom) return GID_FARM;
        return GID_STREET;
    }

    // 4. 走廊段（OUT_RIGHT < x < IN_LEFT） — 全墙
    if (x < IN_LEFT) return GID_WALL;

    // 5. 室内段（x >= IN_LEFT）
    // 室内左外墙
    if (x === IN_LEFT) return GID_WALL;
    // 室内上下墙（房间四面墙）
    if (y < IN_TOP || y > IN_BOTTOM) return GID_WALL;
    // 室内地板
    return GID_INDOOR;
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
    imagewidth: 32 * 7,                   // 7 个 tile 横排
    imageheight: 32,
    tilewidth: TILE,
    tileheight: TILE,
    tilecount: 7,
    columns: 7,
    margin: 0,
    spacing: 0,
    // tileproperties 用 0-based local id；标 `c` 表示碰撞（phaserquest 约定）
    // 只有墙(GID 5)碰撞；门(GID 7)和室内(GID 6)都可走
    tileproperties: {
        4: { c: '' },                     // local id 4 = GID 5 = WALL
    },
};

// ===== 出生点：户外正中央（4 区交界处略偏左上） =====
const checkpointPx = {
    x: (OUT_MIDX - 2) * TILE,
    y: (OUT_MIDY - 2) * TILE,
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

// ===== 门 objectgroup =====
// phaserquest 约定（GameServer.setUpDoors）：door.x/y 为像素坐标，
// door.properties.x/y 为目的 tile 坐标，door.properties.o 为传送后朝向（l/u/r/d）
const doorsLayer = {
    name: 'doors',
    type: 'objectgroup',
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    objects: [
        {
            id: 2,
            name: 'door-out-to-in',
            type: '',
            x: DOOR_OUT_X * TILE,
            y: DOOR_OUT_Y * TILE,
            width: TILE,
            height: TILE,
            rotation: 0,
            visible: true,
            properties: {
                x: DEST_FROM_OUT.x,
                y: DEST_FROM_OUT.y,
                o: 'r',
            },
        },
        {
            id: 3,
            name: 'door-in-to-out',
            type: '',
            x: DOOR_IN_X * TILE,
            y: DOOR_IN_Y * TILE,
            width: TILE,
            height: TILE,
            rotation: 0,
            visible: true,
            properties: {
                x: DEST_FROM_IN.x,
                y: DEST_FROM_IN.y,
                o: 'l',
            },
        },
    ],
};

// ===== 组装地图 JSON =====
function buildMap() {
    // 4 tilelayer 与 client 端 Game.nbGroundLayers = 4 对齐；其它三层占位
    const layers = [
        makeLayer('layer0', getTileGid),
        makeLayer('layer1', () => 0),
        makeLayer('layer2', () => 0),
        makeLayer('layer3', () => 0),
        makeLayer('highlayer0', () => 0),
        emptyObjectGroup('chests'),
        emptyObjectGroup('chestareas'),
        doorsLayer,
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
        nextobjectid: 4,
        properties: {},
        layers,
        tilesets: [tileset],
    };
}

const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'assets/maps/minimap_server.json');
const clientPath = path.join(repoRoot, 'assets/maps/minimap_client.json');

fs.writeFileSync(serverPath, JSON.stringify(buildMap()));
fs.writeFileSync(clientPath, JSON.stringify(buildMap()));

console.log(`Generated: ${serverPath} (${W}x${H}, ${W * H} tiles per layer)`);
console.log(`Generated: ${clientPath}`);
