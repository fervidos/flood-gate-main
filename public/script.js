// Initialize Socket.io
const socket = io();

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

// Chart Configuration
let trafficChart;

// Helper to create gradient
function createGradient(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Indigo
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');
  return gradient;
}

const chartConfig = {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Req/s',
      data: [],
      borderColor: '#6366f1', // Primary Indigo
      borderWidth: 2,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.3, // Smooth curves
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: '#6366f1',
      pointHoverBorderWidth: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#a1a1aa',
        bodyColor: '#fff',
        borderColor: '#27272a',
        borderWidth: 1,
        padding: 12,
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'JetBrains Mono', size: 13 },
        displayColors: false,
        callbacks: {
          label: function (context) {
            return context.parsed.y + ' RPS';
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { display: false },
        border: { display: false }
      },
      y: {
        position: 'right',
        grid: {
          color: '#27272a',
          borderDash: [4, 4],
          drawBorder: false,
          tickLength: 0
        },
        ticks: {
          color: '#71717a',
          font: { family: 'JetBrains Mono', size: 10 },
          maxTicksLimit: 5,
          padding: 10
        },
        border: { display: false },
        beginAtZero: true
      }
    },
    animation: {
      duration: 0
    }
  }
};

// Initialize Chart
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('trafficChart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    chartConfig.data.datasets[0].backgroundColor = createGradient(ctx);
    trafficChart = new Chart(ctx, chartConfig);
  }
});

// Utility: Number count-up animation
const activeAnimations = new Map();
const ANIMATION_THRESHOLD = 5;
const ANIMATION_DURATION = 800;

function animateValue(element, start, end, duration = ANIMATION_DURATION) {
  if (!element) return;
  const existingAnimation = activeAnimations.get(element);
  if (existingAnimation) cancelAnimationFrame(existingAnimation);

  if (Math.abs(end - start) < ANIMATION_THRESHOLD) {
    element.textContent = end.toLocaleString();
    activeAnimations.delete(element);
    return;
  }

  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    element.textContent = value.toLocaleString();
    if (progress < 1) {
      const frameId = window.requestAnimationFrame(step);
      activeAnimations.set(element, frameId);
    } else {
      element.textContent = end.toLocaleString();
      activeAnimations.delete(element);
    }
  };
  const frameId = window.requestAnimationFrame(step);
  activeAnimations.set(element, frameId);
}

// Store previous values
let previousStats = {
  messagesSent: 0,
  failedRequests: 0,
  uniqueVictims: 0,
  proxyCount: 0,
  activeAttacks: 0,
  queueLength: 0,
  successRate: 0
};

// Socket Event Listeners
socket.on('connect', () => {
  console.log('Connected to server');
  const statusBadges = document.querySelectorAll('.status-badge');
  statusBadges.forEach(el => {
    const text = el.querySelector('.status-text');
    if (text) {
      text.textContent = 'Online';
      text.style.display = 'inline';
      text.style.color = 'var(--accent-green)';
    }
  });
  socket.emit('request_stats');
});

socket.on('disconnect', () => {
  console.log('Disconnected');
  const statusBadges = document.querySelectorAll('.status-badge');
  statusBadges.forEach(el => {
    const text = el.querySelector('.status-text');
    if (text) {
      text.textContent = 'Offline';
      text.style.display = 'inline';
      text.style.color = 'var(--accent-red)';
    }
  });
});

socket.on('stats_update', (data) => {
  requestAnimationFrame(() => {
    updateStatsUI(data);
    updateChart(data);
  });
});

