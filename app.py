from flask import Flask, request, Response, jsonify
import ytmusicapi
import yt_dlp
import requests

app = Flask(__name__)
ytmusic = ytmusicapi.YTMusic()

def get_audio_stream_url(video_id):
    ydl_opts = {'format': 'bestaudio', 'quiet': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f'https://www.youtube.com/watch?v={video_id}', download=False)
        return next((f['url'] for f in info['formats'] if f.get('acodec') != 'none' and f.get('vcodec') == 'none'), None)

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('query')
    filter_type = request.args.get('filter', 'songs')  # Can be 'songs', 'albums', 'artists'
    results = ytmusic.search(query, filter=filter_type)
    return jsonify(results)

@app.route('/similar', methods=['GET'])
def similar():
    video_id = request.args.get('video_id')
    watch_playlist = ytmusic.get_watch_playlist(video_id)
    related = watch_playlist.get('tracks', [])[1:]  # Skip the first (current song)
    return jsonify(related)

@app.route('/artist', methods=['GET'])
def artist():
    channel_id = request.args.get('channel_id')
    artist_data = ytmusic.get_artist(channel_id)
    songs = artist_data.get('songs', {}).get('results', [])
    # Fetch more if needed via browseId
    if 'browseId' in artist_data.get('songs', {}):
        full_songs = ytmusic.get_artist(artist_data['songs']['browseId']).get('songs', {}).get('results', [])
        songs.extend(full_songs)
    return jsonify(songs)

@app.route('/stream/<video_id>')
def stream(video_id):
    stream_url = get_audio_stream_url(video_id)
    if not stream_url:
        return 'Stream URL not found', 404
    
    def generate():
        with requests.get(stream_url, stream=True) as r:
            for chunk in r.iter_content(chunk_size=8192):
                yield chunk
    
    return Response(generate(), mimetype='audio/mpeg')

if __name__ == '__main__':
    app.run(debug=True)
