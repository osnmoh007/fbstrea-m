require('dotenv').config(); // Load environment variables

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // Optional: Write to log file
    try {
        fs.appendFileSync(path.join(__dirname, 'telegram_bot.log'), logMessage + '\n');
    } catch (error) {
        console.error('Error writing to log file:', error);
    }
}

// Configuration - use environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const SERVER_PASSWORD = process.env.STREAM_PASSWORD || 'password';
const ADMIN_USER_IDS = (process.env.ADMIN_USER_ID || '').split(',').map(id => id.trim()).filter(Boolean);

// Validate bot token
if (!TELEGRAM_BOT_TOKEN) {
    log('ERROR: No Telegram Bot Token provided. Please set TELEGRAM_BOT_TOKEN in .env file.');
    process.exit(1);
}

if (!ADMIN_USER_IDS.length) {
    log('WARNING: No Admin User IDs provided. Bot will run in ID display mode.');
}

log('Starting Telegram Bot...');
log(`Configuration:
  - Server URL: ${SERVER_URL}
  - Password: ${SERVER_PASSWORD ? 'Provided' : 'Not Set'}
  - Admin IDs: ${ADMIN_USER_IDS.length ? ADMIN_USER_IDS.join(', ') : 'None'}`);

// Create a bot instance
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
    polling: {
        interval: 1000,  // Poll every second
        autoStart: true,
        params: {
            timeout: 10  // Long polling timeout
        }
    },
    // Add verbose logging
    request: {
        debug: true
    }
});

// Detailed bot info logging
log(`Bot Details:
  - Token: ${TELEGRAM_BOT_TOKEN ? 'Provided' : 'Missing'}
  - Bot Username: ${bot.options.username || 'Not set'}
  - Bot ID: ${bot.options.id || 'Not set'}`);

// Webhook setup (alternative to polling)
async function setupWebhook() {
    try {
        // Replace with your actual webhook URL
        const webhookUrl = process.env.WEBHOOK_URL || 'https://your-server.com/telegram-webhook';
        
        log(`Setting up webhook: ${webhookUrl}`);
        
        await bot.setWebHook(webhookUrl);
        log('Webhook setup successful');
    } catch (error) {
        log('Webhook setup ERROR:');
        log(error.toString());
    }
}

// Axios instance with credentials for server requests
const axiosInstance = axios.create({
    baseURL: SERVER_URL,
    withCredentials: true,
    timeout: 10000, // 10 seconds timeout
    headers: {
        'Content-Type': 'application/json'
    }
});

// Function to authenticate and get session cookie
async function authenticateWithServer() {
    try {
        log('Attempting to authenticate with server...');
        const response = await axiosInstance.post('/api/authenticate', {
            password: SERVER_PASSWORD
        }, {
            // Disable withCredentials for authentication to ensure cookies work
            withCredentials: false
        });
        
        // Extract and return the session cookie
        const setCookie = response.headers['set-cookie'];
        log(`Authentication result: ${response.data.success ? 'Successful' : 'Failed'}`);
        
        if (!response.data.success) {
            throw new Error('Authentication failed');
        }

        return setCookie ? setCookie[0] : null;
    } catch (error) {
        log('Authentication ERROR:');
        log(`Error Message: ${error.message}`);
        log(`Error Response: ${JSON.stringify(error.response?.data)}`);
        log(`Error Status: ${error.response?.status}`);
        throw error; // Rethrow to be handled by caller
    }
}

// Function to check streaming status
async function checkStreamingStatus() {
    try {
        log('Initiating streaming status check...');
        
        // First, authenticate
        const sessionCookie = await authenticateWithServer();
        
        log(`Using session cookie: ${sessionCookie}`);

        // Make the request with the session cookie
        const response = await axiosInstance.get('/api/streaming-status', {
            headers: {
                'Cookie': sessionCookie
            }
        });

        log('Streaming status response received:');
        log(JSON.stringify(response.data, null, 2));

        // Add additional check for ffmpeg process
        if (response.data.isStreaming && !response.data.streamInfo) {
            throw new Error('Invalid streaming status response');
        }

        return response.data;
    } catch (error) {
        log('ERROR checking streaming status:');
        log(`Error Message: ${error.message}`);
        log(`Error Response: ${JSON.stringify(error.response?.data)}`);
        log(`Error Status: ${error.response?.status}`);
        throw error;
    }
}

