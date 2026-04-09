import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

import UploadCard from '../components/UploadCard';
import DatasetInfo from '../components/DatasetInfo';
import { uploadFile } from '../services/api';
import { useDataSession } from '../context/DataSessionContext';

export default function UploadStage() {
  const navigate = useNavigate();
  const { setSessionId, datasetInfo, setDatasetInfo, resetSessionVisuals } = useDataSession();
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const handleUpload = async (file) => {
    setIsLoadingFile(true);
    try {
      const response = await uploadFile(file);
      setSessionId(response.session_id);
      setDatasetInfo(response.data);
      resetSessionVisuals();
      toast.success('Dataset uploaded successfully');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to upload dataset';
      toast.error(msg);
    } finally {
      setIsLoadingFile(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-6">
        <UploadCard onUpload={handleUpload} isLoading={isLoadingFile} />
        {datasetInfo && <DatasetInfo info={datasetInfo} />}
      </div>

      <div className="lg:col-span-7">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass p-8 md:p-10 h-full flex flex-col justify-between"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Stage 01</p>
            <h2 className="mt-3 text-3xl font-extrabold text-white leading-tight">
              Load your dataset and initialize an analysis session.
            </h2>
            <p className="mt-4 text-slate-300 max-w-xl">
              Upload a CSV to create a persistent session. The next stages use this shared context for
              visual exploration and conversational analytics.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/visualizations')}
            disabled={!datasetInfo}
            className="mt-10 inline-flex items-center justify-center rounded-xl px-5 py-3 font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Continue To Visualizations
          </button>
        </motion.div>
      </div>
    </div>
  );
}
