// Tailwind configuration
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {"50":"#eff6ff","100":"#dbeafe","200":"#bfdbfe","300":"#93c5fd","400":"#60a5fa","500":"#3b82f6","600":"#2563eb","700":"#1d4ed8","800":"#1e40af","900":"#1e3a8a","950":"#172554"}
            }
        },
        fontFamily: {
            'body': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'],
            'sans': ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji']
        }
    }
};

// Utility functions
let isStreaming = false;
let statsInterval = null;

// Text customization state
let textCustomization = {
    textColor: '#ffffff',
    backgroundColor: '#000000',
    enableBackground: false,
    fontSize: 70,
    animation: 'bounce'
};

// Load saved text customization settings
async function loadTextCustomization() {
    try {
        const savedCustomization = localStorage.getItem('textCustomization');
        if (savedCustomization) {
            textCustomization = JSON.parse(savedCustomization);
        } else {
            // Default values
            textCustomization = {
                textColor: '#ffffff',
                backgroundColor: '#000000',
                enableBackground: false,
                fontSize: 70,
                animation: 'bounce'
            };
        }
        updateTextCustomizationUI();
    } catch (error) {
        handleError(error);
    }
}

// Update UI elements with current text customization settings
function updateTextCustomizationUI() {
    try {
        // Update color pickers and hex inputs
        document.getElementById('textColor').value = textCustomization.textColor;
        document.getElementById('textColorHex').value = textCustomization.textColor;
        
        document.getElementById('backgroundColor').value = textCustomization.backgroundColor;
        document.getElementById('backgroundColorHex').value = textCustomization.backgroundColor;
        
        // Update background checkbox
        const enableBackground = document.getElementById('enableBackground');
        enableBackground.checked = textCustomization.enableBackground;
        
        // Enable/disable background color inputs
        document.getElementById('backgroundColor').disabled = !textCustomization.enableBackground;
        document.getElementById('backgroundColorHex').disabled = !textCustomization.enableBackground;
        
        // Update font size
        const fontSizeInput = document.getElementById('fontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        fontSizeInput.value = textCustomization.fontSize;
        fontSizeValue.textContent = textCustomization.fontSize;
        
        // Update animation type
        const animationType = document.getElementById('animationType');
        if (animationType) {
            animationType.value = textCustomization.animation || 'bounce';
        }
    } catch (error) {
        handleError(error);
    }
}

// Save text customization settings
async function saveTextCustomization() {
    try {
        // Ensure animation type is captured from the dropdown
        const animationType = document.getElementById('animationType');
        if (animationType) {
            textCustomization.animation = animationType.value;
        }

        // Send text customization to server
        await fetch('/api/update-text-styles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(textCustomization)
        });

        // Save to localStorage
        localStorage.setItem('textCustomization', JSON.stringify(textCustomization));
    } catch (error) {
        handleError(error);
    }
}

// Reset text customization to defaults
async function resetTextCustomization() {
    textCustomization = {
        textColor: '#ffffff',
        backgroundColor: '#000000',
        enableBackground: false,
        fontSize: 70,
        animation: 'bounce'
    };
    updateTextCustomizationUI();
    await saveTextCustomization();
}

function log(message) {
    console.log(message);
    setOutput(message);
}

