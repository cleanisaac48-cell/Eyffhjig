document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem("token");
  const spinnerOverlay = document.getElementById("spinnerOverlay");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    spinnerOverlay.style.display = "flex";
    await loadMatches();
  } catch (error) {
    console.error('Error loading matches:', error);
  } finally {
    spinnerOverlay.style.display = "none";
  }
});

async function loadMatches() {
  try {
    const token = localStorage.getItem("token");
    
    // Get current user email from token
    const currentUser = getCurrentUserFromToken();
    if (!currentUser) {
      throw new Error('Unable to get current user');
    }

    // Fetch accepted profiles (mutual matches)
    const response = await fetch(`${config.API_BASE_URL}/api/users/interactions/${currentUser.email}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const interactions = await response.json();
      const acceptedMatches = interactions.filter(u => u.action === 'accepted');
      
      // Load conversation data for each match
      const matchesWithConversations = await Promise.all(
        acceptedMatches.map(async (match) => {
          try {
            const conversationResponse = await fetch(`${config.API_BASE_URL}/api/messages/conversation/${match.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            let lastMessage = 'Start a conversation...';
            let unreadCount = 0;
            
            if (conversationResponse.ok) {
              const conversationData = await conversationResponse.json();
              const messages = conversationData.messages || [];
              if (messages.length > 0) {
                lastMessage = messages[messages.length - 1].message;
                // Fix unread count calculation - use 'read' field instead of 'is_read'
                unreadCount = messages.filter(msg => 
                  msg.sender_id === match.id && msg.read === false
                ).length;
              }
            }
            
            return {
              user_id: match.id,
              user_name: match.full_name,
              profile_photo_url: match.profile_photo_url,
              last_message: lastMessage,
              unread_count: unreadCount
            };
          } catch (error) {
            console.error('Error loading conversation for match:', match.id, error);
            return {
              user_id: match.id,
              user_name: match.full_name,
              profile_photo_url: match.profile_photo_url,
              last_message: 'Start a conversation...',
              unread_count: 0
            };
          }
        })
      );
      
      displayMatches(matchesWithConversations);
    } else {
      throw new Error('Failed to load matches');
    }
  } catch (error) {
    console.error('Error loading matches:', error);
    document.getElementById('noMatches').style.display = 'block';
  }
}

function getCurrentUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch (e) {
    console.error("Error decoding token:", e);
    return null;
  }
}

function displayMatches(matches) {
  const container = document.getElementById('matchesContainer');
  const noMatches = document.getElementById('noMatches');

  if (matches.length === 0) {
    noMatches.style.display = 'block';
    return;
  }

  container.innerHTML = '';

  matches.forEach(match => {
    const matchCard = document.createElement('div');
    matchCard.className = 'match-card';
    matchCard.onclick = () => {
      window.location.href = `chat.html?user=${match.user_id}&name=${encodeURIComponent(match.user_name)}`;
    };

    const unreadBadge = match.unread_count > 0 ?
      `<span class="unread-badge">${match.unread_count}</span>` : '';

    matchCard.innerHTML = `
      <div class="match-profile">
        <img src="${match.profile_photo_url || 'https://via.placeholder.com/60?text=No+Photo'}"
             alt="Profile" class="match-photo"
             onerror="this.src='https://via.placeholder.com/60?text=No+Photo'">
        <div class="match-info">
          <h3>${match.user_name}${unreadBadge}</h3>
          <p>Matched with you</p>
        </div>
      </div>
      <div class="match-stats">
        <div class="stat">
          <div class="stat-number">${match.unread_count || 0}</div>
          <div class="stat-label">Unread</div>
        </div>
        <div class="stat">
          <div class="stat-number">💬</div>
          <div class="stat-label">Chat</div>
        </div>
        <div class="stat">
          <div class="stat-number">💕</div>
          <div class="stat-label">Matched</div>
        </div>
      </div>
      <p style="text-align: center; color: #667eea; font-weight: bold; margin: 10px 0 0 0;">
        ${match.last_message || 'Start a conversation...'}
      </p>
    `;

    container.appendChild(matchCard);
  });
}

// Add function to refresh matches when returning from chat
window.addEventListener('focus', () => {
  // Reload matches when window gains focus (user returns from chat)
  loadMatches();
});

// Add periodic refresh to keep unread counts updated
setInterval(() => {
  loadMatches();
}, 30000); // Refresh every 30 seconds