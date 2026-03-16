import { useRef, useEffect, useState, useCallback } from 'react';
import { Eraser } from 'lucide-react';

export default function SignaturePad({ onSignature, width = 500, height = 200 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const lastPoint = useRef(null);

  const getCoords = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    lastPoint.current = coords;
    setIsDrawing(true);
  }, [getCoords]);

  const draw = useCallback((e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const coords = getCoords(e, canvas);

    // Quadratic bezier for smoother lines
    if (lastPoint.current) {
      const midX = (lastPoint.current.x + coords.x) / 2;
      const midY = (lastPoint.current.y + coords.y) / 2;
      ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
      ctx.stroke();
    }

    lastPoint.current = coords;
    setHasContent(true);
  }, [isDrawing, getCoords]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && hasContent && onSignature) {
      const canvas = canvasRef.current;
      onSignature(canvas.toDataURL('image/png'));
    }
    setIsDrawing(false);
    lastPoint.current = null;
  }, [isDrawing, hasContent, onSignature]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    if (onSignature) onSignature(null);
  }, [onSignature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  return (
    <div>
      <div style={{
        position: 'relative',
        border: '2px dashed var(--border-subtle)',
        borderRadius: 12,
        background: '#ffffff',
        overflow: 'hidden',
      }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ display: 'block', width: '100%', height: 'auto', cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasContent && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            color: '#94a3b8', fontSize: 14, pointerEvents: 'none', textAlign: 'center',
          }}>
            Draw your signature here
          </div>
        )}
      </div>
      {hasContent && (
        <button
          onClick={clear}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 13, padding: '4px 0',
          }}
        >
          <Eraser size={14} /> Clear signature
        </button>
      )}
    </div>
  );
}
