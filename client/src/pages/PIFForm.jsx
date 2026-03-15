import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = 'http://localhost:5000/api';

const STEPS = [
  { id: 'personal',     title: 'Personal Info',       icon: '👤', desc: 'Your basic identification details' },
  { id: 'canada',       title: 'Canada History',       icon: '🍁', desc: 'Your history with Canada and previous applications' },
  { id: 'passport',     title: 'Passport & Status',   icon: '📘', desc: 'Passport details and marital status' },
  { id: 'spouse',       title: 'Spouse / Partner',     icon: '💍', desc: 'Information about your spouse or partner' },
  { id: 'parents',      title: 'Parents',              icon: '👨‍👩‍👦', desc: 'Details about your parents' },
  { id: 'education',    title: 'Education',            icon: '🎓', desc: 'Your academic background' },
  { id: 'work',         title: 'Work History',         icon: '💼', desc: 'Employment and personal activity history' },
  { id: 'children',     title: 'Children',             icon: '👶', desc: 'Details about your children, if any' },
  { id: 'siblings',     title: 'Siblings',             icon: '👫', desc: 'Brothers and sisters information' },
  { id: 'addresses',    title: 'Address History',      icon: '🏠', desc: 'All residences from age 18 or 10 years' },
  { id: 'travel',       title: 'Travel History',       icon: '✈️', desc: 'International travel outside your home country' },
  { id: 'relatives',    title: 'Relatives in Canada',  icon: '🏡', desc: 'Family members currently in Canada' },
  { id: 'language',     title: 'Language Tests',       icon: '📝', desc: 'IELTS, CELPIP or other test scores' },
  { id: 'declarations', title: 'Declaration',          icon: '✅', desc: 'Review, declare and submit your form' },
];

const emptyRow = (type) => {
  const t = {
    education: { from: '', to: '', institute: '', city: '', field: '' },
    work:       { from: '', to: '', jobTitle: '', city: '', country: '', companyName: '' },
    children:   { firstName: '', lastName: '', relation: 'Son', dob: '', placeOfBirth: '', maritalStatus: 'S', occupation: '', currentAddress: '', eyeColour: '', height: '' },
    siblings:   { name: '', relation: '', dob: '', placeOfBirth: '', maritalStatus: '', occupation: '', addressEmail: '' },
    addresses:  { from: '', to: '', address: '', cityState: '', country: '', activity: '' },
    travel:     { from: '', to: '', place: '', purpose: '' },
    relatives:  { firstName: '', lastName: '', city: '', relation: '', phone: '', email: '', yearsInCanada: '' },
  };
  return { ...t[type] };
};

/* ─── Step-level required rules ────────────────────────────── */
// Each key = step id, value = array of rule descriptors:
//   { field, label }              → simple non-empty field check
//   { arrayField, min, label }    → array must have >= min rows
//   { arrayField, rowField, label }→ every row must have rowField filled
//   { field, check, label }       → custom fn(formData) returns bool (true = valid)
const STEP_RULES = {
  personal: [
    { field: 'firstName',   label: 'First Name' },
    { field: 'lastName',    label: 'Last Name' },
    { field: 'dob',         label: 'Date of Birth' },
    { field: 'gender',      label: 'Gender' },
    { field: 'nationality', label: 'Nationality' },
  ],
  canada: [
    { field: 'appliedBefore',  label: 'Applied to Canada before (Yes/No)' },
    { field: 'refusedBefore',  label: 'Refused / denied entry (Yes/No)' },
    { field: 'medicalExamDone',label: 'Medical exam done (Yes/No)' },
    { field: 'biometricsDone', label: 'Biometrics done (Yes/No)' },
  ],
  passport: [
    { field: 'passportNumber',     label: 'Passport Number' },
    { field: 'passportIssueDate',  label: 'Passport Issue Date' },
    { field: 'passportExpiryDate', label: 'Passport Expiry Date' },
    { field: 'passportCountry',    label: 'Country of Issue' },
    { field: 'maritalStatus',      label: 'Marital Status' },
  ],
  spouse: [
    // only required if not Single
    { field: 'spouseFirstName', label: 'Spouse First Name',
      check: fd => fd.maritalStatus === 'Single' || !!fd.spouseFirstName },
    { field: 'spouseLastName',  label: 'Spouse Last Name',
      check: fd => fd.maritalStatus === 'Single' || !!fd.spouseLastName },
    { field: 'spouseDob',       label: 'Spouse Date of Birth',
      check: fd => fd.maritalStatus === 'Single' || !!fd.spouseDob },
    { field: 'spouseMarriageDate', label: 'Date of Marriage',
      check: fd => fd.maritalStatus === 'Single' || !!fd.spouseMarriageDate },
  ],
  parents: [
    { field: 'motherFirstName', label: "Mother's First Name" },
    { field: 'motherLastName',  label: "Mother's Last Name" },
    { field: 'fatherFirstName', label: "Father's First Name" },
    { field: 'fatherLastName',  label: "Father's Last Name" },
  ],
  education: [
    { arrayField: 'education', min: 1, label: 'At least one education entry' },
    { arrayField: 'education', rowField: 'institute', label: 'Institute name (all rows)' },
    { arrayField: 'education', rowField: 'from',      label: 'Start date (all rows)' },
    { arrayField: 'education', rowField: 'to',        label: 'End date (all rows)' },
  ],
  work: [
    { arrayField: 'work', min: 1, label: 'At least one work / activity entry' },
    { arrayField: 'work', rowField: 'jobTitle', label: 'Job title / activity (all rows)' },
    { arrayField: 'work', rowField: 'from',     label: 'Start date (all rows)' },
    { arrayField: 'work', rowField: 'to',       label: 'End date (all rows)' },
    { arrayField: 'work', rowField: 'country',  label: 'Country (all rows)' },
  ],
  children:   [], // optional
  siblings:   [], // optional
  addresses: [
    { arrayField: 'addresses', min: 1, label: 'At least one address entry' },
    { arrayField: 'addresses', rowField: 'address', label: 'Street address (all rows)' },
    { arrayField: 'addresses', rowField: 'from',    label: 'From date (all rows)' },
    { arrayField: 'addresses', rowField: 'to',      label: 'To date (all rows)' },
    { arrayField: 'addresses', rowField: 'country', label: 'Country (all rows)' },
  ],
  travel:   [], // optional
  relatives:[], // optional
  language: [
    { field: 'testType',       label: 'Test Type' },
    { field: 'ieltsListening', label: 'Listening score' },
    { field: 'ieltsReading',   label: 'Reading score' },
    { field: 'ieltsWriting',   label: 'Writing score' },
    { field: 'ieltsSpeaking',  label: 'Speaking score' },
    { field: 'ieltsOverall',   label: 'Overall score' },
  ],
  declarations: [
    { field: 'consent', check: fd => fd.consent === true, label: 'You must check the declaration consent' },
  ],
};

