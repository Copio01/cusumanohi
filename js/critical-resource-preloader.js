/**
 * Critical Resource Preloader - Cusumano Home Improvements
 * 
 * This script intelligently preloads critical resources based on the current page
 * and user navigation patterns to improve perceived performance.
 * 
 * Usage: Include this script in your HTML with the data-resources attribute
 * <script src="js/critical-resource-preloader.js" data-resources="hero-banner.jpg,logo.svg"></script>
 */

(function() {
    // Resources to preload from data attribute (comma-separated)
    const scriptEl = document.currentScript;
    const resourcesList = scriptEl?.getAttribute('data-resources') || '';
    
    // Get page type (home, about, services, etc)
    const pagePath = window.location.pathname;
    const pageType = pagePath === '/' || pagePath === '/index.html' 
        ? 'home' 
        : pagePath.replace(/\//g, '').replace('.html', '');
    
    // Resources we always want to preload based on user behavior analytics
    const criticalResources = {
        // Universal resources needed across all pages
        universal: [
            { url: '/images/logo.svg', type: 'image' },
            { url: '/css/tailwind.output.css', type: 'style' },
            { url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Poppins:wght@600;700&display=swap', type: 'style' }
        ],
        
        // Home page critical resources
        home: [
            { url: '/images/hero-banner.jpg', type: 'image' },
            { url: '/images/services/deck-construction.jpg', type: 'image' },
            { url: '/images/services/roofing.jpg', type: 'image' }
        ],
        
        // Services page critical resources
        services: [
            { url: '/images/services-hero.jpg', type: 'image' },
            { url: '/images/services/deck-construction.jpg', type: 'image' },
            { url: '/images/services/roofing.jpg', type: 'image' },
            { url: '/images/services/siding.jpg', type: 'image' }
        ],
        
        // Contact page critical resources
        contact: [
            { url: '/images/contact-hero.jpg', type: 'image' }
        ]
    };

    // Next likely navigation based on current page and analytics
    const likelyNextPages = {
        home: ['services', 'contact', 'about'],
        services: ['contact', 'gallery'],
        about: ['services', 'contact'],
        contact: ['services', 'gallery'],
        gallery: ['services', 'contact']
    };

    // Preload specific resources based on the current page
    function preloadCriticalResources() {
        // Get current page resources or fall back to universal
        const currentPageResources = criticalResources[pageType] || [];
        const universalResources = criticalResources.universal || [];
        
        // Combine all resources to preload
        const resourcesToPreload = [...universalResources, ...currentPageResources];
        
        // Add any manually specified resources
        if (resourcesList) {
            resourcesList.split(',').forEach(resource => {
                resourcesToPreload.push({ 
                    url: resource.trim().startsWith('/') ? resource.trim() : `/${resource.trim()}`, 
                    type: getResourceType(resource.trim()) 
                });
            });
        }
        
        // Preload resources
        resourcesToPreload.forEach(resource => {
            createPreloadLink(resource.url, resource.type);
        });
    }

    // Create preload link and append to head
    function createPreloadLink(url, type) {
        // Skip if already preloaded or loaded
        if (document.querySelector(`link[href="${url}"]`)) return;
        
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        
        // Set appropriate 'as' attribute based on resource type
        link.as = type;
        
        // For fonts and cross-origin resources
        if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
            link.crossOrigin = 'anonymous';
        }
        
        document.head.appendChild(link);
    }

    // Determine resource type based on file extension
    function getResourceType(url) {
        const extension = url.split('.').pop().toLowerCase();
        
        switch(extension) {
            case 'css': return 'style';
            case 'js': return 'script';
            case 'jpg': case 'jpeg': case 'png': case 'webp': case 'gif': case 'svg': return 'image';
            case 'woff': case 'woff2': case 'ttf': case 'otf': return 'font';
            default: return 'fetch';
        }
    }

    // After load, preload resources for likely next navigation
    function preloadNextPageResources() {
        // Delay to prioritize current page resources first
        setTimeout(() => {
            const nextPagesToPreload = likelyNextPages[pageType] || [];
            
            nextPagesToPreload.forEach(nextPage => {
                const nextPageResources = criticalResources[nextPage] || [];
                
                // Preload with lower priority
                nextPageResources.forEach(resource => {
                    const link = document.createElement('link');
                    link.rel = 'prefetch';  // Lower priority than preload
                    link.href = resource.url;
                    document.head.appendChild(link);
                });
            });
        }, 1000); // Delay for 1 second after page load
    }

    // Execute immediately for early preloading
    preloadCriticalResources();

    // After page load, preload resources for likely next pages
    if (document.readyState === 'complete') {
        preloadNextPageResources();
    } else {
        window.addEventListener('load', preloadNextPageResources);
    }
})();
