// construction21-ui.js

// --- Core Game Logic & Constants ---
import { Construction21Game, GAME_OUTCOMES, db as gameDb } from './construction21-logic.js';

// --- Firebase Integration ---
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ==========================================================================
// A. INITIALIZATION & STATE MANAGEMENT
// ==========================================================================

let game; // Single source of truth for all game logic
let uiLocked = false; // Prevents player actions during critical animations
let lastBets = { main: 0, pp: 0, plus3: 0 }; // For the re-bet feature
let selectedChipValue = 5; // Default selected chip
let playerStats = { handsPlayed: 0, totalWagered: 0, netWinnings: 0, blackjacks: 0, biggestWin: 0 };
let userPreferences = { strategyAdvisor: false, tableColor: '#2a623d' };
let previousBalance = 10000;

// Utility for delays in async functions
const delay = ms => new Promise(res => setTimeout(res, ms));

// --- Use Firebase instance from construction21-logic.js ---
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
const auth = getAuth();
const db = gameDb;

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
    // Voucher system (optional)
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
    const bal = game.chips;
    if (bal !== previousBalance) animateBalanceChange(bal - previousBalance);
    DOMElements.playerBalance.textContent = bal.toLocaleString();
    previousBalance = bal;
    document.body.dataset.gameState = game.isGameInProgress ? 'in-play' : 'betting';
}

function renderHandsAndScores() {
    DOMElements.dealerHand.innerHTML = '';
    game.dealerHand.cards.forEach((cardData, i) => {
        const cardEl = createCardElement(cardData, !(i === 1 && !game.isGameInProgress));
        DOMElements.dealerHand.appendChild(cardEl);
    });
    if (game.dealerHand.cards.length > 0)
        addScoreBubble(DOMElements.dealerHand, game.dealerHand.score);

    DOMElements.playerHandsContainer.innerHTML = '';
    game.playerHands.forEach((hand, index) => {
        const handContainer = document.createElement('div');
        handContainer.className = 'hand player-hand';
        if (index === game.activeHandIndex && game.isGameInProgress)
            handContainer.classList.add('is-active');
        if (game.isBlackjack(hand.cards))
            handContainer.classList.add('has-blackjack');
        const cardsWrapper = document.createElement('div');
        cardsWrapper.className = 'cards-wrapper';
        hand.cards.forEach(cardData => cardsWrapper.appendChild(createCardElement(cardData)));
        handContainer.appendChild(cardsWrapper);
        if (hand.cards.length > 0) addScoreBubble(handContainer, hand.score);
        DOMElements.playerHandsContainer.appendChild(handContainer);
    });
}

function renderBets() {
    DOMElements.betSpots.forEach(spot => {
        const betType = spot.dataset.betType;
        const amount = game.bets[betType] || 0;
        spot.querySelector('.bet-spot__amount').textContent = amount ? `$${amount}` : '';
        spot.classList.toggle('has-bet', amount > 0);

        // Remove old chips and render stack
        const chipsEl = spot.querySelector('.bet-spot__chips');
        chipsEl.innerHTML = '';
        let chipSum = amount;
        [100, 25, 10, 5].forEach(value => {
            while (chipSum >= value) {
                const chip = document.createElement('div');
                chip.className = 'chip';
                chip.textContent = value;
                chip.setAttribute('data-value', value);
                chipsEl.appendChild(chip);
                chipSum -= value;
            }
        });
    });
}

