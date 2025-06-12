// construction21-ui.js
// UI logic for Construction 21 (Blackjack)
// This file wires up the new modern UI to the modular game logic in construction21-logic.js

import { Construction21Game } from './construction21-logic.js';

// --- Game State ---
let game = new Construction21Game();

// --- DOM Elements ---
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
const statusToast = document.getElementById('status-toast');
const profileChipsEl = document.getElementById('profile-chips');
const centerChipsAmountEl = document.getElementById('center-chips-amount');
const profileNameEl = document.getElementById('profile-name');

// --- UI State ---
let selectedChip = null;
let betSpots = {
  main: document.getElementById('main-bet-spot'),
  pp: document.getElementById('pp-bet-spot'),
  plus3: document.getElementById('plus3-bet-spot'),
};

// --- Event Handlers ---
function setupEventHandlers() {
  // Chip click: select chip for betting
  chipTray.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedChip = parseInt(chip.dataset.amount);
      chipTray.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  // Bet spot click: place bet
  Object.entries(betSpots).forEach(([type, spot]) => {
    spot.addEventListener('click', () => {
      if (!selectedChip) return;
      if (game.canPlaceBet(selectedChip)) {
        game.placeBet(type === 'plus3' ? 'plus3' : type, selectedChip);
        updateBetsUI();
        showStatusToast(`Bet ${selectedChip} placed on ${type === 'main' ? 'Main' : type === 'pp' ? 'P / P' : '21+3'}`);
      } else {
        showStatusToast('Not enough chips!', true);
      }
    });
  });

  // Deal button
  dealBtn.addEventListener('click', startRound);

  // Action bar buttons
  hitBtn.addEventListener('click', () => handlePlayerAction('hit'));
  standBtn.addEventListener('click', () => handlePlayerAction('stand'));
  doubleBtn.addEventListener('click', () => handlePlayerAction('double'));
  splitBtn.addEventListener('click', () => handlePlayerAction('split'));

  // Clear Bets button
  const clearBetsBtn = document.getElementById('clear-bets-btn');
  if (clearBetsBtn) {
    clearBetsBtn.addEventListener('click', () => {
      game.clearBets();
      updateBetsUI();
      showStatusToast('Bets cleared!');
    });
  }
}

// --- UI Update Functions ---
function updateBetsUI() {
  mainBetAmountEl.textContent = game.bets.main;
  ppBetAmountEl.textContent = game.bets.pp;
  plus3BetAmountEl.textContent = game.bets.plus3;
}

function showStatusToast(msg, isError = false) {
  statusToast.textContent = msg;
  statusToast.classList.remove('hidden');
  statusToast.style.color = isError ? '#ff4e4e' : '#ffd700';
  setTimeout(() => statusToast.classList.add('hidden'), 1800);
}

function updateChipsDisplay() {
  if (profileChipsEl) profileChipsEl.textContent = game.chips;
  if (centerChipsAmountEl) centerChipsAmountEl.textContent = game.chips;
}

// Patch: Call updateChipsDisplay after every bet, clear, or round start
// (1) After placeBet
const originalPlaceBet = game.placeBet.bind(game);
game.placeBet = function(type, amount) {
  const result = originalPlaceBet(type, amount);
  updateChipsDisplay();
  return result;
};
// (2) After clearBets
const originalClearBets = game.clearBets.bind(game);
game.clearBets = function() {
  originalClearBets();
  updateChipsDisplay();
};
// (3) After round start (in startRound)
const originalStartRound = startRound;
function patchedStartRound() {
  originalStartRound();
  updateChipsDisplay();
}
window.startRound = patchedStartRound;
// (4) On page load
updateChipsDisplay();

// --- Firebase Auth: Display user name/email in header ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk",
  authDomain: "cusumano-website.firebaseapp.com",
  projectId: "cusumano-website",
  storageBucket: "cusumano-website.firebasestorage.app",
  messagingSenderId: "20051552210",
  appId: "1:20051552210:web:7eb3b22baa3fec184e4a0b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Try to get displayName from Firestore user doc, fallback to auth
    let displayName = user.displayName || user.email;
    try {
      const userDoc = await getDoc(doc(db, "construction21_users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        displayName = data.displayName || data.email || displayName;
      }
    } catch (e) {}
    profileNameEl.textContent = displayName;
  } else {
    profileNameEl.textContent = '';
  }
});

