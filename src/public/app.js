const API_BASE = '/api';

// Set today's date as default
document.getElementById('dateInput').valueAsDate = new Date();

// File upload handling
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

let selectedFile = null;

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        selectedFile = e.target.files[0];
        uploadArea.querySelector('.upload-prompt p').textContent = `Selected: ${selectedFile.name}`;
        uploadBtn.disabled = false;
        uploadStatus.className = 'status-message';
    }
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
        selectedFile = e.dataTransfer.files[0];
        fileInput.files = e.dataTransfer.files;
        uploadArea.querySelector('.upload-prompt p').textContent = `Selected: ${selectedFile.name}`;
        uploadBtn.disabled = false;
        uploadStatus.className = 'status-message';
    }
});

uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    uploadBtn.disabled = true;
    uploadStatus.className = 'status-message';
    uploadStatus.textContent = 'Uploading...';

    try {
        const response = await fetch(`${API_BASE}/uploads`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            uploadStatus.className = 'status-message success';
            uploadStatus.textContent = `Success! Batch ID: ${data.batchId}, Events: ${data.totalEvents}`;
            selectedFile = null;
            fileInput.value = '';
            uploadArea.querySelector('.upload-prompt p').textContent = 'Click to select CSV file or drag and drop';
            uploadBtn.disabled = true;
            loadBatches(); // Refresh batches list
        } else {
            uploadStatus.className = 'status-message error';
            uploadStatus.textContent = `Error: ${data.message || 'Upload failed'}`;
            uploadBtn.disabled = false;
        }
    } catch (error) {
        uploadStatus.className = 'status-message error';
        uploadStatus.textContent = `Error: ${error.message}`;
        uploadBtn.disabled = false;
    }
});

// Batches handling
const refreshBatchesBtn = document.getElementById('refreshBatchesBtn');
const batchesList = document.getElementById('batchesList');

refreshBatchesBtn.addEventListener('click', loadBatches);

async function loadBatches() {
    batchesList.innerHTML = '<div class="loading">Loading batches...</div>';

    try {
        // Note: This endpoint doesn't exist yet, so we'll show a message
        // In a real implementation, you'd fetch from an endpoint like GET /api/batches
        batchesList.innerHTML = '<div class="no-metrics">Batch list endpoint not implemented. Check console for batch IDs after upload.</div>';
    } catch (error) {
        batchesList.innerHTML = `<div class="status-message error">Error loading batches: ${error.message}</div>`;
    }
}

function createBatchItem(batch) {
    const div = document.createElement('div');
    div.className = 'batch-item';
    
    const statusClass = `batch-status ${batch.status}`;
    const canProcess = batch.status === 'uploaded' || batch.status === 'processing';
    
    div.innerHTML = `
        <div class="batch-item-info">
            <div class="batch-item-id">${batch.batchId}</div>
            <div class="batch-item-details">
                ${batch.fileName} • ${batch.processedEvents}/${batch.totalEvents} events
            </div>
        </div>
        <div>
            <span class="${statusClass}">${batch.status}</span>
            ${canProcess ? `<button class="process-btn" onclick="processBatch('${batch.batchId}')">Process</button>` : ''}
        </div>
    `;
    
    return div;
}

window.processBatch = async function(batchId) {
    try {
        const response = await fetch(`${API_BASE}/batches/${batchId}/process`, {
            method: 'POST',
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Batch processing started! ${data.jobsEnqueued} jobs enqueued.`);
            loadBatches();
        } else {
            alert(`Error: ${data.message || 'Processing failed'}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
};

// Metrics handling
const dateInput = document.getElementById('dateInput');
const loadMetricsBtn = document.getElementById('loadMetricsBtn');
const metricsContent = document.getElementById('metricsContent');

loadMetricsBtn.addEventListener('click', loadMetrics);
dateInput.addEventListener('change', () => {
    if (dateInput.value) {
        loadMetrics();
    }
});

async function loadMetrics() {
    const date = dateInput.value;
    if (!date) {
        metricsContent.innerHTML = '<div class="status-message error">Please select a date</div>';
        return;
    }

    metricsContent.innerHTML = '<div class="loading">Loading metrics...</div>';

    try {
        const response = await fetch(`${API_BASE}/metrics?date=${date}`);
        const data = await response.json();

        if (response.ok) {
            if (data.metrics && data.metrics.length > 0) {
                const table = document.createElement('table');
                table.className = 'metrics-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Event Type</th>
                            <th>Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.metrics.map(metric => `
                            <tr>
                                <td>${metric.eventType}</td>
                                <td>${metric.count}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                `;
                metricsContent.innerHTML = '';
                metricsContent.appendChild(table);
            } else {
                metricsContent.innerHTML = '<div class="no-metrics">No metrics found for this date</div>';
            }
        } else {
            metricsContent.innerHTML = `<div class="status-message error">Error: ${data.message || 'Failed to load metrics'}</div>`;
        }
    } catch (error) {
        metricsContent.innerHTML = `<div class="status-message error">Error: ${error.message}</div>`;
    }
}

// Load batches and metrics on page load
loadBatches();
loadMetrics();