function createCardElement(cardData, faceUp = true) {
    const card = document.createElement('div');
    card.className = 'card';
    
    // Only allow dealer's second card to be face down during initial deal
    // Player cards should ALWAYS be face up
    const isPlayerCard = !cardData.isDealer; 
    const isDealerHoleCard = cardData.isDealer && cardData.isHoleCard;
    
    if ((!faceUp || cardData.isFaceDown) && !isPlayerCard && isDealerHoleCard) {
        card.classList.add('is-face-down');
        // Store card data for later reveal
        card.dataset.suit = cardData.suit;
        card.dataset.value = cardData.value;
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
    // Find the right parent - either the cards-wrapper or the hand element itself
    const target = handEl.querySelector('.cards-wrapper') || handEl;
    target.appendChild(scoreBubble);
}

function updateActionBarState() {
    if (uiLocked) {
        DOMElements.actionBar.dataset.state = 'ui-locked';
        DOMElements.actionBar.querySelectorAll('button').forEach(btn => btn.disabled = true);
        return;
    }
    
    if (!game.isGameInProgress) {
        DOMElements.actionBar.dataset.state = 'betting';
        // First, disable all buttons
        DOMElements.actionBar.querySelectorAll('button').forEach(btn => btn.disabled = true);
        
        // Then selectively enable appropriate buttons
        DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
            const action = btn.dataset.action;
            
            // Deal button should only be enabled if there's a main bet
            if (action === 'deal') {
                btn.disabled = !(game.bets && game.bets.main > 0);
            }
            // Clear button only if there are bets to clear
            else if (action === 'clear') {
                const hasBets = game.bets && (game.bets.main > 0 || game.bets.pp > 0 || game.bets.plus3 > 0);
                btn.disabled = !hasBets;
            }
            // Rebet button only if there were previous bets and enough chips
            else if (action === 'rebet') {
                const previousTotal = lastBets.main + lastBets.pp + lastBets.plus3;
                btn.disabled = previousTotal === 0 || game.chips < previousTotal;
            }
            // New game button always enabled
            else if (action === 'new-game') {
                btn.disabled = false;
            }
        });
    } else {
        const hand = game.getActiveHand();
        if (hand) {
            DOMElements.actionBar.dataset.state = 'player-turn';
            // Set enabled/disabled state for player actions
            document.getElementById('double-btn').disabled = !(hand.cards.length === 2 && game.chips >= hand.bet && (game.rules.allowDoubleAfterSplit || !hand.isSplit));
            document.getElementById('split-btn').disabled = !(hand.cards.length === 2 && hand.cards[0].value === hand.cards[1].value && game.chips >= hand.bet);
            document.getElementById('hit-btn').disabled = hand.isSplitAce && !game.rules.allowHitOnSplitAces;
            document.getElementById('stand-btn').disabled = false;

            // --- FEATURE: Basic Strategy Advisor ---
            if (userPreferences.strategyAdvisor && typeof game.getBasicStrategyMove === 'function') {
                const correctMove = game.getBasicStrategyMove();
                DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
                    btn.classList.toggle('is-recommended', btn.dataset.action === correctMove);
                });
            }
        } else {
            DOMElements.actionBar.dataset.state = 'dealer-turn';
            // Only allow 'new game' or similar actions
            DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
                btn.disabled = btn.dataset.action !== 'new-game';
            });
        }
    }
}

// ==========================================================================
// D. ANIMATION & VISUAL EFFECTS
// ==========================================================================

async function animateDealCard(targetHandContainer, cardData) {
    // Defensive: don't animate if elements missing
    if (!DOMElements.deck || !targetHandContainer) {
        targetHandContainer?.appendChild(createCardElement(cardData, !cardData.isFaceDown));
        return;
    }
    
    const deckRect = DOMElements.deck.getBoundingClientRect();    
    const destRect = targetHandContainer.getBoundingClientRect();
    const handCardCount = targetHandContainer.children.length;
    
    // For animation, always show the back of the card during animation
    // even for dealer's hole card (to avoid revealing it early)
    const faceUp = !cardData.isFaceDown && !(cardData.isDealer && cardData.isHoleCard);
    const tempCard = createCardElement({...cardData}, faceUp);
    tempCard.classList.add('dealing');
    document.body.appendChild(tempCard);

    // Animate from deck to destination
    tempCard.style.left = `${deckRect.left}px`;
    tempCard.style.top = `${deckRect.top}px`;
    tempCard.style.setProperty('--from-x', '0px');
    tempCard.style.setProperty('--from-y', '0px');
    tempCard.style.setProperty('--to-x', `${destRect.left - deckRect.left + (handCardCount * 25)}px`);
    tempCard.style.setProperty('--to-y', `${destRect.top - deckRect.top}px`);    
    await delay(580);
    tempCard.remove();

    // Now append final card to hand
    // Check if we're dealing to a player hand (which has a cards-wrapper)
    const cardsWrapper = targetHandContainer.querySelector('.cards-wrapper') || targetHandContainer;
    
    // For dealer's hole card, make sure it's face down
    if (cardData.isDealer && cardData.isHoleCard) {
        cardData.isFaceDown = true;
    }
    
    cardsWrapper.appendChild(createCardElement(cardData, !cardData.isFaceDown));
}

function animateChipToBetSpot(chipButton, betSpot) {
    if (!chipButton || !betSpot) return;
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

function animateBalanceChange(delta) {
    if (!delta || delta === 0) return;
    const balWrap = DOMElements.playerBalance.parentElement;
    if (!balWrap) return;
    const el = document.createElement('div');
    el.className = 'balance-delta' + (delta < 0 ? ' negative' : '');
    el.textContent = (delta > 0 ? '+' : '') + delta;
    el.style.left = '50%';
    balWrap.style.position = 'relative';
    balWrap.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}

function showWinConfetti(handEl) {
    const confetti = document.createElement('div');
    confetti.className = 'win-confetti';
    confetti.textContent = '🎉';
    handEl.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1100);
}

