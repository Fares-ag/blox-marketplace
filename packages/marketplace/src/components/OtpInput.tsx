import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

export const OTP_LENGTH = 6;

/**
 * Six single-digit boxes for a one-time code: paste and autofill spread across
 * the boxes, Backspace walks back, arrows move. Always LTR — digits read the
 * same way in Arabic.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
  idPrefix = 'dm-assist-otp-',
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Ids are `${idPrefix}${index}`; the first box is the label target. */
  idPrefix?: string;
}) {
  const { t } = useTranslation();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

  function focusAt(index: number) {
    refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))]?.focus();
  }

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, OTP_LENGTH));
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      setDigit(index, '');
      return;
    }
    if (raw.length > 1) {
      // Autofill or a paste landing in one box: spread the digits from here.
      const merged = (digits.slice(0, index).join('') + raw).slice(0, OTP_LENGTH);
      onChange(merged);
      focusAt(merged.length >= OTP_LENGTH ? OTP_LENGTH - 1 : merged.length);
      return;
    }
    setDigit(index, raw);
    if (index < OTP_LENGTH - 1) focusAt(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setDigit(index, '');
      } else if (index > 0) {
        setDigit(index - 1, '');
        focusAt(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    focusAt(text.length >= OTP_LENGTH ? OTP_LENGTH - 1 : text.length);
  }

  return (
    <div className="dm-assist__otp" dir="ltr" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          id={`${idPrefix}${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`dm-assist__otp-box${digit ? ' is-filled' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={OTP_LENGTH}
          value={digit}
          disabled={disabled}
          autoFocus={i === 0}
          aria-label={t('assistMode.customer.otpDigit', { n: i + 1 })}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
