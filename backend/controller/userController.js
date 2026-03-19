require("dotenv").config();
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Helper function to upload to Cloudinary
async function uploadToCloudinary(filePath, folder, mimeType) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: mimeType && mimeType.startsWith("video") ? "video" : "image",
      folder: folder,
    });
    return { url: result.secure_url, public_id: result.public_id };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}


module.exports = {
  uploadToCloudinary,
  
  uploadIdentity: async (req, res) => {
    console.log("📦 Incoming /api/upload-identity request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      // Check if user exists in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("🔥 Upload Identity Error:", checkError);
        return res.status(500).json({
          success: false,
          message: checkError.message
        });
      }

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Handle file uploads if present
      let photoUrl = null;
      let videoUrl = null;
      let idFrontUrl = null;
      let idBackUrl = null;

      const { photo, video, idFront, idBack, nationalIdNumber } = req.body;

      if (photo) {
        const photoResult = await cloudinary.uploader.upload(photo, {
          resource_type: "image",
          folder: "identity_photos"
        });
        photoUrl = photoResult.secure_url;
      }

      if (video) {
        const videoResult = await cloudinary.uploader.upload(video, {
          resource_type: "video",
          folder: "identity_videos"
        });
        videoUrl = videoResult.secure_url;
      }

      if (idFront) {
        const idFrontResult = await cloudinary.uploader.upload(idFront, {
          resource_type: "image",
          folder: "id_documents"
        });
        idFrontUrl = idFrontResult.secure_url;
      }

      if (idBack) {
        const idBackResult = await cloudinary.uploader.upload(idBack, {
          resource_type: "image",
          folder: "id_documents"
        });
        idBackUrl = idBackResult.secure_url;
      }

      // Validate required identity fields
      if (!nationalIdNumber || (!photoUrl && !photo) || (!idFrontUrl && !idFront)) {
        return res.status(400).json({
          success: false,
          message: "Missing required identity verification data"
        });
      }

      // Update user record with uploaded files and national ID
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (photoUrl) updateData.photo_url = photoUrl;
      if (videoUrl) updateData.liveness_video_url = videoUrl;
      if (idFrontUrl) updateData.id_front_url = idFrontUrl;
      if (idBackUrl) updateData.id_back_url = idBackUrl;
      if (nationalIdNumber) updateData.national_id_number = nationalIdNumber;

      // Only update current_step if identity verification is complete
      if (nationalIdNumber && (photoUrl || photo) && (idFrontUrl || idFront)) {
        updateData.current_step = 'personal';
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', userEmail);

      if (updateError) {
        console.error("🔥 Update Error:", updateError);
        return res.status(500).json({
          success: false,
          message: updateError.message
        });
      }

      console.log("✅ Identity verification data saved for:", userEmail);
      res.status(200).json({
        success: true,
        message: "Identity verification data uploaded successfully",
        current_step: 'personal'
      });

    } catch (error) {
      console.error("🔥 Identity upload error:", error.message);
      res.status(500).json({
        success: false,
        message: "Server error during identity verification save"
      });
    }
  },

  savePersonalInfo: async (req, res) => {
    console.log("📦 Incoming /api/user/personal request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      // Check if user exists in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("🔥 Save Personal Info Error:", checkError);
        return res.status(500).json({
          success: false,
          message: checkError.message
        });
      }

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Handle file uploads - check if files exist first
      console.log("📁 Files received:", req.files);
      const { profilePhoto, profileVideo } = req.files || {};

      let profilePhotoUrl = null;
      let profileVideoUrl = null;
      let profilePhotoPublicId = null;
      let profileVideoPublicId = null;

      try {
        // Upload profile photo if provided
        if (profilePhoto && profilePhoto.length > 0) {
          console.log("📷 Uploading profile photo...");
          const photoUploadResult = await uploadToCloudinary(profilePhoto[0].path, "profile_photos", profilePhoto[0].mimetype);
          profilePhotoUrl = photoUploadResult.url;
          profilePhotoPublicId = photoUploadResult.public_id;
          fs.unlink(profilePhoto[0].path, (err) => {
            if (err) console.error("Error deleting temp photo file:", err);
          });
          console.log("✅ Profile photo uploaded:", profilePhotoUrl);
        }

        // Upload profile video if provided
        if (profileVideo && profileVideo.length > 0) {
          console.log("🎥 Uploading profile video...");
          const videoUploadResult = await uploadToCloudinary(profileVideo[0].path, "profile_videos", profileVideo[0].mimetype);
          profileVideoUrl = videoUploadResult.url;
          profileVideoPublicId = videoUploadResult.public_id;
          fs.unlink(profileVideo[0].path, (err) => {
            if (err) console.error("Error deleting temp video file:", err);
          });
          console.log("✅ Profile video uploaded:", profileVideoUrl);
        }
      } catch (uploadError) {
        console.error("❌ File upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "File upload failed: " + uploadError.message
        });
      }

        // Handle languages array
        let languages = req.body['languages[]'];
        if (typeof languages === 'string') {
          languages = [languages];
        }

        const personalData = {
          ...req.body,
          languages: languages,
          profile_photo_url: profilePhotoUrl,
          profile_video_url: profileVideoUrl,
          profile_photo_public_id: profilePhotoPublicId,
          profile_video_public_id: profileVideoPublicId,
          updated_at: new Date().toISOString(),
          current_step: 'preferences'
        };

        // Remove file-related fields that shouldn't be in the database
        delete personalData['languages[]'];
        delete personalData.profilePhoto;
        delete personalData.profileVideo;

        // Update user record with personal information
        const { error: updateError } = await supabase
          .from('users')
          .update(personalData)
          .eq('email', userEmail);

        if (updateError) {
          console.error("🔥 Update Error:", updateError);
          return res.status(500).json({
            success: false,
            message: updateError.message
          });
        }

        console.log("✅ Personal info saved for:", userEmail);
        res.status(200).json({
          success: true,
          message: "Personal information saved successfully",
          current_step: 'preferences'
        });

    } catch (error) {
      console.error("🔥 Personal info save error:", error.message);
      res.status(500).json({
        success: false,
        message: "Server error during personal info save"
      });
    }
  },

  savePreferences: async (req, res) => {
    console.log("📦 Incoming /api/user/preferences request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      // Check if user exists in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("🔥 Save Preferences Error:", checkError);
        return res.status(500).json({
          success: false,
          message: checkError.message
        });
      }

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Update preferences
        const preferenceFields = [
          'pref_gender', 'pref_age_min', 'pref_age_max', 'pref_location',
          'pref_education', 'pref_occupation', 'pref_religion', 'pref_ethnicity',
          'pref_languages', 'pref_interests', 'pref_lifestyle', 'pref_family_plans',
          'pref_smoking', 'pref_drinking', 'pref_exercise', 'pref_diet',
          'pref_pets', 'pref_travel', 'pref_communication_style',
          'pref_conflict_resolution', 'pref_love_language', 'pref_social_habits',
          'pref_financial_habits', 'pref_living_situation', 'pref_willing_to_relocate',
          'pref_relationship_type'
        ];

        const preferenceUpdates = {};
        preferenceFields.forEach(field => {
          if (req.body[field] !== undefined) {
            let value = req.body[field];
            // Handle array fields - convert comma-separated strings to proper PostgreSQL arrays
            if (['pref_languages', 'pref_interests'].includes(field) && typeof value === 'string') {
              // Convert "English,Swahili" to ["English", "Swahili"]
              value = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
            }
            preferenceUpdates[field] = value;
          }
        });

      // Update user record with preferences
      const updateData = {
        ...preferenceUpdates,
        current_step: 'submission',
        is_complete: true,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', userEmail);

      if (updateError) {
        console.error("🔥 Update Error:", updateError);
        return res.status(500).json({
          success: false,
          message: updateError.message
        });
      }

      console.log("✅ Preferences saved for:", userEmail);
      res.status(200).json({
        success: true,
        message: "Preferences saved successfully",
        current_step: 'submission'
      });

    } catch (error) {
      console.error("🔥 Preferences save error:", error.message);
      res.status(500).json({
        success: false,
        message: "Server error during preferences save"
      });
    }
  },

  getCurrentPreferences: async (req, res) => {
    console.log("📦 Incoming /api/user/current-preferences request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (error) {
        console.error("🔥 Get Preferences Error:", error);
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      console.log("✅ Preferences fetched for:", userEmail);
      res.status(200).json(user);

    } catch (error) {
      console.error("🔥 Get preferences error:", error.message);
      res.status(500).json({
        success: false,
        message: "Server error during preferences fetch"
      });
    }
  },

  updatePreferences: async (req, res) => {
    console.log("📦 Incoming /api/user/update-preferences request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;
    const updateData = req.body;

    // Handle array fields properly
    if (updateData.pref_languages && typeof updateData.pref_languages === 'string') {
      // If it's already in PostgreSQL array format {item1,item2}, keep it
      // If it's a comma-separated string, convert it
      if (!updateData.pref_languages.startsWith('{')) {
        updateData.pref_languages = `{${updateData.pref_languages}}`;
      }
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', userEmail)
        .select();

      if (error) {
        console.error("🔥 Update Error:", error);
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      console.log("✅ Preferences updated for:", userEmail);
      res.status(200).json({
        success: true,
        message: "Preferences updated successfully",
        data: data[0]
      });

    } catch (error) {
      console.error("🔥 Update preferences error:", error.message);
      res.status(500).json({
        success: false,
        message: "Server error during preferences update"
      });
    }
  },

  getUserProgress: async (req, res) => {
    console.log("📦 Incoming /api/user/progress request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      // Get user progress from Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select('current_step, status')
        .eq('email', userEmail)
        .single();

      if (error) {
        console.error("🔥 Get Progress Error:", error);
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      console.log("✅ Progress retrieved for:", userEmail, "Step:", user.current_step, "Status:", user.status);
      res.status(200).json({
        success: true,
        current_step: user.current_step || 'identity',
        status: user.status || 'pending'
      });

    } catch (err) {
      console.error("🔥 Get progress error:", err.message);
      res.status(500).json({
        success: false,
        message: "Server error during progress retrieval"
      });
    }
  },

  resetUserSubmission: async (req, res) => {
    console.log("📦 Incoming /api/user/reset-submission request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      // Complete reset - only keep email and password, everything else becomes null
      const { data, error } = await supabase
        .from('users')
        .update({
          current_step: 'identity',
          status: 'pending',
          admin_message: null,
          full_name: null,
          dob: null,
          gender: null,
          orientation: null,
          country_of_birth: null,
          country_of_residence: null,
          city: null,
          willing_to_relocate: null,
          languages: null,
          preferred_language: null,
          education: null,
          occupation: null,
          employment_type: null,
          religion: null,
          religious_importance: null,
          political_views: null,
          height: null,
          weight: null,
          skin_color: null,
          body_type: null,
          eye_color: null,
          hair_color: null,
          ethnicity: null,
          diet: null,
          smoking: null,
          drinking: null,
          exercise: null,
          pets: null,
          living_situation: null,
          children: null,
          photo_url: null,
          video_url: null,
          profile_photo_url: null,
          profile_video_url: null,
          id_front_url: null,
          id_back_url: null,
          liveness_video_url: null,
          national_id_number: null,
          is_complete: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('email', userEmail)
        .select();

      if (error) {
        console.error("🔥 Reset Submission Error:", error);
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      console.log("✅ User submission completely reset for:", userEmail);
      res.status(200).json({
        success: true,
        message: "User submission completely reset - starting fresh as new user"
      });

    } catch (err) {
      console.error("🔥 Reset Submission Error:", err.message);
      res.status(500).json({
        success: false,
        message: "Server error during submission reset"
      });
    }
  },

  resetIdentityOnly: async (req, res) => {
    console.log("📦 Incoming /api/user/reset-identity request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          current_step: 'identity',
          status: 'pending',
          admin_message: null,
          id_front_url: null,
          id_back_url: null,
          liveness_video_url: null,
          national_id_number: null
        })
        .eq('email', userEmail)
        .select();

      if (error) {
        console.error("🔥 Reset Identity Error:", error);
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      console.log("✅ Identity reset successfully for:", userEmail);
      res.status(200).json({
        success: true,
        message: "Identity reset successfully"
      });

    } catch (err) {
      console.error("🔥 Reset Identity Error:", err.message);
      res.status(500).json({
        success: false,
        message: "Server error during identity reset"
      });
    }
  },

  resetPersonalOnly: async (req, res) => {
    console.log("📦 Incoming /api/user/reset-personal request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          current_step: 'personal',
          status: 'pending',
          admin_message: null,
          full_name: null,
          dob: null,
          gender: null,
          orientation: null,
          country_of_birth: null,
          country_of_residence: null,
          city: null,
          willing_to_relocate: null,
          languages: null,
          preferred_language: null,
          education: null,
          occupation: null,
          employment_type: null,
          religion: null,
          religious_importance: null,
          political_views: null,
          height: null,
          weight: null,
          skin_color: null,
          body_type: null,
          eye_color: null,
          hair_color: null,
          ethnicity: null,
          diet: null,
          smoking: null,
          drinking: null,
          exercise: null,
          pets: null,
          living_situation: null,
          children: null,
          photo_url: null,
          video_url: null,
          profile_photo_url: null,
          profile_video_url: null
        })
        .eq('email', userEmail)
        .select();

      if (error) {
        console.error("🔥 Reset Personal Error:", error);
        return res.status(500).json({
          success: false,
          message: error.message
        });
      }

      console.log("✅ Personal info reset successfully for:", userEmail);
      res.status(200).json({
        success: true,
        message: "Personal info reset successfully"
      });

    } catch (err) {
      console.error("🔥 Reset Personal Error:", err.message);
      res.status(500).json({
        success: false,
        message: "Server error during personal reset"
      });
    }
  },

  getUserProfilePhoto: async (req, res) => {
    try {
      const { email } = req.params;
      console.log(`📦 Fetching profile photo for: ${email}`);

      const { data: user, error } = await supabase
        .from('users')
        .select('profile_photo_url')
        .eq('email', email)
        .single();

      if (error || !user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ profile_photo_url: user.profile_photo_url });
    } catch (error) {
      console.error('❌ Error fetching profile photo:', error);
      res.status(500).json({ error: 'Server error' });
    }
  },

  updateMedia: async (req, res) => {
    console.log("📦 Incoming /api/user/update-media request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔐 Authenticated:", decoded.email);
    } catch (err) {
      console.error("❌ Token verification failed:", err.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("🔥 Update Media Error:", checkError);
        return res.status(500).json({
          success: false,
          message: checkError.message
        });
      }

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      // Handle file uploads
      const { profilePhoto, profileVideo } = req.files || {};
      let profilePhotoUrl = null;
      let profileVideoUrl = null;

      try {
        if (profilePhoto && profilePhoto.length > 0) {
          console.log("📷 Uploading new profile photo...");
          const photoUploadResult = await uploadToCloudinary(profilePhoto[0].path, "profile_photos", profilePhoto[0].mimetype);
          profilePhotoUrl = photoUploadResult.url;
          fs.unlink(profilePhoto[0].path, (err) => {
            if (err) console.error("Error deleting temp photo file:", err);
          });
        }

        if (profileVideo && profileVideo.length > 0) {
          console.log("🎥 Uploading new profile video...");
          const videoUploadResult = await uploadToCloudinary(profileVideo[0].path, "profile_videos", profileVideo[0].mimetype);
          profileVideoUrl = videoUploadResult.url;
          fs.unlink(profileVideo[0].path, (err) => {
            if (err) console.error("Error deleting temp video file:", err);
          });
        }
      } catch (uploadError) {
        console.error("❌ File upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "File upload failed: " + uploadError.message
        });
      }

      // Create pending media update record
      const updateData = {
        user_email: userEmail,
        pending_photo_url: profilePhotoUrl,
        pending_video_url: profileVideoUrl,
        status: 'pending',
        requested_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('pending_media_updates')
        .insert(updateData);

      if (insertError) {
        console.error("🔥 Insert Error:", insertError);
        return res.status(500).json({
          success: false,
          message: insertError.message
        });
      }

      // Update the user's last_media_update timestamp
      await supabase
        .from('users')
        .update({ last_media_update: new Date().toISOString() })
        .eq('email', userEmail);

      console.log("✅ Media update request submitted for:", userEmail);
      res.status(200).json({
        success: true,
        message: "Media update request submitted for admin approval"
      });

    } catch (error) {
      console.error("🔥 Media update error:", error.message);
      res.status(500).json({
        success: false,
        message: "Server error during media update"
      });
    }
  },

  setMediaUpdateTimestamp: async (req, res) => {
    console.log("📦 Incoming /api/user/set-media-update-timestamp request...");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    const userEmail = decoded.email;
    const { timestamp } = req.body;

    try {
      const { error } = await supabase
        .from('users')
        .update({ last_media_update: timestamp })
        .eq('email', userEmail);

      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }

      res.status(200).json({ success: true, message: "Timestamp updated" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  // Send match request
  sendMatchRequest: async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const senderEmail = decoded.email;
      const { targetUserId } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ success: false, message: "Target user ID is required" });
      }

      // Get sender info
      const { data: sender, error: senderError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('email', senderEmail)
        .single();

      if (senderError || !sender) {
        return res.status(404).json({ success: false, message: "Sender not found" });
      }

      // Check if match request already exists
      const { data: existingMatch, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .or(`and(sender_id.eq.${sender.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${sender.id})`)
        .single();

      if (existingMatch) {
        return res.status(400).json({ success: false, message: "Match request already exists" });
      }

      // Create match request
      const { data: newMatch, error: createError } = await supabase
        .from('matches')
        .insert({
          sender_id: sender.id,
          receiver_id: targetUserId,
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
    } catch (err) {
      console.error("❌ Error in sendMatchRequest:", err.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
};