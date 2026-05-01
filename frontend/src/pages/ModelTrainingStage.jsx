import React, { useState, useEffect } from 'react';
import { useDataSession } from '../context/DataSessionContext';
import * as api from '../services/api';
import { motion } from 'framer-motion';

export default function ModelTrainingStage() {
  const { sessionId, datasetInfo } = useDataSession();
  const [targetColumn, setTargetColumn] = useState('');
  const [columns, setColumns] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [taskType, setTaskType] = useState(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainedModel, setTrainedModel] = useState(null);
  const [error, setError] = useState(null);

  // Get available columns on mount
  useEffect(() => {
    if (datasetInfo?.columns) {
      setColumns(datasetInfo.columns);
    }
  }, [datasetInfo]);

  const handleAnalyze = async () => {
    if (!targetColumn) {
      setError('Please select a target column');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const response = await api.analyzeModelTraining({
        session_id: sessionId,
        target_column: targetColumn,
      });
      setAnalysis(response.data);
      setTaskType(response.data.task_type);
      // Pre-select first recommended model
      if (response.data.recommended_models?.length > 0) {
        setSelectedModel(response.data.recommended_models[0].model);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to analyze');
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    if (!selectedModel) {
      setError('Please select a model');
      return;
    }
    setError(null);
    setTraining(true);
    try {
      const response = await api.trainModel({
        session_id: sessionId,
        target_column: targetColumn,
        model_name: selectedModel,
        task_type: taskType,
      });
      setTrainedModel(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to train model');
    } finally {
      setTraining(false);
    }
  };

  const handleDownload = () => {
    const url = api.getModelDownloadUrl(sessionId);
    const link = document.createElement('a');
    link.href = url;
    link.click();
  };

  const getMetricsDisplay = () => {
    if (!trainedModel?.metrics) return null;
    const metrics = trainedModel.metrics;
    
    if (taskType === 'regression') {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-sm text-slate-400">Train R²</p>
            <p className="text-2xl font-bold text-sky-300">{metrics.train_r2}</p>
          </div>
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-sm text-slate-400">Test R²</p>
            <p className="text-2xl font-bold text-sky-300">{metrics.test_r2}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-slate-400">Train RMSE</p>
            <p className="text-2xl font-bold text-emerald-300">{metrics.train_rmse}</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-slate-400">Test RMSE</p>
            <p className="text-2xl font-bold text-emerald-300">{metrics.test_rmse}</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-sm text-slate-400">Train MAE</p>
            <p className="text-2xl font-bold text-cyan-300">{metrics.train_mae}</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-sm text-slate-400">Test MAE</p>
            <p className="text-2xl font-bold text-cyan-300">{metrics.test_mae}</p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-sm text-slate-400">Train Accuracy</p>
            <p className="text-2xl font-bold text-sky-300">{(metrics.train_accuracy * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4">
            <p className="text-sm text-slate-400">Test Accuracy</p>
            <p className="text-2xl font-bold text-sky-300">{(metrics.test_accuracy * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-slate-400">Train Precision</p>
            <p className="text-2xl font-bold text-emerald-300">{(metrics.train_precision * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
            <p className="text-sm text-slate-400">Test Precision</p>
            <p className="text-2xl font-bold text-emerald-300">{(metrics.test_precision * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-sm text-slate-400">Train F1 Score</p>
            <p className="text-2xl font-bold text-cyan-300">{(metrics.train_f1 * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-sm text-slate-400">Test F1 Score</p>
            <p className="text-2xl font-bold text-cyan-300">{(metrics.test_f1 * 100).toFixed(2)}%</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <motion.div
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="lg:col-span-4 glass p-6"
      >
        <p className="text-xs uppercase tracking-[0.24em] text-fuchsia-300">Stage 06</p>
        <h1 className="text-3xl font-extrabold mt-2 text-white">Model Training</h1>
        <p className="text-slate-300 mt-3">
          Select a target variable, inspect the suggested models, and train with a palette that matches the rest of the app.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="lg:col-span-8 space-y-6"
      >
        <div className="glass p-6 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Model Training</h1>
            <p className="text-slate-300">Select a target variable and train a machine learning model.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-rose-200">
              {error}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/20"
          >
            <h2 className="text-xl font-bold text-white mb-4">Step 1: Select Target Variable</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Target Column</label>
                <select
                  value={targetColumn}
                  onChange={(e) => {
                    setTargetColumn(e.target.value);
                    setAnalysis(null);
                    setTrainedModel(null);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-2.5 text-slate-100 outline-none focus:border-sky-300"
                >
                  <option value="">Choose a column...</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAnalyze}
                  disabled={!targetColumn || loading}
                  className="w-full rounded-xl bg-sky-400 px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-sky-300 disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {loading ? 'Analyzing...' : 'Analyze Data'}
                </button>
              </div>
            </div>
          </motion.div>

          {analysis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/20 space-y-6"
            >
              <h2 className="text-xl font-bold text-white">Analysis Results</h2>
            
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-200">Data Quality Metrics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3">
                    <p className="text-xs text-slate-400">Completeness</p>
                    <p className="text-xl font-bold text-sky-300">{analysis.data_quality.completeness}%</p>
                  </div>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                    <p className="text-xs text-slate-400">Null Rate</p>
                    <p className="text-xl font-bold text-emerald-300">{analysis.data_quality.null_rate}%</p>
                  </div>
                  <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                    <p className="text-xs text-slate-400">Outliers</p>
                    <p className="text-xl font-bold text-rose-300">{analysis.data_quality.outlier_rate}%</p>
                  </div>
                  <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3">
                    <p className="text-xs text-slate-400">Diversity</p>
                    <p className="text-xl font-bold text-violet-300">{analysis.data_quality.feature_diversity.toFixed(0)}%</p>
                  </div>
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
                    <p className="text-xs text-slate-400">Task Type</p>
                    <p className="text-xl font-bold text-amber-300 capitalize">{taskType}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-3">Recommended Models</h3>
                <div className="space-y-2">
                  {analysis.recommended_models?.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        selectedModel === rec.model
                          ? 'border-sky-400/40 bg-sky-500/10'
                          : 'border-white/10 bg-slate-900/60 hover:border-sky-300/40'
                      }`}
                      onClick={() => setSelectedModel(rec.model)}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-white capitalize">{rec.model.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-slate-300">{rec.reasons.join(' • ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-sky-300">{rec.score}</p>
                          <p className="text-xs text-slate-500">score</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-200 mb-3">All Available Models</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {analysis.available_models?.map((model) => (
                    <button
                      key={model}
                      onClick={() => setSelectedModel(model)}
                      className={`rounded-xl border px-3 py-3 text-sm font-medium capitalize transition ${
                        selectedModel === model
                          ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                          : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-300/40'
                      }`}
                    >
                      {model.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleTrain}
                disabled={!selectedModel || training}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-300"
              >
                {training ? 'Training Model...' : 'Train Selected Model'}
              </button>
            </motion.div>
          )}

          {trainedModel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 shadow-xl shadow-slate-950/20"
            >
              <h2 className="text-xl font-bold text-white mb-6">
                Training Results - {trainedModel.model_name.replace(/_/g, ' ')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4">
                  <p className="text-sm text-slate-400">Target Variable</p>
                  <p className="text-lg font-bold text-sky-300">{trainedModel.target_column}</p>
                </div>
                <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-4">
                  <p className="text-sm text-slate-400">Task Type</p>
                  <p className="text-lg font-bold text-violet-300 capitalize">{trainedModel.task_type}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <p className="text-sm text-slate-400">Features Used</p>
                  <p className="text-lg font-bold text-emerald-300">{trainedModel.feature_count}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4">
                  <p className="text-sm text-slate-400">Training Samples</p>
                  <p className="text-lg font-bold text-fuchsia-300">{trainedModel.data_split.train_size}</p>
                </div>
                <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4">
                  <p className="text-sm text-slate-400">Testing Samples</p>
                  <p className="text-lg font-bold text-fuchsia-300">{trainedModel.data_split.test_size}</p>
                </div>
                <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-4">
                  <p className="text-sm text-slate-400">Total Samples</p>
                  <p className="text-lg font-bold text-fuchsia-300">{trainedModel.data_split.total_size}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Performance Metrics</h3>
                {getMetricsDisplay()}
              </div>

              <button
                onClick={handleDownload}
                className="w-full rounded-xl bg-fuchsia-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-fuchsia-300"
              >
                Download Trained Model
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
