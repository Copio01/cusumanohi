import { Construction21Game } from './construction21-logic.js';

let game = new Construction21Game();
let inPlay = false, outcomeLock = false, resultsCache = null;

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

let selectedChip = null;
let betSpots = {
  main: document.getElementById('main-bet-spot'),
  pp: document.getElementById('pp-bet-spot'),
  plus3: document.getElementById('plus3-bet-spot'),
};

// --- Helper: current hand utilities ---
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
  // Only on the first decision, after deal, if dealer upcard is Ace and insurance not already placed
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
  // All hands finished: either bust, stood, or doubled
  return (
    game.activeHandIndex >= game.playerHands.length ||
    !inPlay
  );
}

// --- Event handlers and UI logic ---
function setupEventHandlers() {
  chipTray.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (inPlay) return;
      selectedChip = parseInt(chip.dataset.amount);
      chipTray.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });

  Object.entries(betSpots).forEach(([type, spot]) => {
    spot.addEventListener('click', () => {
      if (inPlay) return;
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

  dealBtn.addEventListener('click', () => { if (!inPlay) startRound(); });

  hitBtn.addEventListener('click', () => handlePlayerAction('hit'));
  standBtn.addEventListener('click', () => handlePlayerAction('stand'));
  doubleBtn.addEventListener('click', () => handlePlayerAction('double'));
  splitBtn.addEventListener('click', () => handlePlayerAction('split'));
  if (insuranceBtn) insuranceBtn.addEventListener('click', () => handlePlayerAction('insurance'));
  if (clearBetsBtn) clearBetsBtn.addEventListener('click', () => { if (!inPlay) { game.clearBets(); updateBetsUI(); showStatusToast('Bets cleared!'); }});
}

// --- UI update functions ---
function updateBetsUI() {
  mainBetAmountEl.textContent = game.bets.main;
  ppBetAmountEl.textContent = game.bets.pp;
  plus3BetAmountEl.textContent = game.bets.plus3;
}

function showStatusToast(msg, isError = false) {
  statusToast.textContent = msg;
  statusToast.classList.add('active');
  statusToast.style.color = isError ? '#ff4e4e' : '#ffd700';
  setTimeout(() => statusToast.classList.remove('active'), 2000);
}

function updateChipsDisplay() {
  if (profileChipsEl) profileChipsEl.textContent = game.chips;
  if (centerChipsAmountEl) centerChipsAmountEl.textContent = game.chips;
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

// --- Core hand and card rendering, with multi-hand support ---
function updateHandsUI() {
  // Dealer hand
  dealerCardsEl.innerHTML = '';
  game.dealerHand.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.innerHTML = card.isFaceUp ? `${card.value}${card.suit}` : `<span style="font-size:1.3em;">🂠</span>`;
    dealerCardsEl.appendChild(cardEl);
  });

  // Player hands (show all, highlight active)
  playerHandsEl.innerHTML = '';
  game.playerHands.forEach((hand, idx) => {
    const handDiv = document.createElement('div');
    handDiv.className = 'player-hand';
    if (idx === game.activeHandIndex && inPlay) handDiv.classList.add('active-hand');
    hand.cards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      cardDiv.innerHTML = `${card.value}${card.suit}`;
      handDiv.appendChild(cardDiv);
    });
    let tagStr = `<span>Bet: ${hand.bet}</span> <span>Score: ${game.calculateScore(hand.cards)}</span>`;
    if (hand.isSplit) tagStr += ' <span class="side-bet-label">Split</span>';
    if (hand.isDoubled) tagStr += ' <span class="side-bet-label">Double</span>';
    handDiv.innerHTML += `<div class="hand-info">${tagStr}</div>`;
    playerHandsEl.appendChild(handDiv);
  });

  // Show insurance indicator if bought
  if (game.bets.insurance > 0 && inPlay) {
    let ins = document.createElement('div');
    ins.className = 'insurance-label';
    ins.textContent = `Insurance bet: ${game.bets.insurance}`;
    playerHandsEl.appendChild(ins);
  }
  // Show side bet indicators if placed
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

function startRound() {
  if (game.bets.main <= 0) {
    showStatusToast('Place a main bet to start!', true);
    return;
  }
  inPlay = true; outcomeLock = false; resultsCache = null;
  showInPlayButtons(true); enableDealAndClear(false);

  game.createDeck(); game.shuffleDeck();
  let playerBet = game.bets.main;
  game.dealerHand = { cards: [], score: 0, isBlackjack: false, hasInsurance: false };
  game.playerHands = [{ cards: [], score: 0, isBlackjack: false, bet: playerBet }];
  game.activeHandIndex = 0;

  for (let i = 0; i < 2; i++) {
    game.dealCard(game.playerHands[0], true);
    game.dealCard(game.dealerHand, i === 0); // Only first dealer card face up
  }
  updateHandsUI(); updateActionBarState(); updateChipsDisplay(); updateBetsUI();

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

  if (action === 'hit') {
    game.dealCard(hand, true);
    if (game.isBust(hand.cards)) {
      showStatusToast("Bust!");
      nextHandOrSettle();
    } else {
      showStatusToast("Card dealt.");
    }
  } else if (action === 'stand') {
    nextHandOrSettle();
  } else if (action === 'double') {
    if (canDoubleCurrentHand() && game.doubleDown()) {
      showStatusToast("Bet doubled, one card only.");
      if (game.isBust(hand.cards)) {
        showStatusToast("Bust!");
      }
      nextHandOrSettle();
    } else {
      showStatusToast("Cannot double down!", true);
    }
  } else if (action === 'split') {
    if (canSplitCurrentHand() && game.splitHand()) {
      showStatusToast("Hand split.");
      updateHandsUI();
      updateActionBarState();
      return;
    } else {
      showStatusToast("Cannot split!", true);
    }
  } else if (action === 'insurance') {
    // Insurance is always up to half main bet
    let insuranceAmt = Math.ceil(game.bets.main / 2);
    if (canBuyInsurance() && game.placeInsurance(insuranceAmt)) {
      showStatusToast("Insurance bought.");
    } else {
      showStatusToast("Cannot buy insurance!", true);
    }
  }

  updateHandsUI();
  updateActionBarState();
  if (isAllHandsDone()) {
    settleAndEndRound();
  }
}

function nextHandOrSettle() {
  // Advance to next hand, or finish if done
  game.activeHandIndex += 1;
  if (game.activeHandIndex >= game.playerHands.length) {
    settleAndEndRound();
  } else {
    updateHandsUI();
    updateActionBarState();
    showStatusToast(`Next hand: #${game.activeHandIndex + 1}`);
  }
}

function settleAndEndRound() {
  inPlay = false; outcomeLock = true; 
  const results = game.settleHands();
  updateChipsDisplay(); updateBetsUI(); updateHandsUI();

  // Show result toasts
  results.forEach((res, idx) => {
    setTimeout(() => {
      let txt;
      if (res.outcome === 'blackjack' || res.outcome === 'win') txt = `Hand ${idx+1}: You win!`;
      else if (res.outcome === 'push') txt = `Hand ${idx+1}: Push.`;
      else if (res.outcome === 'bust') txt = `Hand ${idx+1}: Bust!`;
      else if (res.outcome === 'dealer_blackjack') txt = `Hand ${idx+1}: Dealer Blackjack.`;
      else txt = `Hand ${idx+1}: Dealer wins.`;
      showStatusToast(txt);
    }, 900 + idx * 700);
  });

  // Insurance payout
  setTimeout(() => {
    if (game.bets.insurance === 0) return; // Insurance always cleared after settlement
    if (game.isBlackjack(game.dealerHand.cards)) {
      showStatusToast("Insurance paid!");
    } else {
      showStatusToast("Insurance lost.");
    }
  }, 800 + results.length * 700);

  setTimeout(() => {
    showStatusToast("Place your bets for the next round!");
    showInPlayButtons(false);
    updateActionBarState();
    outcomeLock = false;
  }, 1500 + results.length * 700);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventHandlers();
  updateBetsUI();
  updateChipsDisplay();
  updateHandsUI();
  updateActionBarState();
  showInPlayButtons(false);
});