socket.on('proxy_check_progress', (data) => {
  const statusDiv = document.getElementById('proxy-status');
  const btn = document.getElementById('btn-refresh-proxies') || document.getElementById('btn-check-proxies');

  if (statusDiv && btn) {
    btn.disabled = true;
    btn.textContent = 'Checking...';
    btn.style.opacity = '0.7';

    const percent = Math.round((data.checked / data.total) * 100);
    // Use HTML that fits the new design
    statusDiv.innerHTML = `<span class="text-cyan">${percent}%</span> (${data.checked}/${data.total}) | <span class="text-success">${data.working} OK</span> / <span class="text-danger">${data.failed} BAD</span>`;

    if (data.checked === data.total) {
      btn.disabled = false;
      btn.textContent = btn.id === 'btn-refresh-proxies' ? 'Refresh Counter' : 'Refresh Proxies';
      btn.style.opacity = '1';
    }
  }
});

socket.on('attack_stopped', (data) => {
  const modal = document.getElementById("victim-modal");
  if (modal.style.display === "flex") { // Note: using flex for modal now usually, or check visibility
    loadVictims();
  }
});

socket.on('all_attacks_stopped', (data) => {
  showToast(`Stopped ${data.count} active attacks.`, 'success');
  const modal = document.getElementById("victim-modal");
  if (modal.style.display === "flex") {
    loadVictims();
  }
});

function updateStatsUI(data) {
  const messagesSentEl = document.getElementById('messages-sent');
  const failedRequestsEl = document.getElementById('failed-requests');
  const uniqueVictimsEl = document.getElementById('unique-victims');
  const proxyCountEl = document.getElementById('proxy-count');
  const activeAttacksEl = document.getElementById('active-attacks');
  const queueLengthEl = document.getElementById('queue-length');
  const successRateEl = document.getElementById('success-rate');

  if (data.messagesSent !== previousStats.messagesSent) {
    animateValue(messagesSentEl, previousStats.messagesSent, data.messagesSent);
    previousStats.messagesSent = data.messagesSent;
  }
  if (data.failedRequests !== previousStats.failedRequests) {
    animateValue(failedRequestsEl, previousStats.failedRequests, data.failedRequests || 0);
    previousStats.failedRequests = data.failedRequests || 0;
  }
  if (data.uniqueVictims !== previousStats.uniqueVictims) {
    animateValue(uniqueVictimsEl, previousStats.uniqueVictims, data.uniqueVictims || 0);
    previousStats.uniqueVictims = data.uniqueVictims || 0;
  }
  if (data.proxyCount !== previousStats.proxyCount) {
    animateValue(proxyCountEl, previousStats.proxyCount, data.proxyCount);
    previousStats.proxyCount = data.proxyCount;
  }
  if (data.activeAttacks !== previousStats.activeAttacks) {
    animateValue(activeAttacksEl, previousStats.activeAttacks, data.activeAttacks);
    previousStats.activeAttacks = data.activeAttacks;
  }
  if (data.queueLength !== previousStats.queueLength) {
    animateValue(queueLengthEl, previousStats.queueLength, data.queueLength || 0);
    previousStats.queueLength = data.queueLength || 0;
  }
  if (data.successRate !== previousStats.successRate) {
    successRateEl.textContent = (data.successRate || 0) + '%';
    previousStats.successRate = data.successRate || 0;
  }

  // Update uptime
  const uptimeSeconds = Math.floor(data.uptime / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  document.getElementById('uptime').textContent =
    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Update bandwidth
  if (data.bandwidth) {
    const uploadEl = document.getElementById('bandwidth-upload');
    const downloadEl = document.getElementById('bandwidth-download');
    const totalEl = document.getElementById('bandwidth-total');

    if (uploadEl && downloadEl && totalEl) {
      const formatBytes = (bytes, decimals = 1) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
      };

      // Send/Receive rates formatting
      const formatRate = (bytesPerSec) => {
        if (bytesPerSec < 1024) return bytesPerSec + ' B/s';
        if (bytesPerSec < 1024 * 1024) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
        return (bytesPerSec / (1024 * 1024)).toFixed(2) + ' MB/s';
      };

      uploadEl.textContent = '↑ ' + formatRate(data.bandwidth.sendRate);
      downloadEl.textContent = '↓ ' + formatRate(data.bandwidth.receiveRate);
      const totalBytes = data.bandwidth.totalSent + data.bandwidth.totalReceived;
      totalEl.textContent = formatBytes(totalBytes);
    }
  }
}

