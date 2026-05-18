/**
 * 司机模式 & GPS API - V1.2
 * 包含：司机双模式、GPS位置、拒单记录
 */

const commissionEngine = require('../utils/commissionEngine');

// ========== 司机模式 API ==========

// 获取当前司机模式
function handleDriverMode(req, res, pathname, method, db, user) {
  const driverId = user.userId;
  
  // GET /api/driver/mode - 获取当前模式
  if (pathname === '/api/driver/mode' && method === 'GET') {
    const mode = commissionEngine.getDriverMode(driverId, db);
    const modeName = mode === 0 ? '直达模式' : '顺路模式';
    
    return {
      code: 0,
      data: {
        mode: mode,
        mode_name: modeName,
        description: mode === 0 
          ? '仅接收起点到终点的完整订单，不接受中途货源'
          : '可接收沿途顺路货源，中途可装卸货'
      }
    };
  }
  
  // PUT /api/driver/mode - 切换模式
  if (pathname === '/api/driver/mode' && method === 'PUT') {
    // 解析body
    let bodyRaw = '';
    req.on('data', chunk => bodyRaw += chunk);
    req.on('end', () => {
      try {
        const { mode } = JSON.parse(bodyRaw);
        const modeInt = parseInt(mode);
        
        if (modeInt !== 0 && modeInt !== 1) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, msg: '模式值错误，0=直达 1=顺路' }));
          return;
        }
        
        commissionEngine.setDriverMode(driverId, modeInt, db);
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          code: 0,
          msg: '模式切换成功',
          data: {
            mode: modeInt,
            mode_name: modeInt === 0 ? '直达模式' : '顺路模式'
          }
        }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 500, msg: '参数解析错误' }));
      }
    });
    return null; // 异步处理
  }
  
  return null;
}

// ========== 拒单 API ==========

// 检查拒单配额
function handleRejectionQuota(req, res, pathname, method, db, user) {
  if (pathname === '/api/driver/rejection-quota' && method === 'GET') {
    const { route_id } = parseQuery(pathname);
    
    // 从URL参数获取route_id
    const urlParts = pathname.split('?');
    const params = new URLSearchParams(urlParts[1] || '');
    const routeId = parseInt(params.get('route_id')) || 0;
    
    const quota = commissionEngine.checkRejectionQuota(user.userId, routeId, db);
    
    return {
      code: 0,
      data: quota
    };
  }
  
  return null;
}

// 执行拒单
function handleReject(req, res, pathname, method, db, user) {
  if (pathname === '/api/driver/reject' && method === 'POST') {
    // 异步处理
    let bodyRaw = '';
    req.on('data', chunk => bodyRaw += chunk);
    req.on('end', () => {
      try {
        const { order_id, route_id } = JSON.parse(bodyRaw);
        const orderId = parseInt(order_id);
        const routeId = parseInt(route_id) || 0;
        
        // 检查配额
        const quota = commissionEngine.checkRejectionQuota(user.userId, routeId, db);
        
        if (!quota.canReject) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ 
            code: 400, 
            msg: quota.reason || '当前模式不允许拒单' 
          }));
          return;
        }
        
        // 记录拒单
        commissionEngine.recordRejection(user.userId, routeId, orderId, db);
        
        // 更新订单状态为已取消
        const order = db.orders.find(o => o.id === orderId);
        if (order) {
          order.status = 6; // 已取消
          order.cancel_time = new Date().toISOString();
          order.cancel_type = 'driver_reject';
          order.reject_count = (order.reject_count || 0) + 1;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          code: 0,
          msg: quota.willDeductScore 
            ? `拒单成功，将扣除${quota.scoreDeduction}分评分` 
            : '拒单成功（本次免费）',
          data: {
            reject_used: quota.rejectUsed + 1,
            reject_left: Math.max(0, 1 - quota.rejectUsed - 1),
            will_deduct_score: quota.willDeductScore,
            score_deduction: quota.scoreDeduction || 0
          }
        }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 500, msg: '参数解析错误' }));
      }
    });
    return null;
  }
  
  return null;
}

// ========== GPS 位置 API ==========

// 上报GPS位置
function handleLocationUpdate(req, res, pathname, method, db, user) {
  if (pathname === '/api/driver/location' && method === 'POST') {
    let bodyRaw = '';
    req.on('data', chunk => bodyRaw += chunk);
    req.on('end', () => {
      try {
        const { lat, lng, address, speed, direction } = JSON.parse(bodyRaw);
        
        if (!lat || !lng) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ code: 400, msg: '经纬度不能为空' }));
          return;
        }
        
        commissionEngine.updateDriverLocation(
          user.userId, 
          parseFloat(lat), 
          parseFloat(lng), 
          address || '',
          db
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          code: 0,
          msg: '位置更新成功',
          data: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            timestamp: new Date().toISOString()
          }
        }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ code: 500, msg: '参数解析错误' }));
      }
    });
    return null;
  }
  
  // 获取司机位置
  if (pathname.startsWith('/api/driver/location/') && method === 'GET') {
    const driverId = parseInt(pathname.split('/')[4]);
    const location = db.driver_locations?.find(l => l.driver_id === driverId);
    
    return {
      code: 0,
      data: location ? {
        lat: location.lat,
        lng: location.lng,
        address: location.address || '',
        updated_at: location.updated_at
      } : null
    };
  }
  
  // 获取轨迹
  if (pathname === '/api/driver/track' && method === 'GET') {
    const urlParts = pathname.split('?');
    const params = new URLSearchParams(urlParts[1] || '');
    const hours = parseInt(params.get('hours')) || 24;
    
    const track = commissionEngine.getDriverTrack(user.userId, hours, db);
    
    return {
      code: 0,
      data: {
        points: track,
        count: track.length
      }
    };
  }
  
  return null;
}

// ========== 佣金信息 API ==========

// 获取当前用户的佣金信息
function handleCommissionInfo(req, res, pathname, method, db, user) {
  if (pathname === '/api/commission/info' && method === 'GET') {
    const currentUser = db.users.find(u => u.id === user.userId);
    
    if (!currentUser) {
      return { code: 404, msg: '用户不存在' };
    }
    
    const commissionInfo = commissionEngine.getUserCommissionRate(currentUser, db);
    const graceInfo = commissionEngine.getUserGracePeriodInfo(currentUser, db);
    const rulesSummary = commissionEngine.getCommissionRulesSummary(db);
    
    return {
      code: 0,
      data: {
        commission_rate: commissionInfo.commissionRate,
        rate_source: commissionInfo.source,
        rate_description: commissionInfo.description,
        grace_period: graceInfo,
        commission_rules: rulesSummary,
        platform_mode: commissionEngine.getCommissionModeDesc(db)
      }
    };
  }
  
  return null;
}

// ========== 辅助函数 ==========
function parseQuery(pathname) {
  const urlParts = pathname.split('?');
  if (urlParts.length < 2) return {};
  const params = new URLSearchParams(urlParts[1]);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

module.exports = {
  handleDriverMode,
  handleRejectionQuota,
  handleReject,
  handleLocationUpdate,
  handleCommissionInfo
};