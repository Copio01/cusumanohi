// This is a temporary file to hold the properly formatted updateLeaderboard function

async function updateLeaderboard() {
    leaderboardEntries.className = 'loading';
    leaderboardEntries.innerHTML = '<div class="loading-spinner"></div>'; // Better loading indicator
    const scoresCollection = collection(db, leaderboardCollectionName);
    const q = query(scoresCollection, orderBy("score", "desc"), limit(LEADERBOARD_SIZE));
    
    try {
        const querySnapshot = await getDocs(q);
        leaderboardEntries.className = ''; // Remove loading class
        leaderboardEntries.innerHTML = ''; // Clear previous entries or loading message
        
        if (querySnapshot.empty) {
            leaderboardEntries.innerHTML = `
                <div style="text-align:center;padding:30px;color:#ffcc33;">
                    <div style="font-size:36px;margin-bottom:10px;">🏆</div>
                    <div style="font-weight:bold;font-size:1.2em;">No scores yet!</div>
                    <div style="opacity:0.8;margin-top:5px;">Be the first champion!</div>
                </div>`;
            return;
        }
        
        let rank = 1;
        querySnapshot.forEach(doc => {
            const s = doc.data();
            const entry = document.createElement('div');
            entry.classList.add('score-entry');
            entry.setAttribute('data-rank', rank); // Add rank attribute for CSS ::before content
            
            // Format score with commas
            const formattedScore = s.score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            
            // Get timestamp if available
            let timeAgo = '';
            if (s.timestamp) {
                const date = new Date(s.timestamp.seconds * 1000);
                // Simple time ago function
                const now = new Date();
                const diffMs = now - date;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    timeAgo = 'today';
                } else if (diffDays === 1) {
                    timeAgo = 'yesterday';
                } else if (diffDays < 7) {
                    timeAgo = `${diffDays} days ago`;
                } else {
                    timeAgo = date.toLocaleDateString();
                }
            }
            
            // Add trophy icon for top 3
            let trophyIcon = '';
            if (rank === 1) trophyIcon = '🏆 ';
            else if (rank === 2) trophyIcon = '🥈 ';
            else if (rank === 3) trophyIcon = '🥉 ';
            
            entry.innerHTML = `
                <span class="player-name">${trophyIcon}${s.name} <small>(${s.mode})</small></span>
                <span class="player-score">${formattedScore}</span>
                ${timeAgo ? `<span class="score-date">${timeAgo}</span>` : ''}
            `;
            
            // Add extra flair for the current player's score
            if (s.name === playerName) {
                entry.classList.add('current-player');
            }
            
            leaderboardEntries.appendChild(entry);
            rank++;
        });
    } catch (error) {
        console.error("Error fetching leaderboard from Firebase: ", error);
        leaderboardEntries.innerHTML = `
            <div style="text-align:center;padding:20px;color:#ff6b6b;">
                <div style="font-size:24px;margin-bottom:10px;">⚠️</div>
                <div>Error loading scores</div>
                <div style="font-size:0.9em;opacity:0.7;margin-top:5px;">Please try again later</div>
            </div>`;
    }
}
