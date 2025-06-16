import { Construction21Game } from './construction21-logic.js';

// ---- Firebase Setup ----
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk",
  authDomain: "cusumano-website.firebaseapp.com",
  projectId: "cusumano-website",
  storageBucket: "cusumano-website.appspot.com",
  messagingSenderId: "20051552210",
  appId: "1:20051552210:web:7eb3b22baa3fec184e4a0b"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -- Globals --
let game = null;
let inPlay = false, outcomeLock = false, resultsCache = null, lastBets = null, userDocRef = null, userId = null;
let userDisplayName = "";

const dealerCardsEl = document.getElementById('dealer-cards');
const playerHandsEl = document.getElementById('player-hands');
const mainBetAmountEl = document.getElementById('main-bet-amount');
const ppBetAmountEl = document.getElementById('pp-bet-amount');
const plus3BetAmountEl = document.getElementById('plus3-bet-amount');
const chipTray = document.querySelector('.chip-row');
const actionBar = document.getElementById('action-bar');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const splitBtn = document.getElementById('split-btn');
const dealBtn = document.getElementById('deal-btn');
const insuranceBtn = document.getElementById('insurance-btn');
const statusToast = document.getElementById('status-toast');
const profileChipsEl = document.getElementById('profile-chips');
const centerChipsAmountEl = document.getElementById('center-chips-amount');
const profileNameEl = document.getElementById('profile-name');
const clearBetsBtn = document.getElementById('clear-bets-btn');
const newBetBtn = document.getElementById('new-bet-btn');
const rebetBtn = document.getElementById('rebet-btn');
const doubleBetBtn = document.getElementById('double-bet-btn');
const logoutBtn = document.getElementById('logout-btn');

let selectedChip = null;
let betSpots = {
  main: document.getElementById('main-bet-spot'),
  pp: document.getElementById('pp-bet-spot'),
  plus3: document.getElementById('plus3-bet-spot'),
};
const virtualDeckEl = document.getElementById('virtual-deck');

const delay = ms => new Promise(r => setTimeout(r, ms));

// Utility: simpleDelay (used in animateDealCard)
function simpleDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: debounce function to limit frequent calls (for Firebase operations)
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// ---------- FIREBASE SYNC ----------

async function loadUserDataAndStartGame(user) {
  userId = user.uid;
  userDocRef = doc(db, "construction21_users", userId);
  let chipCount = 10000, displayName = user.email; // Start with 10,000 chips
  try {
    const docSnap = await getDoc(userDocRef);    if (docSnap.exists()) {
      chipCount = docSnap.data().chips ?? 10000;
      displayName = docSnap.data().displayName ?? user.email;
    } else {
      await setDoc(userDocRef, {
        displayName: user.email,
        chips: 10000,
        email: user.email,
        createdAt: new Date(),
        lastLogin: new Date()
      });
    }
  } catch (e) {
    showStatusToast("Couldn't load chips from server", true);
  }  userDisplayName = displayName;
  if (profileNameEl) profileNameEl.textContent = userDisplayName;
  
  // Create game with userId and set chips manually
  game = new Construction21Game(userId);
  game.chips = chipCount;
  updateChipsDisplay();
  
  // Initialize enhanced features
  await initializeEnhancedFeatures();
  
  setupEventHandlers();
  updateBetsUI();
  resetAllHandsAndUI();
  updateActionBarState();
  showInPlayButtons(false);
  hideEndButtons();
}

async function saveChipsToFirebase() {
  if (!userDocRef || !game) return;
  try {
    await updateDoc(userDocRef, {
      chips: game.chips,
      lastLogin: new Date()
    });
  } catch (e) {
    console.error('[FIREBASE] Save error:', e);
    showStatusToast("Couldn't save chips! Please reload the game.", true);
  }
}

// Debounced version of saveChipsToFirebase
const debouncedSaveToFirebase = debounce(async function() {
  if (!userDocRef || !game) return;
  try {
    await updateDoc(userDocRef, {
      chips: game.chips,
      lastLogin: new Date()
    });
    // Optionally log success
    // console.log('[FIREBASE] Chips saved successfully:', game.chips);
  } catch (e) {
    console.error('[FIREBASE] Save error:', e);
    showStatusToast("Couldn't save chips! Please reload the game.", true);
  }
}, 500);

function updateChipsDisplay() {
  if (profileChipsEl) profileChipsEl.textContent = game.chips;
  if (centerChipsAmountEl) {
    const currentAmount = parseInt(centerChipsAmountEl.textContent) || 0;
    const newAmount = game.chips;
    
    if (currentAmount !== newAmount) {
      // Animate chip count change
      animateNumberChange(centerChipsAmountEl, currentAmount, newAmount);
    }
  }
}

