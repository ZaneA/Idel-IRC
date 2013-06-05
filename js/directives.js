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
    controller: function ($scope) {
    },
    link: function (scope, element, attrs) {
      scope.networkName = scope.$parent.network.name;
      scope.current = IRCService.current;

      // Select a new channel
      scope.select = function (name) {
        IRCService.current.channel = name;
        IRCService.current.network = scope.$parent.network.name;
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
    controller: function ($scope, $element) {
      $scope.$on('irc::message', function (ev, message) {
        $scope.buffer.push(message);
      });
      
      $scope.$watch('buffer', function () {
        $element.prop('scrollTop', $element.prop('scrollHeight'));
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
    controller: function ($scope) {
    },
    link: function (scope, element, attrs) {
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
    link: function (scope, element, attrs) {
      scope.history = [];

      // Input ALWAYS has keyboard focus
      element.children()[0].onblur = function () {
        this.focus();
      };
      
      element.children()[0].onkeydown = function (ev) {
        if (ev.keyCode == 13 && scope.input.length > 0) { // Enter
          scope.$apply(function () {
            scope.$root.$broadcast('ui::input-box::send', {
              dest: scope.dest,
              message: scope.input
            });
            scope.history.unshift(scope.input);
            scope.input = '';
          });
        }
        
        if (ev.keyCode == 38) { // Up
          scope.$apply(function () {
            scope.input = scope.history.shift();
            if (scope.input)
              scope.history.push(scope.input);
          });
        }

        if (ev.keyCode == 40) { // Down
          scope.$apply(function () {
            scope.input = scope.history.pop();
            if (scope.input)
              scope.history.unshift(scope.input);
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
      var className = 'color-' + (NickColor.get(attrs.colorize) + 1);
      element.addClass(className);
    }
  };
});
