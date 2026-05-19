const app = getApp();
const api = require('../../../utils/api.js');
const { getOrderStatusText, getOrderStatusClass, formatAmount } = require('../../../utils/util.js');
const gpsReporter = require('../../../utils/gpsReporter.js');

Page({
  data: {
    userInfo: null,
    driverMode: 'direct',  // 运行模式：direct(直达) / round-way(顺路)
    stats: {
      waitPickup: 0,
      delivering: 0,
      completed: 0,
      monthIncome: '0.00'
    },
    recentOrders: []
  },

  onLoad() {
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ userInfo });
  },

  onUnload() {
    gpsReporter.stopGPSReport();
  },

  onShow() {
    // 登录检查
    if (!app.globalData.token) {
      wx.redirectTo({ url: '/pages/login/login?role=2' });
      return;
    }

    // 初始化自定义TabBar
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().init();
      const pages = getCurrentPages();
      const currentPath = "/" + pages[pages.length - 1].route;
      const list = this.getTabBar().data.list;
      const idx = list.findIndex(item => item.pagePath === currentPath);
      this.getTabBar().setData({ selected: idx >= 0 ? idx : 0 });
    }
    // 登录后启动 GPS 实时上报
    if (app.globalData.token) {
      gpsReporter.startGPSReport();
    }
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    try {
      const [userInfoRes, ordersRes, walletRes] = await Promise.all([
        api.getUserInfo().catch(() => null),
        api.getDriverOrders().catch(() => null),
        api.getWalletInfo().catch(() => null)
      ]);

      // 用户信息
      if (userInfoRes && userInfoRes.data) {
        const info = userInfoRes.data;
        info.avatarTail = info.phone ? info.phone.slice(-4) : '****';
        this.setData({ 
          userInfo: info,
          driverMode: info.driver_mode || 'direct'  // 设置当前模式
        });
        app.globalData.userInfo = userInfoRes.data;
      }

      // 统计数据
      const orders = (ordersRes && ordersRes.data) || [];
      const stats = {
        waitPickup: orders.filter(o => o.status === 2).length,
        delivering: orders.filter(o => o.status === 3).length,
        completed: orders.filter(o => o.status === 4).length,
        monthIncome: walletRes && walletRes.data ? formatAmount(walletRes.data.monthIncome) : '0.00'
      };
      this.setData({ stats });

      // 最新订单（取前3条）
      const recentOrders = orders.slice(0, 3).map(order => ({
        ...order,
        statusText: getOrderStatusText(order.status),
        statusClass: getOrderStatusClass(order.status)
      }));
      this.setData({ recentOrders });

    } catch (err) {
      console.error('首页数据加载失败', err);
    }
  },

  goPublishRoute() {
    wx.navigateTo({ url: '/pages/driver/publish-route/publish-route' });
  },

  goFindGoods() {
    wx.navigateTo({ url: '/pages/driver/find-goods/find-goods' });
  },

  goOrders(e) {
    const status = e.currentTarget.dataset.status;
    wx.navigateTo({ url: `/pages/driver/orders/orders?status=${status}` });
  },

  // 切换运行模式
  async onModeSwitch(e) {
    const newMode = e.detail.value ? 'round-way' : 'direct';
    wx.showLoading({ title: '切换中...' });
    try {
      const res = await api.switchDriverMode(newMode);
      if (res && res.code === 0) {
        this.setData({ driverMode: newMode });
        wx.showToast({ title: `已切换为${newMode === 'direct' ? '直达' : '顺路'}模式`, icon: 'success' });
      } else {
        wx.showToast({ title: res.msg || '切换失败', icon: 'none' });
      }
    } catch (err) {
      console.error('切换模式失败', err);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  goScanOrder() {
    wx.navigateTo({ url: '/pages/driver/scan-order/scan-order' });
  },

  goMyRoutes() {
    wx.navigateTo({ url: '/pages/driver/my-routes/my-routes' });
  },

  goWallet() {
    wx.reLaunch({ url: '/pages/driver/wallet/wallet' });
  },

  goOrders(e) {
    const status = e.currentTarget.dataset.status;
    wx.navigateTo({ url: '/pages/driver/orders/orders' + (status ? '?status=' + status : '') });
  },

  goOrderDetail(e) {
    wx.navigateTo({ url: '/pages/driver/order-detail/order-detail?id=' + e.currentTarget.dataset.id });
  }
});
