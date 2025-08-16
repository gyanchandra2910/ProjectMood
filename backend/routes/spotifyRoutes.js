// Spotify Integration Routes - OAuth authentication and music search proxy
// Handles Spotify OAuth flow, token management, and search API proxying

const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const crypto = require('crypto');

const router = express.Router();

// Spotify credentials (should be in environment variables)
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID || 'your_spotify_client_id',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || 'your_spotify_client_secret',
  redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3001/api/spotify/callback'
});

// In-memory token storage (in production, use Redis or database)
const tokenStorage = new Map();
const stateStorage = new Map();

// Utility function to generate random state for OAuth security
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Get Spotify authorization URL
router.get('/auth', (req, res) => {
  const state = generateState();
  const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
  ];

  // Store state for validation
  stateStorage.set(state, { 
    createdAt: Date.now(),
    userId: req.user?.uid || 'anonymous'
  });

  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
  
  res.json({
    success: true,
    authUrl: authorizeURL,
    state,
    message: 'Visit the auth URL to authorize the application'
  });
});

// Handle Spotify OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Authorization failed',
      details: error
    });
  }

  if (!code || !state) {
    return res.status(400).json({
      success: false,
      error: 'Missing authorization code or state'
    });
  }

  // Validate state
  const storedState = stateStorage.get(state);
  if (!storedState) {
    return res.status(400).json({
      success: false,
      error: 'Invalid state parameter'
    });
  }

  // Clean up expired states (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of stateStorage.entries()) {
    if (value.createdAt < tenMinutesAgo) {
      stateStorage.delete(key);
    }
  }

  try {
    // Exchange authorization code for access token
    const data = await spotifyApi.authorizationCodeGrant(code);
    
    const { access_token, refresh_token, expires_in } = data.body;
    
    // Set tokens on the API instance
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    // Get user info
    const userInfo = await spotifyApi.getMe();
    const userId = userInfo.body.id;

    // Store tokens securely (in production, encrypt and store in database)
    tokenStorage.set(userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
      userInfo: {
        id: userId,
        displayName: userInfo.body.display_name,
        email: userInfo.body.email,
        country: userInfo.body.country,
        product: userInfo.body.product
      }
    });

    stateStorage.delete(state);

    res.json({
      success: true,
      message: 'Successfully authenticated with Spotify',
      user: {
        id: userId,
        displayName: userInfo.body.display_name,
        email: userInfo.body.email
      },
      expiresIn: expires_in
    });

  } catch (error) {
    console.error('Spotify OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete authorization',
      details: error.message
    });
  }
});

// Middleware to ensure valid Spotify token
async function ensureSpotifyAuth(req, res, next) {
  const userId = req.headers['x-spotify-user'] || 'default';
  const userTokens = tokenStorage.get(userId);

  if (!userTokens) {
    return res.status(401).json({
      success: false,
      error: 'No Spotify authentication found',
      authRequired: true
    });
  }

  // Check if token is expired
  if (Date.now() >= userTokens.expiresAt) {
    try {
      // Refresh the token
      spotifyApi.setRefreshToken(userTokens.refreshToken);
      const data = await spotifyApi.refreshAccessToken();
      
      const newAccessToken = data.body.access_token;
      const newExpiresIn = data.body.expires_in;
      
      // Update stored tokens
      userTokens.accessToken = newAccessToken;
      userTokens.expiresAt = Date.now() + (newExpiresIn * 1000);
      
      spotifyApi.setAccessToken(newAccessToken);
      
    } catch (error) {
      console.error('Token refresh error:', error);
      tokenStorage.delete(userId);
      return res.status(401).json({
        success: false,
        error: 'Failed to refresh Spotify token',
        authRequired: true
      });
    }
  } else {
    spotifyApi.setAccessToken(userTokens.accessToken);
  }

  req.spotifyUser = userTokens.userInfo;
  next();
}

// Search Spotify tracks
router.get('/search', ensureSpotifyAuth, async (req, res) => {
  try {
    const { q, type = 'track', limit = 20, offset = 0, market } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required'
      });
    }

    const searchOptions = {
      limit: Math.min(parseInt(limit), 50), // Spotify max is 50
      offset: parseInt(offset),
      market: market || req.spotifyUser.country || 'US'
    };

    const searchResult = await spotifyApi.search(q, [type], searchOptions);
    
    // Format the response to include preview URLs and relevant data
    const tracks = searchResult.body.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      uri: track.uri,
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      explicit: track.explicit,
      popularity: track.popularity,
      artists: track.artists.map(artist => ({
        id: artist.id,
        name: artist.name,
        uri: artist.uri
      })),
      album: {
        id: track.album.id,
        name: track.album.name,
        uri: track.album.uri,
        images: track.album.images,
        releaseDate: track.album.release_date
      },
      externalUrls: track.external_urls,
      // Audio features will be fetched separately if needed
      audioFeatures: null
    }));

    res.json({
      success: true,
      query: q,
      tracks,
      total: searchResult.body.tracks.total,
      limit: searchOptions.limit,
      offset: searchOptions.offset,
      market: searchOptions.market
    });

  } catch (error) {
    console.error('Spotify search error:', error);
    res.status(500).json({
      success: false,
      error: 'Spotify search failed',
      details: error.message
    });
  }
});

