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

// ---------- FIREBASE SYNC ----------

async function loadUserDataAndStartGame(user) {
  userId = user.uid;
  userDocRef = doc(db, "construction21_users", userId);
  let chipCount = 100, displayName = user.email;
  try {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      chipCount = docSnap.data().chips ?? 100;
      displayName = docSnap.data().displayName ?? user.email;
    } else {
      await setDoc(userDocRef, {
        displayName: user.email,
        chips: 100,
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
  if (!userDocRef) return;
  try {
    await updateDoc(userDocRef, {
      chips: game.chips,
      lastLogin: new Date()
    });
  } catch (e) {
    showStatusToast("Couldn't save chips!", true);
  }
}

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

// --- Animated Card Dealing ---
async function animateDealCard(hand, faceUp, isDealer, cardIndex) {
  game.dealCard(hand, faceUp);
  updateHandsUI();
  await delay(550);
}
async function dealOpeningCards() {
  await animateDealCard(game.playerHands[0], true, false, 0);
  await animateDealCard(game.dealerHand, true, true, 0);
  await animateDealCard(game.playerHands[0], true, false, 1);
  await animateDealCard(game.dealerHand, false, true, 1);
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
    };
    
    // Add both touch and click handlers
    chip.addEventListener('click', handleChipSelection);
    chip.addEventListener('touchend', handleChipSelection);
    
    // Prevent touch from triggering additional events
    chip.addEventListener('touchstart', (e) => {
      e.preventDefault();
    });
  });

  // Enhanced bet spot handling with touch support
  Object.entries(betSpots).forEach(([type, spot]) => {
    let isProcessing = false;
    
    const handleBetPlacement = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (inPlay || !selectedChip || isProcessing) return;
      
      isProcessing = true;
      setTimeout(() => { isProcessing = false; }, 400); // Slightly longer debounce for bets
      
      // Use the enhanced bet validation
      if (game.canPlaceBet(selectedChip) && game.placeBet(type === 'plus3' ? 'plus3' : type, selectedChip)) {
        animateChipToBetSpot(type, selectedChip, spot, getBetStackCount(type));
        updateBetsUI();
        updateChipsDisplay();
        saveChipsToFirebase();
        showStatusToast(`Bet ${selectedChip} placed on ${type === 'main' ? 'Main' : type === 'pp' ? 'P / P' : '21+3'}`);
        
        // Enhanced haptic feedback for successful bet
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30]);
        }
      } else {
        showStatusToast('Cannot place bet!', true);
        
        // Error haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
      }
    };
    
    // Add both touch and click handlers
    spot.addEventListener('click', handleBetPlacement);
    spot.addEventListener('touchend', handleBetPlacement);
    
    // Prevent touch from triggering additional events
    spot.addEventListener('touchstart', (e) => {
      e.preventDefault();
    });
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
      resetAllHandsAndUI();
      game.clearBets();
      // Deduct chips for re-bet
      let totalBet = 0;
      Object.keys(lastBets).forEach(k => { 
        if (lastBets[k] > 0) {
          totalBet += lastBets[k];
          game.bets[k] = lastBets[k];
        }
      });
      game.chips -= totalBet;
      updateBetsUI();
      updateChipsDisplay();
      saveChipsToFirebase();
    }
    startRound();
  });  doubleBetBtn.addEventListener('click', () => {
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

function getBetStackCount(type) {
  if (type === 'main') return Math.floor(game.bets.main / (selectedChip || 1));
  if (type === 'pp') return Math.floor(game.bets.pp / (selectedChip || 1));
  if (type === 'plus3') return Math.floor(game.bets.plus3 / (selectedChip || 1));
  return 0;
}

function animateChipToBetSpot(type, amount, spot, stackCount) {
  const chip = chipTray.querySelector(`.chip[data-amount="${amount}"]`);
  if (!chip) return;
  const clone = chip.cloneNode(true);
  clone.classList.add('chip-flying');
  document.body.appendChild(clone);

  const chipRect = chip.getBoundingClientRect();
  const spotRect = spot.getBoundingClientRect();
  clone.style.position = 'fixed';
  clone.style.left = chipRect.left + chipRect.width / 2 - chip.offsetWidth / 2 + 'px';
  clone.style.top = chipRect.top + chipRect.height / 2 - chip.offsetHeight / 2 + 'px';
  clone.style.zIndex = 9999;
  clone.style.pointerEvents = 'none';

  void clone.offsetWidth;
  const stackOffsetY = -stackCount * 8;
  const x = spotRect.left + spotRect.width / 2 - (chipRect.left + chipRect.width / 2);
  const y = spotRect.top + spotRect.height / 2 - (chipRect.top + chipRect.height / 2) + stackOffsetY;
  clone.style.transition = 'transform 0.45s cubic-bezier(.68,-0.55,.27,1.55), opacity 0.5s';
  clone.style.transform = `translate(${x}px, ${y}px) scale(1.3)`;
  clone.style.opacity = 0.95;

  setTimeout(() => {
    clone.remove();
    spot.classList.add('bet-pulse');
    setTimeout(() => spot.classList.remove('bet-pulse'), 300);
  }, 460);
}

function updateBetsUI() {
  mainBetAmountEl.textContent = game.bets.main;
  ppBetAmountEl.textContent = game.bets.pp;
  plus3BetAmountEl.textContent = game.bets.plus3;
  updateBetChipsVisual();
}

function updateBetChipsVisual() {
  Object.values(betSpots).forEach(spot => {
    const toRemove = spot.querySelectorAll('.bet-visual-chip');
    toRemove.forEach(n => n.remove());
    let chipContainer = spot.querySelector('.bet-spot-chips');
    if (!chipContainer) {
      chipContainer = document.createElement('div');
      chipContainer.className = 'bet-spot-chips';
      spot.appendChild(chipContainer);
    }
    chipContainer.innerHTML = '';
  });
  [
    { type: 'main', spot: betSpots.main, bet: game.bets.main },
    { type: 'pp', spot: betSpots.pp, bet: game.bets.pp },
    { type: 'plus3', spot: betSpots.plus3, bet: game.bets.plus3 }
  ].forEach(({type, spot, bet}) => {
    let chipVals = [100, 25, 10, 5];
    let chips = [];
    let amt = bet;
    for (let v of chipVals) {
      let count = Math.floor(amt / v);
      amt -= count * v;
      for (let i = 0; i < count; i++) chips.push(v);
    }
    let chipContainer = spot.querySelector('.bet-spot-chips');
    chips.forEach((v, i) => {
      const chipDiv = document.createElement('div');
      chipDiv.className = `chip bet-visual-chip`;
      chipDiv.dataset.amount = v;
      chipDiv.style.position = 'absolute';
      chipDiv.style.left = `${48 + (i % 3) * 8}px`;
      chipDiv.style.top = `${52 - i * 10}px`;
      chipDiv.style.zIndex = 200 + i;
      chipDiv.innerHTML = `<span class="chip-value">${v}</span>`;
      chipContainer.appendChild(chipDiv);
    });
    spot.style.position = 'relative';
  });
}

function showStatusToast(msg, isError = false) {
  statusToast.textContent = msg;
  statusToast.classList.add('active');
  statusToast.style.color = isError ? '#ff4e4e' : '#ffd700';
  setTimeout(() => statusToast.classList.remove('active'), 2000);
}

function showActionBar(opts) {
  hitBtn.style.display = opts.canHit ? '' : 'none';
  standBtn.style.display = opts.canStand ? '' : 'none';
  doubleBtn.style.display = opts.canDouble ? '' : 'none';
  splitBtn.style.display = opts.canSplit ? '' : 'none';
  if (insuranceBtn) insuranceBtn.style.display = opts.canInsurance ? '' : 'none';
}

function enableDealAndClear(enable) {
  dealBtn.disabled = !enable;
  dealBtn.classList.toggle('faint', !enable);
  clearBetsBtn.style.display = enable ? '' : 'none';
}

function showInPlayButtons(show) {
  actionBar.style.display = show ? '' : 'none';
  dealBtn.style.display = show ? 'none' : '';
  clearBetsBtn.style.display = show ? 'none' : '';
}

function updateHandsUI(resultData = null) {
  dealerCardsEl.innerHTML = '';
  playerHandsEl.innerHTML = '';

  // --- Dealer cards ---
  const dealerHandRect = dealerCardsEl.getBoundingClientRect();
  const virtualDeck = getVirtualDeckPos();

  game.dealerHand.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerHTML = renderCard(card);
    cardEl.style.position = 'absolute';
    dealerCardsEl.appendChild(cardEl);

    cardEl.style.opacity = 0;
    cardEl.style.left = `${virtualDeck.left - dealerHandRect.left}px`;
    cardEl.style.top = `${virtualDeck.top - dealerHandRect.top}px`;

    setTimeout(() => {
      cardEl.classList.add('card-deal-animate');
      cardEl.style.left = `${idx * 34}px`;
      cardEl.style.top = `0px`;
      cardEl.style.opacity = 1;
    }, 40 + idx * 210);

    setTimeout(() => {
      cardEl.style.position = '';
      cardEl.style.left = '';
      cardEl.style.top = '';
      cardEl.classList.remove('card-deal-animate');
      cardEl.style.opacity = '';
    }, 340 + idx * 210);
  });

  // --- Player hands ---
  game.playerHands.forEach((hand, hIdx) => {
    const handDiv = document.createElement('div');
    handDiv.className = 'player-hand';
    if (hIdx === game.activeHandIndex && inPlay) handDiv.classList.add('active-hand');
    handDiv.style.display = 'inline-block';
    handDiv.style.margin = '0 16px';
    handDiv.style.position = 'relative';

    // Fan the cards in a .hand-cards flexbox
    const handCardsDiv = document.createElement('div');
    handCardsDiv.className = 'hand-cards';
    handCardsDiv.style.position = 'relative';
    const n = hand.cards.length;
    const fanGap = Math.min(38, 180 / n);

    hand.cards.forEach((card, idx) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.innerHTML = renderCard(card);
      cardDiv.style.transform = `translateX(${fanGap * (idx - (n - 1) / 2)}px) rotate(${(idx - (n - 1) / 2) * 7}deg)`;
      cardDiv.style.zIndex = 10 + idx;
      cardDiv.style.position = '';
      handCardsDiv.appendChild(cardDiv);
    });

    handDiv.appendChild(handCardsDiv);

    // Hand info: score, bet, split, doubled, blackjack badge
    let tagStr = `<span>Bet: ${hand.bet}</span> <span>Score: ${game.calculateScore(hand.cards)}</span>`;
    if (hand.isSplit) tagStr += ' <span class="side-bet-label">Split</span>';
    if (hand.isDoubled) tagStr += ' <span class="side-bet-label">Double</span>';
    if (hand.cards.length === 2 && game.calculateScore(hand.cards) === 21) {
      tagStr += ' <span style="color:#ffd700;font-weight:bold;background:rgba(0,0,0,0.08);padding:1px 8px;border-radius:10px;margin-left:6px;">Blackjack!</span>';
    }
    const handInfo = document.createElement('div');
    handInfo.className = 'hand-info';
    handInfo.innerHTML = tagStr;
    handDiv.appendChild(handInfo);

    // Per-hand result banners (only after resultData is passed)
    if (resultData && resultData[hIdx]) {
      let resultText = '';
      switch (resultData[hIdx].outcome) {
        case 'blackjack': case 'win': resultText = 'WIN'; break;
        case 'push': resultText = 'PUSH'; break;
        case 'bust': resultText = 'BUST'; break;
        case 'dealer_blackjack': resultText = 'DEALER BJ'; break;
        default: resultText = 'LOSE';
      }
      const resultBanner = document.createElement('div');
      resultBanner.textContent = resultText;
      resultBanner.className = 'result-banner';
      handDiv.appendChild(resultBanner);

      setTimeout(() => {
        if (resultBanner && resultBanner.parentNode) resultBanner.parentNode.removeChild(resultBanner);
      }, 1400);
    }
    playerHandsEl.appendChild(handDiv);
  });

  // Insurance, side bet indicators
  if (game.bets.insurance > 0 && inPlay) {
    let ins = document.createElement('div');
    ins.className = 'insurance-label';
    ins.textContent = `Insurance bet: ${game.bets.insurance}`;
    playerHandsEl.appendChild(ins);
  }
  if (game.bets.pp > 0 && !inPlay) {
    let label = document.createElement('div');
    label.className = 'side-bet-label';
    label.textContent = `Perfect Pairs bet: ${game.bets.pp}`;
    playerHandsEl.appendChild(label);
  }
  if (game.bets.plus3 > 0 && !inPlay) {
    let label = document.createElement('div');
    label.className = 'side-bet-label';
    label.textContent = `21+3 bet: ${game.bets.plus3}`;
    playerHandsEl.appendChild(label);
  }
}

