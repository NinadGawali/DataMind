import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useDataSession } from '../context/DataSessionContext';
import InsightChatbot from '../components/InsightChatbot';

export default function InsightsStage() {
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
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Stage 03</p>
        <h2 className="text-2xl font-extrabold mt-2">Interactive Insights Agent</h2>
        <p className="text-slate-300 mt-3">
          Ask complex questions. The assistant can choose to execute dataframe code through a LangGraph
          workflow to compute precise answers.
        </p>
      </motion.div>

      <div className="lg:col-span-8">
        <InsightChatbot sessionId={sessionId} />
      </div>
    </div>
  );
}
