from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import requests
import logging

# Configure logging to see the real error in Koyeb logs
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# 1. Anti-Bot Headers & Config
# We use a real browser User-Agent to avoid 403 blocks from YouTube
YDL_OPTIONS = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': False, # Turn on logs for debugging
    'skip_download': True,
    'nocheckcertificate': True,
    'geo_bypass': True,
    'source_address': '0.0.0.0',
    # Spoof a common browser to avoid bot detection
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
}

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/search', methods=['GET'])
def search_music():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    try:
        search_opts = YDL_OPTIONS.copy()
        search_opts['extract_flat'] = True
        
        with yt_dlp.YoutubeDL(search_opts) as ydl:
            # Search 5 items for speed
            info = ydl.extract_info(f"ytsearch5:{query}", download=False)
            
            results = []
            if 'entries' in info:
                for entry in info['entries']:
                    results.append({
                        'id': entry['id'],
                        'title': entry['title'],
                        'uploader': entry.get('uploader', 'Unknown'),
                        'thumbnail': f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg",
                    })
            return jsonify(results)
    except Exception as e:
        app.logger.error(f"Search Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stream/<video_id>')
def stream_audio(video_id):
    """
    Step 1: Get the YouTube URL.
    Step 2: Tell the frontend to ask US for the audio, not YouTube directly.
    """
    try:
        # Instead of returning the GoogleVideo URL (which breaks on mobile/different IPs),
        # We return a URL pointing back to THIS server's proxy route.
        # This solves the "NotSupportedError" and IP mismatch.
        
        return jsonify({
            # The frontend will now load: /api/proxy/VIDEO_ID
            'stream_url': f"/api/proxy/{video_id}", 
            'title': "Loading...",
            'uploader': "..."
        })
            
    except Exception as e:
        app.logger.error(f"Stream Info Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/proxy/<video_id>')
def proxy_stream(video_id):
    """
    Step 3: The Actual Proxy.
    The browser connects here. We connect to YouTube. We pass the data bucket-brigade style.
    """
    try:
        # 1. Get the real Googlevideo URL using yt-dlp
        with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
            info = ydl.extract_info(video_id, download=False)
            real_url = info['url']
        
        # 2. Open a connection to that URL from the SERVER
        req = requests.get(real_url, stream=True)
        
        # 3. Stream chunks of data to the browser
        def generate():
            for chunk in req.iter_content(chunk_size=1024 * 64): # 64KB chunks
                yield chunk

        # Return the stream with correct headers
        return Response(stream_with_context(generate()), content_type="audio/mp4")

    except Exception as e:
        app.logger.error(f"Proxy Error: {str(e)}")
        return jsonify({'error': "Stream proxy failed"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
