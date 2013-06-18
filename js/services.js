'use strict';

/**
 * IRC Service. This service manages a collection of networks and
 * channels and provides helper methods for managing them.
 *
 * @class IRCService
 * @constructor
*/
app.service('IRCService', function (Network) {
  /**
   * A list of networks.
   *
   * @property networks
   * @type {Array}
   */
  this.networks = [Network({ name: 'Idel' })];
  
  /**
   * Find a network by name.
   *
   * @method networkByName
   * @param {String} name Name of the network
   * @return {Network} Network object
   * @example
   *     IRCService.networkByName('Idel');
   */
  this.networkByName = function (name) {
    return _.find(this.networks, { name: name });
  };
  
  /**
   * Find a channel by name.
   *
   * @method channelByName
   * @param {Network} network Network object
   * @param {String} name Name of the channel
   * @return {Channel} Channel object
   */
  this.channelByName = function (network, name) {
    return network ? _.find(network.channels, { name: name }) : null;
  };
  
  /**
   * Get the network object of the current network (selected by the
   * channel selector).
   *
   * @method currentNetwork
   * @return {Network} Network object
   */
  this.currentNetwork = function () {
    return this.networkByName(this.current.network);
  };
  
  /**
   * Find a channel by name.
   *
   * @method getChannel
   * @param {String} network Name of the network
   * @param {String} name Name of the channel
   * @return {Channel} Channel object
   * @example
   *     IRCService.getChannel('Freenode', '#angularjs');
   */
  this.getChannel = function (network, channel) {
    return this.channelByName(this.networkByName(network), channel);
  };

  /**
   * Get the channel object of the current channel (selected by the
   * channel selector).
   *
   * @method currentChannel
   * @return {Channel} Channel object
   */
  this.currentChannel = function () {
    return this.getChannel(this.current.network, this.current.channel);
  };
  
  /**
   * Set the current channel.
   *
   * @method setCurrentChannel
   * @param {String} network Name of the network
   * @param {String} channel Name of the channel
   * @return {Channel} New current channel object
   * @example
   *     IRCService.setCurrentChannel('Freenode', '#angularjs');
   */
  this.setCurrentChannel = function (network, channel) {
    var previousChannel = this.getChannel(this.current.network, this.current.channel);

    if (previousChannel) {
      previousChannel.activity = previousChannel.buffer.length;

      previousChannel.notifyType = 0;
    }

    this.current.network = network;
    this.current.channel = channel;
    
    var current = this.currentChannel();
    
    current.notifyType = 0;
    
    return current;
  };
  
  /**
   * Get the "Status" channel for a network.
   *
   * @method getStatusChannel
   * @param {String} network Name of the network
   * @return {Channel} Channel object for the "Status" channel
   */
  this.getStatusChannel = function (network) {
    return this.getChannel(network || 'Idel', 'Status');
  };
  
  /**
   * A map of the current network and channel names.
   *
   * @property current
   * @type {Object}
   */
  this.current = {
    network: 'Idel',
    channel: 'Status'
  };
});

/**
 * Nick Coloring Service. This service manages the handing out of
 * unique nick colors.
 *
 * @class NickColor
 * @constructor
*/
app.service('NickColor', function () {
  /**
   * The number of usable colors defined in the CSS.
   *
   * @property colors
   * @type {Integer}
   */
  this.colors = 6;

  /**
   * The current index.
   *
   * @property current
   * @type {Integer}
   */
  this.current = 0;

  /**
   * Get the unique color index for a particular nick.
   *
   * @method get
   * @param {String} nick Name of the nick
   * @return {Integer} Returns an index of the color to use
   * @example
   *     NickColor.get('user1'); => 0
   *     NickColor.get('user2'); => 1
   *     NickColor.get('user3'); => 2
   *     NickColor.get('user1'); => 0
   */
  this.get = _.memoize(function (nick) {
    var colorIndex = this.current;

    this.current++;
    if (this.current == this.colors)
      this.current = 0;
    
    return colorIndex;
  });
});

