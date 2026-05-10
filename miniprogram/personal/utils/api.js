/**
 * API 统一封装
 */
const app = getApp();

const api = {
  // 用户相关
  login(data) { return app.post('/api/user/login', data); },
  register(data) { return app.post('/api/user/register', data); },
  getUserInfo() { return app.get('/api/user/info'); },

  // 个人端货源
  publishGoods(data) { return app.post('/api/personal/publish-goods', data); },
  getMyGoods() { return app.get('/api/personal/goods-list'); },
  getPersonalOrders() { return app.get('/api/personal/orders'); },

  // 订单相关
  getOrderDetail(orderId) { return app.get('/api/order/detail/' + orderId); },
  payOrder(orderId) { return app.post('/api/order/pay', { order_id: orderId }); },
  confirmReceipt(orderId) { return app.post('/api/order/confirm-receipt', { order_id: orderId }); },
  cancelOrder(orderId, reason) { return app.post('/api/order/cancel', { order_id: orderId, reason }); },

  // 钱包相关
  getWalletInfo() { return app.get('/api/wallet/info'); },
  getWalletRecords() { return app.get('/api/wallet/records'); },
  recharge(data) { return app.post('/api/wallet/recharge', data); },

  // 消息相关
  getConversations() { return app.get('/api/message/conversations'); },
  getMessageList(userId) { return app.get('/api/message/list/' + userId); },
  sendMessage(data) { return app.post('/api/message/send', data); },

  // 找司机
  getNearbyDrivers(params) { return app.get('/api/match/nearby-drivers', params); }
};

module.exports = api;
