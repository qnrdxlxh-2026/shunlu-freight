/**
 * utils/api.js - 统一API接口（路径已对齐后端）
 * 
 * 后端路由对照表 - 所有路径必须与 server/app.js 一致
 */

const app = getApp();

// 基础请求方法
function request(url, method = 'GET', data = {}) {
  return app.request(url, method, data);
}

function get(url) {
  return request(url, 'GET');
}

function post(url, data) {
  return request(url, 'POST', data);
}

// ========== 认证相关 ==========
// 登录
function login(phone, password, role) {
  return post('/api/user/login', { phone, password, role });
}

// 注册
function register(data) {
  return post('/api/user/register', data);
}

// 获取用户信息
function getUserInfo() {
  return get('/api/user/info');
}

// 实名认证
function realAuth(data) {
  return post('/api/user/real-auth', data);
}

// 更新司机/车辆信息
function updateDriverInfo(data) {
  return post('/api/user/update-driver-info', data);
}

// 获取司机信息
function getDriverInfo() {
  return get('/api/user/driver-info');
}

// ========== 商家端API ==========
// 发布货源 → 后端: /api/merchant/publish-goods
function publishOrder(data) {
  return post('/api/merchant/publish-goods', data);
}

// 获取商家货源列表 → 后端: /api/merchant/goods-list
function getMerchantGoodsList(params) {
  return get('/api/merchant/goods-list', params);
}

// 获取商家订单列表 → 后端: /api/merchant/orders
function getMerchantOrders(params) {
  return get('/api/merchant/orders', params);
}

// 获取订单详情 → 后端: /api/merchant/order/:id
function getOrderDetail(orderId) {
  return get(`/api/merchant/order/${orderId}`);
}

// 取消订单 → 后端: /api/order/cancel
function cancelOrder(orderId) {
  return post('/api/order/cancel', { order_id: orderId });
}

// 获取结算单 → 后端: /api/merchant/settlements
function getMerchantSettlements(params) {
  return get('/api/merchant/settlements', params);
}

// ========== 司机端API ==========
// 获取附近货源（匹配） → 后端: /api/driver/match-goods
function getNearbyGoods(params) {
  return get('/api/driver/match-goods', params);
}

// 获取货源列表（别名）
function getGoodsList(params) {
  return get('/api/driver/match-goods', params);
}

// 发布车源/路线 → 后端: /api/driver/publish-route
function publishRoute(data) {
  return post('/api/driver/publish-route', data);
}

// 获取我的路线 → 后端: /api/driver/my-routes
function getMyRoutes(params) {
  return get('/api/driver/my-routes', params);
}

// 接单 → 后端: /api/driver/take-order
function acceptOrder(goodsId) {
  return post('/api/driver/take-order', { goods_id: goodsId });
}

// 接单（别名）
function takeOrder(goodsId) {
  return post('/api/driver/take-order', { goods_id: goodsId });
}

// 获取司机订单列表 → 后端: /api/driver/orders
function getDriverOrders(params) {
  return get('/api/driver/orders', params);
}

// 获取司机统计 → 后端: /api/driver/stats
function getDriverStats() {
  return get('/api/driver/stats');
}

// 获取司机结算单 → 后端: /api/driver/settlements
function getDriverSettlements(params) {
  return get('/api/driver/settlements', params);
}

// ========== 私家车端API（复用司机端接口） ==========
function getPrivateCarGoodsList(params) {
  return get('/api/driver/match-goods', params);
}

function publishPrivateCarRoute(data) {
  return post('/api/driver/publish-route', data);
}

function getPrivateCarRoutes(params) {
  return get('/api/driver/my-routes', params);
}

function acceptPrivateCarOrder(goodsId) {
  return post('/api/driver/take-order', { goods_id: goodsId });
}

function getPrivateCarOrders(params) {
  return get('/api/driver/orders', params);
}

// ========== 个人端API ==========
// 发布货源（个人寄件） → 后端: /api/personal/publish-goods
function publishGoods(data) {
  return post('/api/personal/publish-goods', data);
}

// 寄件（别名）
function sendPackage(data) {
  return post('/api/personal/publish-goods', data);
}

// 获取我的货源列表 → 后端: /api/personal/goods-list
function getMyPackages(params) {
  return get('/api/personal/goods-list', params);
}

// 获取个人订单列表 → 后端: /api/personal/orders
function getPersonalOrders(params) {
  return get('/api/personal/orders', params);
}

// 查找附近司机 → 后端: /api/match/nearby-drivers
function getNearbyDrivers(params) {
  return get('/api/match/nearby-drivers', params);
}

// 查找司机（别名）
function findDrivers(params) {
  return get('/api/match/nearby-drivers', params);
}

// ========== 订单通用API ==========
// 订单支付 → 后端: /api/order/pay
function payOrder(orderId) {
  return post('/api/order/pay', { order_id: orderId });
}

// 订单签收 → 后端: /api/order/sign
function signOrder(orderId) {
  return post('/api/order/sign', { order_id: orderId });
}

// 订单取货 → 后端: /api/order/pickup
function pickupOrder(orderId) {
  return post('/api/order/pickup', { order_id: orderId });
}

// 订单送达 → 后端: /api/order/deliver
function deliverOrder(orderId) {
  return post('/api/order/deliver', { order_id: orderId });
}

