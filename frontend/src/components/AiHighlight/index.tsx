import { useEffect, useState, useRef, useCallback } from "react";
import type { UserProfile } from "../../types/profile";
import type { PortfolioRecommendation, MonteCarloPoint, ScenarioResult, StressEventResult } from "../../types";
import { apiUrl } from "../../lib/api";

export type AiHighlightContext = {
  profile?: UserProfile | null;
  portfolioInputs?: {
    tickers: string[];
    weights?: number[];
    investmentAmount: number;
    horizonYears: number;
    riskTolerance: number;
  } | null;
  portfolioResult?: PortfolioRecommendation | null;
  riskMetrics?: {
    sharpeRatio: number | null;
    var95: number | null;
  } | null;
  analytics?: {
    monteCarlo?: MonteCarloPoint[] | null;
    scenarios?: ScenarioResult[] | null;
    stressTests?: StressEventResult[] | null;
  } | null;
  currentScreen: string;
};

type Props = {
  context: AiHighlightContext;
};

export default function AiHighlight({ context }: Props) {
  const [selectionText, setSelectionText] = useState("");
  const [buttonPos, setButtonPos] = useState<{ top: number; left: number } | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [question, setQuestion] = useState("What does this mean?");
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dismissedRef = useRef(false);

  const dismissAll = useCallback(() => {
    dismissedRef.current = true;
    setShowPopover(false);
    setButtonPos(null);
    setSelectionText("");
    setExplanation("");
    setQuestion("What does this mean?");
    window.getSelection()?.removeAllRanges();
    // Reset dismiss flag after a short delay so future selections work
    setTimeout(() => { dismissedRef.current = false; }, 300);
  }, []);

  const handleMouseUp = useCallback(() => {
    setTimeout(() => {
      if (dismissedRef.current) return;

      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";

      if (text.length < 2 || text.length > 500) {
        if (!showPopover) {
          setButtonPos(null);
          setSelectionText("");
        }
        return;
      }

      const range = selection?.getRangeAt(0);
      if (!range) return;

      // Don't show if selection is inside a modal overlay (profile, AI popover, etc.)
      const container = range.commonAncestorContainer;
      const el = container instanceof HTMLElement ? container : container.parentElement;
      if (el?.closest(".profile-modal-backdrop, .profile-modal-card, .ai-highlight-popover")) {
        return;
      }

      // Get the rect of the end of the selection for precise positioning
      const rects = range.getClientRects();
      const lastRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();

      // Position button at the top-right corner of the highlighted text
      const top = Math.max(8, lastRect.top - 36);
      const left = Math.max(8, Math.min(lastRect.right + 8, window.innerWidth - 160));

      setSelectionText(text);
      setButtonPos({ top, left });
    }, 10);
  }, [showPopover]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (popoverRef.current?.contains(target)) return;
    if (buttonRef.current?.contains(target)) return;

    if (showPopover) {
      dismissAll();
    }
  }, [showPopover, dismissAll]);

  const handleScroll = useCallback(() => {
    if (buttonPos) {
      setButtonPos(null);
      setSelectionText("");
    }
    if (showPopover) {
      dismissAll();
    }
  }, [buttonPos, showPopover, dismissAll]);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleClickOutside);
    // Listen for scroll on capture phase to catch scrolls in any container
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [handleMouseUp, handleClickOutside, handleScroll]);

  const handleExplainClick = () => {
    if (!buttonPos) return;

    // Position popover: try to place it to the right of the button,
    // but clamp so it stays within the viewport
    const popLeft = Math.min(buttonPos.left, window.innerWidth - 384);
    const popTop = Math.max(8, Math.min(buttonPos.top, window.innerHeight - 400));

    setPopoverPos({ top: popTop, left: popLeft });
    setShowPopover(true);
    setButtonPos(null);
    setExplanation("");
    setQuestion("What does this mean?");
  };

  const handleSend = async () => {
    if (!selectionText || loading) return;

    setLoading(true);
    setExplanation("");

    const payload = {
      selectedText: selectionText,
      userQuestion: question,
      currentScreen: context.currentScreen,
      profile: context.profile ? {
        birthYear: context.profile.birthYear,
        income: context.profile.income,
        monthlySavings: context.profile.monthlySavings,
        jobTitle: context.profile.jobTitle,
        industry: context.profile.industry,
        riskTolerance: context.profile.riskTolerance,
        lifeGoal: context.profile.lifeGoal,
        idealRetirementAge: context.profile.idealRetirementAge,
        investorExperience: context.profile.investorExperience,
      } : null,
      portfolioInputs: context.portfolioInputs ?? null,
      portfolioResult: context.portfolioResult ? {
        funds: context.portfolioResult.funds,
        totalFutureValue: context.portfolioResult.totalFutureValue,
        totalFutureValueAfterTax: context.portfolioResult.totalFutureValueAfterTax,
        totalTaxOwed: context.portfolioResult.totalTaxOwed,
        taxRate: context.portfolioResult.taxRate,
      } : null,
      riskMetrics: context.riskMetrics ?? null,
      analytics: context.analytics ? {
        monteCarlo: context.analytics.monteCarlo ?? null,
        scenarios: context.analytics.scenarios?.map(s => ({
          label: s.label,
          value: s.value,
          desc: s.desc,
        })) ?? null,
        stressTests: context.analytics.stressTests?.map(s => ({
          label: s.label,
          period: s.period,
          marketDrawdownPct: s.marketDrawdownPct,
          portfolioDrawdownPct: s.portfolioDrawdownPct,
          startValue: s.startValue,
          troughValue: s.troughValue,
          endValue: s.endValue,
        })) ?? null,
      } : null,
    };

    try {
      const res = await fetch(apiUrl("/api/ai/explain-selection"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setExplanation(data.explanation);
    } catch (e) {
      setExplanation("Sorry, something went wrong. Please try again.");
      console.error("AI explain error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating "Explain with AI" button near selection */}
      {buttonPos && !showPopover && (
        <button
          ref={buttonRef}
          className="ai-highlight-btn"
          style={{
            position: "fixed",
            top: buttonPos.top,
            left: buttonPos.left,
            zIndex: 9999,
          }}
          onClick={handleExplainClick}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Explain with AI
        </button>
      )}

      {/* Popover panel */}
      {showPopover && popoverPos && (
        <div
          ref={popoverRef}
          className="ai-highlight-popover"
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 9999,
          }}
        >
          {/* Close button */}
          <button className="ai-highlight-popover-close" onClick={dismissAll}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Quoted selection */}
          <div className="ai-highlight-quote">
            "{selectionText.length > 120 ? selectionText.slice(0, 120) + "..." : selectionText}"
          </div>

          {/* Explanation area */}
          {loading && (
            <div className="ai-highlight-loading">
              <div className="ai-highlight-spinner" />
              <span>Thinking...</span>
            </div>
          )}

          {explanation && !loading && (
            <div className="ai-highlight-explanation">
              {explanation}
            </div>
          )}

          {/* Input field */}
          <div className="ai-highlight-input-row">
            <input
              className="ai-highlight-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this..."
              disabled={loading}
            />
            <button
              className="ai-highlight-send"
              onClick={handleSend}
              disabled={loading || !question.trim()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
