import { useState, useMemo, useCallback, useEffect } from 'react';
import { api } from '../api';
import PDFRenderer from './PDFRenderer';
import { User, MapPin, BookOpen, Heart, Users, GraduationCap, Briefcase, Baby, UserPlus, Home, Plane, UsersRound, Languages, Scale, AlertTriangle, Check, CheckCircle, Square, ChevronLeft, ChevronRight, Paperclip, FileText, Eye, Pencil, Save, X, BarChart3, Shield, ShieldAlert, ShieldCheck, ArrowLeftRight, FileSearch, Loader2, MessageSquare, PanelRightClose, Plus, ChevronDown, ChevronUp, Send, Clock, History } from 'lucide-react';

const STEPS = [
    { id: 'personal', title: 'Personal Details', Icon: User, color: '#4f46e5' },
    { id: 'contact', title: 'Contact Information', Icon: MapPin, color: '#06b6d4' },
    { id: 'passport', title: 'Passport & ID', Icon: BookOpen, color: '#7c3aed' },
    { id: 'canada', title: 'Canada History & Visit', Icon: MapPin, color: '#0891b2' },
    { id: 'spouse', title: 'Spouse / Partner', Icon: Heart, color: '#e11d48' },
    { id: 'parents', title: 'Parents', Icon: Users, color: '#0d9488' },
    { id: 'education', title: 'Education & Occupation', Icon: GraduationCap, color: '#2563eb' },
    { id: 'work', title: 'Work History', Icon: Briefcase, color: '#ca8a04' },
    { id: 'children', title: 'Children', Icon: Baby, color: '#f97316' },
    { id: 'siblings', title: 'Siblings', Icon: UserPlus, color: '#059669' },
    { id: 'addresses', title: 'Address History', Icon: Home, color: '#7c3aed' },
    { id: 'travel', title: 'Travel History', Icon: Plane, color: '#0284c7' },
    { id: 'relatives', title: 'Relatives in Canada', Icon: UsersRound, color: '#dc2626' },
    { id: 'language', title: 'Language', Icon: Languages, color: '#4f46e5' },
    { id: 'background', title: 'Background', Icon: Shield, color: '#475569' },
    { id: 'declarations', title: 'Declarations & Consent', Icon: Scale, color: '#64748b' },
];

const ALL_FIELDS = {
    personal: ['firstName', 'lastName', 'aliasFamilyName', 'aliasGivenName', 'dob', 'placeOfBirth', 'countryOfBirth', 'nationality', 'countryOfResidence', 'residenceStatus', 'gender', 'nativeLanguage', 'eyeColour', 'height'],
    contact: ['email', 'phone', 'faxNumber', 'currentAddress', 'currentCity', 'currentProvince', 'currentPostalCode', 'currentCountry', 'residentialAddressSameAsMailing', 'residentialAddress', 'residentialCity', 'residentialProvince', 'residentialPostalCode', 'residentialCountry'],
    passport: ['passportNumber', 'passportIssueDate', 'passportExpiryDate', 'passportCountry', 'nationalIdentityNumber', 'maritalStatus', 'usCitizenOrPR', 'usVisaNumber', 'usVisaExpiryDate'],
    canada: ['appliedBefore', 'appliedBeforeDetails', 'refusedBefore', 'refusedBeforeDetails', 'medicalExamDone', 'medicalExamDetails', 'biometricsDone', 'firstEntryDate', 'placeOfEntry', 'lastEntryDate', 'lastEntryPlace', 'purposeOfVisit', 'stayDuration', 'intendedEntryDate', 'fundsAvailable', 'contactInCanadaName', 'contactInCanadaRelation', 'contactInCanadaAddress', 'contactInCanadaPhone', 'contactInCanadaEmail'],
    spouse: ['spouseMarriageDate', 'spouseFirstName', 'spouseLastName', 'spouseDob', 'spousePlaceOfBirth', 'spouseCountryOfBirth', 'spouseNationality', 'spousePassportNumber', 'spouseOccupation', 'spouseAddress', 'spouseEmail', 'previouslyMarried', 'prevMarriageDate', 'prevMarriageEndDate', 'prevSpouseFirstName', 'prevSpouseLastName', 'prevSpouseDob'],
    parents: ['motherFirstName', 'motherLastName', 'motherDob', 'motherDeathDate', 'motherPlaceOfBirth', 'motherCountryOfBirth', 'motherNationality', 'motherMaritalStatus', 'motherOccupation', 'motherAddress', 'fatherFirstName', 'fatherLastName', 'fatherDob', 'fatherDeathDate', 'fatherPlaceOfBirth', 'fatherCountryOfBirth', 'fatherNationality', 'fatherMaritalStatus', 'fatherOccupation', 'fatherAddress'],
    education: ['highestEducation', 'currentOccupation', 'currentEmployer', 'yearsInOccupation', 'intendedOccupation'],
    language: ['nativeLanguageAbility', 'englishAbility', 'frenchAbility', 'testType', 'ieltsListening', 'ieltsReading', 'ieltsWriting', 'ieltsSpeaking', 'ieltsOverall'],
    background: ['militaryService', 'militaryServiceDetails', 'politicalAssociation', 'politicalAssociationDetails', 'governmentPosition', 'governmentPositionDetails', 'removedFromCountry', 'removedDetails'],
    declarations: ['criminalHistory', 'criminalDetails', 'healthIssues', 'healthDetails', 'consent'],
};
const ARRAY_FIELDS = ['education', 'work', 'children', 'siblings', 'addresses', 'travel', 'relatives'];

function isFilled(val) {
    if (val === null || val === undefined || val === '') return false;
    if (typeof val === 'boolean') return true;
    return String(val).trim() !== '';
}

