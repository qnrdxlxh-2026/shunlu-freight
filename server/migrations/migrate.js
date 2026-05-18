/**
 * 数据库迁移脚本 - V1.2 升级
 * 功能：佣金体系 + 司机双模式 + GPS定位
 * 
 * 执行方式：node server/migrations/migrate.js
 * 执行时间：2026-05-18
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data/db.json');

// 读取现有数据库
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

console.log('🚀 开始数据库迁移 V1.2...');
console.log('当前数据库表:', Object.keys(db));

// ========== 1. 新增：平台全局配置表 ==========
if (!db.platform_config) {
  db.platform_config = {
    // 佣金模式：0=阶梯模式 1=全部免佣 2=固定5% 3=标准10%
    commission_mode: 0,
    // 阶梯佣金开关
    step_commission_enabled: true,
    // 全局免佣开关
    global_free_commission: false,
    // 默认货车佣金率 (基准)
    default_truck_commission: 10,
    // 默认私家车佣金率
    default_private_commission: 10,
    // 更新人
    updated_by: 'system',
    // 更新时间
    updated_at: new Date().toISOString()
  };
  console.log('✅ 新增 platform_config 表');
}

// ========== 2. 新增：阶梯佣金规则表 ==========
if (!db.commission_tiers) {
  db.commission_tiers = [
    {
      id: 1,
      name: '第一阶段：新手免佣期',
      months_from: 0,
      months_to: 3,
      commission_rate: 0,           // 0% 免佣
      status: 1,                    // 启用
      remark: '注册后1-3个月，全额免佣',
      order: 1
    },
    {
      id: 2,
      name: '第二阶段：扶持优惠期',
      months_from: 4,
      months_to: 6,
      commission_rate: 5,           // 5% 佣金
      status: 1,
      remark: '注册后4-6个月，收取5%佣金',
      order: 2
    },
    {
      id: 3,
      name: '第三阶段：标准佣金期',
      months_from: 7,
      months_to: 999,
      commission_rate: 10,          // 10% 标准佣金
      status: 1,
      remark: '注册7个月后，恢复标准10%佣金',
      order: 3
    }
  ];
  console.log('✅ 新增 commission_tiers 表（3条阶梯规则）');
}

// ========== 3. 新增：用户佣金覆盖表（单用户精准设置）==========
if (!db.user_commission_overrides) {
  db.user_commission_overrides = [];
  console.log('✅ 新增 user_commission_overrides 表');
}

// ========== 4. 新增：司机GPS位置表 ==========
if (!db.driver_locations) {
  db.driver_locations = [];
  console.log('✅ 新增 driver_locations 表');
}

// ========== 5. 新增：司机运行模式表 ==========
if (!db.driver_modes) {
  // 默认模式：0=直达模式 1=顺路模式
  db.driver_modes = [];
  console.log('✅ 新增 driver_modes 表');
}

// ========== 6. 新增：拒单记录表 ==========
if (!db.rejection_logs) {
  db.rejection_logs = [];
  console.log('✅ 新增 rejection_logs 表');
}

// ========== 7. 为 users 表扩展字段 ==========
db.users.forEach(user => {
  // 注册时间（用于计算阶梯佣金）
  if (!user.register_time) {
    user.register_time = user.create_time;
  }
  // 阶梯佣金已使用标记
  if (!user.tier_used) {
    user.tier_used = false;
  }
});
console.log('✅ 扩展 users 表字段（register_time, tier_used）');

// ========== 8. 为 orders 表扩展字段 ==========
db.orders.forEach(order => {
  if (typeof order.driver_mode === 'undefined') {
    order.driver_mode = null;  // 接单时的司机模式
  }
  if (!order.reject_count) {
    order.reject_count = 0;   // 拒单次数
  }
});
console.log('✅ 扩展 orders 表字段（driver_mode, reject_count）');

// ========== 9. 更新 nextIds ==========
if (!db.nextIds.platform_config) db.nextIds.platform_config = 1;
if (!db.nextIds.commission_tier) db.nextIds.commission_tier = 4;
if (!db.nextIds.user_override) db.nextIds.user_override = 1;
if (!db.nextIds.driver_location) db.nextIds.driver_location = 1;
if (!db.nextIds.driver_mode) db.nextIds.driver_mode = 1;
if (!db.nextIds.rejection_log) db.nextIds.rejection_log = 1;
console.log('✅ 更新 nextIds');

// ========== 保存数据库 ==========
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log('✅ 数据库迁移完成！');
console.log('');
console.log('📊 新增表结构汇总：');
console.log('  - platform_config: 平台全局配置');
console.log('  - commission_tiers: 阶梯佣金规则（3条）');
console.log('  - user_commission_overrides: 单用户佣金覆盖');
console.log('  - driver_locations: 司机GPS位置');
console.log('  - driver_modes: 司机运行模式');
console.log('  - rejection_logs: 拒单记录');
console.log('');
console.log('📋 下一步：');
console.log('  1. 重启后端服务 (pm2 restart shunlu-api)');
console.log('  2. 测试新增API接口');
console.log('  3. 开发后台佣金管控面板');