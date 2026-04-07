document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    const tableBody = document.querySelector("#accessControlTable tbody");

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Load access control data
    loadAccessControl();

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    async function loadAccessControl() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/access-control', {
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
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Access denied: insufficient permissions</td></tr>';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch access control data');
            }

            const users = await response.json();
            displayUsers(users);
        } catch (error) {
            console.error('Error loading access control data:', error);
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Error loading data. Please try again.</td></tr>';
        }
    }

    function displayUsers(users) {
        if (!users || users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No users found.</td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => {
            const userId = `USR-${String(user.id).padStart(3, '0')}`;
            const roleClass = `role-${user.role}`;
            const statusClass = user.status === 'active' ? 'status-active' : 'status-inactive';
            const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Never';

            return `
                <tr>
                    <td>${userId}</td>
                    <td>${user.full_name}</td>
                    <td>${user.email}</td>
                    <td><span class="role-badge ${roleClass}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></td>
                    <td>${user.department}</td>
                    <td><span class="${statusClass}">${user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span></td>
                    <td>${lastLogin}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editUser(${user.id}, '${user.role}', '${user.department}', '${user.status}')">Edit</button>
                        <button class="action-btn" onclick="revokeUser(${user.id})">Revoke</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Global functions for button clicks
    window.editUser = (userId, currentRole, currentDepartment, currentStatus) => {
        const newRole = prompt('Enter new role (admin/manager/user):', currentRole);
        if (!newRole || !['admin', 'manager', 'user'].includes(newRole)) {
            alert('Invalid role. Must be admin, manager, or user.');
            return;
        }

        const newDepartment = prompt('Enter new department:', currentDepartment);
        if (!newDepartment) return;

        const newStatus = prompt('Enter new status (active/inactive):', currentStatus);
        if (!newStatus || !['active', 'inactive'].includes(newStatus)) {
            alert('Invalid status. Must be active or inactive.');
            return;
        }

        updateUser(userId, newRole, newDepartment, newStatus);
    };

    window.revokeUser = (userId) => {
        if (!confirm('Are you sure you want to revoke this user\'s access?')) return;
        updateUser(userId, 'user', 'General', 'inactive');
    };

    async function updateUser(userId, role, department, status) {
        try {
            const response = await fetch(`http://localhost:5000/api/dashboard/access-control/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role, department, status })
            });

            if (response.ok) {
                loadAccessControl(); // Reload users
            } else {
                alert('Failed to update user');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Error updating user');
        }
    }
});