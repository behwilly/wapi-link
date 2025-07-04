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
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
            level: 'debug'
        }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ],
    exceptionHandlers: [ new winston.transports.File({ filename: 'exceptions.log' }) ],
    rejectionHandlers: [ new winston.transports.File({ filename: 'rejections.log' }) ]
});


// --- Express 應用和服務器設置 ---
const app = express();
const port = 3000;
app.use(express.json());

// --- 全局狀態變量 ---
let isReady = process.env.NODE_ENV === 'test' ? true : false; 

// --- Webhook URL 配置 ---
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'https://YOUR_NGROK_DOMAIN_HERE_FALLBACK'; 
const WEBHOOK_PATH = '/whatsapp-webhook';
const WEBHOOK_URL = WEBHOOK_BASE_URL + WEBHOOK_PATH;

// --- API 安全性配置 ---
const API_KEY = process.env.API_KEY || 'YOUR_SECRET_API_KEY_HERE_FALLBACK'; 


// --- WhatsApp 客戶端初始化 ---
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'wapi-session',
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        executablePath: '/snap/bin/chromium', // <-- 確保是這個路徑
        headless: false, // <-- 這裡應該是 false
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
            // 其他你覺得需要的 arg，但核心是讓 xvfb-run 管理顯示
        ]
    }
});

// --- WhatsApp 客戶端事件監聽器 ---

