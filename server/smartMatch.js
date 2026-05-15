/**
 * 智能匹配引擎 - SmartMatch Engine
 * 基于路线方向、时间就近、载重匹配、综合评分的智能货运撮合
 *
 * 核心算法:
 * 1. 地理匹配 - 地址关键词+经纬度距离计算
 * 2. 路线方向匹配 - 出发地/目的地重叠度
 * 3. 时间就近匹配 - 出发时间与货源时效匹配
 * 4. 载重匹配 - 车辆剩余空间 vs 货物重量
 * 5. 综合评分 - 加权求和,排序推荐
 */

// ========== 甘孜地区地理数据 ==========
// 县级以上行政区域的关键词和坐标
const REGION_DATA = {
  // 甘孜州各县
  "康定": { lat: 29.9986, lng: 101.9569, keywords: ["康定", "炉城"], level: "county" },
  "泸定": { lat: 29.9281, lng: 102.2335, keywords: ["泸定"], level: "county" },
  "丹巴": { lat: 30.8786, lng: 101.8906, keywords: ["丹巴"], level: "county" },
  "九龙": { lat: 29.0002, lng: 101.5086, keywords: ["九龙"], level: "county" },
  "雅江": { lat: 30.0315, lng: 101.0146, keywords: ["雅江"], level: "county" },
  "道孚": { lat: 30.4681, lng: 101.1250, keywords: ["道孚"], level: "county" },
  "炉霍": { lat: 31.3917, lng: 100.6814, keywords: ["炉霍"], level: "county" },
  "甘孜": { lat: 31.6228, lng: 99.9833, keywords: ["甘孜"], level: "county" },
  "新龙": { lat: 30.9392, lng: 100.3117, keywords: ["新龙"], level: "county" },
  "德格": { lat: 31.8061, lng: 98.5806, keywords: ["德格"], level: "county" },
  "白玉": { lat: 31.2094, lng: 98.8244, keywords: ["白玉"], level: "county" },
  "石渠": { lat: 32.9786, lng: 98.1031, keywords: ["石渠"], level: "county" },
  "色达": { lat: 32.2681, lng: 100.3322, keywords: ["色达"], level: "county" },
  "理塘": { lat: 30.0000, lng: 100.2700, keywords: ["理塘"], level: "county" },
  "巴塘": { lat: 30.0081, lng: 99.1094, keywords: ["巴塘"], level: "county" },
  "乡城": { lat: 28.9317, lng: 99.7983, keywords: ["乡城"], level: "county" },
  "稻城": { lat: 29.0369, lng: 100.2983, keywords: ["稻城"], level: "county" },
  "得荣": { lat: 28.7131, lng: 99.2489, keywords: ["得荣"], level: "county" },
  // 主要城市
  "成都": { lat: 30.5728, lng: 104.0668, keywords: ["成都", "武侯", "锦江", "青羊", "金牛", "成华", "龙泉驿", "双流", "郫都", "新都"], level: "city" },
  "雅安": { lat: 30.0106, lng: 103.0013, keywords: ["雅安", "雨城"], level: "city" },
  "眉山": { lat: 30.0754, lng: 103.8480, keywords: ["眉山"], level: "city" },
  "乐山": { lat: 29.5521, lng: 103.7662, keywords: ["乐山"], level: "city" },
};

// ========== 工具函数 ==========

/**
 * 计算两个经纬度之间的距离(Haversine公式,单位km)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371; // 地球半径 km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 从地址字符串中识别区域
 * 返回 { name, lat, lng, level } 或 null
 */
function identifyRegion(addr) {
  if (!addr) return null;

  // 优先匹配关键词
  for (const [name, info] of Object.entries(REGION_DATA)) {
    for (const kw of info.keywords) {
      if (addr.includes(kw)) {
        return { name, lat: info.lat, lng: info.lng, level: info.level };
      }
    }
  }

  // 匹配"XX县"、"XX市"
  const countyMatch = addr.match(/([\u4e00-\u9fa5]{2,3})(?:县|市|区|州)/);
  if (countyMatch) {
    const region = REGION_DATA[countyMatch[1]];
    if (region) return { name: countyMatch[1], ...region };
  }

  return null;
}

