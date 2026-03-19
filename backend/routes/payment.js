const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ dest: '/tmp/' });

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure PayPal
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Get PayPal access token
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, 
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('PayPal token error:', error);
    throw new Error('Failed to get PayPal access token');
  }
}

// Middleware to authenticate user
const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT Authentication error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid token', error: error.message });
  }
};

// PayPal payment creation endpoint
router.post('/paypal/create', authenticateUser, async (req, res) => {
  try {
    const { plan, amount } = req.body;
    const userEmail = req.user.email;

    if (!plan || !amount) {
      return res.status(400).json({ success: false, message: 'Plan and amount are required' });
    }

    // Create PayPal order
    const order = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: amount.toString()
        },
        description: `Takeyours ${plan} Premium Subscription`,
        custom_id: `${userEmail}_${plan}_${Date.now()}`
      }],
      application_context: {
        return_url: `${req.protocol}://${req.get('host')}/api/payment/paypal/success`,
        cancel_url: `${req.protocol}://${req.get('host')}/api/payment/paypal/cancel`,
        brand_name: 'Takeyours',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        payment_method: {
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
          payer_selected: 'PAYPAL'
        }
      }
    };

    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, order, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    const orderData = response.data;

    // Store pending payment in database
    await supabase
      .from('pending_premium_subscriptions')
      .insert({
        user_email: userEmail,
        payment_method: 'paypal',
        amount: parseFloat(amount),
        currency: 'USD',
        transaction_reference: orderData.id,
        plan: plan,
        status: 'pending',
        requested_at: new Date().toISOString(),
        paypal_order_id: orderData.id
      });

    // Find approval URL
    const approvalUrl = orderData.links.find(link => link.rel === 'approve');

    if (!approvalUrl) {
      throw new Error('No approval URL found in PayPal response');
    }

    res.json({ 
      success: true, 
      approval_url: approvalUrl.href,
      order_id: orderData.id
    });

  } catch (error) {
    console.error('PayPal order creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create PayPal order' 
    });
  }
});

