# OpenMole

**OpenMole** 是一款以《摩尔庄园》为蓝本的开源白盒 MMO 原型，fork 自 [Jerenaux/phaserquest](https://github.com/Jerenaux/phaserquest)。当前阶段：**M3a 门传送 + 玩家小屋**（无美术资源，纯色 tile + 中文区域标签验证玩法/网络/状态机）。

> 项目代号 OpenMole 是为了避免与"摩尔庄园" / "Moore Manor" 商标冲突。

### 改造里程碑

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | Docker 环境跑通原版 phaserquest | ✅ ([PR #1](https://github.com/fxq45/OpenMole/pull/1)) |
| M1 | 关闭战斗系统（`combatEnabled` flag + `@deprecated`）| ✅ ([PR #2](https://github.com/fxq45/OpenMole/pull/2)) |
| M2 | 白盒地图 + 4 区域（爱心广场/拉姆农场/摩尔城堡/淘淘乐街）、顺手修 `AOIutils.listAdjacentAOIs` off-by-one | ✅ ([PR #3](https://github.com/fxq45/OpenMole/pull/3)) |
| M3a | 门传送 + 玩家小屋（单地图扩到 122×40，走廊 + door object + AOI ghost 修复） | ✅ ([PR #4](https://github.com/fxq45/OpenMole/pull/4)) |
| — | 启动 race condition 修复（`init-world` 加 `server.db` 守卫 + docker `restart: unless-stopped`） | ✅ ([PR #5](https://github.com/fxq45/OpenMole/pull/5)) |
| M3b | 真 Realm 抽象（不同玩家的家是独立实例）| - |
| M4 | 摩尔豆 + 白盒背包 | 🚧 下一步 |
| M5 | 第一个小游戏（白盒泡泡龙）| - |
| M6 | 拉姆养成 + 任务系统 | - |

完整改造路线详见 [docs/OPENMOLE_PLAN.md](docs/OPENMOLE_PLAN.md)。

### 地图布局（M3a）

122 × 40 tile、补对齐 phaserquest 默认的 34×20 AOI 网格 = 4×2 个 AOI：

```
x=0..67 (户外)            x=68..102 (走廊墙)   x=103..121 (室内)
 ┌──────────┬─────────┐   ███████████████████   ┌──────────────┐
 │ 爱心广场 │ 摩尔城堡│   ███████████████████   │   玩家小屋   │
 ├──────────┼─────────┤   ██████ 门 (67,19) ↔ 门 (103,19) │
 │ 拉姆农场 │ 淘淘乐街│   ███████████████████   │  (light blue) │
 └──────────┴─────────┘   ███████████████████   └──────────────┘
```

走廊 35 tile 宽 > 1 AOI 宽（34），保证户外/室内 AOI 不相邻、各自隔离可见。

### 白盒地图生成

`assets/maps/minimap_*.json` 和 `assets/tilesets/whitebox.png` 由以下脚本生成（不要手改 JSON / PNG）：

```bash
python3 scripts/generate-whitebox-tileset.py   # 生成 7x1 纯色方块 PNG
node scripts/generate-whitebox-map.js          # 生成 122x40 tile 的 Tiled JSON
```

7 个 tile color：白=爱心广场、灰=摩尔城堡、绿=拉姆农场、黄=淘淘乐街、深灰=墙、浅蓝=玩家小屋地板、棕=门。

要换地图布局/颜色，改这两个脚本里的常量后重新执行即可。

### 启动

```bash
docker compose up -d --build
# 浏览器打开 http://localhost/
```

* 老存档（来自原版 172x314 地图）的坐标会自动重置到出生点，无需手动清库。
* 启服后前 1-3 秒如果浏览器马上连，会看到 console 里 `Server not ready, re-attempting...` 重试几次后正常进入（PR #5 后不会再崩服）。
* 端口 80 被占用（Skype / IIS 等）的话，把 `docker-compose.yml` 里 `'80:80'` 改成 `'8081:80'` 后访问 `http://localhost:8081/`。

### 玩法验证（M3a结束后）

* 出生在户外中间、点鼠标可以在 4 色区域间自由奔走。
* 走到 (67,19) 棕门会瞬移到 (104,19) 玩家小屋；玩家小屋里 (103,19) 棕门可返回户外 (66,19)。
* 多人进入、聊天、移动同步都走原版 socket.io + AOI 设计，未增加协议、仅增加了 `leftAOIs[]` 字段修复原版 ghost-player 老 bug。

---

## 以下为原始 phaserquest README（保留以备参考）

# phaserquest

Phaser Quest is a reproduction of Mozilla's [Browserquest](http://browserquest.mozilla.org/) using the following tools:
- The [Phaser](https://phaser.io/) framework for the client 
- [Socket.io](http://socket.io/) and [Node.js](https://nodejs.org/en/) for the server and client-server communication

:fire: If you are interested in this project, you may also be interested in [Westward](https://github.com/Jerenaux/westward), an open source Javascript MMORPG that I am working on! :rocket:

## Quick tour of the code

### Client

The game canvas and the game states are created in `js/client/main.js`. The `Home` state is started first, and will display the home page
of the game. The `Game` state is started upon calling `startGame()` from the `Home` state. 

`js/client/game.js` contains the  `Game` object, which corresponds to the `Game` state and contains the bulk of the client code. 
`Game.init()` is automatically called first by Phaser, to initialize a few variables. `Game.preload()` is then called, to load the
assets that haven't been loaded in the `Home` state. When all assets are loaded, Phaser calls `Game.create()` where the basics of the game
are set up. At the end of `Game.create()`, a call is made to `Client.requestData()` (from `js/client/client.js`) to request initialization
data from the server. Upon reception of this data, `Game.initWorld()` is called, which finishes starting the game. The main update loop of the client is `Game.update()`. 

### Server and updates

`server.js` is the Node.js server that supports the game. Most of the server-side game logic however is located in `js/server/GameServer.js`. Every 200ms, `GameServer.updatePlayers()` is called, and sends updates to all clients (if there are updates to send, as determined by the custom interest management system). Client-side, these updates are processed by `Game.updateWorld()` and `Game.updateSelf()`. 

The code used for the custom binary protocol for the exchange of update packets can be found in `js/client/Decoder.js`, `js/server/Encoder.js` and `js/CODec.js`.

## Installing and running the game

For the client, everything is included in the code (`phaser.js`, `easystar.min.js`, ...). You will need [npm](https://www.npmjs.com/) to install the Node.js packages required for the server. To run the server, you'll need to have Node.js installed, as well as [MongoDB](https://www.mongodb.com/).

Clone the repository. Inside the newly created directory, run `npm install` to install the Node.js packages listed in `package.json`. Make sure that you have MongoDB running, then run `node server.js` to start the game server. 
By default, it'll listen to connections on port `8081`; you can change that behaviour by using the `-p` flag (e.g. `node server.js -p 80`). 
By default, it'll attempt to connect to MongoDB on port `27017`; you can change that behaviour by using the `--mongoPort` flag (e.g. `node server.js --mongoPort 25000`).

[Here](GETTING_STARTED.md) you will find a step-by-step guide how to run and manage the application locally.

### Using Docker

Alternatively, you can use the Dockerfile to create a container with all the necessary components already installed (thanks to Martin kramer for the corresponding pull request). You need to have [Docker](https://www.docker.com) installed. Then, in the directory where you clones the project, run:

```
docker-compose build
```
```
docker-compose up -d
```

The default port when using the Docker way is `80`, so you need to navigate to `<IP_of_your_Docker_machine>:80` to be able to access the game (e.g. 192.168.99.100:80). 

## Modifying the map

In `assets/maps/`, you can find `phaserquest_map.tmx`, which is the Tiled file of the map of the game, to be edited with the [Tiled Map Editor](http://www.mapeditor.org/). One you have made modifications in the Tiled file, you need to export it as a JSON file. But that file will contain a lot of layers, a legacy from how the original Browserquest map was designed. A lot of layers will translate to a very poor performance with Phaser, which is a shame since most of these layers contain only a few tiles. The solution is to "flatten" them to cram as many tiles as possible in the same layers. You can do so by running `formatMap()` from `js/server/format.js`. It will look for a `map.json` file in `assets/maps` and output two new files, the flattened map files for the client and the server.

***Note:*** It is recommended to use _Tiled_ in version ***1.1.6*** or lower, which can be found here:

- [https://github.com/bjorn/tiled/releases/tag/v1.1.6](https://github.com/bjorn/tiled/releases/tag/v1.1.6)
- [https://sourceforge.net/projects/tiled/files/v1.1.6/](https://sourceforge.net/projects/tiled/files/v1.1.6/)

Map JSON format has changed in _Tiled_ in higher versions. Cause of that provided `tmx` map won't be exported to JSON format supported by `format.js` script.

## Further documentation

I have written and will keep writing articles about some development aspects of the game. The full list of existing articles is available [here](http://www.dynetisgames.com/tag/phaser-quest/).

Here is the detail of the topics covered so far:
- [Clients synchronization](http://www.dynetisgames.com/2017/03/19/client-updates-phaser-quest/)
- [Latency estimation](http://www.dynetisgames.com/2017/03/19/latency-estimation-phaser-quest/)
- [Interest management](http://www.dynetisgames.com/2017/04/05/interest-management-mog/) (the "AOI" stuff you might encounter in the code)
- [Custom Binary Protocol](http://www.dynetisgames.com/2017/06/14/custom-binary-protocol-javascript/)

## Donate

If you want to support me to make more open-source projects like Phaser Quest, consider having a look at my [donation page](https://www.dynetisgames.com/donate/). In particular, take a minute to have a look at my [Patreon page](https://www.patreon.com/jeromerenaux), where you can find a listing of rewards for various levels of recurring contributions!