function animateNumberChange(element, from, to) {
  const duration = 500;
  const steps = 20;
  const stepValue = (to - from) / steps;
  let current = from;
  let step = 0;
  
  const interval = setInterval(() => {
    current += stepValue;
    step++;
    
    element.textContent = Math.round(current);
    
    if (step >= steps) {
      clearInterval(interval);
      element.textContent = to;
    }
  }, duration / steps);
}

// ---------- Utility Functions ----------
function getVirtualDeckPos() {
  const rect = virtualDeckEl.getBoundingClientRect();
  return { left: rect.left + rect.width / 2, top: rect.top + rect.height / 2 };
}

function renderCard(card) {
  if (!card.isFaceUp && !card.flipping) {
    return `<span style="font-size:1.6em;">🂠</span>`;
  }
  const val = card.value;
  const suit = card.suit;
  let suitIcon, color;
  switch (suit) {
    case '♠': suitIcon = '♠'; color = '#23232b'; break;
    case '♣': suitIcon = '♣'; color = '#23232b'; break;
    case '♥': suitIcon = '♥'; color = '#c0392b'; break;
    case '♦': suitIcon = '♦'; color = '#c0392b'; break;
    default: suitIcon = suit; color = '#23232b';
  }
  return `
    <div style="display:flex;flex-direction:column;align-items:center;width:100%;height:100%;justify-content:center">
      <div style="font-size:1.15em;font-weight:bold;color:${color};line-height:1.1">${val}</div>
      <div style="font-size:2.05em;color:${color};margin-top:-2px">${suitIcon}</div>
    </div>
  `;
}

// --- Hand utilities ---
function canSplitCurrentHand() {
  const hand = game.getActiveHand();
  return (
    inPlay &&
    hand &&
    hand.cards.length === 2 &&
    hand.cards[0].value === hand.cards[1].value &&
    game.chips >= hand.bet
  );
}
function canDoubleCurrentHand() {
  const hand = game.getActiveHand();
  return (
    inPlay &&
    hand &&
    hand.cards.length === 2 &&
    game.chips >= hand.bet
  );
}
function canBuyInsurance() {
  return (
    inPlay &&
    game.dealerHand.cards.length &&
    game.dealerHand.cards[0].isFaceUp &&
    game.dealerHand.cards[0].value === 'A' &&
    !game.bets.insurance &&
    game.chips >= Math.ceil(game.bets.main / 2)
  );
}
function canHitCurrentHand() {
  const hand = game.getActiveHand();
  return (
    inPlay &&
    hand &&
    game.calculateScore(hand.cards) < 21
  );
}
function isAllHandsDone() {
  return (
    game.activeHandIndex >= game.playerHands.length ||
    !inPlay
  );
}

// --- Reset UI and State for new round ---
function resetAllHandsAndUI() {
  game.dealerHand = { cards: [], score: 0, isBlackjack: false, hasInsurance: false };
  game.playerHands = [];
  game.activeHandIndex = 0;
  inPlay = false;
  outcomeLock = false;
  resultsCache = null;
  
  // Reset mobile gameplay mode
  setMobileGameplayMode(false);
  
  if (dealerCardsEl) dealerCardsEl.innerHTML = '';
  if (playerHandsEl) playerHandsEl.innerHTML = '';
}

// --- Simplified Visual Card Dealing Animation ---
async function animateDealCard(hand, faceUp, isDealer, cardIndex) {
  // Deal the card to the game state first
  const dealtCard = game.dealCard(hand, faceUp);
  if (!dealtCard) return;
  
  // Get target container
  const targetContainer = isDealer ? dealerCardsEl : 
    playerHandsEl.querySelector('.player-hand:last-child .hand-cards') || 
    playerHandsEl;
  
  if (!targetContainer) {
    updateHandsUI();
    return;
  }
  
  // Create visual card element
  const cardEl = document.createElement('div');
  cardEl.className = 'card';
  cardEl.innerHTML = renderCard(dealtCard);
  
  // Position from deck initially
  const deckPos = getVirtualDeckPos();
  const containerRect = targetContainer.getBoundingClientRect();
  
  cardEl.style.position = 'fixed';
  cardEl.style.left = deckPos.left - 50 + 'px';
  cardEl.style.top = deckPos.top - 72 + 'px';
  cardEl.style.zIndex = '1000';
  cardEl.style.opacity = '0.8';
  cardEl.style.transform = 'scale(0.9) rotateY(-15deg)';
  cardEl.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  
  document.body.appendChild(cardEl);
  
  // Animate to target position after a brief delay
  setTimeout(() => {
    const targetX = containerRect.left + (hand.cards.length - 1) * 25;
    const targetY = containerRect.top;
    
    cardEl.style.left = targetX + 'px';
    cardEl.style.top = targetY + 'px';
    cardEl.style.opacity = '1';
    cardEl.style.transform = 'scale(1) rotateY(0deg)';
  }, 50);
  
  // Remove animated card and update UI after animation
  setTimeout(() => {
    cardEl.remove();
    updateHandsUI();
  }, 650);
    // Wait for animation to complete
  await simpleDelay(700);
}
async function dealOpeningCards() {
  // Standard blackjack dealing order: Player, Dealer, Player, Dealer (face down)
  console.log('[DEAL] Starting opening card sequence...');
  
  await animateDealCard(game.playerHands[0], true, false, 0);   // Player card 1 (face up)
  console.log('[DEAL] Player first card dealt');
  
  await animateDealCard(game.dealerHand, true, true, 0);        // Dealer card 1 (face up)
  console.log('[DEAL] Dealer first card dealt (face up)');
  
  await animateDealCard(game.playerHands[0], true, false, 1);   // Player card 2 (face up)
  console.log('[DEAL] Player second card dealt');
  
  await animateDealCard(game.dealerHand, false, true, 1);       // Dealer card 2 (face down)
  console.log('[DEAL] Dealer second card dealt (face down)');
    console.log('[DEAL] Opening deal complete, dealer cards:', game.dealerHand.cards.map((c, i) => `${i}: ${c.value}${c.suit} (${c.isFaceUp ? 'up' : 'down'})`));
  
  // Check for auto-stand conditions (blackjacks)
  await checkAndHandleBlackjacks();
  
  updateActionBarState(); // <-- ENSURE action bar is updated after opening deal!
}

