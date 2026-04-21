import React, { useState, useEffect } from 'react'; // Added useEffect
import HomePage from './HomePage';
import DashboardPage from './DashboardPage';
import SinglePaperDashboard from './SinglePaperDashboard';
import AuthorDashboardPage from './AuthorDashboardPage';

function App() {
  const [searchTerm, setSearchTerm] = useState(null);
  const [newTerm, setNewTerm] = useState("");
  const [searchPaper, setPaper] = useState(null);
  const [searchAuthor, setAuthor] = useState(null);

  // This effect runs once when the app loads to wake up your Render backend
  useEffect(() => {
    // Replace with your actual Render backend URL
    const backendUrl = "https://exploratory-search-viz.onrender.com/"; 
    
    fetch(backendUrl, { mode: 'no-cors' })
      .then(() => console.log("Backend wake-up signal sent successfully."))
      .catch((err) => console.error("Error waking up backend:", err));
  }, []);

  if (!searchTerm) {
    return <HomePage onSearchComplete={(term) => {setSearchTerm(term); setNewTerm("");}} inputTerm={newTerm} />;
  }

  if (searchAuthor){
    return (
    <AuthorDashboardPage
      key={searchAuthor.name}
      author={searchAuthor}
      onReturn={() => setAuthor(null)} 
      searchTerm={searchTerm}
      onNewSearch={() => setSearchTerm(null)}
      onSelectPaper={(paper) => {setPaper(paper); setAuthor(null);}}
      onSelectAuthor={(author) => {setAuthor(author); setPaper(null);}}
      /> );
  }

  if (searchPaper ){
    return (
    <SinglePaperDashboard
     key={searchPaper._id}
     paper={searchPaper}
     onReturn={() => setPaper(null)} 
     searchTerm={searchTerm}
     onNewSearch={() => setSearchTerm(null)}
     onSelectPaper={(paper) => {setPaper(paper); setAuthor(null);}}
     onSelectAuthor={(author) => {setAuthor(author); setPaper(null);}}
     /> );
  } 
  
  return (
    <DashboardPage
      key={searchTerm}
      searchTerm={searchTerm}
      onNewSearch={() => setSearchTerm(null)}
      onSelectPaper={(paper) => setPaper(paper)}
      onSelectAuthor={(author) => setAuthor(author)}
      onSelectWord={(word) => { 
        setNewTerm(word);       
        setSearchTerm(null);
      }}
    />
  );
}

export default App;