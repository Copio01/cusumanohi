# Cusumano Home Improvements Performance Tools

This document explains the performance optimization tools implemented for the Cusumano Home Improvements website and how to use them.

## Performance Testing

To test the performance improvements and measure the impact of optimizations, use the included performance testing tools:

1. Visit [performance-test.html](performance-test.html) in your browser
2. Run both the baseline and optimized tests
3. View the comparison of key performance metrics

### Testing Manually

You can also append URL parameters to any page to test performance:

- `?perf=baseline` - Disables optimizations to simulate pre-optimization performance
- `?perf=optimized` - Enables all optimizations (default mode)

Example: `index.html?perf=baseline`

## Performance Monitor

The real-time performance monitor shows key metrics during browsing:

1. Enable it by adding `?debug=true` to any URL
2. Or set `data-debug="true"` in the script tag in index.html
3. The monitor appears in the bottom-right corner showing:
   - FPS (Frames Per Second)
   - Page Load Time
   - LCP (Largest Contentful Paint)
   - CLS (Cumulative Layout Shift)
   - FID (First Input Delay)
   - Memory Usage

## Optimization Features

The website includes several performance optimizations:

### 1. Critical CSS Inlining
Critical styles are inlined in the HTML head for immediate rendering of above-the-fold content, while non-critical styles load asynchronously.

### 2. Resource Preloading
Key resources (hero images, logo, etc.) are preloaded based on their priority and the current page context.

### 3. Service Worker Caching
Assets are cached for offline use and faster subsequent page loads through a sophisticated service worker implementation.

### 4. Intelligent Image Loading
Images load intelligently based on:
- Viewport visibility (lazy loading)
- Device screen size and pixel density
- Connection speed
- Priority in the visual hierarchy

### 5. Script Loading Optimization
Scripts are categorized and loaded according to their priority:
- Critical scripts: Inline or high priority
- Important but non-blocking: Async
- Enhancement scripts: Defer

### 6. Performance Monitoring
Built-in tools for monitoring and improving performance over time.

## Files and Their Purposes

- `js/performance-monitor.js` - Real-time performance monitoring overlay
- `js/performance-benchmark.js` - A/B testing tool for comparing optimized vs. baseline
- `js/optimization-toggle.js` - Enables/disables optimizations based on URL parameters
- `js/critical-resource-preloader.js` - Preloads critical resources
- `js/intelligent-image-loader.js` - Optimizes image loading
- `js/sw-register.js` - Registers the service worker
- `sw.js` - Service worker implementation for caching and offline support
- `performance-test.html` - Interface for running performance tests

## Development Guidelines

When making changes to the site, follow these guidelines to maintain performance:

1. Keep critical CSS minimal
2. Use appropriate `async` and `defer` attributes for scripts
3. Optimize images before adding them to the site
4. Test performance impact of major changes
5. Regularly run the performance tests to ensure optimizations remain effective