/**
 * Settings Service. This service manages a collection of settings and
 * provides suitable helper methods for retrieval and storage.
 *
 * @class SettingsService
 * @constructor
*/
app.service('SettingsService', function ($rootScope, PortService) {
  /**
   * The path to the active layout.
   *
   * @property layout
   * @type {String}
   * @default "layouts/horizontal.html"
   */
  this.layout = 'layouts/horizontal.html';

  /**
   * The path to the active theme.
   *
   * @property theme
   * @type {String}
   * @default "themes/dark.json"
   */
  this.theme = 'themes/dark.json';
  
  this._defaults = {
    'theme.layout': 'layouts/horizontal.html',
    'theme.user-css': null,
    'irc.nick': 'Idel',
    'idel.firstrun': true
  };
  
  this._settings = {};
  
  this.get = function (key, def) {
    return this._settings[key] || def;
  };

  this.set = function (key, val) {
    if (val == 'true') val = true;
    if (val == 'false') val = false;
    if (val == 'null') {
      delete this._settings[key];
      return;
    }
    
    this._settings[key] = val;
  };
  
  this.save = function (remote) {
    PortService.saveSettings({ 'settings': this._settings }, function () {
      console.log('Saved settings.');
    });
  };

  this.load = function (remote) {
    var self = this;

    PortService.loadSettings('settings', {}, function (settings) {
      self._settings = _.defaults(settings.settings || {}, self._defaults);
      console.log('Loaded settings:', self._settings);
      
      $rootScope.$apply();
    });
  };
  
  this.find = function (term) {
    var settings = _.filter(this._settings, function (val, key) {
      return _.str.include(key, term);
    });

    console.log('Found settings:', settings);

    return settings;
  };
  
  this.load();
});

