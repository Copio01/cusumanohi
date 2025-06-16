// Enhanced Features Validation Test Script
// Run this in browser console to validate all new features

console.log('🔧 Construction 21 Enhanced Features Validation');
console.log('='.repeat(50));

// Test 1: Dashboard Layout Validation
function testDashboardLayout() {
  console.log('\n📊 Testing Dashboard Layout...');
  
  const dashboard = document.querySelector('.game-dashboard');
  const statsPanel = document.querySelector('.stats-panel');
  const balanceCenter = document.querySelector('.balance-display-center');
  const userPanel = document.querySelector('.user-panel');
  
  console.log('✓ Dashboard found:', !!dashboard);
  console.log('✓ Stats panel found:', !!statsPanel);
  console.log('✓ Balance center found:', !!balanceCenter);
  console.log('✓ User panel found:', !!userPanel);
  
  // Check responsive grid
  const computedStyle = window.getComputedStyle(dashboard);
  console.log('✓ Grid layout applied:', computedStyle.display === 'grid');
  
  return !!(dashboard && statsPanel && balanceCenter && userPanel);
}

// Test 2: Compact Voucher System
function testVoucherSystem() {
  console.log('\n🎟️ Testing Compact Voucher System...');
  
  const voucherToggle = document.getElementById('show-voucher-btn');
  const voucherDropdown = document.getElementById('voucher-dropdown');
  const voucherInput = document.getElementById('voucher-code-input');
  const redeemBtn = document.getElementById('redeem-voucher-btn');
  
  console.log('✓ Voucher toggle button:', !!voucherToggle);
  console.log('✓ Voucher dropdown:', !!voucherDropdown);
  console.log('✓ Voucher input field:', !!voucherInput);
  console.log('✓ Redeem button:', !!redeemBtn);
  
  // Test dropdown toggle
  if (voucherToggle && voucherDropdown) {
    const initiallyHidden = voucherDropdown.classList.contains('hidden');
    voucherToggle.click();
    const afterClick = voucherDropdown.classList.contains('hidden');
    console.log('✓ Dropdown toggle works:', initiallyHidden !== afterClick);
    
    // Reset
    if (!afterClick) voucherToggle.click();
  }
  
  return !!(voucherToggle && voucherDropdown && voucherInput && redeemBtn);
}

// Test 3: Quick Bet Presets
function testQuickBets() {
  console.log('\n⚡ Testing Quick Bet Presets...');
  
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  console.log('✓ Quick bet buttons found:', quickBetBtns.length);
  
  const presets = ['min', 'double', 'max'];
  let allPresetsFound = true;
  
  presets.forEach(preset => {
    const btn = document.querySelector(`[data-preset="${preset}"]`);
    console.log(`✓ ${preset} preset button:`, !!btn);
    if (!btn) allPresetsFound = false;
  });
  
  return quickBetBtns.length >= 3 && allPresetsFound;
}

// Test 4: Enhanced Styling and Animations
function testEnhancedStyling() {
  console.log('\n🎨 Testing Enhanced Styling...');
  
  const actionButtons = document.querySelectorAll('.action-button');
  const chips = document.querySelectorAll('.chip');
  const chipTrayContainer = document.querySelector('.chip-tray-container');
  
  console.log('✓ Action buttons with enhanced styling:', actionButtons.length);
  console.log('✓ Enhanced chips found:', chips.length);
  console.log('✓ Chip tray container:', !!chipTrayContainer);
  
  // Check for CSS animations
  const hasAnimations = Array.from(document.styleSheets).some(sheet => {
    try {
      return Array.from(sheet.cssRules).some(rule => 
        rule.cssText && rule.cssText.includes('transition')
      );
    } catch (e) {
      return false;
    }
  });
  
  console.log('✓ CSS animations/transitions found:', hasAnimations);
  
  return actionButtons.length > 0 && chips.length > 0 && chipTrayContainer && hasAnimations;
}

// Test 5: Game Statistics
function testGameStatistics() {
  console.log('\n📈 Testing Game Statistics...');
  
  const handsPlayedEl = document.getElementById('hands-played');
  const winRateEl = document.getElementById('win-rate');
  
  console.log('✓ Hands played display:', !!handsPlayedEl);
  console.log('✓ Win rate display:', !!winRateEl);
  
  // Check if gameStats object exists
  const hasGameStats = typeof gameStats !== 'undefined';
  console.log('✓ Game statistics object:', hasGameStats);
  
  return !!(handsPlayedEl && winRateEl && hasGameStats);
}

// Test 6: Advanced Animation System
function testAnimationSystem() {
  console.log('\n🎬 Testing Advanced Animation System...');
  
  // Check if AdvancedAnimationSystem class exists
  const hasAdvancedAnimations = typeof AdvancedAnimationSystem !== 'undefined';
  console.log('✓ AdvancedAnimationSystem class:', hasAdvancedAnimations);
  
  // Check for hand value displays
  const handValueElements = document.querySelectorAll('.hand-value');
  console.log('✓ Hand value display elements:', handValueElements.length);
  
  return hasAdvancedAnimations;
}

// Test 7: Mobile Responsiveness
function testMobileFeatures() {
  console.log('\n📱 Testing Mobile Features...');
  
  // Check viewport meta tag
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  console.log('✓ Viewport meta tag:', !!viewportMeta);
  
  // Check for touch-action styles
  const bodyStyle = window.getComputedStyle(document.body);
  console.log('✓ Touch manipulation optimized:', bodyStyle.touchAction === 'manipulation');
  
  // Check for responsive breakpoints in CSS
  const hasResponsiveCSS = Array.from(document.styleSheets).some(sheet => {
    try {
      return Array.from(sheet.cssRules).some(rule => 
        rule.cssText && rule.cssText.includes('@media')
      );
    } catch (e) {
      return false;
    }
  });
  
  console.log('✓ Responsive CSS breakpoints:', hasResponsiveCSS);
  
  return !!(viewportMeta && hasResponsiveCSS);
}

// Run All Tests
function runAllTests() {
  console.log('🚀 Running Complete Feature Validation...\n');
  
  const results = {
    dashboard: testDashboardLayout(),
    voucher: testVoucherSystem(),
    quickBets: testQuickBets(),
    styling: testEnhancedStyling(),
    statistics: testGameStatistics(),
    animations: testAnimationSystem(),
    mobile: testMobileFeatures()
  };
  
  console.log('\n' + '='.repeat(50));
  console.log('📋 VALIDATION SUMMARY:');
  console.log('='.repeat(50));
  
  let passed = 0;
  let total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test.charAt(0).toUpperCase() + test.slice(1)} Features`);
    if (result) passed++;
  });
  
  console.log('='.repeat(50));
  console.log(`🎯 Overall Score: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
  
  if (passed === total) {
    console.log('🎉 ALL ENHANCED FEATURES VALIDATED SUCCESSFULLY!');
  } else {
    console.log('⚠️  Some features need attention - check individual test results above');
  }
  
  return results;
}

// Auto-run tests when script loads
setTimeout(runAllTests, 1000);

// Export for manual testing
window.validateEnhancedFeatures = runAllTests;
console.log('\n💡 You can run "validateEnhancedFeatures()" anytime to re-test all features');
