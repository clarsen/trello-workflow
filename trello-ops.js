var Trello = require("node-trello");
var dateFormat = require('dateformat');
var async = require('async');
var Table = require('cli-table');
var moment = require('moment-timezone');

// to get auth token
var t = new Trello(process.env.appkey, process.env.authtoken);
var cardops = [];

var dryRun = true;
var cherry_pick_label = 'orange';
var personal_label = 'blue';
var process_label = 'green';
var work_label = 'yellow';
var periodic_label = 'purple';
var to_top_label = 'sky';
var to_somedaymaybe_label = 'lime';
var to_done_label = 'pink';

var boards = {
  daily: null,
  backlog_personal: null,
  backlog_work: null,
  history_board: null,
  periodic_board: null,
  someday: null,
  shopping: null,
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
  all_personal_backlog_lists: [],
  periodic: {
    often: null,
    weekly: null,
    biweekmonthly: null,
    quarteryearly: null,
  },
  somedaymaybe: {
    maybe: null,
    productideation: null,
    writing: null,
    appsiwouldlike: null,
    somedayspend: null,
  },
  shopping: {
    needtoget: null,
    purchased: null,
    pantry: null,
    refrigerator: null,
  },
};
// var daily, backlog_personal, backlog_work;

exports.boards = boards;
exports.lists = lists;

var history_this_week, history_this_week_goals;
var history_this_month_goals, history_this_month_sprints;
var periodic_often, periodic_weekly, periodic_biweekmonthly;
var periodic_quarteryearly;

var would_move_summary = new Table({ head: ["", "Items"]});
var move_destination = {};

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

