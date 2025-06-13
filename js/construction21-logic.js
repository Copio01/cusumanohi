// construction21-logic.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
    getFirestore, doc, getDoc, setDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

// Only initialize Firebase once (safe to run multiple times in modules)
const firebaseConfig = {
    apiKey: "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk",
    authDomain: "cusumano-website.firebaseapp.com",
    projectId: "cusumano-website",
    storageBucket: "cusumano-website.appspot.com",
    messagingSenderId: "20051552210",
    appId: "1:20051552210:web:7eb3b22baa3fec184e4a0b"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export class Construction21Game {
    constructor(userId) {
        // Input validation
        if (userId && typeof userId !== 'string') {
            throw new Error('userId must be a string or null');
        }
        
        this.suits = ['♥', '♦', '♠', '♣'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.PERFECT_PAIRS_PAYOUTS = { perfect: 25, colored: 12, mixed: 6 };
        this.TWENTY_ONE_PLUS_THREE_PAYOUTS = { suitedTrips: 100, straightFlush: 40, threeOfAKind: 30, straight: 10, flush: 5 };
        this.userId = userId || null;
        this.db = db;
        
        // Game state validation flags
        this.isGameInProgress = false;
        this.isDealerPlayoutComplete = false;
        this.lastActionTimestamp = 0;
        this.actionCooldown = 100; // 100ms cooldown between actions
        
        // Maximum limits for safety
        this.MAX_CHIPS = 1000000;
        this.MIN_CHIPS = 0;
        this.MAX_BET = 10000;
        this.MIN_BET = 1;
        this.MAX_HANDS = 4; // Maximum hands after splitting
        this.MAX_CARDS_PER_HAND = 11; // Theoretical maximum (4 Aces + 7 other cards)
        
        this.resetGame(100);
    }

    // ---- CHIP STORAGE ----
    
    async loadChipsFromFirebase() {
        if (!this.userId) {
            console.warn('No userId provided, cannot load chips from Firebase');
            return;
        }
        
        try {
            const userDocRef = doc(this.db, "construction21_users", this.userId);
            const docSnap = await getDoc(userDocRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                const loadedChips = data.chips || 100;
                
                // Validate loaded chips
                if (typeof loadedChips !== 'number' || loadedChips < this.MIN_CHIPS || loadedChips > this.MAX_CHIPS) {
                    console.warn(`Invalid chips value loaded: ${loadedChips}, using default`);
                    this.chips = 100;
                } else {
                    this.chips = Math.floor(loadedChips); // Ensure integer
                }
            } else {
                this.chips = 100;
                await setDoc(userDocRef, { chips: this.chips });
            }
        } catch (error) {
            console.error('Error loading chips from Firebase:', error);
            this.chips = 100; // Fallback to default
        }
    }
    
    async saveChipsToFirebase() {
        if (!this.userId) {
            console.warn('No userId provided, cannot save chips to Firebase');
            return false;
        }
        
        // Validate chips before saving
        if (typeof this.chips !== 'number' || this.chips < this.MIN_CHIPS || this.chips > this.MAX_CHIPS) {
            console.error(`Invalid chips value: ${this.chips}, not saving to Firebase`);
            return false;
        }
        
        const userDocRef = doc(this.db, "construction21_users", this.userId);
        try {
            await runTransaction(this.db, async (transaction) => {
                const docSnap = await transaction.get(userDocRef);
                if (!docSnap.exists()) {
                    console.warn("User doc missing during transaction, creating new one");
                }
                
                // Ensure chips is an integer
                const chipsToSave = Math.floor(Math.max(this.MIN_CHIPS, Math.min(this.MAX_CHIPS, this.chips)));
                transaction.set(userDocRef, { chips: chipsToSave }, { merge: true });
            });
            return true;
        } catch (error) {
            console.error('Transaction failed, attempting direct save:', error);
            try {
                // Fallback: direct save
                const chipsToSave = Math.floor(Math.max(this.MIN_CHIPS, Math.min(this.MAX_CHIPS, this.chips)));
                await setDoc(userDocRef, { chips: chipsToSave }, { merge: true });
                return true;
            } catch (fallbackError) {
                console.error('Fallback save also failed:', fallbackError);
                return false;
            }
        }
    }

    // ---- GAME LOGIC ----
    
    resetGame(startingChips = 100) {
        // Validate starting chips
        if (typeof startingChips !== 'number' || startingChips < this.MIN_CHIPS || startingChips > this.MAX_CHIPS) {
            console.warn(`Invalid startingChips: ${startingChips}, using default 100`);
            startingChips = 100;
        }
        
        this.deck = [];
        this.dealerHand = { cards: [], score: 0, isBlackjack: false };
        this.playerHands = [];
        this.activeHandIndex = 0;
        this.chips = Math.floor(startingChips);
        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
        
        // Reset game state flags
        this.isGameInProgress = false;
        this.isDealerPlayoutComplete = false;
        this.lastActionTimestamp = 0;
    }
    
    createDeck() {
        this.deck = [];
        this.suits.forEach(suit => {
            this.values.forEach(value => {
                this.deck.push({ suit, value, isFaceUp: false });
            });
        });
        
        // Validate deck was created correctly
        if (this.deck.length !== 52) {
            throw new Error(`Invalid deck size: ${this.deck.length}, expected 52`);
        }
        
        console.log('[DECK] Created new deck with 52 cards');
    }
    
    shuffleDeck() {
        if (!this.deck || this.deck.length === 0) {
            throw new Error('Cannot shuffle empty deck');
        }
        
        // Fisher-Yates shuffle with additional validation
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        
        // Validate shuffle didn't corrupt deck
        if (this.deck.length !== 52) {
            throw new Error(`Deck corrupted during shuffle: ${this.deck.length} cards`);
        }
        
        console.log('[DECK] Shuffled deck');
    }
    
    dealCard(hand, isFaceUp = true) {
        // Validate deck
        if (!this.deck || this.deck.length === 0) {
            console.error('Cannot deal card: deck is empty');
            return null;
        }
        
        // Validate hand
        if (!hand || typeof hand !== 'object') {
            console.error('Cannot deal card: invalid hand');
            return null;
        }
        
        // Initialize cards array if missing
        if (!hand.cards) {
            hand.cards = [];
        }
        
        // Check maximum cards per hand
        if (hand.cards.length >= this.MAX_CARDS_PER_HAND) {
            console.error(`Cannot deal card: hand already has maximum cards (${this.MAX_CARDS_PER_HAND})`);
            return null;
        }
        
        const card = this.deck.pop();
        if (!card) {
            console.error('Failed to pop card from deck');
            return null;
        }
        
        // Validate card structure
        if (!card.suit || !card.value || !this.suits.includes(card.suit) || !this.values.includes(card.value)) {
            console.error('Invalid card dealt:', card);
            return null;
        }
        
        card.isFaceUp = Boolean(isFaceUp);
        hand.cards.push(card);
        
        console.log(`[DEAL] Dealt ${card.value}${card.suit} (${isFaceUp ? 'face up' : 'face down'}), deck has ${this.deck.length} cards left`);
        return card;
    }
    
    calculateScore(cards) {
        // Validate input
        if (!Array.isArray(cards)) {
            console.error('calculateScore: cards must be an array');
            return 0;
        }
        
        if (cards.length === 0) {
            return 0;
        }
        
        let score = 0, aceCount = 0;
        
        // Validate each card and calculate score
        cards.forEach((card, index) => {
            if (!card || typeof card !== 'object' || !card.value) {
                console.error(`calculateScore: invalid card at index ${index}:`, card);
                return; // Skip invalid card
            }
            
            if (card.value === 'A') { 
                aceCount++; 
                score += 11; 
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                score += 10;
            } else {
                const numValue = parseInt(card.value);
                if (isNaN(numValue) || numValue < 2 || numValue > 10) {
                    console.error(`calculateScore: invalid card value: ${card.value}`);
                    return; // Skip invalid card
                }
                score += numValue;
            }
        });
        
        // Adjust for aces
        while (score > 21 && aceCount > 0) { 
            score -= 10; 
            aceCount--; 
        }
        
        // Debug logging for dealer hands only
        if (cards === this.dealerHand?.cards) {
            console.log(`[SCORE DEBUG] Cards: ${cards.map(c => c.value + c.suit).join(', ')}`);
            console.log(`[SCORE DEBUG] Raw values: ${cards.map(c => {
                if (c.value === 'A') return '11(A)';
                if (['K', 'Q', 'J'].includes(c.value)) return '10(' + c.value + ')';
                return c.value;
            }).join(', ')}`);
            console.log(`[SCORE DEBUG] Final score: ${score}, Aces remaining: ${aceCount}`);
        }
        
        // Validate final score
        if (typeof score !== 'number' || score < 0) {
            console.error(`calculateScore: invalid final score: ${score}`);
            return 0;
        }
        
        return score;
    }
    
    // Rate limiting helper
    checkActionCooldown() {
        const now = Date.now();
        if (now - this.lastActionTimestamp < this.actionCooldown) {
            console.warn('Action blocked: too fast');
            return false;
        }
        this.lastActionTimestamp = now;
        return true;
    }

    // Validate game state before actions
    validateGameState() {
        // Check chips bounds
        if (this.chips < this.MIN_CHIPS) {
            console.error(`Invalid chips: ${this.chips} below minimum ${this.MIN_CHIPS}`);
            this.chips = this.MIN_CHIPS;
        }
        if (this.chips > this.MAX_CHIPS) {
            console.error(`Invalid chips: ${this.chips} above maximum ${this.MAX_CHIPS}`);
            this.chips = this.MAX_CHIPS;
        }
        
        // Check bets bounds
        Object.keys(this.bets).forEach(type => {
            if (this.bets[type] < 0) {
                console.error(`Invalid bet: ${type} is negative ${this.bets[type]}`);
                this.bets[type] = 0;
            }
            if (this.bets[type] > this.MAX_BET) {
                console.error(`Invalid bet: ${type} exceeds maximum ${this.bets[type]}`);
                this.bets[type] = this.MAX_BET;
            }
        });
        
        // Check player hands bounds
        if (this.playerHands.length > this.MAX_HANDS) {
            console.error(`Too many hands: ${this.playerHands.length}, limiting to ${this.MAX_HANDS}`);
            this.playerHands = this.playerHands.slice(0, this.MAX_HANDS);
        }
        
        // Check active hand index
        if (this.activeHandIndex < 0 || this.activeHandIndex >= this.playerHands.length) {
            console.warn(`Invalid activeHandIndex: ${this.activeHandIndex}, resetting to 0`);
            this.activeHandIndex = 0;
        }
        
        return true;
    }
    
    canPlaceBet(amount) {
        // Input validation
        if (typeof amount !== 'number' || amount <= 0) {
            console.error(`Invalid bet amount: ${amount}`);
            return false;
        }
        
        // Validate game state
        this.validateGameState();
        
        // Check bet limits
        if (amount < this.MIN_BET) {
            console.warn(`Bet amount ${amount} below minimum ${this.MIN_BET}`);
            return false;
        }
        if (amount > this.MAX_BET) {
            console.warn(`Bet amount ${amount} above maximum ${this.MAX_BET}`);
            return false;
        }
        
        // Check if player has enough chips
        if (this.chips < amount) {
            console.warn(`Not enough chips: have ${this.chips}, need ${amount}`);
            return false;
        }
        
        return true;
    }
    
    placeBet(type, amount) {
        // Rate limiting
        if (!this.checkActionCooldown()) {
            return false;
        }
        
        // Input validation
        if (typeof type !== 'string' || !['main', 'pp', 'plus3', 'insurance'].includes(type)) {
            console.error(`Invalid bet type: ${type}`);
            return false;
        }
        
        if (!this.canPlaceBet(amount)) {
            return false;
        }
        
        // Prevent betting during active game
        if (this.isGameInProgress) {
            console.warn('Cannot place bet: game in progress');
            return false;
        }
        
        // Check total bet won't exceed chips
        const totalBetsAfter = this.bets.main + this.bets.pp + this.bets.plus3 + (this.bets.insurance || 0) + amount;
        if (totalBetsAfter > this.chips + amount) { // +amount because we haven't deducted it yet
            console.warn(`Total bets would exceed available chips: ${totalBetsAfter} > ${this.chips}`);
            return false;
        }
        
        this.chips -= amount;
        this.bets[type] = (this.bets[type] || 0) + amount;
        
        console.log(`[BET] Placed ${amount} on ${type}, total ${type} bet: ${this.bets[type]}, chips remaining: ${this.chips}`);
        
        // Validate final state
        this.validateGameState();
        return true;
    }
    
    clearBets() {
        // Rate limiting
        if (!this.checkActionCooldown()) {
            return false;
        }
        
        // Prevent clearing bets during active game
        if (this.isGameInProgress) {
            console.warn('Cannot clear bets: game in progress');
            return false;
        }
        
        // Return all bet amounts to chips
        const totalBetsToReturn = this.bets.main + this.bets.pp + this.bets.plus3 + (this.bets.insurance || 0);
        this.chips += totalBetsToReturn;
        
        // Reset all bets
        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
        
        console.log(`[BET] Cleared all bets, returned ${totalBetsToReturn} chips, total chips: ${this.chips}`);
        
        // Validate final state
        this.validateGameState();
        return true;
    }

    checkPerfectPairs(card1, card2) {
        if (card1.value !== card2.value) return { type: 'None', payout: 0 };
        const isRed = s => ['♥', '♦'].includes(s);
        if (card1.suit === card2.suit) return { type: 'Perfect Pair', payout: this.PERFECT_PAIRS_PAYOUTS.perfect };
        if (isRed(card1.suit) === isRed(card2.suit)) return { type: 'Colored Pair', payout: this.PERFECT_PAIRS_PAYOUTS.colored };
        return { type: 'Mixed Pair', payout: this.PERFECT_PAIRS_PAYOUTS.mixed };
    }

    check21Plus3(cards) {
        const cardToRank = c => c.value === 'A' ? 1 : (['J','Q','K'].includes(c.value) ? {J:11,Q:12,K:13}[c.value] : parseInt(c.value));
        let ranks = cards.map(cardToRank).sort((a,b)=>a-b);
        const suits = cards.map(c=>c.suit);
        const isFlush = suits.every(s=>s===suits[0]);
        let isStraight = (ranks[1]===ranks[0]+1 && ranks[2]===ranks[1]+1) || (ranks[0]===1 && ranks[1]===12 && ranks[2]===13);
        const isThreeOfAKind = ranks[0]===ranks[1] && ranks[1]===ranks[2];
        const isSuitedTrips = isThreeOfAKind && isFlush;
        if (isSuitedTrips) return { type:'Suited Trips', payout:this.TWENTY_ONE_PLUS_THREE_PAYOUTS.suitedTrips };
        if (isFlush && isStraight) return { type:'Straight Flush', payout:this.TWENTY_ONE_PLUS_THREE_PAYOUTS.straightFlush };
        if (isThreeOfAKind) return { type:'Three of a Kind', payout:this.TWENTY_ONE_PLUS_THREE_PAYOUTS.threeOfAKind };
        if (isStraight) return { type:'Straight', payout:this.TWENTY_ONE_PLUS_THREE_PAYOUTS.straight };
        if (isFlush) return { type:'Flush', payout:this.TWENTY_ONE_PLUS_THREE_PAYOUTS.flush };
        return { type:'None', payout:0 };
    }

    isBlackjack(cards) {
        return cards.length === 2 && this.calculateScore(cards) === 21;
    }
    
    isBust(cards) {
        return this.calculateScore(cards) > 21;
    }

    // Dealer hits on soft 17 (H17) rule
    shouldDealerHit() {
        const dealerScore = this.calculateScore(this.dealerHand.cards);
        // Dealer hits on 16 or less, and also hits on soft 17
        if (dealerScore < 17) return true;
        if (dealerScore === 17 && this.isSoft17(this.dealerHand.cards)) return true;
        return false;
    }

    // Check if a hand is a soft 17 (contains an Ace counted as 11)
    isSoft17(cards) {
        let score = this.calculateScore(cards);
        if (score !== 17) return false;
        let aceCount = 0;
        let tempScore = 0;
        for (const card of cards) {
            if (card.value === 'A') {
                aceCount++;
                tempScore += 11;
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                tempScore += 10;
            } else {
                tempScore += parseInt(card.value);
            }
        }
        // If we have at least one ace and counting all aces as 11 puts us over 17, but the hand is 17, it's soft 17
        return aceCount > 0 && tempScore > 17 && score === 17;
    }
    
    settleHands() {
        const dealerScore = this.calculateScore(this.dealerHand.cards);
        this.dealerHand.score = dealerScore;
        let results = [];
        
        // Settle main hand outcomes
        this.playerHands.forEach((hand, i) => {
            const playerScore = this.calculateScore(hand.cards);
            hand.score = playerScore;
            let result = { outcome: '', payout: 0 };

            if (this.isBust(hand.cards)) {
                result.outcome = 'bust';
                result.payout = 0;
            } else if (this.isBlackjack(hand.cards) && !this.isBlackjack(this.dealerHand.cards)) {
                result.outcome = 'blackjack';
                result.payout = hand.bet * 2.5;
                this.chips += result.payout;
            } else if (this.isBlackjack(this.dealerHand.cards) && !this.isBlackjack(hand.cards)) {
                result.outcome = 'dealer_blackjack';
                result.payout = 0;
            } else if (dealerScore > 21 || playerScore > dealerScore) {
                result.outcome = 'win';
                result.payout = hand.bet * 2;
                this.chips += result.payout;
            } else if (playerScore === dealerScore) {
                result.outcome = 'push';
                result.payout = hand.bet;
                this.chips += result.payout;
            } else {
                result.outcome = 'lose';
                result.payout = 0;
            }
            results.push(result);
        });

        // Settle side bets (only for first hand - side bets are based on first two cards)
        if (this.playerHands.length > 0 && this.playerHands[0].cards.length >= 2) {
            const firstHand = this.playerHands[0];
            
            // Perfect Pairs side bet
            if (this.bets.pp > 0) {
                const ppResult = this.checkPerfectPairs(firstHand.cards[0], firstHand.cards[1]);
                if (ppResult.payout > 0) {
                    const ppPayout = this.bets.pp * (ppResult.payout + 1); // payout + original bet
                    this.chips += ppPayout;
                }
            }
            
            // 21+3 side bet (uses player's first two cards + dealer's up card)
            if (this.bets.plus3 > 0 && this.dealerHand.cards.length > 0) {
                const plus3Cards = [firstHand.cards[0], firstHand.cards[1], this.dealerHand.cards[0]];
                const plus3Result = this.check21Plus3(plus3Cards);
                if (plus3Result.payout > 0) {
                    const plus3Payout = this.bets.plus3 * (plus3Result.payout + 1); // payout + original bet
                    this.chips += plus3Payout;
                }
            }
        }

        this.settleInsurance();
        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
        return results;
    }

    getActiveHand() {
        if (
            Array.isArray(this.playerHands) &&
            this.activeHandIndex >= 0 &&
            this.activeHandIndex < this.playerHands.length
        ) {
            return this.playerHands[this.activeHandIndex];
        } else {
            return null;
        }
    }
    
    splitHand() {
        // Rate limiting
        if (!this.checkActionCooldown()) {
            return false;
        }
        
        // Validate game state
        this.validateGameState();
        
        // Check if game is in progress
        if (!this.isGameInProgress) {
            console.warn('Cannot split: game not in progress');
            return false;
        }
        
        const hand = this.getActiveHand();
        if (!hand) {
            console.error('Cannot split: no active hand');
            return false;
        }
        
        // Validate split conditions
        if (hand.cards.length !== 2) {
            console.warn(`Cannot split: hand has ${hand.cards.length} cards, need exactly 2`);
            return false;
        }
        
        if (hand.cards[0].value !== hand.cards[1].value) {
            console.warn('Cannot split: card values do not match');
            return false;
        }
        
        if (this.chips < hand.bet) {
            console.warn(`Cannot split: insufficient chips (${this.chips} < ${hand.bet})`);
            return false;
        }
        
        // Check maximum hands limit
        if (this.playerHands.length >= this.MAX_HANDS) {
            console.warn(`Cannot split: already at maximum hands (${this.MAX_HANDS})`);
            return false;
        }
        
        // Perform split
        const cardToMove = hand.cards.pop();
        const newHand = { cards: [cardToMove], bet: hand.bet, isSplit: true };
        this.chips -= hand.bet;
        hand.isSplit = true;
        
        // Deal one card to original hand
        if (!this.dealCard(hand, true)) {
            console.error('Failed to deal card to original hand after split');
            return false;
        }
        
        // Insert new hand and deal card to it
        this.playerHands.splice(this.activeHandIndex + 1, 0, newHand);
        if (!this.dealCard(newHand, true)) {
            console.error('Failed to deal card to new hand after split');
            return false;
        }
        
        console.log(`[SPLIT] Hand split successfully, total hands: ${this.playerHands.length}, chips remaining: ${this.chips}`);
        
        // Validate final state
        this.validateGameState();
        return true;
    }
    
    doubleDown() {
        // Rate limiting
        if (!this.checkActionCooldown()) {
            return false;
        }
        
        // Validate game state
        this.validateGameState();
        
        // Check if game is in progress
        if (!this.isGameInProgress) {
            console.warn('Cannot double down: game not in progress');
            return false;
        }
        
        const hand = this.getActiveHand();
        if (!hand) {
            console.error('Cannot double down: no active hand');
            return false;
        }
        
        // Validate double down conditions
        if (hand.cards.length !== 2) {
            console.warn(`Cannot double down: hand has ${hand.cards.length} cards, need exactly 2`);
            return false;
        }
        
        if (this.chips < hand.bet) {
            console.warn(`Cannot double down: insufficient chips (${this.chips} < ${hand.bet})`);
            return false;
        }
        
        if (hand.isDoubled) {
            console.warn('Cannot double down: hand already doubled');
            return false;
        }
        
        // Perform double down
        this.chips -= hand.bet;
        hand.bet *= 2;
        hand.isDoubled = true;
        
        // Deal exactly one card
        if (!this.dealCard(hand, true)) {
            console.error('Failed to deal card for double down');
            return false;
        }
        
        console.log(`[DOUBLE] Hand doubled successfully, new bet: ${hand.bet}, chips remaining: ${this.chips}`);
        
        // Validate final state
        this.validateGameState();
        return true;
    }
    
    placeInsurance(amount) {
        // Rate limiting
        if (!this.checkActionCooldown()) {
            return false;
        }
        
        // Input validation
        if (typeof amount !== 'number' || amount <= 0) {
            console.error(`Invalid insurance amount: ${amount}`);
            return false;
        }
        
        // Validate game state
        this.validateGameState();
        
        // Check if game is in progress
        if (!this.isGameInProgress) {
            console.warn('Cannot place insurance: game not in progress');
            return false;
        }
        
        // Check dealer has an Ace showing
        if (!this.dealerHand.cards.length || this.dealerHand.cards[0].value !== 'A') {
            console.warn('Cannot place insurance: dealer does not have Ace showing');
            return false;
        }
        
        // Check if insurance already placed
        if (this.bets.insurance > 0) {
            console.warn('Cannot place insurance: insurance already placed');
            return false;
        }
        
        // Validate insurance amount (typically half of main bet)
        const maxInsurance = Math.ceil(this.bets.main / 2);
        if (amount > maxInsurance) {
            console.warn(`Insurance amount ${amount} exceeds maximum ${maxInsurance}`);
            return false;
        }
        
        // Check if can place bet
        if (!this.canPlaceBet(amount)) {
            return false;
        }
        
        this.chips -= amount;
        this.bets.insurance = (this.bets.insurance || 0) + amount;
        
        console.log(`[INSURANCE] Placed insurance bet: ${amount}, chips remaining: ${this.chips}`);
        
        // Validate final state
        this.validateGameState();
        return true;
    }

    settleInsurance() {
        const insuranceBet = this.bets.insurance || 0;
        if (!insuranceBet) return;
        const dealerCards = this.dealerHand.cards;
        const isDealerBlackjack = this.isBlackjack(dealerCards);
        if (isDealerBlackjack) {
            const payout = insuranceBet * 3; // 2:1 plus original
            this.chips += payout;
        }
        this.bets.insurance = 0;
    }

    // Game state management
    startGame() {
        // Rate limiting
        if (!this.checkActionCooldown()) {
            return false;
        }
        
        // Validate current state
        this.validateGameState();
        
        // Check if already in progress
        if (this.isGameInProgress) {
            console.warn('Cannot start game: game already in progress');
            return false;
        }
        
        // Validate main bet
        if (this.bets.main <= 0) {
            console.warn('Cannot start game: no main bet placed');
            return false;
        }
        
        // Check minimum chip requirements
        if (this.chips < 0) {
            console.error('Cannot start game: negative chip balance');
            return false;
        }
        
        // Validate deck
        if (!this.deck || this.deck.length < 10) {
            console.warn('Deck too small, creating and shuffling new deck');
            this.createDeck();
            this.shuffleDeck();
        }
        
        // Initialize game state
        this.isGameInProgress = true;
        this.isDealerPlayoutComplete = false;
        this.activeHandIndex = 0;
        
        console.log(`[GAME START] Game started with main bet: ${this.bets.main}, chips: ${this.chips}`);
        return true;
    }
    
    endGame() {
        this.isGameInProgress = false;
        this.isDealerPlayoutComplete = true;
        this.validateGameState();
        console.log('[GAME END] Game ended');
    }
    
    canPerformAction(actionName) {
        if (!this.isGameInProgress) {
            console.warn(`Cannot ${actionName}: game not in progress`);
            return false;
        }
        
        if (this.isDealerPlayoutComplete) {
            console.warn(`Cannot ${actionName}: dealer playout complete`);
            return false;
        }
        
        return true;
    }
}
