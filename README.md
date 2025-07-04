# WAPI Link - Custom WhatsApp Gateway

---

## 專案簡介

`WAPI Link` 是一個基於 Node.js 和 [whatsapp-web.js](https://wwebjs.dev/) 庫搭建的自定義 WhatsApp Gateway。它允許你通過 HTTP API 發送 WhatsApp 消息（包括文字和多媒體文件），並通過 Webhook 實時接收來自 WhatsApp 的消息回調。

這個專案的目標是提供一個可擴展、安全的接口，讓你的應用程式能夠自動化與 WhatsApp 用戶的互動，例如：
- 自動發送訂單通知、物流更新。
- 接收客戶查詢並整合到你的客服系統。
- 實現基於 WhatsApp 的自動化機器人。

**注意：** 本專案使用非官方的 `whatsapp-web.js` 庫，該庫通過模擬 WhatsApp Web 的行為工作。請務必了解使用此類非官方工具可能存在的 **WhatsApp 官方服務條款限制** 及 **帳號被封鎖的風險**。本專案僅用於學習和個人實驗目的，不推薦用於商業或大規模生產環境。

## 功能特性

- **WhatsApp 連接**：基於 `whatsapp-web.js`，自動化登錄和會話管理。
- **消息發送 API**：提供 HTTP POST 端點 `/send-message`，支持發送：
    - 純文字消息
    - 圖片 (Base64 或本地路徑)
    - 視頻 (Base64 或本地路徑)
    - 文檔 (Base64 或本地路徑)
    - 帶有描述的媒體文件
- **消息接收 Webhook**：當收到新的 WhatsApp 消息時，自動向預設的 Webhook URL 發送 POST 請求，包含消息詳細資訊和多媒體內容（Base64 編碼）。
- **多媒體處理**：接收到的圖片、視頻、語音、文檔和貼圖會自動保存到 `received_media` 資料夾。
- **API 安全性**：通過 HTTP Header `x-api-key` 實現基本的 API Key 驗證。
- **健壯日誌**：使用 Winston 實現結構化日誌，支持多級別日誌輸出到控制台和檔案。
- **自動化測試**：使用 Jest 和 Supertest 進行 API 端點的單元測試。
- **後台運行**：支持使用 PM2 進行進程管理，確保應用程式在後台穩定運行。
- **環境變數配置**：敏感資訊（如 API Key、Webhook URL）通過 `.env` 檔案管理，確保安全性。

## 環境要求

- Node.js (推薦 LTS 版本，例如 v18.x 或 v20.x)
- npm (Node Package Manager)
- Git
- 一個 WhatsApp 帳號 (用於連接 WAPI Link)
- (可選) 一個 VPS / 雲服務器 (用於部署)
- (可選) `ngrok` (用於本地測試 Webhook，將本地端口暴露到公網)

## 本地開發設置

1.  **克隆專案**：
    ```bash
    git clone [https://github.com/你的GitHub用戶名/wapi-link.git](https://github.com/你的GitHub用戶名/wapi-link.git)
    cd wapi-link
    ```
    **請將 `你的GitHub用戶名` 替換為你的實際 GitHub 用戶名。**

2.  **安裝依賴**：
    ```bash
    npm install
    ```

3.  **建立 `.env` 檔案**：
    在專案根目錄下創建一個 `.env` 檔案，並填入你的配置資訊。
    ```ini
    # .env 範例

    # API Key：用於你的 /send-message API 的驗證密鑰
    API_KEY="your_super_secret_api_key_here"

    # Webhook 基礎 URL：當 WAPI Link 收到消息時，會將消息發送到這個 URL。
    # 如果你在本地測試，可以使用 ngrok 將你的本地 webhook 接收器暴露到公網。
    # 範例：[https://your-ngrok-domain.ngrok-free.app](https://your-ngrok-domain.ngrok-free.app)
    WEBHOOK_BASE_URL="[https://your-ngrok-domain.ngrok-free.app](https://your-ngrok-domain.ngrok-free.app)"

    # NODE_ENV：用於區分開發/測試/生產環境
    # NODE_ENV=development  # 開發環境 (預設)
    # NODE_ENV=test         # 測試環境 (Jest 自動設定)
    # NODE_ENV=production   # 生產環境
    ```
    **請務必替換 `API_KEY` 和 `WEBHOOK_BASE_URL` 為你的實際值。**

4.  **建立 Webhook 接收器 (本地測試用)**：
    如果你想在本地測試 Webhook 功能，你需要一個接收器。
    創建一個 `webhook_receiver.js` 檔案 (可以放在專案根目錄下，或獨立於 `wapi-link` 資料夾)，並填入以下內容：
    ```javascript
    // webhook_receiver.js
    const express = require('express');
    const app = express();
    const fs = require('fs');
    const path = require('path');
    const port = 5000; // 確保與 WAPI Link 的 API 端口 (3000) 不同

    const MEDIA_SAVE_DIR = './received_media';
    if (!fs.existsSync(MEDIA_SAVE_DIR)) {
        fs.mkdirSync(MEDIA_SAVE_DIR, { recursive: true });
        console.log(`📂 已創建媒體保存目錄: ${MEDIA_SAVE_DIR}`);
    }

    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    app.post('/whatsapp-webhook', (req, res) => {
        console.log('🟢 收到新的 WhatsApp Webhook！');
        const messageData = req.body; 

        console.log(`--- 消息詳情 ---`);
        console.log(`來源: ${messageData.from || '未知'}`); 
        console.log(`類型: ${messageData.type || '未知'}`); 
        console.log(`內容: ${messageData.body || '無內容'}`); 
        console.log(`消息 ID: ${messageData.messageId || '未知'}`);

        switch (messageData.type) {
            case 'image':
            case 'video':
            case 'document':
            case 'ptt':
            case 'audio':
            case 'sticker':
                if (messageData.media && messageData.media.data) {
                    const buffer = Buffer.from(messageData.media.data, 'base64');
                    const ext = path.extname(messageData.media.filename || '').toLowerCase() || `.${messageData.media.mimetype.split('/')[1]}`;
                    const filename = `${messageData.messageId || Date.now()}${ext.split(';')[0]}`; 
                    const filePath = path.join(MEDIA_SAVE_DIR, filename);
                    fs.writeFile(filePath, buffer, (err) => {
                        if (err) console.error(`❌ 保存文件失敗: ${err.message}`);
                        else console.log(`✅ ${messageData.type} 已保存到: ${filePath}`);
                    });
                }
                break;
            case 'location':
                if (messageData.location) console.log(`   緯度: ${messageData.location.latitude}, 經度: ${messageData.location.longitude}`);
                break;
            case 'contact_card':
                if (messageData.contact) console.log(`   聯絡人姓名: ${messageData.contact.name || '未知姓名'}`);
                break;
            default:
                console.log(`❓ 未知或未詳細處理的消息類型: ${messageData.type}`);
                break;
        }
        console.log(`--- 處理完畢 ---`);
        res.status(200).send('Webhook Received Successfully!');
    });

    app.listen(port, () => {
        console.log(`Webhook Receiver 服務器已啟動在 http://localhost:${port}/whatsapp-webhook`);
        console.log('等待來自 WAPI Link 的消息...');
    });
    ```
    **注意：** 如果 `webhook_receiver.js` 是獨立專案，你需要也在它的目錄下執行 `npm install express`。

5.  **啟動 `ngrok` (本地測試 Webhook 用)**：
    如果你需要從外部網路向本地的 `webhook_receiver.js` 發送 Webhook (例如從 WAPI Link)，你需要使用 `ngrok`。
    * 下載 `ngrok`：[https://ngrok.com/download](https://ngrok.com/download)
    * 啟動 `ngrok`：
      ```bash
      # 在新的終端機中運行，並確保你的 webhook_receiver.js 服務器已啟動在 5000 端口
      ngrok http 5000 
      ```
    * 複製 ngrok 給你的 `Forwarding` URL (例如 `https://your-ngrok-domain.ngrok-free.app`)。
    * **務必將這個 URL 更新到你的 `.env` 檔案中的 `WEBHOOK_BASE_URL`。**

