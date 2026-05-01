import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';

import { analyzeFeatureEngineering, applyFeatureEncoding } from '../services/api';

const FEATURE_STRATEGIES = [
  { value: 'auto', label: 'Auto recommend' },
  { value: 'one_hot', label: 'One-hot encoding' },
  { value: 'label', label: 'Label encoding' },
  { value: 'frequency', label: 'Frequency encoding' },
  { value: 'hashing', label: 'Hash encoding' },
];

function parseColumns(raw) {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function FeatureEngineeringPanel({ sessionId }) {
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [mode, setMode] = useState('analyze');
  const [strategy, setStrategy] = useState('auto');
  const [columnsRaw, setColumnsRaw] = useState('');
  const [hashBins, setHashBins] = useState('16');
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;
    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        const response = await analyzeFeatureEngineering({ session_id: sessionId, columns: [] });
        if (!isMounted) return;

        const data = response.data || {};
        setProfile(data || null);
        setSummary(data.summary || 'No feature encoding summary available yet.');
      } catch (error) {
        const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed feature encoding analysis';
        toast.error(msg);
      } finally {
        if (isMounted) setIsBootstrapping(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  const handleAnalyze = async () => {
    if (!sessionId) return;
    setIsWorking(true);
    try {
      const response = await analyzeFeatureEngineering({
        session_id: sessionId,
        columns: parseColumns(columnsRaw),
      });
      const data = response.data || {};
      setProfile(data || null);
      setSummary(data.summary || 'No feature encoding summary available.');
      toast.success('Feature encoding recommendations updated');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed feature engineering analysis';
      toast.error(msg);
    } finally {
      setIsWorking(false);
    }
  };

  const handleApply = async () => {
    if (!sessionId) return;
    setIsWorking(true);

    try {
      const response = await applyFeatureEncoding({
        session_id: sessionId,
        strategy,
        columns: parseColumns(columnsRaw),
        hash_bins: Number(hashBins) || 16,
      });

      const data = response.data || {};
      setProfile(data.profile || null);
      setSummary(data.profile?.summary || 'Feature encoding applied to dataframe.');
      toast.success('Feature encoding applied to dataframe');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to apply feature encoding';
      toast.error(msg);
    } finally {
      setIsWorking(false);
    }
  };

  const hasProfiles = Array.isArray(profile?.profiles) && profile.profiles.length > 0;

  return (
    <div className="glass p-5 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Feature Engineering Agent</p>
          <h3 className="text-2xl font-bold mt-1">Categorical Encoding</h3>
        </div>
        {(isBootstrapping || isWorking) && (
          <div className="inline-flex items-center gap-2 text-slate-300 text-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            Agent is working...
          </div>
        )}
      </div>

      <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 text-slate-200 whitespace-pre-wrap leading-relaxed min-h-24">
        {summary || 'Analyzing feature encoding opportunities...'}
      </div>

      <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode('analyze')}
            className={`px-3 py-1.5 rounded-lg ${mode === 'analyze' ? 'bg-cyan-400 text-slate-900' : 'bg-slate-800 text-slate-200'}`}
          >
            Analyze Encoding
          </button>
          <button
            type="button"
            onClick={() => setMode('apply')}
            className={`px-3 py-1.5 rounded-lg ${mode === 'apply' ? 'bg-emerald-400 text-slate-900' : 'bg-slate-800 text-slate-200'}`}
          >
            Apply Encoding
          </button>
        </div>

        <input
          value={columnsRaw}
          onChange={(event) => setColumnsRaw(event.target.value)}
          placeholder="Optional categorical columns, comma separated"
          className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-cyan-300"
        />

        {mode === 'apply' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={strategy}
              onChange={(event) => setStrategy(event.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-emerald-300"
            >
              {FEATURE_STRATEGIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              value={hashBins}
              onChange={(event) => setHashBins(event.target.value)}
              placeholder="Hash bins (for hash encoding)"
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-emerald-300"
            />
          </div>
        )}

        <button
          type="button"
          onClick={mode === 'analyze' ? handleAnalyze : handleApply}
          disabled={isWorking}
          className="rounded-xl px-4 py-2.5 font-semibold bg-cyan-400 text-slate-900 hover:bg-cyan-300 disabled:opacity-40"
        >
          {mode === 'analyze' ? 'Run Encoding Analysis' : 'Apply Feature Encoding'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Profile Summary</p>
          <p className="text-sm text-slate-300">{profile?.summary || 'No feature encoding summary available.'}</p>
          <p className="text-xs text-slate-400">
            Suggested columns: {(profile?.categorical_columns || []).length} | Supported encodings: auto, one-hot, label, frequency, hashing
          </p>
        </div>

        <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Recommended Scope</p>
          <p className="text-sm text-slate-300">
            {mode === 'apply'
              ? 'Apply the encoding strategy to selected columns, or leave columns blank to let the agent pick.'
              : 'Ask the agent to inspect categorical columns and recommend the right encoding strategy.'}
          </p>
        </div>
      </div>

      {hasProfiles && (
        <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h4 className="font-semibold text-cyan-300">Feature Encoding Recommendations</h4>
            <p className="text-xs text-slate-400">AI-guided guidance based on cardinality and distribution</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(profile.profiles || []).slice(0, 6).map((item) => (
              <div key={item.column} className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">{item.suggested_strategy}</p>
                <h5 className="text-base font-semibold mt-1">{item.column}</h5>
                <p className="text-sm text-slate-300 mt-2">
                  {item.unique_count} unique values, {item.missing_rate}% missing, top value share {item.top_share_percent}%.
                </p>
                <p className="text-sm text-slate-400 mt-2">{item.recommended_reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}