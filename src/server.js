require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const ClientError = require('./exceptions/ClientError');

// Albums
const albums = require('./routes/albums');
const AlbumsService = require('./services/AlbumsService');
const AlbumsHandler = require('./handlers/AlbumsHandler');
const AlbumsValidator = require('./validators/albums');

// Songs
const songs = require('./routes/songs');
const SongsService = require('./services/SongsService');
const SongsHandler = require('./handlers/SongsHandler');
const SongsValidator = require('./validators/songs');

// Users
const users = require('./routes/users');
const UsersService = require('./services/UsersService');
const UsersHandler = require('./handlers/UsersHandler');
const UsersValidator = require('./validators/users');

// Authentications
const authentications = require('./routes/authentications');
const AuthenticationsService = require('./services/AuthenticationsService');
const AuthenticationsHandler = require('./handlers/AuthenticationsHandler');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validators/authentications');

// Playlists
const playlists = require('./routes/playlists');
const PlaylistsService = require('./services/PlaylistsService');
const PlaylistsHandler = require('./handlers/PlaylistsHandler');
const PlaylistsValidator = require('./validators/playlists');

// Collaborations
const collaborations = require('./routes/collaborations');
const CollaborationsService = require('./services/CollaborationsService');
const CollaborationsHandler = require('./handlers/CollaborationsHandler');
const CollaborationsValidator = require('./validators/collaborations');

const init = async () => {
  const collaborationsService = new CollaborationsService();
  const albumsService = new AlbumsService();
  const songsService = new SongsService();
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  const playlistsService = new PlaylistsService(collaborationsService);

  const server = Hapi.server({
    port: process.env.PORT || 5000,
    host: process.env.HOST || 'localhost',
    routes: {
      cors: {
        origin: ['*'],
      },
    },
  });

  // registrasi plugin eksternal
  await server.register([
    {
      plugin: Jwt,
    },
  ]);

  // mendefinisikan strategy autentikasi jwt
  server.auth.strategy('openmusicapi_jwt', 'jwt', {
    keys: process.env.ACCESS_TOKEN_KEY,
    verify: {
      aud: false,
      iss: false,
      sub: false,
      maxAgeSec: process.env.ACCESS_TOKEN_AGE,
    },
    validate: (artifacts) => ({
      isValid: true,
      credentials: {
        id: artifacts.decoded.payload.id,
      },
    }),
  });

  await server.register([
    {
      plugin: {
        name: 'albums',
        register: async (server) => {
          const albumsHandler = new AlbumsHandler(albumsService, AlbumsValidator);
          server.route(albums(albumsHandler));
        },
      },
    },
    {
      plugin: {
        name: 'songs',
        register: async (server) => {
          const songsHandler = new SongsHandler(songsService, SongsValidator);
          server.route(songs(songsHandler));
        },
      },
    },
    {
      plugin: {
        name: 'users',
        register: async (server) => {
          const usersHandler = new UsersHandler(usersService, UsersValidator);
          server.route(users(usersHandler));
        },
      },
    },
    {
      plugin: {
        name: 'authentications',
        register: async (server) => {
          const authenticationsHandler = new AuthenticationsHandler(
            authenticationsService,
            usersService,
            TokenManager,
            AuthenticationsValidator,
          );
          server.route(authentications(authenticationsHandler));
        },
      },
    },
    {
      plugin: {
        name: 'playlists',
        register: async (server) => {
          const playlistsHandler = new PlaylistsHandler(playlistsService, songsService, PlaylistsValidator);
          server.route(playlists(playlistsHandler));
        },
      },
    },
    {
      plugin: {
        name: 'collaborations',
        register: async (server) => {
          const collaborationsHandler = new CollaborationsHandler(
            collaborationsService,
            playlistsService,
            CollaborationsValidator,
          );
          server.route(collaborations(collaborationsHandler));
        },
      },
    },
  ]);

  server.ext('onPreResponse', (request, h) => {
    // mendapatkan konteks response dari request
    const { response } = request;

    if (response instanceof Error) {
      // penanganan client error secara internal.
      if (response instanceof ClientError) {
        const newResponse = h.response({
          status: 'fail',
          message: response.message,
        });
        newResponse.code(response.statusCode);
        return newResponse;
      }

      // mempertahankan penanganan client error oleh hapi secara native, seperti 404, etc.
      if (!response.isServer) {
        return h.continue;
      }

      // penanganan server error sesuai kebutuhan
      const newResponse = h.response({
        status: 'error',
        message: 'Maaf, terjadi kegagalan pada server kami.',
      });
      newResponse.code(500);
      console.error(response);
      return newResponse;
    }

    // jika bukan error, lanjutkan dengan response sebelumnya (tanpa terintervensi)
    return h.continue;
  });

  await server.start();
  console.log(`Server berjalan pada ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
