// --- DOM Elements ---
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const audioPlayer = document.getElementById('audioElement');
const playerBar = document.getElementById('playerBar');
const sidebar = document.getElementById('sidebar');

// Sidebar Context Elements
const currentSongTitleCtx = document.getElementById('currentSongTitleCtx');
const currentArtistCtx = document.getElementById('currentArtistCtx');
const artistSortSelect = document.getElementById('artistSort');
const similarBtn = document.getElementById('similarBtn');
const artistPageBtn = document.getElementById('artistPageBtn');

// --- State Management ---
let isRepeat = false;
let currentTrackIndex = null;
let searchResults = []; // Stores the current list of songs for Next/Prev navigation

// --- Event Listeners ---
searchBtn.addEventListener('click', performSearch);

// Allow pressing "Enter" in the search box
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

document.getElementById('closeSidebar').addEventListener('click', () => {
    sidebar.classList.remove('active');
});

document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
document.getElementById('closePlayerBtn').addEventListener('click', closePlayer);
document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);

// Navigation Controls
document.getElementById('nextBtn').addEventListener('click', () => navigateTrack(1));
document.getElementById('prevBtn').addEventListener('click', () => navigateTrack(-1));

// Sidebar Action Buttons (Mock Functionality)
similarBtn.addEventListener('click', () => alert(`Showing songs similar to: ${currentSongTitleCtx.innerText}`));
artistPageBtn.addEventListener('click', () => alert(`Navigating to artist page for: ${currentArtistCtx.innerText}`));

// Artist Sort Handler
artistSortSelect.addEventListener('change', (e) => {
    console.log(`Sorting artist tracks by: ${e.target.value}`);
    // In a real app, you would fetch sorted data here
});

// --- Core Functions ---

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    // Show loading state
    resultsGrid.innerHTML = '<p class="placeholder-text" style="width:100%">Searching YouTube Music...</p>';
    
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        
        if (!res.ok) throw new Error("Search failed");

        const data = await res.json();
        searchResults = data; // Store results for playlist navigation
        renderResults(data);

    } catch (e) {
        console.error(e);
        resultsGrid.innerHTML = '<p class="placeholder-text">Error fetching results. Please try again.</p>';
    }
}

function renderResults(data) {
    resultsGrid.innerHTML = '';
    
    if (data.length === 0) {
        resultsGrid.innerHTML = '<p class="placeholder-text">No results found.</p>';
        return;
    }

    data.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <img src="${track.thumbnail}" alt="${track.title}" loading="lazy">
            <h4>${track.title}</h4>
            <p>${track.uploader}</p>
        `;
        // Clicking a card loads that specific track index
        card.onclick = () => loadTrack(index);
        resultsGrid.appendChild(card);
    });
}

async function loadTrack(index) {
    // Validate index
    if (index < 0 || index >= searchResults.length) return;

    const track = searchResults[index];
    currentTrackIndex = index;

    // --- Critical Requirement: Clear previous cache ---
    // Pausing and resetting src frees the browser buffer
    audioPlayer.pause();
    audioPlayer.src = ""; 
    audioPlayer.load(); 

    // Update UI elements
    document.getElementById('playerTitle').innerText = track.title;
    document.getElementById('playerArtist').innerText = track.uploader;
    document.getElementById('playerThumb').src = track.thumbnail;
    
    // Show Player Bar
    playerBar.classList.remove('hidden');
    
    // Update and Show Sidebar
    currentSongTitleCtx.innerText = track.title;
    currentArtistCtx.innerText = track.uploader;
    sidebar.classList.add('active');

    // Reset Play/Pause Icon to 'Loading' state or 'Play'
    updatePlayButton(false); 

    try {
        // Fetch the stream URL from our backend
        const res = await fetch(`/api/stream/${track.id}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data = await res.json();
        
        if (data.stream_url) {
            // Point the audio player to our backend Proxy URL
            audioPlayer.src = data.stream_url;
            
            // Attempt to play automatically
            try {
                await audioPlayer.play();
                updatePlayButton(true);
            } catch (playError) {
                console.warn("Autoplay blocked by browser policy:", playError);
                updatePlayButton(false);
            }
        } else {
            console.error("No stream URL returned");
        }
    } catch (e) {
        console.error("Playback failed", e);
        alert("Could not play this track. YouTube might be blocking the request.");
    }
}

// --- Player Controls ---

function togglePlay() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        updatePlayButton(true);
    } else {
        audioPlayer.pause();
        updatePlayButton(false);
    }
}

function updatePlayButton(isPlaying) {
    const btn = document.getElementById('playPauseBtn');
    if (isPlaying) {
        btn.innerHTML = '<i class="fas fa-pause"></i>';
        btn.classList.add('playing'); // Optional: for CSS styling
    } else {
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.classList.remove('playing');
    }
}

function closePlayer() {
    // Stop playback and clear buffer
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer.src = "";
    
    // Hide UI
    playerBar.classList.add('hidden');
    sidebar.classList.remove('active');
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    const btn = document.getElementById('repeatBtn');
    
    // Visual toggle
    if (isRepeat) {
        btn.classList.add('active-repeat');
    } else {
        btn.classList.remove('active-repeat');
    }

    // Apply loop logic to audio element
    audioPlayer.loop = isRepeat;
}

function navigateTrack(direction) {
    if (currentTrackIndex === null) return;

    const newIndex = currentTrackIndex + direction;

    // Check bounds
    if (newIndex >= 0 && newIndex < searchResults.length) {
        loadTrack(newIndex);
    } else {
        console.log("End of playlist reached.");
    }
}

// Handle automatic next track if Repeat is OFF
audioPlayer.addEventListener('ended', () => {
    if (!isRepeat) {
        navigateTrack(1); // Auto-play next song
    }
});