function handleError(error) {
    console.error('Error:', error);
    setOutput(error.message, 'error');
}

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        if (response.status === 401) {
            // Unauthorized, redirect to login
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        // Only redirect on authentication errors, not on network errors
        if (error.name !== 'TypeError') {
            window.location.href = '/login.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    checkAuth();

    try {
        const rtmpUrl = document.getElementById('rtmpUrl');
        const manualContainer = document.getElementById('manualRtmpUrlContainer');
        const enableBlur = document.getElementById('enableBlur');
        const enableZoom = document.getElementById('enableZoom');
        const useMp3Audio = document.getElementById('useMp3Audio');
        const blurSettings = document.getElementById('blurSettings');
        const streamToggle = document.getElementById('streamToggle');
        const sendMessageBtn = document.getElementById('sendMessage');
        const clearMessagesBtn = document.getElementById('clearMessages');
        const textCustomizeBtn = document.getElementById('textCustomizeBtn');
        const textCustomizeModal = document.getElementById('textCustomizeModal');
        const closeTextCustomizeModal = document.getElementById('closeTextCustomizeModal');
        const saveTextCustomizeBtn = document.getElementById('saveTextCustomization');
        const resetTextCustomizeBtn = document.getElementById('resetTextCustomization');

        // Load saved text customization settings
        loadTextCustomization();

        // Restore settings from localStorage
        restoreStreamSettings();

        checkStreamStatus();

        rtmpUrl.addEventListener('change', () => {
            manualContainer.style.display = rtmpUrl.value === 'manual' ? 'block' : 'none';
        });

        enableBlur.addEventListener('change', () => {
            if (enableBlur.checked && blurSettings.children.length === 0) {
                loadBlurSettings();
            }
            blurSettings.style.display = enableBlur.checked ? 'block' : 'none';
        });

        enableZoom.addEventListener('change', () => {
            document.getElementById('zoomSettings').style.display = enableZoom.checked ? 'block' : 'none';
        });

        streamToggle.addEventListener('click', toggleStream);
        sendMessageBtn.addEventListener('click', sendMessage);
        clearMessagesBtn.addEventListener('click', clearMessages);

        // Text customization modal controls
        textCustomizeBtn.addEventListener('click', () => {
            textCustomizeModal.classList.remove('hidden');
            textCustomizeModal.classList.add('flex');
        });

        closeTextCustomizeModal.addEventListener('click', () => {
            textCustomizeModal.classList.add('hidden');
            textCustomizeModal.classList.remove('flex');
        });

        // Color picker and hex input synchronization
        document.getElementById('textColor').addEventListener('input', (e) => {
            textCustomization.textColor = e.target.value;
            document.getElementById('textColorHex').value = e.target.value;
        });

        document.getElementById('textColorHex').addEventListener('change', (e) => {
            const value = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                textCustomization.textColor = value;
                document.getElementById('textColor').value = value;
            } else {
                e.target.value = textCustomization.textColor;
            }
        });

        document.getElementById('backgroundColor').addEventListener('input', (e) => {
            textCustomization.backgroundColor = e.target.value;
            document.getElementById('backgroundColorHex').value = e.target.value;
        });

        document.getElementById('backgroundColorHex').addEventListener('change', (e) => {
            const value = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                textCustomization.backgroundColor = value;
                document.getElementById('backgroundColor').value = value;
            } else {
                e.target.value = textCustomization.backgroundColor;
            }
        });

        // Enable/disable background controls
        document.getElementById('enableBackground').addEventListener('change', (e) => {
            textCustomization.enableBackground = e.target.checked;
            document.getElementById('backgroundColor').disabled = !e.target.checked;
            document.getElementById('backgroundColorHex').disabled = !e.target.checked;
        });

        // Font size control
        document.getElementById('fontSize').addEventListener('input', (e) => {
            textCustomization.fontSize = parseInt(e.target.value);
            document.getElementById('fontSizeValue').textContent = e.target.value;
        });

        // Animation type control
        const animationType = document.getElementById('animationType');
        if (animationType) {
            animationType.addEventListener('change', () => {
                textCustomization.animation = animationType.value;
                saveTextCustomization();
            });
        }

        // Save button
        saveTextCustomizeBtn.addEventListener('click', () => {
            saveTextCustomization();
            textCustomizeModal.classList.add('hidden');
            textCustomizeModal.classList.remove('flex');
        });

        // Reset button
        resetTextCustomizeBtn.addEventListener('click', resetTextCustomization);

    } catch (error) {
        handleError(error);
    }

    const rtmpUrl = document.getElementById('rtmpUrl');
    const streamKey = document.getElementById('streamKey');
    const m3u8Url = document.getElementById('m3u8Url');
    const zoomLevel = document.getElementById('zoomLevel');

    if (!rtmpUrl || !streamKey || !m3u8Url || !zoomLevel) {
        console.error("One or more elements are missing from the DOM.");
        return;
    }

    // Add your event listeners and other logic here
});

function loadBlurSettings() {
    try {
        const blurSettings = document.getElementById('blurSettings');
        const settings = [
            { id: 'blurX', label: 'X Coordinate', value: 1550, min: 0, max: 1920 },
            { id: 'blurY', label: 'Y Coordinate', value: 50, min: 0, max: 1080 },
            { id: 'blurWidth', label: 'Width', value: 250, min: 1, max: 1920 },
            { id: 'blurHeight', label: 'Height', value: 100, min: 1, max: 1080 }
        ];

        settings.forEach(setting => {
            const div = document.createElement('div');
            div.innerHTML = `
                <label for="${setting.id}" class="block text-sm font-medium mb-1">${setting.label}</label>
                <input type="number" id="${setting.id}" value="${setting.value}" min="${setting.min}" max="${setting.max}" class="w-full px-3 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
            `;
            blurSettings.appendChild(div);
        });
    } catch (error) {
        handleError(error);
    }
}

async function checkStreamStatus() {
    try {
        const response = await fetch('/api/stream-status');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        isStreaming = result.isStreaming;
        updateUI();
    } catch (error) {
        handleError(error);
    }
}

async function toggleStream() {
    try {
        if (isStreaming) {
            await stopStream();
        } else {
            await startStream();
        }
    } catch (error) {
        handleError(error);
    }
}

