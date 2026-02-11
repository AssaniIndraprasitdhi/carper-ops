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

        if (plans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted py-4">No plans found</td></tr>';
            return;
        }

        tbody.innerHTML = plans.map(plan => {
            const statusClass = plan.status === 'planned' ? 'bg-primary'
                : plan.status === 'completed' ? 'bg-success'
                : plan.status === 'cancelled' ? 'bg-secondary'
                : 'bg-info';

            return `
                <tr>
                    <td><strong>${plan.planCode}</strong></td>
                    <td>${plan.canvasDesc || '-'}</td>
                    <td>${plan.rollWidth} m</td>
                    <td>${plan.pieceCount}</td>
                    <td><span class="fw-bold text-success">${plan.efficiencyPct}%</span></td>
                    <td>${formatNumber(plan.usedArea)}</td>
                    <td>${formatNumber(plan.wasteArea)}</td>
                    <td><span class="badge ${statusClass}">${plan.status}</span></td>
                    <td>${plan.createdAt}</td>
                    <td>
                        <a href="/Layout/PlanDetail/${plan.id}" class="btn btn-sm btn-outline-primary me-1" title="View">
                            <i class="bi bi-eye"></i>
                        </a>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${plan.id}" data-code="${plan.planCode}" title="Delete">
                            <i class="bi bi-trash"></i>
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
