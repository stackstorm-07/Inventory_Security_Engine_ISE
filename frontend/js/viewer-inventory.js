document.addEventListener("DOMContentLoaded", () => {
    const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const API = `${API_BASE}/api/dashboard`;
    const token = localStorage.getItem("token");
    let user = JSON.parse(localStorage.getItem("user") || "{}");

    if (!token) {
        window.location.href = "login.html";
        return;
    }
    if (user.role !== "viewer") {
        window.location.href = "dashboard.html";
        return;
    }

    const messageEl = document.getElementById("message");
    const ordersList = document.getElementById("ordersList");
    const tradesList = document.getElementById("tradesList");
    const orderAsset = document.getElementById("orderAsset");
    const tradePeer = document.getElementById("tradePeer");
    const offerAsset = document.getElementById("offerAsset");
    const requestAsset = document.getElementById("requestAsset");
    const orderForm = document.getElementById("orderForm");
    const tradeForm = document.getElementById("tradeForm");

    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.style.display = "block";
        setTimeout(() => {
            messageEl.style.display = "none";
        }, 5000);
    }

    function authHeaders() {
        return {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        };
    }

    function assetMatchesMe(asset) {
        const a = (asset.assigned_to || "").trim().toLowerCase();
        if (!a) return false;
        const u = (user.username || "").trim().toLowerCase();
        const f = (user.full_name || "").trim().toLowerCase();
        return a === u || (f && a === f);
    }

    function assetMatchesPeer(asset, peer) {
        const a = (asset.assigned_to || "").trim().toLowerCase();
        if (!a) return false;
        const u = (peer.username || "").trim().toLowerCase();
        const f = (peer.full_name || "").trim().toLowerCase();
        return a === u || (f && a === f);
    }

    let allAssets = [];
    let peers = [];

    async function hydrateProfile() {
        const res = await fetch(`${API}/me`, { headers: authHeaders() });
        if (res.ok) {
            const me = await res.json();
            user = { ...user, full_name: me.full_name, username: me.username };
        }
    }

    document.getElementById("logoutBtn")?.addEventListener("click", () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "login.html";
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
        });
    });

    async function loadAssetsAndPeers() {
        const [aRes, pRes] = await Promise.all([
            fetch(`${API}/assets`, { headers: authHeaders() }),
            fetch(`${API}/viewer-peers`, { headers: authHeaders() })
        ]);
        if (aRes.status === 401 || pRes.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
            return;
        }
        allAssets = await aRes.json();
        peers = await pRes.json();

        const availableAssets = allAssets.filter((asset) => asset.status === 'available' || !asset.assigned_to);
        orderAsset.innerHTML = '<option value="">Select an asset</option>';
        if (!availableAssets.length) {
            orderAsset.innerHTML = '<option value="">No available assets found</option>';
        } else {
            availableAssets.forEach((asset) => {
                const opt = document.createElement("option");
                opt.value = asset.asset_id;
                opt.textContent = `${asset.asset_id} — ${asset.name} (${asset.status})`;
                orderAsset.appendChild(opt);
            });
        }

        tradePeer.innerHTML = '<option value="">Select a viewer</option>';
        if (!peers.length) {
            tradePeer.innerHTML = '<option value="">No other viewers found</option>';
        } else {
            peers.forEach((p) => {
                const opt = document.createElement("option");
                opt.value = p.id;
                opt.textContent = `${p.username} (${p.full_name || "no name"})`;
                opt.dataset.peer = JSON.stringify(p);
                tradePeer.appendChild(opt);
            });
        }

        // Note: rebuildOfferOptions/rebuildRequestOptions are called from
        // the init sequence AFTER hydrateProfile() so user.full_name is available.
    }

    function rebuildOfferOptions() {
        offerAsset.innerHTML = '<option value="">Select your asset</option>';
        const userAssets = allAssets.filter(assetMatchesMe);
        if (!userAssets.length) {
            offerAsset.innerHTML = '<option value="">No assets currently assigned to you</option>';
            return;
        }
        userAssets.forEach((asset) => {
            const opt = document.createElement("option");
            opt.value = asset.asset_id;
            opt.textContent = `${asset.asset_id} — ${asset.name}`;
            offerAsset.appendChild(opt);
        });
    }

    function rebuildRequestOptions() {
        const selected = tradePeer.value;
        requestAsset.innerHTML = '<option value="">Select their asset</option>';
        if (!selected) {
            return;
        }
        const peer = peers.find((p) => String(p.id) === String(selected));
        if (!peer) return;

        const peerAssets = allAssets.filter((a) => assetMatchesPeer(a, peer));
        if (!peerAssets.length) {
            requestAsset.innerHTML = '<option value="">No assets assigned to this viewer</option>';
            return;
        }
        peerAssets.forEach((asset) => {
            const opt = document.createElement("option");
            opt.value = asset.asset_id;
            opt.textContent = `${asset.asset_id} — ${asset.name}`;
            requestAsset.appendChild(opt);
        });
    }

    tradePeer.addEventListener("change", rebuildRequestOptions);

    async function loadOrders() {
        const res = await fetch(`${API}/viewer-orders`, { headers: authHeaders() });
        if (res.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
            return;
        }
        const rows = await res.json();
        if (!rows.length) {
            ordersList.innerHTML = '<p style="color:#6b7280;">No orders yet.</p>';
            return;
        }
        ordersList.innerHTML = rows
            .map((o) => {
                const badgeClass =
                    o.status === "pending"
                        ? "badge-pending"
                        : o.status === "approved" || o.status === "fulfilled"
                          ? "badge-approved"
                          : "badge-rejected";
                return `
                <div class="card">
                    <div class="card-title">${o.asset_id} — ${o.asset_name || ""}</div>
                    <div class="card-meta">
                        <span class="badge ${badgeClass}">${o.status}</span>
                        · ${new Date(o.created_at).toLocaleString()}
                    </div>
                    ${o.note ? `<p style="margin:0.5rem 0 0; font-size:0.9rem;">${escapeHtml(o.note)}</p>` : ""}
                    ${o.staff_response ? `<p style="margin:0.5rem 0 0; font-size:0.85rem; color:#4b5563;"><strong>Staff:</strong> ${escapeHtml(o.staff_response)}</p>` : ""}
                </div>`;
            })
            .join("");
    }

    function escapeHtml(s) {
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    async function loadTrades() {
        const res = await fetch(`${API}/viewer-trades`, { headers: authHeaders() });
        if (res.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
            return;
        }
        const rows = await res.json();
        if (!rows.length) {
            tradesList.innerHTML = '<p style="color:#6b7280;">No trades yet.</p>';
            return;
        }
        tradesList.innerHTML = rows
            .map((t) => {
                const incoming = Number(t.to_user_id) === Number(user.id);
                const outgoing = Number(t.from_user_id) === Number(user.id);
                const badgeClass =
                    t.status === "pending"
                        ? "badge-pending"
                        : t.status === "completed"
                          ? "badge-completed"
                          : "badge-rejected";
                let actions = "";
                if (t.status === "pending") {
                    if (incoming) {
                        actions = `
                        <div class="btn-row">
                            <button type="button" class="btn-sm primary" data-trade-action="accept" data-id="${t.id}">Accept</button>
                            <button type="button" class="btn-sm" data-trade-action="reject" data-id="${t.id}">Reject</button>
                        </div>`;
                    } else if (outgoing) {
                        actions = `<div class="btn-row"><button type="button" class="btn-sm" data-trade-action="cancel" data-id="${t.id}">Cancel</button></div>`;
                    }
                }
                return `
                <div class="card">
                    <div class="card-title">
                        ${outgoing ? "You → " + t.to_username : t.from_username + " → you"}
                    </div>
                    <div class="card-meta">
                        <span class="badge ${badgeClass}">${t.status}</span>
                        · ${new Date(t.created_at).toLocaleString()}
                    </div>
                    <p style="margin:0.5rem 0 0; font-size:0.9rem;">
                        Offer: <strong>${t.offer_asset_id}</strong> (${t.offer_asset_name || ""})<br/>
                        For: <strong>${t.request_asset_id}</strong> (${t.request_asset_name || ""})
                    </p>
                    ${t.message ? `<p style="margin:0.35rem 0 0; font-size:0.85rem;">${escapeHtml(t.message)}</p>` : ""}
                    ${actions}
                </div>`;
            })
            .join("");

        tradesList.querySelectorAll("[data-trade-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                const action = btn.getAttribute("data-trade-action");
                const res2 = await fetch(`${API}/viewer-trades/${id}`, {
                    method: "PATCH",
                    headers: authHeaders(),
                    body: JSON.stringify({ action })
                });
                if (res2.status === 401) {
                    localStorage.removeItem("token");
                    window.location.href = "login.html";
                    return;
                }
                const data = await res2.json().catch(() => ({}));
                if (!res2.ok) {
                    showMessage(data.error || "Action failed", "error");
                    return;
                }
                showMessage(data.message || "Updated", "success");
                await loadTrades();
                await loadAssetsAndPeers();
            });
        });
    }

    orderForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submit = document.getElementById("orderSubmit");
        submit.disabled = true;
        try {
            const res = await fetch(`${API}/viewer-orders`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    asset_id: orderAsset.value,
                    note: document.getElementById("orderNote").value.trim() || null
                })
            });
            if (res.status === 401) {
                window.location.href = "login.html";
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed");
            showMessage(data.message || "Order placed", "success");
            orderForm.reset();
            await loadOrders();
        } catch (err) {
            showMessage(err.message, "error");
        } finally {
            submit.disabled = false;
        }
    });

    tradeForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submit = document.getElementById("tradeSubmit");
        submit.disabled = true;
        try {
            const res = await fetch(`${API}/viewer-trades`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    to_user_id: parseInt(tradePeer.value, 10),
                    offer_asset_id: offerAsset.value,
                    request_asset_id: requestAsset.value,
                    message: document.getElementById("tradeMessage").value.trim() || null
                })
            });
            if (res.status === 401) {
                window.location.href = "login.html";
                return;
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed");
            showMessage(data.message || "Trade sent", "success");
            tradeForm.reset();
            await hydrateProfile();       // keep user object fresh after trade
            await loadAssetsAndPeers();   // reload assets so assignments reflect swap
            rebuildOfferOptions();
            rebuildRequestOptions();
            await loadTrades();
        } catch (err) {
            showMessage(err.message, "error");
        } finally {
            submit.disabled = false;
        }
    });

    (async () => {
        try {
            await hydrateProfile();          // must finish first so user.full_name is set
            await loadAssetsAndPeers();       // now assetMatchesMe() has full_name
            rebuildOfferOptions();            // re-run after profile hydrated
            rebuildRequestOptions();
            await loadOrders();
            await loadTrades();
        } catch (e) {
            console.error(e);
            showMessage("Failed to load page data.", "error");
        }
    })();
});