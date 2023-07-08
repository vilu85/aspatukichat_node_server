const gulp = require('gulp');
const terser = require('gulp-terser');
const autoprefixer = require('gulp-autoprefixer');
const csso = require('gulp-csso');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const zip = require('gulp-zip');
const javascriptObfuscator = require('gulp-javascript-obfuscator');
const args = require('yargs').argv;
const VersionAutoPatchPlugin = require("version-auto-patch");

const versionPlugin = new VersionAutoPatchPlugin({
  files: "./package.json",
  type: "patch"
});

var jsSrc = './src/**/*.js';
var cssSrc = './src/**/*.css';
var htmlSrc = './src/**/*.html';

const AUTOPREFIXER_BROWSERS = [
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];

gulp.task('styles', async function () {
  return gulp.src( cssSrc )
                // Auto-prefix css styles for cross browser compatibility
                //.pipe(autoprefixer({browsers: AUTOPREFIXER_BROWSERS}))
                .pipe(autoprefixer())
                // Minify the file
                .pipe(csso())
                // Output
                .pipe(gulp.dest('./build'));
});

gulp.task( 'scripts', async function() {
  return  gulp.src( jsSrc )
                .pipe( terser() )
                .pipe( gulp.dest( './build' ) );
});

// Gulp task to minify HTML files
gulp.task('html', async function() {
  return gulp.src( htmlSrc )
                .pipe(htmlmin({
                  collapseWhitespace: true,
                  removeComments: true
                }))
                .pipe(gulp.dest('./build'));
});

gulp.task('zip', async function () {
  return gulp.src('./src/**')
                .pipe( zip('AspaTukiChatPlugin_node-sources.zip') )
                .pipe(gulp.dest('./dist'));
});

gulp.task('zipBuild', async function () {
  return gulp.src('./build/**')
                .pipe( zip('AspaTukiChatPlugin_node.zip') )
                .pipe(gulp.dest('./dist'));
});

var files = [
  './src/**/*.html',
  './src/**/*.js',
  './src/**/*.css',
  './src/**/*.png',
  './src/**/*.tt',
  './src/**/*.pm',
  './src/**/*.svg'
];
gulp.task('buildSources', async function() {
  return gulp.src(files)
                .pipe(gulp.dest('./build'));
});

gulp.task('obfuscate', async function() {
  return gulp.src( jsSrc )
                .pipe(javascriptObfuscator())
                .pipe(gulp.dest('./build'));
});

gulp.task( 'automate', async function() {
  gulp.watch( [ jsSrc, cssSrc, htmlSrc ], gulp.series('scripts', 'styles', 'html'));
});

gulp.task("update-version", function (cb) {
  versionPlugin
    .updateVersion()
    .then(() => {
      console.log("Version updated");
      cb();
    })
    .catch((err) => {
      console.error("Error updating version:", err);
      cb(err);
    });
});

// Clean output directory
gulp.task('clean', async () => {del(['build']); del(['dist']);});

// Gulp task to minify all files
gulp.task( 'minifyAll', gulp.series('styles','scripts','html'));
 
gulp.task( 'default', gulp.series( 'clean', 'update-version', 'buildSources', 'minifyAll', 'zipBuild'));

gulp.task( 'build', gulp.series( 'buildSources', 'minifyAll', 'zip' ));

gulp.task( 'build source zip', gulp.series( 'update-version', 'zip' ));

gulp.task( 'build minified release', gulp.series( 'clean', 'update-version', 'buildSources', 'minifyAll', 'zipBuild' ));