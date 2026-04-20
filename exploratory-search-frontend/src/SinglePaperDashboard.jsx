import React, { useCallback, useEffect, useRef, useState } from 'react';
import {updateFavoritePapers, getFavoritePaper, getFavoriteTerms, updateFavoriteTerms} from './BackFetch'
import axios from 'axios';
import TopicChart from './TopicChart';
import PaperForceGraph from './PaperForceGraph';
import BarGraph from './Bargraph'
import WordCloud from './WordCloud'
import CitedLineChart from './CitedLineChart';

import { MathJax, MathJaxContext } from "better-react-mathjax";

const font = "'Consolas', monospace";

const normalizeLabel = (value) => (value || '').toString().trim().toLowerCase();

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

function cleanMath(text = "") {
  return text
    .replace(/\\ensuremath\{(.*?)\}/g, "$1")  
}

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

function SinglePaperDashboard({ paper,onReturn, searchTerm, onNewSearch, onSelectPaper,onSelectAuthor }) {
  const [stats, setStats] = useState(null);
  const [evolutionData, setEvolutionData] = useState([]);
  const [topTerminologies, setTopTerminologies] = useState([]);
  const [paperNetwork, setPaperNetwork] = useState({ nodes: [], links: [] });
  const [topPapers, setTopPapers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [conceptChart, setConceptChart] = useState('concepts');
  const [topKeywords, setTopKeywords] = useState([]);
  const [citHisory, setCitHistory] = useState([]);
  const [closestPapers, setClosestPapers] = useState([]);
  const [authorPaper, setAuthorPaper] = useState([]);
  const pollInterval = useRef(null);

  const [isFavoritesMinimized, setIsFavoritesMinimized] = useState(false);
  const [favoritePaperTopics, setFavoritePaperTopics] = useState({});
  const [favoriteRankedKeywords, setFavoriteRankedKeywords] = useState([]);

  const favoritePaperTopicsRef = useRef(favoritePaperTopics);
  const favoriteRankedKeywordsRef = useRef(favoriteRankedKeywords);

  const loadData = async () => {
      const paperData = await getFavoritePaper(searchTerm);
      const termData = await getFavoriteTerms(searchTerm);
      
      const buildMap = (papers) =>
        Object.fromEntries(
          (papers || []).map(p => [
            String(p.openAlexId),
            getPaperTopicTerms(p)
          ])
      );
    
    setFavoritePaperTopics(buildMap(paperData?.papers));
    setFavoriteRankedKeywords(termData?.terms || []);
  };

  const fetchData = useCallback(async () => {
    try {
        const resStats = await axios.get('http://localhost:5000/api/papers/dashboard-stats');
              
              
              const dashboardStats = resStats.data.stats;
              setStats(dashboardStats);
      
              if (dashboardStats && dashboardStats.totalPapers > 0) {
                setIsSyncing(false);
              if (pollInterval.current) clearInterval(pollInterval.current);

        const [  resNetwork, resTopPapers,resKeywords,resCitHistory,resClosestPapers,resAuthorPaper] = await Promise.allSettled([
          
          
          axios.get('http://localhost:5000/api/paper-network?limit=20'),
          axios.get('http://localhost:5000/api/top-cited?workType=article'),
          axios.get('http://localhost:5000/api/keywords?limit=100'),
          axios.get(`http://localhost:5000/api/yearly-citations/${paper._id}`),
          axios.get(`http://localhost:5000/api/closest-papers/${paper._id}`),
          axios.get(`http://localhost:5000/api/paper-authors/${paper._id}`)
        ]);

        
       
        if (resTopPapers.status === 'fulfilled') {
          setTopPapers(Array.isArray(resTopPapers.value.data) ? resTopPapers.value.data : []);
        }if (resKeywords.status === 'fulfilled') {
          setTopKeywords(Array.isArray(resKeywords.value.data) ? resKeywords.value.data : []);
        }if (resCitHistory.status === 'fulfilled') {
          setCitHistory(Array.isArray(resCitHistory.value.data) ? resCitHistory.value.data : []);
        }if (resClosestPapers.status === 'fulfilled') {
          setClosestPapers(Array.isArray(resClosestPapers.value.data) ? resClosestPapers.value.data : []);
        }if (resAuthorPaper.status === 'fulfilled') {
          setAuthorPaper(Array.isArray(resAuthorPaper.value.data) ? resAuthorPaper.value.data : []);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
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
  
      
    setFavoriteRankedKeywords((prev) => prev.filter((term) => normalizeLabel(term) !== removeKey));
  }, []);
  
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

  const clearKeywords = useCallback(() => {
      setFavoritePaperTopics({});
      setFavoriteRankedKeywords([]);
  });
   
  useEffect(() => {
    favoritePaperTopicsRef.current = favoritePaperTopics;
    favoriteRankedKeywordsRef.current = favoriteRankedKeywords;
  },[[favoriteRankedKeywords,favoriteRankedKeywords]]);

  useEffect(() => {
    loadData();
    fetchData();
    pollInterval.current = setInterval(fetchData, 3000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [fetchData]);



  return ( <MathJaxContext>
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', display: 'flex', flexDirection: 'column', marginBottom: "60px"}}>
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
          <button onClick={async () => {
            try {                      
              await updateFavoritePapers(
                searchTerm,
                Object.keys(favoritePaperTopicsRef.current)
              );
              await updateFavoriteTerms(searchTerm, favoriteRankedKeywordsRef.current);
              } catch (err) {
              } finally {
                onReturn(); 
                                  
              }
            }} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #eeeff0', borderRadius: '100px', padding: '10px 22px', cursor: 'pointer', minWidth: '215px' }}>
            Return
          </button>
          <button onClick={async () => {
            try {                      
              await updateFavoritePapers(
                searchTerm,
                Object.keys(favoritePaperTopicsRef.current)
              );
              await updateFavoriteTerms(searchTerm, favoriteRankedKeywordsRef.current);
              } catch (err) {
              } finally {
                 onNewSearch(); 
                        
              }
            }}style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280', backgroundColor: '#f9fafb', border: '1px solid #eeeff0', borderRadius: '100px', padding: '10px 22px', cursor: 'pointer', minWidth: '215px' }}>
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
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#6b7280' }}>Number of Authors</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '38px', color: '#111827' }}>{paper?.authors?.length ?? '0'}</span>
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
            

            <div style={{ ...panelStyle }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>Authors</p>
              <div style={{ width: '100%', maxHeight: '320px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, backgroundColor: '#fff', border: '1px solid #eeeff0', borderRadius: '10px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      {['Author', 'Citations', 'Papers' ].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: '#111827', padding: '10px 12px', borderBottom: '1px solid #eeeff0' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {authorPaper.map((author) => {
                      const name = author?._id || ""; 
                      const count = author?.count || 0;
                      const citation = author?.citations || 0;
                      return (
                        <tr key={paper._id || `${paper.title}-${paper.citationCount}`}>
                          <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                            {
                              <span onClick={() => onSelectAuthor({ name: name})}  style={{ color: '#2563eb', textDecoration: 'none', cursor: 'pointer' }}>
                                    {name || 'Unknown'}
                                  </span>
                            }
                          </td>
                          <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                            {citation || 0}
                          </td>
                          <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                            {count || 0}
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
            {paper?.abstract ? 
            (<div style= {{...panelStyle,height: "225px", overflowY: "auto", paddingBottom: "20px"}} >
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>Abstract</p>
              <p> <MathJax dynamic> {cleanMath(paper.abstract)}</MathJax> </p></div>) : null}
            <div style={{ ...panelStyle, flex: 1  }}>
                 
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>Topics</p> 
              <div style={{ 
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                maxHeight: "150px",        
                overflowY: "auto",
                scrollBehavior: "smooth",
                marginBottom: "20px",
                marginTop: "20px"
              }}  >
                {paper.tags?.map((tag, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleFavoriteRankedKeyword(tag)}
                  title="Remove keyword"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "12px",
                    backgroundColor: favoriteKeywordSet?.has(normalizeLabel(tag)) ?  "#c1c3c7" : "#f0f2fc" ,
                    color: "#3730a3" ,
                    fontSize: "20px",
                    border: "1px solid #c7d2fe",
                          
                  }}>
                    {tag + " "}
                    
                      {favoriteKeywordSet?.has(normalizeLabel(tag)) ? 'x' : '+'}
                  </button>
                  
                    ))}
                </div>
                   
              </div>
            </div>
            
              
            
          
          <div style={{ display: 'flex', flexDirection: 'column' , gap: '10px', alignItems: 'stretch', flex: '1' }} >
            <div style={{ ...panelStyle, flex: 1.75, height: '1000px' }}>
                
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>Closest Papers</p>
              <div style={{ width: '100%', maxHeight: '320px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, backgroundColor: '#fff', border: '1px solid #eeeff0', borderRadius: '10px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      {['Title', 'Citations', 'Published', 'Total Authors','Similarty Score'].map((h) => (
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

                      const paperId = paper?.openAlexId ? String(paper.openAlexId) : '';
                      const paperFavoriteKey = paperId || `${paper?.title || 'untitled'}-${paper?.year || 0}`;
                      const isFavorited = Boolean(favoritePaperTopics[paperFavoriteKey]);
                      const link = normalizedDoiLink || paper.openAlexUrl || paper.openAlexId || '';
                      const score = (paper.sharedScore * 100 || 0 ).toFixed(2);
                      return (
                        <tr key={paper._id || `${paper.title}-${paper.citationCount}`}>
                          <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
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
                                color: isFavorited ? '#ef4444' :  '#9ca3af'
                              }}
                            >
                              {isFavorited ? '♥' : '♡'}
                            </button>
                            {link ? (
                              <span onClick={() => onSelectPaper(paper)}  style={{ color: '#2563eb', textDecoration: 'none', cursor: 'pointer' }}>
                                    {paper.title || 'Untitled'}
                                  </span>
                            ) : (
                              (paper.title || 'Untitled')
                            )}
                            </span>
                          </td>
                          <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                            {paper.citationCount || 0}
                          </td>
                          <td style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#111827', padding: '8px 12px', borderBottom: '1px solid #eeeff0' }}>
                            <span style={{ fontWeight: 600 }}>{paper.year}</span> {paper.venue ? ` - ${paper.venue}` : ''}
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
            <div style={{ ...panelStyle, height: '350px' }}>
                <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '18px', margin: '0 0 10px 0' }}>
                  Yearly Citation Count
                </p>
                <div style={{ height: '325px' }}>
                  {citHisory?.length > 0 ? <CitedLineChart rawData={citHisory} type={"paper"} /> : <p style={{ fontFamily: font }}>Waiting for data...</p>}
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
            Favorite Keywords 
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
              onClick={clearKeywords}
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
              Clear
            </button>
          </div>
        </div>
        </div>
    </div> </MathJaxContext>
  );
}

export default SinglePaperDashboard;