
const token = localStorage.getItem("admin_token");

if (!token) {
  alert("Access denied. Please login as admin.");
  window.location.href = "admin-login.html";
}

// Load dashboard data
(async () => {
  try {
    await Promise.all([
      loadUsers(),
      loadNotificationCounts(),
      loadDashboardStats()
    ]);
  } catch (err) {
    console.error("Dashboard error:", err.message);
  }
})();

async function loadUsers() {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });

    const data = await res.json();
    const tableBody = document.getElementById("userTableBody");

    if (res.ok && Array.isArray(data.users)) {
      data.users.forEach(user => {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td>${user.full_name || "—"}</td>
          <td>${user.email}</td>
          <td>
            <span class="status-badge status-${user.status || 'pending'}">
              ${(user.status || 'pending').toUpperCase()}
            </span>
          </td>
          <td>
            <span class="subscription-badge subscription-${user.subscription || 'free'}">
              ${(user.subscription || 'free').toUpperCase()}
            </span>
          </td>
          <td>${new Date(user.created_at).toLocaleDateString()}</td>
          <td>
            <button class="admin-action-btn" onclick="viewUser('${user.id}')">
              View
            </button>
            <button class="admin-action-btn premium-btn" onclick="managePremium('${user.email}', '${user.full_name || 'User'}')">
              Premium
            </button>
          </td>
        `;

        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = `<tr><td colspan="6">No users found.</td></tr>`;
    }
  } catch (err) {
    console.error("Load users error:", err.message);
    document.getElementById("userTableBody").innerHTML = `<tr><td colspan="6">Error loading users.</td></tr>`;
  }
}

async function loadNotificationCounts() {
  try {
    // Load media updates count
    const mediaResponse = await fetch(`${config.API_BASE_URL}/api/admin/media-updates/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (mediaResponse.ok) {
      const mediaStats = await mediaResponse.json();
      const pendingMedia = mediaStats.pending || 0;
      
      if (pendingMedia > 0) {
        const badge = document.getElementById('mediaUpdatesBadge');
        badge.textContent = pendingMedia;
        badge.style.display = 'inline-block';
      }
    }

    // Load premium approvals count
    const premiumResponse = await fetch(`${config.API_BASE_URL}/api/admin/premium-approvals/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (premiumResponse.ok) {
      const premiumStats = await premiumResponse.json();
      const pendingPremium = premiumStats.pending || 0;
      
      if (pendingPremium > 0) {
        const badge = document.getElementById('premiumApprovalsBadge');
        badge.textContent = pendingPremium;
        badge.style.display = 'inline-block';
      }
    }
  } catch (error) {
    console.error('Error loading notification counts:', error);
  }
}

async function loadDashboardStats() {
  try {
    const response = await fetch(`${config.API_BASE_URL}/api/admin/dashboard-stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const stats = await response.json();
      
      document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
      document.getElementById('pendingMedia').textContent = stats.pendingMedia || 0;
      document.getElementById('pendingPremium').textContent = stats.pendingPremium || 0;
      document.getElementById('activePremium').textContent = stats.activePremium || 0;
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

function viewUser(userId) {
  window.location.href = `admin-user-view.html?id=${userId}`;
}

function managePremium(email, name) {
  window.location.href = `admin-premium-manager.html?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
}

function logout() {
  localStorage.removeItem('admin_token');
  window.location.href = 'admin-login.html';
}

// Auto-refresh notifications every 30 seconds
setInterval(loadNotificationCounts, 30000);
