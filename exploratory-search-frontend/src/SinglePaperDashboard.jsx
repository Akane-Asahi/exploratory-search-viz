import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import TopicChart from './TopicChart';
import PaperForceGraph from './PaperForceGraph';
import BarGraph from './Bargraph'
import WordCloud from './WordCloud'
import CitedLineChart from './CitedLineChart';

const font = "'Consolas', monospace";

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

function TrendSparkline({ values }) {
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

  return (
    <svg width={width} height={height}>
      <polyline
        fill="none"
        stroke={trendUp ? '#2563eb' : '#64748b'}
        strokeWidth="2"
        points={coords}
      />
    </svg>
  );
}

function SinglePaperDashboard({ paper,onReturn, searchTerm, onNewSearch, onSelectPaper }) {
  const [stats, setStats] = useState(null);
  const [evolutionData, setEvolutionData] = useState([]);
  const [topTerminologies, setTopTerminologies] = useState([]);
  const [paperNetwork, setPaperNetwork] = useState({ nodes: [], links: [] });
  const [topPapers, setTopPapers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [topKeywords, setTopKeywords] = useState([]);
  const [citHisory, setCitHistory] = useState([]);
  const [closestPapers, setClosestPapers] = useState([]);
  const pollInterval = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const resStats = await axios.get('http://localhost:5000/api/dashboard-stats');
      setStats(resStats.data);

      if (resStats.data.totalPapers > 0) {
        setIsSyncing(false);
        if (pollInterval.current) clearInterval(pollInterval.current);

        const [resEvo, resTerminology, resNetwork, resTopPapers,resKeywords,resCitHistory,resClosestPapers] = await Promise.allSettled([
          axios.get('http://localhost:5000/api/topic-timeline?limit=8'),
          axios.get('http://localhost:5000/api/terminology'), 
          axios.get('http://localhost:5000/api/paper-network?limit=20'),
          axios.get('http://localhost:5000/api/top-cited?limit=20'),
          axios.get('http://localhost:5000/api/keywords?limit=100'),
          axios.get(`http://localhost:5000/api/yearly-citations/${paper._id}`),
          axios.get(`http://localhost:5000/api/closest-papers/${paper._id}`)
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
            links: Array.isArray(payload.links) ? payload.links : []
          });
        }
        if (resTopPapers.status === 'fulfilled') {
          setTopPapers(Array.isArray(resTopPapers.value.data) ? resTopPapers.value.data : []);
        }if (resKeywords.status === 'fulfilled') {
          setTopKeywords(Array.isArray(resKeywords.value.data) ? resKeywords.value.data : []);
        }if (resCitHistory.status === 'fulfilled') {
          setCitHistory(Array.isArray(resCitHistory.value.data) ? resCitHistory.value.data : []);
        }if (resClosestPapers.status === 'fulfilled') {
          setClosestPapers(Array.isArray(resClosestPapers.value.data) ? resClosestPapers.value.data : []);
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
          <button onClick={onReturn} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #eeeff0', borderRadius: '100px', padding: '10px 22px', cursor: 'pointer', minWidth: '215px' }}>
            Return
          </button>
          <button onClick={onNewSearch} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #eeeff0', borderRadius: '100px', padding: '10px 22px', cursor: 'pointer', minWidth: '215px' }}>
            Search another topic
          </button>
        </div>
      </div>

      <div style={{ padding: '15px 30px 30px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ padding: '0 0 4px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '16px', margin: 0 }}>Metrics</p>
            {(() => {
              const doiValue = (paper.doi || '').trim();
              console.log("paper:", paper);        // ← check paper exists
              console.log("doi:", doiValue);
              const normalizedDoiLink = doiValue
                ? (doiValue.startsWith('http') ? doiValue : `https://doi.org/${doiValue}`)
                : '';
              const link = normalizedDoiLink || paper.openAlexUrl || paper.openAlexId || '';
              return (
                <a href={link} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>
                  {` → ${paper.title}`} 
                </a>
              );
            })()} 
          </div> 
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Total Citations</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>{paper?.citationCount ?? '0'}</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Active Concepts</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>{stats?.activeConcepts ?? '0'}</span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Keywords</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>
                {paper?.keywords.length ?? 0}
              </span>
            </div>
            <div style={cardStyle}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Year</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>{paper?.year ?? 0}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '0 0 42%' }}>
            <div style={{ ...panelStyle, height: '315px' }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#6b7280', lineHeight: '41px', margin: 0 }}>
                  Yearly Citation Count
                </p>
                <div style={{ height: '250px' }}>
                  {citHisory?.length > 0 ? <CitedLineChart rawData={citHisory} /> : <p style={{ fontFamily: font }}>Waiting for data...</p>}
                </div>
            </div>

            <div style={{ ...panelStyle, height: '315px' }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: '12px', color: '#6b7280', lineHeight: '41px', margin: 0 }}>
                Topic Growth Timeline (Line Chart)
              </p>
              {/* <div style={{ height: '250px' }}>
                {evolutionData?.data?.length > 0 ? <TopicChart rawData={evolutionData} /> : <p style={{ fontFamily: font }}>Waiting for data...</p>}
              </div> */}
            </div>

              
            
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' , gap: '10px', alignItems: 'stretch', flex: '1' }} >
            <div style={{ ...panelStyle, flex: 1.75, height: '1000px' }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '12px', color: '#6b7280', lineHeight: '41px', margin: 0 }}>
                Visualization here
              </p>
              <div style={{ height: '588px' }}>
                {/* {paperNetwork.nodes.length > 0 ? (
                  <PaperForceGraph data={paperNetwork} />
                ) : (
                  <p style={{ fontFamily: font }}>Waiting for paper network...</p>
                )} */}
              </div>
              
            </div>
            <div style={{ ...panelStyle, flex: 1 ,height: '315px' }}>
                
              </div>
            </div>
          </div>

        <div style={{ ...panelStyle }}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>Closest Papers</p>
          <div style={{ width: '100%', maxHeight: '320px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, backgroundColor: '#fff', border: '1px solid #eeeff0', borderRadius: '10px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  {['Title', 'Citations', 'Published', 'Total Authors','Score'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #eeeff0' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closestPapers.map((paper) => {
                  const authors = (paper.authors || []).map((a) => a?.name).filter(Boolean);
                  const doiValue = (paper.doi || '').trim();
                  const normalizedDoiLink = doiValue
                    ? (doiValue.startsWith('http') ? doiValue : `https://doi.org/${doiValue}`)
                    : '';
                  const link = normalizedDoiLink || paper.openAlexUrl || paper.openAlexId || '';
                  const score = (paper.sharedConceptScore * 100 || 0 ).toFixed(2);
                  return (
                    <tr key={paper._id || `${paper.title}-${paper.citationCount}`}>
                      <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                        {link ? (
                          <span onClick={() => onSelectPaper(paper)}  style={{ color: '#2563eb', textDecoration: 'none', cursor: 'pointer' }}>
                                {paper.title || 'Untitled'}
                              </span>
                        ) : (
                          (paper.title || 'Untitled')
                        )}
                      </td>
                      <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                        {paper.citationCount || 0}
                      </td>
                      <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                        {paper.venue || 'Unknown Venue'}
                      </td>
                      <td
                        title={authors.length > 0 ? authors.join(', ') : 'No author names available'}
                        style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0', cursor: 'help' }}
                      >
                        {authors.length}
                      </td>
                      <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                        {score || 'Unknown Score'}
                      </td>
                    </tr>
                  );
                })}
                {topPapers.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', padding: '12px', textAlign: 'center' }}>
                      Waiting for top papers...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SinglePaperDashboard;