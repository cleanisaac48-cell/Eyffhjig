require("dotenv").config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const emailService = require("../services/emailService");
const {
  generateOTP,
  storeOTP,
  verifyOTP,
  checkOTPValidity,
  canSendOTP,
  incrementOTPAttempt,
  resetOTP
} = require("../otpStore");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------- REGISTER: Send OTP ----------
router.post("/send-otp", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing email or password." });

  try {
    const { data: existing, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existing && !error) {
      return res.status(400).json({ error: "Account with this email already exists." });
    }

    // Check OTP limit before sending
    const otpCheck = canSendOTP(email, 'register');
    if (!otpCheck.canSend) {
      return res.status(429).json({ error: otpCheck.message });
    }

    // Increment attempt BEFORE sending to properly track attempts
    incrementOTPAttempt(email, 'register');

    const otp = generateOTP();
    storeOTP(email, otp, 'register');

    console.log(`📧 Attempting to send registration OTP to: ${email} using ${emailService.getServiceType()}`);
    console.log(`🌐 RENDER DEBUG - Platform: ${process.platform}`);
    console.log(`🌐 RENDER DEBUG - Node Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 RENDER DEBUG - Email Service Ready: ${emailService.isServiceReady()}`);

    try {
      await emailService.sendOTP(email, otp);
      console.log(`✅ Registration OTP sent successfully to: ${email}`);
      res.status(200).json({ message: "OTP sent to your email." });
    } catch (emailError) {
      console.error("📧 Registration OTP sending failed:", emailError);
      
      // ENHANCED RENDER DEBUGGING - Log comprehensive error details
      console.error("🚨 RENDER DEBUG INFO - Email Service Failure Details:");
      console.error(`   📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.error(`   📍 Email Service Type: ${emailService.getServiceType()}`);
      console.error(`   📍 Target Email: ${email}`);
      console.error(`   📍 Timestamp: ${new Date().toISOString()}`);
      console.error(`   📍 Error Type: ${emailError.constructor.name}`);
      console.error(`   📍 Error Message: ${emailError.message}`);
      
      if (emailError.stack) {
        console.error(`   📍 Stack Trace: ${emailError.stack}`);
      }

      let errorMessage = "Failed to send OTP. Please check your email address and try again.";

      // Handle SendGrid specific errors
      if (emailError.response && emailError.response.body) {
        const sendGridError = emailError.response.body;
        console.error("📧 RENDER DEBUG - SendGrid Full Response Body:", JSON.stringify(sendGridError, null, 2));
        console.error("📧 RENDER DEBUG - SendGrid Status Code:", emailError.response.statusCode);
        console.error("📧 RENDER DEBUG - SendGrid Headers:", JSON.stringify(emailError.response.headers, null, 2));

        if (sendGridError.errors && sendGridError.errors.length > 0) {
          console.error("📧 RENDER DEBUG - SendGrid Error Array:");
          sendGridError.errors.forEach((err, index) => {
            console.error(`   Error ${index + 1}:`, JSON.stringify(err, null, 2));
          });
          
          const firstError = sendGridError.errors[0];
          if (firstError.message.includes('does not exist') || firstError.message.includes('invalid')) {
            errorMessage = "Invalid email address. Please check and try again.";
          } else if (firstError.message.includes('rate limit') || firstError.message.includes('quota')) {
            errorMessage = "Too many requests. Please wait a moment and try again.";
          } else if (firstError.message.includes('sender') || firstError.message.includes('verify') || firstError.message.includes('authentication')) {
            console.error("🚨 RENDER CRITICAL: SENDER VERIFICATION ISSUE DETECTED!");
            console.error("💡 ACTION REQUIRED: Verify sender email in SendGrid Dashboard");
            errorMessage = "Email service configuration issue. Please contact support.";
          } else {
            errorMessage = "Email service error. Please try again later.";
          }
        }
      }
      // Handle SMTP specific errors
      else if (emailError.code === 'ETIMEDOUT' || emailError.code === 'ECONNECTION') {
        console.error("📧 RENDER DEBUG - SMTP Connection Issue:", emailError.code);
        errorMessage = "Email service temporarily unavailable. Please try again later.";
      } else if (emailError.code === 'EAUTH') {
        console.error("📧 RENDER DEBUG - SMTP Authentication Issue:", emailError.code);
        errorMessage = "Email service authentication failed. Please try again later.";
      }
      // Handle general SendGrid errors
      else if (emailError.code >= 400 && emailError.code < 500) {
        console.error("📧 RENDER DEBUG - Client Error (4xx):", emailError.code);
        errorMessage = "Invalid email request. Please check your email and try again.";
      } else if (emailError.code >= 500) {
        console.error("📧 RENDER DEBUG - Server Error (5xx):", emailError.code);
        errorMessage = "Email service temporarily unavailable. Please try again later.";
      }
      
      console.error("🚨 RENDER DEBUG - Final Error Message Sent to Client:", errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  } catch (err) {
    console.error("📧 Registration error:", err.message);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// ---------- VERIFY OTP + Create User ----------
router.post("/verify-otp", async (req, res) => {
  const { email, otp, password } = req.body;
  if (!email || !otp || !password) {
    return res.status(400).json({ error: "Missing email, OTP or password." });
  }

  const valid = verifyOTP(email, otp, 'register');
  if (!valid) {
    return res.status(400).json({ error: "Wrong OTP." });
  }

  // Reset OTP attempts on successful verification
  resetOTP(email, 'register');

  try {
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existing && !checkError) {
      return res.status(400).json({ error: "User already exists." });
    }

    const { data, error } = await supabase
      .from('users')
      .insert([{
        email: email,
        password: password,
        current_step: 'identity',
        status: 'pending'
      }])
      .select();

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).json({ error: "Failed to save user." });
    }

    res.status(200).json({ message: "User registered successfully." });
  } catch (err) {
    console.error("Save user error:", err.message);
    res.status(500).json({ error: "Failed to save user." });
  }
});

// ---------- LOGIN ----------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Account does not exist. Please sign up." });
    }

    if (data.password !== password) {
      return res.status(401).json({ error: "Wrong password." });
    }

    // ✅ Ensure current_step is always set
    let currentStep = data.current_step;
    if (!currentStep) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ current_step: 'identity' })
        .eq('email', email);

      if (updateError) {
        console.error("Update error:", updateError);
      }
      currentStep = 'identity';
    }

    const token = jwt.sign(
      { email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      email: data.email,
      current_step: currentStep,
      status: data.status || "pending"
    });
  } catch (err) {
    console.error("🔥 Login error:", err.message);
    return res.status(500).json({ error: "Server error during login." });
  }
});

// ---------- FORGOT PASSWORD ----------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email || email.trim() === "") {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "User does not exist. Please sign up." });
    }

    // Check OTP limit before sending
    const otpCheck = canSendOTP(email, 'reset');
    if (!otpCheck.canSend) {
      return res.status(429).json({ error: otpCheck.message });
    }

    // Increment attempt BEFORE sending to properly track attempts
    incrementOTPAttempt(email, 'reset');

    const otp = generateOTP();
    storeOTP(email, otp, 'reset');

    console.log(`📧 Attempting to send password reset OTP to: ${email} using ${emailService.getServiceType()}`);
    console.log(`🌐 RENDER DEBUG - Platform: ${process.platform}`);
    console.log(`🌐 RENDER DEBUG - Node Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 RENDER DEBUG - Email Service Ready: ${emailService.isServiceReady()}`);

    try {
      await emailService.sendOTP(email, otp, 'reset');
      console.log(`✅ Password reset OTP sent successfully to: ${email}`);
      res.status(200).json({ message: "OTP sent." });
    } catch (emailError) {
      console.error("📧 Password reset OTP sending failed:", emailError);
      
      // ENHANCED RENDER DEBUGGING - Log comprehensive error details
      console.error("🚨 RENDER DEBUG INFO - Password Reset Email Failure Details:");
      console.error(`   📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.error(`   📍 Email Service Type: ${emailService.getServiceType()}`);
      console.error(`   📍 Target Email: ${email}`);
      console.error(`   📍 Timestamp: ${new Date().toISOString()}`);
      console.error(`   📍 Error Type: ${emailError.constructor.name}`);
      console.error(`   📍 Error Message: ${emailError.message}`);
      
      if (emailError.stack) {
        console.error(`   📍 Stack Trace: ${emailError.stack}`);
      }

      let errorMessage = "Failed to send OTP. Please check your email address and try again.";

      // Handle SendGrid specific errors
      if (emailError.response && emailError.response.body) {
        const sendGridError = emailError.response.body;
        console.error("📧 RENDER DEBUG - SendGrid Full Response Body:", JSON.stringify(sendGridError, null, 2));
        console.error("📧 RENDER DEBUG - SendGrid Status Code:", emailError.response.statusCode);
        console.error("📧 RENDER DEBUG - SendGrid Headers:", JSON.stringify(emailError.response.headers, null, 2));

        if (sendGridError.errors && sendGridError.errors.length > 0) {
          console.error("📧 RENDER DEBUG - SendGrid Error Array:");
          sendGridError.errors.forEach((err, index) => {
            console.error(`   Error ${index + 1}:`, JSON.stringify(err, null, 2));
          });
          
          const firstError = sendGridError.errors[0];
          if (firstError.message.includes('does not exist') || firstError.message.includes('invalid')) {
            errorMessage = "Invalid email address. Please check and try again.";
          } else if (firstError.message.includes('rate limit') || firstError.message.includes('quota')) {
            errorMessage = "Too many requests. Please wait a moment and try again.";
          } else if (firstError.message.includes('sender') || firstError.message.includes('verify') || firstError.message.includes('authentication')) {
            console.error("🚨 RENDER CRITICAL: SENDER VERIFICATION ISSUE DETECTED!");
            console.error("💡 ACTION REQUIRED: Verify sender email in SendGrid Dashboard");
            errorMessage = "Email service configuration issue. Please contact support.";
          } else {
            errorMessage = "Email service error. Please try again later.";
          }
        }
      }
      // Handle SMTP specific errors
      else if (emailError.code === 'ETIMEDOUT' || emailError.code === 'ECONNECTION') {
        console.error("📧 RENDER DEBUG - SMTP Connection Issue:", emailError.code);
        errorMessage = "Email service temporarily unavailable. Please try again later.";
      } else if (emailError.code === 'EAUTH') {
        console.error("📧 RENDER DEBUG - SMTP Authentication Issue:", emailError.code);
        errorMessage = "Email service authentication failed. Please try again later.";
      }
      // Handle general SendGrid errors
      else if (emailError.code >= 400 && emailError.code < 500) {
        console.error("📧 RENDER DEBUG - Client Error (4xx):", emailError.code);
        errorMessage = "Invalid email request. Please check your email and try again.";
      } else if (emailError.code >= 500) {
        console.error("📧 RENDER DEBUG - Server Error (5xx):", emailError.code);
        errorMessage = "Email service temporarily unavailable. Please try again later.";
      }
      
      console.error("🚨 RENDER DEBUG - Final Error Message Sent to Client:", errorMessage);
      res.status(500).json({ error: errorMessage });
    }
  } catch (err) {
    console.error("📧 Password reset error:", err.message);
    res.status(500).json({ error: "Server error during password reset." });
  }
});

