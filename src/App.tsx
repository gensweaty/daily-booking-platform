import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
} from 'react-router-dom';
import Index from './pages/Index';
import Contact from './pages/Contact';
import Legal from './pages/Legal';
import PublicBusinessPage from "@/pages/PublicBusinessPage";

function App() {
  return (
    <Router>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<Index />} />
      <Route path="/login" element={<Index />} /> 
      <Route path="/contact" element={<Contact />} />
      <Route path="/legal" element={<Legal />} />
      <Route path="/business/:slug" element={<PublicBusinessPage />} />
    </Routes>
    </Router>
  );
}

export default App;
