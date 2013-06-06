var app = angular.module('IdelApp', []);

app.controller('IdelController', function ($scope, $http, WindowService, SettingsService, IRCService, Message, Network) {
  $scope.settings = SettingsService;
  $scope.irc = IRCService;

  $scope.$on('ui::input-box::send', function (ev, input) {
    var matches = input.message.match(/^\/(\w+\b)*/g);
    if (matches) {
      console.log(matches);
      if (matches[0] == '/help') {
        $scope.irc.getChannel('Idel', 'Status').addLine('status', 'Help:');
      }
    } else {
      $scope.$broadcast('irc::message', Message(moment().unix(), '@zanea', input.message));
    }
  });
  
  $scope.$on('ui::channel-list::select', function (ev, args) {
    $scope.irc.setCurrentChannel(args.network, args.channel);
  });
  
  $scope.minimizeClick = WindowService.minimize;
  $scope.exitClick = WindowService.close;
  
  $scope.$watch('settings.theme', function (val) {
    $http.get(val).success(function (theme) {
      less.modifyVars(theme);
    });
  });

  $scope.irc.getChannel('Idel', 'Status').addLine('status', 'Welcome to idel. Type /help to begin.');
  
  //$scope.irc.connect(Network('Demonastery', ['irc.demonastery.org:6667'], 'zanea'));
});
