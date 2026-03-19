let selectedPlan = null;
let selectedPaymentMethod = null;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Load current subscription status
  await loadCurrentSubscription();
});

async function loadCurrentSubscription() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${config.API_BASE_URL}/api/user/subscription`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const subscription = await response.json();
      updateUIForCurrentPlan(subscription);
    }
  } catch (error) {
    console.error('Error loading subscription:', error);
  }
}

function updateUIForCurrentPlan(subscription) {
  // Reset all buttons
  document.querySelectorAll('.subscribe-btn').forEach(btn => {
    btn.textContent = 'Subscribe';
    btn.className = 'subscribe-btn';
    btn.disabled = false;
  });

  // Update current plan
  const currentPlan = subscription.plan || 'free';
  const planCards = document.querySelectorAll('.pricing-card');

  planCards.forEach((card, index) => {
    const btn = card.querySelector('.subscribe-btn');
    const planNames = ['free', 'weekly', 'monthly', 'yearly'];

    if (planNames[index] === currentPlan) {
      btn.textContent = 'Current Plan';
      btn.className = 'subscribe-btn current-plan';
      btn.disabled = true;
    }
  });
}

function selectPlan(plan, price) {
  selectedPlan = { plan, price };

  if (!selectedPaymentMethod) {
    alert('Please select a payment method first.');
    return;
  }

  openPaymentModal();
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;

  // Update UI to show selected payment method
  document.querySelectorAll('.payment-option').forEach(option => {
    option.classList.remove('selected');
  });

  event.target.closest('.payment-option').classList.add('selected');
}

function openPaymentModal() {
  if (!selectedPlan || !selectedPaymentMethod) {
    alert('Please select both a plan and payment method.');
    return;
  }

  const modal = document.getElementById('paymentModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  modalTitle.textContent = `${selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)} Plan - $${selectedPlan.price}`;

  switch (selectedPaymentMethod) {
    case 'paypal':
      modalBody.innerHTML = createPayPalForm();
      break;
    case 'mpesa':
      modalBody.innerHTML = createMpesaForm();
      break;
    case 'crypto':
      modalBody.innerHTML = createCryptoForm();
      break;
    
  }

  modal.style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('paymentModal').style.display = 'none';
}

function createPayPalForm() {
  return `
    <div class="payment-info">
      <p><strong>Plan:</strong> ${selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)} Premium</p>
      <p><strong>Amount:</strong> $${selectedPlan.price}</p>
      <p><strong>Payment Method:</strong> PayPal / Credit Card</p>
    </div>
    <p>You will be redirected to PayPal to complete your payment securely.</p>
    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button class="subscribe-btn" onclick="processPayPalPayment()" style="flex: 1;">
        <span id="paypalSpinner" class="spinner"></span>
        Pay with PayPal or Card
      </button>
      <button class="subscribe-btn" onclick="closePaymentModal()" style="background: #6c757d; flex: 1;">Cancel</button>
    </div>
  `;
}

function createMpesaForm() {
  return `
    <div class="payment-info">
      <p><strong>Plan:</strong> ${selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)} Premium</p>
      <p><strong>Amount:</strong> $${selectedPlan.price}</p>
      <p><strong>Payment Method:</strong> M-Pesa</p>
    </div>
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p><strong>M-Pesa Payment Instructions:</strong></p>
      <p>1. Send <strong>KSH ${(selectedPlan.price * 130).toFixed(0)}</strong> to till <strong>6836928</strong></p>
      <p>2. Enter your transaction ID below</p>
      <p>3. Your subscription will be activated within 24 hours</p>
    </div>
    <div class="form-group">
      <label for="mpesaTransactionId">M-Pesa Transaction ID:</label>
      <input type="text" id="mpesaTransactionId" placeholder="e.g., QC12345678" required>
    </div>
    <div class="form-group">
      <label for="mpesaPhone">Your Phone Number:</label>
      <input type="tel" id="mpesaPhone" placeholder="e.g., 0712345678" required>
    </div>
    <div class="form-group">
      <label for="mpesaProof">Payment Proof (Screenshot):</label>
      <input type="file" id="mpesaProof" accept="image/*" required>
    </div>
    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button class="subscribe-btn" onclick="processMpesaPayment()" style="flex: 1;">
        <span id="mpesaSpinner" class="spinner"></span>
        Confirm Payment
      </button>
      <button class="subscribe-btn" onclick="closePaymentModal()" style="background: #6c757d; flex: 1;">Cancel</button>
    </div>
  `;
}

function createCryptoForm() {
  return `
    <div class="payment-info">
      <p><strong>Plan:</strong> ${selectedPlan.plan.charAt(0).toUpperCase() + selectedPlan.plan.slice(1)} Premium</p>
      <p><strong>Amount:</strong> $${selectedPlan.price}</p>
      <p><strong>Payment Method:</strong> Cryptocurrency</p>
    </div>
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0;">
      <p><strong>Cryptocurrency Payment Instructions:</strong></p>
      <p>1. Send <strong>$${selectedPlan.price}</strong> worth of crypto to our wallet</p>
      <p>2. Select cryptocurrency type and enter transaction ID</p>
      <p>3. Upload transaction proof screenshot</p>
      <p>4. Your subscription will be activated within 24 hours after verification</p>
    </div>
    <div class="form-group">
      <label for="cryptoType">Cryptocurrency:</label>
      <select id="cryptoType" required>
        <option value="">Select cryptocurrency</option>
        <option value="BTC">Bitcoin (BTC)</option>
        <option value="ETH">Ethereum (ETH)</option>
        <option value="USDT">Tether (USDT)</option>
        <option value="BNB">Binance Coin (BNB)</option>
        <option value="USDC">USD Coin (USDC)</option>
        <option value="ADA">Cardano (ADA)</option>
        <option value="DOT">Polkadot (DOT)</option>
        <option value="MATIC">Polygon (MATIC)</option>
      </select>
    </div>
    <div class="form-group">
      <label for="cryptoTransactionId">Transaction ID/Hash:</label>
      <input type="text" id="cryptoTransactionId" placeholder="e.g., 0x1234..." required>
    </div>
    <div class="form-group">
      <label for="cryptoProof">Transaction Proof (Screenshot):</label>
      <input type="file" id="cryptoProof" accept="image/*" required>
    </div>
    <div style="display: flex; gap: 10px; margin-top: 20px;">
      <button class="subscribe-btn" onclick="processCryptoPayment()" style="flex: 1;">
        <span id="cryptoSpinner" class="spinner"></span>
        Submit Payment
      </button>
      <button class="subscribe-btn" onclick="closePaymentModal()" style="background: #6c757d; flex: 1;">Cancel</button>
    </div>
  `;
}



async function processPayPalPayment() {
  const spinner = document.getElementById('paypalSpinner');
  spinner.style.display = 'inline-block';

  try {
    const token = localStorage.getItem("token");

    if (!token) {
      alert('Please log in to continue with payment.');
      window.location.href = 'login.html';
      return;
    }

    console.log('Making PayPal payment request for:', selectedPlan);

    const response = await fetch(`${config.API_BASE_URL}/api/payment/paypal/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        plan: selectedPlan.plan,
        amount: selectedPlan.price
      })
    });

    const data = await response.json();
    console.log('PayPal response:', data);

    if (response.ok && data.success) {
      window.location.href = data.approval_url;
    } else {
      console.error('PayPal error:', data);
      alert(data.message || 'Payment processing failed. Please try again.');
    }
  } catch (error) {
    console.error('PayPal payment error:', error);
    alert('Network error. Please try again.');
  } finally {
    spinner.style.display = 'none';
  }
}

