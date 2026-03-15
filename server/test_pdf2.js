const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const formsDir = 'C:\\Users\\anish\\.gemini\\antigravity\\scratch\\immigration-doc-manager\\server\\uploads\\forms';
const filledDir = 'C:\\Users\\anish\\.gemini\\antigravity\\scratch\\immigration-doc-manager\\server\\uploads\\filled';

async function analyze() {
    // Test the template form
    const formFiles = fs.readdirSync(formsDir);
    const formPath = path.join(formsDir, formFiles[0]);

    console.log('=== TEMPLATE FORM ANALYSIS ===');
    console.log('File:', formFiles[0]);

    // Check for XFA
    const rawBytes = fs.readFileSync(formPath);
    const rawStr = rawBytes.toString('latin1');
    const hasXFA = rawStr.includes('/XFA');
    const hasAcroForm = rawStr.includes('/AcroForm');
    console.log('Has XFA:', hasXFA);
    console.log('Has AcroForm:', hasAcroForm);

    try {
        const doc = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
        const form = doc.getForm();
        const fields = form.getFields();
        console.log('Pages:', doc.getPageCount());
        console.log('Total fields:', fields.length);

        // Group by type
        const types = {};
        fields.forEach(f => {
            const t = f.constructor.name;
            types[t] = (types[t] || 0) + 1;
        });
        console.log('Field types:', types);

        // Show first 20 fields
        console.log('\nFirst 20 fields:');
        fields.slice(0, 20).forEach(f => {
            console.log(`  ${f.getName()} [${f.constructor.name}]`);
        });

        // Try filling and saving
        console.log('\n=== FILL TEST ===');
        let filled = 0;
        for (const field of fields) {
            if (field.constructor.name === 'PDFTextField') {
                try {
                    field.setText('TEST');
                    filled++;
                } catch (e) {
                    console.log('  Cannot fill:', field.getName(), '-', e.message);
                }
                if (filled >= 3) break;
            }
        }
        console.log('Fields filled:', filled);

        const savedBytes = await doc.save();
        const testOut = path.join(filledDir, '__test__.pdf');
        fs.writeFileSync(testOut, savedBytes);
        console.log('Saved test PDF. Size:', savedBytes.length);

        // Verify it can be re-loaded
        const reloaded = await PDFDocument.load(fs.readFileSync(testOut));
        console.log('Re-loaded successfully. Pages:', reloaded.getPageCount());
        fs.unlinkSync(testOut);

    } catch (e) {
        console.log('ERROR:', e.message);
        console.log(e.stack);
    }

    // Check a filled PDF
    console.log('\n=== FILLED PDF ANALYSIS ===');
    const filledFiles = fs.readdirSync(filledDir);
    const filledPath = path.join(filledDir, filledFiles[0]);
    console.log('File:', filledFiles[0]);

    const filledBytes = fs.readFileSync(filledPath);
    const filledStr = filledBytes.toString('latin1');
    const filledHasXFA = filledStr.includes('/XFA');
    console.log('Has XFA:', filledHasXFA);

    try {
        const doc = await PDFDocument.load(filledBytes, { ignoreEncryption: true });
        console.log('Loads OK. Pages:', doc.getPageCount());
        const form = doc.getForm();
        const fields = form.getFields();
        console.log('Fields:', fields.length);
    } catch (e) {
        console.log('CANNOT LOAD filled PDF:', e.message);
    }

    // Also test pdf-parse on a document
    console.log('\n=== DOCUMENT EXTRACTION TEST ===');
    const docsDir = 'C:\\Users\\anish\\.gemini\\antigravity\\scratch\\immigration-doc-manager\\server\\uploads\\documents';
    const docFiles = fs.readdirSync(docsDir);
    console.log('Documents found:', docFiles.length);

    const pdfParse = require('pdf-parse');
    // Test extraction on first PDF document
    for (const f of docFiles.slice(0, 2)) {
        if (f.endsWith('.pdf')) {
            console.log('\nExtracting:', f);
            const buf = fs.readFileSync(path.join(docsDir, f));
            try {
                const data = await pdfParse(buf);
                const text = data.text || '';
                console.log('Pages:', data.numpages);
                console.log('Text length:', text.length);
                console.log('First 200 chars:', text.substring(0, 200));
            } catch (e) {
                console.log('Parse error:', e.message);
            }
        }
    }
}

analyze().catch(e => console.error('Fatal:', e));
