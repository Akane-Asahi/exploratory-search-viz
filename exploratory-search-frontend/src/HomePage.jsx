import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SearchIcon = () => (
  <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
    <circle cx="35" cy="35" r="35" fill="black"/>
    <path d="M22 35H48M48 35L38 25M48 35L38 45" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BAR_LENGTH = 30;

function ProgressBar({ saved, total }) {
  const ratio = Math.min(saved / total, 1);
  const filled = Math.round(ratio * BAR_LENGTH);
  const empty = BAR_LENGTH - filled;
  const bar = '▓'.repeat(filled) + '░'.repeat(empty);
  const pct = (ratio * 100).toFixed(0);

  return (
    <div style={{
      fontFamily: "'Consolas', monospace",
      fontSize: '18px',
      color: 'black',
      textAlign: 'center',
      lineHeight: '1.8'
    }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
        Fetching {total.toLocaleString()} papers
      </p>
      <p style={{ margin: 0, letterSpacing: '1px' }}>{bar}</p>
      <p style={{ margin: '8px 0 0 0', fontSize: '16px', color: '#555' }}>
        {saved.toLocaleString()} / {total.toLocaleString()} ({pct}%)
      </p>
    </div>
  );
}

const MIN_PAPERS = 100;
const MAX_PAPERS = 10000;

function HomePage({ onSearchComplete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('keyword');
  const [paperCount, setPaperCount] = useState(5000);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const termRef = useRef('');

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = () => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get('/api/fetch-status');
        const p = res.data;
        setProgress(p);

        if (p.status === 'done') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setTimeout(() => onSearchComplete(termRef.current), 500);
        } else if (p.status === 'error') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setError(p.error || 'Fetch failed');
          setIsLoading(false);
        }
      } catch {
        // poll silently retries
      }
    }, 2000);
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    const term = searchTerm.trim();
    if (!term) {
      setError('Please enter a search term');
      return;
    }
    setError(null);
    setIsLoading(true);
    setProgress({ saved: 0, total: paperCount, status: 'fetching', error: null });
    termRef.current = term;

    try {
      await axios.post('/api/trigger-fetch',
        { searchTerm: term, totalPapers: paperCount, searchMode },
        { timeout: 10000 }
      );
      startPolling();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start fetch');
      setIsLoading(false);
      setProgress(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div style={{
      backgroundColor: '#f3f5ef',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '50px',
        padding: '0 30px',
        width: '100%',
        maxWidth: '1062px'
      }}>
        <h1 style={{
          fontFamily: "'Hanson', sans-serif",
          fontWeight: 'bold',
          fontSize: '80px',
          lineHeight: '1',
          color: 'black',
          margin: 0,
          textAlign: 'center'
        }}>
          Your Next Research
        </h1>

        {!isLoading && (
          <>
            <div style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              width: '100%'
            }}>
              <div style={{
                flex: 1,
                backgroundColor: 'white',
                border: '3px solid black',
                borderRadius: '100px',
                height: '70px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                overflow: 'hidden'
              }}>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    paddingLeft: '15px',
                    paddingRight: '10px',
                    color: '#64748b',
                    fontFamily: "'Consolas', monospace",
                    fontSize: '16px',
                    height: '100%',
                    cursor: 'pointer'
                  }}
                >
                  <option value="semantic">Semantic Search</option>
                  <option value="keyword">Keyword Search</option>
                </select>
                <div style={{ width: '1px', height: '38px', backgroundColor: '#e2e8f0' }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search your topic here"
                  style={{
                    fontFamily: "'Consolas', monospace",
                    fontSize: '24px',
                    lineHeight: '41px',
                    color: 'black',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    padding: '0 24px'
                  }}
                />
              </div>
              <button
                onClick={handleSearch}
                style={{
                  width: '70px',
                  height: '70px',
                  flexShrink: 0,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                <SearchIcon />
              </button>
            </div>
            <div style={{ width: '100%', maxWidth: 500 }}>
              <label style={{ fontFamily: "'Consolas', monospace", fontSize: '14px', color: '#333', display: 'block', marginBottom: 8 }}>
                Papers to fetch: <strong>{paperCount.toLocaleString()}</strong>
              </label>
              <input
                type="range"
                className="paper-count-slider"
                min={MIN_PAPERS}
                max={MAX_PAPERS}
                step={100}
                value={paperCount}
                onChange={(e) => setPaperCount(Number(e.target.value))}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Consolas', monospace", fontSize: '12px', color: '#64748b', marginTop: 4 }}>
                <span>100</span>
                <span>10,000</span>
              </div>
            </div>
          </>
        )}

        {isLoading && progress && (
          <ProgressBar saved={progress.saved} total={progress.total} />
        )}

        {error && (
          <div style={{ textAlign: 'center' }}>
            <p style={{
              fontFamily: "'Consolas', monospace",
              fontSize: '16px',
              color: '#dc2626',
              margin: '0 0 12px 0'
            }}>
              {error}
            </p>
            <button
              onClick={() => { setError(null); setProgress(null); }}
              style={{
                fontFamily: "'Consolas', monospace",
                fontSize: '14px',
                padding: '8px 20px',
                border: '2px solid black',
                borderRadius: '100px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