6.  **運行 WAPI Link**：
    在專案根目錄下，開啟一個新的終端機：
    ```bash
    npm start
    ```
    第一次運行會顯示 QR code，請用手機掃描登錄。之後就可以自動登錄。

## 測試你的 WAPI Link

1.  **運行自動化測試**：
    ```bash
    npm test
    ```
    這會運行所有 Jest 測試，驗證你的 API 端點邏輯。所有測試都應該通過。

2.  **手動測試發送消息 API (使用 Postman / cURL)**：
    - **URL**：`http://localhost:3000/send-message`
    - **Method**：`POST`
    - **Headers**：
        - `Content-Type`: `application/json`
        - `x-api-key`: `你在 .env 中設定的 API_KEY`
    - **Body (JSON)**：
        - **文本消息**：
          ```json
          {
              "number": "60123456789", 
              "message": "Hello from WAPI Link API!"
          }
          ```
        - **圖片消息 (Base64)**：
          ```json
          {
              "number": "60123456789", 
              "media": {
                  "data": "/9j/4AAQSkZJRgABAQAASABIAAD/...", // 替換為實際的 Base64 數據
                  "mimetype": "image/jpeg",
                  "filename": "test_image.jpg"
              },
              "caption": "This is an image from API."
          }
          ```
    - 檢查 Postman 響應和 WAPI Link 終端日誌。