// Returns array of string error messages for a given step
function validateStep(stepId, fd) {
  const rules = STEP_RULES[stepId] || [];
  const errs = [];
  rules.forEach(r => {
    if (r.arrayField && r.min !== undefined) {
      if ((fd[r.arrayField] || []).length < r.min) errs.push(r.label);
    } else if (r.arrayField && r.rowField) {
      const bad = (fd[r.arrayField] || []).some(row => !row[r.rowField]);
      if (bad) errs.push(r.label);
    } else if (r.check) {
      if (!r.check(fd)) errs.push(r.label);
    } else {
      if (!fd[r.field]) errs.push(r.label);
    }
  });
  return errs;
}

// Returns a Set of field names that are invalid (for highlighting)
function invalidFields(stepId, fd) {
  const rules = STEP_RULES[stepId] || [];
  const bad = new Set();
  rules.forEach(r => {
    if (r.arrayField) return; // array errors shown in banner only
    if (r.check) { if (!r.check(fd)) bad.add(r.field); }
    else { if (!fd[r.field]) bad.add(r.field); }
  });
  return bad;
}

/* ─── Field Components ─────────────────────────────────────── */
const Field = ({ label, req, hint, err, children }) => (
  <div className="pif-field-wrap">
    <label className="pif-field-label">
      {label}{req && <span className="pif-req"> *</span>}
      {err && <span className="pif-field-err-dot" title="Required">!</span>}
    </label>
    {children}
    {hint && <div className="pif-field-hint">{hint}</div>}
    {err  && <div className="pif-field-err-msg">This field is required</div>}
  </div>
);

const PInput = ({ label, field, value, onChange, type = 'text', req, placeholder, hint, errors }) => (
  <Field label={label} req={req} hint={hint} err={errors?.has(field)}>
    <input type={type}
      className={`pif-ctrl${errors?.has(field) ? ' pif-ctrl-err' : ''}`}
      value={value || ''}
      placeholder={placeholder}
      onChange={e => onChange(field, e.target.value)} />
  </Field>
);

const PSelect = ({ label, field, value, onChange, options, req, hint, errors }) => (
  <Field label={label} req={req} hint={hint} err={errors?.has(field)}>
    <select
      className={`pif-ctrl pif-sel${errors?.has(field) ? ' pif-ctrl-err' : ''}`}
      value={value || ''}
      onChange={e => onChange(field, e.target.value)}>
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </Field>
);

const PRadio = ({ label, field, value, onChange, options, errors }) => (
  <Field label={label} err={errors?.has(field)}>
    <div className={`pif-radio-row${errors?.has(field) ? ' pif-radio-err' : ''}`}>
      {options.map(o => (
        <label key={o} className={`pif-radio-chip ${value === o ? 'active' : ''}`}>
          <input type="radio" name={field} value={o} checked={value === o}
            onChange={e => onChange(field, e.target.value)} />
          {o}
        </label>
      ))}
    </div>
  </Field>
);

