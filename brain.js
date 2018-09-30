// // test code for animation:
// var o = {square:{position:{left:0,top:0},size:0,move:function(x,y){o.square.position={left:x,top:y};}}}
// o.square.move(2,3);
// alert(JSON.stringify(o.square.position));

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
    showJSON: false
  },

  methods: {

    enterExample: function() {
      this.clearCode();
      this.input = 'server database gets data source';
      this.delayedParse();
      this.setFocusToInput();
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
      this.timer = setTimeout(this.parse, this.delayToParse);
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

    parse: function() {
      if (this.input == '') return;
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
      let nameChain = '';
      this.checkUndefined(this.definitionsDisplayable, nameChain);
      this.addCodeLandmarks();
    },

    parseCode: function() { // (see parse: function())
      let input = this.input;
      let matches = nlp(input).match('(the|a|an|#Adjective)? #Noun+? #Adverb? #Verb (#Preposition|#Conjunction)? (the|a|an|#Adjective)? (#Noun|#Value)+? .+?').out('array');
      for (let match of matches) {
        // [noun] verb noun
        let noun1 = nlp(match).match('[(the|a|an|#Adjective)? #Noun+] #Adverb? #Verb').out();
        if (noun1 !== '') {
          this.createVariablesFromChain(noun1);
        }
        noun1 = this.parseName(noun1).trim().replace(/ /g,'.');
        // noun [verb] noun
        let verb = nlp(match).match('#Verb').out('text').trim();
        verb = nlp(verb).verbs().conjugate()[0].Infinitive;
        // noun verb [noun]
        let noun2group = nlp(nlp(match).match('#Verb [.+]').out('text')).match('(#Preposition|#Conjunction)? (the|a|an|#Adjective)? (#Noun|#Value)+').out('array');
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
        this.createFunctionFromMatch(noun1,verb,noun2groups);
        // final output
        if (noun1 != '') {
          this.usageSection += noun1 + '.' + verb + '(' + noun2groupString + ');\n';
        } else {
          this.usageSection += verb + '(' + noun2groupString + ');\n';
        }
        this.updateCode();
      }
    },

    updateCode: function() {
      this.definitionSection = this.parseDefinitions();
      this.code = '// VARIABLES and FUNCTIONS:\n' + this.definitionSection + '\n' + '// USAGE:\n' + this.usageSection;
      this.input = '';
    },

    parseName: function(adjectivesAndNouns) {
      let adjectives = nlp(adjectivesAndNouns).adjectives().out('array');
      let nouns = nlp(adjectivesAndNouns).nouns().out('array');
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
      namesArray.push(verb)
      let parameters = noun2groups;
      for (let i=0; i<parameters.length; i++) {
        parameters[i] = parameters[i].split('.').pop();
      }
      let objectToAddTo = {};
      objectToAddTo = this.definitionsDisplayable;
      if (!this.isSpecialRecognizedVerb(verb)) {
        this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, 0, `function(${parameters.join(',')}) { alert(${parameters.join(',')}); }`);
        objectToAddTo = this.definitions;
        this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, 0, function(parameters) { alert(parameters); });
        // e.g.: this.definitions.server.get() would be performed by: 
        // i.e.: this.definitions[parent][child][verb]();
      } else {
        // specially-recognized verbs
        if (verb == 'say') {
          this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, 0, `function(words) { /*uses external library*/responsiveVoice.speak(words, 'UK English Male'); }`);
          objectToAddTo = this.definitions;
          // this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, 0, function(words) { /*uses external library*/responsiveVoice.speak(words, 'UK English Male'); });
          this.updateDefinitionsChainForMethod(namesArray, objectToAddTo, 0, this.say);
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
      if (index >= namesArray.length) return;
      let name = namesArray[index];
      if (!(objectToAddTo.hasOwnProperty(name))) {
        objectToAddTo[name] = {};
        this.updateDefinitionsChain(namesArray, objectToAddTo[name], index+1);
      }
    },

    updateDefinitionsChainForMethod: function(namesArray, objectToAddTo, index, method) {
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
      this.updateDefinitionsChainForMethod(namesArray, objectToAddTo[name], index+1, method);
    },

    parsePromptResponse: function() {
      let response = this.input;
      let attemptedNumber = nlp(response).values().toNumber().out('text');
      let isNotOmittingOtherWords = nlp(response).match('!#Value').out() == '';
      if (attemptedNumber != '' && isNotOmittingOtherWords) {
        response = attemptedNumber;
      } else {
        response = '"' + response + '"';
      }
      let variableChainString = this.prompt.replace('?','').split(' ').pop();
      let variableChainArray = variableChainString.split('.');
      this.setLeaf(this.definitions, variableChainArray, response);
      variableChainArray = variableChainString.split('.');
      this.setLeaf(this.definitionsDisplayable, variableChainArray, response);
      this.updateCode();
      this.prompt = '';
      this.input = '';
    },

    setLeaf: function(definitions, variableChainArray, value) {
      let variable = variableChainArray[0];
      if (definitions.hasOwnProperty(variable)) {
        if (this.isEmptyJSON(definitions[variable])) {
          definitions[variable] = value;
        } else {
          variableChainArray.shift();
          this.setLeaf(definitions[variable], variableChainArray, value)
        }
      }
    },

    parseDefinitions: function() {
      // return JSON.stringify(this.definitionsDisplayable, null, 2);
      let definitionSection = '';
      let d = this.definitionsDisplayable;
      for (let key in d) {
        if (d.hasOwnProperty(key)) {
          definitionSection += 'var ' + key + ' = {};\n';
        }
        let nameChain = key;
        definitionSection += this.parseDefinitionProperties(d, key, nameChain);
      }
      return definitionSection;
    },

    parseDefinitionProperties: function(d, k, nameChain) {
      let definition = '';
      if (typeof d[k] == 'object') {
        for (let key in d[k]) {
          nameChain = nameChain + '.' + key;
          if (typeof d[k][key] == 'object') {
            // nested variables
            definition += nameChain + ' = {};\n';
            definition += this.parseDefinitionProperties(d[k], key, nameChain);
          } else {
            // function
            definition += nameChain + ' = ' + d[k][key] + ';\n';
          }
        }
      } else {
        // value assigned to variable
        definition += nameChain + ' = ' +  d[k] + ';\n';
      }
      return definition;
    },

    checkUndefined: function(definitions, nameChain) {
      if (typeof definitions == 'object') {
        if (this.isEmptyJSON(definitions) && !this.runningUnitTests) {
          // NOTE: do not add text after the '?'
          this.prompt = 'What is the value of ' + nameChain + '?';
          this.say(this.prompt);
          // setTimeout so can this.say at the same time
          setTimeout(this.showPromptPopup);
          return;
        }
        for (var key in definitions) {
          if (definitions.hasOwnProperty(key)) {
            if (nameChain == '') {
              this.checkUndefined(definitions[key], key);
            } else {
              this.checkUndefined(definitions[key], nameChain + '.' + key);
            }
          }
        }
      }
    },

    showPromptPopup: function() {
      let response = prompt(this.prompt);
      if (response) {
        this.input = response;
        this.parsePromptResponse();
      }
    },

    isEmptyJSON: function(obj) {
      return JSON.stringify(obj) === JSON.stringify({})
    },

    isSpecialRecognizedVerb: function(verb) {
      return (verb == 'say');
    },

    addCodeLandmarks: function() {
      return this.code; // TODO
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
        'get the list of chains of nouns'
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
        'get(nouns.chains.list);'
      ];
      return outputs;
    },

    testPassed: function(input, expectedOutput) {
      this.input = input;
      this.parse();
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
      // alert('"Run code" feature coming soon.');
      eval(this.code);
    },

    say: function(words) {
      // uses external library
      responsiveVoice.speak(words, 'UK English Male');
    },

    isSpecialCase: function(input) {
      return input.toLowerCase().replace(/[?,.'"]/g,'') == 'what does the fox say';
    },

    handleSpecialCase: function() {
      this.definitions = {
        fox: {
          say: function() { /*uses external library*/responsiveVoice.speak("Ring-ding-ding-ding-dingeringeding!", 'UK English Male'); }
        }
      };
      this.definitionsDisplayable = {
        fox: {
          say: `function() { /*uses external library*/responsiveVoice.speak("Ring-ding-ding-ding-dingeringeding!", 'UK English Male'); }`
        }
      };
      this.usageSection = 'fox.say();'
      this.updateCode();
      this.input = '';
    }

  }
});
