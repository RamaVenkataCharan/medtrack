const API_BASE = '/api';

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('medtrack_web_session');
    if (raw) {
      const session = JSON.parse(raw);
      if (session.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
    }
  } catch (e) {
    console.warn('Error reading session token:', e);
  }
  return headers;
}

async function handleResponse(res) {
  if (!res.ok) {
    let errorMsg = 'An unexpected error occurred';
    let data = {};
    try {
      data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch {
      errorMsg = (await res.text()) || res.statusText;
    }
    const err = new Error(errorMsg);
    err.status = res.status;
    err.data = data;
    if (data.existingCustomer) {
      err.existingCustomer = data.existingCustomer;
    }
    throw err;
  }
  return res.json();
}

export const api = {
  // Config
  getConfig: () => fetch(`${API_BASE}/config`, { headers: getAuthHeaders() }).then(handleResponse),

  // Customers
  searchCustomers: (query) =>
    fetch(`${API_BASE}/customers/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
  getCustomer: (id) =>
    fetch(`${API_BASE}/customers/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
  getCustomerStats: (id) =>
    fetch(`${API_BASE}/customers/${id}/stats`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
  createCustomer: (data) =>
    fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Soft-Delete & Recycle Bin
  softDeleteCustomer: (id) =>
    fetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then(handleResponse),
  restoreCustomer: (id) =>
    fetch(`${API_BASE}/customers/${id}/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }).then(handleResponse),
  permanentDeleteCustomer: (id) =>
    fetch(`${API_BASE}/customers/${id}/permanent`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).then(handleResponse),
  getDeletedCustomers: () =>
    fetch(`${API_BASE}/customers/deleted`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Entries (Purchases)
  addEntry: (data) =>
    fetch(`${API_BASE}/entries`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  getEntries: (customerId, page = 1, limit = 10) =>
    fetch(`${API_BASE}/entries?customer_id=${customerId}&page=${page}&limit=${limit}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
  getEntry: (id) =>
    fetch(`${API_BASE}/entries/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Payments (Due Clearances)
  recordPayment: (data) =>
    fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),
  getPayments: (customerId) =>
    fetch(`${API_BASE}/payments?customer_id=${customerId}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Medicines (Autocomplete)
  autocompleteMedicines: (query) =>
    fetch(`${API_BASE}/medicines/suggestions?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Reports
  getDuesReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${API_BASE}/reports/dues?${q}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
  },

  // Shop & Pharmacist Profile
  getShopProfile: () =>
    fetch(`${API_BASE}/shop-profile`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
  updateShopProfile: (data) =>
    fetch(`${API_BASE}/shop-profile`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Backups
  createBackup: (pin) =>
    fetch(`${API_BASE}/reports/backup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pin }),
    }).then(handleResponse),
  listBackups: (pin) =>
    fetch(`${API_BASE}/reports/backups?pin=${encodeURIComponent(pin)}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),
  restoreBackup: (filename, pin) =>
    fetch(`${API_BASE}/reports/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ filename, pin }),
    }).then(handleResponse),
  getCsvExportUrl: () => `${API_BASE}/reports/export/csv`,
};
