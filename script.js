let currentVideoId = null;
let currentSongs = []; // For navigation (prev/next)
let songIndex = 0;
let mediaSource = null;
let sourceBuffer = null;
let fetchController = null;
let repeat = false;
let mimeCodec = 'audio/mp4; codecs="mp4a.40.2"'; // Changed to AAC for better support

async function performSearch() {
    const query = document.getElementById('search-bar').value;
    try {
        const response = await fetch(`/search?query=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search failed');
        const results = await response.json();
        displayResults(results);
        currentSongs = results; // For playlist navigation
    } catch (error) {
        console.error('Search error:', error);
    }
}

function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    results.forEach((item, index) => {
        const div = document.createElement('div');
        div.textContent = `${item.title} by ${item.artists?.[0]?.name || 'Unknown'}`;
        div.onclick = () => playSong(item, index);
        resultsDiv.appendChild(div);
    });
}

async function playSong(item, index) {
    currentVideoId = item.videoId;
    songIndex = index;
    document.getElementById('player-controls').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');

    loadSimilar(item.videoId);
    loadArtist(item.artists?.[0]?.id);

    clearMediaSource();
    const audio = document.getElementById('audio-player');
    mediaSource = new MediaSource();
    const objectURL = URL.createObjectURL(mediaSource);
    audio.src = objectURL;
    await new Promise(resolve => mediaSource.addEventListener('sourceopen', resolve, { once: true }));
    try {
        sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
        await streamAudio(item.videoId);
        audio.play().catch(error => console.error('Playback failed:', error));
    } catch (error) {
        console.error('MSE error:', error);
        URL.revokeObjectURL(objectURL);
    }
}

async function streamAudio(videoId) {
    fetchController = new AbortController();
    try {
        const response = await fetch(`/stream/${videoId}`, { signal: fetchController.signal });
        if (!response.ok) throw new Error('Stream failed');
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
    } catch (error) {
        console.error('Stream error:', error);
    }
}

function clearMediaSource() {
    if (fetchController) fetchController.abort();
    if (mediaSource && sourceBuffer) {
        if (sourceBuffer.updating) {
            sourceBuffer.addEventListener('updateend', () => {
                if (sourceBuffer) mediaSource.removeSourceBuffer(sourceBuffer);
            }, { once: true });
        } else {
            mediaSource.removeSourceBuffer(sourceBuffer);
        }
        const audio = document.getElementById('audio-player');
        URL.revokeObjectURL(audio.src);
        audio.src = '';
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
    audio.loop = repeat;
}

let similarTracks = [];
async function loadSimilar(videoId) {
    try {
        const response = await fetch(`/similar?video_id=${videoId}`);
        if (!response.ok) throw new Error('Similar fetch failed');
        similarTracks = await response.json();
    } catch (error) {
        console.error('Load similar error:', error);
    }
}

function showSimilarCollection() {
    const collectionDiv = document.getElementById('similar-collection');
    collectionDiv.classList.toggle('hidden');
    if (!collectionDiv.innerHTML && similarTracks.length > 0) {
        similarTracks.forEach(track => {
            const div = document.createElement('div');
            div.textContent = `${track.title} by ${track.artists?.[0]?.name || 'Unknown'}`;
            div.onclick = () => playSong(track, -1);
            collectionDiv.appendChild(div);
        });
    }
}

let artistSongs = [];
async function loadArtist(channelId) {
    if (!channelId) return;
    try {
        const response = await fetch(`/artist?channel_id=${channelId}`);
        if (!response.ok) throw new Error('Artist fetch failed');
        artistSongs = await response.json();
    } catch (error) {
        console.error('Load artist error:', error);
    }
}

function showArtistView() {
    const artistView = document.getElementById('artist-view');
    artistView.classList.toggle('hidden');
    if (artistView.classList.contains('hidden')) return;

    const sortOption = document.getElementById('sort-option').value;
    let sortedSongs = [...artistSongs];

    if (sortOption === 'popularity' || sortOption === 'likes') {
        sortedSongs.sort((a, b) => {
            const viewsA = parseInt(a.views?.replace(/\D/g, '') || 0);
            const viewsB = parseInt(b.views?.replace(/\D/g, '') || 0);
            return viewsB - viewsA;
        });
    } else if (sortOption === 'latest') {
        sortedSongs.sort((a, b) => (b.year || 0) - (a.year || 0));
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

document.getElementById('sort-option').addEventListener('change', showArtistView);
