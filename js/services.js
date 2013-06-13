app.service('IRCService', function (Network, LineSocket) {
  this.networks = [];

  var idel = Network({ name: 'Idel' });
  
  this.networks.push(idel);
  
  this.networkByName = function (name) {
    return _.find(this.networks, { name: name });
  };
  
  this.channelByName = function (network, name) {
    return network ? _.find(network.channels, { name: name }) : null;
  };
  
  this.currentNetwork = function () {
    return this.networkByName(this.current.network);
  };
  
  this.getChannel = function (network, channel) {
    return this.channelByName(this.networkByName(network), channel);
  };

  this.currentChannel = function () {
    return this.getChannel(this.current.network, this.current.channel);
  };
  
  this.setCurrentChannel = function (network, channel) {
    this.current.network = network;
    this.current.channel = channel;
    
    var current = this.currentChannel();
    
    current.activity = false;
    
    return current;
  };
  
  this.getStatusChannel = function (network) {
    return this.getChannel(network || 'Idel', 'Status');
  };
  
  this.current = {
    network: 'Idel',
    channel: 'Status'
  };
});

app.service('NickColor', function () {
  this.colors = 6;
  this.current = 0;

  this.get = _.memoize(function (nick) {
    var colorIndex = this.current;

    this.current++;
    if (this.current == this.colors)
      this.current = 0;
    
    return colorIndex;
  });
});

// User settings
app.service('SettingsService', function () {
  this.layout = 'layouts/horizontal.html';
  this.theme = 'themes/dark.json';
});

app.service('InputService', function ($rootScope, IRCService, SettingsService, ColorService, Network, Nick) {
  this._handlers = [];

  this.register = function (command, handler, desc) {
    this._handlers.push({ command: command, handler: handler, desc: desc });
    this._handlers = _.sortBy(this._handlers, 'command');
  };

  this.parse = function (line) {
    var bindObject = {
      network: IRCService.currentNetwork(),
      channel: IRCService.currentChannel(),
      statusChannel: IRCService.getStatusChannel()
    };
    
    if (_.str.startsWith(line, '/')) {
      var parts = line.split(' ');
      for (var i = 0; i < this._handlers.length; i++) {
        if (parts[0] == '/' + this._handlers[i].command) {
          parts.shift();
          this._handlers[i].handler.apply(bindObject, parts);
          return;
        }
      }
      
      bindObject.network.writeLine('%s %s', _.str.ltrim(parts.shift(), '/').toUpperCase(), parts.join(' '));
      return;
    }
    
    bindObject.network.writeLine('PRIVMSG %s :%s', bindObject.channel.name, line);
    bindObject.channel.addLine(0, bindObject.network.nick, line);
  };
  
  // Bit of a hack to take a registered handler (command + callback) and turn it into a nice command description
  function commandHelp(command) {
    var desc = '/' + command.command;
    var args = _.filter(command.handler.toString().match(/function \((.*?)\)/)[1].split(','), 'length');
    console.log(args);
    
    while (args.length > 0) {
      var arg = _.str.trim(args.shift());
      if (arg[0] == '_') {
        arg = _.str.ltrim(arg, '_');
        desc += _.str.sprintf(' %s[%s]', ColorService.yellow, arg);
      } else {
        desc += _.str.sprintf(' %s<%s>', ColorService.yellow, arg);
      }
    }

    return desc;
  }
  
  this.autocomplete = function (line) {
    // Autocomplete help commands
    for (var i = 0; i < this._handlers.length; i++) {
      var desc = commandHelp(this._handlers[i]);
      if (_.str.startsWith(desc, line)) {
        return desc + ' ';
      }
    }
    
    // Autocomplete nicks
    var channel = IRCService.currentChannel();

    for (var i = 0; i < channel.nicks.length; i++) {
      if (_.str.startsWith(channel.nicks[i].name, line)) {
        return channel.nicks[i].name + ', ';
      }
    }
    
    return line;
  };
  
  // COMMANDS GO HERE

  var self = this; // HACK Would rather get rid of this

  this.register('help', function () {
    for (var i = 0; i < self._handlers.length; i++) {
      var description = commandHelp(self._handlers[i]);
      var channel = IRCService.getStatusChannel(IRCService.current.network);
      channel.addLine(1, null, '%s%s', ColorService._white, description);
      channel.addLine(1, null, '%s    %s', ColorService.black, self._handlers[i].desc);
    }
  }, 'Display a list of commands.');

  this.register('connect', function (server, _name, _nick, _pass) {
    var network = Network({
      name: _name || server,
      servers: [server],
      nick: Nick(_nick || 'Idel'),
      password: _pass,
      joinChannels: []
    });

    IRCService.networks.push(network);

    network.connect();
  }, 'Connect to a server.');
  
  this.register('disconnect', function () {
    this.network.disconnect();
  }, 'Disconnect from the current server.');

  this.register('join', function (channel) {
    this.network.writeLine('JOIN %s', channel);
  }, 'Join a channel.');

  this.register('part', function () {
    this.network.writeLine('PART %s :', this.channel.name);
  }, 'Part the current channel.');

  this.register('quote', function (line) {
    this.network.writeLine(line);
  }, 'Send a raw string to the server.');

  this.register('layout', function (layout) {
    SettingsService.layout = 'layouts/' + layout + '.html';
  }, 'Change the current layout.');

  this.register('theme', function (theme) {
    SettingsService.theme = 'themes/' + theme + '.json';
  }, 'Change the current theme.');
  
  this.register('clear', function () {
    this.channel.buffer = [];
  }, 'Clear the current channel\'s buffer.');
  
  this.register('search', function (term) {
    _.each(_.filter(this.channel.buffer, function (line) {
      return _.str.include(line.message, term);
    }), function (message) {
      this.channel.addLine(1, null, '%s%s: %s', ColorService._red, (message.nick ? message.nick : 'status'), message.message);
    }, this);
  }, 'Search the current buffer for term.');
  
  this.register('nick', function (nick) {
    this.network.writeLine('NICK %s', nick);
  }, 'Change your nickname.');
});

app.service('ColorService', function () {
  var colors = '_white black blue green _red red purple yellow _yellow _green cyan _cyan _blue _purple _black'.split(' ');
  for (var i = 0; i < colors.length; i++) {
    this[colors[i]] = "\003" + _.str.sprintf('%02f', i);
  }
  this.white = this.reset = "\x0f";
});
