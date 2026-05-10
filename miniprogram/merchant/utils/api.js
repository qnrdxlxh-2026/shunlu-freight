/**
 * API 接口封装
 */

const app = getApp();

/**
 * 用户相关 API
 */
export const userApi = {
  // 登录
  login: (data) => app.post('/api/user/login', data),
  
  // 注册
  register: (data) => app.post('/api/user/register', data),
  
  // 获取用户信息
  getInfo: () => app.get('/api/user/info'),
  
  // 更新用户信息
  updateInfo: (data) => app.post('/api/user/update', data)
};

/**
 * 商家相关 API
 */
export const merchantApi = {
  // 获取订单列表
  getOrders: (status) => {
    const url = status !== undefined ? `/api/merchant/orders?status=${status}` : '/api/merchant/orders';
    return app.get(url);
  },
  
  // 获取统计数据
  getStats: () => app.get('/api/merchant/stats'),
  
  // 发布货源
  publishGoods: (data) => app.post('/api/merchant/publish-goods', data),
  
  // 获取货源列表
  getGoodsList: () => app.get('/api/merchant/goods-list'),
  
  // 获取货源详情
  getGoodsDetail: (id) => app.get(`/api/merchant/goods/${id}`),
  
  // 更新货源
  updateGoods: (id, data) => app.post(`/api/merchant/goods/${id}`, data),
  
  // 删除货源
  deleteGoods: (id) => app.post(`/api/merchant/goods/${id}/delete`)
};

/**
 * 订单相关 API
 */
export const orderApi = {
  // 获取订单详情
  getDetail: (id) => app.get(`/api/order/${id}`),
  
  // 支付订单
  pay: (id) => app.post(`/api/order/${id}/pay`),
  
  // 签收订单
  sign: (id) => app.post(`/api/order/${id}/sign`),
  
  // 取消订单
  cancel: (id) => app.post(`/api/order/${id}/cancel`)
};

/**
 * 钱包相关 API
 */
export const walletApi = {
  // 获取余额
  getBalance: () => app.get('/api/wallet/balance'),
  
  // 充值
  recharge: (data) => app.post('/api/wallet/recharge', data),
  
  // 获取交易记录
  getRecords: (page = 1, size = 20) => app.get(`/api/wallet/records?page=${page}&size=${size}`)
};

/**
 * 消息相关 API
 */
export const messageApi = {
  // 获取会话列表
  getConversations: () => app.get('/api/message/conversations'),
  
  // 获取消息列表
  getMessages: (userId, page = 1, size = 20) => 
    app.get(`/api/message/list/${userId}?page=${page}&size=${size}`),
  
  // 发送消息
  send: (data) => app.post('/api/message/send', data),
  
  // 发起通话请求
  callRequest: (data) => app.post('/api/message/call-request', data),
  
  // 标记已读
  markRead: (userId) => app.post(`/api/message/read/${userId}`)
};

export default {
  user: userApi,
  merchant: merchantApi,
  order: orderApi,
  wallet: walletApi,
  message: messageApi
};