
require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary").v2;
const { createClient } = require("@supabase/supabase-js");

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, "../temp"),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to upload to Cloudinary
async function uploadToCloudinary(filePath, folder) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `takeyours/${folder}`,
      resource_type: "auto",
    });
    return {
      url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.error("❌ Supabase connection test failed:", error.message);
      return false;
    }
    console.log("✅ Supabase connection successful");
    return true;
  } catch (err) {
    console.error("❌ Supabase connection error:", err.message);
    return false;
  }
}

// Upload identity route
router.post("/upload-identity", upload.fields([
  { name: "idFront", maxCount: 1 },
  { name: "idBack", maxCount: 1 },
  { name: "video", maxCount: 1 }
]), async (req, res) => {
  console.log("📦 Incoming /api/upload-identity request...");

  // Test Supabase connection first
  const connectionTest = await testSupabaseConnection();
  if (!connectionTest) {
    return res.status(500).json({
      success: false,
      message: "Database connection failed. Please check your Supabase configuration."
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    const jwt = require("jsonwebtoken");
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔐 Authenticated:", decoded.email);
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const userEmail = decoded.email;
  const { idFront, idBack, video } = req.files;
  const { livenessInstructions } = req.body;

  if (!idFront && !idBack && !video) {
    return res.status(400).json({
      success: false,
      message: "Missing identity files.",
    });
  }

  try {
    let idFrontUrl = null;
    let idBackUrl = null;
    let livenessVideoUrl = null;
    let idFrontPublicId = null;
    let idBackPublicId = null;
    let livenessPublicId = null;

    // Upload idFront if exists
    if (idFront && idFront.length > 0) {
      const idFrontUploadResult = await uploadToCloudinary(idFront[0].path, "identity_front");
      idFrontUrl = idFrontUploadResult.url;
      idFrontPublicId = idFrontUploadResult.public_id;
      fs.unlink(idFront[0].path, () => {}); // Delete temp file
    }

    // Upload idBack if exists
    if (idBack && idBack.length > 0) {
      const idBackUploadResult = await uploadToCloudinary(idBack[0].path, "identity_back");
      idBackUrl = idBackUploadResult.url;
      idBackPublicId = idBackUploadResult.public_id;
      fs.unlink(idBack[0].path, () => {}); // Delete temp file
    }

    // Upload video if exists
    if (video && video.length > 0) {
      const videoUploadResult = await uploadToCloudinary(video[0].path, "liveness_video");
      livenessVideoUrl = videoUploadResult.url;
      livenessPublicId = videoUploadResult.public_id;
      fs.unlink(video[0].path, () => {}); // Delete temp file
    }

    // Update user record in Supabase
    const updateData = {
      current_step: 'personal',
      id_front_url: idFrontUrl,
      id_back_url: idBackUrl,
      liveness_video_url: livenessVideoUrl,
      id_front_public_id: idFrontPublicId,
      id_back_public_id: idBackPublicId,
      liveness_public_id: livenessPublicId
    };

    // Add liveness instructions if provided
    if (livenessInstructions) {
      try {
        updateData.liveness_instructions = JSON.parse(livenessInstructions);
      } catch (e) {
        updateData.liveness_instructions = livenessInstructions;
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('email', userEmail)
      .select();

    if (error) {
      console.error("❌ Database update error:", error);
      console.error("❌ Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Database update failed: ${error.message}`);
    }

    console.log("✅ Database update successful for:", userEmail);
    console.log("✅ Updated data:", data);

    res.status(200).json({
      success: true,
      message: "Identity uploaded and user record updated successfully.",
      data: data,
    });
  } catch (err) {
    console.error("❌ Identity upload failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
