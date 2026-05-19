const BASE_URL = 'http://localhost:3458';  // 本地开发：指向本地服务器

App({
  globalData: {
    userInfo: null,
    token: null,
    currentRole: null,  // 1=商家 2=货车司机 3=私家车 5=个人
    BASE_URL,
    permissions: []  // 新增：缓存用户权限
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
    this.globalData.permissions = [];
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('currentRole');
    wx.reLaunch({ url: '/pages/role-select/role-select' });
  },

  // ========== 新增：权限管理相关方法 ==========
  
  // 获取当前用户权限（带缓存）
  async getUserPermissions() {
    // 如果已缓存，直接返回
    if (this.globalData.permissions.length > 0) {
      return this.globalData.permissions;
    }

    try {
      const res = await this.get('/api/user/permissions');
      const permissions = res.data || [];
      this.globalData.permissions = permissions;
      return permissions;
    } catch (err) {
      console.error('获取权限失败:', err);
      return [];
    }
  },

  // 检查用户是否有某个权限
  async hasPermission(permission) {
    const permissions = await this.getUserPermissions();
    return permissions.includes(permission) || permissions.includes('*');
  },

  // 检查并刷新权限（登录后调用）
  async refreshPermissions() {
    this.globalData.permissions = [];
    return await this.getUserPermissions();
  }
});
