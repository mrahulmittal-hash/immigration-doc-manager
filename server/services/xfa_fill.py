#!/usr/bin/env python3
"""
xfa_fill.py — Fill XFA-based IRCC PDF forms using pikepdf.

Usage:
  python xfa_fill.py <template_pdf> <data_json> <output_pdf>

Reads the XFA datasets XML from the template PDF, fills fields using
the data map from the JSON file, writes the result preserving the
original form structure so it can be uploaded to IRCC.
"""

import sys
import json
import re
import pikepdf

# ── Field name aliases (XFA element name → possible data keys) ────────
ALIASES = {
    'familyname':           ['last_name', 'lastName', 'surname', 'family_name'],
    'givenname':            ['first_name', 'firstName', 'given_name', 'given_names'],
    'dobyear':              ['date_of_birth_year', 'DOBYear'],
    'dobmonth':             ['date_of_birth_month', 'DOBMonth'],
    'dobday':               ['date_of_birth_day', 'DOBDay'],
    'placebirthcity':       ['place_of_birth', 'placeOfBirth', 'city_of_birth'],
    'placebirthcountry':    ['country_of_birth', 'countryOfBirth', 'passportCountry'],
    'citizenship':          ['nationality', 'citizenship', 'country_of_citizenship'],
    'passportnum':          ['passport_number', 'passportNumber', 'passport_no'],
    'countryofissue':       ['passportCountry', 'passport_country', 'nationality'],
    'nativelang':           ['native_language', 'nativeLanguage'],
    'sex':                  ['sex', 'gender'],
    'maritalstatus':        ['marital_status', 'maritalStatus'],
    'email':                ['email', 'email_address'],
    'phone':                ['phone', 'telephone', 'mobile'],
    'currentmailingaddress':['address', 'mailing_address'],
    'residentialaddress':   ['address', 'residential_address'],
    'occupation':           ['occupation', 'job_title', 'profession'],
    'eyecolour':            ['eyeColour', 'eye_colour', 'eye_color'],
    'height':               ['height'],
    'visatype':             ['purposeOfVisit', 'visa_type', 'purpose_of_visit'],
    'servicein':            ['preferred_language'],
    'aliasfamilyname':      ['alias_last_name', 'aliasLastName'],
    'aliasgivenname':       ['alias_first_name', 'aliasFirstName'],
    'dateofmarriage':       ['spouseMarriageDate', 'marriage_date'],
    'pmfamilyname':         ['prevSpouseLastName', 'prev_spouse_last_name'],
    'pmgivenname':          ['prevSpouseFirstName', 'prev_spouse_first_name'],
}

# Parent context aliases — when a field is nested inside a specific parent
CONTEXT_ALIASES = {
    # Page1 > MaritalStatus > SectionA > FamilyName = spouse family name
    ('MaritalStatus', 'FamilyName'):  ['spouseLastName', 'spouse_last_name'],
    ('MaritalStatus', 'GivenName'):   ['spouseFirstName', 'spouse_first_name'],
    # Page2 > PrevSpouseDOB > DOBYear etc.
    ('PrevSpouseDOB', 'DOBYear'):     ['prevSpouseDOBYear'],
    ('PrevSpouseDOB', 'DOBMonth'):    ['prevSpouseDOBMonth'],
    ('PrevSpouseDOB', 'DOBDay'):      ['prevSpouseDOBDay'],
}


def normalize(name):
    """Normalize a field name for matching."""
    # CamelCase → snake_case
    s = re.sub(r'([a-z])([A-Z])', r'\1_\2', name)
    return re.sub(r'[^a-z0-9]', '', s.lower())


def resolve_value(element_name, parent_name, data):
    """Find the best matching value from the data map."""
    # 1) Context-specific match
    ctx_key = (parent_name, element_name)
    for alias in CONTEXT_ALIASES.get(ctx_key, []):
        if alias in data and data[alias]:
            return data[alias]

    # 2) Direct match
    if element_name in data and data[element_name]:
        return data[element_name]

    # 3) Case-insensitive match
    lower = element_name.lower()
    for k, v in data.items():
        if k.lower() == lower and v:
            return v

    # 4) Alias match
    norm = normalize(element_name)
    for alias in ALIASES.get(norm, []):
        if alias in data and data[alias]:
            return data[alias]
        for k, v in data.items():
            if k.lower() == alias.lower() and v:
                return v

    # 5) Normalized match
    for k, v in data.items():
        if normalize(k) == norm and v:
            return v

    return None