// --- Game Flow ---
function startRound() {
  if (game.bets.main <= 0) {
    showStatusToast('Place a main bet to start!', true);
    return;
  }
  game.createDeck();
  game.shuffleDeck();
  game.dealerHand = { cards: [], score: 0, isBlackjack: false };
  game.playerHands = [{ cards: [], score: 0, isBlackjack: false, bet: game.bets.main }];
  game.activeHandIndex = 0;
  // Deal initial cards
  for (let i = 0; i < 2; i++) {
    game.dealCard(game.playerHands[0], true);
    game.dealCard(game.dealerHand, i === 0); // Dealer: 1 face up, 1 face down
  }
  updateHandsUI();
  updateActionBarState();
  updateChipsDisplay();
}

function updateHandsUI() {
  // Render dealer and player hands (placeholder, to be expanded with card rendering)
  dealerCardsEl.innerHTML = game.dealerHand.cards.map(card => `<div class="card">${card.isFaceUp ? card.value + card.suit : '?'}</div>`).join('');
  playerHandsEl.innerHTML = game.playerHands.map(hand =>
    `<div class="player-hand">${hand.cards.map(card => `<div class="card">${card.value + card.suit}</div>`).join('')}</div>`
  ).join('');
}

function updateActionBarState() {
  // Show/hide Double/Split based on game state
  const hand = Array.isArray(game.playerHands) && game.playerHands[game.activeHandIndex];
  let canDouble = false, canSplit = false;
  if (hand && Array.isArray(hand.cards) && hand.cards.length === 2) {
    canDouble = game.chips >= (hand.bet || 0);
    canSplit = hand.cards[0].value === hand.cards[1].value && game.chips >= (hand.bet || 0);
  }
  updateActionBar({ canDouble, canSplit });
}

function handlePlayerAction(action) {
  // Placeholder: implement logic for hit, stand, double, split
  showStatusToast(`Action: ${action}`);
  // After action, update UI and action bar state
  updateHandsUI();
  updateActionBarState();
}

// --- Drag-and-Drop Chip Placement ---
let floatingChipEl = null;
let chipOffset = { x: 0, y: 0 };
let isAnimating = false;

function setupChipDragAndDrop() {
  // Touch support detection
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  chipTray.querySelectorAll('.chip').forEach(chip => {
    // Handle both mouse and touch events
    const startEvent = isTouchDevice ? 'touchstart' : 'mousedown';
    const moveEvent = isTouchDevice ? 'touchmove' : 'mousemove';
    const endEvent = isTouchDevice ? 'touchend' : 'mouseup';
    
    chip.addEventListener(startEvent, (e) => {
      e.preventDefault();
      
      // Remove any existing floating chip
      if (floatingChipEl) floatingChipEl.remove();
      
      const amount = parseInt(chip.dataset.amount);
      
      // Add visual feedback to the original chip
      chip.classList.add('selected');
      
      // Create floating chip with enhanced styling
      floatingChipEl = chip.cloneNode(true);
      floatingChipEl.style.position = 'fixed';
      floatingChipEl.style.pointerEvents = 'none';
      floatingChipEl.style.zIndex = 1000;
      floatingChipEl.style.opacity = 0.9;
      floatingChipEl.classList.add('picked-up');
      document.body.appendChild(floatingChipEl);
      
      // Add shadow and glow effects
      floatingChipEl.style.filter = 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))';
      floatingChipEl.style.transition = 'transform 0.1s ease-out';
      
      // Calculate initial position
      const clientX = isTouchDevice ? e.touches[0].clientX : e.clientX;
      const clientY = isTouchDevice ? e.touches[0].clientY : e.clientY;
      
      // Store offset for smoother dragging
      const rect = chip.getBoundingClientRect();
      chipOffset = {
        x: clientX - rect.left - rect.width / 2,
        y: clientY - rect.top - rect.height / 2
      };
      
      // Initial position
      moveFloatingChip(e);
      
      // Setup event listeners
      document.addEventListener(moveEvent, moveFloatingChip, { passive: false });
      document.addEventListener(endEvent, handleChipMouseUp);
      
      // Store selected chip value
      selectedChip = amount;
      
      // Add brief animation
      playPickupAnimation(floatingChipEl);
    });
  });
}

