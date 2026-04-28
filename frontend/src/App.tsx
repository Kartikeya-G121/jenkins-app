import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BuildDetail from './pages/BuildDetail';
import QueuePage from './pages/QueuePage';
import RepositoriesPage from './pages/RepositoriesPage';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/builds/:id" element={<BuildDetail />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
