
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp && payload.exp < now;
  } catch (e) {
    console.error("Token check failed:", e);
    return true;
  }
}

// Check authentication and redirect if necessary
(async () => {
  const token = localStorage.getItem("token");
  const spinnerOverlay = document.getElementById("spinnerOverlay");

  if (!token || isTokenExpired(token)) {
    localStorage.removeItem("token");
    return (window.location.href = "login.html");
  }

  try {
    if (spinnerOverlay) {
      spinnerOverlay.style.display = "flex";
    }

    const res = await fetch(`${config.API_BASE_URL}/api/user/progress`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Progress check failed');
    }

    const step = data.current_step || "identity";
    const status = data.status || "pending";

    if (status === "approved") return (window.location.href = "dashboard_page.html");
    if (status === "disapproved") return (window.location.href = "submission.html");

    if (step !== "personal") {
      const map = {
        identity: "identity-verification.html",
        preferences: "preferences.html",
        submission: "submission.html"
      };
      return (window.location.href = map[step] || "personal.html");
    }

    if (spinnerOverlay) {
      spinnerOverlay.style.display = "none";
    }
  } catch (err) {
    console.error("Progress check failed:", err.message);
    if (spinnerOverlay) {
      spinnerOverlay.style.display = "none";
    }
    // Don't redirect to login on API errors, just show the form
    console.log("Continuing with personal form despite progress check error");
  }
})();

// Handle form submission
document.addEventListener('DOMContentLoaded', function() {
  const personalForm = document.getElementById("personalForm");
  
  if (personalForm) {
    personalForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      
      const token = localStorage.getItem("token");
      if (!token || isTokenExpired(token)) {
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
        return;
      }

      const submitBtn = document.querySelector('button[type="submit"]');
      const spinner = document.getElementById("spinner");
      
      if (submitBtn) {
        submitBtn.disabled = true;
      }
      if (spinner) {
        spinner.style.display = "inline-block";
      }

  try {
    const formData = new FormData();
    
    // Add all form fields to FormData
    const formElements = e.target.elements;
    for (let element of formElements) {
      if (element.name) {
        if (element.type === 'file') {
          if (element.files.length > 0) {
            const file = element.files[0];
            
            if (element.name === 'video') {
              // Validate video file size and duration before submission
              const maxSize = 100 * 1024 * 1024; // 100MB
              if (file.size > maxSize) {
                alert(`Video file is too large! Maximum size allowed is 100MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
                return;
              }
              formData.append('profileVideo', file);
            } else if (element.name === 'photo') {
              formData.append('profilePhoto', file);
            }
          }
        } else if (element.type === 'checkbox') {
          if (element.checked) {
            formData.append(element.name, element.value);
          }
        } else if (element.type !== 'submit') {
          formData.append(element.name, element.value);
        }
      }
    }

    // Handle languages specially
    const languageCheckboxes = document.querySelectorAll('input[name="languages[]"]:checked');
    languageCheckboxes.forEach(checkbox => {
      formData.append('languages[]', checkbox.value);
    });

    console.log("Submitting personal information...");

    const response = await fetch(`${config.API_BASE_URL}/api/user/personal`, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log("✅ Personal information saved successfully");
      alert("Personal information saved successfully!");
      window.location.href = "preferences.html";
    } else {
      console.error("❌ Save failed:", result.message);
      alert(`Error: ${result.message || "Failed to save personal information"}`);
    }

  } catch (error) {
      console.error("❌ Submit error:", error);
      alert("An error occurred while saving personal information. Please try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
      if (spinner) {
        spinner.style.display = "none";
      }
    }
    });
  }
});

// Handle file preview functionality
document.addEventListener('DOMContentLoaded', function() {
  const photoInput = document.querySelector('input[name="photo"]');
  const videoInput = document.querySelector('input[name="video"]');
  
  if (photoInput) {
    photoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          let preview = document.getElementById('photoPreview');
          if (!preview) {
            preview = document.createElement('img');
            preview.id = 'photoPreview';
            preview.style.maxWidth = '200px';
            preview.style.maxHeight = '200px';
            preview.style.marginTop = '10px';
            if (e.target.parentNode) {
              e.target.parentNode.appendChild(preview);
            }
          }
          preview.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (videoInput) {
    videoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Check file size (100MB = 100 * 1024 * 1024 bytes)
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
          alert(`Video file is too large! Maximum size allowed is 100MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
          e.target.value = ''; // Clear the input
          return;
        }

        let preview = document.getElementById('videoPreview');
        if (!preview) {
          preview = document.createElement('video');
          preview.id = 'videoPreview';
          preview.controls = true;
          preview.style.maxWidth = '300px';
          preview.style.maxHeight = '200px';
          preview.style.marginTop = '10px';
          if (e.target.parentNode) {
            e.target.parentNode.appendChild(preview);
          }
        }
        
        const videoUrl = URL.createObjectURL(file);
        preview.src = videoUrl;
        
        // Check video duration when metadata loads
        preview.addEventListener('loadedmetadata', function() {
          const duration = preview.duration;
          if (duration > 30) {
            alert(`Video is too long! Maximum duration allowed is 30 seconds. Your video is ${duration.toFixed(1)} seconds.`);
            e.target.value = ''; // Clear the input
            preview.src = '';
            return;
          }
        });
      }
    });
  }
});