// Get audio features for tracks (useful for mood matching)
router.get('/audio-features', ensureSpotifyAuth, async (req, res) => {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        success: false,
        error: 'Track IDs are required'
      });
    }

    const trackIds = Array.isArray(ids) ? ids : ids.split(',');
    
    if (trackIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 track IDs allowed'
      });
    }

    const audioFeatures = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    
    res.json({
      success: true,
      audioFeatures: audioFeatures.body.audio_features.map(features => ({
        id: features?.id,
        valence: features?.valence,
        energy: features?.energy,
        danceability: features?.danceability,
        tempo: features?.tempo,
        acousticness: features?.acousticness,
        instrumentalness: features?.instrumentalness,
        speechiness: features?.speechiness,
        liveness: features?.liveness,
        loudness: features?.loudness,
        mode: features?.mode,
        key: features?.key,
        timeSignature: features?.time_signature
      }))
    });

  } catch (error) {
    console.error('Audio features error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audio features',
      details: error.message
    });
  }
});

// Search tracks by mood (uses audio features)
router.get('/search-by-mood', ensureSpotifyAuth, async (req, res) => {
  try {
    const { 
      valence, 
      energy, 
      danceability,
      genre = '',
      limit = 20,
      market 
    } = req.query;

    // Build search query based on mood parameters
    let searchQuery = '';
    
    if (genre) {
      searchQuery += `genre:${genre} `;
    }

    // Add some popular search terms to get better results
    searchQuery += 'year:2020-2024';

    const searchOptions = {
      limit: Math.min(parseInt(limit), 50),
      market: market || req.spotifyUser.country || 'US'
    };

    // First, search for tracks
    const searchResult = await spotifyApi.search(searchQuery, ['track'], searchOptions);
    const tracks = searchResult.body.tracks.items;

    if (tracks.length === 0) {
      return res.json({
        success: true,
        tracks: [],
        message: 'No tracks found matching criteria'
      });
    }

    // Get audio features for the found tracks
    const trackIds = tracks.map(track => track.id);
    const audioFeaturesResult = await spotifyApi.getAudioFeaturesForTracks(trackIds);
    const audioFeatures = audioFeaturesResult.body.audio_features;

    // Filter and score tracks based on mood parameters
    const targetValence = parseFloat(valence);
    const targetEnergy = parseFloat(energy);
    const targetDanceability = parseFloat(danceability);

    const scoredTracks = tracks.map((track, index) => {
      const features = audioFeatures[index];
      if (!features) return null;

      // Calculate mood similarity score
      let score = 0;
      let criteria = 0;

      if (!isNaN(targetValence)) {
        score += 1 - Math.abs(features.valence - targetValence);
        criteria++;
      }
      if (!isNaN(targetEnergy)) {
        score += 1 - Math.abs(features.energy - targetEnergy);
        criteria++;
      }
      if (!isNaN(targetDanceability)) {
        score += 1 - Math.abs(features.danceability - targetDanceability);
        criteria++;
      }

      const finalScore = criteria > 0 ? score / criteria : 0;

      return {
        ...track,
        audioFeatures: features,
        moodScore: finalScore,
        previewUrl: track.preview_url
      };
    }).filter(track => track !== null);

    // Sort by mood score and return top results
    const sortedTracks = scoredTracks
      .sort((a, b) => b.moodScore - a.moodScore)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      tracks: sortedTracks.map(track => ({
        id: track.id,
        name: track.name,
        uri: track.uri,
        previewUrl: track.previewUrl,
        duration: track.duration_ms,
        moodScore: track.moodScore,
        artists: track.artists.map(artist => ({
          id: artist.id,
          name: artist.name
        })),
        album: {
          name: track.album.name,
          images: track.album.images
        },
        audioFeatures: {
          valence: track.audioFeatures.valence,
          energy: track.audioFeatures.energy,
          danceability: track.audioFeatures.danceability,
          tempo: track.audioFeatures.tempo
        }
      })),
      searchCriteria: {
        valence: targetValence,
        energy: targetEnergy,
        danceability: targetDanceability,
        genre
      }
    });

  } catch (error) {
    console.error('Mood search error:', error);
    res.status(500).json({
      success: false,
      error: 'Mood-based search failed',
      details: error.message
    });
  }
});

// Get current user's playlists
router.get('/playlists', ensureSpotifyAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const playlists = await spotifyApi.getUserPlaylists(req.spotifyUser.id, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      playlists: playlists.body.items.map(playlist => ({
        id: playlist.id,
        name: playlist.name,
        uri: playlist.uri,
        description: playlist.description,
        public: playlist.public,
        collaborative: playlist.collaborative,
        trackCount: playlist.tracks.total,
        images: playlist.images,
        externalUrls: playlist.external_urls
      })),
      total: playlists.body.total
    });

  } catch (error) {
    console.error('Playlists error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get playlists',
      details: error.message
    });
  }
});

// Get user authentication status
router.get('/status', (req, res) => {
  const userId = req.headers['x-spotify-user'] || 'default';
  const userTokens = tokenStorage.get(userId);

  if (!userTokens) {
    return res.json({
      success: true,
      authenticated: false,
      message: 'Not authenticated with Spotify'
    });
  }

  const isExpired = Date.now() >= userTokens.expiresAt;

  res.json({
    success: true,
    authenticated: !isExpired,
    user: userTokens.userInfo,
    expiresAt: userTokens.expiresAt,
    canRefresh: !!userTokens.refreshToken
  });
});

module.exports = router;
