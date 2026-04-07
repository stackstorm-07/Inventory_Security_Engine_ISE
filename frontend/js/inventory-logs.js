document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const tableBody = document.querySelector("#inventoryLogsTable tbody");

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

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

        // Hide Security Alerts and Reports links for viewers
        const securityAlertsLink = document.querySelector('a[href="security-alerts.html"]');
        if (securityAlertsLink && user.role === 'viewer') {
            securityAlertsLink.style.display = 'none';
        }

        const reportsLink = document.querySelector('a[href="reports.html"]');
        if (reportsLink && user.role === 'viewer') {
            reportsLink.style.display = 'none';
        }
    }

    // Load inventory logs
    loadInventoryLogs();

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    async function loadInventoryLogs() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/inventory-logs', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                // Token expired or invalid
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch inventory logs');
            }

            const logs = await response.json();
            displayLogs(logs);
        } catch (error) {
            console.error('Error loading inventory logs:', error);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error loading data. Please try again.</td></tr>';
        }
    }

    function displayLogs(logs) {
        if (!logs || logs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No inventory logs found.</td></tr>';
            return;
        }

        tableBody.innerHTML = logs.map(log => {
            const dateTime = new Date(log.date_time).toLocaleString();
            let statusClass = 'status-success';
            if (log.status === 'Pending Return') {
                statusClass = '';
            } else if (log.status === 'In Progress') {
                statusClass = 'status-warning';
            }

            return `
                <tr>
                    <td>${dateTime}</td>
                    <td>${log.asset_id}</td>
                    <td>${log.item_name}</td>
                    <td>${log.user}</td>
                    <td>${log.action}</td>
                    <td>${log.location || 'N/A'}</td>
                    <td><span class="status-badge ${statusClass}">${log.status}</span></td>
                </tr>
            `;
        }).join('');
    }
});