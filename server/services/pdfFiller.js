const fs = require('fs');
const { PDFDocument, StandardFonts, rgb, PDFName } = require('pdf-lib');

/**
 * Analyze a PDF form and return its fillable field names and types.
 * For XFA forms with no detectable AcroForm fields, returns the overlay field mapping.
 */
async function analyzeFormFields(filePath) {
    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // First try standard AcroForm detection
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    if (fields.length > 0) {
        return fields.map(field => {
            const type = field.constructor.name;
            let fieldType = 'unknown';
            if (type === 'PDFTextField') fieldType = 'text';
            else if (type === 'PDFCheckBox') fieldType = 'checkbox';
            else if (type === 'PDFDropdown') fieldType = 'dropdown';
            else if (type === 'PDFRadioGroup') fieldType = 'radio';
            else if (type === 'PDFOptionList') fieldType = 'optionlist';
            else if (type === 'PDFSignature') fieldType = 'signature';

            const info = { name: field.getName(), type: fieldType };

            if (fieldType === 'dropdown') {
                try { info.options = field.getOptions(); } catch (e) { /* ignore */ }
            }

            return info;
        });
    }

    // If no AcroForm fields, check if it's an XFA form
    const isXFA = checkIsXFA(pdfDoc);
    if (isXFA) {
        // Return a generic field list for XFA forms based on common immigration form fields
        return getGenericImmigrationFields();
    }

    return [];
}

/**
 * Check if a PDF uses XFA (XML Forms Architecture)
 */
function checkIsXFA(pdfDoc) {
    try {
        const catalog = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Root);
        if (!catalog || !catalog.dict) return false;

        // Check for NeedsRendering flag
        const needsRendering = catalog.get(PDFName.of('NeedsRendering'));
        if (needsRendering) return true;

        // Check AcroForm for XFA key
        const acroFormRef = catalog.get(PDFName.of('AcroForm'));
        if (acroFormRef) {
            const acroForm = pdfDoc.context.lookup(acroFormRef);
            if (acroForm && acroForm.dict) {
                const xfa = acroForm.get(PDFName.of('XFA'));
                if (xfa) return true;
            }
        }
    } catch (e) {
        // Ignore errors during detection
    }
    return false;
}

/**
 * Return generic field definitions for common immigration forms
 */
function getGenericImmigrationFields() {
    return [
        { name: 'first_name', type: 'text' },
        { name: 'last_name', type: 'text' },
        { name: 'full_name', type: 'text' },
        { name: 'date_of_birth', type: 'text' },
        { name: 'nationality', type: 'text' },
        { name: 'passport_number', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'visa_type', type: 'text' },
        { name: 'marital_status', type: 'text' },
        { name: 'sex', type: 'text' },
        { name: 'place_of_birth', type: 'text' },
        { name: 'occupation', type: 'text' },
        { name: 'country_of_residence', type: 'text' },
    ];
}

/**
 * Fill a PDF form with the given data map and save to outputPath.
 * Supports both standard AcroForm and XFA forms (via text overlay).
 */
async function fillPDFForm(templatePath, dataMap, outputPath) {
    const pdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Try standard AcroForm filling first
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    if (fields.length > 0) {
        // Standard AcroForm path
        const result = await fillAcroForm(pdfDoc, form, fields, dataMap);
        const savedBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, savedBytes);
        return result;
    }

    // No AcroForm fields detected — use text overlay approach
    console.log('No AcroForm fields detected. Using text overlay approach.');
    const result = await fillWithTextOverlay(pdfDoc, dataMap, outputPath);
    return result;
}

/**
 * Standard AcroForm fill logic (for forms with detectable fields)
 */
async function fillAcroForm(pdfDoc, form, fields, dataMap) {
    let fieldsFilled = 0;
    const fieldsTotal = fields.length;

    const normalizedDataMap = {};
    for (const [key, value] of Object.entries(dataMap)) {
        normalizedDataMap[normalizeFieldName(key)] = value;
        normalizedDataMap[key.toLowerCase()] = value;
    }

    for (const field of fields) {
        const fieldName = field.getName();
        const normalizedName = normalizeFieldName(fieldName);
        const fieldType = field.constructor.name;

        const value = findBestMatch(fieldName, normalizedName, normalizedDataMap);

        if (value !== null && value !== undefined && value !== '') {
            try {
                if (fieldType === 'PDFTextField') {
                    field.setText(String(value));
                    fieldsFilled++;
                } else if (fieldType === 'PDFCheckBox') {
                    const boolVal = ['true', 'yes', '1', 'x', 'on'].includes(String(value).toLowerCase());
                    boolVal ? field.check() : field.uncheck();
                    fieldsFilled++;
                } else if (fieldType === 'PDFDropdown') {
                    try {
                        field.select(String(value));
                        fieldsFilled++;
                    } catch (e) {
                        const options = field.getOptions();
                        const match = options.find(o => o.toLowerCase() === String(value).toLowerCase());
                        if (match) { field.select(match); fieldsFilled++; }
                    }
                } else if (fieldType === 'PDFRadioGroup') {
                    try { field.select(String(value)); fieldsFilled++; } catch (e) { /* ignore */ }
                }
            } catch (e) {
                console.warn(`Could not fill field "${fieldName}":`, e.message);
            }
        }
    }

    return { fieldsFilled, fieldsTotal };
}

