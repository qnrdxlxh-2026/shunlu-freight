const app = getApp();
const api = require('../../utils/api.js');
const { validatePhone, validatePassword } = require('../../utils/util.js');

Page({
  data: {
    phone: '',
    password: '',
    loading: false
  },

  onLoad() {
    // 检查是否已登录
    const token = wx.getStorageSync('token');
    if (token) {
      wx.switchTab({ url: '/pages/home/home' });
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async onLogin() {
    const { phone, password } = this.data;

    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    if (!validatePhone(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await api.login({ phone, password });
      const { token, userInfo } = res.data;
      // 存储 token 和用户信息
      wx.setStorageSync('token', token);
      wx.setStorageSync('userInfo', userInfo);
      app.globalData.token = token;
      app.globalData.userInfo = userInfo;
      // 跳转首页
      wx.switchTab({ url: '/pages/home/home' });
    } catch (err) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  }
});
