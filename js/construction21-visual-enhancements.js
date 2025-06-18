// This script enhances the blackjack table visually with additional elements
document.addEventListener('DOMContentLoaded', function() {
  // Create and enhance the table with visual elements
  enhanceBlackjackTable();
  
  // Add card animations
  setupCardAnimations();
  
  // Add dealer card reveal animation
  addDealerCardRevealAnimation();
  
  // Create a simple empty function for sound compatibility
  window.playSoundEffect = function() { /* Silent implementation */ };
  
  console.log("[Visual Enhancements] Running in silent mode (sounds disabled)");
});

// Add card animations
function setupCardAnimations() {
  // Add CSS animation classes to the document
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    @keyframes dealCard {
      0% { transform: translate(0, -100px) rotate(5deg) scale(0.8); opacity: 0; }
      60% { transform: translate(0, 5px) rotate(-2deg) scale(1.05); opacity: 1; }
      100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
    }
    
    @keyframes flipCard {
      0% { transform: rotateY(0deg); box-shadow: 0 3px 10px rgba(0,0,0,0.3); }
      50% { transform: rotateY(90deg); box-shadow: 0 0 5px rgba(0,0,0,0.1); }
      100% { transform: rotateY(0deg); box-shadow: 0 3px 10px rgba(0,0,0,0.3); }
    }
    
    @keyframes winPulse {
      0% { transform: scale(1); box-shadow: 0 0 10px rgba(255,215,0,0.5); }
      50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255,215,0,0.8), 0 0 30px rgba(255,255,255,0.4); }
      100% { transform: scale(1); box-shadow: 0 0 10px rgba(255,215,0,0.5); }
    }
    
    @keyframes bustShake {
      0% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(-5px, 0) rotate(-2deg); }
      50% { transform: translate(5px, 0) rotate(2deg); }
      75% { transform: translate(-5px, 0) rotate(-2deg); }
      100% { transform: translate(0, 0) rotate(0deg); }
    }
      .card-animated-deal {
      animation: dealCard 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      transform-origin: center bottom;
      backface-visibility: hidden;
    }
    
    .card-animated-flip {
      animation: flipCard 0.8s ease-in-out forwards;
      transform-style: preserve-3d;
      perspective: 600px;
    }
    
    .card-win-highlight {
      animation: winPulse 1.5s ease-in-out infinite;
      z-index: 30;
    }
    
    .card-bust {
      animation: bustShake 0.6s ease-in-out forwards;
      opacity: 0.7 !important;
    }
    
    .player-hand.winner {
      animation: winPulse 2s ease-in-out infinite;
    }
    
    .player-hand.loser .card {
      filter: grayscale(60%);
      transition: all 0.5s ease;
    }
  `;
  document.head.appendChild(styleSheet);

  // Observer to add animations to new cards
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.classList && node.classList.contains('card') && !node.classList.contains('card-animated-deal')) {
            node.classList.add('card-animated-deal');
          }
        });
      }
    });
  });

  // Start observing dealer and player card areas
  const dealerCards = document.getElementById('dealer-cards');
  const playerHands = document.getElementById('player-hands');
  
  if (dealerCards) {
    observer.observe(dealerCards, { childList: true, subtree: true });
  }
  
  if (playerHands) {
    observer.observe(playerHands, { childList: true, subtree: true });
  }

  console.log("[Visual Enhancements] Card animations setup complete");
}

// Add function to handle dealer card reveal
function addDealerCardRevealAnimation() {
  // This function should be called when the dealer's hidden card needs to be flipped
  window.revealDealerCard = function() {
    const dealerCards = document.getElementById('dealer-cards');
    if (!dealerCards) return;
    
    // Find the face down card (typically the second card)
    const faceDownCard = dealerCards.querySelector('.card.face-down');
    if (!faceDownCard) return;
      // Sound effects removed for simplicity
    
    // Add flip animation
    faceDownCard.classList.add('card-animated-flip');
    
    // After animation, change from face-down to face-up
    setTimeout(() => {
      faceDownCard.classList.remove('face-down');
      faceDownCard.classList.add('face-up');
    }, 400); // Half the animation duration
    
    return true;
  };
    // Add function to handle win/lose animations
  window.animateHandResult = function(handIndex, result) {
    const playerHands = document.getElementById('player-hands');
    if (!playerHands) return;
    
    const handEl = playerHands.querySelector(`.player-hand[data-hand-index="${handIndex}"]`);
    if (!handEl) return;
    
    // Remove any existing result classes
    handEl.classList.remove('winner', 'loser', 'push');
      // Sound effects removed for simplicity
    
    // Add appropriate class based on result
    if (result === 'win') {
      handEl.classList.add('winner');
      // Add shine effect to cards
      const cards = handEl.querySelectorAll('.card');
      cards.forEach(card => card.classList.add('card-win-highlight'));
    } else if (result === 'lose') {
      handEl.classList.add('loser');
    } else if (result === 'bust') {
      handEl.classList.add('loser');
      // Add bust animation to cards
      const cards = handEl.querySelectorAll('.card');
      cards.forEach(card => card.classList.add('card-bust'));
    } else if (result === 'push') {
      handEl.classList.add('push');
    }
    
    return true;
  };
  
  console.log("[Visual Enhancements] Card reveal animations ready");
}

// Sound functionality removed for simplicity
// The window.playSoundEffect function is defined in the DOMContentLoaded event handler
// as an empty function to maintain compatibility with existing code

function enhanceBlackjackTable() {
  // Get the blackjack table element
  const table = document.getElementById('blackjack-table');
  if (!table) return;
  
  // Add table vignette for depth effect
  const tableVignette = document.createElement('div');
  tableVignette.id = 'table-vignette';
  table.appendChild(tableVignette);

  // Add dealer card spot for visual guidance
  const dealerCardSpot = document.createElement('div');
  dealerCardSpot.className = 'dealer-card-spot';
  dealerCardSpot.innerHTML = '<div class="card-spot-label">DEALER CARDS</div>';
  table.appendChild(dealerCardSpot);

  // Add player card spot for visual guidance
  const playerCardSpot = document.createElement('div');
  playerCardSpot.className = 'player-card-spot';
  playerCardSpot.innerHTML = '<div class="card-spot-label">PLAYER CARDS</div>';
  table.appendChild(playerCardSpot);

  // Add discard tray
  const discardTray = document.createElement('div');
  discardTray.className = 'discard-tray';
  discardTray.innerHTML = '<div class="discard-tray-inner">DISCARD</div>';
  table.appendChild(discardTray);
  
  // Add depth effect to areas
  const dealerArea = document.createElement('div');
  dealerArea.className = 'table-area-dealer';
  table.appendChild(dealerArea);
  
  const playerArea = document.createElement('div');
  playerArea.className = 'table-area-player';
  table.appendChild(playerArea);
  
  // Add subtle table rules text
  const rulesText = document.createElement('div');
  rulesText.className = 'table-text rules';
  rulesText.textContent = 'BLACKJACK PAYS 3:2 • DEALER STANDS ON 17';
  table.appendChild(rulesText);
  
  // Enhance the table style
  table.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6), inset 0 0 30px rgba(255,215,0,0.1), 0 0 0 2px rgba(255,215,0,0.3), inset 0 0 100px rgba(0,0,0,0.3)';
  table.style.background = 'radial-gradient(ellipse at center, rgba(0,80,0,0.9) 0%, rgba(0,60,0,0.95) 50%, rgba(0,40,0,0.9) 100%)';
  table.style.borderRadius = '30px';
  table.style.border = '8px solid #ffd700';
  
  // Update hand value styling
  const handValues = document.querySelectorAll('.hand-value');
  handValues.forEach(value => {
    value.style.background = 'rgba(0,0,0,0.8)';
    value.style.color = 'white';
    value.style.borderRadius = '50%';
    value.style.border = '2px solid #ffd700';
    value.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';
    value.style.zIndex = '20';
  });
  
  // Enhance bet spots
  const betSpots = document.querySelectorAll('.table-bet-spot');
  betSpots.forEach(spot => {
    spot.style.background = 'rgba(0,50,0,0.8)';
    spot.style.borderColor = '#ffd700';
    spot.style.boxShadow = '0 3px 10px rgba(0,0,0,0.4), inset 0 0 15px rgba(0,0,0,0.3)';
  });
  
  console.log("[Visual Enhancements] Table elements added successfully");
}
