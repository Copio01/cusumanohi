/**
 * Service Worker Registration - Cusumano Home Improvements
 * 
 * This script registers a service worker for offline capabilities and resource caching
 * to improve performance and provide offline functionality.
 * 
 * Usage: Include this script at the end of your HTML before closing body tag.
 * <script src="js/sw-register.js"></script>
 */

(function() {
    // Check if service workers are supported
    if ('serviceWorker' in navigator) {
        // Wait for the page to load to avoid competing for resources
        window.addEventListener('load', () => {
            // Register the service worker
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                    
                    // Check for updates on page load
                    registration.update();
                    
                    // Handle service worker updates
                    handleServiceWorkerUpdates(registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }

    /**
     * Handle service worker updates
     * Show a notification to the user when a new version is available
     */
    function handleServiceWorkerUpdates(registration) {
        // When a new service worker is installed and waiting
        registration.addEventListener('updatefound', () => {
            // Get the installing service worker
            const newWorker = registration.installing;
            
            // Listen for state changes
            newWorker.addEventListener('statechange', () => {
                // When the new service worker is installed and waiting
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Show update notification to user
                    showUpdateNotification();
                }
            });
        });
        
        // Listen for controllerchange events
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            // Only reload if we haven't already done so
            if (!window.isReloading) {
                window.isReloading = true;
                window.location.reload();
            }
        });
    }

    /**
     * Show notification to user about new content
     */
    function showUpdateNotification() {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-notification-content">
                <p>A new version of this site is available!</p>
                <button id="update-button">Update Now</button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #0a4d68;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 9999;
            font-family: 'Poppins', sans-serif;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            max-width: 90%;
            animation: slide-up 0.3s ease-out;
        `;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Add button styles and event listener
        const updateButton = document.getElementById('update-button');
        if (updateButton) {
            updateButton.style.cssText = `
                background-color: #fff;
                color: #0a4d68;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                margin-left: 16px;
                cursor: pointer;
                font-weight: bold;
                transition: background-color 0.2s;
            `;
            
            // Add hover effect
            updateButton.addEventListener('mouseover', () => {
                updateButton.style.backgroundColor = '#f1f5f9';
            });
            
            updateButton.addEventListener('mouseout', () => {
                updateButton.style.backgroundColor = '#fff';
            });
            
            // Update button click handler
            updateButton.addEventListener('click', () => {
                // Prevent multiple reloads
                if (!window.isReloading) {
                    window.isReloading = true;
                    
                    // Skip waiting to activate new service worker
                    navigator.serviceWorker.ready.then(registration => {
                        if (registration.waiting) {
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                        } else {
                            // If no waiting worker, just reload
                            window.location.reload();
                        }
                    });
                }
            });
        }
        
        // Add @keyframes for animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slide-up {
                from {
                    transform: translate(-50%, 100px);
                    opacity: 0;
                }
                to {
                    transform: translate(-50%, 0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
})();