function updateActionBarState() {
  if (!inPlay) {
    showActionBar({ canHit: false, canStand: false, canDouble: false, canSplit: false, canInsurance: false });
    enableDealAndClear(true);
    return;
  }
  showActionBar({
    canHit: canHitCurrentHand(),
    canStand: true,
    canDouble: canDoubleCurrentHand(),
    canSplit: canSplitCurrentHand(),
    canInsurance: canBuyInsurance(),
  });
}

async function startRound() {
  if (game.bets.main <= 0) {
    showStatusToast('Place a main bet to start!', true);
    return;
  }
  
  // Use the enhanced game state management
  if (!game.startGame()) {
    showStatusToast('Cannot start game!', true);
    return;
  }
  
  resetAllHandsAndUI();
  inPlay = true; outcomeLock = false; resultsCache = null;
  showInPlayButtons(true); enableDealAndClear(false);
  
  // Enable mobile gameplay mode
  setMobileGameplayMode(true);

  lastBets = { ...game.bets };

  game.createDeck(); game.shuffleDeck();
  let playerBet = game.bets.main;
  game.dealerHand = { cards: [], score: 0, isBlackjack: false, hasInsurance: false };
  game.playerHands = [{ cards: [], score: 0, isBlackjack: false, bet: playerBet }];
  game.activeHandIndex = 0;

  updateHandsUI(); updateActionBarState(); updateChipsDisplay(); updateBetsUI();
  hideEndButtons();

  await dealOpeningCards(); // <-- Updates action bar state after initial deal!

  if (canBuyInsurance()) {
    showStatusToast("Insurance available: Dealer shows Ace.");
    if (insuranceBtn) insuranceBtn.style.display = '';
  } else if (insuranceBtn) {
    insuranceBtn.style.display = 'none';
  }
}

