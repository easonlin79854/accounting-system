import { zValidator } from '@hono/zod-validator'
import {
  createTagSchema,
  createTransactionSchema,
  listTransactionsQuerySchema,
  monthlyReportQuerySchema,
  type AttachmentRecord,
  type TagRecord,
  type TransactionRecord,
} from '@accounting/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'

type Bindings = {
  DB: D1Database
  ATTACHMENTS: R2Bucket
  MAX_ATTACHMENT_SIZE_MB?: string
}

type Variables = {
  now: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const uploadMimeWhitelist = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

app.use('/api/*', async (c, next) => {
  c.set('now', new Date().toISOString())
  await next()
})

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status)
  }

  console.error(error)
  return c.json({ error: 'Internal server error' }, 500)
})

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/transactions', zValidator('query', listTransactionsQuerySchema), async (c) => {
  const { month, currency } = c.req.valid('query')

  const clauses: string[] = []
  const binds: string[] = []

  if (month) {
    clauses.push('substr(date, 1, 7) = ?')
    binds.push(month)
  }

  if (currency) {
    clauses.push('currency = ?')
    binds.push(currency)
  }

  const query = `
    SELECT id, date, type, amount, currency, merchant, note
    FROM transactions
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY date DESC, created_at DESC
  `

  const { results } = await c.env.DB.prepare(query).bind(...binds).all<TransactionRow>()
  const transactions = await hydrateTransactions(c.env.DB, results ?? [])

  return c.json({ data: transactions })
})

app.get('/api/transactions/:id', async (c) => {
  const id = c.req.param('id')
  const transaction = await findTransactionById(c.env.DB, id)

  if (!transaction) {
    throw new HTTPException(404, { message: 'Transaction not found' })
  }

  return c.json({ data: transaction })
})

