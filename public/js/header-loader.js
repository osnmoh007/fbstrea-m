// Add the logout handler function to window scope
window.handleLogout = async function() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        });

        if (response.ok) {
            window.location.href = '/login.html';
        } else {
            console.error('Logout failed');
        }
    } catch (error) {
        console.error('Error during logout:', error);
    }
};

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        
        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        if (error.name !== 'TypeError') {
            window.location.href = '/login.html';
        }
    }
}

// Function to toggle mobile menu
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    
    if (!mobileMenu.classList.contains('open')) {
        // Open menu
        mobileMenu.classList.add('open');
        mobileMenuOverlay.classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    } else {
        // Close menu
        mobileMenu.classList.remove('open');
        mobileMenuOverlay.classList.remove('open');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check authentication first
        await checkAuth();

        // Load header
        const response = await fetch('/components/header.html');
        const headerHtml = await response.text();
        
        // Insert the header at the start of the body
        const bodyElement = document.body;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = headerHtml;
        bodyElement.insertBefore(tempDiv.firstChild, bodyElement.firstChild);

        // Add mobile menu click handlers
        const mobileMenuButton = document.getElementById('mobileMenuButton');
        const closeMobileMenu = document.getElementById('closeMobileMenu');
        const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
        
        if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', toggleMobileMenu);
        }
        
        if (closeMobileMenu) {
            closeMobileMenu.addEventListener('click', toggleMobileMenu);
        }
        
        if (mobileMenuOverlay) {
            mobileMenuOverlay.addEventListener('click', toggleMobileMenu);
        }

        // Close menu on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const mobileMenu = document.getElementById('mobileMenu');
                if (mobileMenu && mobileMenu.classList.contains('open')) {
                    toggleMobileMenu();
                }
            }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            const mobileMenu = document.getElementById('mobileMenu');
            const mobileMenuButton = document.getElementById('mobileMenuButton');
            
            if (!mobileMenu || !mobileMenuButton) return;
            
            if (!mobileMenu.contains(event.target) && 
                !mobileMenuButton.contains(event.target) && 
                !mobileMenu.classList.contains('hidden')) {
                // Removed toggleMobileMenu() call here
            }
        });

        // Check dark mode preference on page load
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        // Update icons visibility based on current mode
        const sunIcons = document.querySelectorAll('.fas.fa-sun');
        const moonIcons = document.querySelectorAll('.fas.fa-moon');
        if (darkMode) {
            sunIcons.forEach(icon => icon.classList.add('hidden'));
            moonIcons.forEach(icon => icon.classList.remove('hidden'));
        } else {
            sunIcons.forEach(icon => icon.classList.remove('hidden'));
            moonIcons.forEach(icon => icon.classList.add('hidden'));
        }

        // Add dark mode toggle event listeners
        const darkModeToggles = document.querySelectorAll('#darkModeToggle, #darkModeToggleMobile');
        darkModeToggles.forEach(toggle => {
            toggle.addEventListener('click', function() {
                // Add spinning animation
                this.classList.add('spinning');
                setTimeout(() => this.classList.remove('spinning'), 500);

                // Toggle dark mode
                document.documentElement.classList.toggle('dark');
                const isDark = document.documentElement.classList.contains('dark');
                localStorage.setItem('darkMode', isDark);

                // Update sun/moon icons
                const sunIcons = this.querySelectorAll('.fa-sun');
                const moonIcons = this.querySelectorAll('.fa-moon');
                sunIcons.forEach(icon => icon.classList.toggle('hidden'));
                moonIcons.forEach(icon => icon.classList.toggle('hidden'));
            });
        });

        // Logout button event listeners
        const logoutButtons = document.querySelectorAll('#logoutButton, #logoutButtonMobile');
        logoutButtons.forEach(button => {
            button.addEventListener('click', window.handleLogout);
        });
    } catch (error) {
        console.error('Error loading header:', error);
    }
});
