import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BuildDetail from './pages/BuildDetail';
import QueuePage from './pages/QueuePage';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/builds/:id" element={<BuildDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