function handlePlayerAction(action) {
  if (outcomeLock) return;
  const hand = game.getActiveHand();
  if (!hand || !inPlay) return;

  // Use the enhanced action validation
  if (!game.canPerformAction(action)) {
    showStatusToast(`Cannot ${action}!`, true);
    return;
  }

  if (action === 'hit') {
    game.dealCard(hand, true);
    updateHandsUI();
    if (game.isBust(hand.cards)) {
      showStatusToast("Bust!");
      nextHandOrSettle();
    } else {
      showStatusToast("Card dealt.");
    }
  } else if (action === 'stand') {
    nextHandOrSettle();  } else if (action === 'double') {
    if (canDoubleCurrentHand() && game.doubleDown()) {
      updateChipsDisplay();
      saveChipsToFirebase();
      showStatusToast("Bet doubled, one card only.");
      updateHandsUI();
      if (game.isBust(hand.cards)) {
        showStatusToast("Bust!");
      }
      nextHandOrSettle();
    } else {
      showStatusToast("Cannot double down!", true);
    }
  } else if (action === 'split') {
    if (canSplitCurrentHand() && game.splitHand()) {
      updateChipsDisplay();
      saveChipsToFirebase();
      animateSplitCardMove();
      showStatusToast("Hand split.");
      updateHandsUI();
      updateActionBarState();
      return;
    } else {
      showStatusToast("Cannot split!", true);
    }} else if (action === 'insurance') {
    let insuranceAmt = Math.ceil(game.bets.main / 2);
    if (canBuyInsurance() && game.placeInsurance(insuranceAmt)) {
      updateChipsDisplay();
      saveChipsToFirebase();
      showStatusToast("Insurance bought.");
    } else {
      showStatusToast("Cannot buy insurance!", true);
    }
  }  updateHandsUI();
  updateActionBarState();
  if (isAllHandsDone() && !outcomeLock) {
    console.log('[SETTLE DEBUG] settleAndEndRound called from handlePlayerAction');
    settleAndEndRound();
  }
}

