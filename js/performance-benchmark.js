/**
 * Performance Benchmark Tool - Cusumano Home Improvements
 * 
 * This script measures and compares website performance metrics to quantify
 * the impact of performance optimizations. It can run in two modes:
 * 1. "baseline" - Before optimizations (use ?perf=baseline)
 * 2. "optimized" - After optimizations (use ?perf=optimized)
 * 
 * Results are stored in localStorage for comparison.
 */

class PerformanceBenchmark {
    constructor() {
        this.mode = new URLSearchParams(window.location.search).get('perf') || 'optimized';
        this.results = {
            timeToFirstByte: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0, 
            domInteractive: 0,
            domComplete: 0,
            resourceLoadTime: 0,
            totalBlockingTime: 0,
            cumulativeLayoutShift: 0
        };
        
        this.resultsHistory = this.loadResults();
        this.layoutShiftScore = 0;
        this.blockingTime = 0;
        this.resourceTimings = [];
        this.initialized = false;
        
        // LCP observer
        this.lcpObserver = new PerformanceObserver(entryList => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.results.largestContentfulPaint = lastEntry.startTime;
        });
        
        // Layout shift observer
        this.clsObserver = new PerformanceObserver(entryList => {
            for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                    this.layoutShiftScore += entry.value;
                    this.results.cumulativeLayoutShift = this.layoutShiftScore;
                }
            }
        });
        
        // Long task observer for Total Blocking Time
        this.longTaskObserver = new PerformanceObserver(entryList => {
            for (const entry of entryList.getEntries()) {
                // Any task over 50ms is considered "blocking"
                const blockingTime = entry.duration - 50;
                if (blockingTime > 0) {
                    this.blockingTime += blockingTime;
                    this.results.totalBlockingTime = this.blockingTime;
                }
            }
        });
        
        // Resource timing observer
        this.resourceObserver = new PerformanceObserver(entryList => {
            this.resourceTimings = this.resourceTimings.concat(entryList.getEntries());
        });
    }
    
    /**
     * Initialize the benchmark
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        
        console.log(`🔍 Performance Benchmark: Running in "${this.mode}" mode`);
        
        // Start observers
        try {
            this.lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
            this.clsObserver.observe({ type: 'layout-shift', buffered: true });
            this.longTaskObserver.observe({ type: 'longtask', buffered: true });
            this.resourceObserver.observe({ type: 'resource', buffered: true });
        } catch (e) {
            console.warn('PerformanceObserver not fully supported:', e);
        }
        
        // Collect basic metrics when page finishes loading
        window.addEventListener('load', () => {
            setTimeout(() => this.collectMetrics(), 1000);
        });
        
        // Create UI for displaying results
        this.createUI();
        
        return this;
    }
    
    /**
     * Collect all available performance metrics
     */
    collectMetrics() {
        const navEntry = performance.getEntriesByType('navigation')[0];
        
        if (navEntry) {
            this.results.timeToFirstByte = navEntry.responseStart;
            this.results.domInteractive = navEntry.domInteractive;
            this.results.domComplete = navEntry.domComplete;
        }
        
        // First Contentful Paint
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
            this.results.firstContentfulPaint = fcpEntry.startTime;
        }
        
        // Resource load times
        this.results.resourceLoadTime = this.calculateResourceLoadTime();
        
        // Store results and update UI
        this.saveResults();
        this.updateUI();
        
        // Disconnect observers to stop collecting data
        this.lcpObserver.disconnect();
        this.clsObserver.disconnect();
        this.longTaskObserver.disconnect();
        this.resourceObserver.disconnect();
        
        console.log('📊 Performance Benchmark: Metrics collected', this.results);
    }
    
    /**
     * Calculate the total resource load time
     */
    calculateResourceLoadTime() {
        if (this.resourceTimings.length === 0) return 0;
        
        // Filter out non-critical resources
        const criticalResources = this.resourceTimings.filter(resource => {
            const url = resource.name;
            return (
                url.endsWith('.css') || 
                url.endsWith('.js') ||
                url.includes('/images/') ||
                url.includes('/fonts/')
            );
        });
        
        if (criticalResources.length === 0) return 0;
        
        // Calculate the time difference between the first request and the last response
        const startTime = Math.min(...criticalResources.map(r => r.startTime));
        const endTime = Math.max(...criticalResources.map(r => r.responseEnd));
        
        return endTime - startTime;
    }
    
    /**
     * Save results to localStorage
     */
    saveResults() {
        const results = this.resultsHistory || {};
        results[this.mode] = this.results;
        results.lastUpdated = new Date().toISOString();
        
        try {
            localStorage.setItem('cusumanoPerformanceBenchmark', JSON.stringify(results));
        } catch (e) {
            console.warn('Could not save benchmark results to localStorage:', e);
        }
    }
    
    /**
     * Load results from localStorage
     */
    loadResults() {
        try {
            const stored = localStorage.getItem('cusumanoPerformanceBenchmark');
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.warn('Could not load benchmark results from localStorage:', e);
            return {};
        }
    }
    
    /**
     * Create UI for displaying results
     */
    createUI() {
        const container = document.createElement('div');
        container.id = 'performance-benchmark';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #fff;
            font-family: monospace;
            padding: 15px;
            border-radius: 5px;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            transition: transform 0.3s;
            transform: translateX(${this.mode === 'baseline' ? '0' : '420px'});
        `;
        
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <h3 style="margin: 0; color: ${this.mode === 'baseline' ? '#f87171' : '#4ade80'};">
                    ${this.mode === 'baseline' ? '🔴 Baseline' : '🟢 Optimized'} Performance
                </h3>
                <button id="toggle-benchmark" style="background: none; border: none; color: #fff; cursor: pointer;">
                    ${this.mode === 'baseline' ? '➡️' : '⬅️'}
                </button>
            </div>
            <div id="benchmark-metrics">
                <div>Collecting metrics...</div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Add event listener to toggle button
        document.getElementById('toggle-benchmark').addEventListener('click', () => {
            const position = container.style.transform;
            container.style.transform = position.includes('0px') ? 'translateX(420px)' : 'translateX(0)';
        });
    }
    
    /**
     * Update the UI with collected metrics
     */
    updateUI() {
        const metricsContainer = document.getElementById('benchmark-metrics');
        if (!metricsContainer) return;
        
        const baseline = this.resultsHistory.baseline || {};
        const optimized = this.resultsHistory.optimized || {};
        const current = this.results;
        
        let comparisonHtml = '';
        
        // Function to calculate improvement percentage
        const improvementPercent = (baseline, optimized) => {
            if (!baseline || !optimized) return null;
            const percent = ((baseline - optimized) / baseline * 100).toFixed(1);
            return parseFloat(percent);
        };
        
        // Function to format a metric row with comparison
        const formatMetricRow = (label, baselineValue, optimizedValue, unit = 'ms') => {
            const improvement = improvementPercent(baselineValue, optimizedValue);
            const hasImprovement = improvement !== null;
            
            return `
                <tr>
                    <td style="padding: 4px 0; color: #e2e8f0;">${label}</td>
                    <td style="padding: 4px 8px; text-align: right;">
                        ${baselineValue ? baselineValue.toFixed(1) + unit : '—'}
                    </td>
                    <td style="padding: 4px 8px; text-align: right;">
                        ${optimizedValue ? optimizedValue.toFixed(1) + unit : '—'}
                    </td>
                    <td style="padding: 4px 0; text-align: right; color: ${hasImprovement ? (improvement > 0 ? '#4ade80' : '#f87171') : '#e2e8f0'}">
                        ${hasImprovement ? (improvement > 0 ? '▼' : '▲') + Math.abs(improvement) + '%' : '—'}
                    </td>
                </tr>
            `;
        };
        
        comparisonHtml = `
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <tr>
                    <th style="text-align: left; padding: 4px 0;">Metric</th>
                    <th style="text-align: right; padding: 4px 8px;">Baseline</th>
                    <th style="text-align: right; padding: 4px 8px;">Optimized</th>
                    <th style="text-align: right; padding: 4px 0;">Diff</th>
                </tr>
                ${formatMetricRow('Time to First Byte', baseline.timeToFirstByte, optimized.timeToFirstByte)}
                ${formatMetricRow('First Contentful Paint', baseline.firstContentfulPaint, optimized.firstContentfulPaint)}
                ${formatMetricRow('Largest Contentful Paint', baseline.largestContentfulPaint, optimized.largestContentfulPaint)}
                ${formatMetricRow('DOM Interactive', baseline.domInteractive, optimized.domInteractive)}
                ${formatMetricRow('DOM Complete', baseline.domComplete, optimized.domComplete)}
                ${formatMetricRow('Resource Load Time', baseline.resourceLoadTime, optimized.resourceLoadTime)}
                ${formatMetricRow('Total Blocking Time', baseline.totalBlockingTime, optimized.totalBlockingTime)}
                ${formatMetricRow('Cumulative Layout Shift', baseline.cumulativeLayoutShift, optimized.cumulativeLayoutShift, '')}
            </table>
            <div style="margin-top: 10px; font-size: 10px; color: #94a3b8; text-align: center;">
                Last updated: ${this.resultsHistory.lastUpdated ? new Date(this.resultsHistory.lastUpdated).toLocaleString() : 'Never'}
            </div>
            <div style="margin-top: 5px; display: flex; justify-content: space-between;">
                <button id="run-baseline" style="font-size: 11px; padding: 2px 5px; background: #475569; border: none; color: white; cursor: pointer; border-radius: 3px;">Run Baseline</button>
                <button id="run-optimized" style="font-size: 11px; padding: 2px 5px; background: #475569; border: none; color: white; cursor: pointer; border-radius: 3px;">Run Optimized</button>
                <button id="clear-results" style="font-size: 11px; padding: 2px 5px; background: #475569; border: none; color: white; cursor: pointer; border-radius: 3px;">Clear Data</button>
            </div>
        `;
        
        metricsContainer.innerHTML = comparisonHtml;
        
        // Add event listeners to buttons
        document.getElementById('run-baseline').addEventListener('click', () => {
            window.location.href = window.location.pathname + '?perf=baseline';
        });
        
        document.getElementById('run-optimized').addEventListener('click', () => {
            window.location.href = window.location.pathname + '?perf=optimized';
        });
        
        document.getElementById('clear-results').addEventListener('click', () => {
            localStorage.removeItem('cusumanoPerformanceBenchmark');
            alert('Performance benchmark data cleared.');
        });
    }
}

// Initialize the benchmark when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check if we should run the benchmark
    const params = new URLSearchParams(window.location.search);
    if (params.has('perf')) {
        new PerformanceBenchmark().init();
    }
});

// Export for direct use in console
window.PerformanceBenchmark = PerformanceBenchmark;
