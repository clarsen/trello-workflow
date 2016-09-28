var Trello = require("node-trello");
var program = require('commander');
var config = require('./config');

// to get auth token
var t = new Trello(config.appkey, config.authtoken);

program
  .option('-d, --dry-run', "Dry run (don't make changes)")
  .option('-w, --weekly-review', "After weekly review cleanup")
  .option('-t, --today', "Before starting today (also can be done at end of day)")
  .option('--history [WW Month]', "History list to move Done list to")
  .parse(process.argv);

var personal_label = 'blue';
var process_label = 'green';
var work_label = 'yellow';
var periodic_label = 'purple';

var daily, backlog_personal, backlog_work;
var history_board, periodic_board, someday;
var history_this_week;
var inbox, today, done;
var backlog_personal_backlog;
var backlog_work_backlog;
var periodic_often, periodic_weekly, periodic_biweekmonthly;
var periodic_quarteryearly;

var populate_lists = [
  function(next) {
    console.log("Get boards");
    t.get("/1/members/me/boards", function(err, data) {
      if (err) throw err;
      var i;
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Kanban daily/weekly') {
          daily = data[i];
        } else if (data[i].name == 'Backlog (Personal)') {
          backlog_personal = data[i];
          // console.log(data[i]);
        } else if (data[i].name == 'Backlog (work)') {
          backlog_work = data[i];
        } else if (data[i].name == 'History 2016') {
          history_board = data[i];
        } else if (data[i].name == 'Periodic board') {
          periodic_board = data[i];
        } else if (data[i].name == 'Someday/Maybe') {
          someday = data[i];
        // } else if (data[i].name != '') {
          // console.log(data[i]);
        }
      }
      next();
    });
  },
  function(next) {
    console.log("Get lists from Kanban daily board");
    // console.log(daily);
    // console.log(daily.id);
    t.get("/1/boards/" + daily.id  + "/lists", function(err, data) {
      if (err) throw err;
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Inbox') {
          inbox = data[i];
        } else if (data[i].name == 'Today') {
          today = data[i];
        } else if (data[i].name == 'Done this week') {
          done = data[i];
        // } else {
        //   console.log(data[i]);
        }
      }
      next();
    });
  },
  function(next) {
    if (!program.history) {
      return next();
    }
    console.log("Get lists from history board");
    // console.log(daily);
    // console.log(daily.id);
    t.get("/1/boards/" + history_board.id  + "/lists", function(err, data) {
      if (err) throw err;
      for (i = 0; i < data.length; i++) {
        if (data[i].name == program.history) {
          history_this_week = data[i];
        }
      }
      if (!history_this_week) {
        console.log("couldn't find list " + program.history
                    + " in history board" );
        process.exit(-1);
      }
      next();
    });
  },
  function(next) {
    console.log("Get lists from periodic board");
    // console.log(daily);
    // console.log(daily.id);
    t.get("/1/boards/" + periodic_board.id  + "/lists", function(err, data) {
      if (err) throw err;
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Often') {
          periodic_often = data[i];
        } else if (data[i].name == 'Weekly') {
          periodic_weekly = data[i];
        } else if (data[i].name == 'Bi-weekly to monthly') {
          periodic_biweekmonthly = data[i];
        } else if (data[i].name == 'Quarterly to Yearly') {
          periodic_quarteryearly = data[i];
        // } else {
        //  console.log(data[i]);
        }
      }
      next();
    });
  },
  function(next) {
    console.log("Get lists from Backlog(personal)");
    t.get("/1/boards/" + backlog_personal.id  + "/lists", function(err, data) {
      if (err) throw err;
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Backlog') {
          backlog_personal_backlog = data[i];
        }
      }
      next();
    });
  },
  function(next) {
    console.log("Get lists from Backlog(work)");
    t.get("/1/boards/" + backlog_work.id  + "/lists", function(err, data) {
      if (err) throw err;
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Backlog') {
          backlog_work_backlog = data[i];
        }
      }
      next();
    });
  },
];

var run_next_function = function(next) {
  if (populate_lists.length > 0) {
    f = populate_lists.shift();
    f(function() {
        run_next_function(next);
      });
  } else {
    next();
  }
}

var card_has_label = function(card, color) {
  for (var i = 0; i < card.labels.length; i++) {
    if (card.labels[i].color == color) {
      return true;
    }
  }
  return false;
}

var movePeriodic = function(card) {
  var board = periodic_board;
  var list = null;
  if (card.name.includes('(po)')) {
    console.log("would move " + card.name + " to often list");
    list = periodic_often;
  } else if (card.name.includes('(p1w)')) {
    console.log("would move " + card.name + " to weekly list");
    list = periodic_weekly;
  } else if (card.name.includes('(p2w)')) {
    console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  } else if (card.name.includes('(p4w)')) {
    console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  }
  if (board && list) {
    tidy_lists.push(moveCard(card, board, list, 'top'));
  }

}

