/**
 * 顺路货运撮合平台 - 纯Node.js内置模块版
 * 功能：用户 | 商家 | 司机 | 订单 | 钱包 | 运营后台
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const formidable = require('formidable');
const smartMatch = require('./smartMatch');
const { hasPermission, getUserPermissions, checkLimit, requirePermission } = require('./permissionMiddleware');
const sms = require('./utils/sms');

// 微信小程序配置
const WX_APPID = 'wx2eeb6db23cb14dca';
const WX_SECRET = 'b6c5476497318c5ef49d45f282f5a69b';

// 封装HTTPS GET请求
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('解析微信响应失败')); }
      });
    }).on('error', reject);
  });
}

// 简易SQLite（用JSON文件模拟数据库）
const DB_FILE = path.join(__dirname, '../data/db.json');

// 初始化数据库
function initDB() {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const emptyDB = {
      users: [],
      merchant_auths: [],
      driver_auths: [],
      goods: [],
      routes: [],
      orders: [],
      wallets: [],
      transactions: [],
      region_configs: [
        { id: 1, province: '四川', city: '甘孜', area: null, commission_rate: 6.00, private_rate: 12.00, status: 1 },
        { id: 2, province: '四川', city: '阿坝', area: null, commission_rate: 6.00, private_rate: 12.00, status: 1 }
      ],
      photos: [],
      messages: [],
      blacklist: [],      // 黑名单记录
      complaints: [],      // 投诉记录
      call_logs: [],       // 通话记录
      settlements: [],     // 结算单
      nextIds: { user: 1, merchant_auth: 1, driver_auth: 1, goods: 1, route: 1, order: 1, wallet: 1, photo: 1, message: 1, transaction: 1, blacklist: 1, complaint: 1, call_log: 1, settlement: 1 }
    };
    // 种子用户（审核人员可用这些账号登录）
    const hashedPwd = '92b4477eab43adc555c9aea7b959684845d750e5946705a9c00b4137b2a5f15d'; // 123456
    emptyDB.users = [
      { id: 1, phone: '13800001111', password: hashedPwd, role: 1, nickname: '测试商家', avatar: '', status: 1, create_time: new Date().toISOString() },
      { id: 2, phone: '13900000002', password: hashedPwd, role: 2, nickname: '测试司机', avatar: '', status: 1, create_time: new Date().toISOString() },
      { id: 3, phone: '13900000003', password: hashedPwd, role: 3, nickname: '测试私家车', avatar: '', status: 1, create_time: new Date().toISOString() },
      { id: 4, phone: '13900000001', password: hashedPwd, role: 5, nickname: '测试个人', avatar: '', status: 1, create_time: new Date().toISOString() },
      { id: 5, phone: 'admin', password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 4, nickname: '管理员', avatar: '', status: 1, create_time: new Date().toISOString() },
    ];
    emptyDB.nextIds.user = 6;
    // 钱包
    emptyDB.wallets = emptyDB.users.map(u => ({ id: u.id, user_id: u.id, balance: 0, frozen: 0, create_time: new Date().toISOString() }));
    emptyDB.nextIds.wallet = 6;
    fs.writeFileSync(DB_FILE, JSON.stringify(emptyDB, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// 工具函数
function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd + 'shunlu_salt').digest('hex');
}

function generateToken(userId, role) {
  const payload = { userId, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ==================== 计价规则 ====================

/**
 * 计算运费和抽成
 * @param {number} distance 距离(km)
 * @param {number} weight 重量(kg)
 * @param {number} volume 体积(m³，可选)
 * @param {number} driverType 司机类型 2=货车 3=私家车
 * @param {string} pickupZone 取货区域（判断是否县城内）
 * @param {string} deliveryZone 送达区域
 * @returns {object} { freight, commission, driverIncome, details }
 */
function calculatePrice(distance, weight, driverType, pickupZone = '', deliveryZone = '') {
  const isCounty = isCountyDelivery(pickupZone, deliveryZone);
  const result = { freight: 0, commission: 0, driverIncome: 0, details: '' };  
  
  if (driverType === 3) { // 私家车（≤20kg小件）
    if (isCounty) {
      // 县城内：固定10元
      result.freight = 10;
      result.commission = Math.round(result.freight * 0.1 * 10) / 10; // 10%抽成
    } else {
      // 跨城：起步价10元 + 里程阶梯加价
      let freight = 10;
      if (distance <= 100) {
        freight += distance * 0.2;
      } else if (distance <= 200) {
        freight += 100 * 0.2 + (distance - 100) * 0.15;
      } else {
        freight += 100 * 0.2 + 100 * 0.15 + (distance - 200) * 0.1;
      }
      result.freight = Math.round(freight * 10) / 10;
      result.commission = Math.round(result.freight * 0.1 * 10) / 10; // 10%抽成
    }
    result.details = `私家车 | ${isCounty ? '县城内固定' : `${distance}km起步10元+阶梯`} | 运费¥${result.freight} | 抽成¥${result.commission}`;
  } else { // 货车
    const tons = weight / 1000; // kg转吨
    const isOneTon = tons <= 1;
    
    // 基础里程单价
    let unitPrice = 0;
    if (distance <= 100) unitPrice = 1.2;
    else if (distance <= 200) unitPrice = 1;
    else if (distance <= 300) unitPrice = 1;
    else unitPrice = 0.5;
    
    if (isCounty) {
      // 县城内：起步价50元 + 吨位计算
      result.freight = Math.max(50, unitPrice * distance * Math.max(tons, 1));
      result.commission = Math.round(result.freight * 0.1 * 10) / 10; // 10%抽成
    } else {
      // 县城外：里程单价 × 公里数 × 吨位
      result.freight = unitPrice * distance * Math.max(tons, 1);
      result.commission = Math.round(result.freight * 0.1 * 10) / 10; // 10%抽成
    }
    result.freight = Math.round(result.freight);
    result.details = `货车${isOneTon ? '(1吨标准)' : `(${tons.toFixed(2)}吨)`} | ${isCounty ? '县城内起步50元' : `${distance}km单价¥${unitPrice}/km`} | 运费¥${result.freight} | 抽成¥${result.commission}`;
  }
  
  result.driverIncome = Math.round((result.freight - result.commission) * 10) / 10;
  return result;
}

/**
 * 判断是否县城内配送（两端都在县城/城区才算）
 */
function isCountyDelivery(pickupZone, deliveryZone) {
  const countyKeywords = ['县城', '城区', '市中心', '镇中心', '康定城区', '炉霍城区', '甘孜城区'];
  const pickupIsCounty = countyKeywords.some(k => pickupZone?.includes(k));
  const deliveryIsCounty = countyKeywords.some(k => deliveryZone?.includes(k));
  // 两端都在县城/城区才算县城内
  return pickupIsCounty && deliveryIsCounty;
}

/**
 * 获取县城关键词列表
 */
function getCountyKeywords() {
  return ['县城', '城区', '市中心', '镇中心', '康定城区', '炉霍城区', '甘孜城区', '新都桥', '塔公镇', '雅拉乡'];
}

// ==================== API路由 ====================

// ==================== 结算单辅助函数 ====================

/**
 * 订单完成后创建结算单（不再直接打款，改为待审核）
 * @param {object} order 订单对象
 * @param {object} db 数据库对象
 * @returns {number|null} 新结算单ID或null
 */
function createSettlement(order, db) {
  if (!order) return null;
  // 防止重复创建：检查该订单是否已有结算单
  const existing = db.settlements.find(s => s.order_id === order.id);
  if (existing) return existing.id;
  const id = db.nextIds.settlement++;
  db.settlements.push({
    id,
    order_id: order.id,
    driver_id: order.driver_id || null,
    merchant_id: order.merchant_id || null,
    amount: order.driver_amount || 0,       // 司机应得（运费-平台抽成）
    commission_fee: order.commission_fee || 0, // 平台抽成
    freight: order.price || 0,               // 总运费
    status: 'pending',
    create_time: new Date().toISOString(),
    reject_reason: null,
    approve_time: null
  });
  return id;
}

