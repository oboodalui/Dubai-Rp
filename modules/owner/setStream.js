/*
 * Copyright (C) 2017 Sankarsan Kampa
 *                    https://sankarsankampa.com/contact
 *
 * This file is a part of Bastion Discord BOT.
 *                        https://github.com/snkrsnkampa/Bastion
 *
 * This code is licensed under the SNKRSN Shared License. It is free to
 * download, copy, compile, use, study and refer under the terms of the
 * SNKRSN Shared License. You can modify the code only for personal or
 * internal use only. However, you can not redistribute the code without
 * explicitly getting permission fot it.
 *
 * Bastion BOT is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY. See the SNKRSN Shared License for
 * more details.
 *
 * You should have received a copy of the SNKRSN Shared License along
 * with this program. If not, see <https://github.com/snkrsnkampa/Bastion/LICENSE>.
 */

exports.run = (Bastion, message, args) => {
  if (!Bastion.credentials.ownerId.includes(message.author.id)) return Bastion.log.info('User doesn\'t have permission to use this command.');
  if (!/^((https:\/\/)(www\.)?(twitch\.tv)\/[a-z0-9-._]+)$/i.test(args[0]) || args.slice(1).join(' ').length < 1) {
    return message.channel.send({
      embed: {
        color: Bastion.colors.yellow,
        title: 'Usage',
        description: `\`${Bastion.config.prefix}${this.help.usage}\``
      }
    }).catch(e => {
      Bastion.log.error(e.stack);
    });
  }

  Bastion.user.setGame(args.slice(1).join(' '), args[0]).then(() => {
    message.channel.send({
      embed: {
        color: Bastion.colors.green,
        description: `${Bastion.user.username} is now streaming **${args.slice(1).join(' ')}**`
      }
    }).catch(e => {
      Bastion.log.error(e.stack);
    });
  }).catch(e => {
    Bastion.log.error(e.stack);
  });
};

exports.config = {
  aliases: [],
  enabled: true
};

exports.help = {
  name: 'setstream',
  description: 'Set the bot to streaming mode with a given twitch link and name.',
  botPermission: '',
  userPermission: 'Bot Owner',
  usage: 'setStream <twitch> <text>',
  example: [ 'setStream https://twitch.tv/TheGamerFDN The Gamer Foundation' ]
};
