'use strict';

var app = angular.module('IdelApp', []);

app.controller('IdelController', function ($scope, $http, PortService, SettingsService, IRCService, InputService, ColorService) {
  $scope.settings = SettingsService;
  $scope.irc = IRCService;
  $scope.port = PortService;

  $scope.$on('ui::input-box::send', function (ev, input) {
    InputService.parse(input.message);
  });
  
  $scope.$on('ui::channel-list::select', function (ev, args) {
    $scope.irc.setCurrentChannel(args.network, args.channel);
  });
  
  $scope.$watch('settings.theme', function (val) {
    $http.get(val).success(function (theme) {
      less.modifyVars(theme);
    });
  });

  $scope.irc.getStatusChannel().topic = _.str.sprintf('Welcome to %sidel IRC%s, type %s/help%s to begin.',
                                                      ColorService._white, ColorService.reset,
                                                      ColorService.green, ColorService.reset);
});
