/**
 * ============================================================================
 * BCS & BD Exam & Predictive Question Synthesizer Service
 * ============================================================================
 * Implements 10-Year BPSC official syllabus distribution, difficulty balancing,
 * and dynamic negative marking (0.50 for BCS, 0.25 for Primary).
 */

import { ExamCategory, DifficultyLevel, QuestionModel, ExamScoringRule } from '../types';

export interface BcsSubjectWeightage {
  subjectCode: string;
  nameBn: string;
  weightage: number;
}

export class BcsExamService {
  /**
   * Official 10-Year BPSC 200-Mark Preliminary Syllabus Weightages
   */
  public static readonly OFFICIAL_BCS_WEIGHTAGES: BcsSubjectWeightage[] = [
    { subjectCode: 'BANGLA', nameBn: 'বাংলা ভাষা ও সাহিত্য', weightage: 35 },
    { subjectCode: 'ENGLISH', nameBn: 'English Language & Literature', weightage: 35 },
    { subjectCode: 'BANGLADESH_AFFAIRS', nameBn: 'বাংলাদেশ বিষয়াবলী', weightage: 30 },
    { subjectCode: 'INT_AFFAIRS', nameBn: 'আন্তর্জাতিক বিষয়াবলী', weightage: 20 },
    { subjectCode: 'MATH', nameBn: 'গাণিতিক যুক্তি', weightage: 15 },
    { subjectCode: 'MENTAL_ABILITY', nameBn: 'মানসিক দক্ষতা', weightage: 15 },
    { subjectCode: 'GENERAL_SCIENCE', nameBn: 'সাধারণ বিজ্ঞান', weightage: 15 },
    { subjectCode: 'COMPUTER_ICT', nameBn: 'কম্পিউটার ও তথ্যপ্রযুক্তি', weightage: 15 },
    { subjectCode: 'GEOGRAPHY', nameBn: 'ভূগোল, পরিবেশ ও দুর্যোগ ব্যবস্থাপনা', weightage: 10 },
    { subjectCode: 'ETHICS', nameBn: 'নৈতিকতা, মূল্যবোধ ও সুশাসন', weightage: 10 },
  ];

  /**
   * Official Primary Assistant Teacher Exam Weightages (80 Marks)
   */
  public static readonly OFFICIAL_PRIMARY_WEIGHTAGES: BcsSubjectWeightage[] = [
    { subjectCode: 'BANGLA', nameBn: 'বাংলা', weightage: 20 },
    { subjectCode: 'ENGLISH', nameBn: 'ইংরেজি', weightage: 20 },
    { subjectCode: 'MATH', nameBn: 'গণিত', weightage: 20 },
    { subjectCode: 'GENERAL_KNOWLEDGE', nameBn: 'সাধারণ জ্ঞান ও বিজ্ঞান', weightage: 20 },
  ];

  /**
   * Official Negative Marking Rules
   */
  public static getScoringRules(category: ExamCategory): ExamScoringRule {
    switch (category) {
      case 'BCS_PRELI':
        return {
          category,
          totalMarks: 200,
          totalQuestions: 200,
          totalDurationMin: 120,
          negativeMarkRate: 0.50, // 0.50 mark deducted for each wrong answer
        };
      case 'PRIMARY_ASSISTANT_TEACHER':
        return {
          category,
          totalMarks: 80,
          totalQuestions: 80,
          totalDurationMin: 60,
          negativeMarkRate: 0.25, // 0.25 mark deducted for each wrong answer
        };
      case 'BANK_OFFICER_CASH':
        return {
          category,
          totalMarks: 100,
          totalQuestions: 100,
          totalDurationMin: 60,
          negativeMarkRate: 0.25,
        };
      default:
        return {
          category,
          totalMarks: 100,
          totalQuestions: 100,
          totalDurationMin: 90,
          negativeMarkRate: 0.50,
        };
    }
  }

  /**
   * Balanced Difficulty Distribution Generator:
   * 60% Standard, 25% Tricky (Distractor heavy), 15% High Difficulty
   */
  public static calculateDifficultyDistribution(totalQuestions: number): {
    standard: number;
    tricky: number;
    high: number;
  } {
    const standard = Math.round(totalQuestions * 0.60);
    const tricky = Math.round(totalQuestions * 0.25);
    const high = Math.max(0, totalQuestions - standard - tricky);
    return { standard, tricky, high };
  }

  /**
   * Grades student exam submission with exact negative penalty calculation
   */
  public static evaluateSubmission(
    answers: Record<string, 'A' | 'B' | 'C' | 'D'>,
    questions: QuestionModel[],
    category: ExamCategory,
    timeTakenSec: number
  ) {
    const rules = this.getScoringRules(category);
    let correct = 0;
    let wrong = 0;
    let blank = 0;

    const incorrectQuestions: Array<{
      question: QuestionModel;
      selectedOption: string;
      correctOption: string;
    }> = [];

    for (const q of questions) {
      const selected = answers[q.id];
      if (!selected) {
        blank++;
      } else if (selected === q.correctOption) {
        correct++;
      } else {
        wrong++;
        incorrectQuestions.push({
          question: q,
          selectedOption: selected,
          correctOption: q.correctOption,
        });
      }
    }

    const rawScore = correct * 1.0;
    const penalty = Number((wrong * rules.negativeMarkRate).toFixed(2));
    const netScore = Math.max(0, Number((rawScore - penalty).toFixed(2)));

    const totalSeconds = rules.totalDurationMin * 60;
    const timeRatio = Math.min(1.0, timeTakenSec / totalSeconds);
    const tieBreakerScore = Number((netScore + (1.0 - timeRatio)).toFixed(6));

    const totalAttempted = correct + wrong;
    const accuracyPercent = totalAttempted > 0 ? Number(((correct / totalAttempted) * 100).toFixed(1)) : 0;

    return {
      category,
      totalQuestions: questions.length,
      attemptedCount: totalAttempted,
      correctCount: correct,
      wrongCount: wrong,
      blankCount: blank,
      rawScore,
      penalty,
      netScore,
      tieBreakerScore,
      accuracyPercent,
      timeTakenSec,
      incorrectQuestions,
    };
  }
}
