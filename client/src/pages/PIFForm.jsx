import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = '/api';

// Context for passing change-highlight function to all field components
const ChgContext = createContext(null);

const STEPS = [
  { id: 'personal',     title: 'Personal Details',     icon: '👤', desc: 'Your identity, birth details, and physical description' },
  { id: 'contact',      title: 'Contact Information',   icon: '📞', desc: 'Email, phone, and current address' },
  { id: 'passport',     title: 'Passport & ID',         icon: '📘', desc: 'Passport, national ID, and US status' },
  { id: 'canada',       title: 'Canada History & Visit', icon: '🍁', desc: 'Previous applications, visit plans, and contact in Canada' },
  { id: 'spouse',       title: 'Spouse / Partner',       icon: '💍', desc: 'Information about your spouse or partner' },
  { id: 'parents',      title: 'Parents',                icon: '👨‍👩‍👦', desc: 'Details about your parents' },
  { id: 'education',    title: 'Education & Occupation', icon: '🎓', desc: 'Education level, current job, and academic history' },
  { id: 'work',         title: 'Work History',           icon: '💼', desc: 'Employment and personal activity history' },
  { id: 'children',     title: 'Children',               icon: '👶', desc: 'Details about your children, if any' },
  { id: 'siblings',     title: 'Siblings',               icon: '👫', desc: 'Brothers and sisters information' },
  { id: 'addresses',    title: 'Address History',        icon: '🏠', desc: 'All residences from age 18 or 10 years' },
  { id: 'travel',       title: 'Travel History',         icon: '✈️', desc: 'International travel outside your home country' },
  { id: 'relatives',    title: 'Relatives in Canada',    icon: '🏡', desc: 'Family members currently in Canada' },
  { id: 'language',     title: 'Language',               icon: '📝', desc: 'Languages spoken and test scores' },
  { id: 'background',   title: 'Background',             icon: '🔍', desc: 'Military, political, and other background questions' },
  { id: 'declarations', title: 'Declaration',            icon: '✅', desc: 'Review, declare and submit your form' },
];

const emptyRow = (type) => {
  const t = {
    education: { from: '', to: '', institute: '', city: '', country: '', field: '', degree: '' },
    work:       { from: '', to: '', jobTitle: '', city: '', country: '', companyName: '' },
    children:   { firstName: '', lastName: '', relation: 'Son', dob: '', placeOfBirth: '', countryOfBirth: '', maritalStatus: '', occupation: '', currentAddress: '' },
    siblings:   { name: '', relation: '', dob: '', placeOfBirth: '', maritalStatus: '', occupation: '', addressEmail: '' },
    addresses:  { from: '', to: '', address: '', cityState: '', country: '', postalCode: '', activity: '' },
    travel:     { from: '', to: '', place: '', purpose: '' },
    relatives:  { firstName: '', lastName: '', city: '', relation: '', phone: '', email: '', yearsInCanada: '', immigrationStatus: '' },
  };
  return { ...t[type] };
};

