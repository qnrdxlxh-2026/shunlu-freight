# 顺路货运平台 - 整体BUG修复+功能优化开发计划

## 项目路径
`/Users/a1234/.qclaw/workspace/shunlu-freight/`

---

## 一、紧急BUG修复（优先级最高）

### BUG-1: 找货源接口不存在
- **问题**: find-goods.js 调用 `api.getNearbyGoods()` → `/api/driver/goods/list`，但后端只有 `/api/driver/match-goods`
- **修复**: api.js 中 getNearbyGoods 改为调用 `/api/driver/match-goods`；后端新增通用路由 `/api/goods/nearby` 支持所有角色
- **涉及文件**: `utils/api.js`, `server/app.js`

### BUG-2: 订单发布失败
- **问题**: 商家端 publish-order.js 调用 `/api/merchant/publish-goods` ✅路由存在，但个人端 send-package.js 调用 `api.publishGoods()` → `/api/merchant/order/publish` ❌不存在
- **修复**: api.js 中 publishGoods 改为 `/api/merchant/publish-goods` 或新增 `/api/personal/publish-goods`
- **涉及文件**: `utils/api.js`, `server/app.js`

### BUG-3: 出发时间缺少年月日
- **问题**: 发布页面没有时间选择器，缺少出发时间字段
- **修复**: 发布页面添加 datetime-picker（年月日+时分），payload 增加 departure_time 字段
- **涉及文件**: `pages/merchant/publish-order/publish-order.{js,wxml,wxss}`, `pages/personal/send-package/send-package.{js,wxml,wxss}`

### BUG-4: 证件照片显示不全
- **问题**: 上传证件后页面排版有问题
- **修复**: 优化证件上传页面的 WXSS 布局
- **涉及文件**: 司机/私家车 profile 页面

### BUG-5: 无证件审核机制
- **问题**: 上传资料无人核验
- **修复**: 新增后端审核接口，driver_info 增加 audit_status 字段
- **涉及文件**: `server/app.js`, `server/admin/`

### BUG-6: 钱包充值提现逻辑不完善
- **问题**: 当前为模拟支付
- **修复**: 完善模拟支付流程，充值增加金额选项，提现增加审核机制
- **涉及文件**: `server/app.js`, 各端 wallet 页面

---

## 二、基础功能整改

### 2.1 出发时间优化
- 增加完整日期时间选择器
- 默认当天日期
- 支持预约未来日期

### 2.2 货源&订单发布修复
- 修复 api.js 中所有错误的接口路径
- 确保 publish-goods 和 match-goods 正常工作

### 2.3 司机证件上传+审核体系
- 优化上传页面排版
- 新增审核接口
- 审核通过后才能接单

---

## 三、钱包充值&提现（微信通道模拟）
- 充值：模拟微信支付，余额即时到账
- 提现：模拟微信提现，需要审核
- 完整资金流水记录

---

## 四、五星评分+评论体系
- 5分制+半星
- 4维度评分
- 评级影响派单优先级

---

## 五、订单取消规则
- 10分钟内免费取消
- 10-20分钟扣20%
- 超过20分钟免费取消
- 已接单不允许取消

---

## 六、完整订单闭环
- 支付→订单→二维码→取货→送达→完成

---

## 七、增值优化
- 身份切换（已实现）
- 智能匹配（smartMatch.js 已有）
- 运费计价（/api/price/calculate 已有）
- 平台抽成（已有）
- 投诉售后（接口已有）
- 合规文案
- 物流可视化

---

## 当前API路由 vs 前端调用 对照表（关键问题）

| 前端调用（api.js） | 后端实际路由 | 状态 |
|---|---|---|
| `/api/driver/goods/list` | `/api/driver/match-goods` | ❌ 不匹配 |
| `/api/merchant/order/publish` | `/api/merchant/publish-goods` | ❌ 不匹配 |
| `/api/driver/order/accept/:id` | `/api/driver/take-order` | ❌ 不匹配 |
| `/api/driver/routes/my` | `/api/driver/my-routes` | ❌ 不匹配 |
| `/api/driver/route/publish` | `/api/driver/publish-route` | ❌ 不匹配 |
| `/api/personal/package/send` | `/api/personal/publish-goods` | ❌ 不匹配 |
| `/api/personal/packages` | `/api/personal/goods-list` | ❌ 不匹配 |
| `/api/personal/drivers` | 无此路由 | ❌ 缺失 |
| `/api/message/list` | 无此路由 | ❌ 缺失 |
| `/api/chat/send` | 无此路由 | ❌ 缺失 |
| `/api/chat/history` | 无此路由 | ❌ 缺失 |
| `/api/address/list` | 无此路由 | ❌ 缺失 |
| `/api/wallet/transactions` | `/api/wallet/records` | ❌ 不匹配 |
| `/api/upload` | `/api/upload/photo` | ❌ 不匹配 |

**结论：api.js 中的接口路径大量与后端不匹配，这是几乎所有功能的根本原因！**
