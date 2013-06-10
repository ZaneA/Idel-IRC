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
        console.log('Connect returned ' + result);
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
      console.log('Read: ' + result.resultCode);

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
    chrome.socket.write(this._socket, this.stringToArrayBuffer(line), function (result) {
      console.log('onWriteCompleteCallback: ' + result.bytesWritten);
    });
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

app.factory('Network', function ($rootScope, ColorService, LineSocket, Channel, Nick) {
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
  
  network.prototype.writeLine = function (line) {
    this.channels[0].addLine(null, ColorService.black + '> ' + line, 1);
    this._socket.writeLine(line);
  };

  network.prototype.onConnect = function () {
    this.writeLine('NICK ' + this.nick.name);
    this.writeLine('USER ' + this.nick.name + ' 0 * :' + this.nick.name);
  };
  
  network.prototype.onMessage = function (line) {
    this.channels[0].addLine(null, ColorService.black + '< ' + line, 1);

    for (var i = 0; i < network.prototype._handlers.length; i++) {
      var match = line.match(network.prototype._handlers[i].regex);
      if (match) {
        match.shift();
        network.prototype._handlers[i].handler.apply(this, match);
        $rootScope.$apply();
        return;
      }
    }
  };
  
  // PROTOCOL HANDLING BELOW
  
  network.prototype.register(
    'RFC1459::332::RPL_TOPIC',
    /^:.*? 332 .*? (.*?) :(.*)$/,
    function (channelName, topic) {
      var channel = _.find(this.channels, { name: channelName });
      channel.topic = topic;
  });

  network.prototype.register(
    'RFC1459::TOPIC',
    /^:(.*?) TOPIC (.*?) :(.*)$/,
    function (user, channelName, topic) {
      var channel = _.find(this.channels, { name: channelName });
      channel.topic = topic;
  });

  network.prototype.register(
    'RFC1459::353::RPL_NAMREPLY',
    /^:.*? 353 .*? . (.*?) :(.*)$/,
    function (channelName, nicks) {
      var channel = _.find(this.channels, { name: channelName });
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
        this.writeLine('JOIN ' + this.joinChannels.join(','));
      }
  });

  network.prototype.register(
    'RFC1459::433::ERR_NICKNAMEINUSE',
    /^:.*? 433/,
    function () {
      this.nick.name += '_';
      this.writeLine('NICK ' + this.nick.name);
  });

  network.prototype.register(
    'RFC1459::JOIN',
    /^:(.*?)!.*? JOIN :?(.*)$/,
    function (nick, channelName) {
      if (nick == this.nick.name) { // It's us!
        // Add ourselves to this new channel
        this.channels.push(Channel(channelName));
      } else {
        // Add nick to the channel
        var channel = _.find(this.channels, { name: channelName });
        channel.nicks.push(Nick(nick));
        channel.addLine(null, ColorService.green + nick + ' joins', 1);
      }
  });
  
  network.prototype.register(
    'RFC1459::QUIT',
    /^:(.*?)!.*? QUIT :(.*)$/,
    function (nick, message) {
      for (var i = 0; i < this.channels.length; i++) {
        this.channels[i].nicks = _.reject(this.channels[i].nicks, function (_nick) {
          if (_nick.name == nick) {
            this.channels[i].addLine(null, ColorService.red + _nick.name + ' quits', 1);
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
        this.channels = _.reject(this.channels, { name: channelName });
      } else {
        // Remove nick from the channel
        console.log(channelName);
        var channel = _.find(this.channels, { name: channelName });
        console.log(this.channels);
        console.log(channel);
        channel.nicks = _.reject(channel.nicks, Nick(nick));
        channel.addLine(null, ColorService.yellow + nick + ' leaves', 1);
      }
  });
  
  network.prototype.register(
    'RFC1459::PING',
    /^PING :(.*)$/,
    function (reply) {
      this.writeLine('PONG :' + reply);
  });

  network.prototype.register(
    'RFC1459::NOTICE|RFC1459::PRIVMSG',
    /^:(.*?)!.*? (NOTICE|PRIVMSG) (.*?) :(.*)$/,
    function (nick, type, channelName, message) {
      var channel = _.find(this.channels, { name: channelName });
      if (channel) {
        var nick = _.find(channel.nicks, { name: nick });
        channel.addLine(nick, message);
      }
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
          
          //case 'QUIT': // No channel given, need to enumerate, look for nick, remove nick from all :(
          case 'PART':
            break;
        }
        break;

      case 'ERROR':
     */
  
  network.prototype.onDisconnect = function () {
    console.log('Disconnected.');
    // TODO Reconnect logic
  };

  return function (obj) {
    return _.assign(new network(), obj);
  };
});

app.factory('Channel', function (Message) {
  return function (name) {
    return {
      name: name,
      activity: false,
      topic: null,
      nicks: [],
      buffer: [],
      addLine: function (nick, message, type, timestamp) {
        var lines = message.split("\n");
        for (var i = 0; i < lines.length; i++) {
          this.buffer.push(Message(timestamp || moment().unix(), nick, lines[i], type || 0));
        }
        this.activity = true;
      }
    };
  };
});

app.factory('Message', function () {
  // Message types:
  // 0 - Message
  // 1 - Status Message
  // 2 - Action
  return function (timestamp, nick, message, type) {
    return {
      type: type,
      timestamp: timestamp,
      nick: nick,
      message: message
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
