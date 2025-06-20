// construction21-logic.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- Constants for Game Clarity & Maintainability ---
export const GAME_OUTCOMES = Object.freeze({
    WIN: 'WIN',
    LOSE: 'LOSE',
    PUSH: 'PUSH',
    BUST: 'BUST',
    BLACKJACK: 'BLACKJACK',
    DEALER_BLACKJACK: 'DEALER_BLACKJACK'
});

// --- Default Game Rules (Configurable) ---
const DEFAULT_RULES = {
    dealerHitsSoft17: true,
    blackjackPayout: 1.5, // 3:2 payout
    allowDoubleAfterSplit: true,
    allowHitOnSplitAces: false
};

// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyBVtq6dAEuybJNmTTv8dXBxTVUgw1t0ZMk",
    authDomain: "cusumano-website.firebaseapp.com",
    projectId: "cusumano-website",
    storageBucket: "cusumano-website.appspot.com",
    messagingSenderId: "20051552210",
    appId: "1:20051552210:web:7eb3b22baa3fec184e4a0b"
};
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export class Construction21Game {
    constructor(userId, rules = {}, verbose = false) {
        this.userId = userId || null;
        this.rules = { ...DEFAULT_RULES, ...rules };
        this.verbose = verbose;
        this.reset();
    }

    reset(startingChips = 10000) {
        this.suits = ['♥', '♦', '♠', '♣'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.PAYOUTS = {
            PERFECT_PAIRS: { perfect: 25, colored: 12, mixed: 6 },
            PLUS_THREE: { suitedTrips: 100, straightFlush: 40, threeOfAKind: 30, straight: 10, flush: 5 }
        };
        this.MAX_CHIPS = 1000000;
        this.MIN_CHIPS = 0;
        this.MAX_BET = 50000;
        this.MIN_BET = 1;
        this.MAX_HANDS = 4;
        this.MAX_CARDS_PER_HAND = 11;

        this.chips = Math.max(this.MIN_CHIPS, Math.min(this.MAX_CHIPS, startingChips));
        this.deck = [];
        this.dealerHand = { cards: [], score: 0 };
        this.playerHands = [];
        this.activeHandIndex = 0;
        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
        this.isGameInProgress = false;
        this.isDealerTurn = false;
        this.actionLog = [];
        this._log({ type: "state", action: "reset", chips: this.chips });
    }

    // --- Logging ---
    _log(entry) {
        this.actionLog.push({ ...entry, ts: Date.now() });
        if (this.verbose) console.log("[GameLog]", entry);
    }
    getActionLog() { return this.actionLog; }

    // --- Betting Methods ---
    placeBet(type, amount) {
        if (this.isGameInProgress) return false;
        if (!(typeof amount === 'number' && amount > 0 && this.chips >= amount)) return false;
        if (!['main', 'pp', 'plus3'].includes(type)) return false;
        if (amount > this.MAX_BET || amount < this.MIN_BET) return false;
        this.chips -= amount;
        this.bets[type] += amount;
        this._log({ type: "bet", action: "placeBet", betType: type, amount, newChips: this.chips });
        return true;
    }

    rebet() {
        if (this.isGameInProgress) return false;
        const sum = this.bets.main + this.bets.pp + this.bets.plus3;
        if (sum === 0) return false;
        if (this.chips < sum) return false;
        this.chips -= sum;
        this.bets.main *= 2;
        this.bets.pp *= 2;
        this.bets.plus3 *= 2;
        this._log({ type: "bet", action: "rebet", newBets: { ...this.bets }, newChips: this.chips });
        return true;
    }

    clearBets() {
        if (this.isGameInProgress) return false;
        const toReturn = this.bets.main + this.bets.pp + this.bets.plus3;
        this.chips += toReturn;
        this._log({ type: "bet", action: "clearBets", returned: toReturn, newChips: this.chips });
        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
        return true;
    }

    // --- Core Game Flow ---
    startGame() {
        if (this.isGameInProgress || this.bets.main < this.MIN_BET) return false;
        this._prepareDeck();
        this.playerHands = [{
            cards: [],
            bet: this.bets.main,
            score: 0,
            isSplit: false,
            isSplitAce: false,
            isDoubled: false
        }];
        this.dealerHand = { cards: [], score: 0 };
        this.activeHandIndex = 0;
        this.isGameInProgress = true;
        this.isDealerTurn = false;
        this._log({ type: "state", action: "startGame", bets: { ...this.bets }, chips: this.chips });
        return true;
    }

    endGame() {
        this.isGameInProgress = false;
        this.isDealerTurn = false;
        this._log({ type: "state", action: "endGame", chips: this.chips });
    }

    // --- Player Actions ---
    hit() {
        if (!this.isGameInProgress) return false;
        const hand = this.getActiveHand();
        if (!hand || hand.score >= 21) return false;
        if (hand.isSplitAce && !this.rules.allowHitOnSplitAces) {
            this._log({ type: "action", action: "hit", result: "illegal_on_split_ace", handIndex: this.activeHandIndex });
            this.stand();
            return false;
        }
        const card = this.dealCard(hand);
        this._log({ type: "action", action: "hit", handIndex: this.activeHandIndex, card, newScore: hand.score });
        return true;
    }

    stand() {
        if (!this.isGameInProgress) return false;
        this._log({ type: "action", action: "stand", handIndex: this.activeHandIndex });
        this.activeHandIndex++;
        if (this.activeHandIndex >= this.playerHands.length) this.isDealerTurn = true;
        return true;
    }    double() {
        if (!this.isGameInProgress) return false;
        const hand = this.getActiveHand();
        if (!hand ||
            hand.cards.length !== 2 ||
            this.chips < hand.bet ||
            (!this.rules.allowDoubleAfterSplit && hand.isSplit)
        ) {
            this._log({ type: "action", action: "double", result: "not_allowed", handIndex: this.activeHandIndex });
            return false;
        }
        this.chips -= hand.bet;
        hand.bet *= 2;
        hand.isDoubled = true;
        const card = this.dealCard(hand);
        
        // After doubling, automatically move to next hand
        // This is correct behavior since you can't hit after doubling
        this.activeHandIndex++;
        if (this.activeHandIndex >= this.playerHands.length) {
            this.isDealerTurn = true;
        }
        
        this._log({ type: "action", action: "double", handIndex: this.activeHandIndex - 1, card, bet: hand.bet, chips: this.chips, nextHand: this.activeHandIndex });
        // Player must stand after doubling
        this.stand();
        return true;
    }

    split() {
        if (!this.isGameInProgress) return false;
        const hand = this.getActiveHand();
        if (!hand ||
            hand.cards.length !== 2 ||
            hand.cards[0].value !== hand.cards[1].value ||
            this.chips < hand.bet ||
            this.playerHands.length >= this.MAX_HANDS
        ) {
            this._log({ type: "action", action: "split", result: "not_allowed", handIndex: this.activeHandIndex });
            return false;
        }
        const isAceSplit = hand.cards[0].value === 'A';
        this.chips -= hand.bet;
        const newHand = {
            cards: [hand.cards.pop()],
            bet: hand.bet,
            isSplit: true,
            isSplitAce: isAceSplit,
            isDoubled: false,
            score: 0
        };
        hand.isSplit = true;
        hand.isSplitAce = isAceSplit;
        this.playerHands.splice(this.activeHandIndex + 1, 0, newHand);
        this.dealCard(hand);
        this.dealCard(newHand);

        this._log({ type: "action", action: "split", handIndex: this.activeHandIndex, splitValue: hand.cards[0]?.value, chips: this.chips });

        // If splitting Aces, auto-stand if not allowed to hit after split
        if (isAceSplit && !this.rules.allowHitOnSplitAces) {
            this.stand();
        }
        return true;
    }

    // --- Card, Deck, & Utility Methods ---
    dealCard(hand, isFaceUp = true) {
        if (!hand || !this.deck.length) return null;
        const card = this.deck.pop();
        card.isFaceDown = !isFaceUp;
        hand.cards.push(card);
        hand.score = this.calculateScore(hand.cards);
        this._log({ type: "deal", card: { ...card }, handIndex: this.activeHandIndex, isFaceUp, handScore: hand.score });
        return card;
    }

    calculateScore(cards) {
        if (!Array.isArray(cards) || cards.length === 0) return 0;
        let score = 0, aceCount = 0;
        cards.forEach(card => {
            if (card.value === 'A') { aceCount++; score += 11; }
            else if (['K', 'Q', 'J'].includes(card.value)) { score += 10; }
            else { score += parseInt(card.value); }
        });
        while (score > 21 && aceCount > 0) { score -= 10; aceCount--; }
        return score;
    }

    isBlackjack(cards) {
        return cards.length === 2 && this.calculateScore(cards) === 21;
    }

    shouldDealerHit() {
        const score = this.calculateScore(this.dealerHand.cards);
        return score < 17 || (score === 17 && this.rules.dealerHitsSoft17 && this._isSoft17(this.dealerHand.cards));
    }

    getActiveHand() {
        if (!this.isGameInProgress || this.activeHandIndex >= this.playerHands.length) return null;
        return this.playerHands[this.activeHandIndex];
    }

    // --- Private Helpers ---
    _prepareDeck() {
        this.deck = [];
        for (const suit of this.suits) {
            for (const value of this.values) {
                this.deck.push({ suit, value });
            }
        }
        // Shuffle using Fisher-Yates
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        this._log({ type: "deck", action: "shuffled" });
    }

    // --- Settling Methods ---
    settleHands() {
        if (!this.isGameInProgress) return null;
        const mainHandResults = this._settleMainHands();
        const sideBetResults = this._settleSideBets();
        const insuranceResult = this._settleInsurance();

        let totalNet = 0;
        mainHandResults.forEach(r => totalNet += r.net);
        Object.values(sideBetResults).forEach(r => totalNet += r.net);
        totalNet += insuranceResult.net;

        this.bets = { main: 0, pp: 0, plus3: 0, insurance: 0 };
        this.endGame();
        this._log({ type: "state", action: "settleHands", mainHandResults, sideBetResults, insuranceResult, totalNet });
        return { mainHandResults, sideBetResults, insuranceResult, totalNet };
    }

    _settleMainHands() {
        const dealerScore = this.calculateScore(this.dealerHand.cards);
        const dealerHasBJ = this.isBlackjack(this.dealerHand.cards);
        return this.playerHands.map(hand => {
            const playerScore = this.calculateScore(hand.cards);
            const playerHasBJ = this.isBlackjack(hand.cards);
            let outcome, payout = 0;

            if (playerHasBJ && !dealerHasBJ) {
                outcome = GAME_OUTCOMES.BLACKJACK;
                payout = hand.bet * (1 + this.rules.blackjackPayout);
            } else if (playerHasBJ && dealerHasBJ) {
                outcome = GAME_OUTCOMES.PUSH;
                payout = hand.bet;
            } else if (dealerHasBJ) {
                outcome = GAME_OUTCOMES.DEALER_BLACKJACK;
            } else if (playerScore > 21) {
                outcome = GAME_OUTCOMES.BUST;
            } else if (dealerScore > 21 || playerScore > dealerScore) {
                outcome = GAME_OUTCOMES.WIN;
                payout = hand.bet * 2;
            } else if (playerScore === dealerScore) {
                outcome = GAME_OUTCOMES.PUSH;
                payout = hand.bet;
            } else {
                outcome = GAME_OUTCOMES.LOSE;
            }

            this.chips += payout;
            this._log({ type: "result", hand, outcome, payout, net: payout - hand.bet });
            return { ...hand, outcome, payout, bet: hand.bet, net: payout - hand.bet };
        });
    }

    _settleSideBets() {
        const results = {};
        const playerInitialCards = this.playerHands.length > 0 ? this.playerHands[0].cards.slice(0, 2) : [];
        const dealerUpCard = this.dealerHand.cards.length > 0 ? this.dealerHand.cards[0] : null;

        // Perfect Pair
        if (this.bets.pp > 0 && playerInitialCards.length === 2) {
            const ppResult = this._checkPerfectPairs(playerInitialCards[0], playerInitialCards[1]);
            const winnings = this.bets.pp * ppResult.payout;
            if (winnings > 0) this.chips += winnings + this.bets.pp;
            results.pp = { type: ppResult.type, payout: winnings, bet: this.bets.pp, net: winnings };
            this._log({ type: "sidebet", side: "Perfect Pair", result: results.pp });
        }

        // 21+3
        if (this.bets.plus3 > 0 && playerInitialCards.length === 2 && dealerUpCard) {
            const plus3Result = this._check21Plus3([...playerInitialCards, dealerUpCard]);
            const winnings = this.bets.plus3 * plus3Result.payout;
            if (winnings > 0) this.chips += winnings + this.bets.plus3;
            results.plus3 = { type: plus3Result.type, payout: winnings, bet: this.bets.plus3, net: winnings };
            this._log({ type: "sidebet", side: "21+3", result: results.plus3 });
        }
        return results;
    }

    _settleInsurance() {
        const bet = this.bets.insurance;
        const result = { bet, payout: 0, net: bet > 0 ? -bet : 0, outcome: 'lose' };
        if (bet > 0 && this.isBlackjack(this.dealerHand.cards)) {
            result.payout = bet * 2;
            this.chips += result.payout + bet;
            result.net = result.payout;
            result.outcome = 'win';
        }
        this._log({ type: "sidebet", side: "Insurance", result });
        return result;
    }

    _checkPerfectPairs(card1, card2) {
        if (card1.value !== card2.value) return { type: 'None', payout: 0 };
        const isRed = s => ['♥', '♦'].includes(s);
        if (card1.suit === card2.suit) return { type: 'Perfect Pair', payout: this.PAYOUTS.PERFECT_PAIRS.perfect };
        if (isRed(card1.suit) === isRed(card2.suit)) return { type: 'Colored Pair', payout: this.PAYOUTS.PERFECT_PAIRS.colored };
        return { type: 'Mixed Pair', payout: this.PAYOUTS.PERFECT_PAIRS.mixed };
    }

    _check21Plus3(cards) {
        const cardToRank = c => c.value === 'A' ? 14 : (['J','Q','K'].includes(c.value) ? {J:11,Q:12,K:13}[c.value] : parseInt(c.value));
        let ranks = cards.map(cardToRank).sort((a,b) => a - b);
        const suits = cards.map(c => c.suit);
        const isFlush = suits.every(s => s === suits[0]);
        const isStraight = (ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1) || (ranks.toString() === '2,3,14'); // Ace-low straight A-2-3
        const isThreeOfAKind = ranks[0] === ranks[1] && ranks[1] === ranks[2];

        if (isFlush && isThreeOfAKind) return { type:'Suited Trips', payout: this.PAYOUTS.PLUS_THREE.suitedTrips };
        if (isFlush && isStraight) return { type:'Straight Flush', payout: this.PAYOUTS.PLUS_THREE.straightFlush };
        if (isThreeOfAKind) return { type:'Three of a Kind', payout: this.PAYOUTS.PLUS_THREE.threeOfAKind };
        if (isStraight) return { type:'Straight', payout: this.PAYOUTS.PLUS_THREE.straight };
        if (isFlush) return { type:'Flush', payout: this.PAYOUTS.PLUS_THREE.flush };
        return { type:'None', payout:0 };
    }

    _isSoft17(cards) {
        if (this.calculateScore(cards) !== 17) return false;
        let nonAceScore = 0, hasAce = false;
        for (const card of cards) {
            if (card.value === 'A') hasAce = true;
            else if (['K', 'Q', 'J'].includes(card.value)) nonAceScore += 10;
            else nonAceScore += parseInt(card.value);
        }
        return hasAce && nonAceScore === 6;
    }
}
