// Function to show notifications
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

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

// Export the function for use in other files
window.showNotification = showNotification;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize any page-specific functionality here
    console.log('Index page loaded');
});
