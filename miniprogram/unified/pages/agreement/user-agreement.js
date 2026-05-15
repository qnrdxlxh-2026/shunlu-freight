// 用户服务协议
const app = getApp();
const READ_TIME = 5; // 需要阅读的秒数

Page({
  data: {
    countdown: READ_TIME,
    canAgree: false,
    agreed: false,
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '用户服务协议' });
    this.startCountdown();
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  startCountdown() {
    this._timer = setInterval(() => {
      const newCount = this.data.countdown - 1;
      if (newCount <= 0) {
        clearInterval(this._timer);
        this.setData({ countdown: 0, canAgree: true });
      } else {
        this.setData({ countdown: newCount });
      }
    }, 1000);
  },

  onAgree() {
    if (!this.data.canAgree) {
      wx.showToast({ title: `请阅读${READ_TIME}秒后再同意`, icon: 'none' });
      return;
    }
    // 设置全局标记，表示用户已阅读并同意用户协议
    wx.setStorageSync('agreement_user_read', true);
    this.setData({ agreed: true });
    wx.showToast({ title: '已同意用户服务协议', icon: 'success' });
    // 延迟返回
    setTimeout(() => wx.navigateBack(), 800);
  },
});