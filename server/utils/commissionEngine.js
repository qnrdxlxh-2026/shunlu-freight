/**
 * 佣金计算引擎 - V1.2 核心模块
 * 功能：智能佣金计算（阶梯佣金 + 后台调控 + 单用户覆盖）
 */

// ========== 核心佣金计算函数 ==========

/**
 * 获取用户的佣金费率（考虑所有调控因素）
 * @param {object} user - 用户对象（需要 id, role, register_time）
 * @param {object} db - 数据库对象
 * @returns {object} { commissionRate, source, description }
 */
function getUserCommissionRate(user, db) {
  // 1. 检查是否有单用户覆盖（最高优先级）
  const override = db.user_commission_overrides?.find(o => o.user_id === user.id && o.status === 1);
  if (override) {
    return {
      commissionRate: override.commission_rate,
      source: 'override',
      description: override.remark || `专属费率：${override.commission_rate}%`
    };
  }

  // 2. 检查平台全局配置
  const config = db.platform_config || {};
  
  // 全局免佣模式
  if (config.global_free_commission === true) {
    return {
      commissionRate: 0,
      source: 'global_free',
      description: '平台全网免佣中'
    };
  }

  // 全局固定佣金模式（模式2：固定5%）
  if (config.commission_mode === 2) {
    const rate = user.role === 2 ? config.default_truck_commission : config.default_private_commission;
    return {
      commissionRate: rate,
      source: 'global_fixed',
      description: `平台统一费率：${rate}%`
    };
  }

  // 恢复标准10%佣金（模式3）
  if (config.commission_mode === 3) {
    const rate = user.role === 2 ? config.default_truck_commission : config.default_private_commission;
    return {
      commissionRate: rate,
      source: 'global_standard',
      description: `平台标准费率：${rate}%`
    };
  }

  // 3. 检查阶梯佣金（模式0：默认阶梯模式）
  if (config.step_commission_enabled !== false && config.commission_mode === 0) {
    const registerTime = new Date(user.register_time || user.create_time);
    const now = new Date();
    const monthsDiff = Math.floor((now - registerTime) / (1000 * 60 * 60 * 24 * 30));
    
    // 查找对应的阶梯
    const tiers = db.commission_tiers || [];
    for (const tier of tiers.sort((a, b) => a.order - b.order)) {
      if (monthsDiff >= tier.months_from && monthsDiff <= tier.months_to && tier.status === 1) {
        return {
          commissionRate: tier.commission_rate,
          source: 'tier',
          description: `${tier.name}（注册${monthsDiff}个月）`,
          tierId: tier.id,
          monthsUsed: monthsDiff
        };
      }
    }
  }

  // 4. 默认佣金率（回退）
  const defaultRate = user.role === 2 ? 6 : 12;
  return {
    commissionRate: defaultRate,
    source: 'default',
    description: `默认费率：${defaultRate}%`
  };
}

/**
 * 计算订单的实际佣金
 * @param {number} orderPrice - 订单总价
 * @param {number} commissionRate - 佣金费率（百分比）
 * @returns {object} { commissionFee, driverAmount, netAmount }
 */
function calculateCommission(orderPrice, commissionRate) {
  const commissionFee = Math.round(orderPrice * commissionRate) / 100;
  const driverAmount = orderPrice - commissionFee;
  return {
    commissionFee,     // 平台抽成
    driverAmount,      // 司机实收
    netAmount: driverAmount // 净额（和driverAmount相同）
  };
}

/**
 * 获取用户免佣状态信息
 * @param {object} user - 用户对象
 * @param {object} db - 数据库对象
 * @returns {object} { inGracePeriod, remainingDays, tierInfo }
 */
function getUserGracePeriodInfo(user, db) {
  const config = db.platform_config || {};
  
  // 如果全局免佣，直接返回
  if (config.global_free_commission) {
    return {
      inGracePeriod: true,
      remainingDays: null,
      tierInfo: { name: '全网免佣', rate: 0 }
    };
  }

  // 计算注册时长
  const registerTime = new Date(user.register_time || user.create_time);
  const now = new Date();
  const daysDiff = Math.floor((now - registerTime) / (1000 * 60 * 60 * 24));
  const monthsDiff = Math.floor(daysDiff / 30);

  // 获取当前阶梯
  const tiers = db.commission_tiers || [];
  const currentTier = tiers.find(t => 
    monthsDiff >= t.months_from && 
    monthsDiff <= t.months_to && 
    t.status === 1
  );

  if (!currentTier) {
    return {
      inGracePeriod: false,
      remainingDays: 0,
      tierInfo: { name: '标准佣金期', rate: 10 }
    };
  }

  // 计算免佣期剩余天数
  let remainingDays = 0;
  if (currentTier.commission_rate === 0) {
    const tierEndDays = currentTier.months_to * 30;
    remainingDays = Math.max(0, tierEndDays - daysDiff);
  }

  return {
    inGracePeriod: currentTier.commission_rate === 0,
    remainingDays,
    totalGraceDays: currentTier.months_to * 30,
    daysUsed: daysDiff,
    tierInfo: {
      id: currentTier.id,
      name: currentTier.name,
      rate: currentTier.commission_rate
    }
  };
}

