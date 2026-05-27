import { z } from 'zod'

const isoDate = /^\d{4}-\d{2}-\d{2}$/
const isoMonth = /^\d{4}-\d{2}$/

export const transactionTypeSchema = z.enum(['income', 'expense'])

export const createTransactionSchema = z.object({
  date: z.string().regex(isoDate, 'date must be yyyy-mm-dd'),
  type: transactionTypeSchema,
  amount: z.number().int().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  merchant: z.string().trim().max(255),
  note: z.string().trim().max(1000).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(50)).default([]),
})

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().max(32).optional(),
})

export const listTransactionsQuerySchema = z.object({
  month: z.string().regex(isoMonth).optional(),
  currency: z
    .string()
    .length(3)
    .optional()
    .transform((value) => value?.toUpperCase()),
})

export const monthlyReportQuerySchema = z.object({
  month: z.string().regex(isoMonth).optional(),
})

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type CreateTagInput = z.infer<typeof createTagSchema>

export type TagRecord = {
  id: string
  name: string
  color: string | null
}

export type AttachmentRecord = {
  id: string
  transactionId: string
  filename: string
  mimeType: string
  size: number
  createdAt: string
}

export type TransactionRecord = {
  id: string
  date: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  merchant: string
  note: string
  tags: TagRecord[]
  attachments: AttachmentRecord[]
}

export type TransactionDetail = TransactionRecord

export type MonthlySummary = {
  currency: string
  incomeTotal: number
  expenseTotal: number
}