function animateSplitCardMove() {
  const handEls = playerHandsEl.querySelectorAll('.player-hand');
  if (handEls.length < 2) return;
  const fromHand = handEls[game.activeHandIndex];
  const toHand = handEls[game.activeHandIndex + 1];
  const fromCard = fromHand.querySelector('.card:last-child');
  if (!fromCard || !toHand) return;

  const cardRect = fromCard.getBoundingClientRect();
  const toRect = toHand.getBoundingClientRect();
  const clone = fromCard.cloneNode(true);
  clone.classList.add('card-fly');
  document.body.appendChild(clone);

  clone.style.position = 'fixed';
  clone.style.left = cardRect.left + 'px';
  clone.style.top = cardRect.top + 'px';
  clone.style.zIndex = 10000;
  void clone.offsetWidth;

  const x = toRect.left - cardRect.left + 44;
  const y = toRect.top - cardRect.top + 4;
  clone.style.transition = 'transform 0.32s cubic-bezier(.68,-0.55,.27,1.55)';
  clone.style.transform = `translate(${x}px, ${y}px) scale(1.08)`;

  setTimeout(() => clone.remove(), 350);
}

function nextHandOrSettle() {
  game.activeHandIndex += 1;
  if (game.activeHandIndex >= game.playerHands.length) {
    // Only settle if not already started!
    if (!outcomeLock && inPlay) {
      console.log('[SETTLE DEBUG] settleAndEndRound called from nextHandOrSettle');
      inPlay = false; // No further player actions allowed
      settleAndEndRound();
    } else {
      console.log('[SETTLE DEBUG] nextHandOrSettle blocked: outcomeLock=' + outcomeLock + ', inPlay=' + inPlay);
    }
  } else {
    updateHandsUI();
    updateActionBarState();
    showStatusToast(`Next hand: #${game.activeHandIndex + 1}`);
  }
}

