
// profile.js

// Function to get the query string parameter 'id'
function getQueryParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Fetch user data from the backend using the API base URL from config.js
async function fetchUserProfile(id) {
  try {
    // Use the config.js API base URL dynamically
    const apiUrl = `${config.API_BASE_URL}/api/user?id=${id}`;

    // Make the API request to fetch user data
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error('User not found!');
    
    const data = await response.json();
    displayUserProfile(data);
  } catch (error) {
    console.error(error);
    document.getElementById('profile-content').innerHTML = '<p>User not found</p>';
  }
}

// Function to display the user profile data
function displayUserProfile(data) {
  const profileContent = document.getElementById('profile-content');

  // Filter out sensitive information (email, password, ID)
  const { email, password, national_id_number, ...publicData } = data;

  const profileHTML = `
    <div class="profile-info">
      <div class="profile-media">
        <div class="photo">
          ${publicData.profile_photo_url && publicData.profile_photo_url.trim() !== '' ? 
            `<img src="${publicData.profile_photo_url}" alt="Profile Picture" onclick="openFullscreenImage('${publicData.profile_photo_url}')"
                  onerror="console.error('❌ Profile photo failed:', this.src); this.src='https://via.placeholder.com/400?text=No+Photo';"
                  onload="console.log('✅ Profile photo loaded:', this.src);">` : 
            `<img src="https://via.placeholder.com/400?text=No+Photo" alt="No Profile Picture">`}
        </div>
        <div class="video">
          ${publicData.profile_video_url && publicData.profile_video_url.trim() !== '' ? 
            `<video controls onclick="openFullscreenVideo('${publicData.profile_video_url}')"
                    onerror="console.error('❌ Profile video failed:', this.src); this.style.display='none'; this.nextElementSibling.style.display='block';"
                    onloadstart="console.log('🎬 Profile video loading:', this.src);">
              <source src="${publicData.profile_video_url}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
            <p style="display:none; color:red;">Video failed to load</p>` : 
            `<p>No video available</p>`}
        </div>
      </div>
      <div class="details">
        <h2>${publicData.full_name}</h2>
        <p><strong>Gender:</strong> ${publicData.gender}</p>
        <p><strong>Age:</strong> ${getAge(publicData.dob)}</p>
        <p><strong>Country of Birth:</strong> ${publicData.country_of_birth}</p>
        <p><strong>Country of Residence:</strong> ${publicData.country_of_residence}</p>
        <p><strong>Orientation:</strong> ${publicData.orientation}</p>
        <p><strong>Willing to Relocate:</strong> ${publicData.willing_to_relocate}</p>
        <p><strong>Education:</strong> ${publicData.education}</p>
        <p><strong>Occupation:</strong> ${publicData.occupation}</p>
        <p><strong>Employment Type:</strong> ${publicData.employment_type}</p>
        <p><strong>Religion:</strong> ${publicData.religion}</p>
        <p><strong>Religious Importance:</strong> ${publicData.religious_importance}</p>
        <p><strong>Political Views:</strong> ${publicData.political_views}</p>
        <p><strong>Height:</strong> ${publicData.height} cm</p>
        <p><strong>Weight:</strong> ${publicData.weight} kg</p>
        <p><strong>Skin Color:</strong> ${publicData.skin_color}</p>
        <p><strong>Body Type:</strong> ${publicData.body_type}</p>
        <p><strong>Ethnicity:</strong> ${publicData.ethnicity}</p>
        <p><strong>Diet:</strong> ${publicData.diet}</p>
        <p><strong>Smoking:</strong> ${publicData.smoking}</p>
        <p><strong>Drinking:</strong> ${publicData.drinking}</p>
        <p><strong>Exercise:</strong> ${publicData.exercise}</p>
        <p><strong>Pets:</strong> ${publicData.pets}</p>
        <p><strong>Living Situation:</strong> ${publicData.living_situation}</p>
        <p><strong>Children:</strong> ${publicData.children}</p>
        <button>Contact</button>
      </div>
    </div>
  `;
  
  profileContent.innerHTML = profileHTML;
}

// Utility function to calculate age from the date of birth
function getAge(dob) {
  const birthDate = new Date(dob);
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// Fullscreen functions for image and video
function openFullscreenImage(url) {
  const fullscreen = document.createElement('div');
  fullscreen.classList.add('fullscreen');
  fullscreen.innerHTML = `
    <img src="${url}" alt="Fullscreen Image">
    <button class="fullscreen-close" onclick="closeFullscreen()">Close</button>
  `;
  document.body.appendChild(fullscreen);
}

function openFullscreenVideo(url) {
  const fullscreen = document.createElement('div');
  fullscreen.classList.add('fullscreen');
  fullscreen.innerHTML = `
    <video controls autoplay>
      <source src="${url}" type="video/mp4">
      Your browser does not support the video tag.
    </video>
    <button class="fullscreen-close" onclick="closeFullscreen()">Close</button>
  `;
  document.body.appendChild(fullscreen);
}

function closeFullscreen() {
  document.querySelector('.fullscreen').remove();
}

// Fetch and display profile based on ID from URL
const userId = getQueryParameter('id');
if (userId) {
  fetchUserProfile(userId);
} else {
  document.getElementById('profile-content').innerHTML = '<p>Invalid User ID</p>';
}
