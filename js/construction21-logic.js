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
        this.suits = ['♥', '♦', '♠', '♣'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.PERFECT_PAIRS_PAYOUTS = { perfect: 25, colored: 12, mixed: 6 };
        this.TWENTY_ONE_PLUS_THREE_PAYOUTS = { suitedTrips: 100, straightFlush: 40, threeOfAKind: 30, straight: 10, flush: 5 };
        this.userId = userId || null;
        this.db = db;
        this.resetGame(100);
    }

    // ---- CHIP STORAGE ----

    async loadChipsFromFirebase() {
        if (!this.userId) return;
        const userDocRef = doc(this.db, "construction21_users", this.userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            this.chips = docSnap.data().chips || 100;
        } else {
            this.chips = 100;
            await setDoc(userDocRef, { chips: this.chips });
        }
    }

    async saveChipsToFirebase() {
        if (!this.userId) return;
        const userDocRef = doc(this.db, "construction21_users", this.userId);
        try {
            await runTransaction(this.db, async (transaction) => {
                const docSnap = await transaction.get(userDocRef);
                if (!docSnap.exists()) throw "User doc missing!";
                transaction.update(userDocRef, { chips: this.chips });
            });
        } catch (e) {
            // If transaction fails, set directly (should not happen unless brand new)
            await setDoc(userDocRef, { chips: this.chips }, { merge: true });
        }
    }

    // ---- GAME LOGIC ----

    resetGame(startingChips = 100) {
        this.deck = [];
        this.dealerHand = { cards: [], score: 0, isBlackjack: false };
        this.playerHands = [];
        this.activeHandIndex = 0;
        this.chips = startingChips;
        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
    }

    createDeck() {
        this.deck = [];
        this.suits.forEach(suit => {
            this.values.forEach(value => {
                this.deck.push({ suit, value, isFaceUp: false });
            });
        });
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCard(hand, isFaceUp = true) {
        if (this.deck.length === 0) return null;
        const card = this.deck.pop();
        card.isFaceUp = isFaceUp;
        if (!hand.cards) hand.cards = [];
        hand.cards.push(card);
        return card;
    }    calculateScore(cards) {
        let score = 0, aceCount = 0;
        cards.forEach(card => {
            if (card.value === 'A') { aceCount++; score += 11; }
            else if (['K', 'Q', 'J'].includes(card.value)) score += 10;
            else score += parseInt(card.value);
        });
        while (score > 21 && aceCount > 0) { score -= 10; aceCount--; }
        
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
        
        return score;
    }

    getCardNumericValue(card) {
        if (card.value === 'A') return 1;
        if (['K', 'Q', 'J'].includes(card.value)) return 10;
        return parseInt(card.value);
    }

    canPlaceBet(amount) {
        return this.chips >= amount;
    }

    placeBet(type, amount) {
        if (!this.canPlaceBet(amount)) return false;
        this.chips -= amount;
        this.bets[type] += amount;
        return true;
    }

    clearBets() {
        this.chips += this.bets.main + this.bets.pp + this.bets.plus3 + (this.bets.insurance || 0);
        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
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

    // Check if a hand is a soft 17 (contains an Ace counted as 11)
    isSoft17(cards) {
        const score = this.calculateScore(cards);
        if (score !== 17) return false;
        
        // Check if there's an Ace being counted as 11
        let aceCount = 0;
        let tempScore = 0;
        cards.forEach(card => {
            if (card.value === 'A') { 
                aceCount++; 
                tempScore += 11; 
            } else if (['K', 'Q', 'J'].includes(card.value)) {
                tempScore += 10;
            } else {
                tempScore += parseInt(card.value);
            }
        });
        
        // If we have aces and the score would be over 21 without converting any ace to 1,
        // but currently equals 17, then it's a soft 17
        return aceCount > 0 && tempScore > 21 && score === 17;
    }    shouldDealerHit() {
        const dealerScore = this.calculateScore(this.dealerHand.cards);
        const shouldHit = dealerScore <= 16;
        
        // Debug logging
        console.log(`[DEALER DEBUG] Cards: ${this.dealerHand.cards.map(c => c.value + c.suit).join(', ')}`);
        console.log(`[DEALER DEBUG] Score: ${dealerScore}`);
        console.log(`[DEALER DEBUG] Should hit: ${shouldHit}`);
        
        // Explicit logic: dealer hits on 16 and below, stands on 17 and above
        return shouldHit;
    }settleHands() {
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
        const hand = this.getActiveHand();
        if (!hand) return false;
        if (hand.cards.length !== 2 || hand.cards[0].value !== hand.cards[1].value) return false;
        if (this.chips < hand.bet) return false;
        // Perform split
        const cardToMove = hand.cards.pop();
        const newHand = { cards: [cardToMove], bet: hand.bet, isSplit: true };
        this.chips -= hand.bet;
        hand.isSplit = true;
        this.dealCard(hand, true);
        this.playerHands.splice(this.activeHandIndex + 1, 0, newHand);
        this.dealCard(newHand, true);
        return true;
    }

    doubleDown() {
        const hand = this.getActiveHand();
        if (!hand) return false;
        if (this.chips < hand.bet) return false;
        if (hand.cards.length !== 2) return false;
        this.chips -= hand.bet;
        hand.bet *= 2;
        this.dealCard(hand, true);
        hand.isDoubled = true;
        return true;
    }

    placeInsurance(amount) {
        if (!this.dealerHand.cards.length || this.dealerHand.cards[0].value !== 'A') return false;
        if (!this.canPlaceBet(amount)) return false;
        this.chips -= amount;
        this.bets.insurance = (this.bets.insurance || 0) + amount;
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
}
