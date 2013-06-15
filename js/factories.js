app.factory('LineSocket', function () {
  function lineSocket () {
    this._lineBuffer = '';
  };

  lineSocket.prototype.connect = function (host, port, onConnect, onMessage, onDisconnect) {
    var self = this;
    
    this._onConnect = onConnect;
    this._onMessage = onMessage;
    this._onDisconnect = onDisconnect;

    chrome.socket.create('tcp', {}, function (createInfo) {
      self._socket = createInfo.socketId;
      
      chrome.socket.connect(self._socket, host, parseInt(port), function (result) {
        self._onConnect();
        self.readLoop();
      });
    });
  };
  
  lineSocket.prototype.disconnect = function () {
    chrome.socket.disconnect(this._socket);
    chrome.socket.destroy(this._socket);
    this._onDisconnect();
  };
  
  lineSocket.prototype.readLoop = function () {
    var self = this;

    chrome.socket.read(this._socket, null, function (result) {
      if (result.resultCode < 0)
        return;

      self._lineBuffer += self.arrayBufferToString(result.data);
      var parts = self._lineBuffer.split("\r\n");

      for (var i = 0; i < parts.length - 1; i++) {
        self._onMessage(parts[i]);
      }
      
      self._lineBuffer = parts[parts.length-1];

      self.readLoop();
    });
  };
  
  lineSocket.prototype.writeLine = function (line) {
    line += "\r\n";
    chrome.socket.write(this._socket, this.stringToArrayBuffer(line), function (result) {});
  };
  
  lineSocket.prototype.arrayBufferToString = function (buffer) {
    return String.fromCharCode.apply(String, new Uint8Array(buffer));
  };

  lineSocket.prototype.stringToArrayBuffer = function (string) {
    var buffer = new ArrayBuffer(string.length);
    var bufferView = new Uint8Array(buffer);
    for (var i = 0; i < string.length; i++) {
      bufferView[i] = string.charCodeAt(i);
    }
    return buffer;
  };

  return function () {
    return new lineSocket();
  };
});

