/**
 * Created by Jerome on 21-01-17.
 */

var AOIutils = {
    nbAOIhorizontal: 0,
    lastAOIid: 0
};


AOIutils.listAdjacentAOIs = function(current){
    var AOIs = [];
    var isAtTop = (current < AOIutils.nbAOIhorizontal);
    // M2 (OpenMole): 原版用 `>`，对于「最后一行 AOI 中最左侧那个」会判错（不算 bottom），
    // 导致 listAdjacentAOIs 引用一个不存在的 AOI id 让 GameServer.AOIs[id] 为 undefined 后崩溃。
    // 改为 `>=` 后任意行/列数的地图都安全。原版 6x16 = 96 AOI 也会受同一 bug 影响（如 AOI 90），
    // 只是出生点离 AOI 90 远所以从未被触发。
    var isAtBottom = (current >= AOIutils.lastAOIid - AOIutils.nbAOIhorizontal);
    var isAtLeft = (current%AOIutils.nbAOIhorizontal == 0);
    var isAtRight = (current%AOIutils.nbAOIhorizontal == AOIutils.nbAOIhorizontal-1);
    AOIs.push(current);
    if(!isAtTop) AOIs.push(current - AOIutils.nbAOIhorizontal);
    if(!isAtBottom) AOIs.push(current + AOIutils.nbAOIhorizontal);
    if(!isAtLeft) AOIs.push(current-1);
    if(!isAtRight) AOIs.push(current+1);
    if(!isAtTop && !isAtLeft) AOIs.push(current-1-AOIutils.nbAOIhorizontal);
    if(!isAtTop && !isAtRight) AOIs.push(current+1-AOIutils.nbAOIhorizontal);
    if(!isAtBottom && !isAtLeft) AOIs.push(current-1+AOIutils.nbAOIhorizontal);
    if(!isAtBottom && !isAtRight) AOIs.push(current+1+AOIutils.nbAOIhorizontal);
    return AOIs;
};

if (typeof window === 'undefined') module.exports.AOIutils = AOIutils;