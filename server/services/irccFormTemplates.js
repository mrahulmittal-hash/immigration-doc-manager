/**
 * IRCC Form Templates — maps visa types to their required official IRCC forms.
 * Each form includes the form number, name, URL, and a field mapping that maps
 * IRCC field names → client_data / client profile field keys.
 */

const IRCC_FORMS = {
  'Express Entry': [
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOBYear': { source: 'date_of_birth', transform: 'year' },
        'DOBMonth': { source: 'date_of_birth', transform: 'month' },
        'DOBDay': { source: 'date_of_birth', transform: 'day' },
        'PlaceOfBirth': 'place_of_birth',
        'Sex': 'sex',
        'MaritalStatus': 'marital_status',
        'Nationality': 'nationality',
        'CountryOfBirth': 'country_of_birth',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
        'MailingAddress': 'address',
        'Occupation': 'occupation',
      }
    },
    {
      form_number: 'IMM 0008 Schedule A',
      name: 'Background/Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008_schedule_a.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfCitizenship': 'nationality',
      }
    },
    {
      form_number: 'IMM 5669',
      name: 'Schedule A – Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5669e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
        'UCI': 'uci_number',
      }
    },
    {
      form_number: 'IMM 5406',
      name: 'Additional Family Information',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5406e.pdf',
      category: 'family',
      field_mappings: {
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenNames': 'first_name',
        'ApplicantDOB': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5562',
      name: 'Supplementary Information – Your Travels',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5562e.pdf',
      category: 'travel',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
      }
    },
  ],

  'Study Permit': [
    {
      form_number: 'IMM 1294',
      name: 'Application for Study Permit',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm1294e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfBirth': 'country_of_birth',
        'CountryOfCitizenship': 'nationality',
        'PassportNumber': 'passport_number',
        'MaritalStatus': 'marital_status',
        'Email': 'email',
        'Phone': 'phone',
        'DLI': 'institution',
        'FieldOfStudy': 'Program',
      }
    },
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 5645',
      name: 'Family Information Form',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5645e.pdf',
      category: 'family',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
  ],

  'Work Permit (PGWP)': [
    {
      form_number: 'IMM 1295',
      name: 'Application for Work Permit',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm1295e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfCitizenship': 'nationality',
        'PassportNumber': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
        'Employer': 'Employer',
        'JobTitle': 'occupation',
      }
    },
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
      }
    },
    {
      form_number: 'IMM 5645',
      name: 'Family Information Form',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5645e.pdf',
      category: 'family',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
  ],

  'Spousal Sponsorship': [
    {
      form_number: 'IMM 1344',
      name: 'Sponsorship Agreement and Undertaking',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm1344e.pdf',
      category: 'sponsorship',
      field_mappings: {
        'SponsorFamilyName': 'sponsor_last_name',
        'SponsorGivenName': 'sponsor_first_name',
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenName': 'first_name',
      }
    },
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 5532',
      name: 'Relationship Information and Sponsorship Evaluation',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5532e.pdf',
      category: 'relationship',
      field_mappings: {
        'SponsorFamilyName': 'sponsor_last_name',
        'SponsorGivenName': 'sponsor_first_name',
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenName': 'first_name',
        'DateOfMarriage': 'marriage_date',
      }
    },
    {
      form_number: 'IMM 5406',
      name: 'Additional Family Information',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5406e.pdf',
      category: 'family',
      field_mappings: {
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenNames': 'first_name',
      }
    },
    {
      form_number: 'IMM 5669',
      name: 'Schedule A – Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5669e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
  ],

  'PR Application': [
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 5669',
      name: 'Schedule A – Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5669e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5406',
      name: 'Additional Family Information',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5406e.pdf',
      category: 'family',
      field_mappings: {
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenNames': 'first_name',
      }
    },
    {
      form_number: 'IMM 5562',
      name: 'Supplementary Information – Your Travels',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5562e.pdf',
      category: 'travel',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
      }
    },
  ],

  'Work Permit (LMIA)': [
    {
      form_number: 'IMM 1295',
      name: 'Application for Work Permit',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm1295e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfCitizenship': 'nationality',
        'PassportNumber': 'passport_number',
        'Email': 'email',
        'Employer': 'Employer',
        'JobTitle': 'occupation',
        'LMIANumber': 'lmia_number',
      }
    },
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
      }
    },
  ],

  'Visitor Visa (TRV)': [
    {
      form_number: 'IMM 5257',
      name: 'Application for Temporary Resident Visa',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5257e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfBirth': 'country_of_birth',
        'CountryOfCitizenship': 'nationality',
        'PassportNumber': 'passport_number',
        'MaritalStatus': 'marital_status',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 5645',
      name: 'Family Information Form',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5645e.pdf',
      category: 'family',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
  ],

  'Refugee Claim': [
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 0008 Schedule 12',
      name: 'Additional Information – Refugee Claimants',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008_schedule12.pdf',
      category: 'refugee',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
      }
    },
    {
      form_number: 'IMM 5669',
      name: 'Schedule A – Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5669e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
  ],

  'Parent/Grandparent Sponsorship': [
    {
      form_number: 'IMM 1344',
      name: 'Sponsorship Agreement and Undertaking',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm1344e.pdf',
      category: 'sponsorship',
      field_mappings: {
        'SponsorFamilyName': 'sponsor_last_name',
        'SponsorGivenName': 'sponsor_first_name',
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenName': 'first_name',
      }
    },
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 5406',
      name: 'Additional Family Information',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5406e.pdf',
      category: 'family',
      field_mappings: {
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenNames': 'first_name',
        'ApplicantDOB': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5669',
      name: 'Schedule A – Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5669e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5768',
      name: 'Financial Evaluation for Parents and Grandparents Sponsorship',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5768e.pdf',
      category: 'sponsorship',
      field_mappings: {
        'SponsorFamilyName': 'sponsor_last_name',
        'SponsorGivenName': 'sponsor_first_name',
      }
    },
  ],

  'Super Visa': [
    {
      form_number: 'IMM 5257',
      name: 'Application for Temporary Resident Visa',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5257e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfBirth': 'country_of_birth',
        'CountryOfCitizenship': 'nationality',
        'PassportNumber': 'passport_number',
        'MaritalStatus': 'marital_status',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 5645',
      name: 'Family Information Form',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5645e.pdf',
      category: 'family',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5476',
      name: 'Use of a Representative',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5476e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
      }
    },
  ],

  'Citizenship Application': [
    {
      form_number: 'CIT 0002',
      name: 'Application for Canadian Citizenship – Adults',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/citizen/cit0002e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfBirth': 'country_of_birth',
        'Nationality': 'nationality',
        'PassportNumber': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
        'Address': 'address',
        'Sex': 'sex',
        'MaritalStatus': 'marital_status',
      }
    },
    {
      form_number: 'CIT 0007',
      name: 'Document Checklist – Adults',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/citizen/cit0007e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
      }
    },
  ],

  'LMIA Application': [
    {
      form_number: 'EMP 5593',
      name: 'Labour Market Impact Assessment Application',
      url: 'https://www.canada.ca/content/dam/esdc-edsc/documents/services/foreign-workers/form/emp5593.pdf',
      category: 'primary',
      field_mappings: {
        'EmployerName': 'employer_name',
        'BusinessAddress': 'business_address',
        'JobTitle': 'occupation',
        'WorkerFamilyName': 'last_name',
        'WorkerGivenName': 'first_name',
        'WorkerNationality': 'nationality',
      }
    },
    {
      form_number: 'EMP 5575',
      name: 'Schedule B – LMIA Application',
      url: 'https://www.canada.ca/content/dam/esdc-edsc/documents/services/foreign-workers/form/emp5575.pdf',
      category: 'primary',
      field_mappings: {
        'EmployerName': 'employer_name',
        'JobTitle': 'occupation',
      }
    },
  ],

  'Provincial Nominee (PNP)': [
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOBYear': { source: 'date_of_birth', transform: 'year' },
        'DOBMonth': { source: 'date_of_birth', transform: 'month' },
        'DOBDay': { source: 'date_of_birth', transform: 'day' },
        'PlaceOfBirth': 'place_of_birth',
        'Sex': 'sex',
        'MaritalStatus': 'marital_status',
        'Nationality': 'nationality',
        'CountryOfBirth': 'country_of_birth',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
        'MailingAddress': 'address',
        'Occupation': 'occupation',
      }
    },
    {
      form_number: 'IMM 0008 Schedule A',
      name: 'Background/Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008_schedule_a.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfCitizenship': 'nationality',
      }
    },
    {
      form_number: 'IMM 5669',
      name: 'Schedule A – Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5669e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
        'UCI': 'uci_number',
      }
    },
    {
      form_number: 'IMM 5406',
      name: 'Additional Family Information',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5406e.pdf',
      category: 'family',
      field_mappings: {
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenNames': 'first_name',
        'ApplicantDOB': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5562',
      name: 'Supplementary Information – Your Travels',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5562e.pdf',
      category: 'travel',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
      }
    },
  ],

  'PR Card Renewal': [
    {
      form_number: 'IMM 5444',
      name: 'Application for Permanent Resident Card',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5444e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfBirth': 'country_of_birth',
        'Nationality': 'nationality',
        'PassportNumber': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
        'Address': 'address',
        'Sex': 'sex',
      }
    },
    {
      form_number: 'IMM 5406',
      name: 'Additional Family Information',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5406e.pdf',
      category: 'family',
      field_mappings: {
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenNames': 'first_name',
        'ApplicantDOB': 'date_of_birth',
      }
    },
  ],

  'eTA': [
    {
      form_number: 'eTA Online',
      name: 'Electronic Travel Authorization (Online Application)',
      url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfBirth': 'country_of_birth',
        'Nationality': 'nationality',
        'PassportNumber': 'passport_number',
        'Email': 'email',
      }
    },
  ],

  'Open Work Permit': [
    {
      form_number: 'IMM 1295',
      name: 'Application for Work Permit',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm1295e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfCitizenship': 'nationality',
        'PassportNumber': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
      }
    },
    {
      form_number: 'IMM 5645',
      name: 'Family Information Form',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5645e.pdf',
      category: 'family',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
  ],

  'Atlantic Immigration (AIP)': [
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOBYear': { source: 'date_of_birth', transform: 'year' },
        'DOBMonth': { source: 'date_of_birth', transform: 'month' },
        'DOBDay': { source: 'date_of_birth', transform: 'day' },
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
        'Occupation': 'occupation',
      }
    },
    {
      form_number: 'IMM 0008 Schedule A',
      name: 'Background/Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008_schedule_a.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfCitizenship': 'nationality',
      }
    },
    {
      form_number: 'IMM 5669',
      name: 'Schedule A – Declaration',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5669e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5406',
      name: 'Additional Family Information',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5406e.pdf',
      category: 'family',
      field_mappings: {
        'ApplicantFamilyName': 'last_name',
        'ApplicantGivenNames': 'first_name',
        'ApplicantDOB': 'date_of_birth',
      }
    },
  ],

  'IEC (Working Holiday)': [
    {
      form_number: 'IMM 1295',
      name: 'Application for Work Permit',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm1295e.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'CountryOfCitizenship': 'nationality',
        'PassportNumber': 'passport_number',
        'Email': 'email',
        'Phone': 'phone',
      }
    },
    {
      form_number: 'IMM 0008',
      name: 'Generic Application Form for Canada',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm0008enu_2d.pdf',
      category: 'primary',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
        'Nationality': 'nationality',
        'PassportNo': 'passport_number',
      }
    },
    {
      form_number: 'IMM 5645',
      name: 'Family Information Form',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5645e.pdf',
      category: 'family',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenNames': 'first_name',
        'DateOfBirth': 'date_of_birth',
      }
    },
    {
      form_number: 'IMM 5476',
      name: 'Use of a Representative',
      url: 'https://www.canada.ca/content/dam/ircc/migration/ircc/english/pdf/kits/forms/imm5476e.pdf',
      category: 'declaration',
      field_mappings: {
        'FamilyName': 'last_name',
        'GivenName': 'first_name',
        'DOB': 'date_of_birth',
      }
    },
  ],
};