/**
 * 获取用户的免佣到期时间
 * @param {object} user - 用户对象
 * @param {object} db - 数据库对象
 * @returns {string|null} ISO日期字符串或null
 */
function getUserGraceEndDate(user, db) {
  const config = db.platform_config || {};
  if (config.global_free_commission) return null; // 全网免佣无到期
  
  const tiers = db.commission_tiers || [];
  const graceTier = tiers.find(t => t.commission_rate === 0 && t.status === 1);
  if (!graceTier) return null;
  
  const registerTime = new Date(user.register_time || user.create_time);
  const graceEnd = new Date(registerTime.getTime() + graceTier.months_to * 30 * 24 * 60 * 60 * 1000);
  
  if (graceEnd > new Date()) {
    return graceEnd.toISOString();
  }
  return null;
}

/**
 * 获取司机当前运行模式
 * @param {number} driverId - 司机用户ID
 * @param {object} db - 数据库对象
 * @returns {number} 0=直达模式 1=顺路模式
 */
function getDriverMode(driverId, db) {
  const modeRecord = db.driver_modes?.find(m => m.driver_id === driverId);
  return modeRecord?.mode ?? 1; // 默认顺路模式
}

/**
 * 设置司机运行模式
 * @param {number} driverId - 司机用户ID
 * @param {number} mode - 模式 0=直达 1=顺路
 * @param {object} db - 数据库对象
 */
