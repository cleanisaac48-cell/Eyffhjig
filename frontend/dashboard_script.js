// JWT decode functionality
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]));
  } catch (e) {
    console.error("Error decoding token:", e);
    return null;
  }
}

// Add event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Add null checks for all event listeners
  const container = document.getElementById('user-container');
  const filterButtons = document.querySelectorAll('.filters button');
  const loadingSpinner = document.getElementById('loadingSpinner');

  const token = localStorage.getItem("token");
  if (!token) {
    if (container) {
      container.innerHTML = "<p>Please log in first!</p>";
    }
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    return;
  }

  const currentUser = getCurrentUserFromToken();
  const currentUserEmail = currentUser ? currentUser.email : null;

  if (!currentUserEmail) {
    if (container) {
      container.innerHTML = "<p>Unable to retrieve user info from token.</p>";
    }
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    return;
  }

  let allProfiles = [];
  let selectedProfiles = [];
  let selectedYouProfiles = [];
  let removedProfiles = [];
  let acceptedProfiles = [];
  let activeSection = "all";

  // Show spinner
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (container) container.style.display = 'none';

  try {
    const response = await fetch(`${config.API_BASE_URL}/api/user/profile-photo/${currentUserEmail}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    let profile_photo_url = null;
    if (response.ok) {
      const data = await response.json();
      profile_photo_url = data.profile_photo_url;
      console.log('✅ Current user profile photo URL:', profile_photo_url);
    } else {
      console.error('❌ Failed to fetch current user profile photo:', response.status);
    }

    const profileIcon = document.querySelector('.profile-icon img');
    if (profileIcon) {
      const profilePhotoUrl = profile_photo_url || null;
      if (profilePhotoUrl && profilePhotoUrl !== 'null' && profilePhotoUrl !== null) {
        profileIcon.src = profilePhotoUrl;
        profileIcon.onerror = () => {
          console.error("❌ Profile icon failed to load:", profilePhotoUrl);
          profileIcon.src = "https://via.placeholder.com/100?text=No+Photo";
        };
      } else {
        console.log("❌ No profile photo for current user.");
        profileIcon.src = "https://via.placeholder.com/100?text=No+Photo";
      }
      profileIcon.onload = function() {
        console.log('✅ Profile icon loaded:', this.src);
      };
    }

    // Show the big profile photo when clicked
    if (profileIcon) {
      profileIcon.addEventListener('click', () => {
        showFloatingProfile(currentUser, 'edit');
      });
    }

    const userResponse = await fetch(`${config.API_BASE_URL}/api/users/${currentUserEmail}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      throw new Error(errorData.message);
    }

    const responseData = await userResponse.json();

    if (responseData.shouldAdjustPreferences) {
      allProfiles = [];
    } else {
      allProfiles = responseData.users || responseData || [];
    }

    // Fetch all user interactions to categorize profiles
    const interactionsResponse = await fetch(`${config.API_BASE_URL}/api/users/interactions/${currentUserEmail}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    let userInteractions = [];
    if (interactionsResponse.ok) {
      userInteractions = await interactionsResponse.json();
    }

    // Categorize profiles based on interactions
    selectedProfiles = userInteractions.filter(u => u.action === 'selected').map(u => ({...u, originalLocation: u.original_location || 'all'}));
    removedProfiles = userInteractions.filter(u => u.action === 'removed').map(u => ({...u, originalLocation: u.original_location || 'all'}));
    acceptedProfiles = userInteractions.filter(u => u.action === 'accepted').map(u => ({...u, originalLocation: u.original_location || 'selected-you'}));

    // Remove already categorized profiles from allProfiles
    const interactedUserIds = userInteractions.map(u => u.id);
    allProfiles = allProfiles.filter(profile => !interactedUserIds.includes(profile.id));

    const selectedYouResponse = await fetch(`${config.API_BASE_URL}/api/users/selected-you/${currentUserEmail}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (selectedYouResponse.ok) {
      let rawSelectedYouProfiles = await selectedYouResponse.json();

      // Remove profiles that are already in accepted section
      const acceptedUserIds = acceptedProfiles.map(u => u.id);
      selectedYouProfiles = rawSelectedYouProfiles
        .filter(profile => !acceptedUserIds.includes(profile.id))
        .map(u => ({...u, originalLocation: 'selected-you'}));
    } else {
      console.error("Error fetching selected-you profiles.");
    }

    // Fetch match scores for all profiles
    const matchScoresResponse = await fetch(`${config.API_BASE_URL}/api/users/match-scores/${currentUserEmail}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    let matchScores = {};
    if (matchScoresResponse.ok) {
      matchScores = await matchScoresResponse.json();
    }

    // Assign match scores to profiles
    allProfiles = allProfiles.map(profile => ({
      ...profile,
      matchScore: matchScores[profile.id] || 0 // Default to 0 if no score
    }));
    selectedProfiles = selectedProfiles.map(profile => ({
      ...profile,
      matchScore: matchScores[profile.id] || 0
    }));
    selectedYouProfiles = selectedYouProfiles.map(profile => ({
      ...profile,
      matchScore: matchScores[profile.id] || 0
    }));
    acceptedProfiles = acceptedProfiles.map(profile => ({
      ...profile,
      matchScore: matchScores[profile.id] || 0
    }));

    // Sort all profile arrays by match score in descending order
    allProfiles.sort((a, b) => b.matchScore - a.matchScore);
    selectedProfiles.sort((a, b) => b.matchScore - a.matchScore);
    selectedYouProfiles.sort((a, b) => b.matchScore - a.matchScore);
    acceptedProfiles.sort((a, b) => b.matchScore - a.matchScore);


    // Hide spinner and show content
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (container) container.style.display = 'block';

    renderProfiles();

  } catch (error) {
    console.error(error);
    if (container) {
      container.innerHTML = `<p>Error: ${error.message}</p>`;
      container.style.display = 'block';
    }
    if (loadingSpinner) loadingSpinner.style.display = 'none';
  }

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeSection = btn.dataset.section;
      renderProfiles();
    });
  });

  function renderProfiles() {
    if (!container) return;
    container.innerHTML = "";

    let profilesToRender = [];
    if (activeSection === "all") profilesToRender = allProfiles;
    if (activeSection === "selected") profilesToRender = selectedProfiles;
    if (activeSection === "selected-you") profilesToRender = selectedYouProfiles;
    if (activeSection === "removed") profilesToRender = removedProfiles;
    if (activeSection === "accepted") profilesToRender = acceptedProfiles;

    if (profilesToRender.length === 0) {
      if (activeSection === "all") {
        container.innerHTML = `
          <div class="no-matches-message">
            <h3>No users found</h3>
            <p>No users found matching your preferences. Try adjusting your gender, location, or age range preferences.</p>
            <button onclick="window.location.href='edit-profile.html'" class="adjust-preferences-btn">
              Adjust Preferences
            </button>
          </div>
        `;
      } else {
        container.innerHTML = "<p>No profiles found.</p>";
      }
      return;
    }

    profilesToRender.forEach(user => {
      const age = user.dob ? new Date().getFullYear() - new Date(user.dob).getFullYear() : 'Unknown';
      const photoUrl = user.profile_photo_url && user.profile_photo_url.trim() !== '' ? user.profile_photo_url : 'https://via.placeholder.com/100?text=No+Photo';
      const videoUrl = user.profile_video_url && user.profile_video_url.trim() !== '' ? user.profile_video_url : null;
      const countryOfBirth = user.country_of_birth || 'Unknown';
      const matchScore = user.matchScore !== undefined && user.matchScore > 0 ? `${user.matchScore}%` : 'N/A';

      const userCard = document.createElement("div");
      userCard.classList.add("profile-card");

      userCard.innerHTML = `
        <div class="profile-info">
          <img src="${photoUrl}" alt="Profile" class="profile-pic" id="profilePic-${user.id}"
               onerror="console.error('❌ Profile pic failed for user ${user.id}:', this.src); this.src='https://via.placeholder.com/100?text=No+Photo';"
               onload="console.log('✅ Profile pic loaded for user ${user.id}:', this.src);">
          <div class="profile-details">
            <h3>${user.full_name || 'Unknown Name'}</h3>
            <p>${age} yrs</p>
            <p>${countryOfBirth}</p>
          </div>
          <span class="score" data-score="${matchScore}">${matchScore}</span>
        </div>
        <div class="profile-video">
          ${videoUrl ? `<video src="${videoUrl}" controls preload="metadata" style="max-width: 100%; height: auto;"
               onerror="console.error('❌ Profile video failed for user ${user.id}:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';"
               oncanplay="console.log('✅ Profile video ready for user ${user.id}');">
               </video>
               <p style="display:none; color:red;">Video failed to load</p>` : "<p>No video available</p>"}
        </div>
        <div class="profile-actions"></div>
      `;

      const actions = userCard.querySelector(".profile-actions");

      if (activeSection === "all") {
        actions.innerHTML = `
          <button class="select-btn">Select</button>
          <button class="remove-btn">Remove</button>
        `;

        const selectButton = actions.querySelector(".select-btn");
        if (selectButton) {
          selectButton.addEventListener("click", async (event) => {
            if (selectButton.disabled) return;
            selectButton.disabled = true;
            selectButton.textContent = 'Processing...';

            try {
              await moveProfile(user, 'all', 'selected', 'selected');
            } finally {
              selectButton.disabled = false;
              selectButton.textContent = 'Select';
            }
          });
        }

        const removeButton = actions.querySelector(".remove-btn");
        if (removeButton) {
          removeButton.addEventListener("click", async () => {
            await moveProfile(user, 'all', 'removed', 'removed');
          });
        }

      } else if (activeSection === "selected") {
        actions.innerHTML = `
          <button class="select-btn">Cancel Selection</button>
          <button class="remove-btn">Remove</button>
        `;

        const cancelButton = actions.querySelector(".select-btn");
        if (cancelButton) {
          cancelButton.addEventListener("click", async () => {
            await moveProfile(user, 'selected', user.originalLocation || 'all', null);
          });
        }

        const removeButton = actions.querySelector(".remove-btn");
        if (removeButton) {
          removeButton.addEventListener("click", async () => {
            await moveProfile(user, 'selected', 'removed', 'removed');
          });
        }

      } else if (activeSection === "selected-you") {
        actions.innerHTML = `
          <button class="select-btn">Accept</button>
          <button class="remove-btn">Reject</button>
        `;

        const acceptButton = actions.querySelector(".select-btn");
        if (acceptButton) {
          acceptButton.addEventListener("click", async (event) => {
            if (acceptButton.disabled) return;
            acceptButton.disabled = true;
            acceptButton.textContent = 'Processing...';

            try {
              await createMutualMatch(user, 'selected-you', 'accepted', 'accepted');
            } finally {
              acceptButton.disabled = false;
              acceptButton.textContent = 'Accept';
            }
          });
        }

        const rejectButton = actions.querySelector(".remove-btn");
        if (rejectButton) {
          rejectButton.addEventListener("click", async () => {
            await moveProfile(user, 'selected-you', 'removed', 'removed');
          });
        }

      } else if (activeSection === "accepted") {
        actions.innerHTML = `
          <button class="match-btn">Matched</button>
          <button class="remove-btn">Cancel Match</button>
        `;

        const matchedButton = actions.querySelector(".match-btn");
        if (matchedButton) {
          matchedButton.addEventListener("click", async (event) => {
            if (matchedButton.disabled) return;
            matchedButton.disabled = true;
            matchedButton.textContent = 'Loading...';

            try {
              const subscription = await checkUserSubscription();
              if (subscription === 'free') {
                showPremiumNotification();
              } else {
                window.location.href = `chat.html?user=${user.id}&name=${encodeURIComponent(user.full_name)}`;
              }
            } finally {
              matchedButton.disabled = false;
              matchedButton.textContent = 'Matched';
            }
          });
        }

        const cancelMatchButton = actions.querySelector(".remove-btn");
        if (cancelMatchButton) {
          cancelMatchButton.addEventListener("click", async () => {
            await moveProfile(user, 'accepted', 'removed', 'removed');
          });
        }

      } else if (activeSection === "removed") {
        actions.innerHTML = `
          <button class="restore-btn">Restore</button>
        `;

        const restoreButton = actions.querySelector(".restore-btn");
        if (restoreButton) {
          restoreButton.addEventListener("click", async () => {
            await moveProfile(user, 'removed', user.originalLocation || 'all', null);
          });
        }
      }

      const profilePic = userCard.querySelector(`#profilePic-${user.id}`);
      if (profilePic) {
        profilePic.addEventListener('click', () => {
          showFloatingProfile(user);
        });
      }

      container.appendChild(userCard);
    });
  }

  async function createMutualMatch(user, fromSection, toSection, action) {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/users/mutual-match`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetUserId: user.id,
          action: action,
          originalLocation: user.originalLocation || fromSection
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create mutual match');
      }

      // Update frontend arrays - remove from selected-you, add to accepted
      selectedYouProfiles = selectedYouProfiles.filter(u => u.id !== user.id);
      acceptedProfiles.push({ ...user, originalLocation: user.originalLocation || fromSection });

      renderProfiles();

    } catch (error) {
      console.log('Error creating mutual match:', error);
    }
  }

  async function moveProfile(user, fromSection, toSection, action) {
    try {
      // Update backend
      if (action) {
        const response = await fetch(`${config.API_BASE_URL}/api/users/interact`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            targetUserId: user.id,
            action: action,
            originalLocation: user.originalLocation || fromSection
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update interaction');
        }
      }

      // Update frontend arrays
      if (fromSection === 'all') allProfiles = allProfiles.filter(u => u.id !== user.id);
      if (fromSection === 'selected') selectedProfiles = selectedProfiles.filter(u => u.id !== user.id);
      if (fromSection === 'selected-you') selectedYouProfiles = selectedYouProfiles.filter(u => u.id !== user.id);
      if (fromSection === 'accepted') acceptedProfiles = acceptedProfiles.filter(u => u.id !== user.id);
      if (fromSection === 'removed') removedProfiles = removedProfiles.filter(u => u.id !== user.id);

      const userToMove = { ...user, originalLocation: user.originalLocation || fromSection };

      if (toSection === 'all') allProfiles.push(userToMove);
      if (toSection === 'selected') selectedProfiles.push(userToMove);
      if (toSection === 'selected-you') selectedYouProfiles.push(userToMove);
      if (toSection === 'accepted') acceptedProfiles.push(userToMove);
      if (toSection === 'removed') removedProfiles.push(userToMove);

      renderProfiles();

    } catch (error) {
      console.log('Error moving profile:', error);
    }
  }

  function showFloatingProfile(user, action = 'view') {
    const floatingProfilePhoto = document.getElementById('floatingProfilePhoto');
    const floatingProfilePic = document.getElementById('floatingProfilePic');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const closeProfileBtn = document.getElementById('closeProfileBtn');

    if (!floatingProfilePhoto || !floatingProfilePic || !viewProfileBtn || !closeProfileBtn) {
      console.error("Floating profile elements not found.");
      return;
    }

    floatingProfilePic.src = user.profile_photo_url || 'https://via.placeholder.com/100';
    floatingProfilePic.onerror = function() {
      this.src = 'https://via.placeholder.com/100';
    };
    floatingProfilePhoto.style.display = 'block';
    document.body.style.overflow = 'hidden';

    if (closeProfileBtn) {
      closeProfileBtn.onclick = () => {
        floatingProfilePhoto.style.display = 'none';
        document.body.style.overflow = '';
      };
    }

    const floatingProfileContent = floatingProfilePhoto.querySelector('.floating-profile-content');
    if (floatingProfileContent) {
      floatingProfileContent.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    }

    if (action === 'edit') {
      viewProfileBtn.textContent = 'Edit Profile';
      viewProfileBtn.onclick = () => {
        floatingProfilePhoto.style.display = 'none';
        document.body.style.overflow = '';
        window.location.href = "edit-profile.html";
      };
    } else {
      viewProfileBtn.textContent = 'View Profile';
      viewProfileBtn.onclick = () => {
        floatingProfilePhoto.style.display = 'none';
        document.body.style.overflow = '';
        window.location.href = `profile.html?id=${user.id}`;
      };
    }
  }

  function getCurrentUserFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return decodeJWT(token);
  }

  async function checkUserSubscription() {
    try {
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

  function showPremiumNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      z-index: 10000;
      text-align: center;
      max-width: 400px;
      width: 90%;
    `;

    notification.innerHTML = `
      <h3 style="color: #ff6b35; margin-bottom: 15px;">🚀 Premium Feature</h3>
      <p style="margin-bottom: 20px;">You need to upgrade to Premium to access this feature!</p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button onclick="window.location.href='subscriptions.html'" style="background: #007BFF; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
          Upgrade to Premium
        </button>
        <button onclick="this.parentElement.parentElement.remove()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
          Cancel
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

    // Charts access check function
    window.checkChartsAccess = async function(event) {
      event.preventDefault();
      const token = localStorage.getItem("token");

      try {
        const response = await fetch(`${config.API_BASE_URL}/api/user/subscription-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          const subscription = data.subscription || 'free';

          if (subscription === 'free') {
            showPremiumNotification();
            return;
          }
        }

        window.location.href = 'charts.html';
      } catch (error) {
        console.error('Error checking subscription:', error);
        window.location.href = 'charts.html';
      }
    };

    const mainContent = document.querySelector('.main-content');
    const sidebar = document.querySelector('.sidebar');

    if (mainContent && sidebar) {
      window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
          mainContent.style.marginLeft = sidebar.classList.contains('sidebar-visible') ? '25vw' : '0';
        } else {
          mainContent.style.marginLeft = sidebar.classList.contains('sidebar-visible') ? '220px' : '0';
        }
      });
    }
});