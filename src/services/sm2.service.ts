/**
 * ============================================================================
 * SuperMemo SM-2 Spaced Repetition Engine
 * ============================================================================
 * Evidence-based cognitive recall algorithm for BCS & competitive exam prep.
 * Calculates optimal review intervals based on candidate recall quality (0 to 5).
 */

import { SM2Input, SM2Output } from '../types';

export class SuperMemo2Service {
  /**
   * Default initial SM-2 parameters for a freshly encountered question
   */
  public static readonly DEFAULT_EASINESS_FACTOR = 2.5;
  public static readonly MINIMUM_EASINESS_FACTOR = 1.3;
  public static readonly INITIAL_INTERVAL_DAYS = 1;

  /**
   * Calculates the next review interval and updated Easiness Factor (EF).
   *
   * @param input Current SM-2 state & candidate's recall quality
   *   Quality Scale:
   *   5: Perfect recall without hesitation (তাত্ক্ষণিক সঠিক উত্তর)
   *   4: Correct response after brief hesitation (সামান্য ভেবে সঠিক উত্তর)
   *   3: Correct response recalled with serious difficulty (কঠিন স্মৃতি হাতড়ে সঠিক)
   *   2: Incorrect response; but the correct answer seemed easy once revealed (স্মৃতিবিভ্রম)
   *   1: Incorrect response; only remembered after seeing the mnemonic (ছন্দ দেখে মনে পড়া)
   *   0: Complete blackout / total unfamiliarity (সম্পূর্ণ অজানা)
   */
  public static calculate(input: SM2Input): SM2Output {
    const { quality, repetition, easinessFactor, intervalDays } = input;

    // Validate quality bounds
    const q = Math.max(0, Math.min(5, Math.round(quality)));
    let nextRepetition = repetition;
    let nextIntervalDays = intervalDays;

    if (q >= 3) {
      // Successful recall
      if (repetition === 0) {
        nextIntervalDays = 1;
      } else if (repetition === 1) {
        nextIntervalDays = 6;
      } else {
        nextIntervalDays = Math.round(intervalDays * easinessFactor);
      }
      nextRepetition = repetition + 1;
    } else {
      // Failed recall -> reset repetition cycle to 0 and interval to 1 day
      nextRepetition = 0;
      nextIntervalDays = 1;
    }

    // Easiness Factor formula:
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const delta = 5 - q;
    let nextEF = easinessFactor + (0.1 - delta * (0.08 + delta * 0.02));

    // Minimum boundary condition for Easiness Factor is 1.3
    if (nextEF < this.MINIMUM_EASINESS_FACTOR) {
      nextEF = this.MINIMUM_EASINESS_FACTOR;
    }

    // Keep EF rounded to two decimal places
    nextEF = Math.round(nextEF * 100) / 100;

    // Next scheduled review timestamp
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + nextIntervalDays);
    // Standardize review trigger to 04:00 AM local morning study block
    nextReviewDate.setHours(4, 0, 0, 0);

    return {
      repetition: nextRepetition,
      easinessFactor: nextEF,
      intervalDays: nextIntervalDays,
      nextReviewDate,
      quality: q,
    };
  }

  /**
   * Evaluates candidate review deck and categorizes questions into:
   * - DUE_TODAY: Questions where nextReviewDate <= current date
   * - OVERDUE: Questions overdue by > 2 days (urgent priority)
   * - FUTURE: Scheduled for upcoming days
   */
  public static categorizeDeck(reviews: Array<{ id: string; nextReviewDate: Date }>) {
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const dueToday: string[] = [];
    const overdue: string[] = [];
    const future: string[] = [];

    for (const item of reviews) {
      const reviewDate = new Date(item.nextReviewDate);
      const diffMs = todayEnd.getTime() - reviewDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays >= 2) {
        overdue.push(item.id);
      } else if (diffDays >= 0) {
        dueToday.push(item.id);
      } else {
        future.push(item.id);
      }
    }

    return {
      dueTodayCount: dueToday.length + overdue.length,
      overdueCount: overdue.length,
      urgentReviewIds: [...overdue, ...dueToday],
      futureCount: future.length,
    };
  }

  /**
   * Forgetting curve retention probability estimation: R = e^(-t / S)
   * where t is days elapsed since last review, and S is interval memory strength.
   */
  public static estimateRetentionProbability(daysElapsed: number, intervalDays: number): number {
    if (intervalDays <= 0) return 0.0;
    const retention = Math.exp(-daysElapsed / intervalDays);
    return Math.max(0.0, Math.min(1.0, Math.round(retention * 1000) / 1000));
  }
}
