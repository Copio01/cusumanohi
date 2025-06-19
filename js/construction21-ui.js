// construction21-ui.js

// --- Core Game Logic & Constants---
import { Construction21Game, GAME_OUTCOMES } from './construction21-logic.js';

// --- Firebase Integration ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

// ==========================================================================
// A. INITIALIZATION & STATE MANAGEMENT
// ==========================================================================

let game; // The single source of truth for all game logic
let uiLocked = false; // Prevents player actions during critical animations
let lastBets = { main: 0, pp: 0, plus3: 0 }; // For the re-bet feature
let selectedChipValue = 5; // Default selected chip
let playerStats = { handsPlayed: 0, totalWagered: 0, netWinnings: 0, blackjacks: 0, biggestWin: 0 };
let userPreferences = { strategyAdvisor: false, tableColor: '#2a623d' };
let previousBalance = 10000;

// Utility for delays in async functions
const delay = ms => new Promise(res => setTimeout(res, ms));

// --- Firebase Initialization ---
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

// ==========================================================================
// B. DOM ELEMENT SELECTORS
// ==========================================================================
const DOMElements = {
    // Player Info
    profileName: document.getElementById('profile-name'),
    playerBalance: document.getElementById('player-balance'),
    logoutBtn: document.getElementById('logout-btn'),
    // Game Areas
    gameTable: document.getElementById('game-table'),
    dealerHand: document.getElementById('dealer-hand'),
    playerHandsContainer: document.getElementById('player-hands'),
    deck: document.getElementById('deck'),
    ambientParticles: document.getElementById('ambient-particles'),
    // Betting
    betSpots: document.querySelectorAll('.bet-spot'),
    chipTray: document.getElementById('chip-tray'),
    // Action Bar
    actionBar: document.getElementById('action-bar'),
    // Modals & Panels
    outcomeModal: document.getElementById('outcome-modal'),
    outcomeTitle: document.getElementById('outcome-title'),
    outcomeList: document.getElementById('outcome-results-list'),
    outcomeTotal: document.getElementById('outcome-total-payout'),
    settingsBtn: document.getElementById('settings-btn'),
    statsBtn: document.getElementById('stats-btn'),
    payoutsBtn: document.getElementById('payouts-btn'),
    settingsModal: document.getElementById('settings-modal'),
    statsModal: document.getElementById('stats-modal'),
    payoutsModal: document.getElementById('payouts-modal'),
    strategyToggle: document.getElementById('strategy-toggle'),
    colorSwatches: document.querySelectorAll('.color-swatch'),
    // Stats fields
    statsHandsPlayed: document.getElementById('stats-hands-played'),
    statsBlackjacks: document.getElementById('stats-blackjacks'),
    statsBiggestWin: document.getElementById('stats-biggest-win'),
    statsNetWinnings: document.getElementById('stats-net-winnings'),
    // Voucher system
    voucherInput: document.getElementById('voucher-input'),
    voucherRedeemBtn: document.getElementById('voucher-redeem-btn'),
    voucherMessage: document.getElementById('voucher-message'),
};

// ==========================================================================
// C. RENDERING ENGINE (UI LOGIC) & ANIMATION HELPERS
// ==========================================================================

function updateUI() {
    if (!game) return;
    renderPlayerState();
    renderHandsAndScores();
    renderBets();
    updateActionBarState();
}

function renderPlayerState() {
    // Animate chip balance changes
    const bal = game.chips;
    animateBalanceChange(bal - previousBalance);
    DOMElements.playerBalance.textContent = bal;
    previousBalance = bal;
    document.body.dataset.gameState = game.isGameInProgress ? 'in-play' : 'betting';
}

