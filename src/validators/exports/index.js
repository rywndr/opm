const InvariantError = require('../../exceptions/InvariantError');
const { ExportPlaylistPayloadSchema, ImageHeadersSchema } = require('./schema');

const ExportsValidator = {
  validateExportPlaylistPayload: (payload) => {
    const validationResult = ExportPlaylistPayloadSchema.validate(payload);
    if (validationResult.error) {
      throw new InvariantError(validationResult.error.message);
    }
  },
  validateImageHeaders: (headers) => {
    const validationResult = ImageHeadersSchema.validate(headers);
    if (validationResult.error) {
      throw new InvariantError(validationResult.error.message);
    }
  },
};

module.exports = ExportsValidator;
