
###  Open Music API (OPM) has gone through its first version and currently is in version 2, it's a backend project @dicodingacademy.


v3 update notes:

###  Features maintained from v1 & v2:

- Album management (CRUD ops)

- Song management (CRUD ops)

- Data validation for albums and songs

- Error handling

- Search songs by title and performer

- User registration and authentication

- JWT-based authentication system

- Playlist management (private playlists)

- Playlist song management (add/remove songs)

- User authorization and access control

- Playlist collaboration system

- Playlist activity tracking

  

###  OPM v3 added features:

-  **Album Cover Upload** - Upload album cover images (local file system)

-  **Album Likes System** - Like/unlike albums with authentication

-  **Server-side Caching** - Redis-based caching for album likes (30 minutes)

-  **Playlist Export** - Export playlist data via RabbitMQ and email

-  **File Storage** - Local file system storage for uploaded images

  

##  Requirements

- Node.js (recommended LTS)

- PostgreSQL database

- Redis server (for caching) - for testing purposes I installed Redis on WSL2

- RabbitMQ server (for message queuing) - for testing purposes I'm using docker for RabbitMQ server

  

##  Setup

  

1. Clone repo

```bash

git  clone  https://github.com/rywndr/opm

cd opm

```

  

2. Install dependencies

```bash

npm install

```

  

3. Set environment variables

```bash

cp .env.example  .env

```

  

Edit the `.env` file with your configuration:

```env

# Server configuration

HOST=localhost

PORT=5000

  

# Database configuration

PGUSER=your_database_usrname

PGHOST=localhost

PGPASSWORD=your_database_passwd

PGDATABASE=openmusic

PGPORT=5432

  

# JWT configuration

ACCESS_TOKEN_KEY=your_access_token_secret_key

REFRESH_TOKEN_KEY=your_refresh_token_secret_key

  

# RabbitMQ configuration

RABBITMQ_SERVER=amqp://localhost

  

# Redis configuration

REDIS_SERVER=localhost

  

# SMTP configuration

SMTP_HOST=smtp.gmail.com

SMTP_PORT=587

SMTP_USER=your-email@gmail.com

SMTP_PASSWORD=your-app-password # I recommend using an app password

```

  

4. Setup services

  

**PostgreSQL:**

```bash

# Create database from pgsql

CREATE  DATABASE  openmusic;

  

# Run migrations

npm  run  migrate:up

```

  

**Redis:**

```bash

# Install and start Redis (Ubuntu/Debian), read the docs @ https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-windows/ or use AWS

curl  -fsSL  https://packages.redis.io/gpg | sudo  gpg  --dearmor  -o  /usr/share/keyrings/redis-archive-keyring.gpg

  

echo  "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release  -cs) main" | sudo  tee  /etc/apt/sources.list.d/redis.list

  

sudo  apt-get  update

sudo  apt-get  install  redis

  

# Or like me, using Docker:

docker  run  --name  redis-openmusic  -p  6379:6379  -d  redis:alpine

```

  

**RabbitMQ:**

```bash

# Install and start RabbitMQ (Ubuntu/Debian) # or just use Docker, or use AWS

sudo  apt  update

sudo  apt  install  rabbitmq-server

sudo  systemctl  start  rabbitmq-server

  

# Or using Docker

docker  run  --name  rabbitmq-openmusic  -p  5672:5672  -p  15672:15672  -d  rabbitmq:3-management

```

  

5. Start the apps

```bash

# Start the main server

npm  start

  

# Start the consumer app (in another terminal)

npm  run  start:consumer

```

  

##  API Endpoints

  

###  Albums

-  `POST /albums` - Create new album

-  `GET /albums/{id}` - Get album by ID (with songs and coverUrl)

-  `PUT /albums/{id}` - Update album

-  `DELETE /albums/{id}` - Delete album

-  `POST /albums/{id}/covers` - Upload album cover (multipart/form-data)

-  `POST /albums/{id}/likes` - Like album (authenticated)

-  `DELETE /albums/{id}/likes` - Unlike album (authenticated)