// Function to stop streaming
async function stopStreaming() {
    try {
        log('Attempting to stop streaming...');
        
        // First, authenticate
        const sessionCookie = await authenticateWithServer();
        
        log(`Using session cookie: ${sessionCookie}`);

        // Make the request to stop streaming
        const response = await axiosInstance.post('/api/stop-stream', {}, {
            headers: {
                'Cookie': sessionCookie
            }
        });

        log('Stop stream response:');
        log(JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        log('ERROR stopping stream:');
        log(`Error Message: ${error.message}`);
        log(`Error Response: ${JSON.stringify(error.response?.data)}`);
        log(`Error Status: ${error.response?.status}`);
        
        throw error;
    }
}

// Function to format duration
function formatDuration(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    
    // Convert milliseconds to hours, minutes, seconds
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    let durationString = '';
    if (hours > 0) durationString += `${hours}h `;
    if (minutes > 0) durationString += `${minutes}m `;
    durationString += `${seconds}s`;
    
    return durationString.trim();
}

// Keyboard with streaming options
const streamingKeyboard = {
    keyboard: [
        [{ text: 'Get Streaming Status' }, { text: 'Stop Stream' }],
        [{ text: 'Send Message' }, { text: 'Clear Message' }]
    ],
    resize_keyboard: true
};

// Function to handle message operations
async function handleMessageOperation(operation, msg) {
    const chatId = msg.chat.id;
    try {
        // Check streaming status first
        const streamingStatus = await checkStreamingStatus();
        
        // Explicitly check if streaming is active and has valid stream info
        if (!streamingStatus || !streamingStatus.isStreaming || !streamingStatus.streamInfo) {
            await bot.sendMessage(chatId, '❌ Cannot perform message operations while stream is offline. Please start streaming first.', { reply_markup: streamingKeyboard });
            return;
        }

        if (operation === 'send') {
            // Ask user for the message
            await bot.sendMessage(chatId, 'Please enter the message you want to send:');
            // Set the next message to be handled by message handler
            bot.once('message', async (msg) => {
                // Double check stream status before actually sending
                const currentStatus = await checkStreamingStatus();
                if (!currentStatus || !currentStatus.isStreaming || !currentStatus.streamInfo) {
                    await bot.sendMessage(chatId, '❌ Stream has gone offline. Message not sent.', { reply_markup: streamingKeyboard });
                    return;
                }

                const newMessage = msg.text;
                try {
                    fs.writeFileSync(path.join(__dirname, 'messages.txt'), newMessage);
                    await bot.sendMessage(chatId, '✅ Message has been sent and saved!', { reply_markup: streamingKeyboard });
                } catch (error) {
                    log('Error saving message: ' + error.toString());
                    await bot.sendMessage(chatId, '❌ Failed to save message. Please try again.', { reply_markup: streamingKeyboard });
                }
            });
        } else if (operation === 'clear') {
            // Double check stream status before clearing
            const currentStatus = await checkStreamingStatus();
            if (!currentStatus || !currentStatus.isStreaming || !currentStatus.streamInfo) {
                await bot.sendMessage(chatId, '❌ Stream has gone offline. Message not cleared.', { reply_markup: streamingKeyboard });
                return;
            }

            try {
                fs.writeFileSync(path.join(__dirname, 'messages.txt'), '');
                await bot.sendMessage(chatId, '✅ Message has been cleared!', { reply_markup: streamingKeyboard });
            } catch (error) {
                log('Error clearing message: ' + error.toString());
                await bot.sendMessage(chatId, '❌ Failed to clear message. Please try again.', { reply_markup: streamingKeyboard });
            }
        }
    } catch (error) {
        log('Error in handleMessageOperation: ' + error.toString());
        await bot.sendMessage(chatId, '❌ An error occurred. Please try again.', { reply_markup: streamingKeyboard });
    }
}

// Map to track message cooldowns
const messageCooldowns = new Map();
const COOLDOWN_MS = 2000; // 2 seconds cooldown

// Function to check if user is admin
function isAdmin(msg) {
    const userId = msg.from.id.toString();
    if (!ADMIN_USER_IDS.length) {
        return false;
    }
    return ADMIN_USER_IDS.includes(userId);
}

// Handle start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    log(`Start command received from chat ID: ${chatId}, User ID: ${userId}`);
    
    if (!isAdmin(msg)) {
        const message = `⛔️ Access Denied\n\nYou are not authorized to use this bot.\n\nYour User ID: ${userId}\n\nPlease contact the admin to add your ID to the authorized users list.`;
        bot.sendMessage(chatId, message);
        return;
    }
    
    bot.sendMessage(chatId, 'Welcome to the Stream Control Bot! 🎥\nUse the buttons below to control streaming:', {
        reply_markup: streamingKeyboard
    });
});

