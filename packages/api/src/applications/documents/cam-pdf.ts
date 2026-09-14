import { normalizeContractContext } from './contract-terms';
import { fieldsForDocument, type ContractFieldContext } from './field-maps';
import { BrandedPdfWriter } from './pdf-brand';

type Cell = { en: string; ar: string; value: string };

function v(fields: Record<string, string>, key: string, fallback = '—'): string {
  const value = fields[key]?.trim();
  return value || fallback;
}

function row(left: Cell, right: Cell): Cell[] {
  return [left, right];
}

function cell(en: string, ar: string, fields: Record<string, string>, key: string, prefix = ''): Cell {
  const raw = v(fields, key);
  return { en, ar, value: prefix && raw !== '—' ? `${prefix}${raw}` : raw };
}

export async function buildCamPdf(ctx: ContractFieldContext): Promise<Buffer> {
  const normalized = normalizeContractContext(ctx);
  const fields = fieldsForDocument('credit_appraisal_memorandum', normalized);

  const writer = await BrandedPdfWriter.create({
    title: 'Credit Appraisal Memorandum',
    subtitle: `INTERNAL · ${v(fields, 'CAM.Ref')}`,
    confidential: true,
    arabic: true,
    footerTag: 'BLX-TPL-004 v1.1 · INTERNAL · NOT FOR CUSTOMER OR DEALER DISCLOSURE · blox-it.com',
  });

  writer.bilingualLine('Credit Appraisal Memorandum', 'مذكرة التقييم الائتماني', { size: 14, bold: true, gap: 4 });
  writer.bilingualLine(
    'INTERNAL — not to be disclosed to the applicant or the dealer',
    'داخلي — لا يفصح عنه لمقدم الطلب أو الوكيل',
    { size: 8, gap: 8 },
  );

  writer.metaStrip([
    ['TEMPLATE ID', 'BLX-TPL-004', 'VERSION', '1.1'],
    ['OWNER', 'BloX Credit Risk', 'STATUS', 'Draft for M2P implementation'],
  ]);
  writer.paragraph('SIGN-OFF GATE: Chief Credit Officer · aligned to BloX Credit Risk Management Policy', {
    size: 8,
    gap: 10,
  });

  writer.noticeBox(
    'INTERNAL DOCUMENT',
    'مستند داخلي',
    'This memorandum must never render in the customer portal, the dealer portal, or any customer-facing communication. Access is restricted to Credit, Risk, Compliance, Internal Audit and the approving authority.',
    'لا يجوز إظهار هذه المذكرة في بوابة العملاء أو بوابة الوكلاء أو أي مراسلة موجهة للعميل. ويقتصر الاطلاع عليها على الائتمان والمخاطر والالتزام والتدقيق الداخلي وصاحب صلاحية الاعتماد.',
  );

  // 1. Facility Summary
  writer.section('1. Facility Summary', '١. ملخص التسهيل');
  writer.definitionGrid([
    row(cell('CAM Reference', 'رقم المذكرة', fields, 'CAM.Ref'), cell('Application No.', 'رقم الطلب', fields, 'Application.Number')),
    row(cell('Applicant', 'مقدم الطلب', fields, 'Customer.FullNameEN'), cell('Qatar ID No.', 'رقم البطاقة الشخصية', fields, 'Customer.QID')),
    row(
      { en: 'Product', ar: 'المنتج', value: v(fields, 'Product.Type', 'Diminishing Musharakah + Ijarah') },
      cell('Vehicle condition', 'حالة المركبة', fields, 'Vehicle.Condition'),
    ),
    row(
      {
        en: 'Vehicle',
        ar: 'المركبة',
        value: `${v(fields, 'Vehicle.Make')} ${v(fields, 'Vehicle.Model')} ${v(fields, 'Vehicle.Year')} · VIN ${v(fields, 'Vehicle.VIN')}`,
      },
      cell('Total vehicle cost', 'إجمالي تكلفة المركبة', fields, 'Price.TotalCost', 'QAR '),
    ),
    row(
      {
        en: 'Independent valuation',
        ar: 'التقييم المستقل',
        value: `QAR ${v(fields, 'Vehicle.ValuationAmount')} · ${v(fields, 'Vehicle.ValuationSource')}`,
      },
      {
        en: 'Customer contribution',
        ar: 'مساهمة العميل',
        value: `QAR ${v(fields, 'Price.CustomerContribution')} (${v(fields, 'Ownership.CustomerOpeningPct')})`,
      },
    ),
    row(
      {
        en: 'BloX contribution',
        ar: 'مساهمة بلوكس',
        value: `QAR ${v(fields, 'Price.BloXContribution')} (${v(fields, 'Ownership.BloXOpeningPct')})`,
      },
      {
        en: 'Loan-to-value',
        ar: 'نسبة التمويل إلى القيمة',
        value: `${v(fields, 'Credit.LTV')} · policy max ${v(fields, 'Policy.LTVMax')} · ${v(fields, 'Credit.LTVResult')}`,
      },
    ),
    row(
      {
        en: 'Term requested',
        ar: 'المدة المطلوبة',
        value: `${v(fields, 'Offer.TermMonths')} months`,
      },
      {
        en: 'Vehicle age at maturity',
        ar: 'عمر المركبة عند الاستحقاق',
        value: `${v(fields, 'Credit.VehicleAgeAtMaturity')} yrs · policy max ${v(fields, 'Policy.VehicleAgeMax')} · ${v(fields, 'Credit.VehicleAgeResult')}`,
      },
    ),
    row(
      cell('Rental rate applied', 'معدل الأجرة المطبق', fields, 'Deal.RentalRate'),
      cell('Periodic payment', 'الدفعة الدورية', fields, 'Deal.PeriodicPayment', 'QAR '),
    ),
  ]);

  // 2. Affordability
  writer.section('2. Affordability & Debt Burden', '٢. القدرة على السداد ونسبة الالتزامات');
  writer.table(
    [
      { label: 'Measure', width: 180 },
      { label: 'Value', width: 90, align: 'right' },
      { label: 'Policy limit', width: 90, align: 'right' },
      { label: 'Result', width: 155, align: 'right' },
    ],
    [
      [
        'Total monthly income (verified)',
        v(fields, 'Income.TotalMonthly', '—') !== '—' ? `QAR ${v(fields, 'Income.TotalMonthly')}` : '—',
        '—',
        v(fields, 'Income.VerificationSource'),
      ],
      [
        'Existing monthly obligations',
        `QAR ${v(fields, 'Obligation.TotalMonthly', '0.00')}`,
        '—',
        v(fields, 'Obligation.BureauReconciled', 'Application declared'),
      ],
      ['Proposed BloX payment', `QAR ${v(fields, 'Deal.PeriodicPayment')}`, '—', '—'],
      [fields['Credit.DBR'] ? 'Debt Burden Ratio (DBR)' : 'Debt Burden Ratio (DBR)', v(fields, 'Credit.DBR'), v(fields, 'Policy.DBRMax'), v(fields, 'Credit.DBRResult')],
      [
        'Residual income after obligations',
        v(fields, 'Credit.ResidualIncome') !== '—' ? `QAR ${v(fields, 'Credit.ResidualIncome')}` : '—',
        v(fields, 'Policy.ResidualIncomeMin'),
        v(fields, 'Credit.ResidualIncomeResult'),
      ],
      [
        'Average 6-month bank balance',
        v(fields, 'Credit.AvgBankBalance') !== '—' ? `QAR ${v(fields, 'Credit.AvgBankBalance')}` : '—',
        '—',
        '—',
      ],
      [
        'Salary transfer / assignment',
        v(fields, 'Income.SalaryTransferUndertaking', 'Not recorded'),
        v(fields, 'Policy.SalaryTransferRequired'),
        v(fields, 'Credit.SalaryTransferResult', '—'),
      ],
    ],
    { repeatHeader: true, fontSize: 7.5 },
  );
  writer.noticeBox(
    'Calculation rule',
    'قاعدة الاحتساب',
    'DBR is computed as (existing monthly obligations + proposed BloX periodic payment) ÷ total verified monthly income. The applicable policy limit is drawn from the BloX Credit Risk Management Policy by residency status and employer category, and must render alongside the computed value with an explicit pass, fail or exception result. The memorandum must not generate where verified income is null.',
    'تحتسب نسبة عبء الدين على أساس (الالتزامات الشهرية القائمة + الدفعة الدورية المقترحة من بلوكس) ÷ إجمالي الدخل الشهري الموثق. ويؤخذ الحد المطبق من سياسة إدارة مخاطر الائتمان لدى بلوكس بحسب حالة الإقامة وتصنيف جهة العمل، ويجب إظهاره إلى جانب القيمة المحتسبة مع نتيجة صريحة بالقبول أو الرفض أو الاستثناء. ولا تصدر المذكرة إذا كان الدخل الموثق غير مسجل.',
  );

  // 3. Credit Bureau
  writer.section('3. Credit Bureau & Decisioning', '٣. المكتب الائتماني واتخاذ القرار');
  writer.definitionGrid([
    row(cell('Bureau report ref.', 'رقم تقرير المكتب', fields, 'Bureau.ReportRef'), cell('Report date', 'تاريخ التقرير', fields, 'Bureau.ReportDate')),
    row(
      cell('Bureau score', 'درجة المكتب', fields, 'Bureau.Score'),
      {
        en: 'Policy cut-off',
        ar: 'حد السياسة',
        value: `${v(fields, 'Policy.BureauScoreMin', '—')} · ${v(fields, 'Bureau.ScoreResult', '—')}`,
      },
    ),
    row(cell('Worst arrears — 24 months', 'أسوأ تأخر خلال ٢٤ شهراً', fields, 'Bureau.WorstArrears'), cell('Defaults / write-offs', 'التعثرات / الديون المعدومة', fields, 'Bureau.Defaults')),
    row(cell('Undeclared obligations found', 'التزامات غير معلنة', fields, 'Bureau.UndeclaredObligations'), cell('Enquiries — 6 months', 'الاستعلامات خلال ٦ أشهر', fields, 'Bureau.RecentEnquiries')),
    row(
      cell('Existing BloX exposure', 'الانكشاف القائم لدى بلوكس', fields, 'Credit.ExistingBloXExposure', 'QAR '),
      cell('Total exposure post-facility', 'إجمالي الانكشاف بعد التسهيل', fields, 'Credit.TotalExposurePost', 'QAR '),
    ),
    row(cell('BRE decision', 'قرار محرك القواعد', fields, 'BRE.Decision'), {
      en: 'BRE score / grade',
      ar: 'درجة محرك القواعد',
      value: `${v(fields, 'BRE.Score', '—')} · ${v(fields, 'BRE.RiskGrade')}`,
    }),
    row(
      { en: 'BRE rules triggered', ar: 'القواعد التي تم تفعيلها', value: v(fields, 'BRE.RulesTriggered', 'None') },
      {
        en: 'BRE override applied',
        ar: 'تجاوز قرار المحرك',
        value: `${v(fields, 'BRE.OverrideApplied')} · by ${v(fields, 'BRE.OverrideBy', '—')} · reason: ${v(fields, 'BRE.OverrideReason', '—')}`,
      },
    ),
  ]);

  // 4. Compliance
  writer.section('4. Compliance & Screening', '٤. الالتزام والفحص');
  writer.table(
    [
      { label: 'Check', width: 130 },
      { label: 'Tool / source', width: 145 },
      { label: 'Date', width: 70 },
      { label: 'Result', width: 170 },
    ],
    [
      ['Identity verification (eKYC)', v(fields, 'Screen.eKYCTool'), v(fields, 'Screen.eKYCDate'), v(fields, 'Screen.eKYCResult')],
      ['Liveness / face match', v(fields, 'Screen.LivenessTool'), v(fields, 'Screen.LivenessDate'), v(fields, 'Screen.LivenessResult')],
      ['Sanctions screening', v(fields, 'Screen.SanctionsTool'), v(fields, 'Screen.SanctionsDate'), v(fields, 'Screen.SanctionsResult')],
      ['PEP screening', v(fields, 'Screen.PEPTool'), v(fields, 'Screen.PEPDate'), v(fields, 'Screen.PEPResult')],
      ['PEP relationship', v(fields, 'Screen.PEPRelationTool'), v(fields, 'Screen.PEPRelationDate'), v(fields, 'Screen.PEPRelationResult')],
      ['Adverse media', v(fields, 'Screen.AdverseMediaTool'), v(fields, 'Screen.AdverseMediaDate'), v(fields, 'Screen.AdverseMediaResult')],
      ['Source of funds — contribution', v(fields, 'Screen.SoFMethod'), v(fields, 'Screen.SoFDate'), v(fields, 'Screen.SoFResult')],
      ['Customer risk rating', 'BloX AML methodology', v(fields, 'Screen.RiskRatingDate'), v(fields, 'Screen.RiskRating')],
      ['MLRO referral required', '—', v(fields, 'Screen.MLROReferralDate'), v(fields, 'Screen.MLROReferralResult')],
    ],
    { repeatHeader: true, fontSize: 7.5 },
  );
  writer.noticeBox(
    'Blocking rule',
    'قاعدة حاجزة',
    'Any screening result other than a clear pass, and any true PEP match, blocks approval until the MLRO has recorded a disposition against this memorandum. The LOS must enforce this; it cannot be a procedural instruction.',
    'أي نتيجة فحص غير النجاح الصريح، وأي تطابق مؤكد مع شخص معرض سياسياً، يوقف الاعتماد إلى أن يسجل مسؤول الإبلاغ عن غسل الأموال قراره على هذه المذكرة. ويجب أن يفرض النظام ذلك آلياً لا إجرائياً.',
  );

  // 5. Applicant Profile
  writer.section('5. Applicant Profile', '٥. ملف مقدم الطلب');
  writer.definitionGrid([
    row(cell('Nationality', 'الجنسية', fields, 'Customer.Nationality'), cell('Residency status', 'حالة الإقامة', fields, 'Customer.ResidencyStatus')),
    row(
      {
        en: 'Age',
        ar: 'العمر',
        value: `${v(fields, 'Customer.Age', '—')} · at maturity ${v(fields, 'Credit.AgeAtMaturity', '—')}`,
      },
      cell('Years in Qatar', 'سنوات الإقامة في قطر', fields, 'Customer.YearsInQatar'),
    ),
    row(cell('Employer', 'جهة العمل', fields, 'Employment.EmployerName'), {
      en: 'Employer category',
      ar: 'تصنيف جهة العمل',
      value: `${v(fields, 'Employment.EmployerCategory')} · ${v(fields, 'Credit.EmployerCategoryResult', '—')}`,
    }),
    row(
      {
        en: 'Length of service',
        ar: 'مدة الخدمة',
        value: `${v(fields, 'Employment.ServiceYears', '—')} yrs · policy min ${v(fields, 'Policy.ServiceYearsMin')} · ${v(fields, 'Credit.ServiceResult', '—')}`,
      },
      {
        en: 'Total experience',
        ar: 'إجمالي الخبرة',
        value: v(fields, 'Employment.TotalExperienceYears') !== '—'
          ? `${v(fields, 'Employment.TotalExperienceYears')} yrs`
          : '—',
      },
    ),
    row(cell('Contract type', 'نوع العقد', fields, 'Employment.ContractType'), cell('Housing status', 'وضع السكن', fields, 'Customer.HousingStatus')),
  ]);

  // 6. Co-applicant & Guarantor
  writer.section('6. Co-Applicant & Guarantor Assessment', '٦. تقييم المشارك والضامن');
  writer.table(
    [
      { label: 'Party', width: 95 },
      { label: 'Role', width: 70 },
      { label: 'Income (QAR)', width: 75, align: 'right' },
      { label: 'DBR', width: 55, align: 'right' },
      { label: 'Bureau score', width: 70, align: 'right' },
      { label: 'Assessment', width: 150 },
    ],
    [
      [v(fields, 'Party.1.Name'), v(fields, 'Party.1.Role'), v(fields, 'Party.1.Income', '—'), v(fields, 'Party.1.DBR', '—'), v(fields, 'Party.1.BureauScore', '—'), v(fields, 'Party.1.Assessment')],
      [v(fields, 'Party.2.Name', '—'), v(fields, 'Party.2.Role', '—'), v(fields, 'Party.2.Income', '—'), v(fields, 'Party.2.DBR', '—'), v(fields, 'Party.2.BureauScore', '—'), v(fields, 'Party.2.Assessment', '—')],
    ],
    { repeatHeader: true, fontSize: 7.5 },
  );

  // 7. Structure & Sharia
  writer.section('7. Structure & Sharia Parameters', '٧. الهيكل والمعايير الشرعية');
  writer.definitionGrid([
    row(cell('Total ownership units', 'إجمالي وحدات الملكية', fields, 'Deal.TotalUnits'), cell('Customer opening units', 'وحدات العميل الافتتاحية', fields, 'Deal.CustomerOpeningUnits')),
    row(cell('BloX opening units', 'وحدات بلوكس الافتتاحية', fields, 'Deal.BloXOpeningUnits'), cell('Units purchased per period', 'الوحدات المشتراة كل فترة', fields, 'Deal.UnitsPerPeriod')),
    row(cell('Unit price basis', 'أساس سعر الوحدة', fields, 'Deal.UnitPriceBasis'), cell('Ijarah rental basis', 'أساس أجرة الإجارة', fields, 'Deal.RentalBasis')),
    row(cell('Takaful operator', 'مشغل التكافل', fields, 'Takaful.Operator'), cell('Takaful borne by', 'من يتحمل التكافل', fields, 'Takaful.BorneBy')),
    row(cell('Asset Sharia-permissible', 'الأصل جائز شرعاً', fields, 'Sharia.AssetPermissible'), cell('Product approved by SSB', 'المنتج معتمد من الهيئة الشرعية', fields, 'Sharia.SSBApprovalRef')),
  ]);

  // 8. Underwriter Assessment
  writer.section('8. Underwriter Assessment', '٨. تقييم مسؤول الدراسة');
  writer.textBlock('Strengths', 'نقاط القوة', v(fields, 'CAM.Strengths', 'None recorded'));
  writer.textBlock('Weaknesses / concerns', 'نقاط الضعف والملاحظات', v(fields, 'CAM.Weaknesses', 'None recorded'));
  writer.textBlock('Mitigants', 'عوامل التخفيف', v(fields, 'CAM.Mitigants'));
  writer.textBlock('Recommendation', 'التوصية', v(fields, 'CAM.Recommendation'));

  // 9. Policy Exceptions
  writer.section('9. Policy Exceptions', '٩. الاستثناءات من السياسة');
  writer.table(
    [
      { label: 'Policy item', width: 110 },
      { label: 'Policy limit', width: 85 },
      { label: 'Actual', width: 85 },
      { label: 'Compensating factor', width: 120 },
      { label: 'Escalated to', width: 115 },
    ],
    [
      [v(fields, 'Exception.1.Item', '—'), v(fields, 'Exception.1.Limit', '—'), v(fields, 'Exception.1.Actual', '—'), v(fields, 'Exception.1.Mitigant', '—'), v(fields, 'Exception.1.EscalatedTo', '—')],
      [v(fields, 'Exception.2.Item', '—'), v(fields, 'Exception.2.Limit', '—'), v(fields, 'Exception.2.Actual', '—'), v(fields, 'Exception.2.Mitigant', '—'), v(fields, 'Exception.2.EscalatedTo', '—')],
    ],
    { repeatHeader: true, fontSize: 7.5 },
  );
  writer.noticeBox(
    'Reporting rule',
    'قاعدة الإبلاغ',
    'Every row rendered here is reported in the monthly exception report to the Board Risk Committee. A facility approved outside policy without a row here is an audit finding by definition.',
    'يدرج كل بند يظهر هنا في تقرير الاستثناءات الشهري المرفوع للجنة المخاطر بالمجلس. ويعد اعتماد أي تسهيل خارج السياسة دون تسجيله هنا ملاحظة تدقيق بحكم التعريف.',
  );

  // 10. Approved Structure
  writer.section('10. Approved Structure & Conditions', '١٠. الهيكل المعتمد والشروط');
  writer.definitionGrid([
    row(
      cell('Decision', 'القرار', fields, 'Decision.Outcome'),
      cell('Approved BloX contribution', 'مساهمة بلوكس المعتمدة', fields, 'Decision.ApprovedAmount', 'QAR '),
    ),
    row(
      { en: 'Approved term', ar: 'المدة المعتمدة', value: `${v(fields, 'Decision.ApprovedTermMonths')} months` },
      cell('Approved rental rate', 'معدل الأجرة المعتمد', fields, 'Decision.ApprovedRentalRate'),
    ),
    row(
      cell('Required contribution', 'المساهمة المطلوبة', fields, 'Decision.RequiredContribution', 'QAR '),
      cell('Approval expiry', 'انتهاء صلاحية الموافقة', fields, 'Decision.ExpiryDate'),
    ),
    row(
      { en: 'Conditions precedent', ar: 'الشروط الواجب استيفاؤها', value: v(fields, 'Decision.ConditionsPrecedent') },
      { en: 'Conditions subsequent', ar: 'الشروط اللاحقة', value: v(fields, 'Decision.ConditionsSubsequent') },
    ),
  ]);

  // 11. Approval trail
  writer.section('11. Approval — Delegated Authority', '١١. الاعتماد — الصلاحيات المفوضة');
  writer.table(
    [
      { label: 'Stage', width: 72 },
      { label: 'Name', width: 95 },
      { label: 'Role', width: 85 },
      { label: 'Authority limit', width: 85, align: 'right' },
      { label: 'Decision', width: 68 },
      { label: 'Date & time', width: 110 },
    ],
    [
      ['Maker', v(fields, 'Approval.Maker.Name'), v(fields, 'Approval.Maker.Role'), '—', v(fields, 'Approval.Maker.Action'), v(fields, 'Approval.Maker.Timestamp')],
      ['Checker', v(fields, 'Approval.Checker.Name', '—'), v(fields, 'Approval.Checker.Role', '—'), v(fields, 'Approval.Checker.Limit', '—'), v(fields, 'Approval.Checker.Action', '—'), v(fields, 'Approval.Checker.Timestamp', '—')],
      ['Approver', v(fields, 'Approval.Approver.Name'), v(fields, 'Approval.Approver.Role'), v(fields, 'Approval.Approver.Limit'), v(fields, 'Approval.Approver.Action'), v(fields, 'Approval.Approver.Timestamp')],
      ['Escalation', v(fields, 'Approval.Escalation.Name', '—'), v(fields, 'Approval.Escalation.Role', '—'), v(fields, 'Approval.Escalation.Limit', '—'), v(fields, 'Approval.Escalation.Action', '—'), v(fields, 'Approval.Escalation.Timestamp', '—')],
    ],
    { repeatHeader: true, fontSize: 7.5 },
  );

  return writer.toBuffer();
}

/** @deprecated use buildCamPdf */
export const buildCamFallbackPdf = buildCamPdf;
