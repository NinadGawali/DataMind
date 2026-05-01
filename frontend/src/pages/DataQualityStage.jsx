import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useDataSession } from '../context/DataSessionContext';
import DataQualityPanel from '../components/DataQualityPanel';

export default function DataQualityStage() {
  const navigate = useNavigate();
  const { sessionId, datasetInfo } = useDataSession();

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
      <motion.div
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-4 glass p-6"
      >
        <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Stage 03</p>
        <h2 className="text-2xl font-extrabold mt-2">Data Quality Intelligence</h2>
        <p className="text-slate-300 mt-3">
          Analyze null values and outliers, then apply cleanup actions directly on the active dataframe session.
          This stage focuses on data hygiene before feature encoding and modeling.
        </p>
      </motion.div>

      <div className="lg:col-span-8">
        <DataQualityPanel sessionId={sessionId} />
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/feature-engineering')}
            className="rounded-xl px-5 py-3 font-semibold bg-emerald-400 text-slate-900 hover:bg-emerald-300 transition"
          >
            Continue to Feature Engineering
          </button>
        </div>
      </div>
    </div>
  );
}
