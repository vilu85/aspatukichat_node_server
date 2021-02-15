class ComparableVersion {
    /**
     * Constructs comparable version object
     * @param {string} version In format of major.minor.patch
     */
    constructor(version) {
        this.version = version;
        var versionParts = this.version.split('.');
        this.major = versionParts[0];
        this.minor = versionParts[1];
        this.patch = versionParts[2];
    }

    /**
     * 
     * @param {ComparableVersion} version other version to compare with
     */
    isCompatibleWith(version) {
        return this.major >= version.major;
    }

}

class Helpers {

    constructor() {
        
    }  

    /**
     * Compares given version numbers
     * @param {String} serverVersion first to compare
     * @param {String} clientVersion second to compare
     * @returns {Boolean} true if versions are compatible
     */
    checkCompatibility(serverVersion, clientVersion) {
        console.log(serverVersion, clientVersion);
        return new ComparableVersion(serverVersion).isCompatibleWith(new ComparableVersion(clientVersion));
    }
}

exports.myDateTime = function () {
    return Date();
};

module.exports = new Helpers();