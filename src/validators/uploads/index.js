const InvariantError = require('../../exceptions/InvariantError');

const UploadsValidator = {
  validateImageHeaders: (headers) => {
    const { 'content-type': contentType } = headers;

    if (!contentType.startsWith('image/')) {
      throw new InvariantError('File harus berupa gambar');
    }

    const allowedTypes = ['image/apng', 'image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(contentType)) {
      throw new InvariantError('Tipe file tidak didukung');
    }
  },
};

module.exports = UploadsValidator;