var copyCard = function(card, board, list, pos) {
  var todo = function(next) {
    var options = {"idList": list.id,
                   "idCardSource": card.id,
                   "pos": "top",
                  };
    console.log("would copy " + card.name + " to "
                + board.name + " list " + list.name + JSON.stringify(options)
              );
    if (program.dryRun) {
      return next();
    }
    t.post("/1/cards", options, function(err, data) {
      if (err) throw err;
      next();
    });
  };
  return todo;
};

var copyBackPeriodic = function(card) {
  var board = periodic_board;
  var list = null;
  if (card.name.includes('(po)')) {
    console.log("would copy " + card.name + " to often list");
    list = periodic_often;
  } else if (card.name.includes('(p1w)')) {
    console.log("would copy " + card.name + " to weekly list");
    list = periodic_weekly;
  } else if (card.name.includes('(p2w)')) {
    console.log("would copy " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  } else if (card.name.includes('(p4w)')) {
    console.log("would copy " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  } else if (card.name.includes('(p3m)')) {
    console.log("would copy " + card.name + " to quarterly/yearly list");
    list = periodic_quarteryearly;
  }
  if (board && list) {
    tidy_lists.push(copyCard(card, board, list, 'top'));
  }
}


var moveCard = function(card, board, list, pos) {
  var todo = function(next) {

    if (program.dryRun) {
      // DEBUG: don't execute the PUT
      console.log("would move " + card.name + " to " + board.name
                  + " list " + list.name);
      return next();
    } else {
      // console.log("PUT " + "/1/cards/" + card.id +
      //          JSON.stringify({
      //            idBoard: board.id,
      //            idList: list.id,
      //            pos: pos
      //          }));
    }

    t.put("/1/cards/" + card.id,
          {
            idBoard: board.id,
            idList: list.id,
            pos: pos
          }, function(err,data) {
              if (err) throw err;
              console.log(data);
              next();
          });
  };
  return todo;
};

var tidy_lists = [
  function(next) {
    if (!program.today) {
      return next();
    }
    console.log("move items from Inbox to backlog based on label color");
    t.get("/1/lists/" + inbox.id + "/cards", function(err, data) {
      if (err) throw err;

      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        var board = null, list = null;
        if (card_has_label(data[i],personal_label)) {
          console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],process_label)) {
          console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],work_label)) {
          console.log("move to Backlog (work)/Backlog");
          board = backlog_work;
          list = backlog_work_backlog;
        }
        if (board && list) {
          tidy_lists.push(moveCard(data[i], board, list, 'top'));
        }
      }
      next();
    });
  },
  function(next) {
    if (!program.today) {
      return next();
    }
    console.log("move items from Today to backlog based on label color");
    t.get("/1/lists/" + today.id + "/cards", function(err, data) {
      if (err) throw err;

      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        var board = null, list = null;
        if (card_has_label(data[i], periodic_label)) {
          console.log("would move periodic");
          movePeriodic(data[i]);

        } else if (card_has_label(data[i],personal_label)) {
          console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],process_label)) {
          console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],work_label)) {
          console.log("move to Backlog (work)/Backlog");
          board = backlog_work;
          list = backlog_work_backlog;
        }
        if (board && list) {
          tidy_lists.push(moveCard(data[i], board, list, 'top'));
        }
      }
      next();
    });
  },
  function(next) {
    if (!program.weeklyReview) {
      return next();
    }
    console.log("copy periodic items from Done to periodic board lists");
    t.get("/1/lists/" + done.id + "/cards", function(err, data) {
      if (err) throw err;
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], periodic_label)) {
          console.log("would copy periodic");
          copyBackPeriodic(data[i]);
        }
      }
      next();
    });
  },
  function(next) {
    if (!program.weeklyReview) {
      return next();
    }
    console.log("move all items from Done to history list");
    t.get("/1/lists/" + done.id + "/cards", function(err, data) {
      if (err) throw err;
      for (i = 0; i < data.length; i++) {
          console.log("would move to history");
          tidy_lists.push(moveCard(data[i], history_board,
                          history_this_week, "bottom"));
      }
      next();
    });

  }
];

var run_next_tidy_function = function(next) {
  if (tidy_lists.length > 0) {
    f = tidy_lists.shift();
    f(function() {
        run_next_tidy_function(next);
      });
  } else {
    next();
  }
}

run_next_function(function() {
  run_next_tidy_function(function() {
    console.log("Done");
  });
});
