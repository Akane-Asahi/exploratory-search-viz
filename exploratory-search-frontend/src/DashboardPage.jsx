import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import TopicChart from './TopicChart';
import PaperForceGraph from './PaperForceGraph';
import BarGraph from './Bargraph'
import WordCloud from './WordCloud'
import AuthorBarChart from './AuthorBarChart'

const font = "'Consolas', monospace";
const TOPIC_COLOR_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#7c3aed',
  '#eA950C'
];

const normalizeLabel = (value) => (value || '').toString().trim().toLowerCase();

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

function DashboardPage({ searchTerm, onNewSearch ,onSelectPaper ,onSelectAuthor}) {
  const [stats, setStats] = useState(null);
  const [evolutionData, setEvolutionData] = useState([]);
  const [topTerminologies, setTopTerminologies] = useState([]);
  const [paperNetwork, setPaperNetwork] = useState({ nodes: [], links: [] });
  const [topPapers, setTopPapers] = useState([]);
  const [tableSort, setTableSort] = useState('citations');
  const [graphMode, setGraphMode] = useState('citation');
  const [citationSpacing, setCitationSpacing] = useState(100);
  const [focusedPaperId, setFocusedPaperId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [topKeywords, setTopKeywords] = useState([]);
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

        const [resEvo, resTerminology, resNetwork, resTopPapers,resKeywords,resAuthors] = await Promise.allSettled([
          axios.get('http://localhost:5000/api/topic-timeline?limit=8'),
          axios.get('http://localhost:5000/api/terminology'), 
          axios.get('http://localhost:5000/api/paper-network?limit=20'),
          axios.get('http://localhost:5000/api/top-cited?limit=20'),
          axios.get('http://localhost:5000/api/keywords?limit=100'),
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
        }if (resKeywords.status === 'fulfilled') {
          setTopKeywords(Array.isArray(resKeywords.value.data) ? resKeywords.value.data : []);
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

  const topicColorMap = React.useMemo(() => {
    const map = {};
    topTerminologies.slice(0, 5).forEach((term, index) => {
      const key = normalizeLabel(term?.name);
      if (!key) return;
      map[key] = TOPIC_COLOR_PALETTE[index];
    });
    return map;
  }, [topTerminologies]);

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
                  {sortedPapers.map((paper) => {
                    const authors = (paper.authors || []).map((a) => a?.name).filter(Boolean);
                    const doiValue = (paper.doi || '').trim();
                    const normalizedDoiLink = doiValue
                      ? (doiValue.startsWith('http') ? doiValue : `https://doi.org/${doiValue}`)
                      : '';
                    const link = normalizedDoiLink || paper.openAlexUrl || paper.openAlexId || '';
                    const paperId = paper?._id ? String(paper._id) : '';
                    const isFocused = graphMode === 'citation' && focusedPaperId && paperId === focusedPaperId;
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
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: isFocused ? '#93c5fd' : '#2563eb', textDecoration: 'none' }}
                            >
                              {paper.title || 'Untitled'}
                            </a>
                          ) : (
                            (paper.title || 'Untitled')
                          )}
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
                  {sortedPapers.length === 0 && (
                    <tr style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                      <td colSpan={4} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', padding: '12px', textAlign: 'center' }}>
                        Waiting for top papers...
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
                    data={paperNetwork}
                    mode={graphMode}
                    citationSpacing={citationSpacing}
                    focusPaperId={focusedPaperId}
                  />
                ) : (
                  <p style={{ fontFamily: font }}>Waiting for paper network...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...panelStyle, height: '315px' }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>Ranked Table</p>
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
                  {topTerminologies.map((term, index) => (
                    <tr key={term.name} style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
                      <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
                          values={term.trend}
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
                {evolutionData?.data?.length > 0 ? (
                  <TopicChart rawData={evolutionData} conceptColors={topicColorMap} />
                ) : (
                  <p style={{ fontFamily: font }}>Waiting for data...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;