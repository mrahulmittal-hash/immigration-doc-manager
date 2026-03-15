import { useState } from 'react';

// Same step definitions as PIFForm
const STEPS = [
    { id: 'personal', title: 'Personal Information', icon: '👤' },
    { id: 'canada', title: 'Canada History', icon: '🇨🇦' },
    { id: 'passport', title: 'Passport Details', icon: '📘' },
    { id: 'spouse', title: 'Spouse Details', icon: '💍' },
    { id: 'parents', title: 'Parents Details', icon: '👨‍👩‍👦' },
    { id: 'education', title: 'Education History', icon: '🎓' },
    { id: 'work', title: 'Work / Personal History', icon: '💼' },
    { id: 'children', title: 'Children', icon: '👶' },
    { id: 'siblings', title: 'Brothers & Sisters', icon: '👫' },
    { id: 'addresses', title: 'Address History', icon: '🏠' },
    { id: 'travel', title: 'Travel History', icon: '✈️' },
    { id: 'relatives', title: 'Relatives in Canada', icon: '🏡' },
    { id: 'language', title: 'Language Test Scores', icon: '📝' },
    { id: 'declarations', title: 'Declarations & Consent', icon: '✅' },
];

// All scalar fields for computing fill stats
const ALL_FIELDS = {
    personal: ['firstName', 'lastName', 'dob', 'placeOfBirth', 'nationality', 'gender', 'eyeColour', 'height'],
    canada: ['appliedBefore', 'appliedBeforeDetails', 'refusedBefore', 'refusedBeforeDetails', 'medicalExamDone', 'medicalExamDetails', 'firstEntryDate', 'placeOfEntry', 'purposeOfVisit', 'lastEntryDate', 'lastEntryPlace', 'biometricsDone'],
    passport: ['passportNumber', 'passportIssueDate', 'passportExpiryDate', 'passportCountry', 'maritalStatus'],
    spouse: ['spouseMarriageDate', 'spouseFirstName', 'spouseLastName', 'spouseDob', 'spousePlaceOfBirth', 'spouseOccupation', 'spouseAddress', 'previouslyMarried', 'prevMarriageDate', 'prevMarriageEndDate', 'prevSpouseFirstName', 'prevSpouseLastName', 'prevSpouseDob'],
    parents: ['motherFirstName', 'motherLastName', 'motherDob', 'motherDeathDate', 'motherPlaceOfBirth', 'motherOccupation', 'motherAddress', 'fatherFirstName', 'fatherLastName', 'fatherDob', 'fatherDeathDate', 'fatherPlaceOfBirth', 'fatherOccupation', 'fatherAddress'],
    language: ['testType', 'ieltsListening', 'ieltsReading', 'ieltsWriting', 'ieltsSpeaking', 'ieltsOverall'],
    declarations: ['criminalHistory', 'criminalDetails', 'healthIssues', 'healthDetails', 'consent'],
};

const ARRAY_FIELDS = ['education', 'work', 'children', 'siblings', 'addresses', 'travel', 'relatives'];

function isFilled(val) {
    if (val === null || val === undefined || val === '') return false;
    if (typeof val === 'boolean') return true;
    return String(val).trim() !== '';
}

// Read-only field display
function FieldValue({ label, value, type, verificationStatus, verificationReason }) {
    const filled = isFilled(value);
    const displayVal = filled
        ? (typeof value === 'boolean' ? (value ? 'Yes ✓' : 'No') : String(value))
        : '—';

    // Verify logic
    let dotColor = filled ? '#16a34a' : '#d1d5db';
    let dotShadow = filled ? '0 0 4px rgba(22,163,106,0.4)' : 'none';
    let bgColor = filled ? '#f0fdf4' : '#fef2f2';
    let borderColor = filled ? '#bbf7d0' : '#fecaca';
    let textColor = filled ? '#1e293b' : '#94a3b8';

    if (verificationStatus === 'mismatch') {
        dotColor = '#dc2626';
        dotShadow = '0 0 4px rgba(220,38,38,0.4)';
        bgColor = '#fef2f2';
        borderColor = '#fca5a5';
        textColor = '#991b1b';
    }

    return (
        <div className="pif-field" style={{ position: 'relative' }}>
            <label className="pif-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {label}
                <span style={{
                    width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                    background: dotColor,
                    boxShadow: dotShadow,
                    flexShrink: 0
                }} title={verificationReason || ''} />
            </label>
            <div className="pif-input" style={{
                background: bgColor,
                border: `1px solid ${borderColor}`,
                color: textColor,
                fontStyle: filled ? 'normal' : 'italic',
                cursor: 'default',
                minHeight: type === 'textarea' ? 60 : 'auto',
            }}>
                {displayVal}
            </div>
            {verificationStatus === 'mismatch' && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                    ⚠️ {verificationReason}
                </div>
            )}
        </div>
    );
}

