export class Construction21Game {
    constructor() {
        this.suits = ['♥', '♦', '♠', '♣'];
        this.values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.PERFECT_PAIRS_PAYOUTS = { perfect: 25, colored: 12, mixed: 6 };
        this.TWENTY_ONE_PLUS_THREE_PAYOUTS = { suitedTrips: 100, straightFlush: 40, threeOfAKind: 30, straight: 10, flush: 5 };
        this.resetGame(100);
    }

    resetGame(startingChips = 100) {
        this.deck = [];
        this.dealerHand = { cards: [], score: 0, isBlackjack: false };
        this.playerHands = [];
        this.activeHandIndex = 0;
        this.chips = startingChips;
        this.bets = { main: 0, pp: 0, plus3: 0 };
        this.bets.insurance = 0; // Add insurance tracking
        console.log('[Game] Reset game. Chips:', this.chips);
    }

    createDeck() {
        this.deck = [];
        this.suits.forEach(suit => {
            this.values.forEach(value => {
                this.deck.push({ suit, value, isFaceUp: false });
            });
        });
        console.log('[Game] Deck created. Cards in deck:', this.deck.length);
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
        console.log('[Game] Deck shuffled.');
    }

    dealCard(hand, isFaceUp = true) {
        if (this.deck.length === 0) {
            console.warn('[Game] Tried to deal card from empty deck!');
            return null;
        }
        const card = this.deck.pop();
        card.isFaceUp = isFaceUp;
        if (!hand.cards) hand.cards = [];
        hand.cards.push(card);
        console.log(`[Game] Dealt card ${card.value}${card.suit} to hand. Face up: ${isFaceUp}`);
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

    canPlaceBet(amount) {
        const canBet = this.chips >= amount;
        if (!canBet) console.warn(`[Game] Cannot place bet: ${amount} chips requested, only ${this.chips} available.`);
        return canBet;
    }
    placeBet(type, amount) {
        if (!this.canPlaceBet(amount)) return false;
        this.chips -= amount;
        this.bets[type] += amount;
        console.log(`[Game] Placed bet of ${amount} on ${type}. Remaining chips: ${this.chips}`);
        return true;
    }
    clearBets() {
        this.chips += this.bets.main + this.bets.pp + this.bets.plus3 + (this.bets.insurance || 0);
        console.log(`[Game] Bets cleared. Chips refunded. Total chips: ${this.chips}`);
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
        const result = cards.length === 2 && this.calculateScore(cards) === 21;
        if (result) console.log('[Game] Blackjack detected:', cards);
        return result;
    }
    isBust(cards) {
        const result = this.calculateScore(cards) > 21;
        if (result) console.log('[Game] Bust detected:', cards);
        return result;
    }

    settleHands() {
        const dealerScore = this.calculateScore(this.dealerHand.cards);
        this.dealerHand.score = dealerScore;
        let results = [];

        this.playerHands.forEach((hand, i) => {
            const playerScore = this.calculateScore(hand.cards);
            hand.score = playerScore;
            let result = { outcome: '', payout: 0 };
            console.log(`[Game] Settling hand #${i + 1}:`, hand.cards);

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
            console.log(`[Game] Result for hand #${i + 1}:`, result);
        });

        // Settle insurance after all hands (should be called after dealer reveals hole card)
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
            console.warn('[Game] getActiveHand: No active hand available.', {
                hands: this.playerHands,
                activeHandIndex: this.activeHandIndex
            });
            return null;
        }
    }

    /**
     * Attempt to split the active hand (only if allowed: two cards, same value, enough chips).
     * Returns true if split succeeds, false otherwise.
     */
    splitHand() {
        const hand = this.getActiveHand();
        if (!hand) {
            console.warn('[Game] splitHand: No active hand.');
            return false;
        }
        if (hand.cards.length !== 2 || hand.cards[0].value !== hand.cards[1].value) {
            console.warn('[Game] splitHand: Can only split pairs. Hand:', hand.cards);
            return false;
        }
        if (this.chips < hand.bet) {
            console.warn('[Game] splitHand: Not enough chips to split.');
            return false;
        }
        // Perform the split
        const cardToMove = hand.cards.pop();
        const newHand = {
            cards: [cardToMove],
            bet: hand.bet,
            isSplit: true
        };
        this.chips -= hand.bet;
        hand.isSplit = true;
        // Each hand gets one new card (face up)
        this.dealCard(hand, true);
        this.playerHands.splice(this.activeHandIndex + 1, 0, newHand); // Insert new hand after current
        this.dealCard(newHand, true);
        console.log('[Game] splitHand: Hand split! New hands:', this.playerHands);
        return true;
    }

    /**
     * Double the bet on the active hand and deal one more card, then end turn for this hand.
     * Returns true if double-down succeeds.
     */
    doubleDown() {
        const hand = this.getActiveHand();
        if (!hand) {
            console.warn('[Game] doubleDown: No active hand.');
            return false;
        }
        if (this.chips < hand.bet) {
            console.warn('[Game] doubleDown: Not enough chips to double down.');
            return false;
        }
        if (hand.cards.length !== 2) {
            console.warn('[Game] doubleDown: Can only double down with exactly two cards.');
            return false;
        }
        this.chips -= hand.bet;
        hand.bet *= 2;
        this.dealCard(hand, true);
        hand.isDoubled = true;
        console.log('[Game] doubleDown: Hand doubled. New bet:', hand.bet, 'Hand:', hand.cards);
        // End turn for this hand—UI/game flow should move to next hand.
        return true;
    }

    /**
     * Place insurance bet (usually up to half the main bet) if dealer shows an Ace.
     * Insurance bet is resolved when dealer checks for blackjack.
     * Returns true if insurance bet is placed.
     */
    placeInsurance(amount) {
        if (
            !this.dealerHand.cards.length ||
            this.dealerHand.cards[0].value !== 'A'
        ) {
            console.warn('[Game] placeInsurance: Dealer does not show Ace.');
            return false;
        }
        if (!this.canPlaceBet(amount)) {
            console.warn('[Game] placeInsurance: Not enough chips for insurance.');
            return false;
        }
        this.chips -= amount;
        this.bets.insurance = (this.bets.insurance || 0) + amount;
        console.log('[Game] placeInsurance: Insurance bet placed:', amount, 'Total insurance bet:', this.bets.insurance);
        return true;
    }

    /**
     * Settle insurance bet after dealer reveals second card.
     * Pays 2:1 if dealer blackjack, loses otherwise.
     * Call after dealer checks for blackjack.
     */
    settleInsurance() {
        const insuranceBet = this.bets.insurance || 0;
        if (!insuranceBet) return;
        const dealerCards = this.dealerHand.cards;
        const isDealerBlackjack = this.isBlackjack(dealerCards);
        if (isDealerBlackjack) {
            const payout = insuranceBet * 3; // 2:1 plus the original bet back
            this.chips += payout;
            console.log('[Game] settleInsurance: Dealer blackjack! Insurance payout:', payout);
        } else {
            console.log('[Game] settleInsurance: No dealer blackjack. Insurance bet lost.');
        }
        this.bets.insurance = 0;
    }
}
