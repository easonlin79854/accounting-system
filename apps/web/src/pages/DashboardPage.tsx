import { useEffect, useMemo, useState } from 'react'
import type { MonthlySummary } from '@accounting/shared'
import { monthlySummary } from '../lib/api'

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7)
}

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonthValue)
  const [rows, setRows] = useState<MonthlySummary[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void monthlySummary(month)
      .then((result) => {
        setRows(result.data)
        setError('')
      })
      .catch((reason: Error) => setError(reason.message))
  }, [month])

  const totals = useMemo(
    () => rows.reduce((acc, row) => acc + row.incomeTotal - row.expenseTotal, 0),
    [rows],
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-100">月彙總 Dashboard</h2>
        <input
          type="month"
          className="rounded-md border border-gray-600 bg-gray-900/80 px-3 py-2"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>

      {error ? <p className="rounded-md bg-red-500/15 px-3 py-2 text-red-300">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <article key={row.currency} className="rounded-lg border border-gray-700 bg-gray-900/80 p-4 shadow-sm">
            <h3 className="text-lg font-medium text-gray-100">{row.currency}</h3>
            <p className="mt-2 text-emerald-300">收入：{row.incomeTotal}</p>
            <p className="text-rose-300">支出：{row.expenseTotal}</p>
          </article>
        ))}
      </div>

      <p className="text-sm text-gray-300">淨額（各幣別原幣加總展示）：{totals}</p>
    </section>
  )
}
