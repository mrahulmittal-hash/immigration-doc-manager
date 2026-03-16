import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader, AlertTriangle, FileText } from 'lucide-react';

// pdf.js setup — used to detect XFA and render AcroForm PDFs
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function PDFRenderer({ url, isXfa: isXfaProp }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfDocRef = useRef(null);
  const destroyedRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isXfa, setIsXfa] = useState(isXfaProp || false);

  // Load the PDF document
  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    destroyedRef.current = false;

    let loadingTask = null;
    let cancelled = false;

    const load = async () => {
      try {
        loadingTask = pdfjsLib.getDocument({ url });
        const pdf = await loadingTask.promise;
        if (cancelled) { pdf.destroy(); return; }

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setCurrentPage(1);

        // Detect XFA by checking the form type
        try {
          const data = await pdf.getMetadata();
          const isFormXfa = data?.info?.IsXFAPresent || false;
          setIsXfa(isFormXfa);
        } catch {
          // Fallback: try to render — if it fails we'll catch it
          setIsXfa(false);
        }

        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || String(err);
        if (msg.includes('Worker was destroyed')) return;
        console.error('PDF load error:', err);
        setError('Failed to load PDF: ' + msg);
        setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
      destroyedRef.current = true;
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
      if (loadingTask) {
        try { loadingTask.destroy(); } catch {}
      }
    };
  }, [url]);

  // Render the current page on canvas (AcroForm/standard PDFs only)
  const renderPage = useCallback(async () => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || !canvasRef.current || destroyedRef.current || isXfa) return;

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      if (destroyedRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      const containerWidth = containerRef.current?.clientWidth || 600;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const fitScale = (containerWidth - 40) / unscaledViewport.width;
      const effectiveScale = fitScale * scale;
      const viewport = page.getViewport({ scale: effectiveScale });

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.scale(dpr, dpr);

      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException' && !destroyedRef.current) {
        console.error('Page render error:', err);
        // If rendering fails, it might be an XFA form we didn't detect
        setIsXfa(true);
      }
    }
  }, [currentPage, scale, isXfa]);

  useEffect(() => {
    if (!loading && !error && !isXfa) renderPage();
  }, [renderPage, loading, error, isXfa]);

  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const zoomIn = () => setScale(s => Math.min(3, s + 0.25));
  const zoomOut = () => setScale(s => Math.max(0.5, s - 0.25));

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', color: '#fff', gap: 12,
      }}>
        <Loader size={24} className="spin" />
        <span style={{ fontSize: 13 }}>Loading PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', color: '#ef4444', gap: 8,
        padding: 20, textAlign: 'center',
      }}>
        <AlertTriangle size={24} />
        <span style={{ fontSize: 13 }}>{error}</span>
      </div>
    );
  }

  // XFA forms can't be rendered in-browser — show info panel instead
  if (isXfa) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 16, padding: 32,
        background: '#2d3748', color: '#e2e8f0', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 16,
          background: 'rgba(245,158,11,.15)', border: '2px solid rgba(245,158,11,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <FileText size={32} style={{ color: '#f59e0b' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>XFA Form</div>
          <div style={{ fontSize: 13, color: '#a0aec0', lineHeight: 1.6, maxWidth: 280 }}>
            This IRCC form uses XFA (XML) format which cannot be previewed in the browser.
          </div>
        </div>
        <div style={{
          fontSize: 12, color: '#68d391', fontWeight: 600,
          background: 'rgba(104,211,145,.1)', padding: '8px 16px', borderRadius: 8,
          border: '1px solid rgba(104,211,145,.2)',
        }}>
          Use the Form Fields panel to edit and download →
        </div>
        {totalPages > 0 && (
          <div style={{ fontSize: 11, color: '#718096', marginTop: 4 }}>
            {totalPages} page{totalPages !== 1 ? 's' : ''} · XFA format
          </div>
        )}
      </div>
    );
  }

  // Standard AcroForm PDF — render with canvas
  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '6px 12px', background: 'rgba(0,0,0,.3)',
        borderBottom: '1px solid rgba(255,255,255,.1)', flexShrink: 0,
      }}>
        <button onClick={prevPage} disabled={currentPage <= 1}
          style={{ ...toolbarBtnStyle, opacity: currentPage <= 1 ? 0.3 : 1 }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600, minWidth: 70, textAlign: 'center' }}>
          {currentPage} / {totalPages}
        </span>
        <button onClick={nextPage} disabled={currentPage >= totalPages}
          style={{ ...toolbarBtnStyle, opacity: currentPage >= totalPages ? 0.3 : 1 }}>
          <ChevronRight size={16} />
        </button>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.2)', margin: '0 4px' }} />

        <button onClick={zoomOut} disabled={scale <= 0.5}
          style={{ ...toolbarBtnStyle, opacity: scale <= 0.5 ? 0.3 : 1 }}>
          <ZoomOut size={14} />
        </button>
        <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, minWidth: 40, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button onClick={zoomIn} disabled={scale >= 3}
          style={{ ...toolbarBtnStyle, opacity: scale >= 3 ? 0.3 : 1 }}>
          <ZoomIn size={14} />
        </button>
      </div>

      {/* Canvas */}
      <div style={{
        flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center',
        padding: '16px 8px', background: '#525659',
      }}>
        <canvas ref={canvasRef} style={{ boxShadow: '0 2px 12px rgba(0,0,0,.4)' }} />
      </div>
    </div>
  );
}

const toolbarBtnStyle = {
  background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 6,
  color: '#fff', cursor: 'pointer', padding: '4px 8px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
