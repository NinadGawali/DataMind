import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { chatInsight } from '../services/api';

const starterPrompts = [
  'Which columns have the strongest variance and why?',
  'Find potential outliers and explain the detection approach.',
  'Segment the dataset and compare key metrics across segments.',
];

export default function InsightChatbot({ sessionId }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'I am your data insight agent. Ask me analytical questions, and I will compute metrics from your dataset when needed.',
    },
  ]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const history = useMemo(
    () => messages.filter((m) => m.role === 'user' || m.role === 'assistant').map(({ role, content }) => ({ role, content })),
    [messages],
  );

  const sendMessage = async (text) => {
    const cleaned = text.trim();
    if (!cleaned || isLoading) return;

    const nextMessages = [...messages, { role: 'user', content: cleaned }];
    setMessages(nextMessages);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await chatInsight({
        session_id: sessionId,
        query: cleaned,
        history,
      });

      setMessages((prev) => [...prev, { role: 'assistant', content: response.data.reply }]);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Insight request failed';
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I hit an error while processing that request. Please try again with a narrower question.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    await sendMessage(query);
  };

  return (
    <div className="glass h-[72vh] flex flex-col overflow-hidden">
      <div className="p-4 border-b border-white/10 flex flex-wrap gap-2">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-full text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[84%] px-4 py-3 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                message.role === 'user'
                  ? 'ml-auto bg-sky-500 text-slate-900'
                  : 'bg-slate-800/80 text-slate-100 border border-white/10'
              }`}
            >
              {message.content}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="inline-flex items-center gap-2 text-slate-300 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            Agent is reasoning and running analysis...
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="p-4 border-t border-white/10 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask for trend analysis, outlier detection, or metric comparisons..."
          className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-3 outline-none focus:border-emerald-300"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="rounded-xl px-5 py-3 font-semibold bg-emerald-400 text-slate-900 hover:bg-emerald-300 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
