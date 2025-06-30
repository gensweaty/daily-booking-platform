
import { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { initializeStorage } from './lib/storage-init';

function App() {
  useEffect(() => {
    // Initialize storage on app start
    initializeStorage();
  }, []);

  return (
    <AuthProvider>
      <LanguageProvider>
        <div>
          <h1>App is running</h1>
          <p>Storage initialization in progress...</p>
        </div>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
