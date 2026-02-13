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
    let viewMode = 'optimize'; // 'actual' (scroll) or 'optimize' (fit-to-screen)
    let editingPlanId = null;   // non-null when editing an existing plan
    let editingPlanCode = null;
    const rollWidthColors = {};
    const colorPalette = ['#1976d2', '#00e676', '#ff7043', '#29b6f6', '#ffd54f', '#0d47a1', '#26c6da', '#64b5f6'];

    // DOM refs
    const $ = id => document.getElementById(id);

    // Helper: get AsPlan value regardless of JSON property casing
    function getAsPlan(o) {
        return o.asplan || o.ASPLAN || o.asPlan || o.AsPlan || '';
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

        // View mode toggle (Actual = scroll, Optimize = fit-to-screen)
        document.querySelectorAll('#viewModeGroup button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#viewModeGroup button').forEach(b => {
                    b.classList.remove('active', 'btn-light');
                    b.classList.add('btn-outline-light');
                });
                btn.classList.remove('btn-outline-light');
                btn.classList.add('active', 'btn-light');
                viewMode = btn.dataset.mode;
                if (detailRenderer) {
                    detailRenderer.setFitMode(viewMode === 'optimize' ? 'fit' : 'width');
                }
            });
        });

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
                el.textContent = `${opt.cnvDesc} (${widths})`;
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
                return `<div class="order-subitem ${selClass}" data-idx="${origIdx}">
                    <input type="checkbox" class="form-check-input order-cb" data-idx="${origIdx}" ${checked}>
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex align-items-center gap-1">
                            <span class="barcode">${o.barcodeNo || ''}</span>
                            ${asPlanBadge}
                            <span class="order-size">${formatNumber(o.width)}x${formatNumber(o.length)}m</span>
                        </div>
                        <div class="tag-input-row ${tagRequired} ${missingClass}" onclick="event.stopPropagation();">
                            <span class="tag-label">${isAsPlan ? '<i class="bi bi-pencil-fill" style="font-size:0.5rem;"></i>' : 'Tag'}</span>
                            <input type="number" class="tag-input tag-w" data-idx="${origIdx}" value="${tw}" placeholder="W" step="0.01">
                            <span class="tag-x">x</span>
                            <input type="number" class="tag-input tag-l" data-idx="${origIdx}" value="${tl}" placeholder="L" step="0.01">
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
            compareResults = response.results || [];
            totalSelected = response.totalSelected || selectedBarcodes.length;
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
            const bestBadge = r.isBest ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.6rem;">Best</span>' : '';
            const bestClass = r.isBest ? 'best-card' : '';
            const borderColor = rollWidthColors[r.rollWidth] || '#ddd';
            const canvasId = `mini_${i}`;
            const skipped = r.skippedCount || 0;
            const skippedWarn = skipped > 0
                ? `<div class="skipped-warning"><i class="bi bi-exclamation-triangle-fill me-1"></i>ข้าม ${skipped} ชิ้น (เกิน ${r.rollWidth}m)</div>`
                : '';

            return `<div class="col-xxl-3 col-xl-3 col-lg-4 col-md-6 card-col" data-rollwidth="${r.rollWidth}">
                <div class="algorithm-card ${bestClass}" style="border-top: 3px solid ${borderColor};">
                    <div class="card-header">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-medium" style="font-size:0.75rem;">${r.algorithmNameTh}</span>
                            <span class="badge bg-light text-dark border" style="font-size:0.65rem;">${r.rollWidth}m</span>
                        </div>
                        <div class="text-muted" style="font-size:0.68rem;">${r.algorithmName} ${bestBadge}</div>
                    </div>
                    <div class="card-body p-2">
                        ${skippedWarn}
                        <div class="text-center mb-1">
                            <div class="fw-bold ${effClass}" style="font-size:1.5rem;">${eff}%</div>
                            <div class="text-muted" style="font-size:0.65rem;margin-top:-2px;">ประสิทธิภาพ</div>
                        </div>
                        <div class="mini-canvas-wrap mb-2"><canvas id="${canvasId}"></canvas></div>
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
                        <button class="btn btn-sm btn-outline-primary w-100 btn-detail" data-idx="${i}" style="font-size:0.72rem;">
                            <i class="bi bi-eye me-1"></i>ดูรายละเอียด
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

    // ───── Detail Modal (Digital Dyed Plan Style) ─────

    function renderDetailContent() {
        const r = compareResults[currentDetailIndex];
        if (!r) return;
        const res = r.result;
        const eff = res.efficiencyPct;
        const effClass = eff >= 70 ? 'eff-high' : (eff >= 50 ? 'eff-mid' : 'eff-low');

        // Header
        $('detailModalTitle').textContent = `${r.algorithmNameTh} (${r.algorithmName})`;
        $('detailModalSubtitle').textContent = `Roll Width ${r.rollWidth}m`;
        $('detailRollWidth').textContent = `${r.rollWidth} m`;
        $('detailTotalLength').textContent = `${formatNumber(res.totalLength)} m`;
        $('detailEffBadge').innerHTML = `<span class="${effClass}">${eff}%</span>`;

        // Metrics cards (stacked vertical with colors)
        const effMetricClass = eff >= 70 ? 'metric-eff-high' : (eff >= 50 ? 'metric-eff-mid' : 'metric-eff-low');
        const skipped = r.skippedCount || 0;
        const skippedHtml = skipped > 0
            ? `<div class="col-12"><div class="skipped-warning mb-2">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                <strong>${skipped} ชิ้นถูกข้าม</strong> - ขนาดใหญ่เกินกว่า roll ${r.rollWidth}m
                ${(r.skippedBarcodes || []).map(b => `<div class="small mt-1" style="color:#856404;">&bull; ${b}</div>`).join('')}
               </div></div>`
            : '';

        $('detailMetrics').innerHTML = `
            ${skippedHtml}
            <div class="col-12"><div class="detail-metric ${effMetricClass}">
                <div class="label">ประสิทธิภาพ</div>
                <div class="value">${eff}%</div>
            </div></div>
            <div class="col-12"><div class="detail-metric metric-used">
                <div class="label">พื้นที่ใช้จริง</div>
                <div class="value">${formatNumber(res.usedArea)} <span class="unit">ตร.ม.</span></div>
            </div></div>
            <div class="col-12"><div class="detail-metric metric-waste">
                <div class="label">พื้นที่สูญเสีย</div>
                <div class="value">${formatNumber(res.wasteArea)} <span class="unit">ตร.ม.</span></div>
            </div></div>
            <div class="col-12"><div class="detail-metric metric-length">
                <div class="label">ความยาวรวม</div>
                <div class="value">${formatNumber(res.totalLength)} <span class="unit">ม.</span></div>
            </div></div>
            <div class="col-12"><div class="detail-metric metric-rolls">
                <div class="label">จำนวนม้วน</div>
                <div class="value">1 <span class="unit">ม้วน</span></div>
            </div></div>
            <div class="col-12"><div class="detail-metric metric-pieces">
                <div class="label">จำนวนชิ้น</div>
                <div class="value">${r.fittableCount || res.pieceCount}/${totalSelected} <span class="unit">ชิ้น</span></div>
            </div></div>`;

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
            return `<div class="d-flex align-items-center gap-2 py-1">
                <span class="legend-swatch" style="background:${color};"></span>
                <span class="small fw-medium">${orno || '(ไม่มี)'}</span>
                <span class="ms-auto badge bg-light text-dark" style="font-size:0.65rem;">${count} ชิ้น</span>
            </div>`;
        }).join('');

        // Items table with comprehensive report columns
        const hasAnyTag = items.some(it => it._tagWidth || it._tagLength);
        $('detailItems').innerHTML = `
            <table class="table table-sm table-hover mb-0" style="font-size:0.68rem;">
                <thead><tr>
                    <th style="width:24px;">#</th>
                    <th>Barcode</th>
                    <th>Order</th>
                    <th class="text-end">พรม W</th>
                    <th class="text-end">พรม L</th>
                    <th class="text-end">พท.พรม</th>
                    ${hasAnyTag ? `
                    <th class="text-end">Tag W</th>
                    <th class="text-end">Tag L</th>
                    <th class="text-end">พท.Tag</th>
                    <th class="text-end">%เผื่อ Tag</th>` : ''}
                    <th class="text-end">ตัด W</th>
                    <th class="text-end">ตัด L</th>
                    <th class="text-end">พท.ตัด</th>
                    ${hasAnyTag ? '<th class="text-end">%เผื่อ ตัด</th>' : ''}
                    <th class="text-end">%สูญเสีย</th>
                    <th class="text-center">R</th>
                </tr></thead>
                <tbody>${items.map((it, i) => {
                    const carpetW = it.originalWidth;
                    const carpetL = it.originalLength;
                    const carpetArea = carpetW * carpetL;
                    const tagW = it._tagWidth;
                    const tagL = it._tagLength;
                    const tagArea = (tagW && tagL) ? tagW * tagL : null;
                    const tagAllowancePct = tagArea ? (((tagArea - carpetArea) / carpetArea) * 100).toFixed(1) : null;
                    const cutW = it.packWidth;
                    const cutL = it.packLength;
                    const cutArea = cutW * cutL;
                    const cutVsTagPct = tagArea ? (((cutArea - tagArea) / tagArea) * 100).toFixed(1) : null;
                    const wastePct = carpetArea > 0 ? (((cutArea - carpetArea) / carpetArea) * 100).toFixed(1) : null;

                    const colorTag = tagAllowancePct !== null ? (parseFloat(tagAllowancePct) <= 5 ? '#16a34a' : parseFloat(tagAllowancePct) <= 15 ? '#ea580c' : '#dc2626') : '';
                    const colorCut = cutVsTagPct !== null ? (parseFloat(cutVsTagPct) <= 5 ? '#16a34a' : parseFloat(cutVsTagPct) <= 15 ? '#ea580c' : '#dc2626') : '';
                    const colorWaste = wastePct !== null ? (parseFloat(wastePct) <= 10 ? '#16a34a' : parseFloat(wastePct) <= 20 ? '#ea580c' : '#dc2626') : '';

                    return `<tr>
                        <td>${i + 1}</td>
                        <td><code class="small" style="color:#0d47a1;">${it.barcodeNo || ''}</code></td>
                        <td class="small">${it.orno || ''}</td>
                        <td class="text-end">${formatNumber(carpetW)}</td>
                        <td class="text-end">${formatNumber(carpetL)}</td>
                        <td class="text-end">${formatNumber(carpetArea)}</td>
                        ${hasAnyTag ? `
                        <td class="text-end">${tagW ? formatNumber(tagW) : '-'}</td>
                        <td class="text-end">${tagL ? formatNumber(tagL) : '-'}</td>
                        <td class="text-end">${tagArea ? formatNumber(tagArea) : '-'}</td>
                        <td class="text-end fw-medium" style="color:${colorTag};">${tagAllowancePct !== null ? tagAllowancePct + '%' : '-'}</td>` : ''}
                        <td class="text-end">${formatNumber(cutW)}</td>
                        <td class="text-end">${formatNumber(cutL)}</td>
                        <td class="text-end">${formatNumber(cutArea)}</td>
                        ${hasAnyTag ? `<td class="text-end fw-medium" style="color:${colorCut};">${cutVsTagPct !== null ? cutVsTagPct + '%' : '-'}</td>` : ''}
                        <td class="text-end fw-medium" style="color:${colorWaste};">${wastePct !== null ? wastePct + '%' : '-'}</td>
                        <td class="text-center">${it.isRotated ? '<span class="badge bg-warning text-dark" style="font-size:0.6rem;">R</span>' : '-'}</td>
                    </tr>`;
                }).join('')}</tbody>
            </table>`;
    }

    function openDetail(index) {
        const r = compareResults[index];
        if (!r) return;
        currentDetailIndex = index;

        // Reset view mode toggle to current state
        document.querySelectorAll('#viewModeGroup button').forEach(b => {
            if (b.dataset.mode === viewMode) {
                b.classList.remove('btn-outline-light');
                b.classList.add('active', 'btn-light');
            } else {
                b.classList.remove('active', 'btn-light');
                b.classList.add('btn-outline-light');
            }
        });

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
            }
            detailRenderer.fitMode = viewMode === 'optimize' ? 'fit' : 'width';
            const scrollContainer = $('detailCanvasContainer');
            if (scrollContainer) {
                scrollContainer.style.overflow = viewMode === 'optimize' ? 'hidden' : 'auto';
            }
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
        const canvas = $('detailCanvas');
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `layout-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
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
