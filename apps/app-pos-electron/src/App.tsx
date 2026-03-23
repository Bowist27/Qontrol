import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PhysicalAudit } from './pages/PhysicalAudit';
import { PosBillingView } from './pages/billing/PosBillingView';

type AppPage = 'dashboard' | 'audit' | 'billing';

// Inner component that uses auth context
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showDashboard, setShowDashboard] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');

  // Show loading while checking auth
  if (isLoading && !showDashboard) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If authenticated or just logged in, show app
  if (isAuthenticated || showDashboard) {
    // Render current page
    switch (currentPage) {
      case 'audit':
        return (
          <PhysicalAudit 
            onBack={() => setCurrentPage('dashboard')} 
          />
        );
      case 'billing':
        return (
          <PosBillingView 
            onBack={() => setCurrentPage('dashboard')} 
          />
        );
      default:
        return (
          <Dashboard 
            onLogout={() => {
              setShowDashboard(false);
              setCurrentPage('dashboard');
            }}
            onNavigate={(page) => setCurrentPage(page as AppPage)}
          />
        );
    }
  }

  // Show login
  return (
    <Login 
      onLoginSuccess={() => setShowDashboard(true)} 
    />
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
