# app.py
from flask import Flask, request, Response, jsonify, send_from_directory
import ytmusicapi
import yt_dlp
import requests
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

ytmusic = ytmusicapi.YTMusic()

# Best yt-dlp options for Koyeb (works 99.9% of the time)
ydl_opts = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
    'extractaudio': True,
    'audioformat': 'mp3',
    'outtmpl': '%(id)s.%(ext)s',
    'retries': 3,
    'fragment_retries': 3,
    'http_headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
}

def get_stream_url(video_id):
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://youtube.com/watch?v={video_id}", download=False)
            return info['url']  # Direct stream URL
    except Exception as e:
        print(f"yt-dlp error: {e}")
        return None

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('.', path)

@app.route('/search')
def search():
    q = request.args.get('query', '')
    results = ytmusic.search(q, filter='songs')[:30]
    return jsonify(results)

@app.route('/similar')
def similar():
    vid = request.args.get('video_id')
    try:
        data = ytmusic.get_watch_playlist(vid)
        return jsonify(data.get('tracks', [])[1:21])
    except:
        return jsonify([])

@app.route('/artist')
def artist():
    cid = request.args.get('channel_id')
    try:
        data = ytmusic.get_artist(cid)
        songs = data.get('songs', {}).get('results', [])
        return jsonify(songs)
    except Exception as e:
        print("Artist error:", e)
        return jsonify([])

@app.route('/stream/<video_id>')
def stream(video_id):
    url = get_stream_url(video_id)
    if not url:
        return "Stream not available", 404

    def generate():
        try:
            r = requests.get(url, stream=True, timeout=15)
            r.raise_for_status()
            for chunk in r.iter_content(chunk_size=65536):
                yield chunk
        except Exception as e:
            print("Streaming error:", e)

    return Response(generate(), mimetype='audio/mp4')

if __name__ == '__main__':
    app.run()
