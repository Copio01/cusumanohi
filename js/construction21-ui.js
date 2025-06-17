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
        lastLogin: new Date()      });
    }
  } catch (e) {
    showEnhancedToast("Couldn't load chips from server", 'error');
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

// Firebase chips saving function with debounce to prevent excessive writes
const debouncedSaveToFirebase = debounce(async function() {
  if (!userDocRef || !game) return;
  try {
    await updateDoc(userDocRef, {
      chips: game.chips,
      lastLogin: new Date()
    });
    // Optionally log success    // console.log('[FIREBASE] Chips saved successfully:', game.chips);
  } catch (e) {
    console.error('[FIREBASE] Save error:', e);
    showEnhancedToast("Couldn't save chips! Please reload the game.", 'error');
  }
}, 500);

function updateChipsDisplay() {  // Display chips in the UI
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

// --- Bet Placement Animation and Utilities ---
function animateChipToBetSpot(spotType, chipValue, spotElement, stackCount = 0) {
  console.log(`[ANIM] Animating chip ${chipValue} to ${spotType} spot`);
  try {
    // Create animated chip element
    const animChip = document.createElement('div');
    animChip.className = 'chip chip-fly';
    animChip.innerHTML = `<span class="chip-value">${chipValue}</span>`;
    animChip.setAttribute('data-amount', chipValue);
    
    // Apply chip styling based on value
    const chipColors = {
      5: 'linear-gradient(135deg, #ff2d55, #d30000)',
      10: 'linear-gradient(135deg, #3478f6, #0035aa)', 
      25: 'linear-gradient(135deg, #34c759, #00701a)',
      100: 'linear-gradient(135deg, #9254de, #5e00c0)'
    };
    
    animChip.style.background = chipColors[chipValue] || chipColors[5];
    animChip.style.width = '56px';
    animChip.style.height = '56px';
    animChip.style.borderRadius = '50%';
    animChip.style.display = 'flex';
    animChip.style.alignItems = 'center';
    animChip.style.justifyContent = 'center';
    animChip.style.color = '#fff';
    animChip.style.fontWeight = 'bold';
    animChip.style.border = '3px dashed rgba(255,255,255,0.6)';
    animChip.style.boxShadow = '0 3px 6px rgba(0,0,0,0.4)';
    animChip.style.textShadow = '0 1px 2px rgba(0,0,0,0.5)';
    
    // Get selected chip position (source)
    const selectedChipEl = document.querySelector('.chip.selected') || 
                          document.querySelector('.chip[data-amount="' + chipValue + '"]');
    
    if (!selectedChipEl || !spotElement) {
      console.warn('[ANIM] Missing elements for chip animation');
      return Promise.resolve();
    }
    
    const fromRect = selectedChipEl.getBoundingClientRect();
    const toRect = spotElement.getBoundingClientRect();
    
    // Position chip at source
    animChip.style.position = 'fixed';
    animChip.style.left = fromRect.left + 'px';
    animChip.style.top = fromRect.top + 'px';
    animChip.style.zIndex = '9999';
    animChip.style.pointerEvents = 'none';
    
    document.body.appendChild(animChip);
    
    // Animate to destination
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        const targetX = toRect.left + (toRect.width / 2) - 28; // Center chip
        const targetY = toRect.top + (toRect.height / 2) - 28 - (stackCount * 4); // Stack effect
        
        animChip.style.transition = 'all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        animChip.style.left = targetX + 'px';
        animChip.style.top = targetY + 'px';
        animChip.style.transform = `scale(0.8) rotate(${Math.random() * 360}deg)`;
      });
      
      setTimeout(() => {
        animChip.remove();
        resolve();
      }, 800);
    });
  } catch (error) {
    console.error('[ERROR] animateChipToBetSpot failed:', error);
    return Promise.resolve();
  }
}

function getBetStackCount(spotType) {
  try {
    if (!game || !game.bets) return 0;
    
    const currentBet = game.bets[spotType] || 0;
    // Each chip represents its face value, so stack count is bet amount divided by smallest chip
    return Math.floor(currentBet / 5); // Assuming 5 is the smallest chip
  } catch (error) {
    console.error('[ERROR] getBetStackCount failed:', error);
    return 0;
  }
}

