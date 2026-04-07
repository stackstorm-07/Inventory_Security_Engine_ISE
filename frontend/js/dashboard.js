document.addEventListener("DOMContentLoaded", () => {
    
    // 1. CONSOLIDATED DATA STORAGE
    // These items show up as soon as the page loads
    let inventoryData = [
        { id: "ITM-001", name: "MacBook Pro 16-inch", user: "Admin", status: "Operational" },
        { id: "ITM-002", name: "Cisco Firewall", user: "Ankit", status: "Maintenance" },
        { id: "ITM-003", name: "Server Rack A", user: "Security_Auth", status: "Operational" },
        { id: "ITM-004", name: "Logitech Webcam", user: "Staff_01", status: "Operational" }
    ];

    // 2. ELEMENT SELECTORS
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

    // 3. UI REFRESH FUNCTION
    // This function handles the "Reflection"—it updates the table AND the boxes
    function refreshDashboard() {
        if (!tableBody) return;

        // Clear current table rows
        tableBody.innerHTML = "";

        // Rebuild table from our data array
        inventoryData.forEach((item, index) => {
            const isMaint = item.status === "Maintenance";
            const statusIcon = item.status === "Operational" ? "✅" : "⚠️";
            
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>#${item.id}</td>
                <td>${item.name}</td>
                <td>${item.user}</td>
                <td>
                    <span class="status-badge" style="${isMaint ? 'background:#fee2e2; color:#dc2626;' : 'background:#dcfce7; color:#16a34a;'}">
                        ${statusIcon} ${item.status}
                    </span>
                </td>
                <td>
                    <button onclick="removeAsset(${index})" style="color:#ef4444; border:none; background:none; cursor:pointer; font-weight:600; font-size:0.8rem;">Remove</button>
                    ${isMaint ? `<button onclick="markAsComplete(${index})" style="color:#16a34a; border:none; background:none; cursor:pointer; font-weight:600; font-size:0.8rem; margin-left:10px;">Mark Done</button>` : ''}
                </td>
            `;
            tableBody.appendChild(row);
        });

        // --- DASHBOARD REFLECTION LOGIC ---
        // 1. Total Assets Box
        if (statTotal) statTotal.innerText = inventoryData.length;
        
        // 2. Active Alerts Box (Counts Maintenance items)
        const maintCount = inventoryData.filter(i => i.status === "Maintenance").length;
        if (statAlerts) statAlerts.innerText = maintCount;

        // 3. Resolved Today Box (Counts Operational/Completed items)
        const completedCount = inventoryData.filter(i => i.status === "Operational").length;
        if (statResolved) statResolved.innerText = completedCount;
    }

    // 4. ADD EQUIPMENT LOGIC
    if (addAssetForm) {
        addAssetForm.addEventListener("submit", (e) => {
            e.preventDefault();

            // Get data from the modal inputs
            const name = document.getElementById("assetName").value;
            const user = document.getElementById("assetUser").value;
            const status = document.getElementById("assetStatus").value;
            const newId = "ITM-" + Math.floor(100 + Math.random() * 900);

            // Add the new object to our array
            inventoryData.push({ id: newId, name: name, user: user, status: status });

            // Trigger the reflection, clear form, and hide modal
            refreshDashboard();
            modal.style.display = "none";
            addAssetForm.reset();
        });
    }

    // 5. ACTION BUTTONS (Global functions so the buttons can see them)
    window.removeAsset = (index) => {
        if(confirm("Confirm removal from database?")) {
            inventoryData.splice(index, 1);
            refreshDashboard();
        }
    };

    window.markAsComplete = (index) => {
        // Change status to Operational (Completed) and refresh
        inventoryData[index].status = "Operational";
        refreshDashboard();
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