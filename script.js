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
        div.onclick = () => playSong(item.videoId, index);
        resultsDiv.appendChild(div);
    });
}

async function playSong(videoId, index) {
    currentVideoId = videoId;
    songIndex = index;
    document.getElementById('player-controls').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');

    // Load similar and artist
    loadSimilar(videoId);
    loadArtist(item.artists[0].id); // Assuming item has artists[0].id from search result

    // Start streaming with MSE
    clearMediaSource(); // Clear previous
    const audio = document.getElementById('audio-player');
    mediaSource = new MediaSource();
    audio.src = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', () => {
        sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
        streamAudio(videoId);
    });
    audio.play();
}

async function streamAudio(videoId) {
    fetchController = new AbortController();
    const response = await fetch(`/stream/${videoId}`, { signal: fetchController.signal });
    const reader = response.body.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!sourceBuffer.updating) {
            sourceBuffer.appendBuffer(value);
        } else {
            // Wait for update end
            await new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, { once: true }));
            sourceBuffer.appendBuffer(value);
        }
    }
    mediaSource.endOfStream();
}

function clearMediaSource() {
    if (fetchController) fetchController.abort();
    if (mediaSource && sourceBuffer) {
        if (!sourceBuffer.updating) {
            mediaSource.removeSourceBuffer(sourceBuffer);
        }
        URL.revokeObjectURL(document.getElementById('audio-player').src);
        mediaSource = null;
        sourceBuffer = null;
    }
}

function togglePlayPause() {
    const audio = document.getElementById('audio-player');
    if (audio.paused) audio.play(); else audio.pause();
}

function nextSong() {
    if (!repeat) clearMediaSource();
    songIndex = (songIndex + 1) % currentSongs.length;
    playSong(currentSongs[songIndex].videoId, songIndex);
}

function previousSong() {
    if (!repeat) clearMediaSource();
    songIndex = (songIndex - 1 + currentSongs.length) % currentSongs.length;
    playSong(currentSongs[songIndex].videoId, songIndex);
}

function closeSong() {
    clearMediaSource();
    document.getElementById('player-controls').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
}

function toggleRepeat() {
    repeat = !repeat;
    document.getElementById('repeat-btn').textContent = `Repeat: ${repeat ? 'On' : 'Off'}`;
    // If on and ended, can replay without clear; audio handles loop if set audio.loop = repeat;
}

async function loadSimilar(videoId) {
    const response = await fetch(`/similar?video_id=${videoId}`);
    const similar = await response.json();
    // Store for collection view
}

function showSimilarCollection() {
    const collectionDiv = document.getElementById('similar-collection');
    collectionDiv.classList.toggle('hidden');
    // Populate with similar tracks, each clickable to play
}

async function loadArtist(channelId) {
    const response = await fetch(`/artist?channel_id=${channelId}`);
    const songs = await response.json();
    // Store for view
}

function showArtistView() {
    const artistView = document.getElementById('artist-view');
    artistView.classList.toggle('hidden');
    const sortOption = document.getElementById('sort-option').value;
    // Sort songs array in JS (e.g., by views for popularity, year for release)
    // Display sorted list, each clickable to play
}

// Add event for sort change to re-display
document.getElementById('sort-option').onchange = showArtistView;
