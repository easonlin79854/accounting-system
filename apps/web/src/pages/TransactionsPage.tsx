import { useEffect, useState } from 'react'
import type { TransactionRecord } from '@accounting/shared'
import { listTransactions } from '../lib/api'

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7)
}

export function TransactionsPage() {
  const [month, setMonth] = useState(currentMonthValue)
  const [currency, setCurrency] = useState('')
  const [rows, setRows] = useState<TransactionRecord[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void listTransactions({ month, currency: currency || undefined })
      .then((result) => {
        setRows(result.data)
        setError('')
      })
      .catch((reason: Error) => setError(reason.message))
  }, [month, currency])

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-100">交易列表</h2>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-gray-300">
          月份
          <input
            type="month"
            className="ml-2 lux-focus rounded-md border border-amber-300/40 bg-gray-900/90 px-2 py-1 text-amber-100"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
        <label className="text-sm text-gray-300">
          幣別
          <input
            type="text"
            placeholder="例如 TWD"
            className="ml-2 lux-focus rounded-md border border-amber-300/40 bg-gray-900/90 px-2 py-1 text-amber-100"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </label>
      </div>

      {error ? <p className="rounded-md bg-red-500/15 px-3 py-2 text-red-300">{error}</p> : null}

      <div className="lux-card overflow-x-auto rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-amber-300/10 text-left text-amber-100">
            <tr>
              <th className="px-3 py-2">日期</th>
              <th className="px-3 py-2">類型</th>
              <th className="px-3 py-2">金額</th>
              <th className="px-3 py-2">商家</th>
              <th className="px-3 py-2">Tags</th>
              <th className="px-3 py-2">附件數</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-700">
                <td className="px-3 py-2">{row.date}</td>
                <td className="px-3 py-2">{row.type}</td>
                <td className="px-3 py-2">{row.amount} {row.currency}</td>
                <td className="px-3 py-2">{row.merchant || '-'}</td>
                <td className="px-3 py-2">{row.tags.map((tag) => tag.name).join(', ') || '-'}</td>
                <td className="px-3 py-2">{row.attachments.length}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  尚無資料
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
