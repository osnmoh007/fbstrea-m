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

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication first
    checkAuth();

    const form = document.getElementById('downloadForm');
    if (!form) {
        console.error('Download form not found');
        return;
    }

    // Add cookie toggle and upload handling
    const useCookiesToggle = document.getElementById('useCookies');
    const cookieUploadSection = document.getElementById('cookieUploadSection');
    const cookieFileInput = document.getElementById('cookieFile');
    const uploadCookieBtn = document.getElementById('uploadCookieBtn');
    const deleteCookieBtn = document.getElementById('deleteCookieBtn');
    const cookieStatus = document.getElementById('cookieStatus');

    // Check if cookies file exists on load
    checkCookieStatus();

    // Toggle cookie upload section visibility
    useCookiesToggle.addEventListener('change', () => {
        cookieUploadSection.classList.toggle('hidden', !useCookiesToggle.checked);
        if (useCookiesToggle.checked) {
            checkCookieStatus();
        }
    });

    // Handle cookie file upload button click
    uploadCookieBtn.addEventListener('click', () => {
        cookieFileInput.click();
    });

    // Handle cookie file selection
    cookieFileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.name.endsWith('.txt')) {
                const formData = new FormData();
                formData.append('cookieFile', file);

                try {
                    const response = await fetch('/api/upload-cookies', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();
                    if (result.success) {
                        showNotification('Cookie file uploaded successfully', 'success');
                        checkCookieStatus();
                    } else {
                        throw new Error(result.message);
                    }
                } catch (error) {
                    console.error('Error uploading cookie file:', error);
                    showNotification('Error uploading cookie file', 'error');
                }
            } else {
                showNotification('Please select a valid .txt file', 'error');
            }
            e.target.value = ''; // Reset file input
        }
    });

    // Handle cookie file deletion
    deleteCookieBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/delete-cookies', {
                method: 'POST'
            });

            const result = await response.json();
            if (result.success) {
                showNotification('Cookie file deleted successfully', 'success');
                checkCookieStatus();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error deleting cookie file:', error);
            showNotification('Error deleting cookie file', 'error');
        }
    });

    // Function to check cookie file status
    async function checkCookieStatus() {
        try {
            const response = await fetch('/api/check-cookies');
            const result = await response.json();
            
            if (result.exists) {
                cookieStatus.textContent = '(Cookie file uploaded)';
                cookieStatus.classList.add('text-green-600', 'dark:text-green-400');
                deleteCookieBtn.classList.remove('hidden');
                uploadCookieBtn.innerHTML = '<i class="fas fa-upload mr-2"></i>Replace cookies.txt';
            } else {
                cookieStatus.textContent = '(No cookie file)';
                cookieStatus.classList.remove('text-green-600', 'dark:text-green-400');
                deleteCookieBtn.classList.add('hidden');
                uploadCookieBtn.innerHTML = '<i class="fas fa-upload mr-2"></i>Upload cookies.txt';
            }
        } catch (error) {
            console.error('Error checking cookie status:', error);
        }
    }

    // Modify the form submission to handle downloads without progress
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const url = document.getElementById('youtubeUrl').value;
        const format = document.getElementById('format').value;
        const includeSubtitles = document.getElementById('subtitles').checked;
        const useCookies = document.getElementById('useCookies').checked;
        const downloadButton = document.getElementById('downloadBtn');
        const messageContainer = document.getElementById('downloadMessage');

        if (!url) {
            showNotification('Please enter a YouTube URL', 'error');
            return;
        }

        try {
            // Update UI to show downloading state
            downloadButton.disabled = true;
            downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Downloading...';
            messageContainer.textContent = 'Downloading video...';
            messageContainer.className = 'text-blue-500';

            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url,
                    format,
                    includeSubtitles,
                    useCookies
                })
            });

            const result = await response.json();

            if (result.success) {
                // Show success message
                messageContainer.textContent = 'Download Complete!';
                messageContainer.className = 'text-green-500';

                // Refresh media library
                refreshMediaLibrary();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Download error:', error);
            messageContainer.textContent = `Download Error: ${error.message}`;
            messageContainer.className = 'text-red-500';
            showNotification(`Download Error: ${error.message}`, 'error');
        } finally {
            // Reset download button
            downloadButton.disabled = false;
            downloadButton.innerHTML = '<i class="fas fa-download mr-2"></i>Download';
        }
    });

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

    refreshMediaLibrary();
});
