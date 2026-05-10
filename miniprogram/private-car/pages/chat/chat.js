const app = getApp();

Page({
  data: { messages: [], inputText: '', toUserInfo: null, orderId: null },
  onLoad(options) {
    this.setData({ toUserInfo: { id: options.toId, phone: options.toPhone||'用户' }, orderId: options.orderId });
    this.loadMessages();
  },
  async loadMessages() {
    try {
      const res = await app.get('/api/message/list/' + this.data.toUserInfo.id);
      this.setData({ messages: res.data || [] });
    } catch (err) { console.log(err); }
  },
  onInput(e) { this.setData({ inputText: e.detail.value }); },
  async sendText() {
    const text = this.data.inputText.trim();
    if (!text) return;
    try {
      await app.post('/api/message/send', { to_user_id: this.data.toUserInfo.id, content: text, order_id: this.data.orderId });
      this.setData({ inputText: '' });
      this.loadMessages();
    } catch (err) { wx.showToast({ title: '发送失败', icon: 'none' }); }
  }
});
