
function getRoleFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || 'seeker';
  } catch(e) { return 'seeker'; }
}

const subMajors = {
  "Engineering & Tech": ["Civil & Structural", "Software & Data", "Electrical", "Mechanical"],
  "Business & Admin": ["Finance & Accounting", "Marketing", "HR", "Operations"],
  "Health & Sciences": ["Clinical", "Laboratory", "Public Health", "Admin"],
  "Arts & Design": ["Graphic Design", "UI/UX", "Photography", "Fine Arts"],
  "Humanities/Social": ["Education", "Psychology", "Sociology", "Political Science"]
};

function populateSubMajors(selectId, major) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Any Sub-Major</option>';
  if (subMajors[major]) {
    subMajors[major].forEach(sm => {
      const opt = document.createElement('option');
      opt.value = sm;
      opt.textContent = sm;
      sel.appendChild(opt);
    });
  }
}

let currentRecency = 'any';

function setRecency(val) {
  currentRecency = val;
  // Seeker
  const any = document.getElementById('recencyAny');
  const today = document.getElementById('recencyToday');
  const val1 = document.getElementById('recencyValue');
  // Employer
  const anyE = document.getElementById('recencyAnyEmp');
  const todayE = document.getElementById('recencyTodayEmp');
  const val2 = document.getElementById('recencyValueEmp');

  [any, anyE].forEach(btn => btn && btn.classList.toggle('active', val === 'any'));
  [today, todayE].forEach(btn => btn && btn.classList.toggle('active', val === 'today'));
  if (val1) val1.value = val;
  if (val2) val2.value = val;
}

function toggleChip(label) {
  const cb = label.querySelector('input[type="checkbox"]');
  if (!cb) return;
  cb.checked = !cb.checked;
  label.classList.toggle('checked', cb.checked);
}

// Auth + role setup
(async () => {
  const token = localStorage.getItem("token");
  const overlay = document.getElementById("spinnerOverlay");

  if (!token) { window.location.href = "login.html"; return; }

  const role = getRoleFromToken() || localStorage.getItem("userRole") || 'seeker';

  // Show the right preference fields
  const seekerPrefs = document.getElementById('seekerPrefs');
  const employerPrefs = document.getElementById('employerPrefs');
  const prefTitle = document.getElementById('prefTitle');

  if (role === 'employer') {
    if (seekerPrefs) seekerPrefs.style.display = 'none';
    if (employerPrefs) employerPrefs.style.display = 'block';
    if (prefTitle) prefTitle.textContent = 'Ideal Candidate Preferences';

    // Employer sub-major cascade
    const reqMajor = document.getElementById('reqMajor');
    if (reqMajor) {
      reqMajor.addEventListener('change', () => populateSubMajors('reqSubMajor', reqMajor.value));
    }
  } else {
    if (seekerPrefs) seekerPrefs.style.display = 'block';
    if (employerPrefs) employerPrefs.style.display = 'none';
    if (prefTitle) prefTitle.textContent = 'Your Job Preferences';
  }

  try {
    if (overlay) overlay.style.display = "flex";

    const res = await fetch(`${config.API_BASE_URL}/api/user/progress`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    const step = data.current_step || "personal";
    const status = data.status || "pending";

    if (status === "approved") { window.location.href = "dashboard_page.html"; return; }
    if (status === "disapproved") { window.location.href = "submission.html"; return; }

    if (step !== "preferences") {
      if (step === "identity" || step === "personal") window.location.href = "personal.html";
      else if (step === "submission") window.location.href = "submission.html";
      return;
    }

    if (overlay) overlay.style.display = "none";
  } catch (err) {
    console.error("Progress check failed:", err);
    if (overlay) overlay.style.display = "none";
    window.location.href = "login.html";
  }
})();

// Form submission
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById("preferencesForm");
  const spinner = document.getElementById("spinner");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (spinner) spinner.style.display = "block";

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Session expired. Please log in again.");
      if (spinner) spinner.style.display = "none";
      return;
    }

    const role = getRoleFromToken() || localStorage.getItem("userRole") || 'seeker';
    const formData = new FormData(form);
    let payload = {};

    if (role === 'seeker') {
      const workModes = Array.from(document.querySelectorAll('input[name="work_mode"]:checked')).map(cb => cb.value);
      const companySizes = Array.from(document.querySelectorAll('input[name="company_size"]:checked')).map(cb => cb.value);
      const targetIndustries = Array.from(document.querySelectorAll('input[name="target_industry"]:checked')).map(cb => cb.value);

      payload = {
        // Store work modes as comma-separated in pref_country_of_birth
        pref_country_of_birth: workModes.join(','),
        // Store company sizes in pref_country
        pref_country: companySizes.join(','),
        // Store target industries in pref_languages (existing array support)
        pref_languages: `{${targetIndustries.join(',')}}`,
        // Recency filter in pref_religion
        pref_religion: currentRecency,
        // Required fields to pass validation
        pref_age_min: 18,
        pref_age_max: 65
      };
    } else {
      // Employer preferences
      const reqReloc = document.getElementById('requireRelocation');
      const reqNight = document.getElementById('requireNightShift');

      payload = {
        pref_gender: formData.get('pref_gender') || 'Any',
        pref_age_min: parseInt(formData.get('pref_age_min')) || 18,
        // Store required major in pref_country_of_birth
        pref_country_of_birth: formData.get('pref_country_of_birth') || '',
        // Store required sub-major in pref_country_of_residence
        pref_country_of_residence: formData.get('pref_country_of_residence') || '',
        // Store min education in pref_education
        pref_education: formData.get('pref_education') || '',
        // Relocation required in pref_willing_to_relocate
        pref_willing_to_relocate: reqReloc && reqReloc.checked ? 'Yes' : 'No',
        // Night shift required in pref_smoking
        pref_smoking: reqNight && reqNight.checked ? 'Yes' : 'No',
        // Recency filter in pref_religion
        pref_religion: currentRecency,
        pref_age_max: 65
      };
    }

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/user/preferences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (spinner) spinner.style.display = "none";

      if (response.ok && result.success) {
        window.location.href = "submission.html";
      } else {
        alert(result.message || "Error saving preferences.");
      }
    } catch (error) {
      if (spinner) spinner.style.display = "none";
      alert("Network error. Try again.");
      console.error(error);
    }
  });
});