def fill_xml(xml_text, data):
    """
    Fill XFA datasets XML fields with values from data map.
    Returns (modified_xml, fields_filled, fields_total, filled_names).
    """
    fields_filled = 0
    fields_total = 0
    filled_names = []

    # Track parent context for context-aware matching
    parent_stack = []

    def replace_element(match):
        nonlocal fields_filled, fields_total
        full_match = match.group(0)
        tag_name = match.group(1)
        attrs = match.group(2) or ''

        # Skip structural/namespace elements
        skip_tags = {'xfa:datasets', 'xfa:data', 'LOVFile', 'LOV', 'form1',
                     'SectionHeader', 'Header', 'Barcodes', 'ReaderInfo', 'Disclosure'}
        if tag_name in skip_tags or tag_name.endswith('List') or 'lic=' in attrs:
            return full_match

        # Skip dataNode="dataGroup" markers
        if 'dataNode="dataGroup"' in attrs:
            return full_match

        fields_total += 1

        # Determine parent context
        parent = parent_stack[-1] if parent_stack else ''
        value = resolve_value(tag_name, parent, data)

        if value:
            fields_filled += 1
            filled_names.append(tag_name)
            escaped = (str(value)
                       .replace('&', '&amp;')
                       .replace('<', '&lt;')
                       .replace('>', '&gt;'))
            return f'<{tag_name}{attrs}>{escaped}</{tag_name}>'

        return full_match

    # Process self-closing empty field tags: <FieldName\n/>
    # The IMM5257 XML uses newlines before /> for self-closing tags
    result = re.sub(
        r'<([A-Za-z][\w]*)((?:\s+[^>]*?)?)\s*/>',
        replace_element,
        xml_text
    )

    # Also handle self-closing with newline: <Tag\n/>
    result = re.sub(
        r'<([A-Za-z][\w]*)((?:\s+[^>]*?)?)\n/>',
        replace_element,
        result
    )

    return result, fields_filled, fields_total, filled_names


def extract_date_parts(data):
    """Extract year/month/day from date fields and add them to the data map."""
    date_fields = {
        'date_of_birth': ('DOBYear', 'DOBMonth', 'DOBDay'),
        'dob': ('DOBYear', 'DOBMonth', 'DOBDay'),
        'passportIssueDate': ('IssueYYYY', 'IssueMM', 'IssueDD'),
        'passport_issue_date': ('IssueYYYY', 'IssueMM', 'IssueDD'),
        'passportExpiryDate': ('expiryYYYY', 'expiryMM', 'expiryDD'),
        'passport_expiry_date': ('expiryYYYY', 'expiryMM', 'expiryDD'),
        'spouseMarriageDate': ('FromYr', 'FromMM', 'FromDD'),
    }

    for src_key, (yr_key, mo_key, day_key) in date_fields.items():
        val = data.get(src_key, '')
        if val and '-' in val:
            parts = val.split('-')
            if len(parts) >= 3:
                if yr_key not in data or not data[yr_key]:
                    data[yr_key] = parts[0]
                if mo_key not in data or not data[mo_key]:
                    data[mo_key] = parts[1]
                if day_key not in data or not data[day_key]:
                    data[day_key] = parts[2]


def main():
    if len(sys.argv) != 4:
        print(json.dumps({'error': 'Usage: xfa_fill.py <template> <data.json> <output>'}))
        sys.exit(1)

    template_path = sys.argv[1]
    data_path = sys.argv[2]
    output_path = sys.argv[3]

    # Load data
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Pre-process: extract date components
    extract_date_parts(data)

    try:
        pdf = pikepdf.open(template_path)
    except Exception as e:
        print(json.dumps({'error': f'Cannot open PDF: {str(e)}'}))
        sys.exit(1)

    # Check for XFA
    try:
        xfa = pdf.Root['/AcroForm']['/XFA']
    except Exception:
        print(json.dumps({'error': 'PDF does not contain XFA data'}))
        sys.exit(1)

    # Find datasets stream index
    datasets_idx = None
    i = 0
    while True:
        try:
            name = str(xfa[i])
            if 'datasets' in name.lower():
                datasets_idx = i + 1
                break
            i += 2
        except IndexError:
            break

    if datasets_idx is None:
        print(json.dumps({'error': 'No datasets stream found in XFA'}))
        sys.exit(1)

    # Read datasets XML
    datasets_stream = xfa[datasets_idx]
    datasets_bytes = bytes(datasets_stream)
    datasets_xml = datasets_bytes.decode('utf-8', errors='replace')

    # Fill fields
    modified_xml, filled, total, filled_names = fill_xml(datasets_xml, data)

    # Write modified datasets back
    new_stream = pikepdf.Stream(pdf, modified_xml.encode('utf-8'))
    xfa[datasets_idx] = pdf.make_indirect(new_stream)

    # Remove NeedsRendering flag
    try:
        if '/NeedsRendering' in pdf.Root:
            del pdf.Root['/NeedsRendering']
    except Exception:
        pass

    # Save
    pdf.save(output_path)
    pdf.close()

    result = {
        'success': True,
        'fieldsFilled': filled,
        'fieldsTotal': total,
        'filledFields': filled_names[:50],  # Limit output size
        'method': 'xfa-pikepdf',
    }
    print(json.dumps(result))


if __name__ == '__main__':
    main()
