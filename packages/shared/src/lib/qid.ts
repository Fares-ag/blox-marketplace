/**
 * Qatar ID (QID) helpers.
 *
 * A QID is 11 digits: C YY NNN SSSSS
 *   C    — century of birth (2 = 1900s, 3 = 2000s)
 *   YY   — last two digits of the birth year
 *   NNN  — ISO 3166-1 numeric code of the holder's nationality (634 = Qatar)
 *   SSSSS— serial
 *
 * We use it to derive nationality and to cross-check the date of birth the
 * customer types; we never treat it as proof of identity — that is KYC's job.
 */
import type { ResidencyClass } from './product-rules';

export const QID_LENGTH = 11;
export const QATAR_NUMERIC_CODE = '634';

/** ISO 3166-1 numeric → English country name for the nationalities we commonly see. */
export const ISO_NUMERIC_COUNTRIES: Record<string, { en: string; ar: string; alpha2: string }> = {
  '634': { en: 'Qatar', ar: 'قطر', alpha2: 'QA' },
  '004': { en: 'Afghanistan', ar: 'أفغانستان', alpha2: 'AF' },
  '008': { en: 'Albania', ar: 'ألبانيا', alpha2: 'AL' },
  '012': { en: 'Algeria', ar: 'الجزائر', alpha2: 'DZ' },
  '024': { en: 'Angola', ar: 'أنغولا', alpha2: 'AO' },
  '031': { en: 'Azerbaijan', ar: 'أذربيجان', alpha2: 'AZ' },
  '032': { en: 'Argentina', ar: 'الأرجنتين', alpha2: 'AR' },
  '036': { en: 'Australia', ar: 'أستراليا', alpha2: 'AU' },
  '040': { en: 'Austria', ar: 'النمسا', alpha2: 'AT' },
  '048': { en: 'Bahrain', ar: 'البحرين', alpha2: 'BH' },
  '050': { en: 'Bangladesh', ar: 'بنغلاديش', alpha2: 'BD' },
  '056': { en: 'Belgium', ar: 'بلجيكا', alpha2: 'BE' },
  '070': { en: 'Bosnia and Herzegovina', ar: 'البوسنة والهرسك', alpha2: 'BA' },
  '072': { en: 'Botswana', ar: 'بوتسوانا', alpha2: 'BW' },
  '076': { en: 'Brazil', ar: 'البرازيل', alpha2: 'BR' },
  '104': { en: 'Myanmar', ar: 'ميانمار', alpha2: 'MM' },
  '108': { en: 'Burundi', ar: 'بوروندي', alpha2: 'BI' },
  '112': { en: 'Belarus', ar: 'بيلاروسيا', alpha2: 'BY' },
  '120': { en: 'Cameroon', ar: 'الكاميرون', alpha2: 'CM' },
  '124': { en: 'Canada', ar: 'كندا', alpha2: 'CA' },
  '144': { en: 'Sri Lanka', ar: 'سريلانكا', alpha2: 'LK' },
  '148': { en: 'Chad', ar: 'تشاد', alpha2: 'TD' },
  '152': { en: 'Chile', ar: 'تشيلي', alpha2: 'CL' },
  '156': { en: 'China', ar: 'الصين', alpha2: 'CN' },
  '170': { en: 'Colombia', ar: 'كولومبيا', alpha2: 'CO' },
  '174': { en: 'Comoros', ar: 'جزر القمر', alpha2: 'KM' },
  '180': { en: 'DR Congo', ar: 'جمهورية الكونغو الديمقراطية', alpha2: 'CD' },
  '192': { en: 'Cuba', ar: 'كوبا', alpha2: 'CU' },
  '203': { en: 'Czechia', ar: 'التشيك', alpha2: 'CZ' },
  '208': { en: 'Denmark', ar: 'الدنمارك', alpha2: 'DK' },
  '231': { en: 'Ethiopia', ar: 'إثيوبيا', alpha2: 'ET' },
  '232': { en: 'Eritrea', ar: 'إريتريا', alpha2: 'ER' },
  '246': { en: 'Finland', ar: 'فنلندا', alpha2: 'FI' },
  '250': { en: 'France', ar: 'فرنسا', alpha2: 'FR' },
  '262': { en: 'Djibouti', ar: 'جيبوتي', alpha2: 'DJ' },
  '268': { en: 'Georgia', ar: 'جورجيا', alpha2: 'GE' },
  '275': { en: 'Palestine', ar: 'فلسطين', alpha2: 'PS' },
  '276': { en: 'Germany', ar: 'ألمانيا', alpha2: 'DE' },
  '288': { en: 'Ghana', ar: 'غانا', alpha2: 'GH' },
  '300': { en: 'Greece', ar: 'اليونان', alpha2: 'GR' },
  '344': { en: 'Hong Kong', ar: 'هونغ كونغ', alpha2: 'HK' },
  '348': { en: 'Hungary', ar: 'المجر', alpha2: 'HU' },
  '356': { en: 'India', ar: 'الهند', alpha2: 'IN' },
  '360': { en: 'Indonesia', ar: 'إندونيسيا', alpha2: 'ID' },
  '364': { en: 'Iran', ar: 'إيران', alpha2: 'IR' },
  '368': { en: 'Iraq', ar: 'العراق', alpha2: 'IQ' },
  '372': { en: 'Ireland', ar: 'أيرلندا', alpha2: 'IE' },
  '380': { en: 'Italy', ar: 'إيطاليا', alpha2: 'IT' },
  '392': { en: 'Japan', ar: 'اليابان', alpha2: 'JP' },
  '398': { en: 'Kazakhstan', ar: 'كازاخستان', alpha2: 'KZ' },
  '400': { en: 'Jordan', ar: 'الأردن', alpha2: 'JO' },
  '404': { en: 'Kenya', ar: 'كينيا', alpha2: 'KE' },
  '410': { en: 'South Korea', ar: 'كوريا الجنوبية', alpha2: 'KR' },
  '414': { en: 'Kuwait', ar: 'الكويت', alpha2: 'KW' },
  '417': { en: 'Kyrgyzstan', ar: 'قرغيزستان', alpha2: 'KG' },
  '422': { en: 'Lebanon', ar: 'لبنان', alpha2: 'LB' },
  '434': { en: 'Libya', ar: 'ليبيا', alpha2: 'LY' },
  '450': { en: 'Madagascar', ar: 'مدغشقر', alpha2: 'MG' },
  '454': { en: 'Malawi', ar: 'مالاوي', alpha2: 'MW' },
  '458': { en: 'Malaysia', ar: 'ماليزيا', alpha2: 'MY' },
  '466': { en: 'Mali', ar: 'مالي', alpha2: 'ML' },
  '478': { en: 'Mauritania', ar: 'موريتانيا', alpha2: 'MR' },
  '480': { en: 'Mauritius', ar: 'موريشيوس', alpha2: 'MU' },
  '484': { en: 'Mexico', ar: 'المكسيك', alpha2: 'MX' },
  '504': { en: 'Morocco', ar: 'المغرب', alpha2: 'MA' },
  '508': { en: 'Mozambique', ar: 'موزمبيق', alpha2: 'MZ' },
  '512': { en: 'Oman', ar: 'عُمان', alpha2: 'OM' },
  '516': { en: 'Namibia', ar: 'ناميبيا', alpha2: 'NA' },
  '524': { en: 'Nepal', ar: 'نيبال', alpha2: 'NP' },
  '528': { en: 'Netherlands', ar: 'هولندا', alpha2: 'NL' },
  '554': { en: 'New Zealand', ar: 'نيوزيلندا', alpha2: 'NZ' },
  '562': { en: 'Niger', ar: 'النيجر', alpha2: 'NE' },
  '566': { en: 'Nigeria', ar: 'نيجيريا', alpha2: 'NG' },
  '578': { en: 'Norway', ar: 'النرويج', alpha2: 'NO' },
  '586': { en: 'Pakistan', ar: 'باكستان', alpha2: 'PK' },
  '604': { en: 'Peru', ar: 'بيرو', alpha2: 'PE' },
  '608': { en: 'Philippines', ar: 'الفلبين', alpha2: 'PH' },
  '616': { en: 'Poland', ar: 'بولندا', alpha2: 'PL' },
  '620': { en: 'Portugal', ar: 'البرتغال', alpha2: 'PT' },
  '642': { en: 'Romania', ar: 'رومانيا', alpha2: 'RO' },
  '643': { en: 'Russia', ar: 'روسيا', alpha2: 'RU' },
  '646': { en: 'Rwanda', ar: 'رواندا', alpha2: 'RW' },
  '682': { en: 'Saudi Arabia', ar: 'السعودية', alpha2: 'SA' },
  '686': { en: 'Senegal', ar: 'السنغال', alpha2: 'SN' },
  '688': { en: 'Serbia', ar: 'صربيا', alpha2: 'RS' },
  '702': { en: 'Singapore', ar: 'سنغافورة', alpha2: 'SG' },
  '704': { en: 'Vietnam', ar: 'فيتنام', alpha2: 'VN' },
  '706': { en: 'Somalia', ar: 'الصومال', alpha2: 'SO' },
  '710': { en: 'South Africa', ar: 'جنوب أفريقيا', alpha2: 'ZA' },
  '716': { en: 'Zimbabwe', ar: 'زيمبابوي', alpha2: 'ZW' },
  '724': { en: 'Spain', ar: 'إسبانيا', alpha2: 'ES' },
  '729': { en: 'Sudan', ar: 'السودان', alpha2: 'SD' },
  '752': { en: 'Sweden', ar: 'السويد', alpha2: 'SE' },
  '756': { en: 'Switzerland', ar: 'سويسرا', alpha2: 'CH' },
  '760': { en: 'Syria', ar: 'سوريا', alpha2: 'SY' },
  '762': { en: 'Tajikistan', ar: 'طاجيكستان', alpha2: 'TJ' },
  '764': { en: 'Thailand', ar: 'تايلاند', alpha2: 'TH' },
  '784': { en: 'United Arab Emirates', ar: 'الإمارات', alpha2: 'AE' },
  '788': { en: 'Tunisia', ar: 'تونس', alpha2: 'TN' },
  '792': { en: 'Türkiye', ar: 'تركيا', alpha2: 'TR' },
  '800': { en: 'Uganda', ar: 'أوغندا', alpha2: 'UG' },
  '804': { en: 'Ukraine', ar: 'أوكرانيا', alpha2: 'UA' },
  '818': { en: 'Egypt', ar: 'مصر', alpha2: 'EG' },
  '826': { en: 'United Kingdom', ar: 'المملكة المتحدة', alpha2: 'GB' },
  '834': { en: 'Tanzania', ar: 'تنزانيا', alpha2: 'TZ' },
  '840': { en: 'United States', ar: 'الولايات المتحدة', alpha2: 'US' },
  '860': { en: 'Uzbekistan', ar: 'أوزبكستان', alpha2: 'UZ' },
  '862': { en: 'Venezuela', ar: 'فنزويلا', alpha2: 'VE' },
  '887': { en: 'Yemen', ar: 'اليمن', alpha2: 'YE' },
  '894': { en: 'Zambia', ar: 'زامبيا', alpha2: 'ZM' },
};

