// ===== ระบบวางแผนผ้าใบ - Global Helpers =====

function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const msg = document.getElementById('loading-message');
    if (msg) msg.textContent = message || 'Loading...';
    if (overlay) overlay.classList.remove('d-none');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('d-none');
}

async function fetchApi(url, options = {}) {
    const loadingMsg = options.loadingMessage;
    delete options.loadingMessage;

    if (loadingMsg) showLoading(loadingMsg);

    try {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        return await response.text();
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    } finally {
        if (loadingMsg) hideLoading();
    }
}

function showAlert(message, type = 'danger') {
    const icons = {
        success: 'bi-check-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        danger:  'bi-x-circle-fill',
        info:    'bi-info-circle-fill'
    };
    const colors = {
        success: { bg: '#e8f5e9', border: '#43a047', icon: '#2e7d32', text: '#1b5e20', bar: '#43a047' },
        warning: { bg: '#fff8e1', border: '#f9a825', icon: '#e65100', text: '#4e342e', bar: '#f9a825' },
        danger:  { bg: '#fce4ec', border: '#e53935', icon: '#c62828', text: '#b71c1c', bar: '#e53935' },
        info:    { bg: '#e3f2fd', border: '#1e88e5', icon: '#1565c0', text: '#0d47a1', bar: '#1e88e5' }
    };
    const c = colors[type] || colors.danger;
    const icon = icons[type] || icons.danger;

    const toast = document.createElement('div');
    toast.className = 'cmt-toast';
    toast.style.cssText = `
        position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-120%);
        z-index:10000; min-width:320px; max-width:500px;
        background:${c.bg}; border:1px solid ${c.border}; border-left:4px solid ${c.border};
        border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
        padding:0; overflow:hidden; opacity:0;
        transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
    `;
    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; padding:12px 14px 10px 14px;">
            <i class="bi ${icon}" style="font-size:1.3rem; color:${c.icon}; flex-shrink:0;"></i>
            <div style="flex:1; font-size:0.85rem; font-weight:500; color:${c.text}; line-height:1.4;">${message}</div>
            <button onclick="this.closest('.cmt-toast').remove()" style="background:none; border:none; color:${c.icon}; opacity:0.6; cursor:pointer; font-size:1.1rem; padding:0 2px; flex-shrink:0;">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
        <div style="height:3px; background:rgba(0,0,0,0.06);">
            <div class="cmt-toast-bar" style="height:100%; width:100%; background:${c.bar}; opacity:0.5; transition:width 4.5s linear;"></div>
        </div>
    `;
    document.body.appendChild(toast);

    // slide in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        // start progress bar
        requestAnimationFrame(() => {
            const bar = toast.querySelector('.cmt-toast-bar');
            if (bar) bar.style.width = '0%';
        });
    });

    // slide out & remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-120%)';
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

function showConfirm(message, { title = 'ยืนยัน', type = 'danger', confirmText = 'ตกลง', cancelText = 'ยกเลิก' } = {}) {
    return new Promise(resolve => {
        const typeConfig = {
            danger:  { iconCls: 'bi-trash3-fill', iconColor: '#e53935', btnBg: '#e53935', btnHover: '#c62828', headerBg: '#fce4ec' },
            warning: { iconCls: 'bi-exclamation-triangle-fill', iconColor: '#f9a825', btnBg: '#e65100', btnHover: '#bf360c', headerBg: '#fff8e1' },
            info:    { iconCls: 'bi-question-circle-fill', iconColor: '#1e88e5', btnBg: '#1e88e5', btnHover: '#1565c0', headerBg: '#e3f2fd' },
            success: { iconCls: 'bi-check-circle-fill', iconColor: '#43a047', btnBg: '#43a047', btnHover: '#2e7d32', headerBg: '#e8f5e9' }
        };
        const cfg = typeConfig[type] || typeConfig.danger;

        // backdrop
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10001;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.25s ease;';

        // dialog
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background:#fff; border-radius:12px; width:380px; max-width:90vw;
            box-shadow:0 20px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.1);
            overflow:hidden; transform:scale(0.85) translateY(20px); opacity:0;
            transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
        `;
        dialog.innerHTML = `
            <div style="background:${cfg.headerBg}; padding:20px 24px 16px; text-align:center;">
                <div style="width:52px;height:52px;border-radius:50%;background:#fff;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                    <i class="bi ${cfg.iconCls}" style="font-size:1.6rem;color:${cfg.iconColor};"></i>
                </div>
                <div style="font-size:0.95rem;font-weight:700;color:#1e293b;">${title}</div>
            </div>
            <div style="padding:16px 24px 8px; text-align:center;">
                <div style="font-size:0.85rem;color:#475569;line-height:1.5;">${message}</div>
            </div>
            <div style="padding:12px 24px 20px; display:flex; gap:10px; justify-content:center;">
                <button class="cmt-confirm-cancel" style="flex:1;padding:8px 16px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:8px;font-size:0.82rem;font-weight:500;cursor:pointer;transition:background 0.15s;">
                    ${cancelText}
                </button>
                <button class="cmt-confirm-ok" style="flex:1;padding:8px 16px;border:none;background:${cfg.btnBg};color:#fff;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;transition:background 0.15s;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
                    ${confirmText}
                </button>
            </div>
        `;

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        function close(result) {
            dialog.style.transform = 'scale(0.85) translateY(20px)';
            dialog.style.opacity = '0';
            backdrop.style.opacity = '0';
            setTimeout(() => { backdrop.remove(); resolve(result); }, 250);
        }

        // animate in
        requestAnimationFrame(() => {
            backdrop.style.opacity = '1';
            requestAnimationFrame(() => {
                dialog.style.transform = 'scale(1) translateY(0)';
                dialog.style.opacity = '1';
            });
        });

        // hover effects
        const cancelBtn = dialog.querySelector('.cmt-confirm-cancel');
        const okBtn = dialog.querySelector('.cmt-confirm-ok');
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = '#f1f5f9'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = '#fff'; });
        okBtn.addEventListener('mouseenter', () => { okBtn.style.background = cfg.btnHover; });
        okBtn.addEventListener('mouseleave', () => { okBtn.style.background = cfg.btnBg; });

        // events
        cancelBtn.addEventListener('click', () => close(false));
        okBtn.addEventListener('click', () => close(true));
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
        });
    });
}

function formatNumber(num, decimals = 2) {
    return Number(num).toFixed(decimals);
}
