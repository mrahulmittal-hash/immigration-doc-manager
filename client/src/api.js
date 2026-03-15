const API_BASE = '/api';

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

    // Timeline
    getTimeline: (clientId) => request(`/clients/${clientId}/timeline`),
    addTimelineEvent: (clientId, data) => request(`/clients/${clientId}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
    getRecentTimeline: (limit = 10) => request(`/timeline/recent?limit=${limit}`),

    // Notes
    getNotes: (clientId) => request(`/clients/${clientId}/notes`),
    addNote: (clientId, content, author) => request(`/clients/${clientId}/notes`, { method: 'POST', body: JSON.stringify({ content, author }) }),
    updateNote: (id, data) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),

    // Deadlines
    getDeadlines: (clientId) => request(`/clients/${clientId}/deadlines`),
    addDeadline: (clientId, data) => request(`/clients/${clientId}/deadlines`, { method: 'POST', body: JSON.stringify(data) }),
    updateDeadline: (id, data) => request(`/deadlines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDeadline: (id) => request(`/deadlines/${id}`, { method: 'DELETE' }),
    getUpcomingDeadlines: () => request('/deadlines/upcoming'),

    // Checklists
    getChecklistTemplate: (visaType) => request(`/checklists/${encodeURIComponent(visaType)}`),
    getClientChecklist: (clientId) => request(`/clients/${clientId}/checklist`),
    updateChecklistItem: (id, data) => request(`/client-checklist/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    initClientChecklist: (clientId) => request(`/clients/${clientId}/checklist/init`, { method: 'POST' }),

    // Pipeline
    updateClientStage: (id, stage) => request(`/clients/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),

    // Emails
    getEmailStatus: () => request('/emails/status'),
    connectEmail: () => request('/emails/connect'),
    disconnectEmail: () => request('/emails/disconnect', { method: 'POST' }),
    syncEmails: () => request('/emails/sync', { method: 'POST' }),
    syncClientEmails: (clientId) => request(`/clients/${clientId}/emails/sync`, { method: 'POST' }),
    getClientEmails: (clientId) => request(`/clients/${clientId}/emails`),

    // IRCC Forms (Auto-generation)
    getIRCCFormTemplates: () => request('/ircc-forms/templates'),
    getClientIRCCForms: (clientId) => request(`/clients/${clientId}/ircc-forms`),
    generateIRCCForm: (clientId, formNumber) => request(`/clients/${clientId}/ircc-forms/generate`, { method: 'POST', body: JSON.stringify({ form_number: formNumber }) }),
    generateAllIRCCForms: (clientId) => request(`/clients/${clientId}/ircc-forms/generate-all`, { method: 'POST' }),

    // IRCC Updates
    getIRCCUpdates: (category, limit) => request(`/ircc-updates?${category ? `category=${category}&` : ''}limit=${limit || 50}`),
    triggerIRCCScrape: () => request('/ircc-updates/scrape', { method: 'POST' }),

    // PIF
    sendPIFEmail: (clientId) => request(`/clients/${clientId}/send-pif`, { method: 'POST' }),
    getPIFData: (clientId) => request(`/pif/data/${clientId}`),
    verifyPIFData: (clientId) => request(`/pif/data/${clientId}/verify`, { method: 'POST' }),
    updatePIFData: (clientId, formData) => request(`/pif/data/${clientId}`, { method: 'PUT', body: JSON.stringify({ form_data: formData }) }),
    getPIFOcrData: (clientId) => request(`/pif/data/${clientId}/ocr`),
};
