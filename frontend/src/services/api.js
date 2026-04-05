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