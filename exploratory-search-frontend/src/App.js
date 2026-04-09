import React, { useState, useCallback } from 'react';
import HomePage from './HomePage';
import DashboardPage from './DashboardPage';
import SinglePaperDashboard from './SinglePaperDashboard'
import AuthorDashboardPage from './AuthorDashboardPage'

function App() {
  const [searchTerm, setSearchTerm] = useState(null);
  const [searchPaper, setPaper] = useState(null);
  const [searchAuthor, setAuthor] = useState(null);
  

  if (!searchTerm) {
    return <HomePage onSearchComplete={(term) => setSearchTerm(term)} />;
  }

  if (searchAuthor){
    return (
    <AuthorDashboardPage
      key={searchAuthor._id}
      author={searchAuthor}
      onReturn={() => setAuthor(null)} 
      searchTerm={searchTerm}
      onNewSearch={() => setSearchTerm(null)}
      onSelectPaper={(paper) => {setPaper(paper);}}
      onSelectAuthor={(author) => setAuthor(author)}
      /> )
  }

  if (searchPaper ){

    return (
    <SinglePaperDashboard
     key={searchPaper._id}
     paper={searchPaper}
     onReturn={() => setPaper(null)} 
     searchTerm={searchTerm}
     onNewSearch={() => setSearchTerm(null)}
     onSelectPaper={(paper) => {setPaper(paper);}}
     onSelectAuthor={(author) => setAuthor(author)}
     /> )
  } 
  
  

  return (
    <DashboardPage
      searchTerm={searchTerm}
      onNewSearch={() => setSearchTerm(null)}
      onSelectPaper={(paper) => setPaper(paper)}
      onSelectAuthor={(author) => setAuthor(author)}
    />
  );
}

export default App;
