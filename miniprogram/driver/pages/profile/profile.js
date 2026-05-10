const app = getApp();

Page({
  data: {
    userInfo: null,
    orderCount: 0,
    balance: '0.00',
    totalIncome: '0.00',
    avatarUrl: '/assets/default-avatar.png',
    menuNames: {
      findGoods: '找货源',
      myRoutes: '我的常跑路线',
      allOrders: '全部订单',
      myWallet: '我的钱包',
      messages: '消息中心',
      editProfile: '编辑资料',
      about: '关于顺路货运',
    },
    sectionTitles: {
      driverService: '🚚 司机服务',
      account: '🔐 账户与工具'
    }
  },

  onShow() {
    this.loadUserInfo();
    const savedNames = wx.getStorageSync('driver_menu_names');
    if (savedNames) this.setData({ menuNames: savedNames });
    const savedTitles = wx.getStorageSync('driver_section_titles');
    if (savedTitles) this.setData({ sectionTitles: { ...this.data.sectionTitles, ...savedTitles } });
  },

  async loadUserInfo() {
    try {
      const res = await app.get('/api/user/info');
      const info = res.data;
      this.setData({ userInfo: info });
      app.globalData.userInfo = res.data;
    } catch (err) {
      console.log('获取用户信息失败', err);
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
    wx.showToast({ title: '头像已更新', icon: 'success' });
  },

  editName() {
    wx.showModal({
      title: '编辑用户名',
      editable: true,
      placeholderText: '请输入用户名（支持藏文）',
      success: res => {
        if (res.confirm && res.content) {
          this.setData({ 'userInfo.phone': res.content });
        }
      }
    });
  },

  saveMenuName(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value.trim();
    if (!value) return;
    const menuNames = { ...this.data.menuNames, [key]: value };
    this.setData({ menuNames });
    wx.setStorageSync('driver_menu_names', menuNames);
  },

  editMenuTitle(e) {
    const type = e.currentTarget.dataset.type;
    const placeholders = { 'driver-service': '司机服务', 'account': '账户与工具' };
    wx.showModal({
      title: '编辑分组名称',
      editable: true,
      placeholderText: placeholders[type],
      success: res => {
        if (res.confirm && res.content) {
          const titles = { ...this.data.sectionTitles, [type]: res.content };
          this.setData({ sectionTitles: titles });
          wx.setStorageSync('driver_section_titles', titles);
        }
      }
    });
  },

  goFindGoods() { wx.navigateTo({ url: '/pages/find-goods/find-goods' }); },
  goMyRoutes() { wx.navigateTo({ url: '/pages/my-routes/my-routes' }); },
  goOrders() { wx.switchTab({ url: '/pages/orders/orders' }); },
  goWallet() { wx.switchTab({ url: '/pages/wallet/wallet' }); },
  goMessages() { wx.navigateTo({ url: '/pages/messages/messages' }); },

  goEditProfile() {
    wx.showModal({
      title: '编辑资料',
      content: '编辑资料功能即将上线，请耐心等待。',
      confirmText: '好的', showCancel: false
    });
  },

  goAbout() {
    wx.showModal({
      title: '关于顺路货运',
      content: '顺路货运 v1.0.0\n顺航川西藏区供应链旗下货运平台\n致力于为商家、司机、个人用户提供高效便捷的货运撮合服务。',
      confirmText: '我知道了', showCancel: false
    });
  },

  logout() {
    wx.showModal({
      title: '提示', content: '确定退出登录？',
      success: res => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          app.globalData.token = null;
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});