async function startStream() {
    if (!validateForm()) return;
    try {
        const rtmpUrl = document.getElementById('rtmpUrl').value === 'manual' 
            ? document.getElementById('manualRtmpUrl').value 
            : document.getElementById('rtmpUrl').value;
        // Clean up stream key by removing leading/trailing slashes
        const streamKey = document.getElementById('streamKey').value.replace(/^\/+|\/+$/g, '');
        const useM3u = document.getElementById('useM3uFile').checked;
        const m3u8Url = useM3u 
            ? document.getElementById('channelSelect').value 
            : document.getElementById('m3u8Url').value;
        const enableZoom = document.getElementById('enableZoom').checked;
        const zoomLevel = enableZoom ? document.getElementById('zoomLevel').value / 100 : 1;
        const useMp3Audio = document.getElementById('useMp3Audio').checked;
        const enableBlur = document.getElementById('enableBlur').checked;

        let filterComplex = '';
        if (enableBlur) {
            const blurX = document.getElementById('blurX').value;
            const blurY = document.getElementById('blurY').value;
            const blurWidth = document.getElementById('blurWidth').value;
            const blurHeight = document.getElementById('blurHeight').value;
            filterComplex = `[0:v]crop=w=${blurWidth}:h=${blurHeight}:x=${blurX}:y=${blurY},boxblur=20:3[blurred];[0:v][blurred]overlay=x=${blurX}:y=${blurY}`;
        }

        let logoPath = '';
        let logoPosition = '';
        if (document.getElementById('enableLogo').checked && document.getElementById('logoUpload').files.length > 0) {
            const formData = new FormData();
            formData.append('logo', document.getElementById('logoUpload').files[0]);
            formData.append('logoPosition', document.getElementById('logoPosition').value);

            const uploadResponse = await fetch('/api/upload-logo', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Logo upload failed');
            }

            const uploadResult = await uploadResponse.json();
            logoPath = uploadResult.logoPath;
            logoPosition = uploadResult.logoPosition;
        }

        const requestBody = {
            rtmpUrl: rtmpUrl,
            streamKey: streamKey,
            m3u8Url: m3u8Url,
            filterComplex: filterComplex,
            enableZoom: enableZoom,
            zoomLevel: zoomLevel,
            useMp3Audio: useMp3Audio,
            logoPath: logoPath,
            logoPosition: logoPosition
        };

        const response = await fetch('/api/start-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        log('Stream started successfully');
        isStreaming = true;
        updateUI();
        
        // Save settings after successful stream start
        saveStreamSettings();
    } catch (error) {
        handleError(error);
    }
}

async function stopStream() {
    try {
        const response = await fetch('/api/stop-stream', { method: 'POST' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        log(result.message);
        isStreaming = false;
        updateUI();
    } catch (error) {
        handleError(error);
    }
}

async function sendMessage() {
    try {
        const streamMessage = document.getElementById('streamMessage').value;
        if (!streamMessage) {
            throw new Error("Please enter a message to send.");
        }

        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: streamMessage })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            document.getElementById('streamMessage').value = '';
            log('Message sent successfully');
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        handleError(error);
    }
}

async function clearMessages() {
    try {
        await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: ' ' })
        });
        const clearResponse = await fetch('/api/clear-messages', { method: 'POST' });
        if (!clearResponse.ok) {
            throw new Error(`HTTP error! status: ${clearResponse.status}`);
        }
        const clearResult = await clearResponse.json();
        if (clearResult.success) {
            log('Messages cleared');
        } else {
            throw new Error(clearResult.message);
        }
    } catch (error) {
        handleError(error);
    }
}

function updateUI() {
    try {
        const streamToggle = document.getElementById('streamToggle');
        const sendMessage = document.getElementById('sendMessage');
        const status = document.getElementById('status');
        const formInputs = document.querySelectorAll('form input, form select');
        const rtmpUrlButton = document.getElementById('rtmpUrlButton');
        const textCustomizeBtn = document.getElementById('textCustomizeBtn');

        if (isStreaming) {
            streamToggle.textContent = 'Stop Streaming';
            streamToggle.classList.remove('bg-primary-600', 'hover:bg-primary-700');
            streamToggle.classList.add('bg-red-600', 'hover:bg-red-700');
            status.innerHTML = '<p class="text-green-500 dark:text-green-400">Streaming</p>';
            sendMessage.disabled = false;
            formInputs.forEach(input => input.disabled = true);
            rtmpUrlButton.disabled = true;
            rtmpUrlButton.classList.add('opacity-50', 'cursor-not-allowed');
            textCustomizeBtn.disabled = true;
            textCustomizeBtn.classList.add('opacity-50', 'cursor-not-allowed');
            startStatsUpdates(); // Start updating stats
        } else {
            streamToggle.textContent = 'Start Streaming';
            streamToggle.classList.remove('bg-red-600', 'hover:bg-red-700');
            streamToggle.classList.add('bg-primary-600', 'hover:bg-primary-700');
            status.innerHTML = '<p class="text-red-500 dark:text-red-400">Stream Stopped</p>';
            sendMessage.disabled = true;
            formInputs.forEach(input => input.disabled = false);
            rtmpUrlButton.disabled = false;
            rtmpUrlButton.classList.remove('opacity-50', 'cursor-not-allowed');
            textCustomizeBtn.disabled = false;
            textCustomizeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            stopStatsUpdates(); // Stop updating stats
        }
    } catch (error) {
        handleError(error);
    }
}

function setOutput(message, type = 'info') {
    try {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let icon = '';
        switch(type) {
            case 'error':
                icon = '❌';
                break;
            case 'success':
                icon = '✅';
                break;
            default:
                icon = 'ℹ️';
        }

        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <div class="notification-content">${message}</div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(notification);

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    } catch (error) {
        console.error('Error setting output:', error);
    }
}

// Wait for the header to be loaded before adding event listeners
document.addEventListener('headerLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    window.location.href = '/';
                } else {
                    throw new Error('Logout failed');
                }
            } catch (error) {
                handleError(error);
            }
        });
    }
});

