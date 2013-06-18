'use strict';

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
      $scope.networkName = $scope.$parent.network.name;
      $scope.current = IRCService.current;
      $scope.selected = function (channel) {
        return $scope.current.network == $scope.networkName && $scope.current.channel == channel.name;
      };

      // Select a new channel
      $scope.select = function (name) {
        IRCService.setCurrentChannel($scope.$parent.network.name, name);
      };
    }
  };
});

app.directive('chatWindow', function () {
  return {
    templateUrl: 'js/templates/chatWindow.html',
    restrict: 'E',
    scope: {
      channel: '=for'
    },
    controller: function ($scope, $element, $timeout) {
      // Scroll to bottom.
      $scope.$watch('channel', function () {
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
      channel: '=for'
    },
    controller: function ($rootScope, $scope) {
      // Select a nick
      $scope.select = function (name) {
        $rootScope.$broadcast('ui::nick-list::select', { nick: name });
      };
    }
  };
});

app.directive('inputBox', function (InputService) {
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

      $element.children()[0].onblur = function (ev) {
        this.focus();
      };

      $element.children()[0].onkeydown = function (ev) {
        if (ev.keyIdentifier == 'F5') { // Refresh User CSS
          $rootScope.$broadcast('ui::refresh-style');
          $rootScope.$apply();
        }

        if (ev.ctrlKey && ev.keyCode == 9) {
          if (ev.shiftKey) {
            InputService.jumpChannel(-1, true); // Relative
          } else {
            InputService.jumpChannel(+1, true); // Relative
          }

          return;
        }
        
        if (ev.altKey && ev.keyCode >= 48 && ev.keyCode <= 57) {
          var code = ev.keyCode;
          if (code == 48) code = 58;
          InputService.jumpChannel(ev.keyCode - 49);

          return;
        }
        
        if (ev.keyCode == 9 && $scope.input.length > 0) { // Tab
          $scope.$apply(function () {
            $scope.input = InputService.autocomplete($scope.input);
          });
          
          return;
        }

        if (ev.keyCode == 13 && $scope.input.length > 0) { // Enter
          $scope.$apply(function () {
            $rootScope.$broadcast('ui::input-box::send', {
              dest: $scope.dest,
              message: $scope.input
            });
            $scope.history.unshift($scope.input);
            $scope.input = '';
          });

          return;
        }
        
        if (ev.keyCode == 38) { // Up
          $scope.$apply(function () {
            $scope.input = $scope.history.shift();
            if ($scope.input)
              $scope.history.push($scope.input);
          });

          return;
        }

        if (ev.keyCode == 40) { // Down
          $scope.$apply(function () {
            $scope.input = $scope.history.pop();
            if ($scope.input)
              $scope.history.unshift($scope.input);
          });

          return;
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

app.directive('modalDialog', function () {
  return {
    restrict: 'E',
    replace: 'true',
    template: '<div class="modal" data-ng-show="modal.template != \'\'" data-ng-animate="{show: \'slide-show\', hide: \'slide-hide\' }" data-ng-include="modal.template"></div>',
    controller: function ($scope, ModalService) {
      $scope.modal = ModalService;

      $scope.close = function () {
        $scope.modal.template = '';
      };
    }
  };
});