app.post('/api/transactions', zValidator('json', createTransactionSchema), async (c) => {
  const payload = c.req.valid('json')
  const now = c.get('now')
  const id = crypto.randomUUID()

  await c.env.DB.prepare(
    `INSERT INTO transactions (id, date, type, amount, currency, merchant, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      payload.date,
      payload.type,
      payload.amount,
      payload.currency,
      payload.merchant,
      payload.note ?? '',
      now,
      now,
    )
    .run()

  await replaceTransactionTags(c.env.DB, id, payload.tags, now)

  const transaction = await findTransactionById(c.env.DB, id)
  return c.json({ data: transaction }, 201)
})

app.put('/api/transactions/:id', zValidator('json', createTransactionSchema), async (c) => {
  const id = c.req.param('id')
  const payload = c.req.valid('json')
  const now = c.get('now')

  const existing = await c.env.DB.prepare('SELECT id FROM transactions WHERE id = ?').bind(id).first<{ id: string }>()
  if (!existing) {
    throw new HTTPException(404, { message: 'Transaction not found' })
  }

  await c.env.DB.prepare(
    `UPDATE transactions
     SET date = ?, type = ?, amount = ?, currency = ?, merchant = ?, note = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(payload.date, payload.type, payload.amount, payload.currency, payload.merchant, payload.note ?? '', now, id)
    .run()

  await replaceTransactionTags(c.env.DB, id, payload.tags, now)

  const transaction = await findTransactionById(c.env.DB, id)
  return c.json({ data: transaction })
})

app.delete('/api/transactions/:id', async (c) => {
  const id = c.req.param('id')

  const existing = await c.env.DB.prepare('SELECT id FROM transactions WHERE id = ?').bind(id).first<{ id: string }>()
  if (!existing) {
    throw new HTTPException(404, { message: 'Transaction not found' })
  }

  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

app.get('/api/tags', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name, color FROM tags ORDER BY name ASC').all<TagRecord>()
  return c.json({ data: results ?? [] })
})

app.post('/api/tags', zValidator('json', createTagSchema), async (c) => {
  const payload = c.req.valid('json')
  const now = c.get('now')

  const existing = await c.env.DB.prepare('SELECT id, name, color FROM tags WHERE name = ?').bind(payload.name).first<TagRecord>()

  if (existing) {
    return c.json({ data: existing })
  }

  const id = crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, payload.name, payload.color ?? null, now)
    .run()

  return c.json({ data: { id, name: payload.name, color: payload.color ?? null } }, 201)
})

app.get('/api/reports/monthly', zValidator('query', monthlyReportQuerySchema), async (c) => {
  const { month } = c.req.valid('query')
  const monthValue = month ?? new Date().toISOString().slice(0, 7)

  const { results } = await c.env.DB.prepare(
    `SELECT
      currency,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS incomeTotal,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenseTotal
     FROM transactions
     WHERE substr(date, 1, 7) = ?
     GROUP BY currency
     ORDER BY currency ASC`,
  )
    .bind(monthValue)
    .all<{
      currency: string
      incomeTotal: number
      expenseTotal: number
    }>()

  return c.json({ data: results ?? [] })
})

app.post('/api/transactions/:id/attachments', async (c) => {
  const transactionId = c.req.param('id')

  const existing = await c.env.DB.prepare('SELECT id FROM transactions WHERE id = ?').bind(transactionId).first<{ id: string }>()
  if (!existing) {
    throw new HTTPException(404, { message: 'Transaction not found' })
  }

  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: 'file is required' })
  }

  if (!uploadMimeWhitelist.has(file.type)) {
    throw new HTTPException(400, { message: 'Unsupported file type' })
  }

  const maxSizeMb = Number(c.env.MAX_ATTACHMENT_SIZE_MB ?? '10')
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new HTTPException(400, { message: `File exceeds ${maxSizeMb}MB limit` })
  }

  const attachmentId = crypto.randomUUID()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const key = `${transactionId}/${attachmentId}-${safeName}`

  await c.env.ATTACHMENTS.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
    },
  })

  const now = c.get('now')

  await c.env.DB.prepare(
    `INSERT INTO attachments (id, transaction_id, r2_key, filename, mime_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(attachmentId, transactionId, key, file.name, file.type, file.size, now)
    .run()

  const data: AttachmentRecord = {
    id: attachmentId,
    transactionId,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    createdAt: now,
  }

  return c.json({ data }, 201)
})

app.get('/api/attachments/:id/download', async (c) => {
  const id = c.req.param('id')

  const attachment = await c.env.DB.prepare(
    'SELECT id, transaction_id as transactionId, r2_key as r2Key, filename, mime_type as mimeType, size, created_at as createdAt FROM attachments WHERE id = ?',
  )
    .bind(id)
    .first<AttachmentStorageRow>()

  if (!attachment) {
    throw new HTTPException(404, { message: 'Attachment not found' })
  }

  const object = await c.env.ATTACHMENTS.get(attachment.r2Key)
  if (!object || !object.body) {
    throw new HTTPException(404, { message: 'Attachment object not found' })
  }

  const encodedFilename = encodeURIComponent(attachment.filename)

  return new Response(object.body, {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.size),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
    },
  })
})

type TransactionRow = {
  id: string
  date: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  merchant: string
  note: string
}

type AttachmentStorageRow = {
  id: string
  transactionId: string
  r2Key: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
}

async function hydrateTransactions(db: D1Database, rows: TransactionRow[]): Promise<TransactionRecord[]> {
  if (rows.length === 0) {
    return []
  }

  const transactionIds = rows.map((row) => row.id)
  const placeholders = transactionIds.map(() => '?').join(',')

  const tagResults = await db
    .prepare(
      `SELECT tt.transaction_id as transactionId, t.id, t.name, t.color
       FROM transaction_tags tt
       JOIN tags t ON t.id = tt.tag_id
       WHERE tt.transaction_id IN (${placeholders})
       ORDER BY t.name ASC`,
    )
    .bind(...transactionIds)
    .all<{ transactionId: string; id: string; name: string; color: string | null }>()

  const attachmentResults = await db
    .prepare(
      `SELECT id, transaction_id as transactionId, filename, mime_type as mimeType, size, created_at as createdAt
       FROM attachments
       WHERE transaction_id IN (${placeholders})
       ORDER BY created_at ASC`,
    )
    .bind(...transactionIds)
    .all<AttachmentRecord>()

  const tagsByTransaction = new Map<string, TagRecord[]>()
  for (const tag of tagResults.results ?? []) {
    const list = tagsByTransaction.get(tag.transactionId) ?? []
    list.push({ id: tag.id, name: tag.name, color: tag.color })
    tagsByTransaction.set(tag.transactionId, list)
  }

  const attachmentsByTransaction = new Map<string, AttachmentRecord[]>()
  for (const attachment of attachmentResults.results ?? []) {
    const list = attachmentsByTransaction.get(attachment.transactionId) ?? []
    list.push(attachment)
    attachmentsByTransaction.set(attachment.transactionId, list)
  }

  return rows.map((row) => ({
    ...row,
    tags: tagsByTransaction.get(row.id) ?? [],
    attachments: attachmentsByTransaction.get(row.id) ?? [],
  }))
}

async function findTransactionById(db: D1Database, id: string): Promise<TransactionRecord | null> {
  const row = await db
    .prepare('SELECT id, date, type, amount, currency, merchant, note FROM transactions WHERE id = ?')
    .bind(id)
    .first<TransactionRow>()

  if (!row) {
    return null
  }

  const transactions = await hydrateTransactions(db, [row])
  return transactions[0] ?? null
}

async function replaceTransactionTags(db: D1Database, transactionId: string, tags: string[], now: string): Promise<void> {
  await db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').bind(transactionId).run()

  const normalizedTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))

  for (const tagName of normalizedTags) {
    const tag = await upsertTag(db, tagName, now)
    await db
      .prepare('INSERT INTO transaction_tags (transaction_id, tag_id, created_at) VALUES (?, ?, ?)')
      .bind(transactionId, tag.id, now)
      .run()
  }
}

async function upsertTag(db: D1Database, name: string, now: string): Promise<TagRecord> {
  const existing = await db.prepare('SELECT id, name, color FROM tags WHERE name = ?').bind(name).first<TagRecord>()
  if (existing) {
    return existing
  }

  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)').bind(id, name, null, now).run()

  return { id, name, color: null }
}

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

export default app
