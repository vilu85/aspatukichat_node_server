class Command {
    /**
     * 
     * @param {String} param0 All command words for this action
     * @param {String} param1 Arguments to be passed for the action
     * @param {Function} func Callback
     * @param {String} helpText Help text for this action
     */
    constructor([...param0], [...param1], func, helpText = undefined) {
        this.commands = param0;
        this.args = param1;
        this.callback = func;
        this.helpText = helpText;
    }

    /**
     * 
     * @param {String} content 
     */
    setHelp(content) {
        this.helpText = content;
    }

    /**
     * 
     * @returns {Array<String>} Keywords for this command
     */
    getKeywords() {
        return this.commands;
    }
}

class CommandRegistry {

    constructor() {
        this.registry = new Map();
    }
    
    /**
     * 
     * @param {Command} command 
     * @param {Function} func 
     */
    registerCommand(command, func) {
        this.registry.set(command.toString().toLowerCase(), func);
    }

    registerCommands([...commands], func) {
        this.registerCommand(new Command(commands), func);
        [...commands].forEach(cmd => {
            console.log("registering alias " + cmd);
            
        });
    }
    
    parseCommand(data) {
        data = data.substring(1);
        var cmd = data.split(" ")[0].toLowerCase();
        var args = data.split(" ").slice(1);
        console.log('parsing: data = %s, cmd = %s, args = %s', data, cmd, args);

        if(commandExists(cmd)) {

        }

        if(registry.has(cmd)) {
            var result = registry.get(cmd)(data);
            console.log("result = %s", result);

            if (result != null) {
                replyClient(result);
            }
        }
    }

    /**
     * Checks if given command exists in registry
     * @param {String} cmd command word to check
     * @returns {Boolean} true if command was found
     */
    commandExists(cmd) {
        var registeredCommand = [...this.registry].filter(v => v.getKeywords().filter(v2 => v2 == cmd)[0])[0];
        return registeredCommand != undefined;
    }

    smart_split(input, del, empty_space) {
        if (input.length === 0) return input;
        var outputs = [""];
    
        var compare = function(base, insert, position) {
            if ((position + insert.length) > base.length) return false;
            for (var i = 0; i < insert.length; i++) {
                if (!(base.charAt(position + i) === insert.charAt(i))) return false;
            }
            return true;
        };
    
        var quotes = false;
        for (var i = 0; i < input.length; i++) {
            var char = input.charAt(i);
            if (char === '"') {
                quotes = !quotes;
                continue;
            }
    
            if (!quotes && compare(input, del, i)) {
                outputs.push("");
                i += del.length - 1;
                continue;
            }
    
            outputs[outputs.length - 1] += char;
        }
    
        if (!empty_space) {
            for (var j = 0; j < outputs.length; j++) {
                if (outputs[j] === "") {
                    outputs.splice(j, 1);
                }
            }
        }
    
        return outputs;
    }
}

module.exports = new CommandRegistry();