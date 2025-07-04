require('dotenv').config(); // 最頂部引入並加載 dotenv

// 引入 whatsapp-web.js 的 Client 類、LocalAuth 模塊和 MessageMedia 類
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// 引入 qrcode-terminal 庫，用於在終端顯示二維碼
const qrcode = require('qrcode-terminal');
// 引入 Express 框架，用於構建 HTTP API
const express = require('express');
// 引入 axios 庫，用於發送 HTTP 請求 (Webhooks)
const axios = require('axios');
// 引入 Winston 日誌庫
const winston = require('winston'); 

// --- Winston 日誌配置 ---
// 設置日誌記錄器，將日誌輸出到控制台和檔案
const logger = winston.createLogger({
    level: 'info', // 預設日誌級別：info (會記錄 info, warn, error)
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss' // 日誌時間戳格式
        }),
        winston.format.errors({ stack: true }), // 記錄錯誤堆棧
        winston.format.splat(), // 允許像 console.log 那樣傳遞多個參數
        winston.format.json() // 輸出 JSON 格式，方便機器解析和集中化日誌系統
    ),
    transports: [
        // 輸出到控制台，方便開發調試
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(), // 控制台輸出帶顏色
                winston.format.simple() // 控制台輸出簡潔格式
            ),
            level: 'debug' // 控制台顯示所有級別的日誌 (debug, info, warn, error)，因為測試通常運行在開發環境
        }),
        // 輸出到檔案 (例如 error.log 只記錄錯誤，combined.log 記錄所有 info 以上的日誌)
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
    exceptionHandlers: [ // 捕獲 Node.js 程序中未捕獲的異常
        new winston.transports.File({ filename: 'exceptions.log' })
    ],
    rejectionHandlers: [ // 捕獲未處理的 Promise 拒絕 (rejections)
        new winston.transports.File({ filename: 'rejections.log' })
    ]
});


// --- Express 應用和服務器設置 ---
const app = express();
const port = 3000; // WAPI Link API 服務器將監聽的端口號
app.use(express.json()); // 允許 Express 應用解析 JSON 格式的請求體

// --- 全局狀態變量 ---
// 在測試環境下 (NODE_ENV=test)，isReady 默認為 true，以便 Supertest 測試可以繼續執行到參數驗證邏輯
// 在生產環境或開發環境，isReady 默認為 false，等待 WhatsApp 客戶端連接成功後才變為 true
let isReady = process.env.NODE_ENV === 'test' ? true : false; 

// --- Webhook URL 配置 ---
// 從環境變量中獲取基礎 URL。如果 .env 檔案中未設置，則使用備用值。
// 此 URL 是你的 Webhook 接收器服務器的地址，例如 ngrok 提供的公共域名
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://YOUR_NGROK_DOMAIN_HERE_FALLBACK'; 
const WEBHOOK_PATH = '/whatsapp-webhook'; // 你的 Webhook 接收器監聽的特定路徑
const WEBHOOK_URL = WEBHOOK_BASE_URL + WEBHOOK_PATH; // 組合成完整的 Webhook URL

// --- API 安全性配置 ---
// 從環境變量中獲取 API 密鑰。如果 .env 檔案中未設置，請確保備用值是安全的！
const API_KEY = process.env.API_KEY || 'YOUR_SECRET_API_KEY_HERE_FALLBACK'; 


// --- WhatsApp 客戶端初始化 ---
const client = new Client({
    // 使用 LocalAuth 來自動管理會話
    // 它會將會話數據保存在專案根目錄下的 .wwebjs_auth/wapi-session 目錄中
    authStrategy: new LocalAuth({
        clientId: 'wapi-session', // 會話的唯一 ID
        dataPath: './.wwebjs_auth' // 指定會話數據的根目錄
    }),
    puppeteer: {
        // executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: process.env.NODE_ENV === 'production' ? true : false, // 在生產環境下無頭模式運行
        args: [
            '--no-sandbox',           // 某些環境（如 Docker）中可能需要
            '--disable-setuid-sandbox' // 某些環境中可能需要
            // 其他 Puppeteer 參數可以在這裡添加
        ]
    }
});

// --- WhatsApp 客戶端事件監聽器 ---

// 當需要掃描二維碼時觸發
client.on('qr', qr => {
    logger.info('請使用 WhatsApp 手機應用掃描以下二維碼進行登錄:');
    qrcode.generate(qr, { small: true });
});

