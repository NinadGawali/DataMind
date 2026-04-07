import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

import { generateVisualization } from '../services/api';
import { useDataSession } from '../context/DataSessionContext';
import VisualizationControls from '../components/VisualizationControls';
import ChartRenderer from '../components/ChartRenderer';

export default function VisualizationStage() {
  const navigate = useNavigate();
  const { sessionId, datasetInfo, vizData, setVizData } = useDataSession();
  const [isLoadingViz, setIsLoadingViz] = useState(false);

  const handleVisualize = async (config) => {
    if (!sessionId) {
      toast.error('Upload a dataset first');
      return;
    }

    setIsLoadingViz(true);
    try {
      const payload = { session_id: sessionId, config };
      const response = await generateVisualization(payload);
      setVizData(response.data);
      toast.success('Visualization generated');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to generate visualization';
      toast.error(msg);
    } finally {
      setIsLoadingViz(false);
    }
  };

  if (!sessionId || !datasetInfo) {
    return (
      <div className="glass p-8 text-center">
        <h2 className="text-2xl font-bold">No active dataset session</h2>
        <p className="text-slate-300 mt-2">Go back to Upload stage and start a session first.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 rounded-lg px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-900 font-semibold"
        >
          Back To Upload
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Stage 02</p>
          <h2 className="text-xl font-bold mt-2">Visualizations</h2>
          <p className="text-slate-300 mt-2 text-sm">Tune chart parameters and map structure before asking analytical questions.</p>
        </motion.div>
        <VisualizationControls columns={datasetInfo.columns} onVisualize={handleVisualize} />
      </div>

      <div className="lg:col-span-8 space-y-6">
        <ChartRenderer vizData={vizData} isLoading={isLoadingViz} />

        <button
          type="button"
          onClick={() => navigate('/insights')}
          className="rounded-xl px-5 py-3 font-semibold bg-emerald-400 text-slate-900 hover:bg-emerald-300 transition"
        >
          Continue To Insight Chat
        </button>
      </div>
    </div>
  );
}
