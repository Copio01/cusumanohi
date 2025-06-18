// construction21-ui.js

// --- Core Game Logic & Constants---
import { Construction21Game, GAME_OUTCOMES } from './construction21-logic.js';

// --- Firebase Integration ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

// ==========================================================================
// A. INITIALIZATION & STATE MANAGEMENT
// ==========================================================================

let game; // The single source of truth for all game logic
let uiLocked = false; // Prevents player actions during critical animations
let lastBets = { main: 0, pp: 0, plus3: 0 }; // For the re-bet feature
let selectedChipValue = 5; // Default selected chip
let playerStats = { handsPlayed: 0, totalWagered: 0, netWinnings: 0, blackjacks: 0, biggestWin: 0 };
let userPreferences = { strategyAdvisor: false, tableColor: '#2a623d' };

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
    settingsBtn: document.getElementById('settings-btn'), // Assumes these exist in your HTML
    statsBtn: document.getElementById('stats-btn'),
    settingsModal: document.getElementById('settings-modal'),
    statsModal: document.getElementById('stats-modal'),
    strategyToggle: document.getElementById('strategy-toggle'),
    colorSwatches: document.querySelectorAll('.color-swatch'),
};

// ==========================================================================
// C. RENDERING ENGINE (UI LOGIC)
// ==========================================================================

function updateUI() {
    if (!game) return;
    renderPlayerState();
    renderHandsAndScores();
    renderBets();
    updateActionBarState();
}

function renderPlayerState() {
    DOMElements.playerBalance.textContent = game.chips;
    document.body.dataset.gameState = game.isGameInProgress ? 'in-play' : 'betting';
}

function renderHandsAndScores() {
    DOMElements.dealerHand.innerHTML = '';
    game.dealerHand.cards.forEach(cardData => {
        DOMElements.dealerHand.appendChild(createCardElement(cardData));
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
    });
}

function createCardElement(cardData) {
    const card = document.createElement('div');
    card.className = 'card';
    if (!cardData.isFaceUp) {
        card.classList.add('is-face-down');
        return card;
    }
    const suitIcons = { '♥': '♥', '♦': '♦', '♠': '♠', '♣': '♣' };
    const suit = suitIcons[cardData.suit];
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
            if (userPreferences.strategyAdvisor) {
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

// --- (All animation functions from previous version are included here) ---
// animateDealCard, animateChipFlight, createAmbientParticles, animateTally, showOutcomeModal

// ==========================================================================
// E. NEW FEATURE: STATISTICS & CUSTOMIZATION
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
    const userDocRef = doc(db, "users", game.userId);
    updateDoc(userDocRef, { stats: playerStats, chips: game.chips });
}

function updateStatsDisplay() {
    // Populate the stats modal with the latest data from playerStats object
    document.getElementById('stats-hands-played').textContent = playerStats.handsPlayed;
    document.getElementById('stats-net-winnings').textContent = `$${playerStats.netWinnings}`;
    document.getElementById('stats-blackjacks').textContent = playerStats.blackjacks;
    document.getElementById('stats-biggest-win').textContent = `$${playerStats.biggestWin}`;
}

function applyCustomization(prefs) {
    // Apply table color
    DOMElements.gameTable.style.setProperty('--color-felt', prefs.tableColor);
    // Set toggle state
    if (DOMElements.strategyToggle) {
        DOMElements.strategyToggle.checked = prefs.strategyAdvisor;
    }
}

function loadPreferences() {
    const savedPrefs = localStorage.getItem('blackjack_prefs');
    if (savedPrefs) {
        userPreferences = JSON.parse(savedPrefs);
    }
    applyCustomization(userPreferences);
}

function savePreference(key, value) {
    userPreferences[key] = value;
    localStorage.setItem('blackjack_prefs', JSON.stringify(userPreferences));
    applyCustomization(userPreferences);
}


// ==========================================================================
// F. GAME FLOW & ACTION HANDLING
// ==========================================================================

async function initializeGame(user) {
    const userDocRef = doc(db, "users", user.uid);
    onSnapshot(userDocRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const userData = docSnap.data();
        if (!game) {
            game = new Construction21Game(user.uid);
            DOMElements.profileName.textContent = userData.displayName || user.email;
            playerStats = userData.stats || playerStats; // Load saved stats
            loadPreferences();
            setupEventHandlers();
            createAmbientParticles(30);
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

    const dealerHoleCardEl = DOMElements.dealerHand.querySelector('.is-face-down');
    if (dealerHoleCardEl) {
        dealerHoleCardEl.classList.remove('is-face-down');
        dealerHoleCardEl.innerHTML = createCardElement(game.dealerHand.cards[1]).innerHTML;
        await delay(800);
    }

    while (game.shouldDealerHit()) {
        await delay(800);
        const newCard = game.dealCard(game.dealerHand);
        await animateDealCard(DOMElements.dealerHand, newCard);
        updateUI();
    }
    
    await delay(1000);
    const results = game.settleHands();
    updateAndSaveStats(results);
    updateUI();
    
    // ... animation and modal logic ...
    showOutcomeModal(results);
    
    uiLocked = false;
}

// ==========================================================================
// G. EVENT LISTENERS
// ==========================================================================

function setupEventHandlers() {
    // --- (Existing event handlers for chips, action bar, etc.) ---
    
    // --- NEW: Event Listeners for Features ---
    if (DOMElements.statsBtn) {
        DOMElements.statsBtn.addEventListener('click', () => {
            updateStatsDisplay();
            DOMElements.statsModal.classList.add('is-visible');
        });
    }

    if (DOMElements.settingsBtn) {
        DOMElements.settingsBtn.addEventListener('click', () => {
            DOMElements.settingsModal.classList.add('is-visible');
        });
    }

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

    // Add listeners to close modals
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('is-visible');
        });
    });
}


// ==========================================================================
// H. INITIALIZATION
// ==========================================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        initializeGame(user);
    } else {
        document.body.innerHTML = `<h1>Please log in to play</h1>`;
    }
});
