#!/usr/bin/env node
/**
 * 顺路货运 - 隧道管理脚本
 * 自动启动 localtunnel 并保存 URL 到文件
 */
const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const PORT = 3458;
const URL_FILE = path.join(__dirname, 'tunnel_url.txt');

async function startTunnel() {
  console.log(`[${new Date().toLocaleString()}] 正在启动隧道，连接端口 ${PORT}...`);
  
  try {
    const tunnel = await localtunnel({ port: PORT });
    
    console.log(`[${new Date().toLocaleString()}] ✅ 隧道已启动!`);
    console.log(`    公开地址: ${tunnel.url}`);
    
    // 保存 URL 到文件
    fs.writeFileSync(URL_FILE, tunnel.url.trim());
    console.log(`    URL 已保存到: ${URL_FILE}`);
    
    // 监听关闭事件，自动重连
    tunnel.on('close', () => {
      console.log(`[${new Date().toLocaleString()}] ⚠️ 隧道已关闭，5秒后重新连接...`);
      setTimeout(startTunnel, 5000);
    });
    
    tunnel.on('error', (err) => {
      console.error(`[${new Date().toLocaleString()}] ❌ 隧道错误: ${err.message}`);
    });
    
  } catch (err) {
    console.error(`[${new Date().toLocaleString()}] ❌ 无法启动隧道: ${err.message}`);
    console.log(`    10秒后重试...`);
    setTimeout(startTunnel, 10000);
  }
}

// 启动
startTunnel();