/**
 * Fill PDF using text overlay — draws text directly onto pages.
 * Creates a clean, new PDF with the data rendered as a summary page + overlaid on the form.
 */
async function fillWithTextOverlay(sourcePdfDoc, dataMap, outputPath) {
    // Create a brand new PDF to avoid XFA corruption issues
    const newPdf = await PDFDocument.create();
    const font = await newPdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await newPdf.embedFont(StandardFonts.HelveticaBold);

    // Organize data into sections
    const sections = organizeDataIntoSections(dataMap);
    let fieldsFilled = 0;
    const fieldsTotal = Object.keys(dataMap).filter(k => dataMap[k] && dataMap[k].toString().trim()).length;

    // --- Page 1: Filled Form Summary ---
    const summaryPage = newPdf.addPage([612, 792]); // US Letter
    let y = 750;

    // Title
    summaryPage.drawText('IMMIGRATION APPLICATION — FILLED FORM', {
        x: 50, y, size: 16, font: boldFont, color: rgb(0.1, 0.1, 0.4)
    });
    y -= 8;

    // Title underline
    summaryPage.drawLine({
        start: { x: 50, y }, end: { x: 562, y },
        thickness: 2, color: rgb(0.1, 0.1, 0.4)
    });
    y -= 25;

    // Generation timestamp
    summaryPage.drawText(`Generated: ${new Date().toLocaleString()}`, {
        x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4)
    });
    y -= 30;

    // Draw each section
    for (const section of sections) {
        if (y < 100) {
            // Start new page if running out of space
            const nextPage = newPdf.addPage([612, 792]);
            y = 750;
            drawSectionOnPage(nextPage, section, font, boldFont, 50, y);
            const sectionHeight = estimateSectionHeight(section);
            y -= sectionHeight;
            fieldsFilled += section.fields.filter(f => f.value).length;
            continue;
        }

        drawSectionOnPage(summaryPage, section, font, boldFont, 50, y);
        const sectionHeight = estimateSectionHeight(section);
        y -= sectionHeight;
        fieldsFilled += section.fields.filter(f => f.value).length;
    }

    // Footer
    if (y > 40) {
        summaryPage.drawLine({
            start: { x: 50, y: 50 }, end: { x: 562, y: 50 },
            thickness: 0.5, color: rgb(0.7, 0.7, 0.7)
        });
        summaryPage.drawText('ImmigrationHub — Document Manager | Auto-Generated Form', {
            x: 50, y: 35, size: 8, font, color: rgb(0.5, 0.5, 0.5)
        });
    }

    // --- Try to copy original form pages ---
    try {
        const sourceBytes = sourcePdfDoc.context.enumerateIndirectObjects();
        const sourcePageCount = sourcePdfDoc.getPageCount();

        // Copy original form pages as reference
        for (let i = 0; i < sourcePageCount; i++) {
            try {
                const [copiedPage] = await newPdf.copyPages(sourcePdfDoc, [i]);
                newPdf.addPage(copiedPage);
            } catch (e) {
                console.warn('Could not copy page', i, ':', e.message);
            }
        }
    } catch (e) {
        console.warn('Could not copy original form pages:', e.message);
    }

    // Save
    const savedBytes = await newPdf.save();
    fs.writeFileSync(outputPath, savedBytes);

    return { fieldsFilled, fieldsTotal };
}

/**
 * Organize data map into logical sections for display
 */
function organizeDataIntoSections(dataMap) {
    const sectionDefs = [
        {
            title: 'PERSONAL INFORMATION',
            keys: ['first_name', 'last_name', 'full_name', 'date_of_birth', 'sex', 'gender',
                'place_of_birth', 'country_of_birth', 'marital_status', 'nationality',
                'citizenship', 'country_of_citizenship']
        },
        {
            title: 'IDENTITY DOCUMENTS',
            keys: ['passport_number', 'passport_no', 'document_number', 'date_of_issue',
                'date_of_expiry', 'issuing_authority', 'issuing_country']
        },
        {
            title: 'CONTACT INFORMATION',
            keys: ['email', 'email_address', 'phone', 'telephone', 'mobile', 'address',
                'mailing_address', 'residential_address', 'city', 'province', 'state',
                'postal_code', 'zip_code', 'country', 'country_of_residence']
        },
        {
            title: 'EMPLOYMENT & EDUCATION',
            keys: ['occupation', 'profession', 'job_title', 'employer', 'employer_name',
                'employer_address', 'education', 'degree', 'institution', 'visa_type']
        }
    ];

    const sections = [];
    const usedKeys = new Set();

    for (const def of sectionDefs) {
        const fields = [];
        for (const key of def.keys) {
            if (dataMap[key] && dataMap[key].toString().trim()) {
                fields.push({
                    label: formatFieldLabel(key),
                    value: dataMap[key].toString().trim()
                });
                usedKeys.add(key);
            }
        }
        if (fields.length > 0) {
            sections.push({ title: def.title, fields });
        }
    }

    // Remaining fields not in any section
    const remaining = [];
    for (const [key, value] of Object.entries(dataMap)) {
        if (!usedKeys.has(key) && value && value.toString().trim()) {
            remaining.push({
                label: formatFieldLabel(key),
                value: value.toString().trim()
            });
        }
    }
    if (remaining.length > 0) {
        sections.push({ title: 'ADDITIONAL INFORMATION', fields: remaining });
    }

    return sections;
}