/**
 * 判断两个区域是否相邻/同方向
 * 基于甘孜地区公路网拓扑
 */
const ROAD_NETWORK = {
  // 主要公路连接(双向),距离km
  "康定-泸定": 50,
  "康定-雅江": 147,
  "康定-成都": 322,
  "康定-雅安": 190,
  "泸定-成都": 280,
  "雅江-理塘": 140,
  "理塘-稻城": 150,
  "理塘-巴塘": 260,
  "道孚-炉霍": 70,
  "炉霍-甘孜": 97,
  "甘孜-德格": 240,
  "甘孜-石渠": 310,
  "丹巴-康定": 120,
  "丹巴-道孚": 90,
  "雅安-成都": 140,
};

function getRoadDistance(from, to) {
  if (from === to) return 0;
  for (const [key, dist] of Object.entries(ROAD_NETWORK)) {
    const [a, b] = key.split("-");
    if ((a === from && b === to) || (a === to && b === from)) return dist;
  }
  return null; // 无直接公路连接
}

/**
 * 判断路线方向是否一致
 * 从A到B的司机,能否顺路带从C到D的货
 * 核心逻辑:C在A→B路线上或附近,D也在A→B路线上或附近
 */
function isSameDirection(driverFrom, driverTo, goodsFrom, goodsTo) {
  // 情况1:完全匹配(出发地=出发地,目的地=目的地)
  if (driverFrom === goodsFrom && driverTo === goodsTo) return { match: true, score: 100, desc: "完全同向" };

  // 情况2:司机路线包含货物起点和终点
  // 例如:司机 成都→康定,货 雅安→泸定(都在成雅高速+G318上)
  const driverRoute = [driverFrom, driverTo];
  const goodsStartOnRoute = driverRoute.includes(goodsFrom);
  const goodsEndOnRoute = driverRoute.includes(goodsTo);

  if (goodsStartOnRoute && goodsEndOnRoute) {
    return { match: true, score: 90, desc: "路线包含起终点" };
  }

  // 情况3:起点或终点有一个匹配
  if (goodsStartOnRoute || goodsEndOnRoute) {
    const score = goodsStartOnRoute ? 70 : 60;
    return { match: true, score, desc: goodsStartOnRoute ? "起点匹配" : "终点匹配" };
  }

  // 情况4:通过公路网判断是否顺路
  // 司机A→B,货C→D:如果C靠近A→B路径,D也靠近A→B路径
  const distAC = getRoadDistance(driverFrom, goodsFrom);
  const distAD = getRoadDistance(driverTo, goodsTo);
  const distBC = getRoadDistance(driverTo, goodsFrom);
  const distBD = getRoadDistance(driverTo, goodsTo);

  if (distAC !== null && distBD !== null) {
    // C在A附近,D在B附近 → 顺路
    const detour = distAC + distBD;
    const mainRoute = getRoadDistance(driverFrom, driverTo) || 999;
    if (detour < mainRoute * 0.3) {
      return { match: true, score: 75, desc: "轻微绕路可送达" };
    }
    if (detour < mainRoute * 0.6) {
      return { match: true, score: 50, desc: "绕路可送达" };
    }
  }

  // 情况5:目的地区域相同(如都去成都)
  if (driverTo === goodsTo) {
    return { match: true, score: 55, desc: "目的地相同" };
  }

  // 不顺路
  return { match: false, score: 0, desc: "方向不一致" };
}

// ========== 核心匹配算法 ==========

/**
 * 计算时间匹配度
 * 司机出发时间与货源时效的匹配
 */
