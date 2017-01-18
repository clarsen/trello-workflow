var Trello = require("node-trello");
var program = require('commander');
var dateFormat = require('dateformat');
var Table = require('cli-table');
var querystring = require("querystring");
require('dotenv').config();
var tops = require('./trello-ops');

var would_move_summary = new Table({ head: ["", "Items"]});
var move_destination = {};

var async = require('async');

var would_move = function(item,dest) {
  if (!(dest in move_destination)) {
    move_destination[dest] = [];
  }
  move_destination[dest].push(item);
}
var would_move_to_list = function(item, board, list) {
  dest = board.name + " - " + list.name;
  if (!(dest in move_destination)) {
    move_destination[dest] = [];
  }
  move_destination[dest].push(item);
}

var would_copy_summary = new Table({ head: ["", "Items"]});
var copy_destination = {};
var would_copy_to_list = function(item, board, list) {
  dest = board.name + " - " + list.name;
  if (!(dest in copy_destination)) {
    copy_destination[dest] = [];
  }
  copy_destination[dest].push(item);
}

var summarize_changes = function() {

  for (var dest in move_destination) {
    var d = {};
    d[dest] = move_destination[dest].join('\n');
    would_move_summary.push(d);
  }
  if (would_move_summary.length > 0) {
    console.log("would move items to:")
    console.log(would_move_summary.toString());
  } else {
    console.log("No changes");
  }

  for (var dest in copy_destination) {
    var d = {};
    d[dest] = copy_destination[dest].join('\n');
    would_copy_summary.push(d);
  }
  if (would_copy_summary.length > 0) {
    console.log("would copy items to:")
    console.log(would_copy_summary.toString());
  } else {
    console.log("No changes");
  }
}

// to get auth token
var t = new Trello(process.env.appkey, process.env.authtoken);

program
  .option('-d, --dry-run', "Dry run (don't make changes)")
  .option('--weekly-report', "Report on when items were moved into Done list (grouped by day of week)")
  .option('-w, --weekly-review [WW Month]', "After weekly review cleanup, history list to move Done list to")
  .option('-t, --today', "Before starting today (also can be done at end of day)")
  .option('-c, --cherry-pick', "move cards labeled 'orange' from lists into Today")
  .option('-m, --maintenance', "Periodically, add creation dates to titles, etc.")
  .option('--monthly-review [Month]', "After monthly review cleanup")
  .option('--watch', "watch boards")
  .parse(process.argv);

var periodic_label = 'purple';

var history_this_week, history_this_week_goals;
var history_this_month_goals, history_this_month_sprints;

var cardops = [];

var week_summary = new Table({ head: ["Date", "Items"]});
var day_summary = {};

var note_completed = function(item) {
  day = dateFormat(item.dateLastActivity, "yyyy-mm-dd ddd");
  console.log("day " + day + " item " + item.name);
  if (!(day in day_summary)) {
    day_summary[day] = [];
  }
  day_summary[day].push(item.name);
}

