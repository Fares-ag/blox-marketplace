import type { AgreementClause } from './musharakah-agreement-clauses';

/** Bind variables for the Ijarah Agreement (BLX-TPL-011). */
export type IjarahBind = {
  dealRef: string;
  executionDate: string;
  commencementDate: string;
  rentalRate: string;
  paymentFrequency: string;
  dueDayDescription: string;
  customerNameEn: string;
  customerNameAr: string;
  customerQid: string;
  customerAddress: string;
  coApplicantName: string;
  coApplicantQid: string;
  bloxAddress: string;
  signatoryName: string;
  maxDaysAbroad: string;
  incidentNoticeDays: string;
  inspectionsPerYear: string;
  abatementDays: string;
};

export function buildIjarahClauses(v: IjarahBind): AgreementClause[] {
  return [
    {
      number: '1',
      titleEn: 'Relationship to the Musharakah',
      titleAr: 'العلاقة باتفاقية المشاركة',
      bodyEn: [
        `1.1 This Agreement is entered into together with the Diminishing Musharakah Agreement of even date (reference ${v.dealRef}) and is to be read with it. Terms defined there have the same meaning here.`,
        '1.2 This Agreement terminates automatically when the Musharakah Agreement terminates.',
      ],
      bodyAr: [
        `١-١ أبرمت هذه الاتفاقية مع اتفاقية المشاركة المتناقصة المؤرخة بذات التاريخ (المرجع ${v.dealRef}) وتقرأ معها، وللمصطلحات المعرفة فيها ذات المعنى هنا.`,
        '١-٢ وتنتهي هذه الاتفاقية تلقائياً بانتهاء اتفاقية المشاركة.',
      ],
    },
    {
      number: '2',
      titleEn: 'Grant of Use',
      titleAr: 'منح حق الانتفاع',
      bodyEn: [
        "2.1 BloX grants the Customer the use and enjoyment of BloX's ownership share in the Asset for the Term, and the Customer accepts it.",
        '2.2 The Customer already owns its own share and pays no rent in respect of it. Rent is payable only in respect of BloX\'s share.',
      ],
      bodyAr: [
        '٢-١ تمنح بلوكس العميل حق الانتفاع بحصتها في ملكية الأصل طوال المدة، ويقبل العميل ذلك.',
        '٢-٢ والعميل يملك حصته أصلاً ولا يدفع عنها أجرة، وإنما تستحق الأجرة عن حصة بلوكس وحدها.',
      ],
    },
    {
      number: '3',
      titleEn: 'Term',
      titleAr: 'المدة',
      bodyEn: [
        `The Term begins on ${v.commencementDate} and continues until the Customer acquires all Ownership Units or this Agreement terminates earlier under Clause 1.2, Clause 8 or the Musharakah Agreement.`,
      ],
      bodyAr: [
        `تبدأ المدة في ${v.commencementDate} وتستمر حتى يتملك العميل جميع وحدات الملكية أو تنتهي هذه الاتفاقية قبل ذلك وفق البند ١-٢ أو البند ٨ أو اتفاقية المشاركة.`,
      ],
    },
    {
      number: '4',
      titleEn: 'Rent',
      titleAr: 'الأجرة',
      bodyEn: [
        `4.1 Rent for each period is calculated on BloX's ownership share during that period at the rate of ${v.rentalRate}, and is set out for each period in the Schedule of Ownership and Rental.`,
        "4.2 As the Customer acquires Ownership Units, BloX's ownership share falls and the rent falls with it. The rent for each period is a known amount stated in the Schedule before that period begins.",
        `4.3 Rent is payable ${v.paymentFrequency} in arrears on ${v.dueDayDescription}.`,
        '4.4 Rent is payable together with the price of the Ownership Units purchased in that period. The two amounts are shown separately on the Schedule and on every statement.',
        '4.5 Rent ceases to accrue on the date the Customer acquires all Ownership Units, on the date of a total loss under Clause 9 of the Musharakah Agreement, or on the date of sale under Clause 11.3 of that Agreement, whichever occurs first.',
      ],
      bodyAr: [
        `٤-١ تحتسب أجرة كل فترة على حصة بلوكس في الملكية خلال تلك الفترة بمعدل ${v.rentalRate}، وتبين لكل فترة في جدول الملكية والأجرة.`,
        '٤-٢ وكلما تملك العميل وحدات ملكية نقصت حصة بلوكس ونقصت الأجرة معها، وتكون أجرة كل فترة مبلغاً معلوماً مبيناً في الجدول قبل بدء تلك الفترة.',
        `٤-٣ وتستحق الأجرة ${v.paymentFrequency} في نهاية كل فترة في ${v.dueDayDescription}.`,
        '٤-٤ وتدفع الأجرة مع ثمن وحدات الملكية المشتراة في تلك الفترة، ويبين المبلغان منفصلين في الجدول وفي كل كشف حساب.',
        '٤-٥ وتتوقف الأجرة عن الاستحقاق في تاريخ تملك العميل جميع وحدات الملكية، أو تاريخ الهلاك الكلي وفق البند ٩ من اتفاقية المشاركة، أو تاريخ البيع وفق البند ١١-٣ منها، أيها أسبق.',
      ],
    },
    {
      number: '5',
      titleEn: 'Payment',
      titleAr: 'السداد',
      bodyEn: [
        '5.1 Payment is made by the method recorded in the Payment Mandate of even date.',
        '5.2 Payments are applied first to rent accrued, then to the price of Ownership Units due, then to any other amount properly due.',
      ],
      bodyAr: [
        '٥-١ يتم السداد بالوسيلة المبينة في تفويض السداد المحرر بذات التاريخ.',
        '٥-٢ وتخصص المدفوعات أولاً للأجرة المستحقة، ثم لثمن وحدات الملكية المستحقة، ثم لأي مبلغ آخر مستحق بوجه حق.',
      ],
    },
    {
      number: '6',
      titleEn: 'Obligations of the Customer',
      titleAr: 'التزامات العميل',
      bodyEn: [
        "6.1 The Customer shall keep the Asset in good working order, service it in accordance with the manufacturer's schedule, and bear the costs of use under Clause 8.2 of the Musharakah Agreement.",
        `6.2 The Customer shall not modify the Asset structurally, shall not sub-let it or allow another person to use it for reward, and shall not remove it from the State of Qatar for more than ${v.maxDaysAbroad} days without BloX's written consent.`,
        `6.3 The Customer shall notify BloX within ${v.incidentNoticeDays} days of any accident, theft, seizure or material damage.`,
        `6.4 The Customer shall permit BloX to inspect the Asset on reasonable notice, not more than ${v.inspectionsPerYear} times a year except following an incident notified under Clause 6.3.`,
      ],
      bodyAr: [
        '٦-١ يلتزم العميل بالمحافظة على الأصل في حالة صالحة للاستعمال وبصيانته وفق جدول الصانع وبتحمل تكاليف الانتفاع وفق البند ٨-٢ من اتفاقية المشاركة.',
        `٦-٢ ولا يجوز للعميل إجراء تعديلات جوهرية على الأصل، ولا تأجيره من الباطن أو السماح لغيره باستعماله بمقابل، ولا إخراجه من دولة قطر لمدة تجاوز ${v.maxDaysAbroad} يوماً دون موافقة بلوكس الخطية.`,
        `٦-٣ ويلتزم العميل بإخطار بلوكس خلال ${v.incidentNoticeDays} يوماً بأي حادث أو سرقة أو حجز أو ضرر جوهري.`,
        `٦-٤ ويمكّن العميل بلوكس من معاينة الأصل بإخطار معقول بما لا يجاوز ${v.inspectionsPerYear} مرات سنوياً، إلا عقب واقعة أخطر بها وفق البند ٦-٣.`,
      ],
    },
    {
      number: '7',
      titleEn: 'Obligations of BloX',
      titleAr: 'التزامات بلوكس',
      bodyEn: [
        "7.1 BloX shall bear the ownership costs attributable to its share under Clause 8.1 of the Musharakah Agreement, including its proportionate share of takaful and of major repairs not caused by the Customer.",
        "7.2 BloX shall not disturb the Customer's use of the Asset while the Customer performs its obligations.",
        `7.3 Where the Asset cannot be used for a continuous period exceeding ${v.abatementDays} days for a reason not attributable to the Customer, rent abates for that period.`,
      ],
      bodyAr: [
        '٧-١ تتحمل بلوكس تكاليف الملكية العائدة لحصتها وفق البند ٨-١ من اتفاقية المشاركة، ومنها نصيبها النسبي في التكافل وفي الإصلاحات الكبرى غير الناشئة عن فعل العميل.',
        '٧-٢ ولا تتعرض بلوكس لانتفاع العميل بالأصل ما دام العميل منفذاً لالتزاماته.',
        `٧-٣ وإذا تعذر الانتفاع بالأصل مدة متصلة تجاوز ${v.abatementDays} يوماً لسبب لا ينسب للعميل سقطت الأجرة عن تلك المدة.`,
      ],
    },
    {
      number: '8',
      titleEn: 'Termination',
      titleAr: 'الإنهاء',
      bodyEn: [
        '8.1 This Agreement terminates on completion under Clause 15 of the Musharakah Agreement, on total loss under Clause 9 of that Agreement, or on sale under Clause 11.3 of that Agreement.',
        '8.2 On termination the Customer shall pay rent accrued to the date of termination and no more. No rent is payable for any period after termination.',
        "8.3 Termination of this Agreement does not by itself extinguish the Customer's ownership share, which is dealt with under the Musharakah Agreement.",
      ],
      bodyAr: [
        '٨-١ تنتهي هذه الاتفاقية بالإتمام وفق البند ١٥ من اتفاقية المشاركة، أو بالهلاك الكلي وفق البند ٩ منها، أو بالبيع وفق البند ١١-٣ منها.',
        '٨-٢ وعند الإنهاء يدفع العميل الأجرة المستحقة حتى تاريخ الإنهاء لا غير، ولا تستحق أجرة عن أي فترة تالية للإنهاء.',
        '٨-٣ ولا يترتب على إنهاء هذه الاتفاقية بذاته سقوط حصة العميل في الملكية، وتعالج تلك الحصة وفق اتفاقية المشاركة.',
      ],
    },
    {
      number: '9',
      titleEn: 'Language, Sharia, Law',
      titleAr: 'اللغة والأحكام الشرعية والقانون',
      bodyEn: ['Clauses 17, 18 and 19 of the Musharakah Agreement apply to this Agreement as if set out here.'],
      bodyAr: ['تسري البنود ١٧ و١٨ و١٩ من اتفاقية المشاركة على هذه الاتفاقية كما لو كانت واردة فيها.'],
    },
  ];
}