// Dealer logic: Use the game's shouldDealerHit method for proper rule enforcement
async function dealerPlayOut() {
  console.log('[DEALER PLAYOUT] Starting dealer play-out');
  let cardCount = 0;
  const maxCards = 10; // Safety limit to prevent infinite loops
  
  while (game.shouldDealerHit() && cardCount < maxCards) {
    cardCount++;
    console.log(`[DEALER PLAYOUT] Drawing card #${cardCount}`);
    await delay(700);
    game.dealCard(game.dealerHand, true);
    updateHandsUI();
  }
  
  if (cardCount >= maxCards) {
    console.error(`[DEALER PLAYOUT] ERROR: Hit maximum card limit (${maxCards}), stopping dealer`);
  }
  
  console.log(`[DEALER PLAYOUT] Finished. Final score: ${game.calculateScore(game.dealerHand.cards)}, Total cards drawn: ${cardCount}`);
}

async function settleAndEndRound() {
  console.log('[SETTLE DEBUG] settleAndEndRound started, outcomeLock=' + outcomeLock);
  
  if (outcomeLock) {
    console.log('[SETTLE DEBUG] Already settling, returning early');
    return;
  }
  
  outcomeLock = true; // Prevent multiple triggers
  console.log('[SETTLE DEBUG] Set outcomeLock to true');

  // Reveal all dealer cards before play out
  game.dealerHand.cards.forEach(card => { card.isFaceUp = true; });
  updateHandsUI();

  await dealerPlayOut();

  const results = game.settleHands();
  updateChipsDisplay();
  saveChipsToFirebase();
  updateBetsUI();
  updateHandsUI(results);  results.forEach((res, idx) => {
    setTimeout(() => {
      let txt;
      if (res.outcome === 'blackjack' || res.outcome === 'win') txt = `Hand ${idx+1}: You win!`;
      else if (res.outcome === 'push') txt = `Hand ${idx+1}: Push.`;
      else if (res.outcome === 'bust') txt = `Hand ${idx+1}: Bust!`;
      else if (res.outcome === 'dealer_blackjack') txt = `Hand ${idx+1}: Dealer Blackjack.`;
      else txt = `Hand ${idx+1}: Dealer wins.`;
      showStatusToast(txt);
      
      // Show main hand outcome display for the first result (or if only one hand)
      if (idx === 0 || results.length === 1) {
        setTimeout(() => {
          showMainHandResult(res.outcome, res.payout, idx);
        }, 500);
      }
    }, 900 + idx * 700);
  });
  // Show side bet results
  setTimeout(() => {
    if (game.playerHands.length > 0 && game.playerHands[0].cards.length >= 2) {
      const firstHand = game.playerHands[0];
      
      // Check Perfect Pairs
      if (lastBets && lastBets.pp > 0) {
        const ppResult = game.checkPerfectPairs(firstHand.cards[0], firstHand.cards[1]);
        if (ppResult.payout > 0) {
          const totalWin = lastBets.pp * (ppResult.payout + 1);
          showSideBetWinDisplay('Perfect Pairs', ppResult.type, totalWin);
          showStatusToast(`Perfect Pairs: ${ppResult.type} pays ${ppResult.payout}:1!`);
        } else {
          showStatusToast("Perfect Pairs: No pair.");
        }
      }
      
      // Check 21+3
      if (lastBets && lastBets.plus3 > 0 && game.dealerHand.cards.length > 0) {
        const plus3Cards = [firstHand.cards[0], firstHand.cards[1], game.dealerHand.cards[0]];
        const plus3Result = game.check21Plus3(plus3Cards);
        if (plus3Result.payout > 0) {
          const totalWin = lastBets.plus3 * (plus3Result.payout + 1);
          showSideBetWinDisplay('21+3', plus3Result.type, totalWin);
          showStatusToast(`21+3: ${plus3Result.type} pays ${plus3Result.payout}:1!`);
        } else {
          showStatusToast("21+3: No winning combination.");
        }
      }
    }
  }, 1200 + results.length * 700);
  setTimeout(() => {
    if (game.bets.insurance === 0) return;
    const insuranceAmount = lastBets ? lastBets.insurance : 0;
    if (game.isBlackjack(game.dealerHand.cards)) {
      showStatusToast("Insurance paid!");
      setTimeout(() => {
        showInsuranceResult(true, insuranceAmount * 3);
      }, 500);
    } else {
      showStatusToast("Insurance lost.");
      setTimeout(() => {
        showInsuranceResult(false, insuranceAmount);
      }, 500);
    }
  }, 800 + results.length * 700);  setTimeout(() => {
    // End the game properly using the new game state management
    game.endGame();
    
    // Disable mobile gameplay mode when round ends
    setMobileGameplayMode(false);
    
    showEndButtons();
    showStatusToast("Place your bets for the next round!");
    showInPlayButtons(false);
    updateActionBarState();
    outcomeLock = false;
  }, 1500 + results.length * 700);
}