// 當成功通過身份驗證時觸發
client.on('authenticated', () => {
    logger.info('🎉 身份驗證成功！');
});

// 當身份驗證失敗時觸發
client.on('auth_failure', msg => {
    logger.error('❌ 身份驗證失敗:', msg);
    // 在這裡你可以添加邏輯來處理認證失敗，例如：
    // - 提示用戶重新掃描二維碼
    // - 清除會話數據並重試
});

// 當客戶端準備就緒，可以開始發送和接收消息時觸發
client.on('ready', () => {
    isReady = true; // 客戶端準備就緒，更新狀態
    logger.info('🚀 WAPI Link 已經準備就緒並運行中！');
    logger.info('現在你可以從你的應用程式調用這個 Gateway 來發送和接收 WhatsApp 消息了。');

    // --- 啟動時發送測試消息功能 (可選) ---
    // 你可以選擇將這部分代碼註釋掉或移除，避免每次啟動都發送測試消息。
    // const targetNumber = '60123396761@c.us'; // 對方手機號碼，請確認此號碼已註冊 WhatsApp
    // const message = 'Hello from WAPI Link! This is a test message from your gateway.';
    // client.sendMessage(targetNumber, message)
    //     .then(response => {
    //         if (response.id.fromMe) {
    //             logger.info(`✅ 啟動時發送測試消息到 ${targetNumber}`);
    //         } else {
    //             logger.error(`❌ 啟動時發送測試消息失敗:`, { details: response });
    //         }
    //     })
    //     .catch(err => {
    //         logger.error(`❌ 啟動時發送測試消息錯誤:`, { error: err.message, stack: err.stack });
    //     });
});