// Add form validation
function validateForm() {
    const rtmpUrl = document.getElementById('rtmpUrl').value;
    const streamKey = document.getElementById('streamKey').value;
    const useM3u = document.getElementById('useM3uFile').checked;
    const selectedChannel = document.getElementById('channelSelect').value;
    const m3u8Url = document.getElementById('m3u8Url').value;

    if (!rtmpUrl || !streamKey) {
        setOutput('Please fill in RTMP URL and Stream Key fields.', 'error');
        return false;
    }

    if (useM3u) {
        if (!selectedChannel) {
            setOutput('Please select a channel from the M3U file.', 'error');
            return false;
        }
    } else {
        if (!m3u8Url) {
            setOutput('Please enter an M3U8 URL.', 'error');
            return false;
        }
    }

    if (document.getElementById('enableBlur').checked) {
        const blurX = parseInt(document.getElementById('blurX').value, 10);
        const blurY = parseInt(document.getElementById('blurY').value, 10);
        const blurWidth = parseInt(document.getElementById('blurWidth').value, 10);
        const blurHeight = parseInt(document.getElementById('blurHeight').value, 10);

        if (isNaN(blurX) || isNaN(blurY) || isNaN(blurWidth) || isNaN(blurHeight) ||
            blurX < 0 || blurX > 1920 || blurY < 0 || blurY > 1080 || 
            blurWidth <= 0 || blurWidth > 1920 || blurHeight <= 0 || blurHeight > 1080) {
            setOutput('Please enter valid blur settings within the specified range.', 'error');
            return false;
        }
    }

    return true;
}

const rtmpUrlButton = document.getElementById('rtmpUrlButton');
const rtmpUrlDropdown = document.getElementById('rtmpUrlDropdown');
const rtmpUrlInput = document.getElementById('rtmpUrl');
const selectedPlatform = document.getElementById('selectedPlatform');

rtmpUrlButton.addEventListener('click', () => {
    rtmpUrlDropdown.classList.toggle('hidden');
});

document.querySelectorAll('#rtmpUrlDropdown a').forEach(option => {
    option.addEventListener('click', (e) => {
        e.preventDefault();
        const value = option.dataset.value;
        const text = option.textContent.trim();
        // Remove any trailing slashes from the RTMP URL
        rtmpUrlInput.value = value.replace(/\/+$/, '');
        selectedPlatform.innerHTML = option.innerHTML;
        rtmpUrlDropdown.classList.add('hidden');
        if (value === 'manual') {
            document.getElementById('manualRtmpUrlContainer').classList.remove('hidden');
        } else {
            document.getElementById('manualRtmpUrlContainer').classList.add('hidden');
        }
    });
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!rtmpUrlButton.contains(e.target) && !rtmpUrlDropdown.contains(e.target)) {
        rtmpUrlDropdown.classList.add('hidden');
    }
});

// Add these event listeners after your existing ones
const logsButton = document.getElementById('logsButton');
const logsModal = document.getElementById('logsModal');
const closeLogsModal = document.getElementById('closeLogsModal');
const logsContent = document.getElementById('logsContent');

logsButton.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/logs');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const logs = await response.text();
        logsContent.innerHTML = logs.split('\n').map(line => `<div class="py-1">${line}</div>`).join('');
        logsContent.scrollTop = logsContent.scrollHeight; // Auto scroll to bottom
        logsModal.classList.remove('hidden');
    } catch (error) {
        console.error('Error fetching logs:', error);
    }
});

closeLogsModal.addEventListener('click', () => {
    logsModal.classList.add('hidden');
});

// Close modal when clicking outside
logsModal.addEventListener('click', (e) => {
    if (e.target === logsModal) {
        logsModal.classList.add('hidden');
    }
});

// Auto-refresh logs every 5 seconds when modal is open
setInterval(async () => {
    if (!logsModal.classList.contains('hidden')) {
        try {
            const response = await fetch('/api/logs');
            if (!response.ok) {
                throw new Error('Failed to fetch logs');
            }
            const logs = await response.text();
            logsContent.innerHTML = logs.split('\n').map(line => `<div class="py-1">${line}</div>`).join('');
            logsContent.scrollTop = logsContent.scrollHeight; // Auto scroll to bottom
        } catch (error) {
            console.error('Error refreshing logs:', error);
        }
    }
}, 5000);

// Add video player functionality
const videoPlayerModal = document.getElementById('videoPlayerModal');
const closeVideoModal = document.getElementById('closeVideoModal');
const videoPlayer = document.getElementById('videoPlayer');
const testM3u8 = document.getElementById('testM3u8');
const testChannel = document.getElementById('testChannel');

function initVideoPlayer(url) {
    // Reset video player
    videoPlayer.src = '';
    videoPlayer.load();

    // Check if the URL is for an MP4 file
    if (url.toLowerCase().endsWith('.mp4')) {
        // Direct MP4 playback
        videoPlayer.src = url;
        videoPlayer.play().catch(function(error) {
            console.log("Play prevented:", error);
            handleError(new Error('Error playing video'));
        });
    } else if (Hls.isSupported()) {
        // HLS playback for M3U8
        const hls = new Hls({
            debug: false,
            enableWorker: true
        });
        hls.loadSource(url);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            videoPlayer.play().catch(function(error) {
                console.log("Play prevented:", error);
            });
        });
        hls.on(Hls.Events.ERROR, function(event, data) {
            console.error('HLS Error:', data);
            if (data.fatal) {
                handleError(new Error('Error loading video stream'));
            }
        });
    } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari
        videoPlayer.src = url;
        videoPlayer.addEventListener('loadedmetadata', function() {
            videoPlayer.play().catch(function(error) {
                console.log("Play prevented:", error);
            });
        });
    }
}

function showVideoPlayer(url) {
    videoPlayerModal.classList.remove('hidden');
    initVideoPlayer(url);
}

