# app.py
from flask import Flask, request, Response, jsonify, send_from_directory
import ytmusicapi
import yt_dlp
import requests
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # This fixes the JSON error you saw

ytmusic = ytmusicapi.YTMusic()

def get_audio_stream_url(video_id):
    ydl_opts = {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            formats = info.get('formats', [])
            # Prefer AAC in MP4 container (most browser-friendly)
            for f in formats:
                if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    if 'mp4a' in f.get('acodec', '') or 'aac' in f.get('acodec', '').lower():
                        return f['url']
            # Fallback to any audio
            for f in formats:
                if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    return f['url']
        except:
            return None
    return None

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/search')
def search():
    query = request.args.get('query', '')
    results = ytmusic.search(query, filter='songs')[:20]
    return jsonify(results)

@app.route('/similar')
def similar():
    video_id = request.args.get('video_id')
    try:
        playlist = ytmusic.get_watch_playlist(video_id)
        tracks = playlist.get('tracks', [])
        return jsonify(tracks[1:21] if len(tracks) > 1 else [])  # skip current song
    except:
        return jsonify([])

@app.route('/artist')
def artist():
    channel_id = request.args.get('channel_id')
    try:
        artist_data = ytmusic.get_artist(channel_id)
        songs = artist_data.get('songs', {}).get('results', [])
        return jsonify(songs)
    except Exception as e:
        print("Artist error:", e)
        return jsonify([]), 500

@app.route('/stream/<video_id>')
def stream(video_id):
    url = get_audio_stream_url(video_id)
    if not url:
        return "Stream not found", 404

    def generate():
        with requests.get(url, stream=True, timeout=10) as r:
            r.raise_for_status()
            for chunk in r.iter_content(chunk_size=65536):
                if chunk:
                    yield chunk

    return Response(generate(), mimetype='audio/mp4')  # Most reliable for browsers

if __name__ == '__main__':
    app.run()
