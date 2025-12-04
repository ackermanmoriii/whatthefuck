import logging
import requests
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp

# --- Configuration & Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# --- The "Magic" Configuration to Fix 403 Errors ---
# YouTube blocks server IPs (like Koyeb). We trick it by pretending 
# to be the Android Mobile App.
YDL_OPTIONS = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'skip_download': True, # Critical: Never save to disk
    'nocheckcertificate': True,
    
    # 1. Spoof User Agent to look like an Android phone
    'user_agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    
    # 2. Force the "Android" player client. 
    # This is the key fix for "Sign in to confirm you're not a bot" errors.
    'extractor_args': {
        'youtube': {
            'player_client': ['android', 'web']
        }
    }
}

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/search', methods=['GET'])
def search_music():
    """
    Searches YouTube Music.
    Uses 'extract_flat' to be extremely fast (doesn't fetch video details).
    """
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        # Search 10 items
        search_opts = YDL_OPTIONS.copy()
        search_opts['extract_flat'] = True 
        
        with yt_dlp.YoutubeDL(search_opts) as ydl:
            info = ydl.extract_info(f"ytsearch10:{query}", download=False)
            
            results = []
            if 'entries' in info:
                for entry in info['entries']:
                    results.append({
                        'id': entry['id'],
                        'title': entry['title'],
                        'uploader': entry.get('uploader', 'Unknown Artist'),
                        'thumbnail': f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg",
                    })
            return jsonify(results)
            
    except Exception as e:
        logger.error(f"Search Error: {str(e)}")
        return jsonify({'error': 'Search failed', 'details': str(e)}), 500

@app.route('/api/stream/<video_id>')
def stream_audio_info(video_id):
    """
    Step 1: The frontend asks for a stream.
    We DO NOT return the YouTube URL directly (because it will fail on your IP).
    Instead, we return a URL pointing to *our own* proxy.
    """
    try:
        # We don't even need to call yt-dlp here, we just tell the frontend
        # "Hey, come back to /api/proxy/<video_id> to get the data"
        return jsonify({
            'stream_url': f"/api/proxy/{video_id}",
            'status': 'success'
        })
    except Exception as e:
        logger.error(f"Stream Info Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/proxy/<video_id>')
def proxy_stream(video_id):
    """
    Step 2: The actual data stream.
    Browser <-> Flask <-> YouTube
    
    1. Flask asks YouTube for the data (using the Android spoof).
    2. Flask pipes that data instantly to the Browser.
    3. No file is ever saved to the server disk.
    """
    try:
        # A. Get the real Googlevideo URL
        with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
            info = ydl.extract_info(video_id, download=False)
            real_url = info['url']
            
        # B. Establish connection to YouTube
        # stream=True ensures we don't download the whole file to RAM
        req = requests.get(real_url, stream=True, timeout=10)
        
        # C. Define a generator to yield chunks of audio
        def generate():
            for chunk in req.iter_content(chunk_size=1024 * 32): # 32KB chunks
                if chunk:
                    yield chunk

        # D. Return the response to the browser with correct headers
        return Response(
            stream_with_context(generate()), 
            content_type="audio/mp4",
            headers={
                # Helping the browser cache this temporarily
                "Cache-Control": "no-cache, no-store, must-revalidate", 
                "Pragma": "no-cache", 
                "Expires": "0",
            }
        )

    except Exception as e:
        logger.error(f"Proxy Error: {str(e)}")
        # If proxy fails, return 500 so frontend knows to show error
        return jsonify({'error': "Stream proxy failed"}), 500

if __name__ == '__main__':
    # Run on 0.0.0.0 to be accessible externally
    app.run(host='0.0.0.0', port=8000)
