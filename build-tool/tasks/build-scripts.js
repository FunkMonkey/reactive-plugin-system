const gulp = require( "gulp" );
const typescript = require( "gulp-typescript" );

const onError = require( "../utils" ).onError;

// const sourcemaps = require( "gulp-sourcemaps" );

const SRC_GLOB =  "./src/**/*.ts";

var tsProject = typescript.createProject({
    //declaration: true,
    noImplicitAny: true
});


gulp.task( "build:scripts", function() {
  return gulp.src( SRC_GLOB )
    //  .pipe( sourcemaps.init() )
    .pipe( tsProject() )
    .on( "error", onError )
    //  .pipe( sourcemaps.write( "." ) )
    .pipe( gulp.dest( "build" ) );
});

gulp.tasks[ "build:scripts" ].SRC_GLOB = SRC_GLOB;
