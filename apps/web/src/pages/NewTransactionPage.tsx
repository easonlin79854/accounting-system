import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createTransaction, listTags, uploadAttachment } from '../lib/api'
import type { TagRecord } from '@accounting/shared'

function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

const parsedAttachmentLimit = Number.parseInt(import.meta.env.VITE_MAX_ATTACHMENT_SIZE_MB ?? '10', 10)
const maxAttachmentSizeMb = Number.isFinite(parsedAttachmentLimit) && parsedAttachmentLimit > 0 ? parsedAttachmentLimit : 10
const maxAttachmentBytes = maxAttachmentSizeMb * 1024 * 1024

export function NewTransactionPage() {
  const [date, setDate] = useState(todayValue)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState('TWD')
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')
  const [customTags, setCustomTags] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [allTags, setAllTags] = useState<TagRecord[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void listTags().then((result) => setAllTags(result.data))
  }, [])

  const mergedTags = useMemo(() => {
    const fromCustom = customTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    return Array.from(new Set([...selectedTags, ...fromCustom]))
  }, [customTags, selectedTags])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      const transaction = await createTransaction({
        date,
        type,
        amount,
        currency,
        merchant,
        note,
        tags: mergedTags,
      })

      for (const file of files) {
        if (file.size > maxAttachmentBytes) {
          throw new Error(`${file.name} 超過 ${maxAttachmentSizeMb}MB 限制`)
        }
        await uploadAttachment(transaction.data.id, file)
      }

      setMessage(`交易已建立（${transaction.data.id}）`)
      setMerchant('')
      setNote('')
      setCustomTags('')
      setSelectedTags([])
      setFiles([])
    } catch (reason) {
      setError((reason as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-100">新增交易</h2>

      {message ? <p className="rounded-md bg-emerald-500/15 px-3 py-2 text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-500/15 px-3 py-2 text-red-300">{error}</p> : null}

      <form className="space-y-4 lux-card rounded-lg p-4" onSubmit={onSubmit}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="min-w-0 text-sm text-gray-300">
            日期
            <input
              required
              type="date"
              className="lux-focus mt-1 block w-full min-w-0 rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label className="min-w-0 text-sm text-gray-300">
            類型
            <select
              className="lux-focus mt-1 block w-full min-w-0 rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100"
              value={type}
              onChange={(event) => setType(event.target.value as 'income' | 'expense')}
            >
              <option value="expense">expense</option>
              <option value="income">income</option>
            </select>
          </label>
          <label className="min-w-0 text-sm text-gray-300">
            金額（最小貨幣單位）
            <input
              required
              min={0}
              type="number"
              className="lux-focus mt-1 block w-full min-w-0 rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
          </label>
          <label className="min-w-0 text-sm text-gray-300">
            幣別（ISO）
            <input
              required
              maxLength={3}
              className="lux-focus mt-1 block w-full min-w-0 rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100 uppercase"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </label>
          <label className="text-sm text-gray-300 sm:col-span-2">
            商家
            <input
              required
              className="lux-focus mt-1 block w-full min-w-0 rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100"
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
            />
          </label>
          <label className="text-sm text-gray-300 sm:col-span-2">
            備註
            <textarea
              className="lux-focus mt-1 block w-full min-w-0 rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-100">Tags（可多選 + 自訂）</p>
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag.name)
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm ${
                    active
                      ? 'border-amber-400/70 bg-amber-400/20 text-amber-200'
                      : 'border-gray-700 bg-gray-800/70 text-gray-300'
                  }`}
                  onClick={() =>
                    setSelectedTags((previous) =>
                      active
                        ? previous.filter((name) => name !== tag.name)
                        : [...previous, tag.name],
                    )
                  }
                >
                  {tag.name}
                </button>
              )
            })}
          </div>
          <input
            type="text"
            placeholder="輸入自訂 tags，以逗號分隔"
            className="lux-focus w-full rounded-md border border-amber-300/40 bg-gray-900/90 px-3 py-2 text-amber-100"
            value={customTags}
            onChange={(event) => setCustomTags(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-100">附件（jpg/png/webp/heic/pdf，10MB 內）</p>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic,.pdf"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          <p className="text-xs text-gray-400">已選 {files.length} 個檔案</p>
        </div>

        <button
          type="submit"
          className="lux-glow rounded-md bg-amber-400 px-4 py-2 font-semibold text-gray-900 transition hover:-translate-y-0.5 hover:bg-amber-300"
        >
          建立交易
        </button>
      </form>
    </section>
  )
}
