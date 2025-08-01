const routes = (handler) => [
  {
    method: 'POST',
    path: '/export/playlists/{playlistId}',
    handler: (request, h) => handler.postExportPlaylistHandler(request, h),
    options: {
      auth: 'openmusicapi_jwt',
    },
  },
];

module.exports = routes;
