var app = angular.module('IdelApp', []);

app.controller('IdelController', function ($scope, $http, WindowService, SettingsService, IRCService, Message, Network) {
  $scope.settings = SettingsService;
  $scope.irc = IRCService;

  $scope.$on('ui::input-box::send', function (ev, input) {
    var network = $scope.irc.currentNetwork();
    var channel = $scope.irc.currentChannel();

    var parts = input.message.split(' ');
    if (parts[0].indexOf('/') === 0) {
      switch (parts[0]) {
        case '/connect':
          var _network = Network({
            name: parts[1],
            servers: [parts[2]],
            nick: parts[3],
            joinChannels: []
          });

          $scope.irc.networks.push(_network);

          _network.connect();
          break;
        
        case '/disconnect':
          network.disconnect();
          break;
        
        case '/join':
          network.writeLine('JOIN ' + parts[1]);
          break;

        case '/part':
          network.writeLine('PART ' + channel.name + ' :');
          break;

        case '/help':
          $scope.irc.getChannel('Idel', 'Status').addLines('status', [
            '/help',
            '.. Show the help text',
            '/connect <name> <host:port> <nick>',
            '.. Connect to a server',
            '/disconnect',
            '.. Disconnect from a server',
            '/join <channel>',
            '.. Join channel',
            '/part',
            '.. Part channel',
            '/quote <line>',
            '.. Send raw text to the server'
          ]);
          break;
        
        case '/quote':
          delete parts[0];
          network.writeLine(parts.join(' '));
          break;
      }
    } else {
      network.writeLine('PRIVMSG ' + channel.name + ' :' + input.message);
      $scope.$broadcast('irc::message', Message(moment().unix(), network.nick, input.message));
    }
  });
  
  $scope.$on('ui::channel-list::select', function (ev, args) {
    $scope.irc.setCurrentChannel(args.network, args.channel);
  });
  
  $scope.minimizeClick = WindowService.minimize;
  $scope.exitClick = function () {
    WindowService.close();
  };
  
  $scope.$watch('settings.theme', function (val) {
    $http.get(val).success(function (theme) {
      less.modifyVars(theme);
    });
  });

  $scope.irc.getChannel('Idel', 'Status').addLine('status', 'Welcome to idel. Type /help to begin.');
});
