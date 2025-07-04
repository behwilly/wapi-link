#!/bin/bash

# --- 設定變數 (請務必替換為你的實際值！) ---
GITHUB_USERNAME=""            # 你的 GitHub 用戶名
GITHUB_REPO="wapi-link"                           # 你的 GitHub 倉庫名稱 (不需要 .git)
GITHUB_PAT=""                      # 你的 Personal Access Token (PAT)
VPS_USER="root"                          # 你希望 PM2 運行應用程式的用戶名 (例如 ubuntu, admin, 或 root)

DEPLOY_BASE_DIR="/opt"                            # 專案部署的基礎目錄，建議用 /opt 而不是 /var/www
WAPI_LINK_DIR="$DEPLOY_BASE_DIR/$GITHUB_REPO"     # WAPI Link 專案的最終路徑
WEBHOOK_RECEIVER_DIR="$DEPLOY_BASE_DIR/webhook-receiver" # Webhook 接收器專案的最終路徑

VPS_API_KEY="YOUR_VPS_API_KEY"                    # 你為 API 設定的密鑰 (請替換)
WEBHOOK_BASE_URL="http://localhost:5000"          # Webhook 接收器 URL (通常是 localhost:5000 如果在同一個 VPS)

# --- Chromium executablePath (腳本會自動檢測並修改 index.js) ---
CHROMIUM_EXEC_PATH="" # 腳本將會自動填充這個值

# --- 日誌檔案和會話數據權限設定 ---
PM2_LOG_DIR="/var/log/pm2" # PM2 日誌的根目錄 (這是 PM2 預設會用的位置，或者 /home/PM2_USER/.pm2/logs)
WWEBJS_AUTH_DIR="$WAPI_LINK_DIR/.wwebjs_auth" # WhatsApp 會話數據目錄
RECEIVED_MEDIA_DIR="$WEBHOOK_RECEIVER_DIR/received_media" # 接收媒體保存目錄

# --- 部署日誌 (腳本執行過程的日誌) ---
SCRIPT_LOG_FILE="/var/log/wapi-link-deploy.log"


echo "--- 🚀 WAPI Link 全自動部署腳本啟動 ---" | tee -a "$SCRIPT_LOG_FILE"

# 將所有標準輸出和錯誤重定向到日誌檔案
exec &> >(tee -a "$SCRIPT_LOG_FILE")

# 確保腳本以 root 權限運行
if [ "$EUID" -ne 0 ]; then
  echo "錯誤：請以 root 權限運行此腳本 (sudo ./deploy_wapi_link.sh)"
  exit 1
fi

# 嘗試獲取 PM2 用戶，如果不存在則使用當前 sudo 用戶
# 這用於正確設定檔案權限
if [ -z "$VPS_USER" ] || [ "$VPS_USER" == "your_username" ]; then # 如果用戶名未設定，或保留預設佔位符
    if [ -n "$SUDO_USER" ]; then
        PM2_RUN_USER="$SUDO_USER"
    else
        PM2_RUN_USER="root" # 最終 fallback 到 root
    fi
    echo "警告：VPS_USER 變數未設定或為預設值，將使用 $PM2_RUN_USER 設置檔案權限。"
else
    PM2_RUN_USER="$VPS_USER"
fi


echo "--- 1. 更新系統並安裝基礎工具 ---"
apt update && apt upgrade -y || { echo "❌ 系統更新失敗！"; exit 1; }
apt install git curl unzip wget nano jq -y || { echo "❌ 基礎工具安裝失敗！"; exit 1; }

echo "--- 2. 安裝 Node.js LTS 和 PM2 ---"
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - || { echo "❌ Node.js 軟體源設定失敗！"; exit 1; }
apt install nodejs -y || { echo "❌ Node.js 安裝失敗！"; exit 1; }
npm install -g pm2 || { echo "❌ PM2 安裝失敗！"; exit 1; }

echo "--- 3. 安裝 Chromium 瀏覽器及其運行依賴 ---"
snap install chromium || echo "警告：Snap 版 Chromium 安裝失敗或跳過，嘗試使用 apt。"

# 安裝所有常見的無頭 Chromium 運行時依賴
apt install -y \
gconf-service libappindicator1 libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
libindicator7 libnspr4 libnss3 libpango1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator3-1 \
libasound2-dev libnss3-dev libxkbcommon-dev xdg-utils libgbm-dev libsecret-1-0 \
libatk-bridge2.0-0 libdrm-dev libxkbcommon0 libvulkan1 fonts-noto-color-emoji || { echo "❌ Chromium 運行時依賴安裝失敗！"; }

# 自動檢測 Chromium 路徑
DETECTED_CHROMIUM_PATH=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null)
if [ -z "$DETECTED_CHROMIUM_PATH" ]; then
  echo "❌ 錯誤：未自動檢測到 Chromium 路徑！請確保已安裝 Chromium。"
  echo "腳本將嘗試使用 /snap/bin/chromium 作為預設值，如果仍失敗請手動確認 executablePath。"
  CHROMIUM_EXEC_PATH="/snap/bin/chromium" # 預設使用 Snap 的路徑
