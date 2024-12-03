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

// Function to show notifications
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    
    notification.className = `notification ${type} animate-fade-in`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            container.removeChild(notification);
        }, 300);
    }, 3000);
}

// Media Library Management
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function refreshMediaLibrary() {
    fetch('/api/media/list')
        .then(response => response.json())
        .then(files => {
            const mediaList = document.getElementById('mediaList');
            const totalFiles = document.getElementById('totalFiles');
            mediaList.innerHTML = '';
            totalFiles.textContent = files.length;

            // Sort files by modified date (newest first)
            files.sort((a, b) => new Date(b.modified) - new Date(a.modified));

            files.forEach(file => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                row.innerHTML = `
                    <td class="px-2 py-2">
                        <div class="flex flex-col sm:flex-row sm:items-center">
                            <span class="media-name font-medium text-gray-900 dark:text-gray-100 break-all" title="${file.displayName}">
                                ${file.displayName}
                            </span>
                            <!-- Mobile-only info -->
                            <div class="flex flex-col space-y-1 text-sm text-gray-500 dark:text-gray-400 sm:hidden mt-1">
                                <span class="media-size">${formatFileSize(file.size)}</span>
                                <span class="media-date">${formatDate(file.modified)}</span>
                            </div>
                            <!-- Mobile-only actions -->
                            <div class="flex space-x-3 mt-2 sm:hidden">
                                <button onclick="playVideo('${file.path}')" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" title="Play">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button onclick="downloadVideo('${file.name}')" class="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300" title="Download">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button onclick="showRenameModal('${file.name}', '${file.displayName}')" class="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300" title="Rename">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteVideo('${file.name}')" class="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                    <!-- Desktop-only columns -->
                    <td class="px-2 py-2 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        <span class="media-size">${formatFileSize(file.size)}</span>
                    </td>
                    <td class="px-2 py-2 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        <span class="media-date">${formatDate(file.modified)}</span>
                    </td>
                    <td class="px-2 py-2 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                        <div class="flex space-x-2">
                            <button onclick="playVideo('${file.path}')" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" title="Play">
                                <i class="fas fa-play"></i>
                            </button>
                            <button onclick="downloadVideo('${file.name}')" class="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300" title="Download">
                                <i class="fas fa-download"></i>
                            </button>
                            <button onclick="showRenameModal('${file.name}', '${file.displayName}')" class="text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300" title="Rename">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteVideo('${file.name}')" class="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                mediaList.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error fetching media library:', error);
            showNotification('Error loading media library', 'error');
        });
}

function playVideo(videoPath) {
    const videoPlayer = document.getElementById('videoPlayer');
    const modal = document.getElementById('videoPlayerModal');
    
    videoPlayer.src = videoPath;
    modal.classList.remove('hidden');
    
    document.getElementById('closeVideoModal').onclick = () => {
        videoPlayer.pause();
        videoPlayer.src = '';
        modal.classList.add('hidden');
    };
}

function downloadVideo(filename) {
    const downloadForm = document.getElementById('downloadForm');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const downloadProgress = document.getElementById('downloadProgress');
    const downloadLink = document.getElementById('downloadLink');

    // Reset UI
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercent) progressPercent.textContent = '0%';
    if (downloadProgress) downloadProgress.classList.remove('hidden');
    if (downloadLink) downloadLink.style.display = 'none';

    // Trigger file download
    const downloadUrl = `/api/media/download/${encodeURIComponent(filename)}`;
    window.location.href = downloadUrl;
}

function deleteVideo(filename) {
    if (!confirm('Are you sure you want to delete this video?')) return;

    fetch(`/api/media/${filename}`, {
        method: 'DELETE'
    })
        .then(response => response.json())
        .then(result => {
            if (result.error) {
                throw new Error(result.error);
            }
            refreshMediaLibrary();
        })
        .catch(error => {
            console.error('Error deleting video:', error);
            showNotification('Error deleting video', 'error');
        });
}

// Add these functions for rename functionality
function showRenameModal(filename, displayName) {
    const modal = document.getElementById('renameModal');
    const input = document.getElementById('newFilename');
    const extension = filename.substring(filename.lastIndexOf('.'));
    const currentName = displayName.substring(0, displayName.lastIndexOf('.'));
    
    input.value = currentName;
    input.dataset.filename = filename;
    input.dataset.extension = extension;
    modal.classList.remove('hidden');
}

function hideRenameModal() {
    const modal = document.getElementById('renameModal');
    modal.classList.add('hidden');
}

async function renameFile() {
    const input = document.getElementById('newFilename');
    const oldName = input.dataset.filename;
    const newName = input.value + input.dataset.extension;

    try {
        const response = await fetch('/api/media/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                oldName: oldName,
                newName: newName
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error);
        }

        hideRenameModal();
        refreshMediaLibrary();
    } catch (error) {
        alert('Error renaming file: ' + error.message);
    }
}

// Add cookie toggle functionality
document.getElementById('useBrowserCookies').addEventListener('change', function(e) {
    const browserSelect = document.getElementById('browserSelect');
    browserSelect.style.display = e.target.checked ? 'block' : 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    checkAuth();

    const form = document.getElementById('downloadForm');
    if (!form) {
        console.error('Download form not found');
        return;
    }

    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const downloadProgress = document.getElementById('downloadProgress');
    const downloadLink = document.getElementById('downloadLink');
    let eventSource = null;

    // Handle logout
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
                    window.location.href = '/login.html';
                } else {
                    console.error('Logout failed');
                    showNotification('Logout failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                showNotification('Error during logout. Please try again.', 'error');
            }
        });
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get download button
        const downloadButton = document.getElementById('downloadBtn');
        const messageContainer = document.getElementById('downloadMessage');
        
        // Disable download button and update its text
        if (downloadButton) {
            downloadButton.disabled = true;
            downloadButton.textContent = 'Downloading...';
        }
        
        // Clear any previous messages
        if (messageContainer) {
            messageContainer.textContent = '';
            messageContainer.classList.remove('text-green-500', 'text-red-500');
        }
        
        // Get form values
        const urlInput = document.getElementById('youtubeUrl');
        const formatSelect = document.getElementById('format');
        const subtitlesCheckbox = document.getElementById('subtitles');

        // Validate inputs
        if (!urlInput || !formatSelect) {
            showNotification('Download form elements not found', 'error');
            return;
        }

        const url = urlInput.value.trim();
        const format = formatSelect.value;
        const includeSubtitles = subtitlesCheckbox ? subtitlesCheckbox.checked : false;

        // Validate URL
        if (!url) {
            showNotification('Please enter a YouTube URL', 'error');
            urlInput.focus();
            return;
        }

        // Basic URL validation
        const urlPattern = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
        if (!urlPattern.test(url)) {
            showNotification('Please enter a valid YouTube URL', 'error');
            urlInput.focus();
            return;
        }

        const formData = {
            url: url,
            format: format,
            includeSubtitles: includeSubtitles
        };

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                // Handle non-200 responses
                const errorText = await response.text();
                throw new Error(errorText || 'Download failed');
            }

            const data = await response.json();

            // Setup EventSource for progress tracking
            eventSource = new EventSource(`/api/download-progress/${data.downloadId}`);
            
            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Progress update:', data);
                    
                    if (data.type === 'complete') {
                        eventSource.close();
                        
                        // Show success message
                        if (messageContainer) {
                            messageContainer.textContent = 'Download Complete!';
                            messageContainer.classList.add('text-green-500');
                        }
                        
                        // Re-enable download button
                        if (downloadButton) {
                            downloadButton.disabled = false;
                            downloadButton.textContent = 'Download';
                        }
                        
                        // Create download button
                        const downloadLink = document.getElementById('downloadLink');
                        if (downloadLink) {
                            const downloadBtn = document.createElement('a');
                            downloadBtn.href = `/api/media/download/${encodeURIComponent(data.filename)}`;
                            //downloadBtn.textContent = 'Download Video';
                           // downloadBtn.className = 'inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700';
                            
                            downloadLink.innerHTML = '';
                            downloadLink.appendChild(downloadBtn);
                            downloadLink.style.display = 'block';
                        }
                    } else if (data.type === 'error') {
                        eventSource.close();
                        
                        // Show error message
                        if (messageContainer) {
                            messageContainer.textContent = `Download Error: ${data.message}`;
                            messageContainer.classList.add('text-red-500');
                        }
                        
                        // Re-enable download button
                        if (downloadButton) {
                            downloadButton.disabled = false;
                            downloadButton.textContent = 'Download';
                        }
                        
                        showNotification(`Download Error: ${data.message}`, 'error');
                    }
                } catch (parseError) {
                    console.error('Error parsing progress event:', parseError);
                    showNotification('Error processing download progress', 'error');
                }
            };

            eventSource.onerror = (error) => {
                console.error('EventSource error:', error);
                
                // Show error message
                if (messageContainer) {
                    messageContainer.textContent = 'Download connection lost';
                    messageContainer.classList.add('text-red-500');
                }
                
                // Re-enable download button
                if (downloadButton) {
                    downloadButton.disabled = false;
                    downloadButton.textContent = 'Download';
                }
                
                eventSource.close();
                showNotification('Download connection lost', 'error');
            };

        } catch (error) {
            console.error('Download error:', error);
            
            // Show error message
            if (messageContainer) {
                messageContainer.textContent = `Download Error: ${error.message}`;
                messageContainer.classList.add('text-red-500');
            }
            
            // Re-enable download button
            const downloadButton = document.getElementById('downloadBtn');
            if (downloadButton) {
                downloadButton.disabled = false;
                downloadButton.textContent = 'Download';
            }
            
            showNotification(`Download Error: ${error.message}`, 'error');
        }
    });

    refreshMediaLibrary();
});
