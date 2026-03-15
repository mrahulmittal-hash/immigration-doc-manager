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

    // ── Employers ────────────────────────────────────────────
    getEmployers: (search, status) => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      return request(`/employers?${p}`);
    },
    getEmployer: (id) => request(`/employers/${id}`),
    createEmployer: (data) => request('/employers', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployer: (id, data) => request(`/employers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployer: (id) => request(`/employers/${id}`, { method: 'DELETE' }),
    getEmployerClients: (id) => request(`/employers/${id}/clients`),
    linkClientToEmployer: (empId, data) => request(`/employers/${empId}/clients`, { method: 'POST', body: JSON.stringify(data) }),
    unlinkClientFromEmployer: (empId, clientId) => request(`/employers/${empId}/clients/${clientId}`, { method: 'DELETE' }),
    getEmployerFees: (id) => request(`/employers/${id}/fees`),
    createEmployerFee: (empId, data) => request(`/employers/${empId}/fees`, { method: 'POST', body: JSON.stringify(data) }),
    updateEmployerFee: (id, data) => request(`/employers/fees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployerFee: (id) => request(`/employers/fees/${id}`, { method: 'DELETE' }),

    // ── Retainers ────────────────────────────────────────────
    getRetainers: (status) => request(`/retainers${status ? `?status=${status}` : ''}`),
    getRetainerStats: () => request('/retainers-stats'),
    getClientRetainers: (clientId) => request(`/clients/${clientId}/retainers`),
    createRetainer: (clientId, data) => request(`/clients/${clientId}/retainers`, { method: 'POST', body: JSON.stringify(data) }),
    updateRetainer: (id, data) => request(`/retainers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRetainer: (id) => request(`/retainers/${id}`, { method: 'DELETE' }),
    getPayments: (retainerId) => request(`/retainers/${retainerId}/payments`),
    recordPayment: (retainerId, data) => request(`/retainers/${retainerId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
    deletePayment: (id) => request(`/payments/${id}`, { method: 'DELETE' }),

    // ── LMIA ─────────────────────────────────────────────────
    getLMIAs: (status, employerId) => {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (employerId) p.set('employer_id', employerId);
      return request(`/lmia?${p}`);
    },
    getLMIA: (id) => request(`/lmia/${id}`),
    createLMIA: (data) => request('/lmia', { method: 'POST', body: JSON.stringify(data) }),
    updateLMIA: (id, data) => request(`/lmia/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateLMIAStatus: (id, status) => request(`/lmia/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteLMIA: (id) => request(`/lmia/${id}`, { method: 'DELETE' }),
    getLMIAStats: () => request('/lmia/stats/summary'),
    getJobAds: (lmiaId) => request(`/lmia/${lmiaId}/ads`),
    createJobAd: (lmiaId, data) => request(`/lmia/${lmiaId}/ads`, { method: 'POST', body: JSON.stringify(data) }),
    updateJobAd: (id, data) => request(`/lmia/ads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteJobAd: (id) => request(`/lmia/ads/${id}`, { method: 'DELETE' }),

    // ── Dependents ─────────────────────────────────────────────
    getDependents: (clientId) => request(`/clients/${clientId}/dependents`),
    createDependent: (clientId, data) => request(`/clients/${clientId}/dependents`, { method: 'POST', body: JSON.stringify(data) }),
    updateDependent: (id, data) => request(`/dependents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDependent: (id) => request(`/dependents/${id}`, { method: 'DELETE' }),

    // ── Immigration Photos ─────────────────────────────────────
    getPhotos: (clientId) => request(`/clients/${clientId}/photos`),
    uploadPhoto: (clientId, file, personName, personType, dependentId, notes) => {
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('person_name', personName);
        formData.append('person_type', personType);
        if (dependentId) formData.append('dependent_id', dependentId);
        if (notes) formData.append('notes', notes);
        return fetch(`${API_BASE}/clients/${clientId}/photos`, {
            method: 'POST',
            body: formData,
        }).then(r => r.json());
    },
    getPhotoDownloadUrl: (id) => `${API_BASE}/photos/${id}/download`,
    updatePhoto: (id, data) => request(`/photos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePhoto: (id) => request(`/photos/${id}`, { method: 'DELETE' }),

    // ── Family Members ─────────────────────────────────────
    getFamilyMembers: (clientId) => request(`/clients/${clientId}/family`),
    addFamilyMember: (clientId, data) => request(`/clients/${clientId}/family`, { method: 'POST', body: JSON.stringify(data) }),
    updateFamilyMember: (id, data) => request(`/family/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFamilyMember: (id) => request(`/family/${id}`, { method: 'DELETE' }),

    // ── Tasks (DB-backed) ──────────────────────────────────
    getTasks: (filter, category) => {
      const p = new URLSearchParams();
      if (filter) p.set('filter', filter);
      if (category && category !== 'all') p.set('category', category);
      return request(`/tasks?${p}`);
    },
    getTodayTasks: () => request('/tasks/today'),
    createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleTask: (id) => request(`/tasks/${id}/toggle`, { method: 'PATCH' }),
    deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

    // ── Notifications ──────────────────────────────────────
    getNotifications: () => request('/notifications'),
    getNotificationCount: () => request('/notifications/count'),
    generateNotifications: () => request('/notifications/generate', { method: 'POST' }),
    markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
    dismissNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' }),

    // ── Dashboard Today ────────────────────────────────────
    getDashboardToday: () => request('/dashboard/today'),
};
