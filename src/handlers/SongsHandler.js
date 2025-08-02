const autoBind = require('auto-bind');

class SongsHandler {
  constructor(service, validator) {
    this._service = service;
    this._validator = validator;

    autoBind(this);
  }

  async postSongHandler(request, h) {
    this._validator.validateSongPayload(request.payload);

    const songId = await this._service.addSong(request.payload);

    const response = h.response({
      status: 'success',
      data: {
        songId,
      },
    });
    response.code(201);
    return response;
  }

  async getSongsHandler(request, h) {
    const { title, performer } = request.query;
    const result = await this._service.getSongs(title, performer);

    const response = h.response({
      status: 'success',
      data: {
        songs: result.songs,
      },
    });

    // Add cache header if data comes from cache
    if (result.isFromCache) {
      response.header('X-Data-Source', 'cache');
    }

    return response;
  }

  async getSongByIdHandler(request, h) {
    const { id } = request.params;
    const result = await this._service.getSongById(id);

    const response = h.response({
      status: 'success',
      data: {
        song: result.song,
      },
    });

    // Add cache header if data comes from cache
    if (result.isFromCache) {
      response.header('X-Data-Source', 'cache');
    }

    return response;
  }

  async putSongByIdHandler(request) {
    this._validator.validateSongPayload(request.payload);
    const { id } = request.params;

    await this._service.editSongById(id, request.payload);

    return {
      status: 'success',
      message: 'Lagu berhasil diperbarui',
    };
  }

  async deleteSongByIdHandler(request) {
    const { id } = request.params;
    await this._service.deleteSongById(id);

    return {
      status: 'success',
      message: 'Lagu berhasil dihapus',
    };
  }
}

module.exports = SongsHandler;