/* ── Field Card (View + Edit + Verification) ──────────── */
function FieldCard({ label, value, fieldKey, type, verificationStatus, verificationReason, editing, onChange, fieldVerification, onVerifyField, canVerify }) {
    const filled = isFilled(value);
    const displayVal = filled
        ? (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value))
        : '—';
    const isMismatch = verificationStatus === 'mismatch';
    const [showComment, setShowComment] = useState(false);
    const [comment, setComment] = useState(fieldVerification?.comment || '');

    const isVerified = fieldVerification?.verified === true;
    const isFlagged = !isVerified && fieldVerification?.comment;

    const borderColor = isVerified ? '#10b981' : isFlagged ? '#ef4444' : isMismatch ? 'var(--danger)' : undefined;

    return (
        <div className={`pv-field-card ${isMismatch ? 'pv-field-mismatch' : filled ? 'pv-field-filled' : 'pv-field-empty'}`}
            style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}>
            <div className="pv-field-label">
                <span>{label}</span>
                <div className="pv-field-actions">
                    {isVerified && <CheckCircle size={13} className="pv-field-status-icon verified" title="Verified" />}
                    {isFlagged && <ShieldAlert size={13} className="pv-field-status-icon flagged" title={`Flagged: ${fieldVerification.comment}`} />}
                    {canVerify && onVerifyField && (
                        <button className="pv-field-action-btn pv-hover-show"
                            onClick={() => onVerifyField(fieldKey, !isVerified, comment)}
                            title={isVerified ? 'Unverify' : 'Verify'}>
                            {isVerified
                                ? <CheckCircle size={14} style={{ color: '#10b981' }} />
                                : <Square size={14} />}
                        </button>
                    )}
                    {canVerify && (
                        <button className="pv-field-action-btn pv-hover-show"
                            onClick={() => setShowComment(!showComment)}
                            title="Add comment">
                            <MessageSquare size={13} style={{ color: fieldVerification?.comment ? '#f59e0b' : undefined }} />
                        </button>
                    )}
                </div>
            </div>

            {editing ? (
                <input
                    type={type === 'date' ? 'date' : 'text'}
                    className="pv-field-input"
                    value={value || ''}
                    onChange={e => onChange(fieldKey, e.target.value)}
                    placeholder={`Enter ${label.toLowerCase()}`}
                />
            ) : (
                <div className={`pv-field-value ${!filled ? 'empty' : ''} ${type === 'textarea' ? 'textarea' : ''}`}>
                    {displayVal}
                </div>
            )}

            {/* Verification comment */}
            {(showComment || (fieldVerification?.comment && !canVerify)) && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                    {canVerify ? (
                        <>
                            <input
                                type="text"
                                className="pv-field-input"
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Add verification comment..."
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onBlur={() => {
                                    if (comment !== (fieldVerification?.comment || '')) {
                                        onVerifyField(fieldKey, isVerified, comment);
                                    }
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        onVerifyField(fieldKey, isVerified, comment);
                                        setShowComment(false);
                                    }
                                }}
                            />
                        </>
                    ) : (
                        <div style={{ fontSize: 11, color: isFlagged ? '#ef4444' : '#6b7280', fontStyle: 'italic' }}>
                            {fieldVerification?.verified_by_name && <strong>{fieldVerification.verified_by_name}: </strong>}
                            {fieldVerification?.comment}
                        </div>
                    )}
                </div>
            )}

            {isMismatch && !editing && (
                <div className="pv-field-error">
                    <AlertTriangle size={11} /> {verificationReason}
                </div>
            )}
        </div>
    );
}

