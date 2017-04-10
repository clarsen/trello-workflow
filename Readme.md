# trello-workflow.js

## Installation
    $ git clone https://github.com/clarsen/trello-workflow
    $ cd trello-workflow
    $ npm install

Follow instructions in config.js.template to create your own config.js with appropriate keys.

Trello boards should be set up as per expectations of code.


## Examples
    $ node index.js -h

    Usage: index [options]

    Options:

      -h, --help                      output usage information
      -d, --dry-run                   Dry run (don't make changes)
      --weekly-report                 Report on when items were moved into Done list (grouped by day of week)
      -w, --weekly-review [WW Month]  After weekly review cleanup, history list to move Done list to
      -t, --today                     Before starting today (also can be done at end of day)
      -m, --maintenance               Periodically, add creation dates to titles, etc.
      --monthly-review [Month]        After monthly review cleanup
      --watch                         watch boards

### In the morning or end of day
    $ node index.js -t

### After the weekly review
    $ node index.js -w "37 September"

## Notable mentions
- Butlerbot does this using trello cards as a conversational API https://trello.com/b/2dLsEE9t/butler-for-trello
  and has a command builder https://butlerfortrello.com/builder.html   I will use this for the orange label
  cherry picking interaction.

## License

MIT
