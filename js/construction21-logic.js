// construction21-logic.js
// Pure game logic for Construction 21 (Blackjack)

export class Construction21Game {
    constructor() {
        this.suits = ['♥', '♦', '♠', '♣'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.PERFECT_PAIRS_PAYOUTS = { perfect: 25, colored: 12, mixed: 6 };
        this.TWENTY_ONE_PLUS_THREE_PAYOUTS = { suitedTrips: 100, straightFlush: 40, threeOfAKind: 30, straight: 10, flush: 5 };
        this.resetGame(100); // Default chips
    }

    resetGame(startingChips = 100) {
        this.deck = [];
        this.dealerHand = { cards: [], score: 0, isBlackjack: false };
        this.playerHands = [];
        this.activeHandIndex = 0;
        this.chips = startingChips;
        this.bets = { main: 0, pp: 0, plus3: 0 };
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
        const card = this.deck.pop();
        card.isFaceUp = isFaceUp;
        hand.cards.push(card);
        return card;
    }

    calculateScore(cards) {
        let score = 0, aceCount = 0;
        cards.forEach(card => {
            if (card.value === 'A') { aceCount++; score += 11; }
            else if (['K', 'Q', 'J'].includes(card.value)) score += 10;
            else score += parseInt(card.value);
        });
        while (score > 21 && aceCount > 0) { score -= 10; aceCount--; }
        return score;
    }

    getCardNumericValue(card) {
        if (card.value === 'A') return 1;
        if (['K', 'Q', 'J'].includes(card.value)) return 10;
        return parseInt(card.value);
    }

    // Betting logic
    canPlaceBet(amount) { return this.chips >= amount; }
    placeBet(type, amount) {
        if (!this.canPlaceBet(amount)) return false;
        this.chips -= amount;
        this.bets[type] += amount;
        return true;
    }
    clearBets() {
        this.chips += this.bets.main + this.bets.pp + this.bets.plus3;
        this.bets = { main: 0, pp: 0, plus3: 0 };
    }

    // Side Bets
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

    // Evaluate blackjack, bust, win, push, etc.
    isBlackjack(cards) {
        return cards.length === 2 && this.calculateScore(cards) === 21;
    }
    isBust(cards) {
        return this.calculateScore(cards) > 21;
    }

    // Settlement logic for round
    settleHands() {
        const dealerScore = this.calculateScore(this.dealerHand.cards);
        this.dealerHand.score = dealerScore;
        let results = [];

        this.playerHands.forEach(hand => {
            const playerScore = this.calculateScore(hand.cards);
            hand.score = playerScore;

            let result = { outcome: '', payout: 0 };

            if (this.isBust(hand.cards)) {
                result.outcome = 'bust';
                result.payout = 0;
            } else if (this.isBlackjack(hand.cards) && !this.isBlackjack(this.dealerHand.cards)) {
                result.outcome = 'blackjack';
                result.payout = hand.bet * 2.5; // pays 3:2
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

        // Settle side bets (if implemented in UI)
        // e.g., checkPerfectPairs, check21Plus3

        // Clear main and side bets after settlement
        this.bets = { main: 0, pp: 0, plus3: 0 };

        return results; // Array of {outcome, payout} per hand
    }

    // (Optional) For UI: expose current dealer/player hand, activeHandIndex, etc.

    // TODO: Add methods for splitting, doubling, insurance, etc. if desired.
}
