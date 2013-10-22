"use strict";
/*
 * BEGIN NPM CHECKS
 */
if (typeof Npm === 'undefined')
  throw new Error('collectionFS: Please update Meteor');

if (!Npm.bundleRoot) {
  var path = Npm.require('path');
  _.extend(Npm, {
    bundleRoot: (process && process.mainModule &&
            process.mainModule.filename) ?
            path.join(process.mainModule.filename, '..') : ''
  });
}

if (!Npm.bundleRoot)
  throw new Error('Cannot find bundle root directory');
/*
 * END NPM CHECKS
 */

var connect = Npm.require('connect');
var fs = Npm.require('fs');
var path = Npm.require('path');

/*
 * BEGIN CONFIGURATION
 */
__meteor_runtime_config__.FILEHANDLER_SUPPORTED = false;

// Filesystem configuration
var fsConfig = {
  folder: 'cfs', // Main folder to place filehandler folders in
  serverPath: '', // Auto
  bundlePath: '', // Auto
  url: '', // Auto
  rootDir: '', // Auto
  bundleStaticPath: '', // Auto
  bundleRoot: '', // Auto
  created: false // Auto
};

fsConfig.url = '/' + fsConfig.folder;
fsConfig.bundleRoot = Npm.bundleRoot;
fsConfig.rootDir = path.join(fsConfig.bundleRoot, '..') + path.sep;
fsConfig.bundleStaticPath = path.join(fsConfig.bundleRoot, 'static');
fsConfig.serverPath = path.join(fsConfig.rootDir, fsConfig.folder);

// Check if the bundle static folder exists, if not then create Issue #40
if (!fs.existsSync(fsConfig.bundleStaticPath)) {
  fs.mkdirSync(fsConfig.bundleStaticPath);
}

// Check if server path exists, if not then create
if (!fs.existsSync(fsConfig.serverPath)) {
  fs.mkdirSync(fsConfig.serverPath);
}

fsConfig.created = (!!fs.existsSync(fsConfig.bundleStaticPath));

__meteor_runtime_config__.FILEHANDLER_SUPPORTED = fs.existsSync(fsConfig.serverPath);

/*
 * END CONFIGURATION
 */

//extend FileObject with FileSystem-specific methods
if (typeof FileObject !== "undefined") {
  FileObject.prototype.putFilesystem = function(options) {
    var self = this;
    options = _.extend({
      subfolder: "default"
    }, options);

    var serverFilename = getFileSystemDestination(self.filename, options);
    fs.writeFileSync(serverFilename, self.buffer);

    if (!fs.existsSync(serverFilename)) {
      return false;
    }

    //return all info needed to retrieve or delete
    return {
      filePath: serverFilename
    };
  };
}

//register storage adaptor
CollectionFS.registerStorageAdaptor("filesystem", {
  put: function(name, config, fileObject) {
    return fileObject.putFilesystem(config);
  },
  get: function(name, config, info) {
    return fs.readFileSync(info.filePath);
  },
  getBytes: function(name, config, info, length, position) {
    var buffer = new Buffer(length);
    var fd = fs.openSync(info.filePath, 'r'); //open file for reading
    fs.readSync(fd, buffer, 0, length, position); //read bytes
    fs.closeSync(fd);

    var bytes = EJSON.newBinary(buffer.length);
    for (var i = 0; i < buffer.length; i++) {
      bytes[i] = buffer[i];
    }

    return bytes;
  },
  del: function(name, config, info) {
    if (fs.existsSync(info.filePath)) {
      fs.unlinkSync(info.filePath);
    }
    return fs.existsSync(info.filePath);
  }
});

var sanitizeFilename = function(filename) {
  return filename.replace(/\//g, '').replace(/\.\.+/g, '.');
};

var getFileSystemDestination = function(filename, options) {
  filename = sanitizeFilename(filename);
  var serverPath = path.join(fsConfig.serverPath, options.subfolder); // Server path

  if (!fs.existsSync(serverPath)) {
    fs.mkdirSync(serverPath);
  }

  if (!fs.existsSync(serverPath))
    throw new Error("could not create serverPath");

  var myFilename = Meteor.uuid() + path.extname(filename);
  return path.join(serverPath, myFilename);
};