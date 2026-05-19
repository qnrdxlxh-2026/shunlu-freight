// 运行乡镇覆盖迁移
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// 运行迁移
const migration = require('./add_township_coverage');
const newDb = migration(db);

// 保存
fs.writeFileSync(DB_FILE, JSON.stringify(newDb, null, 2));
console.log('✅ 乡镇覆盖迁移完成');
console.log(`   新增 ${newDb.townships.length} 个乡镇`);
