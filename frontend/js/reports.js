document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const exportBtn = document.querySelector(".export-btn");
    const reportsTableBody = document.querySelector("#reportsTable tbody");

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Load reports data
    loadReports();

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    // Export functionality
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            alert("Export functionality would be implemented here");
        });
    }

    async function loadReports() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/reports', {
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
                document.querySelector('.main-content').innerHTML = '<div style="text-align: center; color: red; padding: 2rem;">Access denied: insufficient permissions</div>';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch reports');
            }

            const data = await response.json();
            displayReports(data);
        } catch (error) {
            console.error('Error loading reports:', error);
            document.querySelector('.main-content').innerHTML = '<div style="text-align: center; color: red; padding: 2rem;">Error loading data. Please try again.</div>';
        }
    }

    function displayReports(data) {
        // Update inventory overview cards
        const inventory = data.inventory_overview;
        document.querySelector('.report-card:nth-child(1) .metric-value:nth-child(1)').textContent = inventory.total_assets;
        document.querySelector('.report-card:nth-child(1) .metric-value:nth-child(2)').textContent = inventory.checked_out;
        document.querySelector('.report-card:nth-child(1) .metric-value:nth-child(3)').textContent = inventory.available;
        document.querySelector('.report-card:nth-child(1) .metric-value:nth-child(4)').textContent = inventory.under_maintenance;

        // Update security metrics cards
        const security = data.security_metrics;
        document.querySelector('.report-card:nth-child(2) .metric-value:nth-child(1)').textContent = security.active_alerts;
        document.querySelector('.report-card:nth-child(2) .metric-value:nth-child(2)').textContent = security.resolved_this_month;
        document.querySelector('.report-card:nth-child(2) .metric-value:nth-child(3)').textContent = security.system_uptime;
        document.querySelector('.report-card:nth-child(2) .metric-value:nth-child(4)').textContent = security.failed_access_attempts;

        // Update monthly activity table
        if (reportsTableBody && data.monthly_activity) {
            reportsTableBody.innerHTML = data.monthly_activity.map(activity => `
                <tr>
                    <td>${activity.month}</td>
                    <td>${activity.total_transactions}</td>
                    <td>${activity.check_outs}</td>
                    <td>${activity.check_ins}</td>
                    <td>${activity.security_incidents}</td>
                    <td>${activity.user_activity}</td>
                </tr>
            `).join('');
        }
    }
});