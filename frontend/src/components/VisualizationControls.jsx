import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const chartTypes = [
  { id: 'histogram', label: 'Histogram' },
  { id: 'scatter', label: 'Scatter Plot' },
  { id: 'boxplot', label: 'Box Plot' },
  { id: 'countplot', label: 'Count Plot' },
];

export default function VisualizationControls({ columns, onVisualize }) {
  const [config, setConfig] = useState({
    type: 'histogram',
    x: '',
    y: '',
    hue: '',
  });

  // Reset x,y,hue when columns change
  useEffect(() => {
    if (columns.length > 0) {
      setConfig((prev) => ({
        ...prev,
        x: columns[0],
        y: '',
        hue: '',
      }));
    }
  }, [columns]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onVisualize(config);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass p-6 w-full mt-4"
    >
      <h2 className="text-xl font-bold mb-4">Chart Configuration</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Chart Type</label>
          <select
            name="type"
            value={config.type}
            onChange={handleChange}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
          >
            {chartTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">X-Axis</label>
          <select
            name="x"
            value={config.x}
            onChange={handleChange}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
            required
          >
            <option value="" disabled>Select column...</option>
            {columns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {config.type === 'scatter' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Y-Axis</label>
            <select
              name="y"
              value={config.y}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
              required={config.type === 'scatter'}
            >
              <option value="">None</option>
              {columns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {config.type === 'scatter' && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">Hue (Optional)</label>
            <select
              name="hue"
              value={config.hue}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">None</option>
              {columns.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors mt-4"
        >
          Generate Chart
        </motion.button>
      </form>
    </motion.div>
  );
}