// ================================
// COMPREHENSIVE UI ENHANCEMENTS
// ================================

// Game Statistics Tracking
let gameStats = {
  handsPlayed: 0,
  handsWon: 0,
  totalWinnings: 0,
  biggestWin: 0,
  sessionStart: Date.now()
};

// Enhanced Animation System
class AdvancedAnimationSystem {
  static dealCard(targetElement, fromElement, delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        const card = document.createElement('div');
        card.className = 'card card-fly dealing';
        card.innerHTML = '🂠'; // Card back
        
        const fromRect = fromElement.getBoundingClientRect();
        const toRect = targetElement.getBoundingClientRect();
        
        card.style.position = 'fixed';
        card.style.left = fromRect.left + 'px';
        card.style.top = fromRect.top + 'px';
        card.style.zIndex = '10000';
        
        document.body.appendChild(card);
        
        requestAnimationFrame(() => {
          card.style.left = toRect.left + 'px';
          card.style.top = toRect.top + 'px';
          card.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;
        });
        
        setTimeout(() => {
          card.remove();
          resolve();
        }, 600);
      }, delay);
    });
  }
  
  static animateChipToSpot(chipValue, fromElement, toElement) {
    return new Promise(resolve => {
      const chip = document.createElement('div');
      chip.className = 'chip chip-fly';
      chip.innerHTML = `<span class="chip-value">${chipValue}</span>`;
      chip.setAttribute('data-amount', chipValue);
      
      const fromRect = fromElement.getBoundingClientRect();
      const toRect = toElement.getBoundingClientRect();
      
      chip.style.position = 'fixed';
      chip.style.left = fromRect.left + 'px';
      chip.style.top = fromRect.top + 'px';
      chip.style.zIndex = '9999';
      
      document.body.appendChild(chip);
      
      requestAnimationFrame(() => {
        chip.style.left = toRect.left + toRect.width/2 - 32 + 'px';
        chip.style.top = toRect.top + toRect.height/2 - 32 + 'px';
      });
      
      setTimeout(() => {
        chip.remove();
        resolve();
      }, 800);
    });
  }
  
  static celebrateWin(element, amount) {
    element.classList.add('celebrate');
    
    // Add confetti effect for big wins
    if (amount > 100) {
      this.createConfetti(element);
    }
    
    setTimeout(() => {
      element.classList.remove('celebrate');
    }, 600);
  }
  
  static createConfetti(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    for (let i = 0; i < 20; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.left = centerX + 'px';
      confetti.style.top = centerY + 'px';
      confetti.style.width = '4px';
      confetti.style.height = '4px';
      confetti.style.background = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'][Math.floor(Math.random() * 5)];
      confetti.style.zIndex = '10001';
      confetti.style.pointerEvents = 'none';
      
      document.body.appendChild(confetti);
      
      const angle = (i / 20) * Math.PI * 2;
      const velocity = 50 + Math.random() * 50;
      const gravity = 0.5;
      
      let x = 0, y = 0, vx = Math.cos(angle) * velocity, vy = Math.sin(angle) * velocity;
      
      const animate = () => {
        x += vx;
        y += vy;
        vy += gravity;
        
        confetti.style.transform = `translate(${x}px, ${y}px) rotate(${x}deg)`;
        
        if (y < 300) {
          requestAnimationFrame(animate);
        } else {
          confetti.remove();
        }
      };
      
      animate();
    }
  }
}

