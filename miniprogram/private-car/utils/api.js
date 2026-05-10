/**
 * API 统一封装
 */
const app = getApp();

const api = {
  // ========== 用户相关 ==========
  // 登录
  login(data) {
    return app.post('/api/user/login', data);
  },
  // 注册
  register(data) {
    return app.post('/api/user/register', data);
  },
  // 获取用户信息
  getUserInfo() {
    return app.get('/api/user/info');
  },
  // 退出登录
  logout() {
    return app.post('/api/user/logout');
  },

  // ========== 司机相关 ==========
  // 发布行程
  publishRoute(data) {
    return app.post('/api/driver/publish-route', data);
  },
  // 获取我的行程
  getMyRoutes() {
    return app.get('/api/driver/my-routes');
  },
  // 获取司机订单列表
  getDriverOrders(params) {
    return app.get('/api/driver/orders', params);
  },
  // 接单
  takeOrder(orderId) {
    return app.post('/api/driver/take-order', { orderId });
  },
  // 获取附近货源
  getNearbyGoods(params) {
    return app.get('/api/match/nearby-goods', params);
  },

  // ========== 订单相关 ==========
  // 订单详情
  getOrderDetail(orderId) {
    return app.get('/api/order/detail/' + orderId);
  },
  // 确认取货
  pickup(orderId) {
    return app.post('/api/order/pickup', { orderId });
  },
  // 确认送达
  deliver(orderId) {
    return app.post('/api/order/deliver', { orderId });
  },

  // ========== 钱包相关 ==========
  // 获取钱包信息
  getWalletInfo() {
    return app.get('/api/wallet/info');
  },
  // 获取收入记录
  getWalletRecords(params) {
    return app.get('/api/wallet/records', params);
  },
  // 提现
  withdraw(data) {
    return app.post('/api/wallet/withdraw', data);
  },

  // ========== 消息相关 ==========
  // 会话列表
  getConversations() {
    return app.get('/api/message/conversations');
  },
  // 消息列表
  getMessageList(userId) {
    return app.get('/api/message/list/' + userId);
  },
  // 发送消息
  sendMessage(data) {
    return app.post('/api/message/send', data);
  },
  // 通话请求
  callRequest(data) {
    return app.post('/api/message/call-request', data);
  }
};

module.exports = api;
