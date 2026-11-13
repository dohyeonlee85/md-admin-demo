import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Orders from './pages/Orders'
import Inventory from './pages/Inventory'
import Artists from './pages/Artists'
import Planning from './pages/Planning'
import Sales from './pages/Sales'
import Customers from './pages/Customers'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'

export default function App() {
  const { session, booting } = useStore()
  if (booting) return <div className="grid h-full place-items-center text-ink-sub">불러오는 중…</div>
  if (!session) return <Login />
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/artists" element={<Artists />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