// Enhanced Gesture Controls
function setupGestureControls() {
  const table = document.getElementById('blackjack-table');
  if (!table) return;
  
  let startY, endY, startTime;
  
  table.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });
  
  table.addEventListener('touchend', e => {
    if (!inPlay) return;
    
    endY = e.changedTouches[0].clientY;
    const duration = Date.now() - startTime;
    const distance = Math.abs(startY - endY);
    
    if (duration < 300 && distance > 50) {
      if (startY - endY > 50) {
        // Swipe up - Stand
        handlePlayerAction('stand');
        showStatusToast('👆 Swipe Stand');
      } else if (endY - startY > 50) {
        // Swipe down - Hit
        handlePlayerAction('hit');
        showStatusToast('👇 Swipe Hit');
      }
    }
  }, { passive: true });
}

// Voucher System Integration
function setupVoucherSystem() {
  const showVoucherBtn = document.getElementById('show-voucher-btn');
  const voucherDropdown = document.getElementById('voucher-dropdown');
  const voucherInput = document.getElementById('voucher-code-input');
  const redeemBtn = document.getElementById('redeem-voucher-btn');
  
  if (!showVoucherBtn || !voucherDropdown) return;
  
  // Toggle dropdown
  showVoucherBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    voucherDropdown.classList.toggle('hidden');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!voucherDropdown.contains(e.target) && !showVoucherBtn.contains(e.target)) {
      voucherDropdown.classList.add('hidden');
    }
  });
  
  // Format voucher input
  if (voucherInput) {
    voucherInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
      if (value.length > 3) {
        value = value.substring(0, 3) + '-' + value.substring(3);
      }
      if (value.length > 7) {
        value = value.substring(0, 7) + '-' + value.substring(7);
      }
      if (value.length > 13) {
        value = value.substring(0, 13);
      }
      e.target.value = value;
      
      if (redeemBtn) {
        redeemBtn.disabled = value.length < 10;
      }
    });
    
    voucherInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && redeemBtn && !redeemBtn.disabled) {
        redeemBtn.click();
      }
    });
  }
}

// Quick Bet Presets
function setupQuickBets() {
  const quickBetBtns = document.querySelectorAll('.quick-bet-btn');
  
  quickBetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      
      switch (preset) {
        case 'min':
          placeQuickBet(5);
          break;
        case 'double':
          if (lastBets && lastBets.main > 0) {
            placeQuickBet(lastBets.main * 2);
          }
          break;
        case 'max':
          placeQuickBet(Math.min(game.chips, 1000));
          break;
      }
    });
  });
}

function placeQuickBet(amount) {
  if (!game || inPlay || !selectedChip) return;
  
  selectedChip = amount;
  updateSelectedChip();
  
  // Place on main bet spot
  const mainBetSpot = document.getElementById('main-bet-spot');
  if (mainBetSpot && game.canPlaceBet(amount)) {
    game.placeBet('main', amount);
    updateBetsUI();
    updateChipsDisplay();
    saveChipsToFirebase();
    showStatusToast(`Quick bet: ${amount} chips`);
  }
}

// Update Statistics Display
function updateGameStats() {
  const handsPlayedEl = document.getElementById('hands-played');
  const winRateEl = document.getElementById('win-rate');
  
  if (handsPlayedEl) {
    handsPlayedEl.textContent = gameStats.handsPlayed;
  }
  
  if (winRateEl) {
    const winRate = gameStats.handsPlayed > 0 
      ? Math.round((gameStats.handsWon / gameStats.handsPlayed) * 100)
      : 0;
    winRateEl.textContent = `${winRate}%`;
  }
}

// Enhanced Hand Value Display
function addHandValueDisplay(handElement, value, isSoft = false, isBust = false) {
  // Remove existing hand value display
  const existingValue = handElement.querySelector('.hand-value');
  if (existingValue) {
    existingValue.remove();
  }
  
  const valueDisplay = document.createElement('div');
  valueDisplay.className = 'hand-value';
  if (isSoft) valueDisplay.classList.add('soft');
  if (isBust) valueDisplay.classList.add('bust');
  
  valueDisplay.textContent = value;
  
  // Position based on whether it's dealer or player
  if (handElement.closest('#dealer-cards')) {
    valueDisplay.classList.add('dealer-hand-value');
  } else {
    valueDisplay.classList.add('player-hand-value');
  }
  
  handElement.style.position = 'relative';
  handElement.appendChild(valueDisplay);
}

