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
  - User input gets turned into functions and variables (treated as objects) stored in one big JSON object (instead of relying on lines and line numbers).
  - That JSON is used to generate JavaScript code, to be displayed back to the user.
  - Since JSON supports nesting, there can be nesting of functions and variables (all treated as objects).
  - All variables are initialized as JSON objects.

## Examples:

### Hello World:

**User**: "say something"

**CCC**: "What is the initial value of something?"

**User**: "Hello world!"

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