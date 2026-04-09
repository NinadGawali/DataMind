import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import StageLayout from './components/StageLayout';
import { DataSessionProvider } from './context/DataSessionContext';
import UploadStage from './pages/UploadStage';
import VisualizationStage from './pages/VisualizationStage';
import InsightsStage from './pages/InsightsStage';

function App() {
  return (
    <DataSessionProvider>
      <StageLayout>
        <Routes>
          <Route path="/" element={<UploadStage />} />
          <Route path="/visualizations" element={<VisualizationStage />} />
          <Route path="/insights" element={<InsightsStage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StageLayout>
      <ToastContainer position="top-right" autoClose={2600} theme="dark" />
    </DataSessionProvider>
  );
}

export default App;