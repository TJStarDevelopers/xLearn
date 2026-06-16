import React from "react";
import { BookOpen, Video, ExternalLink, HelpCircle, Compass } from "lucide-react";
import { LearningPlan, VideoItem } from "../types";

interface HobbyCuriosityPlanProps {
  plan: LearningPlan;
}

// A smart, lightweight component to render markdown securely with beautiful Tailwind styles
export function CompactMarkdown({ content }: { content: string }) {
  if (!content) return null;

  // Split content by paragraphs/newlines
  const lines = content.split("\n");

  let inCodeBlock = false;
  let codeSnippet = "";

  return (
    <div className="space-y-4 text-gray-700 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Code block toggle
        if (trimmed.startsWith("```")) {
          if (inCodeBlock) {
            inCodeBlock = false;
            const currentCode = codeSnippet;
            codeSnippet = "";
            return (
              <pre key={idx} className="bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-xs overflow-x-auto shadow-inner border border-gray-800 my-4">
                <code>{currentCode}</code>
              </pre>
            );
          } else {
            inCodeBlock = true;
            return null;
          }
        }

        // Accumulate inside code block
        if (inCodeBlock) {
          codeSnippet += line + "\n";
          return null;
        }

        // Headers
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-lg font-semibold font-display text-gray-900 pt-3 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
              {trimmed.replace("### ", "")}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-xl font-bold font-display text-gray-900 border-b border-gray-100 pb-1 pt-4">
              {trimmed.replace("## ", "")}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-2xl font-extrabold font-display text-gray-900 pb-2 pt-4">
              {trimmed.replace("# ", "")}
            </h2>
          );
        }

        // Blockquotes
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={idx} className="border-l-4 border-indigo-200 bg-indigo-50/50 px-4 py-3 rounded-r-xl text-indigo-900 text-sm italic my-2">
              {trimmed.replace("> ", "")}
            </blockquote>
          );
        }

        // Lists
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const text = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-4 text-sm">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full shrink-0 mt-2"></span>
              <span>{renderInlineStyles(text)}</span>
            </div>
          );
        }

        // Numbered lists
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.\s(.*)/);
          const num = match ? match[1] : "1";
          const text = match ? match[2] : trimmed;
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-4 text-sm">
              <span className="font-mono text-xs font-bold text-indigo-500 shrink-0 mt-1">{num}.</span>
              <span>{renderInlineStyles(text)}</span>
            </div>
          );
        }

        // Empty lines
        if (trimmed === "") {
          return <div key={idx} className="h-2"></div>;
        }

        // Standard Paragraph
        return (
          <p key={idx} className="text-sm md:text-base leading-relaxed text-gray-600">
            {renderInlineStyles(line)}
          </p>
        );
      })}
    </div>
  );
}

// Parses **bold** and `code` tags inline
function renderInlineStyles(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded-md font-mono text-xs border border-gray-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function HobbyCuriosityPlan({ plan }: HobbyCuriosityPlanProps) {
  const videoList: VideoItem[] = plan.videos || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in" id="hobby-curiosity-plan">
      {/* Content Side */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-xs lg:col-span-8 space-y-6">
        <div className="flex items-start justify-between border-b border-gray-100 pb-5 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-violet-50 text-violet-700 text-xs font-semibold rounded-full uppercase tracking-wider flex items-center gap-1">
                <Compass className="w-3.5 h-3.5" />
                {plan.type}
              </span>
              <span className="text-xs text-gray-400 font-medium font-mono">{plan.timeframe} Duration</span>
            </div>
            <h2 className="text-2xl font-bold font-display tracking-tight text-gray-900">
              {plan.topic}
            </h2>
          </div>
          <div className="bg-gradient-to-tr from-violet-50 to-indigo-50 p-3 rounded-xl shrink-0 text-indigo-600 hidden sm:block">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Dynamic narrative */}
        <div className="prose max-w-none">
          <CompactMarkdown content={plan.explanation || ""} />
        </div>
      </div>

      {/* Videos Section */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 font-display flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-600" />
              Related Videos
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Curated resource videos sourced from research search grounding.
            </p>
          </div>

          <div className="space-y-4">
            {videoList.length > 0 ? (
              videoList.map((vid, idx) => (
                <a
                  key={idx}
                  href={vid.url}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  rel="noopener noreferrer"
                  className="group block p-4 bg-gray-50 hover:bg-indigo-50/50 border border-gray-100 hover:border-indigo-200 rounded-xl transition-all duration-200 text-left space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-medium text-sm text-gray-800 line-clamp-2 group-hover:text-indigo-950 font-display">
                      {vid.title}
                    </h4>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 shrink-0 mt-0.5" />
                  </div>
                  {vid.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {vid.description}
                    </p>
                  )}
                  {vid.duration && (
                    <span className="inline-block text-[10px] font-mono font-medium text-gray-400 group-hover:text-indigo-500 uppercase">
                      Duration: {vid.duration}
                    </span>
                  )}
                </a>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm italic">
                No videos selected for this topic yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
