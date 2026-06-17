import React, { useState, useEffect } from "react";
import { 
  auth, db, handleFirestoreError, OperationType 
} from "./firebase";
import { 
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User 
} from "firebase/auth";
import { 
  doc, setDoc, getDoc, getDocs, collection, query, where, orderBy, updateDoc 
} from "firebase/firestore";
import { 
  initializePendo, trackPlanCreated, trackPlanOpened, trackSessionStarted, 
  trackSessionContentGenerated, trackQuizSubmitted, trackSessionCompleted, 
  trackCourseCompleted, trackAIDiagnosticRequested 
} from "./utils/pendo";
import { 
  BookOpen, Compass, Plus, LogOut, GraduationCap, Sparkles, 
  Layers, Trophy, ChevronRight, ChevronLeft, CheckCircle2, Circle, Clock, Activity, AlertTriangle, Lock
} from "lucide-react";
import { LearningPlan, LearningSession, PlanType } from "./types";
import AIPerformanceCoach from "./components/AIPerformanceCoach";
import HobbyCuriosityPlan from "./components/HobbyCuriosityPlan";
import ActiveSessionStudy from "./components/ActiveSessionStudy";
import CourseAnalysisPage from "./components/CourseAnalysisPage";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  // Active view tabs
  const [currentTab, setCurrentTab] = useState<'plans' | 'coach'>('plans');

  // Creation form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newTimeframe, setNewTimeframe] = useState("1 week");
  const [newType, setNewType] = useState<PlanType>("skill");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState("");

  // Detailed Study State (Active Plan / Active Session)
  const [selectedPlan, setSelectedPlan] = useState<LearningPlan | null>(null);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState<LearningSession | null>(null);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [isGeneratingCurrent, setIsGeneratingCurrent] = useState(false);
  const [showAnalysisOfPlanId, setShowAnalysisOfPlanId] = useState<string | null>(null);

  // Track Firebase auth details
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        // Initialize Pendo with user metadata
        initializePendo(currentUser.uid, currentUser.email, currentUser.displayName);
        
        // Save/Sync user profile in Firestore
        const userDocPath = `users/${currentUser.uid}`;
        try {
          await setDoc(doc(db, userDocPath), {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("User profile sync failed:", err);
        }
        fetchUserPlans(currentUser.uid);
      } else {
        setPlans([]);
        setSelectedPlan(null);
        setActiveSession(null);
      }
    });
    return unsub;
  }, []);

  const fetchUserPlans = async (userId: string) => {
    setPlansLoading(true);
    const plansPath = `plans`;
    try {
      const q = query(
        collection(db, plansPath), 
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list: LearningPlan[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as LearningPlan);
      });
      setPlans(list);
    } catch (err) {
      console.error("Error fetching user plans:", err);
    } finally {
      setPlansLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Add language preference (optional)
      provider.setCustomParameters({ prompt: 'consent' });
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const error = err as any;
      console.error("[v0] Sign-in error:", {
        code: error.code,
        message: error.message,
        customData: error.customData
      });
      
      // Provide user-friendly error messages
      if (error.code === 'auth/popup-closed-by-user') {
        console.warn('User closed the OAuth popup');
      } else if (error.code === 'auth/popup-blocked') {
        console.error('Popup was blocked. Please allow popups for this site.');
        alert('Sign-in failed: Popup was blocked. Please allow popups for this site.');
      } else if (error.code === 'auth/unauthorized-domain') {
        console.error('This domain is not authorized. Add it to Firebase Console → Authentication → Authorized Domains');
        alert('Sign-in failed: Domain not authorized in Firebase. Please check Firebase Console settings.');
      } else if (error.code === 'auth/operation-not-allowed') {
        console.error('Google Sign-In is not enabled in Firebase');
        alert('Sign-in failed: Google Sign-In not enabled. Please configure in Firebase Console.');
      } else {
        console.error('Unexpected sign-in error:', error);
        alert(`Sign-in failed: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out process triggered error:", err);
    }
  };

  // Triggers generating the course curriculum plan on backend
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    setIsGenerating(true);
    setGenStep("Starting rapid research and deep querying on topic...");

    try {
      // 1. Submit course information to AI backend pipeline
      setGenStep("Researching learning density curves and optimal sequences...");
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: newTopic,
          timeframe: newTimeframe,
          type: newType
        })
      });

      if (!res.ok) {
        throw new Error("Learning research failed on server side.");
      }

      const planOutput = await res.json();
      const generatedPlanId = "plan_" + Date.now().toString(36);

      // Create main plan Firestore structure
      const planDocPath = `plans/${generatedPlanId}`;
      const planData: LearningPlan = {
        id: generatedPlanId,
        userId: user!.uid,
        topic: newTopic,
        timeframe: newTimeframe,
        type: newType,
        createdAt: new Date(),
        completed: false,
        currentSessionNumber: 1,
        totalSessions: newType === "hobby" || newType === "curiosity" ? 1 : planOutput.totalSessions,
        ...(newType === "hobby" || newType === "curiosity" ? {
          explanation: planOutput.explanation,
          videos: planOutput.videos
        } : {})
      };

      try {
        await setDoc(doc(db, planDocPath), planData);
        // Track Plan Created event (fire and forget with error logging)
        trackPlanCreated(generatedPlanId, newTopic, newType, newTimeframe).catch(err => 
          console.error('[App] Plan Created tracking failed:', err)
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, planDocPath);
      }

      // If skill or academic topic, generate subcollection sessions
      if (newType === "skill" || newType === "academic") {
        setGenStep("Dividing curriculum roadmap into Chronological Sessions...");
        const sessionEntities: any[] = planOutput.sessions || [];

        // Save session roadmap shells
        for (const s of sessionEntities) {
          const sessId = `session_${s.order}_${Date.now().toString(36)}`;
          const sessPath = `plans/${generatedPlanId}/sessions/${sessId}`;
          const sessDataByAI = {
            id: sessId,
            planId: generatedPlanId,
            title: s.title,
            order: s.order,
            description: s.description || "",
            status: s.order === 1 ? 'unlocked' : 'locked',
            quizCompleted: false,
            flashcards: [],
            videos: [],
            quiz: []
          };

          try {
            await setDoc(doc(db, sessPath), sessDataByAI);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, sessPath);
          }
        }

        // AUTO RESEARCH & POPULATE SESSION 1 details
        setGenStep("Synthesizing detailed Study Notes & Code Snippets for Session 1...");
        const firstSess = sessionEntities.find(s => s.order === 1);
        if (firstSess) {
          const detailRes = await fetch("/api/generate-session-details", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: newTopic,
              sessionTitle: firstSess.title,
              sessionOrder: 1,
              sessionDescription: firstSess.description || ""
            })
          });

          if (detailRes.ok) {
            const firstSessDetailsByAI = await detailRes.json();
            
            // Query for that first session doc we just created
            const pathForFirst = `plans/${generatedPlanId}/sessions`;
            const firstSnap = await getDocs(collection(db, pathForFirst));
            let targetId = "";
            firstSnap.forEach(snapD => {
              if (snapD.data().order === 1) {
                targetId = snapD.id;
              }
            });

            if (targetId) {
              const editPath = `plans/${generatedPlanId}/sessions/${targetId}`;
              try {
                await updateDoc(doc(db, editPath), {
                  summary: firstSessDetailsByAI.summary || "",
                  notes: firstSessDetailsByAI.notes || "",
                  flashcards: firstSessDetailsByAI.flashcards || [],
                  videos: firstSessDetailsByAI.videos || [],
                  quiz: firstSessDetailsByAI.quiz || []
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, editPath);
              }
            }
          }
        }
      }

      // Close modal & reset inputs
      setNewTopic("");
      setShowCreateModal(false);
      // Reload plans
      fetchUserPlans(user!.uid);

    } catch (err) {
      console.error("Error creating plan layout:", err);
      alert("AI was unable to compile curriculum at this moment. Please check network.");
    } finally {
      setIsGenerating(false);
      setGenStep("");
    }
  };

  // Navigates and loads sessions for a specified plan layout
  const handleOpenPlan = async (plan: LearningPlan) => {
    setSelectedPlan(plan);
    setActiveSession(null);
    // Track Plan Opened event (fire and forget)
    trackPlanOpened(plan.id, plan.topic).catch(err => 
      console.error('[App] Plan Opened tracking failed:', err)
    );
    if (plan.type === "skill" || plan.type === "academic") {
      setSessionsLoading(true);
      const sessionsPath = `plans/${plan.id}/sessions`;
      try {
        const snap = await getDocs(collection(db, sessionsPath));
        const list: LearningSession[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as LearningSession);
        });
        // Sort chronologically
        list.sort((a,b) => a.order - b.order);
        setSessions(list);
      } catch (err) {
        console.error("Failed to load plan sessions:", err);
      } finally {
        setSessionsLoading(false);
      }
    }
  };

  const handleUpdateSessionData = async (updatedFields: Partial<LearningSession>) => {
    if (!selectedPlan || !activeSession) return;

    const path = `plans/${selectedPlan.id}/sessions/${activeSession.id}`;
    try {
      await updateDoc(doc(db, path), updatedFields);
      
      // Update local state
      const updatedSess = { ...activeSession, ...updatedFields } as LearningSession;
      setActiveSession(updatedSess);
      setSessions((prev) => prev.map((s) => s.id === activeSession.id ? updatedSess : s));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleGenerateCurrentSession = async () => {
    if (!selectedPlan || !activeSession) return;

    setIsGeneratingCurrent(true);
    // Track Session Started event (fire and forget)
    trackSessionStarted(selectedPlan.id, activeSession.id, activeSession.title).catch(err => 
      console.error('[App] Session Started tracking failed:', err)
    );
    try {
      const res = await fetch("/api/generate-session-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedPlan.topic,
          sessionTitle: activeSession.title,
          sessionOrder: activeSession.order,
          sessionDescription: activeSession.description || ""
        })
      });

      if (!res.ok) {
        throw new Error("Server failed generating study details for this session.");
      }

      const detailsByAI = await res.json();

      const path = `plans/${selectedPlan.id}/sessions/${activeSession.id}`;
      const fieldsToSave = {
        summary: detailsByAI.summary || "",
        notes: detailsByAI.notes || "",
        flashcards: detailsByAI.flashcards || [],
        videos: detailsByAI.videos || [],
        quiz: detailsByAI.quiz || []
      };

      await updateDoc(doc(db, path), fieldsToSave);

      const updatedSess = { ...activeSession, ...fieldsToSave } as LearningSession;
      setActiveSession(updatedSess);
      setSessions((prev) => prev.map((s) => s.id === activeSession.id ? updatedSess : s));

      // Track Session Content Generated (fire and forget)
      trackSessionContentGenerated(selectedPlan.id, activeSession.id, 'study-materials').catch(err => 
        console.error('[App] Session Content Generated tracking failed:', err)
      );

      alert("Wonderful! Session study materials have been compiled successfully.");
    } catch (err) {
      console.error("Error generating session study materials:", err);
      alert("Unable to generate details for this session. Please check your network or try again.");
    } finally {
      setIsGeneratingCurrent(false);
    }
  };

  // Completes a session and auto-generates materials for the next one sequentially
  const handleUnlockNextSession = async () => {
    if (!selectedPlan || !activeSession) return;

    const currentOrder = activeSession.order;
    const nextOrder = currentOrder + 1;

    // Check if there is a next session roadblock
    const nextSessionRoadblock = sessions.find(s => s.order === nextOrder);

    if (nextSessionRoadblock) {
      setIsGeneratingNext(true);
      
      try {
        // CALL GEMINI BACKEND TO GENERATE COMPLEX TUTORIAL FOR NEXT SESSION ON-DEMAND!
        const res = await fetch("/api/generate-session-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: selectedPlan.topic,
            sessionTitle: nextSessionRoadblock.title,
            sessionOrder: nextOrder,
            sessionDescription: nextSessionRoadblock.description || ""
          })
        });

        if (!res.ok) {
          throw new Error("Server failed generating study details for session: " + nextOrder);
        }

        const nextDetailsByAI = await res.json();

        // Save detailed study materials & unlock inside Firestore
        const nextPath = `plans/${selectedPlan.id}/sessions/${nextSessionRoadblock.id}`;
        const nextFieldsToSave = {
          status: 'unlocked' as const,
          summary: nextDetailsByAI.summary || "",
          notes: nextDetailsByAI.notes || "",
          flashcards: nextDetailsByAI.flashcards || [],
          videos: nextDetailsByAI.videos || [],
          quiz: nextDetailsByAI.quiz || []
        };

        await updateDoc(doc(db, nextPath), nextFieldsToSave);

        // Update overall study plan's progress values
        const planDocPath = `plans/${selectedPlan.id}`;
        await updateDoc(doc(db, planDocPath), {
          currentSessionNumber: nextOrder
        });

        // Sync local states
        const updatedNextSession = { ...nextSessionRoadblock, ...nextFieldsToSave } as LearningSession;
        setSessions(prev => prev.map(s => {
          if (s.id === activeSession.id) {
            return { ...s, status: 'completed' } as LearningSession;
          }
          if (s.id === nextSessionRoadblock.id) {
            return updatedNextSession;
          }
          return s;
        }));

        setSelectedPlan(prev => prev ? { ...prev, currentSessionNumber: nextOrder } : null);
        setActiveSession(updatedNextSession); // Transition seamlessly to the next study deck
        
        // Track Session Completed (fire and forget)
        trackSessionCompleted(selectedPlan.id, activeSession.id, activeSession.title).catch(err => 
          console.error('[App] Session Completed tracking failed:', err)
        );
        
        alert(`Awesome job clearing session ${currentOrder}! Session ${nextOrder} is now unlocked and fully documented.`);

      } catch (err) {
        console.error("Error unlocking lesson milestone:", err);
        alert("Unable to populate details for next session. Please check your network.");
      } finally {
        setIsGeneratingNext(false);
      }
    } else {
      // No next session exists - entire curriculum completed!
      try {
        const planDocPath = `plans/${selectedPlan.id}`;
        await updateDoc(doc(db, planDocPath), {
          completed: true
        });
        setSelectedPlan(prev => prev ? { ...prev, completed: true } : null);
        setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, status: 'completed' } as LearningSession : s));
        setActiveSession(null);
        setShowAnalysisOfPlanId(selectedPlan.id);
        
        // Track Course Completed (fire and forget)
        trackCourseCompleted(selectedPlan.id, selectedPlan.topic, selectedPlan.totalSessions).catch(err => 
          console.error('[App] Course Completed tracking failed:', err)
        );
        
        alert("🎉 INCREDIBLE ACHIEVEMENT! You have cleared all sequential evaluations and completed this entire curriculum!");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `plans/${selectedPlan.id}`);
      }
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <GraduationCap className="w-12 h-12 text-indigo-600 animate-pulse" />
          <p className="font-semibold text-gray-700 font-display text-lg">Waking up xLearn Engine...</p>
        </div>
      </div>
    );
  }

  // Not Logged In screen
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-6 text-white relative overflow-hidden font-sans">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-505/20 blur-3xl rounded-full pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-505/20 blur-3xl rounded-full pointer-events-none"></div>

        {/* Global Navigation Header */}
        <header className="max-w-7xl w-full mx-auto flex items-center justify-between pb-6 border-b border-white/5 z-10">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-2 rounded-xl text-white font-black shadow-lg">
              <GraduationCap className="w-6 h-6" />
            </div>
            <span className="font-bold text-xl font-display tracking-tight uppercase">xLearn</span>
          </div>
          <span className="text-white/40 text-xs font-mono">Cognitive Learning Suite v1.1</span>
        </header>

        {/* Main hero segment */}
        <main className="max-w-3xl w-full mx-auto text-center space-y-8 py-16 z-10">
          <div className="space-y-4">
            <span className="px-3.5 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-full uppercase tracking-wider font-mono border border-indigo-500/20 inline-flex items-center gap-1.5 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Guided Custom Curriculums
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold font-display tracking-tight text-white leading-tight">
              Learn <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500">Almost Anything</span>
              <br />
              Within Any Timeframe.
            </h1>
            <p className="text-gray-450 text-sm md:text-lg max-w-xl mx-auto leading-relaxed font-sans">
              Provide anything you want to study—from specific coding structures to complex athletic setups. xLearn builds a personalized interactive master class with detailed notes, flashcards, search-grounded true YouTube tutorials, and diagnostic quizzes.
            </p>
          </div>

          <div className="pt-4 flex flex-col items-center gap-4">
            <button
              onClick={handleSignIn}
              className="px-8 py-4 bg-white hover:bg-gray-100 text-slate-950 font-bold rounded-2xl shadow-xl transition-all hover:scale-103 cursor-pointer flex items-center justify-center gap-3 active:scale-100"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.91h6.63c-.29 1.5-.14 3.03-.97 4.19l3.19 2.47c1.86-1.72 2.9-4.25 2.9-7.5z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.19-2.47c-1.39.93-3.16 1.47-4.77 1.47-3.66 0-6.76-2.47-7.87-5.8H1.05v2.54C3.04 20.8 7.28 24 12 24z" />
                <path fill="#FBBC05" d="M4.13 14.29a7.14 7.14 0 0 1 0-4.58V7.17H1.05a11.96 11.96 0 0 0 0 9.66l3.08-2.54z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.28 0 3.04 3.2 1.05 7.17l3.08 2.54c1.11-3.33 4.21-5.96 7.87-5.96z" />
              </svg>
              Establish Learning Lab with Google
            </button>
            <p className="text-xs text-gray-500">Google accounts are integrated via secure Firebase protocols.</p>
          </div>
        </main>

        <footer className="text-center text-xs text-white/30 pt-6 border-t border-white/5 font-mono max-w-7xl w-full mx-auto z-10 font-medium">
          Secure Sandboxed Cloud Environment • Google Cloud Run Ingress routing active
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 text-gray-900 flex flex-col font-sans" id="xlearn-app">
      {/* Global Dashboard Navigation header */}
      <header className="bg-white border-b border-gray-100 py-4 px-6 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSelectedPlan(null); setActiveSession(null); setCurrentTab('plans'); }}>
            <div className="bg-indigo-600 p-2 rounded-xl text-white font-black shadow-md shadow-indigo-600/10">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg font-display tracking-tight uppercase block leading-none">xLearn</span>
              <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5">Study Room Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-1 select-none">
              <button
                onClick={() => { setSelectedPlan(null); setActiveSession(null); setCurrentTab('plans'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  currentTab === 'plans' && !selectedPlan 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                Curriculum Lab
              </button>
              <button
                onClick={() => { setSelectedPlan(null); setActiveSession(null); setCurrentTab('coach'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  currentTab === 'coach' 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                AI Performance Coach
              </button>
            </nav>

            <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
              <img 
                src={user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"} 
                alt="Profile photo" 
                className="w-7 h-7 rounded-lg border border-gray-100 object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="text-xs font-semibold text-gray-700 hidden md:block max-w-[120px] truncate">
                {user.displayName || user.email}
              </span>
              <button 
                onClick={handleSignOut}
                className="p-1 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-white cursor-pointer transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 flex-1">
        {selectedPlan ? (
          // Active Plan Workspace Detail View
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200/60 pb-5 gap-4">
              <div>
                <button
                  onClick={() => { setSelectedPlan(null); setActiveSession(null); }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 py-1 mb-2 font-display cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Close Classroom Space
                </button>
                <h1 className="text-2xl md:text-3xl font-extrabold font-display text-gray-900 tracking-tight leading-none">
                  {selectedPlan.topic}
                </h1>
                <p className="text-xs text-gray-500 mt-2 font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  Target timeframe: {selectedPlan.timeframe}
                </p>
              </div>

              {selectedPlan.completed && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start">
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-150 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider font-mono shadow-xs">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                    Completed Course!
                  </div>
                  <button
                    onClick={() => setShowAnalysisOfPlanId(selectedPlan.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 font-sans"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    View AI Performance Graduation Page
                  </button>
                </div>
              )}
            </div>

            {showAnalysisOfPlanId === selectedPlan.id ? (
              <CourseAnalysisPage
                plan={selectedPlan}
                sessions={sessions}
                onBack={() => setShowAnalysisOfPlanId(null)}
              />
            ) : activeSession ? (
              // Active detailed Study session component
              <ActiveSessionStudy
                session={activeSession}
                onGoBack={() => setActiveSession(null)}
                onUpdateSessionData={handleUpdateSessionData}
                onUnlockNextSession={handleUnlockNextSession}
                isGeneratingNext={isGeneratingNext}
                onGenerateSessionContent={handleGenerateCurrentSession}
                isGeneratingCurrent={isGeneratingCurrent}
                sessions={sessions}
                onGoToSession={(sess) => setActiveSession(sess)}
              />
            ) : selectedPlan.type === "hobby" || selectedPlan.type === "curiosity" ? (
              // Simple Detailed Explanation rendering
              <HobbyCuriosityPlan plan={selectedPlan} />
            ) : (
              // Skill/Academic Roadmaps list details
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs lg:col-span-8 space-y-6">
                  <div>
                    <h3 className="font-bold text-gray-950 text-lg font-display tracking-tight flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                      Sequential Milestone Roadmap
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">Unlock nodes and take evaluation tests chronologically to complete curriculum.</p>
                  </div>

                  {sessionsLoading ? (
                    <div className="space-y-4 py-6">
                      <div className="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
                      <div className="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
                      <div className="h-10 bg-gray-100 rounded-xl animate-pulse"></div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      {sessions.map((s, index) => {
                        const isUnlocked = s.status === "unlocked" || s.status === "completed";
                        const isCompleted = s.status === "completed";
                        
                        return (
                          <div 
                            key={s.id} 
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl transition-all gap-4 ${
                              s.status === 'completed'
                                ? "bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/40"
                                : s.status === 'unlocked'
                                ? "bg-indigo-50/10 border-indigo-150 hover:bg-indigo-50/25 ring-2 ring-indigo-500/5"
                                : "bg-gray-50/50 border-gray-150 opacity-60"
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                              ) : isUnlocked ? (
                                <Circle className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                              ) : (
                                <Lock className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                              )}
                              <div>
                                <h4 className="font-bold text-sm text-gray-900 leading-snug font-display flex items-center gap-2">
                                  Session {s.order}: {s.title}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1 max-w-md font-sans">
                                  {s.description || "Synthesizing dynamic learning milestones..."}
                                </p>
                              </div>
                            </div>

                            {isUnlocked ? (
                              <button
                                onClick={() => setActiveSession(s)}
                                className={`px-4 py-2 font-display text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs uppercase tracking-wider ${
                                  isCompleted 
                                    ? "bg-white text-emerald-700 hover:bg-gray-100 border border-emerald-100" 
                                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                                }`}
                              >
                                {isCompleted ? "Revisit Session" : "Start Session"}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 uppercase tracking-widest font-mono font-bold pr-2 flex items-center gap-1.5 self-start sm:self-center">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 font-display">Target Syllabus</h3>
                    <p className="text-xs text-gray-400 mt-1">Status values are updated live.</p>
                  </div>
                  <div className="space-y-3 font-mono text-xs text-gray-500">
                    <div className="flex items-center justify-between">
                      <span>Curriculum Type</span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md uppercase">{selectedPlan.type}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Timeframe</span>
                      <span className="font-medium text-gray-700">{selectedPlan.timeframe}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Completed Steps</span>
                      <span className="font-medium text-gray-700">
                        {sessions.filter(s => s.status === 'completed').length} / {selectedPlan.totalSessions}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : currentTab === 'coach' ? (
          // Coach tab routing
          <AIPerformanceCoach userId={user.uid} plans={plans} />
        ) : (
          // Plans hub workspace home dashboard listing
          <div className="space-y-8 animate-fade-in">
            {/* Quick Stats banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-200 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 font-display flex items-center gap-1.5">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Your Learn Laboratory
                </h2>
                <p className="text-xs text-gray-500 mt-1 max-w-md font-sans">
                  Construct chronological curriculums on any topics. Click Enter Classroom to launch course workspace studies.
                </p>
              </div>

              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 cursor-pointer self-start md:self-center font-display tracking-wide uppercase"
              >
                <Plus className="w-4 h-4" />
                Initialize New Course
              </button>
            </div>

            {/* Empty States / Grid list */}
            {plansLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="h-44 bg-gray-100 rounded-2xl animate-pulse"></div>
                <div className="h-44 bg-gray-100 rounded-2xl animate-pulse"></div>
                <div className="h-44 bg-gray-100 rounded-2xl animate-pulse"></div>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-xs max-w-xl mx-auto space-y-4">
                <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
                <div>
                  <h3 className="font-semibold text-gray-900 font-display">No study plans created yet</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Type what you want to study under any specified timeframe below to begin your personalized learning path.
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-103 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Create Plan Outline
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((p) => {
                  const completePct = p.totalSessions > 0 ? Math.round((p.currentSessionNumber / p.totalSessions) * 100) : 100;

                  return (
                    <div 
                      key={p.id} 
                      className="bg-white border hover:border-indigo-200 rounded-2xl p-5 hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer relative"
                      onClick={() => handleOpenPlan(p)}
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.type === 'skill' || p.type === 'academic' 
                              ? 'bg-blue-50 text-blue-700' 
                              : 'bg-violet-50 text-violet-700'
                          }`}>
                            {p.type}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 font-medium">{p.timeframe} Duration</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-gray-900 font-display line-clamp-1 group-hover:text-indigo-950 transition-colors">
                            {p.topic}
                          </h4>
                        </div>
                      </div>

                      <div className="pt-5 mt-5 border-t border-gray-100 flex items-center justify-between gap-4">
                        {p.type === "hobby" || p.type === "curiosity" ? (
                          <span className="text-[10px] font-mono font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase">Curiosity Ready</span>
                        ) : (
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono text-gray-500">
                              <span>Progression</span>
                              <span>{p.completed ? "100%" : `${completePct}%`}</span>
                            </div>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div style={{ width: `${completePct}%` }} className="h-full bg-indigo-600 rounded-full"></div>
                            </div>
                          </div>
                        )}

                        <span className="text-xs text-indigo-600 font-bold flex items-center gap-0.5 shrink-0 font-display group-hover:translate-x-0.5 transition-transform">
                          Enter Classroom
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Creation Modal Workspace */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-100 p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            {isGenerating ? (
              // AI Plan Generation sequence loader
              <div className="text-center py-8 space-y-6 animate-fade-in select-none">
                <GraduationCap className="w-12 h-12 text-indigo-600 animate-bounce mx-auto" />
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-900 font-display text-lg">xLearn Research AI Active</h3>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto">Researching curriculum plans, sourcing authentic YouTube assets, and building quizes.</p>
                </div>
                <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl font-mono text-xs text-indigo-500 h-16 flex items-center justify-center leading-relaxed">
                  {genStep}
                </div>
              </div>
            ) : (
              // Form Content
              <>
                <div>
                  <h3 className="text-xl font-extrabold font-display tracking-tight text-gray-900">Custom Syllabus Generator</h3>
                  <p className="text-xs text-gray-500 mt-1">Research on any topic instantly with personalized session milestones.</p>
                </div>

                <form onSubmit={handleCreatePlan} className="space-y-4">
                  {/* Topic name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 font-display uppercase tracking-wider block">What would you like to study?</label>
                    <input
                      type="text"
                      className="w-full text-sm p-3 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-hidden text-gray-900 font-medium"
                      placeholder="e.g. Master React Hooks, Beginner Woodworking, WW2 History"
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      required
                    />
                  </div>

                  {/* Classification */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 font-display uppercase tracking-wider block">Course Type</label>
                      <select
                        className="w-full text-sm p-3 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-hidden text-gray-900 bg-white font-medium cursor-pointer"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as PlanType)}
                      >
                        <option value="skill">Academic / Skill</option>
                        <option value="academic">Academic Topic</option>
                        <option value="hobby">Hobby Practice</option>
                        <option value="curiosity">General Curiosity</option>
                      </select>
                    </div>

                    {/* Timeframe */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 font-display uppercase tracking-wider block">Target Timeline</label>
                      <select
                        className="w-full text-sm p-3 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-hidden text-gray-900 bg-white font-medium cursor-pointer"
                        value={newTimeframe}
                        onChange={(e) => setNewTimeframe(e.target.value)}
                      >
                        <option value="5 minutes">5 minutes</option>
                        <option value="2 hours">2 hours</option>
                        <option value="1 day">1 day</option>
                        <option value="1 week">1 week</option>
                        <option value="2 weeks">2 weeks</option>
                        <option value="1 month">1 month</option>
                        <option value="3 months">3 months</option>
                      </select>
                    </div>
                  </div>

                  {/* Warning Notice */}
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex gap-2.5 text-[11px] text-indigo-900 leading-normal">
                    <Clock className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>Academic / Skill structures will generate an interactive chronological roadmap of sessions requiring quiz milestones to unlock details.</span>
                  </div>

                  {/* Actions buttons */}
                  <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-md active:translate-y-0 hover:-translate-y-0.5 transition-all"
                    >
                      Build Course
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
