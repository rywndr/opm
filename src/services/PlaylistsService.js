const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../exceptions/InvariantError');
const NotFoundError = require('../exceptions/NotFoundError');
const AuthorizationError = require('../exceptions/AuthorizationError');
const config = require('../utils/config');

class PlaylistsService {
  constructor(collaborationService, cacheService) {
    this._pool = new Pool(config.database);
    this._collaborationService = collaborationService;
    this._cacheService = cacheService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3) RETURNING id',
      values: [id, name, owner],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Playlist gagal ditambahkan');
    }

    // Invalidate user's playlists cache
    await this._invalidateUserPlaylistsCache(owner);

    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    const cacheKey = `playlists:user:${owner}`;
    
    try {
      // Try to get from cache first
      const cachedPlaylists = await this._cacheService.get(cacheKey);
      return {
        isFromCache: true,
        playlists: JSON.parse(cachedPlaylists),
      };
    } catch (error) {
      // Cache miss, get from database
      const query = {
        text: `SELECT p.id, p.name, u.username FROM playlists p 
               LEFT JOIN collaborations c ON c.playlist_id = p.id 
               LEFT JOIN users u ON u.id = p.owner 
               WHERE p.owner = $1 OR c.user_id = $1
               GROUP BY p.id, p.name, u.username`,
        values: [owner],
      };
      const result = await this._pool.query(query);
      
      // Store in cache for 10 minutes (600 seconds)
      await this._cacheService.set(cacheKey, JSON.stringify(result.rows), 600);
      
      return {
        isFromCache: false,
        playlists: result.rows,
      };
    }
  }

  async deletePlaylistById(id) {
    // Get playlist owner before deletion for cache invalidation
    const ownerQuery = {
      text: 'SELECT owner FROM playlists WHERE id = $1',
      values: [id],
    };
    const ownerResult = await this._pool.query(ownerQuery);
    
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Playlist gagal dihapus. Id tidak ditemukan');
    }

    // Invalidate cache for this playlist and owner's playlists
    if (ownerResult.rows.length > 0) {
      const owner = ownerResult.rows[0].owner;
      await this._invalidatePlaylistCache(id, owner);
    }
  }

  async addSongToPlaylist(playlistId, songId) {
    const id = `ps-${nanoid(16)}`;
    const query = {
      text: 'INSERT INTO playlist_songs VALUES($1, $2, $3) RETURNING id',
      values: [id, playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Lagu gagal ditambahkan ke playlist');
    }

    // Invalidate playlist songs cache
    await this._invalidatePlaylistSongsCache(playlistId);
  }

  async getSongsFromPlaylist(playlistId) {
    const cacheKey = `playlist:${playlistId}:songs`;
    
    try {
      // Try to get from cache first
      const cachedPlaylistSongs = await this._cacheService.get(cacheKey);
      return {
        isFromCache: true,
        ...JSON.parse(cachedPlaylistSongs),
      };
    } catch (error) {
      // Cache miss, get from database
      const playlistQuery = {
        text: `SELECT p.id, p.name, u.username FROM playlists p
               LEFT JOIN users u ON u.id = p.owner
               WHERE p.id = $1`,
        values: [playlistId],
      };

      const playlistResult = await this._pool.query(playlistQuery);

      if (!playlistResult.rows.length) {
        throw new NotFoundError('Playlist tidak ditemukan');
      }

      const songsQuery = {
        text: `SELECT s.id, s.title, s.performer FROM songs s
               LEFT JOIN playlist_songs ps ON ps.song_id = s.id
               WHERE ps.playlist_id = $1`,
        values: [playlistId],
      };

      const songsResult = await this._pool.query(songsQuery);

      const result = {
        playlist: {
          ...playlistResult.rows[0],
          songs: songsResult.rows,
        },
      };
      
      // Store in cache for 10 minutes (600 seconds)
      await this._cacheService.set(cacheKey, JSON.stringify(result), 600);
      
      return {
        isFromCache: false,
        ...result,
      };
    }
  }

  async getPlaylistForExport(playlistId) {
    const playlistQuery = {
      text: 'SELECT p.id, p.name FROM playlists p WHERE p.id = $1',
      values: [playlistId],
    };

    const playlistResult = await this._pool.query(playlistQuery);

    if (!playlistResult.rows.length) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    const songsQuery = {
      text: `SELECT s.id, s.title, s.performer FROM songs s
             LEFT JOIN playlist_songs ps ON ps.song_id = s.id
             WHERE ps.playlist_id = $1`,
      values: [playlistId],
    };

    const songsResult = await this._pool.query(songsQuery);

    return {
      playlist: {
        id: playlistResult.rows[0].id,
        name: playlistResult.rows[0].name,
        songs: songsResult.rows,
      },
    };
  }

  async deleteSongFromPlaylist(playlistId, songId) {
    const query = {
      text: 'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING id',
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new InvariantError('Lagu gagal dihapus dari playlist');
    }

    // Invalidate playlist songs cache
    await this._invalidatePlaylistSongsCache(playlistId);
  }

  async verifyPlaylistOwner(id, owner) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [id],
    };
    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }
    const playlist = result.rows[0];
    if (playlist.owner !== owner) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      try {
        await this._collaborationService.verifyCollaborator(playlistId, userId);
      } catch {
        throw error;
      }
    }
  }

  async addPlaylistSongActivity({
    playlistId, songId, userId, action,
  }) {
    const id = `activity-${nanoid(16)}`;
    const time = new Date().toISOString();

    const query = {
      text: 'INSERT INTO playlist_song_activities VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
      values: [id, playlistId, songId, userId, action, time],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Aktivitas gagal ditambahkan');
    }
  }

  async getPlaylistSongActivities(playlistId) {
    const query = {
      text: `SELECT u.username, s.title, psa.action, psa.time
             FROM playlist_song_activities psa
             LEFT JOIN users u ON u.id = psa.user_id
             LEFT JOIN songs s ON s.id = psa.song_id
             WHERE psa.playlist_id = $1
             ORDER BY psa.time ASC`,
      values: [playlistId],
    };

    const result = await this._pool.query(query);
    return result.rows;
  }
  // Private cache invalidation methods
  async _invalidateUserPlaylistsCache(userId) {
    try {
      await this._cacheService.delete(`playlists:user:${userId}`);
    } catch (error) {
      console.error('User playlists cache invalidation error:', error);
    }
  }

  async _invalidatePlaylistSongsCache(playlistId) {
    try {
      await this._cacheService.delete(`playlist:${playlistId}:songs`);
    } catch (error) {
      console.error('Playlist songs cache invalidation error:', error);
    }
  }

  async _invalidatePlaylistCache(playlistId, owner) {
    try {
      // Invalidate playlist songs cache
      await this._invalidatePlaylistSongsCache(playlistId);
      
      // Invalidate user's playlists cache
      await this._invalidateUserPlaylistsCache(owner);
    } catch (error) {
      console.error('Playlist cache invalidation error:', error);
    }
  }
}

module.exports = PlaylistsService;
