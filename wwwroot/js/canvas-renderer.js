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
        this._zoomLevel = 1.0;
        this._zoomTarget = 1.0;
        this._zoomAnimId = null;
        this._onZoomChange = null; // callback when zoom changes

        if (!this.mini) {
            this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        }
    }

    setShowDetail(v) { this.showDetail = v; this.draw(); }

    setFitMode(mode) {
        this.fitMode = mode;
        const sc = this.canvas.parentElement;
        if (sc) {
            if (mode === 'height') {
                // Fill height, scroll horizontally (Report page — horizontal roll)
                sc.style.overflowX = 'auto';
                sc.style.overflowY = 'hidden';
                sc.style.alignItems = 'flex-start';
                sc.style.justifyContent = 'flex-start';
            } else {
                // Fill width, scroll vertically (default — vertical roll)
                sc.style.overflowX = 'hidden';
                sc.style.overflowY = 'auto';
                sc.style.alignItems = 'flex-start';
                sc.style.justifyContent = 'flex-start';
            }
        }
        if (this.result) this.render(this.result);
    }

    getZoomLevel() { return this._zoomLevel; }
    getZoomTarget() { return this._zoomTarget; }

    setZoom(level, animate = true) {
        const minZ = this._minZoom || 0.1;
        const clamped = Math.max(minZ, Math.min(5.0, level));
        this._zoomTarget = clamped;
        if (animate && this.result) {
            this._animateZoom();
        } else {
            this._zoomLevel = clamped;
            if (this._zoomAnimId) { cancelAnimationFrame(this._zoomAnimId); this._zoomAnimId = null; }
            if (this.result) this.render(this.result);
            if (this._onZoomChange) this._onZoomChange(this._zoomLevel);
        }
        return this._zoomTarget;
    }

    _animateZoom() {
        if (this._zoomAnimId) cancelAnimationFrame(this._zoomAnimId);
        const ease = 0.18; // lerp factor — higher = snappier
        const step = () => {
            const diff = this._zoomTarget - this._zoomLevel;
            if (Math.abs(diff) < 0.003) {
                this._zoomLevel = this._zoomTarget;
                this._zoomAnimId = null;
                if (this.result) this.render(this.result);
                if (this._onZoomChange) this._onZoomChange(this._zoomLevel);
                return;
            }
            this._zoomLevel += diff * ease;
            if (this.result) this.render(this.result);
            if (this._onZoomChange) this._onZoomChange(this._zoomLevel);
            this._zoomAnimId = requestAnimationFrame(step);
        };
        this._zoomAnimId = requestAnimationFrame(step);
    }

    zoomIn() { return this.setZoom(this._zoomTarget + 0.1); }
    zoomOut() { return this.setZoom(this._zoomTarget - 0.1); }
    zoomReset() { return this.setZoom(1.0); }

    render(result) {
        this.result = result;
        this.items = result.packedItems || [];
        this.canvas.style.display = 'block';
        this._buildOrnoColors();

        const container = this.canvas.parentElement;
        const offset = this.rulerSize + this.padding * 2;
        const containerWidth = container.clientWidth - offset;
        const containerHeight = container.clientHeight - offset;

        // Base scale: 100% fills the primary axis
        let baseScale;
        if (this.fitMode === 'height') {
            // Horizontal layout: fill container height, scroll X
            baseScale = containerHeight / result.totalLength;
        } else {
            // Vertical layout: fill container width, scroll Y
            baseScale = containerWidth / result.rollWidth;
        }

        // Min zoom = fit entire layout in container (both axes)
        const minByW = containerWidth / (result.rollWidth * baseScale);
        const minByH = containerHeight / (result.totalLength * baseScale);
        this._minZoom = Math.max(0.01, Math.min(1.0, minByW, minByH));

        this.scale = baseScale * this._zoomLevel;

        const rollWidthPx = result.rollWidth * this.scale;
        let canvasWidth = rollWidthPx + offset;
        let canvasHeight = result.totalLength * this.scale + offset;

        if (this.mini) {
            const maxH = 120;
            if (canvasHeight > maxH) {
                const fitScale2 = (maxH - this.padding * 2) / result.totalLength;
                this.scale = Math.min(this.scale, fitScale2);
                canvasHeight = maxH;
            }
        }

        // Center canvas when narrower than container
        if (!this.mini && canvasWidth < container.clientWidth) {
            this.canvas.style.margin = '0 auto';
        } else {
            this.canvas.style.margin = '';
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

        const rollW = r.rollWidth * this.scale;
        const rollH = r.totalLength * this.scale;

        // Roll background (white for visible gaps between items)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ox, oy, rollW, rollH);
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox, oy, rollW, rollH);

        // Join lines (เส้นต่อผ้าใบ)
        const joinCount = r.joinedRollCount || 1;
        const singleW = r.singleRollWidth || 0;
        const joinAxis = r.joinAxis || 'x'; // 'x' = vertical lines, 'y' = horizontal lines
        if (joinCount > 1 && singleW > 0) {
            ctx.save();
            ctx.setLineDash([8, 5]);
            ctx.strokeStyle = '#e53935';
            ctx.lineWidth = this.mini ? 1 : 2;
            for (let i = 1; i < joinCount; i++) {
                const pos = singleW * i * this.scale;
                ctx.beginPath();
                if (joinAxis === 'y') {
                    ctx.moveTo(ox, oy + pos);
                    ctx.lineTo(ox + rollW, oy + pos);
                } else {
                    ctx.moveTo(ox + pos, oy);
                    ctx.lineTo(ox + pos, oy + rollH);
                }
                ctx.stroke();
            }
            // Labels
            if (!this.mini) {
                ctx.setLineDash([]);
                ctx.font = 'bold 10px Kanit';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                for (let i = 1; i < joinCount; i++) {
                    const pos = singleW * i * this.scale;
                    const lbl = `ต่อม้วน ${i}`;
                    const tw = ctx.measureText(lbl).width + 8;
                    ctx.fillStyle = 'rgba(229,57,53,0.85)';
                    if (joinAxis === 'y') {
                        ctx.fillRect(ox - tw / 2 + rollW / 2, oy + pos - 16, tw, 15);
                        ctx.fillStyle = '#fff';
                        ctx.fillText(lbl, ox + rollW / 2, oy + pos - 3);
                    } else {
                        ctx.fillRect(ox + pos - tw / 2, oy - 16, tw, 15);
                        ctx.fillStyle = '#fff';
                        ctx.fillText(lbl, ox + pos, oy - 3);
                    }
                }
            }
            ctx.restore();
        }

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

            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, h);

            // Item text
            if (this.mini) {
                if (w > 18 && h > 12) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 8px Kanit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const lbl = item.displayIndex != null ? item.displayIndex + 1 : i + 1;
                    ctx.fillText(`#${lbl}`, x + w / 2, y + h / 2);
                }
            } else if (this.showDetail) {
                this._drawItemText(ctx, item, i, x, y, w, h);
            } else {
                if (w > 20 && h > 14) {
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px Kanit';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const lbl = item.displayIndex != null ? item.displayIndex + 1 : i + 1;
                    ctx.fillText(`#${lbl}`, x + w / 2, y + h / 2);
                }
            }
        });

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
        const num = `#${item.displayIndex != null ? item.displayIndex + 1 : index + 1}`;
        const rotLabel = item.isRotated ? ' R' : '';

        if (w > 55 && h > 38) {
            // Full detail — 4 lines compact
            ctx.font = 'bold 9px Kanit';
            ctx.fillText(`${num}${rotLabel}`, x + 2, y + 2);
            ctx.font = '8px Kanit';
            ctx.fillText(orno, x + 2, y + 13);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '7px Kanit';
            ctx.fillText(`${pw}x${pl}m`, x + 2, y + 23);
            ctx.fillText(`${area} sqm`, x + 2, y + 32);
        } else if (w > 80 && h > 14) {
            // Wide but short — single line with all info
            ctx.font = 'bold 8px Kanit';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${num}${rotLabel}  ${orno}  ${pw}x${pl}m  ${area}sqm`, x + 3, y + h / 2);
        } else if (w > 40 && h > 14) {
            // Medium wide but short — num + orno in one line
            ctx.font = 'bold 8px Kanit';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${num}${rotLabel} ${orno}`, x + 3, y + h / 2);
        } else if (w > 30 && h > 22) {
            // Small tall — 2 lines
            ctx.font = 'bold 8px Kanit';
            ctx.fillText(`${num}${rotLabel}`, x + 2, y + 2);
            ctx.font = '7px Kanit';
            ctx.fillText(orno, x + 2, y + 12);
        } else if (w > 16 && h > 10) {
            // Tiny — just number
            ctx.font = 'bold 7px Kanit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num, x + w / 2, y + h / 2);
        }

        ctx.restore();
    }

    // ───── Rulers (single column mode) ─────

    _niceStep() {
        const niceSteps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
        const minPxPerMark = 40;
        const pxPerMeter = this.scale;
        for (const step of niceSteps) {
            if (step * pxPerMeter >= minPxPerMark) return step;
        }
        return niceSteps[niceSteps.length - 1];
    }

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

        const stepW = this._niceStep();
        const stepL = this._niceStep();
        const fmtLabel = (v) => Number.isInteger(v) ? `${v}m` : `${v}m`;

        // Top ruler
        ctx.font = '10px Kanit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (let m = 0; m <= widthM; m += stepW) {
            const x = ox + m * this.scale;
            if (x > ox + rollW + 1) break;
            ctx.beginPath(); ctx.moveTo(x, rs - 10); ctx.lineTo(x, rs); ctx.stroke();
            if (m > 0) ctx.fillText(fmtLabel(m), x, rs - 12);
            // Half-step tick
            const half = m + stepW / 2;
            if (half <= widthM) {
                const xh = ox + half * this.scale;
                ctx.beginPath(); ctx.moveTo(xh, rs - 6); ctx.lineTo(xh, rs); ctx.stroke();
            }
        }

        // Left ruler
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let m = 0; m <= lengthM; m += stepL) {
            const y = oy + m * this.scale;
            if (y > oy + rollH + 1) break;
            ctx.beginPath(); ctx.moveTo(rs - 10, y); ctx.lineTo(rs, y); ctx.stroke();
            if (m > 0) ctx.fillText(fmtLabel(m), rs - 12, y);
            const half = m + stepL / 2;
            if (half <= lengthM) {
                const yh = oy + half * this.scale;
                ctx.beginPath(); ctx.moveTo(rs - 6, yh); ctx.lineTo(rs, yh); ctx.stroke();
            }
        }

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        for (let m = stepW; m <= widthM; m += stepW) {
            const x = ox + m * this.scale;
            if (x > ox + rollW) break;
            ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + rollH); ctx.stroke();
        }
        for (let m = stepL; m <= lengthM; m += stepL) {
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
