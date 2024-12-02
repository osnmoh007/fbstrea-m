// Client-side Authentication Utility

function checkAuthentication() {
    return fetch('/api/check-auth', {
        method: 'GET',
        credentials: 'include'
    }).then(response => {
        if (response.redirected) {
            // If redirected, it means not authenticated
            window.location.href = response.url;
            return false;
        }
        return response.ok;
    }).catch(error => {
        console.error('Authentication check failed:', error);
        return false;
    });
}

// Logout function
function logout() {
    fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
    }).then(response => {
        if (response.ok) {
            window.location.href = '/login.html';
        } else {
            console.error('Logout failed');
        }
    }).catch(error => {
        console.error('Logout error:', error);
    });
}

// Add logout event listener if logout button exists
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // Automatically check authentication on page load
    checkAuthentication().then(authenticated => {
        if (!authenticated) {
            window.location.href = '/login.html';
        }
    });
});