// 當收到任何新消息時觸發 (包括你收到的消息)
client.on('message', async msg => { // 將函數改為 async，因為要處理媒體下載等非同步操作
    if (msg.fromMe) return; // 忽略自己發送的消息，避免循環

    // 記錄收到消息的基本信息
    logger.info(`💬 收到來自 ${msg.from} 的消息:`, {
        type: msg.type,
        body: msg.body || '無內容 (可能為媒體消息)',
        from: msg.from,
        messageId: msg.id.id
    });

    // --- Webhook 發送邏輯 ---
    // 檢查 Webhook URL 是否已配置並非預設值
    // 這裡的判斷應該更嚴格，避免在測試環境下發送真實 webhook
    if (process.env.NODE_ENV !== 'test' && WEBHOOK_URL !== 'https://YOUR_NGROK_DOMAIN_HERE_FALLBACK/whatsapp-webhook') { 
        try {
            // 構造要發送到 Webhook 的基礎數據
            let webhookData = {
                event: 'message_received', // 事件類型
                from: msg.from,            // 消息發送者
                to: msg.to,                // 消息接收者 (你的 WAPI Link 號碼)
                body: msg.body,            // 對於文本消息是內容，對於媒體消息是描述 (caption)
                type: msg.type,            // 消息類型 (chat, image, video, document 等)
                timestamp: msg.timestamp,  // 消息時間戳
                messageId: msg.id.id,      // 消息的唯一 ID
                // 你可以在這裡根據需要添加更多 msg 對象的原始屬性，例如：
                // fromMe: msg.fromMe, isGroup: msg.isGroup, deviceType: msg.deviceType
            };

            // 根據消息類型，添加特定數據 (例如媒體文件、位置信息等)
            if (msg.hasMedia) {
                try {
                    const media = await msg.downloadMedia(); // 下載媒體數據
                    webhookData.media = {
                        mimetype: media.mimetype,
                        filename: media.filename,
                        data: media.data // Base64 編碼的媒體數據
                    };
                    logger.info(`   [媒體消息] 媒體類型: ${media.mimetype}, 文件名: ${media.filename}`);
                } catch (mediaError) {
                    logger.error('❌ 下載媒體失敗:', { // 記錄媒體下載錯誤
                        message: mediaError.message,
                        messageId: msg.id.id,
                        from: msg.from,
                        errorStack: mediaError.stack
                    });
                    webhookData.mediaError = mediaError.message; // 在 Webhook 數據中也標記錯誤
                }
            }
            if (msg.type === 'location' && msg.location) {
                webhookData.location = {
                    latitude: msg.location.latitude,
                    longitude: msg.location.longitude,
                    address: msg.location.address || '無地址信息'
                };
            }
            if (msg.type === 'contact_card' && msg.vCards) {
                const contact = await msg.getContact();
                webhookData.contact = {
                    id: contact.id._serialized,
                    name: contact.name || contact.pushname || contact.shortName || contact.id.user,
                    isMyContact: contact.isMyContact,
                    number: contact.number
                };
            }
            if (msg.isGroup) {
                const chat = await msg.getChat();
                webhookData.groupInfo = {
                    name: chat.name,
                    id: chat.id._serialized
                };
            }
            // 可以根據需要添加其他消息類型的處理，如 'sticker', 'audio', 'ptt', 'document', 'poll_creation', 'event_creation' 等

            // 發送 Webhook POST 請求
            logger.info(`📤 正在向 Webhook 發送消息...`);
            const response = await axios.post(WEBHOOK_URL, webhookData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            logger.info(`✅ Webhook 發送成功！`, { statusCode: response.status }); // 記錄成功響應
        } catch (error) {
            // 捕獲並詳細記錄 Webhook 發送過程中的錯誤
            logger.error(`❌ Webhook 發送失敗！`, {
                message: error.message,
                statusCode: error.response ? error.response.status : 'N/A', // HTTP 狀態碼
                responseData: error.response ? error.response.data : 'N/A', // 錯誤響應數據
                errorStack: error.stack, // 錯誤堆棧
                webhookUrl: WEBHOOK_URL // 記錄嘗試發送的 URL
            });
        }
    } else {
        logger.warn('⚠️ Webhook URL 未配置或當前處於測試環境，未發送消息回調。');
    }

    // --- 回復邏輯 (簡單的機器人功能) ---
    // 這部分邏輯與 Webhook 獨立，可以直接在 WAPI Link 內部處理
    if (msg.body === '!ping') {
        msg.reply('pong');
        logger.info(`   已回復 'pong' 給 ${msg.from}`);
    } else if (msg.body.startsWith('!echo ')) {
        const echoText = msg.body.substring(6);
        msg.reply(`你說的是: ${echoText}`);
        logger.info(`   已回復 '你說的是: ${echoText}' 給 ${msg.from}`);
    }
});

client.on('message_create', msg => {
    if (msg.fromMe) { // 僅處理我方發送的消息
        logger.info(`📤 我方發送的消息:`, {
            to: msg.to,
            content: msg.body || '無內容',
            messageId: msg.id.id
        });
    }
});

client.on('disconnected', reason => {
    isReady = false; // 客戶端斷開連接，更新狀態
    logger.warn('💔 客戶端斷開連接。原因:', reason);
    // 在這裡你可以添加自動重連邏輯，例如：
    // setTimeout(() => client.initialize(), 5000); // 5秒後嘗試重新連接
});

// --- WhatsApp 客戶端初始化 ---
// 僅當不是測試環境時才真正啟動 WhatsApp 客戶端
if (process.env.NODE_ENV !== 'test') {
    logger.info('正在嘗試連接 WhatsApp Web...');
    client.initialize();
} else {
    logger.info('處於測試環境，WhatsApp 客戶端初始化已被跳過。');
}


// --- HTTP API 端點 (Express 服務器部分) ---

// 健康檢查 API：用於確認 WAPI Link API 服務器是否運行
// 訪問：http://localhost:3000/
app.get('/', (req, res) => {
    res.status(200).json({ status: 'WAPI Link API is running!' });
});

// 發送消息 API：允許外部應用程式通過 HTTP 請求發送 WhatsApp 消息
// 接收一個 POST 請求，請求體應包含 JSON 對象：
//   - 文本消息: {"number": "目標號碼", "message": "消息內容"}
//   - 媒體消息: {"number": "目標號碼", "media": {"data": "base64編碼的數據", "mimetype": "image/jpeg"}, "caption": "可選的描述"}
//     或:        {"number": "目標號碼", "media": {"path": "本地檔案絕對路徑"}, "caption": "可選的描述"}
app.post('/send-message', async (req, res) => {
    // --- API Key 驗證 ---
    const clientApiKey = req.headers['x-api-key']; // 從請求頭部獲取 API Key

    if (!clientApiKey || clientApiKey !== API_KEY) {
        logger.warn('⚠️ API 請求被拒絕：API Key 無效或缺失。');
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid or missing API Key.'
        });
    }
    // --- API Key 驗證結束 ---

    const { number, message, media, caption } = req.body; // 解構請求體參數

    // 檢查 WhatsApp 客戶端是否已準備就緒，才能發送消息
    if (!isReady) {
        logger.warn('API 請求被拒絕：WhatsApp 客戶端未準備就緒。', {
            requestBody: req.body
        });
        return res.status(503).json({
            success: false,
            message: 'WhatsApp Client is not ready. Please wait for it to connect.'
        });
    }

    // 檢查必要參數：必須有 number，並且 message 或 media 至少有一個
    if (!number || (!message && !media)) {
        logger.warn('API 請求被拒絕：缺少必要參數 "number" 或 "message/media"。', {
            requestBody: req.body
        });
        return res.status(400).json({
            success: false,
            message: 'Both "number" (phone number) and either "message" (for text) or "media" (for file) are required in the request body.'
        });
    }

    // 格式化目標號碼為 WhatsApp ID 格式
    const targetNumber = `${number.replace(/[^0-9]/g, '')}@c.us`;
    let contentToSend; // 最終要發送的內容（文本字符串或 MessageMedia 對象）

    try {
        if (media) { // 如果請求包含媒體數據
            let mediaObject;
            if (media.data && media.mimetype) {
                // 如果媒體是 Base64 數據，使用 MessageMedia 創建媒體對象
                mediaObject = new MessageMedia(media.mimetype, media.data, media.filename);
            } else if (media.path) {
                // 如果媒體是本地檔案路徑，使用 MessageMedia.fromFilePath 創建
                // 請確保這個路徑在 WAPI Link 服務器上是可訪問的
                mediaObject = MessageMedia.fromFilePath(media.path);
            } else {
                logger.warn('API 請求被拒絕：無效的媒體對象。', {
                    requestBody: req.body
                });
                return res.status(400).json({
                    success: false,
                    message: 'Invalid "media" object. It must contain either "data" and "mimetype" or "path".'
                });
            }
            
            contentToSend = mediaObject;
            if (caption) { // 如果有描述，添加到媒體對象
                contentToSend.caption = caption;
            }
        } else {
            contentToSend = message; // 如果沒有媒體，則發送文本消息
        }

        // 調用 WhatsApp 客戶端發送消息或媒體
        // 為了測試，這裡我們不會真正調用 client.sendMessage，而是模擬其行為
        const response = await (process.env.NODE_ENV === 'test' ? 
            Promise.resolve({ id: { fromMe: true, id: 'mock_message_id_for_test' } }) : // 測試環境下模擬成功響應
            client.sendMessage(targetNumber, contentToSend) // 實際環境下調用真實方法
        );

        if (response.id.fromMe) { // 確認消息是從我方發送的
            logger.info(`API 發送成功：消息到 ${targetNumber}`, {
                messageId: response.id.id,
                targetNumber: targetNumber,
                type: media ? media.mimetype : 'chat' // 記錄發送的消息類型
            });
            res.status(200).json({
                success: true,
                message: `Message sent to ${targetNumber}`,
                messageId: response.id.id,
                type: media ? media.mimetype : 'chat'
            });
        } else {
            // 這可能表示消息進入佇列但實際發送失敗或狀態異常
            logger.error(`API 發送失敗：消息到 ${targetNumber}`, {
                message: 'Failed to send message via WhatsApp (response.id.fromMe is false)',
                targetNumber: targetNumber,
                details: response // 記錄 WhatsApp 返回的詳細響應
            });
            res.status(500).json({
                success: false,
                message: 'Failed to send message via WhatsApp',
                details: response
            });
        }
    } catch (error) {
        // 捕獲發送過程中的錯誤，例如網絡問題或 WhatsApp API 錯誤
        logger.error(`API 發送錯誤：消息到 ${targetNumber}`, {
            message: error.message,
            targetNumber: targetNumber,
            errorStack: error.stack, // 記錄完整錯誤堆棧
            requestBody: req.body // 記錄導致錯誤的請求體
        });
        let errorMessage = 'An error occurred while sending the message';
        if (error.message.includes('file doesn\'t exist at path')) {
            errorMessage = 'Media file not found at the specified path on the server.';
        }
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message
        });
    }
});

// --- 啟動 Express 服務器 ---
// 僅當不是測試環境時才真正啟動 Express 服務器
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        logger.info(`🌐 WAPI Link API 服務器已啟動在 http://localhost:${port}`);
        logger.info('請確保 WhatsApp 客戶端已連接並準備就緒，才能通過 API 發送消息。');
    });
}


// 為了讓測試框架 (如 Jest) 能夠導入 Express 應用實例，我們將其導出
// 在測試環境下，WAPI Link 應用會被導入，但不會真正啟動 WhatsApp 客戶端
module.exports = app;