const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');
const resultsGrid = document.getElementById('resultsGrid');
const audioPlayer = document.getElementById('audioElement');
const playerBar = document.getElementById('playerBar');
const sidebar = document.getElementById('sidebar');

// Sidebar Elements
const currentSongTitleCtx = document.getElementById('currentSongTitleCtx');
const currentArtistCtx = document.getElementById('currentArtistCtx');

// State
let isRepeat = false;
let currentTrackId = null;
let searchResults = []; // To handle next/prev logic

searchBtn.addEventListener('click', performSearch);
document.getElementById('closeSidebar').addEventListener('click', () => sidebar.classList.remove('active'));
document.getElementById('playPauseBtn').addEventListener('click', togglePlay);
document.getElementById('closePlayerBtn').addEventListener('click', closePlayer);
document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);
document.getElementById('nextBtn').addEventListener('click', () => navigateTrack(1));
document.getElementById('prevBtn').addEventListener('click', () => navigateTrack(-1));

async function performSearch() {
    const query = searchInput.value;
    if (!query) return;

    resultsGrid.innerHTML = '<p style="color:white; text-align:center; width:100%;">Searching...</p>';
    
    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        
        searchResults = data; // Store for navigation
        renderResults(data);
    } catch (e) {
        resultsGrid.innerHTML = '<p>Error fetching results.</p>';
    }
}

function renderResults(data) {
    resultsGrid.innerHTML = '';
    data.forEach((track, index) => {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <img src="${track.thumbnail}" alt="${track.title}">
            <h4>${track.title}</h4>
            <p>${track.uploader}</p>
        `;
        card.onclick = () => loadTrack(index);
        resultsGrid.appendChild(card);
    });
}

async function loadTrack(index) {
    const track = searchResults[index];
    if (!track) return;

    // Requirement: Automatically clear previous cached music
    // The browser automatically handles this when the src changes.
    // However, to be explicit about stopping the old download:
    audioPlayer.pause();
    audioPlayer.src = ""; 
    audioPlayer.load(); // Forces buffer flush

    currentTrackId = index;
    
    // Update UI
    document.getElementById('playerTitle').innerText = track.title;
    document.getElementById('playerArtist').innerText = track.uploader;
    document.getElementById('playerThumb').src = track.thumbnail;
    playerBar.classList.remove('hidden');
    
    // Update Sidebar Context
    currentSongTitleCtx.innerText = track.title;
    currentArtistCtx.innerText = track.uploader;
    sidebar.classList.add('active');

    // Fetch Stream URL
    try {
        const res = await fetch(`/api/stream/${track.id}`);
        const data = await res.json();
        
        if (data.stream_url) {
            // Requirement: Download to browser cache and stream
            // Setting the src to a remote URL streams it. 
            // The browser caches this stream in RAM/Temp cache until closed.
            audioPlayer.src = data.stream_url;
            audioPlayer.play();
            updatePlayButton(true);
        }
    } catch (e) {
        console.error("Stream failed", e);
    }
}

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
    btn.innerHTML = isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
}

function closePlayer() {
    // Requirement: 'X' button clears cache
    audioPlayer.pause();
    audioPlayer.src = ""; // Detaches the resource, clearing buffer
    audioPlayer.load();
    playerBar.classList.add('hidden');
    sidebar.classList.remove('active');
}

function toggleRepeat() {
    isRepeat = !isRepeat;
    const btn = document.getElementById('repeatBtn');
    btn.classList.toggle('active-repeat');
    audioPlayer.loop = isRepeat; // HTML5 Audio native loop uses cached buffer
}

function navigateTrack(direction) {
    // Requirement: Clear current cache and move to next
    let newIndex = currentTrackId + direction;
    if (newIndex >= 0 && newIndex < searchResults.length) {
        loadTrack(newIndex);
    }
}
