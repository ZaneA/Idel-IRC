var app = angular.module('IdelApp', []);

app.controller('IdelController', function ($scope, $http, WindowService, SettingsService, IRCService, InputService, Nick) {
  $scope.settings = SettingsService;
  $scope.irc = IRCService;

  $scope.$on('ui::input-box::send', function (ev, input) {
    InputService.parse(input.message);
  });
  
  $scope.$on('ui::channel-list::select', function (ev, args) {
    $scope.irc.setCurrentChannel(args.network, args.channel);
  });
  
  $scope.minimizeClick = WindowService.minimize;
  $scope.exitClick = function () {
    // Disconnect from networks
    WindowService.close();
  };
  
  $scope.$watch('settings.theme', function (val) {
    $http.get(val).success(function (theme) {
      less.modifyVars(theme);
    });
  });

  $scope.irc.getStatusChannel().addLine(Nick('status'), 'Welcome to idel. Type /help to begin.');
});
