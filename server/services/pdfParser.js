const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Extract text from a PDF file and attempt to parse common immigration document patterns.
 * Returns extraction results including whether the document had extractable text.
 */
async function extractTextFromPDF(filePath) {
    const buffer = fs.readFileSync(filePath);

    let text = '';
    let numpages = 0;

    try {
        const data = await pdfParse(buffer);
        text = (data.text || '').trim();
        numpages = data.numpages || 0;
    } catch (e) {
        console.warn('pdf-parse error:', e.message);
    }

    const isImageOnly = text.length < 20;
    const extractedData = isImageOnly ? {} : parseImmigrationData(text);

    return {
        text,
        data: extractedData,
        pages: numpages,
        isImageOnly,
        textLength: text.length
    };
}

/**
 * Parse common immigration document patterns from extracted text.
 * Enhanced with more patterns and better data cleaning.
 */
function parseImmigrationData(text) {
    const data = {};
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const fullText = lines.join(' ');

    // Pattern groups - each group has a key and multiple possible patterns
    const patternGroups = [
        // Name patterns
        {
            key: 'surname', patterns: [
                /(?:surname|family\s*name|last\s*name|nom\s*de\s*famille)[:\s]*([A-Za-z\s'\u2019-]+?)(?:\s{2,}|$|\n)/i,
                /(?:surname|family\s*name|last\s*name)[:\s]+([A-Z][A-Za-z'-]+)/i
            ]
        },
        {
            key: 'given_names', patterns: [
                /(?:given\s*names?|first\s*name|pr[eé]nom)[:\s]*([A-Za-z\s'\u2019-]+?)(?:\s{2,}|$|\n)/i,
                /(?:given\s*names?|first\s*name)[:\s]+([A-Z][A-Za-z\s'-]+)/i
            ]
        },
        {
            key: 'full_name', patterns: [
                /(?:full\s*name|name\s*of\s*applicant|applicant\s*name|name\s*of\s*employee|employee\s*name)[:\s]*([A-Za-z\s'\u2019-]+?)(?:\s{2,}|$|\n)/i,
                /(?:Name|NAME)[:\s]+([A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+)/
            ]
        },

        // Passport / ID
        {
            key: 'passport_number', patterns: [
                /(?:passport\s*(?:no\.?|number|#|num))[:\s]*([A-Z]{1,2}\d{5,9})/i,
                /(?:passport\s*(?:no\.?|number))[:\s]*([A-Z0-9]{6,12})/i
            ]
        },
        { key: 'document_number', patterns: [/(?:document\s*(?:no\.?|number|#))[:\s]*([A-Z0-9]+)/i] },

        // Date of Birth
        {
            key: 'date_of_birth', patterns: [
                /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date|born\s*(?:on)?)[:\s]*((?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}))/i,
                /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date|born\s*(?:on)?)[:\s]*(\d{1,2}\s+\w+[\s,]+\d{4})/i,
                /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date)[:\s]*(\w+\s+\d{1,2}[\s,]+\d{4})/i
            ]
        },

        // Date of Marriage
        {
            key: 'date_of_marriage', patterns: [
                /(?:date\s*of\s*marriage|marriage\s*date|married\s*on)[:\s]*((?:\w+\s+\d{1,2}[\s,]+\d{4}))/i,
                /(?:date\s*of\s*marriage|marriage\s*date)[:\s]*((?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}))/i
            ]
        },

        // Place of Birth
        {
            key: 'place_of_birth', patterns: [
                /(?:place\s*of\s*birth|birth\s*place|born\s*(?:in|at))[:\s]*([A-Za-z\s,'\u2019-]+?)(?:\s{2,}|$|\n)/i
            ]
        },

        // Nationality / Citizenship
        {
            key: 'nationality', patterns: [
                /(?:nationality|citizenship|citizen\s*of|country\s*of\s*citizenship)[:\s]*([A-Za-z\s]+?)(?:\s{2,}|$|\n)/i
            ]
        },

        // Gender / Sex
        { key: 'sex', patterns: [/(?:sex|gender)[:\s]*(male|female|m|f)\b/i] },

        // Dates of issue/expiry
        {
            key: 'date_of_issue', patterns: [
                /(?:date\s*of\s*issue|issued?\s*(?:on|date)|issue\s*date)[:\s]*((?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}))/i,
                /(?:date\s*of\s*issue|issued?\s*(?:on|date))[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i
            ]
        },
        {
            key: 'date_of_expiry', patterns: [
                /(?:date\s*of\s*expir(?:y|ation)|expir(?:y|es|ation)\s*date|valid\s*until)[:\s]*((?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}))/i,
                /(?:date\s*of\s*expir(?:y|ation)|expir(?:y|es|ation)\s*date)[:\s]*(\d{1,2}\s+\w+\s+\d{4})/i
            ]
        },

        // Address
        {
            key: 'address', patterns: [
                /(?:address|residence|residential\s*address|mailing\s*address)[:\s]*(.{10,80})/i
            ]
        },

        // Contact
        {
            key: 'email', patterns: [
                /(?:e-?mail\s*(?:address)?)[:\s]*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
                /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/
            ]
        },
        {
            key: 'phone', patterns: [
                /(?:phone|telephone|tel|mobile|cell)[:\s]*([+\d\s()\-]{7,20})/i
            ]
        },

        // Marital Status
        {
            key: 'marital_status', patterns: [
                /(?:marital\s*status|civil\s*status)[:\s]*(single|married|divorced|widowed|separated|common.?law)/i
            ]
        },

        // Occupation
        {
            key: 'occupation', patterns: [
                /(?:occupation|profession|job\s*title|designation)[:\s]*([A-Za-z\s'\u2019\-]+?)(?:\s{2,}|$|\n)/i
            ]
        },

        // Country of Residence
        {
            key: 'country_of_residence', patterns: [
                /(?:country\s*of\s*residence|residing\s*in|current\s*country)[:\s]*([A-Za-z\s]+?)(?:\s{2,}|$|\n)/i
            ]
        },

        // Education - WES Assessment
        {
            key: 'education_level', patterns: [
                /(?:canadian\s*equivalen(?:cy|ce)\s*(?:summary)?)[:\s]*((?:master|bachelor|doctor|diploma|certificate)[\w'\s]*(?:degree)?)/i,
                /(?:equivalen(?:cy|ce))[:\s]*((?:master|bachelor|doctor|diploma|certificate)[\w'\s]*(?:degree)?)/i
            ]
        },

        // Employer
        {
            key: 'employer_name', patterns: [
                /(?:employer|company\s*name|organization)[:\s]*([A-Za-z\s.&,'\u2019-]+?)(?:\s{2,}|$|\n)/i
            ]
        },

        // Pay/salary info
        {
            key: 'salary', patterns: [
                /(?:gross\s*(?:pay|salary|earnings)|total\s*(?:pay|earnings)|annual\s*salary)[:\s]*\$?([\d,.]+)/i
            ]
        },

        // LMIA / work permit specific
        { key: 'lmia_number', patterns: [/(?:lmia\s*(?:no\.?|number|#))[:\s]*([A-Z0-9\-]+)/i] },
        { key: 'noc_code', patterns: [/(?:noc\s*(?:code|no\.?|number)?)[:\s]*(\d{4,5})/i] },
    ];

    for (const { key, patterns: pats } of patternGroups) {
        for (const pat of pats) {
            const match = fullText.match(pat);
            if (match && match[1]) {
                let value = match[1].trim();
                // Clean up trailing punctuation and whitespace
                value = value.replace(/[,;:.\s]+$/, '').trim();
                if (value.length > 0 && value.length < 200) {
                    data[key] = value;
                    break;
                }
            }
        }
    }

    // Also try line-by-line extraction for structured documents
    extractLineByLine(lines, data);

    return data;
}

/**
 * Line-by-line extraction for structured documents (paystubs, certificates, etc.)
 */
function extractLineByLine(lines, data) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

        // Name on multi-line "Label\nValue" format
        if (/^(?:Name|Employee|Applicant)\s*$/i.test(line) && nextLine.length > 2) {
            if (!data['full_name'] && /^[A-Z][a-z]+/.test(nextLine)) {
                data['full_name'] = nextLine.trim();
            }
        }

        // Address detection from paystub
        const addressMatch = line.match(/^(\d+[\w\s\-]+(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|way|lane|ln|crescent|cr|range|road)[\w\s,]*)/i);
        if (addressMatch && !data['address']) {
            let addr = addressMatch[1].trim();
            // Check if next line has city/province
            if (nextLine && /\b(?:AB|BC|ON|QC|MB|SK|NS|NB|PE|NL|NT|YT|NU)\b/.test(nextLine)) {
                addr += ', ' + nextLine.trim();
            }
            data['address'] = addr;
        }

        // Province detector
        const provMatch = line.match(/\b(Alberta|British Columbia|Ontario|Quebec|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Prince Edward Island|Newfoundland)\b/i);
        if (provMatch && !data['province']) {
            data['province'] = provMatch[1];
        }

        // Canadian postal code
        const postalMatch = line.match(/\b([A-Z]\d[A-Z]\s*\d[A-Z]\d)\b/i);
        if (postalMatch && !data['postal_code']) {
            data['postal_code'] = postalMatch[1].toUpperCase();
        }

        // SIN detection (redacted for privacy but mark as present)
        if (/\b\d{3}[\s-]\d{3}[\s-]\d{3}\b/.test(line) && !data['sin_present']) {
            data['sin_present'] = 'Yes (detected, not stored for privacy)';
        }

        // Name from credential analysis (WES style)
        const credNameMatch = line.match(/(?:Name on Credential|Name)[:\s]*([A-Z]{2,}(?:\s*,\s*[A-Z][A-Za-z]+)?)/);
        if (credNameMatch && !data['surname']) {
            const parts = credNameMatch[1].split(',').map(s => s.trim());
            if (parts.length >= 2) {
                data['surname'] = parts[0];
                data['given_names'] = parts[1];
            } else if (parts[0]) {
                data['surname'] = parts[0];
            }
        }

        // Marriage certificate data
        const marriageDateMatch = line.match(/Date of Marriage\s*:\s*(.+)/i);
        if (marriageDateMatch) data['date_of_marriage'] = marriageDateMatch[1].trim();

        const marriagePlaceMatch = line.match(/Place of Marriage\s*:\s*(.+)/i);
        if (marriagePlaceMatch) data['place_of_marriage'] = marriagePlaceMatch[1].trim();
    }
}

module.exports = { extractTextFromPDF };
