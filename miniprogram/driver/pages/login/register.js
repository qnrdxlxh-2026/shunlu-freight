const app = getApp();
Page({
  data: { phone: '', password: '', password2: '', loading: false, driverTypes: ['货车（拉货）', '私家车（带运）'], driverTypeIndex: 0 },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },
  onPwdInput(e) { this.setData({ password: e.detail.value }); },
  onPwd2Input(e) { this.setData({ password2: e.detail.value }); },
  onTypeChange(e) { this.setData({ driverTypeIndex: e.detail.value }); },
  onRegister() {
    const { phone, password, password2 } = this.data;
    if (!phone || phone.length !== 11) return wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
    if (!password || password.length < 6) return wx.showToast({ title: '密码至少6位', icon: 'none' });
    if (password !== password2) return wx.showToast({ title: '两次密码不一致', icon: 'none' });
    this.setData({ loading: true });
    // 2=货车 3=私家车
    const role = this.data.driverTypeIndex === 0 ? 2 : 3;
    app.post('/api/user/register', { phone, password, role }).then(res => {
      if (res.data && res.data.token) {
        app.globalData.token = res.data.token;
        app.globalData.userInfo = { id: res.data.user_id, phone, role };
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userInfo', { id: res.data.user_id, phone, role });
        wx.switchTab({ url: '/pages/home/home' });
      } else { wx.showToast({ title: res.msg || '注册失败', icon: 'none' }); this.setData({ loading: false }); }
    }).catch(err => { wx.showToast({ title: err.message || '注册失败', icon: 'none' }); this.setData({ loading: false }); });
  },
  goLogin() { wx.redirectTo({ url: '/pages/login/login' }); }
});