function shakeElement(el) {
    el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

// ==========================================================================
// E. GAME OUTCOME & MODALS
// ==========================================================================

function showOutcomeModal(results) {
    // Ensure any remaining face-down cards are now face-up
    DOMElements.dealerHand.querySelectorAll('.card.is-face-down').forEach(card => {
        card.classList.remove('is-face-down');
    });
    
    // Accessibility: focus on modal for keyboard users
    DOMElements.outcomeTitle.textContent =
        results.totalNet > 0 ? "You Win!" :
        results.totalNet < 0 ? "You Lose!" : "Push!";
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
    
    // Disable all action buttons until outcome is acknowledged
    DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
        btn.disabled = true;
    });
    
    // Show the outcome modal and disable actions until modal is dismissed
    showModal(DOMElements.outcomeModal);
    
    // Add a button to dismiss the modal and reset the game
    const modalNewGameBtn = document.getElementById('modal-new-game-btn');
    if (modalNewGameBtn) {
        modalNewGameBtn.addEventListener('click', () => {
            hideModal(DOMElements.outcomeModal);
            resetGameState();
        }, { once: true }); // Use once: true to prevent multiple handlers
    }
    
    // Force game state reset when modal is closed
    const modalCloseBtn = DOMElements.outcomeModal.querySelector('.modal-close-btn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', resetGameState, { once: true });
    }
}

// Modal management functions
function showModal(modalEl) {
    if (!modalEl) return;
    // Hide any other visible modals first
    document.querySelectorAll('.modal-overlay.is-visible').forEach(modal => {
        if (modal !== modalEl) modal.classList.remove('is-visible');
    });
    
    modalEl.classList.add('is-visible');
    
    // Focus first focusable element for accessibility
    setTimeout(() => {
        const focusable = modalEl.querySelector('button, [tabindex], input, select, textarea');
        if (focusable) focusable.focus();
    }, 100);
    
    // Add escape key listener
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modalEl.classList.remove('is-visible');
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function hideModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('is-visible');
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
    if (DOMElements.gameTable)
        DOMElements.gameTable.style.setProperty('--color-felt', prefs.tableColor);
    DOMElements.colorSwatches.forEach(s =>
        s.classList.toggle('selected', s.dataset.color === prefs.tableColor)
    );
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
    try {
        uiLocked = true;
        updateActionBarState();
        
        // Disable all player action buttons during dealer turn
        const actionButtons = DOMElements.actionBar.querySelectorAll('.action-button');
        actionButtons.forEach(btn => btn.disabled = true);

        // Safety check to ensure dealer hand exists
        if (!DOMElements.dealerHand) {
            console.error("Dealer hand element not found");
            return;
        }

        // Flip dealer's hole card if present
        const dealerCards = DOMElements.dealerHand.querySelectorAll('.card');
        const holeCard = dealerCards && dealerCards.length > 1 ? dealerCards[1] : null;
        if (holeCard && holeCard.classList.contains('is-face-down')) {
            // Animate flip
            holeCard.classList.remove('is-face-down');
        
        // Update game state to mark the card as face up
        if (game.dealerHand.cards[1]) {
            game.dealerHand.cards[1].isFaceDown = false;
        }
        
        if (holeCard.dataset.suit && holeCard.dataset.value) {
            // Reconstruct card from stored data attributes
            const cardData = {
                suit: holeCard.dataset.suit,
                value: holeCard.dataset.value,
                isDealer: true,
                isFaceDown: false
            };
            holeCard.innerHTML = createCardElement(cardData, true).innerHTML;
        } else {
            // Fallback to game state
            holeCard.innerHTML = createCardElement(game.dealerHand.cards[1], true).innerHTML;
        }
        await delay(800);
    }    // Make sure game object exists before continuing
    if (game) {
        while (game.shouldDealerHit()) {
            await delay(800);
            const newCard = game.dealCard(game.dealerHand);
            await animateDealCard(DOMElements.dealerHand, newCard);
            updateUI();
        }
        // Make sure ALL dealer cards are face-up before settling
        await ensureAllDealerCardsVisible();
    } else {
        console.error("Game object is undefined in runDealerTurn");
        return;
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
    // Prevent double-binding
    if (DOMElements.chipTray.dataset.eventsBound) return;
    DOMElements.chipTray.dataset.eventsBound = "1";

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
            switch (btn.dataset.action) {                case 'deal':
                    // Check if we can deal
                    if (!game.bets || game.bets.main <= 0) {
                        shakeElement(btn);
                        return;
                    }
                    
                    // Lock UI during deal
                    uiLocked = true;
                    updateActionBarState();
                    
                    // Start the game
                    if (!game.startGame()) {
                        console.error("Failed to start game");
                        uiLocked = false;
                        updateActionBarState();
                        return;
                    }
                    
                    updateUI();
                    
                    try {
                        // Animate initial deal
                        for (let i = 0; i < 2; i++) {
                            for (const hand of [DOMElements.playerHandsContainer, DOMElements.dealerHand]) {
                                await delay(220);
                                const isDealer = hand === DOMElements.dealerHand;
                                const isDealerHoleCard = isDealer && i === 1; // Second dealer card is hole card
                                const card = game.dealCard(isDealer ? game.dealerHand : game.playerHands[0], !isDealerHoleCard);
                                
                                // Mark the card with additional metadata
                                card.isDealer = isDealer;
                                card.isHoleCard = isDealerHoleCard;
                                
                                await animateDealCard(hand, card);
                            }
                        }
                        
                        // Check for blackjacks immediately
                        const playerHand = game.playerHands[0];
                        const dealerHand = game.dealerHand;
                        
                        if (game.isBlackjack(playerHand.cards) || game.isBlackjack(dealerHand.cards)) {
                            // If either has blackjack, go straight to dealer turn
                            updateUI();
                            await delay(1000); // Pause to show the blackjack
                            await runDealerTurn();
                        }
                    } catch (error) {
                        console.error("Error during deal:", error);
                    } finally {
                        uiLocked = false;
                        updateUI();
                    }
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
                    break;                case 'new-game':
                    // Complete reset of both game logic and UI
                    game.reset();
                    DOMElements.dealerHand.innerHTML = '';
                    DOMElements.playerHandsContainer.innerHTML = '';
                    lastBets = { main: 0, pp: 0, plus3: 0 };
                    updateUI();
                    break;
                case 'clear':
                    game.clearBets();
                    updateUI();
                    break;
            }
        });
    });    // Modal Openers/Closers
    if (DOMElements.statsBtn) {
        DOMElements.statsBtn.addEventListener('click', () => {
            updateStatsDisplay();
            showModal(DOMElements.statsModal);
        });
    }
    if (DOMElements.payoutsBtn) {
        DOMElements.payoutsBtn.addEventListener('click', () => {
            showModal(DOMElements.payoutsModal);
        });
    }
    if (DOMElements.settingsBtn) {
        DOMElements.settingsBtn.addEventListener('click', () => {
            showModal(DOMElements.settingsModal);
        });
    }
    if (DOMElements.logoutBtn) {
        DOMElements.logoutBtn.addEventListener('click', () => signOut(auth));
    }

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalOverlay = btn.closest('.modal-overlay');
            hideModal(modalOverlay);
            
            // If this is the outcome modal, reset the game state
            if (modalOverlay.id === 'outcome-modal') {
                resetGameState();
            }
        });
    });
    
    // Also close modal when clicking outside content
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideModal(modal);
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