/**
 * Input Service. This service handles parsing and actions for the
 * input box.
 *
 * @class InputService
 * @constructor
*/
app.service('InputService', function ($rootScope, IRCService, SettingsService, ColorService, Network, Nick) {
  /**
   * A list of registered handlers.
   *
   * @property _handlers
   * @type {Array}
   * @default []
   */
  this._handlers = [];

  /**
   * Register a new command handler.
   *
   * @method register
   * @param {String} command Name of the command
   * @param {Function} handler A function that handles the command
   * @param {String} description Description of the command
   * @example
   *     InputService.register('hello', function (name) {
   *       console.log('Hello, ' + name + '!');
   *     }, 'Say hello on the browser console.');
   *
   *     // Now you may use "/hello World" in the input box
   */
  this.register = function (command, handler, desc) {
    this._handlers.push({ command: command, handler: handler, desc: desc });
    this._handlers = _.sortBy(this._handlers, 'command');
  };

  /**
   * Parse a line from the input box using the registered handlers.
   *
   * @method parse
   * @param {String} line The line to parse
   * @example
   *     InputService.parse('/hello World');
   *
   *     // You should see "Hello, World!" printed to the browser console
   */
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
  
  /**
   * A hack to retrieve the command arguments to be used in help text.
   *
   * @method commandHelp
   * @param {Object} command Command object
   * @return {String} A list of arguments
   */
  function commandHelp(command) {
    var desc = '/' + command.command;
    var args = _.filter(command.handler.toString().match(/function \((.*?)\)/)[1].split(','), 'length');
    
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
  
  /**
   * Jump to another channel.
   *
   * @method jumpChannel
   * @param {Integer} position Index of channel to jump to, or relative offset
   * @param {Boolean} relative Whether or not the position is relative
   * @example
   *     InputService.jumpChannel(0, false);
   */
  this.jumpChannel = function (pos, relative) {
    var list = [];
    
    for (var x = 0; x < IRCService.networks.length; x++) {
      for (var y = 0; y < IRCService.networks[x].channels.length; y++) {
        list.push({ network: IRCService.networks[x].name, channel: IRCService.networks[x].channels[y].name });
      }
    }
    
    list = _.sortBy(list, function (obj) {
      return obj.network + obj.channel.toLowerCase();
    });
    
    for (var i = 0; i < list.length; i++) {
      if (relative) {
        if (IRCService.current.network == list[i].network &&
            IRCService.current.channel == list[i].channel) {
          var offset = i + pos;
          if (offset < 0) offset = list.length - 1;
          if (offset >= list.length) offset = 0;

          IRCService.setCurrentChannel(list[offset].network, list[offset].channel);
          $rootScope.$apply();

          break;
        }

        continue;
      }

      if (i == pos) {
        IRCService.setCurrentChannel(list[i].network, list[i].channel);
        $rootScope.$apply();

        break;
      }
    }
  };
  
  /**
   * Get the autocompletion of a line of text. Completes commands and
   * channel nicks.
   *
   * @method autocomplete
   * @param {String} line The current line to autocomplete
   * @return {String} A new line after autocompletion
   * @example
   *     InputService.autocomplete('zan'); => 'zanea, '
   *     InputService.autocomplete('/con'); => '/connect '
   */
  this.autocomplete = function (line) {
    var parts = line.split(' ');
    var word = parts.pop();

    // Autocomplete help commands
    for (var i = 0; i < this._handlers.length; i++) {
      var desc = commandHelp(this._handlers[i]);
      if (_.str.startsWith(desc.toLowerCase(), line.toLowerCase())) {
        return desc + ' ';
      }
    }
    
    // Autocomplete nicks
    var channel = IRCService.currentChannel();

    for (var i = 0; i < channel.nicks.length; i++) {
      if (_.str.startsWith(channel.nicks[i].name.toLowerCase(), word.toLowerCase())) {
        var beginning = parts.length == 0;
        return parts.join(' ') + (beginning ? '' : ' ') + channel.nicks[i].name + (beginning ? ', ' : ' ');
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
    
    $rootScope.$broadcast('ui::switch-channel', { network: network.name, channel: 'Status' });

    network.connect();
  }, 'Connect to a server.');
  
  this.register('disconnect', function () {
    this.network.disconnect();
  }, 'Disconnect from the current server.');

  this.register('join', function (channel) {
    this.network.writeLine('JOIN %s', channel);
  }, 'Join a channel.');

  this.register('part', function (_channel) {
    this.network.writeLine('PART %s :', _channel || this.channel.name);
  }, 'Part the current channel.');

  this.register('quote', function (line) {
    this.network.writeLine(_.toArray(arguments).join(' '));
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
      return _.str.include(line.message.toLowerCase(), term.toLowerCase());
    }), function (message) {
      this.channel.addLine(1, null, '%s%s: %s', ColorService._red, (message.nick ? message.nick : 'status'), message.message);
    }, this);
  }, 'Search the current buffer for term.');
  
  this.register('nick', function (nick) {
    this.network.writeLine('NICK %s', nick);
  }, 'Change your nickname.');
  
  this.register('topic', function (topic) {
    this.network.writeLine('TOPIC %s :%s', this.channel.name, _.toArray(arguments).join(' '));
  }, 'Change the topic.');
  
  this.register('msg', function (nick, message) {
    var args = _.toArray(arguments);
    this.network.writeLine('PRIVMSG %s :%s', args.shift(), args.join(' '));
  }, 'Send a message to nick.');
  
  this.register('ctcp', function (nick, message) {
    var args = _.toArray(arguments);
    this.network.writeLine('PRIVMSG %s :\u0001%s\u0001', args.shift(), args.join(' '));
  }, 'Send a CTCP message to nick.');
  
  this.register('me', function (message) {
    this.network.writeLine('PRIVMSG %s :\u0001ACTION %s\u0001', this.channel.name, _.toArray(arguments).join(' '));
  }, 'Send an action to the current channel.');
  
  this.register('bug', function () {
    this.channel.addLine(1, null, '%sYou can report bugs either via:', ColorService.yellow);
    this.channel.addLine(1, null, '%sGitHub%s - https://github.com/ZaneA/Idel-IRC/issues', ColorService.green, ColorService.reset);
    this.channel.addLine(1, null, '%sEmail%s - %szane.a+idel@demonastery.org', ColorService.green, ColorService.reset, ColorService._white);
  }, 'Get instructions on bug reporting.');
  
  this.register('set', function (_key, _value) {
    var display = function (val, key) {
      this.channel.addLine(1, null, '%s%s%s: "%s"', ColorService.yellow, key, ColorService.reset, val);
    }.bind(this);

    if (!_key && !_value) { // Display all
      _.each(SettingsService._settings, display);
    } else if (!_value) { // Partial search
      _.each(SettingsService.find(_key), display);
    } else { // Setting
      SettingsService.set(_key, _value);
      this.channel.addLine(1, null, '%s%s%s set to "%s"', ColorService.yellow, _key, ColorService.reset, _value);
    }
  }, 'Modify or display various settings.');

  this.register('save', function (_remote) {
    SettingsService.save(_remote);
  }, 'Save settings to local or remote storage.');

  this.register('load', function (_remote) {
    SettingsService.load(_remote);
  }, 'Load settings from local or remote storage.');
  
  this.register('wc', function () {
    if (this.channel.name == 'Status') {
      this.network.disconnect();
      IRCService.networks = _.reject(IRCService.networks, { name: this.network.name });
    } else {
      this.network.channels = _.reject(this.network.channels, { name: this.channel.name });
    }
  }, 'Close current window.');
});

/**
 * Color Service. This service contains a collection of colors and
 * their corresponding IRC codes which can be added into any string
 * that is entering the chat window.
 *
 * @class ColorService
 * @constructor
 * @example
 *     ColorService.blue + 'hello ' + ColorService._yellow + 'world'
*/
app.service('ColorService', function () {
  var colors = '_white black blue green _red red purple yellow _yellow _green cyan _cyan _blue _purple _black'.split(' ');
  for (var i = 0; i < colors.length; i++) {
    this[colors[i]] = _.str.sprintf('\u0003%02f', i);
  }
  this.white = this.reset = '\x0f';
});

/**
 * Modal Service. This service allows displaying a template to the user
 * inside of a Modal dialog.
 *
 * @class ModalService
 * @constructor
 * @example
 *     ModalService.display('thanks');
 */
app.service('ModalService', function () {
  this.template = '';

  this.display = function (template) {
    this.template = _.str.sprintf('js/templates/%s.html', template);
  };
});