function renderHandsAndScores() {
    DOMElements.dealerHand.innerHTML = '';
    game.dealerHand.cards.forEach((cardData, i) => {
        const cardEl = createCardElement(cardData, i === 1 && !game.isGameInProgress ? false : true);
        DOMElements.dealerHand.appendChild(cardEl);
    });
    if (game.dealerHand.cards.length > 0) addScoreBubble(DOMElements.dealerHand, game.dealerHand.score);

    DOMElements.playerHandsContainer.innerHTML = '';
    game.playerHands.forEach((hand, index) => {
        const handContainer = document.createElement('div');
        handContainer.className = 'hand player-hand';
        if (index === game.activeHandIndex && game.isGameInProgress) {
            handContainer.classList.add('is-active');
        }
        if (game.isBlackjack(hand.cards)) {
            handContainer.classList.add('has-blackjack');
        }
        hand.cards.forEach(cardData => handContainer.appendChild(createCardElement(cardData)));
        if (hand.cards.length > 0) addScoreBubble(handContainer, hand.score);
        DOMElements.playerHandsContainer.appendChild(handContainer);
    });
}

function renderBets() {
    DOMElements.betSpots.forEach(spot => {
        const betType = spot.dataset.betType;
        const amount = game.bets[betType] || 0;
        spot.querySelector('.bet-spot__amount').textContent = `$${amount}`;
        spot.classList.toggle('has-bet', amount > 0);
        // Remove old chips and render stack
        spot.querySelector('.bet-spot__chips').innerHTML = '';
        for (let chipSum = amount; chipSum > 0;) {
            let value = [100, 25, 10, 5].find(v => chipSum >= v) || 5;
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.textContent = value;
            chip.setAttribute('data-value', value);
            chipSum -= value;
            spot.querySelector('.bet-spot__chips').appendChild(chip);
        }
    });
}

function createCardElement(cardData, faceUp = true) {
    const card = document.createElement('div');
    card.className = 'card';
    if (!faceUp || cardData.isFaceDown) {
        card.classList.add('is-face-down');
        return card;
    }
    const suitIcons = { '♥': '♥', '♦': '♦', '♠': '♠', '♣': '♣' };
    const suit = suitIcons[cardData.suit] || cardData.suit;
    if (['♥', '♦'].includes(suit)) card.classList.add('card--red');
    card.innerHTML = `
        <div class="card__corner card__corner--top">${cardData.value}</div>
        <div class="card__suit">${suit}</div>
        <div class="card__corner card__corner--bottom">${cardData.value}</div>
    `;
    return card;
}

function addScoreBubble(handEl, score) {
    const scoreBubble = document.createElement('div');
    scoreBubble.className = 'hand-score';
    if (score > 21) scoreBubble.classList.add('is-bust');
    scoreBubble.textContent = score;
    handEl.appendChild(scoreBubble);
}

function updateActionBarState() {
    if (uiLocked) { DOMElements.actionBar.dataset.state = 'ui-locked'; return; }
    if (!game.isGameInProgress) { DOMElements.actionBar.dataset.state = 'betting'; }
    else {
        const hand = game.getActiveHand();
        if (hand) {
            DOMElements.actionBar.dataset.state = 'player-turn';
            // Disable buttons based on game logic
            document.getElementById('double-btn').disabled = !(hand.cards.length === 2 && game.chips >= hand.bet && (game.rules.allowDoubleAfterSplit || !hand.isSplit));
            document.getElementById('split-btn').disabled = !(hand.cards.length === 2 && hand.cards[0].value === hand.cards[1].value && game.chips >= hand.bet);
            document.getElementById('hit-btn').disabled = hand.isSplitAce && !game.rules.allowHitOnSplitAces;

            // --- FEATURE: Basic Strategy Advisor ---
            if (userPreferences.strategyAdvisor && typeof game.getBasicStrategyMove === 'function') {
                const correctMove = game.getBasicStrategyMove();
                DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
                    btn.classList.toggle('is-recommended', btn.dataset.action === correctMove);
                });
            }
        } else {
            DOMElements.actionBar.dataset.state = 'dealer-turn';
        }
    }
}

