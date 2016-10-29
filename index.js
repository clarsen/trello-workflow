var Trello = require("node-trello");
var program = require('commander');
var dateFormat = require('dateformat');
var Table = require('cli-table');
var querystring = require("querystring");
require('dotenv').config();

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
  .option('-w, --weekly-review', "After weekly review cleanup")
  .option('-t, --today', "Before starting today (also can be done at end of day)")
  .option('-c, --cherry-pick', "move cards labeled 'orange' from lists into Today")
  .option('-m, --maintenance', "Periodically, add creation dates to titles, etc.")
  .option('--watch', "watch boards")
  .option('--history [WW Month]', "History list to move Done list to")
  .parse(process.argv);

var personal_label = 'blue';
var process_label = 'green';
var work_label = 'yellow';
var periodic_label = 'purple';
var cherry_pick_label = 'orange';

var daily, backlog_personal, backlog_work;
var history_board, periodic_board, someday;
var history_this_week;
var inbox, today, done;
var backlog_personal_backlog;
var backlog_work_backlog;
var periodic_often, periodic_weekly, periodic_biweekmonthly;
var periodic_quarteryearly;

var cardops = [];

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
  var board = periodic_board;
  var list = null;
  if (card.name.includes('(po)')) {
    // console.log("would move " + card.name + " to often list");
    list = periodic_often;
  } else if (card.name.includes('(p1w)')) {
    // console.log("would move " + card.name + " to weekly list");
    list = periodic_weekly;
  } else if (card.name.includes('(p2w)')) {
    // console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  } else if (card.name.includes('(p4w)')) {
    // console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  } else if (card.name.includes('(p3m)')) {
    list = periodic_quarteryearly;
  } else if (card.name.includes('(p12m)')) {
    list = periodic_quarteryearly;
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

var copyBackPeriodic = function(card) {
  var board = periodic_board;
  var list = null;
  if (card.name.includes('(po)')) {
    // console.log("would copy " + card.name + " to often list");
    list = periodic_often;
  } else if (card.name.includes('(p1w)')) {
    // console.log("would copy " + card.name + " to weekly list");
    list = periodic_weekly;
  } else if (card.name.includes('(p2w)')) {
    // console.log("would copy " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  } else if (card.name.includes('(p4w)')) {
    // console.log("would copy " + card.name + " to bi-weekly/monthly list");
    list = periodic_biweekmonthly;
  } else if (card.name.includes('(p3m)')) {
    // console.log("would copy " + card.name + " to quarterly/yearly list");
    list = periodic_quarteryearly;
  } else if (card.name.includes('(p12m)')) {
    // console.log("would copy " + card.name + " to quarterly/yearly list");
    list = periodic_quarteryearly;
  }
  if (board && list) {
    would_copy_to_list(card.name, board, list);
    cardops.push(copyCard(card, board, list, 'top'));
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
    console.log("Get boards");
    t.get("/1/members/me/boards", function(err, data) {
      if (err) return cb(err);
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
      cb(null);
    });
  },
  function(cb) {
    console.log("Get lists from Kanban daily board");
    // console.log(daily);
    // console.log(daily.id);
    t.get("/1/boards/" + daily.id  + "/lists", function(err, data) {
      if (err) return cb(err);
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
      cb(null);
    });
  },
  function(cb) {
    if (!program.history) {
      return cb(null);
    }
    console.log("Get lists from history board");
    // console.log(daily);
    // console.log(daily.id);
    t.get("/1/boards/" + history_board.id  + "/lists", function(err, data) {
      if (err) return cb(err);
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
      cb(null);
    });
  },
  function(cb) {
    console.log("Get lists from periodic board");
    // console.log(daily);
    // console.log(daily.id);
    t.get("/1/boards/" + periodic_board.id  + "/lists", function(err, data) {
      if (err) return cb(err);
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
      cb(null);
    });
  },
  function(cb) {
    console.log("Get lists from Backlog(personal)");
    t.get("/1/boards/" + backlog_personal.id  + "/lists", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Backlog') {
          backlog_personal_backlog = data[i];
        }
      }
      cb(null);
    });
  },
  function(cb) {
    console.log("Get lists from Backlog(work)");
    t.get("/1/boards/" + backlog_work.id  + "/lists", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Backlog') {
          backlog_work_backlog = data[i];
        }
      }
      cb(null);
    });
  },
  function(cb) {
    if (!program.maintenance) {
      return cb(null);
    }
    console.log("add creation date to title (if doesn't exist)");
    t.get("/1/lists/" + inbox.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (!card_has_date(data[i]) && !card_has_periodic(data[i])) {
          addDateToName(data[i]);
        }
      }
      cb(null);
    });
  },
  function(cb) {
    if (!program.maintenance) {
      return cb(null);
    }
    console.log("add creation date to title (if doesn't exist)");
    t.get("/1/lists/" + today.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (!card_has_date(data[i]) && !card_has_periodic(data[i])) {
          addDateToName(data[i]);
        }
      }
      cb(null);
    });
  },

  function(cb) {
    if (!program.maintenance) {
      return cb(null);
    }
    console.log("add creation date to title (if doesn't exist)");
    t.get("/1/lists/" + backlog_personal_backlog.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (!card_has_date(data[i]) && !card_has_periodic(data[i])) {
          addDateToName(data[i]);
        }
      }
      cb(null);
    });
  },

  function(cb) {
    if (!program.today) {
      return cb(null);
    }
    console.log("move items from Inbox to backlog based on label color");
    t.get("/1/lists/" + inbox.id + "/cards", function(err, data) {
      if (err) return cb(err);

      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        var board = null, list = null;
        if (card_has_label(data[i], periodic_label)) {
          // console.log("would move periodic");
          movePeriodic(data[i]);
        } else if (card_has_label(data[i],personal_label)) {
          // console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],process_label)) {
          // console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],work_label)) {
          // console.log("move to Backlog (work)/Backlog");
          board = backlog_work;
          list = backlog_work_backlog;
        }
        if (board && list) {
          would_move_to_list(data[i].name, board, list);
          cardops.push(moveCard(data[i], board, list, 'top'));
        }
      }
      cb(null);
    });
  },
  function(cb) {
    if (!program.today) {
      return cb(null);
    }
    console.log("move items from Today to backlog based on label color");
    t.get("/1/lists/" + today.id + "/cards", function(err, data) {
      if (err) return cb(err);

      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        var board = null, list = null;
        if (card_has_label(data[i], periodic_label)) {
          // console.log("would move periodic");
          movePeriodic(data[i]);

        } else if (card_has_label(data[i],personal_label)) {
          // console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],process_label)) {
          // console.log("move to Backlog (personal)/Backlog");
          board = backlog_personal;
          list = backlog_personal_backlog;
        } else if (card_has_label(data[i],work_label)) {
          // console.log("move to Backlog (work)/Backlog");
          board = backlog_work;
          list = backlog_work_backlog;
        }
        if (board && list) {
          would_move_to_list(data[i].name, board, list);
          cardops.push(moveCard(data[i], board, list, 'top'));
        }
      }
      cb(null);
    });
  },
  function(cb) {
    if (!program.weeklyReview) {
      return cb(null);
    }
    console.log("copy periodic items from Done to periodic board lists");
    t.get("/1/lists/" + done.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], periodic_label)) {
          console.log("would copy periodic");
          copyBackPeriodic(data[i]);
        }
      }
      cb(null);
    });
  },
  function(cb) {
    if (!program.weeklyReview) {
      return cb(null);
    }
    console.log("move all items from Done to history list");
    t.get("/1/lists/" + done.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
          // console.log("would move to history");
          would_move_to_list(data[i].name, history_board, history_this_week);
          cardops.push(moveCard(data[i], history_board,
                       history_this_week, "bottom"));
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.cherryPick) {
      return cb(null);
    }
    console.log("move all cherry picked items from Personal backlog to Kanban Today");
    t.get("/1/lists/" + backlog_personal_backlog.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], cherry_pick_label)) {
          would_move_to_list(data[i].name, daily, today);
          cardops.push(moveCardAndRemoveLabel(data[i], daily, today,
                                              "bottom", cherry_pick_label));
        }
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.cherryPick) {
      return cb(null);
    }
    console.log("move all cherry picked items from Work backlog to Kanban Today");
    t.get("/1/lists/" + backlog_work_backlog.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], cherry_pick_label)) {
          would_move_to_list(data[i].name, daily, today);
          cardops.push(moveCardAndRemoveLabel(data[i], daily, today,
                                              "bottom", cherry_pick_label));
        }
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.cherryPick) {
      return cb(null);
    }
    console.log("move all cherry picked items from Periodic often to Kanban Today");
    t.get("/1/lists/" + periodic_often.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], cherry_pick_label)) {
          would_move_to_list(data[i].name, daily, today);
          cardops.push(moveCardAndRemoveLabel(data[i], daily, today,
                                              "bottom", cherry_pick_label));
        }
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.cherryPick) {
      return cb(null);
    }
    console.log("move all cherry picked items from Periodic weekly to Kanban Today");
    t.get("/1/lists/" + periodic_weekly.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], cherry_pick_label)) {
          would_move_to_list(data[i].name, daily, today);
          cardops.push(moveCardAndRemoveLabel(data[i], daily, today,
                                              "bottom", cherry_pick_label));
        }
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.cherryPick) {
      return cb(null);
    }
    console.log("move all cherry picked items from Periodic bi-weekly/monthly to Kanban Today");
    t.get("/1/lists/" + periodic_biweekmonthly.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], cherry_pick_label)) {
          would_move_to_list(data[i].name, daily, today);
          cardops.push(moveCardAndRemoveLabel(data[i], daily, today,
                                              "bottom", cherry_pick_label));
        }
      }
      cb(null);
    });

  },
  function(cb) {
    if (!program.cherryPick) {
      return cb(null);
    }
    console.log("move all cherry picked items from Periodic quarterly/yearly to Kanban Today");
    t.get("/1/lists/" + periodic_quarteryearly.id + "/cards", function(err, data) {
      if (err) return cb(err);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], cherry_pick_label)) {
          would_move_to_list(data[i].name, daily, today);
          cardops.push(moveCardAndRemoveLabel(data[i], daily, today,
                                              "bottom", cherry_pick_label));
        }
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
    cb(null);
  },
  // execute any operations that have been queued up.
  function(cb) {
    if (cardops.length > 0) {
      async.series(cardops);
      cb(null);
    }
  }
]);
