import { createRouter } from './trpc'
import { connectionsRouter } from './routers/connections'
import { schemaRouter } from './routers/schema'
import { queriesRouter } from './routers/queries'

export const appRouter = createRouter({
  connections: connectionsRouter,
  schema: schemaRouter,
  queries: queriesRouter,
})

export type AppRouter = typeof appRouter
