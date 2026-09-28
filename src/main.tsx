import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';

// The unified admin portal (/admin/*) and the public marketing site share
// this one bundle/entry point but mount completely different component
// trees — same pattern as the existing #manage hash-based split inside
// App.tsx itself, just keyed off the path instead of the hash. Both sides
// are lazy-loaded so neither pays for the other's code (public visitors
// never download react-router-dom or the admin tabs, and vice versa).
const isAdminPath = window.location.pathname.startsWith('/admin');
const App = lazy(() => import('./App.tsx'));
const AdminShell = lazy(() => import('./admin/AdminShell.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isAdminPath ? <AdminShell /> : <App />}
    </Suspense>
  </StrictMode>,
);
