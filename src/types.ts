export type PlanType = 'skill' | 'academic' | 'hobby' | 'curiosity';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: string;
}

export interface VideoItem {
  title: string;
  url: string;
  duration?: string;
  description?: string;
}

export interface LearningPlan {
  id: string;
  userId: string;
  topic: string;
  timeframe: string;
  type: PlanType;
  createdAt: any; // Firestore Timestamp
  completed: boolean;
  currentSessionNumber: number;
  totalSessions: number;
  explanation?: string; // For Hobby/Curiosity
  videos?: VideoItem[]; // For Hobby/Curiosity
}

export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface LearningSession {
  id: string;
  planId: string;
  title: string;
  order: number;
  summary: string;
  notes: string; // Markdown supported
  flashcards: Flashcard[];
  videos: VideoItem[];
  quiz: QuizQuestion[];
  status: 'locked' | 'unlocked' | 'completed';
  quizCompleted: boolean;
  quizScore?: number;
  userQuizAnswers?: number[];
  completedAt?: any; // Firestore Timestamp or ISO string
}

export interface SystemAnalytics {
  totalPlans: number;
  completedPlans: number;
  totalQuizzesTaken: number;
  averageQuizScore: number;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
  lastAnalyzedAt?: string;
}
