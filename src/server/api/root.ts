import { accountRouter } from "./routers/account";
import { apiKeysRouter } from "./routers/api-keys";
import { affiliateRouter } from "./routers/affiliate";
import { billingRouter } from "./routers/billing";
import { blogRouter } from "./routers/blog";
import { chatRouter } from "./routers/chat";
import { memoryRouter } from "./routers/memory";
import { migrationRouter } from "./routers/migration";
import { organizationRouter } from "./routers/organization";
import { projectsRouter } from "./routers/projects";
import { router } from "./trpc";

export const appRouter = router({
  account: accountRouter,
  apiKeys: apiKeysRouter,
  affiliate: affiliateRouter,
  blog: blogRouter,
  chat: chatRouter,
  memory: memoryRouter,
  billing: billingRouter,
  migration: migrationRouter,
  organization: organizationRouter,
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
