describe('IRC Connection', function () {
  beforeEach(module('IdelApp'));
  beforeEach(inject(function (Network, Nick, Channel) {
    _Channel = Channel;
    _Nick = Nick;
    _Network = Network;

    network = Network({ name: 'Network', nick: Nick('me'), channels: [Channel('#mock')]});
    network.lineBuffer = [];
    network.writeLine = function (line) {
      this.lineBuffer.push(line);
    };
  }));
  
  describe('RFC1459::353::RPL_NAMREPLY', function () {
    it('should add nicks to channel nicklist', function () {
      network.onMessage(':irc.demonastery.org 353 me @ #mock :me @you');
      expect(network.channels[0].nicks[0].name).toBe('me');
      expect(network.channels[0].nicks[0].mode).toBe('');
      expect(network.channels[0].nicks[1].name).toBe('you');
      expect(network.channels[0].nicks[1].mode).toBe('@');
    });
  });
  
  describe('RFC1459::332::RPL_TOPIC', function () {
    it('should update the topic variable', function () {
      network.onMessage(':irc.demonastery.org 332 me #mock :new subject :D');
      expect(network.channels[0].topic).toBe('new subject :D');
    });
  });

  describe('RFC1459::TOPIC', function () {
    it('should update the topic variable', function () {
      network.onMessage(':you!user@host TOPIC #mock :new subject :D');
      expect(network.channels[0].topic).toBe('new subject :D');
    });
  });
  
  describe('RFC1459::376::RPL_ENDOFMOTD|RFC1459::422::ERR_NOMOTD', function () {
    it('should join any joinChannels', function () {
      network.joinChannels = ['#one', '#two'];
      network.onMessage(':irc.demonastery.org 376 me :End of /MOTD command.');
      expect(network.lineBuffer).toContain('JOIN #one,#two');
    });
  });
  
  describe('RFC1459::433::ERR_NICKNAMEINUSE', function () {
    it('should modify nick, and re-nick', function () {
      network.onMessage(':irc.demonastery.org 433 me :Nickname is already in use');
      expect(network.nick.name).toBe('me_');
      expect(network.lineBuffer).toContain('NICK me_');
    });
  });
  
  describe('RFC1459::JOIN', function () {
    it('should handle ourselves joining', function () {
      network.onMessage(':me!user@host JOIN :#Channel');
      expect(network.channels[1].name).toBe('#Channel');
    });

    it('should handle others joining', function () {
      network.onMessage(':you!user@host JOIN :#mock');
      expect(network.channels[0].nicks[0].name).toBe('you');
    });
  });
  
  describe('RFC1459::PART with extra colon', function () {
    it('should handle ourselves leaving', function () {
      network.onMessage(':me!user@host PART :#mock');
      expect(network.channels[0]).toBeUndefined();
    });

    it('should handle others leaving', function () {
      network.channels[0].nicks = [ _Nick('you') ];
      network.onMessage(':you!user@host PART :#mock');
      expect(network.channels[0].nicks[0]).toBeUndefined();
    });
  });

  describe('RFC1459::PART without extra colon', function () {
    it('should handle ourselves leaving', function () {
      network.onMessage(':me!user@host PART #mock');
      expect(network.channels[0]).toBeUndefined();
    });

    it('should handle others leaving', function () {
      network.channels[0].nicks = [ _Nick('you') ];
      network.onMessage(':you!user@host PART #mock');
      expect(network.channels[0].nicks[0]).toBeUndefined();
    });
  });

  describe('RFC1459::QUIT', function () {
    it('should handle others quitting', function () {
      network.channels[0].nicks = [ _Nick('you') ];
      network.onMessage(':you!user@host QUIT :message');
      expect(network.channels[0].nicks[0]).toBeUndefined();
    });
  });
  
  describe('RFC1459::PING', function () {
    it('should reply with PONG', function () {
      network.onMessage('PING :test');
      expect(network.lineBuffer).toContain('PONG :test');
    });
  });
  
  describe('RFC1459::PRIVMSG', function () {
    it('should add the message to a buffer', function () {
      network.channels[0].nicks.push(_Nick('you'));
      network.onMessage(':you!user@host PRIVMSG #mock :Here is my' + ' message :)');
      expect(network.channels[0].buffer[1].nick.name).toBe('you');
      expect(network.channels[0].buffer[1].message).toBe('Here is my message :)');
    });
  });

  describe('RFC1459::NOTICE', function () {
    it('should add the message to a buffer', function () {
      network.channels[0].nicks.push(_Nick('you'));
      network.onMessage(':you!user@host NOTICE #mock :Here is my' + ' message :)');
      expect(network.channels[0].buffer[1].nick.name).toBe('you');
      expect(network.channels[0].buffer[1].message).toBe('Here is my message :)');
    });
  });
  
  describe('RFC1459::352::RPL_WHOREPLY', function () {
    it('should update the nicklist of a channel', function () {
      network.onMessage(':irc.demonastery.org 352 me #mock ~user host server you H :0 realname');
      expect(network.channels[0].nicks[0].name).toBe('you');
      expect(network.channels[0].nicks[0].mode).toBe('');
    });
  });
});
