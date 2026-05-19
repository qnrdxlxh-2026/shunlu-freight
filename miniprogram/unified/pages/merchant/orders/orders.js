const app = getApp();

// 订单状态映射
const statusMap = { 0: '待支付', 1: '待接单', 2: '待取货', 3: '配送中', 4: '已完成', 5: '已取消', 6: '已签收' };

Page({
  data: {
    orders: [],
    type: 'all',
    // 保持所有Tab选项
    tabs: ['全部', '待接单', '待取货', '配送中', '已完成', '已签收', '已取消'],
    tabIndex: 0,
    loading: false,
    statusText: statusMap
  },

  onLoad(opts) {
    if (opts.type === 'goods') this.setData({ tabIndex: 0 });
    this.loadOrders();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadOrders();
  },

  // 点击Tab切换
  onChangeTab(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ tabIndex: index });
    this.loadOrders();
  },

  loadOrders() {
    this.setData({ loading: true });
    app.get('/api/merchant/orders').then(res => {
      const allOrders = res.data || [];
      // 按Tab筛选状态
      const statusMap2 = { 0: null, 1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 5 };
      const filterStatus = statusMap2[this.data.tabIndex];
      const orders = filterStatus !== null ? allOrders.filter(o => o.status === filterStatus) : allOrders;
      this.setData({ orders, loading: false });
    }).catch(err => {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  // 点击订单查看详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/merchant/order-detail/order-detail?id=' + id });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/merchant/publish-order/publish-order' });
  }
});

  goDetail(e) {
    wx.navigateTo({ url: '/pages/merchant/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/merchant/publish-order/publish-order' });
  }
});
