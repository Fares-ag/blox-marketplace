export { brandTokens, brandMeta, cssVarNames } from './config/brand-tokens';
export { bloxTokens, bloxMeta, bloxSpacing, bloxRadius, bloxElevation, bloxMotion } from './config/blox-tokens';
export { chartPalette, chartColors, chartColorAt } from './config/chart-palette';
export { applicationStatusStyles, listingStatusStyles, applicationStatusLabel, listingStatusLabel, applicationOpsPillVariant, applicationMarketplacePillVariant, listingOpsPillVariant, scheduleOpsPillVariant, transactionOpsPillVariant, companyOpsPillVariant, type OpsPillVariant, type OpsPillSemanticVariant, type MarketplacePillVariant } from './config/status-styles';
export {
  applicationDocumentLabel,
  isPreviewableImageDocument,
  type ApplicationDocumentLike,
} from './application-document-label';
export { apiFetch, ApiError, getApiBase, apiUrl, apiFileUrl, resolveListingImageUrl, assertApiBaseConfigured, registerUnauthorizedHandler, resetUnauthorizedLatch, DEFAULT_PAGE_SIZE, buildPaginationQuery, paginationWindow } from './lib/api';
export { listingImageMediaPath } from './lib/listing-image-url';
export { createQueryClient } from './lib/query-client';
export { useNavCounts } from './lib/use-nav-counts';
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
export { canManageUserAccess } from './users/admin-user-access';
export { MoneyText, MarketplaceTopNav } from './components/ui';
export { theme, brandColors } from './config/theme';
export {
  ExportButton,
  exportToCSV,
  exportToJSON,
  ConfirmDialog,
  UserCredentialsDialog,
  SetPasswordDialog,
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
  Sparkline,
  OpsFormSection,
  OwnershipBar,
  OpsListPage,
  OpsDashboardPage,
  DashboardSection,
  DashboardGrid,
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
  OpsDangerButton,
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
  FINANCE_ACTIVATION_QUEUE_STATUSES,
  FINANCE_REVIEW_QUEUE_STATUSES,
  FINANCE_ACTIVE_BOOK_STATUSES,
  isFullAdminRole,
  canCreditDecide,
  canFinanceAct,
  canActivateFinancing,
  canMarkPaid,
  visibleWorkspaceActions,
  ApplicationsList,
  CreditQueue,
  FinanceQueue,
  ApplicationWorkspace,
  AddApplicationWizard,
  PendingBankTransfers,
  ScheduleLedger,
  RecordPaymentDialog,
  VehicleCardGrid,
  InstallmentScheduleTable,
  InstallmentPlanStep,
  DealerAgentsPanel,
} from './ops-applications';
export type { VehicleCardOption, RecordPaymentTarget } from './ops-applications';
// Shared by the dealer wizard and the customer apply form so the same question
// cannot end up with two different sets of answers. Pure data — no components.
export { EMPLOYMENT_TYPE_OPTIONS, EMPLOYMENT_DURATION_OPTIONS } from './ops-applications/customer-info';
export type {
  OpsAudience,
  OpsAgent,
  OpsQueueItem,
  OpsWorkspace,
  StaffCreatePayload,
  WorkspaceActions,
} from './ops-applications';
// Customer-platform domain rules — the same module the API bundles as
// `@drivemarket/shared/domain-rules`, so web, dealer, ops and server agree.
export {
  PRODUCT_RULES,
  RESIDENCE_DURATION_OPTIONS,
  allowedTenureOptions,
  employerCategoryFromEmploymentType,
  financingCapFor,
  hasHardViolation,
  maxTenureFor,
  minDownPaymentPctFor,
  requiredApprovalAuthority,
  residenceMonthsFromOption,
  residencyFromNationality,
  resolveProductVariant,
  validateFinancingRequest,
  vehicleAgeAtTenureEnd,
  type ApplicantKind,
  type EmployerCategory,
  type FinancingRequest,
  type ProductRuleCode,
  type ProductRuleViolation,
  type ProductVariant,
  type ResidencyClass,
  type ResidenceDurationValue,
  type RuleVehicleCondition,
  type VehicleCategory,
} from './lib/product-rules';
export {
  assessAffordability,
  dbrCapFor,
  maxFinancingForInstallment,
  preCheckEligibility,
  type AffordabilityInput,
  type AffordabilityResult,
  type DbrStatus,
  type EligibilityCheck,
  type EligibilityCheckCode,
  type EligibilityInput,
  type EligibilityOutcome,
  type EligibilityResult,
} from './lib/affordability';
export {
  ISO_NUMERIC_COUNTRIES,
  QID_LENGTH,
  ageFromDateOfBirth,
  dateOfBirthMatchesQid,
  normalizeQid,
  parseQid,
  type ParsedQid,
} from './lib/qid';
export {
  CONSENT_CATALOG,
  CONSENT_CATALOG_VERSION,
  CONSENT_CODES,
  consentDefinition,
  consentFullText,
  isConsentCode,
  missingConsents,
  type ConsentAcceptance,
  type ConsentCodeValue,
  type ConsentDefinition,
} from './lib/consents';
export {
  DOCUMENT_SLOT_CATEGORIES,
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_MAX_BYTES,
  documentSlotsFor,
  documentUploadRejection,
  isSelfEmployed,
  missingDocumentCategories,
  requiredDocumentCategoriesFor,
  type DocumentSlot,
  type DocumentSlotCategory,
  type DocumentSlotGroup,
  type DocumentSlotProfile,
  type UploadRejection,
} from './lib/document-slots';
export { maskEmail, maskIban, maskName, maskPhone, maskQid, maskCustomerSnapshot } from './lib/masking';
export type {
  AssistedSessionDto,
  AssistedSessionPublicDto,
  AssistedSessionStatusDto,
  BranchDto,
  BreOwnershipDto,
  CompanyBrandingDto,
  ConsentChannelDto,
  ConsentCodeDto,
  ConsentRecordDto,
  ConsentStatusDto,
  CustomerAddressDto,
  CustomerDocumentCategoryDto,
  CustomerDocumentDto,
  CustomerProfileDto,
  FinancePartnerAdminDto,
  FinancePartnerBranchDto,
  FinancePartnerEngagementModeDto,
  GenderDto,
  IdentityHoldDto,
  NotificationPreferencesDto,
  OriginationFunnelDto,
  OriginationFunnelGroupBy,
  OriginationFunnelRow,
  SessionPolicyDto,
  TakafulPolicyDto,
  TakafulStatusDto,
} from './types/customer-platform';
export { SessionTimeoutGuard } from './auth/SessionTimeoutGuard';
export { trackProductEvent } from './analytics/track';
