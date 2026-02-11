// ===== Plan Manager - Plans List Page =====

(function () {
    let plans = [];
    let deleteTargetId = null;

    document.addEventListener('DOMContentLoaded', function () {
        loadPlans();

        document.getElementById('statusFilter').addEventListener('change', loadPlans);
        document.getElementById('btnRefresh').addEventListener('click', loadPlans);
        document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);
    });

    async function loadPlans() {
        const status = document.getElementById('statusFilter').value;
        const url = status ? `/api/plans?status=${status}` : '/api/plans';

        try {
            plans = await fetchApi(url, { loadingMessage: 'Loading plans...' });
            renderTable();
        } catch (err) {
            showAlert('Failed to load plans: ' + err.message);
        }
    }

    function renderTable() {
        const tbody = document.getElementById('plansTableBody');
        const summary = document.getElementById('plansSummary');

        if (plans.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-5">
                <i class="bi bi-inbox text-muted" style="font-size:2.5rem;opacity:0.4;"></i>
                <p class="text-muted mt-2 mb-0">ยังไม่มีแผน</p>
            </td></tr>`;
            if (summary) summary.textContent = '0 แผน';
            return;
        }

        if (summary) summary.textContent = `${plans.length} แผน`;

        tbody.innerHTML = plans.map(plan => {
            const eff = plan.efficiencyPct;
            const effColor = eff >= 70 ? '#16a34a' : eff >= 50 ? '#ea580c' : '#dc2626';
            const effBg = eff >= 70 ? '#f0fdf4' : eff >= 50 ? '#fff7ed' : '#fef2f2';

            const statusMap = {
                planned: { bg: '#eff6ff', color: '#2563eb', icon: 'bi-clock', label: 'Planned' },
                completed: { bg: '#f0fdf4', color: '#16a34a', icon: 'bi-check-circle', label: 'Completed' },
                cancelled: { bg: '#f3f4f6', color: '#6b7280', icon: 'bi-x-circle', label: 'Cancelled' },
            };
            const st = statusMap[plan.status] || statusMap.planned;

            return `
                <tr class="plans-row" onclick="window.location='/Layout/PlanDetail/${plan.id}'" style="cursor:pointer;">
                    <td class="ps-4">
                        <div class="fw-semibold" style="color:#1e3a5f;">${plan.planCode}</div>
                    </td>
                    <td>
                        <span class="text-muted">${plan.canvasDesc || '-'}</span>
                    </td>
                    <td class="text-center">
                        <span class="fw-medium">${plan.rollWidth}</span><span class="text-muted small"> m</span>
                    </td>
                    <td class="text-center">
                        <span class="fw-medium">${plan.pieceCount}</span>
                    </td>
                    <td class="text-center">
                        <span class="plans-eff-badge" style="background:${effBg};color:${effColor};">${eff}%</span>
                    </td>
                    <td class="text-end">
                        <span class="fw-medium">${formatNumber(plan.usedArea)}</span><span class="text-muted small"> ตร.ม.</span>
                    </td>
                    <td class="text-end">
                        <span class="text-danger fw-medium">${formatNumber(plan.wasteArea)}</span><span class="text-muted small"> ตร.ม.</span>
                    </td>
                    <td class="text-center">
                        <span class="plans-status-badge" style="background:${st.bg};color:${st.color};">
                            <i class="bi ${st.icon} me-1" style="font-size:0.7rem;"></i>${st.label}
                        </span>
                    </td>
                    <td>
                        <span class="text-muted small">${plan.createdAt}</span>
                    </td>
                    <td class="text-center pe-4" onclick="event.stopPropagation();">
                        <button class="plans-action-btn btn-delete" data-id="${plan.id}" data-code="${plan.planCode}" title="ลบ">
                            <i class="bi bi-trash3"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind delete buttons
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', function () {
                deleteTargetId = this.dataset.id;
                document.getElementById('deletePlanCode').textContent = this.dataset.code;
                new bootstrap.Modal(document.getElementById('deleteModal')).show();
            });
        });
    }

    async function confirmDelete() {
        if (!deleteTargetId) return;

        try {
            await fetchApi(`/api/plans/${deleteTargetId}`, {
                method: 'DELETE',
                loadingMessage: 'Deleting plan...'
            });

            bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
            showAlert('Plan deleted successfully', 'success');
            await loadPlans();
        } catch (err) {
            showAlert('Failed to delete plan: ' + err.message);
        } finally {
            deleteTargetId = null;
        }
    }

})();
