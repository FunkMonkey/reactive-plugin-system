const gulp = require( "gulp" );
const typedoc = require( "gulp-typedoc" );

const onError = require( "../utils" ).onError;

const SRC_GLOB =  "./src/**/*.ts";


gulp.task( "build:docs", function() {
  return gulp.src( SRC_GLOB )
    .pipe( typedoc({
      tsconfig: './tsconfig.json',
      out: './build-docs'
    }) )
    .on( "error", onError )
    .pipe( gulp.dest( "build" ) );
});

gulp.tasks[ "build:docs" ].SRC_GLOB = SRC_GLOB;
