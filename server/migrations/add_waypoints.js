/**
 * 数据库迁移：添加中途装卸货功能
 * 为 goods 和 orders 表添加 waypoints 字段
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/db.json');

// 读取数据库
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

let migrated = 0;

// 为 goods 表添加 waypoints 字段
if (db.goods) {
  db.goods.forEach(g => {
    if (!g.waypoints) {
      g.waypoints = [];  // 中途装卸点数组
      migrated++;
    }
  });
}

// 为 orders 表添加 waypoints 字段
if (db.orders) {
  db.orders.forEach(o => {
    if (!o.waypoints) {
      o.waypoints = [];  // 中途装卸点数组
      migrated++;
    }
  });
}

// 保存数据库
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

console.log(`✅ 迁移完成！为 goods 和 orders 添加 waypoints 字段`);
console.log(`   处理货物数: ${db.goods ? db.goods.length : 0}`);
console.log(`   处理订单数: ${db.orders ? db.orders.length : 0}`);
console.log(`   新增字段数: ${migrated}`);
