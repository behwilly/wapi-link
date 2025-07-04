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
- Git (僅在本地開發和程式碼版本管理時需要)
- 一個 WhatsApp 帳號 (用於連接 WAPI Link)
- 一個 Ubuntu VPS (用於部署)

## 本地開發設置

1.  **克隆或下載專案**：
    如果你是從 GitHub 克隆：
    ```bash
    git clone [https://github.com/你的GitHub用戶名/wapi-link.git](https://github.com/你的GitHub用戶名/wapi-link.git)
    cd wapi-link
    ```
    **請將 `你的GitHub用戶名` 替換為你的實際 GitHub 用戶名。**
    如果你是直接下載 `.zip` 檔：將壓縮檔解壓到你的本地開發目錄。

2.  **安裝依賴**：
    進入專案根目錄後：
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

4.  **建立並運行 Webhook 接收器 (本地測試用)**：
    如果你想在本地測試 Webhook 功能，你需要一個接收器。
    創建一個 `webhook_receiver.js` 檔案 (可以放在專案根目錄下，或獨立於 `wapi-link` 資料夾)，並確保它在 5000 端口運行：
    ```javascript
    // webhook_receiver.js (請參考專案中的完整程式碼)
    const express = require('express');
    const app = express();
    const fs = require('fs');
    const path = require('path');
    const port = 5000; 

    const MEDIA_SAVE_DIR = './received_media';
    if (!fs.existsSync(MEDIA_SAVE_DIR)) {
        fs.mkdirSync(MEDIA_SAVE_DIR, { recursive: true });
        console.log(`📂 已創建媒體保存目錄: ${MEDIA_SAVE_DIR}`);
    }
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    app.post('/whatsapp-webhook', (req, res) => { /* ... 處理邏輯 ... */ });
    app.listen(port, () => { console.log(`Webhook Receiver 服務器已啟動在 http://localhost:${port}/whatsapp-webhook`); });
    ```
    **注意：** 如果 `webhook_receiver.js` 是獨立專案，你需要在它的目錄下執行 `npm install express`。

5.  **啟動 `ngrok` (本地測試 Webhook 用)**：
    如果你需要從外部網路向本地的 `webhook_receiver.js` 發送 Webhook，請使用 `ngrok`。
    ```bash
    # 在新的終端機中運行，並確保你的 webhook_receiver.js 服務器已啟動在 5000 端口
    ngrok http 5000 
    ```
    複製 ngrok 給你的 `Forwarding` URL，並**務必將這個 URL 更新到你的 `.env` 檔案中的 `WEBHOOK_BASE_URL`。**

6.  **運行 WAPI Link**：
    在專案根目錄下，開啟一個新的終端機：
    ```bash
    npm start
    ```
    第一次運行會顯示 QR code，請用手機掃描登錄。之後就可以自動登錄。

## 測試

1.  **運行自動化測試**：
    ```bash
    npm test
    ```
    這會運行所有 Jest 測試，驗證你的 API 端點邏輯。

2.  **手動測試發送消息 API (使用 Postman / cURL)**：
    - **URL**：`http://localhost:3000/send-message`
    - **Method**：`POST`
    - **Headers**：`Content-Type: application/json` 和 `x-api-key: 你的API_KEY`
    - **Body (JSON)**：
        - 文本消息: `{"number": "60123456789", "message": "Hello from WAPI Link API!"}`
        - 圖片消息 (Base64): `{"number": "60123456789", "media": {"data": "...", "mimetype": "image/jpeg"}, "caption": "..."}`
    - 檢查 Postman 響應和 WAPI Link 終端日誌。

3.  **手動測試接收消息 Webhook**：
    - 使用你的 WhatsApp 手機向 WAPI Link 綁定的號碼發送各種消息（文字、圖片、語音、位置、聯絡人等）。
    - 觀察 `webhook_receiver.js` 服務器運行的終端日誌，確認它接收到了 Webhook 並正確解析了消息類型。
    - 檢查 `received_media` 資料夾，確認媒體文件已成功保存。

## 部署到 Ubuntu VPS

### 1. VPS 環境準備

登錄你的 Ubuntu VPS，並安裝必要的軟體。
```bash
# 更新系統套件
sudo apt update && sudo apt upgrade -y

# 安裝 Git (用於未來版本管理或直接從 GitHub 拉取)
sudo apt install git -y

# 安裝 cURL (用於 Node.js 安裝腳本)
sudo apt install curl -y

# 安裝 Node.js LTS 版本
curl -fsSL [https://deb.nodesource.com/setup_lts.x](https://deb.nodesource.com/setup_lts.x) | sudo -E bash -
sudo apt install nodejs -y

# 安裝 PM2 (Node.js 進程管理器)
sudo npm install -g pm2