// 确认收货 → 后端: /api/order/confirm-receipt
function confirmReceipt(orderId) {
  return post('/api/order/confirm-receipt', { order_id: orderId });
}

// ========== 价格相关 ==========
// 计算运费 → 后端: /api/price/calculate
function calculatePrice(data) {
  return post('/api/price/calculate', data);
}

// 估算距离 → 后端: /api/price/estimate-distance
function estimateDistance(data) {
  return post('/api/price/estimate-distance', data);
}

// 运费规则 → 后端: /api/price/rules
function getPriceRules() {
  return get('/api/price/rules');
}

// ========== 匹配相关 ==========
// 全局最优匹配 → 后端: /api/match/global-optimal
function globalOptimalMatch() {
  return get('/api/match/global-optimal');
}

// 匹配评分详情 → 后端: /api/match/score-detail
function getMatchScoreDetail(params) {
  return get('/api/match/score-detail', params);
}

// ========== 钱包相关 ==========
// 获取钱包信息 → 后端: /api/wallet/info
function getWallet() {
  return get('/api/wallet/info');
}

// 获取钱包信息（别名）
function getWalletInfo() {
  return get('/api/wallet/info');
}

// 获取余额 → 后端: /api/wallet/balance
function getWalletBalance() {
  return get('/api/wallet/balance');
}

// 获取交易记录 → 后端: /api/wallet/records
function getTransactions(params) {
  return get('/api/wallet/records', params);
}

// 充值 → 后端: /api/wallet/recharge
function recharge(amount) {
  return post('/api/wallet/recharge', { amount });
}

// 提现 → 后端: /api/wallet/withdraw
function withdraw(amount) {
  return post('/api/wallet/withdraw', { amount });
}

// ========== 消息/聊天 ==========
// 获取会话列表 → 后端: /api/message/conversations
function getConversations(params) {
  return get('/api/message/conversations', params);
}

// 获取消息列表（别名）
function getMessages(params) {
  return get('/api/message/conversations', params);
}

// 发送消息 → 后端: /api/message/send
function sendChatMessage(data) {
  return post('/api/message/send', data);
}

// 发起通话请求 → 后端: /api/message/call-request
function requestCall(data) {
  return post('/api/message/call-request', data);
}

// ========== 上传 ==========
// 上传图片 → 后端: /api/upload/photo
function uploadPhoto(filePath) {
  return app.uploadFile('/api/upload/photo', filePath, 'photo');
}

// 上传文件（别名）
function uploadFile(filePath, name) {
  return app.uploadFile('/api/upload/photo', filePath, name || 'photo');
}

// ========== 评分 ==========
// 提交评分 → 后端: /api/rating/submit
function submitRating(data) {
  return post('/api/rating/submit', data);
}

// 获取评分 → 后端: /api/rating/driver/:id
function getDriverRatings(driverId) {
  return get(`/api/rating/driver/${driverId}`);
}

// ========== 证件审核 ==========
// 提交审核资料 → 后端: /api/driver/audit-submit
function submitAudit(data) {
  return post('/api/driver/audit-submit', data);
}

// 获取审核状态 → 后端: /api/driver/audit-status
function getAuditStatus() {
  return get('/api/driver/audit-status');
}

// ========== 投诉 ==========
// 提交投诉 → 后端: /api/complaint/submit
function submitComplaint(data) {
  return post('/api/complaint/submit', data);
}

// 获取我的投诉 → 后端: /api/complaint/my
function getMyComplaints(params) {
  return get('/api/complaint/my', params);
}

module.exports = {
  request,
  get,
  post,
  // 认证
  login,
  register,
  getUserInfo,
  realAuth,
  updateDriverInfo,
  getDriverInfo,
  // 商家端
  publishOrder,
  getMerchantGoodsList,
  getMerchantOrders,
  getOrderDetail,
  cancelOrder,
  getMerchantSettlements,
  // 司机端
  getNearbyGoods,
  getGoodsList,
  publishRoute,
  getMyRoutes,
  acceptOrder,
  takeOrder,
  getDriverOrders,
  getDriverStats,
  getDriverSettlements,
  // 私家车端
  getPrivateCarGoodsList,
  publishPrivateCarRoute,
  getPrivateCarRoutes,
  acceptPrivateCarOrder,
  getPrivateCarOrders,
  // 个人端
  publishGoods,
  sendPackage,
  getMyPackages,
  getPersonalOrders,
  getNearbyDrivers,
  findDrivers,
  // 订单通用
  payOrder,
  signOrder,
  pickupOrder,
  deliverOrder,
  confirmReceipt,
  // 价格
  calculatePrice,
  estimateDistance,
  getPriceRules,
  // 匹配
  globalOptimalMatch,
  getMatchScoreDetail,
  // 钱包
  getWallet,
  getWalletInfo,
  getWalletBalance,
  getTransactions,
  recharge,
  withdraw,
  // 消息/聊天
  getConversations,
  getMessages,
  sendChatMessage,
  requestCall,
  // 上传
  uploadPhoto,
  uploadFile,
  // 评分
  submitRating,
  getDriverRatings,
  // 证件审核
  submitAudit,
  getAuditStatus,
  // 投诉
  submitComplaint,
  getMyComplaints,
};
