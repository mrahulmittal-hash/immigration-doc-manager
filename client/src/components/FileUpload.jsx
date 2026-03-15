import { useCallback, useState, useRef } from 'react';

export default function FileUpload({ onFiles, accept = '.pdf,.png,.jpg,.jpeg,.gif,.doc,.docx', multiple = true, label = 'Drop files here or click to browse' }) {
    const [dragging, setDragging] = useState(false);
    const [files, setFiles] = useState([]);
    const inputRef = useRef(null);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
    }, []);

    const handleDragOut = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            setFiles(prev => [...prev, ...droppedFiles]);
            onFiles && onFiles([...files, ...droppedFiles]);
        }
    }, [files, onFiles]);

    const handleChange = (e) => {
        const selected = Array.from(e.target.files);
        setFiles(prev => [...prev, ...selected]);
        onFiles && onFiles([...files, ...selected]);
    };

    const removeFile = (index) => {
        const updated = files.filter((_, i) => i !== index);
        setFiles(updated);
        onFiles && onFiles(updated);
    };

    const formatSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    return (
        <div>
            <div
                className={`file-upload-zone ${dragging ? 'dragging' : ''}`}
                onClick={() => inputRef.current?.click()}
                onDragEnter={handleDragIn}
                onDragLeave={handleDragOut}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <div className="file-upload-icon">📁</div>
                <div className="file-upload-text">{label}</div>
                <div className="file-upload-hint">Supports: PDF, Images, Word Documents (max 50MB each)</div>
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />
            </div>

            {files.length > 0 && (
                <div className="file-list">
                    {files.map((file, i) => (
                        <div key={i} className="file-item">
                            <div className="file-item-info">
                                <span className="file-item-icon">
                                    {file.name.endsWith('.pdf') ? '📄' : '🖼️'}
                                </span>
                                <div>
                                    <div className="file-item-name">{file.name}</div>
                                    <div className="file-item-size">{formatSize(file.size)}</div>
                                </div>
                            </div>
                            <button className="btn btn-icon btn-danger" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
