import { motion } from 'framer-motion';

export default function DatasetInfo({ info }) {
  if (!info) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="glass p-6 w-full mt-4"
    >
      <h2 className="text-xl font-bold mb-4">Dataset Overview</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <p className="text-sm text-gray-400 uppercase">Rows</p>
          <p className="text-2xl font-bold">{info.shape[0].toLocaleString()}</p>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <p className="text-sm text-gray-400 uppercase">Columns</p>
          <p className="text-2xl font-bold">{info.shape[1]}</p>
        </div>
      </div>

      <div>
        <h3 className="text-md font-semibold text-gray-300 mb-2">Columns & Types</h3>
        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {Object.entries(info.dtypes).map(([col, type]) => (
            <div key={col} className="flex justify-between items-center bg-gray-800/30 p-2 rounded">
              <span className="font-mono text-sm text-blue-300 truncate w-3/5">{col}</span>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded w-1/3 text-center text-gray-300">
                {type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}