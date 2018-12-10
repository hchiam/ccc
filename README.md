# Conversational Code Creator

[![HitCount](http://hits.dwyl.io/hchiam/ccc.svg)](http://hits.dwyl.io/hchiam/ccc)

Live demo: https://codepen.io/hchiam/full/NLVQeo

Conversationally create code with this interactive programming interface. 

You describe a code instruction, and the interface will ask you questions to implement it.

## Ideas

This tool encourages clean code thinking?

Enable higher-order programming?

## Technical Notes

- It uses [compromise.js](https://github.com/spencermountain/compromise) to parse the user input sentence for verbs, nouns, and prepositions.
  - Verbs are treated as function names.
  - Nouns are treated as variables or parameter names.
  - Prepositions are treated as parameter separators (and maybe as a parameter).
- To make it easier to generate and edit the output code (especially nested objects and functions), I'm trying this out:
  - User input gets turned into functions and variables (treated as objects) stored in one big JS object (instead of relying on lines and line numbers).
  - That JS object is used to generate JavaScript code, to be displayed back to the user.
  - Since JS objects support nesting, there can be nesting of functions and variables (all treated as objects.
  - All variables are initialized as JS objects.

## Hello World Example:

**User**: "say something"

**CCC**: "What is the initial value of something?"

**User**: "Hello world!"

This conversation generates this JSON object:

```json
{
  "something": "\"Hello world\"",
  "say": "function(words) { /*uses external library*/responsiveVoice.speak('\"' + words + '\"', 'UK English Male'); }"
}
```

Which generates this JS code:

```js
// VARIABLES and FUNCTIONS:
var something = {};
something = "Hello world";
var say = {};
say = function(words) { /*uses external library*/responsiveVoice.speak('"' + words + '"', 'UK English Male'); };

// USAGE:
this.resetSharedVariables();
say(something);
```

**Note**: All variables and functions are initialized as JSON objects. This makes creating objects easier, especially ones that contain variables and functions, and even other objects!

## Object Creation Example:

**User**: "fox says words"

**CCC**: "What is the initial value of words?"

**User**: "hi"

This conversation generates this JSON object:

```json
{
  "fox": {
    "say": "function(words) { /*uses external library*/responsiveVoice.speak('\"' + words + '\"', 'UK English Male'); }"
  },
  "words": "\"hi\""
}
```

Which generates this JS code:

```js
// VARIABLES and FUNCTIONS:
var fox = {};
fox.say = function(words) { /*uses external library*/responsiveVoice.speak('"' + words + '"', 'UK English Male'); };
var words = {};
words = "hi";

// USAGE:
this.resetSharedVariables();
fox.say(words);
```

### Built-in Things to Try:

Try these:
* "move to a position" (when you're prompted for a value, enter "top"/"bottom"/"middle"/etc., listed in the if block.)
* say something
* "what does the fox say"

### Related Work:

https://github.com/hchiam/code-tutor