export type ParsedQid = {
  valid: boolean;
  /** Normalised 11-digit string (digits only) when valid. */
  qid: string | null;
  birthYear: number | null;
  nationalityCode: string | null;
  nationality: { en: string; ar: string; alpha2: string } | null;
  residency: ResidencyClass | null;
  reason?: 'length' | 'digits' | 'century' | 'year';
};

export function normalizeQid(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export function parseQid(raw: string | null | undefined, now: Date = new Date()): ParsedQid {
  const digits = String(raw ?? '').trim();
  const invalid = (reason: ParsedQid['reason']): ParsedQid => ({
    valid: false,
    qid: null,
    birthYear: null,
    nationalityCode: null,
    nationality: null,
    residency: null,
    reason,
  });
  if (!/^\d+$/.test(digits)) return invalid('digits');
  if (digits.length !== QID_LENGTH) return invalid('length');

  const century = digits[0];
  const centuryBase = century === '2' ? 1900 : century === '3' ? 2000 : century === '4' ? 2100 : null;
  if (centuryBase == null) return invalid('century');
  const birthYear = centuryBase + Number(digits.slice(1, 3));
  if (birthYear > now.getFullYear() || birthYear < 1900) return invalid('year');

  const nationalityCode = digits.slice(3, 6);
  const nationality = ISO_NUMERIC_COUNTRIES[nationalityCode] ?? null;
  return {
    valid: true,
    qid: digits,
    birthYear,
    nationalityCode,
    nationality,
    residency: nationalityCode === QATAR_NUMERIC_CODE ? 'qatari' : 'expat',
  };
}

/**
 * `YYYY-MM-DD`, optionally carrying a time part so API timestamps parse too.
 * Anchoring both ends is what makes the year exactly four digits: reading the
 * first four characters of "20001-05-12" used to yield 2000 and match.
 */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;

/** Calendar-real ISO date, or null. Rejects "2001-02-30" and "1990-13-01". */
export function parseIsoDateParts(value: string | null | undefined): { year: number; month: number; day: number } | null {
  const m = ISO_DATE_RE.exec(String(value ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return { year, month, day };
}

/**
 * True when the typed date of birth agrees with the birth year encoded in the
 * QID. `null` means "cannot tell" (no date, or no readable QID year); a date
 * that is present but not a real ISO date is a mismatch, not an unknown, so a
 * malformed year cannot slip through the gate unchallenged.
 */
export function dateOfBirthMatchesQid(dateOfBirth: string | null | undefined, qid: string | null | undefined): boolean | null {
  if (!dateOfBirth) return null;
  const parsed = parseQid(qid);
  if (!parsed.valid || parsed.birthYear == null) return null;
  const date = parseIsoDateParts(dateOfBirth);
  if (!date) return false;
  return date.year === parsed.birthYear;
}

/** Age today, from an ISO date string. Null when the date is missing or invalid. */
export function ageFromDateOfBirth(dateOfBirth: string | null | undefined, now: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}