function updateSelectedChip() {
  console.log('[UI] Updating selected chip display');
  try {
    const chipTray = document.querySelector('.chip-row');
    if (!chipTray) return;
    
    chipTray.querySelectorAll('.chip').forEach(chip => {
      chip.classList.remove('selected');
      if (parseInt(chip.dataset.amount) === selectedChip) {
        chip.classList.add('selected');
      }
    });
  } catch (error) {
    console.error('[ERROR] updateSelectedChip failed:', error);
  }
}

// Add missing setMobileGameplayMode function
function setMobileGameplayMode(active) {
  console.log('[UI] Mobile gameplay mode:', active ? 'active' : 'inactive');
  
  try {
    const body = document.body;
    const gameContainer = document.querySelector('.game-container');
    const chipTray = document.getElementById('chip-tray');
    const actionButtons = document.getElementById('action-bar');
    
    if (active) {
      if (body) body.classList.add('mobile-gameplay-mode');
      if (gameContainer) gameContainer.classList.add('mobile-gameplay-mode');
      if (chipTray) chipTray.classList.add('minimized');
      if (actionButtons) actionButtons.classList.add('gameplay-mode');
    } else {
      if (body) body.classList.remove('mobile-gameplay-mode');
      if (gameContainer) gameContainer.classList.remove('mobile-gameplay-mode');
      if (chipTray) chipTray.classList.remove('minimized');
      if (actionButtons) actionButtons.classList.remove('gameplay-mode');
    }
  } catch (error) {
    console.error('[ERROR] setMobileGameplayMode failed:', error);
  }
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
// MISSING UI UPDATE FUNCTIONS
// ================================

function updateBetsUI() {
  console.log('[UI] Updating bets UI');
  try {
    // Update bet amounts on all hands
    if (game && game.playerHands) {
      game.playerHands.forEach((hand, index) => {
        const handEl = playerHandsEl.querySelector(`.player-hand[data-hand-index="${index}"]`);
        if (handEl && hand.bet > 0) {
          const betEl = handEl.querySelector('.hand-bet-amount');
          if (betEl) {
            betEl.textContent = `$${hand.bet}`;
          }
        }
      });
    }
    
    // Update total bet display
    const totalBet = game.playerHands ? game.playerHands.reduce((sum, hand) => sum + hand.bet, 0) : 0;
    const totalBetEl = document.getElementById('total-bet-amount');
    if (totalBetEl) {
      totalBetEl.textContent = totalBet;
    }
    
    // Update chips display
    updateChipsDisplay();
    
  } catch (error) {
    console.error('[ERROR] updateBetsUI failed:', error);
  }
}

function updateHandsUI() {
  console.log('[UI] Updating hands UI');
  try {
    // Update dealer hand
    if (dealerCardsEl && game.dealerHand) {
      const dealerHtml = game.dealerHand.cards.map(card => 
        `<div class="card">${renderCard(card)}</div>`
      ).join('');
      dealerCardsEl.innerHTML = dealerHtml;
      
      // Update dealer score
      const dealerScoreEl = document.querySelector('.dealer-score');
      if (dealerScoreEl) {
        if (game.dealerHand.cards.some(card => !card.isFaceUp)) {
          dealerScoreEl.textContent = '?';
        } else {
          dealerScoreEl.textContent = game.dealerHand.score;
        }
      }
    }
    
    // Update player hands
    if (playerHandsEl && game.playerHands) {
      let handsHtml = '';
      game.playerHands.forEach((hand, index) => {
        const isActive = index === game.activeHandIndex;
        const cardsHtml = hand.cards.map(card => 
          `<div class="card">${renderCard(card)}</div>`
        ).join('');
        
        handsHtml += `
          <div class="player-hand ${isActive ? 'active-hand' : ''}" data-hand-index="${index}">
            <div class="hand-header">
              <div class="hand-label">Hand ${index + 1}</div>
              <div class="hand-value ${hand.score > 21 ? 'bust' : ''}">${hand.score}</div>
            </div>
            <div class="hand-cards">${cardsHtml}</div>
            <div class="hand-bet">Bet: $${hand.bet}</div>
          </div>
        `;
      });
      playerHandsEl.innerHTML = handsHtml;
    }
    
  } catch (error) {
    console.error('[ERROR] updateHandsUI failed:', error);
  }
}

function updateActionBarState() {
  console.log('[UI] Updating action bar state');
  try {
    if (!inPlay) {
      showInPlayButtons(false);
      hideEndButtons();
      return;
    }
    
    const activeHand = game.getActiveHand();
    if (!activeHand) {
      showInPlayButtons(false);
      return;
    }
    
    // Show appropriate buttons based on game state
    showInPlayButtons(true);
    
    // Update button states
    const hitBtn = document.getElementById('hit-btn');
    const standBtn = document.getElementById('stand-btn');
    const doubleBtn = document.getElementById('double-btn');
    const splitBtn = document.getElementById('split-btn');
    
    if (hitBtn) hitBtn.disabled = false;
    if (standBtn) standBtn.disabled = false;
    
    // Double down availability
    if (doubleBtn) {
      doubleBtn.disabled = !canDoubleCurrentHand();
      doubleBtn.style.opacity = canDoubleCurrentHand() ? '1' : '0.5';
    }
    
    // Split availability
    if (splitBtn) {
      splitBtn.disabled = !canSplitCurrentHand();
      splitBtn.style.opacity = canSplitCurrentHand() ? '1' : '0.5';
    }
    
  } catch (error) {
    console.error('[ERROR] updateActionBarState failed:', error);
  }
}

// --- Button Visibility Control Functions ---
function showInPlayButtons(show) {
  console.log('[UI] showInPlayButtons:', show);
  try {
    const actionBar = document.getElementById('action-bar');
    const dealBtn = document.getElementById('deal-btn');
    
    if (actionBar) {
      actionBar.style.display = show ? 'flex' : 'none';
    }
    if (dealBtn) {
      dealBtn.style.display = show ? 'none' : 'block';
    }
  } catch (error) {
    console.error('[ERROR] showInPlayButtons failed:', error);
  }
}

function hideEndButtons() {
  console.log('[UI] hideEndButtons called');
  try {
    const newBetBtn = document.getElementById('new-bet-btn');
    const rebetBtn = document.getElementById('rebet-btn');
    const doubleBetBtn = document.getElementById('double-bet-btn');
    
    if (newBetBtn) newBetBtn.style.display = 'none';
    if (rebetBtn) rebetBtn.style.display = 'none';
    if (doubleBetBtn) doubleBetBtn.style.display = 'none';
  } catch (error) {
    console.error('[ERROR] hideEndButtons failed:', error);
  }
}

function showEndButtons() {
  console.log('[UI] showEndButtons called');
  try {
    const newBetBtn = document.getElementById('new-bet-btn');
    const rebetBtn = document.getElementById('rebet-btn');
    const doubleBetBtn = document.getElementById('double-bet-btn');
    
    if (newBetBtn) newBetBtn.style.display = 'block';
    if (rebetBtn) rebetBtn.style.display = 'block';
    if (doubleBetBtn) doubleBetBtn.style.display = 'block';
  } catch (error) {
    console.error('[ERROR] showEndButtons failed:', error);
  }
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
    
    if (duration < 300 && distance > 50) {      if (startY - endY > 50) {
        // Swipe up - Stand
        handlePlayerAction('stand');
        showEnhancedToast('👆 Swipe Stand', 'info');
      } else if (endY - startY > 50) {
        // Swipe down - Hit
        handlePlayerAction('hit');
        showEnhancedToast('👇 Swipe Hit', 'info');
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
    game.placeBet('main', amount);    updateBetsUI();
    updateChipsDisplay();
    debouncedSaveToFirebase();
    showEnhancedToast(`Quick bet: ${amount} chips`, 'success');
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

// Enhanced Debug System for Button Issues
const DEBUG_BUTTONS = true; // Set to false to disable debugging

function debugLog(category, message, data = null) {
  if (!DEBUG_BUTTONS) return;
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [${category}] ${message}`, data || '');
}

function debugButtonState(buttonName, button) {
  if (!DEBUG_BUTTONS || !button) return;
  
  const rect = button.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(button);
  
  debugLog('BUTTON_DEBUG', `${buttonName} State:`, {
    exists: !!button,
    disabled: button.disabled,
    hidden: computedStyle.display === 'none',
    visible: rect.width > 0 && rect.height > 0,
    clickable: !button.disabled && computedStyle.pointerEvents !== 'none',
    position: `${rect.left}, ${rect.top}`,
    size: `${rect.width}x${rect.height}`,
    zIndex: computedStyle.zIndex,
    hasEventListeners: button._hasDebugListeners || false,
    className: button.className,
    innerHTML: button.innerHTML.substring(0, 50)
  });
}

function debugGameState() {
  if (!DEBUG_BUTTONS) return;
  
  debugLog('GAME_STATE', 'Current Game State:', {
    inPlay: inPlay,
    outcomeLock: outcomeLock,
    gameExists: !!game,
    selectedChip: selectedChip,
    userLoggedIn: !!userId,
    handsCount: game?.hands?.length || 0,
    currentHandIndex: game?.currentHandIndex || 0,
    dealerHand: game?.dealer?.cards?.length || 0,
    lastBets: lastBets
  });
}

function addDebugEventListener(element, eventType, handler, label) {
  if (!element) {
    debugLog('EVENT_DEBUG', `❌ Cannot add ${eventType} listener to ${label} - element not found`);
    return;
  }
  
  const debugHandler = function(event) {
    debugLog('EVENT_DEBUG', `🖱️ ${label} ${eventType} triggered`, {
      inPlay: inPlay,
      disabled: element.disabled,
      eventType: event.type,
      target: event.target.tagName + (event.target.id ? '#' + event.target.id : ''),
      timestamp: Date.now()
    });
    
    try {
      return handler.call(this, event);
    } catch (error) {
      debugLog('EVENT_ERROR', `❌ Error in ${label} ${eventType} handler:`, error);
      throw error;
    }
  };
  
  element.addEventListener(eventType, debugHandler);
  element._hasDebugListeners = true;
  debugLog('EVENT_DEBUG', `✅ Added ${eventType} listener to ${label}`);
}

// Enhanced Game Action Debugging
function debugPlayerAction(action) {
  debugLog('PLAYER_ACTION', `Attempting action: ${action}`, {
    inPlay: inPlay,
    canPerformAction: game && typeof game[`can${action.charAt(0).toUpperCase() + action.slice(1)}`] === 'function' 
      ? game[`can${action.charAt(0).toUpperCase() + action.slice(1)}`]() 
      : 'method not found',
    currentHand: game?.getCurrentHand?.() || 'no current hand',
    gameState: game?.getState?.() || 'no state method'
  });
}

// Debug All Buttons Function
function debugAllButtons() {
  if (!DEBUG_BUTTONS) return;
  
  debugLog('BUTTON_AUDIT', '🔍 BUTTON DEBUG AUDIT STARTING');
  debugLog('BUTTON_AUDIT', '=====================================');
  
  // Debug game action buttons
  debugButtonState('Hit Button', hitBtn);
  debugButtonState('Stand Button', standBtn);
  debugButtonState('Double Button', doubleBtn);
  debugButtonState('Split Button', splitBtn);
  debugButtonState('Deal Button', dealBtn);
  debugButtonState('Insurance Button', insuranceBtn);
  debugButtonState('Clear Bets Button', clearBetsBtn);
  debugButtonState('New Bet Button', newBetBtn);
  debugButtonState('Rebet Button', rebetBtn);
  debugButtonState('Double Bet Button', doubleBetBtn);
  
  // Debug action bar visibility
  const actionBar = document.getElementById('action-bar');
  if (actionBar) {
    const actionBarStyle = window.getComputedStyle(actionBar);
    debugLog('ACTION_BAR', 'Action Bar State:', {
      display: actionBarStyle.display,
      visibility: actionBarStyle.visibility,
      opacity: actionBarStyle.opacity,
      zIndex: actionBarStyle.zIndex
    });
  }
  
  // Debug game state
  debugGameState();
  
  debugLog('BUTTON_AUDIT', '=====================================');
  debugLog('BUTTON_AUDIT', '🔍 BUTTON DEBUG AUDIT COMPLETE');
}

// Expose debug functions globally for console access
window.debugAllButtons = debugAllButtons;
window.debugGameState = debugGameState;
window.debugButtonState = debugButtonState;

// Add debug buttons audit to page
if (DEBUG_BUTTONS) {
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === '`') { // Ctrl + ` to trigger debug
      debugAllButtons();
    }
  });
  
  // Auto-debug when game state changes
  const originalInPlay = inPlay;
  Object.defineProperty(window, 'inPlay', {
    get: function() { return originalInPlay; },
    set: function(value) {
      if (value !== originalInPlay) {
        debugLog('GAME_STATE_CHANGE', `inPlay changed: ${originalInPlay} → ${value}`);
        setTimeout(debugAllButtons, 100); // Debug after state settles
      }
      originalInPlay = value;
    }
  });
}

// --- Player Action Handler ---
function handlePlayerAction(action) {
  debugLog('PLAYER_ACTION', `Handling action: ${action}`);
  
  if (!inPlay) {
    console.warn('[WARN] Cannot perform action - game not in play');
    return;
  }
  
  const activeHand = game.getActiveHand();
  if (!activeHand) {
    console.warn('[WARN] No active hand found');
    return;
  }
  
  try {
    switch(action) {
      case 'hit':
        if (activeHand.cards.length >= 2) {
          game.dealCard(activeHand, true);
          updateHandsUI();
          
          if (game.calculateScore(activeHand.cards) > 21) {
            debugLog('PLAYER_ACTION', 'Hand busted, moving to next');
            moveToNextHandOrFinish();
          } else {
            updateActionBarState();
          }
        }
        break;
        
      case 'stand':
        debugLog('PLAYER_ACTION', 'Player stands');
        moveToNextHandOrFinish();
        break;
        
      case 'double':
        if (canDoubleCurrentHand()) {
          // Use the game's doubleDown method instead of manually modifying the bet
          if (game.doubleDown()) {
            updateBetsUI();
            updateHandsUI();
            updateChipsDisplay();
            debouncedSaveToFirebase(); // Use debounced version
            
            // After doubling, automatically stand
            moveToNextHandOrFinish();
          }
        }
        break;
        
      case 'split':
        if (canSplitCurrentHand()) {
          // Use the game's splitHand method
          if (game.splitHand()) {
            updateBetsUI();
            updateHandsUI();
            updateChipsDisplay();
            debouncedSaveToFirebase(); // Use debounced version
            updateActionBarState();
          }
        }
        break;
        
      case 'insurance':
        if (game.dealerHand.cards[0] && game.dealerHand.cards[0].value === 'A') {
          // Use the game's placeInsurance method instead of manual modification
          const insuranceAmount = Math.ceil(activeHand.bet / 2);
          if (game.placeInsurance(insuranceAmount)) {
            updateBetsUI();
            updateChipsDisplay();
            debouncedSaveToFirebase(); // Use debounced version
          }
        }
        break;
        
      default:
        console.warn('[WARN] Unknown action:', action);
    }
  } catch (error) {
    console.error('[ERROR] handlePlayerAction failed:', error);
  }
}

function moveToNextHandOrFinish() {
  if (game.activeHandIndex < game.playerHands.length - 1) {
    game.activeHandIndex++;
    updateHandsUI();
    updateActionBarState();
  } else {
    // All hands complete, finish round
    finishRound();
  }
}

function finishRound() {
  debugLog('ROUND', 'Finishing round...');
  inPlay = false;
  
  // Reveal dealer's hole card
  if (game.dealerHand.cards[1]) {
    game.dealerHand.cards[1].isFaceUp = true;
  }
  
  // Dealer plays
  while (game.dealerHand.score < 17) {
    game.dealCard(game.dealerHand, true);
  }
  
  updateHandsUI();
  
  // Determine outcomes and update chips
  let totalWinnings = 0;
  game.playerHands.forEach(hand => {
    const result = determineHandResult(hand, game.dealerHand);
    if (result === 'win' || result === 'blackjack') {
      const winAmount = result === 'blackjack' ? hand.bet * 2.5 : hand.bet * 2;
      totalWinnings += winAmount;
    } else if (result === 'push') {
      totalWinnings += hand.bet; // Return bet
    }
  });
  
  game.chips += totalWinnings;
  updateChipsDisplay();
  
  showInPlayButtons(false);
  hideEndButtons();
  
  // Update statistics
  gameStats.handsPlayed++;
  if (totalWinnings > 0) {
    gameStats.handsWon++;
    gameStats.totalWinnings += totalWinnings;
    if (totalWinnings > gameStats.biggestWin) {
      gameStats.biggestWin = totalWinnings;
    }
  }
  updateGameStatistics();
}

function updateGameStatistics() {
  try {
    // Update hands played
    const handsPlayedEl = document.querySelector('.stat-value');
    if (handsPlayedEl) {
      handsPlayedEl.textContent = gameStats.handsPlayed;
    }
    
    // Update win rate
    const winRateEl = document.querySelectorAll('.stat-value')[1];
    if (winRateEl && gameStats.handsPlayed > 0) {
      const winRate = ((gameStats.handsWon / gameStats.handsPlayed) * 100).toFixed(1);
      winRateEl.textContent = `${winRate}%`;
    }
    
    // Update session stats in dashboard
    const sessionStatsEl = document.querySelector('.session-stats');
    if (sessionStatsEl) {
      sessionStatsEl.innerHTML = `
        <div class="stat-item">
          <span class="stat-label">Hands:</span>
          <span class="stat-value">${gameStats.handsPlayed}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Win Rate:</span>
          <span class="stat-value">${gameStats.handsPlayed > 0 ? ((gameStats.handsWon / gameStats.handsPlayed) * 100).toFixed(1) + '%' : '0%'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Biggest Win:</span>
          <span class="stat-value">$${gameStats.biggestWin}</span>
        </div>
      `;
    }
    
    debugLog('STATS', `Updated stats - Hands: ${gameStats.handsPlayed}, Win Rate: ${gameStats.handsPlayed > 0 ? ((gameStats.handsWon / gameStats.handsPlayed) * 100).toFixed(1) + '%' : '0%'}`);
  } catch (error) {
    console.error('[ERROR] updateGameStatistics failed:', error);
  }
}

function determineHandResult(playerHand, dealerHand) {
  if (playerHand.score > 21) return 'lose';
  if (dealerHand.score > 21) return 'win';
  if (playerHand.isBlackjack && !dealerHand.isBlackjack) return 'blackjack';
  if (dealerHand.isBlackjack && !playerHand.isBlackjack) return 'lose';
  if (playerHand.score > dealerHand.score) return 'win';
  if (playerHand.score < dealerHand.score) return 'lose';
  return 'push';
}

// --- Event handlers and UI logic ---
function setupEventHandlers() {
  debugLog('SETUP', 'Setting up event handlers...');
  
  // Enhanced chip selection with touch support and debouncing
  if (chipTray) {
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
        
        debugLog('CHIP_SELECTION', `Selected chip: ${selectedChip}`);
      };
      
      // Add both touch and click handlers
      addDebugEventListener(chip, 'click', handleChipSelection, `Chip ${chip.dataset.amount}`);
      addDebugEventListener(chip, 'touchend', handleChipSelection, `Chip ${chip.dataset.amount} Touch`);
      
      // Prevent touch from triggering additional events
      chip.addEventListener('touchstart', (e) => {
        e.preventDefault();
      });
    });
  }

  // Enhanced bet spot handling with full area touch support
  Object.entries(betSpots).forEach(([type, spot]) => {
    if (!spot) return;
    
    let isProcessing = false;
    let touchStartTime = 0;
    
    const handleBetPlacement = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (inPlay || !selectedChip || isProcessing) return;
      
      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 400); // Debounce for bets
      
      // Use the enhanced bet validation
      if (game.canPlaceBet(selectedChip) && game.placeBet(type === 'plus3' ? 'plus3' : type, selectedChip)) {          animateChipToBetSpot(type, selectedChip, spot, getBetStackCount(type));        updateBetsUI();
        updateChipsDisplay();
        debouncedSaveToFirebase();
        showEnhancedToast(`Bet ${selectedChip} placed on ${type === 'main' ? 'Main' : type === 'pp' ? 'P / P' : '21+3'}`, 'success');
        
        // Enhanced haptic feedback for successful bet
        if (navigator.vibrate) {
          navigator.vibrate([40, 30, 40]); // Slightly stronger pattern
        }
        
        // Visual success feedback
        spot.style.boxShadow = '0 0 25px #00ff0066, 0 0 50px #00ff0033';
        setTimeout(() => {
          spot.style.boxShadow = '';        }, 300);
      } else {
        showEnhancedToast('Cannot place bet!', 'error');
        
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
    addDebugEventListener(spot, 'click', handleBetPlacement, `Bet Spot ${type}`);
  });

  // Enhanced button event handlers with debugging
  addDebugEventListener(dealBtn, 'click', () => { 
    debugLog('DEAL_BUTTON', 'Deal button clicked', { inPlay: inPlay });
    if (!inPlay) {
      debugLog('DEAL_BUTTON', 'Starting round...');
      startRound(); 
    } else {
      debugLog('DEAL_BUTTON', 'Cannot deal - game in play');
    }
  }, 'Deal Button');
  
  addDebugEventListener(hitBtn, 'click', () => {
    debugPlayerAction('hit');
    handlePlayerAction('hit');
  }, 'Hit Button');
  
  addDebugEventListener(standBtn, 'click', () => {
    debugPlayerAction('stand');
    handlePlayerAction('stand');
  }, 'Stand Button');
  
  addDebugEventListener(doubleBtn, 'click', () => {
    debugPlayerAction('double');
    handlePlayerAction('double');
  }, 'Double Button');
  
  addDebugEventListener(splitBtn, 'click', () => {
    debugPlayerAction('split');
    handlePlayerAction('split');
  }, 'Split Button');
  
  if (insuranceBtn) {
    addDebugEventListener(insuranceBtn, 'click', () => {
      debugPlayerAction('insurance');
      handlePlayerAction('insurance');
    }, 'Insurance Button');
  }

  // Enhanced betting control handlers
  if (clearBetsBtn) {    addDebugEventListener(clearBetsBtn, 'click', () => { 
      if (!inPlay) { 
        game.clearBets();        updateBetsUI(); 
        updateChipsDisplay(); 
        debouncedSaveToFirebase(); 
        showEnhancedToast('Bets cleared!', 'info'); 
      } 
    }, 'Clear Bets Button');
  }

  // End game buttons
  if (newBetBtn) {
    addDebugEventListener(newBetBtn, 'click', () => {
      hideEndButtons();      resetAllHandsAndUI();
      game.clearBets();
      updateBetsUI();
      updateChipsDisplay();
      debouncedSaveToFirebase();
      updateHandsUI();
      updateActionBarState();
      showInPlayButtons(false);
    }, 'New Bet Button');
  }

  if (rebetBtn) {
    addDebugEventListener(rebetBtn, 'click', () => {
      hideEndButtons();
      if (lastBets) {
        let totalBet = 0;
        Object.keys(lastBets).forEach(k => {          if (lastBets[k] > 0) totalBet += lastBets[k]; 
        });
        if (totalBet > game.chips) {
          showEnhancedToast('Not enough chips for rebet!', 'error');
          showEndButtons();
          return;
        }
        resetAllHandsAndUI();
        game.clearBets();
        Object.keys(lastBets).forEach(k => {
          if (lastBets[k] > 0) {
            game.bets[k] = lastBets[k];
          }
        });        game.chips -= totalBet;
        updateBetsUI();
        updateChipsDisplay();
        debouncedSaveToFirebase();
        startRound();
      }
    }, 'Rebet Button');
  }

  if (doubleBetBtn) {
    addDebugEventListener(doubleBetBtn, 'click', () => {
      hideEndButtons();
      if (lastBets) {
        let totalDoubleBet = 0;
        Object.keys(lastBets).forEach(k => {
          if (lastBets[k] * 2 > game.chips) totalDoubleBet = Infinity;          else totalDoubleBet += lastBets[k];
        });
        if (totalDoubleBet === Infinity || totalDoubleBet * 2 > game.chips) {
          showEnhancedToast('Not enough chips for 2x bet!', 'error');
          showEndButtons();
          return;
        }
        resetAllHandsAndUI();
        game.clearBets();
        Object.keys(lastBets).forEach(k => {
          if (lastBets[k] > 0) {
            game.bets[k] = lastBets[k] * 2;
          }
        });        game.chips -= totalDoubleBet * 2;
        updateBetsUI();
        updateChipsDisplay();
        debouncedSaveToFirebase();
        startRound();
      }
    }, 'Double Bet Button');
  }

  if (logoutBtn) {
    addDebugEventListener(logoutBtn, 'click', async () => {
      await signOut(auth);
      window.location.href = "construction21-login.html";
    }, 'Logout Button');
  }
  
  debugLog('SETUP', 'All event handlers set up successfully');
}

