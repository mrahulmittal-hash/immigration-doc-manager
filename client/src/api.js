const API_BASE = 'http://localhost:5000/api';

async function request(url, options = {}) {
    const res = await fetch(`${API_BASE}${url}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

export const api = {
    // Stats
    getStats: () => request('/stats'),

    // Clients
    getClients: (search = '') => request(`/clients${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    getClient: (id) => request(`/clients/${id}`),
    createClient: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
    updateClient: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteClient: (id) => request(`/clients/${id}`, { method: 'DELETE' }),

    // Documents
    uploadDocuments: (clientId, files, category = 'general') => {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        formData.append('category', category);
        return fetch(`${API_BASE}/clients/${clientId}/documents`, {
            method: 'POST',
            body: formData,
        }).then(r => r.json());
    },
    getDocuments: (clientId) => request(`/clients/${clientId}/documents`),
    deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
    extractDocument: (id) => request(`/documents/${id}/extract`, { method: 'POST' }),
    extractAllDocuments: (clientId) => request(`/clients/${clientId}/documents/extract-all`, { method: 'POST' }),
    getDocumentDownloadUrl: (id) => `${API_BASE}/documents/${id}/download`,

    // Forms
    uploadForms: (clientId, files, formName = '') => {
        const formData = new FormData();
        files.forEach(f => formData.append('files', f));
        formData.append('form_name', formName);
        return fetch(`${API_BASE}/clients/${clientId}/forms`, {
            method: 'POST',
            body: formData,
        }).then(r => r.json());
    },
    getForms: (clientId) => request(`/clients/${clientId}/forms`),
    getFormFields: (id) => request(`/forms/${id}/fields`),
    fillForm: (id, mappings = {}) => request(`/forms/${id}/fill`, { method: 'POST', body: JSON.stringify({ mappings }) }),
    fillAllForms: (clientId) => request(`/clients/${clientId}/forms/fill-all`, { method: 'POST' }),
    deleteForm: (id) => request(`/forms/${id}`, { method: 'DELETE' }),
    getFilledFormDownloadUrl: (id) => `${API_BASE}/filled-forms/${id}/download`,

    // Client Data
    getClientData: (clientId) => request(`/clients/${clientId}/data`),
    updateClientData: (clientId, data) => request(`/clients/${clientId}/data`, { method: 'PUT', body: JSON.stringify({ data }) }),
    addClientData: (clientId, field_key, field_value) => request(`/clients/${clientId}/data/add`, { method: 'POST', body: JSON.stringify({ field_key, field_value }) }),
    deleteClientData: (id) => request(`/client-data/${id}`, { method: 'DELETE' }),

    // PIF
    sendPIFEmail: (clientId) => request(`/clients/${clientId}/send-pif`, { method: 'POST' }),
    getPIFData: (clientId) => request(`/pif/data/${clientId}`),
    verifyPIFData: (clientId) => request(`/pif/data/${clientId}/verify`, { method: 'POST' }),
};
