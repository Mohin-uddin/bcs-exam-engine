// Type definitions for BCS & BD Competitive Exam Prep Engine

export type ExamCategory =
  | 'BCS_PRELI'
  | 'PRIMARY_ASSISTANT_TEACHER'
  | 'BANK_OFFICER_CASH'
  | 'BJS_JUDICIARY'
  | 'CUSTOM_MODEL_TEST';

export type DifficultyLevel = 'STANDARD' | 'TRICKY' | 'HIGH';

export type MistakeTag =
  | 'SILLY_MISTAKE'      // জানা প্রশ্ন ভুল বা বৃত্ত ভরাট অসাবধানতা
  | 'CONCEPT_GAP'        // মৌলিক তথ্যের ঘাটতি
  | 'TIME_PRESSURE'      // সময়ের অভাবে ভুল
  | 'UNREAD_STEM'        // "নয়/কোনটি সঠিক নয়" খেয়াল না করা
  | 'CALCULATION_ERROR'  // গাণিতিক ভুলে
  | 'GUESS_WORK';        // অযৌক্তিক আন্দাজে দাগানো

export type MistakeResolutionStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'MASTERED';

export interface SM2Input {
  quality: number;          // 0 to 5
  repetition: number;       // Current n
  easinessFactor: number;   // Current EF (>= 1.3, default 2.5)
  intervalDays: number;     // Current interval in days
}

export interface SM2Output {
  repetition: number;
  easinessFactor: number;
  intervalDays: number;
  nextReviewDate: Date;
  quality: number;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  netScore: number;
  rawScore: number;
  penalty: number;
  timeTakenSec: number;
  tieBreakerRankScore: number;
  rank: number;
  percentile: number;
  submittedAt: Date;
}

export interface ExamScoringRule {
  category: ExamCategory;
  totalMarks: number;
  totalQuestions: number;
  totalDurationMin: number;
  negativeMarkRate: number; // e.g. 0.50 for BCS, 0.25 for Primary
}

export interface QuestionModel {
  id: string;
  subjectCode: string;
  subjectNameBn: string;
  topicCode: string;
  stemBn: string;
  stemEn?: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanationBn: string;
  shortcutFormula?: string;
  mnemonicBn?: string;
  difficulty: DifficultyLevel;
  previousExams?: string[];
}

export interface MistakeVaultItem {
  id: string;
  userId: string;
  questionId: string;
  question: QuestionModel;
  sourceExamTitle: string;
  selectedOption: string;
  correctOption: string;
  tag: MistakeTag;
  userNotes?: string;
  status: MistakeResolutionStatus;
  errorCount: number;
  lastErrorDate: Date;
  sm2Data?: SM2Output;
}

export interface SynthesizedCurrentAffairsMCQ {
  headline: string;
  eventDate: string;
  sourceUrl?: string;
  questionBn: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanationBn: string;
  mnemonicBn: string;
  subjectCode: string;
  topicCode: string;
  bpscAuthenticityScore: number;
}