// --- Game Flow Functions ---
async function startRound() {
  debugLog('GAME_FLOW', 'Starting new round...');
  
  if (!game) {
    debugLog('GAME_FLOW', 'Cannot start round - no game instance');
    return;
  }
    // Check if player has placed bets
  const totalBets = (game.bets.main || 0) + (game.bets.pp || 0) + (game.bets.plus3 || 0);
  if (totalBets === 0) {
    showEnhancedToast('Please place a bet first!', 'warning');
    debugLog('GAME_FLOW', 'Cannot start round - no bets placed');
    return;
  }
  
  // Store last bets for rebet functionality
  lastBets = { ...game.bets };
  
  // Initialize game state
  inPlay = true;
  outcomeLock = false;
  
  // Set mobile gameplay mode for touch devices
  setMobileGameplayMode(true);
    // Start the game logic
  try {
    game.startGame();
    
    // Deal opening cards
    await dealOpeningCards();
    
    // Update UI state
    updateHandsUI();
    updateActionBarState();
    showInPlayButtons(true);
    hideEndButtons();
    
    debugLog('GAME_FLOW', 'Round started successfully');  } catch (error) {
    debugLog('GAME_FLOW_ERROR', 'Error starting round:', error);
    showEnhancedToast('Error starting round', 'error');
    inPlay = false;
    setMobileGameplayMode(false);
  }
}

