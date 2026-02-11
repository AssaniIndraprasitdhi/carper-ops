// ===== Layout Planner - Multi-Algorithm Comparison =====

(function () {
    let cnvIdOptions = [];
    let currentOrders = [];
    let compareResults = [];
    let selectedCnvId = null;
    let activeOrderTypeFilter = '';
    let searchQuery = '';
    let expandedGroups = {};
    let detailRenderer = null;
    let currentDetailIndex = null;
    const rollWidthColors = {};
    const colorPalette = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#a29bfe'];

    // DOM refs
    const $ = id => document.getElementById(id);

    // Init
    document.addEventListener('DOMContentLoaded', async () => {
        await loadCnvIds();
        bindEvents();
    });

    function bindEvents() {
        $('cnvIdSelect').addEventListener('change', onCnvIdChange);
        $('btnLoadOrders').addEventListener('click', onLoadOrders);
        $('btnCalculate').addEventListener('click', onCalculate);
        $('btnRefresh').addEventListener('click', onRefresh);
        $('checkSelectAll').addEventListener('change', e => toggleAllOrders(e.target.checked));
        $('orderSearch').addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); renderOrdersList(); });
        $('rollWidthFilter').addEventListener('change', filterCardsByRollWidth);
        $('btnExportCsv').addEventListener('click', exportCsv);
        $('btnSaveFromDetail').addEventListener('click', onSaveFromDetail);
        $('btnDownloadPng').addEventListener('click', downloadPng);

        // OrderType tabs
        document.querySelectorAll('#orderTypeTabs .nav-link').forEach(tab => {
            tab.addEventListener('click', e => {
                e.preventDefault();
                document.querySelectorAll('#orderTypeTabs .nav-link').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeOrderTypeFilter = tab.dataset.filter;
                renderOrdersList();
            });
        });
    }

    // ───── Load cnv_id options ─────
    async function loadCnvIds() {
        try {
            cnvIdOptions = await fetchApi('/api/canvas-types/cnv-ids', { loadingMessage: 'กำลังโหลดข้อมูล..' });
            const select = $('cnvIdSelect');
            cnvIdOptions.forEach(opt => {
                const el = document.createElement('option');
                el.value = opt.cnvId;
                const widths = opt.rollWidths.map(w => w.rollWidth + 'm').join(', ');
                el.textContent = `[${opt.cnvId}] ${opt.cnvDesc} (${widths})`;
                select.appendChild(el);
            });
        } catch (err) {
            showAlert('โหลดข้อมูลผ้าไม่สำเร็จ: ' + err.message);
        }
    }

    function onCnvIdChange() {
        const val = $('cnvIdSelect').value;
        selectedCnvId = val || null;
        $('btnLoadOrders').disabled = !val;

        // Populate roll width filter
        const rwSelect = $('rollWidthFilter');
        rwSelect.innerHTML = '<option value="">ทุกขนาด</option>';
        if (val) {
            const opt = cnvIdOptions.find(o => o.cnvId === val);
            if (opt) {
                opt.rollWidths.forEach(rw => {
                    const el = document.createElement('option');
                    el.value = rw.rollWidth;
                    el.textContent = rw.rollWidth + 'm';
                    rwSelect.appendChild(el);
                });
            }
        }
    }

    // ───── Load Orders ─────
    async function onLoadOrders() {
        if (!selectedCnvId) return;
        try {
            await fetchApi('/api/sync', { method: 'POST', loadingMessage: 'กำลังโหลดข้อมูล..' });
            currentOrders = await fetchApi(`/api/orders?cnvId=${encodeURIComponent(selectedCnvId)}`, { loadingMessage: 'กำลังโหลดรายการ..' });
            currentOrders.forEach(o => o._selected = false);
            expandedGroups = {};
            renderOrdersList();
            updateSelectedCount();
        } catch (err) {
            showAlert('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
        }
    }

    function onRefresh() {
        if (selectedCnvId) onLoadOrders();
    }

    // ───── Sidebar Order List (Grouped by ORNO) ─────
    function getFilteredOrders() {
        return currentOrders.filter(o => {
            if (activeOrderTypeFilter && o.orderType !== activeOrderTypeFilter) return false;
            if (searchQuery) {
                const q = searchQuery;
                const match = (o.barcodeNo || '').toLowerCase().includes(q) ||
                              (o.orno || '').toLowerCase().includes(q);
                if (!match) return false;
            }
            return true;
        });
    }

    function groupByOrno(orders) {
        const groups = {};
        orders.forEach(o => {
            const key = o.orno || '(ไม่มี Order)';
            if (!groups[key]) {
                groups[key] = { orno: key, orderType: o.orderType, items: [] };
            }
            groups[key].items.push(o);
        });
        return Object.values(groups);
    }

    function renderOrdersList() {
        const list = $('ordersList');
        const filtered = getFilteredOrders();
        $('orderCount').textContent = currentOrders.length;

        // Update tab counts
        const allCount = currentOrders.length;
        const orderCount = currentOrders.filter(o => o.orderType === 'Order').length;
        const sampleCount = currentOrders.filter(o => o.orderType === 'Sample').length;
        const tabs = document.querySelectorAll('#orderTypeTabs .nav-link');
        tabs[0].innerHTML = `ทั้งหมด <span class="badge bg-white text-dark ms-1" style="font-size:0.6rem;">${allCount}</span>`;
        tabs[1].innerHTML = `Order <span class="badge bg-white text-dark ms-1" style="font-size:0.6rem;">${orderCount}</span>`;
        tabs[2].innerHTML = `Sample <span class="badge bg-white text-dark ms-1" style="font-size:0.6rem;">${sampleCount}</span>`;

        if (filtered.length === 0) {
            list.innerHTML = `<div class="text-center text-muted py-4 small">
                <i class="bi bi-inbox" style="font-size: 1.5rem; opacity:0.4;"></i>
                <p class="mt-2 mb-0">${currentOrders.length === 0 ? 'ไม่พบข้อมูล' : 'ไม่พบรายการที่ตรงกัน'}</p>
            </div>`;
            return;
        }

        const groups = groupByOrno(filtered);
        const ornoColors = ['#6c5ce7', '#0984e3', '#00b894', '#e17055', '#e84393', '#fdcb6e', '#00cec9', '#a29bfe'];

        list.innerHTML = groups.map((g, gi) => {
            const accentColor = ornoColors[gi % ornoColors.length];
            const allSelected = g.items.every(o => o._selected);
            const someSelected = g.items.some(o => o._selected);
            const selectedInGroup = g.items.filter(o => o._selected).length;
            const isExpanded = expandedGroups[g.orno];
            const typeBadge = g.orderType === 'Order'
                ? '<span class="badge order-badge-order">Order</span>'
                : '<span class="badge order-badge-sample">Sample</span>';

            const itemsHtml = g.items.map(o => {
                const origIdx = currentOrders.indexOf(o);
                const checked = o._selected ? 'checked' : '';
                const selClass = o._selected ? 'selected' : '';
                return `<div class="order-subitem ${selClass}" data-idx="${origIdx}">
                    <input type="checkbox" class="form-check-input order-cb" data-idx="${origIdx}" ${checked}>
                    <span class="barcode">${o.barcodeNo || ''}</span>
                    <span class="order-size">${formatNumber(o.width)}x${formatNumber(o.length)}m</span>
                </div>`;
            }).join('');

            return `<div class="order-group" data-orno="${g.orno}">
                <div class="order-group-header" style="border-left: 3px solid ${accentColor};">
                    <input type="checkbox" class="form-check-input group-cb" data-orno="${g.orno}"
                        ${allSelected ? 'checked' : ''} ${someSelected && !allSelected ? 'indeterminate' : ''}>
                    <div class="flex-grow-1 group-toggle" data-orno="${g.orno}">
                        <div class="d-flex align-items-center gap-2">
                            <span class="order-group-name">${g.orno}</span>
                            ${typeBadge}
                        </div>
                        <div class="order-group-meta">
                            <span>${g.items.length} ชิ้น</span>
                            ${selectedInGroup > 0 ? `<span class="text-success">( เลือก ${selectedInGroup})</span>` : ''}
                        </div>
                    </div>
                    <i class="bi ${isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} text-muted group-chevron"></i>
                </div>
                <div class="order-group-items ${isExpanded ? '' : 'd-none'}" data-orno="${g.orno}">
                    ${itemsHtml}
                </div>
            </div>`;
        }).join('');

        // Set indeterminate state for group checkboxes
        list.querySelectorAll('.group-cb').forEach(cb => {
            const orno = cb.dataset.orno;
            const grp = groups.find(g => g.orno === orno);
            if (grp) {
                const allSel = grp.items.every(o => o._selected);
                const someSel = grp.items.some(o => o._selected);
                cb.indeterminate = someSel && !allSel;
            }
        });

        // Bind group toggle
        list.querySelectorAll('.group-toggle').forEach(el => {
            el.addEventListener('click', () => {
                const orno = el.dataset.orno;
                expandedGroups[orno] = !expandedGroups[orno];
                const itemsDiv = list.querySelector(`.order-group-items[data-orno="${CSS.escape(orno)}"]`);
                const chevron = el.closest('.order-group-header').querySelector('.group-chevron');
                if (itemsDiv) itemsDiv.classList.toggle('d-none');
                if (chevron) {
                    chevron.classList.toggle('bi-chevron-down');
                    chevron.classList.toggle('bi-chevron-up');
                }
            });
        });

        // Bind group checkbox
        list.querySelectorAll('.group-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const orno = cb.dataset.orno;
                const grp = groups.find(g => g.orno === orno);
                if (grp) grp.items.forEach(o => o._selected = cb.checked);
                renderOrdersList();
                updateSelectedCount();
            });
        });

        // Bind individual checkboxes
        list.querySelectorAll('.order-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                const idx = parseInt(cb.dataset.idx);
                currentOrders[idx]._selected = cb.checked;
                renderOrdersList();
                updateSelectedCount();
            });
        });

        // Bind subitem row click
        list.querySelectorAll('.order-subitem').forEach(el => {
            el.addEventListener('click', e => {
                if (e.target.type === 'checkbox') return;
                const idx = parseInt(el.dataset.idx);
                currentOrders[idx]._selected = !currentOrders[idx]._selected;
                renderOrdersList();
                updateSelectedCount();
            });
        });
    }

    function toggleAllOrders(checked) {
        const filtered = getFilteredOrders();
        filtered.forEach(o => o._selected = checked);
        renderOrdersList();
        updateSelectedCount();
    }

    function updateSelectedCount() {
        const count = currentOrders.filter(o => o._selected).length;
        const badge = $('selectedCount');
        if (count > 0) {
            badge.textContent = count + ' เลือก';
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
        $('btnCalculate').disabled = count === 0;
    }

    // ───── Calculate (Compare all algorithms x all widths) ─────
    async function onCalculate() {
        const selectedBarcodes = currentOrders.filter(o => o._selected).map(o => o.barcodeNo);
        if (selectedBarcodes.length === 0) return;

        try {
            const response = await fetchApi('/api/calculation/compare', {
                method: 'POST',
                body: JSON.stringify({ cnvId: selectedCnvId, selectedBarcodes }),
                loadingMessage: 'กำลังคำนวณ Algorithm..'
            });
            compareResults = response.results || [];
            renderComparisonCards();
            $('btnExportCsv').classList.remove('d-none');
        } catch (err) {
            showAlert('คำนวณไม่สำเร็จ: ' + err.message);
        }
    }

    // ───── Render Algorithm Comparison Cards ─────
    function renderComparisonCards() {
        const container = $('algorithmCards');

        if (compareResults.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted py-5">ไม่สามารถคำนวณได้</div>';
            return;
        }

        // Assign colors to roll widths
        const widths = [...new Set(compareResults.map(r => r.rollWidth))].sort((a, b) => a - b);
        widths.forEach((w, i) => { rollWidthColors[w] = colorPalette[i % colorPalette.length]; });

        // Color legend
        const legend = $('colorLegend');
        const legendItems = $('legendItems');
        legend.classList.remove('d-none');
        legendItems.innerHTML = widths.map(w =>
            `<span class="d-flex align-items-center gap-1 small">
                <span class="legend-swatch" style="background:${rollWidthColors[w]}"></span> ${w}m
            </span>`
        ).join('');
        $('resultSummary').textContent = `${compareResults.length} results | ${widths.length} roll widths`;

        // Render cards
        container.innerHTML = compareResults.map((r, i) => {
            const eff = r.result.efficiencyPct;
            const effClass = eff >= 70 ? 'eff-high' : (eff >= 50 ? 'eff-mid' : 'eff-low');
            const bestBadge = r.isBest ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.65rem;">ดีที่สุด</span>' : '';
            const bestClass = r.isBest ? 'best-card' : '';
            const borderColor = rollWidthColors[r.rollWidth] || '#ddd';
            const canvasId = `mini_${i}`;

            return `<div class="col-xxl-3 col-xl-4 col-lg-6 card-col" data-rollwidth="${r.rollWidth}">
                <div class="algorithm-card ${bestClass}" style="border-top: 3px solid ${borderColor};">
                    <div class="card-header bg-white py-2 px-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-medium small">${r.algorithmNameTh}</span>
                            <span class="badge bg-light text-dark border" style="font-size:0.7rem;">${r.rollWidth}m</span>
                        </div>
                        <div class="small text-muted">${r.algorithmName} ${bestBadge}</div>
                    </div>
                    <div class="card-body p-3">
                        <div class="text-center mb-2">
                            <div class="fs-2 fw-bold ${effClass}">${eff}%</div>
                            <div class="small text-muted" style="margin-top:-4px;">ประสิทธิภาพ</div>
                        </div>
                        <div class="mini-canvas-wrap mb-2"><canvas id="${canvasId}"></canvas></div>
                        <div class="row g-1 text-center" style="font-size:0.72rem;">
                            <div class="col-3">
                                <div class="text-muted">ตร.ม.</div>
                                <div class="fw-bold">${formatNumber(r.result.usedArea)}</div>
                            </div>
                            <div class="col-3">
                                <div class="text-muted">สูญเสีย</div>
                                <div class="fw-bold text-danger">${formatNumber(r.result.wasteArea)}</div>
                            </div>
                            <div class="col-3">
                                <div class="text-muted">ยาว</div>
                                <div class="fw-bold">${formatNumber(r.result.totalLength)}</div>
                            </div>
                            <div class="col-3">
                                <div class="text-muted">ชิ้น</div>
                                <div class="fw-bold">${r.result.pieceCount}</div>
                            </div>
                        </div>
                        <div class="mt-2">
                            <div class="progress">
                                <div class="progress-bar" style="width:${Math.min(100, eff)}%; background:${borderColor};"></div>
                            </div>
                        </div>
                    </div>
                    <div class="card-footer bg-white d-flex gap-1 py-2 px-3">
                        <button class="btn btn-sm btn-outline-primary flex-fill btn-detail" data-idx="${i}">
                            <i class="bi bi-eye me-1"></i>ดูรายละเอียด
                        </button>
                        <button class="btn btn-sm btn-success btn-save" data-idx="${i}" title="บันทึกแผน">
                            <i class="bi bi-plus-lg"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Render mini canvases
        requestAnimationFrame(() => {
            compareResults.forEach((r, i) => {
                try {
                    const renderer = new CanvasRenderer(`mini_${i}`, { mini: true });
                    renderer.render(r.result);
                } catch (e) { /* ignore render errors */ }
            });
        });

        // Bind card buttons
        container.querySelectorAll('.btn-detail').forEach(btn => {
            btn.addEventListener('click', () => openDetail(parseInt(btn.dataset.idx)));
        });
        container.querySelectorAll('.btn-save').forEach(btn => {
            btn.addEventListener('click', () => saveFromCard(parseInt(btn.dataset.idx)));
        });

        // Apply roll width filter
        filterCardsByRollWidth();
    }

    function filterCardsByRollWidth() {
        const val = $('rollWidthFilter').value;
        document.querySelectorAll('.card-col').forEach(col => {
            if (!val || col.dataset.rollwidth === val) {
                col.classList.remove('d-none');
            } else {
                col.classList.add('d-none');
            }
        });
    }

    // ───── Detail Modal ─────
    function openDetail(index) {
        const r = compareResults[index];
        if (!r) return;
        currentDetailIndex = index;

        $('detailModalTitle').textContent = `${r.algorithmNameTh} (${r.algorithmName}) - ${r.rollWidth}m`;

        // Metrics
        $('detailMetrics').innerHTML = `
            <div class="row g-2">
                <div class="col-6"><div class="detail-metric">
                    <div class="value ${r.result.efficiencyPct >= 70 ? 'text-success' : 'text-warning'}">${r.result.efficiencyPct}%</div>
                    <div class="label">ประสิทธิภาพ</div>
                </div></div>
                <div class="col-6"><div class="detail-metric">
                    <div class="value">${formatNumber(r.result.usedArea)}</div>
                    <div class="label">ตร.ม. ใช้จริง</div>
                </div></div>
                <div class="col-6"><div class="detail-metric">
                    <div class="value text-danger">${formatNumber(r.result.wasteArea)}</div>
                    <div class="label">สูญเสีย</div>
                </div></div>
                <div class="col-6"><div class="detail-metric">
                    <div class="value">${formatNumber(r.result.totalLength)}m</div>
                    <div class="label">ความยาวรวม</div>
                </div></div>
                <div class="col-6"><div class="detail-metric">
                    <div class="value">${r.result.pieceCount}</div>
                    <div class="label">จำนวนชิ้น</div>
                </div></div>
                <div class="col-6"><div class="detail-metric">
                    <div class="value">${r.rollWidth}m</div>
                    <div class="label">ความกว้างม้วน</div>
                </div></div>
            </div>`;

        // Items table
        const items = r.result.packedItems || [];
        $('detailItems').innerHTML = `
            <table class="table table-sm table-hover mb-0" style="font-size:0.75rem;">
                <thead><tr><th>#</th><th>Barcode</th><th>ORNO</th><th>Size</th><th>R</th></tr></thead>
                <tbody>${items.map((it, i) => `<tr>
                    <td>${i + 1}</td>
                    <td><code style="font-size:0.7rem;">${it.barcodeNo || ''}</code></td>
                    <td>${it.orno || ''}</td>
                    <td>${it.packWidth}x${it.packLength}</td>
                    <td>${it.isRotated ? '<i class="bi bi-arrow-repeat text-warning"></i>' : ''}</td>
                </tr>`).join('')}</tbody>
            </table>`;

        // Show modal then render canvas
        const modal = new bootstrap.Modal($('detailModal'));
        modal.show();

        $('detailModal').addEventListener('shown.bs.modal', function handler() {
            $('detailModal').removeEventListener('shown.bs.modal', handler);
            if (!detailRenderer) {
                detailRenderer = new CanvasRenderer('detailCanvas');
            }
            detailRenderer.render(r.result);
        });
    }

    // ───── Save Plan ─────
    async function saveFromCard(index) {
        const r = compareResults[index];
        if (!r) return;
        await doSave(r);
    }

    async function onSaveFromDetail() {
        if (currentDetailIndex === null) return;
        const r = compareResults[currentDetailIndex];
        if (!r) return;
        bootstrap.Modal.getInstance($('detailModal'))?.hide();
        await doSave(r);
    }

    async function doSave(r) {
        try {
            const plan = await fetchApi('/api/plans', {
                method: 'POST',
                body: JSON.stringify({
                    canvasTypeId: r.canvasTypeId,
                    rollWidth: r.result.rollWidth,
                    totalLength: r.result.totalLength,
                    totalArea: r.result.totalArea,
                    usedArea: r.result.usedArea,
                    wasteArea: r.result.wasteArea,
                    efficiencyPct: r.result.efficiencyPct,
                    pieceCount: r.result.pieceCount,
                    packedItems: r.result.packedItems
                }),
                loadingMessage: 'กำลังบันทึก..'
            });

            $('savedPlanCode').textContent = plan.planCode;
            $('btnViewPlan').href = `/Layout/PlanDetail/${plan.id}`;
            new bootstrap.Modal($('successModal')).show();

            // Reload orders
            await onLoadOrders();
            compareResults = [];
            $('algorithmCards').innerHTML = '<div class="col-12 text-center text-muted py-5">บันทึกสำเร็จ กดคำนวณใหม่</div>';
            $('colorLegend').classList.add('d-none');
            $('btnExportCsv').classList.add('d-none');
        } catch (err) {
            showAlert('Save failed: ' + err.message);
        }
    }

    // ───── Export ─────
    function exportCsv() {
        if (compareResults.length === 0) return;
        const rows = [['Algorithm', 'Algorithm (TH)', 'Roll Width', 'Efficiency %', 'Used Area', 'Waste Area', 'Total Length', 'Pieces', 'Best']];
        compareResults.forEach(r => {
            rows.push([r.algorithmName, r.algorithmNameTh, r.rollWidth, r.result.efficiencyPct,
                r.result.usedArea, r.result.wasteArea, r.result.totalLength, r.result.pieceCount, r.isBest ? 'Yes' : '']);
        });
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `layout-compare-${Date.now()}.csv`;
        link.click();
    }

    function downloadPng() {
        const canvas = $('detailCanvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `layout-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

})();
