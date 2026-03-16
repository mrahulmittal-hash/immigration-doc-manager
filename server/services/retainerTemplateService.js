/**
 * Retainer Template Merge Service
 * Merges template sections with client data, fee info, and firm profile
 */

function calculateAdjustedFee(baseFee, gstRate, adjustments = []) {
  let adjustmentsTotal = 0;
  const details = [];

  for (const adj of adjustments) {
    let amt = 0;
    if (adj.type === 'discount') {
      amt = adj.percentage > 0 ? -(baseFee * adj.percentage / 100) : -(adj.amount || 0);
      details.push({ ...adj, applied: amt });
    } else if (adj.type === 'waiver') {
      amt = adj.percentage > 0 ? -(baseFee * adj.percentage / 100) : -(adj.amount || 0);
      details.push({ ...adj, applied: amt });
    } else if (adj.type === 'surcharge') {
      amt = adj.percentage > 0 ? (baseFee * adj.percentage / 100) : (adj.amount || 0);
      details.push({ ...adj, applied: amt });
    }
    adjustmentsTotal += amt;
  }

  const adjustedBase = Math.max(0, baseFee + adjustmentsTotal);
  const gst = adjustedBase * (gstRate / 100);
  const grandTotal = adjustedBase + gst;

  return {
    base_fee: baseFee,
    adjustments_total: adjustmentsTotal,
    adjusted_base: adjustedBase,
    gst_rate: gstRate,
    gst,
    grand_total: grandTotal,
    details,
  };
}

function formatCurrency(num) {
  return Number(num || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mergeTemplate(sections, clientData, feeData, firmProfile, adjustments = []) {
  const calc = calculateAdjustedFee(
    Number(feeData.base_fee || 0),
    Number(feeData.gst_rate || 5),
    adjustments
  );

  // Build adjustment lines
  let adjLines = '';
  if (calc.details.length > 0) {
    adjLines = 'Adjustments:\n';
    for (const d of calc.details) {
      const label = d.type.charAt(0).toUpperCase() + d.type.slice(1);
      const desc = d.description ? ` — ${d.description}` : '';
      adjLines += `  ${label}: CAD $${formatCurrency(Math.abs(d.applied))}${d.applied < 0 ? ' (deducted)' : ' (added)'}${desc}\n`;
    }
    adjLines += `Adjusted Subtotal: CAD $${formatCurrency(calc.adjusted_base)}`;
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const tokens = {
    '{{client_name}}': `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim(),
    '{{client_dob}}': clientData.date_of_birth || '___',
    '{{client_address}}': clientData.address || '___',
    '{{client_phone}}': clientData.phone || '___',
    '{{client_email}}': clientData.email || '___',
    '{{client_nationality}}': clientData.nationality || '___',
    '{{service_type}}': feeData.service_name || clientData.visa_type || '___',
    '{{professional_fee}}': formatCurrency(calc.base_fee),
    '{{gst_rate}}': String(calc.gst_rate),
    '{{gst_amount}}': formatCurrency(calc.gst),
    '{{total_fee}}': formatCurrency(calc.grand_total),
    '{{fee_adjustments}}': adjLines,
    '{{rcic_name}}': firmProfile.rcic_name || '___',
    '{{rcic_license}}': firmProfile.rcic_license || '___',
    '{{firm_name}}': firmProfile.business_name || '___',
    '{{firm_address}}': [firmProfile.address, firmProfile.city, firmProfile.province, firmProfile.postal_code].filter(Boolean).join(', ') || '___',
    '{{firm_phone}}': firmProfile.phone || '___',
    '{{firm_email}}': firmProfile.email || '___',
    '{{province}}': firmProfile.province || 'Alberta',
    '{{date}}': dateStr,
  };

  // Build HTML
  let html = `<div class="retainer-agreement">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="font-size:22px;font-weight:800;text-decoration:underline;margin:0;">RETAINER AGREEMENT</h1>
    </div>
    <p><strong>This agreement is made this ${dateStr} by and between:</strong></p>
    <div style="margin:12px 0;">
      <p><strong>${tokens['{{rcic_name}}']}</strong><br/>
      Regulated Canadian Immigration Consultant (RCIC)<br/>
      License Number: ${tokens['{{rcic_license}}']}<br/>
      Business Name: ${tokens['{{firm_name}}']}<br/>
      Business Address: ${tokens['{{firm_address}}']}<br/>
      Phone: ${tokens['{{firm_phone}}']}<br/>
      Email: ${tokens['{{firm_email}}']}<br/>
      (Hereinafter referred to as the "RCIC")</p>
    </div>
    <p style="text-align:center;font-weight:700;">AND</p>
    <div style="margin:12px 0;">
      <p><strong>Client Full Legal Name:</strong> ${tokens['{{client_name}}']}<br/>
      <strong>Date of Birth:</strong> ${tokens['{{client_dob}}']}<br/>
      <strong>Phone:</strong> ${tokens['{{client_phone}}']}<br/>
      <strong>Email:</strong> ${tokens['{{client_email}}']}<br/>
      (Hereinafter referred to as the "Client")</p>
    </div>
    <hr style="border:none;border-top:2px solid #a0a0a0;margin:20px 0;"/>`;

  // Render each section
  const sortedSections = [...sections].sort((a, b) => a.section_number - b.section_number);
  for (const sec of sortedSections) {
    let content = sec.content;
    for (const [token, value] of Object.entries(tokens)) {
      content = content.split(token).join(value);
    }
    // Convert newlines to HTML
    const htmlContent = content
      .split('\n')
      .map(line => {
        if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
        return line;
      })
      .join('<br/>');

    // Wrap list items in ul
    const wrappedContent = htmlContent.replace(/((?:<li>.*?<\/li><br\/>?)+)/g, (match) => {
      return '<ul style="margin:8px 0;padding-left:24px;">' + match.replace(/<br\/>/g, '') + '</ul>';
    });

    html += `
    <div style="margin:16px 0;">
      <h3 style="font-size:14px;font-weight:700;text-decoration:underline;margin:0 0 8px;">${sec.section_number}. ${sec.title}</h3>
      <div style="font-size:13px;line-height:1.6;">${wrappedContent}</div>
    </div>`;
  }

  // Signature blocks
  html += `
    <div style="margin-top:40px;">
      <div style="display:flex;gap:40px;margin-top:24px;">
        <div style="flex:1;">
          <p><strong>CLIENT</strong></p>
          <p>Signature: ______________________________</p>
          <p>Name: ${tokens['{{client_name}}']}</p>
          <p>Date: ______________________________</p>
        </div>
        <div style="flex:1;">
          <p><strong>RCIC</strong></p>
          <p>Signature: ______________________________</p>
          <p>Name: ${tokens['{{rcic_name}}']}</p>
          <p>Date: ______________________________</p>
        </div>
      </div>
    </div>
  </div>`;

  return html;
}

module.exports = { mergeTemplate, calculateAdjustedFee };
