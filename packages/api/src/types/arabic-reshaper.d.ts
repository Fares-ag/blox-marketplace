declare module 'arabic-reshaper' {
  /** Convert Arabic text to positional presentation forms for engines without shaping. */
  export function convertArabic(text: string): string;
  /** Reverse the presentation-form conversion. */
  export function convertArabicBack(text: string): string;
  const _default: { convertArabic: typeof convertArabic; convertArabicBack: typeof convertArabicBack };
  export default _default;
}
