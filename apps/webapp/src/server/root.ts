import { createRouter } from './trpc'
import { connectionsRouter } from './routers/connections'
import { schemaRouter } from './routers/schema'
import { queriesRouter } from './routers/queries'
import { savedQueriesRouter } from './routers/saved-queries'

export const appRouter = createRouter({
  connections: connectionsRouter,
  schema: schemaRouter,
  queries: queriesRouter,
  savedQueries: savedQueriesRouter,
})

export type AppRouter = typeof appRouter
