/**
 * Created by Jerome on 26-12-16.
 */

var GameServer = require('./GameServer.js').GameServer;
var MovingEntity = require('./MovingEntity.js').MovingEntity; // Parent class of monsters and players
var PersonalUpdatePacket = require('./PersonalUpdatePacket.js').PersonalUpdatePacket;

function Player(name){
    MovingEntity.call(this);
    this.name = name;
    var startingPosition = GameServer.determineStartingPosition();
    this.x = startingPosition.x;
    this.y = startingPosition.y;
    this.setAOI();
    this.category = 'player';
    this.maxLife = 100;
    this.life = this.maxLife;
    this.speed = 120;
    this.equip(1,"sword1");
    this.equip(2,"clotharmor");
    this.updatePacket = new PersonalUpdatePacket();
    this.newAOIs = [];
    // M4a (OpenMole): 摩尔豆货币 + 背包。新玩家默认 100 豆、空背包。
    // inventory 用 { kind -> count } 字典存储，便于增量更新；按需求未来要支持多 slot 再升级。
    this.moerDou = 100;
    this.inventory = {};
}

Player.prototype = Object.create(MovingEntity.prototype); // Declares the inheritance relationship
Player.prototype.constructor = Player;

Player.prototype.setAOI = function(){
    this.aoi = this.getAOIid();
};

Player.prototype.setIDs = function(dbId,socketId){
    this.id = GameServer.lastPlayerID++;
    GameServer.IDmap[this.id] = dbId;
    this.socketID = socketId;
};

Player.prototype.getMongoID = function(){
    return GameServer.IDmap[this.id];
};

Player.prototype.setLastSavedPosition = function(){
    this.lastSavedPosition = {x:this.x,y:this.y};
};

Player.prototype.resetPosition = function(){
    this.setProperty('x',this.lastSavedPosition.x);
    this.setProperty('y',this.lastSavedPosition.y);
};

Player.prototype.trim = function(){
    // Return a smaller object, containing a subset of the initial properties, to be sent to the client
    var trimmed = {};
    var broadcastProperties = ['id','name','weapon','armor','inFight','alive','aoi']; // list of properties relevant for the client
    for(var p = 0; p < broadcastProperties.length; p++){
        trimmed[broadcastProperties[p]] = this[broadcastProperties[p]];
    }
    trimmed.x = parseInt(this.x);
    trimmed.y = parseInt(this.y);
    if(this.route) trimmed.route = this.route.trim(this.category);
    if(this.target) trimmed.targetID = this.target.id;
    return trimmed;
};

Player.prototype.dbTrim = function(){
    // Return a smaller object, containing a subset of the initial properties, to be stored in the database
    var trimmed = {};
    var dbProperties = ['x','y','name']; // list of properties relevant to store in the database
    for(var p = 0; p < dbProperties.length; p++){
        trimmed[dbProperties[p]] = this[dbProperties[p]];
    }
    trimmed['weapon'] = GameServer.db.itemsIDmap[this.weapon];
    trimmed['armor'] = GameServer.db.itemsIDmap[this.armor];
    // M4a (OpenMole): 持久化货币 + 背包
    trimmed['moerDou'] = this.moerDou;
    trimmed['inventory'] = this.inventory;
    return trimmed;
};

Player.prototype.getDataFromDb = function(document){
    // Set up the player based on the data stored in the databse
    // document is the mongodb document retrieved form the database
    var dbProperties = ['x','y','name'];
    for(var p = 0; p < dbProperties.length; p++){
        this[dbProperties[p]] = document[dbProperties[p]];
    }
    // M2 (OpenMole): 老存档可能来自原版 172x314 地图，若坐标超出当前白盒地图边界则重置到出生点。
    // 这样 Patricia 不用每次切地图都 `docker compose down -v` 清库。
    var mw = GameServer.map.width;
    var mh = GameServer.map.height;
    if (this.x < 0 || this.x >= mw || this.y < 0 || this.y >= mh) {
        console.log('Player ' + document.name + ' had out-of-bounds saved position ('
            + this.x + ',' + this.y + ') for map ' + mw + 'x' + mh + ', resetting to spawn.');
        var spawn = GameServer.determineStartingPosition();
        this.x = spawn.x;
        this.y = spawn.y;
    }
    this.setAOI();
    this.equip(1,document['weapon']);
    this.equip(2,document['armor']);
    // M4a (OpenMole): 老存档没有这两个字段时给默认值（== 新玩家初始值）
    this.moerDou = (typeof document.moerDou === 'number') ? document.moerDou : 100;
    this.inventory = (document.inventory && typeof document.inventory === 'object') ? document.inventory : {};
};

