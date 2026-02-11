// ===== CAPET-OPS Global Helpers =====

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
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '10000';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
}

function formatNumber(num, decimals = 2) {
    return Number(num).toFixed(decimals);
}
