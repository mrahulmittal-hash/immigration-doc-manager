const API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = API_URL + '/api';
export { API_URL };

function getAuthHeaders() {
    const token = localStorage.getItem('crm_access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('crm_refresh_token');
    if (!refreshToken) return false;
    try {
        const res = await fetch(`${API_BASE}/users/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        localStorage.setItem('crm_access_token', data.accessToken);
        localStorage.setItem('crm_refresh_token', data.refreshToken);
        return true;
    } catch {
        return false;
    }
}

async function request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options.headers };
    let res = await fetch(`${API_BASE}${url}`, { ...options, headers });

    // On 401, try refreshing the token once
    if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            const retryHeaders = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...options.headers };
            res = await fetch(`${API_BASE}${url}`, { ...options, headers: retryHeaders });
        } else {
            localStorage.removeItem('crm_access_token');
            localStorage.removeItem('crm_refresh_token');
            localStorage.removeItem('crm_user');
            window.location.href = '/login';
            throw new Error('Session expired');
        }
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const error = new Error(err.error || 'Request failed');
        error.data = err;
        throw error;
    }
    return res.json();
}

function authenticatedFetch(url, options = {}) {
    return fetch(url, { ...options, headers: { ...getAuthHeaders(), ...options.headers } });
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
        return authenticatedFetch(`${API_BASE}/clients/${clientId}/documents`, {
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
        return authenticatedFetch(`${API_BASE}/clients/${clientId}/forms`, {
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

    // Filled Form Data (view/edit)
    getFilledFormData: (filledFormId) => request(`/ircc-forms/filled/${filledFormId}/data`),
    updateFilledFormData: (filledFormId, fields) => request(`/ircc-forms/filled/${filledFormId}/data`, { method: 'PUT', body: JSON.stringify({ fields }) }),

    // Custom form upload + auto-fill
    uploadAndFillForm: (clientId, formData) => {
      const token = localStorage.getItem('token');
      return fetch(`${BASE}/clients/${clientId}/ircc-forms/upload-and-fill`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData, // FormData — no Content-Type header (browser sets multipart boundary)
      }).then(r => r.json());
    },
    getClientCustomForms: (clientId) => request(`/clients/${clientId}/ircc-forms/custom`),

    // IRCC Updates
    getIRCCUpdates: (category, limit) => request(`/ircc-updates?${category ? `category=${category}&` : ''}limit=${limit || 50}`),
    triggerIRCCScrape: () => request('/ircc-updates/scrape', { method: 'POST' }),
    triggerIRCCBulletinScrape: () => request('/ircc-updates/scrape-bulletins', { method: 'POST' }),
    triggerIRCCScrapeAll: () => request('/ircc-updates/scrape-all', { method: 'POST' }),

    // PIF
    sendPIFEmail: (clientId) => request(`/clients/${clientId}/send-pif`, { method: 'POST' }),
    getPIFData: (clientId) => request(`/pif/data/${clientId}`),
    verifyPIFData: (clientId) => request(`/pif/data/${clientId}/verify`, { method: 'POST' }),
    updatePIFData: (clientId, formData) => request(`/pif/data/${clientId}`, { method: 'PUT', body: JSON.stringify({ form_data: formData }) }),
    getPIFOcrData: (clientId) => request(`/pif/data/${clientId}/ocr`),

    // OCR
    ocrDocument: (docId) => request(`/documents/${docId}/ocr`, { method: 'POST' }),
    confirmOcr: (docId, fields, updateClient) => request(`/documents/${docId}/ocr/confirm`, { method: 'POST', body: JSON.stringify({ fields, update_client: updateClient }) }),

    // Signatures
    getSignatures: (clientId) => request(`/clients/${clientId}/signatures`),
    createSignatureRequest: (clientId, data) => request(`/clients/${clientId}/signatures`, { method: 'POST', body: JSON.stringify(data) }),
    sendSignatureRequest: (clientId, sigId) => request(`/clients/${clientId}/signatures/${sigId}/send`, { method: 'POST' }),
    deleteSignatureRequest: (sigId) => request(`/signatures/${sigId}`, { method: 'DELETE' }),

    // Retainers
    getClientRetainers: (clientId) => request(`/clients/${clientId}/retainers`),
    createRetainer: (clientId, data) => request(`/clients/${clientId}/retainers`, { method: 'POST', body: JSON.stringify(data) }),
    updateRetainer: (id, data) => request(`/retainers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteRetainer: (id) => request(`/retainers/${id}`, { method: 'DELETE' }),
    getRetainerPayments: (retainerId) => request(`/retainers/${retainerId}/payments`),
    recordPayment: (retainerId, data) => request(`/retainers/${retainerId}/payments`, { method: 'POST', body: JSON.stringify(data) }),

    // Trust Accounting
    getAccountingSummary: () => request('/accounting/summary'),
    getClientTrust: (clientId) => request(`/clients/${clientId}/trust`),
    depositToTrust: (clientId, data) => request(`/clients/${clientId}/trust/deposit`, { method: 'POST', body: JSON.stringify(data) }),
    releaseFromTrust: (clientId, data) => request(`/clients/${clientId}/trust/release`, { method: 'POST', body: JSON.stringify(data) }),
    refundFromTrust: (clientId, data) => request(`/clients/${clientId}/trust/refund`, { method: 'POST', body: JSON.stringify(data) }),
    getClientInvoices: (clientId) => request(`/clients/${clientId}/invoices`),
    createInvoice: (clientId, data) => request(`/clients/${clientId}/invoices`, { method: 'POST', body: JSON.stringify(data) }),
    updateInvoice: (id, data) => request(`/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    getClientMilestones: (clientId) => request(`/clients/${clientId}/milestones`),
    createMilestones: (clientId, data) => request(`/clients/${clientId}/milestones`, { method: 'POST', body: JSON.stringify(data) }),
    releaseMilestone: (milestoneId) => request(`/milestones/${milestoneId}/release`, { method: 'POST' }),

    // Tasks
    getTasks: (filter, category, clientId) => request(`/tasks?filter=${filter || ''}&category=${category || ''}${clientId ? `&client_id=${clientId}` : ''}`),
    getTodayTasks: () => request('/tasks/today'),
    createTask: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleTask: (id) => request(`/tasks/${id}/toggle`, { method: 'PATCH' }),
    deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),

    // Calendar
    getCalendarEvents: () => request('/calendar/events'),

    // Dashboard
    getDashboardToday: () => request('/dashboard/today'),

    // IRCC Templates Management
    getIRCCTemplatesList: () => request('/ircc-templates'),
    getIRCCTemplatesByType: (visaType) => request(`/ircc-templates/${encodeURIComponent(visaType)}`),
    uploadIRCCTemplate: (formNumber, file, formName, visaType) => {
        const formData = new FormData();
        formData.append('file', file);
        if (formName) formData.append('form_name', formName);
        if (visaType) formData.append('visa_type', visaType);
        return authenticatedFetch(`${API_BASE}/ircc-templates/${encodeURIComponent(formNumber)}/upload`, {
            method: 'POST',
            body: formData,
        }).then(r => r.json());
    },
    downloadIRCCTemplate: (formNumber) => `${API_BASE}/ircc-templates/${encodeURIComponent(formNumber)}/download`,
    deleteIRCCTemplate: (formNumber) => request(`/ircc-templates/${encodeURIComponent(formNumber)}`, { method: 'DELETE' }),

    // IRCC Template Viewer/Editor
    getIRCCTemplateFields: (formNumber) => request(`/ircc-templates/${encodeURIComponent(formNumber)}/fields`),
    getIRCCTemplateFieldsForClient: (formNumber, clientId) => request(`/ircc-templates/${encodeURIComponent(formNumber)}/fields/${clientId}`),
    viewIRCCTemplate: (formNumber) => `${API_BASE}/ircc-templates/${encodeURIComponent(formNumber)}/view`,
    fillIRCCTemplate: (formNumber, fields) => {
        return authenticatedFetch(`${API_BASE}/ircc-templates/${encodeURIComponent(formNumber)}/fill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields }),
        }).then(r => {
            if (!r.ok) throw new Error('Failed to fill template');
            return r.blob();
        });
    },

    // Auth
    login: (email, password) => fetch(`${API_BASE}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    }).then(r => r.json().then(data => ({ ok: r.ok, ...data }))),

    register: (data) => request('/users/register', { method: 'POST', body: JSON.stringify(data) }),

    // PIF Verifications
    getPIFVerifications: (clientId) => request(`/pif/data/${clientId}/verifications`),
    verifyPIFField: (clientId, fieldKey, verified, comment) => request(`/pif/data/${clientId}/verify-field`, {
        method: 'PUT', body: JSON.stringify({ field_key: fieldKey, verified, comment })
    }),
    bulkVerifyPIFFields: (clientId, fields) => request(`/pif/data/${clientId}/verify-bulk`, {
        method: 'PUT', body: JSON.stringify({ fields })
    }),
    getPIFVerificationSummary: (clientId) => request(`/pif/data/${clientId}/verification-summary`),

    // PIF Re-verification
    sendPIFReverification: (clientId) => request(`/pif/data/${clientId}/send-reverification`, { method: 'POST' }),
    getPIFReverificationHistory: (clientId) => request(`/pif/data/${clientId}/reverification-history`),

    // Admin — Service Fees
    getServiceFees: () => request('/admin/service-fees'),
    getActiveServiceFees: () => request('/service-fees/active'),
    createServiceFee: (data) => request('/admin/service-fees', { method: 'POST', body: JSON.stringify(data) }),
    updateServiceFee: (id, data) => request(`/admin/service-fees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteServiceFee: (id) => request(`/admin/service-fees/${id}`, { method: 'DELETE' }),

    // Admin — Retainer Template
    getRetainerTemplate: () => request('/admin/retainer-template'),
    updateRetainerTemplateSection: (sectionNumber, data) => request(`/admin/retainer-template/${sectionNumber}`, { method: 'PUT', body: JSON.stringify(data) }),
    previewRetainerTemplate: () => request('/admin/retainer-template/preview', { method: 'POST' }),

    // Admin — Firm Profile
    getFirmProfile: () => request('/admin/firm-profile'),
    updateFirmProfile: (data) => request('/admin/firm-profile', { method: 'PUT', body: JSON.stringify(data) }),

    // Fee Adjustments
    getFeeAdjustments: (clientId) => request(`/clients/${clientId}/fee-adjustments`),
    createFeeAdjustment: (clientId, data) => request(`/clients/${clientId}/fee-adjustments`, { method: 'POST', body: JSON.stringify(data) }),
    deleteFeeAdjustment: (id) => request(`/fee-adjustments/${id}`, { method: 'DELETE' }),
    getRetainerAdjustedTotal: (retainerId) => request(`/retainers/${retainerId}/adjusted-total`),

    // Retainer Agreements
    generateRetainerAgreement: (clientId, data) => request(`/clients/${clientId}/retainer-agreement/generate`, { method: 'POST', body: JSON.stringify(data) }),
    getClientRetainerAgreements: (clientId) => request(`/clients/${clientId}/retainer-agreements`),
    getRetainerAgreement: (id) => request(`/retainer-agreements/${id}`),
    sendRetainerAgreementEmail: (id) => request(`/retainer-agreements/${id}/send-email`, { method: 'POST' }),
    sendAgreementForSigning: (id) => request(`/retainer-agreements/${id}/send-for-signing`, { method: 'POST' }),

    // Admin — Signing Settings
    getSigningSettings: () => request('/admin/signing-settings'),
    updateSigningSettings: (data) => request('/admin/signing-settings', { method: 'PUT', body: JSON.stringify(data) }),
    testSigningConnection: () => request('/admin/signing-settings/test', { method: 'POST' }),

    // Admin — Email Ingestion
    getEmailIngestionConfig: () => request('/admin/email-ingestion'),
    updateEmailIngestionConfig: (data) => request('/admin/email-ingestion', { method: 'PUT', body: JSON.stringify(data) }),
    testEmailIngestionConnection: (data) => request('/admin/email-ingestion/test', { method: 'POST', body: JSON.stringify(data) }),
    syncEmailIngestion: () => request('/admin/email-ingestion/sync', { method: 'POST' }),
    disconnectEmailIngestion: () => request('/admin/email-ingestion', { method: 'DELETE' }),

    // Audit
    getAuditLog: (clientId, params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/clients/${clientId}/audit${qs ? `?${qs}` : ''}`);
    },
    getRecentAudit: (limit = 20) => request(`/audit/recent?limit=${limit}`),
};
