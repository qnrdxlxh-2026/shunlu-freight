/**
 * 乡镇数据工具
 * 用于前端乡镇选择器
 */

// 乡镇数据（与后端 TOWNSHIP_DATA 对应）
const TOWNSHIP_DATA = [
  { id: 1, name: '炉城镇', county: '康定', lat: 30.05, lng: 101.96, keywords: ['康定', '炉城'] },
  { id: 2, name: '姑咱镇', county: '康定', lat: 29.98, lng: 102.13, keywords: ['姑咱', '康定'] },
  { id: 3, name: '新都桥镇', county: '康定', lat: 30.05, lng: 101.49, keywords: ['新都桥', '康定'] },
  { id: 4, name: '塔公镇', county: '康定', lat: 30.33, lng: 101.58, keywords: ['塔公', '康定'] },
  { id: 5, name: '泸桥镇', county: '泸定', lat: 29.92, lng: 102.23, keywords: ['泸定', '泸桥'] },
  { id: 6, name: '冷碛镇', county: '泸定', lat: 29.83, lng: 102.18, keywords: ['冷碛', '泸定'] },
  { id: 7, name: '磨西镇', county: '泸定', lat: 29.66, lng: 102.08, keywords: ['磨西', '泸定', '海螺沟'] },
  { id: 8, name: '章谷镇', county: '丹巴', lat: 30.88, lng: 101.88, keywords: ['丹巴', '章谷'] },
  { id: 9, name: '巴底镇', county: '丹巴', lat: 30.95, lng: 101.83, keywords: ['巴底', '丹巴'] },
  { id: 10, name: '河口镇', county: '雅江', lat: 30.03, lng: 101.00, keywords: ['雅江', '河口'] },
  { id: 11, name: '高城镇', county: '理塘', lat: 30.00, lng: 100.27, keywords: ['理塘', '高城'] },
  { id: 12, name: '金珠镇', county: '稻城', lat: 29.03, lng: 100.30, keywords: ['稻城', '金珠', '亚丁'] },
  { id: 13, name: '色柯镇', county: '色达', lat: 32.28, lng: 100.33, keywords: ['色达', '色柯', '佛学院'] },
  { id: 14, name: '尼呷镇', county: '石渠', lat: 33.00, lng: 98.10, keywords: ['石渠', '尼呷'] }
];

// 县级列表
const COUNTY_LIST = ['康定', '泸定', '丹巴', '雅江', '理塘', '稻城', '色达', '石渠'];

/**
 * 获取所有乡镇
 */
function getAllTownships() {
  return TOWNSHIP_DATA;
}

/**
 * 按县获取乡镇
 */
function getTownshipsByCounty(county) {
  return TOWNSHIP_DATA.filter(t => t.county === county);
}

/**
 * 根据关键词识别乡镇
 */
function identifyTownship(address) {
  if (!address) return null;
  
  for (const township of TOWNSHIP_DATA) {
    for (const keyword of township.keywords) {
      if (address.includes(keyword)) {
        return township;
      }
    }
  }
  
  return null;
}

/**
 * 格式化乡镇选择器数据（用于picker）
 */
function formatTownshipPickerData() {
  const result = [];
  
  for (const county of COUNTY_LIST) {
    const townships = getTownshipsByCounty(county);
    if (townships.length > 0) {
      result.push({
        county,
        townships: townships.map(t => ({
          id: t.id,
          name: t.name
        }))
      });
    }
  }
  
  return result;
}

module.exports = {
  TOWNSHIP_DATA,
  COUNTY_LIST,
  getAllTownships,
  getTownshipsByCounty,
  identifyTownship,
  formatTownshipPickerData
};
