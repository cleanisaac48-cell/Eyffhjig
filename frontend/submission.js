const uploadAgainBtn = document.getElementById("uploadAgainBtn");
const adminMessageContainer = document.getElementById("adminMessageContainer");
const adminMessageText = document.getElementById("adminMessageText");
const reviewMessage = document.getElementById("reviewMessage");
const mainContent = document.getElementById("mainContent");
const spinnerOverlay = document.getElementById("spinnerOverlay");

const token = localStorage.getItem("token");

uploadAgainBtn.addEventListener("click", async () => {
  // No confirmation needed, proceed directly with reset
  uploadAgainBtn.textContent = "🔄 Resetting...";
  uploadAgainBtn.disabled = true;

  try {
    // Always use complete reset for upload again
    const resetRes = await fetch(`${config.API_BASE_URL}/api/user/reset-submission`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (resetRes.ok) {
      // Redirect to identity verification after successful reset
      window.location.href = "identity-verification.html";
    } else {
      // Handle reset failure
      uploadAgainBtn.textContent = "🔄 Upload Again";
      uploadAgainBtn.disabled = false;
      // Consider showing a more specific error message if available from resetRes.json()
      alert("❌ Failed to reset: Please try again.");
    }
  } catch (err) {
    console.error("❌ Reset error:", err);
    // Handle network errors during reset
    uploadAgainBtn.textContent = "🔄 Upload Again";
    uploadAgainBtn.disabled = false;
    alert("❌ Network error during reset. Please try again.");
  }
});

(async () => {
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Show spinner initially
  spinnerOverlay.style.display = "flex";
  mainContent.style.display = "none";

  try {
    const progressRes = await fetch(`${config.API_BASE_URL}/api/user/progress`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const progressData = await progressRes.json();
    const step = progressData.current_step || "identity";
    const status = progressData.status || "pending";

    if (status === "approved" || step === "dashboard") {
      window.location.href = "dashboard_page.html";
      return;
    }

    if (status !== "disapproved" && step !== "submission") {
      if (step === "identity") window.location.href = "identity-verification.html";
      else if (step === "personal") window.location.href = "personal.html";
      else if (step === "preferences") window.location.href = "preferences.html";
      else window.location.href = "identity-verification.html";
      return;
    }

    if (status === "disapproved") {
      const statusRes = await fetch(`${config.API_BASE_URL}/api/user/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.adminMessage) {
          adminMessageText.textContent = statusData.adminMessage;
          adminMessageContainer.style.display = "block";
        }
      }

      reviewMessage.innerHTML = `
        ❌ <strong>Your submission was disapproved by admin.</strong><br>
        Please read the admin message above and use the "Upload Again" button to restart your verification process.
      `;
      uploadAgainBtn.style.display = "inline-block";
      uploadAgainBtn.textContent = "🔄 Upload Again";
    } else {
      reviewMessage.textContent = "🎉 Congratulations! Your registration is complete. Your profile is under review by our admin team. You will receive an email notification once approved. This process typically takes up to 24 hours.";
      uploadAgainBtn.style.display = "none";
    }

    // Hide spinner and show content
    spinnerOverlay.style.display = "none";
    mainContent.style.display = "block";
  } catch (err) {
    console.error("❌ Submission page error:", err.message);
    spinnerOverlay.style.display = "none";
    // Show error message instead of redirecting
    mainContent.style.display = "block";
    reviewMessage.textContent = "❌ Unable to load submission status. Please refresh the page.";
  }
})();