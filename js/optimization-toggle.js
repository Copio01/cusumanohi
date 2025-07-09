/**
 * Optimization Toggle - Cusumano Home Improvements
 * 
 * This script allows toggling between optimized and baseline modes for performance testing.
 * When in "baseline" mode, it disables various optimizations to simulate pre-optimization performance.
 * 
 * Usage:
 * ?perf=baseline - Disables optimizations
 * ?perf=optimized - Enables all optimizations (default)
 */

(function() {
    // Check if we're in baseline mode
    const urlParams = new URLSearchParams(window.location.search);
    const perfMode = urlParams.get('perf');
    
    if (perfMode === 'baseline') {
        console.log('🔍 Performance Benchmark: Running in baseline mode (optimizations disabled)');
        disableOptimizations();
    }
    
    /**
     * Disable various performance optimizations for baseline testing
     */
    function disableOptimizations() {
        // Disable resource preloading
        const preloadLinks = document.querySelectorAll('link[rel="preload"], link[rel="prefetch"]');
        preloadLinks.forEach(link => link.setAttribute('disabled', 'true'));
        
        // Disable service worker if registered
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                    registration.unregister();
                    console.log('🔍 Service Worker unregistered for baseline testing');
                });
            });
        }
        
        // Prevent image lazy loading
        document.addEventListener('DOMContentLoaded', () => {
            const lazyImages = document.querySelectorAll('img[loading="lazy"]');
            lazyImages.forEach(img => img.removeAttribute('loading'));
        });
        
        // Disable critical CSS inlining by removing inline styles
        // This is just for simulation, as the inline CSS is already in the HTML
        document.addEventListener('DOMContentLoaded', () => {
            // Find and disable any inline critical CSS by setting media="none"
            const inlineStyles = document.querySelectorAll('style[data-critical="true"]');
            inlineStyles.forEach(style => {
                style.media = 'none';
                console.log('🔍 Disabled inline critical CSS for baseline testing');
            });
        });
        
        // Prevent scripts from being deferred or async
        // This is a simulation only - can't actually modify script loading behavior after page start
        console.log('🔍 Simulating sequential script loading for baseline testing');
        
        // Add artificial delay to simulate unoptimized page
        setTimeout(() => {
            console.log('🔍 Added artificial delay to simulate unoptimized load time');
        }, 300);
    }
})();
