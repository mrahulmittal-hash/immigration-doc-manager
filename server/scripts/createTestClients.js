/**
 * Create two test client profiles from PIF form data.
 * Run once: node scripts/createTestClients.js
 */
require('dotenv').config();
const { prepareGet, prepareRun } = require('../database');
const { createWorkflowTask } = require('../services/autoTaskService');
const { v4: uuidv4 } = require('uuid');

async function main() {
  console.log('Creating test clients from PIF form data...\n');

  // ===== CLIENT 1: Neeraj Dahiya =====
  const token1 = uuidv4();
  const r1 = await prepareRun(
    `INSERT INTO clients (first_name, last_name, email, phone, nationality, date_of_birth, passport_number, visa_type, status, notes, form_token, pif_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'Neeraj', 'Dahiya', 'Neeraj.dahiya93@gmail.com', '+13688891876', 'Indian', '1993-10-06',
    'Y4366754', 'Work Permit', 'active',
    'First entry: Nov 9, 2024 (Calgary). Last entry: Jun 23, 2025 (Edmonton). Biometrics done. Married. IELTS: L9 R7 W8 S8 Overall 8.',
    token1, 'completed'
  );
  const client1 = await prepareGet('SELECT * FROM clients WHERE id = ?', r1.lastInsertRowid);
  console.log(`✅ Created Client 1: ID=${client1.id} — ${client1.first_name} ${client1.last_name}`);

  // PIF data for Neeraj
  const pif1 = {
    firstName: 'Neeraj',
    lastName: 'Dahiya',
    dob: '1993-10-06',
    placeOfBirth: 'Delhi',
    nationality: 'Indian',
    gender: 'Male',
    eyeColour: 'Black',
    height: '172.72cm (5ft 8in)',
    appliedBeforeDetails: 'No',
    refusedBeforeDetails: 'No',
    medicalExamDetails: 'No',
    firstEntryDate: '2024-11-09',
    placeOfEntry: 'Calgary',
    purposeOfVisit: 'Work Permit',
    lastEntryDate: '2025-06-23',
    lastEntryPlace: 'Edmonton',
    passportNumber: 'Y4366754',
    passportIssueDate: '2024-07-18',
    passportExpiryDate: '2034-07-17',
    passportCountry: 'India',
    maritalStatus: 'Married',
    spouseMarriageDate: '2019-02-22',
    spouseFirstName: 'Monika',
    spouseLastName: '',
    spouseDob: '1994-02-26',
    spousePlaceOfBirth: 'Jassia',
    spouseOccupation: 'Homemaker',
    spouseAddress: '1028 Knottwood Rd E Northwest, Edmonton, AB T6K 3R4',
    prevMarriageDate: '',
    prevMarriageEndDate: '',
    prevSpouseFirstName: '',
    prevSpouseLastName: '',
    prevSpouseDob: '',
    motherFirstName: 'Nirmala',
    motherLastName: 'Devi',
    motherDob: '1970-01-01',
    motherDeathDate: '',
    motherPlaceOfBirth: 'Haryana',
    motherOccupation: 'Homemaker',
    motherAddress: 'B-5 Inderprastha Colony, Rohtak, Haryana - Pin 124001',
    fatherFirstName: 'Raj Singh',
    fatherLastName: 'Dahiya',
    fatherDob: '1955-03-04',
    fatherDeathDate: '',
    fatherPlaceOfBirth: 'Haryana',
    fatherOccupation: 'Retd. Haryana Govt Employee',
    fatherAddress: 'B-5 Inderprastha Colony, Rohtak, Haryana - Pin 124001',
    ieltsListening: '9',
    ieltsReading: '7',
    ieltsWriting: '8',
    ieltsSpeaking: '8',
    ieltsOverall: '8',
    education: [
      { from: '2011-08', to: '2014-05', institute: 'AIJHM College, MD University', city: 'Rohtak', field: 'Bachelor of Science' },
      { from: '2015-05', to: '2018-09', institute: 'Vellore Institute of Technology', city: 'Hyderabad', field: 'M.Tech Integrated (IT)' }
    ],
    work: [
      { from: '2018-11-01', to: '2023-12-01', jobTitle: 'Senior Project Engineer', city: 'Hyderabad', country: 'India', companyName: 'Wipro Limited' },
      { from: '2023-12-01', to: '2024-11-08', jobTitle: 'Technical Lead', city: 'Gurugram', country: 'India', companyName: 'Wipro Limited' },
      { from: '2024-11-09', to: 'Present', jobTitle: 'Information Systems Specialist', city: 'Calgary', country: 'Canada', companyName: 'Wipro Limited' }
    ],
    children: [
      { firstName: 'Ishanvi', lastName: '', dob: '2023-06-15', placeOfBirth: 'Rohtak', occupation: '', currentAddress: '1028 Knottwood Rd E Northwest, Edmonton, AB T6K 3R4' }
    ],
    siblings: [
      { name: 'Rimpy', relation: 'Sister', dob: '1991-02-18', placeOfBirth: 'Haryana', maritalStatus: 'Married', occupation: 'Asst Professor', addressEmail: 'P 50 Inderprastha Colony Rohtak, Haryana, 124001' },
      { name: 'Jatin Dahiya', relation: 'Brother', dob: '1999-02-14', placeOfBirth: 'Haryana', maritalStatus: 'Unmarried', occupation: 'Unemployed', addressEmail: 'B-5 Inderprastha Colony, Rohtak, Haryana - Pin 124001' }
    ],
    addresses: [
      { address: '1028 Knottwood Rd E Northwest, Edmonton, AB T6K 3R4', cityState: 'Edmonton, AB', country: 'Canada' }
    ],
    travel: [
      { from: '2025-05-05', to: '2025-06-23', place: 'Rohtak, India', purpose: 'Family visit' }
    ],
    relatives: []
  };
  await prepareRun('INSERT INTO pif_submissions (client_id, form_data) VALUES (?, ?)', client1.id, JSON.stringify(pif1));
  console.log('   📋 PIF data inserted for Neeraj Dahiya');

  // ===== CLIENT 2: Gagandeep Singh Nagra =====
  const token2 = uuidv4();
  const r2 = await prepareRun(
    `INSERT INTO clients (first_name, last_name, email, phone, nationality, date_of_birth, passport_number, visa_type, status, notes, form_token, pif_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'Gagandeep Singh', 'Nagra', 'Itsnagra.gagan@gmail.com', '2504673899', 'Indian', '1992-12-24',
    'M1303320', 'Visitor Visa', 'active',
    'First entry: Jun 6, 2019 (Vancouver). Last entry: Sep 5, 2020 (Roosville). Biometrics done. Single. Previously refused: App# V327106678 & W307051087. UCI: 1116254048.',
    token2, 'completed'
  );
  const client2 = await prepareGet('SELECT * FROM clients WHERE id = ?', r2.lastInsertRowid);
  console.log(`\n✅ Created Client 2: ID=${client2.id} — ${client2.first_name} ${client2.last_name}`);

  // PIF data for Gagandeep
  const pif2 = {
    firstName: 'Gagandeep Singh',
    lastName: 'Nagra',
    dob: '1992-12-24',
    placeOfBirth: 'Metla',
    nationality: 'Indian',
    gender: 'Male',
    eyeColour: 'Brown',
    height: '180cm',
    appliedBeforeDetails: 'Yes',
    refusedBeforeDetails: 'Yes - Application No. V327106678 & W307051087',
    medicalExamDetails: '',
    firstEntryDate: '2019-06-06',
    placeOfEntry: 'Vancouver',
    purposeOfVisit: 'Visitor',
    lastEntryDate: '2020-09-05',
    lastEntryPlace: 'Roosville',
    passportNumber: 'M1303320',
    passportIssueDate: '2014-08-14',
    passportExpiryDate: '2024-08-13',
    passportCountry: 'India',
    maritalStatus: 'Single',
    spouseMarriageDate: '',
    spouseFirstName: '',
    spouseLastName: '',
    spouseDob: '',
    spousePlaceOfBirth: '',
    spouseOccupation: '',
    spouseAddress: '',
    prevMarriageDate: '',
    prevMarriageEndDate: '',
    prevSpouseFirstName: '',
    prevSpouseLastName: '',
    prevSpouseDob: '',
    motherFirstName: 'Randhir Kaur',
    motherLastName: '',
    motherDob: '1965-03-30',
    motherDeathDate: '',
    motherPlaceOfBirth: 'Vill: Thakkar Sandhu, Distt: Gurdaspur (Punjab)',
    motherOccupation: 'Teacher',
    motherAddress: 'Vill- Metla, tehsil- Batala, Distt: Gurdaspur (Punjab) India',
    fatherFirstName: 'Sukhdev Singh',
    fatherLastName: '',
    fatherDob: '1961-01-01',
    fatherDeathDate: '',
    fatherPlaceOfBirth: 'Vill- Metla, tehsil- Batala, Distt: Gurdaspur (Punjab) India',
    fatherOccupation: 'Farmer',
    fatherAddress: 'Vill- Metla, tehsil- Batala, Distt: Gurdaspur (Punjab) India',
    ieltsListening: '',
    ieltsReading: '',
    ieltsWriting: '',
    ieltsSpeaking: '',
    ieltsOverall: '',
    education: [
      { from: '2011-08-01', to: '2016-08-01', institute: 'Panjab University', city: 'Chandigarh', field: 'Bachelor of Engineering' },
      { from: '2018-08-01', to: '2021-07-31', institute: 'Delhi University', city: 'Delhi', field: 'Bachelor of Law' }
    ],
    work: [
      { from: '2016-08-01', to: '2018-07-30', jobTitle: 'Network Engineer', city: 'Patiala', country: 'India', companyName: 'Digitax India Communications' },
      { from: '2020-09-20', to: '2021-02-27', jobTitle: 'Long Haul Trucker', city: 'Calgary', country: 'Canada', companyName: '1102052 Alberta Ltd O/A Onkar Express' },
      { from: '2021-04-11', to: '2021-06-06', jobTitle: 'Trucker', city: 'Calgary', country: 'Canada', companyName: 'Autoroute Trucking Ltd' },
      { from: '2021-01-01', to: '2022-09-07', jobTitle: 'Telecommunication Line Technician', city: 'Calgary', country: 'Canada', companyName: 'Humble Solutions Inc' }
    ],
    children: [],
    siblings: [
      { name: 'Kanwardeep Singh Nagra', relation: 'Brother', dob: '1995-03-03', placeOfBirth: 'Metla', maritalStatus: 'Married', occupation: 'Heavy Duty Equipment Technician', addressEmail: '1760 110Ave Dawson Creek BC V1G 2W4' }
    ],
    addresses: [
      { from: '2013-01-01', to: '2018-07-30', address: '1010 Sector 69 Mohali', cityState: 'Punjab', country: 'India' },
      { from: '2018-07-30', to: '2019-11-11', address: 'C 33/20 Ajay Enclave Ext. Subhash Nagar Delhi', cityState: 'Delhi', country: 'India' },
      { from: '2019-11-11', to: '2019-11-25', address: '1760 110Ave Dawson Creek', cityState: 'BC', country: 'Canada' },
      { from: '2019-11-25', to: '2020-03-15', address: '75 Buick Blvd Brampton', cityState: 'Ontario', country: 'Canada' },
      { from: '2020-03-15', to: '2020-08-01', address: '1760 110 Ave Dawson Creek', cityState: 'BC', country: 'Canada' },
      { from: '2020-08-01', to: '2021-07-31', address: '176 Taracove Estate Dr NE Calgary', cityState: 'Alberta', country: 'Canada' },
      { from: '2021-08-01', to: '2022-09-07', address: '172 Cornerstone Pass NE Calgary', cityState: 'Alberta', country: 'Canada' },
      { from: '2022-09-07', to: 'Present', address: '1760 110Ave Dawson Creek', cityState: 'BC', country: 'Canada' }
    ],
    travel: [],
    relatives: []
  };
  await prepareRun('INSERT INTO pif_submissions (client_id, form_data) VALUES (?, ?)', client2.id, JSON.stringify(pif2));
  console.log('   📋 PIF data inserted for Gagandeep Singh Nagra');

  // Create workflow tasks (PIF already completed, so only retainer agreement tasks)
  try {
    await createWorkflowTask(client1.id, { title: `Generate retainer agreement for Neeraj Dahiya`, category: 'Client Follow-up', priority: 'medium', dueDays: 3 });
    console.log('\n   🔧 Created workflow task: Generate retainer agreement for Neeraj Dahiya');

    await createWorkflowTask(client2.id, { title: `Generate retainer agreement for Gagandeep Singh Nagra`, category: 'Client Follow-up', priority: 'medium', dueDays: 3 });
    console.log('   🔧 Created workflow task: Generate retainer agreement for Gagandeep Singh Nagra');
  } catch (e) {
    console.error('Task creation error:', e.message);
  }

  console.log('\n✅ Done! Both clients created with full PIF data and workflow tasks.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
