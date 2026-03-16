import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileCheck, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';

export default function SignPage() {
  const { token } = useParams();
  const [docInfo, setDocInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [signatureData, setSignatureData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setDocInfo(data);
      })
      .catch(() => setError('Failed to load signature request'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!signatureData) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data: signatureData }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setSuccess(true);
    } catch {
      setError('Failed to submit signature');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Loader size={32} className="spin" style={{ color: '#6366f1' }} />
    </div>
  );

  if (error) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <AlertCircle size={48} color="#ef4444" />
        <h2 style={{ marginTop: 16, color: '#1a1a2e' }}>Unable to Sign</h2>
        <p style={{ color: '#64748b' }}>{error}</p>
      </div>
    </div>
  );

  if (success) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
        }}>
          <CheckCircle size={40} color="#fff" />
        </div>
        <h2 style={{ color: '#1a1a2e', margin: '0 0 8px' }}>Document Signed!</h2>
        <p style={{ color: '#64748b', fontSize: 15 }}>
          Thank you, {docInfo?.client_name}. Your signature on <strong>{docInfo?.document_name}</strong> has been recorded.
        </p>
        <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 16 }}>You can close this window.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'Inter, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
          borderRadius: '16px 16px 0 0', padding: '32px 30px', textAlign: 'center'
        }}>
          <h1 style={{ color: '#fff', margin: 0, fontSize: 24 }}>🌏 PropAgent</h1>
          <p style={{ color: '#94a3b8', margin: '8px 0 0', fontSize: 13 }}>RCIC Immigration Services</p>
        </div>

        {/* Content */}
        <div style={{
          background: '#fff', padding: '40px 30px',
          borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0', borderRadius: '0 0 16px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <FileCheck size={24} color="#6366f1" />
            <div>
              <h2 style={{ margin: 0, fontSize: 20, color: '#1a1a2e' }}>Signature Required</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Hello {docInfo?.client_name}</p>
            </div>
          </div>

          {/* Document info */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: 20, marginBottom: 24, textAlign: 'center'
          }}>
            <p style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>Document</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>📄 {docInfo?.document_name}</p>
          </div>

          {/* PDF Preview link */}
          {docInfo?.has_pdf && (
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <a
                href={`/api/sign/${token}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#6366f1', fontSize: 14, textDecoration: 'underline' }}
              >
                Preview document before signing →
              </a>
            </div>
          )}

          {/* Signature Pad */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 12, fontWeight: 600 }}>Your Signature</p>
            <SignaturePad onSignature={setSignatureData} width={580} height={200} />
          </div>

          {/* Agreement text */}
          <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 24 }}>
            By clicking "Sign Document" below, I confirm that I have read and understood the document above,
            and I agree to apply my electronic signature. This signature is legally binding.
          </p>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!signatureData || submitting}
            style={{
              width: '100%', padding: '16px 24px', border: 'none', borderRadius: 12,
              background: signatureData ? 'linear-gradient(135deg, #10b981, #059669)' : '#e2e8f0',
              color: signatureData ? '#fff' : '#94a3b8',
              fontSize: 16, fontWeight: 700, cursor: signatureData ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
            }}
          >
            {submitting ? 'Signing...' : '✍️ Sign Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