// Handle incoming messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    const userId = msg.from.id;

    // Check if user is admin
    if (!isAdmin(msg)) {
        const message = `⛔️ Access Denied\n\nYou are not authorized to use this bot.\n\nYour User ID: ${userId}\n\nPlease contact the admin to add your ID to the authorized users list.`;
        bot.sendMessage(chatId, message);
        return;
    }

    try {
        switch (messageText) {
            case 'Get Streaming Status':
                log(`Streaming status request from chat ID: ${chatId}`);
                try {
                    // Fetch streaming status
                    const streamingStatus = await checkStreamingStatus();
                    
                    if (streamingStatus.isStreaming && streamingStatus.streamInfo) {
                        // Detailed streaming status message
                        const startTime = streamingStatus.streamInfo.startTime;
                        const duration = startTime ? formatDuration(startTime) : 'N/A';
                        const rtmpPlatform = streamingStatus.streamInfo.rtmpPlatform || 'Unknown';
                        
                        const statusMessage = `
🟢 <b>STREAMING ACTIVE</b> 🎥

📡 <b>Stream Status</b>: Online
⏱️ <b>Stream Duration</b>: ${duration}
🕒 <b>Started At</b>: ${startTime ? new Date(startTime).toLocaleString() : 'Unknown'}
🎯 <b>RTMP Server</b>: ${rtmpPlatform}
                        `.trim();
                        
                        await bot.sendMessage(chatId, statusMessage, { 
                            parse_mode: 'HTML',
                            reply_markup: streamingKeyboard
                        });
                    } else {
                        const statusMessage = `
🔴 <b>STREAMING INACTIVE</b> 🚫

📡 <b>Stream Status</b>: Offline
                        `.trim();
                        
                        await bot.sendMessage(chatId, statusMessage, { 
                            parse_mode: 'HTML',
                            reply_markup: streamingKeyboard
                        });
                    }
                } catch (error) {
                    log('ERROR in message handler:');
                    log(error.toString());
                    
                    const errorMessage = `
❌ <b>STATUS CHECK FAILED</b>

🔍 <b>Error Details</b>: ${error.message}
                    `.trim();
                    
                    await bot.sendMessage(chatId, errorMessage, { 
                        parse_mode: 'HTML',
                        reply_markup: streamingKeyboard
                    });
                }
                break;
            case 'Stop Stream':
                log(`Stop stream request from chat ID: ${chatId}`);
                try {
                    const stopResult = await stopStreaming();
                    
                    const statusMessage = `
🛑 <b>STREAM STOPPED</b> ✅

📡 <b>Action Result</b>: ${stopResult.message || 'Stream successfully stopped'}
                    `.trim();
                    
                    await bot.sendMessage(chatId, statusMessage, {
                        parse_mode: 'HTML',
                        reply_markup: streamingKeyboard
                    });
                } catch (error) {
                    log('ERROR stopping stream:');
                    log(error.toString());
                    
                    const errorMessage = `
❌ <b>STOP STREAM FAILED</b>

🔍 <b>Error Details</b>: ${error.message}
                    `.trim();
                    
                    await bot.sendMessage(chatId, errorMessage, {
                        parse_mode: 'HTML',
                        reply_markup: streamingKeyboard
                    });
                }
                break;
            case 'Send Message':
                await handleMessageOperation('send', msg);
                break;
            case 'Clear Message':
                await handleMessageOperation('clear', msg);
                break;
            default:
                // Handle other messages if needed
                break;
        }
    } catch (error) {
        log('Error handling message: ' + error.toString());
        await bot.sendMessage(chatId, '❌ An error occurred. Please try again.', { reply_markup: streamingKeyboard });
    }
});

// Error handling
bot.on('polling_error', (error) => {
    log('Telegram Bot Polling Error:');
    log(error.toString());
});

// Add more comprehensive error handling
process.on('unhandledRejection', (reason, promise) => {
    log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    log('Uncaught Exception:');
    log(error.toString());
    log(error.stack);
    
    // Optional: Restart the process
    process.exit(1);
});

log('Telegram Bot initialization complete.');