/**
 * Get the list of required IRCC forms for a given visa type
 */
function getFormsForVisaType(visaType) {
  return IRCC_FORMS[visaType] || IRCC_FORMS['Express Entry'];
}

/**
 * Get all supported visa types
 */
function getSupportedVisaTypes() {
  return Object.keys(IRCC_FORMS);
}

/**
 * Apply date transforms for field mappings
 */
function applyTransform(value, transform) {
  if (!value) return '';
  if (transform === 'year') {
    const parts = value.split('-');
    return parts[0] || '';
  }
  if (transform === 'month') {
    const parts = value.split('-');
    return parts[1] || '';
  }
  if (transform === 'day') {
    const parts = value.split('-');
    return parts[2] || '';
  }
  return value;
}

/**
 * Build a data map for a specific IRCC form using client data
 */
function buildFormDataMap(formTemplate, clientDataMap) {
  const result = {};
  for (const [formField, mapping] of Object.entries(formTemplate.field_mappings)) {
    if (typeof mapping === 'string') {
      result[formField] = clientDataMap[mapping] || '';
    } else if (typeof mapping === 'object' && mapping.source) {
      const rawValue = clientDataMap[mapping.source] || '';
      result[formField] = mapping.transform ? applyTransform(rawValue, mapping.transform) : rawValue;
    }
  }
  return result;
}

module.exports = { getFormsForVisaType, getSupportedVisaTypes, buildFormDataMap, IRCC_FORMS };
