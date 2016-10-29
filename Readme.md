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
      -c, --cherry-pick     move cards labeled 'orange' from lists into Today
      -m, --maintenance     Periodically, add creation dates to titles, etc.
      --history [WW Month]  History list to move Done list to

### In the morning or end of day
    $ node index.js -t

### After the weekly review
    $ node index.js -w --history "37 September"

## Notable mentions
- Butlerbot does this using trello cards as a conversational API https://trello.com/b/2dLsEE9t/butler-for-trello 
  and has a command builder https://butlerfortrello.com/builder.html   I will use this for the orange label
  cherry picking interaction.

## License

MIT
