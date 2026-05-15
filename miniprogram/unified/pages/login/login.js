// pages/login/login.js
const app = getApp();

Page({
  data: {
    phone: '',
    password: '',
    loading: false,
    role: null,
    roleName: '',
    agreeAgreement: false,
    agreementReadHint: '', // 提示哪个协议未读
  },

  onLoad(options) {
    const role = options && options.role ? Number(options.role) : null;
    const roleNames = { 1: '商家', 2: '货车司机', 3: '私家车主', 5: '个人用户' };
    this.setData({ role, roleName: role ? roleNames[role] || '' : '' });

    // 连通性测试
    wx.request({
      url: app.globalData.BASE_URL + '/api/test',
      success: res => console.log('[TEST] 后端连通:', JSON.stringify(res.data)),
      fail: err => console.error('[TEST] 后端连接失败:', err)
    });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  onAgreementChange(e) {
    this.setData({ agreeAgreement: e.detail.value.includes('agreed') });
  },

  // 检查协议是否已阅读
  checkAgreementRead() {
    const userRead = wx.getStorageSync('agreement_user_read');
    const privacyRead = wx.getStorageSync('agreement_privacy_read');
    if (!userRead) {
      this.setData({ agreementReadHint: '请先阅读并同意《用户服务协议》' });
      return false;
    }
    if (!privacyRead) {
      this.setData({ agreementReadHint: '请先阅读并同意《隐私政策》' });
      return false;
    }
    this.setData({ agreementReadHint: '' });
    return true;
  },

  openUserAgreement() {
    wx.navigateTo({ url: '/pages/agreement/user-agreement' });
  },

  openPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/agreement/privacy-policy' });
  },

  // ===== 微信一键登录 =====
  onWxLogin() {
    // 检查协议是否已阅读
    if (!this.checkAgreementRead()) {
      wx.showToast({ title: this.data.agreementReadHint, icon: 'none' });
      return;
    }
    if (!this.data.agreeAgreement) {
      wx.showToast({ title: '请先勾选同意协议', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          wx.showToast({ title: '微信登录失败', icon: 'none' });
          this.setData({ loading: false });
          return;
        }
        // 发送code到后端换取openid
        app.post('/api/auth/wx-login', {
          code: loginRes.code,
          role: this.data.role
        }).then(res => {
          const data = res.data || {};
          if (data.is_new) {
            // 新用户 → 跳转注册页（带openid）
            wx.navigateTo({
              url: `/pages/register/register?role=${this.data.role || ''}&openid=${data.openid}`
            });
          } else {
            // 老用户 → 直接登录
            this._loginSuccess(data.token, data.user_id, data.role);
          }
        }).catch(e => {
          wx.showToast({ title: (e && e.message) || '微信登录失败', icon: 'none' });
        }).finally(() => {
          this.setData({ loading: false });
        });
      },
      fail: () => {
        wx.showToast({ title: '微信登录失败', icon: 'none' });
        this.setData({ loading: false });
      }
    });
  },

  // ===== 手机号密码登录（带调试） =====
  onLogin() {
    // 检查协议是否已阅读
    if (!this.checkAgreementRead()) {
      wx.showToast({ title: this.data.agreementReadHint, icon: 'none' });
      return;
    }

    const { phone, password, role, agreeAgreement } = this.data;
    if (!agreeAgreement) return wx.showToast({ title: '请先勾选同意协议', icon: 'none' });
    console.log('[LOGIN] phone:', phone, 'pwd length:', password ? password.length : 0, 'role:', role);
    if (!phone) return wx.showToast({ title: '请输入手机号', icon: 'none' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    if (!password) return wx.showToast({ title: '请输入密码', icon: 'none' });

    this.setData({ loading: true });
    // 使用 wx.request 直连（绕过 app.request），完整日志
    wx.request({
      url: app.globalData.BASE_URL + '/api/user/login',
      method: 'POST',
      data: { phone, password },
      header: { 'Content-Type': 'application/json' },
      success: (rawRes) => {
        console.log('[LOGIN-DIRECT] status:', rawRes.statusCode, 'data:', JSON.stringify(rawRes.data));
        const data = rawRes.data && rawRes.data.data;
        const token = data && data.token;
        const userInfo = data && data.userInfo;
        if (rawRes.statusCode === 200 && rawRes.data && rawRes.data.code === 0 && token && userInfo) {
          wx.setStorageSync('token', token);
          wx.setStorageSync('userInfo', userInfo);
          app.globalData.token = token;
          app.globalData.userInfo = userInfo;
          const finalRole = role || (userInfo && userInfo.role);
          if (finalRole) app.setRole(finalRole);
          const routes = { 1: '/pages/merchant/home/home', 2: '/pages/driver/home/home', 3: '/pages/private-car/home/home', 5: '/pages/personal/home/home' };
          wx.reLaunch({ url: routes[finalRole] || '/pages/role-select/role-select' });
        } else {
          wx.showToast({ title: (rawRes.data && rawRes.data.msg) || '登录失败(' + rawRes.statusCode + ')', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('[LOGIN-DIRECT] FAIL err:', err, 'errMsg:', err && err.errMsg, 'type:', typeof err);
        wx.showToast({ title: '网络错误: ' + (err && err.errMsg) || '无法连接后端', icon: 'none' });
      },
      complete: () => this.setData({ loading: false })
    });
  },

  // 登录成功通用处理
  _loginSuccess(token, userId, role) {
    if (!token) {
      wx.showToast({ title: '登录异常', icon: 'none' });
      return;
    }
    wx.setStorageSync('token', token);
    const userInfo = { id: userId, role };
    wx.setStorageSync('userInfo', userInfo);
    app.globalData.token = token;
    app.globalData.userInfo = userInfo;

    const finalRole = this.data.role || role;
    if (finalRole) app.setRole(finalRole);

    const routes = {
      1: '/pages/merchant/home/home',
      2: '/pages/driver/home/home',
      3: '/pages/private-car/home/home',
      5: '/pages/personal/home/home'
    };
    wx.reLaunch({ url: routes[finalRole] || '/pages/role-select/role-select' });
  },

  goRegister() {
    const role = this.data.role || '';
    wx.reLaunch({ url: '/pages/register/register?role=' + role });
  },

  goBack() {
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  }
});