exports.summarize_changes = function() {
console.log("tops.summary");
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

exports.goal_summary = function(cb) {
  tget("/1/lists/" + lists.monthly_goals.id  + "/cards").then(function(data) {
    var checklist_results = [];
    var cards = {}
    var weeksummary = {};

    for (i = 0; i < data.length; i++) {
      // console.log(data[i]);
      cards[data[i].id] = data[i];
      checklist_results.push(tget("/1/cards/" + data[i].id + "/checklists"));
    }
    Promise.all(checklist_results).then(function(checklist_results) {
      console.log("For retrospective:");
      console.log("------------------");
      for (i = 0; i < checklist_results.length; i++) {
        var checklist = checklist_results[i][0];
        // console.log(checklist);
        var card = cards[checklist.idCard];
        var theme = card.name;
        console.log("#### " + theme);
        if (!(theme in weeksummary)) {
          weeksummary[theme] = {}
        }
        for (j = 0; j < checklist.checkItems.length; j++) {
          var goal = checklist.checkItems[j].name
          console.log("- " + goal);
          // match week DD: goal (YYYY-MM-DD) (status)
          // but ignore the YYYY-MM-DD bit
          var matches  = goal.match(/week (\d+): (.*) (?:\(\d\d\d\d-\d\d-\d\d\))(?: (\(.*\)))?/i);
          var week = matches[1];
          var text = matches[2];
          var status = matches[3];
          if (!(week in weeksummary[theme])) {
            weeksummary[theme][week] = [];
          }
          weeksummary[theme][week].push(text + (status ? " " + status : ""));
        }
      }
      console.log("");
      console.log("For plan summary:");
      console.log("-----------------");
      for (var theme in weeksummary) {
        console.log("#### " + theme);
        for (var week in weeksummary[theme]) {
          console.log("- week " + week + ": " + weeksummary[theme][week].join(', '));
        }
      }
      cb(null);
    }).catch(function(error) {
      console.log(error);
      cb(err);
    });
  }).catch(function(error) {
    console.log(error);
    cb(err);
  });
}

exports.preparetoday = function(cb) {
  async.series([
    function(cb) {
      console.log("move items from Inbox to backlog based on label color");
      t.get("/1/lists/" + lists.inbox.id + "/cards", function(err, data) {
        if (err) return cb(err);

        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          var board = null, list = null;
          if (card_has_label(data[i], periodic_label)) {
            // console.log("would move periodic");
            movePeriodic(data[i]);
          } else if (card_has_label(data[i],personal_label)) {
            // console.log("move to Backlog (personal)/Backlog");
            board = boards.backlog_personal;
            list = lists.backlog.personal_backlog;
          } else if (card_has_label(data[i],process_label)) {
            // console.log("move to Backlog (personal)/Backlog");
            board = boards.backlog_personal;
            list = lists.backlog.personal_backlog;
          } else if (card_has_label(data[i],work_label)) {
            // console.log("move to Backlog (work)/Backlog");
            board = boards.backlog_work;
            list = lists.backlog.work_backlog;
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
      console.log("move items from Today to backlog based on label color");
      t.get("/1/lists/" + lists.today.id + "/cards", function(err, data) {
        if (err) return cb(err);

        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          var board = null, list = null;
          if (card_has_label(data[i], periodic_label)) {
            // console.log("would move periodic");
            movePeriodic(data[i]);

          } else if (card_has_label(data[i], personal_label)) {
            // console.log("move to Backlog (personal)/Backlog");
            board = boards.backlog_personal;
            list = lists.backlog.personal_backlog;
          } else if (card_has_label(data[i], process_label)) {
            // console.log("move to Backlog (personal)/Backlog");
            board = boards.backlog_personal;
            list = lists.backlog.personal_backlog;
          } else if (card_has_label(data[i], work_label)) {
            // console.log("move to Backlog (work)/Backlog");
            board = boards.backlog_work;
            list = lists.backlog.work_backlog;
          }
          if (board && list) {
            would_move_to_list(data[i].name, board, list);
            cardops.push(moveCard(data[i], board, list, 'top'));
          }
        }
        cb(null);
      });
    },
  ], cb);
}

exports.maintenance = function(cb) {
  async.series([
    // creation date
    function(cb) {
      exports.add_creation_date_to_title(cb);
    },
    // cherry pick
    function(cb) {
      exports.cherrypick_maint(cb);
    },

    // move to top
    function(cb) {
      console.log("move all to_top items from Personal backlog to top");
      t.get("/1/lists/" + lists.backlog.personal_backlog.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], to_top_label)) {
            would_move_to_list(data[i].name, boards.backlog_personal, lists.backlog.personal_backlog);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.backlog_personal, lists.backlog.personal_backlog,
                                                "top", to_top_label));
          }
        }
        cb(null);
      });

    },

    function(cb) {
      console.log("move all to_top items from Work backlog to top");
      t.get("/1/lists/" + lists.backlog.work_backlog.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], to_top_label)) {
            would_move_to_list(data[i].name, boards.backlog_work, lists.backlog.work_backlog);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.backlog_work, lists.backlog.work_backlog,
                                                "top", to_top_label));
          }
        }
        cb(null);
      });

    },

    // move to someday/maybe
    function(cb) {
      console.log("move all to_somedaymaybe items from Personal backlog to someday/maybe top");
      t.get("/1/lists/" + lists.backlog.personal_backlog.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], to_somedaymaybe_label)) {
            would_move_to_list(data[i].name, boards.someday, lists.somedaymaybe.maybe);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.someday, lists.somedaymaybe.maybe,
                                                "top", to_somedaymaybe_label));
          }
        }
        cb(null);
      });

    },

    // move to done
    function(cb) {
      console.log("move all to_done items from Personal backlog to done bottom");
      t.get("/1/lists/" + lists.backlog.personal_backlog.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], to_done_label)) {
            would_move_to_list(data[i].name, boards.daily, lists.done);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.done,
                                                "bottom", to_done_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all to_done items from Work backlog to done bottom");
      t.get("/1/lists/" + lists.backlog.work_backlog.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], to_done_label)) {
            would_move_to_list(data[i].name, boards.daily, lists.done);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.done,
                                                "bottom", to_done_label));
          }
        }
        cb(null);
      });

    },

    function(cb) {
      console.log("move all someday/maybe items from Inbox to someday/maybe");
      t.get("/1/lists/" + lists.inbox.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_title_starts_with(data[i], "^\\? ")) {
            would_move_to_list(data[i].name, boards.someday, lists.somedaymaybe.maybe);
            cardops.push(moveCardAndTruncateTitle(data[i], boards.someday,
                                                  lists.somedaymaybe.maybe,
                                                  "top", 2));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Shopping purchased to Shopping Need to get");
      t.get("/1/lists/" + lists.shopping.purchased.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            would_move_to_list(data[i].name, boards.shopping, lists.shopping.needtoget);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.shopping, lists.shopping.needtoget,
                                                "top", cherry_pick_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Shopping pantry to Shopping Need to get");
      t.get("/1/lists/" + lists.shopping.pantry.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            would_move_to_list(data[i].name, boards.shopping, lists.shopping.needtoget);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.shopping, lists.shopping.needtoget,
                                                "top", cherry_pick_label));
          }
        }
        cb(null);
      });

    },
    function(cb) {
      console.log("move all cherry picked items from Shopping refrigerator to Shopping Need to get");
      t.get("/1/lists/" + lists.shopping.refrigerator.id + "/cards", function(err, data) {
        if (err) return cb(err);
        for (i = 0; i < data.length; i++) {
          // console.log(data[i]);
          if (card_has_label(data[i], cherry_pick_label)) {
            would_move_to_list(data[i].name, boards.shopping, lists.shopping.needtoget);
            cardops.push(moveCardAndRemoveLabel(data[i], boards.shopping, lists.shopping.needtoget,
                                                "top", cherry_pick_label));
          }
        }
        cb(null);
      });

    },

  ], cb);
}

