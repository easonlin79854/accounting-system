import type {
  AttachmentRecord,
  MonthlySummary,
  TagRecord,
  TransactionDetail,
  TransactionRecord,
} from '@accounting/shared'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

type ApiError = { error: string }

function normalizeBaseUrl(base: string) {
  if (!base) return ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function buildCandidateUrls(path: string, method: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const configuredBase = normalizeBaseUrl(API_BASE_URL)
  const withoutApiPrefix = normalizedPath.startsWith('/api/') ? normalizedPath.slice(4) : normalizedPath

  const primary = [`${configuredBase}${normalizedPath}`, `/api${withoutApiPrefix}`]
  const readFallback = [normalizedPath, withoutApiPrefix]
  const includeReadFallback = method.toUpperCase() === 'GET'

  const candidates = includeReadFallback ? [...primary, ...readFallback] : primary
  return Array.from(new Set(candidates.filter(Boolean)))
}

async function parseError(response: Response) {
  try {
    return (await response.json()) as ApiError
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const urls = buildCandidateUrls(path, method)
  let response: Response | undefined
  const tried: string[] = []

  for (const url of urls) {
    tried.push(url)
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    })

    if (response.ok) {
      return (await response.json()) as T
    }

    if (response.status !== 404 && response.status !== 405) {
      break
    }
  }

  if (!response) throw new Error('Request failed: no response')
  const payload = await parseError(response)
  const errorMessage = payload?.error ?? `Request failed: ${response.status}`
  throw new Error(`${errorMessage} (${method.toUpperCase()} ${tried.join(' -> ')})`)
}

async function requestForm<T>(path: string, init: RequestInit): Promise<T> {
  const method = init.method ?? 'POST'
  const urls = buildCandidateUrls(path, method)
  let response: Response | undefined
  const tried: string[] = []

  for (const url of urls) {
    tried.push(url)
    response = await fetch(url, init)
    if (response.ok) return (await response.json()) as T
    if (response.status !== 404 && response.status !== 405) break
  }

  if (!response) throw new Error('Request failed: no response')
  const payload = await parseError(response)
  const errorMessage = payload?.error ?? `Request failed: ${response.status}`
  throw new Error(`${errorMessage} (${method.toUpperCase()} ${tried.join(' -> ')})`)
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

export function uploadAttachment(transactionId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return requestForm<{ data: AttachmentRecord }>(`/transactions/${transactionId}/attachments`, {
    method: 'POST',
    body: formData,
  })
}
