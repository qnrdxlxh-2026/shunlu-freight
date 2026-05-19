const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/db.json');

// 读取数据库
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// 新增 townships 表
if (!db.townships) {
  db.townships = [
    { id: 1, county: '康定', name: '炉城镇', lat: 29.9986, lng: 101.9569, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 2, county: '康定', name: '姑咱镇', lat: 29.9876, lng: 102.1569, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 3, county: '康定', name: '新都桥镇', lat: 30.0567, lng: 101.7812, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 4, county: '康定', name: '塔公镇', lat: 30.3156, lng: 101.8123, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 5, county: '泸定', name: '泸桥镇', lat: 29.9281, lng: 102.2335, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 6, county: '泸定', name: '冷碛镇', lat: 29.8567, lng: 102.3123, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 7, county: '泸定', name: '磨西镇', lat: 29.6567, lng: 102.0123, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 8, county: '丹巴', name: '章谷镇', lat: 30.8786, lng: 101.8906, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 9, county: '丹巴', name: '巴底镇', lat: 30.9567, lng: 101.8123, status: 0, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 10, county: '雅江', name: '河口镇', lat: 30.0315, lng: 101.0146, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 11, county: '理塘', name: '高城镇', lat: 30.0000, lng: 100.2700, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 12, county: '稻城', name: '金珠镇', lat: 29.0369, lng: 100.2983, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 13, county: '色达', name: '色柯镇', lat: 32.2681, lng: 100.3322, status: 1, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
    { id: 14, county: '石渠', name: '尼呷镇', lat: 32.9786, lng: 98.1031, status: 0, driver_count: 0, order_count: 0, created_at: new Date().toISOString() },
  ];
}

// 扩展 users 表
db.users = db.users.map(u => {
  if (u.role === 2 || u.role === 3) {
    return {
      ...u,
      township: u.township || '',
      service_area: u.service_area || []
    };
  }
  return u;
});

// 扩展 goods 表
db.goods = db.goods.map(g => ({
  ...g,
  start_township: g.start_township || '',
  end_township: g.end_township || ''
}));

// 扩展 orders 表
db.orders = db.orders.map(o => ({
  ...o,
  start_township: o.start_township || '',
  end_township: o.end_township || ''
}));

// 添加 nextIds
if (!db.nextIds) db.nextIds = {};
if (!db.nextIds.township) db.nextIds.township = 15;

// 保存
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log('✅ 乡镇全覆盖迁移完成');
console.log(`   新增 ${db.townships.length} 个乡镇`);
