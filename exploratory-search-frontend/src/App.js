import React, { useState } from 'react';
import HomePage from './HomePage';
import DashboardPage from './DashboardPage';
import SinglePaperDashboard from './SinglePaperDashboard'

function App() {
  const [searchTerm, setSearchTerm] = useState(null);
  const [searchPaper, setPaper] = useState(null);

  if (!searchTerm) {
    return <HomePage onSearchComplete={(term) => setSearchTerm(term)} />;
  }

  if (searchPaper){
    return (
    <SinglePaperDashboard
     paper={searchPaper}
     onReturn={() => setPaper(null)} 
     searchTerm={searchTerm}
     onNewSearch={() => setSearchTerm(null)}
     /> )
  }
  

  return (
    <DashboardPage
      searchTerm={searchTerm}
      onNewSearch={() => setSearchTerm(null)}
      onSelectPaper={(paper) => setPaper(paper)}
    />
  );
}

export default App;
