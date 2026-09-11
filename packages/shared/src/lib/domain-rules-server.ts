/**
 * Server bundle entry for the domain rules shared with the API
 * (`@drivemarket/shared/domain-rules`). Built to CommonJS by
 * `npm run build:domain-rules -w @drivemarket/shared`; keep it free of React,
 * browser globals and Prisma so it stays isomorphic.
 */
export * from './product-rules';
export * from './affordability';
export * from './qid';
export * from './consents';
export * from './document-slots';
export * from './masking';
export * from './settlement';
export * from './credit-assessment';
export * from './terminology';
export * from './contact';