// PayPal payment success callback
router.get('/paypal/success', async (req, res) => {
  try {
    const { PayerID, paymentId, token } = req.query;

    if (!paymentId) {
      return res.redirect('/subscriptions.html?status=error&message=Missing payment ID');
    }

    // Capture the PayPal order
    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paymentId}/capture`, {}, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    const orderData = response.data;

    if (orderData.status === 'COMPLETED') {
      // Find the pending subscription
      const { data: pendingSubscription, error } = await supabase
        .from('pending_premium_subscriptions')
        .select('*')
        .eq('paypal_order_id', paymentId)
        .single();

      if (!error && pendingSubscription) {
        // Get user ID
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('email', pendingSubscription.user_email)
          .single();

        if (user) {
          // Calculate subscription end date
          let endDate = new Date();
          switch (pendingSubscription.plan) {
            case 'weekly':
              endDate.setDate(endDate.getDate() + 7);
              break;
            case 'monthly':
              endDate.setMonth(endDate.getMonth() + 1);
              break;
            case 'yearly':
              endDate.setFullYear(endDate.getFullYear() + 1);
              break;
            default:
              endDate.setMonth(endDate.getMonth() + 1);
          }

          // Create active subscription
          await supabase
            .from('subscriptions')
            .insert({
              user_id: user.id,
              user_email: pendingSubscription.user_email,
              plan: 'premium',
              status: 'active',
              start_date: new Date().toISOString(),
              end_date: endDate.toISOString(),
              amount_paid: pendingSubscription.amount,
              currency: 'USD',
              payment_method: 'paypal',
              paypal_order_id: paymentId
            });

          // Update user subscription status
          await supabase
            .from('users')
            .update({ subscription: 'premium' })
            .eq('id', user.id);

          // Update pending subscription status
          await supabase
            .from('pending_premium_subscriptions')
            .update({
              status: 'approved',
              reviewed_at: new Date().toISOString(),
              admin_message: 'Payment completed successfully via PayPal'
            })
            .eq('id', pendingSubscription.id);
        }
      }

      res.redirect('/subscriptions.html?status=success&message=Payment completed successfully');
    } else {
      res.redirect('/subscriptions.html?status=error&message=Payment not completed');
    }
  } catch (error) {
    console.error('PayPal success callback error:', error);
    res.redirect('/subscriptions.html?status=error&message=Payment processing failed');
  }
});

// PayPal payment cancel callback
router.get('/paypal/cancel', async (req, res) => {
  res.redirect('/subscriptions.html?status=cancelled&message=Payment was cancelled');
});

// Enhanced crypto payment verification

// Enhanced crypto payment verification
router.post('/crypto/verify', authenticateUser, upload.single('transaction_proof'), async (req, res) => {
  try {
    const { plan, amount, crypto_type, transaction_id, payment_reference } = req.body;
    const proofFile = req.file;
    const userEmail = req.user.email;

    if (!plan || !amount || !crypto_type || !transaction_id || !proofFile) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields and transaction proof are required' 
      });
    }

    // Upload proof to Cloudinary
    const proofUpload = await cloudinary.uploader.upload(proofFile.path, {
      folder: 'payment_proofs',
      resource_type: 'auto'
    });

    // Store pending subscription
    const { error } = await supabase
      .from('pending_premium_subscriptions')
      .insert({
        user_email: userEmail,
        payment_method: 'crypto',
        payment_proof_url: proofUpload.secure_url,
        amount: parseFloat(amount),
        currency: crypto_type,
        transaction_reference: transaction_id,
        plan: plan,
        status: 'pending',
        requested_at: new Date().toISOString(),
        crypto_type: crypto_type
      });

    // Clean up temp file
    const fs = require('fs');
    fs.unlink(proofFile.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ 
      success: true, 
      message: 'Crypto payment submitted for review. Admin will verify and approve within 24 hours.' 
    });
  } catch (error) {
    console.error('Crypto payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify crypto payment' 
    });
  }
});

// M-Pesa payment verification (enhanced)
router.post('/mpesa/verify', authenticateUser, upload.single('payment_proof'), async (req, res) => {
  try {
    const { plan, amount, transaction_id, phone_number } = req.body;
    const proofFile = req.file;
    const userEmail = req.user.email;

    if (!plan || !amount || !transaction_id || !phone_number || !proofFile) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields and payment proof are required' 
      });
    }

    // Upload proof to Cloudinary
    const proofUpload = await cloudinary.uploader.upload(proofFile.path, {
      folder: 'payment_proofs',
      resource_type: 'auto'
    });

    // Store pending subscription
    const { error } = await supabase
      .from('pending_premium_subscriptions')
      .insert({
        user_email: userEmail,
        payment_method: 'mpesa',
        payment_proof_url: proofUpload.secure_url,
        amount: parseFloat(amount),
        currency: 'KES',
        transaction_reference: transaction_id,
        plan: plan,
        status: 'pending',
        requested_at: new Date().toISOString(),
        phone_number: phone_number
      });

    // Clean up temp file
    const fs = require('fs');
    fs.unlink(proofFile.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    res.json({ 
      success: true, 
      message: 'M-Pesa payment submitted for review. Admin will verify and approve within 24 hours.' 
    });
  } catch (error) {
    console.error('M-Pesa payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to verify M-Pesa payment' 
    });
  }
});



// Get payment status
router.get('/status/:reference', authenticateUser, async (req, res) => {
  try {
    const { reference } = req.params;
    const userEmail = req.user.email;

    const { data: payment, error } = await supabase
      .from('pending_premium_subscriptions')
      .select('*')
      .eq('transaction_reference', reference)
      .eq('user_email', userEmail)
      .single();

    if (error || !payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    res.json({
      success: true,
      payment: {
        status: payment.status,
        plan: payment.plan,
        amount: payment.amount,
        currency: payment.currency,
        payment_method: payment.payment_method,
        requested_at: payment.requested_at,
        reviewed_at: payment.reviewed_at,
        admin_message: payment.admin_message
      }
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get payment status' 
    });
  }
});

module.exports = router;