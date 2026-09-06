/**
 * Dealer-portal and shared ops-applications copy for the customer-platform
 * features (assisted mode panel, extended intake wizard, vehicle identity,
 * lender tagging). Namespace: `dealerOps`.
 */
export const en = {
  intake: {
    firstName: 'First name',
    lastName: 'Last name',
    gender: 'Gender',
    dateOfBirth: 'Date of birth',
    nationality: 'Nationality',
    nationalityDerived: 'From Qatar ID',
    residenceDuration: 'Time in Qatar',
    monthlyLiabilities: 'Monthly commitments (QAR)',
    guarantor: 'Guarantor',
    addGuarantor: 'Add guarantor',
    removeGuarantor: 'Remove guarantor',
    documentSlots: 'Required documents',
    slotRequired: 'Required',
    slotOptional: 'Optional',
    slotMissing: 'Missing',
    slotUploaded: 'Uploaded',
  },
  workspace: {
    lender: 'Lender',
    branch: 'Branch',
    salesExecutive: 'Sales executive',
    consents: 'Consents',
    consentsComplete: 'All consents captured',
    consentsPending: '{{count}} consent(s) pending',
    takaful: 'Takaful',
    assist: 'Assisted session',
    quotation: 'Dealer quotation',
  },
};

export const ar: typeof en = {
  intake: {
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    gender: 'الجنس',
    dateOfBirth: 'تاريخ الميلاد',
    nationality: 'الجنسية',
    nationalityDerived: 'من البطاقة الشخصية',
    residenceDuration: 'مدة الإقامة في قطر',
    monthlyLiabilities: 'الالتزامات الشهرية (ر.ق)',
    guarantor: 'الكفيل',
    addGuarantor: 'إضافة كفيل',
    removeGuarantor: 'إزالة الكفيل',
    documentSlots: 'المستندات المطلوبة',
    slotRequired: 'مطلوب',
    slotOptional: 'اختياري',
    slotMissing: 'ناقص',
    slotUploaded: 'تم الرفع',
  },
  workspace: {
    lender: 'الممول',
    branch: 'الفرع',
    salesExecutive: 'مندوب المبيعات',
    consents: 'الموافقات',
    consentsComplete: 'تم تسجيل جميع الموافقات',
    consentsPending: '{{count}} من الموافقات معلقة',
    takaful: 'التكافل',
    assist: 'جلسة مساعدة',
    quotation: 'عرض سعر الوكيل',
  },
};
