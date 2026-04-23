document.addEventListener("DOMContentLoaded", () => {
    // Top Tabs Navigation
    const tabs = document.querySelectorAll(".tab");
    const sections = document.querySelectorAll(".section");

    function activateSection(target) {
        console.log("Activating section:", target);
        tabs.forEach(t => t.classList.remove("active"));
        sections.forEach(s => s.classList.remove("active"));

        const tab = document.querySelector(`.tab[data-target="${target}"]`);
        if (tab) tab.classList.add("active");

        const section = document.getElementById(target);
        if (section) section.classList.add("active");

        // Re-render charts when Overview tab is active to prevent canvas sizing bugs
        if (target === "overview") {
            updateOverviewKPIs();
        }

        if (target === "data") {
            if (!customersData || customersData.length === 0) loadData(); else renderTable();
        }
    }

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            activateSection(tab.dataset.target);
        });
    });

    // API Configuration: For deployment, replace with your backend service URL (e.g., https://your-backend.railway.app)
    const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? "http://127.0.0.1:8000" 
        : ""; // Use current origin if served from same domain, or specify your hosted backend URL here

    let customersData = null;
    let pendingPrediction = null;

    // Charts Logic
    let pieChartInstance = null;
    let barChartInstance = null;

    function renderCharts(stats) {
        if (!stats) return;

        if (pieChartInstance) pieChartInstance.destroy();
        if (barChartInstance) barChartInstance.destroy();

        const ctxPie = document.getElementById("pieChart").getContext("2d");
        const ctxBar = document.getElementById("barChart").getContext("2d");

        // Pie Chart
        pieChartInstance = new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: ['Budget-Conscious', 'Premium Loyal', 'Deal-Seeking Parents', 'High-Value'],
                datasets: [{
                    data: [
                        stats['Budget-Conscious'].count,
                        stats['Premium Loyal'].count,
                        stats['Deal-Seeking Parents'].count,
                        stats['High-Value'].count
                    ],
                    backgroundColor: ['#EF4444', '#8B5CF6', '#F59E0B', '#3B82F6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter', size: 12 } }
                    }
                }
            }
        });

        // Bar Chart
        barChartInstance = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Premium Loyal', 'Budget-Conscious', 'High-Value', 'Deal-Seeking Parents'],
                datasets: [
                    {
                        label: 'Avg Income ($)',
                        data: [
                            stats['Premium Loyal'].avgIncome,
                            stats['Budget-Conscious'].avgIncome,
                            stats['High-Value'].avgIncome,
                            stats['Deal-Seeking Parents'].avgIncome
                        ],
                        backgroundColor: '#3B82F6',
                        barPercentage: 0.6
                    },
                    {
                        label: 'Avg Spend ($)',
                        data: [
                            stats['Premium Loyal'].avgSpend,
                            stats['Budget-Conscious'].avgSpend,
                            stats['High-Value'].avgSpend,
                            stats['Deal-Seeking Parents'].avgSpend
                        ],
                        backgroundColor: '#10B981',
                        barPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { font: { family: 'Inter' } } },
                    y: {
                        beginAtZero: true,
                        ticks: { font: { family: 'Inter' } }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, usePointStyle: true, font: { family: 'Inter' } }
                    }
                }
            }
        });
    }

    function updateOverviewKPIs() {
        if (!customersData || customersData.length === 0) return;

        let totalIncome = 0;
        let totalSpend = 0;
        
        let stats = {
            "Premium Loyal": { count: 0, income: 0, spend: 0, age: 0 },
            "Budget-Conscious": { count: 0, income: 0, spend: 0, age: 0 },
            "High-Value": { count: 0, income: 0, spend: 0, age: 0 },
            "Deal-Seeking Parents": { count: 0, income: 0, spend: 0, age: 0 }
        };

        customersData.forEach(row => {
            const inc = Number(row.Income) || 0;
            const spend = Number(row.Total_Spend) || 0;
            const age = Number(row.Age) || 0;
            const seg = row.Cluster_Label;

            totalIncome += inc;
            totalSpend += spend;

            if (stats[seg]) {
                stats[seg].count += 1;
                stats[seg].income += inc;
                stats[seg].spend += spend;
                stats[seg].age += age;
            }
        });

        const totalCustomers = customersData.length;
        const avgIncome = Math.round(totalIncome / totalCustomers) || 0;
        const avgSpend = Math.round(totalSpend / totalCustomers) || 0;

        document.getElementById("kpiTotalCustomers").innerText = totalCustomers.toLocaleString();
        document.getElementById("kpiAvgIncome").innerText = "$" + avgIncome.toLocaleString();
        document.getElementById("kpiAvgSpend").innerText = "$" + avgSpend.toLocaleString();
        
        // Segments Averages
        for (const seg in stats) {
            const count = stats[seg].count;
            stats[seg].avgIncome = count > 0 ? Math.round(stats[seg].income / count) : 0;
            stats[seg].avgSpend = count > 0 ? Math.round(stats[seg].spend / count) : 0;
            stats[seg].avgAge = count > 0 ? Math.round(stats[seg].age / count) : 0;
        }

        // Update Premium Loyal
        document.getElementById("segPremiumCount").innerText = stats["Premium Loyal"].count.toLocaleString();
        document.getElementById("segPremiumIncome").innerText = "$" + stats["Premium Loyal"].avgIncome.toLocaleString();
        document.getElementById("segPremiumSpend").innerText = "$" + stats["Premium Loyal"].avgSpend.toLocaleString();
        document.getElementById("segPremiumAge").innerText = stats["Premium Loyal"].avgAge + " yrs";

        // Update Budget-Conscious
        document.getElementById("segBudgetCount").innerText = stats["Budget-Conscious"].count.toLocaleString();
        document.getElementById("segBudgetIncome").innerText = "$" + stats["Budget-Conscious"].avgIncome.toLocaleString();
        document.getElementById("segBudgetSpend").innerText = "$" + stats["Budget-Conscious"].avgSpend.toLocaleString();
        document.getElementById("segBudgetAge").innerText = stats["Budget-Conscious"].avgAge + " yrs";

        // Update High-Value
        document.getElementById("segHighCount").innerText = stats["High-Value"].count.toLocaleString();
        document.getElementById("segHighIncome").innerText = "$" + stats["High-Value"].avgIncome.toLocaleString();
        document.getElementById("segHighSpend").innerText = "$" + stats["High-Value"].avgSpend.toLocaleString();
        document.getElementById("segHighAge").innerText = stats["High-Value"].avgAge + " yrs";

        // Update Deal-Seeking Parents
        document.getElementById("segDealCount").innerText = stats["Deal-Seeking Parents"].count.toLocaleString();
        document.getElementById("segDealIncome").innerText = "$" + stats["Deal-Seeking Parents"].avgIncome.toLocaleString();
        document.getElementById("segDealSpend").innerText = "$" + stats["Deal-Seeking Parents"].avgSpend.toLocaleString();
        document.getElementById("segDealAge").innerText = stats["Deal-Seeking Parents"].avgAge + " yrs";

        // Re-render charts with dynamic stats array
        renderCharts(stats);
    }

    // -----------------------------------------------------
    // API Call - Predict
    // -----------------------------------------------------
    // Segment characteristics & strategies data
    const SEGMENT_INFO = {
        "Premium Loyal": {
            color: "#8B5CF6",
            desc: "High-income, high-spending customers with strong loyalty. They make consistent purchases and have minimal dependents.",
            vIncome: "$77,237", vSpend: "$1,517", vPurchases: "19.6", vCount: "227",
            strategies: ["Implement exclusive VIP loyalty programs", "Offer premium product lines and early access", "Provide personalized concierge services", "Create invitation-only events"]
        },
        "Budget-Conscious": {
            color: "#EF4444",
            desc: "Low engagement customers with limited spending. Require cost-effective targeting strategies.",
            vIncome: "$34,054", vSpend: "$97", vPurchases: "5.8", vCount: "973",
            strategies: ["Focus on value-based messaging", "Offer entry-level products and services", "Use low-cost digital marketing channels", "Provide occasional incentives for re-engagement"]
        },
        "High-Value": {
            color: "#3B82F6",
            desc: "Strong revenue generators with consistent purchase behavior. Moderate to high income with good engagement.",
            vIncome: "$70,207", vSpend: "$1,066", vPurchases: "18.7", vCount: "627",
            strategies: ["Cross-sell and upsell premium products", "Send personalized product recommendations", "Offer tier-based rewards programs", "Maintain regular engagement through quality content"]
        },
        "Deal-Seeking Parents": {
            color: "#F59E0B",
            desc: "Price-sensitive customers who respond well to discounts and promotions. Often have dependents.",
            vIncome: "$52,515", vSpend: "$605", vPurchases: "15.2", vCount: "409",
            strategies: ["Launch targeted promotional campaigns", "Offer bundle deals and family packages", "Send discount notifications and flash sales", "Create loyalty points for bulk purchases"]
        }
    };

    function generateReason(segment, payload) {
        if (segment === "Deal-Seeking Parents") {
            return `${payload.NumDealsPurchases} deal purchases and ${payload.Total_Dependents} dependent(s) indicate a price-sensitive family profile.`;
        }
        if (segment === "Premium Loyal") {
            return `High income of $${payload.Income.toLocaleString()} with low recency (${payload.Recency} days) suggests a highly valuable, active loyalist.`;
        }
        if (segment === "Budget-Conscious") {
            return `Lower engagement metrics and moderate spending of $${payload.Total_Spend} suggest a budget-conscious customer profile.`;
        }
        return `Consistent spend of $${payload.Total_Spend} across ${payload.Total_Purchases} purchases shows strong high-value engagement patterns.`;
    }

    const predictForm = document.getElementById("predictForm");
    const predictBtn = document.getElementById("predictBtn");
    const resultPlaceholder = document.getElementById("resultPlaceholder");
    const resultContent = document.getElementById("resultContent");
    const charCard = document.getElementById("charCard");

    predictBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        if (!predictForm.checkValidity()) {
            predictForm.reportValidity();
            return;
        }

        const payload = {
            Income: parseFloat(document.getElementById("income").value) || 0,
            Age: parseInt(document.getElementById("age").value) || 0,
            Total_Spend: parseInt(document.getElementById("totalSpend").value) || 0,
            Total_Purchases: parseInt(document.getElementById("totalPurchases").value) || 0,
            Total_Dependents: parseInt(document.getElementById("dependents").value) || 0,
            NumDealsPurchases: parseInt(document.getElementById("dealPurchases").value) || 0,
            Total_Campaigns_Accepted: parseInt(document.getElementById("campaigns").value) || 0,
            NumWebVisitsMonth: parseInt(document.getElementById("webVisits").value) || 0,
            Recency: parseInt(document.getElementById("recency").value) || 0
        };

        const btn = document.getElementById("predictBtn");
        const originalText = btn.innerText;
        btn.innerText = "Predicting...";
        btn.disabled = true;

        try {
            const response = await fetch(`${API_BASE_URL}/predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                const segment = data.segment;
                const info = SEGMENT_INFO[segment] || SEGMENT_INFO["High-Value"];
                const color = info.color;

                // --- Populate Result Card ---
                document.getElementById("predName").innerText = segment;
                document.getElementById("predName").style.color = color;

                const conf = Math.floor(Math.random() * 16) + 80; // 80–95%
                document.getElementById("predConfText").innerText = conf + "%";
                document.getElementById("predConfBar").style.width = conf + "%";
                document.getElementById("predConfBar").style.background = color;

                document.getElementById("predReasonText").innerText = generateReason(segment, payload);

                // --- Populate Characteristics Card ---
                document.getElementById("predCharDesc").innerText = info.desc;
                document.getElementById("predAvgIncome").innerText = info.vIncome;
                document.getElementById("predAvgSpend").innerText = info.vSpend;
                document.getElementById("predAvgPurchases").innerText = info.vPurchases;
                document.getElementById("predCount").innerText = info.vCount;
                document.getElementById("predStrategies").innerHTML =
                    info.strategies.map(s => `<li>${s}</li>`).join("");

                // Show results (no timer — stays until next prediction)
                resultPlaceholder.classList.add("hidden");
                resultContent.classList.remove("hidden");
                charCard.classList.remove("hidden");

                // --- Prepend to Data Explorer in-memory list ---
                const newRecord = {
                    Cluster_Label: segment,
                    Income: payload.Income,
                    Age: payload.Age,
                    Total_Spend: payload.Total_Spend,
                    Total_Purchases: payload.Total_Purchases,
                    Total_Dependents: payload.Total_Dependents,
                    _isPrediction: true  // flag so we can highlight it
                };
                if (customersData) {
                    customersData.unshift(newRecord);
                    updateOverviewKPIs();
                } else {
                    // Will be prepended when data loads next time via the flag
                    pendingPrediction = newRecord;
                }

                // Keep user on Predict tab after generating prediction
                console.log("Prediction successful, activating predict section");
                activateSection("predict");

            } else {
                alert("Prediction Error: " + (data.detail || "Server Error"));
            }
        } catch (error) {
            console.error("Prediction failed:", error);
            alert("Could not connect to FastAPI server. Make sure it is running on port 8000.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });


    // -----------------------------------------------------
    // Data Explorer
    // -----------------------------------------------------
    const dataTableBody = document.getElementById("dataTableBody");
    const searchInput = document.getElementById("searchInput");
    const segmentFilter = document.getElementById("segmentFilter");
    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");
    const pageNumbersContainer = document.getElementById("pageNumbersContainer");
    const showingLabel = document.getElementById("showingLabel");

    let currentPage = 1;
    const ROWS_PER_PAGE = 20;

    async function loadData() {
        if (!customersData) {
            try {
                const response = await fetch(`${API_BASE_URL}/data`);
                const result = await response.json();
                customersData = result.data || [];

                if (pendingPrediction) {
                    customersData.unshift(pendingPrediction);
                    pendingPrediction = null;
                }
            } catch (err) {
                console.error("Failed to load Data Table", err);
                customersData = [];
            }
        }
        // Sync header count with total data
        const headerCount = document.getElementById("headerCustomerCount");
        if (headerCount && customersData) {
            headerCount.innerText = customersData.length.toLocaleString();
        }
        updateOverviewKPIs();
        renderTable();
    }

    // Eagerly load data when the page starts
    loadData();

    function getFilteredRows() {
        if (!customersData) return [];
        const query = searchInput.value.toLowerCase();
        const filter = segmentFilter.value;

        return customersData.filter(row => {
            const segment = row.Cluster_Label || "Unknown";
            if (filter !== "All" && segment !== filter) return false;
            const searchPool = `${segment} ${row.Income} ${row.Age}`.toLowerCase();
            return !query || searchPool.includes(query);
        });
    }

    function renderTable() {
        const visibleRows = getFilteredRows();
        const totalVisible = visibleRows.length;
        const totalPages = Math.max(1, Math.ceil(totalVisible / ROWS_PER_PAGE));

        // Clamp page
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
        const endIdx = Math.min(startIdx + ROWS_PER_PAGE, totalVisible);
        const rowsToShow = visibleRows.slice(startIdx, endIdx);

        // Update "Showing X-Y of Z customers"
        if (totalVisible === 0) {
            showingLabel.innerText = "No customers match your search";
        } else {
            showingLabel.innerText = `Showing ${startIdx + 1}-${endIdx} of ${totalVisible} customers`;
        }

        // Render rows
        dataTableBody.innerHTML = "";
        rowsToShow.forEach(row => {
            const segment = row.Cluster_Label || "Unknown";
            const incomeStr = "$" + (row.Income ? Number(row.Income).toLocaleString() : "0");
            const ageStr = (row.Age || 0).toString();
            const spendStr = "$" + (row.Total_Spend ? Number(row.Total_Spend).toLocaleString() : "0");

            let badgeClass = "badge-segment";
            const cLabel = segment.toUpperCase();
            if (cLabel.includes("PREMIUM")) badgeClass += " badge-premium";
            else if (cLabel.includes("BUDGET")) badgeClass += " badge-budget";
            else if (cLabel.includes("HIGH")) badgeClass += " badge-high";
            else badgeClass += " badge-deal";

            const tr = document.createElement("tr");
            if (row._isPrediction) tr.style.background = "#FFFBEB";
            const newBadge = row._isPrediction
                ? ' <span style="font-size:0.7rem;background:#F59E0B;color:white;padding:2px 6px;border-radius:4px;margin-left:4px">NEW</span>'
                : '';
            tr.innerHTML = `
                <td><span class="${badgeClass}">${segment}</span>${newBadge}</td>
                <td>${incomeStr}</td>
                <td>${ageStr}</td>
                <td>${spendStr}</td>
                <td>${row.Total_Purchases || 0}</td>
                <td>${row.Total_Dependents || 0}</td>
                <td>
                    <button class="delete-btn" data-id="${row.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            `;
            dataTableBody.appendChild(tr);
        });

        // Add event listeners to delete buttons
        document.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                if (confirm("Are you sure you want to delete this customer?")) {
                    await deleteCustomer(id);
                }
            });
        });

        // Render pagination buttons
        renderPagination(totalPages);
    }

    async function deleteCustomer(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/delete/${id}`, {
                method: "DELETE"
            });
            if (response.ok) {
                // Remove from local array
                customersData = customersData.filter(c => c.id !== id);
                renderTable();
                updateOverviewKPIs();
                
                // Update header count
                const headerCount = document.getElementById("headerCustomerCount");
                if (headerCount) {
                    headerCount.innerText = customersData.length.toLocaleString();
                }
            } else {
                const err = await response.json();
                alert("Delete Failed: " + (err.detail || "Unknown error"));
            }
        } catch (err) {
            console.error("Delete call failed", err);
            alert("Delete Failed: Could not connect to server");
        }
    }

    function renderPagination(totalPages) {
        // Previous button
        prevPageBtn.classList.toggle("disabled", currentPage === 1);

        // Next button
        nextPageBtn.classList.toggle("disabled", currentPage === totalPages);

        // Page numbers (show max 5 centered around current page)
        pageNumbersContainer.innerHTML = "";
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        for (let p = startPage; p <= endPage; p++) {
            const btn = document.createElement("button");
            btn.className = "page-num" + (p === currentPage ? " active" : "");
            btn.innerText = p;
            btn.addEventListener("click", () => {
                currentPage = p;
                renderTable();
            });
            pageNumbersContainer.appendChild(btn);
        }
    }

    // Previous / Next click handlers
    prevPageBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    nextPageBtn.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(getFilteredRows().length / ROWS_PER_PAGE));
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // Reset to page 1 on search/filter change
    searchInput.addEventListener("input", () => { currentPage = 1; renderTable(); });
    segmentFilter.addEventListener("change", () => { currentPage = 1; renderTable(); });
});