function hideVideoPlayer() {
    videoPlayerModal.classList.add('hidden');
    videoPlayer.pause();
    videoPlayer.src = '';
}

testM3u8.addEventListener('click', () => {
    const url = document.getElementById('m3u8Url').value;
    if (!url) {
        handleError(new Error('Please enter an M3U8 URL'));
        return;
    }
    showVideoPlayer(url);
});

testChannel.addEventListener('click', () => {
    const url = document.getElementById('channelSelect').value;
    if (!url) {
        handleError(new Error('Please select a channel'));
        return;
    }
    showVideoPlayer(url);
});

closeVideoModal.addEventListener('click', hideVideoPlayer);

// Close modal when clicking outside
videoPlayerModal.addEventListener('click', (e) => {
    if (e.target === videoPlayerModal) {
        hideVideoPlayer();
    }
});

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !videoPlayerModal.classList.contains('hidden')) {
        hideVideoPlayer();
    }
});

// Initialize source visibility on page load
document.addEventListener('DOMContentLoaded', function() {
    const useM3uFile = document.getElementById('useM3uFile');
    if (useM3uFile) {
        useM3uFile.addEventListener('change', function() {
            const m3uFileContainer = document.getElementById('m3uFileContainer');
            const m3u8UrlContainer = document.getElementById('m3u8UrlContainer');
            if (this.checked) {
                m3uFileContainer?.classList.remove('hidden');
                m3u8UrlContainer?.classList.add('hidden');
            } else {
                m3uFileContainer?.classList.add('hidden');
                m3u8UrlContainer?.classList.remove('hidden');
            }
        });
    }
});

const zoomLevelSlider = document.getElementById('zoomLevel');
const zoomLevelValue = document.getElementById('zoomLevelValue');

zoomLevelSlider.addEventListener('input', () => {
    zoomLevelValue.textContent = zoomLevelSlider.value;
});

// Add this function to save stream settings
function saveStreamSettings() {
    const settings = {
        rtmpUrl: document.getElementById('rtmpUrl').value,
        streamKey: document.getElementById('streamKey').value,
        m3u8Url: document.getElementById('m3u8Url').value,
        selectedPlatform: document.getElementById('selectedPlatform').innerHTML,
        enableBlur: document.getElementById('enableBlur').checked,
        enableZoom: document.getElementById('enableZoom').checked,
        zoomLevel: document.getElementById('zoomLevel').value,
        useMp3Audio: document.getElementById('useMp3Audio').checked
    };
    localStorage.setItem('streamSettings', JSON.stringify(settings));
}

// Add this function to restore stream settings
function restoreStreamSettings() {
    const settings = JSON.parse(localStorage.getItem('streamSettings'));
    if (settings) {
        document.getElementById('rtmpUrl').value = settings.rtmpUrl || '';
        document.getElementById('streamKey').value = settings.streamKey || '';
        document.getElementById('m3u8Url').value = settings.m3u8Url || '';
        document.getElementById('selectedPlatform').innerHTML = settings.selectedPlatform || 'Select RTMP URL';
        document.getElementById('enableBlur').checked = settings.enableBlur || false;
        document.getElementById('enableZoom').checked = settings.enableZoom || false;
        document.getElementById('zoomLevel').value = settings.zoomLevel || 100;
        document.getElementById('useMp3Audio').checked = settings.useMp3Audio || false;

        // Trigger the change events to update UI
        if (settings.enableBlur) {
            const event = new Event('change');
            document.getElementById('enableBlur').dispatchEvent(event);
        }
        if (settings.enableZoom) {
            document.getElementById('zoomSettings').style.display = 'block';
        }
    }
}

// Add these after your existing variables
const useM3uFile = document.getElementById('useM3uFile');
const m3uFileContainer = document.getElementById('m3uFileContainer');
const m3uFileInput = document.getElementById('m3uFile');
const channelSelect = document.getElementById('channelSelect');
const m3u8UrlInput = document.getElementById('m3u8Url');

// Toggle M3U file container visibility
useM3uFile.addEventListener('change', () => {
    m3uFileContainer.style.display = useM3uFile.checked ? 'block' : 'none';
    document.getElementById('m3u8UrlContainer').style.display = useM3uFile.checked ? 'none' : 'block';
});

// Handle M3U file upload
m3uFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('m3uFile', file);

    try {
        const response = await fetch('/api/parse-m3u', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to parse M3U file');
        }

        const channels = await response.json();
        
        // Clear existing options
        channelSelect.innerHTML = '<option value="">Select a channel...</option>';
        
        // Add new channel options
        channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.url;
            option.textContent = channel.name;
            channelSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error parsing M3U file:', error);
        alert('Error parsing M3U file');
    }
});