-  `GET /albums/{id}/likes` - Get album likes count (cached)

  

###  Songs

-  `POST /songs` - Create new song

-  `GET /songs` - Get all songs (with optional search)

-  `GET /songs/{id}` - Get song by ID

-  `PUT /songs/{id}` - Update song

-  `DELETE /songs/{id}` - Delete song

  

###  Users

-  `POST /users` - Register new user

  

###  Authentication

-  `POST /authentications` - Login user

-  `PUT /authentications` - Refresh access token

-  `DELETE /authentications` - Logout user

  

###  Playlists (Requires Authentication)

-  `POST /playlists` - Create new playlist

-  `GET /playlists` - Get user's playlists

-  `DELETE /playlists/{id}` - Delete playlist

-  `POST /playlists/{id}/songs` - Add song to playlist

-  `GET /playlists/{id}/songs` - Get songs in playlist

-  `DELETE /playlists/{id}/songs` - Remove song from playlist

-  `GET /playlists/{id}/activities` - Get playlist activities

  

###  Collaborations (Requires Authentication)

-  `POST /collaborations` - Add collaborator to playlist

-  `DELETE /collaborations` - Remove collaborator from playlist

  

###  Exports (New - Requires Authentication)

-  `POST /export/playlists/{playlistId}` - Export playlist to email

  

##  New v3 Features Usage

  
###  Album Cover Upload

```bash

curl  -X  POST  http://localhost:5000/albums/{albumId}/covers  \

-F "cover=@/path/to/image.jpg"

```

###  Album Likes

```bash

# Like an album

curl  -X  POST  http://localhost:5000/albums/{albumId}/likes  \

-H "Authorization: Bearer your_access_token"

  
# Get likes count (cached response includes X-Data-Source header)

curl  -X  GET  http://localhost:5000/albums/{albumId}/likes

```

###  Playlist Export

```bash

curl  -X  POST  http://localhost:5000/export/playlists/{playlistId}  \

-H "Content-Type: application/json" \

-H  "Authorization: Bearer your_access_token"  \

-d '{"targetEmail": "user@example.com"}'

```

##  Database Schema


Updated tables for v3:

-  `albums` - Added `cover_url` field

-  `user_album_likes` - New table for album likes

  
##  Caching Strategy


-  **Album Likes**: Cached for 30 minutes

-  **Cache Headers**: Responses from cache include `X-Data-Source: cache`

-  **Cache Invalidation**: Automatic when likes are added/removed

  
##  File Storage

  
The app uses local file system storage:

-  **Local File System**: Files stored in `public/uploads/images/`

-  **URL Pattern**: `http://host:port/upload/images/filename`

-  **Auto Directory Creation**: Creates upload directory if it doesn't exist


##  Message Queue

  
RabbitMQ handles playlist export requests:

- Producer sends export requests to `export:playlist` queue

- Consumer processes requests and sends emails with playlist data

##  Error Handling

  
Extended error handling for v3 features:

-  `413 Payload Too Large` - File size exceeds 512KB limit

- File type validation for image uploads

- Duplicate like prevention


##  Tech Stack

-  **Framework**: Hapi.js

-  **Database**: PostgreSQL

-  **Authentication**: JWT (JSON Web Tokens)

-  **Validation**: Joi

-  **Password Hashing**: bcrypt

-  **Migration**: node-pg-migrate

  

###  New in v3

-  **Caching**: Redis

-  **Message Queue**: RabbitMQ (amqplib)

-  **Email**: Nodemailer

-  **File Upload**: @hapi/inert

  

##  Project Structure

  

```

src/

├── handlers/ # Request handlers

├── services/ # Business logic services

├── routes/ # Route definitions

├── validators/ # Input validation schemas

├── exceptions/ # Custom error classes

├── tokenize/ # JWT token management

├── utils/ # Utility functions and config

├── mail/ # Email services

├── server.js # Main server file

└── consumer.js # RabbitMQ consumer

migrations/ # Database migrations

public/

└── uploads/

└── images/ # Local file uploads

```