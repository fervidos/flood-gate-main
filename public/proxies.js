document.addEventListener('DOMContentLoaded', () => {
    function ensureUxElements() {
        let toastHost = document.getElementById('ux-toast-host');
        if (!toastHost) {
            toastHost = document.createElement('div');
            toastHost.id = 'ux-toast-host';
            toastHost.className = 'ux-toast-host';
            document.body.appendChild(toastHost);
        }

        let confirmOverlay = document.getElementById('ux-confirm-overlay');
        if (!confirmOverlay) {
            confirmOverlay = document.createElement('div');
            confirmOverlay.id = 'ux-confirm-overlay';
            confirmOverlay.className = 'modal-overlay ux-confirm-overlay';
            confirmOverlay.innerHTML = `
                <div class="modal-content" style="max-width: 420px;">
                    <div class="modal-header">
                        <h3 id="ux-confirm-title">Confirm Action</h3>
                    </div>
                    <p id="ux-confirm-message" class="ux-confirm-text"></p>
                    <div class="ux-confirm-actions">
                        <button id="ux-confirm-cancel" class="btn btn-secondary">Cancel</button>
                        <button id="ux-confirm-ok" class="btn btn-primary">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmOverlay);
        }
    }

    function showToast(message, type = 'info', timeout = 2400) {
        ensureUxElements();
        const toastHost = document.getElementById('ux-toast-host');
        const toast = document.createElement('div');
        toast.className = `ux-toast ux-toast-${type}`;
        toast.textContent = message;
        toastHost.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        window.setTimeout(() => {
            toast.classList.remove('visible');
            window.setTimeout(() => toast.remove(), 200);
        }, timeout);
    }

    function showConfirm(message, options = {}) {
        ensureUxElements();
        const {
            title = 'Confirm Action',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            danger = false
        } = options;

        const overlay = document.getElementById('ux-confirm-overlay');
        const titleEl = document.getElementById('ux-confirm-title');
        const messageEl = document.getElementById('ux-confirm-message');
        const okBtn = document.getElementById('ux-confirm-ok');
        const cancelBtn = document.getElementById('ux-confirm-cancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        okBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;
        okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';

        overlay.style.display = 'flex';

        return new Promise((resolve) => {
            const cleanup = () => {
                overlay.style.display = 'none';
                okBtn.onclick = null;
                cancelBtn.onclick = null;
                overlay.onclick = null;
            };

            okBtn.onclick = () => {
                cleanup();
                resolve(true);
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };

            overlay.onclick = (event) => {
                if (event.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            };
        });
    }

    const proxyList = document.getElementById('proxy-list');
    const pagination = document.getElementById('pagination');
    const searchInput = document.getElementById('search-input');
    const btnSearch = document.getElementById('btn-search');
    const btnDeleteSelected = document.getElementById('btn-delete-selected');
    const btnAddModal = document.getElementById('btn-add-modal');
    const selectAllCheckbox = document.getElementById('select-all');
    const totalProxiesSpan = document.getElementById('total-proxies');
    const addModal = document.getElementById('add-modal');
    const closeBtn = document.querySelector('.close');
    const btnCancelAdd = document.getElementById('btn-cancel-add');
    const btnConfirmAdd = document.getElementById('btn-confirm-add');
    const proxyInput = document.getElementById('proxy-input');
    const addResult = document.getElementById('add-result');

    let currentPage = 1;
    let currentLimit = 50;
    let currentSearch = '';
    let totalPages = 1;
    let selectedProxies = new Set();

    // Initial load
    fetchProxies();

    // Event Listeners
    btnSearch.addEventListener('click', () => {
        currentSearch = searchInput.value;
        currentPage = 1;
        fetchProxies();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentSearch = searchInput.value;
            currentPage = 1;
            fetchProxies();
        }
    });

    selectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.proxy-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) {
                selectedProxies.add(cb.value);
            } else {
                selectedProxies.delete(cb.value);
            }
        });
        updateDeleteButton();
    });

    btnDeleteSelected.addEventListener('click', async () => {
        if (selectedProxies.size === 0) return;
        
        const confirmed = await showConfirm(`Delete ${selectedProxies.size} selected proxies?`, {
            title: 'Delete Proxies',
            confirmText: 'Delete',
            danger: true
        });
        if (!confirmed) return;

        try {
            const response = await fetch('/api/proxies/manage', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedProxies) })
            });
            
            if (response.ok) {
                selectedProxies.clear();
                selectAllCheckbox.checked = false;
                showToast('Selected proxies deleted.', 'success');
                fetchProxies();
            } else {
                showToast('Failed to delete proxies.', 'error');
            }
        } catch (error) {
            console.error('Error deleting proxies:', error);
            showToast('Error deleting proxies.', 'error');
        }
    });

    // Modal Events
    btnAddModal.addEventListener('click', () => {
        addModal.style.display = 'block';
        proxyInput.value = '';
        addResult.textContent = '';
        addResult.className = '';
    });

    closeBtn.addEventListener('click', () => {
        addModal.style.display = 'none';
    });
    
    btnCancelAdd.addEventListener('click', () => {
        addModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === addModal) {
            addModal.style.display = 'none';
        }
    });

    btnConfirmAdd.addEventListener('click', async () => {
        const proxies = proxyInput.value.trim().split('\n').filter(line => line.trim());
        if (proxies.length === 0) {
            addResult.textContent = 'Please enter at least one proxy.';
            addResult.className = 'text-danger';
            return;
        }

        addResult.textContent = 'Adding proxies...';
        addResult.className = 'text-muted';
        btnConfirmAdd.disabled = true;

        try {
            const response = await fetch('/api/proxies/manage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ proxies })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                let msg = `Successfully added ${result.details.upsertedCount} new proxies and updated ${result.details.modifiedCount}.`;
                if (result.bannedCount > 0) {
                    msg += ` <br><span class="text-warning">⚠️ Skipped ${result.bannedCount} banned proxies.</span>`;
                }
                addResult.innerHTML = msg;
                addResult.className = 'text-success';
                showToast('Proxies updated successfully.', 'success');
                setTimeout(() => {
                    addModal.style.display = 'none';
                    fetchProxies();
                    btnConfirmAdd.disabled = false;
                }, 2000);
            } else {
                addResult.textContent = `Error: ${result.error || 'Unknown error'}`;
                addResult.className = 'text-danger';
                showToast('Failed to add proxies.', 'error');
                btnConfirmAdd.disabled = false;
            }
        } catch (error) {
            console.error('Error adding proxies:', error);
            addResult.textContent = 'Network error occurred.';
            addResult.className = 'text-danger';
            showToast('Network error while adding proxies.', 'error');
            btnConfirmAdd.disabled = false;
        }
    });

    async function fetchProxies() {
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: currentLimit,
                search: currentSearch
            });
            
            const response = await fetch(`/api/proxies/manage?${params}`);
            const data = await response.json();
            
            renderTable(data.proxies);
            renderPagination(data.page, data.totalPages);
            totalProxiesSpan.textContent = data.total;
            
            // Reset selection on page change (optional, but safer for bulk actions across pages)
            selectedProxies.clear();
            selectAllCheckbox.checked = false;
            updateDeleteButton();

        } catch (error) {
            console.error('Error fetching proxies:', error);
            proxyList.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-danger);">Failed to load proxies</td></tr>';
        }
    }

    function renderTable(proxies) {
        proxyList.innerHTML = '';
        if (proxies.length === 0) {
            proxyList.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No proxies found</td></tr>';
            return;
        }

        proxies.forEach(proxy => {
            const tr = document.createElement('tr');
            
            const isWorking = proxy.isWorking && (!proxy.timeoutUntil || new Date(proxy.timeoutUntil) < new Date());
            const statusClass = isWorking ? 'status-working' : 'status-failed';
            const statusText = isWorking ? 'Working' : 'Failed/Timeout';
            const lastChecked = new Date(proxy.lastChecked).toLocaleString();

            tr.innerHTML = `
                <td><input type="checkbox" class="proxy-checkbox" value="${proxy._id}"></td>
                <td>${proxy.host}</td>
                <td>${proxy.port}</td>
                <td><span class="status-badge" style="background:var(--bg-secondary); color:var(--text-muted)">${proxy.type}</span></td>
                <td>${proxy.auth ? 'Yes' : 'No'}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td>${proxy.failCount}</td>
                <td style="font-size:0.8em; color:var(--text-muted)">${lastChecked}</td>
            `;
            
            // Re-check if selected (persisting selection within page view, though I cleared it on fetch)
            // If I wanted to persist selection across pages, I'd need to not clear selectedProxies in fetchProxies
            // But for now, clearing is safer.
            
            const checkbox = tr.querySelector('.proxy-checkbox');
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedProxies.add(proxy._id);
                } else {
                    selectedProxies.delete(proxy._id);
                }
                updateDeleteButton();
            });

            proxyList.appendChild(tr);
        });
    }

    function renderPagination(page, total) {
        pagination.innerHTML = '';
        totalPages = total;
        
        if (totalPages <= 1) return;

        // Previous
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.textContent = '«';
        prevBtn.disabled = page === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchProxies();
            }
        });
        pagination.appendChild(prevBtn);

        // Page numbers (simple version)
        // Show max 5 pages around current
        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                currentPage = i;
                fetchProxies();
            });
            pagination.appendChild(btn);
        }

        // Next
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.textContent = '»';
        nextBtn.disabled = page === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                fetchProxies();
            }
        });
        pagination.appendChild(nextBtn);
    }

    function updateDeleteButton() {
        btnDeleteSelected.disabled = selectedProxies.size === 0;
        btnDeleteSelected.textContent = selectedProxies.size > 0 ? `Delete (${selectedProxies.size})` : 'Delete Selected';
    }
});