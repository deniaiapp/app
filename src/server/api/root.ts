import { apiKeysRouter } from "./routers/api-keys";
import { affiliateRouter } from "./routers/affiliate";
import { billingRouter } from "./routers/billing";
import { blogRouter } from "./routers/blog";
import { chatRouter } from "./routers/chat";
import { memoryRouter } from "./routers/memory";
import { migrationRouter } from "./routers/migration";
import { organizationRouter } from "./routers/organization";
import { providersRouter } from "./routers/providers";
import { projectsRouter } from "./routers/projects";
import { shareRouter } from "./routers/share";
import { router } from "./trpc";

export const appRouter = router({
  apiKeys: apiKeysRouter,
  affiliate: affiliateRouter,
  blog: blogRouter,
  chat: chatRouter,
  memory: memoryRouter,
  billing: billingRouter,
  migration: migrationRouter,
  organization: organizationRouter,
  providers: providersRouter,
  projects: projectsRouter,
  share: shareRouter,
});

export type AppRouter = typeof appRouter;
