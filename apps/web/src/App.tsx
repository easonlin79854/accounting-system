import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { NewTransactionPage } from './pages/NewTransactionPage'
import { TransactionsPage } from './pages/TransactionsPage'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: '交易列表' },
  { to: '/transactions/new', label: '新增交易' },
]

function App() {
  return (
    <div className="min-h-screen bg-amber-50 text-gray-800">
      <header className="border-b border-amber-200 bg-amber-100/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold text-gray-900">Accounting System</h1>
          <nav className="flex gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-gray-700 transition hover:bg-amber-200 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/transactions/new" element={<NewTransactionPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
