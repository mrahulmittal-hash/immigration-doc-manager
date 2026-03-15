const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName } = require('pdf-lib');

async function deepAnalyze() {
    const formsDir = 'C:\\Users\\anish\\.gemini\\antigravity\\scratch\\immigration-doc-manager\\server\\uploads\\forms';
    const formPath = path.join(formsDir, '5e96deff-2d8e-4dc6-b7f4-cd40bad86369.pdf');

    const rawBytes = fs.readFileSync(formPath);

    // Search for AcroForm and field-related keys in the raw PDF
    const rawStr = rawBytes.toString('latin1');

    // Check for various field indicators
    console.log('Has /Widget:', rawStr.includes('/Widget'));
    console.log('Has /Tx:', rawStr.includes('/Tx'));
    console.log('Has /T (field name):', rawStr.includes('/T ('));
    console.log('Has /V (value):', rawStr.includes('/V'));
    console.log('Has /FT:', rawStr.includes('/FT'));
    console.log('Has /JavaScript:', rawStr.includes('/JavaScript'));
    console.log('Has /JS:', rawStr.includes('/JS'));
    console.log('Has /AA (additional actions):', rawStr.includes('/AA'));

    // Try with updated options
    const doc = await PDFDocument.load(rawBytes, {
        ignoreEncryption: true,
        updateMetadata: false
    });

    // Access internal context  
    const catalog = doc.context.lookup(doc.context.trailerInfo.Root);
    console.log('\nCatalog keys:', catalog ? Object.keys(catalog.dict ? Object.fromEntries(catalog.dict.entries()) : {}).join(', ') : 'none');

    if (catalog && catalog.dict) {
        for (const [key, value] of catalog.dict.entries()) {
            console.log('  Catalog entry:', key.toString(), '->', typeof value, value.constructor.name);
        }
    }

    // Try to find AcroForm directly
    const acroFormRef = catalog.get(PDFName.of('AcroForm'));
    if (acroFormRef) {
        console.log('\nAcroForm ref type:', acroFormRef.constructor.name);
        const acroForm = doc.context.lookup(acroFormRef);
        if (acroForm && acroForm.dict) {
            console.log('AcroForm keys:');
            for (const [key, value] of acroForm.dict.entries()) {
                console.log('  ', key.toString(), '->', value.constructor.name);
            }

            const fieldsRef = acroForm.get(PDFName.of('Fields'));
            if (fieldsRef) {
                console.log('\nFields ref type:', fieldsRef.constructor.name);
                if (fieldsRef.constructor.name === 'PDFArray') {
                    console.log('Fields count:', fieldsRef.size());
                    for (let i = 0; i < Math.min(fieldsRef.size(), 5); i++) {
                        const fieldRef = fieldsRef.get(i);
                        const field = doc.context.lookup(fieldRef);
                        if (field && field.dict) {
                            const entries = {};
                            for (const [k, v] of field.dict.entries()) {
                                entries[k.toString()] = v.toString ? v.toString() : v.constructor.name;
                            }
                            console.log('  Field', i, ':', JSON.stringify(entries));
                        } else {
                            console.log('  Field', i, ': could not resolve, ref:', fieldRef.toString());
                        }
                    }
                }
            }
        }
    } else {
        console.log('\nNo AcroForm found in catalog');
    }

    // Also check documents for text extractability
    console.log('\n=== DOCUMENT TEXT TEST ===');
    const docsDir = 'C:\\Users\\anish\\.gemini\\antigravity\\scratch\\immigration-doc-manager\\server\\uploads\\documents';
    const docFiles = fs.readdirSync(docsDir);
    const pdfParse = require('pdf-parse');

    for (const f of docFiles) {
        if (!f.endsWith('.pdf')) continue;
        const buf = fs.readFileSync(path.join(docsDir, f));
        try {
            const data = await pdfParse(buf);
            const text = (data.text || '').trim();
            console.log(`${f}: ${data.numpages} pages, text_len=${text.length}, has_text=${text.length > 10}`);
            if (text.length > 10) {
                console.log('  Preview:', text.substring(0, 150).replace(/\n/g, ' '));
            }
        } catch (e) {
            console.log(`${f}: PARSE ERROR - ${e.message}`);
        }
    }
}

deepAnalyze().catch(e => console.error('Fatal:', e.message, e.stack));
