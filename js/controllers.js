app.controller('ConnectController', function ($scope, $http, IRCService, Network, Nick) {
  // Connect Button
  $scope.connect = function () {
    var network = Network({
      name: $scope.name,
      servers: [$scope.url],
      nick: Nick($scope.nick),
      joinChannels: []
    });

    IRCService.networks.push(network);

    network.connect();
  };

  $scope.$watch('theme', function (val) {
    if (!val) return;
    $http.get(val).success(function (theme) {
      less.modifyVars(theme);
    });
  });
});