3.  **手動測試接收消息 Webhook**：
    - 使用你的 WhatsApp 手機向 WAPI Link 綁定的號碼發送各種消息（文字、圖片、語音、位置、聯絡人等）。
    - 觀察 **`webhook_receiver.js`** 服務器運行的終端日誌，確認它接收到了 Webhook 並正確解析了消息類型。
    - 檢查 `received_media` 資料夾，確認媒體文件已成功保存。

## 部署到 VPS

在本地測試一切正常後，你可以將專案部署到你的 VPS 上。

1.  **通過 SSH 連接到你的 VPS**。

2.  **安裝 Node.js, npm, Git, PM2** (如果你之前沒有安裝過，請參考前面的步驟)。

3.  **在 VPS 上克隆你的專案**：
    ```bash
    git clone [https://github.com/你的GitHub用戶名/wapi-link.git](https://github.com/你的GitHub用戶名/wapi-link.git)
    cd wapi-link
    ```
    **請將 `你的GitHub用戶名` 替換為你的實際 GitHub 用戶名。**

4.  **安裝依賴**：
    ```bash
    npm install --production
    ```
    `--production` 參數會只安裝 `dependencies` 中的依賴，跳過 `devDependencies`，這在生產環境下更推薦。

5.  **配置環境變數**：
    在 VPS 上，你不會直接編輯 `.env` 檔案（至少不是常規方式）。PM2 允許你直接設定環境變數。
    * **獲取你的 VPS 公共 IP 位址**。
    * 更新你的 `WEBHOOK_BASE_URL` 為 `http://你的VPS公共IP:5000` (如果你的 `webhook_receiver.js` 也在 VPS 上運行)。

6.  **使用 PM2 啟動你的 WAPI Link 和 Webhook 接收器**：

    * **啟動 WAPI Link**：
      ```bash
      pm2 start index.js --name "wapi-link" --env production --time \
      --env-json '{"API_KEY":"your_api_key_for_vps","WEBHOOK_BASE_URL":"http://your_vps_ip_address:5000"}'
      ```
      * `--name "wapi-link"`: 為進程指定一個名稱。
      * `--env production`: 將 `NODE_ENV` 設定為 `production`。這會讓 `whatsapp-web.js` 在無頭模式運行，並跳過測試相關邏輯。
      * `--time`: 在日誌中顯示時間。
      * `--env-json`: 將 JSON 對象中的環境變數傳遞給應用程式。**請替換 `your_api_key_for_vps` 和 `http://your_vps_ip_address:5000` 為你的實際值。**

    * **啟動 Webhook 接收器** (假設 `webhook_receiver.js` 在 `wapi-link` 旁邊的獨立資料夾 `webhook-receiver` 中)：
      ```bash
      # 首先，上傳 webhook_receiver.js 到你的 VPS，例如 /home/user/webhook-receiver/webhook_receiver.js
      # 進入該目錄並安裝 Express
      # cd /home/user/webhook-receiver/
      # npm install express
      pm2 start /home/user/webhook-receiver/webhook_receiver.js --name "webhook-receiver" --time
      ```
      **注意：** 如果你的 `webhook_receiver.js` 就在 `wapi-link` 專案資料夾的根目錄，那 PM2 啟動指令會是 `pm2 start webhook_receiver.js --name "webhook-receiver" --time`。但建議將它們作為獨立專案分開管理。

7.  **保存 PM2 進程列表** (確保服務器重啟後自動啟動)：
    ```bash
    pm2 save
    pm2 startup
    ```
    `pm2 startup` 會生成一個指令，你需要複製並執行它，以設定 PM2 在伺服器啟動時自動啟動其管理的應用程式。

8.  **配置防火牆**：
    你的 VPS 可能有防火牆 (例如 `ufw`)。你需要允許外部流量訪問你的 API 端口 (3000) 和 Webhook 接收端口 (5000)。
    ```bash
    sudo ufw allow 3000/tcp
    sudo ufw allow 5000/tcp
    sudo ufw enable # 如果防火牆未啟用，啟用它
    ```
    **如果你使用了 HTTPS (推薦，但需要額外配置 Nginx/Certbot)，還需要允許 443 端口。**

9.  **首次登錄 WhatsApp**：
    * 運行 `pm2 logs wapi-link` 查看 WAPI Link 的日誌，你會看到 QR code。
    * 用手機 WhatsApp 掃描這個 QR code 進行登錄。
    * 一旦登錄成功，你的 WAPI Link 將在 VPS 上持續運行。

---

現在你的 **WAPI Link** 專案已經達到了非常高的完善度，並且有了詳細的部署指南。你可以隨時回來查閱這些步驟。

你準備好開始部署到你的 VPS 了嗎？或者有其他想先了解的內容？