async function processMpesaPayment() {
  const transactionId = document.getElementById('mpesaTransactionId').value.trim();
  const phoneNumber = document.getElementById('mpesaPhone').value.trim();
  const proofFile = document.getElementById('mpesaProof').files[0];
  const spinner = document.getElementById('mpesaSpinner');

  if (!transactionId || !phoneNumber || !proofFile) {
    alert('Please fill in all fields and upload payment proof.');
    return;
  }

  spinner.style.display = 'inline-block';

  try {
    const formData = new FormData();
    formData.append('plan', selectedPlan.plan);
    formData.append('amount', selectedPlan.price);
    formData.append('transaction_id', transactionId);
    formData.append('phone_number', phoneNumber);
    formData.append('payment_proof', proofFile);

    const token = localStorage.getItem("token");
    const response = await fetch(`${config.API_BASE_URL}/api/payment/mpesa/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Server returned invalid response');
    }

    if (response.ok) {
      showPaymentSubmittedNotification('M-Pesa payment submitted successfully! Admin will review and approve within 24 hours.');
      closePaymentModal();
      setTimeout(() => loadCurrentSubscription(), 1000);
    } else {
      alert('Payment submission failed: ' + (result.message || 'Please check your transaction details and try again.'));
    }
  } catch (error) {
    console.error('M-Pesa payment error:', error);
    alert('Network error. Please try again.');
  } finally {
    spinner.style.display = 'none';
  }
}

async function processCryptoPayment() {
  const cryptoType = document.getElementById('cryptoType').value;
  const transactionId = document.getElementById('cryptoTransactionId').value.trim();
  const proofFile = document.getElementById('cryptoProof').files[0];
  const spinner = document.getElementById('cryptoSpinner');

  if (!cryptoType || !transactionId || !proofFile) {
    alert('Please fill in all fields and upload transaction proof.');
    return;
  }

  spinner.style.display = 'inline-block';

  try {
    const formData = new FormData();
    formData.append('plan', selectedPlan.plan);
    formData.append('amount', selectedPlan.price);
    formData.append('crypto_type', cryptoType);
    formData.append('transaction_id', transactionId);
    formData.append('transaction_proof', proofFile);

    const token = localStorage.getItem("token");
    const response = await fetch(`${config.API_BASE_URL}/api/payment/crypto/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Server returned invalid response');
    }

    if (response.ok) {
      showPaymentSubmittedNotification('Crypto payment submitted successfully! Admin will review and approve within 24 hours.');
      closePaymentModal();
      setTimeout(() => loadCurrentSubscription(), 1000);
    } else {
      alert('Payment submission failed: ' + (result.message || 'Please check your transaction details and try again.'));
    }
  } catch (error) {
    console.error('Crypto payment error:', error);
    alert('Network error. Please try again.');
  } finally {
    spinner.style.display = 'none';
  }
}




function showPaymentSubmittedNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #28a745;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 400px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: 10px;">×</button>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}

async function checkPendingPayments() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${config.API_BASE_URL}/api/user/payment-status`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.pending && data.admin_message) {
        showAdminMessage(data.admin_message, data.status);
      }
    }
  } catch (error) {
    console.error('Error checking pending payments:', error);
  }
}

function showAdminMessage(message, status) {
  const bgColor = status === 'approved' ? '#28a745' : '#dc3545';
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10001;
    max-width: 400px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  notification.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove(); clearAdminMessage();" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: 10px;">×</button>
  `;

  document.body.appendChild(notification);
}

async function clearAdminMessage() {
  try {
    const token = localStorage.getItem("token");
    await fetch(`${config.API_BASE_URL}/api/user/clear-message`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (error) {
    console.error('Error clearing admin message:', error);
  }
}

// Load pending payments on page load
document.addEventListener('DOMContentLoaded', checkPendingPayments);

// Close modal when clicking outside
document.getElementById('paymentModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closePaymentModal();
  }
});

// Helper function to load subscription data (used for Binance success)
async function loadSubscriptionData() {
  await loadCurrentSubscription();
}