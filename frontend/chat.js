let currentUserId = null;
let currentUserName = null;
let currentUserPhoto = null;
let messages = [];
let socket = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Check user subscription status first
  const userSubscription = await checkUserSubscription();

  if (userSubscription === 'free') {
    document.getElementById('premiumNotice').style.display = 'block';
    document.getElementById('chatMessages').style.display = 'none';
    document.getElementById('chatInputContainer').style.display = 'none';
    return;
  }

  // Get user info from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  currentUserId = urlParams.get('user');
  currentUserName = urlParams.get('name');

  if (!currentUserId) {
    // Redirect back to charts if no user specified
    window.location.href = 'charts.html';
    return;
  }

  // Initialize chat
  await initializeChat();
  setupMessageInput();
  loadMessages();

  // Setup profile photo click handler
  const chatAvatar = document.getElementById('chatAvatar');
  if (chatAvatar) {
    chatAvatar.addEventListener('click', () => {
      showProfilePhoto(chatAvatar.src, currentUserName);
    });
  }
});

async function checkUserSubscription() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${config.API_BASE_URL}/api/user/subscription-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      return data.subscription || 'free';
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
  }

  return 'free';
}

async function initializeChat() {
  try {
    const token = localStorage.getItem("token");

    // Fetch user details
    const response = await fetch(`${config.API_BASE_URL}/api/user?id=${currentUserId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const userData = await response.json();

      // Update UI with user info
      document.getElementById('chatUserName').textContent = userData.full_name || currentUserName || 'Unknown User';

      const chatAvatar = document.getElementById('chatAvatar');
      if (userData.profile_photo_url) {
        chatAvatar.src = userData.profile_photo_url;
      }

      chatAvatar.onerror = () => {
        chatAvatar.src = 'https://via.placeholder.com/50?text=User';
      };
    }
  } catch (error) {
    console.error('Error initializing chat:', error);
  }
}

function setupMessageInput() {
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');

  // Auto-resize textarea
  messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });

  // Send message on Enter (Shift+Enter for new line)
  messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send button click
  sendBtn.addEventListener('click', sendMessage);
}

async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();
  const sendBtn = document.getElementById('sendBtn');

  if (message === '') return;

  // Disable send button to prevent spam
  sendBtn.disabled = true;
  sendBtn.textContent = '...';

  try {
    const token = localStorage.getItem("token");

    // Send message to backend
    const response = await fetch(`${config.API_BASE_URL}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        receiverId: currentUserId,
        message: message
      })
    });

    if (response.ok) {
      // Display message immediately upon successful send
      displayMessage(message, 'sent');

      // Clear input
      messageInput.value = '';
      messageInput.style.height = 'auto';
    } else {
      const errorData = await response.json();
      alert('Failed to send message: ' + (errorData.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  } finally {
    // Re-enable send button
    sendBtn.disabled = false;
    sendBtn.textContent = '➤';
  }
}

function displayMessage(message, type) {
  const messagesContainer = document.getElementById('chatMessages');

  // Remove "no messages" text if it exists
  const noMessages = messagesContainer.querySelector('.no-messages');
  if (noMessages) {
    noMessages.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = message;

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.appendChild(time);
  messageDiv.appendChild(bubble);
  messagesContainer.appendChild(messageDiv);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function loadMessages() {
  try {
    const token = localStorage.getItem("token");
    const currentUserEmail = getCurrentUserEmailFromToken();

    // Get current user ID
    const currentUserResponse = await fetch(`${config.API_BASE_URL}/api/user?email=${currentUserEmail}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    let currentUserIdFromDB = null;
    if (currentUserResponse.ok) {
      const currentUserData = await currentUserResponse.json();
      currentUserIdFromDB = currentUserData.id;
    }

    const response = await fetch(`${config.API_BASE_URL}/api/messages/conversation/${currentUserId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const messages = data.messages || [];

      const chatMessages = document.getElementById('chatMessages');
      chatMessages.innerHTML = '';

      if (messages.length === 0) {
        chatMessages.innerHTML = '<div class="no-messages">Start your conversation here...</div>';
      } else {
        messages.forEach(msg => {
          const messageDiv = document.createElement('div');
          messageDiv.classList.add('message');

          // Determine if message is from current user or other user
          const isCurrentUser = msg.sender_id === currentUserIdFromDB;

          if (isCurrentUser) {
            messageDiv.classList.add('sent');
          } else {
            messageDiv.classList.add('received');
          }

          const messageTime = new Date(msg.sent_at);
          const timeString = messageTime.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
          });
          const dateString = messageTime.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
          });
          
          messageDiv.innerHTML = `
            <div class="message-bubble ${isCurrentUser ? 'sent-bubble' : 'received-bubble'}">
              <div class="message-content">${msg.message}</div>
              <div class="message-time">${dateString} at ${timeString}</div>
            </div>
          `;

          chatMessages.appendChild(messageDiv);
        });

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '<div class="no-messages">Start your conversation here...</div>';
  }

  // Mark messages as read when opening chat
  await markMessagesAsRead();
  
  // Auto-refresh messages every 3 seconds for real-time updates
  setTimeout(loadMessages, 3000);
}

// Function to mark messages as read
async function markMessagesAsRead() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    const response = await fetch(`${config.API_BASE_URL}/api/messages/mark-read/${currentUserId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('Messages marked as read');
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

function getCurrentUserEmailFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.email;
  } catch (e) {
    console.error("Error decoding token:", e);
    return null;
  }
}

function displayMessageFromDB(message, type, timestamp) {
  const messagesContainer = document.getElementById('chatMessages');

  // Remove "no messages" text if it exists
  const noMessages = messagesContainer.querySelector('.no-messages');
  if (noMessages) {
    noMessages.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = message;

  const time = document.createElement('div');
  time.className = 'message-time';

  // Format timestamp
  if (timestamp) {
    const date = new Date(timestamp);
    time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  bubble.appendChild(time);
  messageDiv.appendChild(bubble);
  messagesContainer.appendChild(messageDiv);

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showProfilePhoto(photoUrl, userName) {
  const floating = document.getElementById('floatingProfilePhoto');
  const img = document.getElementById('floatingProfilePic');

  img.src = photoUrl || 'https://via.placeholder.com/400';
  img.alt = userName;
  floating.style.display = 'flex';

  document.getElementById('closeProfileBtn').onclick = () => {
    floating.style.display = 'none';
  };

  floating.onclick = (e) => {
    if (e.target === floating) {
      floating.style.display = 'none';
    }
  };
}