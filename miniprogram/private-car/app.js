// app.js - 私家车端
App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'http://139.155.145.226'
  },

  onLaunch() {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
      this.getUserInfo();
    }
  },

  // 获取用户信息
  getUserInfo() {
    return new Promise((resolve, reject) => {
      if (!this.globalData.token) {
        reject('未登录');
        return;
      }
      wx.request({
        url: `${this.globalData.baseUrl}/user/info`,
        header: { 'Authorization': `Bearer ${this.globalData.token}` },
        success: (res) => {
          if (res.data.code === 0) {
            this.globalData.userInfo = res.data.data;
            resolve(res.data.data);
          } else {
            // token失效，跳转登录
            this.logout();
            reject(res.data.msg);
          }
        },
        fail: reject
      });
    });
  },

  // 登录
  login(phone, password) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.baseUrl}/user/login`,
        method: 'POST',
        data: { phone, password },
        success: (res) => {
          if (res.data.code === 0) {
            this.globalData.token = res.data.data.token;
            this.globalData.userInfo = res.data.data.user;
            wx.setStorageSync('token', res.data.data.token);
            resolve(res.data.data);
          } else {
            reject(res.data.msg);
          }
        },
        fail: reject
      });
    });
  },

  // 退出登录
  logout() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.reLaunch({ url: '/pages/login/login' });
  },

  // 封装请求方法
  request(options) {
    return new Promise((resolve, reject) => {
      const header = options.header || {};
      if (this.globalData.token) {
        header['Authorization'] = `Bearer ${this.globalData.token}`;
      }
      wx.request({
        url: `${this.globalData.baseUrl}${options.url}`,
        method: options.method || 'GET',
        data: options.data,
        header,
        success: (res) => {
          if (res.data.code === 401) {
            this.logout();
            reject('登录已过期');
          } else {
            resolve(res.data);
          }
        },
        fail: reject
      });
    });
  },

  // 上传文件
  uploadFile(url, filePath, name = 'file') {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: this.globalData.baseUrl.replace('/api', '') + url,
        filePath,
        name,
        header: {
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 0) resolve(data);
            else reject(new Error(data.msg || '上传失败'));
          } catch(e) {
            reject(new Error('上传失败'));
          }
        },
        fail: reject
      });
    });
  }
});
