const autoBind = require('auto-bind');

class AlbumsHandler {
  constructor(service, storageService, validator, uploadsValidator) {
    this._service = service;
    this._storageService = storageService;
    this._validator = validator;
    this._uploadsValidator = uploadsValidator;

    autoBind(this);
  }

  async postAlbumHandler(request, h) {
    this._validator.validateAlbumPayload(request.payload);
    const { name, year } = request.payload;

    const albumId = await this._service.addAlbum({ name, year });

    const response = h.response({
      status: 'success',
      data: {
        albumId,
      },
    });
    response.code(201);
    return response;
  }

  async getAlbumByIdHandler(request) {
    const { id } = request.params;

    // Check if we should include songs (for optional criteria)
    const album = await this._service.getAlbumWithSongs(id);

    return {
      status: 'success',
      data: {
        album: {
          id: album.id,
          name: album.name,
          year: album.year,
          coverUrl: album.coverUrl,
          songs: album.songs,
        },
      },
    };
  }

  async putAlbumByIdHandler(request) {
    this._validator.validateAlbumPayload(request.payload);
    const { id } = request.params;

    await this._service.editAlbumById(id, request.payload);

    return {
      status: 'success',
      message: 'Album berhasil diperbarui',
    };
  }

  async deleteAlbumByIdHandler(request) {
    const { id } = request.params;
    await this._service.deleteAlbumById(id);

    return {
      status: 'success',
      message: 'Album berhasil dihapus',
    };
  }

  async postUploadImageHandler(request, h) {
    const { cover } = request.payload;
    const { id } = request.params;

    // Debug logging
    console.log('Cover object:', cover);
    console.log('Cover keys:', cover ? Object.keys(cover) : 'cover is null/undefined');

    // Check if cover file exists
    if (!cover) {
      const response = h.response({
        status: 'fail',
        message: 'File cover harus disertakan',
      });
      response.code(400);
      return response;
    }

    // Validate image headers - check if hapi object exists
    if (!cover.hapi || !cover.hapi.headers) {
      console.log('Cover hapi object:', cover.hapi);
      const response = h.response({
        status: 'fail',
        message: 'Format file tidak valid',
      });
      response.code(400);
      return response;
    }

    this._uploadsValidator.validateImageHeaders(cover.hapi.headers);

    // Check file size (max 512KB = 512000 bytes)
    const fileSize = cover._data ? cover._data.length : (cover.bytes || 0);
    console.log('File size:', fileSize);
    
    if (fileSize > 512000) {
      const response = h.response({
        status: 'fail',
        message: 'Ukuran file terlalu besar. Maksimal 512KB',
      });
      response.code(413);
      return response;
    }

    // Check if album exists
    await this._service.getAlbumById(id);

    try {
      // Upload to local file system
      const filename = await this._storageService.writeFile(cover, cover.hapi);
      const coverUrl = `http://${process.env.HOST}:${process.env.PORT}/upload/images/${filename}`;
      
      await this._service.addAlbumCover(id, coverUrl);
    } catch (error) {
      console.error('Upload error:', error);
      const response = h.response({
        status: 'fail',
        message: 'Gagal mengunggah file',
      });
      response.code(500);
      return response;
    }

    const response = h.response({
      status: 'success',
      message: 'Sampul berhasil diunggah',
    });
    response.code(201);
    return response;
  }

  async postLikeAlbumHandler(request, h) {
    const { id: albumId } = request.params;
    const { id: userId } = request.auth.credentials;

    // Check if album exists
    await this._service.getAlbumById(albumId);

    await this._service.likeAlbum(userId, albumId);

    const response = h.response({
      status: 'success',
      message: 'Album berhasil disukai',
    });
    response.code(201);
    return response;
  }

  async deleteLikeAlbumHandler(request, h) {
    const { id: albumId } = request.params;
    const { id: userId } = request.auth.credentials;

    // Check if album exists
    await this._service.getAlbumById(albumId);

    await this._service.unlikeAlbum(userId, albumId);

    return {
      status: 'success',
      message: 'Batal menyukai album',
    };
  }

  async getAlbumLikesHandler(request, h) {
    const { id: albumId } = request.params;

    const { isFromCache, likes } = await this._service.getAlbumLikes(albumId);

    const response = h.response({
      status: 'success',
      data: {
        likes,
      },
    });

    if (isFromCache) {
      response.header('X-Data-Source', 'cache');
    }

    return response;
  }
}

module.exports = AlbumsHandler;
