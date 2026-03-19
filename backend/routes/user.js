const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  getUserProgress,
  resetUserSubmission,
  resetIdentityOnly,
  resetPersonalOnly,
  savePersonalInfo,
  savePreferences,
  getCurrentPreferences,
  updatePreferences,
  getUserProfilePhoto,
  updateMedia, // Assuming updateMedia is also in userController
  setMediaUpdateTimestamp // Assuming this controller function will be added
} = require("../controller/userController");

// Configure multer for personal info files
const personalUpload = multer({
  dest: path.join(__dirname, "../temp"),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

router.get("/progress", getUserProgress);
router.post("/reset-submission", resetUserSubmission);
router.post("/reset-identity", resetIdentityOnly);
router.post("/reset-personal", resetPersonalOnly);
router.post("/personal", personalUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'profileVideo', maxCount: 1 }
]), savePersonalInfo);
router.post("/preferences", savePreferences);
router.get("/current-preferences", getCurrentPreferences);
router.put("/update-preferences", updatePreferences);
router.get("/profile-photo/:email", getUserProfilePhoto);
router.post("/update-media", personalUpload.fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'profileVideo', maxCount: 1 }
]), updateMedia);

// Add route for media update timestamp
router.put("/set-media-update-timestamp", setMediaUpdateTimestamp);


// Add subscription status endpoint
router.get("/subscription-status", async (req, res) => {
  try {
    const jwt = require("jsonwebtoken");
    const { createClient } = require("@supabase/supabase-js");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.json({ subscription: 'free' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed in subscription-status:', jwtError.message);
      return res.json({ subscription: 'free' });
    }
    const email = decoded.email;

    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, subscription')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.json({ subscription: 'free' });
    }

    // Check for active subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .single();

    if (subscription) {
      const planType = subscription.plan === 'premium' ||
                      subscription.plan === 'weekly' ||
                      subscription.plan === 'monthly' ||
                      subscription.plan === 'yearly' ? 'premium' : 'free';

      await supabase
        .from('users')
        .update({ subscription: planType })
        .eq('id', user.id);

      res.json({ subscription: planType });
    } else {
      // Update user subscription to free if no active subscription found
      await supabase
        .from('users')
        .update({ subscription: 'free' })
        .eq('id', user.id);

      res.json({ subscription: 'free' });
    }
  } catch (error) {
    console.error('Subscription check error:', error);
    res.json({ subscription: 'free' });
  }
});

// Add conversations endpoint - get from accepted mutual matches
router.get("/conversations", async (req, res) => {
  try {
    const jwt = require("jsonwebtoken");
    const { createClient } = require("@supabase/supabase-js");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.json([]);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed in conversations:', jwtError.message);
      return res.json([]);
    }
    const email = decoded.email;

    // Get current user ID
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (userError || !currentUser) {
      return res.json([]);
    }

    const currentUserId = currentUser.id;

    // Get all users that current user has accepted
    const { data: acceptedByCurrentUser, error: acceptedError } = await supabase
      .from('user_interactions')
      .select(`
        target_user_id,
        users!user_interactions_target_user_id_fkey(id, full_name, profile_photo_url)
      `)
      .eq('current_user_id', currentUserId)
      .eq('action', 'accepted');

    if (acceptedError) {
      console.error('Error fetching accepted matches:', acceptedError);
      return res.json([]);
    }

    // Filter to only include mutual matches (both users accepted each other)
    const conversations = [];
    for (const match of acceptedByCurrentUser) {
      const { data: reverseMatch, error: reverseError } = await supabase
        .from('user_interactions')
        .select('id')
        .eq('current_user_id', match.target_user_id)
        .eq('target_user_id', currentUserId)
        .eq('action', 'accepted')
        .single();

      if (!reverseError && reverseMatch) {
        const user = match.users;

        // Get last message and unread count for this conversation
        const { data: messages, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${user.id}),and(sender_id.eq.${user.id},receiver_id.eq.${currentUserId})`)
          .order('sent_at', { ascending: false })
          .limit(1);

        let lastMessage = 'Start a conversation...';
        if (messages && messages.length > 0) {
          lastMessage = messages[0].message;
        }

        // Count unread messages from this user
        const { data: unreadMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('sender_id', user.id)
          .eq('receiver_id', currentUserId)
          .eq('read', false);

        conversations.push({
          user_id: user.id,
          user_name: user.full_name,
          profile_photo_url: user.profile_photo_url,
          last_message: lastMessage,
          last_message_time: messages && messages.length > 0 ? messages[0].sent_at : null,
          unread_count: unreadMessages ? unreadMessages.length : 0
        });
      }
    }

    res.json(conversations);
  } catch (error) {
    console.error('Conversations error:', error);
    res.json([]);
  }
});

// Add payment status endpoint
router.get("/payment-status", async (req, res) => {
  try {
    const jwt = require("jsonwebtoken");
    const { createClient } = require("@supabase/supabase-js");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.json({ pending: false });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed in payment-status:', jwtError.message);
      return res.json({ pending: false });
    }
    const email = decoded.email;

    // Check for pending payment approvals
    const { data: pendingPayments, error } = await supabase
      .from('payment_approvals')
      .select('*')
      .eq('user_email', email)
      .eq('status', 'pending')
      .or('status.eq.approved,status.eq.disapproved')
      .not('admin_message', 'is', null);

    if (pendingPayments && pendingPayments.length > 0) {
      const payment = pendingPayments[0];
      res.json({
        pending: true,
        status: payment.status,
        admin_message: payment.admin_message
      });
    } else {
      res.json({ pending: false });
    }
  } catch (error) {
    console.error('Payment status check error:', error);
    res.json({ pending: false });
  }
});

// Clear admin message
router.post("/clear-message", async (req, res) => {
  try {
    const jwt = require("jsonwebtoken");
    const { createClient } = require("@supabase/supabase-js");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed in clear-message:', jwtError.message);
      return res.status(401).json({ success: false });
    }
    const email = decoded.email;

    await supabase
      .from('payment_approvals')
      .update({ admin_message: null })
      .eq('user_email', email);

    res.json({ success: true });
  } catch (error) {
    console.error('Clear message error:', error);
    res.json({ success: false });
  }
});

module.exports = router;