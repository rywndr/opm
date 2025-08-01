require('dotenv').config();

const amqp = require('amqplib');
const PlaylistsService = require('./services/PlaylistsService');
const MailSender = require('./mail/MailSender');
const CollaborationsService = require('./services/CollaborationsService');
const config = require('./utils/config');

const init = async () => {
  const collaborationsService = new CollaborationsService();
  const playlistsService = new PlaylistsService(collaborationsService);
  const mailSender = new MailSender();

  const connection = await amqp.connect(config.rabbitMq.server);
  const channel = await connection.createChannel();

  await channel.assertQueue('export:playlist', {
    durable: true,
  });

  channel.consume('export:playlist', async (message) => {
    try {
      const { playlistId, targetEmail } = JSON.parse(message.content.toString());

      const playlist = await playlistsService.getPlaylistForExport(playlistId);
      const result = await mailSender.sendEmail(targetEmail, JSON.stringify(playlist));

      console.log(result);
    } catch (error) {
      console.error(error);
    }
  }, { noAck: true });
};

init();
