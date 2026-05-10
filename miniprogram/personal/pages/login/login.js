const app = getApp();
const api = require('../../utils/api.js');
const { validatePhone } = require('../../utils/util.js');

Page({
  data: {
    phone: '',
    password: '',
    loading: false
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async onLogin() {
    const { phone, password } = this.data;
    if (!phone) return wx.showToast({ title: '请输入手机号', icon: 'none' });
    if (!validatePhone(phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    if (!password) return wx.showToast({ title: '请输入密码', icon: 'none' });

    this.setData({ loading: true });
    try {
      const res = await api.login({ phone, password });
      const { token, userInfo } = res.data;
      wx.setStorageSync('token', token);
      wx.setStorageSync('userInfo', userInfo);
      app.globalData.token = token;
      app.globalData.userInfo = userInfo;
      wx.switchTab({ url: '/pages/home/home' });
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  }
});