// Progressive Asset Loading
async function loadGameAssets() {
  // Show loading indicator
  const loadingEl = document.createElement('div');
  loadingEl.id = 'loading-screen';
  loadingEl.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.9); display: flex; align-items: center; 
                justify-content: center; z-index: 10000; color: #ffd700;">
      <div style="text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 1rem;">🔨</div>
        <div style="font-size: 1.2rem; margin-bottom: 1rem;">Loading Construction 21...</div>
        <div style="width: 200px; height: 4px; background: rgba(255,215,0,0.3); border-radius: 2px; overflow: hidden;">
          <div id="loading-progress" style="width: 0%; height: 100%; background: #ffd700; transition: width 0.3s ease;"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingEl);
  
  const progressEl = document.getElementById('loading-progress');
  
  // Simulate progressive loading
  const steps = [
    { progress: 20, delay: 100 },
    { progress: 40, delay: 200 },
    { progress: 60, delay: 150 },
    { progress: 80, delay: 100 },
    { progress: 100, delay: 200 }
  ];
  
  for (const step of steps) {
    await new Promise(resolve => {
      setTimeout(() => {
        progressEl.style.width = `${step.progress}%`;
        resolve();
      }, step.delay);
    });
  }
  
  // Hide loading screen
  setTimeout(() => {
    loadingEl.style.opacity = '0';
    setTimeout(() => {
      loadingEl.remove();
    }, 300);
  }, 500);
}

// Enhanced Status Toast with Types
function showEnhancedToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('status-toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 glassy px-6 py-3 rounded-lg shadow-lg text-lg z-50';
  
  switch (type) {
    case 'success':
      toast.style.background = 'rgba(52,199,89,0.95)';
      toast.style.color = 'white';
      break;
    case 'error':
      toast.style.background = 'rgba(255,59,48,0.95)';
      toast.style.color = 'white';
      break;
    case 'warning':
      toast.style.background = 'rgba(255,149,0,0.95)';
      toast.style.color = 'white';
      break;
    default:
      toast.style.background = 'rgba(255,215,0,0.95)';
      toast.style.color = '#000';
  }
  
  toast.style.display = 'block';
  toast.style.animation = 'slideInDown 0.3s ease-out';
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
      toast.style.opacity = '1';
    }, 300);
  }, duration);
}

// Performance Optimizations
function optimizePerformance() {
  // Use passive event listeners where possible
  const passiveEvents = ['touchstart', 'touchmove', 'wheel'];
  passiveEvents.forEach(eventName => {
    document.addEventListener(eventName, () => {}, { passive: true });
  });
  
  // Optimize animations with will-change
  const animatedElements = document.querySelectorAll('.card, .chip, .action-button');
  animatedElements.forEach(el => {
    el.style.willChange = 'transform';
  });
}

// Enhanced Game Initialization
async function initializeEnhancedFeatures() {
  try {
    // Show loading screen
    await loadGameAssets();
    
    // Initialize all enhanced systems
    setupGestureControls();
    setupVoucherSystem();
    setupQuickBets();
    optimizePerformance();
    
    // Initialize game statistics
    gameStats.sessionStart = Date.now();
    updateGameStats();
    
    console.log('[ENHANCED] All enhanced features initialized successfully');
  } catch (error) {
    console.error('[ENHANCED] Error initializing enhanced features:', error);
  }
}

