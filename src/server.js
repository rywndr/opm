require('dotenv').config();

const Hapi = require('@hapi/hapi');
const Jwt = require('@hapi/jwt');
const Inert = require('@hapi/inert');
const path = require('path');
const ClientError = require('./exceptions/ClientError');

// albums
const albums = require('./routes/albums');
const AlbumsService = require('./services/AlbumsService');
const AlbumsHandler = require('./handlers/AlbumsHandler');
const AlbumsValidator = require('./validators/albums');

// songs
const songs = require('./routes/songs');
const SongsService = require('./services/SongsService');
const SongsHandler = require('./handlers/SongsHandler');
const SongsValidator = require('./validators/songs');

// users
const users = require('./routes/users');
const UsersService = require('./services/UsersService');
const UsersHandler = require('./handlers/UsersHandler');
const UsersValidator = require('./validators/users');

// authentications
const authentications = require('./routes/authentications');
const AuthenticationsService = require('./services/AuthenticationsService');
const AuthenticationsHandler = require('./handlers/AuthenticationsHandler');
const TokenManager = require('./tokenize/TokenManager');
const AuthenticationsValidator = require('./validators/authentications');

// playlists
const playlists = require('./routes/playlists');
const PlaylistsService = require('./services/PlaylistsService');
const PlaylistsHandler = require('./handlers/PlaylistsHandler');
const PlaylistsValidator = require('./validators/playlists');

// collaborations
const collaborations = require('./routes/collaborations');
const CollaborationsService = require('./services/CollaborationsService');
const CollaborationsHandler = require('./handlers/CollaborationsHandler');
const CollaborationsValidator = require('./validators/collaborations');

// exports - renamed to avoid conflict with reserved keyword
const exportsRoutes = require('./routes/exports');
const ExportsHandler = require('./handlers/ExportsHandler');
const ProducerService = require('./services/ProducerService');
const ExportsValidator = require('./validators/exports');

// storage and cache
const StorageService = require('./services/StorageService');
const CacheService = require('./services/CacheService');
const UploadsValidator = require('./validators/uploads');

const init = async () => {
  const cacheService = new CacheService();
  const collaborationsService = new CollaborationsService();
  const albumsService = new AlbumsService(cacheService);
  const songsService = new SongsService();
  const usersService = new UsersService();
  const authenticationsService = new AuthenticationsService();
  const playlistsService = new PlaylistsService(collaborationsService);
  const storageService = new StorageService();

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
    {
      plugin: Inert,
    },
  ]);

  // static file serving for uploads
  server.route({
    method: 'GET',
    path: '/upload/{param*}',
    handler: {
      directory: {
        path: path.resolve(__dirname, '../public'),
      },
    },
  });

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
          const albumsHandler = new AlbumsHandler(
            albumsService, 
            storageService, 
            AlbumsValidator, 
            UploadsValidator
          );
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
    {
      plugin: {
        name: 'exports',
        register: async (server) => {
          const exportsHandler = new ExportsHandler(
            ProducerService,
            playlistsService,
            ExportsValidator,
          );
          server.route(exportsRoutes(exportsHandler)); // using renamed variable
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