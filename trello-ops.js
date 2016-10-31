var Trello = require("node-trello");
var dateFormat = require('dateformat');
var async = require('async');

// to get auth token
var t = new Trello(process.env.appkey, process.env.authtoken);
var cardops = [];

var dryRun = true;
var cherry_pick_label = 'orange';

var boards = {
  daily: null,
  backlog_personal: null,
  backlog_work: null,
  history_board: null,
  periodic_board: null,
  someday: null
};
var lists = {
  inbox: null,
  today: null,
  done: null,
  weekly_goals: null,
  monthly_goals: null,
  monthly_sprints: null,
  backlog: {
    work_backlog: null,
    personal_backlog: null,
  },
  periodic: {
    often: null,
    weekly: null,
    biweekmonthly: null,
    quarteryearly: null,
  }
};
// var daily, backlog_personal, backlog_work;

exports.boards = boards;
exports.lists = lists;

var history_this_week, history_this_week_goals;
var history_this_month_goals, history_this_month_sprints;
var periodic_often, periodic_weekly, periodic_biweekmonthly;
var periodic_quarteryearly;

exports.maintenance = function(cb) {
  async.series([
    function(cb) {
      console.log("add creation date to title (if doesn't exist)");
      t.get("/1/lists/" + lists.inbox.id + "/cards", function(err, data) {
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
      console.log("add creation date to title (if doesn't exist)");
      t.get("/1/lists/" + lists.today.id + "/cards", function(err, data) {
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
      console.log("add creation date to title (if doesn't exist)");
      t.get("/1/lists/" + lists.backlog.personal_backlog.id + "/cards", function(err, data) {
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

    // cherry pick
    function(cb) {
      console.log("move all cherry picked items from Personal backlog to Kanban Today");
      t.get("/1/lists/" + lists.backlog.personal_backlog.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            if (dryRun) {
              would_move_to_list(data[i].name, boards.daily, lists.today);
            }
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.today,
                                                "bottom", cherry_pick_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Work backlog to Kanban Today");
      t.get("/1/lists/" + lists.backlog.personal_backlog.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            if (dryRun) {
              would_move_to_list(data[i].name, boards.daily, lists.today);
            }
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.today,
                                                "bottom", cherry_pick_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Periodic often to Kanban Today");
      t.get("/1/lists/" + lists.periodic.often.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            if (dryRun) {
              would_move_to_list(data[i].name, boards.daily, lists.today);
            }
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.today,
                                                "bottom", cherry_pick_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Periodic weekly to Kanban Today");
      t.get("/1/lists/" + lists.periodic.weekly.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            if (dryRun) {
              would_move_to_list(data[i].name, boards.daily, lists.today);
            }
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.today,
                                                "bottom", cherry_pick_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Periodic bi-weekly/monthly to Kanban Today");
      t.get("/1/lists/" + lists.periodic.biweekmonthly.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            if (dryRun) {
              would_move_to_list(data[i].name, boards.daily, lists.today);
            }
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.today,
                                                "bottom", cherry_pick_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Periodic quarterly/yearly to Kanban Today");
      t.get("/1/lists/" + lists.periodic.quarteryearly.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            if (dryRun) {
              would_move_to_list(data[i].name, boards.daily, lists.today);
            }
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.today,
                                                "bottom", cherry_pick_label));
          }
        }
        cb(null);
      });

    },

  ], cb);
}

exports.init = function(_dryRun, cb) {
  dryRun = _dryRun;
  async.series([
    // get board info
    function(cb) {
      console.log("Get boards");
      t.get("/1/members/me/boards", function(err, data) {
        if (err) return cb(err);
        var i;
        for (i = 0; i < data.length; i++) {
          // console.log(data[i].name);
          if (data[i].name == 'Kanban daily/weekly') {
            boards.daily = data[i];
          } else if (data[i].name == 'Backlog (Personal)') {
            boards.backlog_personal = data[i];
            // console.log(data[i]);
          } else if (data[i].name == 'Backlog (work)') {
            boards.backlog_work = data[i];
          } else if (data[i].name == 'History 2016') {
            boards.history_board = data[i];
          } else if (data[i].name == 'Periodic board') {
            boards.periodic_board = data[i];
          } else if (data[i].name == 'Someday/Maybe') {
            boards.someday = data[i];
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
      t.get("/1/boards/" + boards.daily.id  + "/lists", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          if (data[i].name == 'Inbox') {
            lists.inbox = data[i];
          } else if (data[i].name == 'Today') {
            lists.today = data[i];
          } else if (data[i].name == 'Done this week') {
            lists.done = data[i];
          } else if (data[i].name == 'Weekly Goals') {
            lists.weekly_goals = data[i];
          } else if (data[i].name == 'Monthly Goals') {
            lists.monthly_goals = data[i];
          } else if (data[i].name == 'Monthly Sprints') {
            lists.monthly_sprints = data[i];
          // } else {
          //   console.log(data[i]);
          }
        }
        cb(null);
      });
    },
    function(cb) {
      console.log("Get lists from Backlog(personal)");
      t.get("/1/boards/" + boards.backlog_personal.id  + "/lists", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          if (data[i].name == 'Backlog') {
            lists.backlog.personal_backlog = data[i];
          }
        }
        cb(null);
      });
    },
    function(cb) {
      console.log("Get lists from Backlog(work)");
      t.get("/1/boards/" + boards.backlog_work.id  + "/lists", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          if (data[i].name == 'Backlog') {
            lists.backlog.work_backlog = data[i];
          }
        }
        cb(null);
      });
    },
    function(cb) {
      console.log("Get lists from periodic board");
      // console.log(daily);
      // console.log(daily.id);
      t.get("/1/boards/" + boards.periodic_board.id  + "/lists", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          if (data[i].name == 'Often') {
            lists.periodic.often = data[i];
          } else if (data[i].name == 'Weekly') {
            lists.periodic.weekly = data[i];
          } else if (data[i].name == 'Bi-weekly to monthly') {
            lists.periodic.biweekmonthly = data[i];
          } else if (data[i].name == 'Quarterly to Yearly') {
            lists.periodic.quarteryearly = data[i];
          // } else {
          //  console.log(data[i]);
          }
        }
        cb(null);
      });
    },
  ], cb);
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

var updateCardName = function(card) {
  var todo = function(cb) {
    var options = {"value": card.name };
    t.put("/1/cards/" + card.id + '/name', options, function(err, data) {
      if (err) return cb(err);
      console.log("updated name to " + card.name);
      cb(null);
    });
  }
  return todo;
}

var addDateToName = function(card) {
  var dt = new Date(card.dateLastActivity);
  var dts = dateFormat(dt, "(yyyy-mm-dd)");
  if (dryRun) {
    console.log("would add " + dts + " to " + card.name);
  } else {
    console.log("adding " + dts + " to " + card.name);
    card.name = card.name + " " + dts;
    cardops.push(updateCardName(card));
  }
}
var removeLabel = function(card, labelname) {
  var todo = function(next) {
    if (dryRun) {
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

    if (dryRun) {
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

exports.commit = function(cb) {
  if (cardops.length > 0) {
    async.series(cardops, function(err) {
      cardops = [];
      cb(null);
    });
  } else {
    cb(null);
  }
}
