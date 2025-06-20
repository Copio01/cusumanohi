// construction21-ui.js

// --- Core Game Logic & Constants ---
import { Construction21Game, GAME_OUTCOMES, db as gameDb } from './construction21-logic.js';

// --- Firebase Integration ---
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
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

// Mobile touch support utility
const addTouchSupport = (element, handler) => {
    if (!element) return; // Skip if element doesn't exist
    
    element.addEventListener('touchstart', function(e) {
        e.preventDefault(); // Prevent default behavior like scrolling/zooming
        if (e.touches && e.touches[0]) {
            // Pass the first touch point to the handler
            handler(e.touches[0]);
        } else {
            // Fallback to the event itself
            handler(e);
        }
    });
};

// Function to detect if we're on a mobile device
const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
};

// --- Use Firebase instance from construction21-logic.js ---
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
    actionBar: document.getElementById('action-bar'),    // Modals & Panels
    outcomeModal: document.getElementById('outcome-modal'),
    outcomeModalContent: document.getElementById('outcome-modal-content'),
    outcomeTitle: document.getElementById('outcome-title'),
    outcomeSubtitle: document.getElementById('outcome-subtitle'),
    outcomeHands: document.getElementById('outcome-hands'),
    outcomeSidebets: document.getElementById('outcome-sidebets'),
    outcomeSidebetsContainer: document.getElementById('outcome-sidebets-container'),
    outcomeInsurance: document.getElementById('outcome-insurance'),
    outcomeInsuranceContainer: document.getElementById('outcome-insurance-container'),
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
        // Force all dealer cards face up if it's dealer's turn
        const forceUp = game.isDealerTurn || i !== 1 || !game.isGameInProgress;
        const cardEl = createCardElement(cardData, forceUp);
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
        spot.classList.toggle('has-bet', amount > 0);        // Remove old chips and render stack with enhanced visual effect
        const chipsEl = spot.querySelector('.bet-spot__chips');
        chipsEl.innerHTML = '';
        
        // Calculate chips of each denomination needed
        let chipSum = amount;
        let chipCounts = {};
        [100, 25, 10, 5].forEach(value => {
            chipCounts[value] = 0;
            while (chipSum >= value) {
                chipCounts[value]++;
                chipSum -= value;
            }
        });
        
        // Create and append chips with staggered animations
        let delay = 0;
        let totalChips = 0;
        
        // Add highest denomination chips first (they go on bottom)
        [100, 25, 10, 5].forEach(value => {
            for (let i = 0; i < chipCounts[value]; i++) {                const chip = document.createElement('div');
                chip.className = 'chip';
                chip.textContent = value;
                chip.setAttribute('data-value', value);
                
                // Add edge pattern span element
                const edgePattern = document.createElement('span');
                chip.appendChild(edgePattern);
                
                // Add a small random rotation for natural appearance
                const randomRotate = Math.random() * 8 - 4; // -4 to +4 degrees
                chip.style.setProperty('--random-rotate', `${randomRotate}deg`);
                
                // Add more realistic Y offset to create natural stack variations
                const randomOffsetY = Math.random() * 1.5 - 0.75; // -0.75px to +0.75px
                chip.style.marginTop = `${randomOffsetY}px`;
                
                // Add staggered animation delay
                chip.style.animationDelay = `${delay}ms`;
                delay += 60; // 60ms between each chip for more natural feel
                
                // Add slight offset based on position in stack
                chip.style.zIndex = totalChips;
                totalChips++;
                
                chipsEl.appendChild(chip);
            }
        });
    });
}