var tget = function(path) {
  return new Promise(function(resolve, reject) {
    console.log("getting " + path);
    t.get(path, function(err, data) {
      if (err) reject(err);
      console.log("got " + path);
      resolve(data);
    });
  });
}

exports.maybe_history_board_create = function(program, cb) {
  tget("/1/boards/" + boards.history_board.id  + "/lists").then(function(data) {
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
    if (program.weeklyReview && !history_this_week) {
      console.log("couldn't find tasks lists for " + program.weeklyReview
                  + " in history board" );
      cardops.push(create_list(boards.history_board, program.weeklyReview));
    }
    if (program.weeklyReview && !history_this_week_goals) {
      console.log("couldn't find goals lists for " + program.weeklyReview
                  + " in history board" );
      cardops.push(create_list(boards.history_board, program.weeklyReview + " goals"));
    }
    if (program.monthlyReview && !history_this_month_goals) {
      console.log("couldn't find goals lists for " + program.monthlyReview
                  + " in history board" );
      cardops.push(create_list(boards.history_board, program.monthlyReview + " goals"));
    }
    if (program.monthlyReview && !history_this_month_sprints) {
      console.log("couldn't find sprints lists for " + program.monthlyReview
                  + " in history board" );
      cardops.push(create_list(boards.history_board, program.monthlyReview + " sprints"));
    }
    // execute any operations that have been queued up.
    if (cardops.length > 0) {
      var clear_cardops_and_cb = function() {
        cardops = [];
        cb(null);
      }
      async.series(cardops, clear_cardops_and_cb);
    } else {
      cb(null);
    }
  }).catch(function(error) {
    console.log(error);
    cb(error);
  })
}

exports.add_creation_date_to_title = function(cb) {
  console.log("add creation date to title (if doesn't exist)");
  var list_results = [];
  list_results.push(tget("/1/lists/" + lists.inbox.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.today.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.backlog.personal_backlog.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.somedaymaybe.maybe.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.somedaymaybe.productideation.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.somedaymaybe.writing.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.somedaymaybe.appsiwouldlike.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.somedaymaybe.somedayspend.id + "/cards"));

  Promise.all(list_results).then(function(list_results) {
    var j;
    for (j = 0; j < list_results.length; j++) {
      var data = list_results[j];
      // console.log("result is " + data);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (!card_has_date(data[i]) && !card_has_periodic(data[i])) {
          addDateToName(data[i]);
        }
      }
    }
    console.log("..added creation date to titles");
    cb(null);
  }).catch(function(error) {
    console.log(error);
    cb(error);
  });

}


