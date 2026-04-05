import { useState } from 'react';
import { motion } from 'framer-motion';

export default function UploadCard({ onUpload }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      onUpload(droppedFile);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      onUpload(selectedFile);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-6 w-full text-center"
    >
      <h2 className="text-xl font-bold mb-4">Upload Dataset</h2>
      <div 
        className={`border-2 border-dashed rounded-lg p-10 transition-colors ${dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleChange} 
          className="hidden" 
          id="file-upload" 
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          {file ? (
            <p className="text-blue-400 font-medium">{file.name}</p>
          ) : (
            <p className="text-gray-400">Drag & drop your CSV file here, or click to select</p>
          )}
        </label>
      </div>
    </motion.div>
  );
}