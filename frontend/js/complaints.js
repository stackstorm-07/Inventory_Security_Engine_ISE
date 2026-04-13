document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
    const logoutBtn = document.getElementById("logoutBtn");
    const complaintForm = document.getElementById("complaintForm");
    const submitBtn = document.getElementById("submitBtn");
    const complaintsList = document.getElementById("complaintsList");
    const messageDiv = document.getElementById("message");
    const pageHeaderTitle = document.querySelector('.page-header h1');
    const pageHeaderDesc = document.querySelector('.page-header p');
    const complaintsHeader = document.querySelector('.complaint-history h2');

    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    const navLinksEl = document.querySelector('.nav-links');
    if (navLinksEl && user.role === 'viewer') {
        const ordersNav = document.createElement('a');
        ordersNav.href = 'viewer-inventory.html';
        ordersNav.className = 'nav-item';
        ordersNav.textContent = 'Orders & Trades';
        navLinksEl.appendChild(ordersNav);
    }

    // Show page content based on role
    if (user.role === 'viewer') {
        pageHeaderTitle.textContent = 'Report System Issues';
        pageHeaderDesc.textContent = 'Submit complaints about system faults or request assistance from administrators';
        complaintsHeader.textContent = 'Your Previous Complaints';
        loadUserComplaints();
    } else if (user.role === 'staff') {
        if (complaintForm) complaintForm.style.display = 'none';
        if (pageHeaderTitle) pageHeaderTitle.textContent = 'Assigned Tasks';
        if (pageHeaderDesc) pageHeaderDesc.textContent = 'View tasks assigned to you by the administrator.';
        if (complaintsHeader) complaintsHeader.textContent = 'Assigned Tasks';
        loadAssignedTasks();
    } else if (user.role === 'admin') {
        if (complaintForm) complaintForm.style.display = 'none';
        if (pageHeaderTitle) pageHeaderTitle.textContent = 'Complaint Management';
        if (pageHeaderDesc) pageHeaderDesc.textContent = 'Review complaints and assign tasks to staff members.';
        if (complaintsHeader) complaintsHeader.textContent = 'All Complaints';
        loadAllComplaints();
    } else {
        window.location.href = "dashboard.html";
        return;
    }

    // Logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    // Form submission
    if (complaintForm) {
        complaintForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = document.getElementById("complaintTitle").value.trim();
            const category = document.getElementById("complaintCategory").value;
            const priority = document.getElementById("complaintPriority").value;
            const description = document.getElementById("complaintDescription").value.trim();

            if (!title || !category || !priority || !description) {
                showMessage("Please fill in all required fields.", "error");
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Submitting...";

            try {
                const response = await fetch(`${API_BASE}/api/dashboard/complaints`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title,
                        category,
                        priority,
                        description
                    })
                });

                if (response.status === 401) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    window.location.href = "login.html";
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to submit complaint');
                }

                showMessage("Complaint submitted successfully! An administrator will review it soon.", "success");
                complaintForm.reset();
                loadUserComplaints(); // Refresh the list

            } catch (error) {
                console.error('Error submitting complaint:', error);
                showMessage("Failed to submit complaint. Please try again.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Complaint";
            }
        });
    }

    async function loadUserComplaints() {
        try {
            const response = await fetch(`${API_BASE}/api/dashboard/complaints`, {
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

            if (!response.ok) {
                throw new Error('Failed to fetch complaints');
            }

            const complaints = await response.json();
            displayComplaints(complaints);

        } catch (error) {
            console.error('Error loading complaints:', error);
            complaintsList.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 2rem;">Error loading complaints. Please try again.</p>';
        }
    }

    async function loadAssignedTasks() {
        try {
            const response = await fetch('http://localhost:5000/api/dashboard/assigned-complaints', {
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

            if (!response.ok) {
                throw new Error('Failed to fetch assigned tasks');
            }

            const complaints = await response.json();
            displayComplaints(complaints);

        } catch (error) {
            console.error('Error loading assigned tasks:', error);
            complaintsList.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 2rem;">Error loading tasks. Please try again.</p>';
        }
    }

    async function loadAllComplaints() {
        try {
            const response = await fetch(`${API_BASE}/api/dashboard/complaints`, {
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

            if (!response.ok) {
                throw new Error('Failed to fetch complaints');
            }

            const complaints = await response.json();
            displayComplaints(complaints);

        } catch (error) {
            console.error('Error loading complaints:', error);
            complaintsList.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 2rem;">Error loading complaints. Please try again.</p>';
        }
    }

    function displayComplaints(complaints) {
        if (!complaints || complaints.length === 0) {
            complaintsList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No complaints submitted yet.</p>';
            return;
        }

        complaintsList.innerHTML = complaints.map(complaint => `
            <div class="complaint-card">
                <div class="complaint-header">
                    <div class="complaint-title">${escapeHtml(complaint.title)}</div>
                    <span class="complaint-status status-${complaint.status.toLowerCase().replace(' ', '-')}">${complaint.status}</span>
                </div>
                <div class="complaint-date">Submitted: ${new Date(complaint.created_at).toLocaleDateString()}</div>
                <div class="complaint-description">${escapeHtml(complaint.description)}</div>
                ${complaint.assigned_staff ? `<div class="complaint-assigned">Assigned to: ${escapeHtml(complaint.assigned_staff)}</div>` : ''}
            </div>
        `).join('');
    }

    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});