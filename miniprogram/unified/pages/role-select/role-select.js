// pages/role-select/role-select.js
const app = getApp();

Page({
  data: {
    hasLogin: false,
    lastRole: null
  },

  onLoad() {
    // 已登录且有上次角色 → 直接跳转
    if (app.globalData.token && app.globalData.currentRole) {
      this._goToRole(app.globalData.currentRole);
      return;
    }
    this.setData({
      hasLogin: !!app.globalData.token,
      lastRole: app.globalData.currentRole
    });
  },

  onShow() {
    // 自定义TabBar在此页不显示
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ list: [] });
    }
  },

  // 选择角色
  selectRole(e) {
    const role = Number(e.currentTarget.dataset.role);
    
    if (!app.globalData.token) {
      // 未登录 → 先登录，带上角色参数
      // 使用reLaunch而非navigateTo，避免自定义TabBar模式下导航异常
      wx.reLaunch({ url: `/pages/login/login?role=${role}` });
      return;
    }

    app.setRole(role);
    this._goToRole(role);
  },

  _goToRole(role) {
    const routes = {
      1: '/pages/merchant/home/home',
      2: '/pages/driver/home/home',
      3: '/pages/private-car/home/home',
      5: '/pages/personal/home/home'
    };
    const url = routes[role];
    if (url) {
      wx.reLaunch({ url });
    }
  },

  // 切换账号
  switchAccount() {
    app.logout();
  }
});
