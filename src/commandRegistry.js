class Command {
    constructor([...commands], [...args], func, helpText = undefined) {
        this.commands = commands;
        this.args = args;
        this.callback = func;
        this.helpText = helpText;
    }

    setHelp(content) {
        this.helpText = content;
    }

    getAliases() {
        return this.commands;
    }
}

class CommandRegistry {

    constructor() {
        this.registry = new Map();
    }  

    registerCommands([...commands], func) {
        registerCommand(new Command(commands), func);
        [...commands].forEach(cmd => {
            console.log("registering alias " + cmd);
            
        });
    }
    
    /**
     * 
     * @param {Command} command 
     * @param {*} func 
     */
    registerCommand(command, func) {
        this.registry.set(command.toString().toLowerCase(), func);
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