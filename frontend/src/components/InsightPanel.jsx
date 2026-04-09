import { motion } from 'framer-motion';

export default function InsightPanel({ insightData, isLoading, onGetInsight }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass p-6 w-full mt-6"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          AI Insights
        </h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onGetInsight}
          disabled={isLoading}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg disabled:opacity-50 transition-all flex items-center"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Analyzing...
            </>
          ) : (
            'Generate New Insight'
          )}
        </motion.button>
      </div>

      <div className="bg-gray-800/40 p-4 rounded-lg min-h-[150px] whitespace-pre-wrap text-gray-300 leading-relaxed border border-gray-700/50 shadow-inner">
        {insightData ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {insightData.insight}
          </motion.div>
        ) : (
          <p className="text-gray-500 italic flex items-center justify-center h-full">
            Click the button to generate deep statistical insights using Gemini AI.
          </p>
        )}
      </div>
    </motion.div>
  );
}