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
      console.log('登录成功，res=', JSON.stringify(res));
      const { token, userInfo } = res.data || {};
      console.log('token=', token ? '有值(' + token.slice(0, 20) + ')' : '空');
      console.log('userInfo=', JSON.stringify(userInfo));
      if (!token || !userInfo) {
        wx.showToast({ title: '登录返回数据异常', icon: 'none' });
        return;
      }
      wx.setStorageSync('token', token);
      wx.setStorageSync('userInfo', userInfo);
      app.globalData.token = token;
      app.globalData.userInfo = userInfo;
      console.log('准备跳转首页，当前globalData.token=', app.globalData.token);
      wx.switchTab({ url: '/pages/home/home' });
    } catch (e) {
      console.error('登录失败 e=', e.message, e);
      wx.showToast({ title: e.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  }
});