// --- Event handlers and UI logic ---
function setupEventHandlers() {
  // Enhanced chip selection with touch support and debouncing
  chipTray.querySelectorAll('.chip').forEach(chip => {
    let isProcessing = false;
    
    // Handle both click and touch events
    const handleChipSelection = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (inPlay || isProcessing) return;
      
      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 300); // Debounce for 300ms
      
      selectedChip = parseInt(chip.dataset.amount);
      chipTray.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      
      // Enhanced haptic feedback for chip selection
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
      
      console.log(`[CHIP SELECTION] Selected chip: ${selectedChip}`);
    };
    
    // Add both touch and click handlers
    chip.addEventListener('click', handleChipSelection);
    chip.addEventListener('touchend', handleChipSelection);
    
    // Prevent touch from triggering additional events
    chip.addEventListener('touchstart', (e) => {
      e.preventDefault();
    });
  });
  // Enhanced bet spot handling with full area touch support
  Object.entries(betSpots).forEach(([type, spot]) => {
    let isProcessing = false;
    let touchStartTime = 0;
    
    const handleBetPlacement = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (inPlay || !selectedChip || isProcessing) return;
      
      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 400); // Debounce for bets
      
      // Use the enhanced bet validation
      if (game.canPlaceBet(selectedChip) && game.placeBet(type === 'plus3' ? 'plus3' : type, selectedChip)) {
        animateChipToBetSpot(type, selectedChip, spot, getBetStackCount(type));
        updateBetsUI();
        updateChipsDisplay();
        saveChipsToFirebase();
        showStatusToast(`Bet ${selectedChip} placed on ${type === 'main' ? 'Main' : type === 'pp' ? 'P / P' : '21+3'}`);
        
        // Enhanced haptic feedback for successful bet
        if (navigator.vibrate) {
          navigator.vibrate([40, 30, 40]); // Slightly stronger pattern
        }
        
        // Visual success feedback
        spot.style.boxShadow = '0 0 25px #00ff0066, 0 0 50px #00ff0033';
        setTimeout(() => {
          spot.style.boxShadow = '';
        }, 300);
      } else {
        showStatusToast('Cannot place bet!', true);
        
        // Error haptic feedback and visual cue
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        
        // Visual error feedback
        spot.style.boxShadow = '0 0 20px #ff004466, 0 0 40px #ff004433';
        setTimeout(() => {
          spot.style.boxShadow = '';
        }, 400);
      }
    };
    
    // Enhanced touch event handling
    spot.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchStartTime = Date.now();
      
      // Visual feedback for touch start
      spot.style.transform = 'scale(0.98)';
      spot.style.transition = 'transform 0.1s ease';
      
      // Light haptic feedback for touch recognition
      if (navigator.vibrate && selectedChip) {
        navigator.vibrate(25);
      }
    });
    
    spot.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Reset visual state
      setTimeout(() => {
        spot.style.transform = '';
        spot.style.transition = '';
      }, 100);
      
      // Only trigger if this was a quick tap (not a long press)
      const touchDuration = Date.now() - touchStartTime;
      if (touchDuration < 500) {
        handleBetPlacement(e);
      }
    });
    
    spot.addEventListener('touchcancel', (e) => {
      // Reset visual state on touch cancel
      spot.style.transform = '';
      spot.style.transition = '';
    });
    
    // Standard click handler for desktop
    spot.addEventListener('click', handleBetPlacement);
  });

  dealBtn.addEventListener('click', () => { if (!inPlay) startRound(); });
  hitBtn.addEventListener('click', () => handlePlayerAction('hit'));
  standBtn.addEventListener('click', () => handlePlayerAction('stand'));
  doubleBtn.addEventListener('click', () => handlePlayerAction('double'));
  splitBtn.addEventListener('click', () => handlePlayerAction('split'));
  if (insuranceBtn) insuranceBtn.addEventListener('click', () => handlePlayerAction('insurance'));
  if (clearBetsBtn) clearBetsBtn.addEventListener('click', () => { if (!inPlay) { game.clearBets(); updateBetsUI(); updateChipsDisplay(); saveChipsToFirebase(); showStatusToast('Bets cleared!'); } });

  newBetBtn.addEventListener('click', () => {
    hideEndButtons();
    resetAllHandsAndUI();
    game.clearBets();
    updateBetsUI();
    updateChipsDisplay();
    saveChipsToFirebase();
    updateHandsUI();
    updateActionBarState();
    showInPlayButtons(false);
  });  rebetBtn.addEventListener('click', () => {
    hideEndButtons();
    if (lastBets) {
      // Calculate total rebet amount with detailed logging
      let totalBet = 0;
      const betBreakdown = [];
      Object.keys(lastBets).forEach(k => { 
        if (lastBets[k] > 0) {
          totalBet += lastBets[k];
          betBreakdown.push(`${k}: ${lastBets[k]}`);
        }
      });
      
      console.log(`[REBET DEBUG] Attempting rebet - Total needed: ${totalBet}, Available chips: ${game.chips}`);
      console.log(`[REBET DEBUG] Bet breakdown: ${betBreakdown.join(', ')}`);
      
      // Enhanced validation with detailed feedback
      if (totalBet <= 0) {
        showStatusToast('No previous bets to repeat!', true);
        showEndButtons();
        return;
      }
      
      if (totalBet > game.chips) {
        console.log(`[REBET DEBUG] Insufficient chips: need ${totalBet}, have ${game.chips}`);
        showStatusToast(`Not enough chips for rebet! Need ${totalBet}, have ${game.chips}`, true);
        showEndButtons();
        return;
      }
      
      console.log(`[REBET DEBUG] Rebet validation passed, proceeding with game setup`);
      
      resetAllHandsAndUI();
      game.clearBets();
      // Deduct chips for re-bet
      Object.keys(lastBets).forEach(k => { 
        if (lastBets[k] > 0) {
          game.bets[k] = lastBets[k];
        }
      });
      game.chips -= totalBet;
      
      console.log(`[REBET DEBUG] Bets placed, chips remaining: ${game.chips}`);
      
      updateBetsUI();
      updateChipsDisplay();
      saveChipsToFirebase();
    } else {
      showStatusToast('No previous bets available!', true);
      showEndButtons();
      return;
    }
    startRound();
  });doubleBetBtn.addEventListener('click', () => {
    hideEndButtons();
    if (lastBets) {
      let totalDoubleBet = 0;
      Object.keys(lastBets).forEach(k => {
        if (lastBets[k] * 2 > game.chips) totalDoubleBet = Infinity;
        else totalDoubleBet += lastBets[k];
      });
      if (totalDoubleBet === Infinity || totalDoubleBet * 2 > game.chips) {
        showStatusToast('Not enough chips for 2x bet!', true);
        showEndButtons();
        return;
      }
      resetAllHandsAndUI();
      game.clearBets();
      // Deduct chips for double bet
      Object.keys(lastBets).forEach(k => {
        if (lastBets[k] > 0) {
          game.bets[k] = lastBets[k] * 2;
        }
      });
      game.chips -= totalDoubleBet * 2;
      updateBetsUI();
      updateChipsDisplay();
      saveChipsToFirebase();
      startRound();
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = "construction21-login.html";
    });
  }
}

