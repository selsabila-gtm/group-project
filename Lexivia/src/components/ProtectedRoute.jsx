/**
 * ProtectedRoute.jsx
 *
 * Wraps any route that requires authentication.
 * If no token is found in localStorage, redirects to /login immediately.
 *
 * Usage in your router (App.jsx / router.jsx):
 *
 *   import ProtectedRoute from './components/ProtectedRoute';
 *
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard"   element={<Dashboard />} />
 *     <Route path="/teams"       element={<TeamsPage />} />
 *     <Route path="/teams/:teamId" element={<TeamDetailPage />} />
 *     <Route path="/competitions" element={<CompetitionsPage />} />
 *     // ... all other authenticated routes
 *   </Route>
 */

import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const token = localStorage.getItem('token');

  // No token → kick to login, remembering where they wanted to go
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Token exists → render the child route
  return <Outlet />;
}