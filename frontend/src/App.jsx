import Dashboard from './pages/Dashboard';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <>
      <Dashboard />
      <ToastContainer theme="dark" />
    </>
  );
}

export default App;