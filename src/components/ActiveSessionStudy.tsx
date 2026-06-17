import React, { useState, useEffect } from "react";
import { 
  BookOpen, Layers, Video, FileQuestion, ChevronLeft, ChevronRight, 
  RotateCw, AlertCircle, CheckCircle, ExternalLink, Play, Lock, BookMarked, Sparkles,
  ArrowRight, Check
} from "lucide-react";
import { LearningSession, Flashcard, QuizQuestion, VideoItem } from "../types";
import { CompactMarkdown } from "./HobbyCuriosityPlan";
import { trackQuizSubmitted } from "../utils/pendo";

interface ActiveSessionStudyProps {
  session: LearningSession;
  onGoBack: () => void;
  onUpdateSessionData: (updatedSession: Partial<LearningSession>) => Promise<void>;
  onUnlockNextSession: () => Promise<void>;
  isGeneratingNext: boolean;
  onGenerateSessionContent: () => Promise<void>;
  isGeneratingCurrent: boolean;
  sessions: LearningSession[];
  onGoToSession: (session: LearningSession) => void;
}

const getYouTubeEmbedUrl = (url?: string): string | null => {
  if (!url) return null;
  try {
    if (url.includes('youtube.com/watch')) {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }
    if (url.includes('youtu.be/')) {
      const parts = url.split('youtu.be/');
      const videoIdWithParams = parts[1];
      if (videoIdWithParams) {
        const videoId = videoIdWithParams.split('?')[0];
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    if (url.includes('youtube.com/embed/')) {
      return url;
    }
    if (url.includes('youtube.com/shorts/')) {
      const parts = url.split('youtube.com/shorts/');
      const videoIdWithParams = parts[1];
      if (videoIdWithParams) {
        const videoId = videoIdWithParams.split('?')[0];
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch (e) {
    console.error("Failed to parse YouTube URL", url, e);
  }
  return null;
};

export default function ActiveSessionStudy({ 
  session, 
  onGoBack, 
  onUpdateSessionData, 
  onUnlockNextSession,
  isGeneratingNext,
  onGenerateSessionContent,
  isGeneratingCurrent,
  sessions,
  onGoToSession
}: ActiveSessionStudyProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'flashcards' | 'videos' | 'quiz'>('notes');
  
  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>(new Array(5).fill(-1));
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Initialize state based on historical session load
  useEffect(() => {
    if (session.quizCompleted) {
      setQuizSubmitted(true);
      setQuizScore(session.quizScore || 0);
      if (session.userQuizAnswers) {
        setSelectedAnswers(session.userQuizAnswers);
      }
    } else {
      setQuizSubmitted(false);
      setQuizScore(0);
      setSelectedAnswers(new Array(5).fill(-1));
    }
    setCurrentCardIndex(0);
    setIsFlipped(false);
  }, [session.id]);

  const flashcardsList: Flashcard[] = session.flashcards || [];
  const videosList: VideoItem[] = session.videos || [];
  const quizList: QuizQuestion[] = session.quiz || [];

  const handleNextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev + 1) % flashcardsList.length);
    }, 150);
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentCardIndex((prev) => (prev - 1 + flashcardsList.length) % flashcardsList.length);
    }, 150);
  };

  const handleSelectOption = (qIdx: number, optionIdx: number) => {
    if (quizSubmitted) return; // Cant revise after submission
    const newAnswers = [...selectedAnswers];
    newAnswers[qIdx] = optionIdx;
    setSelectedAnswers(newAnswers);
  };

  const handleSubmitQuiz = async () => {
    if (selectedAnswers.includes(-1)) {
      alert("Please answer all 5 questions before submitting.");
      return;
    }

    let score = 0;
    quizList.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswerIndex) {
        score++;
      }
    });

    setQuizScore(score);
    setQuizSubmitted(true);

    // Save session quiz stats to Firestore
    await onUpdateSessionData({
      quizCompleted: true,
      quizScore: score,
      userQuizAnswers: selectedAnswers
    });

    // Track Quiz Submitted
    trackQuizSubmitted(session.planId || '', session.id, score, quizList.length);
  };

  const handleCompleteSession = async () => {
    // Set status to complete
    await onUpdateSessionData({
      status: 'completed'
    });
    // Trigger outline unlocking the next session on parent
    await onUnlockNextSession();
  };

  const areMaterialsGenerated = !!(session.notes && session.notes.trim()) && flashcardsList.length > 0 && quizList.length > 0;
  const isQuizReadyToSubmit = !selectedAnswers.includes(-1) && !quizSubmitted;

  return (
    <div className="space-y-6 animate-fade-in" id="active-session-study">
      {/* Upper header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <button
          onClick={onGoBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors duration-150 py-1 font-medium cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Outline
        </button>
        <div className="flex items-center gap-4">
          {areMaterialsGenerated ? (
            <button
              onClick={onGenerateSessionContent}
              disabled={isGeneratingCurrent}
              className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border border-gray-150 transition-colors ${
                isGeneratingCurrent
                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-500 hover:text-indigo-650 hover:border-indigo-150 cursor-pointer'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isGeneratingCurrent ? 'animate-spin text-indigo-600' : ''}`} />
              {isGeneratingCurrent ? "Regenerating..." : "Regenerate Content"}
            </button>
          ) : (
            <button
              onClick={onGenerateSessionContent}
              disabled={isGeneratingCurrent}
              className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border transition-colors ${
                isGeneratingCurrent
                  ? 'bg-gray-100 border-gray-250 text-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 cursor-pointer shadow-xs'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGeneratingCurrent ? 'animate-pulse text-indigo-300' : ''}`} />
              {isGeneratingCurrent ? "Generating..." : "Generate Session Content"}
            </button>
          )}
          <div className="flex items-center gap-2 font-mono">
            <span className="text-xs text-gray-400">SESSION #{session.order}</span>
            <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full"></span>
            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${
              session.status === 'completed' 
                ? 'bg-emerald-50 text-emerald-700' 
                : 'bg-indigo-50 text-indigo-700'
            }`}>
              {session.status}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Course Workspace (Left Column) */}
        <div className="lg:col-span-8 bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
          {/* Top Tabs */}
          <div className="flex border-b border-gray-100 bg-gray-50/70 p-1.5 gap-1 select-none">
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-3 px-3 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'notes' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Notes
            </button>
            <button
              onClick={() => setActiveTab('flashcards')}
              className={`flex-1 py-3 px-3 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'flashcards' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              Flashcards
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex-1 py-3 px-3 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'videos' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <Video className="w-4 h-4" />
              Videos
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className={`flex-1 py-3 px-3 rounded-lg text-xs md:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'quiz' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
              }`}
            >
              <FileQuestion className="w-4 h-4" />
              Evaluation Quiz
            </button>
          </div>

          {/* Tab Panes */}
          <div className="p-6 md:p-8 flex-1">
            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4 animate-fade-in">
                {session.notes?.trim() ? (
                  <>
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50 mb-6 font-sans">
                      <h4 className="font-semibold text-indigo-950 text-sm flex items-center gap-1.5 font-display">
                        <BookMarked className="w-4 h-4" />
                        Interactive Study Objective
                      </h4>
                      <p className="text-xs text-indigo-900 mt-1 leading-relaxed">
                        {session.summary || "Review dynamic study guides built for your specific timeline."}
                      </p>
                    </div>
                    <CompactMarkdown content={session.notes || ""} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                    <BookOpen className="w-8 h-8 text-indigo-500 animate-pulse" />
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm font-display">Study Guides Not Generated</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        Notes, summaries, and customized guides have not been compiled for this lesson yet.
                      </p>
                    </div>
                    <button
                      onClick={onGenerateSessionContent}
                      disabled={isGeneratingCurrent}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all font-sans"
                    >
                      {isGeneratingCurrent ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Compiling Notes...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Custom study guides
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Flashcards Tab */}
            {activeTab === 'flashcards' && (
              <div className="space-y-8 animate-fade-in flex flex-col items-center justify-center py-6">
                {flashcardsList.length > 0 ? (
                  <>
                    <p className="text-xs text-gray-400 font-mono">
                      Click card to flip
                    </p>

                    {/* Flippable Card Container */}
                    <div 
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="w-full max-w-md h-64 cursor-pointer select-none relative group"
                      style={{ perspective: "1000px" }}
                    >
                      {/* Inner Container that rotates */}
                      <div 
                        className="w-full h-full relative transition-transform duration-500"
                        style={{ 
                          transformStyle: "preserve-3d",
                          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)"
                        }}
                      >
                        {/* Front Side */}
                        <div 
                          className="absolute inset-0 bg-white rounded-2xl border-2 border-gray-250 hover:border-indigo-300 p-8 flex flex-col items-center justify-center text-center shadow-md transition-all duration-300"
                          style={{ 
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden"
                          }}
                        >
                          <div className="space-y-4">
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 bg-gray-100 text-gray-500 font-bold rounded-full">
                              Question Panel
                            </span>
                            <p className="text-lg font-bold text-gray-900 font-display leading-snug">
                              {flashcardsList[currentCardIndex].question}
                            </p>
                          </div>
                          <div className="absolute bottom-4 text-gray-300 group-hover:text-indigo-400 transition-colors">
                            <RotateCw className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Back Side */}
                        <div 
                          className="absolute inset-0 bg-white rounded-2xl border-2 border-indigo-500 bg-indigo-50/10 p-8 flex flex-col items-center justify-center text-center shadow-md transition-all duration-300"
                          style={{ 
                            backfaceVisibility: "hidden",
                            WebkitBackfaceVisibility: "hidden",
                            transform: "rotateY(180deg)"
                          }}
                        >
                          <div className="space-y-4">
                            <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full">
                              Review Answer
                            </span>
                            <p className="text-base text-gray-700 leading-relaxed font-sans font-medium">
                              {flashcardsList[currentCardIndex].answer}
                            </p>
                          </div>
                          <div className="absolute bottom-4 text-indigo-400">
                            <RotateCw className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center gap-6 mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePrevCard(); }}
                        className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <span className="text-sm font-mono font-medium text-gray-500">
                        {currentCardIndex + 1} / {flashcardsList.length}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleNextCard(); }}
                        className="p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 w-full max-w-md font-sans">
                    <Layers className="w-8 h-8 text-indigo-500 animate-pulse" />
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm font-display">Flashcards Not Compiled Yet</h4>
                      <p className="text-xs text-gray-500 mt-1 max-w-sm">
                        AI-curated mnemonic devices and review items have not been generated for this session yet.
                      </p>
                    </div>
                    <button
                      onClick={onGenerateSessionContent}
                      disabled={isGeneratingCurrent}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all font-sans"
                    >
                      {isGeneratingCurrent ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Building Cards...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate Custom Cards
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Videos Tab */}
            {activeTab === 'videos' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="font-bold text-gray-800 font-display">Sourced YouTube Tutorials</h3>
                  <p className="text-xs text-gray-400 mt-1">Real-time educational video recommendations provided via search grounding.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {videosList.length > 0 ? (
                    videosList.map((vid, ix) => {
                      const embedUrl = getYouTubeEmbedUrl(vid.url);
                      return (
                        <div
                          key={ix}
                          className="flex flex-col bg-gray-50 border border-gray-150 rounded-2xl overflow-hidden transition-all duration-200 shadow-xs hover:border-indigo-200"
                        >
                          {embedUrl ? (
                            <div className="aspect-video w-full bg-black relative">
                              <iframe
                                src={embedUrl}
                                title={vid.title}
                                className="absolute inset-0 w-full h-full border-0 animate-fade-in"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              ></iframe>
                            </div>
                          ) : (
                            <div className="aspect-video w-full bg-slate-900 flex items-center justify-center p-4 text-center">
                              <Play className="w-8 h-8 text-white opacity-80" />
                            </div>
                          )}
                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div className="space-y-1.5">
                              <h4 className="font-semibold text-xs md:text-sm text-gray-800 line-clamp-2 leading-snug font-display">
                                {vid.title}
                              </h4>
                              {vid.description && (
                                <p className="text-[11px] text-gray-550 line-clamp-2 leading-relaxed font-sans mt-1">
                                  {vid.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-gray-150 text-[10px] font-mono text-gray-400 uppercase">
                              <span>Duration: {vid.duration || 'Unknown'}</span>
                              <a
                                href={vid.url}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold cursor-pointer"
                              >
                                YouTube Link
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 font-sans">
                      <Video className="w-8 h-8 text-indigo-500 animate-pulse" />
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm font-display">Videos Not Curated Yet</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm font-sans">
                          Sourced dynamic YouTube tutorials grounded in real searches have not been compiled for this section yet.
                        </p>
                      </div>
                      <button
                        onClick={onGenerateSessionContent}
                        disabled={isGeneratingCurrent}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all font-sans"
                      >
                        {isGeneratingCurrent ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            Curating Videos...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Curation Clips via Search
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quiz Tab */}
            {activeTab === 'quiz' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 font-display text-lg">Active Concept Check</h3>
                    <p className="text-xs text-gray-400 mt-1">Answer 5 high-yield multiple choice questions to confirm mastery.</p>
                  </div>
                  {quizSubmitted && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full font-mono">
                      Score: {quizScore} / 5 ({Math.round((quizScore/5)*100)}%)
                    </div>
                  )}
                </div>

                <div className="space-y-8">
                  {quizList.length > 0 ? (
                    quizList.map((q, qIndex) => {
                      const userChoice = selectedAnswers[qIndex];
                      const isCorrect = userChoice === q.correctAnswerIndex;
                      
                      return (
                        <div key={qIndex} className="space-y-3 p-5 rounded-2xl bg-gray-50/50 border border-gray-100">
                          <h4 className="font-medium text-sm md:text-base text-gray-800 flex gap-2">
                            <span className="font-mono text-xs px-2 py-0.5 bg-gray-100 rounded-md h-5 flex items-center justify-center text-gray-500">Q{qIndex+1}</span>
                            <span className="font-display font-semibold leading-tight">{q.question}</span>
                          </h4>

                          {/* Options list */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {q.options.map((opt, oIdx) => {
                              const isSelected = userChoice === oIdx;
                              let btnClass = "bg-white border-gray-200 hover:border-gray-300 text-gray-700";
                              
                              if (quizSubmitted) {
                                if (oIdx === q.correctAnswerIndex) {
                                  btnClass = "bg-emerald-50 border-emerald-300 text-emerald-950 font-medium";
                                } else if (isSelected) {
                                  btnClass = "bg-rose-50 border-rose-300 text-rose-950";
                                } else {
                                  btnClass = "bg-white border-gray-150 text-gray-400 opacity-60";
                                }
                              } else if (isSelected) {
                                btnClass = "bg-indigo-50 border-indigo-500 text-indigo-950 font-semibold ring-2 ring-indigo-500/20";
                              }

                              return (
                                <button
                                  key={oIdx}
                                  onClick={() => handleSelectOption(qIndex, oIdx)}
                                  className={`p-3.5 rounded-xl border text-left text-xs md:text-sm transition-all text-gray-750 flex items-center gap-3 ${btnClass} ${
                                    !quizSubmitted ? "cursor-pointer hover:bg-gray-100/50" : "cursor-default"
                                  }`}
                                >
                                  <span className="w-5 h-5 rounded-full border border-gray-200 bg-gray-50 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {String.fromCharCode(65 + oIdx)}
                                  </span>
                                  <span className="leading-snug">{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Quiz Explanation area */}
                          {quizSubmitted && (
                            <div className={`mt-3 p-3.5 rounded-xl text-xs md:text-sm leading-relaxed border flex gap-2.5 ${
                              isCorrect 
                                ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' 
                                : 'bg-amber-50/50 border-amber-100/50 text-amber-900'
                            }`}>
                              {isCorrect ? (
                                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                              )}
                              <div>
                                <p className="font-semibold text-xs uppercase tracking-wider">
                                  {isCorrect ? "Correct Concept!" : "Training Insight:"}
                                </p>
                                <p className="mt-1 font-sans">{q.explanation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 font-sans">
                      <FileQuestion className="w-8 h-8 text-indigo-500 animate-pulse" />
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm font-display">Evaluation Quiz Not Generated</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm font-sans">
                          A custom diagnostic check with 5 high-yield multiple-choice questions has not been generated for this lesson yet.
                        </p>
                      </div>
                      <button
                        onClick={onGenerateSessionContent}
                        disabled={isGeneratingCurrent}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all font-sans"
                      >
                        {isGeneratingCurrent ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            Compiling Diagnostic Quiz...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Generate Diagnostic Quiz
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Quiz actions */}
                {!quizSubmitted && quizList.length > 0 && (
                  <div className="pt-4 flex justify-end border-t border-gray-100">
                    <button
                      onClick={handleSubmitQuiz}
                      disabled={!isQuizReadyToSubmit}
                      className={`px-6 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all ${
                        isQuizReadyToSubmit 
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Submit Evaluation answers
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Workspace Footer Navigation */}
          {(() => {
            const nextSession = sessions.find(s => s.order === session.order + 1);
            if (nextSession) {
              return (
                <div className="border-t border-gray-150 bg-gray-50/50 p-5 px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-sans border-b rounded-b-2xl">
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 font-mono">Up Next</span>
                    <h4 className="text-xs md:text-sm font-semibold text-gray-800 line-clamp-1 font-display">
                      Session {nextSession.order}: {nextSession.title}
                    </h4>
                  </div>

                  {session.status === 'completed' ? (
                    <button
                      onClick={() => onGoToSession(nextSession)}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer font-sans"
                    >
                      Proceed to Next Session
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={handleCompleteSession}
                      disabled={!session.quizCompleted || isGeneratingNext}
                      className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        session.quizCompleted && !isGeneratingNext
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:-translate-y-0.5 active:translate-y-0 cursor-pointer lg:scale-101'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isGeneratingNext ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Unlocking Session...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Complete & Unlock Next
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            } else {
              return (
                <div className="border-t border-gray-150 bg-emerald-55/10 p-5 px-6 md:px-8 flex items-center justify-between gap-4 font-sans rounded-b-2xl">
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 font-mono">Final Milestone</span>
                    <h4 className="text-xs md:text-sm font-semibold text-gray-800 font-display">
                      You are studying the final session of this educational roadmap!
                    </h4>
                  </div>
                  {session.status !== 'completed' && (
                    <button
                      onClick={handleCompleteSession}
                      disabled={!session.quizCompleted || isGeneratingNext}
                      className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        session.quizCompleted && !isGeneratingNext
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:-translate-y-0.5 active:translate-y-0 cursor-pointer'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {isGeneratingNext ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Complete Course
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            }
          })()}
        </div>

        {/* Lesson Roadmap Tracking (Right Column) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-5">
            <div>
              <h3 className="font-semibold text-gray-900 font-display">Curriculum Progress</h3>
              <p className="text-xs text-gray-500 mt-1">Unlock sections sequentially by clearing evaluations.</p>
            </div>

            {/* Complete milestone CTA */}
            {session.status !== 'completed' ? (
              <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-xl text-center space-y-3">
                <p className="text-xs font-semibold text-indigo-900 font-display leading-snug">
                  Finish session's quiz to unlock the next session
                </p>
                <button
                  onClick={handleCompleteSession}
                  disabled={!session.quizCompleted || isGeneratingNext}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-1.5 ${
                    session.quizCompleted && !isGeneratingNext
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isGeneratingNext ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin"></div>
                      Generating Next Session...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Complete & Unlock Next
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl text-center space-y-2 text-emerald-900">
                <CheckCircle className="w-5 h-5 text-emerald-600 mx-auto" />
                <p className="text-xs font-semibold font-display">Lesson Milestones Complete!</p>
                <p className="text-[11px] opacity-80">You cleared this concept checklist successfully.</p>
              </div>
            )}

            {/* Quick checklist summary info */}
            <div className="pt-2 space-y-3 font-mono text-xs text-gray-500 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span>Quiz Checklist</span>
                <span className={session.quizCompleted ? "text-emerald-600 font-semibold" : "text-gray-400"}>
                  {session.quizCompleted ? "Passed" : "Incomplete"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Flashcard Items</span>
                <span>{flashcardsList.length} Cards available</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tutorial Curations</span>
                <span>{videosList.length} Sourced clips</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
