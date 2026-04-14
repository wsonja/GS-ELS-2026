import type { PortfolioPreset } from "../types";
import type { UserProfile } from "../types/profile";
import { apiUrl } from "../lib/api";

export async function fetchPortfolioPreset(
  profile: UserProfile
): Promise<PortfolioPreset> {
  const res = await fetch(apiUrl("/api/presets/recommend"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      birthYear: profile.birthYear,
      income: profile.income,
      monthlySavings: profile.monthlySavings,
      jobTitle: profile.jobTitle,
      industry: profile.industry,
      riskTolerance: profile.riskTolerance,
      lifeGoal: profile.lifeGoal,
      idealRetirementAge: profile.idealRetirementAge,
      investorExperience: profile.investorExperience,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load preset (${res.status})`);
  }

  return (await res.json()) as PortfolioPreset;
}