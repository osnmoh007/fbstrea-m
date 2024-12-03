const express = require('express');
const { spawn } = require('child_process');
const app = express();
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const readline = require('readline');
const { createReadStream } = require('fs');
const { execSync } = require('child_process');
const YTDlpWrap = require('yt-dlp-wrap').default;
const ytDlp = new YTDlpWrap();
const session = require('express-session');

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: false, // set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Authentication middleware
const authenticateUser = (req, res, next) => {
    if (req.session && req.session.authenticated) {
        next();
    } else {
        res.redirect('/login.html');
    }
};

// Serve static files with authentication
app.use((req, res, next) => {
    // Allow access to login page and authentication endpoint
    if (req.path === '/login.html' || req.path === '/api/authenticate' || req.path.startsWith('/favicon')) {
        express.static('public')(req, res, next);
    } else {
        // Require authentication for all other routes
        authenticateUser(req, res, (err) => {
            if (err) return next(err);
            express.static('public')(req, res, next);
        });
    }
});

// Login endpoint
app.post('/api/authenticate', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        req.session.authenticated = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            res.status(500).json({ success: false, message: 'Error during logout' });
        } else {
            res.clearCookie('connect.sid');
            res.json({ success: true });
        }
    });
});

let ffmpegProcess = null;
let ffmpegStartTime = null;
let currentRtmpPlatform = null; // Add this to track current RTMP platform

// Clear messages.txt on server start
const messagesFilePath = path.join(__dirname, 'messages.txt');
fs.writeFileSync(messagesFilePath, ''); // Clear the file

