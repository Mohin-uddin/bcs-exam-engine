/**
 * ============================================================================
 * Mistake Vault (ভুল খাতা / Cuotiben) Service
 * ============================================================================
 * Evidence-based error capture and targeted cognitive remediation engine.
 * Categorizes errors by cognitive failure mode and bridges into SM-2 spaced repetition.
 */

import { MistakeVaultItem, MistakeTag, MistakeResolutionStatus, QuestionModel } from '../types';
import { SuperMemo2Service } from './sm2.service';

export class MistakeVaultService {
  // In-memory store: userId -> Map<questionId, MistakeVaultItem>
  private static userVaults: Map<string, Map<string, MistakeVaultItem>> = new Map();

  /**
   * Captures wrong answers from digital exams or OMR scans into candidate's Mistake Vault
   */
  public static recordMistake(params: {
    userId: string;
    question: QuestionModel;
    sourceExamTitle: string;
    selectedOption: string;
    correctOption: string;
    inferredTag?: MistakeTag;
    userNotes?: string;
  }): MistakeVaultItem {
    const { userId, question, sourceExamTitle, selectedOption, correctOption, inferredTag, userNotes } = params;

    if (!this.userVaults.has(userId)) {
      this.userVaults.set(userId, new Map());
    }

    const userBucket = this.userVaults.get(userId)!;
    const existing = userBucket.get(question.id);

    if (existing) {
      // Increment repeat error counter and reset resolution status
      existing.errorCount += 1;
      existing.lastErrorDate = new Date();
      existing.selectedOption = selectedOption;
      existing.status = 'IN_REVIEW';
      if (inferredTag) existing.tag = inferredTag;
      if (userNotes) existing.userNotes = userNotes;

      // Re-initialize SM-2 repetition penalty
      existing.sm2Data = SuperMemo2Service.calculate({
        quality: 1, // Failure reset
        repetition: 0,
        easinessFactor: Math.max(1.3, existing.sm2Data?.easinessFactor ? existing.sm2Data.easinessFactor - 0.2 : 2.3),
        intervalDays: 1,
      });

      return existing;
    }

    // New mistake entry
    const initialSm2 = SuperMemo2Service.calculate({
      quality: 1,
      repetition: 0,
      easinessFactor: SuperMemo2Service.DEFAULT_EASINESS_FACTOR,
      intervalDays: 1,
    });

    const newItem: MistakeVaultItem = {
      id: `mv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      questionId: question.id,
      question,
      sourceExamTitle,
      selectedOption,
      correctOption,
      tag: inferredTag || 'CONCEPT_GAP',
      userNotes,
      status: 'OPEN',
      errorCount: 1,
      lastErrorDate: new Date(),
      sm2Data: initialSm2,
    };

    userBucket.set(question.id, newItem);
    return newItem;
  }

  /**
   * Updates tag and reflective notes for a mistake entry
   */
  public static updateTagAndNotes(
    userId: string,
    questionId: string,
    tag: MistakeTag,
    notes?: string
  ): MistakeVaultItem | null {
    const bucket = this.userVaults.get(userId);
    if (!bucket) return null;
    const item = bucket.get(questionId);
    if (!item) return null;

    item.tag = tag;
    if (notes !== undefined) item.userNotes = notes;
    return item;
  }

  /**
   * Records candidate re-review of a mistake item using SM-2 quality grade (0 to 5)
   */
  public static recordReviewAttempt(
    userId: string,
    questionId: string,
    recallQuality: number
  ): MistakeVaultItem | null {
    const bucket = this.userVaults.get(userId);
    if (!bucket) return null;
    const item = bucket.get(questionId);
    if (!item) return null;

    const currentSm2 = item.sm2Data || {
      quality: 0,
      repetition: 0,
      easinessFactor: 2.5,
      intervalDays: 1,
      nextReviewDate: new Date(),
    };

    const nextSm2 = SuperMemo2Service.calculate({
      quality: recallQuality,
      repetition: currentSm2.repetition,
      easinessFactor: currentSm2.easinessFactor,
      intervalDays: currentSm2.intervalDays,
    });

    item.sm2Data = nextSm2;

    // Status transition:
    // If candidate successfully recalls (q >= 4) with 2 consecutive repetitions -> RESOLVED
    // With 4 consecutive repetitions -> MASTERED
    if (nextSm2.repetition >= 4 && recallQuality >= 4) {
      item.status = 'MASTERED';
    } else if (nextSm2.repetition >= 2 && recallQuality >= 4) {
      item.status = 'RESOLVED';
    } else if (recallQuality >= 3) {
      item.status = 'IN_REVIEW';
    } else {
      item.status = 'OPEN';
    }

    return item;
  }

  /**
   * Returns filtered list of candidate's mistakes with analytical metrics
   */
  public static getMistakeVaultSummary(userId: string, filterTag?: MistakeTag, filterStatus?: MistakeResolutionStatus) {
    const bucket = this.userVaults.get(userId);
    if (!bucket) {
      return {
        totalMistakes: 0,
        masteredCount: 0,
        inReviewCount: 0,
        openCount: 0,
        tagBreakdown: {},
        items: [],
      };
    }

    let items = Array.from(bucket.values());

    // Analytics before filtering
    const tagBreakdown: Record<string, number> = {};
    let masteredCount = 0;
    let inReviewCount = 0;
    let openCount = 0;

    for (const item of items) {
      tagBreakdown[item.tag] = (tagBreakdown[item.tag] || 0) + 1;
      if (item.status === 'MASTERED') masteredCount++;
      else if (item.status === 'RESOLVED' || item.status === 'IN_REVIEW') inReviewCount++;
      else openCount++;
    }

    // Apply filters
    if (filterTag) {
      items = items.filter((i) => i.tag === filterTag);
    }
    if (filterStatus) {
      items = items.filter((i) => i.status === filterStatus);
    }

    // Sort by urgent review date and repeat error count
    items.sort((a, b) => b.errorCount - a.errorCount);

    return {
      totalMistakes: bucket.size,
      masteredCount,
      inReviewCount,
      openCount,
      tagBreakdown,
      items,
    };
  }
}