async function handleApi(req, res, pathname, method) {
  const db = initDB();
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const user = token ? verifyToken(token) : null;

  // ========== 微信登录 ==========
  // 微信一键登录：用 code 换 openid，自动登录或提示注册
  if (pathname === '/api/auth/wx-login' && method === 'POST') {
    const { code, role } = await parseBody(req);
    if (!code) return sendJson(res, { code: 400, msg: '缺少微信code' }, 400);

    try {
      // 调用微信接口换取 openid + session_key
      const wxRes = await httpsGet(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`
      );

      if (wxRes.errcode) {
        console.error('微信登录失败:', wxRes.errmsg);
        return sendJson(res, { code: 400, msg: '微信登录失败: ' + wxRes.errmsg }, 400);
      }

      const { openid, session_key } = wxRes;
      if (!openid) return sendJson(res, { code: 400, msg: '获取openid失败' }, 400);

      // 查找是否已有此openid的用户
      const existingUser = db.users.find(u => u.wx_openid === openid);
      if (existingUser) {
        // 已注册 → 直接登录
        const token = generateToken(existingUser.id, existingUser.role);
        return sendJson(res, {
          code: 0,
          msg: '登录成功',
          data: {
            token,
            user_id: existingUser.id,
            role: existingUser.role,
            is_new: false
          }
        });
      }

      // 未注册 → 返回openid，前端引导注册
      return sendJson(res, {
        code: 0,
        msg: '新用户，需要注册',
        data: {
          openid,
          session_key,
          is_new: true
        }
      });
    } catch (err) {
      console.error('wx-login error:', err.message);
      return sendJson(res, { code: 500, msg: '微信登录异常' }, 500);
    }
  }

  // 微信一键注册：openid + 角色信息 完成注册
  if (pathname === '/api/auth/wx-register' && method === 'POST') {
    const { openid, role, real_name, id_card, phone, password } = await parseBody(req);
    if (!openid) return sendJson(res, { code: 400, msg: '缺少openid' }, 400);
    if (!role) return sendJson(res, { code: 400, msg: '请选择角色' }, 400);
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return sendJson(res, { code: 400, msg: '手机号格式错误' }, 400);
    if (!real_name) return sendJson(res, { code: 400, msg: '请输入真实姓名' }, 400);
    if (!id_card || !/^\d{17}[\dXx]$/.test(id_card)) return sendJson(res, { code: 400, msg: '身份证号格式错误' }, 400);

    // 检查手机号是否已注册
    if (db.users.find(u => u.phone === phone)) return sendJson(res, { code: 400, msg: '手机号已注册' }, 400);
    // 检查openid是否已注册
    if (db.users.find(u => u.wx_openid === openid)) return sendJson(res, { code: 400, msg: '该微信已注册' }, 400);

    const roleInt = parseInt(role);
    const userId = db.nextIds.user++;
    const newUser = {
      id: userId,
      phone,
      password: password ? hashPassword(password) : '',
      role: roleInt,
      real_name,
      id_card,
      wx_openid: openid,
      status: 1,
      create_time: new Date().toISOString()
    };

    // 司机/私家车 额外字段（选填，后续补传）
    if (roleInt === 2 || roleInt === 3) {
      newUser.license_no = '';
      newUser.vehicle_plate = '';
      newUser.vehicle_photos = [];
    }

    db.users.push(newUser);
    saveDB(db);

    const token = generateToken(userId, roleInt);
    return sendJson(res, {
      code: 0,
      msg: '注册成功',
      data: { token, user_id: userId }
    });
  }

  // 获取微信手机号（需企业认证，当前为模拟）
  if (pathname === '/api/auth/wx-phone' && method === 'POST') {
    const { code } = await parseBody(req);
    // 正式版需调用微信 getPhoneNumber 接口
    // 当前返回模拟数据
    return sendJson(res, {
      code: 0,
      msg: '模拟模式',
      data: { phone: '13800000000' }
    });
  }

  // ========== 用户相关 ==========
  if (pathname === '/api/user/register' && method === 'POST') {
    const { phone, password, role, real_name, id_card, license_no, vehicle_plate, vehicle_photos, business_license } = await parseBody(req);
    if (!phone || !password || !role) return sendJson(res, { code: 400, msg: '手机号、密码、角色不能为空' }, 400);
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) return sendJson(res, { code: 400, msg: '手机号格式错误' }, 400);
    if (!password || password.length < 6) return sendJson(res, { code: 400, msg: '密码至少6位' }, 400);
    if (!real_name) return sendJson(res, { code: 400, msg: '请输入真实姓名' }, 400);
    if (!id_card) return sendJson(res, { code: 400, msg: '请输入身份证号' }, 400);
    if (!/^\d{17}[\dXx]$/.test(id_card)) return sendJson(res, { code: 400, msg: '身份证号格式错误' }, 400);

    const roleInt = parseInt(role);
    // 司机/私家车 驾驶证/车牌 注册时不强制，可后续在个人中心补传

    if (db.users.find(u => u.phone === phone)) return sendJson(res, { code: 400, msg: '手机号已注册' }, 400);

    const userId = db.nextIds.user++;
    const newUser = {
      id: userId,
      phone,
      password: hashPassword(password),
      role: roleInt,
      real_name,
      id_card,
      status: 1,
      create_time: new Date().toISOString()
    };

    // 司机/私家车 额外字段
    if (roleInt === 2 || roleInt === 3) {
      newUser.license_no = license_no || '';
      newUser.vehicle_plate = vehicle_plate || '';
      newUser.vehicle_photos = vehicle_photos || [];
    }

    // 商家 营业执照
    if (roleInt === 1) {
      newUser.business_license = business_license || '';
    }

    db.users.push(newUser);
    // 创建钱包
    db.wallets.push({ id: db.nextIds.wallet++, user_id: userId, balance: 0, frozen_amount: 0 });
    saveDB(db);

    return sendJson(res, { code: 0, msg: '注册成功', data: { token: generateToken(userId, role), user_id: userId } });
  }

  // 调试测试接口
  if (pathname === '/api/test' && method === 'GET') {
    return sendJson(res, { code: 0, msg: '后端连通正常', data: { time: Date.now(), server: 'ok' } });
  }

  if (pathname === '/api/user/login' && method === 'POST') {
    let bodyRaw = '';
    try {
      bodyRaw = await parseBody(req);
    } catch (e) {
      console.log('[LOGIN DEBUG] parseBody error:', e.message);
    }
    const { phone, password } = bodyRaw || {};
    console.log('[LOGIN DEBUG] phone:', phone, 'password length:', password ? password.length : 'undefined');
    const user = db.users.find(u => u.phone === phone);
    if (!user) {
      console.log('[LOGIN DEBUG] user not found, all phones:', db.users.map(u => u.phone));
      return sendJson(res, { code: 401, msg: '账号不存在' }, 401);
    }
    const inputHash = hashPassword(password);
    console.log('[LOGIN DEBUG] inputHash:', inputHash, 'dbHash:', user.password, 'match:', inputHash === user.password);
    if (!user || inputHash !== user.password) {
      return sendJson(res, { code: 401, msg: '账号或密码错误' }, 401);
    }
    return sendJson(res, { code: 0, msg: '登录成功', data: { token: generateToken(user.id, user.role), userInfo: user } });
  }

  if (pathname === '/api/user/real-auth' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { real_name, id_card, img_url } = await parseBody(req);
    const u = db.users.find(u => u.id === user.userId);
    if (u) { u.real_name = real_name; u.id_card = id_card; }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '实名认证成功' });
  }

  // 司机/私家车 更新驾驶证和车辆信息
  if (pathname === '/api/user/update-driver-info' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    if (user.role !== 2 && user.role !== 3) return sendJson(res, { code: 403, msg: '仅司机可操作' }, 403);
    const { license_no, vehicle_plate, vehicle_photos } = await parseBody(req);
    if (!license_no) return sendJson(res, { code: 400, msg: '请输入驾驶证号' }, 400);
    if (!vehicle_plate) return sendJson(res, { code: 400, msg: '请输入车牌号' }, 400);
    const u = db.users.find(u => u.id === user.userId);
    if (!u) return sendJson(res, { code: 404, msg: '用户不存在' }, 404);
    u.license_no = license_no;
    u.vehicle_plate = vehicle_plate;
    u.vehicle_photos = vehicle_photos || [];
    // 标记为已完善信息
    u.driver_info_completed = true;
    saveDB(db);
    return sendJson(res, { code: 0, msg: '信息更新成功' });
  }

  // 获取司机证件信息
  if (pathname === '/api/user/driver-info' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const u = db.users.find(u => u.id === user.userId);
    if (!u) return sendJson(res, { code: 404, msg: '用户不存在' }, 404);
    return sendJson(res, { code: 0, data: {
      license_no: u.license_no || '',
      vehicle_plate: u.vehicle_plate || '',
      vehicle_photos: u.vehicle_photos || [],
      driver_info_completed: u.driver_info_completed || false
    }});
  }

  // ========== 商家相关 ==========
  if (pathname === '/api/merchant/publish-goods' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '请先登录' }, 401);
    if (!hasPermission(user.role, 'goods:publish')) return sendJson(res, { code: 403, msg: '权限不足：无法发布货源' }, 403);
    const { start_addr, end_addr, weight, price, goods_value, remark, sender_name, sender_phone, receiver_name, receiver_phone, photo_urls, departure_time, waypoints } = await parseBody(req);
    
    const goodsId = db.nextIds.goods++;
    
    // 为中途装卸点生成二维码和取件码
    const waypointsWithCodes = (waypoints || []).map((wp, index) => ({
      ...wp,
      qr_code: `waypoint:${goodsId}:${index}:${Date.now()}`,
      pickup_code: Math.floor(100000 + Math.random() * 900000).toString() // 6位随机数字
    }));
    
    db.goods.push({
      id: goodsId,
      merchant_id: user.userId,
      start_addr, end_addr,
      weight: parseFloat(weight),
      price: parseFloat(price),
      goods_value: parseFloat(goods_value || 0),
      remark,
      sender_name: sender_name || '',
      sender_phone: sender_phone || '',
      receiver_name: receiver_name || '',
      receiver_phone: receiver_phone || '',
      photo_urls: photo_urls || [],
      departure_time: departure_time || '',
      waypoints: waypointsWithCodes,  // 中途装卸点（包含二维码和取件码）
      status: 1, // 待接单
      create_time: new Date().toISOString()
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '发布成功', data: { goods_id: goodsId } });
  }

  if (pathname === '/api/merchant/goods-list' && method === 'GET') {
    if (!user || user.role !== 1) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const list = db.goods.filter(g => g.merchant_id === user.userId);
    return sendJson(res, { code: 0, data: list });
  }

  // 商家查看自己的订单
  if (pathname === '/api/merchant/orders' && method === 'GET') {
    if (!user || user.role !== 1) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const list = db.orders.filter(o => o.merchant_id === user.userId);
    return sendJson(res, { code: 0, data: list });
  }

  // 商家订单详情
  if (pathname.startsWith('/api/merchant/order/') && method === 'GET') {
    if (!user || user.role !== 1) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const orderId = parseInt(pathname.split('/').pop());
    const order = db.orders.find(o => o.id === orderId && o.merchant_id === user.userId);
    if (!order) return sendJson(res, { code: 404, msg: '订单不存在' }, 404);
    // 附加货物照片
    if (order.goods_id) {
      const goods = db.goods.find(g => g.id === order.goods_id);
      if (goods) {
        order.goods = goods;
        order.photo_urls = goods.photo_urls || [];
        // 中途装卸点（包含二维码和取件码）
        if (goods.waypoints && goods.waypoints.length > 0) {
          order.waypoints = goods.waypoints.map((wp, index) => {
            // 为每个waypoint生成二维码图片
            let qr_url = '';
            try {
              // 注意：这里不能使用await，因为QRCode.toDataURL是异步的
              // 我们先返回qr_code，前端再调用API获取二维码图片
              qr_url = wp.qr_code;  // 先返回qr_code内容
            } catch(e) {}
            return {
              ...wp,
              qr_url: qr_url  // 前端需要调用 /api/goods/:goodsId/waypoint/:index/qrcode 获取图片
            };
          });
        }
      }
    }
    return sendJson(res, { code: 0, data: order });
  }

  // ========== 司机相关 ==========
  if (pathname === '/api/driver/publish-route' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '请先登录' }, 401);
    if (!hasPermission(user.role, 'route:publish')) return sendJson(res, { code: 403, msg: '权限不足：无法发布路线' }, 403);
    const { start_addr, end_addr, departure_time, space, remark, license_plate, vehicle_photos,
           start_lat, start_lng, end_lat, end_lng } = await parseBody(req);

    const routeId = db.nextIds.route++;
    db.routes.push({
      id: routeId,
      driver_id: user.userId,
      driver_type: user.role, // 2-货车 3-私家车
      start_addr, end_addr,
      departure_time: departure_time || '',
      depart_time: departure_time || '',
      remain_space: parseFloat(space) || 0,
      space: parseFloat(space) || 0,
      remark: remark || '',
      license_plate: license_plate || '',
      vehicle_photos: vehicle_photos || [],
      start_lat: parseFloat(start_lat) || 0,
      start_lng: parseFloat(start_lng) || 0,
      end_lat: parseFloat(end_lat) || 0,
      end_lng: parseFloat(end_lng) || 0,
      status: 1,
      create_time: new Date().toISOString(),
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '行程发布成功', data: { route_id: routeId } });
  }

  // ========== 司机找货源（智能匹配） ==========
  if (pathname === '/api/driver/match-goods' && method === 'GET') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const pendingGoods = db.goods.filter(g => g.status === 1);
    // 获取司机模式
    const driverModeRecord = db.driver_modes.find(d => d.driver_id === user.userId);
    const driverMode = driverModeRecord ? driverModeRecord.mode : 0; // 默认直达模式
    const result = smartMatch.matchGoodsForDriver(user, pendingGoods, db.routes, db.orders, driverMode);
    return sendJson(res, { code: 0, data: result, total: result.length });
  }

  if (pathname === '/api/driver/take-order' && method === 'POST') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '仅司机可接单' }, 401);
    // 检查审核状态
    const driverUser = db.users.find(u => u.id === user.userId);
    if (driverUser && driverUser.audit_status === 'pending') {
      return sendJson(res, { code: 403, msg: '您的证件审核中，请等待审核通过后再接单' }, 403);
    }
    if (driverUser && driverUser.audit_status === 'rejected') {
      return sendJson(res, { code: 403, msg: '您的证件审核未通过，请重新提交资料' }, 403);
    }
    const { goods_id } = await parseBody(req);
    const goods = db.goods.find(g => g.id === parseInt(goods_id));
    if (!goods || goods.status !== 1) return sendJson(res, { code: 400, msg: '货源不可用' }, 400);
    
    // 载重限制检查（所有订单）
    if (goods.weight > 4500) {
      return sendJson(res, { code: 400, msg: '订单载重不得超过4.5吨（当前' + goods.weight + 'kg）' }, 400);
    }
    
    // 私家车约束检查
    if (user.role === 3) {
      const todayOrders = db.orders.filter(o => 
        o.driver_id === user.userId && 
        o.create_time.startsWith(new Date().toISOString().slice(0, 10))
      ).length;
      if (todayOrders >= 2) return sendJson(res, { code: 400, msg: '私家车每日限接2单' }, 400);
      if (goods.weight > 20) return sendJson(res, { code: 400, msg: '私家车单票限20kg' }, 400);
      if (goods.goods_value > 2000) return sendJson(res, { code: 400, msg: '私家车单票货值限2000元' }, 400);
    }
    
    // 从区域配置读取佣金率
    let commissionRate = user.role === 2 ? 6 : 12; // 默认值
    const regionConfig = db.region_configs.find(r => r.status === 1);
    if (regionConfig) {
      commissionRate = user.role === 2 ? regionConfig.commission_rate : regionConfig.private_rate;
    }
    const commissionFee = Math.round(goods.price * commissionRate) / 100;
    const driverAmount = goods.price - commissionFee;
    
    const orderId = db.nextIds.order++;
    
    // 接单时不生成二维码，等待支付后才生成
    db.orders.push({
      id: orderId,
      goods_id: goods.id,
      merchant_id: goods.merchant_id,
      driver_id: user.userId,
      price: goods.price,
      commission_rate: commissionRate,
      commission_fee: commissionFee,
      driver_amount: driverAmount,
      status: 1, // 待支付（支付后才生成二维码）
      create_time: new Date().toISOString()
    });
    goods.status = 2; // 已接单
    
    // 货车拼载：扣减剩余载重
    if (user.role === 2) {
      const driverRoute = db.routes.find(r => r.driver_id === user.userId && r.status === 1);
      if (driverRoute && goods.weight) {
        driverRoute.remain_space = (driverRoute.remain_space || driverRoute.space || 0) - goods.weight;
        // 如果已满载，更新状态
        if (driverRoute.remain_space <= 0) {
          driverRoute.status = 2; // 已满载
        }
      }
    }
    
    saveDB(db);
    
    return sendJson(res, { 
      code: 0, 
      msg: '接单成功，等待商家支付', 
      data: { 
        order_id: orderId,
        status: 1
      } 
    });
  }

  // ========== 订单相关 ==========
  if (pathname === '/api/order/pay' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id } = await parseBody(req);
    const order = db.orders.find(o => o.id === parseInt(order_id));
    if (!order) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);
    const goods = db.goods.find(g => g.id === order.goods_id);
    const isOwner = order.merchant_id === user.userId || (goods && goods.personal_id === user.userId);
    if (!isOwner) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);
    
    const wallet = db.wallets.find(w => w.user_id === user.userId);
    if (wallet.balance < order.price) return sendJson(res, { code: 400, msg: '余额不足' }, 400);
    
    wallet.balance -= order.price;
    // 生成取货码和送达码
    order.pickup_code = generateCode();
    order.delivery_code = generateCode();
    
    // 生成取货二维码
    const pickupQRPayload = makeQRPayload(order.id, order.pickup_code, 'pickup');
    order.pickup_qr_url = await QRCode.toDataURL('shunlu://pickup?' + pickupQRPayload);
    
    order.status = 2; // 待取货
    order.update_time = new Date().toISOString();
    // 记录支付交易
    db.transactions.push({
      id: db.nextIds.transaction++,
      user_id: user.userId,
      type: 'pay',
      amount: -order.price,
      balance_after: wallet.balance,
      order_id: order.id,
      remark: '运费支付',
      create_time: new Date().toISOString()
    });
    // 冻结金额记录（佣金从付款方钱包冻结，最终结算给司机）
    const driverWallet = db.wallets.find(w => w.user_id === order.driver_id);
    if (driverWallet) {
      wallet.frozen_amount = (wallet.frozen_amount || 0) + order.commission_fee;
      db.transactions.push({
        id: db.nextIds.transaction++,
        user_id: user.userId,  // 冻结发生在付款方账户
        type: 'freeze',
        amount: 0,
        balance_after: wallet.frozen_amount,
        order_id: order.id,
        remark: '运费冻结¥' + order.commission_fee,
        create_time: new Date().toISOString()
      });
    }
    saveDB(db);
    
    // 支付成功后发送送达码(取件码)短信给收件人
    if (goods && goods.receiver_phone && goods.receiver_phone.length === 11) {
      sms.sendPickupCodeSMS(goods.receiver_phone, order.delivery_code, order.id.toString())
        .then(result => console.log(`[短信] 送达码发送成功:`, result))
        .catch(err => console.log(`[短信] 发送失败:`, err.message));
    }
    
    return sendJson(res, { code: 0, msg: '支付成功', data: { pickup_code: order.pickup_code, delivery_code: order.delivery_code, pickup_qr_url: order.pickup_qr_url } });
  }

  if (pathname === '/api/order/sign' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id } = await parseBody(req);
    const order = db.orders.find(o => o.id === parseInt(order_id));
    if (!order) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);
    if (order.status !== 5) return sendJson(res, { code: 400, msg: '当前状态不允许签收' }, 400);
    order.status = 6; // 已完成（1待接单→2已接单→3已取货→4运输中→5已送达→6已完成）
    order.sign_time = new Date().toISOString();
    // 创建结算单（待审核）
    createSettlement(order, db);
    saveDB(db);
    return sendJson(res, { code: 0, msg: '签收成功，订单已完成' });
  }

  // 生成6位取货码
  function generateCode() {
    return Math.random().toString(36).toUpperCase().slice(2, 8);
  }

  // 生成订单二维码数据
  function makeQRPayload(orderId, code, type) {
    const data = { o: orderId, c: code, t: type };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/qrcode') && method === 'GET') {
    const orderId = parseInt(pathname.split('/')[3]);
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return sendJson(res, { code: 404, msg: '订单不存在' }, 404);
    // 如果没有码就生成
    if (!order.pickup_code) {
      order.pickup_code = generateCode();
      order.delivery_code = generateCode();
      saveDB(db);
    }
    try {
      const pickupQR = await QRCode.toDataURL('shunlu://pickup?' + makeQRPayload(orderId, order.pickup_code, 'pickup'));
      const deliveryQR = await QRCode.toDataURL('shunlu://delivery?' + makeQRPayload(orderId, order.delivery_code, 'delivery'));
      return sendJson(res, { code: 0, data: {
        pickup_code: order.pickup_code,
        delivery_code: order.delivery_code,
        qr_url: pickupQR,
        delivery_qr_url: deliveryQR,
      }});
    } catch(e) {
      return sendJson(res, { code: 0, data: {
        pickup_code: order.pickup_code,
        delivery_code: order.delivery_code,
        qr_url: '',
        delivery_qr_url: '',
      }});
    }
  }

  // ========== 中途装卸点二维码 ==========
  // 获取货源二维码（司机扫码接单）
  if (pathname.match(/^\/api\/goods\/\d+\/qrcode$/) && method === 'GET') {
    const goodsId = parseInt(pathname.split('/')[3]);
    const goods = db.goods.find(g => g.id === goodsId);
    if (!goods) return sendJson(res, { code: 404, msg: '货物不存在' }, 404);
    
    // 生成二维码内容
    const qrContent = JSON.stringify({ type: 'goods', id: goodsId });
    try {
      const qrCode = await QRCode.toDataURL(qrContent);
      // 返回图片
      const base64Data = qrCode.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imgBuffer.length
      });
      return res.end(imgBuffer);
    } catch(e) {
      return sendJson(res, { code: 500, msg: '生成二维码失败' }, 500);
    }
  }

  // 获取中途装卸点二维码
  if (pathname.startsWith('/api/goods/') && pathname.endsWith('/waypoint/qrcode') && method === 'GET') {
    const parts = pathname.split('/');
    const goodsId = parseInt(parts[3]);
    const index = parseInt(parts[5]);
    const goods = db.goods.find(g => g.id === goodsId);
    if (!goods) return sendJson(res, { code: 404, msg: '货物不存在' }, 404);
    if (!goods.waypoints || !goods.waypoints[index]) return sendJson(res, { code: 404, msg: '装卸点不存在' }, 404);
    
    const waypoint = goods.waypoints[index];
    try {
      const qrCode = await QRCode.toDataURL(waypoint.qr_code);
      return sendJson(res, { code: 0, data: {
        qr_code: waypoint.qr_code,
        pickup_code: waypoint.pickup_code,
        qr_url: qrCode
      }});
    } catch(e) {
      return sendJson(res, { code: 0, data: {
        qr_code: waypoint.qr_code,
        pickup_code: waypoint.pickup_code,
        qr_url: ''
      }});
    }
  }

  // 验证中途装卸点取件码
  if (pathname.startsWith('/api/goods/') && pathname.includes('/waypoint/verify') && method === 'POST') {
    const parts = pathname.split('/');
    const goodsId = parseInt(parts[3]);
    const index = parseInt(parts[5]);
    const { code } = await parseBody(req);
    
    const goods = db.goods.find(g => g.id === goodsId);
    if (!goods) return sendJson(res, { code: 404, msg: '货物不存在' }, 404);
    if (!goods.waypoints || !goods.waypoints[index]) return sendJson(res, { code: 404, msg: '装卸点不存在' }, 404);
    
    const waypoint = goods.waypoints[index];
    if (waypoint.pickup_code !== code) return sendJson(res, { code: 400, msg: '取件码错误' }, 400);
    
    return sendJson(res, { code: 0, msg: '验证成功', data: { waypoint } });
  }

  // 司机扫码确认取货（新版简化API）
  if (pathname === '/api/order/scan-pickup' && method === 'POST') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '仅司机可操作' }, 401);
    const { order_id, code } = await parseBody(req);
    const orderId = parseInt(order_id);
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return sendJson(res, { code: 404, msg: '订单不存在' }, 404);
    if (order.driver_id !== user.userId) return sendJson(res, { code: 403, msg: '非此订单司机' }, 403);
    if (order.pickup_code !== code) return sendJson(res, { code: 400, msg: '取货码错误' }, 400);
    if (order.status < 2) return sendJson(res, { code: 400, msg: '订单状态不允许取货' }, 400);
    
    order.status = 3; // 取货完成，配送中
    order.pickup_time = new Date().toISOString();
    order.update_time = new Date().toISOString();
    saveDB(db);
    return sendJson(res, { code: 0, msg: '取货确认成功', data: { status: order.status } });
  }

  // 司机输入送达码确认签收（收件人报码，司机输入）
  if (pathname === '/api/order/confirm-delivery' && method === 'POST') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '仅司机可操作' }, 401);
    const { order_id, delivery_code } = await parseBody(req);
    const orderId = parseInt(order_id);
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return sendJson(res, { code: 404, msg: '订单不存在' }, 404);
    if (order.driver_id !== user.userId) return sendJson(res, { code: 403, msg: '非此订单司机' }, 403);
    if (order.delivery_code !== delivery_code) return sendJson(res, { code: 400, msg: '送达码错误' }, 400);
    if (order.status < 3) return sendJson(res, { code: 400, msg: '订单状态不允许签收' }, 400);
    
    order.status = 6; // 已签收
    order.sign_time = new Date().toISOString();
    order.update_time = new Date().toISOString();
    
    // 货车拼载：释放载重
    const orderGoods = db.goods.find(g => g.id === order.goods_id);
    if (orderGoods && orderGoods.weight) {
      const driverRoute = db.routes.find(r => r.driver_id === order.driver_id && r.status === 2);
      if (driverRoute) {
        driverRoute.remain_space = (driverRoute.remain_space || 0) + orderGoods.weight;
        if (driverRoute.remain_space > 0) driverRoute.status = 1;
      }
    }
    
    // 创建结算单
    createSettlement(order, db);
    saveDB(db);
    return sendJson(res, { code: 0, msg: '签收成功，订单已完成', data: { status: order.status } });
  }

  // 司机扫码确认取货
  if (pathname.startsWith('/api/orders/') && pathname.includes('/verify') && method === 'POST') {
    const parts = pathname.split('/');
    const orderId = parseInt(parts[3]);
    const { code, action } = await parseBody(req);
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return sendJson(res, { code: 404, msg: '订单不存在' }, 404);
    // 如果没有码就生成
    if (!order.pickup_code) {
      order.pickup_code = generateCode();
      order.delivery_code = generateCode();
    }
    if (action === 'pickup') {
      if (order.pickup_code !== code) return sendJson(res, { code: 400, msg: '取货码错误' }, 400);
      if (order.status < 2) return sendJson(res, { code: 400, msg: '订单状态不允许取货' }, 400);
      order.status = 3; // 取货完成，配送中
      order.pickup_time = new Date().toISOString();
      order.update_time = new Date().toISOString();
      saveDB(db);
      return sendJson(res, { code: 0, msg: '取货确认成功', data: { status: order.status } });
    }
    if (action === 'delivery') {
      if (order.delivery_code !== code) return sendJson(res, { code: 400, msg: '送达码错误' }, 400);
      order.status = 6; // 已签收
      order.sign_time = new Date().toISOString();
      order.update_time = new Date().toISOString();
      
      // 货车拼载：释放载重
      const orderGoods = db.goods.find(g => g.id === order.goods_id);
      const driver = db.users.find(u => u.id === order.driver_id);
      if (driver && driver.role === 2 && orderGoods && orderGoods.weight) {
        const driverRoute = db.routes.find(r => r.driver_id === order.driver_id && r.status === 2);
        if (driverRoute) {
          driverRoute.remain_space = (driverRoute.remain_space || 0) + orderGoods.weight;
          // 如果重新有载重空间，恢复状态
          if (driverRoute.remain_space > 0) {
            driverRoute.status = 1; // 恢复活跃
          }
        }
      }
      
      // 创建结算单（不再直接打款，改为待审核）
      createSettlement(order, db);
      saveDB(db);
      return sendJson(res, { code: 0, msg: '送达确认成功，已提交结算', data: { status: order.status } });
    }
    return sendJson(res, { code: 400, msg: '未知操作' }, 400);
  }

  if (pathname.startsWith('/api/order/detail') && method === 'GET') {
    const orderId = parseInt(pathname.split('/').pop());
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return sendJson(res, { code: 404, msg: '订单不存在' }, 404);
    // 附加关联信息
    if (order.goods_id) {
      const goods = db.goods.find(g => g.id === order.goods_id);
      if (goods) {
        order.start_addr = goods.start_addr;
        order.end_addr = goods.end_addr;
        order.goods_name = goods.remark || '货物';
        order.weight = goods.weight;
        order.goods_value = goods.goods_value;
        order.sender_name = goods.sender_name;
        order.sender_phone = goods.sender_phone;
        order.receiver_name = goods.receiver_name;
        order.receiver_phone = goods.receiver_phone;
        order.photo_urls = goods.photo_urls || [];
      }
    }
    // 附加商家信息
    if (order.merchant_id) {
      const merchant = db.users.find(u => u.id === order.merchant_id);
      if (merchant) order.merchant_phone = merchant.phone;
    }
    // 附加司机信息
    if (order.driver_id) {
      const driver = db.users.find(u => u.id === order.driver_id);
      if (driver) {
        order.driver_name = driver.real_name || driver.nickname || '司机' + driver.id;
        order.driver_phone = driver.phone || '';
        order.driver_type = driver.role;
      }
    }
    return sendJson(res, { code: 0, data: order });
  }

  // ========== 钱包相关 ==========
  if (pathname === '/api/wallet/balance' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const wallet = db.wallets.find(w => w.user_id === user.userId);
    return sendJson(res, { code: 0, data: wallet || { balance: 0, frozen_amount: 0 } });
  }

  if (pathname === '/api/wallet/info' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const wallet = db.wallets.find(w => w.user_id === user.userId) || { balance: 0, frozen_amount: 0 };
    
    // 计算本月收入：从本月第一天开始的结算单approved金额
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let monthIncome = 0;
    let pendingSettlement = 0;
    
    if (user.role === 2 || user.role === 3) {
      // 司机/私家车：统计结算单收入
      const mySettlements = db.settlements.filter(s => s.driver_id === user.userId);
      monthIncome = mySettlements
        .filter(s => s.status === 'approved' && s.approve_time >= monthStart)
        .reduce((sum, s) => sum + s.amount, 0);
      pendingSettlement = mySettlements
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + s.amount, 0);
    } else {
      // 商家/个人：统计交易支出
      monthIncome = db.transactions.filter(t => 
        t.user_id === user.userId && 
        t.type === 'settlement' && 
        t.create_time >= monthStart
      ).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      pendingSettlement = db.settlements.filter(s => 
        s.merchant_id === user.userId && 
        s.status === 'pending'
      ).reduce((sum, s) => sum + s.amount, 0);
    }
    
    return sendJson(res, { code: 0, data: {
      ...wallet,
      monthIncome: Math.round(monthIncome * 100) / 100,
      pendingSettlement: Math.round(pendingSettlement * 100) / 100
    }});
  }

  if (pathname === '/api/wallet/records' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const records = db.transactions.filter(t => t.user_id === user.userId)
      .sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
    return sendJson(res, { code: 0, data: records });
  }

  // 司机查看自己的订单
  if (pathname === '/api/driver/orders' && method === 'GET') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const list = db.orders.filter(o => o.driver_id === user.userId);
    return sendJson(res, { code: 0, data: list });
  }

  // 获取司机当前进行中的订单（含剩余载重信息）
  if (pathname === '/api/driver/active-orders' && method === 'GET') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    // 进行中的订单状态：1-待支付, 2-待取货, 3-配送中, 4-运输中, 5-已送达
    const activeStatuses = [1, 2, 3, 4, 5];
    const activeOrders = db.orders.filter(o => 
      o.driver_id === user.userId && activeStatuses.includes(o.status)
    ).map(o => {
      // 附加货源信息
      const goods = db.goods.find(g => g.id === o.goods_id);
      return {
        ...o,
        goods_weight: goods ? goods.weight : 0,
        goods_name: goods ? (goods.remark || '货物') : '货物',
        start_addr: goods ? goods.start_addr : '',
        end_addr: goods ? goods.end_addr : ''
      };
    });
    
    // 计算当前已接单总重量
    const acceptedWeight = activeOrders.reduce((sum, o) => sum + (o.goods_weight || 0), 0);
    
    // 获取司机当前路线的剩余载重
    const driverRoute = db.routes.find(r => r.driver_id === user.userId && r.status === 1);
    const remainSpace = driverRoute ? (driverRoute.remain_space || driverRoute.space || 0) : 0;
    
    return sendJson(res, {
      code: 0,
      data: {
        orders: activeOrders,
        acceptedWeight,
        remainSpace,
        totalSpace: driverRoute ? (driverRoute.space || 0) : 0,
        orderCount: activeOrders.length
      }
    });
  }

  // 司机订单详情
  if (pathname.startsWith('/api/driver/order/') && method === 'GET') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const orderId = parseInt(pathname.split('/').pop());
    const order = db.orders.find(o => o.id === orderId && o.driver_id === user.userId);
    if (!order) return sendJson(res, { code: 404, msg: '订单不存在' }, 404);
    // 附加waypoints数据
    if (order.goods_id) {
      const goods = db.goods.find(g => g.id === order.goods_id);
      if (goods) {
        order.waypoints = goods.waypoints || [];  // 中途装卸点（包含二维码和取件码）
      }
    }
    return sendJson(res, { code: 0, data: order });
  }

  // 司机/私家车主统计数据
  if (pathname === '/api/driver/stats' && method === 'GET') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const myOrders = db.orders.filter(o => o.driver_id === user.userId);
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = myOrders.filter(o => o.create_time && o.create_time.startsWith(today));
    const wallet = db.wallets.find(w => w.user_id === user.userId) || { balance: 0 };
    const resData = {
      totalOrders: myOrders.length,
      todayOrders: todayOrders.length,
      totalIncome: myOrders.reduce((sum, o) => sum + (o.driver_income || o.price * 0.9), 0),
      balance: wallet.balance,
      dailyLimit: user.role === 3 ? 2 : null, // 私家车每日限2单
      todayUsed: todayOrders.length,
      weightLimit: user.role === 3 ? 20 : null, // 私家车限20kg
      valueLimit: user.role === 3 ? 2000 : null // 私家车限2000元
    };
    return sendJson(res, { code: 0, data: resData });
  }

  if (pathname === '/api/wallet/recharge' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { amount } = await parseBody(req);
    const wallet = db.wallets.find(w => w.user_id === user.userId);
    if (wallet) wallet.balance += parseFloat(amount);
    // 记录充值交易
    db.transactions.push({
      id: db.nextIds.transaction++,
      user_id: user.userId,
      type: 'recharge',
      amount: parseFloat(amount),
      balance_after: wallet.balance,
      remark: '充值',
      create_time: new Date().toISOString()
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '充值成功', data: { balance: wallet.balance } });
  }

  // ========== 运营后台 ==========
  if (pathname === '/api/admin/order-list' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    return sendJson(res, { code: 0, data: db.orders });
  }

  if (pathname === '/api/admin/user-list' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    return sendJson(res, { code: 0, data: db.users.map(u => ({ ...u, password: undefined })) });
  }

  if (pathname === '/api/admin/stats' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayOrders = db.orders.filter(o => o.create_time && o.create_time.startsWith(todayStr));
    return sendJson(res, {
      code: 0,
      data: {
        totalUsers: db.users.length,
        totalOrders: db.orders.length,
        totalAmount: db.orders.reduce((sum, o) => sum + (o.price || 0), 0),
        merchants: db.users.filter(u => u.role === 1).length,
        drivers: db.users.filter(u => u.role === 2).length,
        privateCars: db.users.filter(u => u.role === 3).length,
        personalUsers: db.users.filter(u => u.role === 5).length,
        todayOrders: todayOrders.length,
        todayAmount: todayOrders.reduce((sum, o) => sum + (o.price || 0), 0),
        pendingOrders: db.orders.filter(o => [1, 2].includes(o.status)).length,
        activeGoods: db.goods.filter(g => g.status === 1).length
      }
    });
  }

  // 佣金配置
  if (pathname === '/api/admin/commission-config' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    return sendJson(res, { code: 0, data: db.region_configs });
  }

  if (pathname === '/api/admin/commission-config' && method === 'POST') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const { truck_rate, private_rate } = await parseBody(req);
    const config = db.region_configs.find(r => r.status === 1);
    if (config) {
      config.commission_rate = parseFloat(truck_rate) || 6;
      config.private_rate = parseFloat(private_rate) || 12;
    }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '配置已更新', data: config });
  }


  // ========== 运营后台 - 黑名单/白名单 ==========
  if (pathname === '/api/admin/blacklist' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const list = (db.blacklist || []).map(b => {
      const u = db.users.find(u => u.id === b.user_id);
      return { ...b, phone: u?.phone, real_name: u?.real_name, role: u?.role };
    });
    return sendJson(res, { code: 0, data: list });
  }
  if (pathname === '/api/admin/blacklist' && method === 'POST') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const { user_id, type, reason } = await parseBody(req);
    if (!user_id || !type) return sendJson(res, { code: 400, msg: '缺少参数' }, 400);
    if (!db.blacklist) db.blacklist = [];
    const existing = db.blacklist.find(b => b.user_id === parseInt(user_id) && b.status !== 0);
    if (existing) return sendJson(res, { code: 400, msg: '该用户已在名单中' }, 400);
    if (!db.nextIds) db.nextIds = {};
    if (!db.nextIds.blacklist) db.nextIds.blacklist = 1;
    const id = db.nextIds.blacklist++;
    db.blacklist.push({ id, user_id: parseInt(user_id), type, reason: reason || '', operator_id: user.userId, status: 1, create_time: new Date().toISOString() });
    const u = db.users.find(u => u.id === parseInt(user_id));
    if (u) { u.status = type === 'blacklist' ? -1 : 2; u.blacklist_type = type; u.blacklist_reason = reason; }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '已添加', data: { id } });
  }
  if (pathname.startsWith('/api/admin/blacklist/') && method === 'DELETE') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const id = parseInt(pathname.split('/').pop());
    if (!db.blacklist) { saveDB(db); return sendJson(res, { code: 0, msg: '已移除' }); }
    const record = db.blacklist.find(b => b.id === id);
    if (record) {
      const u = db.users.find(u => u.id === record.user_id);
      if (u) { u.status = 1; delete u.blacklist_type; delete u.blacklist_reason; }
    }
    db.blacklist = db.blacklist.filter(b => b.id !== id);
    saveDB(db);
    return sendJson(res, { code: 0, msg: '已移除' });
  }

  // ========== 运营后台 - 用户状态管理 ==========
  if (pathname.startsWith('/api/admin/users/') && pathname.endsWith('/status') && method === 'PUT') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const parts = pathname.split('/');
    const id = parseInt(parts[3]);
    const { status, reason } = await parseBody(req);
    const u = db.users.find(u => u.id === id);
    if (!u) return sendJson(res, { code: 404, msg: '用户不存在' }, 404);
    const oldStatus = u.status;
    u.status = parseInt(status);
    if (parseInt(status) === -1) {
      if (!db.blacklist) db.blacklist = [];
      if (!db.nextIds) db.nextIds = {};
      if (!db.nextIds.blacklist) db.nextIds.blacklist = 1;
      const existing = db.blacklist.find(b => b.user_id === id);
      if (!existing) {
        const bid = db.nextIds.blacklist++;
        db.blacklist.push({ id: bid, user_id: id, type: 'blacklist', reason: reason || '管理员操作', operator_id: user.userId, status: 1, create_time: new Date().toISOString() });
      }
      u.blacklist_type = 'blacklist'; u.blacklist_reason = reason;
    } else if (parseInt(status) === 2) {
      if (!db.blacklist) db.blacklist = [];
      if (!db.nextIds) db.nextIds = {};
      if (!db.nextIds.blacklist) db.nextIds.blacklist = 1;
      const existing = db.blacklist.find(b => b.user_id === id);
      if (!existing) {
        const bid = db.nextIds.blacklist++;
        db.blacklist.push({ id: bid, user_id: id, type: 'whitelist', reason: reason || '管理员操作', operator_id: user.userId, status: 1, create_time: new Date().toISOString() });
      }
      u.blacklist_type = 'whitelist'; u.blacklist_reason = reason;
    } else {
      u.blacklist_type = null; u.blacklist_reason = null;
      if (db.blacklist) db.blacklist = db.blacklist.filter(b => b.user_id !== id);
    }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '状态已更新', data: { oldStatus, newStatus: u.status } });
  }

  // ========== 运营后台 - 投诉管理 ==========
  if (pathname === '/api/admin/complaints' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    if (!db.complaints) { db.complaints = []; saveDB(db); }
    const list = db.complaints.map(c => {
      const complainant = db.users.find(u => u.id === c.complainant_id);
      return { ...c, complainant_phone: complainant?.phone };
    });
    return sendJson(res, { code: 0, data: list });
  }
  if (pathname === '/api/admin/complaints' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id, type, description, evidence } = await parseBody(req);
    if (!order_id || !type || !description) return sendJson(res, { code: 400, msg: '缺少必填参数' }, 400);
    if (!db.complaints) db.complaints = [];
    if (!db.nextIds) db.nextIds = {};
    if (!db.nextIds.complaint) db.nextIds.complaint = 1;
    const id = db.nextIds.complaint++;
    db.complaints.push({ id, order_id: parseInt(order_id), complainant_id: user.userId, type, description, evidence: evidence || '', status: 'pending', handler_id: null, handle_remark: '', create_time: new Date().toISOString(), handle_time: null });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '投诉已提交', data: { complaint_id: id } });
  }
  if (pathname.startsWith('/api/admin/complaints/') && method === 'PUT') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const id = parseInt(pathname.split('/').pop());
    if (!db.complaints) { db.complaints = []; saveDB(db); }
    const complaint = db.complaints.find(c => c.id === id);
    if (!complaint) return sendJson(res, { code: 404, msg: '投诉不存在' }, 404);
    const { status, handle_remark, penalty_amount } = await parseBody(req);
    complaint.status = status; complaint.handler_id = user.userId;
    complaint.handle_remark = handle_remark || ''; complaint.handle_time = new Date().toISOString();
    if (penalty_amount && parseFloat(penalty_amount) > 0 && complaint.order_id) {
      const order = db.orders.find(o => o.id === complaint.order_id);
      if (order) {
        const targetId = order.driver_id || order.merchant_id;
        if (targetId) {
          const wallet = db.wallets.find(w => w.user_id === targetId);
          if (wallet) {
            wallet.balance -= parseFloat(penalty_amount);
            if (!db.transactions) db.transactions = [];
            if (!db.nextIds) db.nextIds = {};
            if (!db.nextIds.transaction) db.nextIds.transaction = 1;
            db.transactions.push({ id: db.nextIds.transaction++, user_id: targetId, type: 'penalty', amount: -parseFloat(penalty_amount), balance_after: wallet.balance, order_id: complaint.order_id, remark: '投诉罚款: ' + (handle_remark || type), create_time: new Date().toISOString() });
          }
        }
      }
    }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '投诉已处理', data: complaint });
  }

  // ========== 运营后台 - 通讯记录 ==========
  if (pathname === '/api/admin/messages' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    if (!db.messages) { db.messages = []; saveDB(db); }
    const records = db.messages.map(m => {
      const fromUser = db.users.find(u => u.id === m.from_user_id);
      const toUser = db.users.find(u => u.id === m.to_user_id);
      const roleNames = ['', '商家', '货车司机', '私家车主', '管理员', '个人用户'];
      return { ...m, from_phone: fromUser?.phone, from_name: fromUser?.real_name || roleNames[fromUser?.role] || '-', to_phone: toUser?.phone, to_name: toUser?.real_name || roleNames[toUser?.role] || '-' };
    }).sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
    return sendJson(res, { code: 0, data: records });
  }
  if (pathname === '/api/admin/calls' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    if (!db.messages) { db.messages = []; saveDB(db); }
    const roleNames = ['', '商家', '货车司机', '私家车主', '管理员', '个人用户'];
    const calls = db.messages.filter(m => m.type === 'call_request').map(m => {
      const fromUser = db.users.find(u => u.id === m.from_user_id);
      const toUser = db.users.find(u => u.id === m.to_user_id);
      const order = m.order_id ? db.orders.find(o => o.id === m.order_id) : null;
      return { ...m, from_phone: fromUser?.phone, from_name: fromUser?.real_name || roleNames[fromUser?.role] || '-', from_role: fromUser?.role, to_phone: toUser?.phone, to_name: toUser?.real_name || roleNames[toUser?.role] || '-', to_role: toUser?.role, order_no: order?.id ? '#' + order.id : null };
    }).sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
    return sendJson(res, { code: 0, data: calls });
  }

  // ========== 智能匹配（按距离排序） ==========
  // ========== 智能匹配（司机找货源） ==========
  if (pathname === '/api/match/nearby-goods' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const pendingGoods = db.goods.filter(g => g.status === 1);
    // 获取司机模式
    const driverModeRecord = db.driver_modes.find(d => d.driver_id === user.userId);
    const driverMode = driverModeRecord ? driverModeRecord.mode : 0; // 默认直达模式
    const result = smartMatch.matchGoodsForDriver(user, pendingGoods, db.routes, db.orders, driverMode);
    return sendJson(res, { code: 0, data: result, total: result.length });
  }
  
  // ========== 智能匹配（货主找司机） ==========
  if (pathname === '/api/match/nearby-drivers' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    // 获取货主最新的待接单货源
    const myGoods = db.goods.filter(g => (g.merchant_id === user.userId || g.personal_id === user.userId) && g.status === 1);
    const latestGoods = myGoods[myGoods.length - 1]; // 取最新一条
    if (!latestGoods) {
      // 没有待接单货源，返回所有活跃司机
      const activeRoutes = db.routes.filter(r => r.status === 1);
      const drivers = activeRoutes.map(r => {
        const driverUser = db.users.find(u => u.id === r.driver_id);
        return {
          route_id: r.id, driver_id: r.driver_id,
          driver_type: r.driver_type || driverUser?.role,
          driver_name: driverUser?.real_name || '司机' + r.driver_id,
          start_addr: r.start_addr, end_addr: r.end_addr,
          depart_time: r.departure_time || r.depart_time,
          remain_space: r.remain_space || r.space,
          matchScore: 50, matchInfo: { total: 50, reason: "无待接单货源，默认展示" }
        };
      });
      return sendJson(res, { code: 0, data: drivers, total: drivers.length });
    }
    const result = smartMatch.matchDriversForGoods(user, latestGoods, db.routes, db.users, db.orders);
    return sendJson(res, { code: 0, data: result, total: result.length, goods: latestGoods });
  }
  
  // ========== 全局最优撮合匹配（管理后台用） ==========
  if (pathname === '/api/match/global-optimal' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const pairs = smartMatch.globalOptimalMatch(db.goods, db.routes, db.users, db.orders);
    // 补充详细信息
    const detailed = pairs.map(p => {
      const g = db.goods.find(x => x.id === p.goodsId);
      const r = db.routes.find(x => x.id === p.routeId);
      const driver = db.users.find(u => u.id === r?.driver_id);
      const merchant = db.users.find(u => u.id === (g?.merchant_id || g?.personal_id));
      return {
        ...p,
        goods: g ? { id: g.id, start_addr: g.start_addr, end_addr: g.end_addr, weight: g.weight, price: g.price, publisher: merchant?.real_name || ('用户' + (g.merchant_id || g.personal_id)) } : null,
        driver: driver ? { id: driver.id, name: driver.real_name, role: driver.role } : null,
        route: r ? { id: r.id, start_addr: r.start_addr, end_addr: r.end_addr, depart_time: r.departure_time || r.depart_time } : null
      };
    });
    return sendJson(res, { code: 0, data: detailed, total: detailed.length });
  }
  
  // ========== 匹配评分详情（调试用） ==========
  if (pathname === '/api/match/score-detail' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const goods_id = urlParams.searchParams.get('goods_id');
    const route_id = urlParams.searchParams.get('route_id');
    
    if (goods_id) {
      // 查看某个货源对当前司机的匹配详情
      const g = db.goods.find(x => x.id === parseInt(goods_id));
      if (!g) return sendJson(res, { code: 400, msg: '货源不存在' }, 400);
      // 获取司机模式
      const driverModeRecord = db.driver_modes.find(d => d.driver_id === user.userId);
      const driverMode = driverModeRecord ? driverModeRecord.mode : 0; // 默认直达模式
      const result = smartMatch.matchGoodsForDriver(user, [g], db.routes, db.orders, driverMode);
      return sendJson(res, { code: 0, data: result[0] || null });
    }
    
    if (route_id) {
      // 查看某个司机路线对指定货源的匹配详情
      const r = db.routes.find(x => x.id === parseInt(route_id));
      if (!r) return sendJson(res, { code: 400, msg: '路线不存在' }, 400);
      const myGoods = db.goods.filter(g => (g.merchant_id === user.userId || g.personal_id === user.userId) && g.status === 1);
      if (myGoods.length === 0) return sendJson(res, { code: 400, msg: '无待接单货源' }, 400);
      const result = smartMatch.matchDriversForGoods(user, myGoods[myGoods.length - 1], [r], db.users, db.orders);
      return sendJson(res, { code: 0, data: result[0] || null });
    }
    
    return sendJson(res, { code: 400, msg: '请提供goods_id或route_id' }, 400);
  }

  // ========== 照片上传 ==========
  if (pathname === '/api/photo/upload' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id, photo_data, photo_type } = await parseBody(req);
    const photoId = db.nextIds.photo++;
    const photoDir = path.join(__dirname, '../data/photos');
    if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
    
    // 保存base64图片
    const matches = (photo_data || '').match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
      const ext = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = `order_${order_id}_${photo_type}_${photoId}.${ext}`;
      fs.writeFileSync(path.join(photoDir, filename), buffer);
      db.photos.push({
        id: photoId,
        order_id: parseInt(order_id),
        photo_type, // 'pickup'取货照, 'deliver'送达照, 'goods'货物照
        filename,
        uploader_id: user.userId,
        create_time: new Date().toISOString()
      });
      saveDB(db);
      return sendJson(res, { code: 0, msg: '上传成功', data: { photo_id: photoId, filename } });
    }
    return sendJson(res, { code: 400, msg: '图片格式错误' }, 400);
  }

  // 简单文件上传接口（小程序wx.uploadFile用）
  if (pathname === '/api/upload/photo' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) return sendJson(res, { code: 500, msg: '解析失败' }, 500);
      const file = files.photo;
      if (!file) return sendJson(res, { code: 400, msg: '未上传文件' }, 400);
      const photoDir = path.join(__dirname, '../data/photos');
      if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
      const fileData = Array.isArray(file) ? file[0] : file;
      const ext = path.extname(fileData.originalFilename || '.jpg') || '.jpg';
      const filename = `goods_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`;
      const dest = path.join(photoDir, filename);
      fs.copyFileSync(fileData.filepath, dest);
      // 返回可访问的URL
      const photoUrl = `/photos/${filename}`;
      return sendJson(res, { code: 0, msg: '上传成功', data: photoUrl });
    });
    return;
  }
  
  // 照片列表
  if (pathname.startsWith('/api/photo/list') && method === 'GET') {
    const orderId = parseInt(pathname.split('/').pop());
    const photos = db.photos.filter(p => p.order_id === orderId);
    return sendJson(res, { code: 0, data: photos });
  }
  
  // 照片文件访问
  if (pathname.startsWith('/photos/') && method === 'GET') {
    const filename = pathname.replace('/photos/', '');
    const filePath = path.join(__dirname, '../data/photos', filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filename).slice(1);
      res.writeHead(200, { 'Content-Type': `image/${ext}` });
      return res.end(fs.readFileSync(filePath));
    }
    return sendJson(res, { code: 404, msg: '图片不存在' }, 404);
  }
  
  // ========== 隐私消息（中间层通话） ==========
  if (pathname === '/api/message/send' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { to_user_id, content, order_id } = await parseBody(req);
    const msgId = db.nextIds.message++;
    db.messages.push({
      id: msgId,
      from_user_id: user.userId,
      to_user_id: parseInt(to_user_id),
      order_id: parseInt(order_id) || null,
      content,
      type: 'text', // text, image, call_request
      read: 0,
      create_time: new Date().toISOString()
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '发送成功', data: { message_id: msgId } });
  }
  
  // 获取消息列表
  if (pathname.startsWith('/api/message/list') && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const otherUserId = parseInt(pathname.split('/').pop());
    const msgs = db.messages.filter(m => 
      (m.from_user_id === user.userId && m.to_user_id === otherUserId) ||
      (m.from_user_id === otherUserId && m.to_user_id === user.userId)
    ).sort((a, b) => new Date(a.create_time) - new Date(b.create_time));
    // 标记已读
    msgs.forEach(m => { if (m.to_user_id === user.userId) m.read = 1; });
    saveDB(db);
    return sendJson(res, { code: 0, data: msgs });
  }
  
  // 通话请求（虚拟号码）
  if (pathname === '/api/message/call-request' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { to_user_id, order_id } = await parseBody(req);
    const msgId = db.nextIds.message++;
    // 生成虚拟号码（实际应接运营商API）
    const virtualNo = '170' + Math.random().toString().slice(2, 8);
    db.messages.push({
      id: msgId,
      from_user_id: user.userId,
      to_user_id: parseInt(to_user_id),
      order_id: parseInt(order_id) || null,
      content: `通话请求已发起，虚拟号码: ${virtualNo}（5分钟内有效）`,
      type: 'call_request',
      virtual_no: virtualNo,
      read: 0,
      create_time: new Date().toISOString()
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '通话请求已发送', data: { virtual_no: virtualNo, message_id: msgId } });
  }
  
  // 获取会话列表
  if (pathname === '/api/message/conversations' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const otherUserIds = new Set();
    db.messages.filter(m => m.from_user_id === user.userId || m.to_user_id === user.userId)
      .forEach(m => {
        const other = m.from_user_id === user.userId ? m.to_user_id : m.from_user_id;
        otherUserIds.add(other);
      });
    const convs = [...otherUserIds].map(uid => {
      const u = db.users.find(u => u.id === uid);
      const lastMsg = db.messages.filter(m => 
        (m.from_user_id === user.userId && m.to_user_id === uid) ||
        (m.from_user_id === uid && m.to_user_id === user.userId)
      ).sort((a, b) => new Date(b.create_time) - new Date(a.create_time))[0];
      const unread = db.messages.filter(m => m.to_user_id === user.userId && m.from_user_id === uid && m.read === 0).length;
      return {
        user_id: uid,
        user_name: u?.real_name || ['','商家','货车司机','私家车主','管理员','个人用户'][u?.role] + uid,
        last_message: lastMsg?.content?.slice(0, 30),
        last_time: lastMsg?.create_time,
        unread
      };
    });
    return sendJson(res, { code: 0, data: convs });
  }

  // ========== 计价API ==========
  if (pathname === '/api/price/calculate' && method === 'POST') {
    const { distance, weight, volume, driver_type, pickup_zone, delivery_zone } = await parseBody(req);
    if (!distance || !weight || !driver_type) {
      return sendJson(res, { code: 400, msg: '请提供距离、重量、司机类型' }, 400);
    }
    const result = calculatePrice(
      parseFloat(distance),
      parseFloat(weight),
      parseInt(driver_type),
      pickup_zone || '',
      delivery_zone || ''
    );
    return sendJson(res, { code: 0, data: result });
  }
  
  // 计价规则查询
  if (pathname === '/api/price/rules' && method === 'GET') {
    return sendJson(res, {
      code: 0,
      data: {
        private_car: {
          label: '私家车（≤20kg小件）',
          county_flat: 20,
          county_commission: 3,
          distance_rates: [
            { range: '0-100km', rate: 0.2 },
            { range: '100-200km', rate: 0.15 },
            { range: '200km以上', rate: 0.1 }
          ],
          out_county_commission_rate: 0.10
        },
        truck: {
          label: '货车（按重量/体积取大）',
          county_flat_commission: 10,
          distance_rates: [
            { range: '0-100km', rate: 1.2 },
            { range: '100-200km', rate: 1.0 },
            { range: '200-300km', rate: 1.0 },
            { range: '300-400km', rate: 0.5 },
            { range: '400km以上', rate: 0.5 }
          ],
          formula: '里程单价 × 公里数 × 吨位（取重量与体积费用更高方）',
          out_county_commission_rate: 0.10
        },
        examples: [
          {
            route: '成都 → 塔公镇（约380km）',
            private_car: { freight: 53, commission: 5.3, driver_income: 47.7 },
            truck_1ton: { freight: 360, commission: 36, driver_income: 324 }
          }
        ]
      }
    });
  }
  
  // 估算距离（简化：根据地址关键词推算）
  if (pathname === '/api/price/estimate-distance' && method === 'POST') {
    const { start_addr, end_addr } = await parseBody(req);
    // 简化距离估算：实际应接入地图API计算
    let distance = 50; // 默认50km
    const longRoutes = [
      { keywords: ['成都', '塔公'], km: 380 },
      { keywords: ['成都', '康定'], km: 330 },
      { keywords: ['成都', '炉霍'], km: 450 },
      { keywords: ['康定', '炉霍'], km: 260 },
      { keywords: ['康定', '塔公'], km: 110 },
      { keywords: ['康定', '新都桥'], km: 80 },
      { keywords: ['炉霍', '甘孜'], km: 95 }
    ];
    for (const r of longRoutes) {
      const s1 = r.keywords[0], s2 = r.keywords[1];
      if ((start_addr?.includes(s1) && end_addr?.includes(s2)) || (start_addr?.includes(s2) && end_addr?.includes(s1))) {
        distance = r.km;
        break;
      }
    }
    return sendJson(res, { code: 0, data: { distance, start_addr, end_addr } });
  }

  // ========== 用户信息 ==========
  if (pathname === '/api/user/info' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const u = db.users.find(u => u.id === user.userId);
    if (!u) return sendJson(res, { code: 404, msg: '用户不存在' }, 404);
    return sendJson(res, { code: 0, data: { ...u, password: undefined } });
  }

  // ========== 个人端 ==========
  if (pathname === '/api/personal/publish-goods' && method === 'POST') {
    if (!user || user.role !== 5) return sendJson(res, { code: 401, msg: '仅个人用户可发布' }, 401);
    const { start_addr, end_addr, weight, price, goods_value, remark, sender_name, sender_phone, receiver_name, receiver_phone, departure_time, waypoints } = await parseBody(req);
    const goodsId = db.nextIds.goods++;
    db.goods.push({
      id: goodsId, personal_id: user.userId, merchant_id: null,
      start_addr, end_addr, weight: parseFloat(weight), price: parseFloat(price),
      goods_value: parseFloat(goods_value || 0), remark,
      sender_name, sender_phone, receiver_name, receiver_phone,
      departure_time: departure_time || '',
      photo_urls: [],
      waypoints: waypoints || [],  // 中途装卸点
      status: 1, create_time: new Date().toISOString()
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '发布成功', data: { goods_id: goodsId } });
  }

  if (pathname === '/api/personal/goods-list' && method === 'GET') {
    if (!user || user.role !== 5) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const list = db.goods.filter(g => g.personal_id === user.userId);
    return sendJson(res, { code: 0, data: list });
  }

  if (pathname === '/api/personal/orders' && method === 'GET') {
    if (!user || user.role !== 5) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const list = db.orders.filter(o => o.personal_id === user.userId || (o.merchant_id === null && db.goods.find(g => g.id === o.goods_id && g.personal_id === user.userId)));
    return sendJson(res, { code: 0, data: { list } });
  }

  // ========== 司机操作 ==========
  if (pathname === '/api/order/pickup' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id } = await parseBody(req);
    const order = db.orders.find(o => o.id === parseInt(order_id));
    if (!order) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);
    if (order.driver_id !== user.userId) return sendJson(res, { code: 403, msg: '非您的订单' }, 403);
    if (order.status !== 2) return sendJson(res, { code: 400, msg: '当前状态不可取货' }, 400);
    order.status = 3; // 配送中
    order.pickup_time = new Date().toISOString();
    saveDB(db);
    return sendJson(res, { code: 0, msg: '已确认取货' });
  }

  if (pathname === '/api/order/deliver' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id } = await parseBody(req);
    const order = db.orders.find(o => o.id === parseInt(order_id));
    if (!order) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);
    if (order.driver_id !== user.userId) return sendJson(res, { code: 403, msg: '非您的订单' }, 403);
    if (order.status !== 3 && order.status !== 4) return sendJson(res, { code: 400, msg: '当前状态不可操作' }, 400);
    // 3(已取货)→4(运输中)→5(已送达)
    if (order.status === 3) {
      order.status = 4; // 运输中
      order.transport_time = new Date().toISOString();
      saveDB(db);
      return sendJson(res, { code: 0, msg: '已出发，运输中' });
    }
    // 4(运输中)→5(已送达待签收)
    if (order.status === 4) {
      order.status = 5; // 已送达
      order.deliver_time = new Date().toISOString();
      saveDB(db);
      return sendJson(res, { code: 0, msg: '已送达，等待收货方签收' });
    }
  }

  if (pathname === '/api/order/cancel' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id, reason } = await parseBody(req);
    const order = db.orders.find(o => o.id === parseInt(order_id));
    if (!order) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);

    // 订单取消规则
    const createMinutes = (Date.now() - new Date(order.create_time).getTime()) / 60000;
    let cancelFee = 0;
    let cancelMsg = '';

    if (order.status === 1) {
      // 未接单状态
      if (createMinutes <= 10) {
        cancelFee = 0;
        cancelMsg = '10分钟内免费取消';
      } else if (createMinutes <= 20) {
        cancelFee = Math.round(order.price * 0.2 * 100) / 100;
        cancelMsg = `取消扣运费20%（¥${cancelFee}）`;
      } else {
        cancelFee = 0;
        cancelMsg = '超过20分钟无人接单，免费取消';
      }
    } else if (order.status === 2) {
      // 已接单 - 不允许取消
      return sendJson(res, { code: 400, msg: '司机已接单，不允许随意取消。如需取消请联系平台客服。' }, 400);
    } else if ([3, 4, 5, 6].includes(order.status)) {
      // 已取货/运输中/已送达/已完成 - 全程禁止取消
      return sendJson(res, { code: 400, msg: '订单已进入配送流程，禁止取消。' }, 400);
    } else if (order.status === 7) {
      return sendJson(res, { code: 400, msg: '订单已取消' }, 400);
    }

    // 退款（扣除手续费后退还）
    const refundAmount = order.price - cancelFee;
    if (refundAmount > 0) {
      const wallet = db.wallets.find(w => w.user_id === (order.merchant_id || order.personal_id));
      if (wallet) {
        wallet.balance += refundAmount;
        db.transactions.push({
          id: db.nextIds.transaction++,
          user_id: wallet.user_id, type: 'refund', amount: refundAmount,
          balance_after: wallet.balance, order_id: order.id, remark: cancelMsg,
          create_time: new Date().toISOString()
        });
      }
    }
    order.status = 7; // 已取消（改为7，6为已完成）
    order.cancel_reason = reason || '用户取消';
    order.cancel_time = new Date().toISOString();
    order.cancel_fee = cancelFee;
    // 恢复货源状态
    const goods = db.goods.find(g => g.id === order.goods_id);
    if (goods) goods.status = 1;
    saveDB(db);
    return sendJson(res, { code: 0, msg: cancelMsg || '已取消', data: { cancel_fee: cancelFee, refund: refundAmount } });
  }

  // ========== 钱包提现 ==========
  if (pathname === '/api/wallet/withdraw' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { amount } = await parseBody(req);
    const wallet = db.wallets.find(w => w.user_id === user.userId);
    if (!wallet) return sendJson(res, { code: 400, msg: '钱包不存在' }, 400);
    if (wallet.balance < parseFloat(amount)) return sendJson(res, { code: 400, msg: '余额不足' }, 400);
    if (parseFloat(amount) < 10) return sendJson(res, { code: 400, msg: '最低提现10元' }, 400);
    wallet.balance -= parseFloat(amount);
    db.transactions.push({
      id: db.nextIds.transaction++, user_id: user.userId,
      type: 'withdraw', amount: -parseFloat(amount),
      balance_after: wallet.balance, remark: '提现申请',
      create_time: new Date().toISOString()
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '提现申请已提交' });
  }

  // ========== 司机行程 ==========
  if (pathname === '/api/driver/my-routes' && method === 'GET') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const list = db.routes.filter(r => r.driver_id === user.userId).sort((a, b) => new Date(b.create_time || b.id) - new Date(a.create_time || a.id));
    return sendJson(res, { code: 0, data: list });
  }

  // ========== 商家/个人确认签收 ==========
  if (pathname === '/api/order/confirm-receipt' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id } = await parseBody(req);
    const order = db.orders.find(o => o.id === parseInt(order_id));
    if (!order) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);
    if (order.status !== 4) return sendJson(res, { code: 400, msg: '当前状态不可签收' }, 400);
    order.status = 5; // 已签收
    order.confirm_time = new Date().toISOString();
    createSettlement(order, db);
    saveDB(db);
    return sendJson(res, { code: 0, msg: '已确认签收，已提交结算' });
  }

  // ========== 结算单 API ==========
  // 管理员获取结算单列表
  if (pathname === '/api/admin/settlements' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const statusFilter = urlParams.searchParams.get('status') || 'all';
    const page = parseInt(urlParams.searchParams.get('page')) || 1;
    const pageSize = parseInt(urlParams.searchParams.get('pageSize')) || 20;

    let list = db.settlements.map(s => {
      const order = db.orders.find(o => o.id === s.order_id);
      const driver = order ? db.users.find(u => u.id === order.driver_id) : null;
      const driverTypeName = order ? (order.driver_type === 3 ? '私家车' : '货车') : '-';
      return {
        ...s,
        order_no: order ? '#' + order.id : '-',
        start_addr: order?.start_addr || '',
        end_addr: order?.end_addr || '',
        driver_name: driver ? (driver.real_name || driver.nickname || '司机' + driver.id) : (order?.driver_id ? '司机' + order.driver_id : '无'),
        driver_phone: driver?.phone || '',
        driver_type_name: driverTypeName
      };
    });

    if (statusFilter !== 'all') {
      list = list.filter(s => s.status === statusFilter);
    }
    list.sort((a, b) => new Date(b.create_time) - new Date(a.create_time));

    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);

    // 统计
    const pendingAmount = db.settlements.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.amount, 0);
    const approvedAmount = db.settlements.filter(s => s.status === 'approved').reduce((sum, s) => sum + s.amount, 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthTotal = db.settlements.filter(s => s.status === 'approved' && s.approve_time >= monthStart).reduce((sum, s) => sum + s.amount, 0);

    return sendJson(res, { code: 0, data: { list: paged, total, pendingAmount, approvedAmount, monthTotal } });
  }

  // 管理员审批结算单
  if (pathname.startsWith('/api/admin/settlements/') && pathname.endsWith('/approve') && method === 'POST') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const parts = pathname.split('/');
    const id = parseInt(parts[parts.length - 2]); // 倒数第二个是ID
    console.log('[DEBUG] 结算审核 pathname:', pathname, 'parts:', parts, 'id:', id);
    console.log('[DEBUG] settlements:', JSON.stringify(db.settlements));
    const settlement = db.settlements.find(s => s.id === id);
    if (!settlement) return sendJson(res, { code: 404, msg: '结算单不存在' }, 404);
    if (settlement.status !== 'pending') return sendJson(res, { code: 400, msg: '只能审批待审核状态的结算单' }, 400);

    settlement.status = 'approved';
    settlement.approve_time = new Date().toISOString();

    // 1. 钱包加钱给司机
    if (settlement.driver_id) {
      const driverWallet = db.wallets.find(w => w.user_id === settlement.driver_id);
      if (driverWallet) {
        driverWallet.balance += settlement.amount;
        db.transactions.push({
          id: db.nextIds.transaction++,
          user_id: settlement.driver_id,
          type: 'settlement',
          amount: settlement.amount,
          balance_after: driverWallet.balance,
          settlement_id: settlement.id,
          order_id: settlement.order_id,
          remark: '结算单收入 #' + settlement.id,
          create_time: new Date().toISOString()
        });
      }
    }

    // 2. 解冻付款方冻结金额（商家或平台扣减冻结，结算给司机后释放）
    const order = db.orders.find(o => o.id === settlement.order_id);
    if (order) {
      const payerId = order.merchant_id || (db.goods.find(g => g.id === order.goods_id) || {}).personal_id;
      if (payerId) {
        const payerWallet = db.wallets.find(w => w.user_id === payerId);
        if (payerWallet && payerWallet.frozen_amount > 0) {
          payerWallet.frozen_amount = Math.max(0, payerWallet.frozen_amount - settlement.commission_fee);
          db.transactions.push({
            id: db.nextIds.transaction++,
            user_id: payerId,
            type: 'unfreeze',
            amount: 0,
            balance_after: payerWallet.frozen_amount,
            settlement_id: settlement.id,
            order_id: settlement.order_id,
            remark: '结算完成，解冻¥' + settlement.commission_fee,
            create_time: new Date().toISOString()
          });
        }
      }
    }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '审批通过，款项已发放' });
  }

  // 管理员驳回结算单
  if (pathname.startsWith('/api/admin/settlements/') && pathname.endsWith('/reject') && method === 'POST') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员' }, 401);
    const parts = pathname.split('/');
    const id = parseInt(parts[parts.length - 2]);
    const { reason } = await parseBody(req);
    const settlement = db.settlements.find(s => s.id === id);
    if (!settlement) return sendJson(res, { code: 404, msg: '结算单不存在' }, 404);
    if (settlement.status !== 'pending') return sendJson(res, { code: 400, msg: '只能驳回待审核状态的结算单' }, 400);

    settlement.status = 'rejected';
    settlement.reject_reason = reason || '未说明原因';
    saveDB(db);
    return sendJson(res, { code: 0, msg: '已驳回' });
  }

  // 司机查看自己的结算单
  if (pathname === '/api/driver/settlements' && method === 'GET') {
    if (!user || (user.role !== 2 && user.role !== 3)) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const statusFilter = urlParams.searchParams.get('status') || 'all';
    const page = parseInt(urlParams.searchParams.get('page')) || 1;
    const pageSize = parseInt(urlParams.searchParams.get('pageSize')) || 20;

    let list = db.settlements.filter(s => s.driver_id === user.userId);
    if (statusFilter !== 'all') {
      list = list.filter(s => s.status === statusFilter);
    }
    list.sort((a, b) => new Date(b.create_time) - new Date(a.create_time));

    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);
    return sendJson(res, { code: 0, data: { list: paged, total } });
  }

  // 商家查看自己的结算单
  if (pathname === '/api/merchant/settlements' && method === 'GET') {
    if (!user || user.role !== 1) return sendJson(res, { code: 401, msg: '未授权' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const statusFilter = urlParams.searchParams.get('status') || 'all';
    const page = parseInt(urlParams.searchParams.get('page')) || 1;
    const pageSize = parseInt(urlParams.searchParams.get('pageSize')) || 20;

    let list = db.settlements.filter(s => s.merchant_id === user.userId);
    if (statusFilter !== 'all') {
      list = list.filter(s => s.status === statusFilter);
    }
    list.sort((a, b) => new Date(b.create_time) - new Date(a.create_time));

    const total = list.length;
    const paged = list.slice((page - 1) * pageSize, page * pageSize);
    return sendJson(res, { code: 0, data: { list: paged, total } });
  }

  // ========== 司机评分体系 ==========
  // 提交评分（携程模式：5星+半星，4维度独立评分）
  if (pathname === '/api/rating/submit' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id, driver_id, timeliness, punctuality, fulfillment, attitude, comment } = await parseBody(req);
    if (!order_id || !driver_id) return sendJson(res, { code: 400, msg: '缺少订单ID或司机ID' }, 400);
    const order = db.orders.find(o => o.id === parseInt(order_id));
    if (!order) return sendJson(res, { code: 400, msg: '订单不存在' }, 400);
    if (order.status !== 5) return sendJson(res, { code: 400, msg: '仅已完成订单可评价' }, 400);
    // 检查是否已评价
    if (db.ratings && db.ratings.find(r => r.order_id === parseInt(order_id) && r.user_id === user.userId)) {
      return sendJson(res, { code: 400, msg: '您已评价过此订单' }, 400);
    }
    if (!db.ratings) db.ratings = [];
    if (!db.nextIds.rating) db.nextIds.rating = 1;
    const ratingId = db.nextIds.rating++;
    db.ratings.push({
      id: ratingId,
      order_id: parseInt(order_id),
      driver_id: parseInt(driver_id),
      user_id: user.userId,
      timeliness: parseFloat(timeliness) || 0,     // 接单及时性 0-5
      punctuality: parseFloat(punctuality) || 0,   // 配送准时性 0-5
      fulfillment: parseFloat(fulfillment) || 0,   // 履约达标 0-5
      attitude: parseFloat(attitude) || 0,         // 服务态度 0-5
      comment: comment || '',
      create_time: new Date().toISOString()
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '评价成功' });
  }

  // 获取司机评分
  if (pathname.startsWith('/api/rating/driver/') && method === 'GET') {
    const driverId = parseInt(pathname.split('/').pop());
    if (!db.ratings) db.ratings = [];
    const driverRatings = db.ratings.filter(r => r.driver_id === driverId);
    const total = driverRatings.length;
    if (total === 0) {
      return sendJson(res, { code: 0, data: { total: 0, avg: 0, timeliness: 0, punctuality: 0, fulfillment: 0, attitude: 0, ratings: [] } });
    }
    const stats = driverRatings.reduce((s, r) => ({
      timeliness: s.timeliness + r.timeliness,
      punctuality: s.punctuality + r.punctuality,
      fulfillment: s.fulfillment + r.fulfillment,
      attitude: s.attitude + r.attitude
    }), { timeliness: 0, punctuality: 0, fulfillment: 0, attitude: 0 });
    const div = (v) => Math.round(v / total * 10) / 10;
    const timeliness = div(stats.timeliness), punctuality = div(stats.punctuality),
          fulfillment = div(stats.fulfillment), attitude = div(stats.attitude);
    const overallAvg = Math.round((timeliness + punctuality + fulfillment + attitude) / 4 * 10) / 10;
    // 最近20条评价
    const recent = driverRatings.slice(-20).reverse().map(r => ({
      timeliness: r.timeliness, punctuality: r.punctuality, fulfillment: r.fulfillment, attitude: r.attitude,
      comment: r.comment, create_time: r.create_time
    }));
    return sendJson(res, { code: 0, data: { total, avg: overallAvg, timeliness, punctuality, fulfillment, attitude, ratings: recent } });
  }

  // ========== 司机证件审核 ==========
  // 提交审核资料
  if (pathname === '/api/driver/audit-submit' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    if (user.role !== 2 && user.role !== 3) return sendJson(res, { code: 403, msg: '仅司机可操作' }, 403);
    const { license_front, license_back, vehicle_front, vehicle_back, vehicle_photos } = await parseBody(req);
    if (!license_front || !license_back) return sendJson(res, { code: 400, msg: '请上传驾驶证正反面' }, 400);
    if (!vehicle_front || !vehicle_back) return sendJson(res, { code: 400, msg: '请上传行驶证正反面' }, 400);
    if (!db.driver_audits) db.driver_audits = [];
    if (!db.nextIds.driver_audit) db.nextIds.driver_audit = 1;
    const auditId = db.nextIds.driver_audit++;
    db.driver_audits.push({
      id: auditId,
      driver_id: user.userId,
      license_front, license_back,
      vehicle_front, vehicle_back,
      vehicle_photos: vehicle_photos || [],
      status: 'pending',       // pending/reviewing/approved/rejected
      reject_reason: '',
      reviewer_id: null,
      create_time: new Date().toISOString(),
      review_time: null
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '审核资料已提交，请等待审核' });
  }

  // 获取审核状态
  if (pathname === '/api/driver/audit-status' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    if (!db.driver_audits) db.driver_audits = [];
    const audit = db.driver_audits.filter(a => a.driver_id === user.userId).pop();
    if (!audit) {
      return sendJson(res, { code: 0, data: { status: 'none', msg: '未提交审核资料' } });
    }
    return sendJson(res, { code: 0, data: audit });
  }

  // ========== 管理后台 - 审核管理 ==========
  if (pathname === '/api/admin/audits' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    if (!db.driver_audits) db.driver_audits = [];
    const list = db.driver_audits.map(a => {
      const driver = db.users.find(u => u.id === a.driver_id);
      return { ...a, driver_name: driver ? (driver.real_name || driver.phone) : '未知', driver_phone: driver ? driver.phone : '' };
    });
    return sendJson(res, { code: 0, data: list });
  }

  if (pathname.startsWith('/api/admin/audits/') && pathname.endsWith('/approve') && method === 'POST') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const auditId = parseInt(pathname.split('/')[4]);
    if (!db.driver_audits) db.driver_audits = [];
    const audit = db.driver_audits.find(a => a.id === auditId);
    if (!audit) return sendJson(res, { code: 404, msg: '审核记录不存在' }, 404);
    audit.status = 'approved';
    audit.reviewer_id = user.userId;
    audit.review_time = new Date().toISOString();
    // 更新司机审核状态
    const driver = db.users.find(u => u.id === audit.driver_id);
    if (driver) driver.audit_status = 'approved';
    saveDB(db);
    return sendJson(res, { code: 0, msg: '审核通过' });
  }

  if (pathname.startsWith('/api/admin/audits/') && pathname.endsWith('/reject') && method === 'POST') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const auditId = parseInt(pathname.split('/')[4]);
    const { reject_reason } = await parseBody(req);
    if (!db.driver_audits) db.driver_audits = [];
    const audit = db.driver_audits.find(a => a.id === auditId);
    if (!audit) return sendJson(res, { code: 404, msg: '审核记录不存在' }, 404);
    audit.status = 'rejected';
    audit.reject_reason = reject_reason || '资料不符合要求';
    audit.reviewer_id = user.userId;
    audit.review_time = new Date().toISOString();
    const driver = db.users.find(u => u.id === audit.driver_id);
    if (driver) driver.audit_status = 'rejected';
    saveDB(db);
    return sendJson(res, { code: 0, msg: '已驳回' });
  }

  // ========== 用户端投诉接口 ==========
  if (pathname === '/api/complaint/submit' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const { order_id, type, description, evidence } = await parseBody(req);
    if (!order_id || !type) return sendJson(res, { code: 400, msg: '缺少订单ID或投诉类型' }, 400);
    if (!db.complaints) db.complaints = [];
    if (!db.nextIds.complaint) db.nextIds.complaint = 1;
    const id = db.nextIds.complaint++;
    db.complaints.push({
      id, order_id: parseInt(order_id), complainant_id: user.userId,
      type, description: description || '', evidence: evidence || [],
      status: 'pending', handler_id: null, handle_remark: '',
      create_time: new Date().toISOString(), handle_time: null
    });
    saveDB(db);
    return sendJson(res, { code: 0, msg: '投诉已提交' });
  }

  if (pathname === '/api/complaint/my' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    if (!db.complaints) db.complaints = [];
    const list = db.complaints.filter(c => c.complainant_id === user.userId)
      .sort((a, b) => new Date(b.create_time) - new Date(a.create_time));
    return sendJson(res, { code: 0, data: list });
  }

  // ========== 佣金 & 司机模式 & GPS API (V1.2新增) ==========

  // 获取当前用户佣金信息
  if (pathname === '/api/commission/info' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const commissionEngine = require('./utils/commissionEngine');
    const currentUser = db.users.find(u => u.id === user.userId);
    if (!currentUser) return sendJson(res, { code: 404, msg: '用户不存在' }, 404);
    const commissionInfo = commissionEngine.getUserCommissionRate(currentUser, db);
    const graceInfo = commissionEngine.getUserGracePeriodInfo(currentUser, db);
    const rulesSummary = commissionEngine.getCommissionRulesSummary(db);
    return sendJson(res, { code: 0, data: {
      commission_rate: commissionInfo.commissionRate,
      rate_source: commissionInfo.source,
      rate_description: commissionInfo.description,
      grace_period: graceInfo,
      commission_rules: rulesSummary,
      platform_mode: commissionEngine.getCommissionModeDesc(db)
    }});
  }

  // ========== 司机模式 API ==========
  // GET /api/driver/mode - 获取当前模式
  if (pathname === '/api/driver/mode' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const commissionEngine = require('./utils/commissionEngine');
    const mode = commissionEngine.getDriverMode(user.userId, db);
    const modeName = mode === 0 ? '直达模式' : '顺路模式';
    return sendJson(res, { code: 0, data: {
      mode: mode,
      mode_name: modeName,
      description: mode === 0 
        ? '仅接收起点到终点的完整订单，不接受中途货源' 
        : '可接收沿途顺路货源，中途可装卸货'
    }});
  }

  // PUT /api/driver/mode - 切换模式
  if (pathname === '/api/driver/mode' && method === 'PUT') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    if (user.role !== 2 && user.role !== 3) return sendJson(res, { code: 403, msg: '仅司机可操作' }, 403);
    const body = await parseBody(req);
    const modeInt = parseInt(body.mode);
    if (modeInt !== 0 && modeInt !== 1) return sendJson(res, { code: 400, msg: '模式值错误，0=直达 1=顺路' }, 400);
    const commissionEngine = require('./utils/commissionEngine');
    commissionEngine.setDriverMode(user.userId, modeInt, db);
    return sendJson(res, { code: 0, msg: '模式切换成功', data: { mode: modeInt, mode_name: modeInt === 0 ? '直达模式' : '顺路模式' }});
  }

  // ========== 拒单 API ==========
  // GET /api/driver/rejection-quota - 检查拒单配额
  if (pathname === '/api/driver/rejection-quota' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const routeId = parseInt(urlParams.searchParams.get('route_id')) || 0;
    const commissionEngine = require('./utils/commissionEngine');
    const quota = commissionEngine.checkRejectionQuota(user.userId, routeId, db);
    return sendJson(res, { code: 0, data: quota });
  }

  // POST /api/driver/reject - 执行拒单
  if (pathname === '/api/driver/reject' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    if (user.role !== 2 && user.role !== 3) return sendJson(res, { code: 403, msg: '仅司机可操作' }, 403);
    const { order_id, route_id } = await parseBody(req);
    const orderId = parseInt(order_id);
    const routeId = parseInt(route_id) || 0;
    const commissionEngine = require('./utils/commissionEngine');
    const quota = commissionEngine.checkRejectionQuota(user.userId, routeId, db);
    if (!quota.canReject) return sendJson(res, { code: 400, msg: quota.reason || '当前模式不允许拒单' }, 400);
    commissionEngine.recordRejection(user.userId, routeId, orderId, db);
    const order = db.orders.find(o => o.id === orderId);
    if (order) {
      order.status = 6;
      order.cancel_time = new Date().toISOString();
      order.cancel_type = 'driver_reject';
      order.reject_count = (order.reject_count || 0) + 1;
    }
    saveDB(db);
    return sendJson(res, { code: 0, msg: quota.willDeductScore ? `拒单成功，将扣除${quota.scoreDeduction}分评分` : '拒单成功（本次免费）', data: {
      reject_used: quota.rejectUsed + 1,
      reject_left: Math.max(0, 1 - quota.rejectUsed - 1),
      will_deduct_score: quota.willDeductScore,
      score_deduction: quota.scoreDeduction || 0
    }});
  }

  // ========== GPS 位置 API ==========
  // POST /api/driver/location - 上报GPS位置
  if (pathname === '/api/driver/location' && method === 'POST') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    if (user.role !== 2 && user.role !== 3) return sendJson(res, { code: 403, msg: '仅司机可操作' }, 403);
    const { lat, lng, address, speed, direction } = await parseBody(req);
    if (!lat || !lng) return sendJson(res, { code: 400, msg: '经纬度不能为空' }, 400);
    const commissionEngine = require('./utils/commissionEngine');
    commissionEngine.updateDriverLocation(user.userId, parseFloat(lat), parseFloat(lng), address || '', db);
    saveDB(db);
    return sendJson(res, { code: 0, msg: '位置更新成功', data: { lat: parseFloat(lat), lng: parseFloat(lng), timestamp: new Date().toISOString() }});
  }

  // GET /api/driver/track - 获取轨迹
  if (pathname === '/api/driver/track' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '未登录' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const hours = parseInt(urlParams.searchParams.get('hours')) || 24;
    const commissionEngine = require('./utils/commissionEngine');
    const track = commissionEngine.getDriverTrack(user.userId, hours, db);
    return sendJson(res, { code: 0, data: { points: track, count: track.length }});
  }

  // GET /api/driver/location/:id - 获取指定司机位置
  if (pathname.startsWith('/api/driver/location/') && method === 'GET') {
    const driverId = parseInt(pathname.split('/')[4]);
    const location = db.driver_locations?.find(l => l.driver_id === driverId);
    return sendJson(res, { code: 0, data: location ? { lat: location.lat, lng: location.lng, address: location.address || '', updated_at: location.updated_at } : null });
  }

  // ========== 后台佣金管理 API (V1.2新增) ==========
  // GET /api/admin/commission/config - 获取平台佣金配置
  if (pathname === '/api/admin/commission/config' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const config = db.platform_config || {};
    const commissionEngine = require('./utils/commissionEngine');
    return sendJson(res, { code: 0, data: {
      ...config,
      mode_description: commissionEngine.getCommissionModeDesc(db)
    }});
  }

  // PUT /api/admin/commission/config - 更新佣金配置
  if (pathname === '/api/admin/commission/config' && method === 'PUT') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const body = await parseBody(req);
    if (!db.platform_config) db.platform_config = {};
    // 允许更新的字段
    const updatableFields = ['commission_mode', 'step_commission_enabled', 'global_free_commission', 'default_truck_commission', 'default_private_commission', 'updated_by'];
    updatableFields.forEach(field => {
      if (body[field] !== undefined) db.platform_config[field] = body[field];
    });
    db.platform_config.updated_at = new Date().toISOString();
    saveDB(db);
    return sendJson(res, { code: 0, msg: '佣金配置已更新', data: db.platform_config });
  }

  // GET /api/admin/commission/tiers - 获取阶梯佣金规则
  if (pathname === '/api/admin/commission/tiers' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const tiers = db.commission_tiers || [];
    return sendJson(res, { code: 0, data: tiers.sort((a, b) => a.order - b.order) });
  }

  // PUT /api/admin/commission/tiers - 更新阶梯佣金规则
  if (pathname === '/api/admin/commission/tiers' && method === 'PUT') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const body = await parseBody(req);
    if (!db.commission_tiers) db.commission_tiers = [];
    // 更新指定规则
    if (body.id) {
      const tier = db.commission_tiers.find(t => t.id === body.id);
      if (tier) {
        ['months_from', 'months_to', 'commission_rate', 'status', 'remark'].forEach(field => {
          if (body[field] !== undefined) tier[field] = body[field];
        });
      }
    } else {
      // 新增规则
      db.commission_tiers.push({
        id: db.nextIds.commission_tier++,
        name: body.name || '自定义规则',
        months_from: body.months_from || 0,
        months_to: body.months_to || 3,
        commission_rate: body.commission_rate || 0,
        status: body.status || 1,
        remark: body.remark || '',
        order: body.order || db.commission_tiers.length + 1
      });
    }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '阶梯规则已更新', data: db.commission_tiers });
  }

  // GET /api/admin/commission/users - 获取用户佣金列表
  if (pathname === '/api/admin/commission/users' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const page = parseInt(urlParams.searchParams.get('page')) || 1;
    const pageSize = parseInt(urlParams.searchParams.get('pageSize')) || 20;
    const roleFilter = urlParams.searchParams.get('role');
    // 获取所有司机/私家车用户
    let users = db.users.filter(u => u.role === 2 || u.role === 3);
    if (roleFilter) users = users.filter(u => u.role === parseInt(roleFilter));
    // 添加佣金信息
    const commissionEngine = require('./utils/commissionEngine');
    const result = users.map(u => {
      const info = commissionEngine.getUserCommissionRate(u, db);
      const grace = commissionEngine.getUserGracePeriodInfo(u, db);
      return {
        id: u.id,
        phone: u.phone,
        real_name: u.real_name || '',
        role: u.role,
        role_name: u.role === 2 ? '货车司机' : '私家车',
        register_time: u.register_time || u.create_time,
        commission_rate: info.commissionRate,
        rate_source: info.source,
        rate_description: info.description,
        grace_info: grace,
        score: u.score || 5.0
      };
    });
    const total = result.length;
    const paged = result.slice((page - 1) * pageSize, page * pageSize);
    return sendJson(res, { code: 0, data: { list: paged, total, page, pageSize }});
  }

  // POST /api/admin/commission/users/:id/override - 单用户佣金覆盖
  if (pathname.startsWith('/api/admin/commission/users/') && pathname.endsWith('/override') && method === 'POST') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const targetId = parseInt(pathname.split('/')[5]);
    const body = await parseBody(req);
    if (!db.user_commission_overrides) db.user_commission_overrides = [];
    // 检查是否已有覆盖
    const existing = db.user_commission_overrides.find(o => o.user_id === targetId);
    if (existing) {
      existing.commission_rate = body.commission_rate !== undefined ? body.commission_rate : existing.commission_rate;
      existing.status = body.status !== undefined ? body.status : existing.status;
      existing.remark = body.remark || existing.remark;
      existing.updated_by = user.userId;
      existing.updated_at = new Date().toISOString();
    } else {
      db.user_commission_overrides.push({
        id: db.nextIds.user_override++,
        user_id: targetId,
        commission_rate: body.commission_rate !== undefined ? body.commission_rate : 0,
        status: body.status !== undefined ? body.status : 1,
        remark: body.remark || '',
        created_by: user.userId,
        created_at: new Date().toISOString(),
        updated_by: user.userId,
        updated_at: new Date().toISOString()
      });
    }
    saveDB(db);
    return sendJson(res, { code: 0, msg: '佣金覆盖设置成功' });
  }

  // ========== 后台司机模式管理 ==========
  // GET /api/admin/drivers/modes - 获取所有司机模式状态
  if (pathname === '/api/admin/drivers/modes' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const page = parseInt(urlParams.searchParams.get('page')) || 1;
    const pageSize = parseInt(urlParams.searchParams.get('pageSize')) || 50;
    let drivers = db.users.filter(u => u.role === 2 || u.role === 3);
    const commissionEngine = require('./utils/commissionEngine');
    const result = drivers.map(d => {
      const mode = commissionEngine.getDriverMode(d.id, db);
      return { id: d.id, phone: d.phone, real_name: d.real_name || '', role: d.role, mode, mode_name: mode === 0 ? '直达模式' : '顺路模式', score: d.score || 5.0 };
    });
    const total = result.length;
    const paged = result.slice((page - 1) * pageSize, page * pageSize);
    return sendJson(res, { code: 0, data: { list: paged, total }});
  }

  // PUT /api/admin/drivers/:id/mode - 管理员设置司机模式
  if (pathname.startsWith('/api/admin/drivers/') && pathname.endsWith('/mode') && method === 'PUT') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const driverId = parseInt(pathname.split('/')[4]);
    const body = await parseBody(req);
    const modeInt = parseInt(body.mode);
    if (modeInt !== 0 && modeInt !== 1) return sendJson(res, { code: 400, msg: '模式值错误' }, 400);
    const commissionEngine = require('./utils/commissionEngine');
    commissionEngine.setDriverMode(driverId, modeInt, db);
    saveDB(db);
    return sendJson(res, { code: 0, msg: '模式设置成功', data: { mode: modeInt, mode_name: modeInt === 0 ? '直达模式' : '顺路模式' }});
  }

  // ========== 司机评分管理 ==========
  // GET /api/admin/drivers/scores - 获取所有司机评分
  if (pathname === '/api/admin/drivers/scores' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const page = parseInt(urlParams.searchParams.get('page')) || 1;
    const pageSize = parseInt(urlParams.searchParams.get('pageSize')) || 50;
    let drivers = db.users.filter(u => u.role === 2 || u.role === 3);
    const result = drivers.map(d => {
      const ratings = db.ratings?.filter(r => r.driver_id === d.id) || [];
      const avgScore = ratings.length > 0 
        ? Math.round(ratings.reduce((s, r) => s + (r.timeliness + r.punctuality + r.fulfillment + r.attitude) / 4, 0) / ratings.length * 10) / 10
        : 5.0;
      return { id: d.id, phone: d.phone, real_name: d.real_name || '', role: d.role, avg_score: avgScore, rating_count: ratings.length };
    });
    result.sort((a, b) => b.avg_score - a.avg_score);
    const total = result.length;
    const paged = result.slice((page - 1) * pageSize, page * pageSize);
    return sendJson(res, { code: 0, data: { list: paged, total }});
  }

  // ========== 优先派单API ==========
  // GET /api/dispatch/prioritize - 获取优先派单司机列表
  if (pathname === '/api/dispatch/prioritize' && method === 'GET') {
    const urlParams = new URL(req.url, 'http://localhost');
    const goodsId = parseInt(urlParams.searchParams.get('goodsId'));
    if (!goodsId) return sendJson(res, { code: 400, msg: '缺少goodsId参数' }, 400);

    const goods = db.goods.find(g => g.id === goodsId);
    if (!goods) return sendJson(res, { code: 404, msg: '货源不存在' }, 404);
    if (goods.status !== 1) return sendJson(res, { code: 400, msg: '该货源不可接单' }, 400);

    // 获取所有匹配司机
    const matchedDrivers = smartMatch.matchDriversForGoods({ id: goods.publish_user_id }, goods, db.routes, db.users, db.orders || []);

    // 应用优先派单逻辑(取前10个匹配司机)
    const limit = parseInt(urlParams.searchParams.get('limit')) || 5;
    const prioritized = smartMatch.prioritizeDrivers(matchedDrivers.slice(0, 10), db.users, db.orders || [], limit);

    return sendJson(res, {
      code: 0,
      data: {
        goodsId,
        total: prioritized.length,
        drivers: prioritized.map(d => ({
          driver_id: d.driver_id,
          driver_name: d.driver_name,
          driver_type: d.driver_type,
          start_addr: d.start_addr,
          end_addr: d.end_addr,
          depart_time: d.depart_time,
          matchScore: d.matchScore,
          priorityScore: d.priorityScore,
          priorityInfo: d.priorityInfo,
          license_plate: d.license_plate
        }))
      }
    });
  }

  // ========== 乡镇全覆盖管理 ==========
  // GET /api/admin/townships - 获取所有乡镇列表
  if (pathname === '/api/admin/townships' && method === 'GET') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const urlParams = new URL(req.url, 'http://localhost');
    const page = parseInt(urlParams.searchParams.get('page')) || 1;
    const pageSize = parseInt(urlParams.searchParams.get('pageSize')) || 50;
    const countyFilter = urlParams.searchParams.get('county');
    const statusFilter = urlParams.searchParams.get('status');
    
    let townships = db.townships || [];
    if (countyFilter) townships = townships.filter(t => t.county === countyFilter);
    if (statusFilter !== null) townships = townships.filter(t => t.status === parseInt(statusFilter));
    
    const total = townships.length;
    const paged = townships.slice((page - 1) * pageSize, page * pageSize);
    return sendJson(res, { code: 0, data: { list: paged, total, page, pageSize } });
  }

  // PUT /api/admin/townships/:id - 更新乡镇状态(启用/禁用)
  if (pathname.startsWith('/api/admin/townships/') && method === 'PUT') {
    if (!user || user.role !== 4) return sendJson(res, { code: 401, msg: '仅管理员可操作' }, 401);
    const townshipId = parseInt(pathname.split('/')[4]);
    const body = await parseBody(req);
    
    if (!db.townships) db.townships = [];
    const township = db.townships.find(t => t.id === townshipId);
    if (!township) return sendJson(res, { code: 404, msg: '乡镇不存在' }, 404);
    
    if (body.status !== undefined) township.status = parseInt(body.status);
    if (body.driver_count !== undefined) township.driver_count = parseInt(body.driver_count);
    if (body.order_count !== undefined) township.order_count = parseInt(body.order_count);
    
    saveDB(db);
    return sendJson(res, { code: 0, msg: '乡镇更新成功', data: township });
  }

  // GET /api/townships/coverage - 获取乡镇覆盖统计(公开)
  if (pathname === '/api/townships/coverage' && method === 'GET') {
    const townships = db.townships || [];
    const total = townships.length;
    const covered = townships.filter(t => t.status === 1).length;
    const counties = [...new Set(townships.map(t => t.county))];
    
    const coverage = counties.map(county => {
      const countyTownships = townships.filter(t => t.county === county);
      const countyCovered = countyTownships.filter(t => t.status === 1).length;
      return {
        county,
        total: countyTownships.length,
        covered: countyCovered,
        percentage: Math.round(countyCovered / countyTownships.length * 100)
      };
    });
    
    return sendJson(res, {
      code: 0,
      data: {
        total,
        covered,
        percentage: Math.round(covered / total * 100),
        counties: coverage
      }
    });
  }

  // ========== 权限管理API ==========
  // GET /api/user/permissions - 获取当前用户权限(用于前端控制UI)
  if (pathname === '/api/user/permissions' && method === 'GET') {
    if (!user) return sendJson(res, { code: 401, msg: '请先登录' }, 401);
    const perms = getUserPermissions(user.role);
    return sendJson(res, {
      code: 0,
      data: {
        role: user.role,
        role_name: ['', '商家', '货车司机', '私家车', '管理员', '个人'][user.role] || '未知',
        permissions: perms.permissions,
        limits: perms.limits,
        denied: perms.denied
      }
    });
  }

  // 404
  sendJson(res, { code: 404, msg: '接口不存在' }, 404);
}

// ==================== HTTP服务器 ====================

// CORS 跨域支持
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer(async (req, res) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    return res.end();
  }
  setCors(res);

  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // API路由
  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname, req.method);
  }

  // 去掉末尾 / 再处理
  const cleanPath = pathname.replace(/\/$/, '');

  // 静态文件 - 支持三个端
  let filePath = null;

  if (cleanPath === '/' || cleanPath.startsWith('/admin')) {
    filePath = path.join(__dirname, '../admin', cleanPath === '/' || cleanPath === '/admin' ? 'index.html' : cleanPath.replace('/admin', '') || 'index.html');
  } else if (pathname === '/merchant' || pathname.startsWith('/merchant/')) {
    filePath = path.join(__dirname, '../merchant', pathname === '/merchant' ? 'index.html' : pathname.replace('/merchant/', ''));
  } else if (pathname === '/driver' || pathname.startsWith('/driver/')) {
    filePath = path.join(__dirname, '../driver', pathname === '/driver' ? 'index.html' : pathname.replace('/driver/', ''));
  } else if (pathname === '/personal' || pathname.startsWith('/personal/')) {
    filePath = path.join(__dirname, '../personal', pathname === '/personal' ? 'index.html' : pathname.replace('/personal/', ''));
  }
  
  if (filePath && fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    return res.end(fs.readFileSync(filePath));
  }

  sendJson(res, { code: 404, msg: 'Not Found' }, 404);
});

const PORT = process.env.PORT || 3458;
// 监听 IPv4 所有接口，微信模拟器用 IPv4 访问
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚚 顺路货运撮合平台启动成功！`);
  console.log(`   后台地址: http://localhost:${PORT}`);
  console.log(`   API文档:  http://localhost:${PORT}/api-docs`);
  if (PORT === 3458) console.log(`   局域网IP: http://192.168.2.3:${PORT}\n`);
});