// Function to escape paths for FFmpeg
function escapeFFmpegPath(filePath) {
    // Escape spaces and special characters
    return filePath.replace(/(["\s'$`\\])/g,'\\$1');
}

// Use a default password for local testing
const PASSWORD = process.env.STREAM_PASSWORD || 'password'; // Default for local testing

// Add this near the top with other constants
const isProduction = process.env.NODE_ENV === 'production' || process.env.FLY_APP_NAME;

// Add these near the top with other constants
const textStylesPath = path.join(__dirname, 'textStyles.json');

// Function to read text styles
function getTextStyles() {
    try {
        if (fs.existsSync(textStylesPath)) {
            const styles = JSON.parse(fs.readFileSync(textStylesPath, 'utf8'));
            return styles;
        }
    } catch (error) {
        log('Error reading text styles, using defaults');
    }
    return {
        fontSize: 70,
        textColor: '#ffffff',
        backgroundColor: '#000000',
        enableBackground: false,
        animation: 'bounce'
    };
}

// Function to extract platform name from RTMP URL
function extractPlatformFromUrl(url) {
    try {
        // Handle localhost/local IP cases
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
            return 'Local RTMP';
        }

        // Remove protocol (rtmp://, rtmps://)
        let domain = url.replace(/^rtmps?:\/\//, '');
        
        // Extract the domain (everything up to the first slash or end)
        domain = domain.split('/')[0];
        
        // Remove port number if present
        domain = domain.split(':')[0];
        
        // Extract the main domain part
        const parts = domain.split('.');
        if (parts.length >= 2) {
            // Get the main domain name (e.g., 'twitch' from 'live.twitch.tv')
            // or the subdomain if it's meaningful (e.g., 'live' from 'live.example.com')
            const mainPart = parts[parts.length - 2];
            // Capitalize first letter
            return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
        }
        
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (error) {
        console.error('Error extracting platform from URL:', error);
        return 'Unknown';
    }
}

app.post('/api/start-stream', authenticateUser, async (req, res) => {
    try {
        if (ffmpegProcess) {
            return res.status(400).json({ success: false, message: 'Stream is already running' });
        }

        const { rtmpUrl, streamKey, inputSource, isMP4Loop, enableZoom, zoomLevel, filterComplex, useMp3Audio, logoPath, logoPosition } = req.body;

        // Extract platform from RTMP URL
        currentRtmpPlatform = extractPlatformFromUrl(rtmpUrl);

        let ffmpegArgs = [];

        // Add MP3 audio input first if enabled
        if (useMp3Audio) {
            ffmpegArgs.push(
                '-hide_banner',
                '-stream_loop', '-1',
                '-i', path.join(__dirname, 'media', 'sound.mp3')
            );
        }

        if (isMP4Loop && Array.isArray(inputSource)) {
            // Handle multiple video inputs
            const videoList = inputSource.map(video => path.join(__dirname, 'videos', video));

            // Create a concat file for FFmpeg - repeat the list multiple times for longer looping
            const concatFilePath = path.join(__dirname, 'concat.txt');
            const videoEntries = videoList.map(video => `file '${video}'`);
            // Repeat the list 10 times to create a longer sequence
            const concatContent = Array(10).fill(videoEntries).flat().join('\n');
            fs.writeFileSync(concatFilePath, concatContent);

            ffmpegArgs.push(
                '-f', 'concat',
                '-safe', '0',
                '-stream_loop', '-1',  // Add infinite loop for the entire concat
                '-i', concatFilePath
            );
        } else {
            // Handle single input source
            ffmpegArgs.push(
                '-stream_loop', '-1',  // Add infinite loop for single input
                '-i', inputSource
            );
        }

        // Clear server.log file
        const logFile = path.join(__dirname, 'logs', 'server.log');
        if (fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, ''); // Clear the file
            log('Server log cleared for new stream');
        }

        // Clear any existing messages before starting the stream
        try {
            fs.writeFileSync(messagesFilePath, '', { encoding: 'utf8' });
            log('Cleared previous messages');
        } catch (error) {
            log('Error clearing messages file: ' + error.message);
        }

        // Validate input URLs
        if (!rtmpUrl || !streamKey || !inputSource) {
            log('Stream start failed: Missing required fields');
            return res.status(400).json({ success: false, message: 'RTMP URL, Stream Key, and Input Source are required.' });
        }

        // Stop any existing stream
        if (ffmpegProcess) {
            log('Stopping existing stream before starting new one');
            ffmpegProcess.kill();
        }

        // Construct the full RTMP URL
        const rtmpUrlWithoutTrailingSlash = rtmpUrl.replace(/\/+$/, '');
        const streamKeyWithoutSlash = streamKey.replace(/^\/+|\/+$/g, '');
        const streamKeyPattern = new RegExp(`/${streamKeyWithoutSlash}/?$`);
        const fullRtmpUrl = streamKeyPattern.test(rtmpUrlWithoutTrailingSlash)
            ? rtmpUrlWithoutTrailingSlash
            : `${rtmpUrlWithoutTrailingSlash}/${streamKeyWithoutSlash}`;

        log(`Starting stream to: ${fullRtmpUrl}`);

        // Prepare FFmpeg arguments
        ffmpegArgs = ffmpegArgs.concat(['-hide_banner']);

        // Initialize filter chain
        let filter = '';
        let lastLabel = 'scaled';
        let videoInputIndex = useMp3Audio ? 1 : 0;  // Video is always first input

        // 1. First scale to 1080p
        filter += `[${videoInputIndex}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[scaled]`;

        // 2. Apply zoom if enabled (before text and logo)
        if (enableZoom) {
            const zoomValue = zoomLevel || 1;
            filter += `;[${lastLabel}]split[toZoom][base];` +
                     `[toZoom]scale=1920*2:1080*2,zoompan=z='min(zoom+${zoomValue},2)':d=1:x='iw/4':y='ih/4',scale=1920:1080[zoomed];` +
                     `[base][zoomed]overlay=(W-w)/2:(H-h)/2[zoombase]`;
            lastLabel = 'zoombase';
        }

        // Get text styles
        const textStyles = getTextStyles();
        const textColor = textStyles.textColor || '#ffffff';
        const bgColor = textStyles.enableBackground ? textStyles.backgroundColor : null;
        const fontSize = textStyles.fontSize || 70;
        const animation = textStyles.animation || 'bounce';
        const boxborderw = textStyles.enableBackground ? 5 : 0;
        const box = textStyles.enableBackground ? '1' : '0';

        // Configure text filter based on animation type
        let xExpr, yExpr;

        switch (animation) {
            case 'slide-left': {
                const slideSpeed = 100;
                const bottomMargin = 20;
                xExpr = box === '1' 
                    ? `W-mod(t*${slideSpeed}\\,W+tw)`
                    : `W-mod(t*${slideSpeed}\\,W+tw)`;
                yExpr = box === '1' 
                    ? `H-th-${bottomMargin}-${boxborderw}`
                    : `H-th-${bottomMargin}`;
                break;
            }
            case 'slide-right': {
                const slideSpeed = 100;
                const bottomMargin = 20;
                xExpr = box === '1' 
                    ? `-tw+mod(t*${slideSpeed}\\,W+tw)`
                    : `-tw+mod(t*${slideSpeed}\\,W+tw)`;
                yExpr = box === '1' 
                    ? `H-th-${bottomMargin}-${boxborderw}`
                    : `H-th-${bottomMargin}`;
                break;
            }
            case 'bounce':
            default: {
                xExpr = box === '1'
                    ? `if(lte(mod(t*200\\,2*(W-tw-${2*boxborderw}))\\,W-tw-${2*boxborderw})\\,mod(t*200\\,W-tw-${2*boxborderw})+${boxborderw}\\,2*(W-tw-${2*boxborderw})-mod(t*200\\,2*(W-tw-${2*boxborderw}))+${boxborderw})`
                    : `if(lte(mod(t*200\\,2*(W-tw))\\,W-tw)\\,mod(t*200\\,W-tw)\\,2*(W-tw)-mod(t*200\\,2*(W-tw)))`;
                
                yExpr = box === '1'
                    ? `if(lte(mod(t*100\\,2*(H-th-${2*boxborderw}))\\,H-th-${2*boxborderw})\\,mod(t*100\\,H-th-${2*boxborderw})+${boxborderw}\\,2*(H-th-${2*boxborderw})-mod(t*100\\,2*(H-th-${2*boxborderw}))+${boxborderw})`
                    : `if(lte(mod(t*100\\,2*(H-th))\\,H-th)\\,mod(t*100\\,H-th)\\,2*(H-th)-mod(t*100\\,2*(H-th)))`;
                break;
            }
        }

        // Build text filter
        const textFilter = `drawtext=textfile='${escapeFFmpegPath(messagesFilePath)}':` 
            + `fontfile='${escapeFFmpegPath(findSystemFont())}':fontsize=${fontSize}:fontcolor=${textColor}:reload=1`
            + (bgColor ? `:box=1:boxcolor=${bgColor}:boxborderw=${boxborderw}` : '')
            + `:x='${xExpr}':y='${yExpr}'`;

        // Add text overlay to filter chain
        filter += `;[${lastLabel}]${textFilter}[withtext]`;
        lastLabel = 'withtext';

        // 4. Apply blur if enabled
        if (filterComplex) {
            const match = filterComplex.match(/crop=w=(\d+):h=(\d+):x=(\d+):y=(\d+)/);
            if (match) {
                const [_, width, height, x, y] = match;
                filter += `;[${lastLabel}]split[main][for_blur];` +
                         `[for_blur]crop=w=${width}:h=${height}:x=${x}:y=${y},boxblur=20:3[blurred];` +
                         `[main][blurred]overlay=x=${x}:y=${y}[blurred_out]`;
                lastLabel = 'blurred_out';
            }
        }

        // 5. Add logo if enabled
        if (logoPath && fs.existsSync(logoPath)) {
            ffmpegArgs.push('-i', logoPath);
            const logoInputIndex = videoInputIndex + 1;
            filter += `;[${logoInputIndex}:v]scale=iw*min(1920*0.15/iw\\,1080*0.15/ih):ih*min(1920*0.15/iw\\,1080*0.15/ih)[scaledlogo];`
                + `[${lastLabel}][scaledlogo]overlay=`
                + (logoPosition === 'top-left' ? '20:20' :
                   logoPosition === 'top-right' ? 'min(W-w-20\\,1900):20' :
                   logoPosition === 'bottom-left' ? '20:min(H-h-20\\,1060)' :
                   'min(W-w-20\\,1900):min(H-h-20\\,1060)') // default to bottom-right
                + '[v]';
        } else {
            filter += `;[${lastLabel}]null[v]`;
        }

        // Add the complete filter complex
        ffmpegArgs.push('-filter_complex', filter);

        // Update the audio mapping
        if (useMp3Audio) {
            ffmpegArgs.push(
                '-map', '[v]',      // Video from filter chain
                '-map', '0:a:0'     // First audio stream from MP3 input (which is input 0)
            );
        } else {
            // Select only the first audio stream from the video input
            ffmpegArgs.push(
                '-map', '[v]',      // Video from filter chain
                '-map', '0:a:0?'    // First audio stream from video input (optional)
            );
        }

        // Add encoding settings with updated audio settings
        ffmpegArgs.push(
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-g', '60',
            '-b:v', '4000k',
            '-maxrate', '4500k',
            '-bufsize', '8000k',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',         // Audio codec
            '-b:a', '128k',        // Audio bitrate
            '-ac', '2',            // 2 audio channels
            '-ar', '44100',        // Audio sample rate
            '-filter:a', 'aresample=44100',  // Ensure consistent audio sampling
            '-strict', 'experimental',       // Allow experimental codecs
            '-f', 'flv',           // Output format
            fullRtmpUrl
        );

        // Log the command for debugging
        log('FFmpeg command: ffmpeg ' + ffmpegArgs.join(' '));

        ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
        ffmpegStartTime = new Date();

        ffmpegProcess.stdout.on('data', (data) => {
            log(`FFmpeg stdout: ${data}`);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            const message = data.toString();
            log(`FFmpeg stderr: ${message}`);
            if (message.includes('drawtext')) {
                log(`Drawtext error: ${message}`);
            }
            if (message.includes('drawtext') || message.includes('text') || message.includes('font')) {
                log(`Font/Text related message: ${message}`);
            }
        });

        ffmpegProcess.on('close', (code) => {
            log(`FFmpeg process exited with code ${code}`);
            ffmpegProcess = null;
        });

        log('Streaming started successfully');
        res.json({ message: 'Streaming started successfully' });
    } catch (error) {
        console.error('Error starting stream:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/stop-stream', authenticateUser, (req, res) => {
    try {
        if (!ffmpegProcess) {
            return res.status(400).json({ success: false, message: 'No stream is currently running' });
        }

        ffmpegProcess.kill();
        ffmpegProcess = null;
        ffmpegStartTime = null;
        currentRtmpPlatform = null;

        log('Stream stopped successfully');
        res.json({ success: true, message: 'Stream stopped successfully' });
    } catch (error) {
        handleError(error);
        res.status(500).json({ success: false, message: 'Error stopping stream: ' + error.message });
    }
});

app.get('/api/stream-status', authenticateUser, (req, res) => {
    res.json({ isStreaming: ffmpegProcess !== null });
});

app.post('/api/send-message', authenticateUser, (req, res) => {
    const { message } = req.body;
    if (ffmpegProcess) {
        try {
            const timestamp = new Date().toISOString();
            log(`[${timestamp}] Writing message to file: ${message}`);

            // Create a temporary file with a unique name
            const tempFile = `${messagesFilePath}.${Date.now()}.tmp`;

            // Write just the message to the file
            fs.writeFileSync(tempFile, message + '\n', { encoding: 'utf8', flag: 'w' });

            // Atomically rename the temp file to the target file
            fs.renameSync(tempFile, messagesFilePath);

            res.json({ success: true });
        } catch (error) {
            handleError(error);
            res.status(500).json({ success: false, message: error.message });
        }
    } else {
        res.status(400).json({ success: false, message: 'Stream is not running' });
    }
});

app.post('/api/clear-messages', authenticateUser, (req, res) => {
    try {
        log('Clearing messages');
        // Create temp file first
        const tempFile = `${messagesFilePath}.${Date.now()}.tmp`;
        fs.writeFileSync(tempFile, '', { encoding: 'utf8', flag: 'w' });
        fs.fsyncSync(fs.openSync(tempFile, 'r+'));
        fs.renameSync(tempFile, messagesFilePath);
        const dir = path.dirname(messagesFilePath);
        fs.fsyncSync(fs.openSync(dir, 'r'));
        log('Messages cleared successfully');
        res.json({ success: true, message: 'Messages cleared' });
    } catch (error) {
        log(`Error clearing messages: ${error.message}`);
        res.status(500).json({ success: false, message: 'Error clearing messages' });
    }
});

app.get('/api/check-messages', authenticateUser, (req, res) => {
    const isEmpty = fs.readFileSync(messagesFilePath, 'utf8').trim() === '';
    res.json({ isEmpty });
});

// Redirect root URL to login page
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.listen(3000, () => {
    log('Server started on port 3000');
});

app.get('/api/logs', authenticateUser, (req, res) => {
    try {
        // Create a logs directory if it doesn't exist
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)){
            fs.mkdirSync(logsDir);
        }

        // Path to the log file
        const logFile = path.join(logsDir, 'server.log');

        // Create the file if it doesn't exist
        if (!fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, '');
        }

        // Read the last 1000 lines of the log file
        const logs = fs.readFileSync(logFile, 'utf8');
        const lines = logs.split('\n').slice(-1000).join('\n');

        res.type('text/plain').send(lines);
    } catch (error) {
        console.error('Error reading logs:', error);
        res.status(500).send('Error reading logs');
    }
});

// Add this new endpoint to clear logs
app.post('/api/clear-logs', authenticateUser, (req, res) => {
    try {
        const logsDir = path.join(__dirname, 'logs');
        const logFile = path.join(logsDir, 'server.log');

        // Create directory if it doesn't exist
        if (!fs.existsSync(logsDir)){
            fs.mkdirSync(logsDir);
        }

        // Clear the log file
        fs.writeFileSync(logFile, '');
        log('Logs cleared successfully');
        res.json({ success: true, message: 'Logs cleared' });
    } catch (error) {
        console.error('Error clearing logs:', error);
        res.status(500).json({ success: false, message: 'Error clearing logs' });
    }
});

// Add this route before your other routes
app.get('/api/environment', authenticateUser, (req, res) => {
    res.json({
        isProduction: isProduction
    });
});

// Modify your existing logging to write to the log file
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;

    // Log to console
    console.log(message);

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)){
        fs.mkdirSync(logsDir);
    }

    // Log to file
    const logFile = path.join(logsDir, 'server.log');
    fs.appendFileSync(logFile, logMessage);
}

