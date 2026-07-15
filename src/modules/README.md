# Modules

Each bounded context owns its domain, application, infrastructure, presentation, tests, and public `index.ts` contract. Cross-module consumers import only from `@/modules/<module>`.