function calcTimeScore(route, goods) {
  // 如果没有出发时间信息,给中等分数
  if (!route.departure_time && !route.depart_time) return { score: 50, desc: "无时间信息" };

  const departTime = route.departure_time || route.depart_time;
  const goodsTime = goods.expected_time || goods.create_time;

  if (!goodsTime) return { score: 60, desc: "货源无时效要求" };

  // 解析出发时间(格式可能是 "HH:MM" 或 ISO时间戳)
  let departHour = 0;
  if (departTime.includes(":") && departTime.length <= 5) {
    departHour = parseInt(departTime.split(":")[0]);
  } else {
    departHour = new Date(departTime).getHours();
  }

  // 货源发布时间
  const goodsDate = new Date(goodsTime);
  const now = new Date();
  const hoursSincePublish = (now - goodsDate) / 3600000;

  // 越新的货源越紧急,越需要尽快匹配
  let urgencyScore = 0;
  if (hoursSincePublish < 1) urgencyScore = 30;      // 1小时内,紧急
  else if (hoursSincePublish < 4) urgencyScore = 20;  // 4小时内
  else if (hoursSincePublish < 12) urgencyScore = 10;  // 半天内
  else urgencyScore = 0;                                // 超过半天

  // 司机出发时间越早越好(对紧急货源)
  let departScore = 0;
  if (departHour >= 6 && departHour <= 22) {
    departScore = 20; // 合理时间出发
  }

  return { score: urgencyScore + departScore, desc: `货源发布${hoursSincePublish.toFixed(1)}小时,司机${departHour}时出发` };
}

/**
 * 计算载重匹配度
 */
function calcCapacityScore(route, goods, driverRole) {
  const weight = goods.weight || 0;
  const remainSpace = route.remain_space || route.space || 0;

  if (driverRole === 3) {
    // 私家车限制
    if (weight > 20) return { score: 0, desc: "超重(私家车限20kg)", blocked: true };
    if (weight > 10) return { score: 40, desc: "接近载重上限" };
    return { score: 80, desc: "载重合适" };
  }

  // 货车
  if (remainSpace > 0 && weight > remainSpace) {
    return { score: 0, desc: "超出剩余载重", blocked: true };
  }

  if (weight <= 0) return { score: 60, desc: "未知重量" };
  if (weight <= remainSpace * 0.5) return { score: 90, desc: "载重充裕" };
  if (weight <= remainSpace) return { score: 70, desc: "载重匹配" };
  return { score: 30, desc: "载重偏紧" };
}

/**
 * 计算价格吸引力(对司机而言)
 */
function calcPriceScore(goods, driverRole) {
  const price = goods.price || 0;
  const weight = goods.weight || 1;
  const pricePerKg = price / weight;

  if (driverRole === 3) {
    // 私家车:单价越高越有吸引力
    if (pricePerKg >= 10) return { score: 90, desc: "高价单" };
    if (pricePerKg >= 5) return { score: 70, desc: "价格不错" };
    if (pricePerKg >= 2) return { score: 50, desc: "价格一般" };
    return { score: 30, desc: "价格偏低" };
  }

  // 货车
  if (price >= 500) return { score: 90, desc: "高价大单" };
  if (price >= 200) return { score: 70, desc: "价格适中" };
  if (price >= 100) return { score: 50, desc: "普通单" };
  return { score: 30, desc: "低价单" };
}

/**
 * 计算货值风险(私家车限制)
 */
function calcValueRisk(goods, driverRole) {
  const value = goods.goods_value || 0;
  if (driverRole === 3 && value > 2000) {
    return { score: 0, desc: "货值超限(私家车限2000元)", blocked: true };
  }
  if (value > 10000) return { score: 50, desc: "高价值需注意" };
  return { score: 80, desc: "货值正常" };
}

/**
 * 计算地理距离分(用经纬度或地址关键词)
 */
