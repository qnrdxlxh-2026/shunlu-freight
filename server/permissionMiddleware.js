/**
 * 四端合一权限管理中间件
 * 定义每个角色可以访问的功能模块
 */

// 权限矩阵
const PERMISSION_MATRIX = {
  1: { // 商家
    name: '商家',
    permissions: [
      'goods:publish',    // 发布货源
      'goods:view',       // 查看货源
      'orders:view',      // 查看订单
      'orders:cancel',    // 取消订单
      'wallet:view',      // 查看钱包
      'wallet:withdraw',  // 提现
      'profile:edit',     // 编辑资料
      'shop:manage'       // 店铺管理
    ],
    denied: [
      'route:publish',   // 不能发布路线
      'driver:accept'     // 不能接单(不是司机)
    ]
  },
  2: { // 货车司机
    name: '货车司机',
    permissions: [
      'route:publish',   // 发布路线
      'goods:view',      // 查看货源
      'orders:accept',   // 接单
      'orders:view',     // 查看订单
      'orders:update',   // 更新订单状态
      'wallet:view',     // 查看钱包
      'wallet:withdraw', // 提现
      'profile:edit',    // 编辑资料
      'driver:mode'      // 切换司机模式
    ],
    denied: [
      'goods:publish'    // 不能发布货源(不是商家)
    ]
  },
  3: { // 私家车
    name: '私家车',
    permissions: [
      'route:publish',   // 发布路线
      'goods:view',      // 查看货源
      'orders:accept',   // 接单
      'orders:view',     // 查看订单
      'orders:update',   // 更新订单状态
      'wallet:view',     // 查看钱包
      'wallet:withdraw', // 提现
      'profile:edit',    // 编辑资料
      'driver:mode',     // 切换司机模式
      'passenger:publish' // 发布乘客信息
    ],
    denied: [
      'goods:publish',   // 不能发布货源
      'orders:bulk'      // 不能批量接单
    ],
    limits: {
      daily_orders: 2,   // 每日最多2单
      max_weight: 20,    // 单票限20kg
      max_value: 2000     // 单票限2000元
    }
  },
  4: { // 管理员
    name: '管理员',
    permissions: ['*'],  // 全部权限
    denied: []
  },
  5: { // 个人
    name: '个人',
    permissions: [
      'goods:publish',    // 发布发货需求
      'goods:view',       // 查看自己的货源
      'orders:view',      // 查看订单
      'orders:cancel',    // 取消订单
      'wallet:view',      // 查看钱包
      'wallet:recharge',  // 充值
      'profile:edit'      // 编辑资料
    ],
    denied: [
      'route:publish',   // 不能发布路线
      'driver:accept'     // 不能接单
    ]
  }
};

/**
 * 检查用户是否有权限
 * @param {number} role - 用户角色
 * @param {string} permission - 权限字符串(如 'goods:publish')
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  const rolePerms = PERMISSION_MATRIX[role];
  if (!rolePerms) return false;
  if (rolePerms.permissions.includes('*')) return true; // 管理员
  return rolePerms.permissions.includes(permission);
}

/**
 * 获取用户所有权限
 * @param {number} role - 用户角色
 * @returns {object} { permissions, limits, denied }
 */
function getUserPermissions(role) {
  const rolePerms = PERMISSION_MATRIX[role];
  if (!rolePerms) return { permissions: [], limits: {}, denied: [] };
  return {
    permissions: rolePerms.permissions,
    limits: rolePerms.limits || {},
    denied: rolePerms.denied || []
  };
}

/**
 * 检查用户是否超过限制
 * @param {object} user - 用户对象
 * @param {string} limitType - 限制类型(daily_orders, max_weight, max_value)
 * @param {number} value - 当前值
 * @returns {boolean}
 */
function checkLimit(user, limitType, value) {
  const perms = getUserPermissions(user.role);
  if (!perms.limits[limitType]) return true; // 无限制
  return value <= perms.limits[limitType];
}

/**
 * 权限检查中间件
 * 在需要权限的API中使用
 */
function requirePermission(permission) {
  return (req, res, user) => {
    if (!user) {
      sendJson(res, { code: 401, msg: '请先登录' }, 401);
      return false;
    }
    if (!hasPermission(user.role, permission)) {
      sendJson(res, { code: 403, msg: '权限不足' }, 403);
      return false;
    }
    return true;
  };
}

module.exports = {
  PERMISSION_MATRIX,
  hasPermission,
  getUserPermissions,
  checkLimit,
  requirePermission
};
