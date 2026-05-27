import type {
  AttachmentRecord,
  MonthlySummary,
  TagRecord,
  TransactionDetail,
  TransactionRecord,
} from '@accounting/shared'

// Default '/api' is intended for Pages + Worker on the same domain/route.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

type ApiError = { error: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let payload: ApiError | null
    try {
      payload = (await response.json()) as ApiError
    } catch {
      payload = null
    }
    throw new Error(payload?.error ?? `Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export function listTransactions(params: { month?: string; currency?: string }) {
  const search = new URLSearchParams()
  if (params.month) search.set('month', params.month)
  if (params.currency) search.set('currency', params.currency)
  return request<{ data: TransactionRecord[] }>(`/transactions?${search.toString()}`)
}

export function createTransaction(payload: {
  date: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  merchant: string
  note?: string
  tags: string[]
}) {
  return request<{ data: TransactionDetail }>('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listTags() {
  return request<{ data: TagRecord[] }>('/tags')
}

export function monthlySummary(month: string) {
  return request<{ data: MonthlySummary[] }>(`/reports/monthly?month=${month}`)
}

export async function uploadAttachment(transactionId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}/attachments`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiError | null
    throw new Error(payload?.error ?? `Attachment upload failed (${response.status})`)
  }

  return (await response.json()) as { data: AttachmentRecord }
}
