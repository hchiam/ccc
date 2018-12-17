var app = new Vue({
  el: '#app',

  data: {
    input: '',
    definitionSection: '',
    usageSection: '',
    code: '',
    timer: null,
    progressBar: document.getElementById("progress"),
    progressTimer: null,
    progress: 0,
    delayToParse: 1500,
    delayToProgress: 100,
    prompt: '',
    runningUnitTests: false,
    definitions: {},
    definitionsDisplayable: {},
    showJSON: false,
    voiceEnabled: true,
    showAnimationScreen: false,
    showPopup: true,
    shape: {
      position: {
        x: 50,
        y: 50
      }
    }
  },

  methods: {

    enterExample: function() {
      this.clearCode();
      // this.input = 'server database gets data source';
      // this.delayedParse();
      this.voiceEnabled = false;
      this.showPopup = false;
      this.input = 'move to the top';
      this.attemptParse();
      this.input = 'top';
      this.attemptParse();
      this.setFocusToInput();
      this.voiceEnabled = true;
      this.showPopup = true;
    },

    clearCode: function() {
      this.input = '';
      this.code = '';
      this.definitionSection = '';
      this.usageSection = '';
      this.prompt = '';
      this.definitions = {};
      this.definitionsDisplayable = {};
      this.setFocusToInput();
    },

    delayedParse: function() {
      if (this.input == '') return;
      // parse
      clearTimeout(this.timer);
      this.timer = setTimeout(this.attemptParse, this.delayToParse);
      // progress bar
      this.progressBar.style.width = '0%';
      clearInterval(this.progressTimer);
      this.progressTimer = setTimeout(this.triggerProgressBar, this.delayToProgress);
      this.resetProgress();
    },

    triggerProgressBar: function() {
      clearInterval(this.progressTimer);
      this.progressTimer = setInterval(this.moveProgress, 10);
    },

    moveProgress: function() {
      if (this.progress >= 100) {
        clearInterval(this.progressTimer);
        this.resetProgress();
      } else {
        this.progress += 1/((this.delayToParse - this.delayToProgress)/1000);
        this.progressBar.style.width = this.progress + '%'; 
      }
    },

    resetProgress: function() {
      this.progress = 0;
      this.progressBar.style.width = '0%';
    },
    
    sanitizeInput: function(string) {
      let notLettersNumbersAndSpaces = /[^\w ]/g;
      return string.replace(notLettersNumbersAndSpaces, '');
    },

    attemptParse: function() {
      if (this.input == '') return;
      this.input = this.sanitizeInput(this.input);
      // account for user responding to prompt
      if (this.prompt) {
        this.parsePromptResponse();
        this.prompt = '';
        return;
      }
      // account for special input
      let isSpecialCase = this.isSpecialCase(this.input);
      if (isSpecialCase) {
        this.handleSpecialCase();
        return;
      }
      // do the actual parsing
      this.parseCode();
      this.checkForUndefinedDefinitions();
      this.addCodeLandmarks();
    },

    parseCode: function() { // (see attemptParse: function())
      let input = this.input;
      let matches = nlp(input).match('(the|a|an|#Adjective)? #Noun+? #Adverb? (#Verb|is) (#Preposition|#Conjunction)? (the|a|an|#Adjective)? (#Noun|#Value)+? .+?').out('array');
      for (let match of matches) {
        // [noun] verb noun
        let noun1 = nlp(match).match('[(the|a|an|#Adjective)? #Noun+] #Adverb? (#Verb|is)').out();
        if (noun1 !== '') {
          this.createVariablesFromChain(noun1);
        }
        noun1 = this.parseName(noun1).trim().replace(/ /g,'.');
        // noun [verb] noun
        let verb = nlp(match).match('(#Verb|is)').out('text').trim();
        let adverb = verb.substr(verb.indexOf(' ')+1);
        verb = nlp(verb.split(' ')[0]).verbs().conjugate()[0].Infinitive;
        // noun verb [noun]
        let noun2group = nlp(nlp(match).match('(#Verb) [.+]').out('text')).match('(#Preposition|#Conjunction)? (the|a|an|#Adjective)? (#Noun|#Value|value|.)+').out('array');
        let noun2groups = [];
        let noun2groupString = '';
        for (let g of noun2group) {
          let isOf = nlp(g).match('[of] .+').out('text');
          let name = this.parseName(g);
          let value = this.parseValue(g);
          if (value !== '') {
            if (noun2groupString == '') {
              noun2groupString = value;
            } else {
              noun2groupString += ',' + value;
            }
            let valueVariableName = 'value' + (noun2groups.length+1);
            // this.createVariablesFromChain(valueVariableName);
            this.definitionsDisplayable[valueVariableName] = value;
            this.definitions[valueVariableName] = value;
            noun2groups.push(valueVariableName);
          } else {
            if (isOf == 'of') {
              noun2groupString = name + '.' + noun2groupString;
            } else if (noun2groupString != '') {
              noun2groupString += ',' + name;
            } else {
              noun2groupString += name;
            }
            this.createVariablesFromChain(g);
            noun2groups.push(name);
          }
        }
        // final output (usage section)
        if (verb == 'is') {
          if (noun1 !== '' && noun2groupString !== '') {
            this.usageSection += noun1 + ' = ' + noun2groupString + ';\n';
          }
        } else {
          if (noun1 !== '') {
            this.usageSection += noun1 + '.' + verb + '(' + noun2groupString + ');\n';
          } else {
            this.usageSection += verb + '(' + noun2groupString + ');\n';
          }
          // final output (function)
          this.createFunctionFromMatch(noun1,verb,noun2groups);
        }
        this.updateCode();
      }
    },

    updateCode: function() {
      this.definitionSection = this.parseDefinitions();
      this.code = '// VARIABLES and FUNCTIONS:\n' + this.definitionSection + '\n' + '// USAGE:\nthis.resetSharedVariables();\n' + this.usageSection;
      this.input = '';
    },

    parseName: function(adjectivesAndNouns) {
      let adjectives = nlp(adjectivesAndNouns).adjectives().out('array');
      let nouns = nlp(adjectivesAndNouns).match('(#Noun|value)').out('array');
      let adjectivesAttached = '';
      for (let i=0; i<adjectives.length; i++) {
        if (i == 0) {
          adjectivesAttached += adjectives[i];
        } else if (i > 0) {
          adjectivesAttached += this.capitalizeFirstLetter(adjectives[i]);
        }
      }
      let nounsAttached = '';
      for (let i=0; i<nouns.length; i++) {
        if (i == 0 && adjectivesAttached !== '') {
          nounsAttached += this.capitalizeFirstLetter(nouns[i]).replace(/ /g,'.');
        } else if (nounsAttached !== '') {
          nounsAttached += '.' + nouns[i].replace(/ /g,'.');
        } else {
          nounsAttached += nouns[i].replace(/ /g,'.');
        }
      }
      return adjectivesAttached + nounsAttached;
    },

    parseValue: function(adjectivesAndNouns) {
      return nlp(adjectivesAndNouns).values().toNumber().out('text');
    },

    capitalizeFirstLetter: function(word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    },

    createVariablesFromChain: function(groupString) {
      let properties = nlp(groupString).match('#Adjective+? #Noun').out('array');
      let parent = this.parseName(properties[0]);
      for (let i=1; i<properties.length; i++) {
        let child = this.parseName(properties[i]);
        let ancestors = '';
        for (let j=1; j<i; j++) {
          ancestors += this.parseName(properties[j]) + '.';
        }
        this.updateDefinitions(parent + '.' + ancestors + child);
      }
      this.updateDefinitions(parent);
    },

    createFunctionFromMatch: function(noun1,verb,noun2groups) {
      let namesArray = noun1.split('.');
      namesArray.push(verb);
      
      let parameters = noun2groups;
      for (let i=0; i<parameters.length; i++) {
        parameters[i] = parameters[i].split('.').pop();
      }
      
      let functionSetup = {
        _isFunction_: true,
        parameters: parameters,
        implementation: {}
      };

      let objectToAddTo = {};
      
      if (!this.isSpecialRecognizedVerb(verb)) {
        objectToAddTo = this.definitions;
        this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, functionSetup);
        // e.g.: this.definitions.server.get() would be performed by: 
        // i.e.: this.definitions[parent][child][verb]();
        objectToAddTo = this.definitionsDisplayable;
        this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, `function ${verb}(${parameters}) {\n  ${JSON.stringify(functionSetup.implementation)}\n}`);
        // TODO: this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, {});
      } else {
        // specially-recognized verbs
        if (verb == 'say') {
          objectToAddTo = this.definitions;
          this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, this.say);
          objectToAddTo = this.definitionsDisplayable;
          this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, "function(words) { /*uses external library*/responsiveVoice.speak('\"' + words + '\"', 'UK English Male'); }");
        } else if (verb == 'move') {
          // NOT this.updateDefinitions('shape.position');
          this.definitions['shape'] = {position:{x:50,y:50}};
          this.definitionsDisplayable['shape'] = {position:{x:50,y:50}};
          objectToAddTo = this.definitions;
          this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, this.move);
          objectToAddTo = this.definitionsDisplayable;
          this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, "function(place) {\n  if (place == 'top') {\n    shape.position = {x:50,y:0};\n  } else if (place == 'bottom') {\n    shape.position = {x:50,y:100};\n  } else if (place == 'middle') {\n    shape.position = {x:50,y:50};\n  } else if (place == 'left') {\n    shape.position = {x:shape.position.x-25,y:shape.position.y};\n  } else if (place == 'right') {\n    shape.position = {x:shape.position.x+25,y:shape.position.y};\n  } else if (place == 'up') {\n    shape.position = {x:shape.position.x,y:shape.position.y-25};\n  } else if (place == 'down') {\n    shape.position = {x:shape.position.x,y:shape.position.y+25};\n  }\n  actuallyMove(shape.position);\n}");
          this.showAnimationScreen = true;
        } else if (verb == 'is') {
          let value = '';
          let isName = nlp(noun2groups).match('#Noun+').found;
          if (isName) {
            value = noun2groups[0].split().join('.').trim();
          } else {
            let attemptedNumber = nlp(noun2groups).values().toNumber().out('text');
            let isNotOmittingOtherWords = nlp(noun2groups).match('!#Value').out() == '';
            if (attemptedNumber != '' && isNotOmittingOtherWords) {
              value = attemptedNumber;
            } else {
              value = '"' + noun2groups.split().join('.').trim() + '"';
            }
          }
          let alreadyHasValue = this.definitions.hasOwnProperty(noun1);
          if (alreadyHasValue) {
            this.usageSection += noun1 + ' = ' + value + ';\n';
          } else {
            this.updateDefinitions(noun1);
            // this.definitions[noun1] = value;
            // this.definitionsDisplayable[noun1] = value;
          }
        }
      }
    },

    updateDefinitions: function(name) { // name = [] or abc.def.ghi
      let isSingleNewNoun = !name.includes('.') && !(this.definitions.hasOwnProperty(name));
      let isEmptyNoun = (name === '');
      if (isSingleNewNoun) {
        this.definitions[name] = {};
        this.definitionsDisplayable[name] = {};
      } else if (isEmptyNoun) {
        // do nothing
      } else { // otherwise is a chain of names, like abc.def.ghi
        let namesArray = name.split('.');
        let objectToAddTo = {};
        objectToAddTo = this.definitions;
        this.updateDefinitionsChain(namesArray, objectToAddTo, 0);
        objectToAddTo = this.definitionsDisplayable;
        this.updateDefinitionsChain(namesArray, objectToAddTo, 0);
      }
    },

    updateDefinitionsChain: function(namesArray, objectToAddTo, index) {
      if (index >= namesArray.length) {
        return;
      }
      let name = namesArray[index];
      if (!(objectToAddTo.hasOwnProperty(name))) {
        objectToAddTo[name] = {};
        this.updateDefinitionsChain(namesArray, objectToAddTo[name], index+1);
      }
    },

    updateDefinitionsChainForMethod: function(namesArray, objectToAddTo, method) {
      this.updateDefinitionsChainForMethodRecursively(namesArray, objectToAddTo, 0, method);
    },

    updateDefinitionsChainForMethodRecursively: function(namesArray, objectToAddTo, index, method) {
      let name = namesArray[index];
      let isVerbWithoutSubjectNoun = (name === '');
      if (isVerbWithoutSubjectNoun) {
        if (namesArray.length > 1) {
          objectToAddTo[namesArray[1]] = method;
          return;
        } else {
          alert('Error: No subject noun and no verb.')
          return;
        }
      }
      if (!(objectToAddTo.hasOwnProperty(name))) {
        if (index < namesArray.length-1) {
          objectToAddTo[name] = {};
        } else {
          objectToAddTo[name] = method;
          return;
        }
      }
      this.updateDefinitionsChainForMethodRecursively(namesArray, objectToAddTo[name], index+1, method);
    },

    parsePromptResponse: function() {
      let response = this.sanitizeInput(this.input);
      let attemptedNumber = nlp(response).values().toNumber().out('text');
      let isNotOmittingOtherWords = nlp(response).match('!#Value').out() == '';
      let isSupposedToBeNull = (response == 'null' || response == 'nothing');
      let isJSON = isJson(response);
      if (attemptedNumber != '' && isNotOmittingOtherWords) {
        response = attemptedNumber;
      } else if (isJSON) {
        // use response;
      } else if (isSupposedToBeNull) {
        response = 'null';
      } else {
        response = '"' + response + '"';
      }
      
      let variableChainString = this.prompt.replace('?','').split(' ').pop();
      // TODO: 
      // let functionStartString = 'What is the implementation of ';
      // let isFunction = this.prompt.substr(0, functionStartString.length) == functionStartString;
      // if (isFunction) {
      //   variableChainString += '.implementation'
      // }
      let variableChainArray = variableChainString.split('.');
      // TODO: 
      // if (isFunction) {
      //   variableChainArray.pop(); // no [implementation] property for displayed definitions
      // }
      this.setLeaf(this.definitionsDisplayable, variableChainArray, response);
      this.updateCode();
      this.prompt = '';
      this.input = '';
    },

    setLeaf: function(definitions, variableChainArray, value) {
      let variableChainArrayNew = variableChainArray.slice();
      let variable = variableChainArrayNew[0];
      if (definitions.hasOwnProperty(variable)) {
        if (this.isEmptyJSON(definitions[variable])) {
          definitions[variable] = value;
        } else {
          variableChainArrayNew.shift();
          this.setLeaf(definitions[variable], variableChainArrayNew, value)
        }
      }
    },

    parseDefinitions: function() {
      // return JSON.stringify(this.definitionsDisplayable, null, 2);
      let definitionSection = '';
      // let d = this.definitions; // TODO: ?
      let d = this.definitionsDisplayable;
      for (let key in d) {
        if (d.hasOwnProperty(key)) {
          if (typeof d[key] == 'object') {
            definitionSection += 'let ' + key + ' = {};\n';
          } else {
            definitionSection += 'let ';
          }
        }
        let nameChain = key;
        // TODO: 
        // if (d.hasOwnProperty(key) && (typeof d[key] == 'object') && ('_isFunction_' in d[key])) {
        //   definitionSection += `function(${d[key].parameters}) {\n  ${'' + d[key].implementation}\n}\n`;
        //   // definitionSection += this.parseDefinitionProperties(d, key, nameChain);
        // } else {
          definitionSection += this.parseDefinitionProperties(d, key, nameChain);
        // }
      }
      return definitionSection;
    },

    parseDefinitionProperties: function(d, k, nameChain) {
      let definition = '';
      if (typeof d[k] == 'object') {
        for (let key in d[k]) {
          let nameChain2 = nameChain + '.' + key;
          if (typeof d[k][key] == 'object') {
            // nested variables
            definition += nameChain2 + ' = {};\n';
            definition += this.parseDefinitionProperties(d[k], key, nameChain2);
          } else {
            // function
            definition += nameChain2 + ' = ' + d[k][key] + ';\n';
          }
        }
      } else {
        // value assigned to variable
        definition += nameChain + ' = ' +  d[k] + ';\n';
      }
      return definition;
    },

    checkForUndefinedDefinitions: function() {
      this.checkUndefined(this.definitions, '');
    },

    checkUndefined: function(definitions, nameChain) {
      if (typeof definitions == 'object') {
        if (this.isEmptyJSON(definitions) && !this.runningUnitTests) {
          // TODO: 
          // let parent = this.getParentAlongNameChain(nameChain);
          // let isFunction = '_isFunction_' in parent;
          // if (isFunction) {
          //   // NOTE: do not add text after the '?'
          //   let nameChainArray = nameChain.split('.');
          //   this.prompt = 'What is the implementation of ' + nameChainArray[nameChainArray.length-2] + '?';
          // } else {
            // NOTE: do not add text after the '?'
            this.prompt = 'What is the initial value of ' + nameChain + '?';
          // }
          this.say(this.prompt);
          // setTimeout so can this.say at the same time
          setTimeout(this.showValuePromptPopup);
          return;
        }
        for (var key in definitions) {
          if (definitions.hasOwnProperty(key)) {
            if (nameChain.length == 0) {
              this.checkUndefined(definitions[key], key);
            } else {
              this.checkUndefined(definitions[key], nameChain + '.' + key);
            }
          }
        }
      }
    },

    getParentAlongNameChain: function(nameChain) {
      let nameChainArray = nameChain.split('.');
      let hasParent = (nameChainArray.length > 1);
      if (!hasParent) return {};
      let parent = this.definitions; // start topmost
      for (let i=0; i<nameChainArray.length-1; i++) {
        parent = parent[nameChainArray[i]];
      }
      return parent;
    },

    showValuePromptPopup: function() {
      let response = this.input;
      if (this.showPopup && this.prompt) {
        response = prompt(this.prompt);
      }
      if (response) {
        this.input = response;
        this.parsePromptResponse();
      }
    },

    showPromptPopup: function() {
      let response = this.input;
      if (this.showPopup && this.prompt) {
        response = prompt(this.prompt);
      }
      if (response) {
        this.input = response;
        this.prompt = '';
        // TODO: 
        // this.parsePromptResponse();
        this.attemptParse();
        this.input = '';
      }
    },

    isEmptyJSON: function(obj) {
      return JSON.stringify(obj) === JSON.stringify({})
    },

    isSpecialRecognizedVerb: function(verb) {
      return (verb == 'say') || (verb == 'move') || (verb == 'is');
    },

    addCodeLandmarks: function() {
      return this.code; // TODO: ? may not need if can just use name chain
      let annotatedCode = this.code;
      let codeLines = annotatedCode.split(/{/);
      annotatedCode = '';
      for (let i=0; i<codeLines.length; i++) {
        if (i < codeLines.length - 1) {
          annotatedCode += codeLines[i] + '{ // ' + i + '\n'; // some incrementing alfa bravo charlie
        } else {
          annotatedCode += codeLines[i];
        }
      }
      this.code = annotatedCode;
    },

    runUnitTests: function() {
      this.runningUnitTests = true;
      // let tempInput = this.input;
      // let tempCode = this.code;
      let inputs = this.getUnitTestInputs();
      let outputs = this.getUnitTestOutputs();
      let allTestsPassed = true;
      for (let i=0; i<inputs.length; i++) {
        this.clearCode();
        allTestsPassed = allTestsPassed && this.testPassed(inputs[i], outputs[i]);
      }
      // restore
      this.clearCode();
      // this.input = tempInput;
      // this.code = tempCode;
      // let user know result
      if (allTestsPassed) {
        console.log('✓');
        alert('All unit tests passed!');
      } else {
        alert('Not all unit tests passed. See console for more info.');
      }
      this.runningUnitTests = false;
      this.setFocusToInput();
    },

    getUnitTestInputs: function() {
      let inputs = [
        'big red dog says big big big woof',
        'dog cat dog says dog cat dog',
        'big red dog cat dog says big big big dog fish dog',
        'big red dog cat dog says big big big dog fish dog fish dog fish dog',
        'the dog really makes a loud sound',
        'apple set banana',
        'apple set as banana',
        'apple set to banana',
        'apple set to banana to coconut',
        'apple set to banana to coconut by car with food',
        'apple set banana to coconut by car with food',
        'Get noun chains.',
        'Get array of noun chains.',
        'Store the list of noun chains.',
        'get the list of chains of nouns',
        'dog is cat',
        'variable is nine thousand',
        'variable is 9000',
        'say words',
        'cat food is fish'
      ];
      return inputs;
    },

    getUnitTestOutputs: function() {
      let outputs = [
        'bigRedDog.say(bigBigBigWoof);',
        'dog.cat.dog.say(dog.cat.dog);',
        'bigRedDog.cat.dog.say(bigBigBigDog.fish.dog);',
        'bigRedDog.cat.dog.say(bigBigBigDog.fish.dog.fish.dog.fish.dog);',
        'dog.make(loudSound);',
        'apple.set(banana);',
        'apple.set(banana);',
        'apple.set(banana);',
        'apple.set(banana,coconut);',
        'apple.set(banana,coconut,car,food);',
        'apple.set(banana,coconut,car,food);',
        'get(noun.chains);',
        'get(noun.chains.array);',
        'store(noun.chains.list);',
        'get(nouns.chains.list);',
        'dog = cat;',
        'variable = 9000;',
        'variable = 9000;',
        'say(words);',
        'cat.food = fish;'
      ];
      return outputs;
    },

    testPassed: function(input, expectedOutput) {
      this.input = input;
      this.attemptParse();
      // if (expectedOutput == this.code) {
      if (expectedOutput + '\n' == this.usageSection) {
        return true;
      } else {
        console.log('INPUT this.input: ' + input + '\n' + 
                    'EXPECTED expectedOutput: ' + expectedOutput + '\n' + 
                    // 'ACTUALLY got this.code: ' + this.code);
                    'ACTUALLY got this.code: ' + this.usageSection);
        return false;
      }
    },

    openInTestMode: function() {
      window.open('https://codepen.io/hchiam/pen/NLVQeo?editors=0011')
    },

    setFocusToInput: function() {
      document.getElementById("input").focus();
    },

    runCode: function() {
      // should limit to client-side use only:
      eval(this.code);
    },

    disableVoice: function() {
      this.voiceEnabled = !this.voiceEnabled;
    },

    say: function(words) {
      if (this.voiceEnabled) {
        // uses external library
        responsiveVoice.speak('"' + words + '"', 'UK English Male');
      }
    },

    move: function(place) {
      // this.shape.position.x = place.x;
      // this.shape.position.y = place.y;
      if (place == 'top') {
        this.shape.position = {x:50,y:0};
      } else if (place == 'bottom') {
        this.shape.position = {x:50,y:100};
      } else if (place == 'middle') {
        this.shape.position = {x:50,y:50};
      } else if (place == 'left') {
        this.shape.position = {x:this.shape.position.x-25,y:this.shape.position.y};
        // this.shape.position.x -= 25;
      } else if (place == 'right') {
        this.shape.position = {x:this.shape.position.x+25,y:this.shape.position.y};
        // this.shape.position.x += 25;
      } else if (place == 'up') {
        this.shape.position = {x:this.shape.position.x,y:this.shape.position.y-25};
        // this.shape.position.y -= 25;
      } else if (place == 'down') {
        this.shape.position = {x:this.shape.position.x,y:this.shape.position.y+25};
        // this.shape.position.y += 25;
      }
      actuallyMove(this.shape.position);
    },

    isSpecialCase: function(input) {
      return input.toLowerCase().replace(/[?,.'"]/g,'') == 'what does the fox say';
    },

    handleSpecialCase: function() {
      this.definitions = {
        fox: {
          say: function() { /*uses external library*/responsiveVoice.speak("Ring-ding-ding-ding-ding-ering-a-ding!", 'UK English Male'); }
        }
      };
      this.definitionsDisplayable = {
        fox: {
          say: `function() { /*uses external library*/responsiveVoice.speak("Ring-ding-ding-ding-ding-ering-a-ding!", 'UK English Male'); }`
        }
      };
      this.usageSection = 'fox.say();'
      this.updateCode();
      this.input = '';
    },

    resetSharedVariables: function() {
      // shared variables
      delay = 0;
      // reset vue variables
      this.move('middle');
    }

  }
});

function isJson(str) {
  // TODO: improve this
  return str[0] == '{' && str[str.length-1] == '}';
}

// shared variable
let delay = 0;

function actuallyMove(where) {
  let shape = document.getElementById("shape");
  if (where && shape) {
    delay += 500;
    setTimeout(function() {
      shape.setAttribute('x', where.x);
      shape.setAttribute('y', where.y);
    }, delay);
  }
}

// perform once on the UI:
$('#input').one('mouseover', function(){
  $('#helper-buttons').slideDown(100);
});