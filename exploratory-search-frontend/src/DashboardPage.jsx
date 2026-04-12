import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import TopicChart from './TopicChart';
import PaperForceGraph from './PaperForceGraph';
import BarGraph from './Bargraph'
import WordCloud from './WordCloud'
import AuthorBarChart from './AuthorBarChartN'

const font = "'Consolas', monospace";
const TOPIC_COLOR_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#7c3aed',
  '#eA950C'
];

const EXTRA_TOPIC_COLOR_PALETTE = [
  '#0ea5e9',
  '#f43f5e',
  '#14b8a6',
  '#a855f7',
  '#f97316',
  '#22c55e',
  '#6366f1',
  '#e11d48'
];

const normalizeLabel = (value) => (value || '').toString().trim().toLowerCase();
const currentYear = new Date().getFullYear();

const getPaperTopicTerms = (paper) => {
  const terms = [
    paper?.primaryTopic || '',
    ...(Array.isArray(paper?.tags) ? paper.tags : []),
    ...(Array.isArray(paper?.keywords) ? paper.keywords : [])
  ]
    .map((value) => (value || '').toString().trim())
    .filter(Boolean);
  const byKey = new Map();
  terms.forEach((term) => {
    const key = normalizeLabel(term);
    if (!key || byKey.has(key)) return;
    byKey.set(key, term);
  });
  return Array.from(byKey.values());
};

const getConfidenceColor = (confidencePercent) => {
  if (confidencePercent >= 80) return '#16a34a';
  if (confidencePercent >= 50) return '#eab308';
  return '#ef4444';
};

const getFallbackLastCitedYear = (term) => {
  const explicitYear = Number(term?.lastCitedYear || 0);
  if (explicitYear > 0) return explicitYear;
  const trend = Array.isArray(term?.trend) ? term.trend : [];
  if (trend.length === 0) return 0;
  const startYear = currentYear - (trend.length - 1);
  for (let i = trend.length - 1; i >= 0; i -= 1) {
    if (Number(trend[i] || 0) > 0) {
      return startYear + i;
    }
  }
  return 0;
};

const getFallbackTrendScore = (term) => {
  const explicitScore = Number(term?.trendScore || 0);
  if (explicitScore > 0) return explicitScore;
  const count = Number(term?.count || 0);
  const lastYear = getFallbackLastCitedYear(term);
  return count + (lastYear * 2);
};

const cardStyle = {
  backgroundColor: 'white',
  border: '1px solid #eeeff0',
  borderRadius: '10px',
  padding: '0 16px',
  flex: '1 0 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: '58px',
  minWidth: 0
};

const panelStyle = {
  backgroundColor: 'white',
  border: '1px solid #eeeff0',
  borderRadius: '10px',
  padding: '12px 14px',
  minWidth: 0,
  overflow: 'hidden'
};

function TrendSparkline({ values, strokeColor }) {
  const points = Array.isArray(values) ? values : [];
  if (points.length === 0) return <span style={{ color: '#94a3b8' }}>No data</span>;

  const width = 140;
  const height = 34;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const coords = points.map((v, i) => {
    const x = (i / Math.max(1, points.length - 1)) * (width - 8) + 4;
    const y = height - 4 - ((v - min) / range) * (height - 10);
    return `${x},${y}`;
  }).join(' ');
  const trendUp = points[points.length - 1] >= points[0];
  const color = strokeColor || (trendUp ? '#2563eb' : '#64748b');

  return (
    <svg width={width} height={height}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={coords}
      />
    </svg>
  );
}

