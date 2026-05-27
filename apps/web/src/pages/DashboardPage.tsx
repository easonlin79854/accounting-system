import { useEffect, useMemo, useState } from 'react'
import type { MonthlySummary } from '@accounting/shared'
import { monthlySummary } from '../lib/api'

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7)
}

export function DashboardPage() {
  const [month, setMonth] = useState(currentMonthValue)
  const [rows, setRows] = useState<MonthlySummary[]>([])

  useEffect(() => {
    void monthlySummary(month)
      .then((result) => {
        setRows(result.data)
      })
      .catch(() => setRows([]))
  }, [month])

  const totals = useMemo(
    () => rows.reduce((acc, row) => acc + row.incomeTotal - row.expenseTotal, 0),
    [rows],
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-100">月總計</h2>
        <input
          type="month"
          className="lux-focus rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <article key={row.currency} className="lux-card lux-hover rounded-lg p-4">
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
