// Load environment variables
require("dotenv").config({ path: __dirname + '/.env' });

const fs = require("fs");

const express = require("express");
const cors = require("cors");

// Platform detection for debugging
const platformInfo = {
  isRender: !!(process.env.RENDER || process.env.RENDER_SERVICE_ID),
  isReplit: !!(process.env.REPL_ID || process.env.REPLIT_DB_URL),
  isCodespace: !!process.env.CODESPACES,
  nodeEnv: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  platform: process.platform,
  architecture: process.arch
};

console.log(`🌐 PLATFORM DETECTION:`, JSON.stringify(platformInfo, null, 2));

// Enhanced environment variables validation for Render
console.log(`🔍 RENDER DEBUG - Environment Variables Comprehensive Check:`);

// All environment variables status
const envVars = {
  EMAIL_USER: process.env.EMAIL_USER,
  GMAIL_USER: process.env.GMAIL_USER,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  ANON_KEY: process.env.ANON_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT
};

// Log environment variable status
Object.keys(envVars).forEach(key => {
  const value = envVars[key];
  if (key === 'SENDGRID_API_KEY' && value) {
    console.log(`   ${key}: ${value.substring(0, 15)}... (length: ${value.length})`);
  } else if (value) {
    console.log(`   ${key}: ${key.includes('SECRET') || key.includes('KEY') ? 'SET (hidden)' : value}`);
  } else {
    console.log(`   ${key}: NOT SET`);
  }
});

// Render-specific environment checks
if (platformInfo.isRender) {
  console.log(`🔧 RENDER SPECIFIC CHECKS:`);
  console.log(`   RENDER: ${process.env.RENDER || 'NOT SET'}`);
  console.log(`   RENDER_SERVICE_ID: ${process.env.RENDER_SERVICE_ID || 'NOT SET'}`);
  console.log(`   RENDER_SERVICE_NAME: ${process.env.RENDER_SERVICE_NAME || 'NOT SET'}`);
  console.log(`   RENDER_GIT_COMMIT: ${process.env.RENDER_GIT_COMMIT || 'NOT SET'}`);
}

// Critical validation for email service
console.log(`🔍 EMAIL SERVICE VALIDATION:`);
const emailValidation = {
  hasSendGridKey: !!process.env.SENDGRID_API_KEY,
  sendGridKeyFormat: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.startsWith('SG.') : false,
  sendGridKeyLength: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.length >= 50 : false,
  hasEmailUser: !!(process.env.EMAIL_USER || process.env.GMAIL_USER),
  emailUserCorrect: (process.env.EMAIL_USER || process.env.GMAIL_USER) === 'takeyours001@gmail.com'
};

console.log(`   SendGrid Key Present: ${emailValidation.hasSendGridKey}`);
console.log(`   SendGrid Key Format Valid: ${emailValidation.sendGridKeyFormat}`);
console.log(`   SendGrid Key Length Valid: ${emailValidation.sendGridKeyLength}`);
console.log(`   Email User Present: ${emailValidation.hasEmailUser}`);
console.log(`   Email User Correct: ${emailValidation.emailUserCorrect}`);

// Error reporting for critical issues
if (!emailValidation.hasSendGridKey) {
  console.error(`🚨 CRITICAL: No SendGrid API key found`);
}
if (!emailValidation.sendGridKeyFormat) {
  console.error(`🚨 CRITICAL: SendGrid API key format invalid (should start with 'SG.')`);
}
if (!emailValidation.sendGridKeyLength) {
  console.error(`🚨 CRITICAL: SendGrid API key too short (should be 50+ characters)`);
}
if (!emailValidation.hasEmailUser) {
  console.error(`🚨 CRITICAL: No email user configured`);
}
if (!emailValidation.emailUserCorrect) {
  console.error(`🚨 WARNING: Email user should be 'takeyours001@gmail.com' for verified sender`);
}
const jwt = require("jsonwebtoken");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const upload = require('./middleware/upload'); // Assuming you have multer setup in middleware
const userController = require('./controller/userController'); // Assuming you have userController


// Routes
const authRoutes = require("./routes/auth");
const uploadIdentityRoute = require("./routes/upload-identity");
const personalRoute = require("./routes/personal");
const preferencesRoute = require("./routes/preferences");
const statusRoute = require("./routes/status");
const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");
const messageRoutes = require("./routes/messages");
const paymentRoutes = require("./routes/payment");
const testEmailRoute = require("./routes/test-email");

const app = express();

