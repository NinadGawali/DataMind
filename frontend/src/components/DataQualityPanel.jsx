import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  analyzeDataQuality,
  chatDataQuality,
  analyzeNullValues,
  applyNullImputation,
  analyzeOutliers,
  applyOutlierHandling,
} from '../services/api';

const NULL_STRATEGIES = [
  { value: 'drop_rows', label: 'Drop rows' },
  { value: 'drop_columns', label: 'Drop columns' },
  { value: 'fill_avg', label: 'Fill with average' },
  { value: 'fill_mean', label: 'Fill with mean' },
  { value: 'fill_mode', label: 'Fill with mode' },
  { value: 'fill_median', label: 'Fill with median' },
  { value: 'fill_forward', label: 'Fill forward (ffill)' },
  { value: 'fill_backward', label: 'Fill backward (bfill)' },
  { value: 'fill_interpolate', label: 'Interpolate value' },
];

const OUTLIER_STRATEGIES = [
  { value: 'drop_rows', label: 'Drop outlier rows' },
  { value: 'iqr_rescale', label: 'Rescale to IQR bounds' },
];

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

export default function DataQualityPanel({ sessionId }) {
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isApplyingNulls, setIsApplyingNulls] = useState(false);
  const [isApplyingOutliers, setIsApplyingOutliers] = useState(false);

  const [summary, setSummary] = useState('');
  const [questions, setQuestions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [visuals, setVisuals] = useState({ null_columns: [], outlier_columns: [] });
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState([]);

  const [nullMode, setNullMode] = useState('analyze');
  const [nullStrategy, setNullStrategy] = useState('fill_mean');
  const [nullColumnsRaw, setNullColumnsRaw] = useState('');
  const [nullProfile, setNullProfile] = useState(null);

  const [outlierMode, setOutlierMode] = useState('analyze');
  const [outlierStrategy, setOutlierStrategy] = useState('iqr_rescale');
  const [outlierColumnsRaw, setOutlierColumnsRaw] = useState('');
  const [iqrFactor, setIqrFactor] = useState('1.5');
  const [outlierProfile, setOutlierProfile] = useState(null);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Use the agent controls above to analyze or fix nulls and outliers. I can also guide you in chat based on your data context.',
    },
  ]);
  const [query, setQuery] = useState('');

  const history = useMemo(
    () => messages.filter((m) => m.role === 'user' || m.role === 'assistant').map(({ role, content }) => ({ role, content })),
    [messages],
  );

  const nullChartData = (visuals.null_columns || []).slice(0, 8).map((row) => ({
    column: row.column,
    count: row.count,
  }));

  const outlierChartData = (visuals.outlier_columns || []).slice(0, 8).map((row) => ({
    column: row.column,
    count: row.count,
  }));

  const refreshDataQuality = async (id, options = {}) => {
    const { preserveChat = false } = options;
    const [qualityResponse, nullResponse, outlierResponse] = await Promise.all([
      analyzeDataQuality({ session_id: id }),
      analyzeNullValues({ session_id: id }),
      analyzeOutliers({ session_id: id, columns: [], iqr_factor: Number(iqrFactor) || 1.5 }),
    ]);

    const qualityData = qualityResponse.data || {};
    const nullData = nullResponse.data || {};
    const outlierData = outlierResponse.data || {};

    setSummary(qualityData.summary || 'No summary available.');
    setQuestions(Array.isArray(qualityData.questions) ? qualityData.questions : []);
    setRecommendations(Array.isArray(qualityData.recommendations) ? qualityData.recommendations : []);
    setVisuals(qualityData.visuals || { null_columns: [], outlier_columns: [] });
    setAllQuestionsAnswered(false);
    setAnsweredQuestionIds([]);

    setNullProfile(nullData);
    setOutlierProfile(outlierData);

    if (!preserveChat) {
      const introMessages = [
        {
          role: 'assistant',
          content: qualityData.summary || 'Analyzing your dataset quality...',
        },
      ];

      if ((qualityData.questions || []).length > 0) {
        introMessages.push({
          role: 'assistant',
          content: `If you want tailored recommendations, answer this first question:\n\n${qualityData.questions[0].question}`,
        });
      }

      setMessages(introMessages);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;
    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        await refreshDataQuality(sessionId);
      } catch (error) {
        if (!isMounted) return;
        const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to analyze data quality';
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

  const sendMessage = async (text) => {
    const cleaned = text.trim();
    if (!cleaned || isSending) return;

    setMessages((prev) => [...prev, { role: 'user', content: cleaned }]);
    setQuery('');
    setIsSending(true);

    try {
      const response = await chatDataQuality({
        session_id: sessionId,
        query: cleaned,
        history,
        answered_question_ids: answeredQuestionIds,
      });

      const data = response.data || {};
      setSummary(data.summary || summary);
      setVisuals(data.visuals || visuals);
      setRecommendations(data.recommendations || []);
      setAllQuestionsAnswered(data.all_questions_answered || false);

      const nextQuestions = data.next_questions || [];
      setQuestions(nextQuestions);

      const newlyAnswered = [...answeredQuestionIds];
      questions.forEach((question) => {
        if (!nextQuestions.some((nextQuestion) => nextQuestion.id === question.id) && !newlyAnswered.includes(question.id)) {
          newlyAnswered.push(question.id);
        }
      });
      setAnsweredQuestionIds(newlyAnswered);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'I could not generate a response. Please provide more context.',
        },
      ]);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Data quality agent request failed';
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I hit an error while processing that response. Please try again.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleAnalyzeNulls = async () => {
    if (!sessionId) return;
    setIsApplyingNulls(true);
    try {
      const response = await analyzeNullValues({ session_id: sessionId });
      setNullProfile(response.data || null);
      toast.success('Null-value analysis updated');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed null-value analysis';
      toast.error(msg);
    } finally {
      setIsApplyingNulls(false);
    }
  };

  const handleApplyNulls = async () => {
    if (!sessionId) return;
    setIsApplyingNulls(true);

    try {
      const columns = parseColumns(nullColumnsRaw);
      const response = await applyNullImputation({
        session_id: sessionId,
        strategy: nullStrategy,
        columns,
      });

      const data = response.data || {};
      setNullProfile(data.profile || null);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Null agent applied '${nullStrategy}'. Nulls before: ${data.before_total_nulls ?? '-'}, after: ${data.after_total_nulls ?? '-'}.`,
        },
      ]);

      await refreshDataQuality(sessionId, { preserveChat: true });
      toast.success('Null imputation applied to dataframe');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to apply null imputation';
      toast.error(msg);
    } finally {
      setIsApplyingNulls(false);
    }
  };

  const handleAnalyzeOutliers = async () => {
    if (!sessionId) return;
    setIsApplyingOutliers(true);
    try {
      const response = await analyzeOutliers({
        session_id: sessionId,
        columns: parseColumns(outlierColumnsRaw),
        iqr_factor: Number(iqrFactor) || 1.5,
      });
      setOutlierProfile(response.data || null);
      toast.success('Outlier analysis updated');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed outlier analysis';
      toast.error(msg);
    } finally {
      setIsApplyingOutliers(false);
    }
  };

  const handleApplyOutliers = async () => {
    if (!sessionId) return;
    setIsApplyingOutliers(true);

    try {
      const response = await applyOutlierHandling({
        session_id: sessionId,
        strategy: outlierStrategy,
        columns: parseColumns(outlierColumnsRaw),
        iqr_factor: Number(iqrFactor) || 1.5,
      });

      const data = response.data || {};
      setOutlierProfile(data.profile || null);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Outlier agent applied '${outlierStrategy}'. Rows removed: ${data.rows_changed ?? 0}.`,
        },
      ]);

      await refreshDataQuality(sessionId, { preserveChat: true });
      toast.success('Outlier handling applied to dataframe');
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to apply outlier handling';
      toast.error(msg);
    } finally {
      setIsApplyingOutliers(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    await sendMessage(query);
  };

  return (
    <div className="glass p-5 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Data Quality Agents</p>
          <h3 className="text-2xl font-bold mt-1">Null Values & Outliers</h3>
        </div>
        {(isBootstrapping || isSending || isApplyingNulls || isApplyingOutliers) && (
          <div className="inline-flex items-center gap-2 text-slate-300 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            Agent is working...
          </div>
        )}
      </div>

      <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 text-slate-200 whitespace-pre-wrap leading-relaxed min-h-24">
        {summary || 'Analyzing dataset quality...'}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 h-72">
          <h4 className="font-semibold text-sky-300 mb-3">Top Null-Value Columns</h4>
          {nullChartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nullChartData} margin={{ top: 8, right: 10, left: 0, bottom: 46 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="column" angle={-25} textAnchor="end" tick={{ fill: '#cbd5e1', fontSize: 11 }} interval={0} />
                <YAxis tick={{ fill: '#cbd5e1' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm">No null-value hotspots detected.</p>
          )}
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4 h-72">
          <h4 className="font-semibold text-rose-300 mb-3">Top Outlier Columns (IQR)</h4>
          {outlierChartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outlierChartData} margin={{ top: 8, right: 10, left: 0, bottom: 46 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="column" angle={-25} textAnchor="end" tick={{ fill: '#cbd5e1', fontSize: 11 }} interval={0} />
                <YAxis tick={{ fill: '#cbd5e1' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                <Bar dataKey="count" fill="#fb7185" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm">No outlier hotspots detected.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-sky-300">Null Value Agent</h4>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setNullMode('analyze')}
              className={`px-3 py-1.5 rounded-lg ${nullMode === 'analyze' ? 'bg-sky-500 text-slate-900' : 'bg-slate-800 text-slate-200'}`}
            >
              Analyze Null Values
            </button>
            <button
              type="button"
              onClick={() => setNullMode('fill')}
              className={`px-3 py-1.5 rounded-lg ${nullMode === 'fill' ? 'bg-emerald-400 text-slate-900' : 'bg-slate-800 text-slate-200'}`}
            >
              Fill Null Values
            </button>
          </div>

          <input
            value={nullColumnsRaw}
            onChange={(event) => setNullColumnsRaw(event.target.value)}
            placeholder="Optional columns, comma separated"
            className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-sky-300"
          />

          {nullMode === 'fill' && (
            <select
              value={nullStrategy}
              onChange={(event) => setNullStrategy(event.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-emerald-300"
            >
              {NULL_STRATEGIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={nullMode === 'analyze' ? handleAnalyzeNulls : handleApplyNulls}
            disabled={isApplyingNulls}
            className="rounded-xl px-4 py-2.5 font-semibold bg-sky-500 text-slate-900 hover:bg-sky-400 disabled:opacity-40"
          >
            {nullMode === 'analyze' ? 'Run Null Analysis' : 'Apply Null Imputation'}
          </button>

          <p className="text-xs text-slate-400">
            Total nulls: {nullProfile?.total_nulls ?? 0} | Columns with nulls: {(nullProfile?.null_columns || []).length}
          </p>
        </div>

        <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-rose-300">Outlier Agent</h4>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setOutlierMode('analyze')}
              className={`px-3 py-1.5 rounded-lg ${outlierMode === 'analyze' ? 'bg-rose-500 text-slate-900' : 'bg-slate-800 text-slate-200'}`}
            >
              Analyze Outliers
            </button>
            <button
              type="button"
              onClick={() => setOutlierMode('apply')}
              className={`px-3 py-1.5 rounded-lg ${outlierMode === 'apply' ? 'bg-emerald-400 text-slate-900' : 'bg-slate-800 text-slate-200'}`}
            >
              Handle Outliers
            </button>
          </div>

          <input
            value={outlierColumnsRaw}
            onChange={(event) => setOutlierColumnsRaw(event.target.value)}
            placeholder="Optional numeric columns, comma separated"
            className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-rose-300"
          />

          <div className="flex gap-3">
            <input
              value={iqrFactor}
              onChange={(event) => setIqrFactor(event.target.value)}
              placeholder="IQR factor (default 1.5)"
              className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-rose-300"
            />
            {outlierMode === 'apply' && (
              <select
                value={outlierStrategy}
                onChange={(event) => setOutlierStrategy(event.target.value)}
                className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm outline-none focus:border-emerald-300"
              >
                {OUTLIER_STRATEGIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={outlierMode === 'analyze' ? handleAnalyzeOutliers : handleApplyOutliers}
            disabled={isApplyingOutliers}
            className="rounded-xl px-4 py-2.5 font-semibold bg-rose-500 text-slate-900 hover:bg-rose-400 disabled:opacity-40"
          >
            {outlierMode === 'analyze' ? 'Run Outlier Analysis' : 'Apply Outlier Handling'}
          </button>

          <p className="text-xs text-slate-400">
            Outlier columns found: {(outlierProfile?.outlier_columns || []).length} | IQR factor: {outlierProfile?.iqr_factor ?? iqrFactor}
          </p>
        </div>
      </div>

      <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4">
        <h4 className="font-semibold text-emerald-300 mb-3">Data Quality Chat</h4>
        <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={`${message.role}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[90%] px-4 py-3 rounded-xl whitespace-pre-wrap leading-relaxed text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-sky-500 text-slate-900'
                    : 'bg-slate-800/90 text-slate-100 border border-white/10'
                }`}
              >
                {message.content}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about null handling, outliers, and strategy tradeoffs..."
            className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-3 text-sm outline-none focus:border-emerald-300"
          />
          <button
            type="submit"
            disabled={isSending || !query.trim()}
            className="rounded-xl px-5 py-3 font-semibold bg-emerald-400 text-slate-900 hover:bg-emerald-300 disabled:opacity-40 text-sm"
          >
            Send
          </button>
        </form>
      </div>

      {allQuestionsAnswered && recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <div className="bg-emerald-500/10 border border-emerald-300/30 rounded-xl p-4">
            <h4 className="font-semibold text-emerald-200 mb-2">Tailored Recommendations</h4>
            <p className="text-sm text-emerald-100/90">
              Based on your answers and dataset profile, these recommendations are tailored for your workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {recommendations.map((item) => (
              <div key={`${item.title}-${item.category}`} className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-cyan-300">{item.category}</p>
                <h4 className="text-lg font-semibold mt-2 text-white">{item.title}</h4>
                <p className="text-sm text-slate-300 mt-2">{item.why}</p>
                <ul className="mt-3 text-sm text-slate-200 list-disc pl-5 space-y-1.5">
                  {(item.actions || []).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {allQuestionsAnswered && recommendations.length === 0 && (
        <div className="bg-blue-500/10 border border-blue-300/30 rounded-xl p-4">
          <h4 className="font-semibold text-blue-200">Analysis Complete</h4>
          <p className="text-sm text-blue-100/90 mt-2">
            No major null or outlier issues detected. Your dataset is ready for downstream modeling.
          </p>
        </div>
      )}

      {questions.length > 0 && !allQuestionsAnswered && (
        <div className="bg-amber-500/10 border border-amber-300/30 rounded-xl p-4">
          <h4 className="font-semibold text-amber-200 mb-2">Pending Question</h4>
          <p className="text-sm text-amber-100/90">{questions[0]?.question}</p>
        </div>
      )}
    </div>
  );
}
