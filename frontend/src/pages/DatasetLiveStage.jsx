import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

import { useDataSession } from '../context/DataSessionContext';
import { getDatasetDownloadUrl, getDatasetSnapshot } from '../services/api';

const PAGE_SIZE = 50;
const REFRESH_MS = 3000;

export default function DatasetLiveStage() {
  const navigate = useNavigate();
  const { sessionId, datasetInfo } = useDataSession();

  const [isLoading, setIsLoading] = useState(false);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [snapshot, setSnapshot] = useState({
    columns: [],
    rows: [],
    row_count: 0,
    column_count: 0,
    offset: 0,
    limit: PAGE_SIZE,
    returned_rows: 0,
    refreshed_at: '',
  });

  const totalPages = useMemo(() => {
    if (!snapshot.row_count) return 1;
    return Math.max(1, Math.ceil(snapshot.row_count / PAGE_SIZE));
  }, [snapshot.row_count]);

  const currentPage = useMemo(() => Math.floor(snapshot.offset / PAGE_SIZE) + 1, [snapshot.offset]);

  const fetchSnapshot = async (offset = snapshot.offset) => {
    if (!sessionId) return;

    setIsLoading(true);
    try {
      const response = await getDatasetSnapshot({
        session_id: sessionId,
        limit: PAGE_SIZE,
        offset,
      });
      setSnapshot(response);
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to fetch live dataset';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    fetchSnapshot(0);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !isAutoRefresh) return;

    const intervalId = setInterval(() => {
      fetchSnapshot(snapshot.offset);
    }, REFRESH_MS);

    return () => clearInterval(intervalId);
  }, [sessionId, isAutoRefresh, snapshot.offset]);

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
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-4 glass p-6"
        >
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Independent View</p>
          <h2 className="text-2xl font-extrabold mt-2">Live Dataset</h2>
          <p className="text-slate-300 mt-3 text-sm">
            This table shows the current session dataframe. Any null/outlier fixes applied by agents are reflected here live.
          </p>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>Rows: {snapshot.row_count}</p>
            <p>Columns: {snapshot.column_count}</p>
            <p>Last refresh: {snapshot.refreshed_at ? new Date(snapshot.refreshed_at).toLocaleTimeString() : '-'}</p>
          </div>
        </motion.div>

        <div className="lg:col-span-8 glass p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fetchSnapshot(snapshot.offset)}
              disabled={isLoading}
              className="rounded-xl px-4 py-2 font-semibold bg-sky-500 text-slate-900 hover:bg-sky-400 disabled:opacity-40"
            >
              Refresh Now
            </button>

            <button
              type="button"
              onClick={() => setIsAutoRefresh((prev) => !prev)}
              className={`rounded-xl px-4 py-2 font-semibold ${
                isAutoRefresh ? 'bg-emerald-400 text-slate-900 hover:bg-emerald-300' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isAutoRefresh ? 'Auto Refresh: ON' : 'Auto Refresh: OFF'}
            </button>

            <a
              href={getDatasetDownloadUrl(sessionId)}
              className="rounded-xl px-4 py-2 font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300"
            >
              Download Current CSV
            </a>
          </div>

          <div className="overflow-auto border border-white/10 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800/90 sticky top-0">
                <tr>
                  {snapshot.columns.map((column) => (
                    <th key={column} className="text-left px-3 py-2 border-b border-white/10 whitespace-nowrap">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-400" colSpan={Math.max(1, snapshot.columns.length)}>
                      {isLoading ? 'Loading rows...' : 'No rows available.'}
                    </td>
                  </tr>
                ) : (
                  snapshot.rows.map((row, index) => (
                    <tr key={`${snapshot.offset + index}`} className="odd:bg-slate-900/30 even:bg-slate-900/10">
                      {snapshot.columns.map((column) => (
                        <td key={`${snapshot.offset + index}-${column}`} className="px-3 py-2 border-b border-white/5 whitespace-nowrap">
                          {row[column] === null || row[column] === undefined || row[column] === '' ? (
                            <span className="text-rose-300">NULL</span>
                          ) : (
                            String(row[column])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => fetchSnapshot(Math.max(0, snapshot.offset - PAGE_SIZE))}
              disabled={snapshot.offset === 0 || isLoading}
              className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
            >
              Previous
            </button>

            <p className="text-sm text-slate-300">
              Page {currentPage} of {totalPages}
            </p>

            <button
              type="button"
              onClick={() => fetchSnapshot(snapshot.offset + PAGE_SIZE)}
              disabled={snapshot.offset + PAGE_SIZE >= snapshot.row_count || isLoading}
              className="rounded-lg px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
