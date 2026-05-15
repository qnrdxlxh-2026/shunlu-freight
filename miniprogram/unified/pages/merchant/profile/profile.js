const app = getApp();

Page({
  data: {
    userInfo: null,
    orderCount: 0,
    balance: '0.00',
    goodsCount: 0,
    avatarUrl: '/assets/default-avatar.png',
    // 菜单名称，支持藏文等多语言
    menuNames: {
      publish: '发布货源',
      myGoods: '我的货源',
      allOrders: '全部订单',
      myWallet: '我的钱包',
      auth: '实名认证',
      settings: '账号设置',
      messages: '消息中心',
      about: '关于顺路货运',
    },
    // 分组标题（可编辑，支持藏文）
    sectionTitles: {
      merchantService: '📦 货运管理',
      account: '🔐 账户与安全'
    }
  },

  onShow() {

    // 初始化自定义TabBar
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().init();
      const pages = getCurrentPages();
      const currentPath = "/" + pages[pages.length - 1].route;
      const list = this.getTabBar().data.list;
      const idx = list.findIndex(item => item.pagePath === currentPath);
      this.getTabBar().setData({ selected: idx >= 0 ? idx : 0 });
    }
    this.loadUserInfo();
    const savedNames = wx.getStorageSync('merchant_menu_names');
    if (savedNames) this.setData({ menuNames: savedNames });
    const savedTitles = wx.getStorageSync('merchant_section_titles');
    if (savedTitles) this.setData({ sectionTitles: { ...this.data.sectionTitles, ...savedTitles } });
  },

  async loadUserInfo() {
    try {
      const res = await app.get('/api/user/info');
      const info = res.data;
      this.setData({ userInfo: info, balance: info.balance || '0.00' });
      app.globalData.userInfo = res.data;
    } catch (err) {
      console.log('获取用户信息失败', err);
    }
  },

  // 头像上传（支持裁剪/缩放/平移 - 微信 chooseAvatar 组件自带裁剪界面）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
    // TODO: wx.uploadFile 上传到服务器
    wx.showToast({ title: '头像已更新', icon: 'success' });
  },

  // 编辑用户名
  editName() {
    wx.showModal({
      title: '编辑用户名',
      editable: true,
      placeholderText: '请输入用户名（支持藏文）',
      success: res => {
        if (res.confirm && res.content) {
          this.setData({ 'userInfo.phone': res.content });
          // TODO: 上传到服务器
        }
      }
    });
  },

  // 保存菜单名称（支持藏文）
  saveMenuName(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value.trim();
    if (!value) return;
    const menuNames = { ...this.data.menuNames, [key]: value };
    this.setData({ menuNames });
    wx.setStorageSync('merchant_menu_names', menuNames);
  },

  // 编辑分组标题（支持藏文）
  editMenuTitle(e) {
    const type = e.currentTarget.dataset.type;
    const defaults = { merchantService: '📦 货运管理', account: '🔐 账户与安全' };
    const placeholders = { merchantService: '货运管理', account: '账户与安全' };
    wx.showModal({
      title: '编辑分组名称',
      editable: true,
      placeholderText: placeholders[type],
      success: res => {
        if (res.confirm && res.content) {
          const titles = { ...this.data.sectionTitles, [type]: res.content };
          this.setData({ sectionTitles: titles });
          wx.setStorageSync('merchant_section_titles', titles);
        }
      }
    });
  },

  goPublish() { wx.navigateTo({ url: '/pages/merchant/publish-order/publish-order' }); },
  goMyGoods() { wx.navigateTo({ url: '/pages/my-goods/my-goods' }); },
  goOrders() { wx.reLaunch({ url: '/pages/merchant/orders/orders' }); },
  goWallet() { wx.reLaunch({ url: '/pages/merchant/wallet/wallet' }); },
  goAuth() { wx.showModal({ title: '实名认证', content: '请前往微信实名认证页面完成认证。', confirmText: '知道了', showCancel: false }); },
  goSettings() { wx.showModal({ title: '账号设置', content: '账号设置功能即将上线，请耐心等待。', confirmText: '好的', showCancel: false }); },
  goUserAgreement() { wx.navigateTo({ url: '/pages/agreement/user-agreement/user-agreement' }); },
  goPrivacyPolicy() { wx.navigateTo({ url: '/pages/agreement/privacy-policy/privacy-policy' }); },
  goMessages() { wx.navigateTo({ url: '/pages/merchant/messages/messages' }); },
  goAbout() {
    wx.showModal({
      title: '关于顺路货运',
      content: '顺路货运 v1.0.0\n顺航川西藏区供应链旗下货运平台\n致力于为商家、司机、个人用户提供高效便捷的货运撮合服务。',
      confirmText: '我知道了', showCancel: false
    });
  },

  onLogout() {
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