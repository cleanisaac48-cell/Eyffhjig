
const token = localStorage.getItem("admin_token");
const userId = new URLSearchParams(window.location.search).get("id");

const userInfoContainer = document.getElementById("userInfo");
const adminMessageInput = document.getElementById("adminMessage");
const approveBtn = document.getElementById("approveBtn");
const disapproveBtn = document.getElementById("disapproveBtn");
const statusText = document.getElementById("updateStatusText");

if (!token) {
  alert("Access denied. Please login.");
  window.location.href = "admin-login.html";
}

async function loadUser() {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        alert("Session expired. Please login again.");
        window.location.href = "admin-login.html";
        return;
      }
      userInfoContainer.innerHTML = `❌ Error: ${res.status} - ${res.statusText}`;
      return;
    }

    const data = await res.json();

    if (!data.success || !data.user) {
      userInfoContainer.innerHTML = `❌ ${data.message || "User not found"}`;
      return;
    }

    const user = data.user;

    userInfoContainer.innerHTML = `
      <h3>${user.full_name || "Unnamed User"}</h3>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Status:</strong> ${user.status || "pending"}</p>
      <p><strong>User ID:</strong> ${user.id}</p>
      <p><strong>National ID Number:</strong> ${user.national_id_number || "—"}</p>

      <h4>ID Front</h4>
      ${user.id_front_url ? `
        <img src="${user.id_front_url}" alt="ID Front" style="max-width: 400px; height: auto;" 
             onerror="console.error('ID Front failed to load:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';" 
             onload="console.log('ID Front loaded successfully');" />
        <p style="display:none; color:red;">Image failed to load</p>` : '<p>No ID front image</p>'}

      <h4>ID Back</h4>
      ${user.id_back_url ? `
        <img src="${user.id_back_url}" alt="ID Back" style="max-width: 400px; height: auto;" 
             onerror="console.error('ID Back failed to load:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';" 
             onload="console.log('ID Back loaded successfully');" />
        <p style="display:none; color:red;">Image failed to load</p>` : '<p>No ID back image</p>'}

      <h4>Liveness Video</h4>
      <p><strong>Instructions followed by user during recording:</strong> ${user.liveness_instructions ? (Array.isArray(user.liveness_instructions) ? user.liveness_instructions.join(', ') : user.liveness_instructions) : 'Look up, Look left, Look right, Smile, Open your mouth'}</p>
      ${user.liveness_video_url ? `
        <video src="${user.liveness_video_url}" controls style="max-width: 400px; height: auto;" 
               onerror="console.error('Liveness video failed to load:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';" 
               onloadstart="console.log('Liveness video loading');" 
               oncanplay="console.log('Liveness video can play');"></video>
        <p style="display:none; color:red;">Video failed to load</p>` : '<p>No liveness video</p>'}

      <h4>Profile Photo</h4>
      ${user.profile_photo_url && user.profile_photo_url.trim() !== '' ? `
        <img src="${user.profile_photo_url}" alt="Profile Photo" style="max-width: 400px; height: auto;" 
             onerror="console.error('❌ Profile photo failed to load for user ${user.id}:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';" 
             onload="console.log('✅ Profile photo loaded for user ${user.id}:', this.src);" />
        <p style="display:none; color:red;">Image failed to load</p>
        <p><strong>Profile Photo URL:</strong> ${user.profile_photo_url}</p>` : '<p>No profile photo uploaded</p>'}
    `;
  } catch (err) {
    userInfoContainer.innerHTML = "⚠️ Error loading user.";
    console.error(err);
  }
}

async function updateStatus(newStatus) {
  try {
    const message = adminMessageInput.value.trim();
    if (!message) {
      alert("❌ Please enter a message to send to the user.");
      return;
    }

    const res = await fetch(`${config.API_BASE_URL}/api/admin/user/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        userId: userId,
        status: newStatus,
        adminMessage: message
      })
    });

    const data = await res.json();

    if (res.ok) {
      if (newStatus === "approved") {
        statusText.innerHTML = `✅ User approved! User will be redirected to dashboard on next login. Email sent with login link.`;
        statusText.style.color = "#2ecc71";
      } else {
        statusText.innerHTML = `❌ User disapproved! User will see submission page with "Upload Again" button on next login. Email sent with instructions.`;
        statusText.style.color = "#e74c3c";
      }
      
      // Disable buttons after action
      approveBtn.disabled = true;
      disapproveBtn.disabled = true;
      adminMessageInput.disabled = true;
    } else {
      statusText.textContent = `❌ Error: ${data.message}`;
      statusText.style.color = "#e74c3c";
    }
  } catch (err) {
    statusText.textContent = "❌ Server error";
    statusText.style.color = "#e74c3c";
    console.error(err);
  }
}

async function triggerReset(endpoint) {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/user/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Reset failed with status ${res.status}:`, errorText);
      alert(`❌ Reset failed: ${res.status} - ${res.statusText}`);
      return;
    }

    const data = await res.json();
    if (!data.success) {
      alert("❌ Reset failed: " + (data.message || "Unknown error"));
    } else {
      console.log(`✅ ${endpoint} triggered successfully`);
      alert(`✅ ${endpoint} completed successfully`);
    }
  } catch (err) {
    console.error(`❌ Error triggering ${endpoint}:`, err);
    alert(`❌ Error: ${err.message}`);
  }
}

approveBtn.addEventListener("click", () => updateStatus("approved"));

disapproveBtn.addEventListener("click", () => updateStatus("disapproved"));

loadUser();
