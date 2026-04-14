import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type {
  AnalyticsRequest,
  PortfolioRecommendation,
  MonteCarloPoint,
  ScenarioResult,
  StressEventResult,
} from "../../types";
import type { UserProfile } from "../../types/profile";
import StressExplanationModal from "./StressExplanationModal";
import AiHighlight from "../AiHighlight";
import { apiUrl } from "../../lib/api";

type Props = {
  onTabChange: (t: string) => void;
  analyticsParams: AnalyticsRequest;
  profile?: UserProfile | null;
  portfolioResult?: PortfolioRecommendation | null;
};

function buildFeeChartData(
  result: PortfolioRecommendation,
  horizonYears: number
): { year: string; withFees: number; withoutFees: number }[] {
  const points: { year: string; withFees: number; withoutFees: number }[] = [];
  for (let y = 0; y <= horizonYears; y++) {
    let withFees = 0;
    let withoutFees = 0;
    for (const fund of result.funds) {
      const grossRate = fund.capmRate > 0 ? fund.capmRate : fund.expectedReturnRate;
      const netRate = grossRate - fund.expenseRatio;
      withoutFees += fund.principal * Math.pow(1 + grossRate, y);
      withFees += fund.principal * Math.pow(1 + netRate, y);
    }
    points.push({ year: `Y${y}`, withFees: Math.round(withFees), withoutFees: Math.round(withoutFees) });
  }
  return points;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function usd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatShortDate(value: string): string {
  return value.slice(0, 7);
}

function buildStressExplanation(event: StressEventResult): string {
  const moreResilient =
    Math.abs(event.portfolioDrawdownPct) < Math.abs(event.marketDrawdownPct);

  const downsideLine = moreResilient
    ? "The stress path falls less sharply than the broad market shock because your portfolio has lower estimated beta exposure."
    : "The stress path falls roughly in line with, or more than, the broad market shock because your portfolio has market-like or higher beta exposure.";

  return `${downsideLine} If markets had followed this crisis path, a starting portfolio of ${usd(
    event.startValue
  )} would have dropped to about ${usd(
    event.troughValue
  )} at the low point and ended the event window near ${usd(
    event.endValue
  )}. Over the same time period, a smooth normal projection would have reached about ${usd(
    event.normalEndValue
  )}, which highlights the gap between expected compounding and realized crisis behavior.`;
}

export default function Analytics({ onTabChange, analyticsParams, profile, portfolioResult }: Props) {
  const [mcData, setMcData] = useState<MonteCarloPoint[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
  const [stressEvents, setStressEvents] = useState<StressEventResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStressEvent, setSelectedStressEvent] =
    useState<StressEventResult | null>(null);

  useEffect(() => {
    setLoading(true);

    const body = JSON.stringify(analyticsParams);
    const headers = { "Content-Type": "application/json" };

    Promise.all([
      fetch(apiUrl("/api/analytics/montecarlo"), { method: "POST", headers, body }).then((r) => r.json()),
      fetch(apiUrl("/api/analytics/scenarios"), { method: "POST", headers, body }).then((r) => r.json()),
      fetch(apiUrl("/api/analytics/stress"), { method: "POST", headers, body }).then((r) => r.json()),
    ])
      .then(([mc, sc, stress]) => {
        setMcData(mc.data ?? []);
        setScenarios(sc.scenarios ?? []);
        setStressEvents(stress.events ?? []);
      })
      .catch((err) => {
        console.error("Analytics fetch failed:", err);
        setMcData([]);
        setScenarios([]);
        setStressEvents([]);
      })
      .finally(() => setLoading(false));
  }, [analyticsParams]);

  const feeChartData = useMemo(() => {
    if (!portfolioResult) return null;
    return buildFeeChartData(portfolioResult, analyticsParams.horizonYears);
  }, [portfolioResult, analyticsParams.horizonYears]);

  const totalFeeImpact = portfolioResult?.totalFeeImpact ?? 0;

  const stressExplanationBody = useMemo(() => {
    if (!selectedStressEvent) return "";
    return buildStressExplanation(selectedStressEvent);
  }, [selectedStressEvent]);

  return (
    <section className="section-analytics">
      <div className="section-inner">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          style={{ marginBottom: 48, display: "flex", justifyContent: "center" }}
        >
          <div className="glass-tab-switch switch-right">
            <div className="glass-tab-slider" />
            <button
              type="button"
              className="glass-tab-option"
              onClick={() => onTabChange("calculator")}
            >
              Calculator
            </button>
            <button type="button" className="glass-tab-option active">
              Advanced Analytics
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{ marginBottom: 56 }}
        >
          <p className="section-eyebrow-blue">Advanced Analytics</p>
          <h2 className="section-headline-dark" style={{ margin: "0 0 12px" }}>
            Deep portfolio insights
          </h2>
          <p className="section-subtext-muted" style={{ maxWidth: 620 }}>
            Monte Carlo simulation, scenario analysis, and historical stress testing
            using market history.
          </p>
        </motion.div>

        <div className="analytics-grid">
          <motion.div
            className="analytics-chart-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            <p className="risk-card-label">Monte Carlo Simulation</p>
            <span className="risk-badge-blue">
              1,000 simulations · {analyticsParams.horizonYears}-year horizon
            </span>

            <div style={{ flex: 1, minHeight: 0 }}>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#94a3b8",
                    fontSize: 14,
                  }}
                >
                  Loading simulation…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mcData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                    <XAxis
                      dataKey="year"
                      tickFormatter={(v) => `Yr ${v}`}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value, name) => [
                        typeof value === "number"
                          ? value.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })
                          : String(value ?? ""),
                        name === "p95"
                          ? "95th Percentile"
                          : name === "median"
                          ? "Median"
                          : "5th Percentile",
                      ]}
                      labelFormatter={(l) => `Year ${l}`}
                    />
                    <Line type="monotone" dataKey="p95" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="median" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="p5" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          <div className="scenario-cards-col">
            {loading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#94a3b8",
                  fontSize: 14,
                }}
              >
                Loading scenarios…
              </div>
            ) : (
              scenarios.map((s, i) => (
                <motion.div
                  key={s.id}
                  className={`scenario-card${s.featured ? " scenario-card--featured" : ""}`}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.12 + i * 0.08 }}
                >
                  <p className={`risk-card-label${s.featured ? " risk-card-label--white" : ""}`}>
                    {s.label}
                  </p>
                  <span className={s.badgeClass}>{s.badge}</span>
                  <p className={`analytics-scenario-value${s.featured ? " scenario-value-white" : " scenario-value-dark"}`}>
                    {s.value}
                  </p>
                  <p className={`risk-card-desc${s.featured ? " risk-card-desc--white" : ""}`}>
                    {s.desc}
                  </p>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {feeChartData && (
          <div style={{ marginTop: 56 }}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.12 }}
              style={{ marginBottom: 24 }}
            >
              <p className="section-eyebrow-blue">Expense Ratio Impact</p>
              <h3
                style={{
                  margin: "0 0 10px",
                  fontSize: "2rem",
                  lineHeight: 1.1,
                  color: "#0f172a",
                }}
              >
                How fees erode your returns
              </h3>
              <p className="section-subtext-muted" style={{ maxWidth: 620 }}>
                Compares portfolio growth with and without expense ratios over your
                {" "}{analyticsParams.horizonYears}-year horizon. Total fee drag:{" "}
                <strong style={{ color: "#f59e0b" }}>{usd(totalFeeImpact)}</strong>.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              style={{
                background: "#ffffff",
                borderRadius: 24,
                border: "1px solid rgba(15,23,42,0.06)",
                boxShadow: "0 18px 48px rgba(15,23,42,0.06)",
                padding: 24,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 300,
                  background: "#f8fafc",
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={feeChartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                      }
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#ffffff",
                        border: "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value, name) => [
                        typeof value === "number" ? usd(value) : String(value ?? ""),
                        name === "withoutFees" ? "Without Fees" : "With Fees",
                      ]}
                      labelFormatter={(l) => String(l)}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, color: "#64748b" }}
                      formatter={(value) =>
                        value === "withoutFees" ? "Without Fees" : "With Fees"
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="withoutFees"
                      stroke="#22c55e"
                      strokeWidth={2.5}
                      dot={false}
                      name="withoutFees"
                    />
                    <Line
                      type="monotone"
                      dataKey="withFees"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      strokeDasharray="6 3"
                      name="withFees"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 14,
                  marginTop: 18,
                }}
              >
                {portfolioResult!.funds.map((fund) => (
                  <div
                    key={fund.ticker}
                    style={{ background: "#f8fafc", borderRadius: 18, padding: 18 }}
                  >
                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                      }}
                    >
                      {fund.ticker} · {(fund.expenseRatio * 100).toFixed(2)}% ER
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: "1.4rem",
                        fontWeight: 800,
                        color: "#f59e0b",
                      }}
                    >
                      −{usd(fund.feeImpact)}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: "0.85rem",
                        color: "#94a3b8",
                      }}
                    >
                      fee drag over {analyticsParams.horizonYears} yrs
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        <div style={{ marginTop: 64 }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            style={{ marginBottom: 24 }}
          >
            <p className="section-eyebrow-blue">Historical Stress Test</p>
            <h3
              style={{
                margin: "0 0 10px",
                fontSize: "2rem",
                lineHeight: 1.1,
                color: "#0f172a",
              }}
            >
              Normal projection vs crisis path
            </h3>
            <p className="section-subtext-muted" style={{ maxWidth: 760 }}>
              Each chart compares a smooth normal projection for your portfolio
              against a beta-adjusted crisis path based on the historical SPY event.
            </p>
          </motion.div>

          <div style={{ display: "grid", gap: 18 }}>
            {loading ? (
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 14,
                  padding: "18px 0",
                }}
              >
                Loading historical stress tests…
              </div>
            ) : (
              stressEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.2 + i * 0.06 }}
                  style={{
                    background: "#ffffff",
                    borderRadius: 24,
                    border: "1px solid rgba(15,23,42,0.06)",
                    boxShadow: "0 18px 48px rgba(15,23,42,0.06)",
                    padding: 24,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 20,
                      flexWrap: "wrap",
                      marginBottom: 18,
                    }}
                  >
                    <div style={{ maxWidth: 720 }}>
                      <p
                        style={{
                          margin: 0,
                          color: "#2563eb",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                        }}
                      >
                        {event.period}
                      </p>
                      <h4
                        style={{
                          margin: "8px 0 6px",
                          fontSize: "1.4rem",
                          color: "#0f172a",
                        }}
                      >
                        {event.label}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          color: "#64748b",
                          lineHeight: 1.6,
                        }}
                      >
                        {event.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="analytics-ai-pill"
                      onClick={() => setSelectedStressEvent(event)}
                    >
                      AI ✨
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 20,
                      width: "100%",
                      height: 280,
                      minHeight: 280,
                      background: "#f8fafc",
                      borderRadius: 20,
                      padding: 16,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={event.series}
                        margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatShortDate}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={32}
                        />
                        <YAxis
                          tickFormatter={(v) =>
                            typeof v === "number"
                              ? `$${Math.round(v).toLocaleString()}`
                              : String(v)
                          }
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                          width={70}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#ffffff",
                            border: "1px solid rgba(0,0,0,0.08)",
                            borderRadius: 12,
                            fontSize: 12,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                          }}
                          formatter={(value, _name, item) => {
                            const label =
                              item?.dataKey === "normalValue" ? "Normal Prediction" : "Crisis Path";

                            return [
                              typeof value === "number" ? usd(value) : String(value ?? ""),
                              label,
                            ];
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="normalValue"
                          stroke="#22c55e"
                          strokeWidth={2.5}
                          dot={false}
                          name="Normal Prediction"
                        />
                        <Line
                          type="monotone"
                          dataKey="stressValue"
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={false}
                          name="Crisis Path"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 14,
                      marginTop: 18,
                    }}
                  >
                    <div style={{ background: "#f8fafc", borderRadius: 18, padding: 18 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                        MARKET DRAWDOWN
                      </div>
                      <div style={{ marginTop: 8, fontSize: "1.6rem", fontWeight: 800, color: "#ef4444" }}>
                        {pct(event.marketDrawdownPct)}
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 18, padding: 18 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                        PORTFOLIO DRAWDOWN
                      </div>
                      <div style={{ marginTop: 8, fontSize: "1.6rem", fontWeight: 800, color: "#ef4444" }}>
                        {pct(event.portfolioDrawdownPct)}
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 18, padding: 18 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                        STARTING VALUE
                      </div>
                      <div style={{ marginTop: 8, fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
                        {usd(event.startValue)}
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 18, padding: 18 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                        TROUGH VALUE
                      </div>
                      <div style={{ marginTop: 8, fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
                        {usd(event.troughValue)}
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 18, padding: 18 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                        NORMAL END VALUE
                      </div>
                      <div style={{ marginTop: 8, fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
                        {usd(event.normalEndValue)}
                      </div>
                    </div>

                    <div style={{ background: "#f8fafc", borderRadius: 18, padding: 18 }}>
                      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
                        CRISIS END VALUE
                      </div>
                      <div style={{ marginTop: 8, fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>
                        {usd(event.endValue)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      <StressExplanationModal
        open={selectedStressEvent !== null}
        title={selectedStressEvent ? selectedStressEvent.label : ""}
        body={stressExplanationBody}
        onClose={() => setSelectedStressEvent(null)}
      />

      <AiHighlight
        context={{
          profile: profile ?? null,
          portfolioInputs: {
            tickers: analyticsParams.tickers,
            investmentAmount: analyticsParams.investmentAmount,
            horizonYears: analyticsParams.horizonYears,
            riskTolerance: analyticsParams.riskTolerance,
          },
          portfolioResult: null,
          riskMetrics: null,
          analytics: {
            monteCarlo: mcData.length > 0 ? mcData : null,
            scenarios: scenarios.length > 0 ? scenarios : null,
            stressTests: stressEvents.length > 0 ? stressEvents : null,
          },
          currentScreen: "analytics",
        }}
      />
    </section>
  );
}