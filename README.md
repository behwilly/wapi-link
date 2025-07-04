-----



好的！我會為你的 **WAPI Link** 專案重新編寫一份全面且清晰的 `README.md` 檔案。這份 `README` 將完全專注於**如何在 Ubuntu VPS 上部署**，並強調**私有倉庫**的處理方式，同時確保所有必要的資訊都包含在內。



這份 `README.md` 檔案將是你的專案最好的文件，讓它對任何部署者（包括未來的你）都極為友善。



-----



# WAPI Link - Custom WhatsApp Gateway



-----



## 🚀 專案簡介



`WAPI Link` 是一個基於 **Node.js** 和 [`whatsapp-web.js` 函式庫](https://www.google.com/search?q=%5Bhttps://wwebjs.dev/%5D\(https://wwebjs.dev/\)) 搭建的自定義 WhatsApp Gateway。它提供了一個 **HTTP API**，讓你能夠透過程式碼發送 WhatsApp 訊息（包括文字和多媒體檔案），並透過 **Webhook** 實時接收來自 WhatsApp 的訊息回調。



這個專案的目標是提供一個可擴展、安全的接口，讓你的應用程式能夠自動化與 WhatsApp 用戶的互動，例如：



  * 自動發送訂單確認、物流更新。

  * 接收客戶查詢並整合到你的客服系統。

  * 實現基於 WhatsApp 的自動化機器人。



**⚠️ 重要提示：** 本專案使用非官方的 `whatsapp-web.js` 函式庫，該庫透過模擬 WhatsApp Web 的行為工作。請務必了解使用此類非官方工具可能違反 **WhatsApp 官方服務條款**，並存在 **帳號被封鎖的風險**。本專案僅用於學習和個人實驗目的，**不推薦用於商業或大規模生產環境**。請自行承擔所有風險。



## ✨ 功能特性



  * **WhatsApp 連接**：基於 `whatsapp-web.js`，支援自動化登入和會話管理。

  * **訊息發送 API**：提供 HTTP `POST` 端點 `/send-message`，支援發送**文字和多媒體檔案**（圖片、影片、文件），並可帶有描述。

  * **訊息接收 Webhook**：當收到新的 WhatsApp 訊息時，自動向預設的 Webhook URL 發送 `POST` 請求，包含訊息詳細資訊和多媒體內容（Base64 編碼）。

  * **多媒體處理**：接收到的圖片、影片、語音、文件和貼圖會自動保存到 `received_media` 資料夾。

  * **API 安全性**：透過 HTTP Header `x-api-key` 實現基本的 API Key 驗證。

  * **健壯日誌**：使用 [Winston](https://www.npmjs.com/package/winston) 函式庫實現結構化日誌，支援多級別日誌輸出到控制台和檔案。

  * **後台運行**：支援使用 [PM2](https://pm2.keymetrics.io/) 進行進程管理，確保應用程式在後台穩定運行。

  * **環境變數配置**：敏感資訊（如 API Key、Webhook URL）透過**系統環境變數**管理，確保安全性。



## ⚙️ 環境要求



  * 一個 **Ubuntu VPS** (推薦 LTS 版本，例如 v20.04 或 v22.04)

  * **Node.js** (推薦 LTS 版本，v18.x 或 v20.x，但本專案在 **v22.x** 上已驗證成功)

  * **npm** (Node Package Manager)

  * **Git** (用於克隆專案)

  * 一個 **WhatsApp 帳號** (用於連接 WAPI Link)

  * **SSH 客戶端** (用於連接 VPS)



-----



## 🚀 部署到 Ubuntu VPS 指南



本指南將詳細說明如何將 `WAPI Link` 部署到一個 **Ubuntu VPS** 上。這個專案會假定你的 GitHub 倉庫是 **私有的 (Private)**，並使用 **Personal Access Token (PAT)** 進行認證。



### 1\. VPS 環境準備



透過 SSH 連接到你的 Ubuntu VPS，並安裝所有必要的系統套件和 Node.js 環境。



```bash

# 1. 更新系統套件列表

sudo apt update

sudo apt upgrade -y



# 2. 安裝 Git (用於克隆私有倉庫)

sudo apt install git -y



# 3. 安裝 cURL (用於 Node.js 安裝腳本)

sudo apt install curl -y



# 4. 安裝 Node.js LTS 版本

# 注意：如果你的 VPS 已經安裝了 Node.js v22.x，可以跳過此步。

# 本專案在 Node.js v22.12.0 上驗證成功。

curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -

sudo apt install nodejs -y

# 驗證 Node.js 和 npm 是否成功安裝

node -v

npm -v



# 5. 安裝 PM2 (Node.js 進程管理器)

sudo npm install -g pm2



# 6. 安裝 Chromium (用於 whatsapp-web.js)

# 本專案建議使用 Snap 安裝的 Chromium，因為它在 ARM64 環境下兼容性較好。

sudo snap install chromium

# 如果 snap install 失敗，或你的 Ubuntu 版本較舊，可以嘗試 apt 安裝：

# sudo apt install chromium-browser -y



# 7. 安裝所有常見的無頭 Chromium 運行時依賴 (非常重要，即使已安裝也要再次運行以確保完整性)

sudo apt install -y \

gconf-service \

libappindicator1 \

libasound2 \

libatk1.0-0 \

libc6 \

libcairo2 \

libcups2 \

libdbus-1-3 \

libexpat1 \

libfontconfig1 \

libgcc1 \

libgconf-2-4 \

libgdk-pixbuf2.0-0 \

libglib2.0-0 \

libgtk-3-0 \

libindicator7 \

libnspr4 \

libnss3 \

libpango1.0-0 \

libstdc++6 \

libx11-6 \

libx11-xcb1 \

libxcb1 \

libxcomposite1 \

libxcursor1 \

libxdamage1 \

libxext6 \

libxfixes3 \

libxi6 \

libxrandr2 \

libxrender1 \

libxss1 \

libxtst6 \

ca-certificates \

fonts-liberation \

libappindicator3-1 \

libasound2-dev \

libnss3-dev \

libxkbcommon-dev \

xdg-utils \

libgbm-dev \

libsecret-1-0 \

libatk-bridge2.0-0 \

libdrm-dev \

libxkbcommon0 \

libvulkan1 \

fonts-noto-color-emoji

```



### 2\. 生成 Personal Access Token (PAT)



由於你的 GitHub 倉庫是私有的，你不能直接 `git clone` 或 `wget` 程式碼。你需要一個 **Personal Access Token (PAT)** 來認證。



1.  **登錄你的 GitHub 帳號。**

2.  點擊右上角的**頭像**，選擇 **`Settings` (設定)**。

3.  在左側導覽列，找到 **`Developer settings` (開發者設定)**。

4.  點擊 **`Personal access tokens` (個人訪問令牌)**，然後選擇 **`Tokens (classic)`**。

5.  點擊綠色的 **`Generate new token` (生成新令牌)**。

6.  給它一個有意義的名稱（例如 `vps-wapi-link-deploy`）。

7.  在 `Select scopes` (選擇範圍) 下，至少勾選 **`repo`** (允許訪問私有倉庫)。

8.  點擊 **`Generate token`**。

9.  **務必複製生成的令牌！** 這個令牌只會顯示一次，請將它**妥善保管**，因為它將用作你的 GitHub 密碼。



### 3\. 在 VPS 上部署專案



1.  **克隆專案到 VPS**：

    進入你希望部署專案的目錄 (例如 `/var/www/` 或 `/home/your_username/`):



```bash

    cd /var/www/ # 替換為你的目標目錄



    # 克隆私有倉庫：當提示輸入密碼時，貼上你剛剛生成的 PAT

    git clone https://github.com/behwilly/wapi-link.git



    # 進入專案目錄

    cd wapi-link/

```



2.  **安裝 Node.js 依賴**：



```bash

    npm install --production

```



      * `npm install --production` 會只安裝生產環境所需的依賴，跳過開發依賴（例如 Jest 和 Supertest）。

      * 如果遇到 `ETARGET` 錯誤，請確認你本地的 `package.json` 中的 `devDependencies` 沒有問題，並嘗試刪除 VPS 上的 `node_modules` 和 `package-lock.json` 後再重試。



3.  **準備 Webhook 接收器**：

    `WAPI Link` 會將收到的消息推送到一個 Webhook 接收器。這個接收器也需要運行在 VPS 上。



```bash

    # 假設你在 /var/www/ 下創建一個獨立的 webhook-receiver 資料夾

    cd /var/www/

    mkdir webhook-receiver

    cd webhook-receiver/



    # 創建 webhook_receiver.js 檔案 (內容請參考專案代碼或 README 本地開發設置中的範例)

    nano webhook_receiver.js # 將內容貼上並保存



    # 安裝 Express

    npm install express

```



    **請確保 `webhook_receiver.js` 中的 `port` 設定為 `5000`。**



4.  **設定 Chromium `executablePath` (在 `index.js` 內)**：

    `whatsapp-web.js` 需要知道 `chromium` 在 VPS 上的確切路徑。



      * 在 VPS 上執行這個命令，找到 Chromium 的實際路徑：

```bash

        which chromium || which chromium-browser # 複製它的輸出！通常是 /snap/bin/chromium

    ```

      * **編輯你 VPS 上的 `index.js` 檔案**：

```bash

        nano index.js # 開啟 index.js

    ```

        修改 `puppeteer` 配置中的 `executablePath`：

    ```javascript

        // index.js (部分程式碼)

        puppeteer: {

            executablePath: '/snap/bin/chromium', // <-- 替換為你 VPS 上 'which chromium' 的實際輸出

            headless: false, // <-- 如果使用 xvfb-run，這裡應為 false

            args: [

                '--no-sandbox',

                '--disable-setuid-sandbox',

                // 如果在某些 VPS 環境下仍然遇到問題，可以嘗試添加這些：

                // '--disable-gpu', 

                // '--disable-dev-shm-usage',

                // ...

            ]

        }

    ```

        **保存檔案** (Ctrl+X, Y, Enter)。



5.  **設定系統環境變數**：

    `API_KEY` 和 `WEBHOOK_BASE_URL` 需要在 VPS 系統層面設定，以便 PM2 管理的應用程式能夠讀取。



```bash

    sudo nano /etc/environment

```



    添加或修改以下行：



```

    API_KEY="your_vps_api_key_here"              # 你在 VPS 上使用的 API 密鑰

    WEBHOOK_BASE_URL="http://localhost:5000"     # Webhook 接收器在同一個 VPS 上運行

```



    **保存檔案** (Ctrl+X, Y, Enter)。

    **重啟 VPS** (`sudo reboot`) 或 `source /etc/environment` 並登出再登入 SSH，確保環境變數生效。



6.  **設定 WAPI Link 啟動腳本 (`start_app.sh`)**：

    由於 `xvfb-run` 的特殊性，我們用一個 shell 腳本來啟動 `index.js`。

    在你的 `wapi-link` 專案目錄 (`/var/www/wapi-link`) 中創建 `start_app.sh`：



```bash

    cd /var/www/wapi-link # 進入 wapi-link 專案目錄

    nano start_app.sh

```



    在 `start_app.sh` 檔案中貼上以下內容：



```bash

    #!/bin/bash

    # 環境變數會從 /etc/environment 載入，並由 PM2 自動注入



    # 這是運行你的 Node.js 應用程式在 Xvfb 虛擬顯示器中的命令

    # --server-args="-screen 0 1024x768x24" 建立一個虛擬螢幕

    xvfb-run --server-args="-screen 0 1024x768x24" node index.js

```



    **保存檔案** (Ctrl+X, Y, Enter)。

    **使腳本可執行：**



```bash

    chmod +x start_app.sh

```



7.  **設定目錄權限 (非常重要！)**

    確保所有應用程式和日誌文件有正確的讀寫權限。



```bash

    # 讓 PM2 日誌目錄可寫 (通常在 /root/.pm2/logs/ 如果你用 root 運行)

    sudo mkdir -p /root/.pm2/logs/

    sudo chmod -R 777 /root/.pm2/logs/ # 測試用，生產環境應更嚴格



    # 確保 wapi-link 專案目錄可讀寫 (特別是 .wwebjs_auth 資料夾)

    sudo chown -R root:root /var/www/wapi-link # 如果你以 root 運行

    sudo chmod -R 777 /var/www/wapi-link/.wwebjs_auth # 允許所有權限寫入會話數據



    # 確保 webhook-receiver 的接收媒體目錄可寫 (如果有的話)

    sudo mkdir -p /var/www/webhook-receiver/received_media 

    sudo chmod -R 777 /var/www/webhook-receiver/received_media

```



### 4\. 啟動應用程式並配置 PM2



1.  **啟動 Webhook 接收器**：



```bash

    cd /var/www/webhook-receiver/ # 進入 webhook_receiver.js 所在目錄

    pm2 start webhook_receiver.js --name "webhook-receiver" --time --env production

```



2.  **啟動 WAPI Link**：



```bash

    cd /var/www/wapi-link/ # 進入 wapi-link 專案目錄

    pm2 start start_app.sh --name "wapi-link" --time --interpreter=bash # 指定 interpreter 是 bash

```



3.  **保存 PM2 進程列表並配置開機自啟**：



```bash

    pm2 save

    pm2 startup

```



      * **務必複製並執行 `pm2 startup` 提供的 `sudo` 命令**，它會配置系統服務，讓 PM2 和它管理的應用程式在伺服器重啟後自動啟動。



### 5\. 首次登錄 WhatsApp



1.  查看 WAPI Link 的日誌以獲取 QR Code：

```bash

    pm2 logs wapi-link

```

2.  用你的手機 WhatsApp 掃描日誌中顯示的 QR Code 進行登錄。

3.  一旦登錄成功，你的 WAPI Link 將在 VPS 上持續運行。



### 6\. 配置防火牆



如果你的 VPS 啟用了防火牆 (例如 `ufw`)，你需要允許外部流量訪問你的 API 端口 (3000) 和 Webhook 接收端口 (5000)。



```bash

sudo ufw allow 3000/tcp

sudo ufw allow 5000/tcp

sudo ufw enable # 如果防火牆未啟用，啟用它

```



-----