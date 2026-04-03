import { createRouter } from './trpc'
import { connectionsRouter } from './routers/connections'

export const appRouter = createRouter({
  connections: connectionsRouter,
})

export type AppRouter = typeof appRouter
