// 引入 Express 框架
const express = require('express');
const app = express();
// 引入 Node.js 文件系統模組，用於保存文件
const fs = require('fs');
// 引入路徑模組，用於處理文件路徑
const path = require('path');

// !!! 重要：確保這個端口 (5000) 和你的 WAPI Link (3000) 是不同的 !!!
const port = 5000; 

// 定義媒體文件保存的目錄
const MEDIA_SAVE_DIR = './received_media'; 

// 檢查媒體保存目錄是否存在，如果不存在則創建它
if (!fs.existsSync(MEDIA_SAVE_DIR)) {
    fs.mkdirSync(MEDIA_SAVE_DIR, { recursive: true });
    console.log(`📂 已創建媒體保存目錄: ${MEDIA_SAVE_DIR}`);
}

// 使用 express.json() 中間件來解析 JSON 格式的請求體
// 增加請求體大小限制，例如設置為 50MB。預設通常是 100kb，對於圖片來說太小了。
app.use(express.json({ limit: '50mb' }));
// 如果你也處理 URL-encoded 數據，也可能需要增加這個限制
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// --- Webhook 接收端點 ---
app.post('/whatsapp-webhook', (req, res) => {
    console.log('🟢 收到新的 WhatsApp Webhook！');
    const messageData = req.body; 

    console.log(`--- 消息詳情 ---`);
    console.log(`來源: ${messageData.from || '未知'}`); 
    console.log(`目標: ${messageData.to || '未知'}`);   
    console.log(`類型: ${messageData.type || '未知'}`); 
    console.log(`時間戳: ${new Date(messageData.timestamp * 1000).toLocaleString()}`); 
    console.log(`消息 ID: ${messageData.messageId || '未知'}`);

    // 根據消息類型進行不同的處理
    switch (messageData.type) {
        case 'chat':
            console.log(`📝 文本消息內容: ${messageData.body}`);
            break;
        case 'image':
            console.log(`🖼️ 圖片消息`);
            console.log(`   圖片描述 (Caption): ${messageData.body || '無描述'}`);
            if (messageData.media && messageData.media.data) {
                const buffer = Buffer.from(messageData.media.data, 'base64');
                const ext = path.extname(messageData.media.filename || '').toLowerCase() || `.${messageData.media.mimetype.split('/')[1]}`;
                const filename = `${messageData.messageId || Date.now()}${ext.split(';')[0]}`; 
                const filePath = path.join(MEDIA_SAVE_DIR, filename);

                fs.writeFile(filePath, buffer, (err) => {
                    if (err) {
                        console.error(`❌ 保存圖片文件失敗: ${err.message}`);
                    } else {
                        console.log(`✅ 圖片已保存到: ${filePath}`);
                    }
                });
            }
            break;
        case 'video':
            console.log(`🎥 視頻消息`);
            console.log(`   視頻描述 (Caption): ${messageData.body || '無描述'}`);
            if (messageData.media && messageData.media.data) {
                const buffer = Buffer.from(messageData.media.data, 'base64');
                const ext = path.extname(messageData.media.filename || '').toLowerCase() || `.${messageData.media.mimetype.split('/')[1]}`;
                const filename = `${messageData.messageId || Date.now()}${ext.split(';')[0]}`;
                const filePath = path.join(MEDIA_SAVE_DIR, filename);

                fs.writeFile(filePath, buffer, (err) => {
                    if (err) {
                        console.error(`❌ 保存視頻文件失敗: ${err.message}`);
                    } else {
                        console.log(`✅ 視頻已保存到: ${filePath}`);
                    }
                });
            }
            break;
        case 'document':
            console.log(`📄 文檔消息`);
            console.log(`   文件名: ${messageData.filename || '未知文件名'}`);
            if (messageData.media && messageData.media.data) {
                const buffer = Buffer.from(messageData.media.data, 'base64');
                const filename = messageData.filename || `${messageData.messageId || Date.now()}.${messageData.media.mimetype.split('/')[1].split(';')[0]}`;
                const filePath = path.join(MEDIA_SAVE_DIR, filename);

                fs.writeFile(filePath, buffer, (err) => {
                    if (err) {
                        console.error(`❌ 保存文檔文件失敗: ${err.message}`);
                    } else {
                        console.log(`✅ 文檔已保存到: ${filePath}`);
                    }
                });
            }
            break;
        case 'ptt': 
        case 'audio': 
            console.log(`🎤🎵 音頻消息`);
            if (messageData.media && messageData.media.data) {
                const buffer = Buffer.from(messageData.media.data, 'base64');
                const ext = path.extname(messageData.media.filename || '').toLowerCase() || `.${messageData.media.mimetype.split('/')[1]}`;
                const filename = `${messageData.messageId || Date.now()}${ext.split(';')[0]}`;
                const filePath = path.join(MEDIA_SAVE_DIR, filename);

                fs.writeFile(filePath, buffer, (err) => {
                    if (err) {
                        console.error(`❌ 保存音頻文件失敗: ${err.message}`);
                    } else {
                        console.log(`✅ 音頻已保存到: ${filePath}`);
                    }
                });
            }
            break;
        case 'sticker':
            console.log(`✨ 貼圖消息`);
            if (messageData.media && messageData.media.data) {
                const buffer = Buffer.from(messageData.media.data, 'base64');
                const ext = path.extname(messageData.media.filename || '').toLowerCase() || '.webp';
                const filename = `${messageData.messageId || Date.now()}${ext.split(';')[0]}`;
                const filePath = path.join(MEDIA_SAVE_DIR, filename);

                fs.writeFile(filePath, buffer, (err) => {
                    if (err) {
                        console.error(`❌ 保存貼圖文件失敗: ${err.message}`);
                    } else {
                        console.log(`✅ 貼圖已保存到: ${filePath}`);
                    }
                });
            }
            break;
        case 'location':
            console.log(`📍 位置消息`);
            if (messageData.location) {
                console.log(`   緯度: ${messageData.location.latitude}`);
                console.log(`   經度: ${messageData.location.longitude}`);
                console.log(`   地址: ${messageData.location.address || '無地址信息'}`);
            }
            break;
        case 'contact_card': // 聯絡人名片
            console.log(`👤 聯絡人名片`);
            if (messageData.contact) {
                console.log(`   聯絡人姓名: ${messageData.contact.name || '未知姓名'}`);
                console.log(`   聯絡人號碼: ${messageData.contact.number || '未知號碼'}`);
                console.log(`   原始 vCard 數據 (可在 body 中查看): ${messageData.body ? messageData.body.substring(0, 100) + '...' : '無'}`); // 打印部分 vCard
            } else {
                console.log(`   無詳細聯絡人信息`);
                console.log(`   原始 Webhook 數據 (vcard): ${JSON.stringify(messageData, null, 2)}`);
            }
            break;
        case 'poll_creation': // 投票創建消息
            console.log(`📊 投票創建消息`);
            console.log(`   投票問題: ${messageData.body || '無問題'}`);
            // 注意：whatsapp-web.js 默認的 message 對象可能不直接包含所有投票選項，
            // 如果需要詳細信息，可能需要更深入地探索原始 msg 對象或 whatsapp-web.js 文檔
            console.log(`   (投票詳情需要更深入解析原始數據)`);
            console.log(`   原始 Webhook 數據 (poll_creation): ${JSON.stringify(messageData, null, 2)}`);
            break;
        case 'event_creation': // 活動創建消息
            console.log(`📅 活動創建消息`);
            console.log(`   活動名稱: ${messageData.body || '無名稱'}`);
            // 同樣，活動的開始時間、地點等詳細信息可能需要更深入解析
            console.log(`   (活動詳情需要更深入解析原始數據)`);
            console.log(`   原始 Webhook 數據 (event_creation): ${JSON.stringify(messageData, null, 2)}`);
            break;
        default:
            console.log(`❓ 收到未知消息類型: ${messageData.type}`);
            console.log(`   原始 Webhook 數據: ${JSON.stringify(messageData, null, 2)}`);
            break;
    }
    console.log(`--- 處理完畢 ---`);

    res.status(200).send('Webhook Received Successfully!');
});

// --- 服務器啟動 ---
app.listen(port, () => {
    console.log(`Webhook Receiver 服務器已啟動在 http://localhost:${port}/whatsapp-webhook`);
    console.log('等待來自 WAPI Link 的消息...');
});