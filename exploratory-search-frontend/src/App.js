import React, { useState } from 'react';
import HomePage from './HomePage';
import DashboardPage from './DashboardPage';

function App() {
  const [searchTerm, setSearchTerm] = useState(null);

  if (!searchTerm) {
    return <HomePage onSearchComplete={(term) => setSearchTerm(term)} />;
  }

  return (
    <DashboardPage
      searchTerm={searchTerm}
      onNewSearch={() => setSearchTerm(null)}
    />
  );
}

export default App;
