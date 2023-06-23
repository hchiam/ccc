# Conversational Code Creator

Live demo: https://codepen.io/hchiam/full/NLVQeo

Conversationally create code with this interactive programming interface.

You describe a code instruction, and the interface will ask you questions to implement it.

**UPDATE:** won't be working on this anymore - see repos like:

- https://github.com/hchiam/learning-gpt4all
- https://github.com/hchiam/learning-prompt-eng

## Ideas

Maybe this tool could enable even higher-level programming?

Encourage clean code thinking? Think in terms of nouns and verbs to create more declarative code?

## Technical Notes

- This project uses [compromise.js](https://github.com/spencermountain/compromise) to parse the user input sentence for verbs, nouns, and prepositions.
  - Verbs are treated as function names.
  - Nouns are treated as variables or parameter names.
  - Prepositions _can_ be treated as parameter separators (or as a parameter when there are no nouns, e.g. the "up" in "move up").
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
let something = "Hello world";
let say = function (words) {
  /*uses external library*/ responsiveVoice.speak(
    '"' + words + '"',
    "UK English Male"
  );
};

// USAGE:
this.resetSharedVariables();
say(something);
```

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
let fox = {};
fox.say = function (words) {
  /*uses external library*/ responsiveVoice.speak(
    '"' + words + '"',
    "UK English Male"
  );
};
let words = "hi";

// USAGE:
this.resetSharedVariables();
fox.say(words);
```

**Note**: Nouns that have associated verbs (and nouns) are initialized as JS objects.

If we continue the conversation with the code above:

**User**: "fox mouth eats food"

**CCC**: "What is the initial value of food?"

**User**: "pests"

This conversation re-generates this updated JSON object:

```json
{
  "fox": {
    "say": "function(words) { /*uses external library*/responsiveVoice.speak('\"' + words + '\"', 'UK English Male'); }",
    "mouth": {
      "eat": "function(food) { alert(food); }"
    }
  },
  "words": "\"hi\"",
  "food": "\"pests\""
}
```

Which re-generates this JS code:

```js
// VARIABLES and FUNCTIONS:
let fox = {};
fox.say = function (words) {
  /*uses external library*/ responsiveVoice.speak(
    '"' + words + '"',
    "UK English Male"
  );
};
fox.mouth = {};
fox.mouth.eat = function (food) {
  alert(food);
};
let words = "hi";
let food = "pests";

// USAGE:
this.resetSharedVariables();
fox.say(words);
fox.mouth.eat(food);
```

### Built-in Things to Try:

Try these:

- "move to a position" (when you're prompted for a value, enter "top"/"bottom"/"middle"/etc., listed in the if block.)
- "say something"
- "what does the fox say"

### Related Work:

https://github.com/hchiam/code-tutor
