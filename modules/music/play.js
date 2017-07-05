/**
 * @file play command
 * @author Sankarsan Kampa (a.k.a k3rn31p4nic)
 * @license MIT
 */

const string = require('../../handlers/languageHandler');
const yt = require('youtube-dl');
const jsonDB = require('node-json-db');
const db = new jsonDB('./data/favouriteSongs', true, true);

exports.run = (Bastion, message, args) => {
  // TODO: Auto pause/resume playback
  if (message.deletable) {
    message.delete().catch(e => {
      Bastion.log.error(e);
    });
  }
  if (!args.song && (!args.playlist || args.playlist.length < 1) && !args.favourites) {
    /**
     * The command was ran with invalid parameters.
     * @fires commandUsage
     */
    return Bastion.emit('commandUsage', message, this.help);
  }

  Bastion.db.get(`SELECT musicMasterRoleID, musicTextChannelID, musicVoiceChannelID FROM guildSettings WHERE guildID=${message.guild.id}`).then(musicChannel => {
    let voiceChannel, textChannel, vcStats;
    if (message.guild.voiceConnection) {
      voiceChannel = message.guild.voiceConnection.channel;
      textChannel = message.channel;
      vcStats = string('userNoSameVC', 'errorMessage', message.author.tag);
    }
    else if (musicChannel.musicTextChannelID && musicChannel.musicVoiceChannelID) {
      if (!(voiceChannel = message.guild.channels.filter(c => c.type === 'voice').get(musicChannel.musicVoiceChannelID)) || !(textChannel = message.guild.channels.filter(c => c.type === 'text').get(musicChannel.musicTextChannelID))) {
        /**
         * Error condition is encountered.
         * @fires error
         */
        return Bastion.emit('error', string('invalidInput', 'errors'), string('invalidMusicChannel', 'errorMessage'), message.channel);
      }
      if (!voiceChannel.joinable) {
        /**
         * Error condition is encountered.
         * @fires error
         */
        return Bastion.emit('error', string('forbidden', 'errors'), string('noPermission', 'errorMessage', 'join', voiceChannel.name), message.channel);
      }
      if (!voiceChannel.speakable) {
        /**
         * Error condition is encountered.
         * @fires error
         */
        return Bastion.emit('error', string('forbidden', 'errors'), string('noPermission', 'errorMessage', 'speak', `in ${voiceChannel.name}`), message.channel);
      }
      vcStats = string('userNoMusicChannel', 'errorMessage', message.author.tag, voiceChannel.name);
    }
    else {
      /**
       * Error condition is encountered.
       * @fires error
       */
      return Bastion.emit('error', string('forbidden', 'errors'), string('musicChannelNotFound', 'errorMessage'), message.channel);
    }

    let musicMasterRoleID = musicChannel.musicMasterRoleID;

    if (textChannel.id !== message.channel.id) return;
    if (voiceChannel.members.get(message.author.id) === undefined) {
      /**
       * Error condition is encountered.
       * @fires error
       */
      return Bastion.emit('error', '', vcStats, message.channel);
    }

    let song = '';
    let musicObject = {
      voiceChannel: voiceChannel,
      textChannel: textChannel,
      musicMasterRoleID: musicMasterRoleID,
      songs: [],
      playing: false,
      repeat: false,
      skipVotes: []
    };

    try {
      if (args.favourites) {
        let favs;
        try {
          db.reload();
          favs = db.getData('/');
        }
        catch(e) {
          Bastion.log.error(e);
        }
        if (favs.length === 0) {
          /**
           * Error condition is encountered.
           * @fires error
           */
          return Bastion.emit('error', string('notFound', 'errors'), string('favSongsNotFound', 'errorMessage'), textChannel);
        }
        song = favs.shift();
        message.channel.send({
          embed: {
            color: Bastion.colors.green,
            description: `Adding ${favs.length + 1} favourite songs to the queue...`
          }
        }).then(m => {
          m.delete(5000).catch(e => {
            Bastion.log.error(e);
          });
        }).catch(e => {
          Bastion.log.error(e);
        });
        // TODO: This executes before `args` is added to the queue, so the first song (`args`) is added later in the queue. Using setTimeout or flags is inefficient, find an efficient way to fix this!
        favs.forEach(e => {
          e = /^(http[s]?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)$/i.test(e) ? e : `ytsearch:${e}`;
          if (!message.guild.music) {
            message.guild.music = musicObject;
          }
          yt.getInfo(e, [ '-q', '-i', '--skip-download', '--no-warnings', '--format=bestaudio[protocol^=http]' ], (err, info) => {
            if (err || info.format_id === undefined || info.format_id.startsWith('0')) return;
            message.guild.music.songs.push({
              url: info.formats[info.formats.length - 1].url,
              title: info.title,
              thumbnail: info.thumbnail,
              duration: info.duration,
              requester: message.author.tag
            });
          });
        });
      }
      else if (args.playlist) {
        if (!/^(http[s]?:\/\/)?(www\.)?youtube\.com\/playlist\?list=([-a-zA-Z0-9@:%_+.~#?&/=]*)$/i.test(args.playlist)) {
          /**
           * Error condition is encountered.
           * @fires error
           */
          return Bastion.emit('error', string('invalidInput', 'errors'), string('invalidInput', 'errorMessage', 'YouTube Playlist URL'), textChannel);
        }
        message.channel.send({
          embed: {
            color: Bastion.colors.green,
            description: 'Processing playlist...'
          }
        }).then(m => {
          m.delete(5000).catch(e => {
            Bastion.log.error(e);
          });
        }).catch(e => {
          Bastion.log.error(e);
        });

        yt.getInfo(args.playlist, [ '-q', '-i', '--skip-download', '--no-warnings', '--flat-playlist', '--format=bestaudio[protocol^=http]' ], (err, info) => {
          if (err) {
            Bastion.log.error(err);
            /**
             * Error condition is encountered.
             * @fires error
             */
            return Bastion.emit('error', string('connection', 'errors'), string('connection', 'errorMessage'), textChannel);
          }
          if (info) {
            if (info.length === 0) {
              /**
               * Error condition is encountered.
               * @fires error
               */
              return Bastion.emit('error', string('notFound', 'errors'), string('playlistNotFound', 'errorMessage'), textChannel);
            }
            song = info.shift().title;
            message.channel.send({
              embed: {
                color: Bastion.colors.green,
                description: `Adding ${info.length} songs to the queue...`
              }
            }).then(m => {
              m.delete(5000).catch(e => {
                Bastion.log.error(e);
              });
            }).catch(e => {
              Bastion.log.error(e);
            });
            // TODO: This executes before `args` is added to the queue, so the first song (`args`) is added later in the queue. Using setTimeout or flags is inefficient, find an efficient way to fix this!
            info.forEach(e => {
              if (!message.guild.music) {
                message.guild.music = musicObject;
              }
              message.guild.music.songs.push({
                url: `https://www.youtube.com/watch?v=${e.url}`,
                title: e.title,
                thumbnail: '',
                duration: e.duration,
                requester: message.author.tag
              });
            });
          }
        });
      }
      else {
        song = args.song.join(' ');
      }
      song = /^(http[s]?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)$/i.test(song) ? song : `ytsearch:${song}`;

      yt.getInfo(song, [ '-q', '-i', '--skip-download', '--no-warnings', '--format=bestaudio[protocol^=http]' ], (err, info) => {
        if (err || info.format_id === undefined || info.format_id.startsWith('0')) {
          return message.channel.send({
            embed: {
              color: Bastion.colors.red,
              description: string('notFound', 'errorMessage', 'result')
            }
          }).catch(e => {
            Bastion.log.error(e);
          });
        }

        if (!message.guild.music) {
          message.guild.music = musicObject;
        }

        message.guild.music.songs.push({
          url: info.formats[info.formats.length - 1].url,
          title: info.title,
          thumbnail: info.thumbnail,
          duration: info.duration,
          requester: message.author.tag
        });
        textChannel.send({
          embed: {
            color: Bastion.colors.green,
            title: 'Added to the queue',
            description: info.title,
            thumbnail: {
              url: info.thumbnail
            },
            footer: {
              text: `Position: ${message.guild.music.songs.length} | Duration: ${info.duration} | Requester: ${message.author.tag}`
            }
          }
        }).catch(e => {
          Bastion.log.error(e);
        });
        if (message.guild.music && message.guild.music.playing) return;

        voiceChannel.join().then(connection => {
          message.guild.members.get(Bastion.user.id).setDeaf(true).catch(() => {});

          startStreamDispatcher(message.guild, connection);
        }).catch(e => {
          Bastion.log.error(e);
        });
      });
    }
    catch (e) {
      /**
       * Error condition is encountered.
       * @fires error
       */
      return Bastion.emit('error', string('connection', 'errors'), string('connection', 'errorMessage'), textChannel);
    }
  }).catch(e => {
    Bastion.log.error(e);
  });
};

exports.config = {
  aliases: [],
  enabled: true,
  argsDefinitions: [
    { name: 'song', type: String, multiple: true, defaultOption: true },
    { name: 'playlist', type: String, alias: 'l' },
    { name: 'favourites', type: Boolean, alias: 'f' }
  ]
};

exports.help = {
  name: 'play',
  description: string('play', 'commandDescription'),
  botPermission: '',
  userPermission: '',
  usage: 'play <name | song_link | -l <playlist_link> | --favourites>',
  example: [ 'play Shape of you', 'play https://www.youtube.com/watch?v=GoUyrUwDN64', 'play -l https://www.youtube.com/playlist?list=PL4zQ6RXLMCJx4RD3pyzRX4QYFubtCdn_k', 'play --favourites' ]
};

/**
 * Starts a Stream Dispatcher in the specified guild
 * @function startStreamDispatcher
 * @param {Guild} guild the guild object where this command was ran
 * @param {VoiceConnection} connection the VoiceConnection of Bastion in this guild
 * @returns {void}
 */
function startStreamDispatcher(guild, connection) {
  if (guild.music.songs[0] === undefined) {
    return guild.music.textChannel.send({
      embed: {
        color: guild.client.colors.red,
        description: 'Exiting voice channel.'
      }
    }).then(m => {
      guild.music.voiceChannel.leave();
      delete guild.music;
      m.delete(5000).catch(e => {
        guild.client.log.error(e);
      });
    }).catch(e => {
      guild.client.log.error(e);
    });
  }

  // message.guild.voiceConnection.dispatcher = connection.playStream(yt(guild.music.songs[0].url), { passes: 1 });
  const dispatcher = connection.playStream(yt(guild.music.songs[0].url), { passes: 1 });

  guild.music.playing = true;

  guild.music.textChannel.send({
    embed: {
      color: guild.client.colors.blue,
      title: 'Playing',
      description: guild.music.songs[0].title,
      thumbnail: {
        url: guild.music.songs[0].thumbnail
      },
      footer: {
        text: `🔉 ${guild.voiceConnection.dispatcher.volume * 50}% | Duration: ${guild.music.songs[0].duration} | Requester: ${guild.music.songs[0].requester}`
      }
    }
  }).catch(e => {
    guild.client.log.error(e);
  });


  dispatcher.on('end', () => {
    guild.music.playing = false;
    guild.music.skipVotes = [];
    if (!guild.music.repeat) {
      guild.music.songs.shift();
    }
    else {
      guild.music.repeat = false;
    }
    startStreamDispatcher(guild, connection);
  });

  dispatcher.on('error', (err) => {
    guild.music.playing = false;
    guild.music.songs.shift();
    startStreamDispatcher(guild, connection);
    return guild.client.log.error(err);
  });
}