// Update your error logging
function handleError(error) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ERROR: ${error.message}\n`;

    // Log to console
    console.error('Error:', error);

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)){
        fs.mkdirSync(logsDir);
    }

    // Log to file
    const logFile = path.join(logsDir, 'server.log');
    fs.appendFileSync(logFile, errorMessage);
}

let lastCPUInfo = null;
let lastCPUTotalTimes = null;

// Function to get CPU usage for macOS
function getMacCPUUsage() {
    const command = 'ps -A -o %cpu | awk \'{s+=$1} END {print s}\'';
    try {
        const cpuUsage = parseFloat(execSync(command).toString());
        return Math.min(100, Math.max(0, cpuUsage));
    } catch (error) {
        console.error('Error getting CPU usage:', error);
        return 0;
    }
}

// Function to get Linux-specific memory info
function getLinuxMemoryInfo() {
    try {
        const memInfoContent = fs.readFileSync('/proc/meminfo', 'utf8');
        const memInfo = {};
        memInfoContent.split('\n').forEach(line => {
            const [key, value] = line.split(':');
            if (key && value) {
                // Extract the numeric value and convert to KB
                const numericValue = parseInt(value.replace(/[^0-9]/g, ''));
                memInfo[key.trim()] = numericValue;
            }
        });

        // Calculate memory usage following the same formula as htop
        const total = memInfo.MemTotal;
        const free = memInfo.MemFree;
        const buffers = memInfo.Buffers || 0;
        const cached = memInfo.Cached || 0;
        const sReclaimable = memInfo.SReclaimable || 0;
        const shmem = memInfo.Shmem || 0;

        // Used memory calculation (same as htop)
        const used = total - free - buffers - cached - sReclaimable + shmem;

        return {
            total,
            used,
            percentage: ((used / total) * 100).toFixed(1)
        };
    } catch (error) {
        console.error('Error reading Linux memory info:', error);
        return null;
    }
}

app.get('/api/system-stats', authenticateUser, (req, res) => {
    try {
        let cpuUsage;
        let memoryStats;

        if (process.platform === 'darwin') { // macOS
            cpuUsage = getMacCPUUsage();
            
            // Get macOS memory info using vm_stat command
            try {
                const vmStatOutput = execSync('vm_stat').toString();
                const pageSize = 4096; // Default page size on macOS
                
                // Parse vm_stat output
                const matches = {
                    free: vmStatOutput.match(/Pages free:\s+(\d+)/),
                    active: vmStatOutput.match(/Pages active:\s+(\d+)/),
                    inactive: vmStatOutput.match(/Pages inactive:\s+(\d+)/),
                    speculative: vmStatOutput.match(/Pages speculative:\s+(\d+)/),
                    wired: vmStatOutput.match(/Pages wired down:\s+(\d+)/),
                    compressed: vmStatOutput.match(/Pages occupied by compressor:\s+(\d+)/)
                };
                
                const stats = {};
                for (const [key, match] of Object.entries(matches)) {
                    stats[key] = match ? parseInt(match[1]) * pageSize : 0;
                }
                
                const totalMemory = os.totalmem();
                const usedMemory = stats.wired + stats.active + stats.inactive + stats.compressed;
                const freeMemory = stats.free * pageSize;
                const actualUsed = totalMemory - freeMemory;
                
                memoryStats = {
                    total: totalMemory,
                    used: actualUsed,
                    percentage: ((actualUsed / totalMemory) * 100).toFixed(1)
                };
            } catch (error) {
                console.error('Error getting macOS memory stats:', error);
                // Fallback to basic memory calculation
                const totalMemory = os.totalmem();
                const freeMemory = os.freemem();
                memoryStats = {
                    total: totalMemory,
                    used: totalMemory - freeMemory,
                    percentage: (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(1)
                };
            }
        } else { // Linux and other platforms
            // CPU calculation
            const cpus = os.cpus();
            const currentCPUInfo = {
                idle: 0,
                total: 0
            };

            for (const cpu of cpus) {
                for (const type in cpu.times) {
                    if (type === 'idle') {
                        currentCPUInfo.idle += cpu.times[type];
                    }
                    currentCPUInfo.total += cpu.times[type];
                }
            }

            if (lastCPUInfo) {
                const idleDiff = currentCPUInfo.idle - lastCPUInfo.idle;
                const totalDiff = currentCPUInfo.total - lastCPUInfo.total;
                cpuUsage = 100 - Math.floor(100 * idleDiff / totalDiff);
            } else {
                cpuUsage = 0;
            }

            lastCPUInfo = currentCPUInfo;

            // Try to get Linux-specific memory info first
            memoryStats = getLinuxMemoryInfo();
            if (!memoryStats) {
                // Fallback to standard memory calculation
                const totalMemory = os.totalmem();
                const freeMemory = os.freemem();
                memoryStats = {
                    total: totalMemory,
                    used: totalMemory - freeMemory,
                    percentage: (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(1)
                };
            }
        }

        // Get FFmpeg process memory if running
        let ffmpegMemory = 0;
        if (ffmpegProcess) {
            try {
                const pid = ffmpegProcess.pid;
                if (process.platform === 'linux') {
                    // On Linux, read from /proc/[pid]/status
                    const statusContent = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
                    const vmRssMatch = statusContent.match(/VmRSS:\s+(\d+)/);
                    if (vmRssMatch) {
                        ffmpegMemory = parseInt(vmRssMatch[1]); // Keep in KB
                    }
                } else if (process.platform === 'darwin') {
                    const command = `ps -o rss= -p ${pid}`;
                    const output = execSync(command).toString();
                    ffmpegMemory = parseInt(output); // Keep in KB
                } else {
                    ffmpegMemory = process.memoryUsage().heapUsed / 1024; // Convert bytes to KB
                }
            } catch (error) {
                console.error('Error getting FFmpeg memory:', error);
            }
        }

        res.json({
            cpu: Math.min(100, Math.max(0, cpuUsage)),
            memory: memoryStats.percentage,
            totalMemory: (memoryStats.total / (1024 * 1024 * 1024)).toFixed(1), // Convert bytes to GB
            usedMemory: (memoryStats.used / (1024 * 1024 * 1024)).toFixed(1),   // Convert bytes to GB
            freeMemory: ((memoryStats.total - memoryStats.used) / (1024 * 1024 * 1024)).toFixed(1), // Free memory in GB
            ffmpegMemory: ffmpegMemory ? (ffmpegMemory / 1024).toFixed(1) : '0' // Convert KB to MB
        });
    } catch (error) {
        handleError(error);
        res.status(500).json({ error: 'Error fetching system stats' });
    }
});

app.post('/api/upload-logo', authenticateUser, upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No logo uploaded' });
        }

        const logoPosition = req.body.logoPosition || 'bottom-right';
        const originalName = req.file.originalname;
        const extension = path.extname(originalName);
        const logoFileName = `logo_${Date.now()}${extension}`;
        const logoPath = path.join(__dirname, 'uploads', logoFileName);

        // Move the uploaded file to the uploads directory using copy instead of rename
        fs.copyFileSync(req.file.path, logoPath);
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            logoPath: logoPath,
            logoPosition: logoPosition
        });
    } catch (error) {
        console.error('Logo upload error:', error);
        res.status(500).json({ success: false, message: 'Logo upload failed' });
    }
});

app.post('/api/parse-m3u', authenticateUser, upload.single('m3uFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
        const channels = [];
        const fileStream = createReadStream(req.file.path);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let currentChannel = null;

        for await (const line of rl) {
            if (line.startsWith('#EXTINF:')) {
                // Extract channel name from EXTINF line
                const nameMatch = line.match(/,(.+)$/);
                if (nameMatch) {
                    currentChannel = {
                        name: nameMatch[1].trim()
                    };
                }
            } else if (line.trim() && !line.startsWith('#') && currentChannel) {
                // This is a URL line
                currentChannel.url = line.trim();
                channels.push(currentChannel);
                currentChannel = null;
            }
        }

        // Clean up the uploaded file
        fs.unlinkSync(req.file.path);

        res.json(channels);
    } catch (error) {
        console.error('Error parsing M3U file:', error);
        res.status(500).json({ success: false, message: 'Error parsing M3U file' });
    }
});

app.get('/api/debug-messages', authenticateUser, (req, res) => {
    try {
        const exists = fs.existsSync(messagesFilePath);
        const content = exists ? fs.readFileSync(messagesFilePath, 'utf8') : null;
        const stats = exists ? fs.statSync(messagesFilePath) : null;

        res.json({
            exists,
            filePath: messagesFilePath,
            content,
            stats: stats ? {
                size: stats.size,
                permissions: stats.mode,
                modified: stats.mtime
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function findSystemFont() {
    try {
        let fontPath;
        if (process.platform === 'darwin') { // macOS
            fontPath = '/System/Library/Fonts/Helvetica.ttc';
        } else if (process.platform === 'linux') {
            // Try to find a suitable font on Linux
            const fonts = [
                '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                '/usr/share/fonts/TTF/Arial.ttf',
                '/usr/share/fonts/liberation/LiberationSans-Regular.ttf'
            ];
            for (const font of fonts) {
                if (fs.existsSync(font)) {
                    fontPath = font;
                    break;
                }
            }
        } else if (process.platform === 'win32') { // Windows
            fontPath = 'C:\\Windows\\Fonts\\arial.ttf';
        }

        if (!fontPath || !fs.existsSync(fontPath)) {
            throw new Error('No suitable font found');
        }

        log(`Using font: ${fontPath}`);
        return fontPath;
    } catch (error) {
        log(`Error finding system font: ${error.message}`);
        return null;
    }
}

// Add this new endpoint to get available videos
app.get('/api/videos', authenticateUser, (req, res) => {
    try {
        const videosDir = path.join(__dirname, 'videos');

        // Create videos directory if it doesn't exist
        if (!fs.existsSync(videosDir)) {
            fs.mkdirSync(videosDir, { recursive: true });
        }

        // Get all MP4 files in the videos directory
        const videos = fs.readdirSync(videosDir)
            .filter(file => file.toLowerCase().endsWith('.mp4'))
            .sort((a, b) => {
                const statA = fs.statSync(path.join(videosDir, a));
                const statB = fs.statSync(path.join(videosDir, b));
                return statB.mtime.getTime() - statA.mtime.getTime(); // Sort by newest first
            });

        res.json({ success: true, videos });
    } catch (error) {
        console.error('Error getting videos:', error);
        res.status(500).json({ success: false, message: 'Error getting videos' });
    }
});

// Add this endpoint to delete videos
app.delete('/api/videos/:filename', authenticateUser, (req, res) => {
    try {
        const filename = req.params.filename;
        const videoPath = path.join(__dirname, 'videos', filename);

        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ success: false, message: 'Video not found' });
        }

        fs.unlinkSync(videoPath);
        res.json({ success: true, message: 'Video deleted successfully' });
    } catch (error) {
        console.error('Error deleting video:', error);
        res.status(500).json({ success: false, message: 'Error deleting video' });
    }
});

// Add video upload endpoint
app.post('/api/upload-video', authenticateUser, upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
        // Create videos directory if it doesn't exist
        const videosDir = path.join(__dirname, 'videos');
        if (!fs.existsSync(videosDir)) {
            fs.mkdirSync(videosDir);
        }

        // Move file to videos directory
        const fileExt = path.extname(req.file.originalname);
        const finalPath = path.join(videosDir, req.file.originalname);
        fs.copyFileSync(req.file.path, finalPath);
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            message: 'Video uploaded successfully',
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('Error uploading video:', error);
        res.status(500).json({ success: false, message: 'Error uploading video' });
    }
});

// Add this new endpoint for deleting videos
app.delete('/api/videos/:filename', authenticateUser, (req, res) => {
    try {
        const filename = req.params.filename;
        const videoPath = path.join(__dirname, 'videos', filename);

        // Check if file exists
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Delete the file
        fs.unlinkSync(videoPath);

        log(`Video deleted successfully: ${filename}`);
        res.json({
            success: true,
            message: 'Video deleted successfully'
        });
    } catch (error) {
        handleError(error);
        res.status(500).json({
            success: false,
            message: 'Error deleting video'
        });
    }
});

// Store active downloads
const activeDownloads = new Map();

// YouTube downloader endpoints
app.post('/api/get-video-info', authenticateUser, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        const videoInfo = await ytDlp.getVideoInfo(url);
        res.json({
            success: true,
            info: {
                title: videoInfo.title,
                duration: videoInfo.duration,
                channel: videoInfo.channel,
                formats: videoInfo.formats.map(format => ({
                    formatId: format.format_id,
                    ext: format.ext,
                    resolution: format.resolution,
                    filesize: format.filesize,
                    acodec: format.acodec,
                    vcodec: format.vcodec
                }))
            }
        });
    } catch (error) {
        console.error('Error getting video info:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/download', authenticateUser, async (req, res) => {
    try {
        const { url, format = 'mp4-1080', includeSubtitles } = req.body;
        console.log('Download request:', { url, format, includeSubtitles });

        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        // Generate a unique download ID
        const downloadId = Date.now().toString();

        // Change downloads directory to videos
        const videosDir = path.join(__dirname, 'videos');

        // Create videos directory if it doesn't exist
        if (!fs.existsSync(videosDir)) {
            fs.mkdirSync(videosDir, { recursive: true });
        }

        // Generate a unique filename
        const outputTemplate = path.join(videosDir, `%(title)s.%(ext)s`);

        // Prepare download options
        const options = [
            '--no-playlist',
            '--progress',
            '--newline',
            '--print-json',  // Print all information as JSON
            '-o', outputTemplate
        ];

        // Handle different format types
        if (format.startsWith('mp3')) {
            const bitrate = format.split('-')[1];
            options.push(
                '-x',
                '--audio-format', 'mp3',
                '--audio-quality', bitrate
            );
        } else if (format.startsWith('mp4')) {
            const quality = format.split('-')[1];
            if (quality === '1080p') {
                options.push(
                    '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                    '--merge-output-format', 'mp4'
                );
            } else {
                options.push(
                    '-f', `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]`,
                    '--merge-output-format', 'mp4'
                );
            }
        }

        if (includeSubtitles) {
            options.push('--write-sub', '--sub-lang', 'en');
        }

        console.log('Download options:', options);

        // Create download state object
        const downloadState = {
            progress: 0,
            status: 'starting',
            error: null,
            outputFile: '',
            clients: new Set(),
            downloadDir: videosDir,
            timestamp: Date.now()
        };

        activeDownloads.set(downloadId, downloadState);

        // Start download process
        const download = ytDlp.exec([url, ...options]);

        // Track download stages
        let isDownloading = false;
        let isConverting = false;

        download.on('stdout', (output) => {
            const line = output.toString().trim();
            console.log('yt-dlp output:', line);  // Log all output

            const state = activeDownloads.get(downloadId);
            if (!state) return;

            try {
                // Try to parse JSON output
                if (line.startsWith('{')) {
                    const info = JSON.parse(line);
                    if (info.requested_downloads) {
                        const download = info.requested_downloads[0];
                        if (download && download.filepath) {
                            state.outputFile = download.filepath;
                            console.log('Found output file from JSON:', state.outputFile);
                        }
                    } else if (info.filepath) {
                        state.outputFile = info.filepath;
                        console.log('Found output file from JSON:', state.outputFile);
                    }
                }
            } catch (e) {
                // Not JSON output, continue with normal parsing
            }

            // Look for the final output file path in normal output
            if (line.startsWith('[MovingFiles]')) {
                console.log('Found MovingFiles line:', line);
                const filepathMatch = line.match(/Moving file (.+?) to (.+)/);
                if (filepathMatch) {
                    state.outputFile = filepathMatch[2];
                    console.log('Set output file from MovingFiles:', state.outputFile);
                }
            } else if (line.startsWith('[download]') && line.includes('Destination:')) {
                console.log('Found Destination line:', line);
                const filepathMatch = line.match(/Destination:\s+(.+)/);
                if (filepathMatch) {
                    state.outputFile = filepathMatch[1];
                    console.log('Set output file from Destination:', state.outputFile);
                }
            }

            // Parse download progress
            const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/);
            if (progressMatch && isDownloading) {
                const progress = parseFloat(progressMatch[1]);
                state.progress = progress;

                // Notify all clients
                const message = JSON.stringify({ 
                    type: 'progress', 
                    percentage: progress, 
                    status: 'Downloading video' 
                });
                state.clients.forEach(client => {
                    safeWrite(client, `data: ${message}\n\n`);
                });
            }

            // Detect conversion start
            if (line.includes('[Merger] Merging formats')) {
                isDownloading = false;
                isConverting = true;
                const message = JSON.stringify({ 
                    type: 'progress', 
                    percentage: 90, 
                    status: 'Merging video formats' 
                });
                state.clients.forEach(client => {
                    safeWrite(client, `data: ${message}\n\n`);
                });
            }
        });

        download.on('close', () => {
            const state = activeDownloads.get(downloadId);
            if (state) {
                console.log('Download process closed. Current state:', {
                    outputFile: state.outputFile,
                    exists: state.outputFile ? fs.existsSync(state.outputFile) : false,
                    downloadDir: state.downloadDir
                });

                // If we still don't have the output file, try to find it in the videos directory
                if (!state.outputFile || !fs.existsSync(state.outputFile)) {
                    try {
                        // Get the most recently created file in the videos directory
                        const files = fs.readdirSync(videosDir)
                            .filter(file => !file.startsWith('.'))
                            .map(file => ({
                                name: file,
                                path: path.join(videosDir, file),
                                ctime: fs.statSync(path.join(videosDir, file)).ctime
                            }))
                            .sort((a, b) => b.ctime - a.ctime);

                        if (files.length > 0) {
                            const newestFile = files[0];
                            // Only use this file if it was created in the last minute
                            if (Date.now() - newestFile.ctime < 60000) {
                                state.outputFile = newestFile.path;
                                console.log('Found recent output file:', state.outputFile);
                            }
                        }
                    } catch (error) {
                        console.error('Error finding output file:', error);
                    }
                }

                // Only proceed if we have a valid output file
                if (state.outputFile && fs.existsSync(state.outputFile)) {
                    const filename = path.basename(state.outputFile);
                    // Set the file's modification time to the current time
                    const currentTime = new Date();
                    fs.utimesSync(state.outputFile, currentTime, currentTime);
                    console.log('Download completed successfully:', {
                        filename,
                        path: state.outputFile,
                        modifiedTime: currentTime
                    });
                    const message = JSON.stringify({ 
                        type: 'complete', 
                        filename, 
                        status: 'Download complete' 
                    });
                    state.clients.forEach(client => {
                        safeWrite(client, `data: ${message}\n\n`);
                        try {
                            client.end();
                        } catch (error) {
                            console.error('Error ending client connection:', error);
                        }
                    });
                } else {
                    console.error('Download completed but output file not found or invalid');
                    const message = JSON.stringify({ 
                        type: 'error', 
                        message: 'Output file not found or invalid',
                        status: 'Download failed' 
                    });
                    state.clients.forEach(client => {
                        safeWrite(client, `data: ${message}\n\n`);
                        try {
                            client.end();
                        } catch (error) {
                            console.error('Error ending client connection:', error);
                        }
                    });
                }
            }
        });

        download.on('error', (error) => {
            console.error('Download error:', error);
            const state = activeDownloads.get(downloadId);
            if (state) {
                state.error = error.message;
                state.status = 'error';
                const message = JSON.stringify({ 
                    type: 'error', 
                    message: error.message,
                    status: 'Download failed' 
                });
                state.clients.forEach(client => {
                    safeWrite(client, `data: ${message}\n\n`);
                    try {
                        client.end();
                    } catch (error) {
                        console.error('Error ending client connection:', error);
                    }
                });
            }
        });

        res.json({
            success: true,
            downloadId: downloadId
        });

    } catch (error) {
        console.error('Error starting download:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// SSE endpoint for progress updates
app.get('/api/download-progress/:downloadId', authenticateUser, (req, res) => {
    const { downloadId } = req.params;
    const state = activeDownloads.get(downloadId);

    if (!state) {
        return res.status(404).json({ success: false, message: 'Download not found' });
    }

    // Set up SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // Send initial progress
    const initialMessage = JSON.stringify({
        type: 'progress',
        percentage: state.progress
    });
    res.write(`data: ${initialMessage}\n\n`);

    // Add this client to the state's clients set
    state.clients.add(res);

    // Handle client disconnect
    req.on('close', () => {
        state.clients.delete(res);
        if (state.clients.size === 0 && state.status === 'complete') {
            activeDownloads.delete(downloadId);
        }
    });
});

function safeWrite(stream, data) {
    try {
        stream.write(data);
    } catch (error) {
        console.error('Error writing to stream:', error);
    }
}

// Check authentication status endpoint
app.get('/api/check-auth', (req, res) => {
    if (req.session && req.session.authenticated) {
        res.status(200).json({ authenticated: true });
    } else {
        res.status(401).redirect('/login.html');
    }
});

// Endpoint to update text styles
app.post('/api/update-text-styles', authenticateUser, (req, res) => {
    try {
        const newTextStyles = req.body;

        // Log incoming styles
        console.log('Received text styles update:', newTextStyles);
        log(`Received text styles update: ${JSON.stringify(newTextStyles)}`);

        // Validate input
        const validAnimations = ['bounce', 'slide-left', 'slide-right'];
        if (newTextStyles.animation && !validAnimations.includes(newTextStyles.animation)) {
            console.error('Invalid animation type:', newTextStyles.animation);
            return res.status(400).json({ error: 'Invalid animation type' });
        }

        // Read current text styles
        const currentTextStyles = getTextStyles();
        console.log('Current text styles:', currentTextStyles);

        // Merge new styles with current styles
        const updatedTextStyles = {
            ...currentTextStyles,
            ...newTextStyles
        };

        console.log('Updated text styles:', updatedTextStyles);

        // Write updated styles to file
        fs.writeFileSync(
            path.join(__dirname, 'textStyles.json'),
            JSON.stringify(updatedTextStyles, null, 4)
        );

        // Log the update
        log(`Text styles updated: ${JSON.stringify(updatedTextStyles)}`);

        res.json({
            message: 'Text styles updated successfully',
            textStyles: updatedTextStyles
        });
    } catch (error) {
        console.error('Error updating text styles:', error);
        handleError(error);
        res.status(500).json({ error: 'Failed to update text styles' });
    }
});

app.get('/api/text-styles', authenticateUser, (req, res) => {
    try {
        const styles = getTextStyles();
        res.json(styles);
    } catch (error) {
        handleError(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Serve MP4 files
app.get('/videos/:filename', authenticateUser, (req, res) => {
    const filename = req.params.filename;
    const videoPath = path.join(__dirname, 'videos', filename);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ success: false, message: 'Video not found' });
    }

    // Stream the video file
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize-1;
        const chunksize = (end-start)+1;
        const file = fs.createReadStream(videoPath, {start, end});
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

// Media Library Management API
app.get('/api/media/list', (req, res) => {
    const videosDir = path.join(__dirname, 'videos');
    fs.readdir(videosDir, async (err, items) => {
        if (err) {
            console.error('Error reading videos directory:', err);
            return res.status(500).json({ error: 'Failed to read videos directory' });
        }

        try {
            const fileStats = await Promise.all(
                items
                    // Filter out .DS_Store and hidden files
                    .filter(item => !item.startsWith('.'))
                    .map(async item => {
                        const filePath = path.join(videosDir, item);
                        const stats = await fs.promises.stat(filePath);
                        return { item, stats, isFile: stats.isFile() };
                    })
            );

            // Filter out directories and only include files
            const files = fileStats
                .filter(file => file.isFile)
                .map(file => ({
                    name: file.item,
                    displayName: getDisplayName(file.item),
                    size: file.stats.size,
                    created: file.stats.birthtime,
                    modified: file.stats.mtime,
                    path: `/videos/${file.item}`
                }));

            res.json(files);
        } catch (error) {
            console.error('Error getting file details:', error);
            res.status(500).json({ error: 'Failed to get file details' });
        }
    });
});

app.delete('/api/media/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'videos', filename);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting file:', err);
            return res.status(500).json({ error: 'Failed to delete file' });
        }
        res.json({ message: 'File deleted successfully' });
    });
});

app.get('/api/media/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'videos', filename);
    res.download(filePath);
});

// Rename file endpoint
app.post('/api/media/rename', (req, res) => {
    const { oldName, newName } = req.body;
    if (!oldName || !newName) {
        return res.status(400).json({ error: 'Both old and new filenames are required' });
    }

    const videosDir = path.join(__dirname, 'videos');
    const oldPath = path.join(videosDir, oldName);
    
    // Preserve the timestamp prefix if it exists
    const timestampPrefix = oldName.match(/^(\d+_)/)?.[1] || '';
    const newNameWithPrefix = timestampPrefix + newName;
    const newPath = path.join(videosDir, newNameWithPrefix);

    // Check if source file exists
    if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: 'Source file not found' });
    }

    // Check if destination file already exists
    if (fs.existsSync(newPath)) {
        return res.status(409).json({ error: 'A file with that name already exists' });
    }

    fs.rename(oldPath, newPath, (err) => {
        if (err) {
            console.error('Error renaming file:', err);
            return res.status(500).json({ error: 'Failed to rename file' });
        }
        res.json({ success: true, message: 'File renamed successfully' });
    });
});

function getDisplayName(filename) {
    // Remove timestamp prefix if it exists (e.g., "1732653496464_")
    const match = filename.match(/^\d+_(.+)$/);
    return match ? match[1] : filename;
}

// Add this endpoint to check streaming status
app.get('/api/streaming-status', authenticateUser, (req, res) => {
    try {
        console.log('Streaming status check:', {
            ffmpegProcess: ffmpegProcess ? 'Running' : 'Not Running',
            startTime: ffmpegStartTime,
            rtmpPlatform: currentRtmpPlatform
        });

        // Check if ffmpegProcess is running
        const isStreaming = ffmpegProcess !== null;
        
        res.json({ 
            isStreaming: isStreaming,
            streamInfo: isStreaming ? {
                startTime: ffmpegStartTime,
                rtmpPlatform: currentRtmpPlatform || 'Unknown' // Include RTMP platform in response
            } : null
        });
    } catch (error) {
        console.error('Error checking streaming status:', error);
        res.status(500).json({ isStreaming: false, error: error.message });
    }
});

// Telegram Bot Management
let telegramBotProcess = null;

// Middleware to log and handle potential errors
function handleTelegramBotError(res, error, action) {
    const errorMessage = `Error ${action} Telegram bot: ${error.message}`;
    log(errorMessage);
    console.error(errorMessage, error);
    res.status(500).json({ 
        success: false, 
        message: errorMessage,
        error: error.toString() 
    });
}

// Endpoint to start Telegram bot
app.post('/api/telegram-bot/start', authenticateUser, (req, res) => {
    try {
        // If bot is already running, return error
        if (telegramBotProcess) {
            return res.status(400).json({ 
                success: false, 
                message: 'Telegram bot is already running' 
            });
        }

        // Spawn the Telegram bot process
        telegramBotProcess = spawn('node', ['telegram_bot.js'], {
            detached: true,
            stdio: 'ignore'
        });

        telegramBotProcess.unref(); // Allow the process to run independently

        // Add error handling for the spawned process
        telegramBotProcess.on('error', (err) => {
            log(`Telegram bot process error: ${err.message}`);
            telegramBotProcess = null;
        });

        log('Telegram bot started');
        res.json({ success: true, message: 'Telegram bot started successfully' });
    } catch (error) {
        handleTelegramBotError(res, error, 'starting');
    }
});

// Endpoint to stop Telegram bot
app.post('/api/telegram-bot/stop', authenticateUser, (req, res) => {
    try {
        // If no bot process is running, return error
        if (!telegramBotProcess) {
            return res.status(400).json({ 
                success: false, 
                message: 'Telegram bot is not running' 
            });
        }

        // Try to kill the process
        try {
            process.kill(-telegramBotProcess.pid, 'SIGTERM');
        } catch (killError) {
            log(`Error killing Telegram bot process: ${killError.message}`);
        }
        
        telegramBotProcess = null;

        log('Telegram bot stopped');
        res.json({ success: true, message: 'Telegram bot stopped successfully' });
    } catch (error) {
        handleTelegramBotError(res, error, 'stopping');
    }
});

// Endpoint to check Telegram bot status
app.get('/api/telegram-bot/status', authenticateUser, (req, res) => {
    try {
        res.json({ 
            success: true, 
            isRunning: telegramBotProcess !== null 
        });
    } catch (error) {
        handleTelegramBotError(res, error, 'checking status of');
    }
});

// Create necessary directories if they don't exist
const mediaDir = path.join(__dirname, 'media');
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}
