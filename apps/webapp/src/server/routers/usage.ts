import { createRouter, protectedProcedure } from '../trpc'
import { getUserPlan, getTodayUsage, getLimits } from '../usage'
import { eq } from 'drizzle-orm'
import { userConnections, savedQueries, dashboards } from '@/db/schema'

export const usageRouter = createRouter({
  current: protectedProcedure.query(async ({ ctx }) => {
    const plan = await getUserPlan(ctx.customerId)
    const limits = getLimits(plan)
    const todayUsage = await getTodayUsage(ctx.customerId)

    const connectionCount = await ctx.db.query.userConnections.findMany({
      where: eq(userConnections.customerId, ctx.customerId),
      columns: { id: true },
    })

    const savedQueryCount = await ctx.db.query.savedQueries.findMany({
      where: eq(savedQueries.customerId, ctx.customerId),
      columns: { id: true },
    })

    const dashboardCount = await ctx.db.query.dashboards.findMany({
      where: eq(dashboards.customerId, ctx.customerId),
      columns: { id: true },
    })

    return {
      plan,
      limits,
      usage: {
        queriesUsed: todayUsage.queryCount,
        aiMessagesUsed: todayUsage.aiMessageCount,
        connectionsUsed: connectionCount.length,
        savedQueriesUsed: savedQueryCount.length,
        dashboardsUsed: dashboardCount.length,
      },
    }
  }),
})