else
  CHROMIUM_EXEC_PATH="$DETECTED_CHROMIUM_PATH"
fi
echo "使用 Chromium 路徑: $CHROMIUM_EXEC_PATH"


echo "--- 4. 克隆專案並安裝 Node.js 依賴 ---"
mkdir -p "$DEPLOY_BASE_DIR"
cd "$DEPLOY_BASE_DIR" || { echo "❌ 無法進入部署基礎目錄！"; exit 1; }

# 如果專案目錄已存在，則先移除 (確保乾淨部署，如果需要保留舊會話數據，請自行修改此處)
if [ -d "$WAPI_LINK_DIR" ]; then
    echo "專案目錄已存在，正在刪除舊目錄 $WAPI_LINK_DIR..."
    rm -rf "$WAPI_LINK_DIR" || { echo "❌ 無法刪除舊專案目錄！"; exit 1; }
fi

# 克隆私有倉庫，使用 PAT 進行認證
# 注意：這裡將 PAT 直接放入 URL，安全性較低，但在單次自動化腳本中常見。
# 更安全的方式是將 PAT 存儲為環境變數或使用 ssh-agent。
git clone "https://$GITHUB_PAT@github.com/$GITHUB_USERNAME/$GITHUB_REPO.git" || { echo "❌ 專案克隆失敗，請檢查 PAT 和用戶名/倉庫名稱！"; exit 1; }

cd "$WAPI_LINK_DIR" || { echo "❌ 無法進入 WAPI Link 專案目錄！"; exit 1; }

# === 動態移除 package.json 中的 devDependencies ===
echo "動態移除 package.json 中的 devDependencies 以確保生產部署成功..."
jq 'del(.devDependencies)' package.json > package.json.tmp && mv package.json.tmp package.json || \
{ echo "❌ 無法移除 package.json 中的 devDependencies！"; exit 1; }
echo "devDependencies 已從 package.json 移除。"

# 安裝 Node.js 生產依賴
rm -rf node_modules package-lock.json # 清理舊的依賴
export PUPPETEER_SKIP_DOWNLOAD=true # 阻止 Puppeteer 下載 Chromium
npm install --production || { echo "❌ Node.js 依賴安裝失敗！"; exit 1; }
unset PUPPETEER_SKIP_DOWNLOAD # 取消設定環境變數


echo "--- 5. 準備 Webhook 接收器 ---"
mkdir -p "$WEBHOOK_RECEIVER_DIR"
cd "$WEBHOOK_RECEIVER_DIR" || { echo "❌ 無法進入 Webhook 接收器目錄！"; exit 1; }

