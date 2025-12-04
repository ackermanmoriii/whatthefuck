let currentVideoId = null;
let currentSongs = []; // For navigation (prev/next)
let songIndex = 0;
let mediaSource = null;
let sourceBuffer = null;
let fetchController = null;
let repeat = false;
let mimeCodec = 'audio/mpeg; codecs="mp3"'; // Adjust based on stream

async function performSearch() {
    const query = document.getElementById('search-bar').value;
    const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
    const results = await response.json();
    displayResults(results);
    currentSongs = results; // For playlist navigation
}

function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    results.forEach((item, index) => {
        const div = document.createElement('div');
        div.textContent = `${item.title} by ${item.artists?.[0]?.name || 'Unknown'}`;
        div.onclick = () => playSong(item, index); // Pass full item instead of just videoId
        resultsDiv.appendChild(div);
    });
}

async function playSong(item, index) { // Change param to item
    currentVideoId = item.videoId;
    songIndex = index;
    document.getElementById('player-controls').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');

    // Load similar and artist
    loadSimilar(item.videoId);
    loadArtist(item.artists?.[0]?.id); // Now item is available

    // Start streaming with MSE
    clearMediaSource(); // Clear previous
    const audio = document.getElementById('audio-player');
    mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', () => {
        sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
        streamAudio(item.videoId); // Use item.videoId
    });
    await audio.play().catch(error => console.error('Playback failed:', error)); // Use await to handle play promise
}

async function streamAudio(videoId) {
    fetchController = new AbortController();
    const response = await fetch(`/stream/${videoId}`, { signal: fetchController.signal });
    const reader = response.body.getReader();
    let updatingPromise = null;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (sourceBuffer.updating) {
            if (!updatingPromise) {
                updatingPromise = new Promise(resolve => sourceBuffer.addEventListener('updateend', () => { updatingPromise = null; resolve(); }, { once: true }));
            }
            await updatingPromise;
        }
        sourceBuffer.appendBuffer(value);
    }
    mediaSource.endOfStream();
}

function clearMediaSource() {
    if (fetchController) fetchController.abort();
    if (mediaSource && sourceBuffer) {
        if (!sourceBuffer.updating) {
            mediaSource.removeSourceBuffer(sourceBuffer);
        } else {
            // Wait for update to finish before removing
            sourceBuffer.addEventListener('updateend', () => mediaSource.removeSourceBuffer(sourceBuffer), { once: true });
        }
        URL.revokeObjectURL(document.getElementById('audio-player').src);
        mediaSource = null;
        sourceBuffer = null;
    }
}

function togglePlayPause() {
    const audio = document.getElementById('audio-player');
    if (audio.paused) {
        audio.play().catch(error => console.error('Play failed:', error));
    } else {
        audio.pause();
    }
}

function nextSong() {
    if (!repeat) clearMediaSource();
    songIndex = (songIndex + 1) % currentSongs.length;
    playSong(currentSongs[songIndex], songIndex);
}

function previousSong() {
    if (!repeat) clearMediaSource();
    songIndex = (songIndex - 1 + currentSongs.length) % currentSongs.length;
    playSong(currentSongs[songIndex], songIndex);
}

function closeSong() {
    clearMediaSource();
    document.getElementById('player-controls').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
}

function toggleRepeat() {
    repeat = !repeat;
    document.getElementById('repeat-btn').textContent = `Repeat: ${repeat ? 'On' : 'Off'}`;
    const audio = document.getElementById('audio-player');
    audio.loop = repeat; // Use native loop for repeat
}

let similarTracks = []; // Store similar tracks globally for collection view
async function loadSimilar(videoId) {
    const response = await fetch(`/similar?video_id=${videoId}`);
    similarTracks = await response.json();
    // You can pre-populate if needed, but wait for button click
}

function showSimilarCollection() {
    const collectionDiv = document.getElementById('similar-collection');
    collectionDiv.classList.toggle('hidden');
    if (!collectionDiv.innerHTML) { // Populate if not already
        similarTracks.forEach(track => {
            const div = document.createElement('div');
            div.textContent = `${track.title} by ${track.artists?.[0]?.name || 'Unknown'}`;
            div.onclick = () => playSong(track, -1); // -1 for non-playlist index
            collectionDiv.appendChild(div);
        });
    }
}

let artistSongs = []; // Store artist songs globally for view
async function loadArtist(channelId) {
    if (!channelId) return; // Guard if no artist ID
    const response = await fetch(`/artist?channel_id=${channelId}`);
    artistSongs = await response.json();
    // Wait for button click to display
}

function showArtistView() {
    const artistView = document.getElementById('artist-view');
    artistView.classList.toggle('hidden');
    if (artistView.classList.contains('hidden')) return;

    const sortOption = document.getElementById('sort-option').value;
    let sortedSongs = [...artistSongs];

    if (sortOption === 'popularity' || sortOption === 'likes') {
        // Proxy with views (assuming 'views' field exists as string like '1M views')
        sortedSongs.sort((a, b) => {
            const viewsA = parseInt(a.views?.replace(/\D/g, '') || 0);
            const viewsB = parseInt(b.views?.replace(/\D/g, '') || 0);
            return viewsB - viewsA; // Descending
        });
    } else if (sortOption === 'latest') {
        sortedSongs.sort((a, b) => (b.year || 0) - (a.year || 0)); // Assuming 'year' field
    } else if (sortOption === 'oldest') {
        sortedSongs.sort((a, b) => (a.year || 0) - (b.year || 0));
    }

    const songsDiv = document.getElementById('artist-songs');
    songsDiv.innerHTML = '';
    sortedSongs.forEach(song => {
        const div = document.createElement('div');
        div.textContent = `${song.title} (${song.year || 'Unknown'})`;
        div.onclick = () => playSong(song, -1);
        songsDiv.appendChild(div);
    });
}

// Add event for sort change to re-display
document.getElementById('sort-option').addEventListener('change', showArtistView);
