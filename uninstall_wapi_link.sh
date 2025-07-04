#!/bin/bash

# --- 設定變數 (請務必與你的部署腳本 `deploy_wapi_link.sh` 保持一致！) ---
GITHUB_USERNAME="behwilly"            # 你的 GitHub 用戶名
GITHUB_REPO="wapi-link"                           # 你的 GitHub 倉庫名稱
DEPLOY_DIR="/www/wwwroot/wapi-link"                             # 專案部署的基礎目錄
WAPI_LINK_DIR="$DEPLOY_DIR/$GITHUB_REPO"          # WAPI Link 專案的路徑
WEBHOOK_RECEIVER_DIR="$DEPLOY_DIR/webhook-receiver" # Webhook 接收器專案的路徑

# --- 環境變數名稱 (與 /etc/environment 中的名稱一致) ---
ENV_VAR_API_KEY_NAME="API_KEY"
ENV_VAR_WEBHOOK_URL_NAME="WEBHOOK_BASE_URL"

# --- 日誌和會話數據路徑 ---
PM2_LOG_DIR="/var/log/pm2" # PM2 日誌的根目錄
WWEBJS_AUTH_DIR="$WAPI_LINK_DIR/.wwebjs_auth" # WhatsApp 會話數據目錄
RECEIVED_MEDIA_DIR="$WEBHOOK_RECEIVER_DIR/received_media" # 接收媒體保存目錄

# --- 卸載日誌 (腳本執行過程的日誌) ---
SCRIPT_LOG_FILE="/var/log/wapi-link-uninstall.log"


echo "--- 🧹 WAPI Link 完全自動化一鍵刪除部署腳本啟動 ---" | tee -a "$SCRIPT_LOG_FILE"
exec &> >(tee -a "$SCRIPT_LOG_FILE") # 將所有輸出重定向到日誌檔案

# 確保腳本以 root 權限運行
if [ "$EUID" -ne 0 ]; then
  echo "錯誤：請以 root 權限運行此腳本 (sudo ./uninstall_wapi_link_auto.sh)"
  exit 1
fi

echo "--- 1. 停止並刪除 PM2 應用程式 ---"
# 停止並刪除 WAPI Link
if pm2 list | grep -q "wapi-link"; then
  echo "停止並刪除 PM2 應用程式 'wapi-link'..."
  pm2 stop wapi-link
  pm2 delete wapi-link
else
  echo "PM2 中未找到應用程式 'wapi-link'，跳過刪除。"
fi

# 停止並刪除 Webhook 接收器
if pm2 list | grep -q "webhook-receiver"; then
  echo "停止並刪除 PM2 應用程式 'webhook-receiver'..."
  pm2 stop webhook-receiver
  pm2 delete webhook-receiver
else
  echo "PM2 中未找到應用程式 'webhook-receiver'，跳過刪除。"
fi

# 保存 PM2 狀態 (清除已刪除的應用)
pm2 save --force
echo "PM2 應用程式已停止並從列表中刪除。"


echo "--- 2. 移除專案檔案和資料夾 ---"
echo "刪除 WAPI Link 專案目錄: $WAPI_LINK_DIR"
rm -rf "$WAPI_LINK_DIR"

echo "刪除 Webhook 接收器專案目錄: $WEBHOOK_RECEIVER_DIR"
rm -rf "$WEBHOOK_RECEIVER_DIR"

echo "刪除 PM2 相關日誌檔案..."
rm -rf "$PM2_LOG_DIR/wapi_link"
rm -rf "$PM2_LOG_DIR/webhook_receiver"
echo "專案檔案和日誌已刪除。"


echo "--- 3. 清理 /etc/environment 中的環境變數 ---"
# 這是自動修改系統文件！使用 sed 命令進行精確刪除。
# sed -i 意思是直接在檔案中修改
# /^VAR_NAME=/d 匹配以 'VAR_NAME=' 開頭的行並刪除
if grep -q "^$ENV_VAR_API_KEY_NAME=" /etc/environment; then
    sed -i "/^$ENV_VAR_API_KEY_NAME=/d" /etc/environment
    echo "已從 /etc/environment 移除 $ENV_VAR_API_KEY_NAME。"
else
    echo "/etc/environment 中未找到 $ENV_VAR_API_KEY_NAME，跳過移除。"
fi

if grep -q "^$ENV_VAR_WEBHOOK_URL_NAME=" /etc/environment; then
    sed -i "/^$ENV_VAR_WEBHOOK_URL_NAME=/d" /etc/environment
    echo "已從 /etc/environment 移除 $ENV_VAR_WEBHOOK_URL_NAME。"
else
    echo "/etc/environment 中未找到 $ENV_VAR_WEBHOOK_URL_NAME，跳過移除。"
fi

echo "請注意：/etc/environment 的修改可能需要重啟 VPS 或重新登入 SSH 才能完全反映。"


echo "--- 4. 移除 PM2 開機啟動服務 ---"
# 這個命令會移除 PM2 的系統服務，防止它在開機時啟動
pm2 unstartup systemd || echo "PM2 開機啟動服務移除失敗或未設定。"
echo "PM2 開機啟動服務已嘗試移除。"


echo "--- 5. 徹底清理 PM2 (可選，極度謹慎) ---"
echo "警告：以下操作將會徹底刪除 PM2 本身及所有由它管理的應用程式和配置。"
echo "如果你在 VPS 上還有其他應用程式由 PM2 管理，請勿執行以下操作！"
read -p "你確定要徹底刪除 PM2 (y/N)? " confirm_pm2_delete
if [[ "$confirm_pm2_delete" =~ ^[yY]$ ]]; then
  echo "正在徹底刪除 PM2 和其所有配置..."
  pm2 kill || echo "無法停止 PM2 守護進程。"
  rm -rf "$(eval echo ~$PM2_USER)/.pm2" || echo "無法刪除 ~/.pm2 資料夾。請檢查權限或手動刪除。"
  npm uninstall -g pm2 || echo "PM2 全局卸載失敗。"
  echo "PM2 已徹底移除。"
else
  echo "跳過徹底刪除 PM2。"
fi


echo "--- ✅ WAPI Link 部署刪除完成！ ---"
echo "你的 WAPI Link 和相關組件已從此 VPS 移除。"
echo "如果這是你最後一個 Node.js 應用程式，你也可以考慮卸載 Node.js 和 npm。"