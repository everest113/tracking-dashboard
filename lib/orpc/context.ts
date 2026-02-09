import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface Context extends Record<string, unknown> {
  req: NextRequest
  prisma: typeof prisma
}

export async function createContext(req: NextRequest): Promise<Context> {
  return {
    req,
    prisma,
  }
}
