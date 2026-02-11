// ===== Canvas Layout Renderer =====

class CanvasRenderer {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.mini = options.mini || false;
        this.showDetail = true;
        this.rulerSize = this.mini ? 0 : 32;
        this.padding = this.mini ? 5 : 10;
        this.scale = 1;
        this.hoveredItem = null;
        this.items = [];
        this.result = null;
        this._ornoColorMap = {};
        this.fitMode = 'fit'; // 'width' (actual, may scroll) or 'fit' (optimize, fit to container)
        this._wrapCols = 1;
        this._segmentLength = 0;
        this._wrapGapPx = 4;

        if (!this.mini) {
            this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        }
    }

    setShowDetail(v) { this.showDetail = v; this.draw(); }

    setFitMode(mode) {
        this.fitMode = mode;
        const scrollContainer = this.canvas.parentElement;
        if (scrollContainer) {
            scrollContainer.style.overflow = mode === 'fit' ? 'hidden' : 'auto';
            scrollContainer.style.alignItems = mode === 'fit' ? 'center' : 'flex-start';
            scrollContainer.style.justifyContent = mode === 'fit' ? 'center' : 'flex-start';
        }
        if (this.result) this.render(this.result);
    }

    render(result) {
        this.result = result;
        this.items = result.packedItems || [];
        this.canvas.style.display = 'block';
        this._buildOrnoColors();

        const container = this.canvas.parentElement;
        const offset = this.rulerSize + this.padding * 2;
        const containerWidth = container.clientWidth - offset;

        this._wrapCols = 1;
        this._segmentLength = result.totalLength;

        if (this.fitMode === 'fit' && !this.mini) {
            const containerHeight = container.clientHeight - offset;
            const rollAspect = result.totalLength / result.rollWidth;
            const containerAspect = containerHeight > 0 ? containerWidth / containerHeight : 1;

            if (rollAspect > 2.5 && containerHeight > 0) {
                // Wrap mode: split roll into columns for better screen utilization
                const numCols = Math.max(1, Math.round(Math.sqrt(containerAspect * rollAspect)));
                this._wrapCols = numCols;
                this._segmentLength = result.totalLength / numCols;
                const totalGapPx = (numCols - 1) * this._wrapGapPx;
                const totalRollWidthM = numCols * result.rollWidth;
                const scaleByWidth = (containerWidth - totalGapPx) / totalRollWidthM;
                const scaleByHeight = containerHeight / this._segmentLength;
                this.scale = Math.min(scaleByWidth, scaleByHeight);
            } else {
                const scaleByWidth = containerWidth / result.rollWidth;
                const scaleByHeight = containerHeight > 0 ? containerHeight / result.totalLength : scaleByWidth;
                this.scale = Math.min(scaleByWidth, scaleByHeight);
            }
        } else {
            this.scale = containerWidth / result.rollWidth;
        }

        let canvasWidth, canvasHeight;
        if (this._wrapCols > 1) {
            const colWidthPx = result.rollWidth * this.scale;
            const totalGapPx = (this._wrapCols - 1) * this._wrapGapPx;
            canvasWidth = this._wrapCols * colWidthPx + totalGapPx + offset;
            canvasHeight = this._segmentLength * this.scale + offset;
        } else {
            canvasWidth = containerWidth + offset;
            canvasHeight = result.totalLength * this.scale + offset;
        }

        if (this.mini) {
            const maxH = 120;
            if (canvasHeight > maxH) {
                const fitScale = (maxH - this.padding * 2) / result.totalLength;
                this.scale = Math.min(this.scale, fitScale);
                canvasHeight = maxH;
            }
        }

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.draw();
    }

    _buildOrnoColors() {
        const palette = [
            '#2196F3','#4CAF50','#FF9800','#E91E63','#9C27B0','#00BCD4',
            '#FF5722','#3F51B5','#8BC34A','#FFC107','#795548','#607D8B',
            '#F44336','#009688','#CDDC39','#673AB7','#03A9F4','#FF6F00',
            '#1B5E20','#AD1457','#0D47A1','#E65100','#4A148C','#006064'
        ];
        this._ornoColorMap = {};
        const ornos = [...new Set(this.items.map(it => it.orno || it.ORNO || ''))];
        ornos.forEach((o, i) => { this._ornoColorMap[o] = palette[i % palette.length]; });
    }

    _getItemColor(item) {
        const key = item.orno || item.ORNO || '';
        return this._ornoColorMap[key] || '#90A4AE';
    }

    draw() {
        const ctx = this.ctx;
        const r = this.result;
        const rs = this.rulerSize;
        const p = this.padding;
        const ox = rs + p;
        const oy = rs + p;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Wrapped multi-column mode
        if (this._wrapCols > 1) {
            this._drawWrapped(ctx, r, ox, oy);
            return;
        }

        const rollW = r.rollWidth * this.scale;
        const rollH = r.totalLength * this.scale;

        // Roll background
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(ox, oy, rollW, rollH);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox, oy, rollW, rollH);

        // Rulers
        if (!this.mini) {
            this._drawRulers(ox, oy, rollW, rollH, r.rollWidth, r.totalLength);
        }

        // Draw items
        this.items.forEach((item, i) => {
            const x = ox + item.packX * this.scale;
            const y = oy + item.packY * this.scale;
            const w = item.packWidth * this.scale;
            const h = item.packLength * this.scale;
            const color = this._getItemColor(item);

            const isHovered = !this.mini && this.hoveredItem === i;
            ctx.fillStyle = isHovered ? this._darkenHex(color) : color;
            ctx.fillRect(x, y, w, h);

            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, w, h);

            // Item text
            if (this.mini) {
                if (w > 18 && h > 12) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 8px Kanit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`#${i + 1}`, x + w / 2, y + h / 2);
                }
            } else if (this.showDetail) {
                this._drawItemText(ctx, item, i, x, y, w, h);
            } else {
                if (w > 20 && h > 14) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px Kanit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`#${i + 1}`, x + w / 2, y + h / 2);
                }
            }
        });

        // Tooltip
        if (!this.mini && this.hoveredItem !== null && this.hoveredItem < this.items.length) {
            this._drawTooltip(this.items[this.hoveredItem]);
        }
    }

    // ───── Wrapped Column Rendering ─────

    _drawWrapped(ctx, result, ox, oy) {
        const numCols = this._wrapCols;
        const segLen = this._segmentLength;
        const colWidthPx = result.rollWidth * this.scale;
        const gapPx = this._wrapGapPx;

        for (let col = 0; col < numCols; col++) {
            const colX = ox + col * (colWidthPx + gapPx);
            const segStartM = col * segLen;
            const segEndM = Math.min((col + 1) * segLen, result.totalLength);
            const actualSegHPx = (segEndM - segStartM) * this.scale;

            // Column background
            ctx.fillStyle = '#e8e8e8';
            ctx.fillRect(colX, oy, colWidthPx, actualSegHPx);
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 1;
            ctx.strokeRect(colX, oy, colWidthPx, actualSegHPx);

            // Grid lines within column
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 0.5;
            const maxW = Math.ceil(result.rollWidth);
            for (let m = 1; m <= maxW; m++) {
                const gx = colX + m * this.scale;
                if (gx > colX + colWidthPx) break;
                ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + actualSegHPx); ctx.stroke();
            }
            const segLenCeil = Math.ceil(segEndM - segStartM);
            for (let m = 1; m <= segLenCeil; m++) {
                const gy = oy + m * this.scale;
                if (gy > oy + actualSegHPx) break;
                ctx.beginPath(); ctx.moveTo(colX, gy); ctx.lineTo(colX + colWidthPx, gy); ctx.stroke();
            }

            // Draw items in this segment (clipped)
            ctx.save();
            ctx.beginPath();
            ctx.rect(colX, oy, colWidthPx, actualSegHPx);
            ctx.clip();

            this.items.forEach((item, i) => {
                const itemTopM = item.packY;
                const itemBottomM = item.packY + item.packLength;
                if (itemBottomM <= segStartM || itemTopM >= segEndM) return;

                const x = colX + item.packX * this.scale;
                const y = oy + (item.packY - segStartM) * this.scale;
                const w = item.packWidth * this.scale;
                const h = item.packLength * this.scale;
                const color = this._getItemColor(item);

                const isHovered = !this.mini && this.hoveredItem === i;
                ctx.fillStyle = isHovered ? this._darkenHex(color) : color;
                ctx.fillRect(x, y, w, h);

                ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x, y, w, h);

                if (this.showDetail) {
                    this._drawItemText(ctx, item, i, x, y, w, h);
                } else if (w > 20 && h > 14) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px Kanit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`#${i + 1}`, x + w / 2, y + h / 2);
                }
            });

            ctx.restore();

            // Column header label (meter range)
            if (!this.mini) {
                ctx.fillStyle = '#040d1a';
                ctx.fillRect(colX, 0, colWidthPx, this.rulerSize);
                ctx.fillStyle = '#fff';
                ctx.font = '9px Kanit';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    `${segStartM.toFixed(1)}m — ${segEndM.toFixed(1)}m`,
                    colX + colWidthPx / 2, this.rulerSize / 2
                );
            }
        }

        // Left ruler (for segment height)
        if (!this.mini) {
            const segHeightPx = segLen * this.scale;
            ctx.fillStyle = '#040d1a';
            ctx.fillRect(0, oy, this.rulerSize, segHeightPx);
            ctx.fillRect(0, 0, this.rulerSize, this.rulerSize);

            ctx.fillStyle = '#fff';
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 0.5;
            ctx.font = '10px Kanit';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const maxSeg = Math.ceil(segLen);
            for (let m = 0; m <= maxSeg; m++) {
                const y = oy + m * this.scale;
                if (y > oy + segHeightPx + 1) break;
                ctx.beginPath(); ctx.moveTo(this.rulerSize - 10, y); ctx.lineTo(this.rulerSize, y); ctx.stroke();
                if (m > 0) ctx.fillText(`${m}m`, this.rulerSize - 12, y);
            }
        }

        // Tooltip
        if (!this.mini && this.hoveredItem !== null && this.hoveredItem < this.items.length) {
            this._drawTooltip(this.items[this.hoveredItem]);
        }
    }

    // ───── Item Text ─────

    _drawItemText(ctx, item, index, x, y, w, h) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const orno = item.orno || item.ORNO || '';
        const pw = item.packWidth;
        const pl = item.packLength;
        const area = (pw * pl).toFixed(2);
        const num = `#${index + 1}`;
        const rotLabel = item.isRotated ? ' R' : '';

        if (w > 70 && h > 50) {
            ctx.font = 'bold 11px Kanit';
            ctx.fillText(`${num}${rotLabel}`, x + 3, y + 3);
            ctx.font = '10px Kanit';
            ctx.fillText(orno, x + 3, y + 17);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '9px Kanit';
            ctx.fillText(`${pw}x${pl}m`, x + 3, y + 30);
            ctx.fillText(`${area} sqm`, x + 3, y + 42);
        } else if (w > 40 && h > 30) {
            ctx.font = 'bold 10px Kanit';
            ctx.fillText(`${num}${rotLabel}`, x + 2, y + 2);
            ctx.font = '9px Kanit';
            ctx.fillText(orno, x + 2, y + 15);
        } else if (w > 22 && h > 16) {
            ctx.font = 'bold 9px Kanit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num, x + w / 2, y + h / 2);
        }

        ctx.restore();
    }

    // ───── Rulers (single column mode) ─────

    _drawRulers(ox, oy, rollW, rollH, widthM, lengthM) {
        const ctx = this.ctx;
        const rs = this.rulerSize;

        // Ruler backgrounds
        ctx.fillStyle = '#040d1a';
        ctx.fillRect(ox, 0, rollW, rs);
        ctx.fillRect(0, oy, rs, rollH);
        ctx.fillRect(0, 0, rs, rs);

        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;

        // Top ruler
        ctx.font = '10px Kanit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const maxW = Math.ceil(widthM);
        for (let m = 0; m <= maxW; m++) {
            const x = ox + m * this.scale;
            if (x > ox + rollW + 1) break;
            ctx.beginPath(); ctx.moveTo(x, rs - 10); ctx.lineTo(x, rs); ctx.stroke();
            if (m > 0) ctx.fillText(`${m}m`, x, rs - 12);
            if (m + 0.5 <= widthM) {
                const xh = ox + (m + 0.5) * this.scale;
                ctx.beginPath(); ctx.moveTo(xh, rs - 6); ctx.lineTo(xh, rs); ctx.stroke();
            }
        }

        // Left ruler
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const maxL = Math.ceil(lengthM);
        for (let m = 0; m <= maxL; m++) {
            const y = oy + m * this.scale;
            if (y > oy + rollH + 1) break;
            ctx.beginPath(); ctx.moveTo(rs - 10, y); ctx.lineTo(rs, y); ctx.stroke();
            if (m > 0) ctx.fillText(`${m}m`, rs - 12, y);
            if (m + 0.5 <= lengthM) {
                const yh = oy + (m + 0.5) * this.scale;
                ctx.beginPath(); ctx.moveTo(rs - 6, yh); ctx.lineTo(rs, yh); ctx.stroke();
            }
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        for (let m = 1; m <= maxW; m++) {
            const x = ox + m * this.scale;
            if (x > ox + rollW) break;
            ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + rollH); ctx.stroke();
        }
        for (let m = 1; m <= maxL; m++) {
            const y = oy + m * this.scale;
            if (y > oy + rollH) break;
            ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + rollW, y); ctx.stroke();
        }
    }

    // ───── Tooltip ─────

    _drawTooltip(item) {
        const ctx = this.ctx;
        const mx = this._mouseX || 0;
        const my = this._mouseY || 0;
        const orno = item.orno || item.ORNO || '';
        const barcode = item.barcodeNo || item.BarcodeNo || '';
        const ow = item.originalWidth || item.OriginalWidth || item.packWidth;
        const ol = item.originalLength || item.OriginalLength || item.packLength;
        const lines = [
            `Order: ${orno}`,
            `Barcode: ${barcode}`,
            `ขนาดจริง: ${ow} x ${ol} m`,
            `วาง: ${item.packWidth} x ${item.packLength} m`,
            `พท.: ${(item.packWidth * item.packLength).toFixed(2)} ตร.ม.`,
            item.isRotated ? 'หมุน: ใช่' : '',
        ].filter(l => l);

        ctx.font = '11px Kanit';
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
        const tw = maxW + 20;
        const th = lines.length * 18 + 14;
        let tx = mx + 14;
        let ty = my - th - 8;
        if (tx + tw > this.canvas.width) tx = mx - tw - 14;
        if (ty < 0) ty = my + 18;

        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(13,33,55,0.92)';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 6);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            ctx.fillText(line, tx + 10, ty + 8 + i * 18);
        });
    }

    // ───── Mouse Hover ─────

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this._mouseX = e.clientX - rect.left;
        this._mouseY = e.clientY - rect.top;
        const ox = this.rulerSize + this.padding;
        const oy = this.rulerSize + this.padding;

        let found = null;

        if (this._wrapCols > 1) {
            // Wrapped mode: check items with column-adjusted positions
            const colWidthPx = this.result.rollWidth * this.scale;
            const gapPx = this._wrapGapPx;

            for (let i = this.items.length - 1; i >= 0; i--) {
                const item = this.items[i];
                const col = Math.floor(item.packY / this._segmentLength);
                const segStartM = col * this._segmentLength;

                const x = ox + col * (colWidthPx + gapPx) + item.packX * this.scale;
                const y = oy + (item.packY - segStartM) * this.scale;
                const w = item.packWidth * this.scale;
                const h = item.packLength * this.scale;

                if (this._mouseX >= x && this._mouseX <= x + w && this._mouseY >= y && this._mouseY <= y + h) {
                    found = i;
                    break;
                }
            }
        } else {
            // Single column mode
            for (let i = this.items.length - 1; i >= 0; i--) {
                const item = this.items[i];
                const x = ox + item.packX * this.scale;
                const y = oy + item.packY * this.scale;
                const w = item.packWidth * this.scale;
                const h = item.packLength * this.scale;
                if (this._mouseX >= x && this._mouseX <= x + w && this._mouseY >= y && this._mouseY <= y + h) {
                    found = i;
                    break;
                }
            }
        }

        if (found !== this.hoveredItem) {
            this.hoveredItem = found;
            this.canvas.style.cursor = found !== null ? 'pointer' : 'default';
            this.draw();
        }
    }

    onMouseLeave() {
        this.hoveredItem = null;
        this.draw();
    }

    _darkenHex(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const f = 0.75;
        return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
    }
}
