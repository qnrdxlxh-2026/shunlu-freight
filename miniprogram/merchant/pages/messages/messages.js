const app = getApp();

Page({
  data: {
    conversations: []
  },
  onShow() { this.loadConversations(); },
  async loadConversations() {
    try {
      const res = await app.get('/api/message/conversations');
      const conversations = (res.data || []).map(c => {
        const phone = c.phone || '用户';
        c.avatarText = phone.slice(-2);
        return c;
      });
      this.setData({ conversations });
    } catch (err) { console.log(err); }
  },
  goChat(e) {
    const item = e.currentTarget.dataset.item;
    wx.navigateTo({ url: `/pages/chat/chat?toId=${item.user_id}&toPhone=${item.phone||''}&orderId=${item.order_id||''}` });
  }
});
