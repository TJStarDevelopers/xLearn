import React, { useState, useEffect } from "react";
import { 
  Sparkles, Trophy, CheckCircle, Award, 
  TrendingUp, AlertCircle, Lightbulb, RefreshCw 
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { SystemAnalytics, LearningPlan, LearningSession } from "../types";

interface AIPerformanceCoachProps {
  userId: string;
  plans: LearningPlan[];
}

export default function AIPerformanceCoach({ userId, plans }: AIPerformanceCoachProps) {
  const [stats, setStats] = useState({
    totalPlans: 0,
    completedPlans: 0,
    completedSessions: 0,
    quizzesTaken: 0,
    averageScore: 0
  });

  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("");

  const loadingMessages = [
    "Analyzing quiz responses and scores...",
    "Scanning completed sessions and curriculum completion rates...",
    "Evaluating topic cognitive density and retention...",
    "Synthesizing personal strengths and weaknesses...",
    "Formulating actionable recommendations and study strategies..."
  ];

  useEffect(() => {
    let msgIndex = 0;
    let interval: any;
    if (loading) {
      setLoadingMessage(loadingMessages[0]);
      interval = setInterval(() => {
        msgIndex = (msgIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[msgIndex]);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Load stats and analytics
  useEffect(() => {
    if (userId) {
      calculateStatsAndLoadAnalytics();
    }
  }, [userId, plans]);

  const calculateStatsAndLoadAnalytics = async () => {
    try {
      setError(null);
      
      // Calculate local stats based on plans and subcollection sessions
      let totalPls = plans.length;
      let completedPls = plans.filter(p => p.completed).length;
      let completedSess = 0;
      let quizzesTaken = 0;
      let totalScoreSum = 0;

      // Query sessions across all plans
      const allSessions: LearningSession[] = [];
      const sessionHistoryForCoach: any[] = [];

      for (const p of plans) {
        const path = `plans/${p.id}/sessions`;
        try {
          const sSnap = await getDocs(collection(db, path));
          sSnap.forEach(d => {
            const data = d.data() as LearningSession;
            allSessions.push(data);
            if (data.status === 'completed') {
              completedSess++;
            }
            if (data.quizCompleted) {
              quizzesTaken++;
              totalScoreSum += (data.quizScore || 0);
              sessionHistoryForCoach.push({
                planTopic: p.topic,
                sessionTitle: data.title,
                quizScore: data.quizScore,
                completed: data.status === 'completed'
              });
            }
          });
        } catch (err) {
          console.warn("Failed to fetch sessions for coaching calculation:", err);
        }
      }

      setStats({
        totalPlans: totalPls,
        completedPlans: completedPls,
        completedSessions: completedSess,
        quizzesTaken,
        averageScore: quizzesTaken > 0 ? Math.round((totalScoreSum / (quizzesTaken * 5)) * 100) : 0
      });

      // Load cached coaching data from firestore
      const analyticsDocPath = `users/${userId}/analytics/data`;
      try {
        const aSnap = await getDoc(doc(db, analyticsDocPath));
        if (aSnap.exists()) {
          setAnalytics(aSnap.data() as SystemAnalytics);
        }
      } catch (err) {
        console.error("Cached analytics load failed:", err);
      }
    } catch (err) {
      console.error("Error building dashboard stats:", err);
    }
  };

  const handleRequestDiagnostics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Collect study history to submit to coaching API
      const historySummary: any[] = [];
      
      for (const p of plans) {
        const path = `plans/${p.id}/sessions`;
        const sSnap = await getDocs(collection(db, path));
        const sessionsList: any[] = [];
        sSnap.forEach(d => {
          const s = d.data() as LearningSession;
          sessionsList.push({
            sessionTitle: s.title,
            completed: s.status === 'completed',
            quizCompleted: s.quizCompleted,
            quizScorePercent: s.quizScore ? Math.round((s.quizScore / 5) * 100) : null
          });
        });
        
        historySummary.push({
          topic: p.topic,
          timeframe: p.timeframe,
          type: p.type,
          completed: p.completed,
          currentSession: p.currentSessionNumber,
          totalSessions: p.totalSessions,
          sessions: sessionsList
        });
      }

      if (historySummary.length === 0) {
        throw new Error("You haven't started any study plans yet! Please enter what you want to learn to build your first curriculum plan.");
      }

      const res = await fetch("/api/analyze-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: historySummary })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to analyze study progress");
      }

      const coachOutput = await res.json();
      
      const updatedAnalytics: SystemAnalytics = {
        totalPlans: stats.totalPlans,
        completedPlans: stats.completedPlans,
        totalQuizzesTaken: stats.quizzesTaken,
        averageQuizScore: stats.averageScore,
        strengths: coachOutput.strengths || [],
        weaknesses: coachOutput.weaknesses || [],
        tips: coachOutput.tips || [],
        lastAnalyzedAt: new Date().toLocaleDateString()
      };

      // Save to Firestore
      const analyticsDocPath = `users/${userId}/analytics/data`;
      try {
        await setDoc(doc(db, analyticsDocPath), updatedAnalytics);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, analyticsDocPath);
      }

      setAnalytics(updatedAnalytics);
    } catch (err: any) {
      setError(err.message || "Something went wrong while compiling stats.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8" id="ai-performance-coach">
      {/* Upper header summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-2xl font-semibold font-display tracking-tight text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500 fill-amber-100 animate-pulse" />
            AI Training Coach & Diagnostics
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Get personalized diagnostics, study advice, and granular cognitive reviews generated directly from your quiz accuracy and completion records.
          </p>
        </div>
        <button
          onClick={handleRequestDiagnostics}
          disabled={loading || plans.length === 0}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
            plans.length === 0 
              ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Analyzing..." : "Perform AI Diagnostic"}
        </button>
      </div>

      {loading && (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center space-y-4 animate-fade-in shadow-xs">
          <div className="flex justify-center">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin"></div>
            </div>
          </div>
          <p className="font-semibold text-gray-800 font-display text-lg">Running Cognitive Audit...</p>
          <p className="text-xs text-indigo-500 h-5 font-mono max-w-md mx-auto">{loadingMessage}</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Diagnostic Blocked</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Grids */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Plans</span>
              <Award className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 font-display">{stats.totalPlans}</p>
            <p className="text-xs text-gray-500 font-medium">{stats.completedPlans} Completed Curriculum</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Sessions Cleared</span>
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 font-display">{stats.completedSessions}</p>
            <p className="text-xs text-gray-500 font-medium">Accumulated milestone notes</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Quizzes Ended</span>
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 font-display">{stats.quizzesTaken}</p>
            <p className="text-xs text-gray-500 font-medium">Concept evaluations check</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Accuracy</span>
              <TrendingUp className="w-5 h-5 text-rose-500" />
            </div>
            <p className="text-3xl font-bold text-gray-900 font-display">{stats.averageScore}%</p>
            <p className="text-xs text-gray-500 font-medium">Overall correct answer ratio</p>
          </div>
        </div>
      )}

      {/* SVG Performance chart & detail blocks */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Custom elegant SVG Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs lg:col-span-12 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 font-display">Target Performance Visualizer</h3>
              <p className="text-xs text-gray-500">Visualization of current course completions and overall concept grade profiles.</p>
            </div>
            
            {plans.length === 0 ? (
              <div className="h-44 flex items-center justify-center border border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
                Create a study plan to display performance metrics charts.
              </div>
            ) : (
              <div className="pt-4">
                <div className="space-y-4">
                  {plans.map((p, idx) => {
                    const completePct = p.totalSessions > 0 ? Math.round((p.currentSessionNumber / p.totalSessions) * 100) : 100;
                    return (
                      <div key={p.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700 truncate max-w-sm font-display">{p.topic}</span>
                          <span className="text-xs font-semibold text-gray-500">Progression: {p.completed ? "Done" : `${completePct}%`}</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${Math.min(100, Math.max(5, completePct))}%` }} 
                            className={`h-full rounded-full transition-all duration-500 ${
                              p.completed ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* AI Coach insights */}
          {analytics ? (
            <>
              {/* Strengths */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs lg:col-span-4 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-display font-semibold">
                  <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600 shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  Cognitive Strengths
                </div>
                <div className="space-y-3">
                  {analytics.strengths.map((s, index) => (
                    <div key={index} className="flex gap-2 text-sm text-gray-600 border-l-2 border-emerald-500 pl-3 py-0.5">
                      {s}
                    </div>
                  ))}
                  {analytics.strengths.length === 0 && (
                     <p className="text-xs text-gray-400 italic">No strengths calculated yet.</p>
                  )}
                </div>
              </div>

              {/* Weaknesses */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs lg:col-span-4 space-y-4">
                <div className="flex items-center gap-2 text-amber-700 font-display font-semibold">
                  <div className="bg-amber-50 p-2 rounded-lg text-amber-600 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  Growth Opportunities
                </div>
                <div className="space-y-3">
                  {analytics.weaknesses.map((w, index) => (
                    <div key={index} className="flex gap-2 text-sm text-gray-600 border-l-2 border-amber-500 pl-3 py-0.5">
                      {w}
                    </div>
                  ))}
                  {analytics.weaknesses.length === 0 && (
                     <p className="text-xs text-gray-400 italic">No developmental flags calculated yet.</p>
                  )}
                </div>
              </div>

              {/* Actionable Tips */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs lg:col-span-4 space-y-4">
                <div className="flex items-center gap-2 text-indigo-700 font-display font-semibold">
                  <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 shrink-0">
                    <Lightbulb className="w-5 h-5" />
                  </div>
                  Coach Recommendations
                </div>
                <div className="space-y-3">
                  {analytics.tips.map((t, index) => (
                    <div key={index} className="flex gap-2 text-sm text-gray-600 border-l-2 border-indigo-500 pl-3 py-0.5">
                      {t}
                    </div>
                  ))}
                  {analytics.tips.length === 0 && (
                     <p className="text-xs text-gray-400 italic">No recommendations yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-100 p-8 rounded-2xl text-center lg:col-span-12 space-y-3">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="font-semibold text-gray-800 font-display">Diagnostic Report Ready</p>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                No active audit is saved on your profile. Take some quizzes and click the <strong>Perform AI Diagnostic</strong> button in the upper right to run a comprehensive cognitive scan of your study plans!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
