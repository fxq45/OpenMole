/**
 * M4a (OpenMole): 白盒家具实例。
 *
 * 服务端权威家具数据。每个家具实例固定坐标、可被玩家走过去拾起一次。
 * 不复用 phaserquest 的 Item 系统（那个跟战斗/掉落耦合，M1 已禁用），
 * 也不走 UpdatePacket / 二进制协议——家具数量少、走简单 JSON socket 事件够用。
 *
 * 渲染：客户端用 Phaser graphics 画带颜色矩形，不进 tilemap（要支持动态消失）。
 *
 * 字段：
 *   id    数字 ID，服务端分配（pickup 广播用）
 *   x,y   tile 坐标
 *   kind  'chair' | 'table' | 'lamp' | 'flower'
 *   value 拾起奖励的摩尔豆
 */

function Furniture(id, x, y, kind, value) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.value = value;
}

Furniture.prototype.trim = function() {
    return {id: this.id, x: this.x, y: this.y, kind: this.kind};
};

module.exports.Furniture = Furniture;