function DashboardPage({ searchTerm, onNewSearch ,onSelectPaper ,onSelectAuthor, onSelectWord}) {
  const [stats, setStats] = useState(null);
  const [evolutionData, setEvolutionData] = useState([]);
  const [topTerminologies, setTopTerminologies] = useState([]);
  const [paperNetwork, setPaperNetwork] = useState({ nodes: [], links: [] });
  const [topPapers, setTopPapers] = useState([]);
  const [tableSort, setTableSort] = useState('citations');
  const [rankedTableSort, setRankedTableSort] = useState('cited_papers');
  const [graphMode, setGraphMode] = useState('citation');
  const [citationSpacing, setCitationSpacing] = useState(50);
  const [edgeLength, setEdgeLength] = useState(50);
  const [focusedPaperId, setFocusedPaperId] = useState(null);
  const [favoritePaperTopics, setFavoritePaperTopics] = useState({});
  const [favoriteRankedKeywords, setFavoriteRankedKeywords] = useState([]);
  const [activeFilterTerms, setActiveFilterTerms] = useState([]);
  const [isFavoritesMinimized, setIsFavoritesMinimized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [topTags, setTopTags] = useState([]);
  const [authors, setAuthors] = useState([]);
  const pollInterval = useRef(null);

  
  const fetchData = useCallback(async () => {
    try {
      // 1. Pointed to correct backend URL and correct route
      const resStats = await axios.get('http://localhost:5000/api/papers/dashboard-stats');
      
      // 2. Extracted the nested 'stats' object correctly
      const dashboardStats = resStats.data.stats;
      setStats(dashboardStats);

      if (dashboardStats && dashboardStats.totalPapers > 0) {
        setIsSyncing(false);
        if (pollInterval.current) clearInterval(pollInterval.current);

        const [resEvo, resTerminology, resNetwork, resTopPapers,resTags,resAuthors] = await Promise.allSettled([
          axios.get('http://localhost:5000/api/topic-timeline'),
          axios.get('http://localhost:5000/api/terminology'), 
          axios.get('http://localhost:5000/api/paper-network'),
          axios.get('http://localhost:5000/api/top-cited?limit=20'),
          axios.get('http://localhost:5000/api/tags?limit=100'),
          axios.get('http://localhost:5000/api/authors')
        ]);

        if (resEvo.status === 'fulfilled') {
          setEvolutionData(resEvo.value.data);
        }
        if (resTerminology.status === 'fulfilled') {
          setTopTerminologies(Array.isArray(resTerminology.value.data) ? resTerminology.value.data : []);
        }
        if (resNetwork.status === 'fulfilled') {
          const payload = resNetwork.value.data || {};
          setPaperNetwork({
            nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
            links: Array.isArray(payload.links) ? payload.links : [],
            terminologyLinks: Array.isArray(payload.terminologyLinks) ? payload.terminologyLinks : [],
            citationLinks: Array.isArray(payload.citationLinks) ? payload.citationLinks : []
          });
        }
        if (resTopPapers.status === 'fulfilled') {
          setTopPapers(Array.isArray(resTopPapers.value.data) ? resTopPapers.value.data : []);
        }if (resTags.status === 'fulfilled') {
          setTopTags(Array.isArray(resTags.value.data) ? resTags.value.data : []);
        }if (resAuthors.status === 'fulfilled') {
          setAuthors(Array.isArray(resAuthors.value.data) ? resAuthors.value.data : []);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    pollInterval.current = setInterval(fetchData, 3000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [fetchData]);

  const sortedPapers = [...topPapers].sort((a, b) => {
    if (tableSort === 'citations') return (b.citationCount || 0) - (a.citationCount || 0);
    if (tableSort === 'year_new') return (b.year || 0) - (a.year || 0);
    if (tableSort === 'year_old') return (a.year || 0) - (b.year || 0);
    return 0;
  });

  const sortedTerminologies = React.useMemo(() => {
    const list = [...topTerminologies];
    if (rankedTableSort === 'trend') {
      return list.sort((a, b) => {
        const scoreDiff = getFallbackTrendScore(b) - getFallbackTrendScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        return Number(b?.count || 0) - Number(a?.count || 0);
      });
    }
    if (rankedTableSort === 'newest') {
      return list.sort((a, b) => {
        const yearDiff = getFallbackLastCitedYear(b) - getFallbackLastCitedYear(a);
        if (yearDiff !== 0) return yearDiff;
        return Number(b?.count || 0) - Number(a?.count || 0);
      });
    }
    return list.sort((a, b) => {
      const countDiff = Number(b?.count || 0) - Number(a?.count || 0);
      if (countDiff !== 0) return countDiff;
      return (a?.name || '').localeCompare(b?.name || '');
    });
  }, [topTerminologies, rankedTableSort]);

  const top5RankedTerminologies = React.useMemo(
    () => sortedTerminologies.slice(0, 5),
    [sortedTerminologies]
  );

  const terminologyByName = React.useMemo(() => {
    const map = new Map();
    topTerminologies.forEach((term) => {
      const key = normalizeLabel(term?.name);
      if (!key || map.has(key)) return;
      map.set(key, term);
    });
    return map;
  }, [topTerminologies]);

  const getDisplayTrendSeries = useCallback((term) => {
    const trend = Array.isArray(term?.trend) ? term.trend : [];
    const totalCount = Number(term?.count || 0);
    if (trend.length === 0) {
      return totalCount > 0 ? [totalCount] : [];
    }

    let runningTotal = 0;
    const cumulative = trend.map((yearCount) => {
      runningTotal += Number(yearCount || 0);
      return runningTotal;
    });

    if (runningTotal === 0) {
      return totalCount > 0 ? [totalCount] : cumulative.map(() => 0);
    }

    const scale = totalCount > 0 ? (totalCount / runningTotal) : 1;
    return cumulative.map((value) => Math.max(0, Math.round(value * scale)));
  }, []);

  const timelineConcepts = React.useMemo(() => {
    const favoriteKeywordCandidates = [];
    Object.values(favoritePaperTopics).forEach((terms) => {
      (terms || []).forEach((term) => favoriteKeywordCandidates.push(term));
    });
    (favoriteRankedKeywords || []).forEach((term) => favoriteKeywordCandidates.push(term));

    const ordered = [];
    const pushUnique = (termName) => {
      const normalized = normalizeLabel(termName);
      if (!normalized) return;
      if (ordered.some((name) => normalizeLabel(name) === normalized)) return;
      ordered.push(termName);
    };
    top5RankedTerminologies.forEach((term) => pushUnique(term?.name));
    favoriteKeywordCandidates.forEach((keyword) => pushUnique(keyword));
    return ordered;
  }, [top5RankedTerminologies, favoritePaperTopics, favoriteRankedKeywords]);

  const topicColorMap = React.useMemo(() => {
    const map = {};
    top5RankedTerminologies.forEach((term, index) => {
      const key = normalizeLabel(term?.name);
      if (!key) return;
      map[key] = TOPIC_COLOR_PALETTE[index];
    });
    const extraKeywords = timelineConcepts.filter(
      (name) => !top5RankedTerminologies.some((term) => normalizeLabel(term?.name) === normalizeLabel(name))
    );
    extraKeywords.forEach((keyword, index) => {
      const key = normalizeLabel(keyword);
      if (!key || map[key]) return;
      map[key] = EXTRA_TOPIC_COLOR_PALETTE[index % EXTRA_TOPIC_COLOR_PALETTE.length];
    });
    return map;
  }, [top5RankedTerminologies, timelineConcepts]);

  const filteredEvolutionData = React.useMemo(() => {
    const rawRows = Array.isArray(evolutionData?.data) ? evolutionData.data : [];
    const conceptKeySet = new Set(timelineConcepts.map((name) => normalizeLabel(name)).filter(Boolean));

    // Build timeline directly from selected chart terms so "Newest"/"Trend" and favorites always have data.
    const trendRows = [];
    timelineConcepts.forEach((conceptName) => {
      const concept = conceptName;
      const term = terminologyByName.get(normalizeLabel(conceptName));
      const displayTrend = term ? getDisplayTrendSeries(term) : [];
      if (!concept) return;
      if (displayTrend.length === 0) {
        const fallbackRows = rawRows
          .filter((row) => normalizeLabel(row?.concept) === normalizeLabel(concept))
          .map((row) => ({
            concept,
            year: Number(row?.year || 0),
            count: Number(row?.count || 0)
          }))
          .filter((row) => row.year > 0);
        if (fallbackRows.length > 0) {
          fallbackRows
            .sort((a, b) => a.year - b.year)
            .forEach((row) => trendRows.push(row));
        }
        return;
      }

      const startYear = currentYear - (displayTrend.length - 1);
      displayTrend.forEach((value, index) => {
        trendRows.push({
          concept,
          year: startYear + index,
          count: Number(value || 0)
        });
      });
    });

    const fallbackRows = rawRows.filter((row) => conceptKeySet.has(normalizeLabel(row?.concept)));
    const dataRows = trendRows.length > 0 ? trendRows : fallbackRows;

    return {
      ...(evolutionData || {}),
      concepts: timelineConcepts,
      data: dataRows
    };
  }, [evolutionData, timelineConcepts, terminologyByName, getDisplayTrendSeries]);

  const toggleFavoritePaperTopics = useCallback((paperKey, paper) => {
    setFavoritePaperTopics((prev) => {
      if (prev[paperKey]) {
        const next = { ...prev };
        delete next[paperKey];
        return next;
      }
      return {
        ...prev,
        [paperKey]: getPaperTopicTerms(paper)
      };
    });
  }, []);

  const favoriteKeywords = React.useMemo(() => {
    const byKey = new Map();
    Object.values(favoritePaperTopics).forEach((terms) => {
      (terms || []).forEach((term) => {
        const key = normalizeLabel(term);
        if (!key || byKey.has(key)) return;
        byKey.set(key, term);
      });
    });
    (favoriteRankedKeywords || []).forEach((term) => {
      const key = normalizeLabel(term);
      if (!key || byKey.has(key)) return;
      byKey.set(key, term);
    });
    return Array.from(byKey.values());
  }, [favoritePaperTopics, favoriteRankedKeywords]);

  const favoriteKeywordSet = React.useMemo(
    () => new Set(favoriteKeywords.map((term) => normalizeLabel(term)).filter(Boolean)),
    [favoriteKeywords]
  );

  const removeFavoriteKeyword = useCallback((keywordToRemove) => {
    const removeKey = normalizeLabel(keywordToRemove);
    if (!removeKey) return;

    setFavoritePaperTopics((prev) => {
      const next = {};
      Object.entries(prev).forEach(([paperKey, terms]) => {
        const filteredTerms = (terms || []).filter((term) => normalizeLabel(term) !== removeKey);
        if (filteredTerms.length > 0) {
          next[paperKey] = filteredTerms;
        }
      });
      return next;
    });

    setActiveFilterTerms((prev) => prev.filter((term) => normalizeLabel(term) !== removeKey));
    setFavoriteRankedKeywords((prev) => prev.filter((term) => normalizeLabel(term) !== removeKey));
  }, []);

  const toggleFavoriteRankedKeyword = useCallback((keyword) => {
    const normalized = normalizeLabel(keyword);
    if (!normalized) return;
    const alreadyFavorite = favoriteKeywordSet.has(normalized);
    if (alreadyFavorite) {
      removeFavoriteKeyword(keyword);
      return;
    }
    setFavoriteRankedKeywords((prev) => {
      const exists = prev.some((term) => normalizeLabel(term) === normalized);
      if (exists) return prev;
      return [...prev, keyword];
    });
  }, [favoriteKeywordSet, removeFavoriteKeyword]);

  const toggleFavoriteKeywordFromPanel = useCallback((keyword) => {
    const normalized = normalizeLabel(keyword);
    if (!normalized) return;
    const alreadyFavorite = favoriteKeywordSet.has(normalized);
    if (alreadyFavorite) {
      removeFavoriteKeyword(keyword);
      return;
    }
    setFavoriteRankedKeywords((prev) => {
      const exists = prev.some((term) => normalizeLabel(term) === normalized);
      if (exists) return prev;
      return [...prev, keyword];
    });
  }, [favoriteKeywordSet, removeFavoriteKeyword]);

  const activeFilterTermSet = React.useMemo(
    () => new Set(activeFilterTerms.map((term) => normalizeLabel(term)).filter(Boolean)),
    [activeFilterTerms]
  );

  const paperMatchDetails = React.useMemo(() => {
    const details = new Map();
    const totalSelectedTerms = activeFilterTermSet.size;
    sortedPapers.forEach((paper) => {
      const paperTerms = getPaperTopicTerms(paper);
      const paperTermSet = new Set(paperTerms.map((term) => normalizeLabel(term)).filter(Boolean));
      let matchedCount = 0;
      activeFilterTermSet.forEach((term) => {
        if (paperTermSet.has(term)) matchedCount += 1;
      });
      const confidence = totalSelectedTerms > 0 ? (matchedCount / totalSelectedTerms) : 0;
      details.set(String(paper?._id || ''), {
        matchedCount,
        totalSelectedTerms,
        confidence,
        confidencePercent: Math.round(confidence * 100)
      });
    });
    return details;
  }, [sortedPapers, activeFilterTermSet]);

  const filteredSortedPapers = React.useMemo(() => {
    if (activeFilterTermSet.size === 0) return sortedPapers;
    return sortedPapers.filter((paper) => {
      const key = String(paper?._id || '');
      const match = paperMatchDetails.get(key);
      return Number(match?.matchedCount || 0) > 0;
    });
  }, [sortedPapers, activeFilterTermSet, paperMatchDetails]);

  const filteredPaperIdSet = React.useMemo(() => {
    if (activeFilterTermSet.size === 0) return null;
    return new Set(filteredSortedPapers.map((paper) => String(paper?._id || '')).filter(Boolean));
  }, [filteredSortedPapers, activeFilterTermSet]);

  const filteredPaperNetwork = React.useMemo(() => {
    if (!filteredPaperIdSet) return paperNetwork;
    const resolveEndpointId = (value) => {
      if (typeof value === 'string') return value;
      return value?.id || '';
    };
    const nodes = (paperNetwork.nodes || []).filter((node) => filteredPaperIdSet.has(String(node.id || '')));
    const keepNodeIds = new Set(nodes.map((node) => String(node.id || '')));
    const filterLinks = (links) => (links || []).filter((link) => {
      const source = resolveEndpointId(link?.source);
      const target = resolveEndpointId(link?.target);
      return keepNodeIds.has(String(source || '')) && keepNodeIds.has(String(target || ''));
    });
    return {
      ...paperNetwork,
      nodes,
      links: filterLinks(paperNetwork.links),
      terminologyLinks: filterLinks(paperNetwork.terminologyLinks),
      citationLinks: filterLinks(paperNetwork.citationLinks)
    };
  }, [paperNetwork, filteredPaperIdSet]);

  const hasActiveFavoriteFilter = activeFilterTermSet.size > 0;

  const nodeConfidenceById = React.useMemo(() => {
    if (!hasActiveFavoriteFilter) return {};
    const confidenceMap = {};
    const totalSelectedTerms = activeFilterTermSet.size;
    (filteredPaperNetwork?.nodes || []).forEach((node) => {
      const paperTerms = getPaperTopicTerms(node);
      const paperTermSet = new Set(paperTerms.map((term) => normalizeLabel(term)).filter(Boolean));
      let matchedCount = 0;
      activeFilterTermSet.forEach((term) => {
        if (paperTermSet.has(term)) matchedCount += 1;
      });
      const confidencePercent = totalSelectedTerms > 0
        ? Math.round((matchedCount / totalSelectedTerms) * 100)
        : 0;
      confidenceMap[String(node?.id || '')] = confidencePercent;
    });
    return confidenceMap;
  }, [hasActiveFavoriteFilter, activeFilterTermSet, filteredPaperNetwork]);

  const applyFavoriteKeywordFilter = useCallback(() => {
    setActiveFilterTerms(favoriteKeywords);
  }, [favoriteKeywords]);

  const resetFavoriteKeywordFilter = useCallback(() => {
    setActiveFilterTerms([]);
  }, []);

  useEffect(() => {
    if (!focusedPaperId || !filteredPaperIdSet) return;
    if (!filteredPaperIdSet.has(String(focusedPaperId))) {
      setFocusedPaperId(null);
    }
  }, [focusedPaperId, filteredPaperIdSet]);

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '84px' }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #eeeff0',
        height: '65px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 30px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0
      }}>
        <p style={{ fontFamily: "'Hanson', sans-serif", fontWeight: 'bold', fontSize: '16px', color: '#6b7280', margin: 0 }}>
          Your Next Research
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isSyncing && <span style={{ color: '#6b7280', fontFamily: font, fontSize: '11px' }}>Syncing data...</span>}
          <button onClick={onNewSearch} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #eeeff0', borderRadius: '100px', padding: '10px 22px', cursor: 'pointer', minWidth: '215px' }}>
            Search another topic
          </button>
        </div>
      </div>

      <div style={{ padding: '15px 30px 30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ padding: '0 0 4px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '16px', margin: 0 }}>Metrics</p>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '24px', lineHeight: '41px', margin: 0 }}>{` → ${searchTerm || 'Exploratory Search'}`}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* 4. Updated Cards to reflect the real backend data metrics */}
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Total Papers</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>{stats?.totalPapers?.toLocaleString() ?? '0'}</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Avg Citations</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>{stats?.avgCitations?.toFixed(1) ?? '0'}</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Unique Venues</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>{stats?.uniqueVenues?.toLocaleString() ?? '0'}</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Top Tag</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '20px', color: '#111827', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stats?.topTag ?? 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ ...panelStyle, height: '640px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: 0 }}>
              Top Papers
            </p>
            <select
              value={tableSort}
              onChange={(e) => setTableSort(e.target.value)}
              style={{
                border: '1px solid #eeeff0',
                borderRadius: '6px',
                padding: '4px 8px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
                color: '#111827',
                backgroundColor: '#fff'
              }}
            >
              <option value="citations">Sort by Citations</option>
              <option value="year_new">Sort by Year (Newest)</option>
              <option value="year_old">Sort by Year (Oldest)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', height: '574px' }}>
            <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
              <table
                style={{
                  width: '100%',
                  height: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  backgroundColor: '#fff',
                  border: '1px solid #eeeff0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  tableLayout: 'fixed'
                }}
              >
                <thead style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    {[
                      { label: 'Title', width: '40%' },
                      { label: 'Citations', width: '8%' },
                      { label: 'Published', width: '24%' },
                      { label: 'Total Authors', width: '28%' }
                    ].map((h) => (
                      <th key={h.label} style={{ width: h.width, textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #eeeff0' }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ display: 'block', height: 'calc(100% - 41px)', overflowY: 'auto', width: '100%' }}>
                  {filteredSortedPapers.map((paper) => {
                    const authors = (paper.authors || []).map((a) => a?.name).filter(Boolean);
                    const doiValue = (paper.doi || '').trim();
                    const normalizedDoiLink = doiValue
                      ? (doiValue.startsWith('http') ? doiValue : `https://doi.org/${doiValue}`)
                      : '';
                    const link = normalizedDoiLink || paper.openAlexUrl || paper.openAlexId || '';
                    const paperId = paper?._id ? String(paper._id) : '';
                    const paperFavoriteKey = paperId || `${paper?.title || 'untitled'}-${paper?.year || 0}`;
                    const isFavorited = Boolean(favoritePaperTopics[paperFavoriteKey]);
                    const isFocused = graphMode === 'citation' && focusedPaperId && paperId === focusedPaperId;
                    const confidenceInfo = paperMatchDetails.get(paperId) || {
                      matchedCount: 0,
                      totalSelectedTerms: 0,
                      confidencePercent: 0
                    };
                    const confidencePercent = Number(confidenceInfo.confidencePercent || 0);
                    const confidenceColor = getConfidenceColor(confidencePercent);
                    return (
                      <tr
                        key={paper._id || `${paper.title}-${paper.citationCount}`}
                        onClick={() => {
                          if (graphMode !== 'citation') return;
                          if (!paperId) return;
                          setFocusedPaperId((prev) => (prev === paperId ? null : paperId));
                        }}
                        style={{
                          display: 'table',
                          width: '100%',
                          tableLayout: 'fixed',
                          cursor: graphMode === 'citation' ? 'pointer' : 'default',
                          backgroundColor: isFocused ? '#111827' : '#ffffff'
                        }}
                      >
                        <td style={{ width: '40%', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: isFocused ? '#ffffff' : '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavoritePaperTopics(paperFavoriteKey, paper);
                              }}
                              title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '13px',
                                lineHeight: 1,
                                color: isFavorited ? '#ef4444' : (isFocused ? '#ffffff' : '#9ca3af')
                              }}
                            >
                              {isFavorited ? '♥' : '♡'}
                            </button>
                            
                              <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                            {link ? (
                              <span onClick={() => onSelectPaper(paper)}  style={{ color: '#2563eb', textDecoration: 'none', cursor: 'pointer' }}>
                                    {paper.title || 'Untitled'}
                                  </span>
                            ) : (
                              (paper.title || 'Untitled')
                            )}
                          </td>
                            
                          </span>
                          {hasActiveFavoriteFilter ? (
                            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: 7,
                                  borderRadius: 999,
                                  background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #16a34a 100%)',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: 0,
                                    height: '100%',
                                    width: `${Math.max(0, 100 - confidencePercent)}%`,
                                    backgroundColor: '#e5e7eb'
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  minWidth: 42,
                                  textAlign: 'right',
                                  fontFamily: 'Consolas, monospace',
                                  fontSize: '11px',
                                  color: isFocused ? '#ffffff' : confidenceColor
                                }}
                              >
                                {confidencePercent}%
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td style={{ width: '8%', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: isFocused ? '#ffffff' : '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                          {paper.citationCount || 0}
                        </td>
                        <td style={{ width: '24%', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: isFocused ? '#ffffff' : '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                          <span style={{ fontWeight: 600 }}>{paper.year}</span> {paper.venue ? ` - ${paper.venue}` : ''}
                        </td>
                        <td
                          title={authors.length > 0 ? authors.join(', ') : 'No author names available'}
                          style={{ width: '28%', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: isFocused ? '#ffffff' : '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0', cursor: 'help' }}
                        >
                          {authors.length} ({authors.length > 0 ? authors.join(', ') : 'No authors'})
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSortedPapers.length === 0 && (
                    <tr style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                      <td colSpan={4} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', padding: '12px', textAlign: 'center' }}>
                        {hasActiveFavoriteFilter ? 'No papers match the selected favorite keywords.' : 'Waiting for top papers...'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ flex: 1, border: '1px solid #eeeff0', borderRadius: '10px', padding: '8px 10px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '12px', color: '#6b7280', lineHeight: '22px', margin: 0 }}>
                  Paper Force-Directed Tree (All Fetched Papers)
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#6b7280' }}>
                    Cluster spacing
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={citationSpacing}
                    onChange={(e) => setCitationSpacing(Number(e.target.value))}
                    title="Cluster spacing"
                    style={{
                      width: '92px',
                      accentColor: '#111827',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#6b7280' }}>
                    Edge length
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={edgeLength}
                    onChange={(e) => setEdgeLength(Number(e.target.value))}
                    title="Edge length"
                    style={{
                      width: '92px',
                      accentColor: '#111827',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ display: 'inline-flex', border: '1px solid #d1d5db', borderRadius: '999px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setGraphMode('citation')}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '11px',
                        padding: '6px 12px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: graphMode === 'citation' ? '#111827' : '#ffffff',
                        color: graphMode === 'citation' ? '#ffffff' : '#374151'
                      }}
                    >
                      Citation
                    </button>
                    <button
                      onClick={() => setGraphMode('terminology')}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '11px',
                        padding: '6px 12px',
                        border: 'none',
                        borderLeft: '1px solid #d1d5db',
                        cursor: 'pointer',
                        backgroundColor: graphMode === 'terminology' ? '#111827' : '#ffffff',
                        color: graphMode === 'terminology' ? '#ffffff' : '#374151'
                      }}
                    >
                      Terminology
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                {paperNetwork.nodes.length > 0 ? (
                  <PaperForceGraph
                    data={filteredPaperNetwork}
                    mode={graphMode}
                    citationSpacing={citationSpacing}
                    edgeLength={edgeLength}
                    focusPaperId={focusedPaperId}
                    confidenceFilterActive={hasActiveFavoriteFilter}
                    nodeConfidenceById={nodeConfidenceById}
                    favoriteKeywords={favoriteKeywords}
                    onToggleFavoriteKeyword={toggleFavoriteKeywordFromPanel}
                  />
                ) : (
                  <p style={{ fontFamily: font }}>Waiting for paper network...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...panelStyle, height: '315px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: 0 }}>Ranked Table</p>
            <select
              value={rankedTableSort}
              onChange={(e) => setRankedTableSort(e.target.value)}
              style={{
                border: '1px solid #eeeff0',
                borderRadius: '6px',
                padding: '4px 8px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: '12px',
                color: '#111827',
                backgroundColor: '#fff'
              }}
            >
              <option value="cited_papers">Sort by Cited Papers</option>
              <option value="trend">Sort by Trend</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', height: '252px' }}>
            <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
              <table style={{ width: '100%', height: '100%', borderCollapse: 'separate', borderSpacing: 0, backgroundColor: '#fff', border: '1px solid #eeeff0', borderRadius: '10px', overflow: 'hidden', tableLayout: 'fixed' }}>
                <thead style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    {['Keyword', 'Cited Papers', 'Trend'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #eeeff0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody style={{ display: 'block', height: 'calc(100% - 41px)', overflowY: 'auto', width: '100%' }}>
                  {sortedTerminologies.map((term, index) => (
                    <tr key={term.name} style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                      <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => toggleFavoriteRankedKeyword(term.name)}
                            title={
                              favoriteKeywordSet.has(normalizeLabel(term.name))
                                ? 'Remove from favorites'
                                : 'Add to favorites'
                            }
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '13px',
                              lineHeight: 1,
                              color: favoriteKeywordSet.has(normalizeLabel(term.name)) ? '#ef4444' : '#9ca3af'
                            }}
                          >
                            {favoriteKeywordSet.has(normalizeLabel(term.name)) ? '♥' : '♡'}
                          </button>
                         <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: index < 5 ? (topicColorMap[normalizeLabel(term.name)] || '#94a3b8') : '#e5e7eb',
                              display: 'inline-block'
                            }}
                          />
                          {term.name}
                        </span>
                      </td>
                      <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>{term.count}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                        <TrendSparkline
                          values={getDisplayTrendSeries(term)}
                          strokeColor={index < 5 ? topicColorMap[normalizeLabel(term.name)] : '#9ca3af'}
                        />
                      </td>
                    </tr>
                  ))}
                  {topTerminologies.length === 0 && (
                    <tr style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                      <td colSpan={3} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', padding: '12px', textAlign: 'center' }}>
                        {isSyncing ? 'Waiting for terminology extraction...' : 'No terminology data found for this search.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ flex: 1, minWidth: 0, border: '1px solid #eeeff0', borderRadius: '10px', padding: '8px 10px' }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#6b7280', lineHeight: '22px', margin: '0 0 6px 0' }}>
                Topic Growth Timeline (Line Chart)
              </p>
              <div style={{ height: '216px' }}>
                {filteredEvolutionData?.data?.length > 0 ? (
                  <TopicChart rawData={filteredEvolutionData} conceptColors={topicColorMap} />
                ) : (
                  <p style={{ fontFamily: font }}>Waiting for data...</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ ...panelStyle, height: '600px' }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>Authors</p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch', height: '390px' }}>
            
            <div style={{ flex: 1.5, minWidth: 0, border: '1px solid #eeeff0', borderRadius: '10px', padding: '8px 10px' }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#6b7280', lineHeight: '22px', margin: '0 0 6px 0' }}>
                Top Author Chart
              </p>
              <div id = "chart-container" style={{ height: '350px' }}>
                {authors?.length > 0 ? (
                  <AuthorBarChart rawData={authors} selectAuthor={onSelectAuthor} />
                ) : (
                  <p style={{ fontFamily: font }}>Waiting for data...</p>
                )}
              </div>
            </div>
             <div style={{ flex: 1, minWidth: 0, border: '1px solid #eeeff0', borderRadius: '10px', padding: '8px 10px' }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#6b7280', lineHeight: '22px', margin: '0 0 6px 0' }}>
                Related Concepts
              </p>
              <div style={{ height: '400px' }}>
                {authors?.length > 0 ? (
                  <WordCloud rawData={topTags} selectWord={onSelectWord}  />
                ) : (
                  <p style={{ fontFamily: font }}>Waiting for data...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          height: '120px',
          background: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          boxShadow: '0 -6px 18px rgba(15, 23, 42, 0.12)',
          transform: isFavoritesMinimized ? 'translateY(calc(100% - 30px))' : 'translateY(0)',
          transition: 'transform 220ms ease',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 600, color: '#111827' }}>
            Favorite Keywords {hasActiveFavoriteFilter ? '(Filtered)' : ''}
          </span>
          <button
            type="button"
            onClick={() => setIsFavoritesMinimized((prev) => !prev)}
            title={isFavoritesMinimized ? 'Expand' : 'Minimize'}
            style={{
              width: 22,
              height: 22,
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#ffffff',
              color: '#111827',
              cursor: 'pointer',
              fontSize: '12px',
              lineHeight: 1
            }}
          >
            {isFavoritesMinimized ? '▴' : '▾'}
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 10, padding: '8px 14px 10px' }}>
          <div
            style={{
              width: '90%',
              minHeight: 0,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '6px 8px',
              overflowY: 'auto',
              overflowX: 'hidden',
              fontFamily: "'Inter', sans-serif",
              fontSize: '12px',
              color: '#64748b'
            }}
          >
            {favoriteKeywords.length === 0 ? (
              <span>No favorites selected yet.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {favoriteKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    style={{
                      fontFamily: 'Consolas, monospace',
                      fontSize: '11px',
                      color: '#0f172a',
                      background: '#f8fafc',
                      border: '1px solid #dbe3ee',
                      borderRadius: 999,
                      padding: '4px 8px',
                      lineHeight: 1.2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span>{keyword}</span>
                    <button
                      type="button"
                      onClick={() => removeFavoriteKeyword(keyword)}
                      title="Remove keyword"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1,
                        fontSize: '12px'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: '10%', minWidth: 90, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={applyFavoriteKeywordFilter}
              disabled={favoriteKeywords.length === 0}
              style={{
                flex: 1,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                background: favoriteKeywords.length === 0 ? '#f3f4f6' : '#ffffff',
                color: '#111827',
                cursor: favoriteKeywords.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              Filter
            </button>
            <button
              type="button"
              onClick={resetFavoriteKeywordFilter}
              disabled={!hasActiveFavoriteFilter}
              style={{
                flex: 1,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                background: !hasActiveFavoriteFilter ? '#f3f4f6' : '#ffffff',
                color: '#111827',
                cursor: !hasActiveFavoriteFilter ? 'not-allowed' : 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;