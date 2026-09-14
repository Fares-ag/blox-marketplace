/** Bind variables for the Diminishing Musharakah Agreement (BLX-TPL-MUSH-V2). */
export type MusharakahBind = {
  contractNo: string;
  executionDate: string;
  customerName: string;
  customerQid: string;
  customerAddress: string;
  customerPhoneEmail: string;
  bloxAddress: string;
  signatoryName: string;
  signatoryTitle: string;
  vehicleType: string;
  vehicleMakeModel: string;
  vehicleYear: string;
  chassisNo: string;
  engineNo: string;
  plateNo: string;
  totalPrice: string;
  bloxContribution: string;
  bloxPct: string;
  customerContribution: string;
  customerPct: string;
  numberOfUnits: string;
  unitValue: string;
  annualRate: string;
  tenor: string;
  rentDefaultDays: string;
  defaultNoticeDays: string;
  saleProcureDays: string;
  disputeDays: string;
  forceMajeureNoticeDays: string;
  forceMajeureMaxDays: string;
  latePaymentDaily: string;
};

export type AgreementClause = {
  number: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string[];
  bodyAr: string[];
};

export const MUSHARAKAH_TOC: Array<{ number: string; titleEn: string; titleAr: string }> = [
  { number: '1', titleEn: 'Parties to the Agreement', titleAr: 'أطراف العقد' },
  { number: '2', titleEn: 'Definitions and Interpretation', titleAr: 'التعريفات والتفسير' },
  { number: '3', titleEn: 'Preamble', titleAr: 'التمهيد' },
  { number: '4', titleEn: 'Description of the Asset', titleAr: 'وصف الأصل' },
  { number: '5', titleEn: 'Capital Contributions and Ownership Shares', titleAr: 'المساهمات الرأسمالية وحصص الملكية' },
  { number: '6', titleEn: 'Lease (Ijarah) Subcontract', titleAr: 'عقد الإجارة الفرعي' },
  { number: '7', titleEn: 'Diminishing Musharakah Mechanism', titleAr: 'آلية المشاركة المتناقصة' },
  { number: '8', titleEn: 'Maintenance and Takaful Insurance', titleAr: 'الصيانة والتأمين التكافلي' },
  { number: '9', titleEn: 'Loss or Total Destruction of the Asset', titleAr: 'هلاك الأصل أو تلفه الكلي' },
  { number: '10', titleEn: 'Representations and Warranties', titleAr: 'الإقرارات والضمانات' },
  { number: '11', titleEn: 'Events of Default and Remedies', titleAr: 'حالات الإخلال والحلول' },
  { number: '12', titleEn: "Late Payment Compensation (Ta'widh)", titleAr: 'تعويض التأخير (التعويض)' },
  { number: '13', titleEn: 'Force Majeure', titleAr: 'القوة القاهرة' },
  { number: '14', titleEn: 'Assignment and Transfer', titleAr: 'التنازل والنقل' },
  { number: '15', titleEn: 'Electronic Execution and Digital Platform', titleAr: 'التنفيذ الإلكتروني والمنصة الرقمية' },
  { number: '16', titleEn: 'Data Protection', titleAr: 'حماية البيانات' },
  { number: '17', titleEn: 'Shariah Compliance', titleAr: 'الامتثال للشريعة الإسلامية' },
  { number: '18', titleEn: 'Governing Law and Dispute Resolution', titleAr: 'القانون الواجب التطبيق وتسوية النزاعات' },
  { number: '19', titleEn: 'Language', titleAr: 'اللغة' },
  { number: '20', titleEn: 'Entire Agreement and Amendments', titleAr: 'العقد الكامل والتعديلات' },
  { number: '21', titleEn: 'Notices', titleAr: 'الإخطارات' },
  { number: '22', titleEn: 'Signatures', titleAr: 'التوقيعات' },
];