function createCardElement(cardData, faceUp = true) {
    // Create card element with necessary class
    const card = document.createElement('div');
    card.className = 'card';
    
    // Handle face down cards (for dealer's hole card)
    const isPlayerCard = !cardData.isDealer; 
    const isDealerHoleCard = cardData.isDealer && cardData.isHoleCard;
    
    // Show face down cards only during active gameplay
    // If game is over (dealer's turn) OR faceUp is explicitly true, always show face up
    if ((!faceUp || cardData.isFaceDown) && !isPlayerCard && isDealerHoleCard && 
        !(game && game.isDealerTurn)) {
        card.classList.add('is-face-down');
        // Store card data for later reveal
        card.dataset.suit = cardData.suit;
        card.dataset.value = cardData.value;
        return card;
    }
    
    // Setup suit and color
    const suitIcons = { '♥': '♥', '♦': '♦', '♠': '♠', '♣': '♣' };
    const suit = suitIcons[cardData.suit] || cardData.suit;
    if (['♥', '♦'].includes(suit)) {
        card.classList.add('card--red');
    }
    
    // Add special class for face cards
    if (['J', 'Q', 'K', 'A'].includes(cardData.value)) {
        card.classList.add('card--face');
    }
    
    // Create background/base structure
    const cardBg = document.createElement('div');
    cardBg.className = 'card__bg';
    card.appendChild(cardBg);
    
    // Create the corners and center suit elements
    const topCorner = document.createElement('div');
    topCorner.className = 'card__corner card__corner--top';
    topCorner.textContent = cardData.value;
    
    const bottomCorner = document.createElement('div');
    bottomCorner.className = 'card__corner card__corner--bottom';
    bottomCorner.textContent = cardData.value;
    
    const suitCenter = document.createElement('div');
    suitCenter.className = 'card__suit';
    suitCenter.textContent = suit;
    
    // Add mini-suit to corners
    const miniSuitTop = document.createElement('span');
    miniSuitTop.className = 'mini-suit';
    miniSuitTop.textContent = suit;
    topCorner.appendChild(miniSuitTop);
    
    const miniSuitBottom = document.createElement('span');
    miniSuitBottom.className = 'mini-suit';
    miniSuitBottom.textContent = suit;
    bottomCorner.appendChild(miniSuitBottom);
    
    // Add face card decoration for J, Q, K
    if (['J', 'Q', 'K'].includes(cardData.value)) {
        const faceDesign = document.createElement('div');
        faceDesign.className = 'face-design ' + cardData.value.toLowerCase() + '-design';
        card.appendChild(faceDesign);
    }
    
    // Add elements to card
    card.appendChild(topCorner);
    card.appendChild(suitCenter);
    card.appendChild(bottomCorner);
    
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
    
    // Create a flying chip clone with all styling
    const flyingChip = chipButton.cloneNode(true);
    flyingChip.classList.add('flying');
    
    // Add edge pattern element if it doesn't exist
    if (!flyingChip.querySelector('span')) {
        const edgePattern = document.createElement('span');
        flyingChip.appendChild(edgePattern);
    }
    
    document.body.appendChild(flyingChip);
    
    // Position the chip at its starting point
    flyingChip.style.left = `${chipRect.left}px`;
    flyingChip.style.top = `${chipRect.top}px`;
    
    // Calculate a more dramatic arched path for realistic casino chip toss
    // Higher value chips have a more dramatic arc
    const chipValue = parseInt(chipButton.dataset.value || 5);
    const arcHeight = chipValue >= 100 ? -120 : 
                       chipValue >= 25 ? -100 : 
                       chipValue >= 10 ? -80 : -60;
    
    // Add slight variation to the arc for more natural movement
    const arcVariation = Math.random() * 15 - 7.5; // -7.5 to +7.5 pixels
    
    // Set animation variables
    flyingChip.style.setProperty('--from-x', '0px');
    flyingChip.style.setProperty('--from-y', '0px');
    flyingChip.style.setProperty('--arc-height', `${arcHeight + arcVariation}px`);
    
    // Add slight random offset to final position for more natural stacking
    const randomOffsetX = Math.random() * 6 - 3; // -3 to +3 pixels
    const randomOffsetY = Math.random() * 6 - 3; // -3 to +3 pixels
    
    flyingChip.style.setProperty(
        '--to-x', 
        `${betRect.left - chipRect.left + betRect.width / 2 - chipRect.width / 2 + randomOffsetX}px`
    );
    flyingChip.style.setProperty(
        '--to-y', 
        `${betRect.top - chipRect.top + betRect.height / 2 - chipRect.height / 2 + randomOffsetY}px`
    );
    
    // Add a sound effect for chip movement (if enabled)
    if (window.playSoundEffect) {
        window.playSoundEffect('chip');
    }
    
    // Remove the flying chip when animation completes
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
    
    // Reset modal content
    DOMElements.outcomeHands.innerHTML = '';
    DOMElements.outcomeSidebets.innerHTML = '';
    DOMElements.outcomeInsurance.innerHTML = '';
      // Determine the primary outcome type to style the modal accordingly
    let mainOutcomeType = 'push';
    let outcomeClass = 'outcome-push';
    let titleText = 'Push';
    let subtitleText = 'Nobody wins, nobody loses';
    let titleIcon = '⚖️';
    
    // Check if any hands have BLACKJACK
    const hasBlackjack = results.mainHandResults.some(hand => hand.outcome === 'BLACKJACK');
    
    // Calculate the dealer's score to include in the subtitle
    const dealerScore = game.dealerHand ? calculateScore(game.dealerHand.cards) : 0;
    const dealerHasBlackjack = game.dealerHand ? isBlackjack(game.dealerHand.cards) : false;
    
    // Check overall outcome
    if (results.totalNet > 0) {
        if (hasBlackjack) {
            outcomeClass = 'outcome-blackjack';
            titleText = 'Blackjack!';
            titleIcon = '🎯';
            subtitleText = `Natural 21! ${dealerHasBlackjack ? 'Dealer also has Blackjack but you get paid insurance.' : `Dealer has ${dealerScore}`}`;
        } else {
            outcomeClass = 'outcome-win';
            titleText = 'You Win!';
            titleIcon = '🏆';
            
            // Determine a more specific message based on why they won
            if (dealerScore > 21) {
                subtitleText = `Dealer busted with ${dealerScore}!`;
            } else {
                subtitleText = `Your hand beat the dealer's ${dealerScore}!`;
            }
        }
        mainOutcomeType = 'win';
    } else if (results.totalNet < 0) {
        // Check if all hands busted
        const allBust = results.mainHandResults.every(hand => hand.outcome === 'BUST');
        if (allBust) {
            outcomeClass = 'outcome-bust';
            titleText = 'Bust!';
            titleIcon = '💥';
            subtitleText = 'Your hand exceeded 21';
        } else if (dealerHasBlackjack) {
            outcomeClass = 'outcome-lose';
            titleText = 'Dealer Blackjack';
            titleIcon = '🃏';
            subtitleText = 'Dealer has a natural 21';
        } else {
            outcomeClass = 'outcome-lose';
            titleText = 'You Lose';
            titleIcon = '👎';
            subtitleText = `Dealer's ${dealerScore} beats your hand`;
        }
        mainOutcomeType = 'lose';
    }
      // Update header
    DOMElements.outcomeModalContent.className = 'modal-content ' + outcomeClass;
    DOMElements.outcomeTitle.innerHTML = `${titleIcon} ${titleText} ${titleIcon}`;
    DOMElements.outcomeSubtitle.textContent = subtitleText;
    
    // Create hand results (main bets)
    results.mainHandResults.forEach((hand, i) => {
        // Create hand result container
        const handDiv = document.createElement('div');
        handDiv.className = 'outcome-hand';
        
        // Create header with hand number and outcome
        const handHeader = document.createElement('div');
        handHeader.className = 'outcome-hand-header';
        
        const handTitle = document.createElement('div');
        handTitle.className = 'outcome-hand-title';
        handTitle.textContent = results.mainHandResults.length > 1 ? `Hand ${i + 1}` : 'Your Hand';
        
        const handResult = document.createElement('div');
        let resultClass = '';
        switch (hand.outcome) {
            case 'BLACKJACK': resultClass = 'blackjack'; break;
            case 'WIN': resultClass = 'win'; break;
            case 'PUSH': resultClass = 'push'; break;
            case 'BUST': resultClass = 'bust'; break;
            default: resultClass = 'lose';
        }
        handResult.className = `outcome-hand-result ${resultClass}`;
        handResult.textContent = hand.outcome.replace('_', ' ');
        
        handHeader.appendChild(handTitle);
        handHeader.appendChild(handResult);
        handDiv.appendChild(handHeader);
          // Add score information
        const handDetails = document.createElement('div');
        handDetails.className = 'outcome-hand-details';
        
        // Get score from game state if not provided directly
        const handScore = hand.score !== undefined ? hand.score : 
                        (game.playerHands[i] ? calculateScore(game.playerHands[i].cards) : undefined);
        
        if (handScore !== undefined) {
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'outcome-hand-score';
            scoreSpan.textContent = `Score: ${handScore}`;
            handDetails.appendChild(scoreSpan);
            
            if (hand.outcome === 'BUST') {
                const bustSpan = document.createElement('span');
                bustSpan.textContent = ' (Over 21)';
                bustSpan.style.color = 'var(--color-danger)';
                handDetails.appendChild(bustSpan);
            }
        }
        
        handDiv.appendChild(handDetails);
        
        // Add payout information
        const handPayout = document.createElement('div');
        handPayout.className = 'outcome-hand-payout';
        
        const handBet = document.createElement('div');
        handBet.className = 'outcome-hand-bet';
        handBet.textContent = `Bet: $${hand.bet}`;
        
        const handNet = document.createElement('div');
        const netClass = hand.net > 0 ? 'positive' : hand.net < 0 ? 'negative' : 'zero';
        handNet.className = `outcome-hand-net ${netClass}`;
        handNet.textContent = hand.net >= 0 ? `+$${hand.net}` : `-$${Math.abs(hand.net)}`;
        
        handPayout.appendChild(handBet);
        handPayout.appendChild(handNet);
        handDiv.appendChild(handPayout);
        
        // Add win effects for blackjack or win
        if (hand.outcome === 'BLACKJACK' || hand.outcome === 'WIN') {
            const handEls = DOMElements.playerHandsContainer.querySelectorAll('.hand');
            if (handEls[i]) showWinConfetti(handEls[i]);
        }
        
        DOMElements.outcomeHands.appendChild(handDiv);
    });
    
    // Create side bet results
    let hasSideBets = false;
    
    if (results.sideBetResults) {
        const sideBets = Object.entries(results.sideBetResults);
        
        if (sideBets.length > 0) {
            hasSideBets = true;
            
            sideBets.forEach(([type, result]) => {                if (result.bet > 0) {
                    // Create side bet result container
                    const sideBetDiv = document.createElement('div');
                    const isWin = result.payout > 0;
                    sideBetDiv.className = `outcome-sidebet ${isWin ? 'win' : 'lose'}`;
                    
                    // Create header with side bet name
                    const sideBetName = document.createElement('div');
                    sideBetName.className = 'outcome-sidebet-name';
                    
                    let sideBetTitle = '';
                    switch (type) {
                        case 'pp': sideBetTitle = 'Perfect Pairs'; break;
                        case 'plus3': sideBetTitle = '21+3'; break;
                        default: sideBetTitle = type;
                    }
                    sideBetName.textContent = sideBetTitle;
                    
                    // Create win/loss indicator
                    const sideBetResult = document.createElement('div');
                    sideBetResult.className = 'outcome-sidebet-result';
                    sideBetResult.textContent = isWin ? 'Win!' : 'No match';
                    
                    sideBetDiv.appendChild(sideBetName);
                    sideBetDiv.appendChild(sideBetResult);
                    
                    // Add win type if available
                    if (result.type && isWin) {
                        const sideBetType = document.createElement('div');
                        sideBetType.className = 'outcome-sidebet-type';
                        sideBetType.textContent = result.type;
                        sideBetDiv.appendChild(sideBetType);
                    }
                    
                    // Add payout information
                    const sideBetPayout = document.createElement('div');
                    sideBetPayout.className = 'outcome-sidebet-payout';
                    
                    const sideBetBet = document.createElement('div');
                    sideBetBet.className = 'outcome-sidebet-bet';
                    sideBetBet.textContent = `Bet: $${result.bet}`;
                    
                    const sideBetNet = document.createElement('div');
                    const netClass = isWin ? 'positive' : 'negative';
                    sideBetNet.className = `outcome-sidebet-net ${netClass}`;
                    
                    // Calculate net (payout minus bet is shown in results.net)
                    sideBetNet.textContent = isWin ? `$${result.payout}` : `$${result.bet}`;
                    
                    sideBetPayout.appendChild(sideBetBet);
                    sideBetPayout.appendChild(sideBetNet);
                    sideBetDiv.appendChild(sideBetPayout);
                    
                    DOMElements.outcomeSidebets.appendChild(sideBetDiv);
                }
            });
        }
    }
    
    // Toggle side bets container visibility
    DOMElements.outcomeSidebetsContainer.style.display = hasSideBets ? 'block' : 'none';
    
    // Create insurance result
    let hasInsurance = false;
      if (results.insuranceResult && results.insuranceResult.bet > 0) {
        hasInsurance = true;
        
        const insuranceDiv = document.createElement('div');
        const insuranceWin = results.insuranceResult.payout > 0;
        insuranceDiv.className = `outcome-insurance-result ${insuranceWin ? 'win' : 'lose'}`;
        
        // Create header
        const insuranceTitle = document.createElement('div');
        insuranceTitle.className = 'outcome-insurance-title';
        insuranceTitle.textContent = 'Insurance';
        
        // Create outcome
        const insuranceOutcome = document.createElement('div');
        insuranceOutcome.className = 'outcome-insurance-outcome';
        insuranceOutcome.textContent = insuranceWin ? 
            'Dealer has Blackjack! Insurance pays 2:1' : 
            'Dealer does not have Blackjack';
        
        insuranceDiv.appendChild(insuranceTitle);
        insuranceDiv.appendChild(insuranceOutcome);
        
        // Add payout information
        const insurancePayout = document.createElement('div');
        insurancePayout.className = 'outcome-insurance-payout';
        
        const insuranceBet = document.createElement('div');
        insuranceBet.className = 'outcome-insurance-bet';
        insuranceBet.textContent = `Bet: $${results.insuranceResult.bet}`;
        
        const insuranceNet = document.createElement('div');
        const netClass = results.insuranceResult.net > 0 ? 'positive' : 'negative';
        insuranceNet.className = `outcome-insurance-net ${netClass}`;
        insuranceNet.textContent = results.insuranceResult.net > 0 ? 
            `$${results.insuranceResult.net}` : 
            `$${Math.abs(results.insuranceResult.net)}`;
        
        insurancePayout.appendChild(insuranceBet);
        insurancePayout.appendChild(insuranceNet);
        insuranceDiv.appendChild(insurancePayout);
        
        DOMElements.outcomeInsurance.appendChild(insuranceDiv);
    }
    
    // Toggle insurance container visibility
    DOMElements.outcomeInsuranceContainer.style.display = hasInsurance ? 'block' : 'none';
      // Update total net result with enhanced visual effects
    const totalClass = results.totalNet > 0 ? 'positive' : results.totalNet < 0 ? 'negative' : 'zero';
    let totalClassList = `outcome-total-payout ${totalClass}`;
    
    // Add big-win class for larger wins (adjust threshold as needed)
    if (results.totalNet >= 500) {
        totalClassList += ' big-win';
    }
    
    DOMElements.outcomeTotal.className = totalClassList;
    DOMElements.outcomeTotal.textContent = results.totalNet > 0 ? 
        `+$${results.totalNet}` : 
        results.totalNet < 0 ? 
        `-$${Math.abs(results.totalNet)}` : 
        `$${results.totalNet}`;
    
    // Add staggered animations to side bet elements
    setTimeout(() => {
        const sideBetElements = DOMElements.outcomeSidebets.querySelectorAll('.outcome-sidebet');
        sideBetElements.forEach((element, index) => {
            element.style.animationDelay = `${index * 0.2}s`;
        });
    }, 100);
    
    // Disable all action buttons until outcome is acknowledged
    DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
        btn.disabled = true;
    });
    
    // Show the outcome modal and disable actions until modal is dismissed
    showModal(DOMElements.outcomeModal);
      // Add a button to dismiss the modal and start a new game
    const modalNewGameBtn = document.getElementById('modal-new-game-btn');
    if (modalNewGameBtn) {
        modalNewGameBtn.addEventListener('click', () => {
            hideModal(DOMElements.outcomeModal);
            // Use the proper new game action instead of just resetGameState
            startNewGame();
        }, { once: true }); // Use once: true to prevent multiple handlers
    }
    
    // Force game state reset when modal is closed
    const modalCloseBtn = DOMElements.outcomeModal.querySelector('.modal-close-btn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            hideModal(DOMElements.outcomeModal);
            resetGameState();
        }, { once: true });
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

        // Force all dealer cards to be face up - first in game state
        if (game && game.dealerHand && game.dealerHand.cards) {
            game.dealerHand.cards.forEach(card => {
                card.isFaceDown = false;
            });
        }
        
        // Then update the DOM - re-render all dealer cards to ensure they're face-up
        DOMElements.dealerHand.innerHTML = '';
        if (game && game.dealerHand && game.dealerHand.cards) {
            game.dealerHand.cards.forEach(cardData => {
                // Force all cards to be face up when rendering
                const cardEl = createCardElement(cardData, true);
                DOMElements.dealerHand.appendChild(cardEl);
            });
        }
        
        // Add dealer score bubble
        if (game && game.dealerHand && game.dealerHand.score) {
            addScoreBubble(DOMElements.dealerHand, game.dealerHand.score);
        }
        
        await delay(800);
        
        // Make sure game object exists before continuing
        if (game) {
            while (game.shouldDealerHit()) {
                await delay(800);
                const newCard = game.dealCard(game.dealerHand);
                await animateDealCard(DOMElements.dealerHand, newCard);
                updateUI();
            }
            // Make sure ALL dealer cards are face-up before settling
            await ensureAllDealerCardsVisible();
            
            await delay(900);
            const results = game.settleHands();
            updateAndSaveStats(results);
            updateUI();
            showOutcomeModal(results);
        } else {
            console.error("Game object is undefined in runDealerTurn");
        }    } catch (error) {
        console.error("Error during dealer's turn:", error);
    } finally {
        uiLocked = false;
        updateActionBarState();
    }
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
        // Mouse click handler
        const chipClickHandler = () => {
            DOMElements.chipTray.querySelectorAll('.chip').forEach(c => c.classList.remove('is-selected'));
            chip.classList.add('is-selected');
            selectedChipValue = parseInt(chip.dataset.value, 10);
        };
        
        chip.addEventListener('click', chipClickHandler);
        
        // Add touch support
        addTouchSupport(chip, chipClickHandler);
    });    // Betting
    DOMElements.betSpots.forEach(spot => {
        // Mouse click handler
        const spotClickHandler = () => {
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
        };
        
        spot.addEventListener('click', spotClickHandler);
        
        // Add touch support
        addTouchSupport(spot, spotClickHandler);
    });    // Action Bar
    DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
        const buttonHandler = async () => {
            if (uiLocked || btn.disabled) {
                shakeElement(btn);
                return;
            }
            switch (btn.dataset.action) {case 'deal':
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
                    break;                case 'double':
                    uiLocked = true;
                    updateActionBarState();
                    
                    // Store current hand index before double action
                    const handIndex = game.activeHandIndex;
                    
                    // Double doubles the bet and deals exactly one card
                    // It also automatically advances to next hand
                    game.double();
                    
                    // Get the element for the hand that was just doubled
                    if (handIndex >= 0 && handIndex < DOMElements.playerHandsContainer.children.length) {
                        const handEl = DOMElements.playerHandsContainer.children[handIndex];
                        
                        // Get the most recently added card from that hand
                        const playerHand = game.playerHands[handIndex];
                        if (playerHand && playerHand.cards.length > 0) {
                            const card = playerHand.cards[playerHand.cards.length - 1];
                            
                            // Animate the card being dealt
                            await animateDealCard(handEl, card);
                        }
                    }
                    
                    updateUI();
                    uiLocked = false;
                    
                    // Check if it's dealer's turn and proceed if so
                    if (game.isDealerTurn) {
                        await runDealerTurn();
                    }
                    
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
                    updateUI();                    break;
                case 'clear':
                    game.clearBets();
                    updateUI();
                    break;
            }
        };
        
        btn.addEventListener('click', buttonHandler);
        
        // Add touch support for action buttons
        addTouchSupport(btn, buttonHandler);
    });
    
    // Modal Openers/Closers
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
    if (DOMElements.colorSwatches) {        DOMElements.colorSwatches.forEach(swatch => {
            const swatchHandler = () => {
                savePreference('tableColor', swatch.dataset.color);
            };
            
            swatch.addEventListener('click', swatchHandler);
            
            // Add touch support
            addTouchSupport(swatch, swatchHandler);
        });
    }
    
    // Apply mobile-specific adjustments if on a mobile device
    if (isMobileDevice()) {
        document.body.classList.add('mobile-device');
        
        // Make additional UI tweaks for mobile experience
        const gameTable = document.querySelector('.game-table');
        if (gameTable) {
            if (window.matchMedia("(orientation: portrait)").matches) {
                gameTable.classList.add('portrait-mode');
            } else {
                gameTable.classList.add('landscape-mode');
            }
            
            // Listen for orientation changes
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    if (window.matchMedia("(orientation: portrait)").matches) {
                        gameTable.classList.add('portrait-mode');
                        gameTable.classList.remove('landscape-mode');
                    } else {
                        gameTable.classList.add('landscape-mode');
                        gameTable.classList.remove('portrait-mode');
                    }
                }, 100);
            });
        }
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
    
    // First update all cards in game state to be face up
    game.dealerHand.cards.forEach(card => {
        if (card) card.isFaceDown = false;
    });
    
    // Completely re-render dealer's hand to ensure everything is visible
    DOMElements.dealerHand.innerHTML = '';
    game.dealerHand.cards.forEach(cardData => {
        if (cardData) {
            const cardEl = createCardElement(cardData, true); // Force face up
            DOMElements.dealerHand.appendChild(cardEl);
        }
    });
    
    // Re-add score bubble
    if (game.dealerHand.score !== undefined) {
        addScoreBubble(DOMElements.dealerHand, game.dealerHand.score);
    }
    
    // Give a small delay for the animation effect
    await delay(600);
    
    // Double check for any remaining face-down cards in the DOM and force their display
    DOMElements.dealerHand.querySelectorAll('.card.is-face-down').forEach((card) => {
        card.classList.remove('is-face-down');
    });
}

