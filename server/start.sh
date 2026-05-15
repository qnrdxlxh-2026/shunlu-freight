#!/bin/bash
# 顺路货运平台启动脚本（带自动重启）
cd "$(dirname "$0")"
echo "🚚 启动顺路货运平台（自动重启模式）..."
while true; do
  node app.js
  echo "⚠️ 服务器意外退出，3秒后重启..."
  sleep 3
done