/**
 * Draw a section with its fields on a PDF page
 */
function drawSectionOnPage(page, section, font, boldFont, x, startY) {
    let y = startY;

    // Section header with background
    page.drawRectangle({
        x: x - 5, y: y - 4, width: 517, height: 20,
        color: rgb(0.92, 0.93, 0.96)
    });

    page.drawText(section.title, {
        x, y, size: 11, font: boldFont, color: rgb(0.15, 0.15, 0.35)
    });
    y -= 28;

    // Fields
    for (const field of section.fields) {
        // Label
        page.drawText(field.label + ':', {
            x: x + 10, y, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3)
        });

        // Value — handle long values by truncating
        const maxValueWidth = 300;
        let displayValue = field.value;
        if (displayValue.length > 60) {
            displayValue = displayValue.substring(0, 60) + '...';
        }

        page.drawText(displayValue, {
            x: x + 190, y, size: 10, font, color: rgb(0.05, 0.05, 0.05)
        });
        y -= 18;
    }

    return y;
}

/**
 * Estimate the height a section will take on the page
 */
function estimateSectionHeight(section) {
    return 28 + (section.fields.length * 18) + 15;
}

/**
 * Format a field key into a human-readable label
 */
function formatFieldLabel(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Normalize a field name for matching
 */
function normalizeFieldName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

/**
 * Find the best matching value for a PDF field from the data map
 */
function findBestMatch(originalName, normalizedName, normalizedDataMap) {
    if (normalizedDataMap[normalizedName] !== undefined) {
        return normalizedDataMap[normalizedName];
    }

    if (normalizedDataMap[originalName.toLowerCase()] !== undefined) {
        return normalizedDataMap[originalName.toLowerCase()];
    }

    const aliases = {
        'family_name': ['surname', 'last_name', 'family_name'],
        'surname': ['surname', 'last_name', 'family_name'],
        'last_name': ['surname', 'last_name', 'family_name'],
        'given_name': ['given_names', 'first_name', 'given_name', 'prenom'],
        'given_names': ['given_names', 'first_name', 'given_name'],
        'first_name': ['given_names', 'first_name', 'given_name'],
        'date_of_birth': ['date_of_birth', 'dob', 'birth_date', 'birthdate'],
        'dob': ['date_of_birth', 'dob', 'birth_date'],
        'birth_date': ['date_of_birth', 'dob', 'birth_date'],
        'passport_no': ['passport_number', 'passport_no', 'document_number'],
        'passport_number': ['passport_number', 'passport_no', 'document_number'],
        'country_of_citizenship': ['nationality', 'citizenship', 'country_of_citizenship'],
        'nationality': ['nationality', 'citizenship', 'country_of_citizenship'],
        'sex': ['sex', 'gender'],
        'gender': ['sex', 'gender'],
        'telephone': ['phone', 'telephone', 'tel', 'mobile'],
        'phone': ['phone', 'telephone', 'tel', 'mobile'],
        'email_address': ['email', 'email_address'],
        'email': ['email', 'email_address'],
        'mailing_address': ['address', 'mailing_address', 'residential_address'],
        'address': ['address', 'mailing_address', 'residential_address'],
        'marital_status': ['marital_status', 'civil_status'],
        'place_of_birth': ['place_of_birth', 'birth_place', 'city_of_birth'],
        'country_of_birth': ['place_of_birth', 'country_of_birth'],
        'occupation': ['occupation', 'profession', 'job_title'],
        'full_name': ['full_name', 'name', 'applicant_name'],
    };

    const possibleAliases = aliases[normalizedName] || [];
    for (const alias of possibleAliases) {
        if (normalizedDataMap[alias] !== undefined) {
            return normalizedDataMap[alias];
        }
    }

    for (const [key, value] of Object.entries(normalizedDataMap)) {
        if (normalizedName.includes(key) || key.includes(normalizedName)) {
            if (key.length > 2 && normalizedName.length > 2) {
                return value;
            }
        }
    }

    return null;
}

module.exports = { analyzeFormFields, fillPDFForm };
