const path = require( 'path' );
const gulp = require( 'gulp' );
const sourcemaps = require( 'gulp-sourcemaps' );
const typescript = require( 'gulp-typescript' );

function watchTask( task ) {
  const watcher = gulp.watch( [task.SRC_GLOB], { cwd: __dirname }, task);
  watcher.on( 'add', path => { console.log('File ' + path + ' was added, running tasks...'); });
  watcher.on( 'change', path => { console.log('File ' + path + ' was changed, running tasks...'); });
}

// build task
const SRC_GLOB =  './src/**/*.ts';
const DEST = './build';

const CONFIGPATH = path.join( __dirname, 'tsconfig.json' );

const tsProject = typescript.createProject( CONFIGPATH );
tsProject.options.configFilePath = CONFIGPATH; // due to bug in gulp-typescript

const build = () =>
  gulp.src( SRC_GLOB, { cwd: __dirname } )
      .pipe( sourcemaps.init() )
      .pipe( tsProject() )
      .pipe( sourcemaps.write( '.' ) )
      .pipe( gulp.dest( DEST, { cwd: __dirname } ) );

build.displayName = 'build';
build.SRC_GLOB = SRC_GLOB;

// watch:build task
const watchBuild = () => watchTask( build );
watchBuild.displayName = 'watch:build';

// exports
module.exports[build.displayName] = build;
module.exports[watchBuild.displayName] = watchBuild;
