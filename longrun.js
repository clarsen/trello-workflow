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

    var morningjob = new CronJob({
      cronTime: '0 30 21 * * *',
      onTick: function() {
        /*
         * Runs every day 4:00:30am.
         */
         console.log("every day 9:30:00pm");
         async.series([
           function(cb) {
             tops.preparetoday(cb);
           },
           function(cb) {
             tops.commit(cb);
           },
         ])
      },
      start: false,
      timeZone: 'America/Los_Angeles'
    });
    morningjob.start();
  },
]);
