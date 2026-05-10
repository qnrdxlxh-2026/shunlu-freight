const BASE_URL = 'http://localhost:3458';

App({
  globalData: {
    userInfo: null,
    token: null,
    BASE_URL
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  },

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
            wx.removeStorageSync('token');
            wx.redirectTo({ url: '/pages/login/login' });
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
  }
});
