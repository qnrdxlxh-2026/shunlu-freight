// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: {},
    todayOrders: 0,
    avatarUrl: '/assets/default-avatar.png'
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const userRes = await app.request({ url: '/user/info' });
      if (userRes.code === 0) {
        const userInfo = userRes.data;
        this.setData({ 
          userInfo,
          avatarUrl: userInfo.avatar || '/assets/default-avatar.png'
        });
      }

      const statsRes = await app.request({ url: '/driver/stats' });
      if (statsRes.code === 0) {
        this.setData({ todayOrders: statsRes.data.today_orders || 0 });
      }
    } catch (err) {
      console.error('加载数据失败', err);
    }
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0];
        wx.showLoading({ title: '上传中...' });
        try {
          const uploadRes = await app.uploadFile('/api/upload/photo', tempFilePath, 'avatar');
          if (uploadRes.code === 0) {
            const avatarUrl = uploadRes.data;
            // 更新用户信息
            await app.request({
              url: '/user/update',
              method: 'POST',
              data: { avatar: avatarUrl }
            });
            this.setData({ avatarUrl });
            wx.showToast({ title: '头像已更新', icon: 'success' });
          } else {
            wx.showToast({ title: uploadRes.msg || '上传失败', icon: 'none' });
          }
        } catch (err) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
        wx.hideLoading();
      }
    });
  },

  goOrders() {
    wx.switchTab({ url: '/pages/orders/orders' });
  },

  goWallet() {
    wx.switchTab({ url: '/pages/wallet/wallet' });
  },

  showRules() {
    wx.showModal({
      title: '私家车主接单规则',
      content: '1. 单票限重≤20kg\n2. 货值限额≤2000元\n3. 每日限接2单\n4. 县城内运费20元/单\n5. 平台抽成10%',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
        }
      }
    });
  }
});
