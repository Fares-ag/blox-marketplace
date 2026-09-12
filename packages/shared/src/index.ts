export { brandTokens, brandMeta, cssVarNames } from './config/brand-tokens';
export { bloxTokens, bloxMeta, bloxSpacing, bloxRadius, bloxElevation, bloxMotion } from './config/blox-tokens';
export { chartPalette, chartColors, chartColorAt, listingChartColors, listingChartColor, applicationChartColor } from './config/chart-palette';
export { applicationStatusStyles, listingStatusStyles, applicationStatusLabel, listingStatusLabel, quoteStatusLabel, applicationOpsPillVariant, applicationMarketplacePillVariant, applicationCardTone, listingOpsPillVariant, quoteOpsPillVariant, scheduleOpsPillVariant, transactionOpsPillVariant, companyOpsPillVariant, type OpsPillVariant, type OpsPillSemanticVariant, type OpsCardTone, type MarketplacePillVariant, type DealerQuoteStatus } from './config/status-styles';
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
  sumStatuses,
  totalStatuses,
  OPEN_APPLICATION_STATUSES,
  CONTRACT_STAGE_STATUSES,
  ACTIVE_FINANCING_STATUSES,
  IN_REVIEW_METRIC_STATUSES,
} from './lib/dashboard-metrics';
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
  overlayRegisterOnTimeline,
  filterKeyMilestones,
  type OwnershipMilestone,
  type OwnershipMilestoneKind,
  type OwnershipScheduleInput,
  type OwnershipTimeline,
  type PaymentLedgerEventInput,
} from './lib/ownership';
export {
  customerPhaseFor,
  canonicalStatusFromLegacy,
  APPLICATION_STATUSES,
  BLOCKING_APPLICATION_STATUSES as SHARED_BLOCKING_APPLICATION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
  PARTNER_PROCESSING_EXIT_STATUSES,
  CUSTOMER_PHASES,
  type CustomerPhase,
} from './lib/application-status-map';
export {
  DEFAULT_TOTAL_UNITS,
  unitsFromDownPayment,
  isMature,
  applyUnitPurchase,
  proRataAllocation,
  splitRentAndUnits,
  ownershipPctFromUnits,
  type UnitSplit,
  type ProRataAllocation,
} from './lib/units';
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
  clearMultiStepDraft,
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
  DashboardPipelineSection,
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
  StatusDonutChart,
} from './ops-ui-v2';
export type { FilterConfig, FilterOption, StepConfig, StepProps, VerticalBar, FunnelStage, LineChartSeries, StatusDonutSegment, OpsMetricItem } from './ops-ui-v2';
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
  CREDIT_HARDSHIP_QUEUE_STATUSES,
  isFullAdminRole,
  canCreditDecide,
  canFinanceAct,
  canActivateFinancing,
  canMarkPaid,
  visibleWorkspaceActions,
  ApplicationsList,
  CreditQueue,
  FinanceQueue,
  LpoInboxPage,
  HardshipQueuePage,
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
  recommendedMaxTenureFor,
  tenureBounds,
  downPaymentBounds,
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
  originationFunnelChartStages,
  type OriginationFunnelCounts,
  type OriginationFunnelStageLabels,
} from './lib/origination-funnel-ui';
export {
  ISO_NUMERIC_COUNTRIES,
  QID_LENGTH,
  ageFromDateOfBirth,
  dateOfBirthMatchesQid,
  normalizeQid,
  parseIsoDateParts,
  parseQid,
  type ParsedQid,
} from './lib/qid';
export {
  QATAR_DIAL_CODE,
  QATAR_PHONE_DIGITS,
  CR_NUMBER_MIN_DIGITS,
  CR_NUMBER_MAX_DIGITS,
  formatQatarPhone,
  isValidCrNumber,
  isValidEmail,
  isValidQatarPhone,
  normalizeCrNumber,
  normalizePhoneInput,
  normalizePhoneTyping,
  qatarPhoneSubscriberDigits,
} from './lib/contact';
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
  identityPresentSet,
  documentMatchesSlot,
  documentsForSlot,
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
// Customer-platform ops surfaces (dealer portal + the shared application workspace).
export {
  AssistedSessionPanel,
  ConsentsPanel,
  TakafulPanel,
  IdentityHoldBanner,
  isIdentityHoldActive,
  ReasonDialog,
  TagLenderDialog,
  SUBMIT_GATE_CODES,
  submitGateCode,
  submitGateMessage,
  GENDER_OPTIONS,
  GUARANTOR_RELATIONSHIP_OPTIONS,
  DOCUMENT_SLOT_GROUP_LABEL_KEYS,
  emptyCustomerInfo,
  customerInfoFromSnapshot,
  buildCustomerSnapshot,
  validateCustomerInfo,
  validateRequiredWizardDocuments,
  residencyForInfo,
  documentSlotProfileFor,
  wizardDocumentSlots,
  groupDocumentSlots,
  slotSatisfiedBy,
  wizardRuleViolations,
  ruleViolationMessage,
  applicantAgeBandWarning,
} from './ops-applications';
export type {
  OpsRuleFlag,
  OpsDocumentSlotsResponse,
  OpsUnmaskField,
  OpsUnmaskResponse,
  IdentityRevealProps,
  AssistedSessionListResponse,
  SubmitGateCode,
  WorkspacePlatformProps,
  CustomerInfoFormValue,
  CustomerGuarantor,
  CustomerGender,
  GuarantorRelationship,
  WizardDocumentSlot,
  IntakeTranslate,
} from './ops-applications';
export { Alert as OpsAlert } from './ops-ui-v2';
export { computeEarlySettlementQuote, type EarlySettlementQuote, type SettlementScheduleRow, type SettlementRowBreakdown } from './lib/settlement';
export {
  assessCredit,
  roleMayApprove,
  roleMayApproveTier,
  APPROVAL_AUTHORITY_ROLES,
  MAX_EXCEPTION_TIER_BY_ROLE,
  type ApprovalAuthority,
  type CreditAssessment,
  type CreditAssessmentInput,
  type CreditDecisionPath,
} from './lib/credit-assessment';
export { FORBIDDEN_TERMS, findForbiddenTerms, findForbiddenTermsInObject, type ForbiddenTermHit } from './lib/terminology';
export type {
  AffordabilityDto,
  CreditAssessmentDto,
  DataRightsRequestDto,
  DataRightsRequestKindDto,
  DataRightsRequestStatusDto,
  GuarantorSessionDto,
  GuarantorSessionPublicDto,
  GuarantorSessionStatusDto,
  PartnerApplicationDto,
  SettlementQuoteDto,
  SettlementQuoteRowDto,
  TakafulProviderDto,
  TakafulQuoteDto,
} from './types/customer-platform';
// Wave 2 ops surfaces: credit decisioning, guarantor consent, document freshness,
// takaful provider master, data-rights queue and the finance-partner read-only view.
export {
  CreditAssessmentPanel,
  DbrGauge,
  GuarantorPanel,
  useGuarantorSession,
  isGuarantorSessionActive,
  GUARANTOR_ACTIVE_STATUSES,
  TakafulProvidersPage,
  TakafulProviderEditPage,
  useTakafulProviders,
  DataRightsQueuePage,
  PartnerApplicationsList,
  PartnerApplicationDetail,
  usePartnerSummary,
  apiErrorCodeOf,
  apiErrorDetails,
  DECISION_ERROR_CODES,
  decisionErrorCode,
  decisionErrorMessage,
  approveBlockReason,
  effectiveAffordability,
  effectiveExceptionTier,
  dbrGaugeModel,
  creditPathVariant,
  formatDbrPct,
  staleDocumentCategories,
  newestUploadAt,
  isStaleUpload,
  dueState,
  dataRightsTransitions,
  dataRightsMetrics,
  normalizeDataRightsList,
  takafulAnnualContribution,
  takafulMonthlyEquivalent,
  sampleTakafulQuote,
  normalizeTakafulProviderList,
  PARTNER_STATUS_TABS,
  partnerStatusesFor,
  normalizePartnerList,
  normalizePartnerSummary,
  partnerSummaryCount,
} from './ops-applications';
export type {
  OpsDocumentSlot,
  GuarantorSessionResponse,
  TakafulProviderListResponse,
  DataRightsListResponse,
  PartnerApplicationListResponse,
  WorkspaceGuarantorProps,
  TransitionInput,
  ApproveInput,
  DecisionErrorCode,
  ApproveBlock,
  DbrGaugeModel,
  DueState,
  TakafulProviderFormValues,
  TakafulRiderFormValues,
  PartnerStatusTabId,
  PartnerSummary,
} from './ops-applications';