// Function to properly reset the game state
function resetGameState() {
    if (!game) return;
    
    // Reset all UI elements
    DOMElements.dealerHand.innerHTML = '';
    DOMElements.playerHandsContainer.innerHTML = '';
    
    // Reset all bet spots
    DOMElements.betSpots.forEach(spot => {
        spot.classList.remove('has-bet');
        spot.querySelector('.bet-spot__amount').textContent = '';
        spot.querySelector('.bet-spot__chips').innerHTML = '';
    });
    
    // Store the last bets for rebetting
    lastBets = { ...game.bets };
    
    // Reset the game logic state
    game.endGame();
    
    // Clear any face-down card states in the game object
    if (game.dealerHand && game.dealerHand.cards) {
        game.dealerHand.cards.forEach(card => {
            if (card) card.isFaceDown = false;
        });
    }
    
    // Re-enable all buttons
    DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
        btn.disabled = false;
    });
    
    // Update the UI
    updateUI();
    
    // Log the reset for debugging
    console.log("Game state reset complete");
}

// Function to ensure all dealer cards are face up before showing the outcome
async function ensureAllDealerCardsVisible() {
    if (!game || !game.dealerHand || !game.dealerHand.cards) return;
    
    const dealerCards = DOMElements.dealerHand.querySelectorAll('.card');
    // Check if we have any face-down cards
    let hasHiddenCards = false;
    
    dealerCards.forEach((cardElement, index) => {
        if (cardElement.classList.contains('is-face-down')) {
            hasHiddenCards = true;
            cardElement.classList.remove('is-face-down');
            
            // Get card data from game state
            const cardData = game.dealerHand.cards[index];
            if (cardData) {
                // Ensure the card is marked as face up in the game state
                cardData.isFaceDown = false;
                
                // Update the card visual
                cardElement.innerHTML = createCardElement(cardData, true).innerHTML;
            }
        }
    });
    
    // If any cards were flipped, add a small delay for the animation effect
    if (hasHiddenCards) {
        await delay(800);
    }
    
    // Double check for any remaining face-down cards in the DOM and force their display
    DOMElements.dealerHand.querySelectorAll('.card.is-face-down').forEach((card) => {
        card.classList.remove('is-face-down');
    });
}