function showEndButtons() {
  newBetBtn.style.display = '';
  rebetBtn.style.display = '';
  doubleBetBtn.style.display = '';
}
function hideEndButtons() {
  newBetBtn.style.display = 'none';
  rebetBtn.style.display = 'none';
  doubleBetBtn.style.display = 'none';
}

// ---- Enhanced Outcome Display Functions ----
function showOutcomeDisplay(outcomeType, title, description, amount = null, isWin = true, playerScore = null, dealerScore = null) {
  const outcomeDisplay = document.getElementById('side-bet-win-display');
  const outcomeIcon = outcomeDisplay.querySelector('.outcome-icon');
  const outcomeTitle = outcomeDisplay.querySelector('.outcome-title');
  const outcomeTypeDisplay = document.getElementById('outcome-type-display');
  const outcomeAmountDisplay = document.getElementById('outcome-amount-display');
  const amountText = outcomeAmountDisplay.querySelector('.amount-text');
  const outcomeIconSmall = outcomeAmountDisplay.querySelector('.outcome-icon-small');
  
  // Card totals elements
  const outcomeScoresSection = document.getElementById('outcome-scores-section');
  const playerScoreDisplay = document.getElementById('player-score-display');
  const dealerScoreDisplay = document.getElementById('dealer-score-display');
  
  if (!outcomeDisplay) return;
  
  // Remove all existing outcome classes
  const outcomeClasses = ['blackjack', 'win', 'side-bet-win', 'bust', 'lose', 'dealer-blackjack', 'push', 'insurance-win'];
  outcomeClasses.forEach(cls => outcomeDisplay.classList.remove(cls));
  
  // Add the new outcome class
  outcomeDisplay.classList.add(outcomeType);
  
  // Set icons and content based on outcome type
  const outcomeConfig = {
    'blackjack': { icon: '🎰', smallIcon: '💰', title: 'BLACKJACK!' },
    'win': { icon: '🎉', smallIcon: '💰', title: 'YOU WIN!' },
    'side-bet-win': { icon: '✨', smallIcon: '🎰', title: 'SIDE BET WIN!' },
    'bust': { icon: '💥', smallIcon: '💸', title: 'BUST!' },
    'lose': { icon: '😞', smallIcon: '💸', title: 'YOU LOSE' },
    'dealer-blackjack': { icon: '🃏', smallIcon: '💸', title: 'DEALER BLACKJACK' },
    'push': { icon: '🤝', smallIcon: '🪙', title: 'PUSH' },
    'insurance-win': { icon: '🛡️', smallIcon: '💰', title: 'INSURANCE PAID!' }
  };
  
  const config = outcomeConfig[outcomeType] || outcomeConfig['win'];
  
  // Update content
  outcomeIcon.textContent = config.icon;
  outcomeTitle.textContent = title || config.title;
  outcomeTypeDisplay.textContent = description;
  outcomeIconSmall.textContent = config.smallIcon;
  
  // Handle card totals display
  if (playerScore !== null && dealerScore !== null && outcomeScoresSection) {
    outcomeScoresSection.style.display = 'block';
    playerScoreDisplay.textContent = playerScore;
    dealerScoreDisplay.textContent = dealerScore;
    
    // Apply score styling based on outcome
    const playerScoreContainer = playerScoreDisplay.closest('.score-item');
    const dealerScoreContainer = dealerScoreDisplay.closest('.score-item');
    
    // Reset classes
    ['winning', 'bust'].forEach(cls => {
      playerScoreContainer.classList.remove(cls);
      dealerScoreContainer.classList.remove(cls);
    });
    
    // Apply appropriate styling
    if (playerScore > 21) {
      playerScoreContainer.classList.add('bust');
    } else if (dealerScore > 21) {
      dealerScoreContainer.classList.add('bust');
    } else if (outcomeType === 'win' || outcomeType === 'blackjack') {
      playerScoreContainer.classList.add('winning');
    } else if (outcomeType === 'lose' || outcomeType === 'dealer-blackjack') {
      dealerScoreContainer.classList.add('winning');
    }
  } else if (outcomeScoresSection) {
    outcomeScoresSection.style.display = 'none';
  }
  
  // Handle amount display
  if (amount !== null) {
    if (isWin) {
      amountText.textContent = `+${amount}`;
    } else if (amount === 0) {
      amountText.textContent = `${amount}`;
    } else {
      amountText.textContent = `-${Math.abs(amount)}`;
    }
    outcomeAmountDisplay.style.display = 'flex';
  } else {
    outcomeAmountDisplay.style.display = 'none';
  }
  
  // Show the display with animation
  outcomeDisplay.classList.add('show');
  
  // Auto-hide after different durations based on outcome
  const hideDelay = outcomeType === 'blackjack' ? 10000 : 
                   outcomeType === 'side-bet-win' ? 8000 : 6000;
  
  setTimeout(() => {
    closeOutcomeDisplay();
  }, hideDelay);
}

