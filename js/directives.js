app.directive('networkList', function () {
  return {
    templateUrl: 'js/templates/networkList.html',
    restrict: 'E',
    scope: {
      networks: '=for'
    },
    controller: function ($scope) {
    },
    link: function (scope, element, attrs) {
    }
  };
});

app.directive('channelList', function (IRCService) {
  return {
    templateUrl: 'js/templates/channelList.html',
    restrict: 'E',
    scope: {
      channels: '=for'
    },
    controller: function ($rootScope, $scope) {
      $scope.networkName = $scope.$parent.network.name;
      $scope.current = IRCService.current;

      // Select a new channel
      $scope.select = function (name) {
        $rootScope.$broadcast('ui::channel-list::select', {
          channel: name,
          network: $scope.$parent.network.name
        });
      };
    }
  };
});

app.directive('chatWindow', function () {
  return {
    templateUrl: 'js/templates/chatWindow.html',
    restrict: 'E',
    scope: {
      buffer: '=for'
    },
    controller: function ($scope, $element, $timeout) {
      $scope.$on('irc::message', function (ev, message) {
        $scope.buffer.push(message);
      });
      
      // Scroll to bottom.
      $scope.$watch('buffer', function () {
        $timeout(function () {
          $element.prop('scrollTop', $element.prop('scrollHeight'));
        },0);
      }, true);
    },
    link: function (scope, element, attrs) {
    }
  };
});

app.directive('nickList', function () {
  return {
    templateUrl: 'js/templates/nickList.html',
    restrict: 'E',
    scope: {
      nicks: '=for'
    },
    controller: function ($rootScope, $scope) {
      // Select a nick
      $scope.select = function (name) {
        $rootScope.$broadcast('ui::nick-list::select', { nick: name });
      };
    }
  };
});

app.directive('inputBox', function () {
  return {
    templateUrl: 'js/templates/inputBox.html',
    restrict: 'E',
    scope: {
      dest: '=for'
    },
    controller: function ($rootScope, $scope, $element) {
      $scope.history = [];
      $scope.input = '';

      $scope.$on('ui::nick-list::select', function (ev, args) {
        $scope.input += args.nick + ', ';
      });

      $element.children()[1].onkeydown = function (ev) {
        if (ev.keyCode == 13 && $scope.input.length > 0) { // Enter
          $scope.$apply(function () {
            $rootScope.$broadcast('ui::input-box::send', {
              dest: $scope.dest,
              message: $scope.input
            });
            $scope.history.unshift($scope.input);
            $scope.input = '';
          });
        }
        
        if (ev.keyCode == 38) { // Up
          $scope.$apply(function () {
            $scope.input = $scope.history.shift();
            if ($scope.input)
              $scope.history.push($scope.input);
          });
        }

        if (ev.keyCode == 40) { // Down
          $scope.$apply(function () {
            $scope.input = $scope.history.pop();
            if ($scope.input)
              $scope.history.unshift($scope.input);
          });
        }
      };
    }
  };
});

// Colorize nicknames
app.directive('colorize', function (NickColor) {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var className = 'color-' + (NickColor.get(scope.$eval(attrs.colorize)) + 1);
      element.addClass(className);
    }
  };
});

app.directive('editableLabel', function () {
  return {
    restrict: 'E',
    templateUrl: 'js/templates/editableLabel.html',
    scope: {
      model: '=model'
    },
    link: function (scope, element, attrs) {
      scope.editing = false;
    }
  };
});
