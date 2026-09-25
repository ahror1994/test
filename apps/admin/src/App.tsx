import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import type { AdminPermission } from '@taptym/shared';
import { AuthProvider, useAuth } from './auth';
import { Layout, NAV } from './Layout';
import { Login } from './pages/Login';
import { Empty, Skeleton } from './ui';
import { ErrorBoundary } from './ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail'));
const Customers = lazy(() => import('./pages/Customers'));
const Products = lazy(() => import('./pages/Products'));
const Payouts = lazy(() => import('./pages/Payouts'));
const Promos = lazy(() => import('./pages/Promos'));
const Banners = lazy(() => import('./pages/Banners'));
const Support = lazy(() => import('./pages/Support'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Integrations = lazy(() => import('./pages/Integrations'));
const Staff = lazy(() => import('./pages/Staff'));

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/*" element={<Protected />} />
      </Routes>
    </AuthProvider>
  );
}

function LoginRoute() {
  const { me } = useAuth();
  const loc = useLocation();
  if (me) return <Navigate to={(loc.state as { from?: string } | null)?.from ?? '/'} replace />;
  return <Login />;
}

function PageFallback() {
  return (
    <div className="col gap-16" style={{ paddingTop: 14 }}>
      <Skeleton h={34} w={260} />
      <div className="grid g-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} h={118} r={20} />
        ))}
      </div>
      <Skeleton h={320} r={20} />
    </div>
  );
}

function Guard({ perm, children }: { perm: AdminPermission; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) return <Empty icon={<ShieldOff size={26} />} title="Нет доступа" text="У вашей роли нет прав на этот раздел. Обратитесь к владельцу." />;
  return <>{children}</>;
}

function Home() {
  const { can } = useAuth();
  if (can('dashboard')) return <Dashboard />;
  const first = NAV.flatMap((g) => g.items).find((i) => can(i.perm));
  return first ? <Navigate to={first.to} replace /> : <Empty title="Нет доступных разделов" />;
}

function Protected() {
  const { me, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return null;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return (
    <Layout>
      <ErrorBoundary resetKey={loc.pathname}>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="orders" element={<Guard perm="orders"><Orders /></Guard>} />
          <Route path="suppliers" element={<Guard perm="suppliers"><Suppliers /></Guard>} />
          <Route path="suppliers/:id" element={<Guard perm="suppliers"><SupplierDetail /></Guard>} />
          <Route path="customers" element={<Guard perm="customers"><Customers /></Guard>} />
          <Route path="products" element={<Guard perm="products"><Products /></Guard>} />
          <Route path="payouts" element={<Guard perm="payouts"><Payouts /></Guard>} />
          <Route path="promos" element={<Guard perm="promos"><Promos /></Guard>} />
          <Route path="banners" element={<Guard perm="banners"><Banners /></Guard>} />
          <Route path="support" element={<Guard perm="support"><Support /></Guard>} />
          <Route path="support/:id" element={<Guard perm="support"><Support /></Guard>} />
          <Route path="reports" element={<Guard perm="reports"><Reports /></Guard>} />
          <Route path="settings" element={<Guard perm="settings"><Settings /></Guard>} />
          <Route path="integrations" element={<Guard perm="settings"><Integrations /></Guard>} />
          <Route path="staff" element={<Guard perm="staff"><Staff /></Guard>} />
          <Route path="*" element={<Empty title="Страница не найдена" text="Проверьте адрес или вернитесь на главную." />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </Layout>
  );
}