// ==========================================================================
// D. ANIMATION & VISUAL EFFECTS
// ==========================================================================

// Animate Card Dealing (from deck to target hand)
async function animateDealCard(targetHandContainer, cardData) {
    const deck = DOMElements.deck;
    const deckRect = deck.getBoundingClientRect();
    const destRect = targetHandContainer.getBoundingClientRect();
    const handCardCount = targetHandContainer.children.length;
    const tempCard = createCardElement(cardData);
    tempCard.classList.add('dealing');
    document.body.appendChild(tempCard);
    // Position for flight
    tempCard.style.left = `${deckRect.left}px`;
    tempCard.style.top = `${deckRect.top}px`;
    tempCard.style.setProperty('--from-x', '0px');
    tempCard.style.setProperty('--from-y', '0px');
    tempCard.style.setProperty('--to-x', `${destRect.left - deckRect.left + (handCardCount * 30)}px`);
    tempCard.style.setProperty('--to-y', `${destRect.top - deckRect.top}px`);
    await delay(580);
    tempCard.remove();
    // Now append final card to hand
    targetHandContainer.appendChild(createCardElement(cardData));
}

// Animate Chip Flight
function animateChipToBetSpot(chipButton, betSpot) {
    const chipRect = chipButton.getBoundingClientRect();
    const betRect = betSpot.getBoundingClientRect();
    const flyingChip = chipButton.cloneNode(true);
    flyingChip.classList.add('flying');
    document.body.appendChild(flyingChip);
    flyingChip.style.left = `${chipRect.left}px`;
    flyingChip.style.top = `${chipRect.top}px`;
    flyingChip.style.setProperty('--from-x', '0px');
    flyingChip.style.setProperty('--from-y', '0px');
    flyingChip.style.setProperty('--to-x', `${betRect.left - chipRect.left + betRect.width / 2 - chipRect.width / 2}px`);
    flyingChip.style.setProperty('--to-y', `${betRect.top - chipRect.top + betRect.height / 2 - chipRect.height / 2}px`);
    flyingChip.addEventListener('animationend', () => flyingChip.remove());
}

// Animate balance change floating delta
function animateBalanceChange(delta) {
    if (!delta || delta === 0) return;
    const balWrap = DOMElements.playerBalance.parentElement;
    const el = document.createElement('div');
    el.className = 'balance-delta' + (delta < 0 ? ' negative' : '');
    el.textContent = (delta > 0 ? '+' : '') + delta;
    el.style.left = '50%';
    balWrap.style.position = 'relative';
    balWrap.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}

// Show win confetti on a hand container
function showWinConfetti(handEl) {
    const confetti = document.createElement('div');
    confetti.className = 'win-confetti';
    confetti.textContent = '🎉';
    handEl.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1100);
}