// M4a (OpenMole): 拾起家具 — 只进背包，不动摩尔豆。
// 摩尔豆是任务 / 打工 / 小游戏的奖励（M5+ 接入），不是「捡到东西就送」。
// Furniture.value 字段保留作为未来商店「售价 / 回收价」的引用。
// 广播 furniture-pickup（让所有客户端的家具 sprite 消失）由 GameServer.checkFurniture 负责。
Player.prototype.pickupFurniture = function(furniture){
    this.inventory[furniture.kind] = (this.inventory[furniture.kind] || 0) + 1;
    // 立刻存档：家具一旦被捡走就从世界永久消失，不存档 + 玩家在走够 30 tile 触发
    // checkSave 之前断线 → inventory 改动丢失而世界已少一个家具，造成不可逆数据不一致。
    GameServer.savePlayer(this);
    var socket = GameServer.server.getSocket(this.socketID);
    if(socket) socket.emit('inventory-update', {moerDou: this.moerDou, inventory: this.inventory});
};

Player.prototype.getIndividualUpdatePackage = function(){
    if(this.updatePacket.isEmpty()) return null;
    var pkg = this.updatePacket;
    this.updatePacket = new PersonalUpdatePacket();
    return pkg;
};

Player.prototype.getPathEnd = function(){
    return {x:this.route.path[this.route.path.length-1].x,y:this.route.path[this.route.path.length-1].y};
};

Player.prototype.updateFight = function(){
    this.lastFightUpdate = Date.now();
    if(!this.target || !this.target.alive) return;
    var direction = GameServer.adjacentNoDiagonal(this,this.target);
    if(direction > 0) this.damage();
};

Player.prototype.regenerate = function(){
    this.updateLife(2);
};

Player.prototype.equip = function(type,item){
    var equipInfo = GameServer.db.items[item];
    if(type == 1){
        this.atk = equipInfo.atk;
        this.setProperty('weapon',equipInfo.id);
    }else if(type == 2){
        this.def = equipInfo.def;
        this.setProperty('armor',equipInfo.id);
    }
};

Player.prototype.applyItem = function(item){
    var itemInfo = GameServer.db.items[item.itemKey];
    if(itemInfo === undefined){
        console.error('WARNING : undefined data for item : ');
        console.log(item);
        return;
    }
    var picked = true;
    if(itemInfo.heals){
        var difference = this.updateLife(itemInfo.heals);
        this.updatePacket.addHP(false,difference); /// false = self
        this.updatePacket.addUsed(itemInfo.id);
    }else if(itemInfo.equip){
        var equipInfo = GameServer.db.items[itemInfo.equip];
        var type = equipInfo.type;
        if(type == 1){ // Weapon
            if(this.atk >= equipInfo.atk){ // don't pick up if a better item is already equipped
                this.updatePacket.addNoPick();
                picked = false;
            }
        }else if(type == 2){ // Armor
            if(this.def >= equipInfo.def){
                this.updatePacket.addNoPick();
                picked = false;
            }
        }
        if(picked){
            this.equip(type,itemInfo.equip);
            if(this.x < 92) GameServer.savePlayer(this);
            this.updatePacket.addUsed(equipInfo.id);
        }
    }
    return picked;
};

Player.prototype.teleport = function(door){
    this.x = door.to.x;
    this.y = door.to.y;
    this.manageFoes();
    this.endFight();
};

Player.prototype.revive = function(){
    if(this.alive) return;
    this.life = this.maxLife;
    this.resetPosition();
    this.setProperty('alive',true);
    this.updatePacket.updatePosition(this.x,this.y);
};

module.exports.Player = Player;