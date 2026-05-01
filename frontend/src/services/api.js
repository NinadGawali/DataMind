import axios from 'axios';

const api = axios.create({
  baseURL: '/',
});

export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getSummary = async (session_id) => {
  const response = await api.get(`/eda/summary/${session_id}`);
  return response.data;
};

export const getCorrelation = async (session_id) => {
  const response = await api.get(`/eda/correlation/${session_id}`);
  return response.data;
};

export const generateVisualization = async (config) => {
  const response = await api.post('/eda/visualize', config);
  return response.data;
};

export const getInsight = async (config) => {
  const response = await api.post('/eda/insight', config);
  return response.data;
};

export const chatInsight = async (payload) => {
  const response = await api.post('/eda/insight/chat', payload);
  return response.data;
};

export const analyzeDataQuality = async (payload) => {
  const response = await api.post('/eda/data-quality/analyze', payload);
  return response.data;
};

export const chatDataQuality = async (payload) => {
  const response = await api.post('/eda/data-quality/chat', payload);
  return response.data;
};

export const analyzeNullValues = async (payload) => {
  const response = await api.post('/eda/data-quality/nulls/analyze', payload);
  return response.data;
};

export const applyNullImputation = async (payload) => {
  const response = await api.post('/eda/data-quality/nulls/apply', payload);
  return response.data;
};

export const analyzeOutliers = async (payload) => {
  const response = await api.post('/eda/data-quality/outliers/analyze', payload);
  return response.data;
};

export const applyOutlierHandling = async (payload) => {
  const response = await api.post('/eda/data-quality/outliers/apply', payload);
  return response.data;
};

export const analyzeFeatureEngineering = async (payload) => {
  const response = await api.post('/eda/data-quality/features/analyze', payload);
  return response.data;
};

export const applyFeatureEncoding = async (payload) => {
  const response = await api.post('/eda/data-quality/features/apply', payload);
  return response.data;
};

export const getDatasetSnapshot = async ({ session_id, limit = 100, offset = 0 }) => {
  const response = await api.get(`/eda/dataset/${session_id}?limit=${limit}&offset=${offset}`);
  return response.data;
};

export const getDatasetDownloadUrl = (sessionId) => `/eda/dataset/download/${sessionId}`;

export const analyzeModelTraining = async (payload) => {
  const response = await api.post('/eda/model/analyze', payload);
  return response.data;
};

export const trainModel = async (payload) => {
  const response = await api.post('/eda/model/train', payload);
  return response.data;
};

export const getModelDownloadUrl = (sessionId) => `/eda/model/download/${sessionId}`;