// Safe event handler setup for multiplayer compatibility
export function setupEventHandlersSafe() {
  // Only set up handlers for elements that actually exist
  const elements = {
    chips: chipTray?.querySelectorAll('.chip'),
    betSpots: betSpots,
    dealBtn,
    hitBtn,
    standBtn,
    doubleBtn,
    splitBtn,
    insuranceBtn,
    clearBetsBtn,
    newBetBtn,
    rebetBtn,
    doubleBetBtn,
    logoutBtn
  };

  // Chip selection handlers (only if chip tray exists)
  if (elements.chips) {
    elements.chips.forEach(chip => {
      let isProcessing = false;
      
      const handleChipSelection = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (inPlay || isProcessing) return;
        
        isProcessing = true;
        setTimeout(() => { isProcessing = false; }, 300);
        
        selectedChip = parseInt(chip.dataset.amount);
        elements.chips.forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        
        if (navigator.vibrate) {
          navigator.vibrate(20);
        }
        
        console.log(`[CHIP SELECTION] Selected chip: ${selectedChip}`);
      };
      
      chip.addEventListener('click', handleChipSelection);
      chip.addEventListener('touchend', handleChipSelection);
      
      chip.addEventListener('touchstart', (e) => {
        e.preventDefault();
      });
    });
  }

  // Bet spot handlers (only if bet spots exist)
  if (elements.betSpots) {
    Object.entries(elements.betSpots).forEach(([type, spot]) => {
      if (!spot) return; // Skip if spot doesn't exist
      
      let isProcessing = false;
      let touchStartTime = 0;
      
      const handleBetPlacement = (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        if (inPlay || !selectedChip || isProcessing) return;
        
        isProcessing = true;
        setTimeout(() => { isProcessing = false; }, 400); // Debounce for bets
        
        // Use the enhanced bet validation
        if (game?.canPlaceBet?.(selectedChip) && game?.placeBet?.(type === 'plus3' ? 'plus3' : type, selectedChip)) {
          if (typeof animateChipToBetSpot === 'function') {
            animateChipToBetSpot(type, selectedChip, spot, getBetStackCount(type));
          }
          updateBetsUI();
          updateChipsDisplay();
          saveChipsToFirebase();
          showStatusToast(`Bet ${selectedChip} placed on ${type === 'main' ? 'Main' : type === 'pp' ? 'P / P' : '21+3'}`);
          
          if (navigator.vibrate) {
            navigator.vibrate([40, 30, 40]);
          }
          
          spot.style.boxShadow = '0 0 25px #00ff0066, 0 0 50px #00ff0033';
          setTimeout(() => {
            spot.style.boxShadow = '';
          }, 300);
        } else {
          showStatusToast('Cannot place bet!', true);
          
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
          
          spot.style.boxShadow = '0 0 20px #ff004466, 0 0 40px #ff004433';
          setTimeout(() => {
            spot.style.boxShadow = '';
          }, 400);
        }
      };
      
      spot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchStartTime = Date.now();
        spot.style.transform = 'scale(0.98)';
        spot.style.transition = 'transform 0.1s ease';
        
        if (navigator.vibrate && selectedChip) {
          navigator.vibrate(25);
        }
      });
      
      spot.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        setTimeout(() => {
          spot.style.transform = '';
          spot.style.transition = '';
        }, 100);
        
        const touchDuration = Date.now() - touchStartTime;
        if (touchDuration < 500) {
          handleBetPlacement(e);
        }
      });
      
      spot.addEventListener('touchcancel', (e) => {
        spot.style.transform = '';
        spot.style.transition = '';
      });
      
      spot.addEventListener('click', handleBetPlacement);
    });
  }

  // Game action button handlers (only if buttons exist)
  if (elements.dealBtn) elements.dealBtn.addEventListener('click', () => { if (!inPlay) startRound(); });
  if (elements.hitBtn) elements.hitBtn.addEventListener('click', () => handlePlayerAction('hit'));
  if (elements.standBtn) elements.standBtn.addEventListener('click', () => handlePlayerAction('stand'));
  if (elements.doubleBtn) elements.doubleBtn.addEventListener('click', () => handlePlayerAction('double'));
  if (elements.splitBtn) elements.splitBtn.addEventListener('click', () => handlePlayerAction('split'));
  if (elements.insuranceBtn) elements.insuranceBtn.addEventListener('click', () => handlePlayerAction('insurance'));
  
  // Betting control handlers
  if (elements.clearBetsBtn) {
    elements.clearBetsBtn.addEventListener('click', () => { 
      if (!inPlay && game) { 
        game.clearBets(); 
        updateBetsUI(); 
        updateChipsDisplay(); 
        saveChipsToFirebase(); 
        showStatusToast('Bets cleared!'); 
      } 
    });
  }

  if (elements.newBetBtn) {
    elements.newBetBtn.addEventListener('click', () => {
      hideEndButtons();
      resetAllHandsAndUI();
      if (game) game.clearBets();
      updateBetsUI();
      updateChipsDisplay();
      saveChipsToFirebase();
      updateHandsUI();
      updateActionBarState();
      showInPlayButtons(false);
    });
  }

  if (elements.rebetBtn) {
    elements.rebetBtn.addEventListener('click', () => {
      hideEndButtons();
      if (lastBets && game) {
        let totalBet = 0;
        const betBreakdown = [];
        Object.keys(lastBets).forEach(k => { 
          if (lastBets[k] > 0) {
            totalBet += lastBets[k];
            betBreakdown.push(`${k}: ${lastBets[k]}`);
          }
        });
        
        console.log(`[REBET DEBUG] Attempting rebet - Total needed: ${totalBet}, Available chips: ${game.chips}`);
        console.log(`[REBET DEBUG] Bet breakdown: ${betBreakdown.join(', ')}`);
        
        // Enhanced validation with detailed feedback
        if (totalBet <= 0) {
          showStatusToast('No previous bets to repeat!', true);
          showEndButtons();
          return;
        }
        
        if (totalBet > game.chips) {
          console.log(`[REBET DEBUG] Insufficient chips: need ${totalBet}, have ${game.chips}`);
          showStatusToast(`Not enough chips for rebet! Need ${totalBet}, have ${game.chips}`, true);
          showEndButtons();
          return;
        }
        
        console.log(`[REBET DEBUG] Rebet validation passed, proceeding with game setup`);
        
        resetAllHandsAndUI();
        game.clearBets();
        // Deduct chips for re-bet
        Object.keys(lastBets).forEach(k => { 
          if (lastBets[k] > 0) {
            game.bets[k] = lastBets[k];
          }
        });
        game.chips -= totalBet;
        
        console.log(`[REBET DEBUG] Bets placed, chips remaining: ${game.chips}`);
        
        updateBetsUI();
        updateChipsDisplay();
        saveChipsToFirebase();
      } else {
        showStatusToast('No previous bets available!', true);
        showEndButtons();
        return;
      }
      startRound();
    });
  }

  if (elements.doubleBetBtn) {
    elements.doubleBetBtn.addEventListener('click', () => {
      hideEndButtons();
      if (lastBets && game) {
        let totalDoubleBet = 0;
        Object.keys(lastBets).forEach(k => {
          if (lastBets[k] * 2 > game.chips) totalDoubleBet = Infinity;
          else totalDoubleBet += lastBets[k];
        });
        if (totalDoubleBet === Infinity || totalDoubleBet * 2 > game.chips) {
          showStatusToast('Not enough chips for 2x bet!', true);
          showEndButtons();
          return;
        }
        resetAllHandsAndUI();
        game.clearBets();
        // Deduct chips for double bet
        Object.keys(lastBets).forEach(k => {
          if (lastBets[k] > 0) {
            game.bets[k] = lastBets[k] * 2;
          }
        });
        game.chips -= totalDoubleBet * 2;
        updateBetsUI();
        updateChipsDisplay();
        saveChipsToFirebase();
        startRound();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
      window.location.href = "construction21-login.html";
    });
  }
}

// --- Event Listener Cleanup for Memory Management ---
function cleanupEventListeners() {
  // Clean up chip selection event listeners
  if (chipTray) {
    chipTray.querySelectorAll('.chip').forEach(chip => {
      chip.replaceWith(chip.cloneNode(true)); // Remove all listeners by replacing node
    });
  }
  // Clean up bet spot event listeners
  Object.values(betSpots).forEach(spot => {
    if (spot) {
      spot.replaceWith(spot.cloneNode(true));
    }
  });
  // Clean up button event listeners
  [dealBtn, hitBtn, standBtn, doubleBtn, splitBtn, insuranceBtn, clearBetsBtn, newBetBtn, rebetBtn, doubleBetBtn, logoutBtn].forEach(btn => {
    if (btn) btn.replaceWith(btn.cloneNode(true));
  });
  // Remove page unload handler
  window.removeEventListener('beforeunload', cleanupEventListeners);
  // Optionally log cleanup
  // console.log('[CLEANUP] Event listeners successfully removed');
}
window.addEventListener('beforeunload', cleanupEventListeners);

// For future: consider adding event listener cleanup for memory management.