// Update the validateForm function
function validateForm() {
    const rtmpUrl = document.getElementById('rtmpUrl').value;
    const streamKey = document.getElementById('streamKey').value;
    const useM3u = document.getElementById('useM3uFile').checked;
    const selectedChannel = document.getElementById('channelSelect').value;
    const m3u8Url = document.getElementById('m3u8Url').value;

    if (!rtmpUrl || !streamKey) {
        setOutput('Please fill in RTMP URL and Stream Key fields.', 'error');
        return false;
    }

    if (useM3u) {
        if (!selectedChannel) {
            setOutput('Please select a channel from the M3U file.', 'error');
            return false;
        }
    } else {
        if (!m3u8Url) {
            setOutput('Please enter an M3U8 URL.', 'error');
            return false;
        }
    }

    if (document.getElementById('enableBlur').checked) {
        const blurX = parseInt(document.getElementById('blurX').value, 10);
        const blurY = parseInt(document.getElementById('blurY').value, 10);
        const blurWidth = parseInt(document.getElementById('blurWidth').value, 10);
        const blurHeight = parseInt(document.getElementById('blurHeight').value, 10);

        if (isNaN(blurX) || isNaN(blurY) || isNaN(blurWidth) || isNaN(blurHeight) ||
            blurX < 0 || blurX > 1920 || blurY < 0 || blurY > 1080 || 
            blurWidth <= 0 || blurWidth > 1920 || blurHeight <= 0 || blurHeight > 1080) {
            setOutput('Please enter valid blur settings within the specified range.', 'error');
            return false;
        }
    }

    return true;
}

async function updateSystemStats() {
    try {
        const response = await fetch('/api/system-stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const stats = await response.json();
        
        // Update CPU
        const cpuUsage = document.getElementById('cpuUsage');
        const cpuBar = document.getElementById('cpuBar');
        if (cpuUsage && cpuBar) {
            cpuUsage.textContent = stats.cpu;
            cpuBar.style.width = `${stats.cpu}%`;
        }
        
        // Update Memory
        const memoryUsage = document.getElementById('memoryUsage');
        const memoryBar = document.getElementById('memoryBar');
        const usedMemory = document.getElementById('usedMemory');
        const totalMemory = document.getElementById('totalMemory');
        
        if (memoryUsage && memoryBar && usedMemory && totalMemory) {
            memoryUsage.textContent = stats.memory;
            memoryBar.style.width = `${stats.memory}%`;
            usedMemory.textContent = stats.usedMemory;
            totalMemory.textContent = stats.totalMemory;
        }
    } catch (error) {
        console.error('Error updating system stats:', error);
    }
}

function startStatsUpdates() {
    // Clear any existing interval
    if (statsInterval) {
        clearInterval(statsInterval);
    }
    // Update immediately
    updateSystemStats();
    // Then update every 2 seconds
    statsInterval = setInterval(updateSystemStats, 2000);
}

function stopStatsUpdates() {
    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }
}

// Add these after your existing variables
const useMp4Loop = document.getElementById('useMp4Loop');
const mp4Container = document.getElementById('mp4Container');
const videoSelect = document.getElementById('videoSelect');
const testVideo = document.getElementById('testVideo');

// Toggle containers based on source selection
useMp4Loop.addEventListener('change', () => {
    mp4Container.style.display = useMp4Loop.checked ? 'block' : 'none';
    m3uFileContainer.style.display = 'none';
    m3u8UrlContainer.style.display = useMp4Loop.checked ? 'none' : 'block';
    useM3uFile.parentElement.parentElement.style.display = useMp4Loop.checked ? 'none' : 'flex';
    document.getElementById('useM3uFile').checked = false;
    
    if (useMp4Loop.checked) {
        // Fetch available videos when MP4 loop is enabled
        fetchVideos();
    }
});

useM3uFile.addEventListener('change', () => {
    m3uFileContainer.style.display = useM3uFile.checked ? 'block' : 'none';
    m3u8UrlContainer.style.display = useM3uFile.checked ? 'none' : 'block';
    mp4Container.style.display = 'none';
    // Remove this line so MP4 toggle stays visible
    // useMp4Loop.parentElement.parentElement.style.display = useM3uFile.checked ? 'none' : 'flex';
    useMp4Loop.checked = false;
});

// Function to fetch available videos
async function fetchVideos() {
    try {
        const response = await fetch('/api/videos');
        const data = await response.json();
        
        if (data.success) {
            const videoSelect = document.getElementById('videoSelect');
            videoSelect.innerHTML = '';
            
            data.videos.forEach(video => {
                const videoItem = document.createElement('div');
                videoItem.className = 'flex items-center justify-between p-3 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-150';
                
                const leftSection = document.createElement('div');
                leftSection.className = 'flex items-center space-x-3 flex-1 min-w-0';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = video;
                checkbox.className = 'form-checkbox h-4 w-4 text-primary-600 rounded border-gray-300 dark:border-gray-600 focus:ring-primary-500 dark:focus:ring-primary-400';
                
                const labelContainer = document.createElement('div');
                labelContainer.className = 'flex-1 min-w-0';
                
                const label = document.createElement('div');
                label.textContent = video;
                label.className = 'text-sm text-gray-900 dark:text-gray-100 truncate';
                
                labelContainer.appendChild(label);
                leftSection.appendChild(checkbox);
                leftSection.appendChild(labelContainer);
                
                const buttonsContainer = document.createElement('div');
                buttonsContainer.className = 'flex items-center space-x-4';

                const playBtn = document.createElement('button');
                playBtn.className = 'text-gray-400 hover:text-primary-500 dark:text-gray-500 dark:hover:text-primary-400 transition-colors duration-150';
                playBtn.innerHTML = '<i class="fas fa-play"></i>';
                playBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showVideoPlayer(`/videos/${video}`);
                };
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors duration-150';
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this video?')) {
                        deleteVideo(video);
                    }
                };
                
                buttonsContainer.appendChild(playBtn);
                buttonsContainer.appendChild(deleteBtn);
                
                videoItem.appendChild(leftSection);
                videoItem.appendChild(buttonsContainer);
                videoSelect.appendChild(videoItem);
            });
        }
    } catch (error) {
        console.error('Error fetching videos:', error);
        setOutput('Error fetching videos: ' + error.message, 'error');
    }
}