const PTextarea = ({ label, field, value, onChange, placeholder }) => (
  <div className="pif-field-wrap pif-span2">
    <label className="pif-field-label">{label}</label>
    <textarea className="pif-ctrl pif-ta" value={value || ''}
      placeholder={placeholder} rows={3}
      onChange={e => onChange(field, e.target.value)} />
  </div>
);

/* ─── Uploader ─────────────────────────────────────────────── */
function SectionUpload({ token, sectionId, uploadedFiles, setUploadedFiles }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef(null);
  const files = uploadedFiles[sectionId] || [];

  async function upload(rawFiles) {
    if (!rawFiles?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(rawFiles).forEach(f => fd.append('files', f));
      fd.append('section', sectionId);
      const res  = await fetch(`${API_BASE}/pif/${token}/upload`, { method: 'POST', body: fd });
      const docs = await res.json();
      if (Array.isArray(docs))
        setUploadedFiles(p => ({ ...p, [sectionId]: [...(p[sectionId] || []), ...docs] }));
    } catch { /**/ }
    setUploading(false);
  }

  async function del(id) {
    await fetch(`${API_BASE}/pif/${token}/uploads/${id}`, { method: 'DELETE' });
    setUploadedFiles(p => ({ ...p, [sectionId]: (p[sectionId] || []).filter(d => d.id !== id) }));
  }

  return (
    <div className="pif-upload-box">
      <div
        className="pif-drop-zone"
        onClick={() => ref.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files); }}
      >
        <div className="pif-drop-icon">{uploading ? '⏳' : '📎'}</div>
        <div className="pif-drop-text">{uploading ? 'Uploading…' : 'Attach supporting documents'}</div>
        <div className="pif-drop-hint">PDF, Images, Word · max 50 MB · drag & drop or click</div>
        <input ref={ref} type="file" multiple style={{ display: 'none' }}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          onChange={e => { upload(e.target.files); e.target.value = ''; }} />
      </div>
      {files.length > 0 && (
        <div className="pif-file-list">
          {files.map(doc => (
            <div key={doc.id} className="pif-file-item">
              <span className="pif-file-icon">{doc.original_name?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
              <div className="pif-file-meta">
                <div className="pif-file-name">{doc.original_name}</div>
                <div className="pif-file-size">{doc.file_size ? (doc.file_size / 1024).toFixed(0) + ' KB' : ''}</div>
              </div>
              <button className="pif-file-del" onClick={() => del(doc.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Dynamic Table ───────────────────────────────────────── */
function DynTable({ rows, cols, onAdd, onRemove, onChange, label, addLabel }) {
  return (
    <div className="pif-dyn-wrap">
      {rows.length === 0 ? (
        <div className="pif-dyn-empty">No {label.toLowerCase()} added yet</div>
      ) : (
        <div className="pif-dyn-table-wrap">
          <table className="pif-dyn-table">
            <thead>
              <tr>
                <th>#</th>
                {cols.map(c => <th key={c.key}>{c.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{i + 1}</td>
                  {cols.map(c => (
                    <td key={c.key}>
                      {c.type === 'select' ? (
                        <select className="pif-ctrl pif-sel pif-sm"
                          value={row[c.key] || ''}
                          onChange={e => onChange(i, c.key, e.target.value)}>
                          {c.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={c.type || 'text'}
                          className="pif-ctrl pif-sm"
                          placeholder={c.placeholder || ''}
                          value={row[c.key] || ''}
                          onChange={e => onChange(i, c.key, e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td>
                    <button type="button" className="pif-dyn-del" onClick={() => onRemove(i)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="pif-dyn-add" onClick={onAdd}>+ {addLabel}</button>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────── */
export default function PIFForm() {
  const { token } = useParams();
  const [step, setStep]             = useState(0);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clientInfo, setClientInfo] = useState(null);
  const [error, setError]           = useState(null);
  const [submitted, setSubmitted]   = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [showErrors, setShowErrors] = useState(false); // whether to highlight errors

  const [fd, setFd] = useState({
    firstName:'', lastName:'', dob:'', placeOfBirth:'', nationality:'',
    eyeColour:'', height:'', gender:'',
    appliedBefore:'', appliedBeforeDetails:'',
    refusedBefore:'', refusedBeforeDetails:'',
    medicalExamDone:'', medicalExamDetails:'',
    firstEntryDate:'', placeOfEntry:'', purposeOfVisit:'',
    lastEntryDate:'', lastEntryPlace:'', biometricsDone:'',
    passportNumber:'', passportIssueDate:'', passportExpiryDate:'',
    passportCountry:'', maritalStatus:'',
    spouseMarriageDate:'', spouseFirstName:'', spouseLastName:'',
    spouseDob:'', spousePlaceOfBirth:'', spouseOccupation:'', spouseAddress:'',
    previouslyMarried:'No',
    prevMarriageDate:'', prevMarriageEndDate:'',
    prevSpouseFirstName:'', prevSpouseLastName:'', prevSpouseDob:'',
    motherFirstName:'', motherLastName:'', motherDob:'', motherDeathDate:'',
    motherPlaceOfBirth:'', motherOccupation:'', motherAddress:'',
    fatherFirstName:'', fatherLastName:'', fatherDob:'', fatherDeathDate:'',
    fatherPlaceOfBirth:'', fatherOccupation:'', fatherAddress:'',
    education:  [emptyRow('education')],
    work:       [emptyRow('work')],
    children:   [], siblings:[], addresses:[emptyRow('addresses')],
    travel:[], relatives:[],
    ieltsListening:'', ieltsReading:'', ieltsWriting:'',
    ieltsSpeaking:'', ieltsOverall:'', testType:'IELTS',
    criminalHistory:'No', criminalDetails:'',
    healthIssues:'No', healthDetails:'',
    consent: false,
  });

  useEffect(() => {
    fetch(`${API_BASE}/pif/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          setClientInfo(d);
          if (d.already_submitted) setSubmitted(true);
        }
        setLoading(false);
      })
      .catch(() => { setError('Unable to load form. Please check the link.'); setLoading(false); });

    fetch(`${API_BASE}/pif/${token}/uploads`)
      .then(r => r.json())
      .then(docs => {
        if (Array.isArray(docs)) {
          const grouped = {};
          docs.forEach(d => { const s = d.category || 'general'; if (!grouped[s]) grouped[s] = []; grouped[s].push(d); });
          setUploadedFiles(grouped);
        }
      }).catch(() => {});
  }, [token]);

  const set = useCallback((field, val) => setFd(p => ({ ...p, [field]: val })), []);
  const setArr = useCallback((arr, i, k, v) => setFd(p => { const a=[...p[arr]]; a[i]={...a[i],[k]:v}; return {...p,[arr]:a}; }), []);
  const addRow = useCallback((arr, type) => setFd(p => ({ ...p, [arr]: [...p[arr], emptyRow(type)] })), []);
  const delRow = useCallback((arr, i) => setFd(p => ({ ...p, [arr]: p[arr].filter((_,j)=>j!==i) })), []);

  async function submit() {
    if (!fd.consent) { alert('Please agree to the declaration before submitting.'); return; }
    setSubmitting(true);
    try {
      const res  = await fetch(`${API_BASE}/pif/${token}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(fd)
      });
      const data = await res.json();
      if (data.success) setSubmitted(true);
      else alert(data.error || 'Failed to submit');
    } catch { alert('Network error. Please try again.'); }
    setSubmitting(false);
  }

  /* step content */
  // live error set — only shown after first attempt
  const curErrors = showErrors ? invalidFields(STEPS[step].id, fd) : new Set();
  const stepErrs  = showErrors ? validateStep(STEPS[step].id, fd) : [];

  function tryAdvance() {
    const errs = validateStep(STEPS[step].id, fd);
    if (errs.length > 0) {
      setShowErrors(true);
      // scroll to top of right panel
      document.querySelector('.pif-right-body')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setShowErrors(false);
    setStep(p => p + 1);
  }

  const renderStep = () => {
    const s = STEPS[step];
    switch (s.id) {
      case 'personal': return (
        <div className="pif-grid2">
          <PInput label="First Name"     field="firstName"    value={fd.firstName}    onChange={set} req placeholder="Given name(s)"    errors={curErrors} />
          <PInput label="Last Name"      field="lastName"     value={fd.lastName}     onChange={set} req placeholder="Family / surname" errors={curErrors} />
          <PInput label="Date of Birth"  field="dob"          value={fd.dob}          onChange={set} type="date" req                    errors={curErrors} />
          <PInput label="Place of Birth" field="placeOfBirth" value={fd.placeOfBirth} onChange={set} placeholder="City, Country" />
          <PInput label="Nationality"    field="nationality"  value={fd.nationality}  onChange={set} placeholder="e.g. Indian, Filipino" req errors={curErrors} />
          <PSelect label="Gender"        field="gender"       value={fd.gender}       onChange={set} options={['Male','Female','Other','Prefer not to say']} req errors={curErrors} />
          <PInput label="Eye Colour"     field="eyeColour"    value={fd.eyeColour}    onChange={set} placeholder="e.g. Brown" />
          <PInput label="Height"         field="height"       value={fd.height}       onChange={set} placeholder="e.g. 5ft 8in" />
        </div>
      );
      case 'canada': return (
        <div className="pif-grid2">
          <PRadio label="Have you applied to Canada before?" field="appliedBefore" value={fd.appliedBefore} onChange={set} options={['Yes','No']} errors={curErrors} />
          {fd.appliedBefore==='Yes' && <PTextarea label="Details of previous application" field="appliedBeforeDetails" value={fd.appliedBeforeDetails} onChange={set} placeholder="Describe previous applications..." />}
          <PRadio label="Have you ever been refused entry or ordered to leave any country?" field="refusedBefore" value={fd.refusedBefore} onChange={set} options={['Yes','No']} errors={curErrors} />
          {fd.refusedBefore==='Yes' && <PTextarea label="Refusal details" field="refusedBeforeDetails" value={fd.refusedBeforeDetails} onChange={set} />}
          <PRadio label="Have you done a medical exam in the last 12 months?" field="medicalExamDone" value={fd.medicalExamDone} onChange={set} options={['Yes','No']} errors={curErrors} />
          {fd.medicalExamDone==='Yes' && <PInput label="Medical exam details" field="medicalExamDetails" value={fd.medicalExamDetails} onChange={set} />}
          <PInput label="First Entry Date in Canada" field="firstEntryDate" value={fd.firstEntryDate} onChange={set} type="date" />
          <PInput label="Place of Entry"              field="placeOfEntry"   value={fd.placeOfEntry}   onChange={set} placeholder="e.g. Toronto Pearson" />
          <PInput label="Purpose of Visit"            field="purposeOfVisit" value={fd.purposeOfVisit} onChange={set} placeholder="e.g. Study, Work" />
          <PInput label="Last Entry Date"             field="lastEntryDate"  value={fd.lastEntryDate}  onChange={set} type="date" />
          <PInput label="Last Entry Place"            field="lastEntryPlace" value={fd.lastEntryPlace} onChange={set} placeholder="e.g. Vancouver YVR" />
          <PRadio label="Have you done biometrics?" field="biometricsDone" value={fd.biometricsDone} onChange={set} options={['Yes','No']} errors={curErrors} />
        </div>
      );
      case 'passport': return (
        <div className="pif-grid2">
          <PInput  label="Passport Number"  field="passportNumber"     value={fd.passportNumber}     onChange={set} req placeholder="e.g. A12345678" errors={curErrors} />
          <PInput  label="Issue Date"        field="passportIssueDate"  value={fd.passportIssueDate}  onChange={set} type="date" req errors={curErrors} />
          <PInput  label="Expiry Date"       field="passportExpiryDate" value={fd.passportExpiryDate} onChange={set} type="date" req errors={curErrors} />
          <PInput  label="Country of Issue"  field="passportCountry"    value={fd.passportCountry}    onChange={set} placeholder="e.g. India" req errors={curErrors} />
          <PSelect label="Marital Status"    field="maritalStatus"      value={fd.maritalStatus}      onChange={set} req errors={curErrors}
            options={['Single','Married','Divorced','Widowed','Common-Law','Separated']} />
        </div>
      );
      case 'spouse': return fd.maritalStatus === 'Single' ? (
        <div className="pif-info-banner">💡 You selected <strong>Single</strong> as your marital status. You may skip this section.</div>
      ) : (
        <div>
          <div className="pif-sub-heading">Current Spouse / Partner</div>
          <div className="pif-grid2">
            <PInput label="Date of Marriage"  field="spouseMarriageDate"  value={fd.spouseMarriageDate}  onChange={set} type="date" req errors={curErrors} />
            <PInput label="First Name"         field="spouseFirstName"     value={fd.spouseFirstName}     onChange={set} req errors={curErrors} />
            <PInput label="Last Name"          field="spouseLastName"      value={fd.spouseLastName}      onChange={set} req errors={curErrors} />
            <PInput label="Date of Birth"      field="spouseDob"           value={fd.spouseDob}           onChange={set} type="date" req errors={curErrors} />
            <PInput label="Place of Birth"     field="spousePlaceOfBirth"  value={fd.spousePlaceOfBirth}  onChange={set} placeholder="City, Country" />
            <PInput label="Occupation"         field="spouseOccupation"    value={fd.spouseOccupation}    onChange={set} />
            <div className="pif-span2"><PInput label="Spouse's Current Address" field="spouseAddress" value={fd.spouseAddress} onChange={set} placeholder="Full address" /></div>
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Previous Marriage</div>
          <PRadio label="Were you previously married?" field="previouslyMarried" value={fd.previouslyMarried} onChange={set} options={['Yes','No']} />
          {fd.previouslyMarried==='Yes' && (
            <div className="pif-grid2" style={{ marginTop:12 }}>
              <PInput label="Date of Marriage"      field="prevMarriageDate"    value={fd.prevMarriageDate}    onChange={set} type="date" />
              <PInput label="End Date of Marriage"  field="prevMarriageEndDate" value={fd.prevMarriageEndDate} onChange={set} type="date" />
              <PInput label="Ex-Spouse First Name"  field="prevSpouseFirstName" value={fd.prevSpouseFirstName} onChange={set} />
              <PInput label="Ex-Spouse Last Name"   field="prevSpouseLastName"  value={fd.prevSpouseLastName}  onChange={set} />
              <PInput label="Ex-Spouse Date of Birth" field="prevSpouseDob"    value={fd.prevSpouseDob}       onChange={set} type="date" />
            </div>
          )}
        </div>
      );
      case 'parents': return (
        <div>
          <div className="pif-sub-heading">👩 Mother</div>
          <div className="pif-grid2">
            <PInput label="First Name"      field="motherFirstName"    value={fd.motherFirstName}    onChange={set} req errors={curErrors} />
            <PInput label="Last Name"       field="motherLastName"     value={fd.motherLastName}     onChange={set} req errors={curErrors} />
            <PInput label="Date of Birth"   field="motherDob"          value={fd.motherDob}          onChange={set} type="date" />
            <PInput label="Date of Death (if deceased)" field="motherDeathDate" value={fd.motherDeathDate} onChange={set} type="date" />
            <PInput label="Place of Birth"  field="motherPlaceOfBirth" value={fd.motherPlaceOfBirth} onChange={set} placeholder="City, Country" />
            <PInput label="Occupation"      field="motherOccupation"   value={fd.motherOccupation}   onChange={set} />
            <div className="pif-span2"><PInput label="Current Address & Email" field="motherAddress" value={fd.motherAddress} onChange={set} /></div>
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>👨 Father</div>
          <div className="pif-grid2">
            <PInput label="First Name"      field="fatherFirstName"    value={fd.fatherFirstName}    onChange={set} req errors={curErrors} />
            <PInput label="Last Name"       field="fatherLastName"     value={fd.fatherLastName}     onChange={set} req errors={curErrors} />
            <PInput label="Date of Birth"   field="fatherDob"          value={fd.fatherDob}          onChange={set} type="date" />
            <PInput label="Date of Death (if deceased)" field="fatherDeathDate" value={fd.fatherDeathDate} onChange={set} type="date" />
            <PInput label="Place of Birth"  field="fatherPlaceOfBirth" value={fd.fatherPlaceOfBirth} onChange={set} placeholder="City, Country" />
            <PInput label="Occupation"      field="fatherOccupation"   value={fd.fatherOccupation}   onChange={set} />
            <div className="pif-span2"><PInput label="Current Address & Email" field="fatherAddress" value={fd.fatherAddress} onChange={set} /></div>
          </div>
        </div>
      );
      case 'education': return (
        <DynTable rows={fd.education} label="Education" addLabel="Add Education Entry"
          cols={[
            { key:'from',      label:'From',          type:'date' },
            { key:'to',        label:'To',            type:'date' },
            { key:'institute', label:'Institute',     placeholder:'School / University' },
            { key:'city',      label:'City',          placeholder:'City' },
            { key:'field',     label:'Field of Study',placeholder:'e.g. Computer Science' },
          ]}
          onAdd={() => addRow('education','education')}
          onRemove={i => delRow('education',i)}
          onChange={(i,k,v) => setArr('education',i,k,v)} />
      );
      case 'work': return (
        <div>
          <div className="pif-desc-box">📌 List personal history (work, unemployed, retired, other) from age 18 or last 10 years. <strong>No gaps allowed.</strong></div>
          <DynTable rows={fd.work} label="Work" addLabel="Add Work / Activity"
            cols={[
              { key:'from',        label:'From',        type:'date' },
              { key:'to',          label:'To',          type:'date' },
              { key:'jobTitle',    label:'Job Title',   placeholder:'e.g. Engineer' },
              { key:'city',        label:'City',        placeholder:'City' },
              { key:'country',     label:'Country',     placeholder:'Country' },
              { key:'companyName', label:'Company',     placeholder:'Employer name' },
            ]}
            onAdd={() => addRow('work','work')}
            onRemove={i => delRow('work',i)}
            onChange={(i,k,v) => setArr('work',i,k,v)} />
        </div>
      );
      case 'children': return (
        <DynTable rows={fd.children} label="Children" addLabel="Add Child"
          cols={[
            { key:'firstName',    label:'First Name' },
            { key:'lastName',     label:'Last Name' },
            { key:'relation',     label:'Relation', type:'select', options:['Son','Daughter'] },
            { key:'dob',          label:'DOB',      type:'date' },
            { key:'placeOfBirth', label:'Place of Birth' },
            { key:'occupation',   label:'Occupation' },
          ]}
          onAdd={() => addRow('children','children')}
          onRemove={i => delRow('children',i)}
          onChange={(i,k,v) => setArr('children',i,k,v)} />
      );
      case 'siblings': return (
        <DynTable rows={fd.siblings} label="Siblings" addLabel="Add Sibling"
          cols={[
            { key:'name',         label:'Full Name' },
            { key:'relation',     label:'Relation', type:'select', options:['Brother','Sister','Step-Brother','Step-Sister','Half-Brother','Half-Sister'] },
            { key:'dob',          label:'DOB',      type:'date' },
            { key:'placeOfBirth', label:'Place of Birth' },
            { key:'occupation',   label:'Occupation' },
          ]}
          onAdd={() => addRow('siblings','siblings')}
          onRemove={i => delRow('siblings',i)}
          onChange={(i,k,v) => setArr('siblings',i,k,v)} />
      );
      case 'addresses': return (
        <div>
          <div className="pif-desc-box">📌 Address history from age 18 or last 10 years. <strong>No gaps allowed.</strong></div>
          <DynTable rows={fd.addresses} label="Addresses" addLabel="Add Address"
            cols={[
              { key:'from',     label:'From',      type:'date' },
              { key:'to',       label:'To',        type:'date' },
              { key:'address',  label:'Street Address', placeholder:'Street, Postal Code' },
              { key:'cityState',label:'City / State' },
              { key:'country',  label:'Country' },
              { key:'activity', label:'Activity', type:'select', options:['Studying','Working','Unemployed','Retired','Other'] },
            ]}
            onAdd={() => addRow('addresses','addresses')}
            onRemove={i => delRow('addresses',i)}
            onChange={(i,k,v) => setArr('addresses',i,k,v)} />
        </div>
      );
      case 'travel': return (
        <DynTable rows={fd.travel} label="Trips" addLabel="Add Trip"
          cols={[
            { key:'from',    label:'From',    type:'date' },
            { key:'to',      label:'To',      type:'date' },
            { key:'place',   label:'Country / City', placeholder:'e.g. USA, New York' },
            { key:'purpose', label:'Purpose', placeholder:'e.g. Tourism' },
          ]}
          onAdd={() => addRow('travel','travel')}
          onRemove={i => delRow('travel',i)}
          onChange={(i,k,v) => setArr('travel',i,k,v)} />
      );
      case 'relatives': return (
        <DynTable rows={fd.relatives} label="Relatives" addLabel="Add Relative"
          cols={[
            { key:'firstName',     label:'First Name' },
            { key:'lastName',      label:'Last Name' },
            { key:'city',          label:'City in Canada' },
            { key:'relation',      label:'Relation', placeholder:'e.g. Uncle' },
            { key:'phone',         label:'Phone' },
            { key:'yearsInCanada', label:'Years in Canada' },
          ]}
          onAdd={() => addRow('relatives','relatives')}
          onRemove={i => delRow('relatives',i)}
          onChange={(i,k,v) => setArr('relatives',i,k,v)} />
      );
      case 'language': return (
        <div>
          <div className="pif-desc-box">📌 Enter your language test scores. If you have your certificate, please attach it below.</div>
          <div className="pif-grid2">
            <PSelect label="Test Type"  field="testType"        value={fd.testType}        onChange={set} options={['IELTS','CELPIP','TEF','PTE','Other']} req errors={curErrors} />
            <PInput  label="Listening"  field="ieltsListening"  value={fd.ieltsListening}  onChange={set} placeholder="e.g. 7.5" req errors={curErrors} />
            <PInput  label="Reading"    field="ieltsReading"    value={fd.ieltsReading}    onChange={set} placeholder="e.g. 6.5" req errors={curErrors} />
            <PInput  label="Writing"    field="ieltsWriting"    value={fd.ieltsWriting}    onChange={set} placeholder="e.g. 7.0" req errors={curErrors} />
            <PInput  label="Speaking"   field="ieltsSpeaking"   value={fd.ieltsSpeaking}   onChange={set} placeholder="e.g. 7.0" req errors={curErrors} />
            <PInput  label="Overall"    field="ieltsOverall"    value={fd.ieltsOverall}    onChange={set} placeholder="e.g. 7.0" req errors={curErrors} />
          </div>
        </div>
      );
      case 'declarations': return (
        <div>
          <div className="pif-decl-box">
            <div className="pif-decl-title">⚖️ Declarations — Applicable to all family members</div>
            <PRadio label="a) Have you ever been convicted of, currently charged with, on trial for, or party to any crime or offence in any country?" field="criminalHistory" value={fd.criminalHistory} onChange={set} options={['Yes','No']} />
            {fd.criminalHistory==='Yes' && <PTextarea label="Please provide details" field="criminalDetails" value={fd.criminalDetails} onChange={set} />}
            <div style={{ marginTop:16 }} />
            <PRadio label="b) Have you ever had any disease or physical or mental disorder?" field="healthIssues" value={fd.healthIssues} onChange={set} options={['Yes','No']} />
            {fd.healthIssues==='Yes' && <PTextarea label="Please provide details" field="healthDetails" value={fd.healthDetails} onChange={set} />}
          </div>
          <div className="pif-consent-box">
            <p className="pif-consent-text">We use the information in this form for assessing and filling information required for your application. By submitting, you declare that all information stated is up-to-date and accurate. In the event of any changes in your personal circumstances, please inform us at the earliest.</p>
            <label className="pif-consent-label">
              <input type="checkbox" checked={fd.consent} onChange={e => set('consent', e.target.checked)} />
              <span>I declare that all information provided is <strong>true, accurate and complete</strong>. I understand that any false information may affect my immigration application.</span>
            </label>
          </div>
        </div>
      );
      default: return null;
    }
  };

  /* ─── Shell states ─────────────────────────────────────── */
  if (loading) return (
    <div className="pif-shell pif-state-center">
      <div className="pif-spinner-ring" />
      <p style={{ color:'var(--text-muted)', marginTop:16 }}>Loading your form…</p>
    </div>
  );

  if (error) return (
    <div className="pif-shell pif-state-center">
      <div className="pif-state-icon">⚠️</div>
      <div className="pif-state-title">Link Unavailable</div>
      <p style={{ color:'var(--text-muted)', maxWidth:380, textAlign:'center' }}>{error}</p>
    </div>
  );

  if (submitted) return (
    <div className="pif-shell pif-state-center">
      <div className="pif-state-icon" style={{ fontSize:56 }}>🎉</div>
      <div className="pif-state-title">Form Submitted!</div>
      <p style={{ color:'var(--text-muted)', maxWidth:400, textAlign:'center', fontSize:14 }}>
        Thank you, <strong>{clientInfo?.client_name}</strong>! Your Personal Information Form has been received.
        Our team at <strong>PropAgent / New Way Immigration</strong> will review your information and contact you shortly.
      </p>
      <div style={{ marginTop:20, padding:'12px 20px', borderRadius:8, background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.3)', color:'var(--accent-green)', fontSize:13, fontWeight:600 }}>
        ✓ Submission ID: PIF-{token?.slice(0,8).toUpperCase()}
      </div>
    </div>
  );

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const cur = STEPS[step];

  /* ─── Main render ──────────────────────────────────────── */
  return (
    <div className="pif-shell">
      {/* Left panel */}
      <div className="pif-left">
        <div className="pif-brand-block">
          <div className="pif-brand-logo">🌏</div>
          <div>
            <div className="pif-brand-name">PropAgent</div>
            <div className="pif-brand-sub">Personal Information Form</div>
          </div>
        </div>

        {clientInfo && (
          <div className="pif-client-block">
            <div className="pif-client-avatar">
              {clientInfo.client_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div className="pif-client-name">{clientInfo.client_name}</div>
              <div className="pif-client-service">{clientInfo.service_type}</div>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="pif-left-progress">
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
            <span>Progress</span><span>{pct}%</span>
          </div>
          <div className="pif-prog-track"><div className="pif-prog-fill" style={{ width:`${pct}%` }} /></div>
        </div>

        {/* Step list */}
        <nav className="pif-step-list">
          {STEPS.map((s, i) => {
            const done    = i < step;
            const active  = i === step;
            return (
              <button key={s.id}
                className={`pif-step-btn ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                onClick={() => setStep(i)}>
                <div className={`pif-step-dot ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                  {done ? '✓' : i + 1}
                </div>
                <div>
                  <div className="pif-step-label">{s.title}</div>
                  {active && <div className="pif-step-sub">{s.desc}</div>}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right panel */}
      <div className="pif-right">
        <div className="pif-right-header">
          <div>
            <div className="pif-right-title">{cur.icon} {cur.title}</div>
            <div className="pif-right-sub">{cur.desc}</div>
          </div>
          <div className="pif-step-counter">Step {step+1} / {STEPS.length}</div>
        </div>

        <div className="pif-right-body">
          {renderStep()}

          {/* Upload (not on declarations) */}
          {cur.id !== 'declarations' && (
            <div style={{ marginTop:28 }}>
              <div className="pif-upload-label">📎 Supporting Documents for this section</div>
              <SectionUpload token={token} sectionId={cur.id} uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} />
            </div>
          )}
        </div>

        {/* Footer nav */}
        {/* Error banner */}
        {stepErrs.length > 0 && (
          <div className="pif-validation-banner">
            <div className="pif-validation-title">⚠️ Please complete the following required fields:</div>
            <ul className="pif-validation-list">
              {stepErrs.map(e => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}

        <div className="pif-right-footer">
          <button
            className="pif-nav-btn pif-nav-prev"
            disabled={step === 0}
            onClick={() => { setShowErrors(false); setStep(p => p - 1); }}
          >← Back</button>

          {step === STEPS.length - 1 ? (
            <button
              className="pif-nav-btn pif-nav-submit"
              onClick={submit}
              disabled={submitting || !fd.consent}
            >
              {submitting ? '⏳ Submitting…' : '🚀 Submit Form'}
            </button>
          ) : (
            <button
              className="pif-nav-btn pif-nav-next"
              onClick={tryAdvance}
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