function showSideBetWinDisplay(betType, winType, amount) {
  // Side bets don't show card totals since they're not based on final hand values
  showOutcomeDisplay('side-bet-win', `${betType.toUpperCase()} WIN!`, winType, amount, true);
}

function showMainHandResult(outcome, amount, handIndex = 0) {
  const handText = handIndex > 0 ? ` (Hand ${handIndex + 1})` : '';
  
  // Get current hand scores
  const playerScore = game.playerHands[handIndex] ? 
    game.calculateScore(game.playerHands[handIndex].cards) : 0;
  const dealerScore = game.dealerHand ? 
    game.calculateScore(game.dealerHand.cards) : 0;
  
  switch(outcome) {
    case 'blackjack':
      showOutcomeDisplay('blackjack', 'BLACKJACK!', `Natural 21${handText}`, amount, true, playerScore, dealerScore);
      break;
    case 'win':
      showOutcomeDisplay('win', 'YOU WIN!', `Victory${handText}`, amount, true, playerScore, dealerScore);
      break;
    case 'bust':
      showOutcomeDisplay('bust', 'BUST!', `Over 21${handText}`, amount, false, playerScore, dealerScore);
      break;
    case 'lose':
      showOutcomeDisplay('lose', 'YOU LOSE', `Dealer wins${handText}`, amount, false, playerScore, dealerScore);
      break;
    case 'dealer_blackjack':
      showOutcomeDisplay('dealer-blackjack', 'DEALER BLACKJACK', `House natural 21${handText}`, amount, false, playerScore, dealerScore);
      break;
    case 'push':
      showOutcomeDisplay('push', 'PUSH', `Tie game${handText}`, amount, true, playerScore, dealerScore);
      break;
  }
}

function showInsuranceResult(won, amount) {
  // Insurance bets also don't need card totals shown
  if (won) {
    showOutcomeDisplay('insurance-win', 'INSURANCE PAID!', 'Dealer had blackjack', amount, true);
  } else {
    showOutcomeDisplay('lose', 'INSURANCE LOST', 'Dealer did not have blackjack', amount, false);
  }
}

function closeOutcomeDisplay() {
  const outcomeDisplay = document.getElementById('side-bet-win-display');
  if (outcomeDisplay) {
    outcomeDisplay.classList.remove('show');
  }
}

// Enhanced mobile-friendly close button setup
function setupOutcomeDisplayMobileOptimizations() {
  const closeButton = document.querySelector('.close-win-btn');
  if (!closeButton) return;
  
  // Add mobile touch enhancements
  if (isMobileDevice()) {
    let isProcessing = false;
    
    // Enhanced touch handling with debouncing
    const handleClose = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      if (isProcessing) return;
      isProcessing = true;
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Visual feedback
      closeButton.style.transform = 'scale(0.9)';
      setTimeout(() => {
        closeButton.style.transform = '';
      }, 150);
      
      closeOutcomeDisplay();
      
      setTimeout(() => { isProcessing = false; }, 300);
    };
    
    // Add both touch and click handlers
    closeButton.addEventListener('click', handleClose);
    closeButton.addEventListener('touchend', handleClose);
    
    // Prevent unwanted touch events
    closeButton.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      closeButton.style.transform = 'scale(0.95)';
    });
    
    closeButton.addEventListener('touchcancel', (e) => {
      closeButton.style.transform = '';
    });
  }
}

// Make closeOutcomeDisplay global for onclick
window.closeOutcomeDisplay = closeOutcomeDisplay;

// Legacy function for backward compatibility
function closeSideBetWinDisplay() {
  closeOutcomeDisplay();
}
window.closeSideBetWinDisplay = closeSideBetWinDisplay;

// ---- Mobile Optimizations ----
function isMobileDevice() {
  return window.innerWidth <= 768 || 
         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         ('ontouchstart' in window);
}

function setMobileGameplayMode(isGameplay) {
  const body = document.body;
  const isMobile = isMobileDevice();
  
  if (isMobile) {
    if (isGameplay) {
      body.classList.add('mobile-gameplay');
    } else {
      body.classList.remove('mobile-gameplay');
    }
  }
}

