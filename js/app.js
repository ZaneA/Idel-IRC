var app = angular.module('IdelApp', []);

app.controller('IdelController', function ($scope, IRCService, Message) {
  $scope.irc = IRCService;

  $scope.$on('ui::input-box::send', function (ev, input) {
    var matches = input.message.match(/^\/(\w+\b)*/g);
    if (matches) {
      console.log(matches);
    } else {
      $scope.$broadcast('irc::message', Message(moment().unix(), '@zanea', input.message));
    }
  });
  
  $scope.minimize = function () {
    chrome.app.window.current().minimize();
  };
  
  $scope.exit = function () {
    window.close();
  };
});