# 如果接收器目錄已存在，先刪除
if [ -d "$WEBHOOK_RECEIVER_DIR" ] && [ "$(ls -A $WEBHOOK_RECEIVER_DIR)" ]; then # 檢查目錄不為空才提示
    echo "警告：Webhook 接收器目錄 $WEBHOOK_RECEIVER_DIR 已存在且不為空。為確保乾淨部署，將會覆蓋/重建。"
    rm -rf "$WEBHOOK_RECEIVER_DIR"/* # 刪除內容，不刪目錄本身
fi
# 重新創建目錄以確保權限正確
mkdir -p "$WEBHOOK_RECEIVER_DIR"

# 創建 webhook_receiver.js 檔案
# 這裡將直接寫入完整內容，你可以替換為 scp 傳輸如果你有獨立的 webhook_receiver.js 倉庫
echo '
const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const port = 5000;

const MEDIA_SAVE_DIR = "./received_media";
if (!fs.existsSync(MEDIA_SAVE_DIR)) {
    fs.mkdirSync(MEDIA_SAVE_DIR, { recursive: true });
    console.log(`📂 Created media save directory: ${MEDIA_SAVE_DIR}`);
}
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.post("/whatsapp-webhook", (req, res) => {
    console.log("🟢 Received new WhatsApp Webhook!");
    const messageData = req.body;
    console.log("Data:", JSON.stringify(messageData, null, 2));

    if (messageData.media && messageData.media.data) {
        const buffer = Buffer.from(messageData.media.data, "base64");
        const ext = path.extname(messageData.media.filename || "").toLowerCase() || `.${messageData.media.mimetype.split("/")[1]}`;
        const filename = `${messageData.messageId || Date.now()}${ext.split(";")[0]}`;
        const filePath = path.join(MEDIA_SAVE_DIR, filename);
        fs.writeFile(filePath, buffer, (err) => {
            if (err) console.error(`❌ Failed to save file: ${err.message}`);
            else console.log(`✅ ${messageData.type} saved to: ${filePath}`);
        });
    }
    res.status(200).send("Webhook Received Successfully!");
});

app.listen(port, () => {
    console.log(`Webhook Receiver server started on http://localhost:${port}/whatsapp-webhook`);
});
' > webhook_receiver.js

# 安裝 Webhook 接收器依賴
npm install express || { echo "❌ Webhook Receiver 依賴安裝失敗！"; exit 1; }


echo "--- 6. 設定 WAPI Link 啟動腳本 ---"
# 創建 WAPI Link 啟動腳本 (start_app.sh)
# index.js 中的 executablePath 和 headless 設定應已在 GitHub 上配置正確。
cd "$WAPI_LINK_DIR" || { echo "❌ 無法進入 WAPI Link 專案目錄！"; exit 1; }
echo '#!/bin/bash

# 創建 WAPI Link 啟動腳本 (start_app.sh) (KEEP THIS PART)
cd "$WAPI_LINK_DIR"
echo '#!/bin/bash
# 環境變數會從 /etc/environment 或 PM2 的 --env 設置載入
xvfb-run --server-args="-screen 0 1024x768x24" node index.js' > start_app.sh
chmod +x start_app.sh


echo "--- 7. 設定系統環境變數 (在 /etc/environment) ---"
# 將 API_KEY 和 WEBHOOK_BASE_URL 寫入 /etc/environment
# 只有在變數不存在時才添加，避免重複添加
if ! grep -q "^$ENV_VAR_API_KEY_NAME=" /etc/environment; then
    echo "$ENV_VAR_API_KEY_NAME=\"$VPS_API_KEY\"" | tee -a /etc/environment > /dev/null
    echo "已在 /etc/environment 添加 $ENV_VAR_API_KEY_NAME。"
else
    # 如果變數已存在，則更新其值
    sed -i "/^$ENV_VAR_API_KEY_NAME=/c\\$ENV_VAR_API_KEY_NAME=\"$VPS_API_KEY\"" /etc/environment
    echo "已在 /etc/environment 更新 $ENV_VAR_API_KEY_NAME。"
fi

if ! grep -q "^$ENV_VAR_WEBHOOK_URL_NAME=" /etc/environment; then
    echo "$ENV_VAR_WEBHOOK_URL_NAME=\"$WEBHOOK_BASE_URL\"" | tee -a /etc/environment > /dev/null
    echo "已在 /etc/environment 添加 $ENV_VAR_WEBHOOK_URL_NAME。"
else
    # 如果變數已存在，則更新其值
    sed -i "/^$ENV_VAR_WEBHOOK_URL_NAME=/c\\$ENV_VAR_WEBHOOK_URL_NAME=\"$WEBHOOK_BASE_URL\"" /etc/environment
    echo "已在 /etc/environment 更新 $ENV_VAR_WEBHOOK_URL_NAME。"
fi

echo "請注意：/etc/environment 的修改可能需要重啟 VPS 或重新登入 SSH 才能完全反映。"


echo "--- 8. 設定目錄權限 (非常重要！) ---"
# 為 PM2 日誌目錄創建並設定權限
mkdir -p "$PM2_LOG_DIR/wapi_link"
mkdir -p "$PM2_LOG_DIR/webhook_receiver"
chmod -R 777 "$PM2_LOG_DIR" # 給予 PM2 日誌目錄所有權限

# 確保應用程式目錄可讀寫，並設定所有者
chown -R "$PM2_RUN_USER":"$PM2_RUN_USER" "$WAPI_LINK_DIR" || { echo "❌ 設置 $WAPI_LINK_DIR 權限失敗！"; }
chmod -R 777 "$WAPI_LINK_DIR/.wwebjs_auth" # 允許所有權限寫入會話數據

chown -R "$PM2_RUN_USER":"$PM2_RUN_USER" "$WEBHOOK_RECEIVER_DIR" || { echo "❌ 設置 $WEBHOOK_RECEIVER_DIR 權限失敗！"; }
mkdir -p "$RECEIVED_MEDIA_DIR"
chmod -R 777 "$RECEIVED_MEDIA_DIR"


echo "--- 9. 啟動應用程式並配置 PM2 ---"
# 清理所有舊的 PM2 進程 (確保從乾淨狀態開始)
pm2 stop all
pm2 delete all

# 啟動 Webhook 接收器
cd "$WEBHOOK_RECEIVER_DIR" || { echo "❌ 無法進入 Webhook 接收器目錄以啟動！"; exit 1; }
pm2 start webhook_receiver.js --name "webhook-receiver" --time --env production

# 啟動 WAPI Link
cd "$WAPI_LINK_DIR" || { echo "❌ 無法進入 WAPI Link 目錄以啟動！"; exit 1; }
pm2 start start_app.sh --name "wapi-link" --time --interpreter=bash # 指定 interpreter 是 bash

# 保存 PM2 進程列表並配置開機自啟
pm2 save
pm2 startup # 會提示你執行一個 sudo 命令，請複製並執行它


echo "--- 10. 首次登錄 WhatsApp ---"
echo "部署完成！請執行 'pm2 logs wapi-link' 查看 QR Code，並用手機掃描登錄。"
echo "一旦登錄成功，WAPI Link 將在 VPS 上持續運行。"

echo "--- 11. 配置防火牆 (如果你的 VPS 使用 ufw) ---"
echo "請確保以下端口在防火牆中開放："
echo "sudo ufw allow 3000/tcp" # WAPI Link API 端口
echo "sudo ufw allow 5000/tcp" # Webhook 接收器端口
echo "sudo ufw enable # 如果防火牆未啟用，啟用它"

echo "--- ✅ 部署完成！ ---"