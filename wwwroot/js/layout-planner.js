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
    let totalSelected = 0;
    // viewMode removed — always 'width' (actual) with zoom controls
    let editingPlanId = null;   // non-null when editing an existing plan
    let editingPlanCode = null;

    // DOM refs
    const $ = id => document.getElementById(id);

    // Helper: get AsPlan value regardless of JSON property casing
    function getAsPlan(o) {
        return o.asplan || o.ASPLAN || o.asPlan || o.AsPlan || '';
    }

    // Zoom label — top-level so accessible from both bindEvents and openDetail
    function updateZoomLabel(level) {
        const btn = $('btnZoomReset');
        if (btn) btn.textContent = Math.round((level ?? (detailRenderer ? detailRenderer.getZoomLevel() : 1)) * 100) + '%';
    }

    // Init
    document.addEventListener('DOMContentLoaded', async () => {
        await loadCnvIds();
        bindEvents();
        await checkEditMode();
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

        // Zoom controls
        $('btnZoomIn').addEventListener('click', () => { if (detailRenderer) detailRenderer.zoomIn(); });
        $('btnZoomOut').addEventListener('click', () => { if (detailRenderer) detailRenderer.zoomOut(); });
        $('btnZoomReset').addEventListener('click', () => { if (detailRenderer) detailRenderer.zoomReset(); });

        // Mouse wheel zoom on canvas container
        const canvasContainer = $('detailCanvasContainer');
        if (canvasContainer) {
            canvasContainer.addEventListener('wheel', (e) => {
                if (!detailRenderer) return;
                if (!e.ctrlKey) return; // only zoom with Ctrl+wheel
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.08 : 0.08;
                detailRenderer.setZoom(detailRenderer.getZoomTarget() + delta);
            }, { passive: false });
        }

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
            cnvIdOptions.forEach((opt, idx) => {
                const el = document.createElement('option');
                el.value = opt.cnvId;
                const widths = opt.rollWidths.map(w => w.rollWidth + 'm').join(', ');
                const cnt = opt.orderCount || 0;
                el.textContent = `${idx + 1}. ${opt.cnvDesc} (${widths}) — ${cnt} รายการ`;
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
            let url = `/api/orders?cnvId=${encodeURIComponent(selectedCnvId)}`;
            if (editingPlanId) url += `&excludePlanId=${editingPlanId}`;
            currentOrders = await fetchApi(url, { loadingMessage: 'กำลังโหลดรายการ..' });
            // Debug: log AsPlan info to console
            if (currentOrders.length > 0) {
                const keys = Object.keys(currentOrders[0]);
                const asPlanKey = keys.find(k => k.toLowerCase() === 'asplan');
                console.log('[DEBUG] JSON keys:', keys.join(', '));
                console.log('[DEBUG] AsPlan key:', asPlanKey, '| sample:', currentOrders[0][asPlanKey]);
            }
            currentOrders.forEach(o => o._selected = false);
            expandedGroups = {};

            // Auto-fill tag from report allowance data
            await autoFillTagsFromReport();

            renderOrdersList();
            updateSelectedCount();
        } catch (err) {
            showAlert('โหลดข้อมูลไม่สำเร็จ: ' + err.message);
        }
    }

    async function autoFillTagsFromReport() {
        try {
            const barcodes = currentOrders.map(o => o.barcodeNo).filter(Boolean);
            if (barcodes.length === 0) return;

            const tagMap = await fetchApi('/Report/GetTagsByBarcodes', {
                method: 'POST',
                body: JSON.stringify(barcodes)
            });

            if (!tagMap || typeof tagMap !== 'object') return;

            let filled = 0;
            currentOrders.forEach(o => {
                const tag = tagMap[o.barcodeNo];
                if (tag && tag.tagWidth > 0 && tag.tagLength > 0) {
                    o._tagWidth = tag.tagWidth;
                    o._tagLength = tag.tagLength;
                    o._tagFromReport = true;
                    filled++;
                }
            });

            if (filled > 0) {
                console.log(`[Tag] Auto-filled ${filled} items from report data`);
            }
        } catch (err) {
            console.warn('[Tag] Could not load report data:', err.message);
        }
    }

    function onRefresh() {
        if (selectedCnvId) onLoadOrders();
    }

    // ───── Sidebar Order List (Grouped by ORNO) ─────
    function getFilteredOrders() {
        return currentOrders.filter(o => {
            if (activeOrderTypeFilter === 'AsPlan') {
                if (getAsPlan(o) !== 'Y') return false;
            } else if (activeOrderTypeFilter) {
                if (o.orderType !== activeOrderTypeFilter) return false;
            }
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
        const asPlanCount = currentOrders.filter(o => getAsPlan(o) === 'Y').length;
        const tabs = document.querySelectorAll('#orderTypeTabs .nav-link');
        tabs[0].innerHTML = `ทั้งหมด <span class="badge bg-white text-dark ms-1" style="font-size:0.6rem;">${allCount}</span>`;
        tabs[1].innerHTML = `Order <span class="badge bg-white text-dark ms-1" style="font-size:0.6rem;">${orderCount}</span>`;
        tabs[2].innerHTML = `Sample <span class="badge bg-white text-dark ms-1" style="font-size:0.6rem;">${sampleCount}</span>`;
        tabs[3].innerHTML = `AsPlan <span class="badge bg-white text-dark ms-1" style="font-size:0.6rem;">${asPlanCount}</span>`;

        if (filtered.length === 0) {
            list.innerHTML = `<div class="text-center text-muted py-4 small">
                <i class="bi bi-inbox" style="font-size: 1.5rem; opacity:0.4;"></i>
                <p class="mt-2 mb-0">${currentOrders.length === 0 ? 'ไม่พบข้อมูล' : 'ไม่พบรายการที่ตรงกัน'}</p>
            </div>`;
            return;
        }

        const groups = groupByOrno(filtered);
        const ornoColors = ['#1976d2', '#0d47a1', '#29b6f6', '#1565c0', '#0277bd', '#01579b', '#039be5', '#64b5f6'];

        list.innerHTML = groups.map((g, gi) => {
            const accentColor = ornoColors[gi % ornoColors.length];
            const allSelected = g.items.every(o => o._selected);
            const someSelected = g.items.some(o => o._selected);
            const selectedInGroup = g.items.filter(o => o._selected).length;
            const isExpanded = expandedGroups[g.orno];
            const typeBadge = g.orderType === 'Order'
                ? '<span class="badge order-badge-order">Order</span>'
                : '<span class="badge order-badge-sample">Sample</span>';
            const asPlanCount = g.items.filter(o => getAsPlan(o) === 'Y').length;
            const groupAsPlanBadge = asPlanCount > 0
                ? `<span class="badge asplan-badge">${asPlanCount} AsPlan</span>`
                : '';

            const itemsHtml = g.items.map(o => {
                const origIdx = currentOrders.indexOf(o);
                const checked = o._selected ? 'checked' : '';
                const selClass = o._selected ? 'selected' : '';
                const tw = o._tagWidth ?? '';
                const tl = o._tagLength ?? '';
                const isAsPlan = getAsPlan(o) === 'Y';
                const asPlanBadge = isAsPlan ? '<span class="badge asplan-badge">AsPlan</span>' : '';
                const tagRequired = isAsPlan ? 'tag-required' : '';
                const missingTag = isAsPlan && o._selected && (!o._tagWidth || !o._tagLength);
                const missingClass = missingTag ? 'tag-missing' : '';
                const tagLocked = o._tagFromReport ? 'tag-locked' : '';
                const tagReadonly = o._tagFromReport ? 'readonly' : '';
                const tagIcon = o._tagFromReport
                    ? '<i class="bi bi-lock-fill" style="font-size:0.5rem;"></i>'
                    : (isAsPlan ? '<i class="bi bi-pencil-fill" style="font-size:0.5rem;"></i>' : 'Tag');
                return `<div class="order-subitem ${selClass}" data-idx="${origIdx}">
                    <input type="checkbox" class="form-check-input order-cb" data-idx="${origIdx}" ${checked}>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex align-items-center gap-1">
                            <span class="barcode">${o.barcodeNo || ''}</span>
                            ${asPlanBadge}
                            <span class="order-size">${formatNumber(o.width)}x${formatNumber(o.length)}m</span>
                        </div>
                        <div class="tag-input-row ${tagRequired} ${missingClass} ${tagLocked}" onclick="event.stopPropagation();">
                            <span class="tag-label">${tagIcon}</span>
                            <input type="number" class="tag-input tag-w" data-idx="${origIdx}" value="${tw}" placeholder="W" step="0.01" ${tagReadonly}>
                            <span class="tag-x">x</span>
                            <input type="number" class="tag-input tag-l" data-idx="${origIdx}" value="${tl}" placeholder="L" step="0.01" ${tagReadonly}>
                            <span class="tag-unit">m</span>
                        </div>
                    </div>
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
                            ${groupAsPlanBadge}
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
                if (e.target.type === 'checkbox' || e.target.type === 'number') return;
                const idx = parseInt(el.dataset.idx);
                currentOrders[idx]._selected = !currentOrders[idx]._selected;
                renderOrdersList();
                updateSelectedCount();
            });
        });

        // Bind tag inputs
        list.querySelectorAll('.tag-w').forEach(inp => {
            inp.addEventListener('change', () => {
                const idx = parseInt(inp.dataset.idx);
                currentOrders[idx]._tagWidth = inp.value ? parseFloat(inp.value) : null;
            });
        });
        list.querySelectorAll('.tag-l').forEach(inp => {
            inp.addEventListener('change', () => {
                const idx = parseInt(inp.dataset.idx);
                currentOrders[idx]._tagLength = inp.value ? parseFloat(inp.value) : null;
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

        // Validate AsPlan items must have Tag W & H
        const asPlanMissing = currentOrders.filter(o =>
            o._selected &&
            getAsPlan(o) === 'Y' &&
            (!o._tagWidth || !o._tagLength)
        );
        if (asPlanMissing.length > 0) {
            const barcodes = asPlanMissing.map(o => o.barcodeNo).join(', ');
            showAlert(`กรุณากรอก Tag Width และ Height สำหรับรายการ AsPlan: ${barcodes}`, 'warning');
            renderOrdersList();
            return;
        }

        try {
            const response = await fetchApi('/api/calculation/compare', {
                method: 'POST',
                body: JSON.stringify({ cnvId: selectedCnvId, selectedBarcodes }),
                loadingMessage: 'กำลังคำนวณ Algorithm..'
            });
            const allResults = response.results || [];
            totalSelected = response.totalSelected || selectedBarcodes.length;
            // Keep only the single best result
            const best = allResults.find(r => r.isBest) || allResults[0];
            compareResults = best ? [best] : [];
            enrichPackedItemsWithTags();
            renderComparisonCards();
            $('btnExportCsv').classList.remove('d-none');
        } catch (err) {
            showAlert('คำนวณไม่สำเร็จ: ' + err.message);
        }
    }

    // ───── Enrich packed items with tag dimensions and asPlan from sidebar ─────
    function enrichPackedItemsWithTags() {
        // Build lookup: barcodeNo → { tagWidth, tagLength, asPlan }
        const tagMap = {};
        currentOrders.forEach(o => {
            const isAsPlan = getAsPlan(o) === 'Y';
            if (o._tagWidth || o._tagLength || isAsPlan) {
                tagMap[o.barcodeNo] = { tagWidth: o._tagWidth || null, tagLength: o._tagLength || null, asPlan: isAsPlan };
            }
        });

        compareResults.forEach(cr => {
            (cr.result.packedItems || []).forEach(item => {
                const tag = tagMap[item.barcodeNo];
                if (tag) {
                    item._tagWidth = tag.tagWidth;
                    item._tagLength = tag.tagLength;
                    item._asPlan = tag.asPlan;
                }
            });
        });
    }

    // ───── Render Algorithm Result Card (Best Only — "มาตรฐาน") ─────
    function renderComparisonCards() {
        const container = $('algorithmCards');

        if (compareResults.length === 0) {
            container.innerHTML = '<div class="col-12 text-center text-muted py-5">ไม่สามารถคำนวณได้</div>';
            return;
        }

        // Hide legend/filter — single result only
        $('colorLegend').classList.add('d-none');
        $('resultSummary').textContent = '';

        const r = compareResults[0];
        const eff = r.result.efficiencyPct;
        const effClass = eff >= 70 ? 'eff-high' : (eff >= 50 ? 'eff-mid' : 'eff-low');
        const borderColor = '#1976d2';
        const skipped = r.skippedCount || 0;
        const skippedWarn = skipped > 0
            ? `<div class="skipped-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i>ข้าม ${skipped} ชิ้น (เกิน ${r.rollWidth}m)</div>`
            : '';

        container.innerHTML = `<div class="col-xxl-3 col-xl-3 col-lg-4 col-md-6 card-col" data-rollwidth="${r.rollWidth}">
            <div class="algorithm-card best-card" style="border-top: 3px solid ${borderColor};">
                <div class="card-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-medium" style="font-size:0.75rem;">มาตรฐาน</span>
                        <span class="badge bg-light text-dark border" style="font-size:0.65rem;">${r.rollWidth}m</span>
                    </div>
                    <div class="text-muted" style="font-size:0.68rem;">${r.algorithmName} — ${r.algorithmNameTh}</div>
                </div>
                <div class="card-body p-2">
                    ${skippedWarn}
                    <div class="text-center mb-1">
                        <div class="fw-bold ${effClass}" style="font-size:1.5rem;">${eff}%</div>
                        <div class="text-muted" style="font-size:0.65rem;margin-top:-2px;">ประสิทธิภาพ</div>
                    </div>
                    <div class="mini-canvas-wrap mb-2"><canvas id="mini_0"></canvas></div>
                    <div class="row g-0 text-center" style="font-size:0.68rem;">
                        <div class="col-4">
                            <div class="text-muted">ตร.ม.</div>
                            <div class="fw-bold">${formatNumber(r.result.usedArea)}</div>
                        </div>
                        <div class="col-4">
                            <div class="text-muted">สูญเสีย</div>
                            <div class="fw-bold text-danger">${formatNumber(r.result.wasteArea)}</div>
                        </div>
                        <div class="col-4">
                            <div class="text-muted">ชิ้น</div>
                            <div class="fw-bold">${r.fittableCount || r.result.pieceCount}/${totalSelected}</div>
                        </div>
                    </div>
                    <div class="mt-1">
                        <div class="progress">
                            <div class="progress-bar" style="width:${Math.min(100, eff)}%; background:${borderColor};"></div>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-sm btn-outline-primary w-100 btn-detail" data-idx="0" style="font-size:0.72rem;">
                        <i class="bi bi-eye me-1"></i>ดูรายละเอียด
                    </button>
                </div>
            </div>
        </div>`;

        // Render mini canvas
        requestAnimationFrame(() => {
            try {
                const renderer = new CanvasRenderer('mini_0', { mini: true });
                renderer.render(r.result);
            } catch (e) { /* ignore */ }
        });

        // Bind detail button
        container.querySelector('.btn-detail').addEventListener('click', () => openDetail(0));
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

    // ───── Detail Modal (Digital Dyed Plan Style) ─────

    function renderDetailContent() {
        const r = compareResults[currentDetailIndex];
        if (!r) return;
        const res = r.result;
        const eff = res.efficiencyPct;
        const effClass = eff >= 70 ? 'eff-high' : (eff >= 50 ? 'eff-mid' : 'eff-low');

        // Header
        $('detailModalTitle').textContent = `มาตรฐาน`;
        $('detailModalSubtitle').textContent = `${r.algorithmNameTh} — Roll Width ${r.rollWidth}m`;
        $('detailRollWidth').textContent = `${r.rollWidth} m`;
        $('detailTotalLength').textContent = `${formatNumber(res.totalLength)} m`;
        $('detailEffBadge').innerHTML = `<span class="${effClass}">${eff}%</span>`;

        // Metrics cards (clean left-border style)
        const effMetricClass = eff >= 70 ? 'metric-eff-high' : (eff >= 50 ? 'metric-eff-mid' : 'metric-eff-low');
        const skipped = r.skippedCount || 0;
        const skippedHtml = skipped > 0
            ? `<div class="skipped-warning mb-2">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                <strong>${skipped} ชิ้นถูกข้าม</strong> - ขนาดใหญ่เกินกว่า roll ${r.rollWidth}m
                ${(r.skippedBarcodes || []).map(b => `<div class="small mt-1" style="color:#856404;">&bull; ${b}</div>`).join('')}
               </div>`
            : '';

        $('detailMetrics').innerHTML = `
            ${skippedHtml}
            <div class="detail-metric ${effMetricClass}">
                <div class="label">ประสิทธิภาพ</div>
                <div class="value">${eff}<span class="unit">%</span></div>
            </div>
            <div class="detail-metric metric-used">
                <div class="label">พื้นที่ใช้จริง</div>
                <div class="value">${formatNumber(res.usedArea)} <span class="unit">ตร.ม.</span></div>
            </div>
            <div class="detail-metric metric-waste">
                <div class="label">พื้นที่สูญเสีย</div>
                <div class="value">${formatNumber(res.wasteArea)} <span class="unit">ตร.ม.</span></div>
            </div>
            <div class="detail-metric metric-length">
                <div class="label">ความยาวรวม</div>
                <div class="value">${formatNumber(res.totalLength)} <span class="unit">ม.</span></div>
            </div>
            <div class="detail-metric metric-rolls">
                <div class="label">จำนวนม้วน</div>
                <div class="value">1 <span class="unit">ม้วน</span></div>
            </div>
            <div class="detail-metric metric-pieces">
                <div class="label">จำนวนชิ้น</div>
                <div class="value">${r.fittableCount || res.pieceCount}/${totalSelected} <span class="unit">ชิ้น</span></div>
            </div>`;

        // ORNO Color Legend
        const items = res.packedItems || [];
        const ornoSet = [...new Set(items.map(it => it.orno || ''))];
        const palette = [
            '#2196F3','#4CAF50','#FF9800','#E91E63','#9C27B0','#00BCD4',
            '#FF5722','#3F51B5','#8BC34A','#FFC107','#795548','#607D8B',
            '#F44336','#009688','#CDDC39','#673AB7','#03A9F4','#FF6F00'
        ];
        $('detailOrnoLegend').innerHTML = ornoSet.map((orno, i) => {
            const color = palette[i % palette.length];
            const count = items.filter(it => (it.orno || '') === orno).length;
            return `<div class="d-flex align-items-center gap-2">
                <span class="legend-swatch" style="background:${color};"></span>
                <span class="small fw-medium" style="color:var(--gray-700);">${orno || '(ไม่มี)'}</span>
                <span class="ms-auto" style="font-size:0.68rem;color:var(--gray-400);font-weight:500;">${count} ชิ้น</span>
            </div>`;
        }).join('');

    }

    function openDetail(index) {
        const r = compareResults[index];
        if (!r) return;
        currentDetailIndex = index;

        // Reset zoom to 100% every time detail opens
        if (detailRenderer) detailRenderer.zoomReset();
        const zBtn = $('btnZoomReset');
        if (zBtn) zBtn.textContent = '100%';

        // Show detail checkbox
        const chk = $('chkShowDetail');
        chk.checked = true;
        chk.onchange = () => {
            if (detailRenderer) detailRenderer.setShowDetail(chk.checked);
        };

        // Render content
        renderDetailContent();

        // Show modal then render canvas
        const modal = new bootstrap.Modal($('detailModal'));
        modal.show();

        $('detailModal').addEventListener('shown.bs.modal', function handler() {
            $('detailModal').removeEventListener('shown.bs.modal', handler);
            if (!detailRenderer) {
                detailRenderer = new CanvasRenderer('detailCanvas');
                detailRenderer._onZoomChange = updateZoomLabel;
            }
            detailRenderer.setFitMode('fit');
            detailRenderer.render(r.result);
        });
    }

    // ───── Save Plan ─────
    async function onSaveFromDetail() {
        if (currentDetailIndex === null) return;
        const r = compareResults[currentDetailIndex];
        if (!r) return;
        bootstrap.Modal.getInstance($('detailModal'))?.hide();
        await doSave(r);
    }

    async function doSave(r) {
        try {
            const isEdit = !!editingPlanId;
            const url = isEdit ? `/api/plans/${editingPlanId}` : '/api/plans';
            const method = isEdit ? 'PUT' : 'POST';

            // Enrich packed items with tag dimensions for saving
            const itemsToSave = (r.result.packedItems || []).map(item => ({
                ...item,
                tagWidth: item._tagWidth || item.tagWidth || null,
                tagLength: item._tagLength || item.tagLength || null
            }));

            const plan = await fetchApi(url, {
                method,
                body: JSON.stringify({
                    canvasTypeId: r.canvasTypeId,
                    rollWidth: r.result.rollWidth,
                    totalLength: r.result.totalLength,
                    totalArea: r.result.totalArea,
                    usedArea: r.result.usedArea,
                    wasteArea: r.result.wasteArea,
                    efficiencyPct: r.result.efficiencyPct,
                    pieceCount: r.result.pieceCount,
                    packedItems: itemsToSave
                }),
                loadingMessage: isEdit ? 'กำลังอัปเดต..' : 'กำลังบันทึก..'
            });

            if (isEdit) {
                // Redirect to plan detail after update
                showAlert('อัปเดตแผนสำเร็จ', 'success');
                window.location.href = `/Layout/PlanDetail/${editingPlanId}`;
                return;
            }

            $('savedPlanCode').textContent = plan.planCode;
            $('btnViewPlan').href = `/Layout/PlanDetail/${plan.id}`;
            $('btnViewReport').href = `/Layout/Report/${plan.id}`;
            new bootstrap.Modal($('successModal')).show();

            // Auto-open report in new tab
            window.open(`/Layout/Report/${plan.id}`, '_blank');

            // Reload orders
            await onLoadOrders();
            compareResults = [];
            $('algorithmCards').innerHTML = '<div class="col-12 text-center text-muted py-5">บันทึกสำเร็จ กดคำนวณใหม่</div>';
            $('colorLegend').classList.add('d-none');
            $('btnExportCsv').classList.add('d-none');
        } catch (err) {
            showAlert('บันทึกไม่สำเร็จ: ' + err.message);
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
        if (currentDetailIndex === null) return;
        const r = compareResults[currentDetailIndex];
        if (!r || !detailRenderer) return;
        const res = r.result;
        const items = res.packedItems || [];
        if (!items.length) return;

        showLoading('กำลังสร้างรูป PNG...');
        setTimeout(() => {
            try { _generateExportPng(r, res, items); }
            catch (e) { console.error('PNG export error:', e); showAlert('ไม่สามารถสร้างรูปได้', 'danger'); }
            finally { hideLoading(); }
        }, 60);
    }

    function _generateExportPng(r, res, items) {
        // ── Color palette (same as renderer) ──
        const palette = [
            '#2196F3','#4CAF50','#FF9800','#E91E63','#9C27B0','#00BCD4',
            '#FF5722','#3F51B5','#8BC34A','#FFC107','#795548','#607D8B',
            '#F44336','#009688','#CDDC39','#673AB7','#03A9F4','#FF6F00',
            '#1B5E20','#AD1457','#0D47A1','#E65100','#4A148C','#006064'
        ];
        const ornos = [...new Set(items.map(it => it.orno || it.ORNO || ''))];
        const ornoColor = {};
        ornos.forEach((o, i) => { ornoColor[o] = palette[i % palette.length]; });

        // ── Segment parameters ──
        const segLenM = Math.max(res.rollWidth, 5);    // each segment length in meters (min = roll width for squareish)
        const cols = 3;                                  // segments per row
        const segGap = 8;                                // gap between segments in px
        const rulerH = 20;                               // ruler height per segment
        const segPxPerM = 200;                           // fixed scale for export
        const pad = 24;
        const headerH = 72;

        const segWpx = Math.ceil(res.rollWidth * segPxPerM);
        const totalSegs = Math.ceil(res.totalLength / segLenM);
        const segHpx = Math.ceil(segLenM * segPxPerM);
        const rows = Math.ceil(totalSegs / cols);

        // Total grid width
        const gridW = cols * segWpx + (cols - 1) * segGap;
        const gridH = rows * (segHpx + rulerH) + (rows - 1) * segGap;

        // Legend
        const legendCols = 3;
        const legendColW = Math.floor(gridW / legendCols);
        const legendRowH = 26;
        const legendRows = Math.ceil(ornos.length / legendCols);
        const legendH = 42 + legendRows * legendRowH + 16;

        const canvasW = gridW + pad * 2;
        const canvasH = headerH + gridH + legendH + pad + 10;

        // ── Offscreen canvas ──
        const off = document.createElement('canvas');
        off.width = canvasW;
        off.height = canvasH;
        const ctx = off.getContext('2d');

        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // ── Header ──
        ctx.fillStyle = '#111';
        ctx.font = 'bold 20px Kanit, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Carpet Layout: ${r.algorithmNameTh}`, pad, pad);

        ctx.fillStyle = '#666';
        ctx.font = '13px Kanit, sans-serif';
        ctx.fillText(
            `พรมหลัก: ${r.rollWidth}m | ความยาว: ${res.totalLength.toFixed(2)}m | ประสิทธิภาพ: ${res.efficiencyPct}% | จำนวน: ${items.length} ชิ้น`,
            pad, pad + 32
        );

        // ── Draw segments ──
        for (let s = 0; s < totalSegs; s++) {
            const col = s % cols;
            const row = Math.floor(s / cols);
            const sx = pad + col * (segWpx + segGap);
            const sy = headerH + row * (segHpx + rulerH + segGap);

            const segStartM = s * segLenM;
            const segEndM = Math.min((s + 1) * segLenM, res.totalLength);
            const actualSegH = Math.ceil((segEndM - segStartM) * segPxPerM);

            // Ruler label (segment range)
            ctx.fillStyle = '#040d1a';
            ctx.fillRect(sx, sy, segWpx, rulerH);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Kanit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${segStartM.toFixed(1)}m – ${segEndM.toFixed(1)}m`, sx + segWpx / 2, sy + rulerH / 2);

            // Roll background for this segment
            const segTop = sy + rulerH;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(sx, segTop, segWpx, actualSegH);
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, segTop, segWpx, actualSegH);

            // Draw items that overlap this segment
            items.forEach((item, i) => {
                const iy = item.packY;
                const ih = item.packLength;
                // Skip items fully outside this segment
                if (iy + ih <= segStartM || iy >= segEndM) return;

                const key = item.orno || item.ORNO || '';
                const color = ornoColor[key] || '#90A4AE';

                const x = sx + item.packX * segPxPerM;
                const yRel = (iy - segStartM) * segPxPerM;
                const y = segTop + yRel;
                const w = item.packWidth * segPxPerM;
                const h = ih * segPxPerM;

                // Skip if fully clipped out
                if (y + h <= segTop || y >= segTop + actualSegH) return;

                ctx.save();
                ctx.beginPath();
                ctx.rect(sx, segTop, segWpx, actualSegH);
                ctx.clip();

                // Fill item
                ctx.fillStyle = color;
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, w, h);

                // Item text (only if item starts in this segment)
                if (iy >= segStartM) {
                    _drawExportItemText(ctx, item, i, x, y, w, h, color);
                }

                ctx.restore();
            });
        }

        // ── Legend section ──
        const legY = headerH + gridH + 14;
        const legH = legendH - 14;

        ctx.fillStyle = '#fff';
        ctx.fillRect(pad, legY, gridW, legH);
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(pad, legY, gridW, legH);

        ctx.fillStyle = '#111';
        ctx.font = 'bold 13px Kanit, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('รายการ Design:', pad + 14, legY + 10);

        ctx.font = '11px Kanit, sans-serif';
        ornos.forEach((orno, i) => {
            const col = i % legendCols;
            const row = Math.floor(i / legendCols);
            const cx = pad + 14 + col * legendColW;
            const cy = legY + 38 + row * legendRowH;
            const color = ornoColor[orno] || '#90A4AE';
            const count = items.filter(it => (it.orno || it.ORNO || '') === orno).length;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(cx, cy, 14, 14, 2);
            ctx.fill();

            ctx.fillStyle = '#333';
            ctx.textBaseline = 'middle';
            const label = `${orno || '(ไม่มี)'} (${count} ชิ้น)`;
            ctx.fillText(_truncText(ctx, label, legendColW - 40), cx + 20, cy + 7);
        });

        // ── Download ──
        const link = document.createElement('a');
        link.download = `layout-${r.algorithmNameTh}-${r.rollWidth}m.png`;
        link.href = off.toDataURL('image/png');
        link.click();
    }

    function _drawExportItemText(ctx, item, i, x, y, w, h, color) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        const rr = parseInt(color.slice(1, 3), 16);
        const gg = parseInt(color.slice(3, 5), 16);
        const bb = parseInt(color.slice(5, 7), 16);
        const bright = (rr * 299 + gg * 587 + bb * 114) / 1000;
        const txtCol = bright > 145 ? '#111' : '#fff';

        ctx.fillStyle = txtCol;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const key = item.orno || item.ORNO || '';
        const num = `#${i + 1}`;
        const rot = item.isRotated ? ' R' : '';
        const dim = `${item.packWidth.toFixed(2)}x${item.packLength.toFixed(2)}`;

        if (w > 65 && h > 48) {
            ctx.font = 'bold 12px Kanit, sans-serif';
            ctx.fillText(`${num}${rot}`, x + 5, y + 4);
            ctx.font = '10px Kanit, sans-serif';
            ctx.fillText(_truncText(ctx, key, w - 10), x + 5, y + 20);
            ctx.fillText(dim, x + 5, y + 34);
        } else if (w > 45 && h > 30) {
            ctx.font = 'bold 10px Kanit, sans-serif';
            ctx.fillText(_truncText(ctx, `${num}${rot} ${key}`, w - 8), x + 4, y + 3);
            ctx.font = '9px Kanit, sans-serif';
            ctx.fillText(dim, x + 4, y + 17);
        } else if (w > 50 && h > 15) {
            ctx.font = 'bold 9px Kanit, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText(_truncText(ctx, `${num} ${key}`, w - 6), x + 3, y + h / 2);
        } else if (w > 26 && h > 15) {
            ctx.font = 'bold 9px Kanit, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num, x + w / 2, y + h / 2);
        }
        ctx.restore();
    }

    function _truncText(ctx, text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        let t = text;
        while (t.length > 2 && ctx.measureText(t + '..').width > maxW) t = t.slice(0, -1);
        return t + '..';
    }

    // ───── Edit Mode ─────
    async function checkEditMode() {
        const params = new URLSearchParams(window.location.search);
        const planId = params.get('editPlanId');
        if (!planId) return;

        try {
            const plan = await fetchApi(`/api/plans/${planId}`, { loadingMessage: 'กำลังโหลดแผน..' });
            editingPlanId = plan.id;
            editingPlanCode = plan.planCode;

            // Show edit banner
            $('editBanner').classList.remove('d-none');
            $('editPlanCode').textContent = plan.planCode;

            // Auto-select cnvId in dropdown
            const cnvId = plan.cnvId;
            if (cnvId) {
                $('cnvIdSelect').value = cnvId;
                onCnvIdChange();
                selectedCnvId = cnvId;
            }

            // Load orders with excludePlanId
            await fetchApi('/api/sync', { method: 'POST', loadingMessage: 'กำลังโหลดข้อมูล..' });
            let url = `/api/orders?cnvId=${encodeURIComponent(cnvId)}`;
            url += `&excludePlanId=${editingPlanId}`;
            currentOrders = await fetchApi(url, { loadingMessage: 'กำลังโหลดรายการ..' });
            currentOrders.forEach(o => o._selected = false);

            // Pre-select barcodes that were in the plan
            const planBarcodes = new Set((plan.items || []).map(i => i.barcodeNo));
            currentOrders.forEach(o => {
                if (planBarcodes.has(o.barcodeNo)) o._selected = true;
            });

            expandedGroups = {};
            renderOrdersList();
            updateSelectedCount();
        } catch (err) {
            showAlert('โหลดแผนไม่สำเร็จ: ' + err.message);
        }
    }

})();