/* ─── Step-level required rules ────────────────────────────── */
const STEP_RULES = {
  personal: [
    { field: 'firstName',   label: 'First Name' },
    { field: 'lastName',    label: 'Last Name' },
    { field: 'dob',         label: 'Date of Birth' },
    { field: 'gender',      label: 'Gender' },
    { field: 'nationality', label: 'Nationality' },
    { field: 'countryOfBirth', label: 'Country of Birth' },
  ],
  contact: [
    { field: 'email',       label: 'Email Address' },
    { field: 'phone',       label: 'Phone Number' },
    { field: 'currentAddress', label: 'Current Address' },
    { field: 'currentCity',    label: 'City' },
    { field: 'currentCountry', label: 'Country' },
  ],
  passport: [
    { field: 'passportNumber',     label: 'Passport Number' },
    { field: 'passportIssueDate',  label: 'Passport Issue Date' },
    { field: 'passportExpiryDate', label: 'Passport Expiry Date' },
    { field: 'passportCountry',    label: 'Country of Issue' },
    { field: 'maritalStatus',      label: 'Marital Status' },
  ],
  canada: [
    { field: 'appliedBefore',  label: 'Applied to Canada before (Yes/No)' },
    { field: 'refusedBefore',  label: 'Refused / denied entry (Yes/No)' },
    { field: 'biometricsDone', label: 'Biometrics done (Yes/No)' },
  ],
  spouse: [
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
    { field: 'highestEducation', label: 'Highest Level of Education' },
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
  children:   [],
  siblings:   [],
  addresses: [
    { arrayField: 'addresses', min: 1, label: 'At least one address entry' },
    { arrayField: 'addresses', rowField: 'address', label: 'Street address (all rows)' },
    { arrayField: 'addresses', rowField: 'from',    label: 'From date (all rows)' },
    { arrayField: 'addresses', rowField: 'to',      label: 'To date (all rows)' },
    { arrayField: 'addresses', rowField: 'country', label: 'Country (all rows)' },
  ],
  travel:   [],
  relatives:[],
  language: [],
  background: [],
  declarations: [
    { field: 'consent', check: fd => fd.consent === true, label: 'You must check the declaration consent' },
  ],
};

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

function invalidFields(stepId, fd) {
  const rules = STEP_RULES[stepId] || [];
  const bad = new Set();
  rules.forEach(r => {
    if (r.arrayField) return;
    if (r.check) { if (!r.check(fd)) bad.add(r.field); }
    else { if (!fd[r.field]) bad.add(r.field); }
  });
  return bad;
}

/* ─── Field Components ─────────────────────────────────────── */
const Field = ({ label, req, hint, err, changed, oldValue, children }) => (
  <div className={`pif-field-wrap${changed ? ' pif-field-changed' : ''}`}>
    <label className="pif-field-label">
      {label}{req && <span className="pif-req"> *</span>}
      {err && <span className="pif-field-err-dot" title="Required">!</span>}
      {changed && <span className="pif-changed-badge">Changed</span>}
    </label>
    {children}
    {changed && oldValue !== undefined && oldValue !== '' && (
      <div className="pif-changed-old">Previously: <strong>{typeof oldValue === 'boolean' ? (oldValue ? 'Yes' : 'No') : String(oldValue)}</strong></div>
    )}
    {hint && <div className="pif-field-hint">{hint}</div>}
    {err  && <div className="pif-field-err-msg">This field is required</div>}
  </div>
);

const PInput = ({ label, field, value, onChange, type = 'text', req, placeholder, hint, errors }) => {
  const chg = useContext(ChgContext);
  const c = chg?.(field) || {};
  return (
    <Field label={label} req={req} hint={hint} err={errors?.has(field)} changed={c.changed} oldValue={c.oldValue}>
      <input type={type}
        className={`pif-ctrl${errors?.has(field) ? ' pif-ctrl-err' : ''}`}
        value={value || ''}
        placeholder={placeholder}
        onChange={e => onChange(field, e.target.value)} />
    </Field>
  );
};

const PSelect = ({ label, field, value, onChange, options, req, hint, errors }) => {
  const chg = useContext(ChgContext);
  const c = chg?.(field) || {};
  return (
    <Field label={label} req={req} hint={hint} err={errors?.has(field)} changed={c.changed} oldValue={c.oldValue}>
      <select
        className={`pif-ctrl pif-sel${errors?.has(field) ? ' pif-ctrl-err' : ''}`}
        value={value || ''}
        onChange={e => onChange(field, e.target.value)}>
        <option value="">Select...</option>
        {options.map(o => typeof o === 'object'
          ? <option key={o.value} value={o.value}>{o.label}</option>
          : <option key={o} value={o}>{o}</option>
        )}
      </select>
    </Field>
  );
};

const PRadio = ({ label, field, value, onChange, options, errors }) => {
  const chg = useContext(ChgContext);
  const c = chg?.(field) || {};
  return (
    <Field label={label} err={errors?.has(field)} changed={c.changed} oldValue={c.oldValue}>
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
};

const PTextarea = ({ label, field, value, onChange, placeholder, req, errors }) => {
  const chg = useContext(ChgContext);
  const c = chg?.(field) || {};
  return (
    <div className={`pif-field-wrap pif-span2${c.changed ? ' pif-field-changed' : ''}`}>
      <label className="pif-field-label">{label}{req && <span className="pif-req"> *</span>}
        {c.changed && <span className="pif-changed-badge">Changed</span>}
      </label>
      <textarea className={`pif-ctrl pif-ta${errors?.has(field) ? ' pif-ctrl-err' : ''}`} value={value || ''}
        placeholder={placeholder} rows={3}
        onChange={e => onChange(field, e.target.value)} />
      {c.changed && c.oldValue !== undefined && c.oldValue !== '' && (
        <div className="pif-changed-old">Previously: <strong>{String(c.oldValue)}</strong></div>
      )}
    </div>
  );
};

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
        <div className="pif-drop-icon">{uploading ? '...' : '+'}</div>
        <div className="pif-drop-text">{uploading ? 'Uploading...' : 'Attach supporting documents'}</div>
        <div className="pif-drop-hint">PDF, Images, Word - max 50 MB - drag & drop or click</div>
        <input ref={ref} type="file" multiple style={{ display: 'none' }}
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
          onChange={e => { upload(e.target.files); e.target.value = ''; }} />
      </div>
      {files.length > 0 && (
        <div className="pif-file-list">
          {files.map(doc => (
            <div key={doc.id} className="pif-file-item">
              <span className="pif-file-icon">{doc.original_name?.endsWith('.pdf') ? 'PDF' : 'IMG'}</span>
              <div className="pif-file-meta">
                <div className="pif-file-name">{doc.original_name}</div>
                <div className="pif-file-size">{doc.file_size ? (doc.file_size / 1024).toFixed(0) + ' KB' : ''}</div>
              </div>
              <button className="pif-file-del" onClick={() => del(doc.id)}>x</button>
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
                    <button type="button" className="pif-dyn-del" onClick={() => onRemove(i)}>x</button>
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
  const [showErrors, setShowErrors] = useState(false);
  const [reverifyMode, setReverifyMode] = useState(false);
  const [reverifyData, setReverifyData] = useState(null); // { reverification_id, changed_fields, current_data }

  const [fd, setFd] = useState({
    // ── Personal Details ──
    firstName:'', lastName:'', dob:'', placeOfBirth:'', countryOfBirth:'',
    nationality:'', countryOfResidence:'', residenceStatus:'',
    nativeLanguage:'', gender:'', eyeColour:'', height:'',
    aliasFamilyName:'', aliasGivenName:'',

    // ── Contact Information ──
    email:'', phone:'', faxNumber:'',
    currentAddress:'', currentCity:'', currentProvince:'',
    currentPostalCode:'', currentCountry:'',
    residentialAddressSameAsMailing: 'Yes',
    residentialAddress:'', residentialCity:'', residentialProvince:'',
    residentialPostalCode:'', residentialCountry:'',

    // ── Passport & ID ──
    passportNumber:'', passportIssueDate:'', passportExpiryDate:'',
    passportCountry:'', maritalStatus:'',
    nationalIdentityNumber:'',
    usCitizenOrPR:'No', usVisaNumber:'', usVisaExpiryDate:'',

    // ── Canada History & Visit ──
    appliedBefore:'', appliedBeforeDetails:'',
    refusedBefore:'', refusedBeforeDetails:'',
    medicalExamDone:'', medicalExamDetails:'',
    firstEntryDate:'', placeOfEntry:'', purposeOfVisit:'',
    lastEntryDate:'', lastEntryPlace:'', biometricsDone:'',
    fundsAvailable:'', stayDuration:'', intendedEntryDate:'',
    contactInCanadaName:'', contactInCanadaRelation:'',
    contactInCanadaAddress:'', contactInCanadaPhone:'', contactInCanadaEmail:'',

    // ── Spouse / Partner ──
    spouseMarriageDate:'', spouseFirstName:'', spouseLastName:'',
    spouseDob:'', spousePlaceOfBirth:'', spouseCountryOfBirth:'',
    spouseNationality:'', spousePassportNumber:'',
    spouseOccupation:'', spouseAddress:'', spouseEmail:'',
    previouslyMarried:'No',
    prevMarriageDate:'', prevMarriageEndDate:'',
    prevSpouseFirstName:'', prevSpouseLastName:'', prevSpouseDob:'',

    // ── Parents ──
    motherFirstName:'', motherLastName:'', motherDob:'', motherDeathDate:'',
    motherPlaceOfBirth:'', motherCountryOfBirth:'', motherNationality:'',
    motherMaritalStatus:'', motherOccupation:'', motherAddress:'',
    fatherFirstName:'', fatherLastName:'', fatherDob:'', fatherDeathDate:'',
    fatherPlaceOfBirth:'', fatherCountryOfBirth:'', fatherNationality:'',
    fatherMaritalStatus:'', fatherOccupation:'', fatherAddress:'',

    // ── Education & Occupation ──
    highestEducation:'', currentOccupation:'', intendedOccupation:'',
    currentEmployer:'', yearsInOccupation:'',
    education: [emptyRow('education')],

    // ── Work ──
    work: [emptyRow('work')],

    // ── Children, Siblings, Addresses, Travel, Relatives ──
    children:[], siblings:[], addresses:[emptyRow('addresses')],
    travel:[], relatives:[],

    // ── Language ──
    nativeLanguageAbility:'',
    englishAbility:'', frenchAbility:'',
    testType:'', ieltsListening:'', ieltsReading:'', ieltsWriting:'',
    ieltsSpeaking:'', ieltsOverall:'',

    // ── Background ──
    militaryService:'No', militaryServiceDetails:'',
    politicalAssociation:'No', politicalAssociationDetails:'',
    governmentPosition:'No', governmentPositionDetails:'',
    removedFromCountry:'No', removedDetails:'',

    // ── Declarations ──
    criminalHistory:'No', criminalDetails:'',
    healthIssues:'No', healthDetails:'',
    consent: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isReverify = params.get('reverify') === '1';

    fetch(`${API_BASE}/pif/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else {
          setClientInfo(d);
          if (d.already_submitted && !isReverify) setSubmitted(true);
        }
        setLoading(false);
      })
      .catch(() => { setError('Unable to load form. Please check the link.'); setLoading(false); });

    // If re-verification mode, fetch reverification data
    if (isReverify) {
      fetch(`${API_BASE}/pif/${token}/reverification`)
        .then(r => r.json())
        .then(rv => {
          if (rv.has_reverification) {
            setReverifyMode(true);
            setReverifyData(rv);
            // Pre-populate form with current data (admin-edited), but clear consent
            const currentData = rv.current_data || {};
            currentData.consent = false;
            setFd(prev => ({ ...prev, ...currentData }));
          }
        })
        .catch(() => {});
    }

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

  // Helper for re-verification change highlighting
  const chg = useCallback((field) => {
    if (!reverifyMode || !reverifyData?.changed_fields) return {};
    const cf = reverifyData.changed_fields[field];
    if (!cf) return {};
    return { changed: true, oldValue: cf.old };
  }, [reverifyMode, reverifyData]);

  const set = useCallback((field, val) => setFd(p => ({ ...p, [field]: val })), []);
  const setArr = useCallback((arr, i, k, v) => setFd(p => { const a=[...p[arr]]; a[i]={...a[i],[k]:v}; return {...p,[arr]:a}; }), []);
  const addRow = useCallback((arr, type) => setFd(p => ({ ...p, [arr]: [...p[arr], emptyRow(type)] })), []);
  const delRow = useCallback((arr, i) => setFd(p => ({ ...p, [arr]: p[arr].filter((_,j)=>j!==i) })), []);

  async function submit() {
    if (!fd.consent) { alert('Please agree to the declaration before submitting.'); return; }
    setSubmitting(true);
    try {
      let res;
      if (reverifyMode && reverifyData) {
        // Re-verification submission
        res = await fetch(`${API_BASE}/pif/${token}/reverification`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ reverification_id: reverifyData.reverification_id, form_data: fd, consent: true })
        });
      } else {
        // Normal submission
        res = await fetch(`${API_BASE}/pif/${token}`, {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(fd)
        });
      }
      const data = await res.json();
      if (data.success) setSubmitted(true);
      else alert(data.error || 'Failed to submit');
    } catch { alert('Network error. Please try again.'); }
    setSubmitting(false);
  }

  const curErrors = showErrors ? invalidFields(STEPS[step].id, fd) : new Set();
  const stepErrs  = showErrors ? validateStep(STEPS[step].id, fd) : [];

  function tryAdvance() {
    const errs = validateStep(STEPS[step].id, fd);
    if (errs.length > 0) {
      setShowErrors(true);
      document.querySelector('.pif-right-body')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setShowErrors(false);
    setStep(p => p + 1);
  }

  const COUNTRIES = ['Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guyana','Haiti','Honduras','Hong Kong','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone','Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

  const renderStep = () => {
    const s = STEPS[step];
    switch (s.id) {

      case 'personal': return (
        <div className="pif-grid2">
          <PInput label="First / Given Name(s)"  field="firstName"    value={fd.firstName}    onChange={set} req placeholder="As shown on passport" errors={curErrors} />
          <PInput label="Last / Family Name"     field="lastName"     value={fd.lastName}     onChange={set} req placeholder="Family / surname"     errors={curErrors} />
          <PInput label="Alias / Former Family Name" field="aliasFamilyName" value={fd.aliasFamilyName} onChange={set} placeholder="If applicable" hint="If you have ever used another family name" />
          <PInput label="Alias / Former Given Name"  field="aliasGivenName"  value={fd.aliasGivenName}  onChange={set} placeholder="If applicable" />
          <PInput label="Date of Birth"   field="dob"          value={fd.dob}          onChange={set} type="date" req errors={curErrors} />
          <PInput label="City / Place of Birth" field="placeOfBirth" value={fd.placeOfBirth} onChange={set} placeholder="City / town of birth" />
          <PSelect label="Country of Birth"  field="countryOfBirth"  value={fd.countryOfBirth}  onChange={set} options={COUNTRIES} req errors={curErrors} />
          <PSelect label="Country of Citizenship / Nationality" field="nationality" value={fd.nationality} onChange={set} options={COUNTRIES} req errors={curErrors} />
          <PSelect label="Current Country of Residence" field="countryOfResidence" value={fd.countryOfResidence} onChange={set} options={COUNTRIES} />
          <PSelect label="Immigration Status in Country of Residence" field="residenceStatus" value={fd.residenceStatus} onChange={set}
            options={['Citizen','Permanent Resident','Student','Worker','Visitor','Refugee','Other']} />
          <PSelect label="Gender / Sex" field="gender" value={fd.gender} onChange={set} options={['Male','Female','Other']} req errors={curErrors} />
          <PInput label="Native Language"  field="nativeLanguage" value={fd.nativeLanguage} onChange={set} placeholder="e.g. Hindi, Tagalog, Mandarin" />
          <PInput label="Eye Colour"       field="eyeColour"      value={fd.eyeColour}      onChange={set} placeholder="e.g. Brown, Black, Blue" />
          <PInput label="Height (cm)"      field="height"         value={fd.height}         onChange={set} placeholder="e.g. 170" />
        </div>
      );

      case 'contact': return (
        <div>
          <div className="pif-sub-heading">Primary Contact</div>
          <div className="pif-grid2">
            <PInput label="Email Address"   field="email"   value={fd.email}   onChange={set} type="email" req placeholder="your@email.com" errors={curErrors} />
            <PInput label="Phone Number"    field="phone"   value={fd.phone}   onChange={set} type="tel"   req placeholder="+1 234 567 8901" errors={curErrors} />
            <PInput label="Fax Number"      field="faxNumber" value={fd.faxNumber} onChange={set} placeholder="If applicable" />
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Current Mailing Address</div>
          <div className="pif-grid2">
            <div className="pif-span2"><PInput label="Street Address"  field="currentAddress"    value={fd.currentAddress}    onChange={set} req placeholder="Apt / Unit, Street, Area" errors={curErrors} /></div>
            <PInput label="City"              field="currentCity"       value={fd.currentCity}       onChange={set} req placeholder="City / Town" errors={curErrors} />
            <PInput label="Province / State"  field="currentProvince"   value={fd.currentProvince}   onChange={set} placeholder="Province or State" />
            <PInput label="Postal / ZIP Code" field="currentPostalCode" value={fd.currentPostalCode} onChange={set} placeholder="e.g. M5V 2T6" />
            <PSelect label="Country"          field="currentCountry"    value={fd.currentCountry}    onChange={set} options={COUNTRIES} req errors={curErrors} />
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Residential Address</div>
          <PRadio label="Same as mailing address?" field="residentialAddressSameAsMailing" value={fd.residentialAddressSameAsMailing} onChange={set} options={['Yes','No']} />
          {fd.residentialAddressSameAsMailing === 'No' && (
            <div className="pif-grid2" style={{ marginTop:12 }}>
              <div className="pif-span2"><PInput label="Street Address" field="residentialAddress" value={fd.residentialAddress} onChange={set} placeholder="Apt / Unit, Street, Area" /></div>
              <PInput label="City"              field="residentialCity"       value={fd.residentialCity}       onChange={set} />
              <PInput label="Province / State"  field="residentialProvince"   value={fd.residentialProvince}   onChange={set} />
              <PInput label="Postal / ZIP Code" field="residentialPostalCode" value={fd.residentialPostalCode} onChange={set} />
              <PSelect label="Country"          field="residentialCountry"    value={fd.residentialCountry}    onChange={set} options={COUNTRIES} />
            </div>
          )}
        </div>
      );

      case 'passport': return (
        <div className="pif-grid2">
          <PInput  label="Passport / Travel Doc Number" field="passportNumber"     value={fd.passportNumber}     onChange={set} req placeholder="e.g. A12345678" errors={curErrors} />
          <PSelect label="Country of Issue"             field="passportCountry"    value={fd.passportCountry}    onChange={set} options={COUNTRIES} req errors={curErrors} />
          <PInput  label="Issue Date"                   field="passportIssueDate"  value={fd.passportIssueDate}  onChange={set} type="date" req errors={curErrors} />
          <PInput  label="Expiry Date"                  field="passportExpiryDate" value={fd.passportExpiryDate} onChange={set} type="date" req errors={curErrors} />
          <PInput  label="National Identity Document No." field="nationalIdentityNumber" value={fd.nationalIdentityNumber} onChange={set} placeholder="e.g. Aadhaar, DNI, NIC" hint="Government-issued national ID number (if any)" />
          <PSelect label="Marital Status"               field="maritalStatus"      value={fd.maritalStatus}      onChange={set} req errors={curErrors}
            options={['Single','Married','Common-Law','Divorced','Separated','Widowed','Annulled Marriage']} />
          <div className="pif-span2" style={{ marginTop: 12 }}>
            <PRadio label="Are you a lawful Permanent Resident or Citizen of the United States?" field="usCitizenOrPR" value={fd.usCitizenOrPR} onChange={set} options={['Yes','No']} />
          </div>
          {fd.usCitizenOrPR === 'Yes' && (
            <>
              <PInput label="US Visa / Green Card Number" field="usVisaNumber" value={fd.usVisaNumber} onChange={set} placeholder="e.g. SRC2012345678" />
              <PInput label="US Visa Expiry Date"         field="usVisaExpiryDate" value={fd.usVisaExpiryDate} onChange={set} type="date" />
            </>
          )}
        </div>
      );

      case 'canada': return (
        <div>
          <div className="pif-sub-heading">Previous Applications & Entry</div>
          <div className="pif-grid2">
            <PRadio label="Have you previously applied to visit, live, work, or study in Canada?" field="appliedBefore" value={fd.appliedBefore} onChange={set} options={['Yes','No']} errors={curErrors} />
            {fd.appliedBefore==='Yes' && <PTextarea label="Details of previous application(s)" field="appliedBeforeDetails" value={fd.appliedBeforeDetails} onChange={set} placeholder="Type of application, date, result..." />}
            <PRadio label="Have you ever been refused a visa, denied entry, or ordered to leave any country?" field="refusedBefore" value={fd.refusedBefore} onChange={set} options={['Yes','No']} errors={curErrors} />
            {fd.refusedBefore==='Yes' && <PTextarea label="Refusal / removal details" field="refusedBeforeDetails" value={fd.refusedBeforeDetails} onChange={set} />}
            <PRadio label="Have you completed a medical exam in the last 12 months?" field="medicalExamDone" value={fd.medicalExamDone} onChange={set} options={['Yes','No']} />
            {fd.medicalExamDone==='Yes' && <PInput label="Medical exam details (panel physician name, date)" field="medicalExamDetails" value={fd.medicalExamDetails} onChange={set} />}
            <PRadio label="Have you provided biometrics (fingerprints and photo) previously?" field="biometricsDone" value={fd.biometricsDone} onChange={set} options={['Yes','No']} errors={curErrors} />
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Previous Entries to Canada</div>
          <div className="pif-grid2">
            <PInput label="Date of First Entry to Canada" field="firstEntryDate" value={fd.firstEntryDate} onChange={set} type="date" />
            <PInput label="Place of First Entry"          field="placeOfEntry"   value={fd.placeOfEntry}   onChange={set} placeholder="e.g. Toronto Pearson" />
            <PInput label="Date of Last Entry to Canada"  field="lastEntryDate"  value={fd.lastEntryDate}  onChange={set} type="date" />
            <PInput label="Place of Last Entry"           field="lastEntryPlace" value={fd.lastEntryPlace} onChange={set} placeholder="e.g. Vancouver YVR" />
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Details of This Visit</div>
          <div className="pif-grid2">
            <PSelect label="Purpose of Visit" field="purposeOfVisit" value={fd.purposeOfVisit} onChange={set}
              options={['Tourism','Visit Family/Friends','Business','Study','Work','Medical Treatment','Super Visa','Transit','Other']} />
            <PInput label="How long do you plan to stay?" field="stayDuration" value={fd.stayDuration} onChange={set} placeholder="e.g. 6 months, 2 weeks" />
            <PInput label="Intended Date of Entry"        field="intendedEntryDate" value={fd.intendedEntryDate} onChange={set} type="date" />
            <PInput label="Funds Available for Trip (CAD)" field="fundsAvailable" value={fd.fundsAvailable} onChange={set} placeholder="e.g. 5000" />
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Contact Person in Canada</div>
          <div className="pif-grid2">
            <PInput label="Name"         field="contactInCanadaName"     value={fd.contactInCanadaName}     onChange={set} placeholder="Full name" />
            <PInput label="Relationship" field="contactInCanadaRelation" value={fd.contactInCanadaRelation} onChange={set} placeholder="e.g. Son, Friend, Employer" />
            <div className="pif-span2"><PInput label="Address in Canada" field="contactInCanadaAddress" value={fd.contactInCanadaAddress} onChange={set} placeholder="Full Canadian address" /></div>
            <PInput label="Phone"        field="contactInCanadaPhone"    value={fd.contactInCanadaPhone}    onChange={set} placeholder="+1 xxx xxx xxxx" />
            <PInput label="Email"        field="contactInCanadaEmail"    value={fd.contactInCanadaEmail}    onChange={set} placeholder="email@example.com" />
          </div>
        </div>
      );

      case 'spouse': return fd.maritalStatus === 'Single' ? (
        <div className="pif-info-banner">You selected <strong>Single</strong> as your marital status. You may skip this section.</div>
      ) : (
        <div>
          <div className="pif-sub-heading">Current Spouse / Partner</div>
          <div className="pif-grid2">
            <PInput label="Date of Marriage / Union" field="spouseMarriageDate" value={fd.spouseMarriageDate} onChange={set} type="date" req errors={curErrors} />
            <div />
            <PInput label="First Name"         field="spouseFirstName"     value={fd.spouseFirstName}     onChange={set} req errors={curErrors} />
            <PInput label="Last Name"          field="spouseLastName"      value={fd.spouseLastName}      onChange={set} req errors={curErrors} />
            <PInput label="Date of Birth"      field="spouseDob"           value={fd.spouseDob}           onChange={set} type="date" req errors={curErrors} />
            <PInput label="Place of Birth"     field="spousePlaceOfBirth"  value={fd.spousePlaceOfBirth}  onChange={set} placeholder="City" />
            <PSelect label="Country of Birth"  field="spouseCountryOfBirth" value={fd.spouseCountryOfBirth} onChange={set} options={COUNTRIES} />
            <PSelect label="Nationality"       field="spouseNationality"   value={fd.spouseNationality}   onChange={set} options={COUNTRIES} />
            <PInput label="Passport Number"    field="spousePassportNumber" value={fd.spousePassportNumber} onChange={set} />
            <PInput label="Occupation"         field="spouseOccupation"    value={fd.spouseOccupation}    onChange={set} />
            <PInput label="Email"              field="spouseEmail"         value={fd.spouseEmail}         onChange={set} />
            <div className="pif-span2"><PInput label="Current Address" field="spouseAddress" value={fd.spouseAddress} onChange={set} placeholder="Full address" /></div>
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Previous Marriage</div>
          <PRadio label="Were you previously married?" field="previouslyMarried" value={fd.previouslyMarried} onChange={set} options={['Yes','No']} />
          {fd.previouslyMarried==='Yes' && (
            <div className="pif-grid2" style={{ marginTop:12 }}>
              <PInput label="Date of Previous Marriage"    field="prevMarriageDate"    value={fd.prevMarriageDate}    onChange={set} type="date" />
              <PInput label="End Date of Previous Marriage" field="prevMarriageEndDate" value={fd.prevMarriageEndDate} onChange={set} type="date" />
              <PInput label="Ex-Spouse First Name"         field="prevSpouseFirstName" value={fd.prevSpouseFirstName} onChange={set} />
              <PInput label="Ex-Spouse Last Name"          field="prevSpouseLastName"  value={fd.prevSpouseLastName}  onChange={set} />
              <PInput label="Ex-Spouse Date of Birth"      field="prevSpouseDob"       value={fd.prevSpouseDob}       onChange={set} type="date" />
            </div>
          )}
        </div>
      );

      case 'parents': return (
        <div>
          <div className="pif-sub-heading">Mother</div>
          <div className="pif-grid2">
            <PInput label="First Name"      field="motherFirstName"      value={fd.motherFirstName}      onChange={set} req errors={curErrors} />
            <PInput label="Last Name"       field="motherLastName"       value={fd.motherLastName}       onChange={set} req errors={curErrors} />
            <PInput label="Date of Birth"   field="motherDob"            value={fd.motherDob}            onChange={set} type="date" />
            <PInput label="Date of Death (if deceased)" field="motherDeathDate" value={fd.motherDeathDate} onChange={set} type="date" />
            <PInput label="Place of Birth"  field="motherPlaceOfBirth"   value={fd.motherPlaceOfBirth}   onChange={set} placeholder="City" />
            <PSelect label="Country of Birth" field="motherCountryOfBirth" value={fd.motherCountryOfBirth} onChange={set} options={COUNTRIES} />
            <PSelect label="Nationality / Citizenship" field="motherNationality" value={fd.motherNationality} onChange={set} options={COUNTRIES} />
            <PSelect label="Marital Status" field="motherMaritalStatus"  value={fd.motherMaritalStatus}  onChange={set} options={['Single','Married','Common-Law','Divorced','Separated','Widowed']} />
            <PInput label="Occupation"      field="motherOccupation"     value={fd.motherOccupation}     onChange={set} />
            <div className="pif-span2"><PInput label="Current Address & Email" field="motherAddress" value={fd.motherAddress} onChange={set} /></div>
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Father</div>
          <div className="pif-grid2">
            <PInput label="First Name"      field="fatherFirstName"      value={fd.fatherFirstName}      onChange={set} req errors={curErrors} />
            <PInput label="Last Name"       field="fatherLastName"       value={fd.fatherLastName}       onChange={set} req errors={curErrors} />
            <PInput label="Date of Birth"   field="fatherDob"            value={fd.fatherDob}            onChange={set} type="date" />
            <PInput label="Date of Death (if deceased)" field="fatherDeathDate" value={fd.fatherDeathDate} onChange={set} type="date" />
            <PInput label="Place of Birth"  field="fatherPlaceOfBirth"   value={fd.fatherPlaceOfBirth}   onChange={set} placeholder="City" />
            <PSelect label="Country of Birth" field="fatherCountryOfBirth" value={fd.fatherCountryOfBirth} onChange={set} options={COUNTRIES} />
            <PSelect label="Nationality / Citizenship" field="fatherNationality" value={fd.fatherNationality} onChange={set} options={COUNTRIES} />
            <PSelect label="Marital Status" field="fatherMaritalStatus"  value={fd.fatherMaritalStatus}  onChange={set} options={['Single','Married','Common-Law','Divorced','Separated','Widowed']} />
            <PInput label="Occupation"      field="fatherOccupation"     value={fd.fatherOccupation}     onChange={set} />
            <div className="pif-span2"><PInput label="Current Address & Email" field="fatherAddress" value={fd.fatherAddress} onChange={set} /></div>
          </div>
        </div>
      );

      case 'education': return (
        <div>
          <div className="pif-sub-heading">Current Education & Occupation</div>
          <div className="pif-grid2">
            <PSelect label="Highest Level of Education" field="highestEducation" value={fd.highestEducation} onChange={set} req errors={curErrors}
              options={[
                { value: 'None', label: 'None' },
                { value: 'Primary', label: 'Primary School' },
                { value: 'Secondary', label: 'Secondary / High School' },
                { value: 'Trade', label: 'Trade / Apprenticeship Certificate' },
                { value: 'Non-University Diploma', label: 'Non-University Diploma / Certificate' },
                { value: 'Bachelor', label: "Bachelor's Degree" },
                { value: 'Master', label: "Master's Degree" },
                { value: 'Doctorate', label: 'Doctorate / PhD' },
              ]} />
            <PInput label="Current Occupation / Job Title" field="currentOccupation" value={fd.currentOccupation} onChange={set} placeholder="e.g. Software Engineer, Teacher" />
            <PInput label="Current Employer / Company"     field="currentEmployer"   value={fd.currentEmployer}   onChange={set} placeholder="Employer name" />
            <PInput label="Years in Current Occupation"    field="yearsInOccupation" value={fd.yearsInOccupation} onChange={set} placeholder="e.g. 5" />
            <PInput label="Intended Occupation in Canada"  field="intendedOccupation" value={fd.intendedOccupation} onChange={set} placeholder="If different from current" />
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Education History</div>
          <DynTable rows={fd.education} label="Education" addLabel="Add Education Entry"
            cols={[
              { key:'from',      label:'From',           type:'date' },
              { key:'to',        label:'To',             type:'date' },
              { key:'institute', label:'Institute',      placeholder:'School / University' },
              { key:'city',      label:'City',           placeholder:'City' },
              { key:'country',   label:'Country',        placeholder:'Country' },
              { key:'field',     label:'Field of Study', placeholder:'e.g. Computer Science' },
              { key:'degree',    label:'Degree/Diploma', placeholder:'e.g. BSc, MBA' },
            ]}
            onAdd={() => addRow('education','education')}
            onRemove={i => delRow('education',i)}
            onChange={(i,k,v) => setArr('education',i,k,v)} />
        </div>
      );

      case 'work': return (
        <div>
          <div className="pif-desc-box">List personal history (work, unemployed, retired, other) from age 18 or last 10 years. <strong>No gaps allowed.</strong></div>
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
            { key:'firstName',      label:'First Name' },
            { key:'lastName',       label:'Last Name' },
            { key:'relation',       label:'Relation', type:'select', options:['Son','Daughter'] },
            { key:'dob',            label:'DOB',      type:'date' },
            { key:'placeOfBirth',   label:'Place of Birth' },
            { key:'countryOfBirth', label:'Country of Birth' },
            { key:'maritalStatus',  label:'Marital Status' },
            { key:'occupation',     label:'Occupation' },
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
          <div className="pif-desc-box">Address history from age 18 or last 10 years. <strong>No gaps allowed.</strong></div>
          <DynTable rows={fd.addresses} label="Addresses" addLabel="Add Address"
            cols={[
              { key:'from',       label:'From',           type:'date' },
              { key:'to',         label:'To',             type:'date' },
              { key:'address',    label:'Street Address', placeholder:'Street, Postal Code' },
              { key:'cityState',  label:'City / State' },
              { key:'country',    label:'Country' },
              { key:'postalCode', label:'Postal Code' },
              { key:'activity',   label:'Activity', type:'select', options:['Studying','Working','Unemployed','Retired','Other'] },
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
            { key:'firstName',        label:'First Name' },
            { key:'lastName',         label:'Last Name' },
            { key:'city',             label:'City in Canada' },
            { key:'relation',         label:'Relation', placeholder:'e.g. Uncle' },
            { key:'phone',            label:'Phone' },
            { key:'email',            label:'Email' },
            { key:'yearsInCanada',    label:'Years in Canada' },
            { key:'immigrationStatus',label:'Status', placeholder:'e.g. PR, Citizen' },
          ]}
          onAdd={() => addRow('relatives','relatives')}
          onRemove={i => delRow('relatives',i)}
          onChange={(i,k,v) => setArr('relatives',i,k,v)} />
      );

      case 'language': return (
        <div>
          <div className="pif-sub-heading">Language Abilities</div>
          <div className="pif-grid2">
            <PInput label="Native Language" field="nativeLanguageAbility" value={fd.nativeLanguageAbility || fd.nativeLanguage} onChange={set} placeholder="e.g. Hindi, Tagalog" hint="Your mother tongue" />
            <PSelect label="Ability in English" field="englishAbility" value={fd.englishAbility} onChange={set}
              options={['Native/Bilingual','Fluent','Intermediate','Basic','None']} />
            <PSelect label="Ability in French" field="frenchAbility" value={fd.frenchAbility} onChange={set}
              options={['Native/Bilingual','Fluent','Intermediate','Basic','None']} />
          </div>
          <div className="pif-sub-heading" style={{ marginTop:20 }}>Language Test Scores (if applicable)</div>
          <div className="pif-grid2">
            <PSelect label="Test Type" field="testType" value={fd.testType} onChange={set} options={['','IELTS','CELPIP','TEF','TCF','PTE','Other']} />
            {fd.testType && fd.testType !== '' && (
              <>
                <PInput label="Listening" field="ieltsListening" value={fd.ieltsListening} onChange={set} placeholder="e.g. 7.5" />
                <PInput label="Reading"   field="ieltsReading"   value={fd.ieltsReading}   onChange={set} placeholder="e.g. 6.5" />
                <PInput label="Writing"   field="ieltsWriting"   value={fd.ieltsWriting}   onChange={set} placeholder="e.g. 7.0" />
                <PInput label="Speaking"  field="ieltsSpeaking"  value={fd.ieltsSpeaking}  onChange={set} placeholder="e.g. 7.0" />
                <PInput label="Overall"   field="ieltsOverall"   value={fd.ieltsOverall}   onChange={set} placeholder="e.g. 7.0" />
              </>
            )}
          </div>
        </div>
      );

      case 'background': return (
        <div>
          <div className="pif-desc-box">The following questions are required by IRCC. Answer honestly -- providing false information may affect your application.</div>
          <div style={{ display:'flex', flexDirection:'column', gap:16, marginTop:12 }}>
            <PRadio label="a) Have you ever served in any military, militia, or civil defence unit, or been a member of a security organization or police force (including non-obligatory national service, reserve or volunteer units)?"
              field="militaryService" value={fd.militaryService} onChange={set} options={['Yes','No']} />
            {fd.militaryService==='Yes' && <PTextarea label="Please provide details (dates, country, rank, unit)" field="militaryServiceDetails" value={fd.militaryServiceDetails} onChange={set} />}

            <PRadio label="b) Have you ever been a member of or associated with any political party, or other group or organization which has engaged in or advocated violence as a means to achieving a political or religious objective, or which has been associated with criminal activity at any time?"
              field="politicalAssociation" value={fd.politicalAssociation} onChange={set} options={['Yes','No']} />
            {fd.politicalAssociation==='Yes' && <PTextarea label="Please provide details" field="politicalAssociationDetails" value={fd.politicalAssociationDetails} onChange={set} />}

            <PRadio label="c) Have you ever held, currently hold, or have been appointed to any government position (e.g., municipal, regional, provincial/state, or national)?"
              field="governmentPosition" value={fd.governmentPosition} onChange={set} options={['Yes','No']} />
            {fd.governmentPosition==='Yes' && <PTextarea label="Please provide details" field="governmentPositionDetails" value={fd.governmentPositionDetails} onChange={set} />}

            <PRadio label="d) Have you ever been detained, incarcerated, or ordered to leave (deported/removed from) any country?"
              field="removedFromCountry" value={fd.removedFromCountry} onChange={set} options={['Yes','No']} />
            {fd.removedFromCountry==='Yes' && <PTextarea label="Please provide details" field="removedDetails" value={fd.removedDetails} onChange={set} />}
          </div>
        </div>
      );

      case 'declarations': return (
        <div>
          <div className="pif-decl-box">
            <div className="pif-decl-title">Declarations -- Applicable to all family members</div>
            <PRadio label="e) Have you ever been convicted of, currently charged with, on trial for, or party to any crime or offence in any country?" field="criminalHistory" value={fd.criminalHistory} onChange={set} options={['Yes','No']} />
            {fd.criminalHistory==='Yes' && <PTextarea label="Please provide details" field="criminalDetails" value={fd.criminalDetails} onChange={set} />}
            <div style={{ marginTop:16 }} />
            <PRadio label="f) Have you ever had any serious disease or physical or mental disorder?" field="healthIssues" value={fd.healthIssues} onChange={set} options={['Yes','No']} />
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
      <p style={{ color:'var(--text-muted)', marginTop:16 }}>Loading your form...</p>
    </div>
  );

  if (error) return (
    <div className="pif-shell pif-state-center">
      <div className="pif-state-icon">Warning</div>
      <div className="pif-state-title">Link Unavailable</div>
      <p style={{ color:'var(--text-muted)', maxWidth:380, textAlign:'center' }}>{error}</p>
    </div>
  );

  if (submitted) return (
    <div className="pif-shell pif-state-center">
      <div className="pif-state-icon" style={{ fontSize:56 }}>!</div>
      <div className="pif-state-title">Form Submitted!</div>
      <p style={{ color:'var(--text-muted)', maxWidth:400, textAlign:'center', fontSize:14 }}>
        Thank you, <strong>{clientInfo?.client_name}</strong>! Your Personal Information Form has been received.
        Our team at <strong>PropAgent / New Way Immigration</strong> will review your information and contact you shortly.
      </p>
      <div style={{ marginTop:20, padding:'12px 20px', borderRadius:8, background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.3)', color:'var(--accent-green)', fontSize:13, fontWeight:600 }}>
        Submission ID: PIF-{token?.slice(0,8).toUpperCase()}
      </div>
    </div>
  );

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const cur = STEPS[step];

  /* ─── Main render ──────────────────────────────────────── */
  return (
    <ChgContext.Provider value={chg}>
    <div className="pif-shell">
      {/* Left panel */}
      <div className="pif-left">
        <div className="pif-brand-block">
          <div className="pif-brand-logo">G</div>
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
                  {done ? '>' : i + 1}
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
          {/* Re-verification banner */}
          {reverifyMode && (
            <div className="pif-reverify-banner">
              <div className="pif-reverify-banner-icon">⚠️</div>
              <div>
                <strong>Your case manager has updated some of your information.</strong>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  Fields marked with <span className="pif-changed-badge" style={{ display: 'inline', verticalAlign: 'middle' }}>Changed</span> have been modified.
                  Please review all changes, make any corrections, and provide your consent on the final step.
                </p>
              </div>
            </div>
          )}
          {renderStep()}

          {/* Upload (not on declarations or background) */}
          {cur.id !== 'declarations' && cur.id !== 'background' && (
            <div style={{ marginTop:28 }}>
              <div className="pif-upload-label">Supporting Documents for this section</div>
              <SectionUpload token={token} sectionId={cur.id} uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {stepErrs.length > 0 && (
          <div className="pif-validation-banner">
            <div className="pif-validation-title">Please complete the following required fields:</div>
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
          >Back</button>

          {step === STEPS.length - 1 ? (
            <button
              className="pif-nav-btn pif-nav-submit"
              onClick={submit}
              disabled={submitting || !fd.consent}
            >
              {submitting ? 'Submitting...' : 'Submit Form'}
            </button>
          ) : (
            <button
              className="pif-nav-btn pif-nav-next"
              onClick={tryAdvance}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
    </ChgContext.Provider>
  );
}
