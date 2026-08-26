export { brandTokens, brandMeta, cssVarNames } from './config/brand-tokens';
export { bloxTokens, bloxMeta, bloxSpacing, bloxRadius, bloxElevation, bloxMotion } from './config/blox-tokens';
export { chartPalette, chartColors, chartColorAt } from './config/chart-palette';
export { applicationStatusStyles, listingStatusStyles, applicationStatusLabel, listingStatusLabel, applicationOpsPillVariant, applicationMarketplacePillVariant, listingOpsPillVariant, scheduleOpsPillVariant, type OpsPillVariant, type MarketplacePillVariant } from './config/status-styles';
export { apiFetch, ApiError, getApiBase, apiUrl, apiFileUrl, resolveListingImageUrl, assertApiBaseConfigured, registerUnauthorizedHandler, resetUnauthorizedLatch, DEFAULT_PAGE_SIZE, buildPaginationQuery, paginationWindow } from './lib/api';
export { listingImageMediaPath } from './lib/listing-image-url';
export { createQueryClient } from './lib/query-client';
export { mountPortalApp, AuthBootstrap } from './lib/app-bootstrap';
export { initAppSentry } from './lib/sentry';
export { formatQar, formatPercent } from './lib/format';
export {
  buildInstallmentAmounts,
  buildPricingSnapshot,
  buildPrincipalAmounts,
  estimateMonthlyPayment,
  financedTotal,
  principalAmountsFromPricingSnapshot,
  principalCollectedFromInstallment,
  sumInstallmentAmounts,
  type MonthlyPaymentInput,
  type PricingInput,
  type PricingSnapshot,
} from './lib/pricing';
export {
  normalizeInstallmentInterval,
  isScheduleLikelyDaily,
  aggregateDailyScheduleToMonthly,
} from './lib/installment-plan-utils';
export {
  validatePaymentStructure,
  calculateBalloonPaymentSchedule,
  extractBalloonConfig,
  type BalloonPaymentConfig,
  type BalloonPaymentCalculation,
} from './lib/balloon-payment';
export {
  computeHideInterestDisplay,
  getCustomerFacingPrice,
  getCustomerFacingRatePercent,
} from './lib/deal-pricing';
export {
  parseTenureToMonths,
  formatMonthsToTenure,
  MIN_TENURE_MONTHS,
  MAX_TENURE_MONTHS,
  TENURE_PRESET_MONTHS,
  clampTenureMonths,
  isTenureInRange,
} from './lib/tenure';
export {
  generateInstallmentSchedule,
  generatePaymentScheduleFallback,
  resolveDownPaymentPercent,
  planForVehicle,
  calculateAmortizedMonthlyPayment,
  buildPlanFromPricingSnapshot,
} from './lib/generate-schedule';
export {
  resolveDisplaySchedule,
  isPreActiveStatus,
  type DisplayScheduleRow,
} from './lib/resolve-display-schedule';
export {
  calculatePlanOwnership,
  calculateBalloonPlanOwnership,
  rowOwnershipShares,
} from './lib/plan-ownership';
export type {
  InstallmentPlan,
  PaymentScheduleRow,
  PaymentStatus,
  InstallmentCalculationMethod,
} from './types/installment-plan';
export {
  labelTransmission,
  labelDrivetrain,
  labelBodyType,
  labelCondition,
  formatCardFacets,
  hasWarranty,
} from './lib/product-labels';
export {
  calculateOwnershipTimeline,
  filterKeyMilestones,
  type OwnershipMilestone,
  type OwnershipMilestoneKind,
  type OwnershipScheduleInput,
  type OwnershipTimeline,
  type PaymentLedgerEventInput,
} from './lib/ownership';
export type {
  UserRole,
  OfficerScope,
  CompanyStatus,
  ListingStatus,
  ApplicationStatus,
  VehicleCondition,
  Transmission,
  Drivetrain,
  BodyType,
  ProductCard,
  ProductDetail,
  ProductListResponse,
  PaginatedResponse,
  PublicCompanyListResponse,
  ScheduleListResponse,
  ScheduleSummary,
  ProductDetailResponse,
  PublicCompany,
  DmUser,
  Company,
  NotificationItem,
  AdminUser,
  AdminUserProvision,
  AdminCompany,
  DealerInventoryItem,
  DealerQuoteItem,
  ApplicationListItem,
  ApplicationDetail,
  ApplicationDocument,
  OpsApplicationQueueItem,
  FinancePartner,
} from './types/domain';
export { NON_BLOCKING_APPLICATION_STATUSES } from './types/domain';
export { useAuthStore, roleAllowed } from './auth/auth-store';
export { AuthGuard, GuestGuard } from './auth/AuthGuard';
export { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './auth/LoginPage';
export { TwoFactorLoginPage, MfaSetupPage, SecuritySettingsPanel } from './auth/MfaPages';
export { isMfaRequiredRole, MFA_REQUIRED_ROLES } from './auth/privileged-roles';
export {
  PRODUCT_ANALYTICS_EVENTS,
  sanitizeAnalyticsProps,
  type ProductAnalyticsEvent,
  type ProductAnalyticsProps,
} from './analytics/events';
export { trackProductEvent } from './analytics/track';
export { MoneyText, MarketplaceTopNav } from './components/ui';
export { theme, brandColors } from './config/theme';
export {
  ExportButton,
  exportToCSV,
  exportToJSON,
  ConfirmDialog,
  UserCredentialsDialog,
  EmptyState,
  StatusBadge,
  SearchBar,
  FilterPanel,
  MultiStepForm,
  PageSkeleton,
  PortalBasePathProvider,
  usePortalBasePath,
  withPortalBase,
  OpsSegmentedControl,
  OpsTabs,
  OpsTab,
  OpsToolbar,
  OpsMetricRow,
  OpsFormSection,
  OwnershipBar,
  OpsListPage,
  OpsDashboardPage,
  OpsDetailPage,
  OpsDetailGrid,
  OpsFormPage,
  OpsAuthLayout,
  OpsAuthBrandPanel,
  OpsAuthCardInner,
  doughnutChartOptions,
  ChartPanel,
  ChartLegendItem,
  HorizontalBarChart,
  SegmentedBarChart,
  VerticalBarChart,
  FunnelChart,
  LineChart,
} from './ops-ui-v2';
export type { FilterConfig, FilterOption, StepConfig, StepProps, VerticalBar, FunnelStage, LineChartSeries, OpsMetricItem } from './ops-ui-v2';
export {
  Button as OpsCoreButton,
  Input as OpsCoreInput,
  Select as OpsCoreSelect,
  Table as OpsCoreTable,
  Card as OpsCoreCard,
  Loading as OpsCoreLoading,
  Skeleton as OpsCoreSkeleton,
  TableSkeleton,
  CardSkeleton,
  ErrorBoundary as OpsErrorBoundary,
  PDFViewer,
} from './ops-core';
export type { Column as OpsTableColumn, ButtonProps as OpsCoreButtonProps } from './ops-core';
export {
  OpsField,
  OpsSelect,
  OpsTextarea,
  OpsFormGrid,
  OpsContentCard,
} from './ops-ui-v2';
export {
  OpsPageHeader,
  OpsStatusPill,
  OpsDataTable,
  OpsStatCard,
  OpsEmptyState,
  OpsPrimaryButton,
  OpsSecondaryButton,
  OpsGhostButton,
} from './components/ops-ui';
export { ScrollToTop } from './components/ScrollToTop';
export { BloxShell, OpsAppFrame } from './components/BloxShell';
export type { BloxNavItem } from './components/BloxShell';
export { DocumentMeta } from './components/DocumentMeta';
export {
  getAppLocale,
  setAppLocale,
  applyDocumentLocale,
  type AppLocale,
} from './i18n';
export { default as i18n } from './i18n';
export { useOpsLabels } from './i18n/use-ops-labels';
export {
  CREDIT_PIPELINE_STATUSES,
  CREDIT_QUEUE_STATUSES,
  isFullAdminRole,
  canCreditDecide,
  canFinanceAct,
  visibleWorkspaceActions,
  ApplicationsList,
  CreditQueue,
  ApplicationWorkspace,
  AddApplicationWizard,
  PendingBankTransfers,
  ScheduleLedger,
  VehicleCardGrid,
  InstallmentScheduleTable,
  InstallmentPlanStep,
  DealerAgentsPanel,
} from './ops-applications';
export type { VehicleCardOption } from './ops-applications';
// Shared by the dealer wizard and the customer apply form so the same question
// cannot end up with two different sets of answers. Pure data — no components.
export { EMPLOYMENT_TYPE_OPTIONS, EMPLOYMENT_DURATION_OPTIONS } from './ops-applications/customer-info';
export type { OpsAudience, OpsAgent, OpsQueueItem, OpsWorkspace, StaffCreatePayload } from './ops-applications';
