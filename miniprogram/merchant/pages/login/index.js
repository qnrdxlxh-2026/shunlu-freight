const app = getApp();

Page({
  data: {
    phone: '',
    password: '',
    password2: '',
    loading: false
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },
  onPwdInput(e) {
    this.setData({ password: e.detail.value });
  },
  onPwd2Input(e) {
    this.setData({ password2: e.detail.value });
  },

  onRegister() {
    const { phone, password, password2 } = this.data;
    if (!phone || phone.length !== 11) {
      return wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
    }
    if (!password || password.length < 6) {
      return wx.showToast({ title: '密码至少6位', icon: 'none' });
    }
    if (password !== password2) {
      return wx.showToast({ title: '两次密码不一致', icon: 'none' });
    }

    this.setData({ loading: true });
    app.post('/merchant/register', { phone, password })
      .then(res => {
        if (res.token) {
          app.globalData.token = res.token;
          app.globalData.userInfo = res.user;
          wx.setStorageSync('token', res.token);
          wx.setStorageSync('userInfo', res.user);
          wx.redirectTo({ url: '/pages/home/home' });
        } else {
          wx.showToast({ title: res.message || '注册失败', icon: 'none' });
        }
        this.setData({ loading: false });
      })
      .catch(err => {
        wx.showToast({ title: err.message || '注册失败', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  goLogin() {
    wx.redirectTo({ url: '/pages/login/login?type=login' });
  }
});
