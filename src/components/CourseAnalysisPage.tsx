import React, { useState, useEffect } from "react";
import { 
  Award, Trophy, TrendingUp, AlertCircle, Lightbulb, 
  ArrowLeft, RotateCw, CheckCircle, Sparkles, BookOpen 
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { LearningPlan, LearningSession } from "../types";

interface CourseAnalysisData {
  overallEvaluation: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  analyzedAt: string;
}

interface CourseAnalysisPageProps {
  plan: LearningPlan;
  sessions: LearningSession[];
  onBack: () => void;
}

export default function CourseAnalysisPage({ plan, sessions, onBack }: CourseAnalysisPageProps) {
  const [analysis, setAnalysis] = useState<CourseAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("");

  const loadingMessages = [
    "Retconning evaluation performance profiles...",
    "Scanning cumulative sub-lesson outcomes...",
    "Synthesizing customized strengths and developmental flags...",
    "Drafting advanced next-semester learning trajectories...",
  ];

  useEffect(() => {
    let index = 0;
    let interval: any;
    if (loading) {
      setLoadingMessage(loadingMessages[0]);
      interval = setInterval(() => {
        index = (index + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[index]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Load analysis on mount
  useEffect(() => {
    loadCachedAnalysis();
  }, [plan.id]);

  const loadCachedAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const docRef = doc(db, `plans/${plan.id}/analysis/detailed`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setAnalysis(snap.data() as CourseAnalysisData);
        setLoading(false);
      } else {
        // Trigger auto-analysis
        await runNewAnalysis();
      }
    } catch (err: any) {
      console.error("Cached analysis load failed, retrying generation:", err);
      await runNewAnalysis();
    }
  };

  const runNewAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      // Formulate history context for Gemini
      const historySummary = sessions.map(s => ({
        sessionTitle: s.title,
        order: s.order,
        quizCompleted: s.quizCompleted,
        quizScore: s.quizScore || 0,
        totalQuestions: s.quiz?.length || 5,
        summary: s.summary
      }));

      const res = await fetch("/api/analyze-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: plan.topic,
          timeframe: plan.timeframe,
          type: plan.type,
          sessions: historySummary
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to compile AI study diagnostic.");
      }

      const rawData = await res.json();
      const analysisData: CourseAnalysisData = {
        overallEvaluation: rawData.overallEvaluation || "You have completed this specialized roadmap series successfully with stellar effort across all chronological subjects.",
        strengths: rawData.strengths || ["Consistent session clearances", "Active quiz-taking diligence"],
        weaknesses: rawData.weaknesses || ["Could explore more diverse context levels"],
        suggestions: rawData.suggestions || ["Review topics with lower accuracy profiles", "Begin a brand new advanced curriculum next"],
        analyzedAt: new Date().toLocaleDateString()
      };

      // Cache into Firestore
      const docRef = doc(db, `plans/${plan.id}/analysis/detailed`);
      await setDoc(docRef, analysisData);

      setAnalysis(analysisData);
    } catch (err: any) {
      console.error("Course Analysis compilation failed:", err);
      setError(err.message || "Something went wrong while formulating the diagnostic report.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate quiz score metrics
  const sessionsWithQuizzes = sessions.filter(s => s.quizCompleted);
  const totalScoreMax = sessionsWithQuizzes.length * 5;
  const totalScoreEarned = sessionsWithQuizzes.reduce((acc, s) => acc + (s.quizScore || 0), 0);
  const overallAccuracy = totalScoreMax > 0 ? Math.round((totalScoreEarned / totalScoreMax) * 100) : 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2 animate-fade-in" id="course-completion-analysis">
      {/* Return button */}
      <div>
        <button
          onClick={onBack}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 py-1 mb-1 font-display cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Roadmap Overview
        </button>
      </div>

      {/* Hero Achievement Board */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Award className="w-40 h-40" />
        </div>
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider font-mono">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Curriculum Mastered
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold font-display tracking-tight">
            AI Graduation Report
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">
            Congratulations! You have cleared every scholastic milestone node in the **{plan.topic}** roadmap. The classroom metrics have been reviewed below by the AI Performance Coach.
          </p>
        </div>
      </div>

      {/* Score and metrics breakdown panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Completed Roadmap</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="my-3">
            <p className="text-4xl font-black text-gray-900 font-display">100%</p>
          </div>
          <p className="text-xs text-gray-500 font-medium">Clearance across {sessions.length} structured sessions</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Overall Accuracy</span>
            <TrendingUp className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="my-3">
            <p className="text-4xl font-black text-gray-900 font-display">{overallAccuracy}%</p>
          </div>
          <p className="text-xs text-gray-500 font-medium">{totalScoreEarned} / {totalScoreMax} cumulative quiz points</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">Exams Finished</span>
            <BookOpen className="w-5 h-5 text-amber-500" />
          </div>
          <div className="my-3">
            <p className="text-4xl font-black text-gray-900 font-display">{sessionsWithQuizzes.length}</p>
          </div>
          <p className="text-xs text-gray-500 font-medium">Diagnostic milestone evaluations checked</p>
        </div>
      </div>

      {/* Quiz Progress Visual Timeline */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-150 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-gray-900 font-display">Roadmap Performance Timeline</h3>
          <p className="text-xs text-gray-500 mt-1">Granular quiz performance breakdown across all sequential milestones.</p>
        </div>

        <div className="space-y-4 pt-2">
          {sessions.map((s) => {
            const pct = s.quizCompleted && s.quizScore ? Math.round((s.quizScore / 5) * 100) : 0;
            return (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-gray-50 last:border-0">
                <div className="text-left max-w-sm">
                  <h4 className="text-xs md:text-sm font-semibold text-gray-800 font-display line-clamp-1">
                    S{s.order}: {s.title}
                  </h4>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-64 shrink-0">
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      key={s.id}
                      style={{ width: s.quizCompleted ? `${pct}%` : "0%" }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-indigo-500" : "bg-amber-400"
                      }`}
                    />
                  </div>
                  <span className="text-xs font-bold font-mono text-gray-500 shrink-0 min-w-[40px] text-right">
                    {s.quizCompleted ? `${s.quizScore}/5` : "Optional"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Performance Evaluation Segment */}
      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-150 text-center space-y-4 animate-fade-in shadow-xs">
          <div className="flex justify-center">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin"></div>
            </div>
          </div>
          <p className="font-bold text-gray-800 font-display text-lg">AI Performance Audit in progress...</p>
          <p className="text-xs text-indigo-500 font-mono h-4">{loadingMessage}</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-5 rounded-2xl border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Diagnostic Review Blocked</p>
            <p className="text-xs leading-relaxed">{error}</p>
            <button
              onClick={runNewAnalysis}
              className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Retry Computation
            </button>
          </div>
        </div>
      ) : analysis ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main detailed overview */}
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-150 shadow-xs lg:col-span-8 space-y-5">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Sparkles className="w-5 h-5 text-indigo-500 fill-indigo-100 animate-pulse shrink-0" />
              <h2 className="text-lg font-bold font-display text-gray-900 leading-none">
                AI Narrative Evaluation Report
              </h2>
            </div>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-wider">
              Diagnostically analyzed on {analysis.analyzedAt}
            </p>
            <div className="text-sm text-gray-650 leading-relaxed font-sans whitespace-pre-wrap">
              {analysis.overallEvaluation}
            </div>
          </div>

          {/* Strengths & suggestions in sidebar column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Strengths */}
            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 font-display font-bold text-sm">
                <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-600 shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                Key Strengths
              </div>
              <ul className="space-y-3">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-650 border-l-2 border-emerald-500 pl-3 leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Growth areas */}
            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-rose-700 font-display font-bold text-sm">
                <div className="bg-rose-50 p-1.5 rounded-lg text-rose-600 shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                Areas for Focus
              </div>
              <ul className="space-y-3">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-650 border-l-2 border-rose-400 pl-3 leading-relaxed">
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations */}
            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-indigo-700 font-display font-bold text-sm">
                <div className="bg-indigo-50 p-1.5 rounded-lg text-indigo-600 shrink-0">
                  <Lightbulb className="w-4 h-4" />
                </div>
                Next Step Recommendations
              </div>
              <ul className="space-y-3">
                {analysis.suggestions.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-650 border-l-2 border-indigo-500 pl-3 leading-relaxed">
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recalculate button */}
            <button
              onClick={runNewAnalysis}
              disabled={loading}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Recalculate Narrative
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
