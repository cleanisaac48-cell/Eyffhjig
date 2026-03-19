require("dotenv").config();
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Get current user ID by email
async function getUserIdByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();
  
  if (error) throw error;
  return data.id;
}

// Mark messages as read when user opens chat
router.post('/mark-read/:userId', verifyToken, async (req, res) => {
  try {
    const currentUserEmail = req.user.email;
    const otherUserId = req.params.userId;
    
    // Get current user ID
    const currentUserId = await getUserIdByEmail(currentUserEmail);
    
    // Mark all messages from the other user as read
    const { error } = await supabase
      .from('messages')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Send a message
router.post("/send", verifyToken, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderEmail = req.user.email;
    
    if (!receiverId || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Receiver ID and message are required" });
    }
    
    // Get sender ID
    const senderId = await getUserIdByEmail(senderEmail);
    
    // Check if users are mutual matches (both have accepted each other)
    const { data: senderAccepted } = await supabase
      .from('user_interactions')
      .select('id')
      .eq('current_user_id', senderId)
      .eq('target_user_id', receiverId)
      .eq('action', 'accepted')
      .single();
    
    const { data: receiverAccepted } = await supabase
      .from('user_interactions')
      .select('id')
      .eq('current_user_id', receiverId)
      .eq('target_user_id', senderId)
      .eq('action', 'accepted')
      .single();
    
    if (!senderAccepted || !receiverAccepted) {
      return res.status(403).json({ success: false, message: "You can only message mutual matches" });
    }
    
    // Insert message into database
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message: message.trim()
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error sending message:", error);
      return res.status(500).json({ success: false, message: "Failed to send message" });
    }
    
    res.json({ 
      success: true, 
      message: "Message sent successfully",
      data: data
    });
    
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get messages for a conversation
router.get("/conversation/:receiverId", verifyToken, async (req, res) => {
  try {
    const { receiverId } = req.params;
    const senderEmail = req.user.email;
    
    // Get sender ID
    const senderId = await getUserIdByEmail(senderEmail);
    
    // Get all messages between these two users
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        sender_id,
        receiver_id,
        message,
        created_at,
        read_at,
        sender:users!messages_sender_id_fkey(full_name, profile_photo_url),
        receiver:users!messages_receiver_id_fkey(full_name, profile_photo_url)
      `)
      .or(`and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch messages" });
    }
    
    // Mark messages as read where current user is receiver
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', receiverId)
      .eq('receiver_id', senderId)
      .is('read_at', null);
    
    res.json({ 
      success: true, 
      messages: messages || []
    });
    
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get recent conversations with last message
router.get("/conversations", verifyToken, async (req, res) => {
  try {
    const senderEmail = req.user.email;
    const senderId = await getUserIdByEmail(senderEmail);
    
    // Get all mutual matches
    const { data: mutualMatches, error: matchError } = await supabase
      .from('user_interactions')
      .select(`
        target_user_id,
        users!user_interactions_target_user_id_fkey(id, full_name, profile_photo_url)
      `)
      .eq('current_user_id', senderId)
      .eq('action', 'accepted');
    
    if (matchError) {
      console.error('Error fetching mutual matches:', matchError);
      return res.json({ success: true, conversations: [] });
    }
    
    const conversations = [];
    
    for (const match of mutualMatches || []) {
      // Check if it's a mutual match
      const { data: reverseMatch } = await supabase
        .from('user_interactions')
        .select('id')
        .eq('current_user_id', match.target_user_id)
        .eq('target_user_id', senderId)
        .eq('action', 'accepted')
        .single();
      
      if (reverseMatch) {
        const otherUserId = match.target_user_id;
        
        // Get last message between these users
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('message, created_at, sender_id')
          .or(`and(sender_id.eq.${senderId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${senderId})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        // Get unread count
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', otherUserId)
          .eq('receiver_id', senderId)
          .is('read_at', null);
        
        const user = match.users;
        conversations.push({
          user_id: user.id,
          user_name: user.full_name,
          profile_photo_url: user.profile_photo_url,
          last_message: lastMessage ? lastMessage.message : 'Start a conversation...',
          last_message_time: lastMessage ? lastMessage.created_at : null,
          unread_count: unreadCount || 0,
          is_last_message_mine: lastMessage ? lastMessage.sender_id === senderId : false
        });
      }
    }
    
    // Sort by last message time (most recent first)
    conversations.sort((a, b) => {
      if (!a.last_message_time) return 1;
      if (!b.last_message_time) return -1;
      return new Date(b.last_message_time) - new Date(a.last_message_time);
    });
    
    res.json({ success: true, conversations });
    
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;