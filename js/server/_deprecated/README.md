# `js/server/_deprecated/` — 战斗系统归档说明

> 本目录用于**说明** OpenMole 改造路线中战斗相关源码的归档策略，而非实际存放源文件。

## 为什么是空目录？

M1 阶段（PR #2）拆战斗系统时，我们没有把战斗相关源文件物理移到这里，原因如下：

1. `Monster.js` 通过 `require('./Monster.js')` 被 `GameServer.js` 引用。物理移走会断 require 链，需要同步改一堆 import 路径。
2. `MovingEntity.js` 是 `Player` 和 `Monster` 的公共父类。它里面的 `startFight / damage / die` 等战斗方法和非战斗方法（`updateWalk` / `setRoute`）耦合在一起，没法整文件移走。

所以 M1 采取的策略是：**保持源文件在原位置 + 用 feature flag 关闭调用 + 在每个战斗方法上加 `@deprecated` 注释**。

## 战斗代码的"逻辑归档点"

| 源文件位置 | 状态 | 备注 |
|---|---|---|
| `js/server/Monster.js` | `@deprecated`，整文件不再被实例化 | 在 `GameServer.combatEnabled = false` 时不会被调用 |
| `js/server/MovingEntity.js` 中的 `startFight / damage / updateLife / die / endFight / manageFoes / addFoe / hasFoe / updateFight` | `@deprecated`，调用点已关闭 | 文件本身不能整体废弃（含移动逻辑） |
| `js/server/GameServer.js` 中的 `setUpFight / areFighting / handleKill / formatLootTable / dropLoot / spawnHiddenChest / checkMonster / setUpRoaming / addMonster` | `@deprecated`，被 `combatEnabled` flag gate | flag 在 `GameServer` 对象顶部，默认 false |

## 何时彻底删除？

按 OpenMole 改造路线规划，**M5（第一个白盒小游戏）** 完成后再判断：

- 如果 M5 选了战斗类小游戏（如 PVE 副本），战斗代码会被搬到 `js/server/minigames/<game>/` 下重构使用，本归档点废弃。
- 如果 M5 选了非战斗小游戏（泡泡龙、抓豆等），且后续没有任何战斗玩法计划，则在 M6 结束后开 PR **物理删除**所有标 `@deprecated` 的战斗代码。

## 如何临时重新启用战斗（仅供调试）

```js
// js/server/GameServer.js
combatEnabled: true,  // 默认 false，临时改为 true 即可恢复原版 phaserquest 战斗体验
```

不需要改其它任何代码，所有 gate 都基于这一个 flag。
