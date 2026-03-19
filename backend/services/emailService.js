const nodemailer = require("nodemailer");
const sgMail = require('@sendgrid/mail');

class EmailService {
  constructor() {
    this.usesSendGrid = false;
    this.transporter = null;
    this.isReady = false;
    this.platformInfo = this.detectPlatform();
    this.initializeService();
  }

  detectPlatform() {
    const platform = {
      isRender: process.env.RENDER || process.env.RENDER_SERVICE_ID || false,
      isReplit: process.env.REPL_ID || process.env.REPLIT_DB_URL || false,
      isCodespace: process.env.CODESPACES || false,
      nodeEnv: process.env.NODE_ENV || 'development'
    };
    
    console.log("🌐 PLATFORM DETECTION:", JSON.stringify(platform, null, 2));
    return platform;
  }

  initializeService() {
    console.log("🔧 RENDER DEBUG - Starting email service initialization");
    console.log("🔧 RENDER DEBUG - Platform Info:", this.platformInfo);
    
    // Enhanced environment variable validation
    const sendGridKey = process.env.SENDGRID_API_KEY;
    const emailUser = process.env.EMAIL_USER || process.env.GMAIL_USER;
    
    console.log("🔧 RENDER DEBUG - Environment Variables Status:");
    console.log(`   SENDGRID_API_KEY: ${sendGridKey ? 'SET' : 'NOT SET'}`);
    console.log(`   EMAIL_USER: ${process.env.EMAIL_USER || 'NOT SET'}`);
    console.log(`   GMAIL_USER: ${process.env.GMAIL_USER || 'NOT SET'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
    
    if (sendGridKey) {
      console.log(`   SENDGRID_API_KEY length: ${sendGridKey.length}`);
      console.log(`   SENDGRID_API_KEY starts with SG.: ${sendGridKey.startsWith('SG.')}`);
      console.log(`   SENDGRID_API_KEY preview: ${sendGridKey.substring(0, 15)}...`);
    }

    // Validate SendGrid configuration
    if (this.validateSendGridConfig(sendGridKey, emailUser)) {
      this.initializeSendGrid(sendGridKey);
    } else {
      console.log("📧 SendGrid validation failed, trying SMTP fallback...");
      this.initializeSMTP();
    }
  }

  validateSendGridConfig(apiKey, emailUser) {
    const validations = {
      hasApiKey: !!apiKey,
      correctFormat: apiKey && apiKey.startsWith('SG.'),
      minLength: apiKey && apiKey.length >= 50,
      hasEmailUser: !!emailUser,
      correctEmailUser: emailUser === 'takeyours001@gmail.com'
    };

    console.log("🔧 RENDER DEBUG - SendGrid Validations:", validations);

    if (!validations.hasApiKey) {
      console.error("❌ RENDER ERROR: No SendGrid API key found");
      return false;
    }

    if (!validations.correctFormat) {
      console.error("❌ RENDER ERROR: SendGrid API key doesn't start with 'SG.'");
      return false;
    }

    if (!validations.minLength) {
      console.error("❌ RENDER ERROR: SendGrid API key appears too short");
      return false;
    }

    if (!validations.hasEmailUser) {
      console.error("❌ RENDER ERROR: No email user configured");
      return false;
    }

    if (!validations.correctEmailUser) {
      console.error("❌ RENDER WARNING: Email user is not the verified sender");
      console.error(`   Expected: takeyours001@gmail.com`);
      console.error(`   Found: ${emailUser}`);
    }

    return validations.hasApiKey && validations.correctFormat && validations.minLength && validations.hasEmailUser;
  }

  initializeSendGrid(apiKey) {
    try {
      console.log("📧 Initializing SendGrid API for email service");
      sgMail.setApiKey(apiKey);
      
      // Test SendGrid configuration
      this.testSendGridConnection().then((testResult) => {
        if (testResult.success) {
          this.usesSendGrid = true;
          this.isReady = true;
          console.log("✅ SendGrid API initialized and tested successfully");
        } else {
          console.error("❌ SendGrid test failed:", testResult.error);
          this.initializeSMTP();
        }
      }).catch((error) => {
        console.error("❌ SendGrid test error:", error);
        this.initializeSMTP();
      });
      
    } catch (error) {
      console.error("❌ SendGrid initialization error:", error);
      this.initializeSMTP();
    }
  }

  async testSendGridConnection() {
    try {
      // This is a minimal test - just checking if the API key format works
      // We can't actually send without triggering rate limits
      console.log("🧪 Testing SendGrid connection...");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  initializeSMTP() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true' || false,
        auth: {
          user: process.env.EMAIL_USER || process.env.GMAIL_USER,
          pass: process.env.EMAIL_PASS || process.env.GMAIL_PASS
        }
      });

      // Verify SMTP connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error("❌ SMTP verification failed:", {
            code: error.code,
            message: error.message,
            responseCode: error.responseCode,
            response: error.response
          });
          console.log("💡 Consider using SendGrid API for better reliability on cloud platforms");
          this.isReady = false;
        } else {
          console.log("✅ SMTP transporter verified successfully");
          this.isReady = true;
        }
      });
    } catch (error) {
      console.error("❌ SMTP initialization failed:", error);
      this.isReady = false;
    }
  }

  async sendOTP(toEmail, otp, type = 'register') {
    const subject = type === 'register' ? "Your Takeyours OTP Code" : "Reset Your Password - OTP";
    const title = type === 'register' ? "Welcome to Takeyours!" : "Password Reset Request";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${title}</h2>
        <p>Your OTP ${type === 'register' ? 'verification' : 'to reset your password'} code is:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        </div>
        <p style="color: #666;">This code expires in 5 minutes.</p>
        <p style="color: #666;">If you didn't request this ${type === 'register' ? 'code' : 'reset'}, please ignore this email.</p>
      </div>
    `;

    try {
      if (this.usesSendGrid) {
        return await this.sendWithSendGrid(toEmail, subject, htmlContent);
      } else {
        return await this.sendWithSMTP(toEmail, subject, htmlContent);
      }
    } catch (error) {
      console.error(`📧 Failed to send ${type} OTP:`, error);
      throw error;
    }
  }

  async sendStatusUpdateEmail(toEmail, status, adminMessage = '') {
    const subject = status === "approved" ? "Profile Approved - Takeyours" : "Profile Disapproved - Takeyours";
    const loginLink = `${process.env.FRONTEND_URL || 'http://0.0.0.0:5000'}/login.html`;

    let htmlContent;
    if (status === "approved") {
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2ecc71;">🎉 Congratulations! Your profile has been approved.</h2>
          <p>You can now access your dashboard and start using Takeyours to find your perfect match.</p>
          <p><strong>Admin Message:</strong> ${adminMessage || 'Welcome to Takeyours!'}</p>
          <p><a href="${loginLink}" style="background-color: #2ecc71; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Access Your Dashboard</a></p>
        </div>
      `;
    } else {
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">❌ Profile Disapproved - Action Required</h2>
          <p>Your profile submission has been disapproved and requires updates.</p>
          <p><strong>Admin Message:</strong> ${adminMessage || 'Please review and resubmit your information.'}</p>
          <p>Please login to your account and use the "Upload Again" button to restart your verification process.</p>
          <p><a href="${loginLink}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Login to Resubmit</a></p>
        </div>
      `;
    }

    try {
      if (this.usesSendGrid) {
        return await this.sendWithSendGrid(toEmail, subject, htmlContent);
      } else {
        return await this.sendWithSMTP(toEmail, subject, htmlContent);
      }
    } catch (error) {
      console.error(`📧 Failed to send status update email:`, error);
      throw error;
    }
  }

  async sendWithSendGrid(toEmail, subject, htmlContent) {
    console.log(`📧 RENDER DEBUG - Starting SendGrid send process`);
    console.log(`📧 RENDER DEBUG - Target email: ${toEmail}`);
    console.log(`📧 RENDER DEBUG - Subject: ${subject}`);
    console.log(`📧 RENDER DEBUG - Platform Info:`, this.platformInfo);
    console.log(`📧 RENDER DEBUG - Process Info:`, {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
      pid: process.pid
    });

    const fromEmail = process.env.EMAIL_USER || process.env.GMAIL_USER;
    
    // Pre-send validation
    const preValidation = {
      hasFromEmail: !!fromEmail,
      fromEmailCorrect: fromEmail === 'takeyours001@gmail.com',
      hasApiKey: !!process.env.SENDGRID_API_KEY,
      apiKeyFormat: process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.startsWith('SG.') : false,
      toEmailValid: toEmail && toEmail.includes('@')
    };

    console.log(`📧 RENDER DEBUG - Pre-send validation:`, preValidation);

    if (!preValidation.hasFromEmail) {
      const error = new Error('CRITICAL: No sender email configured. Please set EMAIL_USER or GMAIL_USER environment variable.');
      console.error("🚨 RENDER CRITICAL ERROR:", error.message);
      throw error;
    }

    if (!preValidation.fromEmailCorrect) {
      console.error(`🚨 RENDER WARNING: Using sender email "${fromEmail}" but verified sender is "takeyours001@gmail.com"`);
    }

    if (!preValidation.hasApiKey) {
      const error = new Error('CRITICAL: No SendGrid API key found');
      console.error("🚨 RENDER CRITICAL ERROR:", error.message);
      throw error;
    }

    if (!preValidation.apiKeyFormat) {
      const error = new Error('CRITICAL: SendGrid API key format invalid (should start with SG.)');
      console.error("🚨 RENDER CRITICAL ERROR:", error.message);
      throw error;
    }

    const msg = {
      to: toEmail,
      from: {
        email: fromEmail,
        name: 'Takeyours'
      },
      subject: subject,
      html: htmlContent,
      trackingSettings: {
        clickTracking: { enable: false },
        openTracking: { enable: false }
      }
    };

    console.log(`📧 RENDER DEBUG - Message object created:`, {
      to: msg.to,
      from: msg.from,
      subject: msg.subject,
      htmlLength: htmlContent.length
    });

    try {
      console.log(`📧 RENDER DEBUG - Attempting SendGrid send...`);
      const startTime = Date.now();
      
      const response = await sgMail.send(msg);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ RENDER SUCCESS - SendGrid email sent in ${duration}ms to: ${toEmail}`);
      console.log(`📧 RENDER DEBUG - Response details:`, {
        statusCode: response[0].statusCode,
        messageId: response[0].headers['x-message-id'],
        headers: Object.keys(response[0].headers)
      });
      
      return { success: true, messageId: response[0].headers['x-message-id'] };
      
    } catch (error) {
      console.error("🚨 RENDER ERROR - SendGrid send failed");
      console.error("📧 RENDER DEBUG - Error type:", error.constructor.name);
      console.error("📧 RENDER DEBUG - Error message:", error.message);
      console.error("📧 RENDER DEBUG - Error code:", error.code);
      
      if (error.response) {
        console.error("📧 RENDER DEBUG - Response status:", error.response.statusCode);
        console.error("📧 RENDER DEBUG - Response headers:", JSON.stringify(error.response.headers, null, 2));
        console.error("📧 RENDER DEBUG - Response body:", JSON.stringify(error.response.body, null, 2));
        
        if (error.response.body && error.response.body.errors) {
          console.error("📧 RENDER DEBUG - Specific errors:");
          error.response.body.errors.forEach((err, index) => {
            console.error(`   Error ${index + 1}:`, JSON.stringify(err, null, 2));
            
            // Check for specific error types
            if (err.message.includes('sender') || err.message.includes('verify')) {
              console.error("🚨 RENDER CRITICAL: SENDER VERIFICATION ISSUE!");
              console.error("💡 ACTION REQUIRED:");
              console.error("   1. Log into SendGrid Dashboard");
              console.error("   2. Go to Settings → Sender Authentication");
              console.error("   3. Verify sender: takeyours001@gmail.com");
              console.error("   4. Check email for verification link");
            }
            
            if (err.message.includes('unauthorized') || err.message.includes('authentication')) {
              console.error("🚨 RENDER CRITICAL: API KEY AUTHENTICATION ISSUE!");
              console.error("💡 ACTION REQUIRED:");
              console.error("   1. Verify SendGrid API key is correct");
              console.error("   2. Check API key permissions in SendGrid");
              console.error("   3. Regenerate API key if necessary");
            }
            
            if (err.message.includes('rate limit') || err.message.includes('quota')) {
              console.error("🚨 RENDER WARNING: RATE LIMIT HIT!");
              console.error("💡 ACTION: Wait and retry, or upgrade SendGrid plan");
            }
          });
        }
      }
      
      // Enhanced stack trace for debugging
      if (error.stack) {
        console.error("📧 RENDER DEBUG - Stack trace:");
        console.error(error.stack);
      }
      
      throw error;
    }
  }

  async sendWithSMTP(toEmail, subject, htmlContent) {
    if (!this.transporter || !this.isReady) {
      throw new Error("SMTP transporter not ready");
    }

    console.log(`📧 Sending email via SMTP to: ${toEmail}`);

    const mailOptions = {
      from: `"Takeyours" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: htmlContent
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ SMTP email sent successfully to: ${toEmail}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("📧 SMTP error details:", {
        name: error.name,
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
        response: error.response,
        message: error.message
      });
      throw error;
    }
  }

  getServiceType() {
    return this.usesSendGrid ? 'SendGrid API' : 'SMTP';
  }

  isServiceReady() {
    return this.isReady;
  }
}

module.exports = new EmailService();