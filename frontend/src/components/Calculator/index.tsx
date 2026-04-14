import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  PortfolioRecommendation,
  PortfolioRequest,
  AnalyticsRequest,
  PortfolioPreset,
} from "../../types";
import type { UserProfile } from "../../types/profile";
import HeroSection from "./HeroSection";
import CalculatorForm from "./CalculatorForm";
import ResultsSection from "./ResultsSection";
import RiskMetricsSection from "./RiskMetricsSection";
import AiHighlight from "../AiHighlight";
import { fetchPortfolioPreset } from "../../services/presetService";
import { apiUrl } from "../../lib/api";

const SECTION_BGS = ["#ffffff", "#ffffff", "#0f172a", "#f8fafc"];
const SECTION_NAMES = ["hero", "form", "results", "riskMetrics"];
const RISK_FREE_RATE = 0.045;
const MARKET_VOLATILITY = 0.15;

const pageVariants = {
  enter: (dir: number) => ({ opacity: 0, y: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, y: 0 },
  exit: (dir: number) => ({ opacity: 0, y: dir > 0 ? -40 : 40 }),
};

const pageTrans = { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const };

function parseTickers(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}

function riskStringToSlider(value: "low" | "medium" | "high"): number {
  if (value === "low") return 0.17;
  if (value === "high") return 0.83;
  return 0.5;
}

type Props = {
  activeTab: string;
  onTabChange: (t: string) => void;
  initialSection?: number;
  onPortfolioSubmit?: (params: AnalyticsRequest, result?: PortfolioRecommendation) => void;
  profile?: UserProfile | null;
};

export default function Calculator({
  activeTab,
  onTabChange,
  initialSection = 0,
  onPortfolioSubmit,
  profile,
}: Props) {
  const [tickerText, setTickerText] = useState("VTI VXUS BND");
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [horizonYears, setHorizonYears] = useState(5);
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  const [result, setResult] = useState<PortfolioRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<PortfolioPreset | null>(null);

  const [sectionIdx, setSectionIdx] = useState(initialSection);
  const [direction, setDirection] = useState(1);

  const busy = useRef(false);
  const idxRef = useRef(initialSection);
  const lastNavTimeRef = useRef(0);
  const didLoadPresetRef = useRef(false);

  const tickers = useMemo(() => parseTickers(tickerText), [tickerText]);

  const maxSectionRef = useRef(1);
  maxSectionRef.current = result ? SECTION_BGS.length - 1 : 1;

  useEffect(() => {
    async function loadPreset() {
      if (!profile || didLoadPresetRef.current) return;

      try {
        const recommendedPreset = await fetchPortfolioPreset(profile);
        setPreset(recommendedPreset);
        setTickerText(recommendedPreset.tickers.join(" "));
        setRiskTolerance(riskStringToSlider(recommendedPreset.riskTolerance));
        didLoadPresetRef.current = true;
      } catch (e) {
        console.error("Failed to load preset:", e);
      }
    }

    loadPreset();
  }, [profile]);

  const goTo = useCallback((next: number) => {
    const cur = idxRef.current;
    if (next === cur || next < 0 || next > maxSectionRef.current || busy.current) {
      return;
    }

    busy.current = true;
    setDirection(next > cur ? 1 : -1);
    setSectionIdx(next);
    idxRef.current = next;

    setTimeout(() => {
      busy.current = false;
    }, 600);
  }, []);

  function handleSectionWheel(e: React.WheelEvent<HTMLDivElement>) {
    const container = e.currentTarget;
    if (busy.current) return;

    const now = Date.now();
    if (now - lastNavTimeRef.current < 650) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const remaining = scrollHeight - clientHeight - scrollTop;

    const atTop = scrollTop <= 24;
    const atBottom = remaining <= 24;
    const canScroll = scrollHeight > clientHeight + 4;

    if (e.deltaY > 0) {
      if (Math.abs(e.deltaY) < 25) return;
      if (canScroll && !atBottom) return;
      e.preventDefault();
      lastNavTimeRef.current = now;
      goTo(idxRef.current + 1);
    } else if (e.deltaY < 0) {
      if (Math.abs(e.deltaY) < 25) return;
      if (canScroll && !atTop) return;
      e.preventDefault();
      lastNavTimeRef.current = now;
      goTo(idxRef.current - 1);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "PageDown") goTo(idxRef.current + 1);
      if (e.key === "ArrowUp" || e.key === "PageUp") goTo(idxRef.current - 1);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo]);

  async function handleRecommend() {
    setLoading(true);
    setError(null);
    setResult(null);

    const payload: PortfolioRequest = {
      tickers,
      weights: preset?.tickers.join(" ") === tickerText.trim()
        ? preset.weights
        : undefined,
      riskTolerance,
      horizonYears,
      investmentAmount,
      income: profile?.income ?? null,
    };

    try {
      const res = await fetch(apiUrl("/api/portfolio/recommend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as PortfolioRecommendation;
      setResult(data);

      onPortfolioSubmit?.(
        { tickers, investmentAmount, horizonYears, riskTolerance },
        data,
      );

      setTimeout(() => goTo(2), 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const pages = [
    <HeroSection key="hero" onStartCalculating={() => goTo(1)} />,
    <CalculatorForm
      key="form"
      tickerText={tickerText}
      tickers={tickers}
      riskTolerance={riskTolerance}
      horizonYears={horizonYears}
      investmentAmount={investmentAmount}
      loading={loading}
      error={error}
      activeTab={activeTab}
      onTabChange={onTabChange}
      onTickerChange={setTickerText}
      onRiskChange={setRiskTolerance}
      onHorizonChange={setHorizonYears}
      onAmountChange={setInvestmentAmount}
      onSubmit={handleRecommend}
      result={result}
      profile={profile}
      preset={preset}
    />,
    <ResultsSection
      key="results"
      result={result}
      investmentAmount={investmentAmount}
      horizonYears={horizonYears}
      onScrollToForm={() => goTo(1)}
    />,
    <RiskMetricsSection
      key="risk"
      result={result}
      investmentAmount={investmentAmount}
    />,
  ];

  const sharpeRatio = result
    ? (result.funds.reduce((s, f) => s + f.expectedReturnRate * f.weight, 0) - RISK_FREE_RATE)
      / (result.funds.reduce((s, f) => s + f.beta * f.weight, 0) * MARKET_VOLATILITY)
    : null;

  const var95 = result
    ? investmentAmount * result.funds.reduce((s, f) => s + f.beta * f.weight, 0) * MARKET_VOLATILITY * 1.645
    : null;

  return (
    <motion.div
      style={{ position: "fixed", inset: 0, overflow: "hidden" }}
      animate={{ backgroundColor: SECTION_BGS[sectionIdx] }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <AiHighlight
        context={{
          profile: profile ?? null,
          portfolioInputs: {
            tickers,
            weights: preset?.tickers.join(" ") === tickerText.trim() ? preset.weights : undefined,
            investmentAmount,
            horizonYears,
            riskTolerance,
          },
          portfolioResult: result,
          riskMetrics: { sharpeRatio, var95 },
          analytics: null,
          currentScreen: SECTION_NAMES[sectionIdx] ?? "calculator",
        }}
      />
      <div
        style={{
          position: "fixed",
          right: 24,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 50,
        }}
      >
        {SECTION_BGS.slice(0, result ? SECTION_BGS.length : 2).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              padding: 0,
              background:
                i === sectionIdx
                  ? sectionIdx === 1 || sectionIdx === 3
                    ? "#2563eb"
                    : "#ffffff"
                  : sectionIdx === 1 || sectionIdx === 3
                  ? "rgba(37,99,235,0.25)"
                  : "rgba(255,255,255,0.35)",
              transition: "background 0.3s, transform 0.3s",
              transform: i === sectionIdx ? "scale(1.5)" : "scale(1)",
            }}
            aria-label={`Go to section ${i + 1}`}
          />
        ))}
      </div>

      <AnimatePresence custom={direction} mode="sync">
        <motion.div
          key={sectionIdx}
          custom={direction}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={pageTrans}
          onWheel={handleSectionWheel}
          style={{
            position: "absolute",
            inset: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {pages[sectionIdx]}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}