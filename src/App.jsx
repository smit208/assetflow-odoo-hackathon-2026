import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './stores/authStore'
import Layout from './components/Layout'

import Login       from './pages/Login'
import Dashboard   from './pages/Dashboard'
import OrgSetup    from './pages/OrgSetup'
import AssetDirectory from './pages/AssetDirectory'
import Allocation  from './pages/Allocation'
import ResourceBooking from './pages/ResourceBooking'
import Maintenance from './pages/Maintenance'
import Audit       from './pages/Audit'
import Reports     from './pages/Reports'
import ActivityLogs from './pages/ActivityLogs'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-base)' }}>
      <div style={{ color:'var(--text-muted)', fontSize:13 }}>Loading AssetFlow...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const init = useAuthStore(s => s.init)
  useEffect(() => { init() }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="org-setup"   element={<OrgSetup />} />
          <Route path="assets"      element={<AssetDirectory />} />
          <Route path="allocation"  element={<Allocation />} />
          <Route path="bookings"    element={<ResourceBooking />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="audit"       element={<Audit />} />
          <Route path="reports"     element={<Reports />} />
          <Route path="logs"        element={<ActivityLogs />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
