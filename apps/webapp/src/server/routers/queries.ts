import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createRouter, protectedProcedure } from '../trpc'
import { userConnections, queryHistory } from '@/db/schema'
import { getAdapter } from '@/lib/db-connect'

export const queriesRouter = createRouter({
  execute: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        sql: z.string().min(1).max(100000),
        timeoutMs: z.number().int().min(1000).max(300000).default(30000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.userConnections.findFirst({
        where: and(
          eq(userConnections.id, input.connectionId),
          eq(userConnections.customerId, ctx.customerId)
        ),
      })

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' })
      }

      const adapter = await getAdapter(
        connection.id,
        connection.dbType,
        connection.encryptedCredentials,
        connection.iv,
        connection.authTag,
        ctx.userId
      )

      try {
        const result = await adapter.query(input.sql, input.timeoutMs)

        await ctx.db.insert(queryHistory).values({
          customerId: ctx.customerId,
          connectionId: input.connectionId,
          query: input.sql,
          status: 'success',
          durationMs: result.durationMs,
          rowCount: result.rowCount,
        })

        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Query execution failed'

        await ctx.db.insert(queryHistory).values({
          customerId: ctx.customerId,
          connectionId: input.connectionId,
          query: input.sql,
          status: 'error',
          errorMessage: message,
        })

        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
      }
    }),

  explain: protectedProcedure
    .input(
      z.object({
        connectionId: z.string().uuid(),
        sql: z.string().min(1),
        analyze: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.userConnections.findFirst({
        where: and(
          eq(userConnections.id, input.connectionId),
          eq(userConnections.customerId, ctx.customerId)
        ),
      })

      if (!connection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Connection not found' })
      }

      const adapter = await getAdapter(
        connection.id,
        connection.dbType,
        connection.encryptedCredentials,
        connection.iv,
        connection.authTag,
        ctx.userId
      )

      return adapter.explain(input.sql, input.analyze)
    }),
})