export function buildMusharakahClauses(v: MusharakahBind): AgreementClause[] {
  return [
    {
      number: '1',
      titleEn: 'Parties to the Agreement',
      titleAr: 'أطراف العقد',
      bodyEn: [
        `This Diminishing Musharakah Agreement ("Agreement") is entered into on ${v.executionDate} in the city of Doha, State of Qatar, by and between the following parties:`,
        `First Party (Owner-Co / Financier): BloX, a company duly incorporated under the laws of the State of Qatar, with its registered office at ${v.bloxAddress}, Doha, Qatar, Commercial Registration No. 17-2820-69, represented by ${v.signatoryName} in the capacity of ${v.signatoryTitle}. (Hereinafter: "BloX" or "First Party")`,
        `Second Party (Owner-Co / Customer): ${v.customerName}, QID / Passport No. ${v.customerQid}, Address: ${v.customerAddress}, Phone / Email: ${v.customerPhoneEmail}. (Hereinafter: "Customer" or "Second Party"). The First Party and the Second Party are each a "Party" and together the "Parties".`,
      ],
      bodyAr: [
        `أُبرم عقد المشاركة المتناقصة هذا ("العقد") في يوم ${v.executionDate} في مدينة الدوحة، دولة قطر، بين كل من الطرفين الآتيين:`,
        `الطرف الأول (الممول / الشريك): بلوكس، شركة مؤسسة قانوناً بموجب قوانين دولة قطر، مقرها المسجل في ${v.bloxAddress}، الدوحة، قطر، سجل تجاري رقم 17-2820-69، ويمثلها ${v.signatoryName} بصفته ${v.signatoryTitle}. (ويشار إليه بـ "بلوكس" أو "الطرف الأول")`,
        `الطرف الثاني (العميل / الشريك): ${v.customerName}، رقم الهوية / جواز السفر: ${v.customerQid}، العنوان: ${v.customerAddress}، الهاتف / البريد الإلكتروني: ${v.customerPhoneEmail}. (ويشار إليه بـ "العميل" أو "الطرف الثاني"). يشار إلى الطرف الأول والطرف الثاني معاً بـ "الطرفين" وكل منهما منفرداً بـ "الطرف".`,
      ],
    },
    {
      number: '2',
      titleEn: 'Definitions and Interpretation',
      titleAr: 'التعريفات والتفسير',
      bodyEn: [
        'In this Agreement, unless the context otherwise requires, the following terms shall have the meanings set out below:',
        '"Asset" means the motor vehicle described in Clause 4, together with all parts, accessories, registration documents, and title relating to it.',
        '"Business Day" means any day other than a Friday, Saturday, or official public holiday in the State of Qatar.',
        '"Ijarah Agreement" means the lease agreement referred to in Clause 6, under which the First Party leases its undivided share in the Asset to the Second Party.',
        '"QCB" means the Qatar Central Bank.',
        '"Shariah Supervisory Board" means the Shariah supervisory board constituted by BloX to review and supervise the Shariah compliance of its products, including this Agreement.',
        '"Takaful" means Islamic insurance coverage over the Asset procured in accordance with Clause 8.',
        '"Unit" means one of the equal units into which the First Party\'s ownership share in the Asset is divided pursuant to Clause 7.1.',
        '"Force Majeure Event" means has the meaning given to it in Clause 13.',
        '"Wa\'d" means the separate unilateral Promise to Purchase given by the Second Party in favour of the First Party in respect of the Units, as referred to in Clause 7.1.',
        '"PDPPL" means Law No. (13) of 2016 Concerning Personal Data Privacy Protection of the State of Qatar, as amended from time to time.',
      ],
      bodyAr: [
        'في هذا العقد، ما لم يقتضِ السياق خلاف ذلك، للمصطلحات التالية المعاني الموضحة أدناه:',
        '"الأصل": المركبة الموصوفة في البند الرابع، بما في ذلك جميع الأجزاء والملحقات ووثائق التسجيل والملكية المتعلقة بها.',
        '"يوم عمل": أي يوم بخلاف الجمعة أو السبت أو العطلات الرسمية المعتمدة في دولة قطر.',
        '"عقد الإجارة": عقد الإيجار المشار إليه في البند السادس، الذي يؤجر بموجبه الطرف الأول حصته الشائعة في الأصل للطرف الثاني.',
        '"مصرف قطر المركزي": مصرف قطر المركزي.',
        '"هيئة الرقابة الشرعية": هيئة الرقابة الشرعية التي شكّلتها بلوكس لمراجعة والإشراف على الامتثال الشرعي لمنتجاتها، بما في ذلك هذا العقد.',
        '"التكافل": تغطية التأمين الإسلامي على الأصل التي يتم الحصول عليها وفقاً للبند الثامن.',
        '"الوحدة": إحدى الوحدات المتساوية التي تُقسَّم إليها حصة ملكية الطرف الأول في الأصل عملاً بالبند 7.1.',
        '"حدث القوة القاهرة": له المعنى المحدد له في البند الثالث عشر.',
        '"الوعد": وعد الشراء الأحادي المنفصل المقدَّم من الطرف الثاني لصالح الطرف الأول فيما يتعلق بالوحدات، على النحو المشار إليه في البند 7.1.',
        '"قانون حماية الخصوصية": القانون رقم (13) لسنة 2016 بشأن حماية خصوصية البيانات الشخصية في دولة قطر، وتعديلاته.',
      ],
    },
    {
      number: '3',
      titleEn: 'Preamble',
      titleAr: 'التمهيد',
      bodyEn: [
        'The Second Party desires to acquire the Asset described in Clause 4 but requires co-financing to do so. The Parties have agreed to jointly purchase and co-own the Asset in accordance with the principles of Diminishing Musharakah (Shirkat Al-Milk) under Islamic Shariah and the applicable laws of the State of Qatar. The Second Party further intends to gradually acquire the First Party\'s ownership units until the Second Party becomes the sole owner of the Asset.',
        'The above Preamble and all annexes attached hereto form an integral part of this Agreement.',
      ],
      bodyAr: [
        'يرغب الطرف الثاني في تملك الأصل الموصوف في البند الرابع ويحتاج إلى تمويل مشترك لذلك. اتفق الطرفان على شراء الأصل بشكل مشترك وتملكه على الشيوع وفقاً لمبادئ المشاركة المتناقصة (شركة الملك) بموجب الشريعة الإسلامية وقوانين دولة قطر المعمول بها. ويعتزم الطرف الثاني كذلك الاستحواذ التدريجي على وحدات ملكية الطرف الأول حتى يصبح المالك الوحيد للأصل.',
        'يُعدّ التمهيد أعلاه وجميع الملاحق المرفقة بهذا العقد جزءاً لا يتجزأ منه.',
      ],
    },
    {
      number: '4',
      titleEn: 'Description of the Asset',
      titleAr: 'وصف الأصل',
      bodyEn: [
        `Type: ${v.vehicleType}. Make & Model: ${v.vehicleMakeModel}. Year of Manufacture: ${v.vehicleYear}. Chassis No.: ${v.chassisNo}. Engine No.: ${v.engineNo}. Plate No.: ${v.plateNo}.`,
        'The Parties agree to jointly acquire the Asset described above.',
      ],
      bodyAr: [
        `النوع: ${v.vehicleType}. الصنع والطراز: ${v.vehicleMakeModel}. سنة الصنع: ${v.vehicleYear}. رقم الشassis: ${v.chassisNo}. رقم المحرك: ${v.engineNo}. رقم اللوحة: ${v.plateNo}.`,
        'يتفق الطرفان على الاقتناء المشترك للأصل الموضّح بياناته أعلاه.',
      ],
    },
    {
      number: '5',
      titleEn: 'Capital Contributions and Ownership Shares',
      titleAr: 'المساهمات الرأسمالية وحصص الملكية',
      bodyEn: [
        `The total purchase price of the Asset is QAR ${v.totalPrice}. BloX — First Party: QAR ${v.bloxContribution} (${v.bloxPct}). Customer — Second Party: QAR ${v.customerContribution} (${v.customerPct}). Total: 100%.`,
        'The Asset shall be registered in the name of the First Party (or jointly, as required by applicable registration rules) as nominee and trustee for the joint ownership, without prejudice to the actual beneficial ownership shares stated above.',
      ],
      bodyAr: [
        `يبلغ إجمالي سعر شراء الأصل ${v.totalPrice} ريال قطري. بلوكس — الطرف الأول: ${v.bloxContribution} ريال (${v.bloxPct}). العميل — الطرف الثاني: ${v.customerContribution} ريال (${v.customerPct}). الإجمالي: 100%.`,
        'يُسجَّل الأصل باسم الطرف الأول (أو بشكل مشترك وفقاً لقواعد التسجيل المعمول بها) بصفته مرشحاً وأميناً للملكية المشتركة، دون الإخلال بحصص الملكية المنفعة الفعلية المذكورة أعلاه.',
      ],
    },
    {
      number: '6',
      titleEn: 'Lease (Ijarah) Subcontract',
      titleAr: 'عقد الإجارة الفرعي',
      bodyEn: [
        `Simultaneously with the execution of this Agreement, the First Party shall lease its undivided share in the Asset to the Second Party under a separate Ijarah Agreement, granting the Second Party the exclusive right to use the entire Asset during the lease period. The rent payable under the Ijarah Agreement shall be a fair market rental rate reflecting the First Party's ownership share at each period (${v.annualRate} per annum on the declining BloX share), in accordance with AAOIFI Shariah Standard No. 9.`,
      ],
      bodyAr: [
        `بالتزامن مع إبرام هذا العقد، يقوم الطرف الأول بتأجير حصته الشائعة في الأصل للطرف الثاني بموجب عقد إجارة منفصل، مما يمنح الطرف الثاني الحق الحصري في استخدام الأصل بالكامل خلال فترة الإجارة. تكون الأجرة المستحقة بسعر إيجار السوق العادل الذي يعكس حصة ملكية الطرف الأول في كل فترة (${v.annualRate} سنوياً على الحصة المتناقصة لبلوكس)، وفقاً للمعيار الشرعي رقم 9 للأيوفي.`,
      ],
    },
    {
      number: '7',
      titleEn: 'Diminishing Musharakah Mechanism',
      titleAr: 'آلية المشاركة المتناقصة',
      bodyEn: [
        `7.1 Unit Structure: The First Party's ownership share is divided into ${v.numberOfUnits} equal units, each with a face value of QAR ${v.unitValue}. The Second Party shall acquire these units periodically pursuant to a separate unilateral Promise to Purchase (Wa'd) executed concurrently with this Agreement.`,
        '7.2 Unit Sale Mechanism: Each sale of a unit shall be executed by a separate offer and acceptance at the time of sale, at a price that may be the market value, the agreed value, or the face value, as agreed between the Parties at the time of each transaction, in compliance with AAOIFI Shariah Standard No. 12, Clause 5/2. A bilateral binding forward sale (Muwa\'adah) is expressly prohibited.',
        '7.3 Rental Adjustment: Upon the Second Party acquiring each unit, the Second Party\'s ownership share increases and the First Party\'s share decreases proportionally. The monthly rent payable under the Ijarah Agreement shall be adjusted downwards at the commencement of each new period to reflect the First Party\'s reduced ownership share, ensuring that rent is never cross-subsidised with the equity purchase price.',
      ],
      bodyAr: [
        `7.1 هيكل الوحدات: تُقسَّم حصة ملكية الطرف الأول إلى ${v.numberOfUnits} وحدة متساوية، قيمة كل منها ${v.unitValue} ريال قطري بالقيمة الاسمية. يقوم الطرف الثاني بالاستحواذ على هذه الوحدات بشكل دوري بموجب وعد شراء أحادي (وعد) منفصل يُبرم بالتزامن مع هذا العقد.`,
        '7.2 آلية بيع الوحدات: يُنفَّذ كل بيع وحدة بموجب إيجاب وقبول منفصلين في وقت البيع، بسعر قد يكون القيمة السوقية أو القيمة المتفق عليها أو القيمة الاسمية، حسبما يتفق عليه الطرفان في وقت كل معاملة، بما يتوافق مع المعيار الشرعي رقم 12 للأيوفي، البند 5/2. ويُحظر صراحةً البيع الآجل الملزم الثنائي (المواعدة).',
        '7.3 تعديل الأجرة: عند استحواذ الطرف الثاني على كل وحدة، تزداد حصة ملكية الطرف الثاني وتنخفض حصة الطرف الأول بشكل متناسب. يُعدَّل الإيجار الشهري المستحق بموجب عقد الإجارة بالانخفاض في بداية كل فترة جديدة ليعكس انخفاض حصة ملكية الطرف الأول، مع ضمان عدم الإعانة المتبادلة بين الإيجار وسعر شراء الحصة.',
      ],
    },
    {
      number: '8',
      titleEn: 'Maintenance and Takaful Insurance',
      titleAr: 'الصيانة والتأمين التكافلي',
      bodyEn: [
        'Major structural maintenance and the cost of comprehensive Takaful (Islamic insurance) shall be borne by the Parties in proportion to their respective ownership shares at the time the cost is incurred, as this is an ownership-related obligation. The Second Party, as the sole user of the Asset, shall bear all routine, operational, and day-to-day maintenance costs, as these are usage-related obligations.',
        "The First Party shall have the sole and exclusive right to select, procure, and maintain the Takaful policy covering the Asset, from a Takaful provider approved by the First Party and, where applicable, by the Shariah Supervisory Board. The Second Party shall not independently procure, substitute, cancel, or allow to lapse any insurance or Takaful coverage over the Asset without the First Party's prior written consent.",
      ],
      bodyAr: [
        'تُتحمَّل تكاليف الصيانة الهيكلية الأساسية وتكاليف التكافل (التأمين الإسلامي) الشامل من قِبل الطرفين بنسبة حصص ملكيتهما في وقت تكبد التكلفة، باعتبارها التزامات مرتبطة بالملكية. يتحمل الطرف الثاني، بصفته المستخدم الوحيد للأصل، جميع تكاليف الصيانة الدورية والتشغيلية واليومية، باعتبارها التزامات مرتبطة بالاستخدام.',
        'يتمتع الطرف الأول بالحق الحصري والوحيد في اختيار وثيقة التكافل التي تغطي الأصل والحصول عليها والمحافظة عليها، من مزوّد تكافل تعتمده الطرف الأول، وعند الاقتضاء، تعتمده هيئة الرقابة الشرعية. لا يجوز للطرف الثاني أن يحصل بشكل مستقل على أي تغطية تأمينية أو تكافلية بديلة على الأصل أو يستبدلها أو يلغيها أو يسمح بسقوطها، دون موافقة خطية مسبقة من الطرف الأول.',
      ],
    },
    {
      number: '9',
      titleEn: 'Loss or Total Destruction of the Asset',
      titleAr: 'هلاك الأصل أو تلفه الكلي',
      bodyEn: [
        "If the Asset is totally destroyed or lost without negligence or wilful misconduct by the Second Party, this Musharakah shall terminate. Any Takaful compensation received shall be distributed between the Parties according to their respective ownership shares on the date of destruction. If the destruction is caused by the Second Party's negligence or wilful misconduct, the Second Party shall be liable to compensate the First Party for the First Party's proportionate loss.",
      ],
      bodyAr: [
        'إذا هلك الأصل كلياً أو ضاع دون إهمال أو تعدٍّ متعمد من الطرف الثاني، تنتهي هذه المشاركة. يُوزَّع أي تعويض تكافلي مستلم بين الطرفين وفقاً لحصص ملكيتهما في تاريخ الهلاك. إذا كان الهلاك ناجماً عن إهمال الطرف الثاني أو تعديه المتعمد، يكون الطرف الثاني مسؤولاً عن تعويض الطرف الأول عن خسارته النسبية.',
      ],
    },
    {
      number: '10',
      titleEn: 'Representations and Warranties',
      titleAr: 'الإقرارات والضمانات',
      bodyEn: [
        'Each Party represents and warrants to the other that: (a) it has full legal capacity and authority to enter into this Agreement; (b) this Agreement constitutes a legal, valid, and binding obligation enforceable against it; (c) the execution of this Agreement does not violate any applicable law, regulation, or agreement to which it is a party; and (d) all information provided to the other Party in connection with this Agreement is true, accurate, and complete.',
      ],
      bodyAr: [
        'يُقرّر كل طرف للطرف الآخر ويضمن له ما يلي: (أ) يتمتع بالأهلية القانونية الكاملة والصلاحية اللازمة لإبرام هذا العقد؛ (ب) يُشكّل هذا العقد التزاماً قانونياً صحيحاً وملزماً وقابلاً للتنفيذ في مواجهته؛ (ج) لا يُخالف إبرام هذا العقد أي قانون أو لائحة معمول بها أو أي اتفاقية يكون طرفاً فيها؛ (د) جميع المعلومات المقدمة للطرف الآخر فيما يتعلق بهذا العقد صحيحة ودقيقة وكاملة.',
      ],
    },
    {
      number: '11',
      titleEn: 'Events of Default and Remedies',
      titleAr: 'حالات الإخلال والحلول',
      bodyEn: [
        `11.1 An Event of Default shall occur if: (a) the Second Party fails to pay rent under the Ijarah Agreement for more than ${v.rentDefaultDays} days after the due date; (b) the Second Party uses the Asset for any unlawful or Shariah-non-compliant purpose; (c) the Second Party attempts to transfer, encumber, or dispose of the Asset without the First Party's prior written consent; or (d) the Second Party becomes insolvent or subject to bankruptcy proceedings.`,
        `11.2 Upon an Event of Default, the First Party may, after giving ${v.defaultNoticeDays} days' written notice, terminate the Ijarah Agreement and require the Second Party to vacate and return the Asset. The First Party may also exercise any other remedies available under applicable Qatar law, including the remedies set out in Clause 12 (Late Payment Compensation).`,
        `11.3 Sale of the Asset and Distribution of Proceeds: (a) Where an Event of Default has occurred and has not been remedied within the cure period set out in Clause 11.2, the Parties shall procure the sale of the Asset to a third party at fair market value. The Second Party may, within ${v.saleProcureDays} days of the notice of enforcement, procure such a sale itself at a price approved by the First Party. (b) The Second Party hereby irrevocably appoints the First Party as its agent (Wakil) to sell the Second Party's undivided ownership share in the Asset. (c) Net proceeds shall be applied in order: sale costs; First Party ownership share; unpaid rent; Ta'widh if due; balance to Second Party. (d) The First Party's entitlement is limited to the value of its ownership share as at the date of sale.`,
      ],
      bodyAr: [
        `11.1 تقع حالة الإخلال إذا: (أ) تخلف الطرف الثاني عن دفع الأجرة لأكثر من ${v.rentDefaultDays} يوماً بعد تاريخ الاستحقاق؛ (ب) استخدم الأصل لغرض غير مشروع أو غير متوافق مع الشريعة؛ (ج) حاول نقل الأصل أو تحميله أو التصرف فيه دون موافقة خطية مسبقة؛ (د) أصبح معسراً أو خضع لإجراءات الإفلاس.`,
        `11.2 عند وقوع حالة الإخلال، يجوز للطرف الأول، بعد إشعار خطي مدته ${v.defaultNoticeDays} يوماً، إنهاء عقد الإجارة وطلب إعادة الأصل. يجوز للطرف الأول أيضاً ممارسة أي حلول أخرى بموجب قانون قطر، بما في ذلك البند 12 (تعويض التأخير).`,
        `11.3 بيع الأصل وتوزيع العائدات: (أ) في حال وقوع إخلال ولم يُعالج خلال مهلة المعالجة، يلتزم الطرفان بترتيب البيع لطرف ثالث بالقيمة السوقية العادلة. (ب) يُوكِّل الطرف الثاني الطرف الأول توكيلاً غير قابل للإلغاء لبيع حصته. (ج) تُطبَّق العائدات الصافية بالترتيب: تكاليف البيع؛ حصة الطرف الأول؛ الأجرة المستحقة؛ التعويض إن وجد؛ الرصيد للطرف الثاني.`,
      ],
    },
    {
      number: '12',
      titleEn: "Late Payment Compensation (Ta'widh)",
      titleAr: 'تعويض التأخير (التعويض)',
      bodyEn: [
        `If the Second Party fails to pay any amount due under the Ijarah Agreement on its due date, the Second Party shall pay to the First Party a late payment charge of QAR ${v.latePaymentDaily} per day of delay, calculated from the due date until the date of actual payment, by way of compensation (Ta'widh) for loss actually and directly suffered by the First Party, and not as a penalty, and not as interest (Riba). The full amount collected under this Clause, less the First Party's actual, documented costs of collection, shall be donated to a charitable cause approved by the Shariah Supervisory Board, in accordance with AAOIFI Shariah Standard No. 3.`,
        "This Clause shall not apply where the delay in payment results from the Second Party's genuine financial hardship rather than procrastination in payment while able to pay.",
      ],
      bodyAr: [
        `إذا تخلف الطرف الثاني عن سداد أي مبلغ مستحق في تاريخ استحقاقه، يدفع للطرف الأول رسم تأخير قدره ${v.latePaymentDaily} ريال قطري عن كل يوم تأخير، وذلك على سبيل التعويض عن الضرر الفعلي والمباشر، وليس على سبيل الغرامة، وليس رباً. يُتبرَّع بكامل المبلغ المحصَّل، بعد خصم تكاليف التحصيل الفعلية، لجهة خيرية تعتمدها هيئة الرقابة الشرعية، وفقاً للمعيار الشرعي رقم 3 للأيوفي.`,
        'لا يسري هذا البند إذا كان التأخير ناجماً عن عسر مالي حقيقي للطرف الثاني وليس مماطلة مع القدرة على السداد.',
      ],
    },
    {
      number: '13',
      titleEn: 'Force Majeure',
      titleAr: 'القوة القاهرة',
      bodyEn: [
        'Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement (other than payment obligations already due at the time the Force Majeure Event begins) to the extent that such failure or delay results from a Force Majeure Event.',
        `"Force Majeure Event" means any event beyond the reasonable control of the affected Party, including natural disaster, war, civil unrest, act of government or public authority, epidemic or pandemic, or a general and material failure of utilities or telecommunications infrastructure in the State of Qatar. The Party affected shall notify the other Party in writing within ${v.forceMajeureNoticeDays} days. If a Force Majeure Event continues for more than ${v.forceMajeureMaxDays} consecutive days, either Party may terminate this Agreement by written notice.`,
      ],
      bodyAr: [
        'لا يكون أي طرف مسؤولاً عن أي إخفاق أو تأخير في تنفيذ التزاماته (باستثناء التزامات الدفع المستحقة بالفعل عند بدء حدث القوة القاهرة) بالقدر الذي ينجم فيه هذا الإخفاق أو التأخير عن حدث قوة قاهرة.',
        `يُقصد بـ "حدث القوة القاهرة" أي حدث خارج عن السيطرة المعقولة للطرف المتأثر. يُخطر الطرف المتأثر الطرف الآخر خطياً خلال ${v.forceMajeureNoticeDays} يوماً. إذا استمر الحدث لأكثر من ${v.forceMajeureMaxDays} يوماً متتالياً، يجوز لأي من الطرفين إنهاء هذا العقد بإشعار خطي.`,
      ],
    },
    {
      number: '14',
      titleEn: 'Assignment and Transfer',
      titleAr: 'التنازل والنقل',
      bodyEn: [
        "The First Party may, at its discretion and without requiring the consent of the Second Party, assign, transfer, sell, participate, or otherwise dispose of the whole or any part of its rights, benefits, and obligations under this Agreement to any bank, financial institution, special purpose vehicle, or other third party, provided that any such assignment shall not adversely affect the Second Party's rights under this Agreement.",
        "The Second Party shall not assign, transfer, or otherwise deal with its rights or obligations under this Agreement without the prior written consent of the First Party.",
      ],
      bodyAr: [
        'يجوز للطرف الأول، وفقاً لتقديره ودون الحاجة إلى موافقة الطرف الثاني، أن يتنازل عن حقوقه والتزاماته بموجب هذا العقد أو ينقلها إلى أي بنك أو مؤسسة مالية أو طرف ثالث، شريطة ألا يؤثر هذا التنازل سلباً على حقوق الطرف الثاني.',
        'لا يجوز للطرف الثاني التنازل عن حقوقه أو التزاماته أو نقلها دون موافقة خطية مسبقة من الطرف الأول.',
      ],
    },
    {
      number: '15',
      titleEn: 'Electronic Execution and Digital Platform',
      titleAr: 'التنفيذ الإلكتروني والمنصة الرقمية',
      bodyEn: [
        'The Parties agree that this Agreement, and any related notice, consent, offer, acceptance, or instruction, may be executed, given, or communicated by electronic means, including through the BloX digital platform, electronic signature, or authenticated electronic acceptance, and that such electronic execution or communication shall have the same legal effect and enforceability as a handwritten signature or physical delivery, in accordance with Law No. (16) of 2010 (the Electronic Commerce and Transactions Law) of the State of Qatar.',
      ],
      bodyAr: [
        'يتفق الطرفان على أنه يجوز إبرام هذا العقد، وتقديم أو توصيل أي إخطار أو موافقة أو عرض أو قبول أو تعليمات متعلقة به، بالوسائل الإلكترونية، بما في ذلك عبر المنصة الرقمية لبلوكس أو التوقيع الإلكتروني أو القبول الإلكتروني الموثَّق، وفقاً للقانون رقم (16) لسنة 2010 (قانون المعاملات والتجارة الإلكترونية) لدولة قطر.',
      ],
    },
    {
      number: '16',
      titleEn: 'Data Protection',
      titleAr: 'حماية البيانات',
      bodyEn: [
        "In connection with this Agreement, the First Party may collect, process, store, and use the Second Party's personal data for purposes including underwriting, contract administration, payment collection, regulatory reporting, and fraud prevention. The First Party shall process such personal data in accordance with the PDPPL and any regulations issued thereunder.",
        'The Second Party consents to the processing of their personal data for the purposes described above and, where required, to the sharing of such data with QCB, licensed credit bureaus, Takaful providers, and professional advisors engaged by the First Party.',
      ],
      bodyAr: [
        'فيما يتعلق بهذا العقد، يجوز للطرف الأول جمع بيانات الطرف الثاني الشخصية ومعالجتها وتخزينها واستخدامها لأغراض تشمل التحقق الائتماني وإدارة العقد وتحصيل المدفوعات والإبلاغ التنظيمي ومنع الاحتيال. يعالج الطرف الأول هذه البيانات وفقاً لقانون حماية الخصوصية.',
        'يوافق الطرف الثاني على معالجة بياناته الشخصية للأغراض الموضحة أعلاه، وعلى مشاركة هذه البيانات، عند اللزوم، مع مصرف قطر المركزي ومكاتب الائتمان المرخصة ومزوّدي التكافل والمستشارين المهنيين.',
      ],
    },
    {
      number: '17',
      titleEn: 'Shariah Compliance',
      titleAr: 'الامتثال للشريعة الإسلامية',
      bodyEn: [
        'This Agreement and all transactions contemplated herein are intended to comply with the principles of Islamic Shariah, including the prohibition of Riba (interest), Gharar (excessive uncertainty), and Maysir (speculation). This Agreement shall be interpreted and performed in a manner consistent with the rulings of the Shariah Supervisory Board of BloX and the standards issued by AAOIFI. In the event of any conflict between the terms of this Agreement and Shariah principles, the Shariah principles shall prevail.',
      ],
      bodyAr: [
        'يُقصد من هذا العقد وجميع المعاملات المتصورة فيه الامتثال لمبادئ الشريعة الإسلامية، بما في ذلك تحريم الربا والغرر والميسر. يُفسَّر هذا العقد ويُنفَّذ بما يتوافق مع أحكام هيئة الرقابة الشرعية لبلوكس والمعايير الصادرة عن الأيوفي. في حال وجود أي تعارض بين شروط هذا العقد ومبادئ الشريعة الإسلامية، تسود مبادئ الشريعة الإسلامية.',
      ],
    },
    {
      number: '18',
      titleEn: 'Governing Law and Dispute Resolution',
      titleAr: 'القانون الواجب التطبيق وتسوية النزاعات',
      bodyEn: [
        'This Agreement shall be governed by and construed in accordance with Law No. (22) of 2004 (Qatar Civil Code) and all other applicable laws of the State of Qatar, to the extent they do not conflict with the principles of Islamic Shariah.',
        `The Parties shall first attempt to resolve any dispute amicably through good-faith negotiation for a period of ${v.disputeDays} days from written notice of the dispute. If the dispute is not resolved within that period, either Party may elect to refer the dispute to final and binding arbitration administered by QICCA in Doha, or to the competent courts of the State of Qatar.`,
      ],
      bodyAr: [
        'يخضع هذا العقد ويُفسَّر وفقاً للقانون رقم (22) لسنة 2004 (القانون المدني القطري) وجميع القوانين الأخرى المعمول بها في دولة قطر، بالقدر الذي لا يتعارض فيه مع مبادئ الشريعة الإسلامية.',
        `يسعى الطرفان أولاً إلى تسوية أي نزاع ودياً من خلال مفاوضات بحسن نية لمدة ${v.disputeDays} يوماً. إذا لم تتم التسوية خلال تلك المدة، يجوز إحالة النزاع إلى التحكيم النهائي والملزم الذي يديره QICCA في الدوحة، أو إلى المحاكم المختصة في دولة قطر.`,
      ],
    },
    {
      number: '19',
      titleEn: 'Language',
      titleAr: 'اللغة',
      bodyEn: [
        'This Agreement is executed in both Arabic and English. Both texts are equally authentic. In the event of any discrepancy or conflict between the two texts, the Arabic text shall prevail, in accordance with applicable Qatar law.',
      ],
      bodyAr: [
        'أُبرم هذا العقد باللغتين العربية والإنجليزية. كلا النصين متساويان في الحجية. في حال وجود أي تعارض أو اختلاف بين النصين، يُعتمد النص العربي، وفقاً لقانون قطر المعمول به.',
      ],
    },
    {
      number: '20',
      titleEn: 'Entire Agreement and Amendments',
      titleAr: 'العقد الكامل والتعديلات',
      bodyEn: [
        "This Agreement, together with the Ijarah Agreement, the Promise to Purchase (Wa'd), and all annexes hereto, constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior negotiations, representations, and agreements. No amendment to this Agreement shall be valid unless made in writing and signed by both Parties.",
      ],
      bodyAr: [
        'يُشكّل هذا العقد، إلى جانب عقد الإجارة ووعد الشراء (الوعد) وجميع الملاحق المرفقة به، الاتفاقية الكاملة بين الطرفين فيما يتعلق بموضوعه. لا يكون أي تعديل على هذا العقد صحيحاً ما لم يكن خطياً وموقعاً من كلا الطرفين.',
      ],
    },
    {
      number: '21',
      titleEn: 'Notices',
      titleAr: 'الإخطارات',
      bodyEn: [
        'All notices under this Agreement shall be in writing and delivered by hand, registered mail, or email (with read receipt) to the addresses set out in the Parties section above. Notices shall be deemed received: (a) immediately upon hand delivery; (b) five (5) business days after posting by registered mail; or (c) upon confirmed receipt by email.',
      ],
      bodyAr: [
        'تكون جميع الإخطارات بموجب هذا العقد خطية وتُسلَّم يداً بيد أو بالبريد المسجل أو بالبريد الإلكتروني (مع إيصال القراءة) إلى العناوين المذكورة في قسم الأطراف أعلاه. تُعدّ الإخطارات مستلمة: (أ) فور التسليم يداً بيد؛ (ب) بعد خمسة (5) أيام عمل من الإيداع بالبريد المسجل؛ (ج) عند تأكيد الاستلام بالبريد الإلكتروني.',
      ],
    },
    {
      number: '22',
      titleEn: 'Signatures',
      titleAr: 'التوقيعات',
      bodyEn: [
        'IN WITNESS WHEREOF the Parties have executed this Agreement on the date first written above.',
      ],
      bodyAr: ['وإثباتاً لما تقدم، قام الطرفان بتوقيع هذا العقد في التاريخ المذكور أعلاه.'],
    },
  ];
}
