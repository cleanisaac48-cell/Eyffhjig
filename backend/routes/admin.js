const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: "Missing or invalid token format" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ success: false, message: "Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    console.log('Admin login attempt:', email);

    // Query admin from Supabase
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!data) {
      console.log('No admin found with email:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(password, data.password_hash);
    if (!isValid) {
      console.log('Invalid password for admin:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: data.id, email: data.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Admin login successful:', email);
    res.json({ 
      message: 'Login successful',
      token,
      admin: { id: data.id, email: data.email }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all users (admin only)
router.get("/users", authenticateAdmin, adminController.getAllUsers);

// Update user status (admin only)
router.post("/user/status", authenticateAdmin, adminController.updateUserStatus);

// Get user by ID (admin only)
router.get("/users/:id", authenticateAdmin, adminController.getUserById);

// Grant premium access to a user (admin only)
router.post("/grant-premium", authenticateAdmin, adminController.grantPremiumAccess);

// Remove premium access from a user (admin only)
router.post("/remove-premium", authenticateAdmin, adminController.removePremiumAccess);

// Dashboard stats endpoint
router.get("/dashboard-stats", authenticateAdmin, async (req, res) => {
  try {
    // Get total users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('subscription');

    if (usersError) {
      console.error("Users query error:", usersError);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const totalUsers = users.length;
    const activePremium = users.filter(user => user.subscription === 'premium').length;

    // Get pending media updates
    const { data: mediaUpdates, error: mediaError } = await supabase
      .from('pending_media_updates')
      .select('*')
      .eq('status', 'pending');

    const pendingMedia = mediaError ? 0 : mediaUpdates.length;

    // Get pending premium approvals
    const { data: premiumApprovals, error: premiumError } = await supabase
      .from('pending_premium_subscriptions')
      .select('*')
      .eq('status', 'pending');

    const pendingPremium = premiumError ? 0 : premiumApprovals.length;

    res.json({
      success: true,
      totalUsers,
      pendingMedia,
      pendingPremium,
      activePremium
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Media updates stats endpoint
router.get("/media-updates/stats", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pending_media_updates')
      .select('status');

    if (error) {
      console.error("Media stats error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const stats = {
      pending: data.filter(item => item.status === 'pending').length,
      approved: data.filter(item => item.status === 'approved').length,
      rejected: data.filter(item => item.status === 'rejected').length
    };

    res.json(stats);

  } catch (error) {
    console.error("Media stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Premium approvals stats endpoint
router.get("/premium-approvals/stats", authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pending_premium_subscriptions')
      .select('status');

    if (error) {
      console.error("Premium stats error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const stats = {
      pending: data.filter(item => item.status === 'pending').length,
      approved: data.filter(item => item.status === 'approved').length,
      rejected: data.filter(item => item.status === 'rejected').length
    };

    res.json(stats);

  } catch (error) {
    console.error("Premium stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Media updates endpoints
router.get("/media-updates", authenticateAdmin, async (req, res) => {
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

router.post("/media-updates/review", authenticateAdmin, async (req, res) => {
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

// Premium subscriptions endpoints
router.get("/premium-subscriptions", authenticateAdmin, async (req, res) => {
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

router.post("/premium-subscriptions/review", authenticateAdmin, async (req, res) => {
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
        // Find the user by email
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('email', subscription.user_email)
          .single();

        if (user) {
          // Create active subscription
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 30); // 30 days

          await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              user_email: subscription.user_email,
              plan: 'premium',
              status: 'active',
              start_date: new Date().toISOString(),
              end_date: endDate.toISOString(),
              amount_paid: subscription.amount,
              currency: subscription.currency,
              payment_method: subscription.payment_method
            });

          // Update user's subscription status
          await supabase
            .from('users')
            .update({ subscription: 'premium' })
            .eq('id', user.id);
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

module.exports = router;