async function checkAndHandleBlackjacks() {
  debugLog('GAME_FLOW', 'Checking for blackjacks...');
  
  if (!game || !game.playerHands || !game.dealerHand) return;
  
  const playerHasBlackjack = game.playerHands[0] && game.calculateScore(game.playerHands[0].cards) === 21;
  const dealerHasBlackjack = game.calculateScore(game.dealerHand.cards) === 21;
  
  if (playerHasBlackjack || dealerHasBlackjack) {
    debugLog('GAME_FLOW', `Blackjack detected - Player: ${playerHasBlackjack}, Dealer: ${dealerHasBlackjack}`);
    
    // Reveal dealer's hole card if there's a blackjack
    if (game.dealerHand.cards.length > 1 && !game.dealerHand.cards[1].isFaceUp) {
      game.dealerHand.cards[1].isFaceUp = true;
      updateHandsUI();
      await delay(1000);
    }
    
    // Handle round completion
    setTimeout(() => {
      processRoundCompletion();
    }, 1500);
  }
}

function processRoundCompletion() {
  debugLog('ROUND', 'Processing round completion...');
  
  try {
    // End the game properly
    inPlay = false;
    setMobileGameplayMode(false);
    
    // Reveal dealer's hole card if not already revealed
    if (game.dealerHand.cards.length > 1 && !game.dealerHand.cards[1].isFaceUp) {
      game.dealerHand.cards[1].isFaceUp = true;
    }
    
    // Update final UI
    updateHandsUI();
    
    // Calculate and apply winnings
    let totalWinnings = 0;
    if (game.playerHands && game.playerHands.length > 0) {
      game.playerHands.forEach(hand => {
        const result = determineHandResult(hand, game.dealerHand);
        if (result === 'win' || result === 'blackjack') {
          const winAmount = result === 'blackjack' ? hand.bet * 2.5 : hand.bet * 2;
          totalWinnings += winAmount;
        } else if (result === 'push') {
          totalWinnings += hand.bet; // Return original bet
        }
      });
    }    // Update chips    game.chips += totalWinnings;
    updateChipsDisplay();
    debouncedSaveToFirebase();
    
    // Update statistics
    gameStats.handsPlayed++;
  } catch (error) {
    console.error('[ERROR] processRoundCompletion failed:', error);
  }
}

// Initialize Firebase auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log('[AUTH] User authenticated:', user.uid);
    // Load user data and initialize game
    await loadUserDataAndStartGame(user);
  } else {
    console.log('[AUTH] No authenticated user, redirecting to login');
    window.location.href = "construction21-login.html";
  }
});