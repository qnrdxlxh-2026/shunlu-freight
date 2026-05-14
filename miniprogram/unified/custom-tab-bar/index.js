// custom-tab-bar/index.js
const app = getApp();

// 各角色的TabBar配置
const tabConfigs = {
  1: [ // 商家
    { pagePath: '/pages/merchant/home/home', text: '首页', icon: '🏠', activeIcon: '🏠' },
    { pagePath: '/pages/merchant/orders/orders', text: '订单', icon: '📋', activeIcon: '📋' },
    { pagePath: '/pages/merchant/wallet/wallet', text: '钱包', icon: '💰', activeIcon: '💰' },
    { pagePath: '/pages/merchant/profile/profile', text: '我的', icon: '👤', activeIcon: '👤' }
  ],
  2: [ // 货车司机
    { pagePath: '/pages/driver/home/home', text: '首页', icon: '🏠', activeIcon: '🏠' },
    { pagePath: '/pages/driver/orders/orders', text: '订单', icon: '📋', activeIcon: '📋' },
    { pagePath: '/pages/driver/wallet/wallet', text: '收入', icon: '💰', activeIcon: '💰' },
    { pagePath: '/pages/driver/profile/profile', text: '我的', icon: '👤', activeIcon: '👤' }
  ],
  3: [ // 私家车
    { pagePath: '/pages/private-car/home/home', text: '首页', icon: '🏠', activeIcon: '🏠' },
    { pagePath: '/pages/private-car/orders/orders', text: '订单', icon: '📋', activeIcon: '📋' },
    { pagePath: '/pages/private-car/wallet/wallet', text: '收入', icon: '💰', activeIcon: '💰' },
    { pagePath: '/pages/private-car/profile/profile', text: '我的', icon: '👤', activeIcon: '👤' }
  ],
  5: [ // 个人
    { pagePath: '/pages/personal/home/home', text: '首页', icon: '🏠', activeIcon: '🏠' },
    { pagePath: '/pages/personal/orders/orders', text: '订单', icon: '📋', activeIcon: '📋' },
    { pagePath: '/pages/personal/wallet/wallet', text: '钱包', icon: '💰', activeIcon: '💰' },
    { pagePath: '/pages/personal/profile/profile', text: '我的', icon: '👤', activeIcon: '👤' }
  ]
};

// 角色对应主题色
const roleColors = {
  1: '#1890ff',  // 商家-蓝
  2: '#52c41a',  // 货车司机-绿
  3: '#1890ff',  // 私家车-蓝
  5: '#722ed1'   // 个人-紫
};

Component({
  data: {
    list: [],
    selected: 0,
    themeColor: '#1890ff'
  },

  methods: {
    init() {
      const role = app.globalData.currentRole;
      const list = tabConfigs[role] || [];
      const themeColor = roleColors[role] || '#1890ff';
      this.setData({ list, themeColor });
    },

    switchTab(e) {
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      if (!item) return;
      
      // 获取当前页面路径
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      const currentPath = '/' + currentPage.route;

      if (currentPath === item.pagePath) return;

      wx.reLaunch({ url: item.pagePath });
    }
  }
});
