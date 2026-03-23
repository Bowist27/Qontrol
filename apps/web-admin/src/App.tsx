/**
 * App.tsx - Main Application with Routing
 * 
 * Routes:
 * - /login -> Login page (public)
 * - /dashboard -> Dashboard (protected)
 * - / -> Redirects to appropriate page based on auth status
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuditProvider } from './context/AuditContext';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import BillingPortal from './pages/BillingPortal';
import InvoiceSuccess from './pages/InvoiceSuccess';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// View components
import DashboardView from './components/dashboard/DashboardView';
import InventoryView from './components/inventory/InventoryView';
import AuditsView from './components/audits/AuditsView';
import BillingAdminView from './components/billing/BillingAdminView';
import CatalogView from './components/catalog/CatalogView';
import UsersView from './components/users/UsersView';
import StoresView from './components/stores/StoresView';

/**
 * Auth Guard - Only checks authentication (no permissions)
 * Used for the Dashboard layout wrapper
 */
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * Public Route Component
 * Redirects to /dashboard if already authenticated
 */
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/**
 * App Routes
 */
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Password Reset - Public, no auth redirect */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public Billing Portal - Unauthenticated */}
      <Route path="/facturacion" element={<BillingPortal />} />
      <Route path="/facturacion/exito" element={<InvoiceSuccess />} />

      {/* Legal Pages */}
      <Route path="/terminos" element={<Terms />} />
      <Route path="/privacidad" element={<Privacy />} />
      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <AuditProvider>
              <Dashboard />
            </AuditProvider>
          </AuthGuard>
        }
      >
        {/* Dashboard Nested Routes - Each with permission guard */}
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<ProtectedRoute permission="web:dashboard"><DashboardView onViewInventory={() => { }} /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute permission="web:inventories"><InventoryView /></ProtectedRoute>} />
        <Route path="audits/*" element={<ProtectedRoute permission="web:audits"><AuditsView /></ProtectedRoute>} />
        <Route path="billing/*" element={<ProtectedRoute permission="web:dashboard"><BillingAdminView /></ProtectedRoute>} />
        <Route path="catalog" element={<ProtectedRoute permission="web:catalog"><CatalogView /></ProtectedRoute>} />
        <Route path="users" element={<ProtectedRoute permission="web:users"><UsersView /></ProtectedRoute>} />
        <Route path="stores" element={<ProtectedRoute permission="web:users"><StoresView /></ProtectedRoute>} />
      </Route>

      {/* Default Route - Redirect based on auth */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Catch all - Redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

/**
 * Main App Component
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer
          theme="dark"
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
