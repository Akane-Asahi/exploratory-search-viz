
const updateFavoritePapers = async (searchTerm,papers) => {
  await fetch(`http://localhost:5000/api/insert-favorite-paper/${searchTerm}`, {
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
      `http://localhost:5000/api/favorite-paper/${searchTerm}`
    );

    const data = await res.json();
    return data; 
  } catch (err) {
    console.error(err);
    return null;
  }
};


const updateFavoriteTerms = async (searchTerm,terms) => {
  await fetch(`http://localhost:5000/api/insert-favorite-term/${searchTerm}`, {
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
      `http://localhost:5000/api/favorite-term/${searchTerm}`
    );

    const data = await res.json();
    return data; 
  } catch (err) {
    console.error(err);
    return null;
  }
};

export { updateFavoritePapers, getFavoritePaper, updateFavoriteTerms, getFavoriteTerms };
