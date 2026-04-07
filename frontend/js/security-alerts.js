document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const alertsContainer = document.querySelector(".alerts-container");

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
        window.location.href = "login.html";
        return;
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

    function displayAlerts(alerts) {
        if (!alerts || alerts.length === 0) {
            alertsContainer.innerHTML = '<div style="text-align: center; padding: 2rem;">No security alerts found.</div>';
            return;
        }

        alertsContainer.innerHTML = alerts.map(alert => {
            const time = new Date(alert.time).toLocaleString();
            const severityClass = `severity-${alert.severity}`;

            return `
                <div class="alert-card">
                    <div class="alert-info">
                        <div class="alert-title">${alert.title}</div>
                        <div class="alert-details">${alert.details}</div>
                        <div class="alert-time">${time} ${alert.asset_id ? `- Asset ID: ${alert.asset_id}` : ''}</div>
                    </div>
                    <div class="alert-severity ${severityClass}">${alert.severity.toUpperCase()}</div>
                    <div class="alert-actions">
                        <button class="action-btn resolve-btn" onclick="resolveAlert(${alert.id})">Resolve</button>
                        <button class="action-btn dismiss-btn" onclick="dismissAlert(${alert.id})">Dismiss</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Global functions for button clicks
    window.resolveAlert = async (alertId) => {
        if (!confirm('Are you sure you want to resolve this alert?')) return;

        try {
            const response = await fetch(`http://localhost:5000/api/dashboard/security-alerts/${alertId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resolved: true })
            });

            if (response.ok) {
                loadSecurityAlerts(); // Reload alerts
            } else {
                alert('Failed to resolve alert');
            }
        } catch (error) {
            console.error('Error resolving alert:', error);
            alert('Error resolving alert');
        }
    };

    window.dismissAlert = async (alertId) => {
        if (!confirm('Are you sure you want to dismiss this alert?')) return;

        try {
            const response = await fetch(`http://localhost:5000/api/dashboard/security-alerts/${alertId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resolved: false })
            });

            if (response.ok) {
                loadSecurityAlerts(); // Reload alerts
            } else {
                alert('Failed to dismiss alert');
            }
        } catch (error) {
            console.error('Error dismissing alert:', error);
            alert('Error dismissing alert');
        }
    };
});