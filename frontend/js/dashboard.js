document.addEventListener("DOMContentLoaded", () => {
    
    // Check authentication
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Update welcome message with user role
    const welcomeMessage = document.getElementById("welcomeMessage");
    if (welcomeMessage && user.username) {
        const roleDisplay = user.role ? `(${user.role.charAt(0).toUpperCase() + user.role.slice(1)})` : '';
        welcomeMessage.textContent = `Welcome ${user.username} ${roleDisplay} - Security Dashboard`;
    }

    // Role-based navigation hiding
    const userRole = user.role;
    // Inventory permissions: viewer reads only; staff operates (add/update); admin full control including delete
    const inventoryPerms = {
        canAdd: userRole === 'admin' || userRole === 'staff',
        canUpdateStatus: userRole === 'admin' || userRole === 'staff',
        canDelete: userRole === 'admin'
    };
    /* const pageHeaderDesc = document.querySelector('.page-header p');
    if (pageHeaderDesc) {
        if (userRole === 'viewer') {
            pageHeaderDesc.textContent = 'View inventory and search assets. Changes require staff or admin.';
        } else if (userRole === 'staff') {
            pageHeaderDesc.textContent = 'Add equipment and update maintenance status. Only admins can remove assets.';
        } else if (userRole === 'admin') {
            pageHeaderDesc.textContent = 'Full inventory control: add, update status, and remove assets.';
        }
    } */
   
    const navLinks = document.querySelectorAll('.nav-links .nav-item');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Hide Access Control for non-admins
        if (href === 'access-control.html' && userRole !== 'admin') {
            link.style.display = 'none';
        }
    });

    // Add Complaints / Tasks link based on role
    const navLinksContainer = document.querySelector('.nav-links');
    if (navLinksContainer) {
        const taskLink = document.createElement('a');
        taskLink.href = 'complaints.html';
        taskLink.className = 'nav-item';
        taskLink.textContent = userRole === 'viewer' ? 'Complaints' : 'Tasks';
        navLinksContainer.insertBefore(taskLink, navLinksContainer.lastElementChild);
        if (userRole === 'viewer') {
            const ordersLink = document.createElement('a');
            ordersLink.href = 'viewer-inventory.html';
            ordersLink.className = 'nav-item';
            ordersLink.textContent = 'Orders & Trades';
            navLinksContainer.insertBefore(ordersLink, navLinksContainer.lastElementChild);
        }
    }

    // 1. ELEMENT SELECTORS
    const tableBody = document.getElementById("inventoryTableBody");
    const openBtn = document.getElementById("openModalBtn");
    const closeBtn = document.getElementById("closeModalBtn");
    const modal = document.getElementById("assetModal");
    const addAssetForm = document.getElementById("addAssetForm");
    const logoutBtn = document.getElementById("logoutBtn");
    
    // Selecting the 4 Stat Value containers from your HTML
    const statTotal = document.querySelector(".card-blue .stat-value");    // Total Items
    const statAlerts = document.querySelector(".card-yellow .stat-value"); // Active Alerts (Maintenance)
    const statResolved = document.querySelector(".card-green .stat-value"); // Resolved Today (Operational)

    let inventoryData = [];

    if (openBtn && !inventoryPerms.canAdd) {
        openBtn.style.display = 'none';
    }

    function actionCellHtml(item) {
        const isMaint = item.status === 'maintenance';
        const parts = [];
        if (inventoryPerms.canDelete) {
            parts.push(`<button type="button" onclick="removeAsset('${item.asset_id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; font-weight:600; font-size:0.8rem;">Remove</button>`);
        }
        if (inventoryPerms.canUpdateStatus && isMaint) {
            parts.push(`<button type="button" onclick="markAsComplete('${item.asset_id}')" style="color:#16a34a; border:none; background:none; cursor:pointer; font-weight:600; font-size:0.8rem; margin-left:10px;">Mark Done</button>`);
        }
        if (parts.length === 0) {
            return '<span style="color:#6b7280; font-size:0.8rem;">View only</span>';
        }
        return parts.join('');
    }

    // Load initial data
    loadDashboardData();

    // 3. UI REFRESH FUNCTION
    // This function handles the "Reflection"—it updates the table AND the boxes
    function refreshDashboard() {
        if (!tableBody) return;

        // Clear current table rows
        tableBody.innerHTML = "";

        // Rebuild table from our data array
        inventoryData.forEach((item) => {
            const isMaint = item.status === "maintenance";
            const statusIcon = item.status === "available" || item.status === "checked_out" ? "✅" : "⚠️";
            const statusText = item.status.charAt(0).toUpperCase() + item.status.replace('_', ' ').slice(1);
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${item.asset_id}</td>
                <td>${item.name}</td>
                <td>${item.assigned_to || 'Unassigned'}</td>
                <td>
                    <span class="status-badge" style="${isMaint ? 'background:#fee2e2; color:#dc2626;' : 'background:#dcfce7; color:#16a34a;'}">
                        ${statusIcon} ${statusText}
                    </span>
                </td>
                <td>${actionCellHtml(item)}</td>
            `;
            tableBody.appendChild(row);
        });

        // --- DASHBOARD REFLECTION LOGIC ---
        // 1. Total Assets Box
        if (statTotal) statTotal.innerText = inventoryData.length;
        
        // 2. Active Alerts Box (Counts Maintenance items)
        const maintCount = inventoryData.filter(i => i.status === "maintenance").length;
        if (statAlerts) statAlerts.innerText = maintCount;

        // 3. Resolved Today Box (Counts Available items)
        const availableCount = inventoryData.filter(i => i.status === "available").length;
        if (statResolved) statResolved.innerText = availableCount;
    }

    const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';

    async function loadDashboardData() {
        try {
            const response = await fetch(`${API_BASE}/api/dashboard/assets`, {
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
                throw new Error('Failed to fetch assets');
            }
    
            const assets = await response.json();
    
            inventoryData = (assets || []).map(asset => ({
                asset_id: asset.asset_id || 'UNKNOWN',
                name: asset.name || 'Unknown Item',
                assigned_to: asset.assigned_to || null,
                status: asset.status || 'available'
            }));
    
            refreshDashboard();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            inventoryData = [];
            refreshDashboard();
        }
    }
    
    function generateNextAssetId(items) {
        let maxNumber = 0;
        items.forEach((item) => {
            const match = String(item.asset_id || '').match(/^AST-(\d+)$/i);
            if (match) {
                const value = parseInt(match[1], 10);
                if (!Number.isNaN(value) && value > maxNumber) maxNumber = value;
            }
        });
        return `AST-${String(maxNumber + 1).padStart(3, '0')}`;
    }

    // 4. ADD EQUIPMENT LOGIC
    if (addAssetForm) {
        addAssetForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (!inventoryPerms.canAdd) {
                alert('Only administrators and staff can add equipment.');
                return;
            }

            // Get data from the modal inputs
            const name = document.getElementById("assetName").value;
            const assignedTo = document.getElementById("assetUser").value;
            const status = document.getElementById("assetStatus").value;
            const newId = generateNextAssetId(inventoryData);
            const mappedStatus = status.toLowerCase() === 'maintenance' ? 'maintenance' : 'available';

            try {
                const response = await fetch(`${process.env.API_URL}/api/dashboard/assets`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        asset_id: newId,
                        name,
                        status: mappedStatus,
                        assigned_to: assignedTo || null
                    })
                });

                if (response.status === 401) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    window.location.href = "login.html";
                    return;
                }
                if (response.status === 403) {
                    alert('You do not have permission to add equipment.');
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to create asset');
                }

                await loadDashboardData();
                modal.style.display = "none";
                addAssetForm.reset();
            } catch (error) {
                console.error('Error creating asset:', error);
                alert(error.message || 'Unable to add asset.');
            }
        });
    }

    // 5. ACTION BUTTONS (Global functions so the buttons can see them)
    window.removeAsset = async (assetId) => {
        if (!inventoryPerms.canDelete) {
            alert('Only administrators can remove assets from inventory.');
            return;
        }
        if(confirm("Confirm removal from database?")) {
            try {
                const response = await fetch(`${API_BASE}/api/dashboard/assets/${encodeURIComponent(assetId)}`, {
                    method: 'DELETE',
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
                    alert('You do not have permission to remove this asset.');
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Failed to remove asset');
                }

                await loadDashboardData();
            } catch (error) {
                console.error('Error removing asset:', error);
                alert(error.message || 'Unable to remove asset.');
            }
        }
    };

    window.markAsComplete = async (assetId) => {
        if (!inventoryPerms.canUpdateStatus) {
            alert('Only administrators and staff can update asset status.');
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/dashboard/assets/${encodeURIComponent(assetId)}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'available', assigned_to: null })
            });

            if (response.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "login.html";
                return;
            }
            if (response.status === 403) {
                alert('You do not have permission to update this asset.');
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to update asset');
            }

            await loadDashboardData();
        } catch (error) {
            console.error('Error updating asset:', error);
            alert(error.message || 'Unable to mark asset as complete.');
        }
    };

    // 6. MODAL & LOGOUT CONTROLS
    if (openBtn) openBtn.onclick = () => modal.style.display = "flex";
    if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
    
    // Close modal if user clicks the darkened background
    window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }

    // 7. SEARCH / SCAN LOGIC
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("inventorySearch");

    if (searchBtn && searchInput) {
        searchBtn.addEventListener("click", () => {
            const query = searchInput.value.trim().toLowerCase();

            if (!query) {
                refreshDashboard();
                return;
            }

            const filteredData = inventoryData.filter(item =>
                (item.name || "").toLowerCase().includes(query) ||
                (item.assigned_to || "").toLowerCase().includes(query) ||
                (item.asset_id || "").toLowerCase().includes(query)
            );

            renderFilteredTable(filteredData);
        });
    }

    function renderFilteredTable(data) {
        if (!tableBody) return;
        tableBody.innerHTML = "";

        data.forEach((item) => {
            const isMaint = item.status === "maintenance";
            const statusIcon = item.status === "available" || item.status === "checked_out" ? "✅" : "⚠️";
            const statusText = item.status.charAt(0).toUpperCase() + item.status.replace('_', ' ').slice(1);

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${item.asset_id}</td>
                <td>${item.name}</td>
                <td>${item.assigned_to || "Unassigned"}</td>
                <td>
                    <span class="status-badge" style="${isMaint ? "background:#fee2e2; color:#dc2626;" : "background:#dcfce7; color:#16a34a;"}">
                        ${statusIcon} ${statusText}
                    </span>
                </td>
                <td>${actionCellHtml(item)}</td>
            `;
            tableBody.appendChild(row);
        });

        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#6b7280;">No assets found.</td></tr>`;
        }
    }
});