exports.cherrypick_maint = function(cb) {

  // cherry pick
  console.log("move all cherry picked items from all Personal backlog lists to Kanban Today");
  var list_results = [];

  var i;
  for (i = 0; i < lists.all_personal_backlog_lists.length; i++) {
    list_results.push(tget("/1/lists/" + lists.all_personal_backlog_lists[i].id + "/cards"));
  }

  console.log("move all cherry picked items from all Periodic board lists to Kanban Today");
  list_results.push(tget("/1/lists/" + lists.backlog.work_backlog.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.periodic.often.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.periodic.weekly.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.periodic.biweekmonthly.id + "/cards"));
  list_results.push(tget("/1/lists/" + lists.periodic.quarteryearly.id + "/cards"));

  Promise.all(list_results).then(function(list_results) {
    var j;
    for (j = 0; j < list_results.length; j++) {
      var data = list_results[j];
      // console.log("result is " + data);
      for (i = 0; i < data.length; i++) {
        // console.log(data[i]);
        if (card_has_label(data[i], cherry_pick_label)) {
          would_move_to_list(data[i].name, boards.daily, lists.today);
          cardops.push(moveCardAndRemoveLabel(data[i], boards.daily, lists.today,
                                              "bottom", cherry_pick_label));
        }
      }
    }
    console.log("..collected cherry picked items to Kanban Today");
    cb(null);
  }).catch(function(error) {
    console.log(error);
    cb(error);
  });

}

exports.init = function(_dryRun, cb) {
  dryRun = _dryRun;
  console.log("Get boards..");
  tget("/1/members/me/boards").then(function(data) {
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
      } else if (data[i].name == 'History 2017') {
        boards.history_board = data[i];
      } else if (data[i].name == 'Periodic board') {
        boards.periodic_board = data[i];
      } else if (data[i].name == 'Someday/Maybe') {
        boards.someday = data[i];
      } else if (data[i].name == 'Shopping') {
        boards.shopping = data[i];
        // console.log(data[i]);
      // } else if (data[i].name != '') {
        // console.log(data[i]);
      }
    }

    console.log("..Got boards");

    console.log("Get lists from Kanban daily board..");
    var p1 = tget("/1/boards/" + boards.daily.id  + "/lists").then(function(data) {
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
      console.log("..got lists from Kanban daily board");
    });

    console.log("Get lists from Someday/Maybe..");
    var p2 = tget("/1/boards/" + boards.someday.id  + "/lists").then(function(data) {
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Maybe') {
          lists.somedaymaybe.maybe = data[i];
        } else if (data[i].name == 'Product ideation') {
          lists.somedaymaybe.productideation = data[i];
        } else if (data[i].name == 'Writing') {
          lists.somedaymaybe.writing = data[i];
        } else if (data[i].name == 'Apps I would like to write') {
          lists.somedaymaybe.appsiwouldlike = data[i];
        } else if (data[i].name == 'Someday/Maybe (spend $$)') {
          lists.somedaymaybe.somedayspend = data[i];
        }
      }
      console.log("..got lists from Someday/Maybe");
    });

    console.log("Get lists from Backlog(personal)..");
    var p3 = tget("/1/boards/" + boards.backlog_personal.id  + "/lists").then(function(data) {
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Backlog') {
          lists.backlog.personal_backlog = data[i];
        }
        lists.all_personal_backlog_lists.push(data[i]);
      }
      console.log("..got lists from Backlog(personal)");
    });

    console.log("Get lists from Backlog(work)");
    var p4 = tget("/1/boards/" + boards.backlog_work.id  + "/lists").then(function(data) {
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Backlog') {
          lists.backlog.work_backlog = data[i];
        }
      }
      console.log("..got lists from Backlog(work)");
    });

    console.log("Get lists from periodic board");
    var p5 = tget("/1/boards/" + boards.periodic_board.id  + "/lists").then(function(data) {
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
      console.log("..got lists from periodic board");
    });
    console.log("Get lists from Shopping");
    var p6 = tget("/1/boards/" + boards.shopping.id  + "/lists").then(function(data) {
      for (i = 0; i < data.length; i++) {
        if (data[i].name == 'Need to get') {
          lists.shopping.needtoget = data[i];
        } else if (data[i].name == 'Purchased') {
          lists.shopping.purchased = data[i];
        } else if (data[i].name == 'Pantry') {
          lists.shopping.pantry = data[i];
        } else if (data[i].name == 'Refrigerator') {
          lists.shopping.refrigerator = data[i];
        }
      }
      console.log("..got lists from Shopping");
    });

    Promise.all([p1, p2, p3, p4, p5, p6]).then(function(results) {
      console.log("returning");
      cb(null);
    }).catch(function(error) {
      console.log(error);
      cb(err);
    });

  }).catch(function(error) {
    console.log(error);
    cb(err);
  });
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

