// pages/register/register.js
const app = getApp();

const ROLE_NAMES = {
  1: '商家',
  2: '货车司机',
  3: '私家车主',
  5: '个人用户'
};

Page({
  data: {
    phone: '',
    password: '',
    confirmPassword: '',
    real_name: '',
    id_card: '',
    role: null,
    roleName: '',
    openid: '',
    business_license: '',
    loading: false,
    agreeAgreement: false,
    agreementReadHint: '',
  },

  onLoad(options) {
    const role = options.role ? Number(options.role) : null;
    const openid = options.openid || '';
    this.setData({ role, roleName: role ? ROLE_NAMES[role] : '', openid });
    wx.setNavigationBarTitle({ title: '注册' + (role ? ROLE_NAMES[role] : '') + '账号' });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onIdCardInput(e) {
    let val = e.detail.value.replace(/[\s]/g, '').toUpperCase();
    val = val.replace(/[^0-9X]/g, '');
    if (val.length > 18) val = val.slice(0, 18);
    this.setData({ id_card: val });
  },

  chooseBusinessLicense() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        if (res.tempFiles.length > 0) {
          this.setData({ business_license: res.tempFiles[0].tempFilePath });
        }
      }
    });
  },

  delBusinessLicense() {
    this.setData({ business_license: '' });
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

  async onRegister() {
    // 检查协议是否已阅读
    if (!this.checkAgreementRead()) {
      wx.showToast({ title: this.data.agreementReadHint, icon: 'none' });
      return;
    }

    const { phone, password, confirmPassword, real_name, id_card, role, openid, business_license, agreeAgreement } = this.data;

    if (!agreeAgreement) return wx.showToast({ title: '请先勾选同意协议', icon: 'none' });
    if (!phone) return wx.showToast({ title: '请输入手机号', icon: 'none' });
    if (!/^1[3-9]\d{9}$/.test(phone)) return wx.showToast({ title: '手机号格式错误', icon: 'none' });
    if (!real_name) return wx.showToast({ title: '请输入真实姓名', icon: 'none' });
    if (!id_card) return wx.showToast({ title: '请输入身份证号', icon: 'none' });
    if (!/^\d{17}[\dXx]$/.test(id_card)) return wx.showToast({ title: '身份证号格式错误', icon: 'none' });
    if (!password) return wx.showToast({ title: '请设置密码', icon: 'none' });
    if (password.length < 6) return wx.showToast({ title: '密码至少6位', icon: 'none' });
    if (password !== confirmPassword) return wx.showToast({ title: '两次密码不一致', icon: 'none' });

    this.setData({ loading: true });

    try {
      let res;
      if (openid) {
        // 微信一键注册（带openid）
        res = await app.post('/api/auth/wx-register', {
          openid,
          role: role || 5,
          phone,
          password,
          real_name,
          id_card
        });
      } else {
        // 普通注册
        const payload = { phone, password, role: role || 5, real_name, id_card };
        if (role === 1 && business_license) payload.business_license = business_license;
        res = await app.post('/api/user/register', payload);
      }

      wx.showToast({ title: '注册成功', icon: 'success' });
      // 注册成功后自动登录
      const token = res.data && res.data.token;
      if (token) {
        wx.setStorageSync('token', token);
        app.globalData.token = token;
        const finalRole = role || 5;
        app.setRole(finalRole);
        const routes = {
          1: '/pages/merchant/home/home',
          2: '/pages/driver/home/home',
          3: '/pages/private-car/home/home',
          5: '/pages/personal/home/home'
        };
        setTimeout(() => {
          wx.reLaunch({ url: routes[finalRole] || '/pages/role-select/role-select' });
        }, 1000);
      } else {
        setTimeout(() => {
          wx.reLaunch({ url: `/pages/login/login?role=${role || 5}` });
        }, 1500);
      }
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '注册失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goLogin() {
    const role = this.data.role ? `?role=${this.data.role}` : '';
    wx.reLaunch({ url: `/pages/login/login${role}` });
  },

  onAgreementChange(e) {
    this.setData({ agreeAgreement: e.detail.value.includes('agreed') });
  },
  openUserAgreement() {
    wx.navigateTo({ url: '/pages/agreement/user-agreement' });
  },
  openPrivacyPolicy() {
    wx.navigateTo({ url: '/pages/agreement/privacy-policy' });
  },
});
