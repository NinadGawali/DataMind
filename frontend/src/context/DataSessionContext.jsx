import { createContext, useContext, useMemo, useState } from 'react';

const DataSessionContext = createContext(null);

export function DataSessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [datasetInfo, setDatasetInfo] = useState(null);
  const [vizData, setVizData] = useState(null);

  const resetSessionVisuals = () => {
    setVizData(null);
  };

  const value = useMemo(
    () => ({
      sessionId,
      setSessionId,
      datasetInfo,
      setDatasetInfo,
      vizData,
      setVizData,
      resetSessionVisuals,
    }),
    [sessionId, datasetInfo, vizData],
  );

  return <DataSessionContext.Provider value={value}>{children}</DataSessionContext.Provider>;
}

export function useDataSession() {
  const context = useContext(DataSessionContext);
  if (!context) {
    throw new Error('useDataSession must be used inside DataSessionProvider');
  }
  return context;
}