var card_title_starts_with = function(card, str) {
  if (card.name.search(str) == 0) {
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
  var dts = moment(dt).tz("America/Los_Angeles").format("(YYYY-MM-DD)");
  // var dts = dateFormat(dt, "(yyyy-mm-dd)");
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
              if (err) next(err);
              console.log("removed label " + label.color + " from " + card.name);
              next();
            });
    } else {
      next();
    }
  };
  return todo;
}

var movePeriodic = function(card) {
  var board = boards.periodic_board;
  var list = null;
  if (card.name.includes('(po)')) {
    // console.log("would move " + card.name + " to often list");
    list = lists.periodic.often;
  } else if (card.name.includes('(p1w)')) {
    // console.log("would move " + card.name + " to weekly list");
    list = lists.periodic.weekly;
  } else if (card.name.includes('(p2w)')) {
    // console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = lists.periodic.biweekmonthly;
  } else if (card.name.includes('(p4w)')) {
    // console.log("would move " + card.name + " to bi-weekly/monthly list");
    list = lists.periodic.biweekmonthly;
  } else if (card.name.includes('(p2m)')) {
    list = lists.periodic.quarteryearly;
  } else if (card.name.includes('(p3m)')) {
    list = lists.periodic.quarteryearly;
  } else if (card.name.includes('(p12m)')) {
    list = lists.periodic.quarteryearly;
  }
  if (board && list) {
    would_move_to_list(card.name, board, list);
    cardops.push(moveCard(card, board, list, 'top'));
  }

}

var moveCard = function(card, board, list, pos) {
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
              if (err) next(err);
              console.log("moved " + card.name + " to " + board.name
                          + " list " + list.name);
              next();
          });
  };
  return todo;
};

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
              if (err) next(err);
              console.log("moved " + card.name + " to " + board.name
                          + " list " + list.name);
              // console.log("got " + JSON.stringify(data));
              async.series([ removeLabel(data, label) ]);
              next();
          });
  };
  return todo;
}

var moveCardAndTruncateTitle = function(card, board, list, pos, truncamount) {
  var todo = function(next) {

    var newName = card.name.substring(truncamount);
    console.log("name is now " + newName);
    if (dryRun) {
      // DEBUG: don't execute the PUT
      // console.log("would move " + card.name + " to " + board.name
      //             + " list " + list.name);
      // XXX: this will not get shown because it is executed during the cardops
      // processing which happens after the summary is printed.
      would_move_to_list(newName, board, list);
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
            pos: pos,
            name: newName
          }, function(err,data) {
              if (err) next(err);
              console.log("moved " + newName + " to " + board.name
                          + " list " + list.name);
              next();
          });
  };
  return todo;
}

var create_list = function(board, name) {
  var todo = function(next) {
    if (dryRun) {
      // DEBUG: don't execute the POST
      console.log("would creae list " + name + " in board " + board.name);
      return next();
    }
    t.post("/1/lists",
        {
          name: name,
          idBoard: board.id,
          pos: 'bottom'
        }, function(err, data) {
          if (err) next(err);
          console.log("created " + name);
          next();
        });
  }
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
