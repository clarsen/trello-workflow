require('dotenv').config();
var CronJob = require('cron').CronJob;
// var Trello = require("node-trello");
var tops = require('./trello-ops');
var async = require('async');

async.series([
  function(cb) {
    tops.init(false, // not dryRun mode
      function() {
        console.log("did tops.initBoards()");
        cb();
      });
  },
  function(cb) {
    var job = new CronJob({
      cronTime: '0 * * * * *',
      onTick: function() {
        /*
         * Runs every minute.
         */
         console.log("every minute");
         async.series([
           function(cb) {
             tops.maintenance(cb);
           },
           function(cb) {
             tops.commit(cb);
           },
         ])
      },
      start: false,
      timeZone: 'America/Los_Angeles'
    });
    job.start();
  },
]);