function calcGeoScore(route, goods) {
  // 优先用经纬度
  if (route.start_lat && route.start_lng && goods.start_lat && goods.start_lng) {
    const pickupDist = haversineDistance(route.start_lat, route.start_lng, goods.start_lat, goods.start_lng);
    const deliveryDist = haversineDistance(route.end_lat, route.end_lng, goods.end_lat, goods.end_lng);

    if (pickupDist !== null && deliveryDist !== null) {
      const totalDetour = pickupDist + deliveryDist;
      if (totalDetour < 10) return { score: 95, desc: `取送货绕行${totalDetour.toFixed(1)}km` };
      if (totalDetour < 30) return { score: 80, desc: `取送货绕行${totalDetour.toFixed(1)}km` };
      if (totalDetour < 60) return { score: 60, desc: `取送货绕行${totalDetour.toFixed(1)}km` };
      if (totalDetour < 100) return { score: 40, desc: `绕行较远${totalDetour.toFixed(1)}km` };
      return { score: 20, desc: `绕行太远${totalDetour.toFixed(1)}km` };
    }
  }

  // 用地址关键词匹配
  const routeFrom = identifyRegion(route.start_addr);
  const routeTo = identifyRegion(route.end_addr);
  const goodsFrom = identifyRegion(goods.start_addr);
  const goodsTo = identifyRegion(goods.end_addr);

  if (routeFrom && routeTo && goodsFrom && goodsTo) {
    const dirResult = isSameDirection(routeFrom.name, routeTo.name, goodsFrom.name, goodsTo.name);
    return { score: dirResult.score, desc: dirResult.desc };
  }

  // 简单地址包含匹配
  let addrScore = 0;
  if (goods.start_addr && route.start_addr) {
    const fromMatch = extractCity(goods.start_addr) === extractCity(route.start_addr);
    if (fromMatch) addrScore += 40;
  }
  if (goods.end_addr && route.end_addr) {
    const toMatch = extractCity(goods.end_addr) === extractCity(route.end_addr);
    if (toMatch) addrScore += 40;
  }

  return { score: addrScore || 30, desc: addrScore > 0 ? "部分地址匹配" : "地址未匹配" };
}

/**
 * 从地址中提取城市名
 */
function extractCity(addr) {
  if (!addr) return "";
  // 匹配 "XX市"、"XX州"、"XX县"
  const match = addr.match(/([\u4e00-\u9fa5]{2,4})(?:市|州|县|区)/);
  return match ? match[1] : addr.slice(0, 2);
}

// ========== 公开API ==========

/**
 * 司机找货源 - 智能匹配
 * @param {Object} user - 当前登录的司机用户
 * @param {Array} goods - 所有待接单的货源
 * @param {Array} routes - 所有活跃路线
 * @param {Array} orders - 所有订单(用于统计司机历史)
 * @returns {Array} 匹配排序后的货源列表,带matchInfo
 */
