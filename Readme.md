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

      -h, --help            output usage information
      -d, --dry-run         Dry run (don't make changes)
      -w, --weekly-review   After weekly review cleanup
      -t, --today           Before starting today (also can be done at end of day)
      --history [WW Month]  History list to move Done list to

### In the morning or end of day
    $ node index.js -t

### After the weekly review
    $ node index.js -w --history "37 September"

## License

MIT
