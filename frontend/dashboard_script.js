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

function getCurrentUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return decodeJWT(token);
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('user-container');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const token = localStorage.getItem("token");

  if (!token) {
    if (container) container.innerHTML = "<p>Please log in first!</p>";
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    return;
  }

  const currentUser = getCurrentUserFromToken();
  const currentUserEmail = currentUser ? currentUser.email : null;
  const userRole = currentUser ? (currentUser.role || localStorage.getItem("userRole") || 'seeker') : 'seeker';

  if (!currentUserEmail) {
    if (container) container.innerHTML = "<p>Unable to retrieve user info.</p>";
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    return;
  }

  // Show role badge
  const roleBadge = document.getElementById('sidebarRoleBadge');
  if (roleBadge) roleBadge.textContent = userRole === 'employer' ? 'Employer' : 'Job Seeker';

  // Show correct filter tabs
  const seekerFilters = document.getElementById('seekerFilters');
  const employerFilters = document.getElementById('employerFilters');
  if (userRole === 'employer') {
    if (seekerFilters) seekerFilters.style.display = 'none';
    if (employerFilters) employerFilters.style.display = 'flex';
  }

  let matchProfiles = [];
  let appliedProfiles = [];
  let shortlistedProfiles = [];
  let applicationProfiles = [];
  let shortlistedByMeProfiles = [];
  let chatEnabledProfiles = [];

  let activeSection = userRole === 'employer' ? 'applications' : 'matches';

  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (container) container.style.display = 'none';

  try {
    // Fetch current user profile photo
    const photoRes = await fetch(`${config.API_BASE_URL}/api/user/profile-photo/${currentUserEmail}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (photoRes.ok) {
      const photoData = await photoRes.json();
      const profileIcon = document.querySelector('.profile-icon img');
      if (profileIcon && photoData.profile_photo_url) {
        profileIcon.src = photoData.profile_photo_url;
        profileIcon.onerror = () => { profileIcon.src = 'https://via.placeholder.com/100?text=No+Photo'; };
      }
    }

    const profileIcon = document.querySelector('.profile-icon img');
    if (profileIcon) {
      profileIcon.addEventListener('click', () => showFloatingProfile(currentUser, 'edit'));
    }

    // Fetch matching profiles based on role
    const matchRes = await fetch(`${config.API_BASE_URL}/api/users/${currentUserEmail}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (matchRes.ok) {
      const matchData = await matchRes.json();
      if (userRole === 'seeker') {
        matchProfiles = matchData.users || matchData || [];
      } else {
        applicationProfiles = matchData.users || matchData || [];
      }
    }

    // Fetch interactions
    const interactRes = await fetch(`${config.API_BASE_URL}/api/users/interactions/${currentUserEmail}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    let myInteractions = [];
    if (interactRes.ok) {
      myInteractions = await interactRes.json();
    }

    if (userRole === 'seeker') {
      // Applied = seeker's "selected" actions (applied to companies)
      appliedProfiles = myInteractions.filter(u => u.action === 'applied' || u.action === 'selected');

      // Shortlisted = companies who shortlisted this seeker (via selected-you equivalent)
      const shortlistRes = await fetch(`${config.API_BASE_URL}/api/users/shortlisted-me/${currentUserEmail}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (shortlistRes.ok) {
        shortlistedProfiles = await shortlistRes.json();
      }

      // Filter out applied profiles from match list
      const appliedIds = appliedProfiles.map(u => u.id);
      matchProfiles = matchProfiles.filter(p => !appliedIds.includes(p.id));

    } else {
      // Employer: shortlisted by me
      shortlistedByMeProfiles = myInteractions.filter(u => u.action === 'shortlisted' || u.action === 'selected');
      // Chat enabled
      chatEnabledProfiles = myInteractions.filter(u => u.action === 'chat_enabled' || u.action === 'accepted');

      // Filter applied from application list
      const processedIds = [...shortlistedByMeProfiles, ...chatEnabledProfiles].map(u => u.id);
      applicationProfiles = applicationProfiles.filter(p => !processedIds.includes(p.id));
    }

  } catch (error) {
    console.error('Dashboard load error:', error);
    if (container) {
      container.innerHTML = `<p>Error loading dashboard: ${error.message}</p>`;
      container.style.display = 'block';
    }
  }

  if (loadingSpinner) loadingSpinner.style.display = 'none';
  if (container) container.style.display = 'block';

  // Set up filter buttons
  const filterBtns = document.querySelectorAll('.filters button');
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeSection = btn.dataset.section;
      renderProfiles();
    });
  });

  renderProfiles();

  function renderProfiles() {
    if (!container) return;
    container.innerHTML = "";

    let profiles = [];
    if (userRole === 'seeker') {
      if (activeSection === 'matches') profiles = matchProfiles;
      else if (activeSection === 'applied') profiles = appliedProfiles;
      else if (activeSection === 'shortlisted') profiles = shortlistedProfiles;
    } else {
      if (activeSection === 'applications') profiles = applicationProfiles;
      else if (activeSection === 'shortlisted_by_me') profiles = shortlistedByMeProfiles;
      else if (activeSection === 'chat_enabled') profiles = chatEnabledProfiles;
    }

    if (profiles.length === 0) {
      const emptyMsg = getEmptyMessage(activeSection, userRole);
      container.innerHTML = `<div class="no-matches-message"><h3>${emptyMsg.title}</h3><p>${emptyMsg.body}</p></div>`;
      return;
    }

    profiles.forEach(profile => {
      const card = createProfileCard(profile, activeSection, userRole);
      container.appendChild(card);
    });
  }

  function getEmptyMessage(section, role) {
    const msgs = {
      matches: { title: 'No Matching Companies', body: 'No companies match your preferences yet. Update your preferences to find more opportunities.' },
      applied: { title: 'No Applications', body: "You haven't applied to any companies yet. Browse matches and apply!" },
      shortlisted: { title: 'Not Shortlisted Yet', body: 'No companies have shortlisted you yet. Keep your profile strong!' },
      applications: { title: 'No Applications', body: 'No job seekers have applied yet. Ensure your job post preferences match candidates.' },
      shortlisted_by_me: { title: 'No Shortlisted Candidates', body: 'You have not shortlisted any candidates yet. Browse applications.' },
      chat_enabled: { title: 'No Chat Connections', body: 'Shortlist candidates and activate chat to connect with them.' }
    };
    return msgs[section] || { title: 'Nothing Here', body: '' };
  }

  function createProfileCard(user, section, role) {
    const photoUrl = user.profile_photo_url && user.profile_photo_url !== 'null'
      ? user.profile_photo_url
      : 'https://via.placeholder.com/100?text=No+Photo';

    // Determine display fields based on role
    let displayName, displaySub1, displaySub2;
    const otherRole = user.orientation === 'employer' ? 'employer' : 'seeker';

    if (otherRole === 'employer') {
      displayName = user.full_name || 'Unknown Company';
      displaySub1 = user.occupation || 'Unknown Industry';
      displaySub2 = user.employment_type || '';
    } else {
      displayName = user.full_name || 'Unknown Candidate';
      displaySub1 = user.occupation || 'No Major';
      displaySub2 = user.employment_type || '';
    }

    // Parse video intros from liveness_video_url
    let videoIntros = [];
    try {
      if (user.liveness_video_url && user.liveness_video_url.startsWith('[')) {
        videoIntros = JSON.parse(user.liveness_video_url);
      }
    } catch(e) {}

    // Parse docs from id_back_url
    let docVault = [];
    try {
      if (user.id_back_url && user.id_back_url.startsWith('[')) {
        docVault = JSON.parse(user.id_back_url);
      }
    } catch(e) {}

    const card = document.createElement("div");
    card.classList.add("profile-card");

    let actionsHtml = '';
    if (role === 'seeker') {
      if (section === 'matches') {
        actionsHtml = `<button class="select-btn apply-action" data-id="${user.id}">Apply</button>`;
      } else if (section === 'applied') {
        actionsHtml = `<span style="color:#00b894;font-weight:600;">Applied</span>`;
      } else if (section === 'shortlisted') {
        const chatAllowed = user.action === 'chat_enabled';
        actionsHtml = chatAllowed
          ? `<button class="match-btn chat-action" data-id="${user.id}" data-name="${encodeURIComponent(displayName)}">Chat</button>`
          : `<span style="color:#888;">Shortlisted – awaiting chat</span>`;
      }
    } else {
      // Employer
      if (section === 'applications') {
        actionsHtml = `
          <button class="select-btn shortlist-action" data-id="${user.id}">Shortlist</button>
          <button class="remove-btn ignore-action" data-id="${user.id}">Ignore</button>`;
      } else if (section === 'shortlisted_by_me') {
        actionsHtml = `
          <button class="match-btn activate-chat-action" data-id="${user.id}" data-name="${encodeURIComponent(displayName)}">Activate Chat</button>
          <button class="remove-btn unshortlist-action" data-id="${user.id}">Remove</button>`;
      } else if (section === 'chat_enabled') {
        actionsHtml = `<button class="match-btn chat-action" data-id="${user.id}" data-name="${encodeURIComponent(displayName)}">Open Chat</button>`;
      }
    }

    // Build videos section
    let videosHtml = '';
    if (videoIntros.length > 0) {
      videosHtml = videoIntros.map(v => `
        <div style="margin-bottom:8px;">
          <p style="font-size:0.8rem;color:#555;margin-bottom:4px;">${v.name || 'Video'}</p>
          <video src="${v.url}" controls preload="metadata" style="max-width:100%;height:auto;border-radius:6px;"></video>
        </div>`).join('');
    } else if (user.profile_video_url) {
      videosHtml = `<video src="${user.profile_video_url}" controls preload="metadata" style="max-width:100%;height:auto;border-radius:6px;"></video>`;
    } else {
      videosHtml = '<p style="color:#888;font-size:0.9rem;">No videos uploaded</p>';
    }

    // Build docs section
    let docsHtml = '';
    if (docVault.length > 0 && (role === 'employer' || section === 'shortlisted')) {
      docsHtml = `<div style="margin-top:10px;"><p style="font-weight:600;font-size:0.9rem;">Documents:</p>` +
        docVault.map(d => `<a href="${d.url}" target="_blank" style="display:block;color:#0984e3;font-size:0.85rem;margin-bottom:4px;">📄 ${d.name || 'Document'}</a>`).join('') +
        `</div>`;
    }

    card.innerHTML = `
      <div class="profile-info">
        <img src="${photoUrl}" alt="Profile" class="profile-pic profile-pic-click" data-id="${user.id}"
             onerror="this.src='https://via.placeholder.com/100?text=No+Photo';">
        <div class="profile-details">
          <h3>${displayName}</h3>
          <p>${displaySub1}</p>
          ${displaySub2 ? `<p>${displaySub2}</p>` : ''}
        </div>
      </div>
      <div class="profile-video">${videosHtml}</div>
      ${docsHtml}
      <div class="profile-actions">${actionsHtml}</div>
    `;

    // Wire up action buttons
    const applyBtn = card.querySelector('.apply-action');
    if (applyBtn) {
      applyBtn.addEventListener('click', async () => {
        applyBtn.disabled = true; applyBtn.textContent = 'Applying...';
        await interactWithProfile(user.id, 'applied');
        matchProfiles = matchProfiles.filter(u => u.id !== user.id);
        appliedProfiles.push({ ...user, action: 'applied' });
        renderProfiles();
      });
    }

    const shortlistBtn = card.querySelector('.shortlist-action');
    if (shortlistBtn) {
      shortlistBtn.addEventListener('click', async () => {
        shortlistBtn.disabled = true; shortlistBtn.textContent = 'Shortlisting...';
        await interactWithProfile(user.id, 'shortlisted');
        applicationProfiles = applicationProfiles.filter(u => u.id !== user.id);
        shortlistedByMeProfiles.push({ ...user, action: 'shortlisted' });
        renderProfiles();
      });
    }

    const ignoreBtn = card.querySelector('.ignore-action');
    if (ignoreBtn) {
      ignoreBtn.addEventListener('click', async () => {
        await interactWithProfile(user.id, 'removed');
        applicationProfiles = applicationProfiles.filter(u => u.id !== user.id);
        renderProfiles();
      });
    }

    const activateChatBtn = card.querySelector('.activate-chat-action');
    if (activateChatBtn) {
      activateChatBtn.addEventListener('click', async () => {
        activateChatBtn.disabled = true; activateChatBtn.textContent = 'Activating...';
        await interactWithProfile(user.id, 'chat_enabled');
        shortlistedByMeProfiles = shortlistedByMeProfiles.filter(u => u.id !== user.id);
        chatEnabledProfiles.push({ ...user, action: 'chat_enabled' });
        renderProfiles();
      });
    }

    const unshortlistBtn = card.querySelector('.unshortlist-action');
    if (unshortlistBtn) {
      unshortlistBtn.addEventListener('click', async () => {
        await interactWithProfile(user.id, 'removed');
        shortlistedByMeProfiles = shortlistedByMeProfiles.filter(u => u.id !== user.id);
        renderProfiles();
      });
    }

    const chatBtns = card.querySelectorAll('.chat-action');
    chatBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const sub = await checkUserSubscription();
        if (sub === 'free') {
          showPremiumNotification();
        } else {
          window.location.href = `chat.html?user=${btn.dataset.id}&name=${btn.dataset.name}`;
        }
      });
    });

    const profilePicClick = card.querySelector('.profile-pic-click');
    if (profilePicClick) {
      profilePicClick.addEventListener('click', () => showFloatingProfile(user));
    }

    return card;
  }

  async function interactWithProfile(targetUserId, action) {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/users/interact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetUserId, action, originalLocation: activeSection })
      });
      if (!res.ok) throw new Error('Interaction failed');
    } catch (e) {
      console.error('Interact error:', e);
    }
  }

  function showFloatingProfile(user, action = 'view') {
    const floatingEl = document.getElementById('floatingProfilePhoto');
    const floatingPic = document.getElementById('floatingProfilePic');
    const viewBtn = document.getElementById('viewProfileBtn');
    const closeBtn = document.getElementById('closeProfileBtn');

    if (!floatingEl || !floatingPic || !viewBtn || !closeBtn) return;

    floatingPic.src = user.profile_photo_url || 'https://via.placeholder.com/100';
    floatingPic.onerror = () => { floatingPic.src = 'https://via.placeholder.com/100'; };
    floatingEl.style.display = 'block';
    document.body.style.overflow = 'hidden';

    closeBtn.onclick = () => {
      floatingEl.style.display = 'none';
      document.body.style.overflow = '';
    };

    if (action === 'edit') {
      viewBtn.textContent = 'Edit Profile';
      viewBtn.onclick = () => {
        floatingEl.style.display = 'none';
        document.body.style.overflow = '';
        window.location.href = "edit-profile.html";
      };
    } else {
      viewBtn.textContent = 'View Profile';
      viewBtn.onclick = () => {
        floatingEl.style.display = 'none';
        document.body.style.overflow = '';
        window.location.href = `profile.html?id=${user.id}`;
      };
    }
  }

  async function checkUserSubscription() {
    try {
      const res = await fetch(`${config.API_BASE_URL}/api/user/subscription-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.subscription || 'free';
      }
    } catch(e) { console.error('Subscription check error:', e); }
    return 'free';
  }

  function showPremiumNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:white;padding:30px;border-radius:15px;
      box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:10000;
      text-align:center;max-width:400px;width:90%;
    `;
    notification.innerHTML = `
      <h3 style="color:#ff6b35;margin-bottom:15px;">Premium Feature</h3>
      <p style="margin-bottom:20px;">Upgrade to Premium to access chat!</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="window.location.href='subscriptions.html'" style="background:#007BFF;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;">Upgrade</button>
        <button onclick="this.parentElement.parentElement.remove()" style="background:#6c757d;color:white;padding:10px 20px;border:none;border-radius:5px;cursor:pointer;">Cancel</button>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => { if (notification.parentElement) notification.remove(); }, 10000);
  }

  window.checkChartsAccess = async function(event) {
    event.preventDefault();
    const sub = await checkUserSubscription();
    if (sub === 'free') { showPremiumNotification(); return; }
    window.location.href = 'charts.html';
  };
});
