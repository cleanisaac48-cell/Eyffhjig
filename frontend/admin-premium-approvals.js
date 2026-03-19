document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = 'admin-login.html';
        return;
    }

    let currentStatus = 'pending';

    // Load initial data
    await loadSubscriptions();
    await loadStats();

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatus = btn.dataset.status;
            await loadSubscriptions();
        });
    });

    async function loadSubscriptions() {
        try {
            const response = await fetch(`${config.API_BASE_URL}/api/admin/premium-subscriptions?status=${currentStatus}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to load subscriptions');

            const subscriptions = await response.json();
            renderSubscriptions(subscriptions);
        } catch (error) {
            console.error('Error loading subscriptions:', error);
            document.getElementById('subscriptionsContainer').innerHTML = '<p>Error loading subscriptions</p>';
        }
    }

    async function loadStats() {
        try {
            const response = await fetch(`${config.API_BASE_URL}/api/admin/premium-approvals/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to load stats');

            const stats = await response.json();
            document.getElementById('pendingCount').textContent = stats.pending || 0;
            document.getElementById('approvedCount').textContent = stats.approved || 0;
            document.getElementById('rejectedCount').textContent = stats.rejected || 0;
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    function renderSubscriptions(subscriptions) {
        const container = document.getElementById('subscriptionsContainer');

        if (!subscriptions || subscriptions.length === 0) {
            container.innerHTML = '<p>No subscription requests found</p>';
            return;
        }

        container.innerHTML = subscriptions.map(subscription => `
            <div class="update-card">
                <div class="update-header">
                    <div class="user-info">
                        <h3>${subscription.user_email}</h3>
                        <p><strong>Plan:</strong> ${subscription.plan || 'Premium'}</p>
                        <p><strong>Amount:</strong> $${subscription.amount}</p>
                        <p><strong>Payment Method:</strong> ${subscription.payment_method.toUpperCase()}</p>
                        <p>Requested: ${new Date(subscription.requested_at).toLocaleDateString()}</p>
                        ${subscription.reviewed_at ? `<p>Reviewed: ${new Date(subscription.reviewed_at).toLocaleDateString()}</p>` : ''}
                    </div>
                    <span class="status-badge status-${subscription.status}">${subscription.status.toUpperCase()}</span>
                </div>

                <div class="media-content">
                    <div class="media-item">
                        <h4>Payment Proof</h4>
                        <img src="${subscription.payment_proof_url}" alt="Payment Proof" style="max-width: 300px; border-radius: 8px;" />
                        ${subscription.transaction_reference ? `<p><strong>Transaction ID:</strong> ${subscription.transaction_reference}</p>` : ''}
                        ${subscription.phone_number ? `<p><strong>Phone:</strong> ${subscription.phone_number}</p>` : ''}
                    </div>
                </div>

                ${subscription.admin_message ? `
                    <div class="admin-message-display">
                        <strong>Admin Message:</strong> ${subscription.admin_message}
                    </div>
                ` : ''}

                ${subscription.status === 'pending' ? `
                    <div class="actions">
                        <textarea class="admin-message" placeholder="Admin message (optional)..." id="message-${subscription.id}"></textarea>
                        <button class="btn btn-approve" onclick="reviewSubscription(${subscription.id}, 'approved')">Approve</button>
                        <button class="btn btn-reject" onclick="reviewSubscription(${subscription.id}, 'rejected')">Reject</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    window.reviewSubscription = async (subscriptionId, status) => {
        try {
            const messageTextarea = document.getElementById(`message-${subscriptionId}`);
            const adminMessage = messageTextarea ? messageTextarea.value : '';

            const response = await fetch(`${config.API_BASE_URL}/api/admin/premium-subscriptions/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    subscriptionId,
                    status,
                    adminMessage
                })
            });

            if (!response.ok) throw new Error('Failed to review subscription');

            await loadSubscriptions();
            await loadStats();

            alert(`Subscription ${status} successfully!`);
        } catch (error) {
            console.error('Error reviewing subscription:', error);
            alert('Error reviewing subscription');
        }
    };
});

window.logout = function() {
    localStorage.removeItem('admin_token');
    window.location.href = 'admin-login.html';
};