// Shake an element (for invalid actions)
function shakeElement(el) {
    el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

// Ambient particles are handled in HTML init

// ==========================================================================
// E. GAME OUTCOME & MODALS
// ==========================================================================

function showOutcomeModal(results) {
    DOMElements.outcomeTitle.textContent = results.totalNet > 0
        ? "You Win!"
        : results.totalNet < 0
            ? "You Lose!"
            : "Push!";
    DOMElements.outcomeList.innerHTML = '';
    results.mainHandResults.forEach((hand, i) => {
        const li = document.createElement('li');
        li.textContent = `Hand ${i + 1}: ${hand.outcome} | Bet $${hand.bet} | Payout $${hand.payout}`;
        if (hand.outcome === 'BLACKJACK' || hand.outcome === 'WIN') {
            const handEls = DOMElements.playerHandsContainer.querySelectorAll('.hand');
            if (handEls[i]) showWinConfetti(handEls[i]);
        }
        DOMElements.outcomeList.appendChild(li);
    });
    DOMElements.outcomeTotal.textContent = `Net: $${results.totalNet}`;
    DOMElements.outcomeModal.classList.add('is-visible');
}

// ==========================================================================
// F. STATISTICS & CUSTOMIZATION
// ==========================================================================

function updateAndSaveStats(results) {
    playerStats.handsPlayed += results.mainHandResults.length;
    playerStats.netWinnings += results.totalNet;
    if (results.totalNet > playerStats.biggestWin) {
        playerStats.biggestWin = results.totalNet;
    }
    results.mainHandResults.forEach(hand => {
        playerStats.totalWagered += hand.bet;
        if (hand.outcome === GAME_OUTCOMES.BLACKJACK) {
            playerStats.blackjacks++;
        }
    });
    // Save to Firestore
    if (game?.userId) {
        const userDocRef = doc(db, "users", game.userId);
        updateDoc(userDocRef, { stats: playerStats, chips: game.chips });
    }
}

function updateStatsDisplay() {
    DOMElements.statsHandsPlayed.textContent = playerStats.handsPlayed;
    DOMElements.statsNetWinnings.textContent = `$${playerStats.netWinnings}`;
    DOMElements.statsBlackjacks.textContent = playerStats.blackjacks;
    DOMElements.statsBiggestWin.textContent = `$${playerStats.biggestWin}`;
}

function applyCustomization(prefs) {
    // Table color
    DOMElements.gameTable.style.setProperty('--color-felt', prefs.tableColor);
    // Swatch highlight
    DOMElements.colorSwatches.forEach(s =>
        s.classList.toggle('selected', s.dataset.color === prefs.tableColor)
    );
    // Strategy toggle state
    if (DOMElements.strategyToggle)
        DOMElements.strategyToggle.checked = !!prefs.strategyAdvisor;
}

function loadPreferences() {
    const savedPrefs = localStorage.getItem('blackjack_prefs');
    if (savedPrefs) userPreferences = JSON.parse(savedPrefs);
    applyCustomization(userPreferences);
}

function savePreference(key, value) {
    userPreferences[key] = value;
    localStorage.setItem('blackjack_prefs', JSON.stringify(userPreferences));
    applyCustomization(userPreferences);
}

// ==========================================================================
// G. GAME FLOW & ACTION HANDLING
// ==========================================================================

async function initializeGame(user) {
    const userDocRef = doc(db, "users", user.uid);
    onSnapshot(userDocRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const userData = docSnap.data();
        if (!game) {
            game = new Construction21Game(user.uid);
            DOMElements.profileName.textContent = userData.displayName || user.email;
            playerStats = userData.stats || playerStats;
            previousBalance = userData.chips;
            loadPreferences();
            setupEventHandlers();
        }
        game.chips = userData.chips;
        updateUI();
    });
    const docSnap = await getDoc(userDocRef);
    if (!docSnap.exists()) {
        await setDoc(userDocRef, { displayName: user.email, chips: 10000, stats: playerStats });
    }
}

async function runDealerTurn() {
    uiLocked = true;
    updateActionBarState();

    // Flip dealer's hole card if present
    const dealerCards = DOMElements.dealerHand.querySelectorAll('.card');
    const holeCard = dealerCards[1];
    if (holeCard && holeCard.classList.contains('is-face-down')) {
        // Animate flip
        holeCard.classList.remove('is-face-down');
        holeCard.innerHTML = createCardElement(game.dealerHand.cards[1]).innerHTML;
        await delay(800);
    }

    while (game.shouldDealerHit()) {
        await delay(800);
        const newCard = game.dealCard(game.dealerHand);
        await animateDealCard(DOMElements.dealerHand, newCard);
        updateUI();
    }

    await delay(900);
    const results = game.settleHands();
    updateAndSaveStats(results);
    updateUI();
    showOutcomeModal(results);
    uiLocked = false;
    updateActionBarState();
}

// ==========================================================================
// H. EVENT LISTENERS & UI INTERACTION
// ==========================================================================

