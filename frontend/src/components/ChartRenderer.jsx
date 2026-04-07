import {
  BarChart, Bar,
  ScatterChart, Scatter,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#a855f7'];

export default function ChartRenderer({ vizData, isLoading }) {
  if (isLoading) {
    return (
      <div className="glass p-6 w-full h-96 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!vizData) {
    return (
      <div className="glass p-6 w-full h-96 flex items-center justify-center flex-col text-gray-500">
        <p>No visualization generated yet.</p>
        <p className="text-sm mt-2">Use the controls on the left to create a chart.</p>
      </div>
    );
  }

  const { type, chart_data, meta } = vizData;
  const previewRows = chart_data.points || [];
  const pieData = (chart_data.labels || []).map((label, idx) => ({
    name: label,
    value: chart_data.y?.[idx] ?? 0,
  }));

  const renderChart = () => {
    switch (type) {
      case 'histogram':
      case 'countplot': {
        const data = chart_data.x.map((x, i) => ({
          name: x,
          value: chart_data.y[i],
        }));

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="name" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                itemStyle={{ color: '#60a5fa' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      }
      
      case 'scatter': {
        const data = chart_data.x.map((x, i) => ({
          x,
          y: chart_data.y[i],
          series: chart_data.series ? chart_data.series[i] : 'default',
        }));

        // Group by series if hue exists
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" dataKey="x" name={meta.x_label} stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis type="number" dataKey="y" name={meta.y_label} stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
              />
              <Scatter name="Data" data={data} fill="#3b82f6">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        );
      }

      case 'line': {
        const data = chart_data.x.map((x, i) => ({
          x,
          y: chart_data.y?.[i],
        }));

        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="x" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
              <Line type="monotone" dataKey="y" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      }

      case 'area': {
        const data = chart_data.x.map((x, i) => ({
          x,
          y: chart_data.y?.[i],
        }));

        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="x" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
              <Area type="monotone" dataKey="y" stroke="#34d399" fill="#34d39944" />
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      case 'pie': {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
              <Legend />
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130}>
                {pieData.map((entry, index) => (
                  <Cell key={`pie-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        );
      }

      case 'boxplot': {
        // Pseudo boxplot using scatter for basic display (recharts lacks native boxplot without custom shapes)
        const data = chart_data.x.map((x, i) => ({ x: meta.x_label, y: x }));
        return (
          <ResponsiveContainer width="100%" height="100%">
             <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="category" dataKey="x" name={meta.x_label} stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis type="number" dataKey="y" name="Value" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
              />
              <Scatter name="Values" data={data} fill="#10b981" />
            </ScatterChart>
          </ResponsiveContainer>
        );
      }

      default:
        return <p>Unsupported chart type</p>;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={vizData.type + (meta.x_label || '') + (meta.y_label || '')}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="glass p-6 w-full"
      >
        <h2 className="text-xl font-bold mb-4 uppercase tracking-wider text-gray-200">
          {type} <span className="text-sm font-normal text-gray-400 capitalize">({meta.x_label}{meta.y_label ? ` vs ${meta.y_label}` : ''})</span>
        </h2>
        <div className="w-full h-[420px]">
          {renderChart()}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
            <h3 className="font-semibold text-emerald-300 mb-2">AI Insight</h3>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{vizData.ai_insight || 'No insight available.'}</p>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
            <h3 className="font-semibold text-amber-300 mb-2">Mathematical Summary</h3>
            <pre className="text-xs text-slate-200 overflow-auto max-h-56 whitespace-pre-wrap">
              {JSON.stringify(vizData.math_summary || {}, null, 2)}
            </pre>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
            <h3 className="font-semibold text-sky-300 mb-2">Complete Chart Data</h3>
            <p className="text-xs text-slate-400 mb-2">Records: {previewRows.length}</p>
            <pre className="text-xs text-slate-200 overflow-auto max-h-56 whitespace-pre-wrap">
              {JSON.stringify(chart_data, null, 2)}
            </pre>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}