function setDriverMode(driverId, mode, db) {
  if (!db.driver_modes) db.driver_modes = [];
  
  const existing = db.driver_modes.find(m => m.driver_id === driverId);
  if (existing) {
    existing.mode = mode;
    existing.updated_at = new Date().toISOString();
  } else {
    db.driver_modes.push({
      id: db.nextIds.driver_mode++,
      driver_id: driverId,
      mode: mode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
}

/**
 * 检查司机是否可以拒单（顺路模式下每趟1次免费）
 * @param {number} driverId - 司机ID
 * @param {number} routeId - 行程ID
 * @param {object} db - 数据库对象
 * @returns {object} { canReject, rejectUsed, rejectLeft }
 */
function checkRejectionQuota(driverId, routeId, db) {
  const driverMode = getDriverMode(driverId, db);
  
  // 直达模式不允许拒单
  if (driverMode === 0) {
    return {
      canReject: false,
      reason: '直达模式不允许中途拒单',
      rejectUsed: 0,
      rejectLeft: 0
    };
  }
  
  // 顺路模式：每趟行程1次免费拒单
  // 查找该司机当前行程的拒单记录
  const rejectionLogs = db.rejection_logs?.filter(log => 
    log.driver_id === driverId && 
    log.route_id === routeId
  ) || [];
  
  const usedCount = rejectionLogs.length;
  const maxFreeRejects = 1;
  
  if (usedCount < maxFreeRejects) {
    return {
      canReject: true,
      rejectUsed: usedCount,
      rejectLeft: maxFreeRejects - usedCount,
      willDeductScore: false
    };
  } else {
    return {
      canReject: true,
      rejectUsed: usedCount,
      rejectLeft: 0,
      willDeductScore: true, // 超额会扣评分
      scoreDeduction: 0.5   // 每次超额拒单扣0.5分
    };
  }
}

/**
 * 记录拒单
 * @param {number} driverId - 司机ID
 * @param {number} routeId - 行程ID
 * @param {number} orderId - 订单ID
 * @param {object} db - 数据库对象
 */
function recordRejection(driverId, routeId, orderId, db) {
  if (!db.rejection_logs) db.rejection_logs = [];
  
  db.rejection_logs.push({
    id: db.nextIds.rejection_log++,
    driver_id: driverId,
    route_id: routeId,
    order_id: orderId,
    created_at: new Date().toISOString()
  });
  
  // 如果超额拒单，扣除评分
  const quota = checkRejectionQuota(driverId, routeId, db);
  if (quota.willDeductScore) {
    deductDriverScore(driverId, quota.scoreDeduction, db);
  }
}

/**
 * 扣除司机评分
 * @param {number} driverId - 司机ID
 * @param {number} deduction - 扣除分数
 * @param {object} db - 数据库对象
 */
function deductDriverScore(driverId, deduction, db) {
  const user = db.users.find(u => u.id === driverId);
  if (!user) return;
  
  // 初始化或更新评分
  const currentScore = user.score || 5.0;
  user.score = Math.max(0, currentScore - deduction);
  
  // 记录评分变更日志
  if (!db.score_logs) db.score_logs = [];
  db.score_logs.push({
    id: db.nextIds.score_log || 1,
    user_id: driverId,
    change: -deduction,
    reason: '超额拒单',
    created_at: new Date().toISOString()
  });
  db.nextIds.score_log = (db.nextIds.score_log || 1) + 1;
}

/**
 * 司机上报GPS位置
 * @param {number} driverId - 司机ID
 * @param {number} lat - 纬度
 * @param {number} lng - 经度
 * @param {string} address - 地址（可选）
 * @param {object} db - 数据库对象
 */
function updateDriverLocation(driverId, lat, lng, address, db) {
  if (!db.driver_locations) db.driver_locations = [];
  
  const now = new Date().toISOString();
  const existing = db.driver_locations.find(l => l.driver_id === driverId);
  
  const locationRecord = {
    driver_id: driverId,
    lat,
    lng,
    address: address || '',
    updated_at: now
  };
  
  if (existing) {
    existing.lat = lat;
    existing.lng = lng;
    existing.address = address || existing.address;
    existing.updated_at = now;
    existing.history = existing.history || [];
    existing.history.push({ lat, lng, address: address || '', timestamp: now });
    // 保留最近100条历史
    if (existing.history.length > 100) {
      existing.history = existing.history.slice(-100);
    }
  } else {
    locationRecord.id = db.nextIds.driver_location++;
    locationRecord.created_at = now;
    locationRecord.history = [];
    db.driver_locations.push(locationRecord);
  }
}

/**
 * 获取司机轨迹
 * @param {number} driverId - 司机ID
 * @param {number} hours - 最近几小时（默认24）
 * @param {object} db - 数据库对象
 * @returns {Array} 轨迹点列表
 */
function getDriverTrack(driverId, hours = 24, db) {
  const location = db.driver_locations?.find(l => l.driver_id === driverId);
  if (!location || !location.history) return [];
  
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return location.history.filter(h => new Date(h.timestamp) > cutoff);
}

/**
 * 获取平台当前佣金模式描述
 * @param {object} db - 数据库对象
 * @returns {string} 模式描述
 */
function getCommissionModeDesc(db) {
  const config = db.platform_config || {};
  
  const modeNames = {
    0: '三段阶梯模式',
    1: '全网免佣模式',
    2: '固定佣金模式',
    3: '标准佣金模式'
  };
  
  let desc = modeNames[config.commission_mode] || '未知模式';
  
  if (config.global_free_commission) {
    desc = '全网免佣中';
  }
  
  return desc;
}

/**
 * 获取佣金规则摘要（用于前端显示）
 * @param {object} db - 数据库对象
 * @returns {Array} 规则列表
 */
function getCommissionRulesSummary(db) {
  const config = db.platform_config || {};
  const tiers = db.commission_tiers || [];
  
  // 如果全局免佣
  if (config.global_free_commission) {
    return [{
      period: '全平台',
      rate: 0,
      desc: '全网免佣'
    }];
  }
  
  // 返回阶梯规则
  return tiers
    .filter(t => t.status === 1)
    .sort((a, b) => a.order - b.order)
    .map(t => ({
      period: t.months_from === 0 ? `注册1-${t.months_to}月` : `注册${t.months_from}-${t.months_to}月`,
      rate: t.commission_rate,
      desc: t.name
    }));
}

// 导出所有函数
module.exports = {
  getUserCommissionRate,
  calculateCommission,
  getUserGracePeriodInfo,
  getUserGraceEndDate,
  getDriverMode,
  setDriverMode,
  checkRejectionQuota,
  recordRejection,
  deductDriverScore,
  updateDriverLocation,
  getDriverTrack,
  getCommissionModeDesc,
  getCommissionRulesSummary
};