function RadioChips({ label, value, options, fieldKey, editing, onChange }) {
    const filled = isFilled(value);
    return (
        <div className={`pv-radio-card ${filled ? 'pv-radio-filled' : 'pv-radio-empty'}`} style={{ gridColumn: '1 / -1' }}>
            <div className="pv-radio-question">
                <span className="pv-radio-icon-wrap">
                    {filled ? <CheckCircle size={16} className="pv-radio-check-icon" /> : <Square size={16} className="pv-radio-square-icon" />}
                </span>
                <span className="pv-radio-label">{label}</span>
            </div>
            <div className="pv-radio-options">
                {options.map(o => {
                    const isSelected = value === o;
                    const isYes = o === 'Yes';
                    return (
                        <button key={o}
                            className={`pv-radio-btn ${isSelected ? 'selected' : ''} ${isSelected && isYes ? 'yes' : ''} ${isSelected && !isYes ? 'no' : ''}`}
                            onClick={editing ? () => onChange(fieldKey, o) : undefined}
                            disabled={!editing}
                            type="button">
                            {isSelected ? <Check size={13} strokeWidth={3} /> : null}
                            <span>{o}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function SectionDivider({ title, icon: Icon }) {
    return (
        <div className="pv-section-divider">
            {Icon && <Icon size={15} />}
            <span>{title}</span>
        </div>
    );
}

/* ── Array Section ──────────────────────────────────────── */
function ArraySection({ sectionKey, rows, fields, label, optional, getVerifyProps, editing, onRowChange }) {
    const items = rows || [];
    if (items.length === 0) {
        return (
            <div className="pv-empty-section">
                <div className="pv-empty-icon">📋</div>
                <div className="pv-empty-text">{optional ? `No ${label.toLowerCase()}s were added by the client.` : `No ${label.toLowerCase()} entries added.`}</div>
            </div>
        );
    }
    return (
        <div className="pv-array-list">
            {items.map((row, i) => {
                const filledCount = fields.filter(f => isFilled(row[f.key])).length;
                const pct = Math.round((filledCount / fields.length) * 100);
                return (
                    <div key={i} className="pv-array-card">
                        <div className="pv-array-header">
                            <div className="pv-array-badge">{label} #{i + 1}</div>
                            <div className="pv-array-meter">
                                <div className="pv-array-meter-bar">
                                    <div className="pv-array-meter-fill" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="pv-array-meter-text">{filledCount}/{fields.length}</span>
                            </div>
                        </div>
                        <div className="pv-grid pv-array-grid">
                            {fields.map(f => (
                                <div key={f.key} className={f.full ? 'pv-span-full' : ''}>
                                    <FieldCard
                                        label={f.label} value={row[f.key]} fieldKey={f.key}
                                        editing={editing}
                                        onChange={(key, val) => onRowChange(sectionKey, i, key, val)}
                                        {...(getVerifyProps(sectionKey, f.key, true, i))}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ════════════════════════════════════════════════════════════
   Main PIFViewer Component
   ════════════════════════════════════════════════════════════ */
export default function PIFViewer({ data, verificationResults, clientDocuments, clientId, onDataSaved, userRole }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [editing, setEditing] = useState(true);
    const [editData, setEditData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState('form'); // 'form' | 'compare'
    const [fieldVerifications, setFieldVerifications] = useState({});

    const [selectedDocId, setSelectedDocId] = useState(null);
    const [showDocPanel, setShowDocPanel] = useState(false);
    const [reverifyHistory, setReverifyHistory] = useState([]);
    const [showReverifyHistory, setShowReverifyHistory] = useState(false);
    const [sendingReverify, setSendingReverify] = useState(false);
    const [pendingReverifyId, setPendingReverifyId] = useState(null);
    const [saveResult, setSaveResult] = useState(null);

    const canVerify = !userRole || userRole === 'Admin' || userRole === 'Case Manager';

    // Load field verifications
    useEffect(() => {
        if (clientId) {
            api.getPIFVerifications(clientId).then(setFieldVerifications).catch(() => {});
            api.getPIFReverificationHistory(clientId).then(rows => {
                setReverifyHistory(rows || []);
                const pending = (rows || []).find(r => r.status === 'pending');
                if (pending) setPendingReverifyId(pending.id);
            }).catch(() => {});
        }
    }, [clientId]);

    const handleVerifyField = async (fieldKey, verified, comment) => {
        try {
            await api.verifyPIFField(clientId, fieldKey, verified, comment);
            setFieldVerifications(prev => ({
                ...prev,
                [fieldKey]: { ...prev[fieldKey], verified, comment, verified_by_name: 'You', verified_at: new Date().toISOString() }
            }));
        } catch (err) {
            console.error('Failed to verify field:', err);
        }
    };

    const handleVerifyAllInSection = async (sectionKey) => {
        const fields = ALL_FIELDS[sectionKey];
        if (!fields) return;
        const bulkFields = fields.map(f => ({ field_key: `${sectionKey}.${f}`, verified: true, comment: '' }));
        try {
            await api.bulkVerifyPIFFields(clientId, bulkFields);
            const updated = { ...fieldVerifications };
            bulkFields.forEach(f => { updated[f.field_key] = { verified: true, comment: '', verified_by_name: 'You' }; });
            setFieldVerifications(updated);
        } catch (err) {
            console.error('Failed to bulk verify:', err);
        }
    };


    // Verification progress
    const verificationProgress = useMemo(() => {
        const keys = Object.keys(fieldVerifications);
        if (keys.length === 0) return { verified: 0, total: 0, pct: 0 };
        const verified = keys.filter(k => fieldVerifications[k]?.verified).length;
        return { verified, total: keys.length, pct: Math.round((verified / keys.length) * 100) };
    }, [fieldVerifications]);

    // Initialize editData when data loads and editing is true by default
    useEffect(() => {
        if (editing && data && !editData) {
            setEditData(JSON.parse(JSON.stringify(data)));
        }
    }, [data, editing]);

    const d = editing ? (editData || data || {}) : (data || {});

    // Start editing
    const startEdit = () => {
        setEditData(JSON.parse(JSON.stringify(data || {})));
        setEditing(true);
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditData(null);
        setEditing(false);
    };

    // Save edits
    const saveEdits = async () => {
        if (!clientId || !editData) return;
        setSaving(true);
        setSaveResult(null);
        try {
            const result = await api.updatePIFData(clientId, editData);
            setEditing(false);
            setEditData(null);
            if (onDataSaved) onDataSaved(editData);
            if (result.changes_detected) {
                setPendingReverifyId(result.reverification_id);
                setSaveResult({ changed: result.changed_count, reverificationId: result.reverification_id });
                // Refresh history
                api.getPIFReverificationHistory(clientId).then(rows => setReverifyHistory(rows || [])).catch(() => {});
            }
        } catch (e) {
            console.error('Failed to save PIF edits:', e);
            alert('Failed to save changes. Please try again.');
        }
        setSaving(false);
    };

    // Send re-verification request
    const sendReverification = async () => {
        if (!clientId) return;
        setSendingReverify(true);
        try {
            const result = await api.sendPIFReverification(clientId);
            alert(result.message || 'Re-verification request sent!');
            setPendingReverifyId(null);
            setSaveResult(null);
            // Refresh history
            api.getPIFReverificationHistory(clientId).then(rows => setReverifyHistory(rows || [])).catch(() => {});
        } catch (e) {
            console.error('Failed to send re-verification:', e);
            alert('Failed to send re-verification request.');
        }
        setSendingReverify(false);
    };

    // Update a scalar field
    const setField = useCallback((key, val) => {
        setEditData(prev => ({ ...prev, [key]: val }));
    }, []);

    // Update an array row field
    const setRowField = useCallback((sectionKey, rowIdx, fieldKey, val) => {
        setEditData(prev => {
            const arr = [...(prev[sectionKey] || [])];
            arr[rowIdx] = { ...arr[rowIdx], [fieldKey]: val };
            return { ...prev, [sectionKey]: arr };
        });
    }, []);

    // Section stats
    const getSectionStats = (stepId) => {
        if (ALL_FIELDS[stepId]) {
            const fields = ALL_FIELDS[stepId];
            const filled = fields.filter(f => isFilled(d[f])).length;
            return { filled, total: fields.length };
        }
        if (ARRAY_FIELDS.includes(stepId)) {
            const rows = d[stepId] || [];
            return { filled: rows.length, total: rows.length, isArray: true };
        }
        return { filled: 0, total: 0 };
    };

    const { stats, progress } = useMemo(() => {
        let filled = 0, total = 0;
        Object.keys(ALL_FIELDS).forEach(k => {
            ALL_FIELDS[k].forEach(f => { total++; if (isFilled(d[f])) filled++; });
        });
        ARRAY_FIELDS.forEach(k => {
            (d[k] || []).forEach(row => {
                Object.values(row).forEach(v => { total++; if (isFilled(v)) filled++; });
            });
        });
        return { stats: { filled, total }, progress: total > 0 ? Math.round((filled / total) * 100) : 0 };
    }, [d]);

    const getVerifyProps = (sectionId, fieldKey, isArray = false, arrayIdx = 0) => {
        const props = {};

        // Mismatch verification
        if (verificationResults && verificationResults[sectionId]) {
            const vr = verificationResults[sectionId];
            if (vr.status === 'mismatch') {
                const searchKey = isArray ? `${fieldKey} (Row ${arrayIdx + 1})` : fieldKey;
                const mismatch = vr.mismatches.find(m => m.field === searchKey);
                if (mismatch) {
                    props.verificationStatus = 'mismatch';
                    props.verificationReason = mismatch.reason;
                }
            }
        }

        // Per-field verification status
        const verifyKey = isArray ? `${sectionId}.${arrayIdx}.${fieldKey}` : `${sectionId}.${fieldKey}`;
        props.fieldVerification = fieldVerifications[verifyKey] || null;
        props.canVerify = canVerify;
        props.onVerifyField = (fk, verified, comment) => handleVerifyField(verifyKey, verified, comment);

        return props;
    };

    const sectionDocs = useMemo(() => {
        return (clientDocuments || []).filter(doc => doc.category === STEPS[currentStep].id && doc.source === 'pif-upload');
    }, [clientDocuments, currentStep]);

    const renderStep = () => {
        const step = STEPS[currentStep];
        const fieldProps = (key, opts = {}) => ({
            label: opts.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
            value: d[key], fieldKey: key,
            editing, onChange: setField,
            ...getVerifyProps(step.id, key),
            ...opts,
        });

        switch (step.id) {
            case 'personal': return (
                <div className="pv-grid">
                    <FieldCard {...fieldProps('firstName', { label: 'First / Given Name(s)' })} />
                    <FieldCard {...fieldProps('lastName', { label: 'Last / Family Name' })} />
                    <FieldCard {...fieldProps('aliasFamilyName', { label: 'Alias / Former Family Name' })} />
                    <FieldCard {...fieldProps('aliasGivenName', { label: 'Alias / Former Given Name' })} />
                    <FieldCard {...fieldProps('dob', { label: 'Date of Birth', type: 'date' })} />
                    <FieldCard {...fieldProps('placeOfBirth', { label: 'City / Place of Birth' })} />
                    <FieldCard {...fieldProps('countryOfBirth', { label: 'Country of Birth' })} />
                    <FieldCard {...fieldProps('nationality', { label: 'Nationality / Citizenship' })} />
                    <FieldCard {...fieldProps('countryOfResidence', { label: 'Country of Residence' })} />
                    <FieldCard {...fieldProps('residenceStatus', { label: 'Immigration Status' })} />
                    <FieldCard {...fieldProps('gender', { label: 'Gender / Sex' })} />
                    <FieldCard {...fieldProps('nativeLanguage', { label: 'Native Language' })} />
                    <FieldCard {...fieldProps('eyeColour', { label: 'Eye Colour' })} />
                    <FieldCard {...fieldProps('height', { label: 'Height (cm)' })} />
                </div>
            );
            case 'contact': return (
                <div>
                    <SectionDivider title="Primary Contact" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('email', { label: 'Email Address' })} />
                        <FieldCard {...fieldProps('phone', { label: 'Phone Number' })} />
                        <FieldCard {...fieldProps('faxNumber', { label: 'Fax Number' })} />
                    </div>
                    <SectionDivider title="Current Mailing Address" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('currentAddress', { label: 'Street Address' })} />
                        <FieldCard {...fieldProps('currentCity', { label: 'City' })} />
                        <FieldCard {...fieldProps('currentProvince', { label: 'Province / State' })} />
                        <FieldCard {...fieldProps('currentPostalCode', { label: 'Postal / ZIP Code' })} />
                        <FieldCard {...fieldProps('currentCountry', { label: 'Country' })} />
                    </div>
                    <SectionDivider title="Residential Address" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('residentialAddressSameAsMailing', { label: 'Same as Mailing?' })} />
                        {d.residentialAddressSameAsMailing === 'No' && <>
                            <FieldCard {...fieldProps('residentialAddress', { label: 'Street Address' })} />
                            <FieldCard {...fieldProps('residentialCity', { label: 'City' })} />
                            <FieldCard {...fieldProps('residentialProvince', { label: 'Province / State' })} />
                            <FieldCard {...fieldProps('residentialPostalCode', { label: 'Postal / ZIP Code' })} />
                            <FieldCard {...fieldProps('residentialCountry', { label: 'Country' })} />
                        </>}
                    </div>
                </div>
            );
            case 'passport': return (
                <div className="pv-grid">
                    <FieldCard {...fieldProps('passportNumber', { label: 'Passport Number' })} />
                    <FieldCard {...fieldProps('passportCountry', { label: 'Country of Issue' })} />
                    <FieldCard {...fieldProps('passportIssueDate', { label: 'Issue Date' })} />
                    <FieldCard {...fieldProps('passportExpiryDate', { label: 'Expiry Date' })} />
                    <FieldCard {...fieldProps('nationalIdentityNumber', { label: 'National Identity Doc No.' })} />
                    <FieldCard {...fieldProps('maritalStatus', { label: 'Marital Status' })} />
                    <RadioChips label="US Citizen or Permanent Resident?" value={d.usCitizenOrPR} options={['Yes', 'No']} fieldKey="usCitizenOrPR" editing={editing} onChange={setField} />
                    {d.usCitizenOrPR === 'Yes' && <>
                        <FieldCard {...fieldProps('usVisaNumber', { label: 'US Visa / Green Card Number' })} />
                        <FieldCard {...fieldProps('usVisaExpiryDate', { label: 'US Visa Expiry Date' })} />
                    </>}
                </div>
            );
            case 'canada': return (
                <div>
                    <SectionDivider title="Previous Applications & Entry" />
                    <div className="pv-grid">
                        <RadioChips label="Have you applied to Canada before?" value={d.appliedBefore} options={['Yes', 'No']} fieldKey="appliedBefore" editing={editing} onChange={setField} />
                        {d.appliedBefore === 'Yes' && <FieldCard {...fieldProps('appliedBeforeDetails', { label: 'Details of previous application', type: 'textarea' })} />}
                        <RadioChips label="Have you ever been refused a visa/permit?" value={d.refusedBefore} options={['Yes', 'No']} fieldKey="refusedBefore" editing={editing} onChange={setField} />
                        {d.refusedBefore === 'Yes' && <FieldCard {...fieldProps('refusedBeforeDetails', { label: 'Details of refusal', type: 'textarea' })} />}
                        <RadioChips label="Medical exam done (last 12 months)?" value={d.medicalExamDone} options={['Yes', 'No']} fieldKey="medicalExamDone" editing={editing} onChange={setField} />
                        {d.medicalExamDone === 'Yes' && <FieldCard {...fieldProps('medicalExamDetails', { label: 'Medical exam details' })} />}
                        <RadioChips label="Have you done your biometrics?" value={d.biometricsDone} options={['Yes', 'No']} fieldKey="biometricsDone" editing={editing} onChange={setField} />
                    </div>
                    <SectionDivider title="Previous Entries to Canada" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('firstEntryDate', { label: 'First Entry Date' })} />
                        <FieldCard {...fieldProps('placeOfEntry', { label: 'Place of First Entry' })} />
                        <FieldCard {...fieldProps('lastEntryDate', { label: 'Last Entry Date' })} />
                        <FieldCard {...fieldProps('lastEntryPlace', { label: 'Last Entry Place' })} />
                    </div>
                    <SectionDivider title="Details of This Visit" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('purposeOfVisit', { label: 'Purpose of Visit' })} />
                        <FieldCard {...fieldProps('stayDuration', { label: 'How Long to Stay' })} />
                        <FieldCard {...fieldProps('intendedEntryDate', { label: 'Intended Entry Date' })} />
                        <FieldCard {...fieldProps('fundsAvailable', { label: 'Funds Available (CAD)' })} />
                    </div>
                    <SectionDivider title="Contact Person in Canada" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('contactInCanadaName', { label: 'Name' })} />
                        <FieldCard {...fieldProps('contactInCanadaRelation', { label: 'Relationship' })} />
                        <FieldCard {...fieldProps('contactInCanadaAddress', { label: 'Address in Canada' })} />
                        <FieldCard {...fieldProps('contactInCanadaPhone', { label: 'Phone' })} />
                        <FieldCard {...fieldProps('contactInCanadaEmail', { label: 'Email' })} />
                    </div>
                </div>
            );
            case 'spouse': return d.maritalStatus === 'Single' ? (
                <div className="pv-empty-section"><div className="pv-empty-icon">💍</div><div className="pv-empty-text">Client selected "Single" — this section was skipped.</div></div>
            ) : (
                <div>
                    <SectionDivider title="Current Spouse / Partner" icon={Heart} />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('spouseMarriageDate', { label: 'Date of Marriage' })} />
                        <FieldCard {...fieldProps('spouseFirstName', { label: 'First Name' })} />
                        <FieldCard {...fieldProps('spouseLastName', { label: 'Last Name' })} />
                        <FieldCard {...fieldProps('spouseDob', { label: 'Date of Birth' })} />
                        <FieldCard {...fieldProps('spousePlaceOfBirth', { label: 'Place of Birth' })} />
                        <FieldCard {...fieldProps('spouseCountryOfBirth', { label: 'Country of Birth' })} />
                        <FieldCard {...fieldProps('spouseNationality', { label: 'Nationality' })} />
                        <FieldCard {...fieldProps('spousePassportNumber', { label: 'Passport Number' })} />
                        <FieldCard {...fieldProps('spouseOccupation', { label: 'Occupation' })} />
                        <FieldCard {...fieldProps('spouseEmail', { label: 'Email' })} />
                        <FieldCard {...fieldProps('spouseAddress', { label: 'Current Address' })} />
                    </div>
                    <SectionDivider title="Previous Marriage" />
                    <RadioChips label="Were you previously married?" value={d.previouslyMarried} options={['Yes', 'No']} fieldKey="previouslyMarried" editing={editing} onChange={setField} />
                    {d.previouslyMarried === 'Yes' && (
                        <div className="pv-grid" style={{ marginTop: 12 }}>
                            <FieldCard {...fieldProps('prevMarriageDate', { label: 'Date of Marriage' })} />
                            <FieldCard {...fieldProps('prevMarriageEndDate', { label: 'End Date' })} />
                            <FieldCard {...fieldProps('prevSpouseFirstName', { label: 'First Name' })} />
                            <FieldCard {...fieldProps('prevSpouseLastName', { label: 'Last Name' })} />
                            <FieldCard {...fieldProps('prevSpouseDob', { label: 'Date of Birth' })} />
                        </div>
                    )}
                </div>
            );
            case 'parents': return (
                <div>
                    <SectionDivider title="Mother's Details" icon={Users} />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('motherFirstName', { label: 'First Name' })} />
                        <FieldCard {...fieldProps('motherLastName', { label: 'Last Name' })} />
                        <FieldCard {...fieldProps('motherDob', { label: 'Date of Birth' })} />
                        <FieldCard {...fieldProps('motherDeathDate', { label: 'Death Date' })} />
                        <FieldCard {...fieldProps('motherPlaceOfBirth', { label: 'Place of Birth' })} />
                        <FieldCard {...fieldProps('motherCountryOfBirth', { label: 'Country of Birth' })} />
                        <FieldCard {...fieldProps('motherNationality', { label: 'Nationality / Citizenship' })} />
                        <FieldCard {...fieldProps('motherMaritalStatus', { label: 'Marital Status' })} />
                        <FieldCard {...fieldProps('motherOccupation', { label: 'Occupation' })} />
                        <FieldCard {...fieldProps('motherAddress', { label: 'Current Address & Email' })} />
                    </div>
                    <SectionDivider title="Father's Details" icon={Users} />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('fatherFirstName', { label: 'First Name' })} />
                        <FieldCard {...fieldProps('fatherLastName', { label: 'Last Name' })} />
                        <FieldCard {...fieldProps('fatherDob', { label: 'Date of Birth' })} />
                        <FieldCard {...fieldProps('fatherDeathDate', { label: 'Death Date' })} />
                        <FieldCard {...fieldProps('fatherPlaceOfBirth', { label: 'Place of Birth' })} />
                        <FieldCard {...fieldProps('fatherCountryOfBirth', { label: 'Country of Birth' })} />
                        <FieldCard {...fieldProps('fatherNationality', { label: 'Nationality / Citizenship' })} />
                        <FieldCard {...fieldProps('fatherMaritalStatus', { label: 'Marital Status' })} />
                        <FieldCard {...fieldProps('fatherOccupation', { label: 'Occupation' })} />
                        <FieldCard {...fieldProps('fatherAddress', { label: 'Current Address & Email' })} />
                    </div>
                </div>
            );
            case 'education': return (
                <div>
                    <SectionDivider title="Current Education & Occupation" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('highestEducation', { label: 'Highest Level of Education' })} />
                        <FieldCard {...fieldProps('currentOccupation', { label: 'Current Occupation' })} />
                        <FieldCard {...fieldProps('currentEmployer', { label: 'Current Employer' })} />
                        <FieldCard {...fieldProps('yearsInOccupation', { label: 'Years in Occupation' })} />
                        <FieldCard {...fieldProps('intendedOccupation', { label: 'Intended Occupation in Canada' })} />
                    </div>
                    <SectionDivider title="Education History" />
                    <ArraySection sectionKey="education" rows={d.education} fields={[
                        { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                        { key: 'institute', label: 'Institute' }, { key: 'city', label: 'City' },
                        { key: 'country', label: 'Country' }, { key: 'field', label: 'Field of Study' },
                        { key: 'degree', label: 'Degree / Diploma' }
                    ]} label="Education" getVerifyProps={getVerifyProps} editing={editing} onRowChange={setRowField} />
                </div>
            );
            case 'work': return <ArraySection sectionKey="work" rows={d.work} fields={[
                { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                { key: 'jobTitle', label: 'Job Title' }, { key: 'city', label: 'City' },
                { key: 'country', label: 'Country' }, { key: 'companyName', label: 'Company Name' }
            ]} label="Work / Activity" getVerifyProps={getVerifyProps} editing={editing} onRowChange={setRowField} />;
            case 'children': return <ArraySection sectionKey="children" rows={d.children} fields={[
                { key: 'firstName', label: 'First Name' }, { key: 'lastName', label: 'Last Name' },
                { key: 'relation', label: 'Son / Daughter' }, { key: 'dob', label: 'Date of Birth' },
                { key: 'placeOfBirth', label: 'Place of Birth' }, { key: 'maritalStatus', label: 'Marital Status' },
                { key: 'occupation', label: 'Occupation' }, { key: 'eyeColour', label: 'Eye Colour' },
                { key: 'height', label: 'Height' }, { key: 'currentAddress', label: 'Current Address', full: true }
            ]} label="Child" optional getVerifyProps={getVerifyProps} editing={editing} onRowChange={setRowField} />;
            case 'siblings': return <ArraySection sectionKey="siblings" rows={d.siblings} fields={[
                { key: 'name', label: 'Full Name' }, { key: 'relation', label: 'Relation' },
                { key: 'dob', label: 'Date of Birth' }, { key: 'placeOfBirth', label: 'Place of Birth' },
                { key: 'maritalStatus', label: 'Marital Status' }, { key: 'occupation', label: 'Occupation' },
                { key: 'addressEmail', label: 'Address & Email', full: true }
            ]} label="Sibling" optional getVerifyProps={getVerifyProps} editing={editing} onRowChange={setRowField} />;
            case 'addresses': return <ArraySection sectionKey="addresses" rows={d.addresses} fields={[
                { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                { key: 'address', label: 'Address with Postal Code', full: true },
                { key: 'cityState', label: 'City / State' }, { key: 'country', label: 'Country' }, { key: 'activity', label: 'Activity' }
            ]} label="Address" getVerifyProps={getVerifyProps} editing={editing} onRowChange={setRowField} />;
            case 'travel': return <ArraySection sectionKey="travel" rows={d.travel} fields={[
                { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                { key: 'place', label: 'Place (City, Country)' }, { key: 'purpose', label: 'Purpose of Travel' }
            ]} label="Trip" optional getVerifyProps={getVerifyProps} editing={editing} onRowChange={setRowField} />;
            case 'relatives': return <ArraySection sectionKey="relatives" rows={d.relatives} fields={[
                { key: 'firstName', label: 'First Name' }, { key: 'lastName', label: 'Last Name' },
                { key: 'city', label: 'City' }, { key: 'relation', label: 'Relation' },
                { key: 'phone', label: 'Phone Number' }, { key: 'email', label: 'Email' },
                { key: 'yearsInCanada', label: 'Years in Canada' }, { key: 'immigrationStatus', label: 'Immigration Status' }
            ]} label="Relative" optional getVerifyProps={getVerifyProps} editing={editing} onRowChange={setRowField} />;
            case 'language': return (
                <div>
                    <SectionDivider title="Language Abilities" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('nativeLanguageAbility', { label: 'Native Language' })} />
                        <FieldCard {...fieldProps('englishAbility', { label: 'English Ability' })} />
                        <FieldCard {...fieldProps('frenchAbility', { label: 'French Ability' })} />
                    </div>
                    <SectionDivider title="Language Test Scores" />
                    <div className="pv-grid">
                        <FieldCard {...fieldProps('testType', { label: 'Test Type' })} />
                        <FieldCard {...fieldProps('ieltsListening', { label: 'Listening' })} />
                        <FieldCard {...fieldProps('ieltsReading', { label: 'Reading' })} />
                        <FieldCard {...fieldProps('ieltsWriting', { label: 'Writing' })} />
                        <FieldCard {...fieldProps('ieltsSpeaking', { label: 'Speaking' })} />
                        <FieldCard {...fieldProps('ieltsOverall', { label: 'Overall' })} />
                    </div>
                </div>
            );
            case 'background': return (
                <div className="pv-grid">
                    <RadioChips label="a) Military / militia / civil defence service?" value={d.militaryService} options={['Yes', 'No']} fieldKey="militaryService" editing={editing} onChange={setField} />
                    {d.militaryService === 'Yes' && <FieldCard {...fieldProps('militaryServiceDetails', { label: 'Military service details', type: 'textarea' })} />}
                    <RadioChips label="b) Political party or organization?" value={d.politicalAssociation} options={['Yes', 'No']} fieldKey="politicalAssociation" editing={editing} onChange={setField} />
                    {d.politicalAssociation === 'Yes' && <FieldCard {...fieldProps('politicalAssociationDetails', { label: 'Association details', type: 'textarea' })} />}
                    <RadioChips label="c) Government position held?" value={d.governmentPosition} options={['Yes', 'No']} fieldKey="governmentPosition" editing={editing} onChange={setField} />
                    {d.governmentPosition === 'Yes' && <FieldCard {...fieldProps('governmentPositionDetails', { label: 'Position details', type: 'textarea' })} />}
                    <RadioChips label="d) Detained, incarcerated, or deported?" value={d.removedFromCountry} options={['Yes', 'No']} fieldKey="removedFromCountry" editing={editing} onChange={setField} />
                    {d.removedFromCountry === 'Yes' && <FieldCard {...fieldProps('removedDetails', { label: 'Removal details', type: 'textarea' })} />}
                </div>
            );
            case 'declarations': return (
                <div>
                    <div className="pv-declarations-box">
                        <RadioChips label="e) Criminal history / charges?" value={d.criminalHistory} options={['Yes', 'No']} fieldKey="criminalHistory" editing={editing} onChange={setField} />
                        {d.criminalHistory === 'Yes' && <FieldCard {...fieldProps('criminalDetails', { label: 'Details', type: 'textarea' })} />}
                        <div style={{ marginTop: 12 }} />
                        <RadioChips label="f) Disease or physical/mental disorder?" value={d.healthIssues} options={['Yes', 'No']} fieldKey="healthIssues" editing={editing} onChange={setField} />
                        {d.healthIssues === 'Yes' && <FieldCard {...fieldProps('healthDetails', { label: 'Details', type: 'textarea' })} />}
                    </div>
                    <div className={`pv-consent-card ${d.consent ? 'agreed' : 'pending'}`}>
                        <span className="pv-consent-icon">{d.consent ? <CheckCircle size={22} /> : <Square size={22} />}</span>
                        <div>
                            <div className="pv-consent-title">{d.consent ? 'Consent Provided' : 'Consent Pending'}</div>
                            <div className="pv-consent-desc">{d.consent ? 'Client has agreed to the declaration and consented to information sharing.' : 'Client has NOT provided consent yet.'}</div>
                        </div>
                    </div>
                    {editing && (
                        <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: 13, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Shield size={14} /> Consent must be provided by the client directly. Use "Request Re-verification" to ask the client to review and re-consent.
                        </div>
                    )}
                </div>
            );
            default: return null;
        }
    };

    const step = STEPS[currentStep];
    const sStats = getSectionStats(step.id);
    const sectionPct = sStats.total > 0 ? Math.round((sStats.filled / sStats.total) * 100) : 0;
    const verifyStatus = verificationResults?.[step.id]?.status;

    const pdfDocs = (clientDocuments || []).filter(d => d.original_name.toLowerCase().endsWith('.pdf'));

    return (
        <div>
            {/* Verification Progress Bar */}
            {verificationProgress.total > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 12,
                    background: verificationProgress.pct === 100 ? 'rgba(16,185,129,.08)' : 'rgba(99,102,241,.06)',
                    border: `1px solid ${verificationProgress.pct === 100 ? 'rgba(16,185,129,.2)' : 'rgba(99,102,241,.15)'}`,
                    borderRadius: 10,
                }}>
                    <ShieldCheck size={16} style={{ color: verificationProgress.pct === 100 ? '#10b981' : '#6366f1', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                                Verification Progress
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: verificationProgress.pct === 100 ? '#10b981' : '#6366f1' }}>
                                {verificationProgress.verified}/{verificationProgress.total} fields ({verificationProgress.pct}%)
                            </span>
                        </div>
                        <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', width: `${verificationProgress.pct}%`,
                                background: verificationProgress.pct === 100 ? '#10b981' : '#6366f1',
                                borderRadius: 3, transition: 'width 0.3s',
                            }} />
                        </div>
                    </div>
                </div>
            )}

        <div className="pv-shell">
            {/* ── Left Sidebar ─────────────────────────────── */}
            <div className="pv-sidebar">
                <div className="pv-progress-block">
                    <div className="pv-progress-header"><BarChart3 size={14} /><span>Overall Completion</span></div>
                    <div className="pv-progress-ring-row">
                        <div className="pv-progress-circle">
                            <svg viewBox="0 0 36 36" className="pv-circular-chart">
                                <path className="pv-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="pv-circle-fill" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style={{ stroke: progress === 100 ? '#10b981' : '#4f46e5' }} />
                            </svg>
                            <span className="pv-progress-pct">{progress}%</span>
                        </div>
                        <div className="pv-progress-detail"><span className="pv-progress-num">{stats.filled}</span> / {stats.total} fields</div>
                    </div>
                </div>
                <div className="pv-step-nav">
                    {STEPS.map((s, i) => {
                        const st = getSectionStats(s.id);
                        const isDone = st.total > 0 && st.filled === st.total;
                        const isActive = i === currentStep;
                        const hasVIssue = verificationResults?.[s.id]?.status === 'mismatch';
                        return (
                            <button key={s.id} className={`pv-step-btn ${isActive ? 'active' : ''} ${isDone ? 'done' : ''} ${hasVIssue ? 'has-issue' : ''}`} onClick={() => setCurrentStep(i)}>
                                <div className={`pv-step-num ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} style={isActive ? { background: s.color, borderColor: s.color } : {}}>
                                    {isDone ? <Check size={12} /> : hasVIssue ? <AlertTriangle size={11} /> : (i + 1)}
                                </div>
                                <div className="pv-step-info">
                                    <div className="pv-step-title">{s.title}</div>
                                    {st.total > 0 && <div className="pv-step-sub">{st.filled}/{st.total} {st.isArray ? 'entries' : 'fields'}</div>}
                                </div>
                                {isDone && <CheckCircle size={14} className="pv-step-check" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Main Content ──────────────────────────────── */}
            <div className="pv-main">
                <div className="pv-main-header">
                    <div className="pv-main-header-left">
                        <div className="pv-step-icon-badge" style={{ background: `${step.color}12`, color: step.color, border: `1px solid ${step.color}30` }}>
                            <step.Icon size={20} />
                        </div>
                        <div>
                            <div className="pv-main-title">{step.title}</div>
                            <div className="pv-main-subtitle">Step {currentStep + 1} of {STEPS.length}{sStats.total > 0 && <> · <strong>{sectionPct}%</strong> complete</>}</div>
                        </div>
                    </div>
                    <div className="pv-main-header-right">
                        {/* Verify All in Section Button */}
                        {canVerify && ALL_FIELDS[step.id] && (
                            <button className="pv-toolbar-btn" onClick={() => handleVerifyAllInSection(step.id)}
                                style={{ color: '#10b981', borderColor: '#10b98130' }}
                                title="Verify all fields in this section">
                                <CheckCircle size={14} /> Verify All
                            </button>
                        )}
                        {/* Document Viewer Button */}
                        <button className={`pv-toolbar-btn docs ${showDocPanel ? 'active' : ''}`} onClick={() => setShowDocPanel(!showDocPanel)} title="View uploaded documents">
                            <FileText size={14} /> Docs{pdfDocs.length > 0 && ` (${pdfDocs.length})`}
                        </button>
                        {/* Edit / Save / Cancel */}
                        {editing ? (
                            <>
                                <button className="pv-toolbar-btn cancel" onClick={cancelEdit}><X size={14} /> Cancel</button>
                                <button className="pv-toolbar-btn save" onClick={saveEdits} disabled={saving}>
                                    {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Save
                                </button>
                            </>
                        ) : (
                            <button className="pv-toolbar-btn edit" onClick={startEdit}><Pencil size={14} /> Edit</button>
                        )}
                        {/* Re-verification button */}
                        {!editing && pendingReverifyId && (
                            <button className="pv-toolbar-btn" onClick={sendReverification} disabled={sendingReverify}
                                style={{ color: '#d97706', borderColor: '#d9770630', fontWeight: 600 }}
                                title="Send re-verification request to client">
                                {sendingReverify ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Request Re-verification
                            </button>
                        )}
                        {verifyStatus === 'mismatch' && <div className="pv-verify-badge warn"><ShieldAlert size={14} /> Issues</div>}
                        {verifyStatus === 'verified' && <div className="pv-verify-badge ok"><ShieldCheck size={14} /> Verified</div>}
                    </div>
                </div>

                <div className="pv-main-body">
                    {/* Save result banner — changes detected */}
                    {saveResult && (
                        <div className="pv-alert-banner" style={{ background: '#fffbeb', borderColor: '#fbbf24', color: '#92400e' }}>
                            <AlertTriangle size={14} />
                            <div>
                                <strong>{saveResult.changed} field{saveResult.changed > 1 ? 's' : ''} changed.</strong>
                                <span> Client consent has been invalidated. </span>
                                <button onClick={sendReverification} disabled={sendingReverify}
                                    style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12, marginLeft: 8 }}>
                                    {sendingReverify ? 'Sending...' : 'Send Re-verification Now'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Pending re-verification banner */}
                    {!saveResult && reverifyHistory.length > 0 && reverifyHistory[0].status === 'sent' && (
                        <div className="pv-alert-banner" style={{ background: '#fffbeb', borderColor: '#fbbf24', color: '#92400e' }}>
                            <Clock size={14} />
                            <div><strong>Re-verification requested.</strong><span> Waiting for client to review changes and provide consent.</span></div>
                        </div>
                    )}

                    {/* Editing banner */}
                    {editing && (
                        <div className="pv-alert-banner edit">
                            <Pencil size={14} />
                            <div><strong>Edit Mode</strong><span>You are editing the client's PIF data. Click Save when done.</span></div>
                        </div>
                    )}

                    {/* Docs banner */}
                    {sectionDocs.length > 0 && (
                        <div className="pv-docs-banner">
                            <Paperclip size={14} />
                            <span className="pv-docs-label">Uploaded Documents:</span>
                            <div className="pv-docs-list">
                                {sectionDocs.map(doc => (
                                    <a key={doc.id} href={`/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer" className="pv-doc-chip">
                                        <FileText size={12} /> {doc.original_name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {verifyStatus === 'mismatch' && !editing && (
                        <div className="pv-alert-banner warn">
                            <AlertTriangle size={15} />
                            <div><strong>Verification Issues</strong><span>Some fields could not be verified against the uploaded documents.</span></div>
                        </div>
                    )}

                    <div className="pv-step-content">{renderStep()}</div>
                </div>

                <div className="pv-main-footer">
                    <button className="pv-nav-btn prev" disabled={currentStep === 0} onClick={() => setCurrentStep(prev => prev - 1)}><ChevronLeft size={16} /> Previous</button>
                    <div className="pv-step-dots">
                        {STEPS.map((_, i) => (
                            <button key={i} className={`pv-dot ${i === currentStep ? 'active' : ''} ${getSectionStats(STEPS[i].id).total > 0 && getSectionStats(STEPS[i].id).filled === getSectionStats(STEPS[i].id).total ? 'done' : ''}`} onClick={() => setCurrentStep(i)} title={STEPS[i].title} />
                        ))}
                    </div>
                    <button className="pv-nav-btn next" disabled={currentStep === STEPS.length - 1} onClick={() => setCurrentStep(prev => prev + 1)}>Next <ChevronRight size={16} /></button>
                </div>
            </div>
        </div>

                    {/* Re-verification History */}
                    {reverifyHistory.length > 0 && (
                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                            <button onClick={() => setShowReverifyHistory(!showReverifyHistory)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                    background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
                                    fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
                                }}>
                                <History size={14} />
                                Re-verification History ({reverifyHistory.length})
                                {showReverifyHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {showReverifyHistory && (
                                <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {reverifyHistory.map(r => {
                                        const fields = r.changed_fields || {};
                                        const count = Object.keys(fields).length;
                                        const statusColors = { pending: '#f59e0b', sent: '#3b82f6', confirmed: '#10b981', superseded: '#94a3b8' };
                                        return (
                                            <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                    <span style={{ fontWeight: 600 }}>{r.changed_by_name}</span>
                                                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: `${statusColors[r.status]}18`, color: statusColors[r.status], textTransform: 'uppercase' }}>
                                                        {r.status}
                                                    </span>
                                                </div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                                                    {count} field{count > 1 ? 's' : ''} changed · {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                {r.consent_at && (
                                                    <div style={{ color: '#10b981', fontSize: 11, marginTop: 2 }}>
                                                        Client confirmed {new Date(r.consent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}


            {/* ── Document Viewer Drawer (slide-over) ──────────── */}
            <div className={`pv-doc-backdrop ${showDocPanel ? 'open' : ''}`} onClick={() => setShowDocPanel(false)} />
            <div className={`pv-doc-drawer ${showDocPanel ? 'open' : ''}`}>
                <div className="pv-doc-drawer-header">
                    <FileText size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <select value={selectedDocId || ''} onChange={e => setSelectedDocId(e.target.value || null)}>
                        <option value="">Select a document to view...</option>
                        {pdfDocs.map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.original_name}</option>
                        ))}
                    </select>
                    <button className="pv-doc-drawer-close" onClick={() => setShowDocPanel(false)} title="Close document viewer">
                        <PanelRightClose size={18} />
                    </button>
                </div>
                <div className="pv-doc-drawer-body">
                    {selectedDocId ? (
                        <PDFRenderer url={api.getDocumentDownloadUrl(selectedDocId)} />
                    ) : (
                        <div className="pv-doc-drawer-placeholder">
                            <Eye size={36} />
                            <div className="pv-doc-drawer-title">Select a document above</div>
                            <div className="pv-doc-drawer-desc">Compare uploaded documents with client PIF data to verify accuracy</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
