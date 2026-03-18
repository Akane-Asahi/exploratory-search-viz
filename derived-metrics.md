DERIVED_METRICS.md
Derived Metrics Specification

Research Topic Intelligence Platform (MERN)

1. Purpose

This document defines:

All derived metrics used in the system
Mathematical definitions
Edge-case handling
Exact JavaScript implementations
Data dependencies

All derived metrics must be computed server-side.

Frontend must never recompute core metrics.

2. Required Raw Inputs

For each topic, backend must aggregate:

{
  topicName: String,
  publicationCountsByYear: {
    "2019": Number,
    "2020": Number,
    "2021": Number,
    "2022": Number,
    "2023": Number,
    "2024": Number
  },
  papers: [
    {
      publication_year: Number,
      cited_by_count: Number,
      authorIds: [String]
    }
  ]
}

From this structure, all derived metrics are computed.

3. Derived Metrics Overview

We compute:

Growth Rate (CAGR)
Citation Velocity
Competition (log author density)
Normalized Metrics
Opportunity Score
Median Thresholds (for scatterplot quadrants)

4. Growth Rate (CAGR)

Concept

Measures 5-year publication acceleration.

We use Compound Annual Growth Rate (CAGR).

Mathematical Formula
CAGR=((Pt/P0)^(1/n))−1

Where:
Pt = publications current year
P0 = publications 5 years ago
n = 5 years

Edge Case Handling

If P0 < 5, set P0 = 5.

Reason:
Small baselines create artificial growth spikes.

JavaScript Implementation
function computeGrowthRate(publicationCountsByYear, currentYear = 2024) {
  const pastYear = currentYear - 5;

  let P0 = publicationCountsByYear[pastYear] || 0;
  const Pt = publicationCountsByYear[currentYear] || 0;

  // Prevent artificial inflation
  if (P0 < 5) P0 = 5;

  if (Pt === 0) return 0;

  const years = 5;
  const growth = Math.pow(Pt / P0, 1 / years) - 1;

  return growth; // decimal form (0.32 = 32%)
}

5. Citation Velocity

Concept

Measures how quickly papers accumulate citations.
We compute median citation rate per year.

Per-Paper Formula
Velocity=(cited_by_count)/(currentYear−publicationYear+1)

+1 prevents division by zero.

Topic-Level Value
Use median of all paper velocities.
Median avoids skew from extreme citation outliers.

JavaScript Implementation
function computeCitationVelocity(papers, currentYear = 2024) {
  if (!papers || papers.length === 0) return 0;

  const velocities = papers.map(paper => {
    const age = currentYear - paper.publication_year + 1;
    return paper.cited_by_count / age;
  });

  velocities.sort((a, b) => a - b);

  const mid = Math.floor(velocities.length / 2);

  if (velocities.length % 2 === 0) {
    return (velocities[mid - 1] + velocities[mid]) / 2;
  }

  return velocities[mid];
}

6. Competition (Author Density)

Concept

Measures how crowded a subfield is.
Raw author counts are power-law distributed.
Therefore we use log scaling.

Formula
Competition=ln(Unique Active Authors)

Active authors = unique authors from last 3 years.

JavaScript Implementation
function computeCompetition(papers, currentYear = 2024) {
  const activeAuthorSet = new Set();

  papers.forEach(paper => {
    if (paper.publication_year >= currentYear - 2) {
      paper.authorIds.forEach(id => activeAuthorSet.add(id));
    }
  });

  const authorCount = activeAuthorSet.size;

  if (authorCount === 0) return 0;

  return Math.log(authorCount);
}

7. Normalization (Min-Max)

We normalize:

growthRate
citationVelocity
competition
Across all topics.

Formula
Normalized=(x−min)/(max−min)

	​

Edge Case

If max == min → return 0.5.

JavaScript Implementation
function normalizeArray(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);

  return values.map(value => {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  });
}

8. Opportunity Score

Concept

Weighted composite strategic index.

Weights:
40% Growth
40% Impact
20% Inverse Competition

Formula
Opportunity=0.4G+0.4V+0.2(1−C)

Where:

G = normalized growth
V = normalized velocity
C = normalized competition

JavaScript Implementation
function computeOpportunityScores(growthArr, velocityArr, competitionArr) {
  const normGrowth = normalizeArray(growthArr);
  const normVelocity = normalizeArray(velocityArr);
  const normCompetition = normalizeArray(competitionArr);

  return normGrowth.map((g, i) => {
    return (
      0.4 * g +
      0.4 * normVelocity[i] +
      0.2 * (1 - normCompetition[i])
    );
  });
}

9. Median Thresholds (For Quadrants)
Used in Impact vs Competition Scatterplot.

Implementation
function computeMedian(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

Used for:

medianCompetition
medianImpact

10. Full Metric Pipeline

function computeAllMetrics(topics) {
  const growthArr = [];
  const velocityArr = [];
  const competitionArr = [];

  topics.forEach(topic => {
    const growth = computeGrowthRate(topic.publicationCountsByYear);
    const velocity = computeCitationVelocity(topic.papers);
    const competition = computeCompetition(topic.papers);

    topic.growthRate = growth;
    topic.citationVelocity = velocity;
    topic.competition = competition;

    growthArr.push(growth);
    velocityArr.push(velocity);
    competitionArr.push(competition);
  });

  const opportunityArr = computeOpportunityScores(
    growthArr,
    velocityArr,
    competitionArr
  );

  topics.forEach((topic, index) => {
    topic.opportunityScore = opportunityArr[index];
  });

  return topics;
}

11. Storage Format (Mongo)

Each topic document must contain:

{
  topicName: String,
  totalPublications: Number,
  growthRate: Number,
  citationVelocity: Number,
  competition: Number,
  opportunityScore: Number,
  publicationCountsByYear: Object
}

12. Why This Is Academically Defensible

Uses CAGR (standard growth metric)
Uses median (robust central tendency)
Uses log scaling (corrects skew)
Uses normalized weighted composite scoring
Transparent deterministic calculations

No black-box scoring.