// ---------- VERIFY RESET OTP ----------
router.post("/verify-reset-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Missing email or OTP." });
    }

    // Use checkOTPValidity instead of verifyOTP to avoid deleting the OTP
    const isValid = checkOTPValidity(email, otp, 'reset');
    if (!isValid) {
      return res.status(400).json({ error: "Wrong OTP." });
    }

    // Don't reset OTP here - keep it for the actual password reset
    // resetOTP(email, 'reset'); // Commented out

    return res.status(200).json({ message: "OTP verified." });
  } catch (error) {
    console.error("Verify reset OTP error:", error);
    return res.status(500).json({ error: "Server error during OTP verification." });
  }
});

// ---------- RESET PASSWORD ----------
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Email, OTP, and new password are required"
    });
  }

  try {
    // Verify OTP first
    const isValid = verifyOTP(email, otp, 'reset');
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link. Please request a new password reset."
      });
    }

    // Update password in database
    const { error } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('email', email);

    if (error) {
      console.error("Password update error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update password"
      });
    }

    // Clean up OTP after successful password reset
    resetOTP(email, 'reset');

    console.log("✅ Password reset successfully for:", email);
    res.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Verify reset token route
router.get("/verify-reset-token", async (req, res) => {
  const { email, otp } = req.query;

  console.log("🔍 Verify reset token request:", { email, otp });

  if (!email || !otp) {
    console.log("❌ Missing email or OTP in query params");
    return res.status(400).json({
      success: false,
      message: "Invalid reset link"
    });
  }

  try {
    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(400).json({
        success: false,
        message: "Invalid reset link"
      });
    }

    // Check OTP validity without consuming it
    const isValid = checkOTPValidity(email, otp, 'reset');
    console.log("🔍 OTP validity check result:", { email, otp, isValid });

    if (!isValid) {
      console.log("❌ OTP validation failed for reset token verification");
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link"
      });
    }

    res.json({
      success: true,
      message: "Valid reset token"
    });

  } catch (error) {
    console.error("Verify reset token error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ---------- USER PROGRESS ----------
router.get("/user/progress", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔐 User progress request for:", decoded.email);
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }

  const email = decoded.email;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('current_step, status')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      current_step: data.current_step || "identity",
      status: data.status || "pending"
    });
  } catch (err) {
    console.error("🔥 Progress fetch error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;