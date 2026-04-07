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
    const navLinks = document.querySelectorAll('.nav-links .nav-item');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Hide Access Control for non-admins
        if (href === 'access-control.html' && userRole !== 'admin') {
            link.style.display = 'none';
        }
        
        // Hide Security Alerts and Reports for viewers
        if ((href === 'security-alerts.html' || href === 'reports.html') && userRole === 'viewer') {
            link.style.display = 'none';
        }
    });

    // Add Complaints link for viewers only
    if (userRole === 'viewer') {
        const navLinksContainer = document.querySelector('.nav-links');
        if (navLinksContainer) {
            const complaintsLink = document.createElement('a');
            complaintsLink.href = 'complaints.html';
            complaintsLink.className = 'nav-item';
            complaintsLink.textContent = 'Complaints';
            navLinksContainer.insertBefore(complaintsLink, navLinksContainer.lastElementChild);
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

    // Load initial data
    loadDashboardData();

    // 3. UI REFRESH FUNCTION
    // This function handles the "Reflection"—it updates the table AND the boxes
    function refreshDashboard() {
        if (!tableBody) return;

        // Clear current table rows
        tableBody.innerHTML = "";

        // Rebuild table from our data array
        inventoryData.forEach((item, index) => {
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
                <td>
                    <button onclick="removeAsset('${item.asset_id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; font-weight:600; font-size:0.8rem;">Remove</button>
                    ${isMaint ? `<button onclick="markAsComplete('${item.asset_id}')" style="color:#16a34a; border:none; background:none; cursor:pointer; font-weight:600; font-size:0.8rem; margin-left:10px;">Mark Done</button>` : ''}
                </td>
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

    async function loadDashboardData() {
        try {
            // For now, we'll simulate loading assets data
            // In a full implementation, you'd have an API endpoint for assets
            const response = await fetch('http://localhost:5000/api/dashboard/inventory-logs', {
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

            // For demo purposes, use sample data
            inventoryData = [
                { asset_id: "AST-001", name: "Dell Laptop XPS 13", assigned_to: "John Doe", status: "checked_out" },
                { asset_id: "AST-045", name: "Samsung Monitor 27\"", assigned_to: null, status: "available" },
                { asset_id: "AST-023", name: "HP Printer LaserJet", assigned_to: null, status: "maintenance" },
                { asset_id: "AST-067", name: "Apple iPad Pro", assigned_to: "Sarah Wilson", status: "checked_out" }
            ];

            refreshDashboard();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Fallback to sample data
            inventoryData = [
                { asset_id: "AST-001", name: "Dell Laptop XPS 13", assigned_to: "John Doe", status: "checked_out" },
                { asset_id: "AST-045", name: "Samsung Monitor 27\"", assigned_to: null, status: "available" },
                { asset_id: "AST-023", name: "HP Printer LaserJet", assigned_to: null, status: "maintenance" },
                { asset_id: "AST-067", name: "Apple iPad Pro", assigned_to: "Sarah Wilson", status: "checked_out" }
            ];
            refreshDashboard();
        }
    }

    // 4. ADD EQUIPMENT LOGIC
    if (addAssetForm) {
        addAssetForm.addEventListener("submit", (e) => {
            e.preventDefault();

            // Get data from the modal inputs
            const name = document.getElementById("assetName").value;
            const user = document.getElementById("assetUser").value;
            const status = document.getElementById("assetStatus").value;
            const newId = "AST-" + Math.floor(100 + Math.random() * 900);

            // Add the new object to our array
            inventoryData.push({ 
                asset_id: newId, 
                name: name, 
                assigned_to: user || null, 
                status: status.toLowerCase().replace(' ', '_')
            });

            // Trigger the reflection, clear form, and hide modal
            refreshDashboard();
            modal.style.display = "none";
            addAssetForm.reset();
        });
    }

    // 5. ACTION BUTTONS (Global functions so the buttons can see them)
    window.removeAsset = (assetId) => {
        if(confirm("Confirm removal from database?")) {
            inventoryData = inventoryData.filter(item => item.asset_id !== assetId);
            refreshDashboard();
        }
    };

    window.markAsComplete = (assetId) => {
        // Change status to available and refresh
        const item = inventoryData.find(item => item.asset_id === assetId);
        if (item) {
            item.status = "available";
            item.assigned_to = null;
            refreshDashboard();
        }
    };

    // 6. MODAL & LOGOUT CONTROLS
    if (openBtn) openBtn.onclick = () => modal.style.display = "flex";
    if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
    
    // Close modal if user clicks the darkened background
    window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            window.location.href = "login.html";
        });
    }

    // Initial Load when the page opens
    refreshDashboard();
});

// 7. SEARCH / SCAN LOGIC (For SQL Injection Demo)
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("inventorySearch");

    if (searchBtn) {
        searchBtn.addEventListener("click", () => {
            const query = searchInput.value.toLowerCase();
            
            // This is where you explain: "In a real app, this query goes to the database."
            // For now, we filter the local array to show the 'Result'
            const filteredData = inventoryData.filter(item => 
                item.name.toLowerCase().includes(query) || 
                item.user.toLowerCase().includes(query) ||
                item.id.toLowerCase().includes(query)
            );

            // Temporarily update the table with search results
            renderFilteredTable(filteredData);
        });
    }

    // Helper to render only search results
    function renderFilteredTable(data) {
        tableBody.innerHTML = "";
        data.forEach((item, index) => {
            const isMaint = item.status === "Maintenance";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${item.id}</td>
                <td>${item.name}</td>
                <td>${item.user}</td>
                <td><span class="status-badge" style="${isMaint ? 'background:#fee2e2; color:#dc2626;' : 'background:#dcfce7; color:#16a34a;'}">${item.status}</span></td>
                <td><button onclick="removeAsset(${index})" style="color:#ef4444; border:none; background:none; cursor:pointer;">Remove</button></td>
            `;
            tableBody.appendChild(row);
        });
        
        // If no results found, show a message
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#6b7280;">No assets found in database scan.</td></tr>`;
        }
    }