// Update startStream function to handle multiple videos
async function startStream() {
    try {
        if (isStreaming) return;
        
        const formData = new FormData();
        
        if (useMp4Loop.checked) {
            const selectedVideos = Array.from(document.querySelectorAll('#videoSelect input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            
            if (selectedVideos.length === 0) {
                throw new Error('Please select at least one video');
            }
            
            formData.append('videos', JSON.stringify(selectedVideos));
        }
        
        // Rest of your existing startStream code...
    } catch (error) {
        handleError(error);
    }
}

// Update validateForm to include MP4 loop validation
function validateForm() {
    const rtmpUrl = document.getElementById('rtmpUrl').value;
    const streamKey = document.getElementById('streamKey').value;

    if (!rtmpUrl || !streamKey) {
        setOutput('Please fill in RTMP URL and Stream Key fields.', 'error');
        return false;
    }

    if (useMp4Loop.checked) {
        const selectedVideos = Array.from(document.querySelectorAll('#videoSelect input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        if (selectedVideos.length === 0) {
            setOutput('Please select at least one video.', 'error');
            return false;
        }
    } else if (useM3uFile.checked) {
        if (!document.getElementById('channelSelect').value) {
            setOutput('Please select a channel from the M3U file.', 'error');
            return false;
        }
    } else {
        if (!document.getElementById('m3u8Url').value) {
            setOutput('Please enter an M3U8 URL.', 'error');
            return false;
        }
    }

    // Rest of your existing validation...
    return true;
}

// Add video upload functionality
async function deleteVideo(filename) {
    try {
        const response = await fetch(`/api/videos/${filename}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            setOutput('Video deleted successfully', 'success');
            // Refresh the video list
            fetchVideos();
        } else {
            setOutput(result.message || 'Error deleting video', 'error');
        }
    } catch (error) {
        console.error('Error deleting video:', error);
        setOutput('Error deleting video', 'error');
    }
}

// Add stream key toggle functionality
const toggleStreamKey = document.getElementById('toggleStreamKey');
const streamKeyInput = document.getElementById('streamKey');

toggleStreamKey.addEventListener('click', () => {
    const type = streamKeyInput.type === 'password' ? 'text' : 'password';
    streamKeyInput.type = type;
    toggleStreamKey.querySelector('i').classList.toggle('fa-eye');
    toggleStreamKey.querySelector('i').classList.toggle('fa-eye-slash');
});

// Add video upload functionality
const uploadModal = document.getElementById('uploadModal');
const uploadVideoBtn = document.getElementById('uploadVideoBtn');
const closeUploadModal = document.getElementById('closeUploadModal');
const uploadArea = document.getElementById('uploadArea');
const videoUpload = document.getElementById('videoUpload');
const uploadProgress = document.getElementById('uploadProgress');
const uploadFileName = document.getElementById('uploadFileName');
const progressBarFill = document.getElementById('progressBarFill');
const uploadStatus = document.getElementById('uploadStatus');

uploadVideoBtn.addEventListener('click', () => {
    uploadModal.style.display = 'block';
});

closeUploadModal.addEventListener('click', () => {
    uploadModal.style.display = 'none';
    uploadProgress.classList.add('hidden');
    progressBarFill.style.width = '0%';
});

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});

['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('dragover');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('dragover');
    });
});

uploadArea.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        uploadVideo(file);
    } else {
        setOutput('Please upload a valid video file', 'error');
    }
});

videoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadVideo(file);
    }
});

function uploadVideo(file) {
    const formData = new FormData();
    formData.append('video', file);

    // Show progress elements
    uploadProgress.classList.remove('hidden');
    uploadFileName.textContent = file.name;
    uploadStatus.textContent = 'Uploading...';
    progressBarFill.style.width = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload-video', true);

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            progressBarFill.style.width = percentComplete + '%';
            uploadStatus.textContent = `Uploading... ${percentComplete}%`;
        }
    });

    xhr.onload = function() {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
                uploadStatus.textContent = 'Upload Complete!';
                progressBarFill.style.width = '100%';
                setOutput('Video uploaded successfully', 'success');
                fetchVideos(); // Refresh video list
                videoUpload.value = ''; // Clear the file input
                setTimeout(() => {
                    uploadModal.style.display = 'none';
                    uploadProgress.classList.add('hidden');
                    progressBarFill.style.width = '0%';
                    uploadStatus.textContent = '';
                }, 1500);
            } else {
                uploadStatus.textContent = 'Upload Failed';
                setOutput(response.message || 'Upload failed', 'error');
            }
        } else {
            uploadStatus.textContent = 'Upload Failed';
            setOutput('Error uploading video', 'error');
        }
    };

    xhr.onerror = function() {
        uploadStatus.textContent = 'Upload Failed';
        setOutput('Error uploading video', 'error');
    };

    xhr.send(formData);
}

const enableLogo = document.getElementById('enableLogo');
const logoUploadContainer = document.getElementById('logoUploadContainer');
const logoUpload = document.getElementById('logoUpload');

enableLogo.addEventListener('change', () => {
    logoUploadContainer.style.display = enableLogo.checked ? 'block' : 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    // Load saved text customization settings
    loadTextCustomization();

    // Text color picker
    const textColor = document.getElementById('textColor');
    const textColorHex = document.getElementById('textColorHex');
    if (textColor && textColorHex) {
        textColor.addEventListener('input', (e) => {
            textCustomization.textColor = e.target.value;
            textColorHex.value = e.target.value;
            saveTextCustomization();
        });
        
        textColorHex.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                textCustomization.textColor = value;
                textColor.value = value;
                saveTextCustomization();
            } else {
                e.target.value = textCustomization.textColor;
            }
        });
    }

    // Background color picker
    const backgroundColor = document.getElementById('backgroundColor');
    const backgroundColorHex = document.getElementById('backgroundColorHex');
    const enableBackground = document.getElementById('enableBackground');
    if (backgroundColor && backgroundColorHex && enableBackground) {
        backgroundColor.addEventListener('input', (e) => {
            textCustomization.backgroundColor = e.target.value;
            backgroundColorHex.value = e.target.value;
            saveTextCustomization();
        });

        backgroundColorHex.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                textCustomization.backgroundColor = value;
                backgroundColor.value = value;
                saveTextCustomization();
            } else {
                e.target.value = textCustomization.backgroundColor;
            }
        });

        enableBackground.addEventListener('change', (e) => {
            textCustomization.enableBackground = e.target.checked;
            backgroundColor.disabled = !e.target.checked;
            backgroundColorHex.disabled = !e.target.checked;
            saveTextCustomization();
        });
    }

    // Font size slider
    const fontSize = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    if (fontSize && fontSizeValue) {
        fontSize.addEventListener('input', (e) => {
            textCustomization.fontSize = parseInt(e.target.value);
            fontSizeValue.textContent = e.target.value;
            saveTextCustomization();
        });
    }

    // Animation type select
    const animationType = document.getElementById('animationType');
    if (animationType) {
        animationType.addEventListener('change', (e) => {
            textCustomization.animation = e.target.value;
            saveTextCustomization();
        });
    }
});

// Update the startStream function to handle MP4 loop
async function startStream() {
    if (!validateForm()) return;
    try {
        const rtmpUrl = document.getElementById('rtmpUrl').value === 'manual' 
            ? document.getElementById('manualRtmpUrl').value 
            : document.getElementById('rtmpUrl').value;
        const streamKey = document.getElementById('streamKey').value.replace(/^\/+|\/+$/g, '');
        
        // Determine input source
        let inputSource;
        let isMP4Loop = false;
        if (useMp4Loop.checked) {
            const selectedVideos = Array.from(document.querySelectorAll('#videoSelect input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.value);
            inputSource = selectedVideos;
            isMP4Loop = true;
        } else if (useM3uFile.checked) {
            inputSource = document.getElementById('channelSelect').value;
        } else {
            inputSource = document.getElementById('m3u8Url').value;
        }

        const enableZoom = document.getElementById('enableZoom').checked;
        const zoomLevel = enableZoom ? document.getElementById('zoomLevel').value / 100 : 1;
        const useMp3Audio = document.getElementById('useMp3Audio').checked;
        const enableBlur = document.getElementById('enableBlur').checked;

        let filterComplex = '';
        if (enableBlur) {
            const blurX = document.getElementById('blurX').value;
            const blurY = document.getElementById('blurY').value;
            const blurWidth = document.getElementById('blurWidth').value;
            const blurHeight = document.getElementById('blurHeight').value;
            filterComplex = `[0:v]crop=w=${blurWidth}:h=${blurHeight}:x=${blurX}:y=${blurY},boxblur=20:3[blurred];[0:v][blurred]overlay=x=${blurX}:y=${blurY}`;
        }

        let logoPath = '';
        let logoPosition = '';
        if (document.getElementById('enableLogo').checked && document.getElementById('logoUpload').files.length > 0) {
            const formData = new FormData();
            formData.append('logo', document.getElementById('logoUpload').files[0]);
            formData.append('logoPosition', document.getElementById('logoPosition').value);

            const uploadResponse = await fetch('/api/upload-logo', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('Logo upload failed');
            }

            const uploadResult = await uploadResponse.json();
            logoPath = uploadResult.logoPath;
            logoPosition = uploadResult.logoPosition;
        }

        const requestBody = {
            rtmpUrl: rtmpUrl,
            streamKey: streamKey,
            inputSource: inputSource,
            isMP4Loop,
            enableZoom,
            zoomLevel,
            filterComplex,
            useMp3Audio,
            logoPath: logoPath,
            logoPosition: logoPosition
        };

        const response = await fetch('/api/start-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        log('Stream started successfully');
        isStreaming = true;
        updateUI();
        
        // Save settings after successful stream start
        saveStreamSettings();
    } catch (error) {
        handleError(error);
    }
}

// Add video upload functionality
async function deleteVideo(filename) {
    try {
        const response = await fetch(`/api/videos/${filename}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            setOutput('Video deleted successfully', 'success');
            // Refresh the video list
            fetchVideos();
        } else {
            setOutput(result.message || 'Error deleting video', 'error');
        }
    } catch (error) {
        console.error('Error deleting video:', error);
        setOutput('Error deleting video', 'error');
    }
}
