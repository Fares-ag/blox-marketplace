import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_REMINDER_THRESHOLDS,
  reminderKindFor,
  reminderStages,
  shouldSendReminder,
  TAKAFUL_REMINDER_THRESHOLDS,
} from './reminder-logic';

describe('reminderStages', () => {
  it('orders stages from the earliest nudge to expiry', () => {
    expect(reminderStages(DOCUMENT_REMINDER_THRESHOLDS)).toEqual(['d60', 'd30', 'd7', 'expired']);
    expect(reminderStages(TAKAFUL_REMINDER_THRESHOLDS)).toEqual(['d30', 'd14', 'd3', 'expired']);
    expect(reminderStages([7, 60, 30])).toEqual(['d60', 'd30', 'd7', 'expired']);
  });
});

describe('reminderKindFor', () => {
  it('picks the document stage (the latest threshold crossed) from days to expiry', () => {
    expect(reminderKindFor(90, DOCUMENT_REMINDER_THRESHOLDS)).toBeNull();
    expect(reminderKindFor(61, DOCUMENT_REMINDER_THRESHOLDS)).toBeNull();
    expect(reminderKindFor(60, DOCUMENT_REMINDER_THRESHOLDS)).toBe('d60');
    expect(reminderKindFor(45, DOCUMENT_REMINDER_THRESHOLDS)).toBe('d60');
    expect(reminderKindFor(30, DOCUMENT_REMINDER_THRESHOLDS)).toBe('d30');
    expect(reminderKindFor(8, DOCUMENT_REMINDER_THRESHOLDS)).toBe('d30');
    expect(reminderKindFor(7, DOCUMENT_REMINDER_THRESHOLDS)).toBe('d7');
    expect(reminderKindFor(0, DOCUMENT_REMINDER_THRESHOLDS)).toBe('d7');
    expect(reminderKindFor(-1, DOCUMENT_REMINDER_THRESHOLDS)).toBe('expired');
  });

  it('picks the takaful stage from days to expiry', () => {
    expect(reminderKindFor(31, TAKAFUL_REMINDER_THRESHOLDS)).toBeNull();
    expect(reminderKindFor(30, TAKAFUL_REMINDER_THRESHOLDS)).toBe('d30');
    expect(reminderKindFor(14, TAKAFUL_REMINDER_THRESHOLDS)).toBe('d14');
    expect(reminderKindFor(3, TAKAFUL_REMINDER_THRESHOLDS)).toBe('d3');
    expect(reminderKindFor(-30, TAKAFUL_REMINDER_THRESHOLDS)).toBe('expired');
  });
});

describe('shouldSendReminder', () => {
  const T = DOCUMENT_REMINDER_THRESHOLDS;

  it('sends the first applicable stage once', () => {
    expect(shouldSendReminder('d60', null, T)).toBe(true);
    expect(shouldSendReminder('d60', 'd60', T)).toBe(false);
    expect(shouldSendReminder(null, null, T)).toBe(false);
  });

  it('only moves forward through the stages', () => {
    expect(shouldSendReminder('d30', 'd60', T)).toBe(true);
    expect(shouldSendReminder('d7', 'd60', T)).toBe(true);
    expect(shouldSendReminder('d30', 'd7', T)).toBe(false);
    expect(shouldSendReminder('expired', 'd7', T)).toBe(true);
    expect(shouldSendReminder('expired', 'expired', T)).toBe(false);
  });

  it('restarts the ladder when the last stage is unknown (e.g. thresholds changed)', () => {
    expect(shouldSendReminder('d30', 'd90', T)).toBe(true);
  });
});
