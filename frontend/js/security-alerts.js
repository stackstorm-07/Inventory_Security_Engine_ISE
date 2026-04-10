document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const alertsContainer = document.querySelector(".alerts-container");

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const isAdmin = user.role === 'admin';

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Role-based UI hiding
    if (user.role) {
        // Hide Access Control link for non-admins
        const accessControlLink = document.querySelector('a[href="access-control.html"]');
        if (accessControlLink && user.role !== 'admin') {
            accessControlLink.style.display = 'none';
        }
    }

    // Load security alerts
    loadSecurityAlerts();

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    async function loadSecurityAlerts() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/security-alerts', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "login.html";
                return;
            }

            if (response.status === 403) {
                alertsContainer.innerHTML = '<div style="text-align: center; color: red; padding: 2rem;">Access denied: insufficient permissions</div>';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch security alerts');
            }

            const alerts = await response.json();
            displayAlerts(alerts);
        } catch (error) {
            console.error('Error loading security alerts:', error);
            alertsContainer.innerHTML = '<div style="text-align: center; color: red; padding: 2rem;">Error loading data. Please try again.</div>';
        }
    }

    function dedupeAlerts(alerts) {
        const seen = new Set();
        return (alerts || []).filter((alert) => {
            const key = [
                alert.title,
                alert.time,
                alert.asset_id || '',
                alert.severity,
                alert.details,
                alert.resolved
            ].join('||');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function displayAlerts(alerts) {
        const uniqueAlerts = dedupeAlerts(alerts);
        if (!uniqueAlerts || uniqueAlerts.length === 0) {
            alertsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">No security alerts found.</div>';
            return;
        }

        alertsContainer.innerHTML = uniqueAlerts.map(alert => {
            const time = alert.time ? new Date(alert.time).toLocaleString() : 'Unknown';
            const severityClass = `severity-${alert.severity}`;
            const resolvedTag = alert.resolved ? '<span class="resolved-badge">Resolved</span>' : '';
            const actionButtons = isAdmin && !alert.resolved
                ? `
                    <div class="alert-actions">
                        <button class="action-btn resolve-btn" data-action="resolve" data-alert-id="${alert.id}">Resolve</button>
                        <button class="action-btn dismiss-btn" data-action="dismiss" data-alert-id="${alert.id}">Dismiss</button>
                    </div>
                `
                : '';

            return `
                <div class="alert-card">
                    <div class="alert-info">
                        <div class="alert-title">${alert.title}</div>
                        <div class="alert-details">${alert.details}</div>
                        <div class="alert-time">${time} ${alert.asset_id ? `- Asset ID: ${alert.asset_id}` : ''}</div>
                    </div>
                    <div>
                        <div class="alert-severity ${severityClass}">${alert.severity.toUpperCase()}</div>
                        ${resolvedTag}
                    </div>
                    ${actionButtons}
                </div>
            `;
        }).join('');
    }

    alertsContainer.addEventListener('click', async (event) => {
        let target = event.target;
        if (target.nodeType !== Node.ELEMENT_NODE) {
            target = target.parentElement;
        }
        const button = target && target.closest ? target.closest('button[data-action]') : null;
        if (!button) return;
        const alertId = button.dataset.alertId;
        const action = button.dataset.action;

        if (!alertId || !action) return;
        if (!isAdmin) {
            alert('Only admins can update alert status.');
            return;
        }

        if (action === 'resolve' && !confirm('Are you sure you want to resolve this alert?')) return;
        if (action === 'dismiss' && !confirm('Are you sure you want to dismiss this alert?')) return;

        const resolved = action === 'resolve';
        try {
            const response = await fetch(`http://localhost:5000/api/dashboard/security-alerts/${alertId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resolved })
            });

            if (response.ok) {
                loadSecurityAlerts();
            } else {
                const data = await response.json().catch(() => ({}));
                alert(data.error || 'Failed to update alert status');
            }
        } catch (error) {
            console.error('Error updating alert status:', error);
            alert('Error updating alert status');
        }
    });
});