function moveFloatingChip(e) {
  if (!floatingChipEl || isAnimating) return;
  
  // Get coordinates from either mouse or touch event
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  // Apply position with smooth dragging
  floatingChipEl.style.left = (clientX - floatingChipEl.offsetWidth / 2 - chipOffset.x) + 'px';
  floatingChipEl.style.top = (clientY - floatingChipEl.offsetHeight / 2 - chipOffset.y) + 'px';
  
  // Highlight bet spots on hover for better UX
  highlightBetSpotOnHover(clientX, clientY);
}

function highlightBetSpotOnHover(x, y) {
  // Find spot under cursor/finger
  const elements = document.elementsFromPoint(x, y);
  const spot = elements.find(el => el.classList.contains('table-bet-spot'));
  
  // Clear all highlights first
  Object.values(betSpots).forEach(s => s.classList.remove('active'));
  
  // Add highlight if hovering over a bet spot
  if (spot) spot.classList.add('active');
}

function playPickupAnimation(element) {
  isAnimating = true;
  element.style.transform = 'scale(1.2) translateY(-10px)';
  setTimeout(() => {
    element.style.transform = 'scale(1.15) translateY(-8px)';
    isAnimating = false;
  }, 150);
}

function playDropAnimation(spotElement, amount, type) {
  // Create a chip element for animation
  const animChip = document.createElement('div');
  animChip.className = 'chip picked-up';
  animChip.dataset.amount = amount;
  animChip.innerHTML = `<span class="chip-value">${amount}</span>`;
  
  // Position it at the floating chip location
  const floatingRect = floatingChipEl.getBoundingClientRect();
  animChip.style.position = 'fixed';
  animChip.style.left = floatingRect.left + 'px';
  animChip.style.top = floatingRect.top + 'px';
  animChip.style.zIndex = 999;
  document.body.appendChild(animChip);
  
  // Get the target position
  const spotRect = spotElement.getBoundingClientRect();
  const targetX = spotRect.left + spotRect.width/2 - floatingRect.width/2;
  const targetY = spotRect.top + spotRect.height/2 - floatingRect.height/2;
  
  // Animate
  animChip.style.transition = 'all 0.3s cubic-bezier(0.2, 0.85, 0.4, 1.275)';
  setTimeout(() => {
    animChip.style.transform = 'scale(0.75)';
    animChip.style.opacity = '0.9';
    animChip.style.left = targetX + 'px';
    animChip.style.top = targetY + 'px';
  }, 10);
  
  // Remove after animation
  setTimeout(() => {
    animChip.remove();
    // Update UI
    updateBetsUI();
  }, 350);
}

function handleChipMouseUp(e) {
  if (!floatingChipEl) return;
  
  // Get coordinates
  const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  
  // Find elements under pointer
  const elements = document.elementsFromPoint(clientX, clientY);
  const spot = elements.find(el => el.classList.contains('table-bet-spot'));
  
  // Try to place bet if released over a bet spot
  if (spot && selectedChip) {
    const type = spot.id === 'main-bet-spot' ? 'main' : spot.id === 'pp-bet-spot' ? 'pp' : 'plus3';
    
    if (game.canPlaceBet(selectedChip)) {
      // Place bet and play drop animation
      game.placeBet(type, selectedChip);
      playDropAnimation(spot, selectedChip, type);
      showStatusToast(`Bet ${selectedChip} placed on ${type === 'main' ? 'Main' : type === 'pp' ? 'P / P' : '21+3'}`);
    } else {
      showStatusToast('Not enough chips!', true);
    }
  }
  
  // Clear all highlights
  Object.values(betSpots).forEach(s => s.classList.remove('active'));
  
  // Remove visual feedback from chips
  chipTray.querySelectorAll('.chip').forEach(chip => chip.classList.remove('selected'));
  
  // Clean up
  if (floatingChipEl) floatingChipEl.remove();
  floatingChipEl = null;
  selectedChip = null;
  document.removeEventListener('mousemove', moveFloatingChip);
  document.removeEventListener('touchmove', moveFloatingChip);
  document.removeEventListener('mouseup', handleChipMouseUp);
  document.removeEventListener('touchend', handleChipMouseUp);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventHandlers();
  setupChipDragAndDrop();
  updateBetsUI();
  updateChipsDisplay();
});