function setupEventHandlers() {
    // Chips
    DOMElements.chipTray.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            DOMElements.chipTray.querySelectorAll('.chip').forEach(c => c.classList.remove('is-selected'));
            chip.classList.add('is-selected');
            selectedChipValue = parseInt(chip.dataset.value, 10);
        });
    });

    // Betting
    DOMElements.betSpots.forEach(spot => {
        spot.addEventListener('click', () => {
            if (uiLocked || !selectedChipValue) {
                shakeElement(DOMElements.chipTray);
                return;
            }
            if (game.chips < selectedChipValue) {
                shakeElement(DOMElements.playerBalance);
                return;
            }
            game.placeBet(spot.dataset.betType, selectedChipValue);
            animateChipToBetSpot(
                DOMElements.chipTray.querySelector('.chip.is-selected'),
                spot
            );
            updateUI();
        });
    });

    // Action Bar
    DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (uiLocked || btn.disabled) {
                shakeElement(btn);
                return;
            }
            switch (btn.dataset.action) {
                case 'deal':
                    uiLocked = true;
                    updateActionBarState();
                    game.startRound();
                    updateUI();
                    // Animate initial deal
                    for (let i = 0; i < 2; i++) {
                        for (const hand of [DOMElements.playerHandsContainer, DOMElements.dealerHand]) {
                            await delay(220);
                            const card = game.dealCard(hand === DOMElements.playerHandsContainer
                                ? game.playerHands[0]
                                : game.dealerHand);
                            await animateDealCard(hand, card);
                        }
                    }
                    uiLocked = false;
                    updateUI();
                    break;
                case 'hit':
                    uiLocked = true;
                    updateActionBarState();
                    {
                        const hand = game.getActiveHand();
                        const card = game.dealCard(hand);
                        await animateDealCard(
                            DOMElements.playerHandsContainer.children[game.activeHandIndex],
                            card
                        );
                        updateUI();
                    }
                    uiLocked = false;
                    updateUI();
                    break;
                case 'stand':
                    game.stand();
                    updateUI();
                    if (game.isDealerTurn) await runDealerTurn();
                    break;
                case 'double':
                    game.double();
                    updateUI();
                    break;
                case 'split':
                    game.split();
                    updateUI();
                    break;
                case 'rebet':
                    game.rebet();
                    updateUI();
                    break;
                case 'new-game':
                    game.reset();
                    updateUI();
                    break;
                case 'clear':
                    game.clearBets();
                    updateUI();
                    break;
            }
        });
    });

    // Modal Openers/Closers
    if (DOMElements.statsBtn) {
        DOMElements.statsBtn.addEventListener('click', () => {
            updateStatsDisplay();
            DOMElements.statsModal.classList.add('is-visible');
        });
    }
    if (DOMElements.payoutsBtn) {
        DOMElements.payoutsBtn.addEventListener('click', () => {
            DOMElements.payoutsModal.classList.add('is-visible');
        });
    }
    if (DOMElements.settingsBtn) {
        DOMElements.settingsBtn.addEventListener('click', () => {
            DOMElements.settingsModal.classList.add('is-visible');
        });
    }
    if (DOMElements.logoutBtn) {
        DOMElements.logoutBtn.addEventListener('click', () => signOut(auth));
    }

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('is-visible');
        });
    });

    // Settings - strategy toggle & color swatch
    if (DOMElements.strategyToggle) {
        DOMElements.strategyToggle.addEventListener('change', (e) => {
            savePreference('strategyAdvisor', e.target.checked);
            updateUI();
        });
    }
    if (DOMElements.colorSwatches) {
        DOMElements.colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                savePreference('tableColor', swatch.dataset.color);
            });
        });
    }
}

// ==========================================================================
// I. INITIALIZATION
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeGame(user);
    } else {
        document.body.innerHTML = `<h1>Please log in to play</h1>`;
    }
});
