/**
 * emailService.js — Sends emails via AWS SES (production) or Gmail/nodemailer (local fallback)
 *
 * When AWS_REGION + SES_FROM_EMAIL are configured, uses the AWS SDK SES v3.
 * Otherwise, falls back to nodemailer/Gmail (existing dev setup).
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const EMAIL_USER   = process.env.EMAIL_USER || 'anishgargin@gmail.com';
const EMAIL_PASS   = process.env.EMAIL_PASS || '';
const SES_FROM     = process.env.SES_FROM_EMAIL || EMAIL_USER;

function isSESEnabled() {
    return !!(process.env.AWS_REGION && process.env.SES_FROM_EMAIL && process.env.AWS_ACCESS_KEY_ID);
}

/**
 * Build the branded HTML email body — reused by all email types.
 */
function buildPIFEmailHtml(clientName, serviceType, formUrl) {
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                    🌏 PropAgent
                </h1>
                <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">RCIC Immigration Services</p>
            </div>

            <!-- Body -->
            <div style="background: #ffffff; padding: 40px 30px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
                <h2 style="color: #1a1a2e; font-size: 22px; margin: 0 0 16px;">Hello ${clientName},</h2>
                
                <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
                    Welcome to <strong>PropAgent</strong>! We're excited to assist you with your 
                    <strong style="color: #0f3460;">${serviceType}</strong> application.
                </p>

                <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
                    To get started, please complete your <strong>Personal Information Form (PIF)</strong>. 
                    This form collects all the necessary details we need to process your immigration application.
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${formUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #0f3460 0%, #1a5276 100%); 
                              color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 10px; 
                              font-size: 16px; font-weight: 600; letter-spacing: 0.3px;
                              box-shadow: 0 4px 15px rgba(15, 52, 96, 0.3);">
                        📋 Fill Personal Information Form
                    </a>
                </div>

                <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0 0 24px;">
                    Or copy this link: <a href="${formUrl}" style="color: #0f3460;">${formUrl}</a>
                </p>

                <!-- Info Box -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 24px 0;">
                    <h3 style="color: #1a1a2e; font-size: 14px; margin: 0 0 12px;">📌 What you'll need:</h3>
                    <ul style="color: #475569; font-size: 13px; line-height: 2; margin: 0; padding-left: 20px;">
                        <li>Passport details (number, issue &amp; expiry dates)</li>
                        <li>Spouse &amp; family member information</li>
                        <li>Education &amp; work history</li>
                        <li>Travel history &amp; addresses</li>
                        <li>IELTS/CELPIP/TEF scores (if applicable)</li>
                    </ul>
                </div>

                <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                    Please ensure all information is accurate and complete. If you have any questions, 
                    don't hesitate to reach out to us.
                </p>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 16px 16px; padding: 24px 30px; text-align: center;">
                <p style="color: #64748b; font-size: 13px; margin: 0 0 4px; font-weight: 600;">PropAgent</p>
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">RCIC Immigration Platform</p>
                <p style="color: #94a3b8; font-size: 11px; margin: 12px 0 0;">
                    This email was sent because you registered for immigration services. 
                    Please do not share this link with anyone.
                </p>
            </div>
        </div>
    </body>
    </html>`;
}

/**
 * Send PIF invitation email using SES or Gmail fallback.
 */
async function sendPIFEmail(clientEmail, clientName, formToken, serviceType) {
    const formUrl = `${FRONTEND_URL}/pif/${formToken}`;
    const htmlContent = buildPIFEmailHtml(clientName, serviceType, formUrl);
    const subject = `Your Personal Information Form — PropAgent`;

    if (isSESEnabled()) {
        return await sendViaSES(clientEmail, subject, htmlContent, formUrl);
    }
    return await sendViaGmail(clientEmail, subject, htmlContent, formUrl, clientName);
}

// -----------------------------------------------------------------------
// SES transport (AWS SDK v3)
// -----------------------------------------------------------------------
async function sendViaSES(toAddress, subject, htmlBody, formUrl) {
    const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

    const ses = new SESClient({
        region: process.env.AWS_REGION || 'ca-central-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    await ses.send(new SendEmailCommand({
        Source: SES_FROM,
        Destination: { ToAddresses: [toAddress] },
        Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } },
        },
    }));

    console.log(`✅ PIF email sent via SES to ${toAddress}`);
    return { success: true, transport: 'ses', formUrl };
}

// -----------------------------------------------------------------------
// Gmail/SMTP fallback (nodemailer — existing dev setup)
// -----------------------------------------------------------------------
async function sendViaGmail(toAddress, subject, htmlBody, formUrl, clientName) {
    if (!EMAIL_PASS) {
        console.log('⚠️  EMAIL_PASS not set. Email not sent. PIF form URL:');
        console.log(`   ${formUrl}`);
        console.log(`   Client: ${clientName} <${toAddress}>`);
        return { success: true, simulated: true, formUrl };
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });

    const info = await transporter.sendMail({
        from: `"PropAgent" <${EMAIL_USER}>`,
        to: toAddress,
        subject,
        html: htmlBody,
    });

    console.log(`✅ PIF email sent via Gmail to ${toAddress} — Message ID: ${info.messageId}`);
    return { success: true, transport: 'gmail', messageId: info.messageId, formUrl };
}

// -----------------------------------------------------------------------
// Portal Link Email
// -----------------------------------------------------------------------
async function sendPortalEmail(clientEmail, clientName, formToken, serviceType) {
    const portalUrl = `${FRONTEND_URL}/portal/${formToken}`;
    const subject = `Your Client Portal — PropAgent`;
    const htmlBody = `<!DOCTYPE html>
    <html><head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', sans-serif; background-color: #f0f2f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">🌏 PropAgent</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">RCIC Immigration Services</p>
        </div>
        <div style="background: #fff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: 0;">
          <h2 style="color: #1a1a2e; margin: 0 0 16px;">Hello ${clientName},</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.7;">
            Your client portal is ready! Use it to track your <strong>${serviceType || 'immigration'}</strong> application,
            upload required documents, and view your progress.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">
              Open My Portal
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">This link is unique to you — please do not share it.</p>
        </div>
      </div>
    </body></html>`;

    if (isSESEnabled()) {
        return await sendViaSES(clientEmail, subject, htmlBody, portalUrl);
    }
    return await sendViaGmail(clientEmail, subject, htmlBody, portalUrl, clientName);
}

// -----------------------------------------------------------------------
// Signature Request Email
// -----------------------------------------------------------------------
async function sendSignatureRequestEmail(clientEmail, clientName, signToken, documentName) {
    const signUrl = `${FRONTEND_URL}/sign/${signToken}`;
    const subject = `Signature Required: ${documentName} — PropAgent`;
    const htmlBody = `<!DOCTYPE html>
    <html><head><meta charset="utf-8"></head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', sans-serif; background-color: #f0f2f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">🌏 PropAgent</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">RCIC Immigration Services</p>
        </div>
        <div style="background: #fff; padding: 40px 30px; border: 1px solid #e2e8f0; border-top: 0;">
          <h2 style="color: #1a1a2e; margin: 0 0 16px;">Hello ${clientName},</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.7;">
            Your signature is required on the following document:
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 0;">📄 ${documentName}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${signUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #fff; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">
              Sign Document
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px;">This link expires in 7 days. Do not share it.</p>
        </div>
      </div>
    </body></html>`;

    if (isSESEnabled()) {
        return await sendViaSES(clientEmail, subject, htmlBody, signUrl);
    }
    return await sendViaGmail(clientEmail, subject, htmlBody, signUrl, clientName);
}

// -----------------------------------------------------------------------
// Retainer Agreement Email
// -----------------------------------------------------------------------
async function sendRetainerAgreementEmail(clientEmail, clientName, agreementHtml, serviceName) {
    const subject = `Your Retainer Agreement — PropAgent`;
    const htmlBody = `<!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
      <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">PropAgent</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">RCIC Immigration Services</p>
        </div>
        <div style="background: #ffffff; padding: 40px 30px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
          <h2 style="color: #1a1a2e; font-size: 22px; margin: 0 0 16px;">Hello ${clientName},</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
            Please find your <strong>Retainer Agreement</strong> for <strong style="color: #0f3460;">${serviceName || 'Immigration Services'}</strong> attached below.
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
            Please review the agreement carefully. If you have any questions, don't hesitate to reach out to us.
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; font-size: 13px; line-height: 1.7; color: #1a1a1a;">
            ${agreementHtml}
          </div>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Please print, sign, and return this agreement to proceed with your application.
          </p>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0 0 16px 16px; padding: 24px 30px; text-align: center;">
          <p style="color: #64748b; font-size: 13px; margin: 0 0 4px; font-weight: 600;">PropAgent</p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">RCIC Immigration Platform</p>
          <p style="color: #94a3b8; font-size: 11px; margin: 12px 0 0;">
            This email contains your retainer agreement. Please do not share it with unauthorized parties.
          </p>
        </div>
      </div>
    </body></html>`;

    if (isSESEnabled()) {
        return await sendViaSES(clientEmail, subject, htmlBody, '');
    }
    return await sendViaGmail(clientEmail, subject, htmlBody, '', clientName);
}

module.exports = { sendPIFEmail, sendPortalEmail, sendSignatureRequestEmail, sendRetainerAgreementEmail };
