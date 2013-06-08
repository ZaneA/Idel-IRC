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

app.factory('Network', function ($rootScope, LineSocket, Channel, Nick) {
  function network () {
    this.channels = [Channel('Status')];
  }
  
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
    this.channels[0].addLine(Nick('status'), '> ' + line);
    this._socket.writeLine(line);
  };

  network.prototype.onConnect = function () {
    this.writeLine('NICK ' + this.nick.name);
    this.writeLine('USER ' + this.nick.name + ' * * :' + this.nick.name);
  };
  
  network.prototype.onMessage = function (line) {
    this.channels[0].addLine(Nick('status'), '< ' + line);
    
    var parts = line.split(':');
    parts = _.map(parts, function (part) { return part.split(' '); });
    
    if (parts[0] === undefined)
      return;

    switch (parts[0][0]) {
      case '':
        switch (parts[1][1]) {
          case '332':
            var channel = _.find(this.channels, {name: parts[1][3]});
            channel.topic = parts[2].join(' ');
            break;
          
          case 'TOPIC':
            var channel = _.find(this.channels, {name: parts[1][2]});
            channel.topic = parts[2].join(' ');
            break;

          case '333': // no idea
            break;

          case '353': // Names
            var channel = _.find(this.channels, {name: parts[1][4]});
            for (var i = 0; i < parts[2].length; i++) {
              var mode = '';
              if (parts[2][i][0] == '@') { // Op
                mode += '@';
                parts[2][i] = parts[2][i].substr(1);
              }
              channel.nicks.push(Nick(parts[2][i], mode));
            }
            break;

          case '375': // Beginning of MOTD
          case '372': // MOTD
            break;

          case '376': // End of MOTD
          case '422': // no idea
            this.joinChannels.forEach(function (channel) {
              this.writeLine('JOIN ' + channel);
            }.bind(this));
            break;
          
          case '433': // Nick in use
            this.nick.name += '_';
            this.writeLine('NICK ' + this.nick.name);
            break;
          
          case 'MODE':
            break;
          
          case 'JOIN':
            var nick = parts[1][0].split('!')[0];
            if (nick == this.nick.name) { // It's us!
              // Add ourselves to this new channel
              this.channels.push(Channel(parts.length==3 ? parts[2][0] : parts[1][2]));
            } else {
              // Add nick to the channel
              var channel = _.find(this.channels, {name: parts.length==3 ? parts[2][0] : parts[1][2]});
              channel.nicks.push(Nick(nick));
              channel.addLine(Nick(nick), '(joins)');
            }
            break;
          
          //case 'QUIT': // No channel given, need to enumerate, look for nick, remove nick from all :(
          case 'PART':
            var nick = parts[1][0].split('!')[0];
            if (nick == this.nick.name) { // It's us!
              // Remove ourselves from this channel
              this.channels = _.reject(this.channels, {name: parts.length==3 ? parts[2][0] : parts[1][2]});
            } else {
              // Remove nick from the channel
              var channel = _.find(this.channels, {name: parts.length==3 ? parts[2][0] : parts[1][2]});
              channel.nicks = _.reject(channel.nicks, Nick(nick));
              channel.addLine(Nick(nick), '(leaves)');
            }
            break;
          
          case 'NOTICE':
          case 'PRIVMSG':
            var channel = _.find(this.channels, { name: parts[1][2] });
            if (channel) {
              var nick = _.find(channel.nicks, { name: parts[1][0].split('!')[0] });
              channel.addLine(nick, parts[2].join(' '));
            }
            break;
        }
        break;

      case 'PING':
        this.writeLine('PONG :' + parts[1].join(' '));
        break;
      
      case 'ERROR':
        break;
    }

    $rootScope.$apply();
  };
  
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
      addLine: function (nick, message, timestamp) {
        var lines = message.split("\n");
        for (var i = 0; i < lines.length; i++) {
          this.buffer.push(Message(timestamp || moment().unix(), nick, lines[i]));
        }
        this.activity = true;
      }
    };
  };
});

app.factory('Message', function () {
  return function (timestamp, nick, message) {
    return {
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