// Chart Logic
const maxDataPoints = 60;
let lastMessageCount = 0;
let lastTimestamp = Date.now();

function updateChart(data) {
  if (!trafficChart) return;
  const now = new Date();
  const timeDiff = (now.getTime() - lastTimestamp);

  if (timeDiff < 800 && lastMessageCount > 0) return;

  const currentMessageCount = data.messagesSent + (data.failedRequests || 0);
  let rate = 0;
  const secondsDiff = timeDiff / 1000;

  if (secondsDiff > 0 && lastMessageCount > 0) {
    rate = (currentMessageCount - lastMessageCount) / secondsDiff;
  }
  if (lastMessageCount === 0 || rate < 0) rate = 0;

  lastMessageCount = currentMessageCount;
  lastTimestamp = now.getTime();

  trafficChart.data.labels.push('');
  trafficChart.data.datasets[0].data.push(rate);

  if (trafficChart.data.labels.length > maxDataPoints) {
    trafficChart.data.labels.shift();
    trafficChart.data.datasets[0].data.shift();
  }
  trafficChart.update();

  const rpsDisplay = document.getElementById('current-rps-display');
  if (rpsDisplay) rpsDisplay.textContent = Math.round(rate).toLocaleString() + ' RPS';
}

// Proxy buttons
const btnFetch = document.getElementById('btn-fetch-proxies');
if (btnFetch) {
  btnFetch.addEventListener('click', async () => {
    const statusDiv = document.getElementById('proxy-status');
    btnFetch.disabled = true;
    const originalText = btnFetch.textContent;
    btnFetch.textContent = 'Fetching...';
    if (statusDiv) statusDiv.textContent = 'Fetching new proxies...';

    try {
      await fetch('/api/proxies/fetch', { method: 'POST' });
    } catch (error) {
      if (statusDiv) statusDiv.textContent = 'Fetch failed.';
    } finally {
      btnFetch.disabled = false;
      btnFetch.textContent = originalText;
    }
  });
}

const btnRefresh = document.getElementById('btn-refresh-proxies');
if (btnRefresh) {
  btnRefresh.addEventListener('click', async () => {
    const statusDiv = document.getElementById('proxy-status');
    btnRefresh.disabled = true;
    const originalText = btnRefresh.textContent;
    btnRefresh.textContent = 'Refreshing...';
    if (statusDiv) statusDiv.textContent = 'Syncing with DB...';

    try {
      await fetch('/api/proxies/refresh', { method: 'POST' });
    } catch (error) {
      if (statusDiv) statusDiv.textContent = 'Refresh failed.';
    } finally {
      btnRefresh.disabled = false;
      btnRefresh.textContent = originalText;
    }
  });
}