function matchGoodsForDriver(user, goods, routes, orders) {
  const driverRole = user.role; // 2=货车, 3=私家车
  const userId = user.userId || user.id; // 兼容不同调用方式
  const driverRoutes = routes.filter(r => r.driver_id === userId && r.status === 1);
  const driverRoute = driverRoutes[0]; // 取最新的活跃路线

  // 司机历史接单统计
  const completedOrders = orders.filter(o => o.driver_id === userId && o.status === 4);
  const reliabilityScore = Math.min(completedOrders.length * 5, 20); // 信誉加分,最多20分

  const results = goods.filter(g => g.status === 1).map(g => {
    // 1. 载重匹配(有blocked标记的先排除)
    const capacity = calcCapacityScore(driverRoute || {}, g, driverRole);

    // 2. 货值风险
    const valueRisk = calcValueRisk(g, driverRole);

    // 如果有blocked标记,总分直接0
    if (capacity.blocked || valueRisk.blocked) {
      return {
        ...g,
        matchScore: 0,
        matchInfo: {
          total: 0,
          direction: { score: 0, desc: "不适用" },
          capacity,
          valueRisk,
          time: { score: 0, desc: "不适用" },
          price: { score: 0, desc: "不适用" },
          geo: { score: 0, desc: "不适用" },
          reason: capacity.blocked ? capacity.desc : valueRisk.desc
        }
      };
    }

    // 3. 路线方向匹配
    let directionScore = { score: 50, desc: "无路线信息" };
    if (driverRoute) {
      const routeFrom = identifyRegion(driverRoute.start_addr);
      const routeTo = identifyRegion(driverRoute.end_addr);
      const goodsFrom = identifyRegion(g.start_addr);
      const goodsTo = identifyRegion(g.end_addr);

      if (routeFrom && routeTo && goodsFrom && goodsTo) {
        directionScore = isSameDirection(routeFrom.name, routeTo.name, goodsFrom.name, goodsTo.name);
        if (!directionScore.match) directionScore = { score: 10, desc: directionScore.desc };
      }
    }

    // 4. 地理距离
    const geo = calcGeoScore(driverRoute || {}, g);

    // 5. 时间匹配
    const time = calcTimeScore(driverRoute || {}, g);

    // 6. 价格吸引力
    const price = calcPriceScore(g, driverRole);

    // 综合加权评分(满分100)
    const total = Math.round(
      directionScore.score * 0.30 +  // 方向 30%
      geo.score * 0.25 +              // 地理距离 25%
      time.score * 0.15 +             // 时间 15%
      capacity.score * 0.10 +         // 载重 10%
      price.score * 0.10 +            // 价格 10%
      valueRisk.score * 0.05 +        // 货值 5%
      reliabilityScore * 0.05          // 信誉 5%
    );

    return {
      ...g,
      matchScore: total,
      matchInfo: {
        total,
        direction: directionScore,
        geo,
        time,
        capacity,
        price,
        valueRisk,
        reliabilityBonus: reliabilityScore
      }
    };
  });

  // 过滤掉0分的,按总分降序排
  return results
    .filter(r => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * 货主找司机 - 智能匹配
 * @param {Object} user - 当前登录的货主(商家或个人)
 * @param {Object} goods - 当前发布的货源
 * @param {Array} routes - 所有活跃路线
 * @param {Array} users - 所有用户
 * @param {Array} orders - 所有订单
 * @returns {Array} 匹配排序后的司机列表,带matchInfo
 */
function matchDriversForGoods(user, goods, routes, users, orders) {
  const activeRoutes = routes.filter(r => r.status === 1);

  const results = activeRoutes.map(r => {
    const driverUser = users.find(u => u.id === r.driver_id);
    const driverRole = r.driver_type || driverUser?.role;

    // 司机历史统计
    const completedOrders = orders.filter(o => o.driver_id === r.driver_id && o.status === 4);
    const reliabilityScore = Math.min(completedOrders.length * 5, 20);

    // 1. 载重匹配
    const capacity = calcCapacityScore(r, goods, driverRole);

    // 2. 货值风险
    const valueRisk = calcValueRisk(goods, driverRole);

    if (capacity.blocked || valueRisk.blocked) {
      return {
        route_id: r.id,
        driver_id: r.driver_id,
        driver_type: driverRole,
        driver_name: driverUser?.real_name || "司机" + r.driver_id,
        start_addr: r.start_addr,
        end_addr: r.end_addr,
        depart_time: r.departure_time || r.depart_time,
        remain_space: r.remain_space || r.space,
        license_plate: r.license_plate,
        matchScore: 0,
        matchInfo: {
          total: 0,
          reason: capacity.blocked ? capacity.desc : valueRisk.desc
        }
      };
    }

    // 3. 路线方向匹配
    const routeFrom = identifyRegion(r.start_addr);
    const routeTo = identifyRegion(r.end_addr);
    const goodsFrom = identifyRegion(goods.start_addr);
    const goodsTo = identifyRegion(goods.end_addr);

    let directionScore = { score: 50, desc: "无法识别方向" };
    if (routeFrom && routeTo && goodsFrom && goodsTo) {
      directionScore = isSameDirection(routeFrom.name, routeTo.name, goodsFrom.name, goodsTo.name);
      if (!directionScore.match) directionScore = { score: 10, desc: directionScore.desc };
    }

    // 4. 地理距离
    const geo = calcGeoScore(r, goods);

    // 5. 时间匹配
    const time = calcTimeScore(r, goods);

    // 综合评分
    const total = Math.round(
      directionScore.score * 0.35 +  // 方向 35%(货主找司机,方向最关键)
      geo.score * 0.25 +             // 地理距离 25%
      time.score * 0.15 +            // 时间 15%
      capacity.score * 0.10 +        // 载重 10%
      valueRisk.score * 0.05 +       // 货值 5%
      reliabilityScore * 0.10         // 信誉 10%(货主更看重司机信誉)
    );

    return {
      route_id: r.id,
      driver_id: r.driver_id,
      driver_type: driverRole,
      driver_name: driverUser?.real_name || "司机" + r.driver_id,
      start_addr: r.start_addr,
      end_addr: r.end_addr,
      depart_time: r.departure_time || r.depart_time,
      remain_space: r.remain_space || r.space,
      license_plate: r.license_plate,
      matchScore: total,
      matchInfo: {
        total,
        direction: directionScore,
        geo,
        time,
        capacity,
        valueRisk,
        reliabilityBonus: reliabilityScore,
        completedOrders: completedOrders.length
      }
    };
  });

  return results
    .filter(r => r.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * 全局最优匹配推荐(双向撮合)
 * 为所有待接单货源推荐最优司机,或为所有空闲司机推荐最优货源
 */
function globalOptimalMatch(goods, routes, users, orders) {
  const pendingGoods = goods.filter(g => g.status === 1);
  const activeRoutes = routes.filter(r => r.status === 1);

  // 构建匹配矩阵
  const matrix = [];
  for (const g of pendingGoods) {
    for (const r of activeRoutes) {
      const driverUser = users.find(u => u.id === r.driver_id);
      const driverRole = r.driver_type || driverUser?.role;

      const capacity = calcCapacityScore(r, g, driverRole);
      const valueRisk = calcValueRisk(g, driverRole);
      if (capacity.blocked || valueRisk.blocked) continue;

      const routeFrom = identifyRegion(r.start_addr);
      const routeTo = identifyRegion(r.end_addr);
      const goodsFrom = identifyRegion(g.start_addr);
      const goodsTo = identifyRegion(g.end_addr);

      let directionScore = { score: 30, desc: "未知" };
      if (routeFrom && routeTo && goodsFrom && goodsTo) {
        directionScore = isSameDirection(routeFrom.name, routeTo.name, goodsFrom.name, goodsTo.name);
      }

      const geo = calcGeoScore(r, g);
      const time = calcTimeScore(r, g);
      const price = calcPriceScore(g, driverRole);

      const total = Math.round(
        directionScore.score * 0.30 + geo.score * 0.25 + time.score * 0.15 +
        capacity.score * 0.10 + price.score * 0.10 + valueRisk.score * 0.10
      );

      matrix.push({ goodsId: g.id, routeId: r.id, score: total, details: { direction: directionScore, geo, time, capacity, price } });
    }
  }

  // 贪心匹配:按分数从高到低,每个货源匹配一个司机
  matrix.sort((a, b) => b.score - a.score);
  const matchedGoods = new Set();
  const matchedRoutes = new Set();
  const pairs = [];

  for (const m of matrix) {
    if (matchedGoods.has(m.goodsId) || matchedRoutes.has(m.routeId)) continue;
    matchedGoods.add(m.goodsId);
    matchedRoutes.add(m.routeId);
    pairs.push(m);
  }

  return pairs;
}

module.exports = {
  matchGoodsForDriver,
  matchDriversForGoods,
  globalOptimalMatch,
  identifyRegion,
  isSameDirection,
  haversineDistance,
  REGION_DATA
};