function optimizeForMobile() {
  const isMobile = isMobileDevice();
  
  if (isMobile) {
    // Add mobile class to body
    document.body.classList.add('mobile-device');
    
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
    
    // Enhanced haptic feedback for touch devices
    function addHapticFeedback(element) {
      if (!element) return;
      element.addEventListener('touchstart', function() {
        if (navigator.vibrate) {
          navigator.vibrate(30); // Light haptic feedback
        }
      });
    }
    
    // Enhanced touch target optimization
    function enhanceTouchTargets() {
      // Add larger touch areas for chips
      chipTray.querySelectorAll('.chip').forEach(chip => {
        chip.style.position = 'relative';
        
        // Visual touch feedback
        chip.addEventListener('touchstart', (e) => {
          chip.style.transform = 'scale(0.95)';
          chip.style.transition = 'transform 0.1s ease';
        });
        
        chip.addEventListener('touchend', (e) => {
          setTimeout(() => {
            chip.style.transform = '';
            chip.style.transition = '';
          }, 100);
        });
        
        chip.addEventListener('touchcancel', (e) => {
          chip.style.transform = '';
          chip.style.transition = '';
        });
      });
      
      // Add larger touch areas for bet spots
      Object.values(betSpots).forEach(spot => {
        spot.style.position = 'relative';
        
        // Visual touch feedback for bet spots
        spot.addEventListener('touchstart', (e) => {
          spot.style.transform = 'scale(0.96)';
          spot.style.transition = 'transform 0.1s ease';
        });
        
        spot.addEventListener('touchend', (e) => {
          setTimeout(() => {
            spot.style.transform = '';
            spot.style.transition = '';
          }, 100);
        });
        
        spot.addEventListener('touchcancel', (e) => {
          spot.style.transform = '';
          spot.style.transition = '';
        });
      });
      
      // Enhance button touch targets
      const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
      buttons.forEach(button => {
        button.addEventListener('touchstart', (e) => {
          button.style.transform = 'scale(0.97)';
          button.style.transition = 'transform 0.1s ease';
        });
        
        button.addEventListener('touchend', (e) => {
          setTimeout(() => {
            button.style.transform = '';
            button.style.transition = '';
          }, 100);
        });
        
        button.addEventListener('touchcancel', (e) => {
          button.style.transform = '';
          button.style.transition = '';
        });
      });
    }
    
    // Add haptic feedback to interactive elements
    document.querySelectorAll('.chip, .btn-primary, .btn-secondary, .table-bet-spot').forEach(addHapticFeedback);
    
    // Initialize enhanced touch targets
    enhanceTouchTargets();
    
    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
      setTimeout(function() {
        // Force layout recalculation after orientation change
        document.body.style.opacity = '0.99';
        setTimeout(() => {
          document.body.style.opacity = '';
        }, 10);
      }, 100);
    });
    
    // Prevent unwanted scrolling on mobile
    document.body.addEventListener('touchmove', function(e) {
      if (e.target === document.body) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Add touch tolerance for small screens
    if (window.innerWidth <= 480) {
      document.documentElement.style.setProperty('--touch-tolerance', '12px');
    } else if (window.innerWidth <= 768) {
      document.documentElement.style.setProperty('--touch-tolerance', '8px');
    }
  }
}

// Enhanced deal function with mobile optimizations
const originalDealCards = window.dealCards || (() => {});

// Dynamic touch target adjustment based on screen size
function adjustTouchTargetsForScreen() {
  const screenWidth = window.innerWidth;
  const isMobile = isMobileDevice();
  
  if (!isMobile) return;
  
  // Calculate appropriate touch target sizes
  let chipTouchScale, betSpotTouchScale, minTouchSize;
  
  if (screenWidth <= 480) {
    // Small mobile devices
    chipTouchScale = 1.4;
    betSpotTouchScale = 1.5;
    minTouchSize = 60;
  } else if (screenWidth <= 768) {
    // Regular mobile devices
    chipTouchScale = 1.3;
    betSpotTouchScale = 1.4;
    minTouchSize = 54;
  } else {
    // Larger mobile devices/tablets
    chipTouchScale = 1.2;
    betSpotTouchScale = 1.3;
    minTouchSize = 48;
  }
  
  // Apply dynamic touch target sizing via CSS custom properties
  document.documentElement.style.setProperty('--chip-touch-scale', chipTouchScale);
  document.documentElement.style.setProperty('--bet-spot-touch-scale', betSpotTouchScale);
  document.documentElement.style.setProperty('--min-touch-size', `${minTouchSize}px`);
  
  // Log for debugging (remove in production)
  console.log(`Touch targets adjusted for ${screenWidth}px screen: chip=${chipTouchScale}x, betSpot=${betSpotTouchScale}x, minSize=${minTouchSize}px`);
}

// Call on load and resize
window.addEventListener('resize', adjustTouchTargetsForScreen);
window.addEventListener('orientationchange', () => {
  setTimeout(adjustTouchTargetsForScreen, 100);
});

// Initialize mobile optimizations when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  optimizeForMobile();
  adjustTouchTargetsForScreen(); // Initialize dynamic touch targets
  setupOutcomeDisplayMobileOptimizations(); // Setup enhanced outcome display interactions
});

// ---- Firebase Auth Init ----
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "construction21-login.html";
    return;
  }
  loadUserDataAndStartGame(user);
});