function RadioValue({ label, value, options }) {
    return (
        <div className="pif-field">
            <label className="pif-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {label}
                <span style={{
                    width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                    background: isFilled(value) ? '#16a34a' : '#d1d5db',
                }} />
            </label>
            <div className="pif-radio-group">
                {options.map(o => (
                    <span key={o} className={`pif-radio-btn ${value === o ? 'active' : ''}`}
                        style={{ cursor: 'default', opacity: value === o ? 1 : 0.4 }}>
                        {o}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function PIFViewer({ data, verificationResults, clientDocuments }) {
    const [currentStep, setCurrentStep] = useState(0);
    const d = data || {};

    // Compute per-section fill counts
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

    // Total stats
    const totalStats = () => {
        let filled = 0, total = 0;
        Object.keys(ALL_FIELDS).forEach(k => {
            ALL_FIELDS[k].forEach(f => {
                total++;
                if (isFilled(d[f])) filled++;
            });
        });
        ARRAY_FIELDS.forEach(k => {
            const rows = d[k] || [];
            rows.forEach(row => {
                Object.values(row).forEach(v => { total++; if (isFilled(v)) filled++; });
            });
        });
        return { filled, total };
    };

    const stats = totalStats();
    const progress = stats.total > 0 ? Math.round((stats.filled / stats.total) * 100) : 0;

    const getVerifyProps = (sectionId, fieldKey, isArray = false, arrayIdx = 0) => {
        if (!verificationResults || !verificationResults[sectionId]) return {};
        const vr = verificationResults[sectionId];
        if (vr.status !== 'mismatch') return {};

        const searchKey = isArray ? `${fieldKey} (Row ${arrayIdx + 1})` : fieldKey;
        const mismatch = vr.mismatches.find(m => m.field === searchKey);
        
        if (mismatch) {
            return { verificationStatus: 'mismatch', verificationReason: mismatch.reason };
        }
        return {};
    };

    const renderStep = () => {
        const step = STEPS[currentStep];
        switch (step.id) {
            case 'personal': return (
                <div className="pif-grid">
                    <FieldValue label="First Name" value={d.firstName} {...getVerifyProps('personal', 'firstName')} />
                    <FieldValue label="Last Name" value={d.lastName} {...getVerifyProps('personal', 'lastName')} />
                    <FieldValue label="Date of Birth" value={d.dob} {...getVerifyProps('personal', 'dob')} />
                    <FieldValue label="Place of Birth" value={d.placeOfBirth} {...getVerifyProps('personal', 'placeOfBirth')} />
                    <FieldValue label="Nationality" value={d.nationality} {...getVerifyProps('personal', 'nationality')} />
                    <FieldValue label="Gender" value={d.gender} {...getVerifyProps('personal', 'gender')} />
                    <FieldValue label="Eye Colour" value={d.eyeColour} {...getVerifyProps('personal', 'eyeColour')} />
                    <FieldValue label="Height (ft, in)" value={d.height} {...getVerifyProps('personal', 'height')} />
                </div>
            );
            case 'canada': return (
                <div className="pif-grid">
                    <RadioValue label="Have you applied to Canada before?" value={d.appliedBefore} options={['Yes', 'No']} />
                    {d.appliedBefore === 'Yes' && <FieldValue label="Details of previous application" value={d.appliedBeforeDetails} type="textarea" {...getVerifyProps('canada', 'appliedBeforeDetails')} />}
                    <RadioValue label="Have you ever been refused a visa/permit?" value={d.refusedBefore} options={['Yes', 'No']} />
                    {d.refusedBefore === 'Yes' && <FieldValue label="Details of refusal" value={d.refusedBeforeDetails} type="textarea" {...getVerifyProps('canada', 'refusedBeforeDetails')} />}
                    <RadioValue label="Have you done your medical exam (last 12 months)?" value={d.medicalExamDone} options={['Yes', 'No']} />
                    {d.medicalExamDone === 'Yes' && <FieldValue label="Medical exam details" value={d.medicalExamDetails} {...getVerifyProps('canada', 'medicalExamDetails')} />}
                    <FieldValue label="First Entry Date in Canada" value={d.firstEntryDate} {...getVerifyProps('canada', 'firstEntryDate')} />
                    <FieldValue label="Place of Entry" value={d.placeOfEntry} {...getVerifyProps('canada', 'placeOfEntry')} />
                    <FieldValue label="Purpose of Visit" value={d.purposeOfVisit} {...getVerifyProps('canada', 'purposeOfVisit')} />
                    <FieldValue label="Last Entry Date" value={d.lastEntryDate} {...getVerifyProps('canada', 'lastEntryDate')} />
                    <FieldValue label="Last Entry Place" value={d.lastEntryPlace} {...getVerifyProps('canada', 'lastEntryPlace')} />
                    <RadioValue label="Have you done your biometrics?" value={d.biometricsDone} options={['Yes', 'No']} />
                </div>
            );
            case 'passport': return (
                <div className="pif-grid">
                    <FieldValue label="Passport Number" value={d.passportNumber} {...getVerifyProps('passport', 'passportNumber')} />
                    <FieldValue label="Issue Date" value={d.passportIssueDate} {...getVerifyProps('passport', 'passportIssueDate')} />
                    <FieldValue label="Expiry Date" value={d.passportExpiryDate} {...getVerifyProps('passport', 'passportExpiryDate')} />
                    <FieldValue label="Country of Issue" value={d.passportCountry} {...getVerifyProps('passport', 'passportCountry')} />
                    <FieldValue label="Marital Status" value={d.maritalStatus} {...getVerifyProps('passport', 'maritalStatus')} />
                </div>
            );
            case 'spouse': return (
                <div>
                    {d.maritalStatus === 'Single' ? (
                        <div className="pif-info-box"><p>Client selected "Single" — this section was skipped.</p></div>
                    ) : (
                        <>
                            <h3 className="pif-subsection">Current Spouse / Partner</h3>
                            <div className="pif-grid">
                                <FieldValue label="Date of Marriage" value={d.spouseMarriageDate} {...getVerifyProps('spouse', 'spouseMarriageDate')} />
                                <FieldValue label="First Name" value={d.spouseFirstName} {...getVerifyProps('spouse', 'spouseFirstName')} />
                                <FieldValue label="Last Name" value={d.spouseLastName} {...getVerifyProps('spouse', 'spouseLastName')} />
                                <FieldValue label="Date of Birth" value={d.spouseDob} {...getVerifyProps('spouse', 'spouseDob')} />
                                <FieldValue label="Place of Birth" value={d.spousePlaceOfBirth} {...getVerifyProps('spouse', 'spousePlaceOfBirth')} />
                                <FieldValue label="Occupation" value={d.spouseOccupation} {...getVerifyProps('spouse', 'spouseOccupation')} />
                                <div className="pif-field pif-full">
                                    <FieldValue label="Spouse Address" value={d.spouseAddress} {...getVerifyProps('spouse', 'spouseAddress')} />
                                </div>
                            </div>
                            <h3 className="pif-subsection" style={{ marginTop: 24 }}>Previous Marriage</h3>
                            <RadioValue label="Were you previously married?" value={d.previouslyMarried} options={['Yes', 'No']} />
                            {d.previouslyMarried === 'Yes' && (
                                <div className="pif-grid" style={{ marginTop: 12 }}>
                                    <FieldValue label="Date of Marriage" value={d.prevMarriageDate} {...getVerifyProps('spouse', 'prevMarriageDate')} />
                                    <FieldValue label="End Date" value={d.prevMarriageEndDate} {...getVerifyProps('spouse', 'prevMarriageEndDate')} />
                                    <FieldValue label="First Name" value={d.prevSpouseFirstName} {...getVerifyProps('spouse', 'prevSpouseFirstName')} />
                                    <FieldValue label="Last Name" value={d.prevSpouseLastName} {...getVerifyProps('spouse', 'prevSpouseLastName')} />
                                    <FieldValue label="Date of Birth" value={d.prevSpouseDob} {...getVerifyProps('spouse', 'prevSpouseDob')} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            );
            case 'parents': return (
                <div>
                    <h3 className="pif-subsection">👩 Mother's Details</h3>
                    <div className="pif-grid">
                        <FieldValue label="First Name" value={d.motherFirstName} {...getVerifyProps('parents', 'motherFirstName')} />
                        <FieldValue label="Last Name" value={d.motherLastName} {...getVerifyProps('parents', 'motherLastName')} />
                        <FieldValue label="Date of Birth" value={d.motherDob} {...getVerifyProps('parents', 'motherDob')} />
                        <FieldValue label="If deceased, date of death" value={d.motherDeathDate} {...getVerifyProps('parents', 'motherDeathDate')} />
                        <FieldValue label="Place of Birth" value={d.motherPlaceOfBirth} {...getVerifyProps('parents', 'motherPlaceOfBirth')} />
                        <FieldValue label="Occupation" value={d.motherOccupation} {...getVerifyProps('parents', 'motherOccupation')} />
                        <div className="pif-field pif-full">
                            <FieldValue label="Current Address & Email" value={d.motherAddress} {...getVerifyProps('parents', 'motherAddress')} />
                        </div>
                    </div>
                    <h3 className="pif-subsection" style={{ marginTop: 24 }}>👨 Father's Details</h3>
                    <div className="pif-grid">
                        <FieldValue label="First Name" value={d.fatherFirstName} {...getVerifyProps('parents', 'fatherFirstName')} />
                        <FieldValue label="Last Name" value={d.fatherLastName} {...getVerifyProps('parents', 'fatherLastName')} />
                        <FieldValue label="Date of Birth" value={d.fatherDob} {...getVerifyProps('parents', 'fatherDob')} />
                        <FieldValue label="If deceased, date of death" value={d.fatherDeathDate} {...getVerifyProps('parents', 'fatherDeathDate')} />
                        <FieldValue label="Place of Birth" value={d.fatherPlaceOfBirth} {...getVerifyProps('parents', 'fatherPlaceOfBirth')} />
                        <FieldValue label="Occupation" value={d.fatherOccupation} {...getVerifyProps('parents', 'fatherOccupation')} />
                        <div className="pif-field pif-full">
                            <FieldValue label="Current Address & Email" value={d.fatherAddress} {...getVerifyProps('parents', 'fatherAddress')} />
                        </div>
                    </div>
                </div>
            );
            case 'education': return renderArraySection('education', d.education, [
                { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                { key: 'institute', label: 'Institute' }, { key: 'city', label: 'City' },
                { key: 'field', label: 'Field of Study' }
            ], 'Education');
            case 'work': return renderArraySection('work', d.work, [
                { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                { key: 'jobTitle', label: 'Job Title' }, { key: 'city', label: 'City' },
                { key: 'country', label: 'Country' }, { key: 'companyName', label: 'Company Name' }
            ], 'Work / Activity');
            case 'children': return renderArraySection('children', d.children, [
                { key: 'firstName', label: 'First Name' }, { key: 'lastName', label: 'Last Name' },
                { key: 'relation', label: 'Son / Daughter' }, { key: 'dob', label: 'Date of Birth' },
                { key: 'placeOfBirth', label: 'Place of Birth' }, { key: 'maritalStatus', label: 'Marital Status' },
                { key: 'occupation', label: 'Occupation' }, { key: 'eyeColour', label: 'Eye Colour' },
                { key: 'height', label: 'Height' }, { key: 'currentAddress', label: 'Current Address', full: true }
            ], 'Child', true);
            case 'siblings': return renderArraySection('siblings', d.siblings, [
                { key: 'name', label: 'Full Name' }, { key: 'relation', label: 'Relation' },
                { key: 'dob', label: 'Date of Birth' }, { key: 'placeOfBirth', label: 'Place of Birth' },
                { key: 'maritalStatus', label: 'Marital Status' }, { key: 'occupation', label: 'Occupation' },
                { key: 'addressEmail', label: 'Address & Email', full: true }
            ], 'Sibling', true);
            case 'addresses': return renderArraySection('addresses', d.addresses, [
                { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                { key: 'address', label: 'Address with Postal Code', full: true },
                { key: 'cityState', label: 'City / State' }, { key: 'country', label: 'Country' },
                { key: 'activity', label: 'Activity' }
            ], 'Address');
            case 'travel': return renderArraySection('travel', d.travel, [
                { key: 'from', label: 'From' }, { key: 'to', label: 'To' },
                { key: 'place', label: 'Place (City, Country)' }, { key: 'purpose', label: 'Purpose of Travel' }
            ], 'Trip', true);
            case 'relatives': return renderArraySection('relatives', d.relatives, [
                { key: 'firstName', label: 'First Name' }, { key: 'lastName', label: 'Last Name' },
                { key: 'city', label: 'City' }, { key: 'relation', label: 'Relation' },
                { key: 'phone', label: 'Phone Number' }, { key: 'email', label: 'Email' },
                { key: 'yearsInCanada', label: 'Years in Canada' }
            ], 'Relative', true);
            case 'language': return (
                <div className="pif-grid">
                    <FieldValue label="Test Type" value={d.testType} />
                    <FieldValue label="Listening" value={d.ieltsListening} {...getVerifyProps('language', 'ieltsListening')} />
                    <FieldValue label="Reading" value={d.ieltsReading} {...getVerifyProps('language', 'ieltsReading')} />
                    <FieldValue label="Writing" value={d.ieltsWriting} {...getVerifyProps('language', 'ieltsWriting')} />
                    <FieldValue label="Speaking" value={d.ieltsSpeaking} {...getVerifyProps('language', 'ieltsSpeaking')} />
                    <FieldValue label="Overall" value={d.ieltsOverall} {...getVerifyProps('language', 'ieltsOverall')} />
                </div>
            );
            case 'declarations': return (
                <div>
                    <div className="pif-declaration-box">
                        <h3 className="pif-subsection">⚖️ Declarations</h3>
                        <RadioValue label="a) Criminal history / charges?" value={d.criminalHistory} options={['Yes', 'No']} />
                        {d.criminalHistory === 'Yes' && <FieldValue label="Details" value={d.criminalDetails} type="textarea" />}
                        <div style={{ marginTop: 16 }} />
                        <RadioValue label="b) Disease or physical/mental disorder?" value={d.healthIssues} options={['Yes', 'No']} />
                        {d.healthIssues === 'Yes' && <FieldValue label="Details" value={d.healthDetails} type="textarea" />}
                    </div>
                    <div className="pif-consent-box">
                        <div style={{
                            padding: 14, borderRadius: 10,
                            background: d.consent ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${d.consent ? '#bbf7d0' : '#fecaca'}`,
                            display: 'flex', alignItems: 'center', gap: 10, fontSize: 14
                        }}>
                            <span style={{ fontSize: 20 }}>{d.consent ? '✅' : '⬜'}</span>
                            <span style={{ color: d.consent ? '#166534' : '#991b1b' }}>
                                {d.consent
                                    ? 'Client has agreed to the declaration and consented to information sharing.'
                                    : 'Client has NOT provided consent yet.'}
                            </span>
                        </div>
                    </div>
                </div>
            );
            default: return null;
        }
    };

    const renderArraySection = (key, rows, fields, label, optional = false) => {
        const items = rows || [];
        if (items.length === 0) {
            return (
                <div className="pif-info-box">
                    <p>{optional ? `No ${label.toLowerCase()}s were added by the client.` : `No ${label.toLowerCase()} entries added.`}</p>
                </div>
            );
        }
        return (
            <div>
                {items.map((row, i) => (
                    <div key={i} className="pif-dynamic-row">
                        <div className="pif-dynamic-row-header">
                            <span className="pif-row-num">{label} #{i + 1}</span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                                {fields.filter(f => isFilled(row[f.key])).length}/{fields.length} filled
                            </span>
                        </div>
                        <div className="pif-grid">
                            {fields.map(f => (
                                <div key={f.key} className={f.full ? 'pif-field pif-full' : 'pif-field'}>
                                    <FieldValue label={f.label} value={row[f.key]} {...getVerifyProps(key, f.key, true, i)} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="pif-shell" style={{ margin:0, borderRadius: 16, overflow:'hidden', border:'1px solid var(--border-color)', height: 600 }}>
            {/* Left Nav Panel */}
            <div className="pif-left" style={{ width: 280, padding: 20 }}>
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight:600 }}>Completion</div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 3, transition: 'width 0.4s ease',
                            width: `${progress}%`,
                            background: progress === 100 ? '#10b981' : '#3b82f6'
                        }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, fontWeight:500 }}>
                        {stats.filled} / {stats.total} fields filled ({progress}%)
                    </div>
                </div>

                <div className="pif-step-list">
                    {STEPS.map((s, i) => {
                        const sStats = getSectionStats(s.id);
                        const isDone = sStats.total > 0 && sStats.filled === sStats.total;
                        return (
                            <button key={s.id}
                                className={`pif-step-row ${i === currentStep ? 'active' : ''} ${isDone ? 'done' : ''}`}
                                onClick={() => setCurrentStep(i)}>
                                <div className="pif-step-dot">{isDone ? '✓' : (i + 1)}</div>
                                <div className="pif-step-text">
                                    <div className="pif-step-name">{s.title}</div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right Content Panel */}
            <div className="pif-right">
                <div className="pif-right-body" style={{ padding: '30px 40px' }}>
                    <div className="pif-step-header" style={{ marginBottom: 30 }}>
                        <h2 className="pif-step-heading" style={{ fontSize:22, display:'flex', alignItems:'center', gap:10 }}>
                            <span>{STEPS[currentStep].icon}</span>
                            {STEPS[currentStep].title}
                        </h2>
                    </div>
                    
                    <div className="pif-step-content">
                        {(() => {
                            const stepId = STEPS[currentStep].id;
                            const vr = verificationResults ? verificationResults[stepId] : null;
                            let hasIssues = vr && vr.status === 'mismatch';
                            const sectionDocs = (clientDocuments || []).filter(doc => doc.category === stepId && doc.source === 'pif-upload');

                            return (
                                <>
                                    {sectionDocs.length > 0 && (
                                        <div style={{
                                            marginBottom: 20, padding: 12, borderRadius: 8,
                                            background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)',
                                            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'
                                        }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#60a5fa' }}>📎 Uploaded Docs:</div>
                                            {sectionDocs.map(doc => (
                                                <a key={doc.id} href={`http://localhost:5000/api/documents/${doc.id}/download`} 
                                                   target="_blank" rel="noreferrer"
                                                   style={{
                                                       fontSize: 12, padding: '4px 10px', background: 'rgba(255,255,255,.05)', 
                                                       border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, 
                                                       color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4
                                                   }}>
                                                    📄 {doc.original_name}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {hasIssues && (
                                        <div style={{
                                            marginBottom: 20, padding: '12px 16px', borderRadius: 8,
                                            background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#fca5a5',
                                            fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8
                                        }}>
                                            <span style={{ fontSize: 16 }}>⚠️</span>
                                            <div>
                                                <strong style={{ display: 'block', marginBottom: 4, color:'#f87171' }}>Verification Check Failed</strong>
                                                Some fields could not be found in the uploaded documents.
                                            </div>
                                        </div>
                                    )}
                                    
                                    {renderStep()}
                                </>
                            );
                        })()}
                    </div>
                </div>

                <div className="pif-right-footer" style={{ padding: '16px 40px' }}>
                    <button className="pif-nav-btn pif-nav-prev" disabled={currentStep === 0}
                        onClick={() => setCurrentStep(prev => prev - 1)}>
                        ← Back
                    </button>
                    <button className="pif-nav-btn pif-nav-next" disabled={currentStep === STEPS.length - 1}
                        onClick={() => setCurrentStep(prev => prev + 1)}>
                        Next →
                    </button>
                </div>
            </div>
        </div>
    );
}