// Function to start a completely new game
function startNewGame() {
    if (!game) return;
    
    // Complete reset of both game logic and UI (same as new-game action)
    game.reset();
    DOMElements.dealerHand.innerHTML = '';
    DOMElements.playerHandsContainer.innerHTML = '';
    
    // Reset all bet spots
    DOMElements.betSpots.forEach(spot => {
        spot.classList.remove('has-bet');
        spot.querySelector('.bet-spot__amount').textContent = '';
        spot.querySelector('.bet-spot__chips').innerHTML = '';
    });
    
    // Clear last bets to start fresh
    lastBets = { main: 0, pp: 0, plus3: 0 };
    
    // Re-enable all buttons
    DOMElements.actionBar.querySelectorAll('.action-button').forEach(btn => {
        btn.disabled = false;
    });
    
    // Update the UI to reflect the fresh game state
    updateUI();
    
    // Log for debugging
    console.log("New game started");
}

// Utility functions that mirror the game object's methods
function calculateScore(cards) {
    if (!cards || !Array.isArray(cards)) return 0;
    
    let score = 0;
    let aces = 0;
    
    for (const card of cards) {
        if (card.value === 'A') {
            aces++;
            score += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            score += 10;
        } else {
            score += parseInt(card.value);
        }
    }
    
    // Adjust for aces
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    
    return score;
}

function isBlackjack(cards) {
    return cards && cards.length === 2 && calculateScore(cards) === 21;
}
