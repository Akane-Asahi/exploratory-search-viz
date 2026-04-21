import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from './apiBase';

const SearchIcon = () => (
  <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
    <circle cx="35" cy="35" r="35" fill="black"/>
    <path d="M22 35H48M48 35L38 25M48 35L38 45" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BAR_LENGTH = 30;

function ProgressBar({ saved, total }) {
  const isCalculating = typeof total === 'string';
  const ratio = isCalculating || total === 0 ? 0 : Math.min(saved / total, 1);
  const filled = Math.round(ratio * BAR_LENGTH);
  const empty = BAR_LENGTH - filled;
  const bar = '▓'.repeat(filled) + '░'.repeat(empty);
  const pct = isCalculating ? 0 : (ratio * 100).toFixed(0);

  return (
    <div style={{
      fontFamily: "'Consolas', monospace",
      fontSize: '18px',
      color: 'black',
      textAlign: 'center',
      lineHeight: '1.8'
    }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '20px' }}>
        {isCalculating ? "Calculating total papers..." : `Fetching top ${Math.min(total, 10000).toLocaleString()} papers`}
      </p>
      {!isCalculating && (
        <>
          <p style={{ margin: 0, letterSpacing: '1px' }}>{bar}</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '16px', color: '#555' }}>
            {saved.toLocaleString()} / {Math.min(total, 10000).toLocaleString()} ({pct}%)
          </p>
          {total > 10000 && (
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#059669' }}>
              Found {total.toLocaleString()} total papers in OpenAlex index.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function HomePage({ onSearchComplete,inputTerm }) {
  const [searchTerm, setSearchTerm] = useState(inputTerm);
  const [category, setCategory] = useState('All Computer Science');
  const [sortBy, setSortBy] = useState('relevance');
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
        const res = await axios.get(`${API_BASE_URL}/api/fetch-status`);
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
    setProgress({ saved: 0, total: "Calculating...", status: 'fetching', error: null });
    termRef.current = term;

    try {
      await axios.post(`${API_BASE_URL}/api/trigger-fetch`,
        { searchTerm: term, category, sortBy },
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
        gap: '30px',
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
          margin: '0 0 20px 0',
          textAlign: 'center'
        }}>
          Your Next Research
        </h1>

        {!isLoading && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
                    padding: '0 30px'
                  }}
                />
                <div style={{ width: '1px', height: '38px', backgroundColor: '#e2e8f0' }} />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    paddingLeft: '15px',
                    paddingRight: '18px',
                    color: '#64748b',
                    fontFamily: "'Consolas', monospace",
                    fontSize: '14px',
                    height: '100%',
                    cursor: 'pointer',
                    maxWidth: '235px'
                  }}
                >
                  <option value="All Computer Science">All Computer Science</option>
                  <option value="Information Retrieval & Search">Information Retrieval & Search</option>
                  <option value="HCI & Visualization">HCI & Visualization</option>
                  <option value="AI & Machine Learning">AI & Machine Learning</option>
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Computer Graphics">Computer Graphics</option>
                  <option value="Theoretical Computer Science">Theoretical Computer Science</option>
                  <option value="Computer Networks & Comm">Computer Networks & Comm</option>
                  <option value="Computer Security & Reliability">Computer Security & Reliability</option>
                  <option value="Database Management Systems">Database Management Systems</option>
                </select>
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

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontFamily: "'Consolas', monospace", fontSize: '14px', color: '#64748b' }}>
                Sort Results By:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  border: '2px solid black',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  outline: 'none',
                  background: 'white',
                  fontFamily: "'Consolas', monospace",
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="relevance">Relevance (Best Match)</option>
                <option value="citations">Citation Count (Most Impactful)</option>
                <option value="date">Publication Date (Newest First)</option>
              </select>
            </div>
          </div>
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