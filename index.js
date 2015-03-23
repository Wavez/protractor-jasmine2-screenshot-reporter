var fs     = require('fs'),
    mkdirp = require('mkdirp'),
    _      = require('lodash'),
    path   = require('path'),
    hat    = require('hat');

var jf = require('jsonfile');

require('string.prototype.startswith');

function Jasmine2ScreenShotReporter(opts) {
    'use strict';

    var suites       = {},   // suite clones
        specs        = {},   // tes spec clones
        runningSuite = null, // currently running suite

        // report marks
        marks = {
            pending:'<span class="pending">~</span>',
            failed: '<span class="failed">&#10007;</span>',
            passed: '<span class="passed">&#10003;</span>'
        };

    // write data into opts.dest as filename
    var writeScreenshot = function (data, filename) {
        var stream = fs.createWriteStream(opts.dest + filename);
        stream.write(new Buffer(data, 'base64'));
        stream.end();
    };

    var writeMetadata = function(data, filename) {
        var stream;

        try {
          stream = fs.createWriteStream(filename);
          stream.write(JSON.stringify(data, null, '\t'));
          stream.end();
        } catch(e) {
          console.error('Couldn\'t save metadata: ' + filename);
        }

    };

    // returns suite clone or creates one
    var getSuiteClone = function(suite) {
      suites[suite.id] = _.extend((suites[suite.id] || {}), suite);
      return suites[suite.id];
    };

    // returns spec clone or creates one
    var getSpecClone = function(spec) {
      specs[spec.id] = _.extend((specs[spec.id] || {}), spec);
      return specs[spec.id];
    };

    // returns duration in seconds
    var getDuration = function(obj) {
        if (!obj._started || !obj._finished) {
            return 0;
        }
        var duration = (obj._finished - obj._started) / 1000;
        return (duration < 1) ? duration : Math.round(duration);
    };

    var pathBuilder = function(spec, suites, capabilities) {
      return hat();
    };

    var metadataBuilder = function(spec, suites, capabilities) {
      return false;
    };

    var isSpecValid = function (spec) {
      // Don't screenshot skipped specs
      var isSkipped = opts.ignoreSkippedSpecs && spec.status === 'pending';
      // Screenshot only for failed specs
      var isIgnored = opts.captureOnlyFailedSpecs && spec.status !== 'failed';

      return !isSkipped && !isIgnored;
    };

    var hasValidSpecs = function (suite) {
      var validSuites = false;
      var validSpecs = false;

      if (suite._suites.length) {
        validSuites = _.any(suite._suites, function(s) {
          return hasValidSpecs(s);
        });
      }

      if (suite._specs.length) {
        validSpecs = _.any(suite._specs, function(s) {
          return isSpecValid(s);
        });
      }

      return validSuites || validSpecs;
    };

    // TODO: more options
    opts          = opts || {};
    opts.dest     = (opts.dest || 'target/screenshots') + '/';
    opts.filename = opts.filename || 'report.html';
    opts.ignoreSkippedSpecs = opts.ignoreSkippedSpecs || false;
    opts.captureOnlyFailedSpecs = opts.captureOnlyFailedSpecs || false;
    opts.pathBuilder = opts.pathBuilder || pathBuilder;
    opts.metadataBuilder = opts.metadataBuilder || metadataBuilder;


    this.jasmineStarted = function() {
        mkdirp(opts.dest, function(err) {
            var files;

            if(err) {
                throw new Error('Could not create directory ' + opts.dest);
            }

            files = fs.readdirSync(opts.dest);

            _.each(files, function(file) {
              var filepath = opts.dest + file;
              if (fs.statSync(filepath).isFile()) {
                fs.unlinkSync(filepath);
              }
            });
        });
    };

    this.suiteStarted = function(suite) {
        suite = getSuiteClone(suite);
        suite._suites = [];
        suite._specs = [];
        suite._started = Date.now();
        suite._parent = runningSuite;

        if (runningSuite) {
            runningSuite._suites.push(suite);
        }

        runningSuite = suite;
    };

    this.suiteDone = function(suite) {
        suite = getSuiteClone(suite);
        suite._finished = Date.now();
        runningSuite = suite._parent;
    };

    this.specStarted = function(spec) {
        spec = getSpecClone(spec);
        spec._started = Date.now();
        spec._suite = runningSuite;
        runningSuite._specs.push(spec);
    };

    this.specDone = function(spec) {
        var file;
        spec = getSpecClone(spec);
        spec._finished = Date.now();

        if (!isSpecValid(spec)) {
          spec.isPrinted = true;
          return;
        }

        file = opts.pathBuilder(spec, suites);
        spec.filename = file + '.png';

        browser.takeScreenshot().then(function (png) {
            browser.getCapabilities().then(function (capabilities) {
                var screenshotPath,
                    metadataPath,
                    metadata;

                screenshotPath = path.join(opts.dest, spec.filename);
                metadata       = opts.metadataBuilder(spec, suites, capabilities);

                if (metadata) {
                    metadataPath = path.join(opts.dest, file + '.json');
                    mkdirp(path.dirname(metadataPath), function(err) {
                        if(err) {
                            throw new Error('Could not create directory for ' + metadataPath);
                        }
                        writeMetadata(metadata, metadataPath);
                    });
                }

                mkdirp(path.dirname(screenshotPath), function(err) {
                    if(err) {
                        throw new Error('Could not create directory for ' + screenshotPath);
                    }
                    writeScreenshot(png, spec.filename);
                });
            });
        });
    };

    this.jasmineDone = function() {
      var output = '<html><head><meta charset="utf-8"><style>body{font-family:Arial;}ul{list-style-position: inside;}.passed{padding: 0 1em;color:green;}.failed{padding: 0 1em;color:red;}.pending{padding: 0 1em;color:red;}</style></head><body>';

        //old combined.js json example
       /* var jsonObj = [
            {
                "description":"will login as Amanda|R&D Serial Amanda",
                "passed":true,
                "os":"Windows NT",
                "browser":{
                    "name":"chrome",
                    "version":"41.0.2272.89"
                },
                "screenShotFile":"00cf0044-00bb-0067-0009-0018001c0086.png"
            },
            {
                "description":"will expect that nodes are healthy|R&D Serial Amanda",
                "passed":true,
                "os":"Windows NT",
                "browser":{
                    "name":"chrome",
                    "version":"41.0.2272.89"
                },
                "message":"Passed.",
                "trace":"Error: Failed expectation\n    at [object Object].<anonymous> (C:\\j\\workspace\\systest-sbe-ui-regression\\al-html\\src\\main\\ng\\test\\e2e\\amanda.spec.js:47:54)\n    at [object Object].jasmine.Block.execute (C:\\Program Files (x86)\\nodejs\\node_modules\\protractor\\node_modules\\minijasminenode\\lib\\jasmine-1.3.1.js:1174:17)\n    at [object Object].jasmine.Queue.next_ (C:\\Program Files (x86)\\nodejs\\node_modules\\protractor\\node_modules\\minijasminenode\\lib\\jasmine-1.3.1.js:2209:31)\n    at [object Object]._onTimeout (C:\\Program Files (x86)\\nodejs\\node_modules\\protractor\\node_modules\\minijasminenode\\lib\\jasmine-1.3.1.js:2199:18)\n    at Timer.listOnTimeout [as ontimeout] (timers.js:112:15)",
                "screenShotFile":"004c003e-0082-00fa-0050-00130031002c.png"
            }];*/



        /*-------------------------------------------------------------------------------------*/
        //creates a json structure similar to protractor-html-screenshot-reporter (combined.json) output

        var testResult = [];

        var jsonFileName = _.trimRight(opts.filename, 'html') + 'json';
        var filePathAndName = opts.dest + jsonFileName;


        _.each(suites, function (suite) {
            _.each(suite._specs, function (spec) {
                var isPassed = (spec.status === "passed") ? true : false;
                testResult.push({
                    "description":spec.description,
                    "passed":isPassed,
                    "screenShotFile":spec.filename,
                    "timeTookMiliSec":spec._finished - spec._started
                });
            });
        });


        jf.writeFile(filePathAndName, testResult, function(err) {
            console.log(err);
        });

        /*-------------------------------------------------------------------------------------*/



      _.each(suites, function(suite) {
        output += printResults(suite);
      });

      // Ideally this shouldn't happen, but some versions of jasmine will allow it
      _.each(specs, function(spec) {
        output += printSpec(spec);
      });

      output += '</body></html>';

      fs.appendFileSync(opts.dest + opts.filename, output, {encoding: 'utf8'}, function(err){
        if(err){
          console.error('Error writing to file:' + opts.dest + opts.filename);
          throw err;
        }
      });
    };

    // TODO: better template

    function printSpec(spec) {
      var suiteName = spec._suite ? spec._suite.fullName : '';
      if (spec.isPrinted) {
        return '';
      }

      spec.isPrinted = true;
      return '<li>' + marks[spec.status] + '<a href="' + encodeURIComponent(spec.filename) + '">' + spec.fullName.replace(suiteName, '').trim() + '</a> (' + getDuration(spec) + ' s)' + printReasonsForFailure(spec) + '</li>';
    }

    // TODO: proper nesting -> no need for magic
    function printResults(suite) {
        var output = '';

        if (suite.isPrinted || !hasValidSpecs(suite)) {
          return '';
        }

        suite.isPrinted = true;

        output += '<ul style="list-style-type:none">';
        output += '<h4>' + suite.fullName + ' (' + getDuration(suite) + ' s)</h4>';

        _.each(suite._specs, function(spec) {
            spec = specs[spec.id];
            output += printSpec(spec);
        });

        if (suite._suites.length) {
            _.each(suite._suites, function(childSuite) {
                output += printResults(childSuite);
            });
        }

        output += '</ul>';

        return output;
    }

    function printReasonsForFailure(spec) {
      if (spec.status !== 'failed') {
        return '';
      }

      var reasons = '<ul>';
      _.each(spec.failedExpectations, function(exp) {
        reasons += '<li>' + exp.message + '</li>';
      });
      reasons += '</ul>';

      return reasons;
    }

    return this;
}

module.exports = Jasmine2ScreenShotReporter;
