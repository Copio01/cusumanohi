/**
 * Performance Monitor - Cusumano Home Improvements
 * 
 * This script creates a small overlay that displays real-time performance metrics
 * to help identify potential bottlenecks during development.
 * 
 * Usage: Include this script in your HTML with the data-debug attribute to enable it only in development:
 * <script src="js/performance-monitor.js" data-debug="true"></script>
 */

(function() {
    // Only run in development mode if data-debug attribute is set
    const debugMode = document.currentScript.getAttribute('data-debug') === 'true';
    if (!debugMode && !location.search.includes('debug=true')) return;

    // Create performance monitor element
    const perfMonitor = document.createElement('div');
    perfMonitor.id = 'perf-monitor';
    perfMonitor.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: #4ade80;
        font-family: monospace;
        padding: 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 9999;
        user-select: none;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        transition: opacity 0.3s;
        max-width: 300px;
    `;

    // Initial metrics
    perfMonitor.innerHTML = `
        <div><strong>⚡ Performance Monitor</strong></div>
        <div>FPS: <span id="fps">--</span></div>
        <div>Load: <span id="load-time">--</span></div>
        <div>LCP: <span id="lcp">--</span></div>
        <div>CLS: <span id="cls">--</span></div>
        <div>FID: <span id="fid">--</span></div>
        <div>Memory: <span id="memory">--</span></div>
    `;

    // Add to body after it's loaded
    if (document.body) {
        document.body.appendChild(perfMonitor);
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            document.body.appendChild(perfMonitor);
        });
    }

    // Variables for FPS calculation
    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;

    // Metrics elements
    let fpsEl, loadTimeEl, lcpEl, clsEl, fidEl, memoryEl;

    // Initialize after DOM is ready
    window.addEventListener('DOMContentLoaded', () => {
        fpsEl = document.getElementById('fps');
        loadTimeEl = document.getElementById('load-time');
        lcpEl = document.getElementById('lcp');
        clsEl = document.getElementById('cls');
        fidEl = document.getElementById('fid');
        memoryEl = document.getElementById('memory');

        // Report initial load time
        loadTimeEl.textContent = `${Math.round(performance.now())}ms`;
        
        // Setup Web Vitals monitoring
        setupWebVitals();
        
        // Setup FPS and memory monitoring
        requestAnimationFrame(updateMetrics);
        
        // Add toggle functionality
        perfMonitor.addEventListener('click', () => {
            perfMonitor.style.opacity = perfMonitor.style.opacity === '0.3' ? '1' : '0.3';
        });
        
        // Initially dim the monitor
        setTimeout(() => {
            perfMonitor.style.opacity = '0.3';
        }, 3000);
    });

    // Update FPS and memory usage
    function updateMetrics(timestamp) {
        // Calculate FPS
        frames++;
        if (timestamp - lastTime >= 1000) {
            fps = Math.round((frames * 1000) / (timestamp - lastTime));
            frames = 0;
            lastTime = timestamp;
            
            if (fpsEl) {
                fpsEl.textContent = fps;
                fpsEl.style.color = fps < 30 ? '#f87171' : fps < 50 ? '#facc15' : '#4ade80';
            }
            
            // Update memory if available
            if (memoryEl && performance.memory) {
                const memoryUsed = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
                memoryEl.textContent = `${memoryUsed}MB / ${Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024))}MB`;
                memoryEl.style.color = memoryUsed > 100 ? '#f87171' : '#4ade80';
            }
        }
        
        requestAnimationFrame(updateMetrics);
    }

    // Setup Web Vitals monitoring
    function setupWebVitals() {
        // LCP - Largest Contentful Paint
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            const lcp = Math.round(lastEntry.startTime);
            if (lcpEl) {
                lcpEl.textContent = `${lcp}ms`;
                lcpEl.style.color = lcp > 2500 ? '#f87171' : lcp > 1800 ? '#facc15' : '#4ade80';
            }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // CLS - Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            }
            if (clsEl) {
                clsEl.textContent = clsValue.toFixed(3);
                clsEl.style.color = clsValue > 0.1 ? '#f87171' : clsValue > 0.05 ? '#facc15' : '#4ade80';
            }
        }).observe({ type: 'layout-shift', buffered: true });

        // FID - First Input Delay
        new PerformanceObserver((entryList) => {
            const firstInput = entryList.getEntries()[0];
            if (firstInput) {
                const fid = Math.round(firstInput.processingStart - firstInput.startTime);
                if (fidEl) {
                    fidEl.textContent = `${fid}ms`;
                    fidEl.style.color = fid > 100 ? '#f87171' : fid > 50 ? '#facc15' : '#4ade80';
                }
            }
        }).observe({ type: 'first-input', buffered: true });
    }
})();
