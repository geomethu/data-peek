import { createRouter } from './trpc'
import { connectionsRouter } from './routers/connections'
import { schemaRouter } from './routers/schema'
import { queriesRouter } from './routers/queries'
import { savedQueriesRouter } from './routers/saved-queries'
import { historyRouter } from './routers/history'
import { healthRouter } from './routers/health'

export const appRouter = createRouter({
  connections: connectionsRouter,
  schema: schemaRouter,
  queries: queriesRouter,
  savedQueries: savedQueriesRouter,
  history: historyRouter,
  health: healthRouter,
})

export type AppRouter = typeof appRouter
