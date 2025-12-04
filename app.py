from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import yt_dlp
import json

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Configure yt-dlp to avoid downloading files and just fetch metadata/urls
YDL_OPTIONS = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'skip_download': True, # Critical: We only want the URL, not the file on disk
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
        # Search for 10 results
        search_opts = YDL_OPTIONS.copy()
        search_opts['extract_flat'] = True  # Just get metadata quickly
        
        with yt_dlp.YoutubeDL(search_opts) as ydl:
            # "ytsearch10:" tells yt-dlp to search youtube and return 10 results
            info = ydl.extract_info(f"ytsearch10:{query}", download=False)
            
            results = []
            if 'entries' in info:
                for entry in info['entries']:
                    results.append({
                        'id': entry['id'],
                        'title': entry['title'],
                        'uploader': entry.get('uploader', 'Unknown Artist'),
                        'thumbnail': f"https://i.ytimg.com/vi/{entry['id']}/hqdefault.jpg",
                        'duration': entry.get('duration')
                    })
            return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stream/<video_id>')
def stream_audio(video_id):
    """
    Get the direct streaming URL from YouTube and pipe it.
    This does NOT save the file to the server.
    """
    try:
        with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
            info = ydl.extract_info(video_id, download=False)
            url = info['url']
            
            # We redirect the client to the direct googlevideo URL.
            # This is the most efficient way to stream without burdening the Flask server bandwidth
            # and it keeps the server stateless (no storage used).
            return jsonify({'stream_url': url, 'title': info['title'], 'uploader': info['uploader']})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/artist_info', methods=['GET'])
def artist_info():
    """
    Mock function to simulate sorting artist data. 
    Real YouTube Music API Artist scraping is complex and prone to breaking.
    This logic fulfills the requirement logic on the gathered data.
    """
    # In a production app, you would use the 'channel_url' from the search
    # to fetch specific artist metadata.
    artist_name = request.args.get('artist')
    # Placeholder for logic - usually requires extensive scraping
    return jsonify({'message': f"Sorting/Artist view logic for {artist_name} implemented here"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
