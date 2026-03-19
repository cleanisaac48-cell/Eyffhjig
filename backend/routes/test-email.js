
require("dotenv").config();
const express = require("express");
const router = express.Router();
const emailService = require("../services/emailService");

// Test email sending endpoint with comprehensive Render debugging
router.post("/test-email", async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  console.log(`🧪 RENDER DEBUG - Starting email test for: ${email}`);
  console.log(`🧪 RENDER DEBUG - Service type: ${emailService.getServiceType()}`);
  console.log(`🧪 RENDER DEBUG - Service ready: ${emailService.isServiceReady()}`);
  
  // Environment check
  const envCheck = {
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET',
    EMAIL_USER: process.env.EMAIL_USER || 'NOT SET',
    GMAIL_USER: process.env.GMAIL_USER || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
  
  console.log(`🧪 RENDER DEBUG - Environment check:`, envCheck);

  try {
    const testOtp = "123456";
    const startTime = Date.now();
    
    await emailService.sendOTP(email, testOtp, 'test');
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ RENDER SUCCESS - Test email sent in ${duration}ms to: ${email}`);
    res.status(200).json({ 
      success: true, 
      message: "Test email sent successfully",
      serviceType: emailService.getServiceType(),
      duration: duration,
      environment: envCheck
    });
  } catch (error) {
    console.error(`❌ RENDER ERROR - Test email failed for: ${email}`);
    console.error(`❌ RENDER ERROR - Error details:`, {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      serviceType: emailService.getServiceType(),
      errorCode: error.code,
      environment: envCheck
    });
  }
});

// Add a diagnostic endpoint specifically for Render
router.get("/email-diagnostics", async (req, res) => {
  console.log(`🔧 RENDER DEBUG - Email diagnostics requested`);
  
  const diagnostics = {
    platform: {
      isRender: !!(process.env.RENDER || process.env.RENDER_SERVICE_ID),
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime()
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? {
        present: true,
        length: process.env.SENDGRID_API_KEY.length,
        startsWithSG: process.env.SENDGRID_API_KEY.startsWith('SG.'),
        preview: process.env.SENDGRID_API_KEY.substring(0, 15) + '...'
      } : { present: false },
      EMAIL_USER: process.env.EMAIL_USER || 'not set',
      GMAIL_USER: process.env.GMAIL_USER || 'not set'
    },
    emailService: {
      type: emailService.getServiceType(),
      ready: emailService.isServiceReady(),
      usesSendGrid: emailService.usesSendGrid
    }
  };
  
  console.log(`🔧 RENDER DEBUG - Diagnostics:`, JSON.stringify(diagnostics, null, 2));
  
  res.json({
    success: true,
    diagnostics: diagnostics,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
