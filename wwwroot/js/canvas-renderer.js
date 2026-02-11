// ===== Canvas Layout Renderer =====

class CanvasRenderer {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.mini = options.mini || false;
        this.padding = this.mini ? 5 : 30;
        this.scale = 1;
        this.hoveredItem = null;
        this.items = [];
        this.result = null;

        if (!this.mini) {
            this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
            this.canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        }
    }

    render(result) {
        this.result = result;
        this.items = result.packedItems || [];
        this.canvas.style.display = 'block';

        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth - this.padding * 2;
        this.scale = containerWidth / result.rollWidth;

        const canvasWidth = containerWidth + this.padding * 2;
        let canvasHeight = result.totalLength * this.scale + this.padding * 2;

        if (this.mini) {
            const maxH = 120;
            if (canvasHeight > maxH) {
                const fitScale = (maxH - this.padding * 2) / result.totalLength;
                this.scale = Math.min(this.scale, fitScale);
                canvasHeight = maxH;
            }
        } else {
            canvasHeight += 40;
        }

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const p = this.padding;
        const r = this.result;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Roll background
        const rollW = r.rollWidth * this.scale;
        const rollH = r.totalLength * this.scale;
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(p, p, rollW, rollH);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.strokeRect(p, p, rollW, rollH);

        // Labels (full mode only)
        if (!this.mini) {
            ctx.fillStyle = '#666';
            ctx.font = '11px Kanit';
            ctx.textAlign = 'center';
            ctx.fillText(`${r.rollWidth}m`, p + rollW / 2, p - 8);
            ctx.save();
            ctx.translate(p - 12, p + rollH / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(`${r.totalLength}m`, 0, 0);
            ctx.restore();
        }

        // Draw items
        this.items.forEach((item, i) => {
            const x = p + item.packX * this.scale;
            const y = p + item.packY * this.scale;
            const w = item.packWidth * this.scale;
            const h = item.packLength * this.scale;
            const color = this.getColor(i);

            const isHovered = !this.mini && this.hoveredItem === i;
            ctx.fillStyle = isHovered ? this.darken(color) : color;
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, w, h);

            // Text inside item (full mode only, if big enough)
            if (!this.mini && w > 40 && h > 25) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px Kanit';
                ctx.textAlign = 'left';
                const label = item.orno || item.ORNO || '';
                ctx.fillText(label, x + 3, y + 13);
                ctx.font = '9px Kanit';
                ctx.fillText(`${item.packWidth}x${item.packLength}`, x + 3, y + 24);
                if (item.isRotated) {
                    ctx.fillStyle = '#ff9800';
                    ctx.font = 'bold 9px Kanit';
                    ctx.fillText('R', x + w - 12, y + 13);
                }
            }
        });

        // Tooltip
        if (!this.mini && this.hoveredItem !== null && this.hoveredItem < this.items.length) {
            this.drawTooltip(this.items[this.hoveredItem]);
        }
    }

    drawTooltip(item) {
        const ctx = this.ctx;
        const mx = this._mouseX || 0;
        const my = this._mouseY || 0;
        const lines = [
            `Order: ${item.orno || item.ORNO || ''}`,
            `Barcode: ${item.barcodeNo || item.BarcodeNo || ''}`,
            `Size: ${item.originalWidth || item.OriginalWidth}x${item.originalLength || item.OriginalLength}m`,
            `Placed: ${item.packWidth}x${item.packLength}m`,
            item.isRotated ? 'Rotated: Yes' : '',
        ].filter(l => l);

        ctx.font = '11px Kanit';
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width));
        const tw = maxW + 16;
        const th = lines.length * 16 + 12;
        let tx = mx + 12;
        let ty = my - th - 5;
        if (tx + tw > this.canvas.width) tx = mx - tw - 12;
        if (ty < 0) ty = my + 15;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
            ctx.fillText(line, tx + 8, ty + 16 + i * 16);
        });
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this._mouseX = e.clientX - rect.left;
        this._mouseY = e.clientY - rect.top;
        const p = this.padding;

        let found = null;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            const x = p + item.packX * this.scale;
            const y = p + item.packY * this.scale;
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

    getColor(index) {
        const hue = (index * 137.508) % 360;
        return `hsl(${hue}, 55%, 60%)`;
    }

    darken(color) {
        return color.replace('60%', '45%');
    }
}
