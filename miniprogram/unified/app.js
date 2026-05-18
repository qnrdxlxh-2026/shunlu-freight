const BASE_URL = 'https://www.huoshunlu.com';

App({
  globalData: {
    userInfo: null,
    token: null,
    currentRole: null,  // 1=商家 2=货车司机 3=私家车 5=个人
    BASE_URL
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const currentRole = wx.getStorageSync('currentRole');
    
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
    if (currentRole) {
      this.globalData.currentRole = currentRole;
    }
  },

  // 设置角色并保存
  setRole(role) {
    this.globalData.currentRole = role;
    wx.setStorageSync('currentRole', role);
  },

  // 通用请求方法
  request(url, method = 'GET', data = {}) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.BASE_URL + url,
        method,
        data,
        header: {
          'Authorization': this.globalData.token ? 'Bearer ' + this.globalData.token : ''
        },
        success: res => {
          if (res.statusCode === 200 && res.data.code === 0) {
            resolve(res.data);
          } else if (res.statusCode === 401) {
            // 不自动跳转，由各页面自行处理 401
            reject(new Error('未登录'));
          } else {
            reject(new Error(res.data.msg || '请求失败'));
          }
        },
        fail: reject
      });
    });
  },

  get(url) {
    return this.request(url, 'GET');
  },

  post(url, data) {
    return this.request(url, 'POST', data);
  },

  put(url, data) {
    return this.request(url, 'PUT', data);
  },

  uploadFile(url, filePath, name = 'file') {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: this.globalData.BASE_URL + url,
        filePath,
        name,
        header: {
          'Authorization': this.globalData.token ? 'Bearer ' + this.globalData.token : ''
        },
        success: res => {
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
  },

  // 退出登录
  logout() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    this.globalData.currentRole = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('currentRole');
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  }
});