// ✅ CORS setup
app.use(cors({
  origin: "*", // your frontend domain
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization"
}));


// ✅ Handle large requests (videos + images)
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

// ✅ Supabase Client Initialization
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ✅ Serve static files for frontend  
app.use(express.static(path.join(__dirname, '../frontend')));

// ✅ API routes
app.use("/api", authRoutes);
app.use("/api", uploadIdentityRoute);
app.use("/api", personalRoute);
app.use("/api", preferencesRoute);
app.use("/api", statusRoute);
app.use('/api/admin', adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api", testEmailRoute);

// Admin media updates routes
app.get("/api/admin/media-updates", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { status = 'pending' } = req.query;

    const { data, error } = await supabase
      .from('pending_media_updates')
      .select('*')
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error("Media updates fetch error:", error);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    res.json(data || []);
  } catch (error) {
    console.error("Media updates error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/media-updates/stats", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: pending } = await supabase
      .from('pending_media_updates')
      .select('id')
      .eq('status', 'pending');

    const { data: approved } = await supabase
      .from('pending_media_updates')
      .select('id')
      .eq('status', 'approved')
      .gte('reviewed_at', today);

    const { data: rejected } = await supabase
      .from('pending_media_updates')
      .select('id')
      .eq('status', 'rejected')
      .gte('reviewed_at', today);

    res.json({
      pending: pending?.length || 0,
      approved: approved?.length || 0,
      rejected: rejected?.length || 0
    });
  } catch (error) {
    console.error("Media stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/premium-subscriptions", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { status = 'pending' } = req.query;

    const { data, error } = await supabase
      .from('pending_premium_subscriptions')
      .select('*')
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error("Premium approvals fetch error:", error);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    res.json(data || []);
  } catch (error) {
    console.error("Premium approvals error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/admin/premium-approvals/stats", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: pending } = await supabase
      .from('pending_premium_subscriptions')
      .select('id')
      .eq('status', 'pending');

    const { data: approved } = await supabase
      .from('pending_premium_subscriptions')
      .select('id')
      .eq('status', 'approved')
      .gte('reviewed_at', today);

    const { data: rejected } = await supabase
      .from('pending_premium_subscriptions')
      .select('id')
      .eq('status', 'rejected')
      .gte('reviewed_at', today);

    res.json({
      pending: pending?.length || 0,
      approved: approved?.length || 0,
      rejected: rejected?.length || 0
    });
  } catch (error) {
    console.error("Premium stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Fetch the user ID based on email
async function getUserIdByEmail(currentUserEmail) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', currentUserEmail)  // Fetch the user id by email
    .single();

  if (error) {
    console.error("Error fetching user ID:", error);
    throw new Error(`Supabase Query Error: ${error.message}`);
  }

  if (!data) {
    throw new Error('No user found with the provided email.');
  }

  return data.id;  // Return the user ID
}

// ✅ Fetch all users excluding the current logged-in user by user ID
async function fetchUsers(currentUserId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .neq('id', currentUserId);  // Exclude the logged-in user by id

  if (error) {
    console.error("Error fetching users:", error);
    throw new Error(`Supabase Query Error: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No users found in the database.');
  }

  return data;
}

// Function to fetch users with pre-filtering based on preferences
async function fetchUsersWithPreFiltering(currentUserId, currentUser) {
  let query = supabase
    .from('users')
    .select('*')
    .neq('id', currentUserId)
    .eq('status', 'approved');

  // Filter by preferred gender
  if (currentUser.pref_gender) {
    query = query.eq('gender', currentUser.pref_gender);
  }

  // Filter by preferred county (country_of_residence)
  if (currentUser.pref_country_of_residence) {
    query = query.eq('country_of_residence', currentUser.pref_country_of_residence);
  }

  // Filter by age range
  if (currentUser.pref_age_min && currentUser.pref_age_max) {
    // Calculate age from date of birth
    query = query.gte('dob', new Date(new Date().getFullYear() - currentUser.pref_age_max, new Date().getMonth(), new Date().getDate()).toISOString())
                 .lte('dob', new Date(new Date().getFullYear() - currentUser.pref_age_min, new Date().getMonth(), new Date().getDate()).toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching users with pre-filtering:", error);
    throw new Error(`Supabase Query Error: ${error.message}`);
  }

  return data || [];
}

// ✅ Endpoint to fetch users and calculate match score
app.get('/api/users/:email', async (req, res) => {
  const currentUserEmail = req.params.email;  // Current logged-in user email

  try {
    // Fetch the user ID based on the email
    const currentUserId = await getUserIdByEmail(currentUserEmail);
    const currentUser = await getUserById(currentUserId);  // Fetch the logged-in user's full profile

    // Pre-filter users based on key preferences before fetching all users
    const preFilteredUsers = await fetchUsersWithPreFiltering(currentUserId, currentUser);

    if (preFilteredUsers.length === 0) {
      let adjustMessage = "No users found matching your preferences for All Profiles. ";

      if (currentUser.pref_gender && currentUser.pref_gender !== 'Any') {
        adjustMessage += `Try adjusting your preferred gender (currently: ${currentUser.pref_gender}). `;
      }

      if (currentUser.pref_country_of_residence) {
        adjustMessage += `Try adjusting your preferred county (currently: ${currentUser.pref_country_of_residence}). `;
      }

      if (currentUser.pref_age_min && currentUser.pref_age_max) {
        adjustMessage += `Try adjusting your age range (currently: ${currentUser.pref_age_min}-${currentUser.pref_age_max} years). `;
      }

      adjustMessage += "Consider broadening your criteria to find more matches.";

      return res.status(200).json({
        shouldAdjustPreferences: true,
        message: adjustMessage,
        users: [],
        section: 'all_profiles'
      });
    }

    // Calculate match scores only for pre-filtered users
    const totalAttributes = 18; // Total number of attributes being compared
    const matchedUsers = preFilteredUsers.map(user => {
      const rawScore = calculateMatchScore(user, currentUser);
      const matchScore = Math.round((rawScore / totalAttributes) * 100); // Convert to percentage
      return { ...user, matchScore };
    });

    // Sort users by match score in descending order
    matchedUsers.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      users: matchedUsers,
      message: null,
      shouldAdjustPreferences: false
    });
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Helper function to get a user by their ID
async function getUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)  // Fetch the user by ID
    .single();

  if (error) {
    throw new Error('Error fetching current user');
  }

  return data;
}

// Function to calculate match score
function calculateMatchScore(user, currentUser) {
  let score = 0;

  // Check each attribute and match preferences with personal info
  score += compareAttribute(user.gender, currentUser.pref_gender);
  score += compareAttribute(user.dob, currentUser.pref_age_min, currentUser.pref_age_max);
  score += compareAttribute(user.country_of_birth, currentUser.pref_country_of_birth);
  score += compareAttribute(user.country_of_residence, currentUser.pref_country_of_residence);
  score += compareAttribute(user.languages, currentUser.pref_languages);
  score += compareAttribute(user.religion, currentUser.pref_religion);
  score += compareAttribute(user.height, currentUser.pref_height);
  score += compareAttribute(user.weight, currentUser.pref_weight);
  score += compareAttribute(user.body_type, currentUser.pref_body_type);
  score += compareAttribute(user.skin_color, currentUser.pref_skin_color);
  score += compareAttribute(user.ethnicity, currentUser.pref_ethnicity);
  score += compareAttribute(user.diet, currentUser.pref_diet);
  score += compareAttribute(user.smoking, currentUser.pref_smoking);
  score += compareAttribute(user.drinking, currentUser.pref_drinking);
  score += compareAttribute(user.exercise, currentUser.pref_exercise);
  score += compareAttribute(user.pets, currentUser.pref_pets);
  score += compareAttribute(user.children, currentUser.pref_children);
  score += compareAttribute(user.living_situation, currentUser.pref_living_situation);
  score += compareAttribute(user.willing_to_relocate, currentUser.pref_willing_to_relocate);

  return score;
}

// Helper function to compare two attributes, accounting for null or empty values
function compareAttribute(userValue, prefValue, prefMax) {
  if (userValue == null || prefValue == null) return 0;  // No match if either value is null

  // If it's an array (languages or multiple values), check if there's any match
  if (Array.isArray(userValue) && Array.isArray(prefValue)) {
    return userValue.some(val => prefValue.includes(val)) ? 1 : 0;
  }

  // For numerical values (age, height, weight), check within a range if the preference is a range
  if (prefMax != null && !isNaN(userValue) && !isNaN(prefValue)) {
      const prefMinValue = Array.isArray(prefValue) ? prefValue[0] : prefValue;
      const prefMaxValue = Array.isArray(prefValue) ? prefValue[1] : prefMax;
      return (userValue >= prefMinValue && userValue <= prefMaxValue) ? 1 : 0;
  }

  // Compare for exact matches (strings, numbers)
  return userValue === prefValue ? 1 : 0;
}

// ✅ API route to fetch the current user's profile photo URL
app.get('/api/user/profile-photo/:email', async (req, res) => {
  const currentUserEmail = req.params.email;  // Current logged-in user email

  try {
    // Fetch the user ID based on the email
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Fetch the current user's profile data by ID
    const currentUser = await getUserById(currentUserId);

    // Check if the user has a profile photo URL
    const profilePhotoUrl = currentUser.photo_url || currentUser.profile_photo_url;

    if (!profilePhotoUrl) {
      return res.status(404).json({
        success: false,
        message: 'Profile photo not found',
      });
    }

    // Return the profile photo URL
    res.json({
      success: true,
      profile_photo_url: profilePhotoUrl,
    });
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ✅ API route to fetch profiles of people who selected the current user
app.get('/api/users/selected-you/:email', async (req, res) => {
  const currentUserEmail = req.params.email;

  try {
    // Fetch the current user's ID
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Fetch users who selected the current user using corrected query
    const { data: interactions, error } = await supabase
      .from('user_interactions')
      .select(`
        *,
        selector_user:users!fk_current_user(*)
      `)
      .eq('target_user_id', currentUserId)
      .eq('action', 'selected');

    if (error) {
      console.error("Error fetching user selections:", error);
      return res.status(500).json({ success: false, message: 'Error fetching user interactions' });
    }

    // If no one selected the current user
    if (!interactions || interactions.length === 0) {
      return res.json([]);
    }

    // Return the users with actions and match score
    const currentUser = await getUserById(currentUserId);
    const selectorUsersWithMatchScore = interactions.map(interaction => {
      const user = interaction.selector_user;
      const matchScore = calculateMatchScore(user, currentUser);
      return { 
        ...user, 
        action: interaction.action,
        matchScore,
        interactionId: interaction.id
      };
    });

    // Sort users by match score in descending order
    selectorUsersWithMatchScore.sort((a, b) => b.matchScore - a.matchScore);

    res.json(selectorUsersWithMatchScore);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to get match scores for a user
app.get('/api/users/match-scores/:email', async (req, res) => {
  const currentUserEmail = req.params.email;

  try {
    const currentUserId = await getUserIdByEmail(currentUserEmail);
    const currentUser = await getUserById(currentUserId);

    // Get all users except current user
    const { data: allUsers, error } = await supabase
      .from('users')
      .select('*')
      .neq('id', currentUserId);

    if (error) {
      throw new Error('Error fetching users for match scores');
    }

    const matchScores = {};
    allUsers.forEach(user => {
      const score = calculateMatchScore(user, currentUser);
      const totalAttributes = 18;
      matchScores[user.id] = Math.round((score / totalAttributes) * 100);
    });

    res.json(matchScores);
  } catch (error) {
    console.error("Error calculating match scores:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to send match request
app.post('/api/users/match/:email', async (req, res) => {
  const currentUserEmail = req.params.email;
  const { matchedUserId } = req.body;

  try {
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Check if match already exists
    const { data: existingMatch, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${matchedUserId}),and(sender_id.eq.${matchedUserId},receiver_id.eq.${currentUserId})`)
      .single();

    if (existingMatch) {
      return res.status(400).json({ success: false, message: "Match already exists" });
    }

    // Create match request
    const { data: newMatch, error: createError } = await supabase
      .from('matches')
      .insert({
        sender_id: currentUserId,
        receiver_id: matchedUserId,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error("Match request creation error:", createError.message);
      return res.status(500).json({ success: false, message: "Failed to create match request" });
    }

    res.json({ success: true, message: "Match request sent successfully", match: newMatch });
  } catch (error) {
    console.error("Error in match request:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to get mutual matches
app.get('/api/users/mutual-matches/:email', async (req, res) => {
  const currentUserEmail = req.params.email;

  try {
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Get mutual matches where both users have matched each other
    const { data: mutualMatches, error } = await supabase
      .from('matches')
      .select(`
        *,
        sender:users!matches_sender_id_fkey(*),
        receiver:users!matches_receiver_id_fkey(*)
      `)
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .eq('status', 'accepted');

    if (error) {
      console.error("Error fetching mutual matches:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    // Process mutual matches to return the other user's profile
    const processedMatches = mutualMatches.map(match => {
      const otherUser = match.sender_id === currentUserId ? match.receiver : match.sender;
      return {
        ...otherUser,
        matchId: match.id,
        matchedAt: match.created_at,
        isMutualMatch: true
      };
    });

    res.json(processedMatches);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to accept a selected user
app.post('/api/users/accept/:email', async (req, res) => {
  const currentUserEmail = req.params.email;
  const { selectedUserId } = req.body;

  try {
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Update the interaction to "accepted"
    const { error } = await supabase
      .from('user_interactions')
      .update({ action: 'accepted' })
      .eq('current_user_id', currentUserId)
      .eq('target_user_id', selectedUserId);

    if (error) {
      console.error("Error updating interaction to accepted:", error);
      throw new Error('Error accepting user');
    }

    res.json({ success: true, message: 'User accepted' });
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to reject a selected user
app.post('/api/users/reject/:email', async (req, res) => {
  const currentUserEmail = req.params.email;
  const { selectedUserId } = req.body;  // Expecting selected user's ID

  try {
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Update the interaction to "rejected"
    const { error } = await supabase
      .from('user_interactions')
      .update({ action: 'rejected' })
      .eq('current_user_id', currentUserId)
      .eq('target_user_id', selectedUserId);

    if (error) {
      console.error("Error updating interaction to rejected:", error);
      throw new Error('Error rejecting user');
    }

    res.json({ success: true, message: 'User rejected' });
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to fetch user interactions
app.get('/api/users/interactions/:email', async (req, res) => {
  const currentUserEmail = req.params.email;

  try {
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Fetch all interactions for the current user
    const { data: interactions, error } = await supabase
      .from('user_interactions')
      .select(`
        *,
        target_user:users!fk_target_user(*)
      `)
      .eq('current_user_id', currentUserId);

    if (error) {
      console.error("Error fetching user interactions:", error);
      throw new Error('Error fetching user interactions');
    }

    // Transform the data to include user details
    const userInteractions = interactions.map(interaction => ({
      ...interaction.target_user,
      action: interaction.action,
      originalLocation: interaction.original_location || 'all',
      interactionId: interaction.id
    }));

    res.json(userInteractions);
  } catch (error) {
    console.error("Error occurred:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to handle user interactions (select, remove, accept, etc.)
app.post('/api/users/interact', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserEmail = decoded.email;
    const { targetUserId, action, originalLocation } = req.body;

    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Check if interaction already exists
    const { data: existingInteraction, error: checkError } = await supabase
      .from('user_interactions')
      .select('*')
      .eq('current_user_id', currentUserId)
      .eq('target_user_id', targetUserId)
      .single();

    if (existingInteraction) {
      // Update existing interaction
      const { error: updateError } = await supabase
        .from('user_interactions')
        .update({ 
          action: action,
          original_location: originalLocation || existingInteraction.original_location || 'all',
          updated_at: new Date().toISOString()
        })
        .eq('current_user_id', currentUserId)
        .eq('target_user_id', targetUserId);

      if (updateError) {
        throw new Error('Error updating interaction');
      }
    } else {
      // Create new interaction
      const { error: insertError } = await supabase
        .from('user_interactions')
        .insert({
          current_user_id: currentUserId,
          target_user_id: targetUserId,
          action: action,
          original_location: originalLocation || 'all'
        });

      if (insertError) {
        throw new Error('Error creating interaction');
      }
    }

    res.json({ success: true, message: 'Interaction updated successfully' });
  } catch (error) {
    console.error("Error in user interaction:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to update found match status
app.post('/api/users/found-match-status', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { targetUserId, foundMatch } = req.body;

    const { error } = await supabase
      .from('users')
      .update({ found_match: foundMatch })
      .eq('id', targetUserId);

    if (error) {
      throw new Error('Error updating found match status');
    }

    res.json({ success: true, message: 'Found match status updated successfully' });
  } catch (error) {
    console.error("Error updating found match status:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to handle match status (both users found match)
app.post('/api/users/match-status', async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserEmail = decoded.email;
    const { targetUserId } = req.body;

    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Update both users as found_match
    const { error: currentUserError } = await supabase
      .from('users')
      .update({ found_match: true, matched_with: targetUserId })
      .eq('id', currentUserId);

    const { error: targetUserError } = await supabase
      .from('users')
      .update({ found_match: true, matched_with: currentUserId })
      .eq('id', targetUserId);

    if (currentUserError || targetUserError) {
      throw new Error('Error updating match status');
    }

    res.json({ success: true, message: 'Match status updated successfully' });
  } catch (error) {
    console.error("Error updating match status:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ API route to update interaction when a user selects another user
app.post('/api/users/select/:email', async (req, res) => {
  const currentUserEmail = req.params.email;
  const { selectedUserId, action } = req.body;

  console.log(`📦 Select user request - Current user: ${currentUserEmail}, Selected user: ${selectedUserId}, Action: ${action}`);

  try {
    // Validate input
    if (!selectedUserId || !action) {
      return res.status(400).json({ success: false, message: "Missing selectedUserId or action" });
    }

    // Fetch the current user's ID based on the email
    const currentUserId = await getUserIdByEmail(currentUserEmail);
    if (!currentUserId) {
      return res.status(400).json({ success: false, message: "Current user not found." });
    }

    // Check if an interaction already exists between these two users
    const { data, error } = await supabase
      .from('user_interactions')
      .select('*')
      .eq('current_user_id', currentUserId)
      .eq('target_user_id', selectedUserId);

    if (error) {
      console.error('❌ Error checking user interaction:', error);
      return res.status(500).json({ success: false, message: 'Error checking user interaction' });
    }

    if (data.length > 0) {
      // If interaction already exists, just update it
      const { error: updateError } = await supabase
        .from('user_interactions')
        .update({ action: action })
        .eq('current_user_id', currentUserId)
        .eq('target_user_id', selectedUserId);

      if (updateError) {
        console.error('❌ Error updating user interaction:', updateError);
        return res.status(500).json({ success: false, message: 'Error updating user interaction' });
      }

      console.log('✅ User interaction updated successfully');
      return res.json({ success: true, message: 'Interaction updated successfully' });
    } else {
      // If no interaction exists, create a new one
      const { error: insertError } = await supabase
        .from('user_interactions')
        .insert({
          current_user_id: currentUserId,
          target_user_id: selectedUserId,
          action: action
        });

      if (insertError) {
        console.error('❌ Error creating user interaction:', insertError);
        return res.status(500).json({ success: false, message: 'Error creating user interaction' });
      }

      console.log('✅ User interaction created successfully');
      return res.json({ success: true, message: 'Interaction created successfully' });
    }
  } catch (error) {
    console.error('❌ Error in select user endpoint:', error);
    return res.status(500).json({ success: false, message: 'Server error during user selection' });
  }
});

// Get user subscription endpoint  
app.get("/api/user/subscription", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.json({ plan: 'free', status: 'active' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, subscription')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.json({ plan: 'free', status: 'active' });
    }

    // Check for active subscription
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .single();

    if (activeSubscription) {
      res.json({ 
        plan: activeSubscription.plan,
        status: 'active',
        startDate: activeSubscription.start_date,
        endDate: activeSubscription.end_date
      });
    } else {
      res.json({ plan: 'free', status: 'active' });
    }
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.json({ plan: 'free', status: 'active' });
  }
});

// Get user subscription status
app.get("/api/user/subscription-status", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.json({ subscription: 'free' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    // Get user data
    const { data: user, error } = await supabase
      .from('users')
      .select('id, subscription')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.json({ subscription: 'free' });
    }

    // Check for active subscription in subscriptions table
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan, status, end_date')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .single();

    if (activeSubscription) {
      // Update users table with current subscription status
      const planType = activeSubscription.plan === 'premium' || 
                      activeSubscription.plan === 'weekly' || 
                      activeSubscription.plan === 'monthly' || 
                      activeSubscription.plan === 'yearly' ? 'premium' : 'free';

      await supabase
        .from('users')
        .update({ subscription: planType })
        .eq('id', user.id);

      res.json({ subscription: planType });
    } else {
      // Update users table to free if no active subscription
      await supabase
        .from('users')
        .update({ subscription: 'free' })
        .eq('id', user.id);

      res.json({ subscription: 'free' });
    }
  } catch (error) {
    console.error("Error checking subscription:", error);
    res.json({ subscription: 'free' });
  }
});

// Create mutual match
app.post("/api/users/mutual-match", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserEmail = decoded.email;
    const { targetUserId, originalLocation } = req.body;

    // Get current user ID
    const currentUserId = await getUserIdByEmail(currentUserEmail);

    // Create interaction for current user accepting the other user
    const { error: currentUserError } = await supabase
      .from('user_interactions')
      .upsert({
        current_user_id: currentUserId,
        target_user_id: targetUserId,
        action: 'accepted',
        original_location: originalLocation || 'selected-you',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'current_user_id,target_user_id'
      });

    if (currentUserError) {
      console.error("Error creating current user interaction:", currentUserError);
    }

    // Create reverse interaction - other user also goes to accepted for current user
    const { error: reverseUserError } = await supabase
      .from('user_interactions')
      .upsert({
        current_user_id: targetUserId,
        target_user_id: currentUserId,
        action: 'accepted',
        original_location: 'selected',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'current_user_id,target_user_id'
      });

    if (reverseUserError) {
      console.error("Error creating reverse user interaction:", reverseUserError);
    }

    res.json({ success: true, message: "Mutual match created successfully" });
  } catch (error) {
    console.error("Error creating mutual match:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get user by email endpoint
app.get('/api/user', async (req, res) => {
  try {
    const { email, id } = req.query;

    let query = supabase.from('users').select('*');

    if (email) {
      query = query.eq('email', email);
    } else if (id) {
      query = query.eq('id', id);
    } else {
      return res.status(400).json({ error: 'Email or ID parameter required' });
    }

    const { data, error } = await query.single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// M-Pesa payment verification endpoint
app.post('/api/payment/mpesa/verify', upload.single('payment_proof'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const { plan, amount, transaction_id, phone_number } = req.body;
    const proofFile = req.file;

    if (!plan || !amount || !transaction_id || !phone_number || !proofFile) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Upload proof to Cloudinary
    const cloudinary = require('cloudinary').v2;
    const proofUpload = await cloudinary.uploader.upload(proofFile.path, {
      folder: 'payment_proofs',
      resource_type: 'auto'
    });

    // Store in pending subscriptions
    const { error } = await supabase
      .from('pending_premium_subscriptions')
      .insert({
        user_email: userEmail,
        payment_method: 'mpesa',
        payment_proof_url: proofUpload.secure_url,
        amount: parseFloat(amount),
        currency: 'USD',
        transaction_reference: transaction_id,
        phone_number: phone_number,
        plan: plan,
        status: 'pending',
        requested_at: new Date().toISOString()
      });

    // Clean up temp file
    const fs = require('fs');
    fs.unlink(proofFile.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    if (error) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true, message: 'Payment submitted for review' });
  } catch (error) {
    console.error('M-Pesa payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Crypto payment verification endpoint
app.post('/api/payment/crypto/verify', upload.single('transaction_proof'), async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const { plan, amount, crypto_type, transaction_id } = req.body;
    const proofFile = req.file;

    if (!plan || !amount || !crypto_type || !transaction_id || !proofFile) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Upload proof to Cloudinary
    const cloudinary = require('cloudinary').v2;
    const proofUpload = await cloudinary.uploader.upload(proofFile.path, {
      folder: 'payment_proofs',
      resource_type: 'auto'
    });

    // Store in pending subscriptions
    const { error } = await supabase
      .from('pending_premium_subscriptions')
      .insert({
        user_email: userEmail,
        payment_method: 'crypto',
        payment_proof_url: proofUpload.secure_url,
        amount: parseFloat(amount),
        currency: crypto_type,
        transaction_reference: transaction_id,
        plan: plan,
        status: 'pending',
        requested_at: new Date().toISOString()
      });

    // Clean up temp file
    const fs = require('fs');
    fs.unlink(proofFile.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    if (error) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true, message: 'Payment submitted for review' });
  } catch (error) {
    console.error('Crypto payment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send match request
app.post("/api/users/match-request", upload.none(), userController.sendMatchRequest);

// Admin media updates endpoints
app.get('/api/admin/media-updates', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const { data, error } = await supabase
      .from('pending_media_updates')
      .select('*')
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching media updates:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/media-updates/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: pending } = await supabase
      .from('pending_media_updates')
      .select('id')
      .eq('status', 'pending');

    const { data: approved } = await supabase
      .from('pending_media_updates')
      .select('id')
      .eq('status', 'approved')
      .gte('reviewed_at', today);

    const { data: rejected } = await supabase
      .from('pending_media_updates')
      .select('id')
      .eq('status', 'rejected')
      .gte('reviewed_at', today);

    res.json({
      pending: pending?.length || 0,
      approved: approved?.length || 0,
      rejected: rejected?.length || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/media-updates/review', async (req, res) => {
  try {
    const { updateId, status, adminMessage } = req.body;

    if (status === 'approved') {
      // Get the pending update
      const { data: update } = await supabase
        .from('pending_media_updates')
        .select('*')
        .eq('id', updateId)
        .single();

      if (update) {
        // Update user's actual media URLs
        const updateData = {};
        if (update.pending_photo_url) updateData.profile_photo_url = update.pending_photo_url;
        if (update.pending_video_url) updateData.profile_video_url = update.pending_video_url;

        await supabase
          .from('users')
          .update(updateData)
          .eq('email', update.user_email);
      }
    }

    // Update the pending update status
    await supabase
      .from('pending_media_updates')
      .update({
        status,
        admin_message: adminMessage,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', updateId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error reviewing media update:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin premium subscription endpoints
app.get('/api/admin/premium-subscriptions', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const { data, error } = await supabase
      .from('pending_premium_subscriptions')
      .select('*')
      .eq('status', status)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching premium subscriptions:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/premium-subscriptions/review', async (req, res) => {
  try {
    const { subscriptionId, status, adminMessage } = req.body;

    if (status === 'approved') {
      // Get the subscription details
      const { data: subscription } = await supabase
        .from('pending_premium_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (subscription) {
        // Update user's subscription status
        await supabase
          .from('users')
          .update({ subscription: 'premium' })
          .eq('email', subscription.user_email);

        // Get user ID first
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', subscription.user_email)
          .single();

        if (userData) {
          // Create active subscription record
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30); // 30 days premium

          await supabase
            .from('subscriptions')
            .insert({
              user_id: userData.id,
              plan: subscription.plan || 'premium',
              status: 'active',
              start_date: new Date().toISOString(),
              end_date: endDate.toISOString()
            });
        }
      }
    }

    // Update the pending subscription status
    await supabase
      .from('pending_premium_subscriptions')
      .update({
        status,
        admin_message: adminMessage,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', subscriptionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error reviewing subscription:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Premium subscription stats
app.get('/api/admin/premium-approvals/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: pending } = await supabase
      .from('pending_premium_subscriptions')
      .select('id')
      .eq('status', 'pending');

    const { data: approved } = await supabase
      .from('pending_premium_subscriptions')
      .select('id')
      .eq('status', 'approved')
      .gte('reviewed_at', today);

    const { data: rejected } = await supabase
      .from('pending_premium_subscriptions')
      .select('id')
      .eq('status', 'rejected')
      .gte('reviewed_at', today);

    res.json({
      pending: pending?.length || 0,
      approved: approved?.length || 0,
      rejected: rejected?.length || 0
    });
  } catch (error) {
    console.error('Error fetching premium stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/premium-subscriptions/review-old', async (req, res) => {
  try {
    const { subscriptionId, status, adminMessage } = req.body;

    if (status === 'approved') {
      // Get the pending subscription
      const { data: subscription } = await supabase
        .from('pending_premium_subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (subscription) {
        // Update user's subscription status
        await supabase
          .from('users')
          .update({ subscription: 'premium' })
          .eq('email', subscription.user_email);
      }
    }

    // Update the pending subscription status
    await supabase
      .from('pending_premium_subscriptions')
      .update({
        status,
        admin_message: adminMessage,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', subscriptionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error reviewing subscription:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Static files served above

// Endpoint to fetch user data based on ID
app.get('/api/user', async (req, res) => {
  const userId = req.query.id;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Query Supabase database to get user data by ID
    const { data, error } = await supabase
      .from('users')  // Replace 'users' with your table name
      .select('*')
      .eq('id', userId)
      .single();  // Fetch a single record

    if (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ message: 'Error fetching user data' });
    }

    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Filter out sensitive information like email, password and ID numbers
    const { password, email, national_id_number, id_front_url, id_back_url, liveness_video_url, ...publicData } = data;

    // Return public data (exclude sensitive information)
    res.json(publicData);
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ API route to get user subscription status
app.get('/api/user/subscription-status', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    // Get user subscription from users table
    const { data: user, error } = await supabase
      .from('users')
      .select('subscription')
      .eq('email', userEmail)
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ 
      subscription: user?.subscription || 'free',
      isPremium: user?.subscription === 'premium'
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ API route to get detailed user subscription info
app.get('/api/user/subscription', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, subscription')
      .eq('email', userEmail)
      .single();

    if (userError) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // Check for active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1)
      .single();

    const currentPlan = user?.subscription || 'free';
    const isActive = subscription && new Date(subscription.end_date) > new Date();

    res.json({
      plan: currentPlan,
      isActive: isActive,
      subscription: subscription,
      endDate: subscription?.end_date
    });
  } catch (error) {
    console.error('Subscription info error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ Root test route
app.get("/api", (req, res) => {
  res.send("✅ Takeyours Identity Verification API is running.");
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});