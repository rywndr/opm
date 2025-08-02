const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../exceptions/InvariantError');
const NotFoundError = require('../exceptions/NotFoundError');
const config = require('../utils/config');

class SongsService {
  constructor(cacheService) {
    this._pool = new Pool(config.database);
    this._cacheService = cacheService;
  }

  async addSong(payload) {
    const { title, year, genre, performer, duration, albumId } = payload;
    const id = `song-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO songs VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      values: [id, title, year, genre, performer, duration, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Lagu gagal ditambahkan');
    }

    // Invalidate songs list cache since we added a new song
    await this._invalidateSongsListCache();

    return result.rows[0].id;
  }

  async getSongs(title = '', performer = '') {
    const cacheKey = `songs:${title}:${performer}`;
    
    try {
      // Try to get from cache first
      const cachedSongs = await this._cacheService.get(cacheKey);
      return {
        isFromCache: true,
        songs: JSON.parse(cachedSongs),
      };
    } catch (error) {
      // Cache miss, get from database
      const query = {
        text: 'SELECT id, title, performer FROM songs WHERE title ILIKE $1 AND performer ILIKE $2',
        values: [`%${title}%`, `%${performer}%`],
      };

      const { rows } = await this._pool.query(query);
      
      // Store in cache for 15 minutes (900 seconds)
      await this._cacheService.set(cacheKey, JSON.stringify(rows), 900);
      
      return {
        isFromCache: false,
        songs: rows,
      };
    }
  }

  async getSongById(id) {
    const cacheKey = `song:${id}`;
    
    try {
      // Try to get from cache first
      const cachedSong = await this._cacheService.get(cacheKey);
      return {
        isFromCache: true,
        song: JSON.parse(cachedSong),
      };
    } catch (error) {
      // Cache miss, get from database
      const query = {
        text: 'SELECT * FROM songs WHERE id = $1',
        values: [id],
      };

      const result = await this._pool.query(query);

      if (!result.rows.length) {
        throw new NotFoundError('Lagu tidak ditemukan');
      }

      const song = result.rows[0];
      
      // Store in cache for 15 minutes (900 seconds)
      await this._cacheService.set(cacheKey, JSON.stringify(song), 900);
      
      return {
        isFromCache: false,
        song,
      };
    }
  }

  async editSongById(id, payload) {
    const { title, year, genre, performer, duration, albumId } = payload;
    const query = {
      text: 'UPDATE songs SET title = $1, year = $2, genre = $3, performer = $4, duration = $5, album_id = $6 WHERE id = $7 RETURNING id',
      values: [title, year, genre, performer, duration, albumId, id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui lagu. Id tidak ditemukan');
    }

    // Invalidate cache for this song and songs list
    await this._invalidateSongCache(id);
  }

  async deleteSongById(id) {
    const query = {
      text: 'DELETE FROM songs WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rows.length) {
      throw new NotFoundError('Lagu gagal dihapus. Id tidak ditemukan');
    }

    // Invalidate cache for this song and songs list
    await this._invalidateSongCache(id);
  }

  // Private method to invalidate song-related cache
  async _invalidateSongCache(songId) {
    try {
      // Invalidate specific song cache
      await this._cacheService.delete(`song:${songId}`);
      
      // Also invalidate songs list cache
      await this._invalidateSongsListCache();
    } catch (error) {
      // Cache deletion errors shouldn't break the operation
      console.error('Cache invalidation error:', error);
    }
  }

  // Private method to invalidate songs list cache
  async _invalidateSongsListCache() {
    try {
      // This is a simplified approach - in production you might want to be more specific
      // For now, we'll use a pattern to delete common song list queries
      const commonKeys = [
        'songs::',      // Empty title and performer
        'songs: :',     // Empty title, space performer
        'songs: : ',    // Both empty with spaces
      ];
      
      for (const key of commonKeys) {
        try {
          await this._cacheService.delete(key);
        } catch (error) {
          // Individual key deletion errors are not critical
          continue;
        }
      }
    } catch (error) {
      console.error('Songs list cache invalidation error:', error);
    }
  }
}

module.exports = SongsService;
