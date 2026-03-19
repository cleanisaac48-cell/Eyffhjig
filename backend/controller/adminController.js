const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");
const emailService = require("../services/emailService");

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Using centralized EmailService (SendGrid/SMTP)
console.log(`📧 Admin Controller using Email Service: ${emailService.getServiceType()}`);

// Admin login
exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password required" });
  }

  try {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Import bcrypt for password verification
    const bcrypt = require("bcrypt");
    const passwordMatch = await bcrypt.compare(password, data.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ email: data.email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      admin: { email: data.email }
    });
  } catch (err) {
    console.error("Admin login error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Get users error:", error.message);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    res.json({ success: true, users: data });
  } catch (err) {
    console.error("Get users error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update user status
exports.updateUserStatus = async (req, res) => {
  const { userId, status, adminMessage } = req.body;

  if (!userId || !status) {
    return res.status(400).json({ success: false, message: "User ID and status required" });
  }

  try {
    let updateData = {
      status: status,
      admin_message: adminMessage || null,
      updated_at: new Date().toISOString()
    };

    // If approved, set current_step to dashboard
    if (status === "approved") {
      updateData.current_step = "dashboard";
    }
    // If disapproved, keep current_step as submission for upload again functionality
    else if (status === "disapproved") {
      updateData.current_step = "submission";
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) {
      console.error("Update status error:", error.message);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Send email notification using EmailService (SendGrid/SMTP)
    const user = data[0];
    if (user.email) {
      try {
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(user.email)) {
          console.error(`❌ Invalid email format: ${user.email}`);
          return res.json({ success: true, message: "User status updated successfully (email invalid)" });
        }

        console.log(`📧 Attempting to send status update email to: ${user.email} using ${emailService.getServiceType()}`);
        
        if (emailService.isServiceReady()) {
          await emailService.sendStatusUpdateEmail(user.email, status, adminMessage);
          console.log(`✅ Status update email sent successfully to: ${user.email} (Status: ${status})`);
        } else {
          console.warn(`📧 Email service not ready. Email not sent to ${user.email}`);
        }
      } catch (emailError) {
        console.error("📧 Status update email sending failed:", emailError);
        
        // ENHANCED RENDER DEBUGGING for admin emails
        console.error("🚨 RENDER DEBUG INFO - Admin Email Failure Details:");
        console.error(`   📍 Email Service Type: ${emailService.getServiceType()}`);
        console.error(`   📍 Target Email: ${user.email}`);
        console.error(`   📍 Status: ${status}`);
        console.error(`   📍 Admin Message: ${adminMessage || 'N/A'}`);
        console.error(`   📍 Error Type: ${emailError.constructor.name}`);
        console.error(`   📍 Error Message: ${emailError.message}`);
        
        if (emailError.response && emailError.response.body) {
          console.error("📧 RENDER DEBUG - SendGrid Admin Email Error:", JSON.stringify(emailError.response.body, null, 2));
        }
        
        // Don't fail the request if email fails - admin status update should still succeed
      }
    }

    res.json({ success: true, message: "User status updated successfully" });
  } catch (err) {
    console.error("Update status error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Get user error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!data || error?.code === 'PGRST116') {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: data });
  } catch (err) {
    console.error("Get user error:", err.message);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Grant premium access to a user
exports.grantPremiumAccess = async (req, res) => {
  try {
    const { email, days = 30 } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Find the user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if user already has an active subscription
    const { data: existingSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      // Update existing subscription to extend it
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + parseInt(days));

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          end_date: newEndDate.toISOString(),
          plan: 'premium'
        })
        .eq('id', existingSubscription.id);

      if (updateError) {
        return res.status(500).json({ success: false, message: updateError.message });
      }
    } else {
      // Create new subscription
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + parseInt(days));

      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan: 'premium',
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString()
        });

      if (insertError) {
        return res.status(500).json({ success: false, message: insertError.message });
      }
    }

    // Update user's subscription status
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ subscription: 'premium' })
      .eq('id', user.id);

    if (userUpdateError) {
      return res.status(500).json({ success: false, message: userUpdateError.message });
    }

    res.json({
      success: true,
      message: `Premium access granted to ${email} for ${days} days`
    });

  } catch (error) {
    console.error("Grant premium access error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Remove premium access from a user
exports.removePremiumAccess = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Find the user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Deactivate all subscriptions for this user
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        end_date: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (subError) {
      return res.status(500).json({ success: false, message: subError.message });
    }

    // Update user's subscription status to free
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ subscription: 'free' })
      .eq('id', user.id);

    if (userUpdateError) {
      return res.status(500).json({ success: false, message: userUpdateError.message });
    }

    res.json({
      success: true,
      message: `Premium access removed from ${email}`
    });

  } catch (error) {
    console.error("Remove premium access error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};