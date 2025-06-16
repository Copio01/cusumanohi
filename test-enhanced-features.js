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

// Test 8: Button Debugging System
function testButtonDebugging() {
  console.log('\n🐛 Testing Button Debugging System...');
  
  // Check if debug functions exist
  const hasDebugAllButtons = typeof debugAllButtons !== 'undefined';
  const hasDebugGameState = typeof debugGameState !== 'undefined';
  const hasDebugButtonState = typeof debugButtonState !== 'undefined';
  
  console.log('✓ debugAllButtons function:', hasDebugAllButtons);
  console.log('✓ debugGameState function:', hasDebugGameState);
  console.log('✓ debugButtonState function:', hasDebugButtonState);
  
  // Test if buttons have debug event listeners
  const hitBtn = document.getElementById('hit-btn');
  const dealBtn = document.getElementById('deal-btn');
  const standBtn = document.getElementById('stand-btn');
  
  console.log('✓ Hit button has debug listeners:', hitBtn?._hasDebugListeners || false);
  console.log('✓ Deal button has debug listeners:', dealBtn?._hasDebugListeners || false);
  console.log('✓ Stand button has debug listeners:', standBtn?._hasDebugListeners || false);
  
  // Run a quick button audit if available
  if (hasDebugAllButtons) {
    console.log('✓ Running button audit...');
    try {
      debugAllButtons();
      console.log('✓ Button audit completed successfully');
    } catch (error) {
      console.log('❌ Button audit failed:', error.message);
    }
  }
  
  return hasDebugAllButtons && hasDebugGameState && hasDebugButtonState;
}

// Test 9: Game Logic Integration
function testGameLogicIntegration() {
  console.log('\n🎯 Testing Game Logic Integration...');
  
  // Check if game instance exists
  const hasGame = typeof game !== 'undefined' && game !== null;
  console.log('✓ Game instance exists:', hasGame);
  
  // Check critical game functions
  if (hasGame) {
    const hasCanHit = typeof game.canHit === 'function';
    const hasCanStand = typeof game.canStand === 'function';
    const hasCanDouble = typeof game.canDouble === 'function';
    const hasCanSplit = typeof game.canSplit === 'function';
    const hasPlaceBet = typeof game.placeBet === 'function';
    const hasStartRound = typeof game.startRound === 'function';
    
    console.log('✓ canHit method:', hasCanHit);
    console.log('✓ canStand method:', hasCanStand);
    console.log('✓ canDouble method:', hasCanDouble);
    console.log('✓ canSplit method:', hasCanSplit);
    console.log('✓ placeBet method:', hasPlaceBet);
    console.log('✓ startRound method:', hasStartRound);
    
    // Check game state
    console.log('✓ Current chips:', game.chips || 'N/A');
    console.log('✓ Current bets:', game.bets || 'N/A');
    
    return hasCanHit && hasCanStand && hasCanDouble && hasCanSplit && hasPlaceBet && hasStartRound;
  }
  
  return false;
}

// Test 10: Event Handler Setup
function testEventHandlerSetup() {
  console.log('\n🔗 Testing Event Handler Setup...');
  
  // Check if setupEventHandlers function exists
  const hasSetupEventHandlers = typeof setupEventHandlers !== 'undefined';
  console.log('✓ setupEventHandlers function:', hasSetupEventHandlers);
  
  // Check critical UI functions
  const hasHandlePlayerAction = typeof handlePlayerAction !== 'undefined';
  const hasUpdateHandsUI = typeof updateHandsUI !== 'undefined';
  const hasUpdateBetsUI = typeof updateBetsUI !== 'undefined';
  const hasUpdateActionBarState = typeof updateActionBarState !== 'undefined';
  const hasStartRound = typeof startRound !== 'undefined';
  
  console.log('✓ handlePlayerAction function:', hasHandlePlayerAction);
  console.log('✓ updateHandsUI function:', hasUpdateHandsUI);
  console.log('✓ updateBetsUI function:', hasUpdateBetsUI);
  console.log('✓ updateActionBarState function:', hasUpdateActionBarState);
  console.log('✓ startRound function:', hasStartRound);
  
  // Check global variables
  const hasInPlay = typeof inPlay !== 'undefined';
  const hasSelectedChip = typeof selectedChip !== 'undefined';
  const hasBetSpots = typeof betSpots !== 'undefined';
  
  console.log('✓ inPlay variable:', hasInPlay);
  console.log('✓ selectedChip variable:', hasSelectedChip);
  console.log('✓ betSpots variable:', hasBetSpots);
  
  return hasSetupEventHandlers && hasHandlePlayerAction && hasUpdateHandsUI && 
         hasUpdateBetsUI && hasUpdateActionBarState && hasStartRound;
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
    mobile: testMobileFeatures(),
    debugging: testButtonDebugging(),
    gameLogic: testGameLogicIntegration(),
    eventHandlers: testEventHandlerSetup()
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
    console.log('\n🔧 DEBUG TIPS:');
    console.log('- Press Ctrl + ` in game to run button debug audit');
    console.log('- Check browser console for detailed debug logs');
    console.log('- Try clicking buttons and watch for debug output');
  }
  
  return results;
}

// Auto-run tests when script loads
setTimeout(runAllTests, 1000);

// Export for manual testing
window.validateEnhancedFeatures = runAllTests;
window.testButtonDebugging = testButtonDebugging;
window.testGameLogicIntegration = testGameLogicIntegration;
window.testEventHandlerSetup = testEventHandlerSetup;

console.log('\n💡 DEBUGGING COMMANDS AVAILABLE:');
console.log('- validateEnhancedFeatures() - Run all tests');
console.log('- testButtonDebugging() - Test button debugging system');
console.log('- testGameLogicIntegration() - Test game logic');
console.log('- testEventHandlerSetup() - Test event handlers');
console.log('- debugAllButtons() - Run button audit (if available)');
console.log('- debugGameState() - Check current game state (if available)');
console.log('- Press Ctrl + ` in game for live button debugging');

// Additional helper functions for debugging
window.clickAllButtons = function() {
  console.log('🖱️ Testing all button clicks...');
  const buttons = ['hit-btn', 'stand-btn', 'deal-btn', 'double-btn', 'split-btn', 'clear-bets-btn'];
  
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn && !btn.disabled && window.getComputedStyle(btn).display !== 'none') {
      console.log(`Clicking ${btnId}...`);
      try {
        btn.click();
      } catch (error) {
        console.error(`Error clicking ${btnId}:`, error);
      }
    } else {
      console.log(`${btnId} not available or disabled`);
    }
  });
};

window.checkButtonStates = function() {
  console.log('🔍 Checking all button states...');
  const buttons = ['hit-btn', 'stand-btn', 'deal-btn', 'double-btn', 'split-btn', 'clear-bets-btn'];
  
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      const style = window.getComputedStyle(btn);
      console.log(`${btnId}:`, {
        exists: true,
        disabled: btn.disabled,
        visible: style.display !== 'none',
        clickable: !btn.disabled && style.pointerEvents !== 'none'
      });
    } else {
      console.log(`${btnId}: NOT FOUND`);
    }
  });
};
