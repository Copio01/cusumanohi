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
  }
  userDisplayName = displayName;
  if (profileNameEl) profileNameEl.textContent = userDisplayName;
  
  // Create game with userId and set chips manually
  game = new Construction21Game(userId);
  game.chips = chipCount;
  updateChipsDisplay();
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
  if (centerChipsAmountEl) centerChipsAmountEl.textContent = game.chips;
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