// Stop All Button
document.getElementById('btn-stop-all').addEventListener('click', async () => {
  const confirmed = await showConfirm('Are you sure you want to stop all active attacks?', {
    title: 'Stop All Attacks',
    confirmText: 'Stop All',
    danger: true
  });
  if (!confirmed) return;

  const btn = document.getElementById('btn-stop-all');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Stopping...';

  try {
    const response = await fetch('/api/attack/stop-all', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Stop all failed');
    }
    showToast('Stop-all request sent.', 'success');
  } catch (error) {
    showToast('Failed to stop attacks.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
});

// Modal Logic
document.addEventListener('DOMContentLoaded', () => {
  // Victims Modal
  const victimModal = document.getElementById("victim-modal");
  // ID used for the anchor tag in sidebar
  const victimBtn = document.getElementById("unique-victims-card");
  const closeVictimBtn = victimModal.querySelector(".close-modal");

  // Add Victim Modal
  const addModal = document.getElementById('add-victim-modal');
  const closeAddBtn = addModal.querySelector('.close-add-modal');
  const btnAddVictim = document.getElementById('btn-add-victim');

  // -- Victim Modal Events --
  if (victimBtn) {
    victimBtn.onclick = function (e) {
      e.preventDefault();
      victimModal.style.display = "flex"; // Changed to flex for centering
      startVictimPolling();
    }
  }
  if (closeVictimBtn) {
    closeVictimBtn.onclick = function () {
      victimModal.style.display = "none";
      stopVictimPolling();
    }
  }

  // -- Add Modal Events --
  // Use event delegation for buttons that might be dynamic, or straightforward ID if static
  if (btnAddVictim) {
    btnAddVictim.onclick = () => {
      addModal.style.display = 'flex';
    }
  }
  if (closeAddBtn) {
    closeAddBtn.onclick = () => {
      addModal.style.display = 'none';
    }
  }

  // Close on click outside
  window.onclick = function (event) {
    if (event.target == victimModal) {
      victimModal.style.display = "none";
      stopVictimPolling();
    }
    if (event.target == addModal) {
      addModal.style.display = "none";
    }
  }

  let victimPollInterval;
  function startVictimPolling() {
    loadVictims();
    victimPollInterval = setInterval(loadVictims, 2000);
  }
  function stopVictimPolling() {
    if (victimPollInterval) clearInterval(victimPollInterval);
  }

  // Victim Data Management
  let victimOrder = [];
  let lastVictimStatuses = {};
  const victimDataHashes = new Map();

  function hashVictimData(data) {
    return `${data.stats?.success || 0}-${data.stats?.failed || 0}-${data.isActive}-${data.isPaused}-${data.elapsedSeconds || 0}-${data.attackCount || 0}`;
  }

  function formatTimer(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  async function loadVictims() {
    try {
      const response = await fetch('/api/victims');
      const victims = await response.json();
      const victimList = document.getElementById("victim-list");
      const scrollTop = victimList.scrollTop;

      // Sorting Logic
      let needsResort = false;
      const currentStatuses = {};
      for (const username in victims) {
        currentStatuses[username] = victims[username].isActive;
        if (lastVictimStatuses[username] !== currentStatuses[username]) needsResort = true;
      }
      if (Object.keys(currentStatuses).length !== Object.keys(lastVictimStatuses).length) needsResort = true;
      lastVictimStatuses = currentStatuses;

      if (needsResort || victimOrder.length === 0) {
        victimOrder = Object.keys(victims).sort((a, b) => {
          if (victims[a].isActive && !victims[b].isActive) return -1;
          if (!victims[a].isActive && victims[b].isActive) return 1;
          const lastA = victims[a].lastSeen || 0;
          const lastB = victims[b].lastSeen || 0;
          return new Date(lastB) - new Date(lastA);
        });
      }

      const searchInput = document.getElementById('victim-search');
      const currentSelection = document.querySelector('.victim-item.active')?.dataset.username;

      const existingElements = {};
      document.querySelectorAll('.victim-item').forEach(el => {
        existingElements[el.dataset.username] = el;
      });

      // Update List
      victimOrder.forEach((username) => {
        if (!victims[username]) return;
        const data = victims[username];
        const currentHash = hashVictimData(data);
        const lastHash = victimDataHashes.get(username);

        let div = existingElements[username];
        let isNew = false;

        if (!div) {
          div = document.createElement('div');
          div.className = 'victim-item';
          div.dataset.username = username;
          div.onclick = () => showMessages(username, victims[username]);
          victimList.appendChild(div);
          isNew = true;
          existingElements[username] = div;
        }

        if (needsResort && !isNew) {
          victimList.appendChild(div); // Move to correct position
        }

        if (currentSelection === username) div.classList.add('active');
        else div.classList.remove('active');

        // Search Filter
        if (searchInput && searchInput.value) {
          const term = searchInput.value.toLowerCase();
          div.style.display = username.toLowerCase().includes(term) ? 'block' : 'none';
        }

        if (lastHash === currentHash && div.innerHTML) return;

        // Build HTML for Item
        const isActive = data.isActive;
        const lastSeen = formatTimeAgo(data.lastSeen);
        let statusBadge = '';
        if (isActive) statusBadge = '<span style="display:inline-block; width:6px; height:6px; background:var(--green); border-radius:50%; margin-right:6px;"></span>';
        else if (data.isPaused) statusBadge = '<span style="color:var(--orange); font-size:10px; margin-right:6px;">PAUSED</span>';

        div.innerHTML = `
            <div class="victim-item-header">
                <span class="victim-name" style="${isActive ? 'color: white' : 'color: var(--text-muted)'}">${statusBadge}${username}</span>
                <span style="font-size:11px; color: var(--text-muted)">${lastSeen}</span>
            </div>
            <div class="victim-meta">
                 <span>${data.stats?.success || 0}/${data.stats?.failed || 0}</span>
                 ${isActive && data.elapsedSeconds ? `<span>⏱ ${formatTimer(data.elapsedSeconds)}</span>` : ''}
            </div>
        `;
        victimDataHashes.set(username, currentHash);
      });

      // Cleanup removed victims
      Object.keys(existingElements).forEach(name => {
        if (!victimOrder.includes(name)) existingElements[name].remove();
      });

      victimList.scrollTop = scrollTop;

      // Selection Logic
      const victimNameHeader = document.getElementById("selected-victim-name");
      const messageList = document.getElementById("message-list");

      if (victimOrder.length === 0) {
        victimNameHeader.textContent = "No victims found";
        messageList.innerHTML = '';
      } else if (!currentSelection && !document.querySelector('.victim-item.active')) {
        if (!searchInput || !searchInput.value) {
          showMessages(victimOrder[0], victims[victimOrder[0]]);
        }
      } else if (currentSelection && victims[currentSelection]) {
        updateVictimStats(currentSelection, victims[currentSelection]);
      }

    } catch (e) {
      console.error(e);
    }
  }

  // Search Handler
  const searchInput = document.getElementById('victim-search');
  if (searchInput) {
    searchInput.onkeyup = () => {
      const term = searchInput.value.toLowerCase();
      document.querySelectorAll('.victim-item').forEach(div => {
        const name = div.dataset.username.toLowerCase();
        div.style.display = name.includes(term) ? 'block' : 'none';
      });
    }
  }

  // --- Details View Functions ---

  function updateHeader(username, data) {
    const success = data.stats?.success || 0;
    const failed = data.stats?.failed || 0;
    const total = success + failed;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : 0;
    const isActive = data.isActive;

    const header = document.getElementById("selected-victim-name");

    // We construct the "Details Header" to be rich HTML inside the #selected-victim-name H2 container?
    // In my new HTML, #selected-victim-name is an H2 in .details-header.
    // I should probably allow the previous custom HTML injection if we want those controls.

    let container = document.getElementById('v-header-container');
    if (!container || container.dataset.username !== username) {
      header.innerHTML = `
            <div id="v-header-container" data-username="${username}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:1.2rem; display:flex; align-items:center; gap:8px;">
                         ${username}
                         <span id="v-status-pill" style="font-size:10px; padding:2px 6px; border-radius:4px; background:var(--bg-card); border:1px solid var(--border-subtle); display:none"></span>
                    </span>
                    <div id="v-actions" style="display:flex; gap:8px"></div>
                </div>
                <!-- Progress & Stats Strip -->
                <div style="margin-top:12px; font-size:12px; color:var(--text-muted); display:flex; gap:16px;">
                     <span>Total: <b style="color:var(--text-main)" id="v-total">0</b></span>
                     <span>Success: <b class="text-success" id="v-success">0</b></span>
                     <span>Failed: <b class="text-danger" id="v-failed">0</b></span>
                     <span>Ratio: <b class="text-cyan" id="v-rate">0%</b></span>
                     <span id="v-timer-elapsed" style="display:none">Elapsed: <b class="text-cyan" id="v-val-elapsed"></b></span>
                </div>
                <div id="v-progress-bg" style="height:4px; background:#1f1f22; margin-top:8px; border-radius:2px; overflow:hidden; display:none">
                     <div id="v-progress-bar" style="height:100%; width:0%; background:var(--primary)"></div>
                </div>
            </div>
        `;
      container = document.getElementById('v-header-container');
    }

    // Update Values
    document.getElementById('v-total').textContent = total;
    document.getElementById('v-success').textContent = success;
    document.getElementById('v-failed').textContent = failed;
    document.getElementById('v-rate').textContent = successRate + '%';

    // Status Pill
    const pill = document.getElementById('v-status-pill');
    if (isActive) {
      pill.style.display = 'inline-block';
      pill.textContent = data.isPaused ? 'PAUSED' : 'ACTIVE';
      pill.style.color = data.isPaused ? 'var(--accent-orange)' : 'var(--accent-green)';
      pill.style.borderColor = data.isPaused ? 'var(--accent-orange)' : 'var(--accent-green)';
    } else {
      pill.style.display = 'none';
      container.querySelector('#v-progress-bg').style.display = 'none';
      container.querySelector('#v-timer-elapsed').style.display = 'none';
    }

    // Progress
    if (isActive && data.elapsedSeconds !== undefined) {
      document.getElementById('v-timer-elapsed').style.display = 'block';
      document.getElementById('v-val-elapsed').textContent = formatTimer(data.elapsedSeconds);

      if (data.duration) {
        const pct = Math.min(100, (data.elapsedSeconds / data.duration) * 100);
        const bar = document.getElementById('v-progress-bg');
        bar.style.display = 'block';
        document.getElementById('v-progress-bar').style.width = pct + '%';
      }
    }

    // Actions
    const actionsDiv = document.getElementById('v-actions');
    if (isActive) {
      const pauseLabel = data.isPaused ? 'Resume' : 'Pause';
      actionsDiv.innerHTML = `
            <button id="btn-pause" class="btn btn-xs" style="padding:4px 10px; font-size:11px; background:var(--bg-hover)">${pauseLabel}</button>
            <button id="btn-stop" class="btn btn-xs" style="padding:4px 10px; font-size:11px; background:rgba(239,68,68,0.2); color:var(--accent-red)">Stop</button>
        `;
      document.getElementById('btn-stop').onclick = (e) => { e.stopPropagation(); stopAttack(username); }
      document.getElementById('btn-pause').onclick = (e) => {
        e.stopPropagation();
        if (data.isPaused) resumeAttack(username); else pauseAttack(username);
      }
    } else {
      actionsDiv.innerHTML = `
             <button class="btn btn-xs" style="padding:4px 10px; font-size:11px; background:var(--bg-hover)" onclick="openAttackModal('${username}')">Relaunch</button>
        `;
    }
  }

  function updateVictimStats(username, data) {
    updateHeader(username, data);
    // Update Message Table in Details
    const statsContainer = document.getElementById('message-list').querySelector('.stats-container');
    if (statsContainer) {
      const tbody = statsContainer.querySelector('tbody');
      if (tbody) {
        // Rebuild table rows...
        // (Simplified for brevity, similar logic to previous script but ensuring styles match)
        tbody.innerHTML = '';
        const counts = data.messageCounts || {};
        if (Object.keys(counts).length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:12px; color:var(--text-muted)">No data available</td></tr>';
        } else {
          Object.entries(counts).sort(([, a], [, b]) => (b.success + b.failed) - (a.success + a.failed)).forEach(([msg, st]) => {
            tbody.innerHTML += `
                        <tr style="border-bottom:1px solid var(--border-subtle)">
                            <td style="padding:6px; font-size:12px;" title="${msg}">${msg.substring(0, 50)}...</td>
                            <td style="padding:6px; text-align:center; font-size:12px;">${st.success + st.failed}</td>
                            <td style="padding:6px; text-align:center; font-size:12px; color:var(--accent-green)">${st.success}</td>
                            <td style="padding:6px; text-align:center; font-size:12px; color:var(--accent-red)">${st.failed}</td>
                        </tr>
                       `;
          });
        }
      }
    }
  }

  function showMessages(username, data) {
    updateHeader(username, data);
    const messageList = document.getElementById("message-list");
    messageList.innerHTML = '';

    // Set Active Class
    document.querySelectorAll('.victim-item').forEach(el => {
      if (el.dataset.username === username) el.classList.add('active');
      else el.classList.remove('active');
    });

    // Note Logic
    const noteInput = document.getElementById('victim-note');
    if (noteInput) {
      noteInput.value = data.note || '';
      // Save handler logic same as before...
      const saveBtn = document.getElementById('save-note-btn');
      const newBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newBtn, saveBtn);

      newBtn.onclick = async () => {
        // ... save fetch call ...
        await fetch('/api/victims/note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, note: noteInput.value })
        });
        document.getElementById('note-save-status').textContent = 'Saved!';
        setTimeout(() => document.getElementById('note-save-status').textContent = '', 2000);
      }
    }

    // 1. Stats Table
    const statsDiv = document.createElement('div');
    statsDiv.className = 'stats-container';
    statsDiv.innerHTML = `
          <h4 style="font-size:12px; color:var(--text-muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Message Performance</h4>
          <table style="width:100%; border-collapse:collapse;">
              <thead>
                  <tr style="text-align:left; color:var(--text-muted); font-size:11px;">
                      <th style="padding:4px">CONTENT</th>
                      <th style="padding:4px; text-align:center">SENT</th>
                      <th style="padding:4px; text-align:center">OK</th>
                      <th style="padding:4px; text-align:center">FAIL</th>
                  </tr>
              </thead>
              <tbody></tbody>
          </table>
      `;
    messageList.appendChild(statsDiv);
    updateVictimStats(username, data); // Populate it immediately


  }

  // Attack Start Form Logic
  const attackForm = document.getElementById('attack-form');
  if (attackForm) {
    attackForm.onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-launch');
      btn.disabled = true;
      btn.textContent = 'Initializing...';

      const msgLimitRaw = document.getElementById('message-limit-input')?.value;
      const payload = {
        username: document.getElementById('target-input').value,
        type: 'spam',
        message: document.getElementById('message-input').value,
        rps: 25,            // Fixed — not user-settable
        duration: 86400,    // 24h ceiling; attack stops via messageLimit first
        messageLimit: msgLimitRaw ? parseInt(msgLimitRaw) : null
      };

      try {
        const response = await fetch('/api/attack/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error('Start failed');
        }
        showToast('Attack started.', 'success');
        document.getElementById('add-victim-modal').style.display = 'none';
        loadVictims();
      } catch (e) {
        showToast('Error starting attack.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Initialize Attack Sequence';
      }
    }
  }
});

// Global Helpers for buttons injected in innerHTML
window.stopAttack = async (username) => {
  const confirmed = await showConfirm(`Stop attack on ${username}?`, {
    title: 'Stop Attack',
    confirmText: 'Stop',
    danger: true
  });
  if (!confirmed) return;

  try {
    const response = await fetch('/api/attack/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!response.ok) {
      throw new Error('Stop failed');
    }
    showToast(`Stopped attack on ${username}.`, 'success');
  } catch (error) {
    showToast(`Failed to stop attack on ${username}.`, 'error');
  }
}
window.pauseAttack = async (username) => {
  await fetch('/api/attack/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
}
window.resumeAttack = async (username) => {
  await fetch('/api/attack/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
}

window.openAttackModal = function(username) {
  const modal = document.getElementById('add-victim-modal');
  const input = document.getElementById('target-input');
  if (modal && input) {
      input.value = username;
      modal.style.display = 'flex';
  }
}
