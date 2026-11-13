import { Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './lib/store'
import Layout, { MENUS } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import Orders from './pages/Orders'
import Inventory from './pages/Inventory'
import Planned from './pages/Planned'
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
        {MENUS.filter((m) => !m.ready).map((m) => (
          <Route key={m.path} path={m.path} element={<Planned menu={m.label} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
