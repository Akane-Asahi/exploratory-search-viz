
import API_BASE_URL from './apiBase';

const updateFavoritePapers = async (searchTerm,papers) => {
  await fetch(`${API_BASE_URL}/api/insert-favorite-paper/${searchTerm}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      papers: papers
    })
  });
}

const getFavoritePaper = async (searchTerm) => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/favorite-paper/${searchTerm}`
    );

    const data = await res.json();
    return data; 
  } catch (err) {
    console.error(err);
    return null;
  }
};


const updateFavoriteTerms = async (searchTerm,terms) => {
  await fetch(`${API_BASE_URL}/api/insert-favorite-term/${searchTerm}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      terms: terms
    })
  });
}

const getFavoriteTerms = async (searchTerm) => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/favorite-term/${searchTerm}`
    );

    const data = await res.json();
    return data; 
  } catch (err) {
    console.error(err);
    return null;
  }
};

export { updateFavoritePapers, getFavoritePaper, updateFavoriteTerms, getFavoriteTerms };
