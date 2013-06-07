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
        case '/help':
          $scope.irc.getChannel('Idel', 'Status').addLines('status', [
            'Help:',
            '/help',
            '.. Show the help text',
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
  
  var network = Network({
    name: 'Demonastery',
    servers: ['irc.demonastery.org:6667'],
    nick: 'testclient',
    joinChannels: ['#Bottest']
  });

  $scope.irc.networks.push(network);
  
  network.connect();
});