var summarize_week = function() {
  var keys = Object.keys(day_summary).sort();

  for (var i in keys) {
    var dest = keys[i];
    var d = {};
    d[dest] = day_summary[dest].join('\n');
    week_summary.push(d);
  }
  if (week_summary.length > 0) {
    console.log("Completed this week")
    console.log(week_summary.toString());
  } else {
    console.log("No items completed");
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

var card_has_date = function(card) {
  if (card.name.search(/\(\d{4}-\d{2}-\d{2}\)/) >= 0) {
    return true;
  }
  return false;
}

var card_has_periodic = function(card) {
  if (card.name.search(/\((po|p1w|p2w|p4w|p12m)\)/) >= 0) {
    return true;
  }
  return false;
}

var movePeriodic = function(card) {
  var board = tops.boards.periodic_board;
  var list = null;
  if (card.name.includes('(po)')) {
    // console.log("would move " + card.name + " to often list");
    list = tops.lists.periodic.often;
  } else if (card.name.includes('(p1w)')) {
    // console.log("would move " + card.name + " to weekly list");
    list = tops.lists.periodic.weekly;
  } else if (card.name.includes('(p2w)')) {
    // console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = tops.lists.periodic.biweekmonthly;
  } else if (card.name.includes('(p4w)')) {
    // console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = tops.lists.periodic.biweekmonthly;
  } else if (card.name.includes('(p2m)')) {
    list = tops.lists.periodic.quarteryearly;
  } else if (card.name.includes('(p3m)')) {
    list = tops.lists.periodic.quarteryearly;
  } else if (card.name.includes('(p12m)')) {
    list = tops.lists.periodic.quarteryearly;
  }
  if (board && list) {
    would_move_to_list(card.name, board, list);
    cardops.push(moveCard(card, board, list, 'top'));
  }

}

var updateCardName = function(card) {
  var todo = function(next) {
    var options = {"value": card.name };
    t.put("/1/cards/" + card.id + '/name', options, function(err, data) {
      if (err) throw err;
      console.log("updated name to " + card.name);
      next();
    });
  }
  return todo;
}

var copyCard = function(card, board, list, pos) {
  var todo = function(next) {
    var options = {"idList": list.id,
                   "idCardSource": card.id,
                   "pos": "top",
                  };
    // console.log("would copy " + card.name + " to "
    //             + board.name + " list " + list.name + JSON.stringify(options)
    //           );
    if (program.dryRun) {
      return next();
    }
    t.post("/1/cards", options, function(err, data) {
      if (err) throw err;
      console.log("copied " + card.name + " to " + board.name
                  + " list " + list.name);
      next();
    });
  };
  return todo;
};

var addDateToName = function(card) {
  var dt = new Date(card.dateLastActivity);
  var dts = dateFormat(dt, "(yyyy-mm-dd)");
  if (program.dryRun) {
    console.log("would add " + dts + " to " + card.name);
  } else {
    console.log("adding " + dts + " to " + card.name);
    card.name = card.name + " " + dts;
    // tidy_lists.push(updateCardName(card));
    cardops.push(updateCardName(card));
  }
}

var removeLabel = function(card, labelname) {
  var todo = function(next) {
    if (program.dryRun) {
      // DEBUG: don't execute the PUT
      console.log("would remove label " + labelname + " from " + card.name);

      var label = null;
      for (var i = 0; i < card.labels.length; i++) {
        console.log(card.labels[i]);
        if (card.labels[i].color == labelname) {
          label = card.labels[i];
        }
      }
      console.log("DELETE " + "/1/cards/" + card.id + "/idLabels/" + label.id);
      return next();
    }
    var label = null;
    for (var i = 0; i < card.labels.length; i++) {
      // console.log(card.labels[i]);
      if (card.labels[i].color == labelname) {
        label = card.labels[i];
      }
    }
    if (label) {
      // with_auth = "/1/cards/" + card.id + "/idLabels/" + label.id;
      // with_auth += "?" + querystring.stringify(t.addAuthArgs(t.parseQuery(with_auth, {})));
      // console.log(with_auth);

      t.del("/1/cards/" + card.id + "/idLabels/" + label.id, function(err,data) {
              if (err) throw err;
              console.log("removed label " + label.color + " from " + card.name);
              next();
            });
    } else {
      next();
    }
  };
  return todo;
}

var moveCardAndRemoveLabel = function(card, board, list, pos, label) {
  var todo = function(next) {

    if (program.dryRun) {
      // DEBUG: don't execute the PUT
      // console.log("would move " + card.name + " to " + board.name
      //             + " list " + list.name);
      would_move_to_list(card.name, board, list);
      return next();
    } else {
      // console.log("PUT " + "/1/cards/" + card.id +
      //          JSON.stringify({a
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
              console.log("moved " + card.name + " to " + board.name
                          + " list " + list.name);
              // console.log("got " + JSON.stringify(data));
              async.series([ removeLabel(data, label) ]);
              next();
          });
  };
  return todo;
}

var moveCard = function(card, board, list, pos) {
  var todo = function(next) {

    if (program.dryRun) {
      // DEBUG: don't execute the PUT
      // console.log("would move " + card.name + " to " + board.name
      //             + " list " + list.name);
      would_move_to_list(card.name, board, list);
      return next();
    } else {
      // console.log("PUT " + "/1/cards/" + card.id +
      //          JSON.stringify({a
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
              console.log("moved " + card.name + " to " + board.name
                          + " list " + list.name);
              next();
          });
  };
  return todo;
};

/// =====================================================================
/// =====================================================================
/// =====================================================================


