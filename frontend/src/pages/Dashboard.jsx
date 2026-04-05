import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { uploadFile, generateVisualization, getInsight } from '../services/api';

import UploadCard from '../components/UploadCard';
import DatasetInfo from '../components/DatasetInfo';
import VisualizationControls from '../components/VisualizationControls';
import ChartRenderer from '../components/ChartRenderer';
import InsightPanel from '../components/InsightPanel';

export default function Dashboard() {
  const [sessionId, setSessionId] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [vizData, setVizData] = useState(null);
  const [insightData, setInsightData] = useState(null);

  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isLoadingViz, setIsLoadingViz] = useState(false);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  const handleUpload = async (file) => {
    setIsLoadingFile(true);
    try {
      const response = await uploadFile(file);
      setSessionId(response.session_id);
      setDatasetInfo(response.data);
      setVizData(null);
      setInsightData(null);
      toast.success('Dataset uploaded successfully!');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to upload dataset';
      toast.error(msg);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleVisualize = async (config) => {
    if (!sessionId) return toast.error('Please upload a dataset first');
    
    setIsLoadingViz(true);
    try {
      const payload = {
        session_id: sessionId,
        config: config
      };
      const response = await generateVisualization(payload);
      setVizData(response.data);
      toast.success('Chart generated');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to generate visualization';
      toast.error(msg);
    } finally {
      setIsLoadingViz(false);
    }
  };

  const handleGetInsight = async () => {
    if (!sessionId) return toast.error('Please upload a dataset first');
    
    setIsLoadingInsight(true);
    try {
      const payload = {
        session_id: sessionId,
        query: 'Please provide deep statistical insights based on column stats and correlations.',
      };
      const response = await getInsight(payload);
      setInsightData(response.data);
      toast.success('Insights generated successfully');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to get insights';
      toast.error(msg);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans overflow-x-hidden selection:bg-blue-500/30">
      
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass fixed top-0 w-full z-50 rounded-none border-t-0 border-l-0 border-r-0 px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
          <h1 className="text-2xl font-bold tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            DATAMIND
          </h1>
        </div>
      </motion.header>

      {/* Main Content Layout */}
      <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8"
        >
          
          {/* Left Column (Controls & Info) */}
          <div className="lg:col-span-4 space-y-6">
            <UploadCard onUpload={handleUpload} isLoading={isLoadingFile} />
            
            {datasetInfo && (
              <DatasetInfo info={datasetInfo} />
            )}

            {datasetInfo && (
              <VisualizationControls 
                columns={datasetInfo.columns} 
                onVisualize={handleVisualize} 
              />
            )}
          </div>

          {/* Right Column (Charts & Insights) */}
          <div className="lg:col-span-8 flex flex-col pt-0">
            {sessionId ? (
              <>
                <div className="flex-1 rounded-2xl overflow-hidden glass border-white/5 relative">
                  {/* Decorative blobs */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full -z-10 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full -z-10 pointer-events-none transform -translate-x-1/2 translate-y-1/2"></div>
                  
                  <div className="p-2 h-full flex flex-col">
                    <ChartRenderer vizData={vizData} isLoading={isLoadingViz} />
                  </div>
                </div>

                <div className="mt-8">
                  <InsightPanel 
                    insightData={insightData} 
                    isLoading={isLoadingInsight} 
                    onGetInsight={handleGetInsight} 
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-[600px] border-2 border-dashed border-gray-700/50 rounded-2xl bg-gray-800/20">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-400">Awaiting Dataset</h3>
                <p className="text-gray-500 mt-2">Upload a CSV on the left panel to begin your EDA journey.</p>
              </div>
            )}
          </div>

        </motion.div>
      </main>

    </div>
  );
}