app.factory('Network', function ($rootScope, PortService, ColorService, LineSocket, Channel, Nick) {
  function network () {
    this.channels = [Channel('Status')];
  }
  
  network.prototype._handlers = [];

  network.prototype.register = function (desc, regex, handler) {
    network.prototype._handlers.push({ regex: regex, handler: handler, desc: desc });
  };
  
  network.prototype.connect = function () {
    this._socket = LineSocket();
    
    // FIXME should cycle through available servers
    var server = this.servers[0];
    var parts = server.split(':');

    this._socket.connect(parts[0], parts[1], this.onConnect.bind(this), this.onMessage.bind(this), this.onDisconnect.bind(this));
  };
  
  network.prototype.disconnect = function () {
    this.writeLine('QUIT :Bye');
    this._socket.disconnect();
  };
  
  network.prototype.writeLine = function () {
    var line = _.str.sprintf.apply(this, arguments);
    this.channels[0].addLine(1, null, '%s> %s', ColorService.black, line);
    this._socket.writeLine(line);
  };

  network.prototype.onConnect = function () {
    if (this.password) {
      this.writeLine('PASS %s', this.password);
    }

    this.writeLine('NICK %s', this.nick.name);
    this.writeLine('USER %s 0 * :%s', this.nick.name, this.nick.name);
  };
  
  network.prototype.onMessage = function (line) {
    this.channels[0].addLine(1, null, '%s< %s', ColorService.black, line);

    for (var i = 0; i < network.prototype._handlers.length; i++) {
      var match = line.match(network.prototype._handlers[i].regex);
      if (match) {
        match.shift();
        network.prototype._handlers[i].handler.apply(this, match);
        break;
      }
    }

    $rootScope.$apply();
  };
  
  // HELPERS

  network.prototype.findChannel = function (name) {
    return _.find(this.channels, { name: name });
  };

  network.prototype.findOrCreateChannel = function (name) {
    var channel = this.findChannel(name);

    if (!channel) {
      channel = Channel(name);
      this.channels.push(channel);
    }

    return channel;
  };
  
  // PROTOCOL HANDLING BELOW
  
  network.prototype.register(
    'RFC1459::332::RPL_TOPIC',
    /^:.*? 332 .*? (.*?) :(.*)$/,
    function (channelName, topic) {
      var channel = this.findChannel(channelName);
      channel.addLine(1, null, '%sTopic changed from %s%s%s to %s%s%s',
                      ColorService.yellow,
                      ColorService.reset,
                      channel.topic || 'none',
                      ColorService.yellow,
                      ColorService.reset,
                      topic,
                      ColorService.yellow);
      channel.topic = topic;
  });

  network.prototype.register(
    'RFC1459::TOPIC',
    /^:(.*?) TOPIC (.*?) :(.*)$/,
    function (user, channelName, topic) {
      var channel = this.findChannel(channelName);
      channel.addLine(1, null, '%sTopic changed from %s%s%s to %s%s%s',
                      ColorService.yellow,
                      ColorService.reset,
                      channel.topic || 'none',
                      ColorService.yellow,
                      ColorService.reset,
                      topic,
                      ColorService.yellow);
      channel.topic = topic;
  });

  network.prototype.register(
    'RFC1459::353::RPL_NAMREPLY',
    /^:.*? 353 .*? . (.*?) :(.*)$/,
    function (channelName, nicks) {
      var channel = this.findChannel(channelName);
      var nicks = nicks.split(' ');
      for (var i = 0; i < nicks.length; i++) {
        var mode = '';
        if (nicks[i][0] == '@' || nicks[i][0] == '+') { // Op
          mode += nicks[i][0];
          nicks[i] = nicks[i].substr(1);
        }
        channel.nicks.push(Nick(nicks[i], mode));
      }
  });

  network.prototype.register(
    'RFC1459::376::RPL_ENDOFMOTD',
    /^:.*? (376|422)/,
    function () {
      if (this.joinChannels.length > 0) {
        this.writeLine('JOIN %s', this.joinChannels.join(','));
      }
  });

  network.prototype.register(
    'RFC1459::433::ERR_NICKNAMEINUSE',
    /^:.*? 433/,
    function () {
      this.nick.name += '_';
      this.writeLine('NICK %s', this.nick.name);
  });

  network.prototype.register(
    'RFC1459::JOIN',
    /^:(.*?)!.*? JOIN :?(.*)$/,
    function (nick, channelName) {
      if (nick == this.nick.name) { // It's us!
        // Add ourselves to this new channel
        var channel = Channel(channelName);
        channel.addLine(1, null, '%sJoined %s', ColorService.green, channelName);
        this.channels.push(channel);
      } else {
        // Add nick to the channel
        var channel = this.findChannel(channelName);
        channel.nicks.push(Nick(nick));
        channel.addLine(1, null, '%s%s joins', ColorService.green, nick);
      }
  });
  
  network.prototype.register(
    'RFC1459::QUIT',
    /^:(.*?)!.*? QUIT :(.*)$/,
    function (nick, message) {
      for (var i = 0; i < this.channels.length; i++) {
        this.channels[i].nicks = _.reject(this.channels[i].nicks, function (_nick) {
          if (_nick.name == nick) {
            this.channels[i].addLine(1, null, '%s%s quits', ColorService.red, _nick.name);
            return true;
          }
          
          return false;
        }, this);
      }
  });

  network.prototype.register(
    'RFC1459::PART',
    /^:(.*?)!.*? PART :?(.*?)(\s.*)?$/,
    function (nick, channelName) {
      if (nick == this.nick.name) { // It's us!
        // Remove ourselves from this channel
        var channel = this.findChannel(channelName);
        channel.nicks = [];
        channel.addLine(1, null, '%sYou have left the channel', ColorService.yellow);
      } else {
        // Remove nick from the channel
        var channel = this.findChannel(channelName);
        channel.nicks = _.reject(channel.nicks, Nick(nick));
        channel.addLine(1, null, '%s%s leaves', ColorService.yellow, nick);
      }
  });
  
  network.prototype.register(
    'RFC1459::PING',
    /^PING :(.*)$/,
    function (reply) {
      this.writeLine('PONG :%s', reply);
  });

  network.prototype.register(
    'RFC1459::NOTICE|RFC1459::PRIVMSG',
    /^:(.*?)!.*? (NOTICE|PRIVMSG) (.*?) :(.*)$/,
    function (nick, type, channelName, message) {
      var lineType = 0; // Regular PRIVMSG
      var privateMsg = false;
      
      if (channelName == this.nick.name) { // HACK to make private messages work
        channelName = nick;
        privateMsg = true;
      }

      if (message[0] == "\001") { // Handle CTCP
        var match = message.match(/\001(.*?)(\s.*)?\001/);

        if (match) {
          var body = _.str.ltrim(match[2]);

          switch (match[1]) {
          case 'ACTION':
            lineType = 2; // Action
            message = match[2];
            break;

          case 'VERSION':
            if (type == 'PRIVMSG') {
              this.writeLine('NOTICE %s :\001VERSION Idel IRC %s\001', nick, chrome.runtime.getManifest().version);
            }
            return;

          case 'TIME':
            if (type == 'PRIVMSG') {
              this.writeLine('NOTICE %s :\001TIME :%s\001', nick, moment().format('dddd, MMMM Do YYYY, h:mm:ss a'));
            }
            return;

          case 'PING':
            if (type == 'PRIVMSG') {
              this.writeLine('NOTICE %s :\001PING %s\001', nick, body);
            }
            return;
          }
        }
      }

      var channel = this.findOrCreateChannel(channelName);
      
      if (privateMsg) {
        channel.nicks.push(Nick(nick));
      }

      nick = _.find(channel.nicks, { name: nick });

      channel.addLine(lineType, nick, '%s', message);

      if (channel.notifyType < 2)
        channel.notifyType = 2;

      // Highlight notifications
      if (_.str.include(message.toLowerCase(), this.nick.name.toLowerCase())) {
        PortService.notify('(' + channel.name + ') ' + nick.name, message);
        if (channel.notifyType < 3)
          channel.notifyType = 3;
      }
  });
  
  network.prototype.register(
    'RFC1459::NICK',
    /^:(.*?)!.*? NICK :(.*)$/,
    function (oldnick, newnick) {
      _.each(this.channels, function (channel) {
        if (channel.name == oldnick) { // Private messages
          channel.name = newnick;
        }

        var nick = _.find(channel.nicks, { name: oldnick });

        if (!nick) return;

        nick.name = newnick;

        if (this.nick.name == oldnick)
          this.nick.name = newnick;

        channel.addLine(1, null, '%s%s%s is now known as %s%s',
                        ColorService._white, oldnick, ColorService.reset,
                        ColorService._white, newnick);
      }, this);
  });

    /*
          case '001': // Welcome

          case '005': // Options
            // :irc.demonastery.org 005 testclient CALLERID CASEMAPPING=rfc1459 DEAF=D KICKLEN=160 MODES=4 NICKLEN=15 PREFIX=(ohv)@%+ STATUSMSG=@%+ TOPICLEN=350 NETWORK=demonastery MAXLIST=beI:25 MAXTARGETS=4 CHANTYPES=#& :are supported by this server
            // :irc.demonastery.org 005 testclient CHANLIMIT=#&:15 CHANNELLEN=50 CHANMODES=eIb,k,l,imnpst KNOCK ELIST=CMNTU SAFELIST AWAYLEN=160 EXCEPTS=e INVEX=I :are supported by this server

          case '333': // no idea
            break;

          case '375': // Beginning of MOTD
          case '372': // MOTD
            break;
          
          case 'MODE':
            break;
        }
        break;

      case 'ERROR':
     */
  
  network.prototype.onDisconnect = function () {
    _.each(this.channels, function (channel) {
      channel.addLine(1, null, '%sDisconnected.', ColorService._red);
    });

    // TODO Reconnect logic
  };

  return function (obj) {
    return _.assign(new network(), obj);
  };
});

app.factory('Channel', function () {
  return function (name) {
    return {
      name: name,
      activity: 0,
      notifyType: 0,
      topic: null,
      nicks: [],
      buffer: [],
      addLine: function () {
        var args = _.toArray(arguments);
        var type = args.shift();
        var nick = args.shift();
        var message = _.str.sprintf.apply(this, args);

        var lines = message.split("\n");

        for (var i = 0; i < lines.length; i++) {
          this.buffer.push({
            type: type,
            timestamp: moment().unix(),
            nick: nick,
            message: lines[i]
          });
        }
        
        if (this.notifyType < 1)
          this.notifyType = 1;
      }
    };
  };
});

app.factory('Nick', function () {
  return function (name, mode) {
    return {
      name: name,
      mode: mode || ''
    };
  };
});
