require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'propgent',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: false
});

const formData = {
  firstName: 'Wei', lastName: 'Chen', dob: '1995-03-15', placeOfBirth: 'Shanghai, China',
  nationality: 'Chinese', gender: 'Male', eyeColour: 'Brown', height: '5 ft 10 in',
  appliedBefore: 'No', refusedBefore: 'No', medicalExamDone: 'Yes',
  medicalExamDetails: 'Completed at LifeLabs Toronto, Jan 2026',
  firstEntryDate: '2023-09-01', placeOfEntry: 'Toronto Pearson International Airport',
  purposeOfVisit: 'Study', lastEntryDate: '2023-09-01', lastEntryPlace: 'Toronto',
  biometricsDone: 'Yes', passportNumber: 'E12345678', passportIssueDate: '2022-01-15',
  passportExpiryDate: '2032-01-14', passportCountry: 'China', maritalStatus: 'Single',
  motherFirstName: 'Mei', motherLastName: 'Chen', motherDob: '1968-07-22',
  motherPlaceOfBirth: 'Beijing, China', motherOccupation: 'Teacher',
  motherAddress: '42 Hongqiao Rd, Shanghai | mei.chen@qq.com',
  fatherFirstName: 'Jun', fatherLastName: 'Chen', fatherDob: '1965-11-03',
  fatherPlaceOfBirth: 'Shanghai, China', fatherOccupation: 'Engineer',
  fatherAddress: '42 Hongqiao Rd, Shanghai | jun.chen@qq.com',
  education: [
    { from: '2013-09', to: '2017-06', institute: 'Shanghai Jiao Tong University', city: 'Shanghai', field: 'Computer Science' },
    { from: '2023-09', to: '2025-06', institute: 'University of Toronto', city: 'Toronto', field: 'Data Science (MSc)' }
  ],
  work: [
    { from: '2017-07', to: '2023-08', jobTitle: 'Software Developer', city: 'Shanghai', country: 'China', companyName: 'Alibaba Group' }
  ],
  children: [],
  siblings: [
    { name: 'Li Chen', relation: 'Sister', dob: '1998-05-10', placeOfBirth: 'Shanghai', maritalStatus: 'Single', occupation: 'Accountant', addressEmail: 'Shanghai | li.chen@outlook.com' }
  ],
  addresses: [
    { from: '2023-09', to: 'Present', address: '120 Bloor St W, Apt 4B, M5S 1S4', cityState: 'Toronto, Ontario', country: 'Canada', activity: 'Study' },
    { from: '2013-09', to: '2023-08', address: '42 Hongqiao Rd, Changning District', cityState: 'Shanghai', country: 'China', activity: 'Study / Work' }
  ],
  travel: [
    { from: '2022-06', to: '2022-07', place: 'Tokyo, Japan', purpose: 'Tourism' },
    { from: '2021-12', to: '2022-01', place: 'Singapore', purpose: 'Business Conference' }
  ],
  relatives: [],
  testType: 'IELTS', ieltsListening: '8.0', ieltsReading: '7.5', ieltsWriting: '7.0', ieltsSpeaking: '7.5', ieltsOverall: '7.5',
  criminalHistory: 'No', healthIssues: 'No', consent: true
};

(async () => {
  try {
    await pool.query('DELETE FROM pif_submissions WHERE client_id = 4');
    await pool.query(
      'INSERT INTO pif_submissions (client_id, form_data, submitted_at) VALUES ($1, $2, NOW())',
      [4, JSON.stringify(formData)]
    );
    await pool.query("UPDATE clients SET pif_status = 'completed' WHERE id = 4");
    console.log('Done - PIF data inserted for Wei Chen (client 4)');
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
})();
