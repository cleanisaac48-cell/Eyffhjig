const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { savePersonalInfo } = require("../controllers/userController");

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, "../temp"),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Personal info route with file upload support
router.post("/personal", upload.fields([
  { name: "profilePhoto", maxCount: 1 },
  { name: "profileVideo", maxCount: 1 }
]), savePersonalInfo);

module.exports = router;