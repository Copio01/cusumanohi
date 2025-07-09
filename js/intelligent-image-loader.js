/**
 * Intelligent Image Loader - Cusumano Home Improvements
 * 
 * This script optimizes image loading by:
 * 1. Using native lazy loading for images below the fold
 * 2. Loading proper resolution images based on screen size and device pixel ratio
 * 3. Progressively loading images with blur-up technique for better UX
 * 4. Automatically applying WebP with fallback for older browsers
 * 
 * Usage: Initialize after DOM content is loaded:
 * document.addEventListener('DOMContentLoaded', () => {
 *   new IntelligentImageLoader().init();
 * });
 */

class IntelligentImageLoader {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            lazyLoadSelector: 'img:not([loading="eager"])',
            threshold: 0.1,
            placeholderColor: '#f1f5f9',
            enableWebP: true,
            lowQualityPreview: true,
            ...options
        };
        
        // Store references to images being processed
        this.images = [];
        
        // Feature detection
        this.supportsWebP = false;
        this.supportsIntersectionObserver = 'IntersectionObserver' in window;
        this.supportsNativeLazy = 'loading' in HTMLImageElement.prototype;
    }
    
    /**
     * Initialize the image loader
     */
    init() {
        // Check for WebP support
        this.detectWebP().then(supported => {
            this.supportsWebP = supported && this.config.enableWebP;
            
            // Process images
            this.setupImages();
            
            // Setup intersection observer for non-native lazy loading
            if (!this.supportsNativeLazy && this.supportsIntersectionObserver) {
                this.setupIntersectionObserver();
            }
        });
        
        // Listen for DOM changes to process new images
        this.observeDOMChanges();
    }
    
    /**
     * Setup all images on the page
     */
    setupImages() {
        const images = document.querySelectorAll(this.config.lazyLoadSelector);
        
        images.forEach(img => {
            // Skip already processed images
            if (img.dataset.processed === 'true') return;
            
            // Add to tracked images
            this.images.push(img);
            
            // Mark as processed
            img.dataset.processed = 'true';
            
            // Get optimal image source based on screen size and pixel density
            const optimizedSrc = this.getOptimalImageSrc(img);
            
            if (this.supportsNativeLazy) {
                // Use native lazy loading when available
                img.loading = 'lazy';
                
                // Apply optimized source if available
                if (optimizedSrc) {
                    img.src = optimizedSrc;
                }
                
                // Apply low quality preview if enabled
                if (this.config.lowQualityPreview && img.dataset.src) {
                    this.applyLowQualityPreview(img);
                }
            } else if (this.supportsIntersectionObserver) {
                // Use Intersection Observer for lazy loading
                this.prepareForLazyLoading(img, optimizedSrc);
            } else {
                // Fallback for older browsers - load immediately
                if (optimizedSrc) {
                    img.src = optimizedSrc;
                } else if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
            }
        });
    }
    
    /**
     * Setup intersection observer for lazy loading
     */
    setupIntersectionObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // Load the image
                    this.loadImage(img);
                    
                    // Stop observing this image
                    this.observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: this.config.threshold
        });
        
        // Observe all tracked images
        this.images.forEach(img => {
            if (!img.complete) {
                this.observer.observe(img);
            }
        });
    }
    
    /**
     * Prepare image for lazy loading
     */
    prepareForLazyLoading(img, optimizedSrc) {
        // Save original src
        if (!img.dataset.src && img.src) {
            img.dataset.src = img.src;
        }
        
        // Create a placeholder
        img.style.backgroundColor = this.config.placeholderColor;
        
        // Apply low quality preview if enabled
        if (this.config.lowQualityPreview) {
            this.applyLowQualityPreview(img);
        } else {
            // Remove src to prevent loading
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
        }
        
        // Store optimized src for later use
        if (optimizedSrc) {
            img.dataset.optimizedSrc = optimizedSrc;
        }
    }
    
    /**
     * Apply a low quality preview of the image
     */
    applyLowQualityPreview(img) {
        // Use tiny placeholder or data-placeholder if available
        if (img.dataset.placeholder) {
            img.src = img.dataset.placeholder;
        } else {
            // Create SVG placeholder with image dimensions
            const width = img.width || 100;
            const height = img.height || 100;
            img.src = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"%3E%3C/svg%3E`;
        }
        
        // Apply blur effect
        img.style.filter = 'blur(10px)';
        img.style.transition = 'filter 0.3s ease-out';
    }
    
    /**
     * Load the image when it comes into view
     */
    loadImage(img) {
        // Create a new image to load in background
        const newImg = new Image();
        
        // When image loads, replace src and remove blur
        newImg.onload = () => {
            img.src = newImg.src;
            img.style.filter = '';
            
            // Dispatch custom event
            img.dispatchEvent(new CustomEvent('imageLoaded'));
        };
        
        // Load optimized source if available, otherwise original source
        newImg.src = img.dataset.optimizedSrc || img.dataset.src || img.src;
    }
    
    /**
     * Get optimal image source based on screen size and pixel ratio
     */
    getOptimalImageSrc(img) {
        // Check if we have responsive images defined
        if (!img.dataset.srcset && !img.dataset.sizes) {
            // Check for WebP alternative
            if (this.supportsWebP && img.dataset.webp) {
                return img.dataset.webp;
            }
            return null;
        }
        
        // Get device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        
        // Get viewport width
        const viewportWidth = window.innerWidth;
        
        // Parse srcset
        const srcset = img.dataset.srcset;
        if (!srcset) return null;
        
        const sources = srcset.split(',').map(src => {
            const [url, width] = src.trim().split(' ');
            return {
                url: url.trim(),
                width: parseInt(width.replace('w', ''))
            };
        });
        
        // Find the best match
        let bestMatch = null;
        let bestWidth = 0;
        
        sources.forEach(source => {
            // Target width based on viewport and pixel density
            const targetWidth = viewportWidth * dpr;
            
            // Check if this source is better than current best
            if (source.width >= targetWidth && (!bestMatch || source.width < bestWidth)) {
                bestMatch = source;
                bestWidth = source.width;
            }
        });
        
        // If no match above target, use the largest
        if (!bestMatch) {
            bestMatch = sources.reduce((prev, current) => 
                (current.width > prev.width) ? current : prev
            );
        }
        
        // If WebP is supported, try to find WebP version
        if (this.supportsWebP) {
            // Check for WebP specific srcset
            if (img.dataset.srcsetWebp) {
                const webpSources = img.dataset.srcsetWebp.split(',').map(src => {
                    const [url, width] = src.trim().split(' ');
                    return {
                        url: url.trim(),
                        width: parseInt(width.replace('w', ''))
                    };
                });
                
                const webpMatch = webpSources.find(src => src.width === bestMatch.width);
                if (webpMatch) {
                    return webpMatch.url;
                }
            }
            
            // Try to generate WebP URL
            const webpUrl = bestMatch.url.replace(/\.(jpe?g|png)$/i, '.webp');
            return webpUrl;
        }
        
        return bestMatch.url;
    }
    
    /**
     * Detect WebP support
     */
    detectWebP() {
        return new Promise(resolve => {
            const webP = new Image();
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
            webP.onload = webP.onerror = () => {
                resolve(webP.height === 2);
            };
        });
    }
    
    /**
     * Observe DOM changes to process new images
     */
    observeDOMChanges() {
        // Use MutationObserver to detect new images added to the DOM
        if ('MutationObserver' in window) {
            const observer = new MutationObserver(mutations => {
                let hasNewImages = false;
                
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        const newImages = Array.from(mutation.addedNodes).filter(node => {
                            // Check if node is an element and matches our selector
                            return node.nodeType === 1 && 
                                   (node.matches?.(this.config.lazyLoadSelector) || 
                                    node.querySelectorAll?.(this.config.lazyLoadSelector).length > 0);
                        });
                        
                        if (newImages.length > 0) {
                            hasNewImages = true;
                        }
                    }
                });
                
                // Process new images if found
                if (hasNewImages) {
                    this.setupImages();
                }
            });
            
            observer.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
        }
    }
}

// Auto initialize if script has data-auto-init attribute
if (document.currentScript.hasAttribute('data-auto-init')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new IntelligentImageLoader().init();
        });
    } else {
        new IntelligentImageLoader().init();
    }
}
