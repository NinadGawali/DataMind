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

import { analyzeDataQuality, chatDataQuality } from '../services/api';

export default function DataQualityAgentPanel({ sessionId }) {
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [summary, setSummary] = useState('');
  const [questions, setQuestions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [visuals, setVisuals] = useState({ null_columns: [], outlier_columns: [] });

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'I will analyze null values and outliers, ask what they mean in your domain, then propose imputation and rescaling choices.',
    },
  ]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;
    const bootstrap = async () => {
      setIsBootstrapping(true);
      try {
        const response = await analyzeDataQuality({ session_id: sessionId });
        if (!isMounted) return;

        const data = response.data || {};
        setSummary(data.summary || 'No summary available.');
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
        setVisuals(data.visuals || { null_columns: [], outlier_columns: [] });

        if (data.summary) {
          setMessages((prev) => [...prev, { role: 'assistant', content: data.summary }]);
        }

        if (Array.isArray(data.questions) && data.questions.length) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `To tailor fixes, please answer these:\n- ${data.questions.slice(0, 2).join('\n- ')}`,
            },
          ]);
        }
      } catch (error) {
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
      });

      const data = response.data || {};
      setSummary(data.summary || summary);
      setVisuals(data.visuals || visuals);
      setQuestions(Array.isArray(data.pending_questions) ? data.pending_questions : []);
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'I could not generate a recommendation. Please provide more context.',
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

  const onSubmit = async (event) => {
    event.preventDefault();
    await sendMessage(query);
  };

  return (
    <div className="glass p-5 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Null + Outlier Agent</p>
          <h3 className="text-2xl font-bold mt-1">Data Quality Intelligence</h3>
        </div>
        {(isBootstrapping || isSending) && (
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

      {questions.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-300/30 rounded-xl p-4">
          <h4 className="font-semibold text-amber-200 mb-2">Pending Questions</h4>
          <ul className="text-sm text-amber-100/90 list-disc pl-5 space-y-1">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recommendations.map((item) => (
          <div key={`${item.title}-${item.category}`} className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">{item.category}</p>
            <h4 className="text-lg font-semibold mt-1">{item.title}</h4>
            <p className="text-sm text-slate-300 mt-2">{item.why}</p>
            <ul className="mt-3 text-sm text-slate-200 list-disc pl-5 space-y-1">
              {(item.actions || []).map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4">
        <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={`${message.role}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-[90%] px-4 py-3 rounded-xl whitespace-pre-wrap leading-relaxed ${
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
            placeholder="Answer the questions: are nulls meaningful? are outliers real or noise?"
            className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300"
          />
          <button
            type="submit"
            disabled={isSending || !query.trim()}
            className="rounded-xl px-5 py-3 font-semibold bg-emerald-400 text-slate-900 hover:bg-emerald-300 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