async.series([
  function(cb) {
    tops.init(program.dryRun,
      function() {
        console.log("did tops.initBoards()");
        cb();
      });
  },
  function(cb) {
    if (!program.weeklyReview && !program.monthlyReview) {
      return cb(null);
    }
    console.log("Get lists from history board");
    // console.log(daily);
    // console.log(daily.id);
    t.get("/1/boards/" + tops.boards.history_board.id  + "/lists", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        if (data[i].name == program.weeklyReview) {
          history_this_week = data[i];
        }
        if (data[i].name == program.weeklyReview + " goals") {
          history_this_week_goals = data[i];
        }
        if (data[i].name == program.monthlyReview + " goals") {
          history_this_month_goals = data[i];
        }
        if (data[i].name == program.monthlyReview + " sprints") {
          history_this_month_sprints = data[i];
        }
      }
      if (program.weeklyReview && (!history_this_week
                                   || !history_this_week_goals)) {
        console.log("couldn't find goals/tasks lists for " + program.weeklyReview
                    + " in history board" );
        process.exit(-1);
      }
      if (program.monthlyReview && (!history_this_month_goals
                                    || !history_this_month_sprints)) {
        console.log("couldn't find goals/sprints lists for " + program.monthlyReview
                    + " in history board" );
        process.exit(-1);
      }
      cb(null);
    });
  },
  function(cb) {
    if (!program.maintenance) {
      return cb(null);
    }
    tops.maintenance(cb);
  },


  function(cb) {
    if (!program.today) {
      return cb(null);
    }
    tops.preparetoday(cb);
  },

  function(cb) {
    if (!program.weeklyReport) {
      return cb(null);
    }
    console.log("report on items in Done list");
    t.get("/1/lists/" + tops.lists.done.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        console.log(data[i].dateLastActivity);
        note_completed(data[i]);
        // if (card_has_label(data[i], periodic_label)) {
        //   console.log("would copy periodic");
        //   copyBackPeriodic(data[i]);
        // }
      }
      summarize_week();
      cb(null);
    });
  },
  function(cb) {
    if (!program.weeklyReview) {
      return cb(null);
    }
    console.log("copy periodic items, move other items from Done to history lists");
    t.get("/1/lists/" + tops.lists.done.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        if (card_has_label(data[i], periodic_label)) {
          would_copy_to_list(data[i].name, tops.boards.history_board,
            history_this_week, "bottom");
          cardops.push(copyCard(data[i], tops.boards.history_board,
                       history_this_week, "bottom"));
        } else {
          would_move_to_list(data[i].name, tops.boards.history_board,
            history_this_week, "bottom");
          cardops.push(moveCard(data[i], tops.boards.history_board,
                       history_this_week, "bottom"));

        }
      }
      cb(null);
    });
  },
  function(cb) {
    if (!program.weeklyReview) {
      return cb(null);
    }
    console.log("move all items from Done to appropriate periodic board list");
    t.get("/1/lists/" + tops.lists.done.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
          // console.log("would move to periodic list");
          movePeriodic(data[i]);
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.weeklyReview) {
      return cb(null);
    }
    console.log("copy all items (snapshot) from Monthly goals to history list");
    t.get("/1/lists/" + tops.lists.monthly_goals.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
          would_copy_to_list(data[i].name, tops.boards.history_board, history_this_week_goals);
          cardops.push(copyCard(data[i], tops.boards.history_board,
                       history_this_week_goals, "bottom"));
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.monthlyReview) {
      return cb(null);
    }
    console.log("copy all items from Monthly sprints to history monthly sprints list");
    t.get("/1/lists/" + tops.lists.monthly_sprints.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
          // console.log("would move to history");
          would_copy_to_list(data[i].name, tops.boards.history_board, history_this_month_sprints);
          cardops.push(copyCard(data[i], tops.boards.history_board,
                       history_this_month_sprints, "bottom"));
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.monthlyReview) {
      return cb(null);
    }
    console.log("copy all items from Monthly goals to history monthly goals list");
    t.get("/1/lists/" + tops.lists.monthly_goals.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
          // console.log("would move to history");
          would_copy_to_list(data[i].name, tops.boards.history_board, history_this_month_goals);
          cardops.push(copyCard(data[i], tops.boards.history_board,
                       history_this_month_goals, "bottom"));
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.watch) {
      return cb(null);
    }
    console.log("(re)setting up webhooks");
    t.post("/1/webhooks",
        {
          callbackURL: process.env.TRELLO_HOOK_URL,
          idModel: inbox.id,
        }, function(err, data) {
          if (err) return cb(err);
          console.log(data);
          cb(null);
        });
  },
  function(cb) {
    // summarize
    summarize_changes();
    tops.summarize_changes();
    cb(null);
  },
  function(cb) {
    tops.commit(cb);
  },
  // execute any operations that have been queued up.
  function(cb) {
    if (cardops.length > 0) {
      async.series(cardops, cb);
    } else {
      cb(null);
    }
  }
]);
