'use strict';
  
/**
 * Network Factory. This factory is responsible for handling the
 * connection to an IRC network and parsing the protocol.
 *
 * @class Network
 * @constructor
*/
app.factory('Network', function ($rootScope, PortService, ColorService, LineSocket, /*TLSLineSocket,*/ Channel, Nick) {
  function network () {
    this.channels = [Channel('Status')];
  }
  

  /**
   * A list of registered protocol handlers.
   *
   * @property _handlers
   * @type {Array}
   */
  network.prototype._handlers = [];

  /**
   * Register a new handler for a piece of the IRC protocol.
   *
   * @method register
   * @param {String} description Description of this handler
   * @param {String} regex Regular expression describing the line to match
   * @param {Function} handler The function that handles this regular expression
   * @example
   *     network.register(
   *       'RFC1459::PING',
   *       /^PING :(.*)$/,
   *       function (reply) {
   *         this.writeLine('PONG :%s', reply);
   *     });
   */
  network.prototype.register = function (desc, regex, handler) {
    network.prototype._handlers.push({ regex: regex, handler: handler, desc: desc });
  };
  
  /**
   * Begin connecting to the IRC network.
   *
   * @method connect
   */
  network.prototype.connect = function () {
    this._socket = LineSocket();
    //this._socket = TLSLineSocket();
    
    // FIXME should cycle through available servers
    var server = this.servers[0];
    var parts = server.split(':');

    this._socket.connect(parts[0], parts[1], this.onConnect.bind(this), this.onMessage.bind(this), this.onDisconnect.bind(this));
  };
  
  /**
   * Disconnect from the IRC network.
   *
   * @method disconnect
   * @param {String} [message='Bye'] Quit message
   */
  network.prototype.disconnect = function (message) {
    this.writeLine('QUIT :%s', message || 'Bye');
    this._socket.disconnect();
  };
  
  /**
   * Write a formatted line to the network connection. Uses sprintf
   * from Underscore.string.
   *
   * @method writeLine
   * @param {String} format Format string (int sprintf-like format)
   * @param {Object} [objects]* Objects to be passed to _.str.sprintf
   * @example
   *     network.writeLine('NICK %s', 'newnick');
   */
  network.prototype.writeLine = function () {
    var line = _.str.sprintf.apply(this, arguments);
    this.channels[0].addLine(1, null, '%s> %s', ColorService.black, line);
    this._socket.writeLine(line);
  };

  /**
   * Internal method that handles the onConnect event from the network
   * socket.
   *
   * @method onConnect
   */
  network.prototype.onConnect = function () {
    if (this.password) {
      this.writeLine('PASS %s', this.password);
    }

    this.writeLine('NICK %s', this.nick.name);
    this.writeLine('USER %s 0 * :%s', this.nick.name, this.nick.name);
  };
  
  /**
   * Internal method that handles the onMessage event from the network
   * socket.
   *
   * @method onMessage
   * @param {String} line The incoming line to match against registered handlers
   */
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
  
  /**
   * Internal method that handles the onDisconnect event from the network
   * socket.
   *
   * @method onDisconnect
   */
  network.prototype.onDisconnect = function () {
    _.each(this.channels, function (channel) {
      channel.addLine(1, null, '%sDisconnected.', ColorService._red);
    });

    // TODO Reconnect logic
  };
  
  // HELPERS

  /**
   * Find a channel in this network by name.
   *
   * @method findChannel
   * @param {String} name Name of the channel to find
   * @return {Channel} The found channel, or null
   */
  network.prototype.findChannel = function (name) {
    return _.find(this.channels, { name: name });
  };

  /**
   * Find a channel in this network by name, or create it.
   *
   * @method findOrCreateChannel
   * @param {String} name Name of the channel to find
   * @return {Channel} A channel object, either existing or new
   */
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
      nicks = nicks.split(' ');
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
      var channel = null;

      if (nick == this.nick.name) { // It's us!
        // Add ourselves to this new channel
        channel = Channel(channelName);
        channel.addLine(1, null, '%sJoined %s', ColorService.green, channelName);
        this.channels.push(channel);
        $rootScope.$broadcast('ui::switch-channel', { network: this.name, channel: channelName });
      } else {
        // Add nick to the channel
        channel = this.findChannel(channelName);
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
      var channel = this.findChannel(channelName);

      if (nick == this.nick.name) { // It's us!
        // Remove ourselves from this channel
        channel.nicks = [];
        channel.addLine(1, null, '%sYou have left the channel', ColorService.yellow);
      } else {
        // Remove nick from the channel
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

      if (message[0] == '\u0001') { // Handle CTCP
        var match = message.match(/\u0001(.*?)(\s.*)?\u0001/);

        if (match) {
          var body = _.str.ltrim(match[2]);

          switch (match[1]) {
          case 'ACTION':
            lineType = 2; // Action
            message = match[2];
            break;

          case 'VERSION':
            if (type == 'PRIVMSG') {
              this.writeLine('NOTICE %s :\u0001VERSION Idel IRC %s\u0001', nick, chrome.runtime.getManifest().version);
            }
            return;

          case 'TIME':
            if (type == 'PRIVMSG') {
              this.writeLine('NOTICE %s :\u0001TIME :%s\u0001', nick, moment().format('dddd, MMMM Do YYYY, h:mm:ss a'));
            }
            return;

          case 'PING':
            if (type == 'PRIVMSG') {
              this.writeLine('NOTICE %s :\u0001PING %s\u0001', nick, body);
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

        if (this.nick.name == oldnick)
          this.nick.name = newnick;

        var nick = _.find(channel.nicks, { name: oldnick });

        if (!nick) return;

        nick.name = newnick;

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

  return function (obj) {
    return _.assign(new network(), obj);
  };
});

/**
 * Channel Factory. This factory contains a representation of a
 * channel and contains all properties related to that.
 *
 * @class Channel
 * @constructor
*/
app.factory('Channel', function () {
  return function (name) {
    return {
      name: name,
      activity: 0,
      notifyType: 0,
      topic: null,
      nicks: [],
      buffer: [],
      /**
       * Add a line to this channel buffer.
       *
       * @method addLine
       * @param {String} format Format string (int sprintf-like format)
       * @param {Object} [objects]* Objects to be passed to _.str.sprintf
       * @example
       *     channel.addLine('%shello, %s%s', ColorService.white, ColorService._white, 'world');
       */
      addLine: function () {
        var args = _.toArray(arguments);
        var type = args.shift();
        var nick = args.shift();
        var message = _.str.sprintf.apply(this, args);

        var lines = message.split('\n');

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

/**
 * Nick Factory. This is a small wrapper for an IRC nick to keep track
 * of name and modes.
 *
 * @class Nick
 * @constructor
*/
app.factory('Nick', function () {
  return function (name, mode) {
    return {
      name: name,
      mode: mode || ''
    };
  };
});