client.on('qr', qr => {
    logger.info('請使用 WhatsApp 手機應用掃描以下二維碼進行登錄:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    logger.info('🎉 身份驗證成功！');
});

client.on('auth_failure', msg => {
    logger.error('❌ 身份驗證失敗:', msg);
});

client.on('ready', () => {
    isReady = true;
    logger.info('🚀 WAPI Link 已經準備就緒並運行中！');
    logger.info('現在你可以從你的應用程式調用這個 Gateway 來發送和接收 WhatsApp 消息了。');
});

client.on('message', async msg => {
    if (msg.fromMe) return;

    logger.info(`💬 收到來自 ${msg.from} 的消息:`, {
        type: msg.type,
        body: msg.body || '無內容 (可能為媒體消息)',
        from: msg.from,
        messageId: msg.id.id
    });

    if (process.env.NODE_ENV !== 'test' && WEBHOOK_URL !== 'https://YOUR_NGROK_DOMAIN_HERE_FALLBACK/whatsapp-webhook') { 
        try {
            let webhookData = {
                event: 'message_received',
                from: msg.from,
                to: msg.to,
                body: msg.body,
                type: msg.type,
                timestamp: msg.timestamp,
                messageId: msg.id.id,
            };

            if (msg.hasMedia && msg.mediaKey) { 
                try {
                    const media = await msg.downloadMedia();
                    webhookData.media = {
                        mimetype: media.mimetype,
                        filename: media.filename,
                        data: media.data
                    };
                    logger.info(`   [媒體消息] 媒體類型: ${media.mimetype}, 文件名: ${media.filename}`);
                } catch (mediaError) {
                    logger.error('❌ 下載媒體失敗:', {
                        message: mediaError.message,
                        messageId: msg.id.id,
                        from: msg.from,
                        errorStack: mediaError.stack
                    });
                    webhookData.mediaError = mediaError.message;
                }
            } else if (msg.hasMedia && !msg.mediaKey) {
                logger.warn('⚠️ 消息有媒體但無媒體密鑰，跳過下載。', {
                    messageId: msg.id.id,
                    type: msg.type,
                    from: msg.from
                });
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

            logger.info(`📤 正在向 Webhook 發送消息...`);
            const response = await axios.post(WEBHOOK_URL, webhookData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            logger.info(`✅ Webhook 發送成功！`, { statusCode: response.status });
        } catch (error) {
            logger.error(`❌ Webhook 發送失敗！`, {
                message: error.message,
                statusCode: error.response ? error.response.status : 'N/A',
                responseData: error.response ? error.response.data : 'N/A',
                errorStack: error.stack,
                webhookUrl: WEBHOOK_URL
            });
        }
    } else {
        logger.warn('⚠️ Webhook URL 未配置或當前處於測試環境，未發送消息回調。');
    }

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
    if (msg.fromMe) {
        logger.info(`📤 我方發送的消息:`, {
            to: msg.to,
            content: msg.body || '無內容',
            messageId: msg.id.id
        });
    }
});

client.on('disconnected', reason => {
    isReady = false;
    logger.warn('💔 客戶端斷開連接。原因:', reason);
});

// --- WhatsApp 客戶端初始化 ---
if (process.env.NODE_ENV !== 'test') {
    logger.info('正在嘗試連接 WhatsApp Web...');
    client.initialize();
} else {
    logger.info('處於測試環境，WhatsApp 客戶端初始化已被跳過。');
}


// --- HTTP API 端點 (Express 服務器部分) ---

app.get('/', (req, res) => {
    res.status(200).json({ status: 'WAPI Link API is running!' });
});

app.post('/send-message', async (req, res) => {
    const clientApiKey = req.headers['x-api-key'];

    if (!clientApiKey || clientApiKey !== API_KEY) {
        logger.warn('⚠️ API 請求被拒絕：API Key 無效或缺失。');
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: Invalid or missing API Key.'
        });
    }

    const { number, message, media, caption } = req.body;

    if (!isReady) {
        logger.warn('API 請求被拒絕：WhatsApp 客戶端未準備就緒。', {
            requestBody: req.body
        });
        return res.status(503).json({
            success: false,
            message: 'WhatsApp Client is not ready. Please wait for it to connect.'
        });
    }

    if (!number || (!message && !media)) {
        logger.warn('API 請求被拒絕：缺少必要參數 "number" 或 "message/media"。', {
            requestBody: req.body
        });
        return res.status(400).json({
            success: false,
            message: 'Both "number" (phone number) and either "message" (for text) or "media" (for file) are required in the request body.'
        });
    }

    const targetNumber = `${number.replace(/[^0-9]/g, '')}@c.us`;
    let contentToSend;

    try {
        if (media) {
            let mediaObject;
            if (media.data && media.mimetype) {
                mediaObject = new MessageMedia(media.mimetype, media.data, media.filename);
            } else if (media.path) {
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
            if (caption) {
                contentToSend.caption = caption;
            }
        } else {
            contentToSend = message;
        }

        const response = await (process.env.NODE_ENV === 'test' ? 
            Promise.resolve({ id: { fromMe: true, id: 'mock_message_id_for_test' } }) :
            client.sendMessage(targetNumber, contentToSend)
        );

        if (response.id.fromMe) {
            logger.info(`API 發送成功：消息到 ${targetNumber}`, {
                messageId: response.id.id,
                targetNumber: targetNumber,
                type: media ? media.mimetype : 'chat'
            });
            res.status(200).json({
                success: true,
                message: `Message sent to ${targetNumber}`,
                messageId: response.id.id,
                type: media ? media.mimetype : 'chat'
            });
        } else {
            logger.error(`API 發送失敗：消息到 ${targetNumber}`, {
                message: 'Failed to send message via WhatsApp (response.id.fromMe is false)',
                targetNumber: targetNumber,
                details: response
            });
            res.status(500).json({
                success: false,
                message: 'Failed to send message via WhatsApp',
                details: response
            });
        }
    } catch (error) {
        logger.error(`API 發送錯誤：消息到 ${targetNumber}`, {
            message: error.message,
            targetNumber: targetNumber,
            errorStack: error.stack,
            requestBody: req.body
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
if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        logger.info(`🌐 WAPI Link API 服務器已啟動在 http://localhost:${port}`);
        logger.info('請確保 WhatsApp 客戶端已連接並準備就緒，才能通過 API 發送消息。');
    });
}


// 為了讓測試框架 (如 Jest) 能夠導入 Express 應用實例，我們將其導出
// 在測試環境下，WAPI Link 應用會被導入，但不會真正啟動 WhatsApp 客戶端
module.exports = app;