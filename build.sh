#!/bin/bash
zip -9 -xports/chrome/manifest.json -r idel.zip manifest.json LICENSE main.html themes ports/chrome components/{angular-unstable/angular.min.js,less.js/dist/less-1.4.0-beta.min.js,lodash/dist/lodash.min.js,moment/min/moment.min.js,underscore.string/dist/underscore.string.min.js} layouts css js assets
