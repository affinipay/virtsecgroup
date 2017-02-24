import del from 'del'
import gulp from 'gulp'
import babel from 'gulp-babel'
import eslint from 'gulp-eslint'
import rename from 'gulp-rename'
import run from 'gulp-run'

const gensrc = './gensrc'
const lib = './lib'
const src = './src'
const examples = './examples'

gulp.task('clean', function() {
  return del([gensrc, lib])
})

gulp.task('nearleyc', function() {
  return gulp.src(src + '/*.ne')
    .pipe(run('node_modules/.bin/nearleyc', { silent: true }))
    .pipe(rename(p => { p.extname = '.js' }))
    .pipe(gulp.dest(gensrc))
})

gulp.task('babel', ['nearleyc'], function() {
  return gulp.src([src + '/*.js', gensrc + '/*.js'])
    .pipe(babel())
    .pipe(gulp.dest(lib))
})

gulp.task('examples', ['babel'], function() {
  return gulp.src([examples + '/*.vsg'])
    .pipe(run(`node ../${lib}/index.js`, { cwd: examples, verbosity: 1 }))
    .pipe(rename(p => { p.extname = '.tf' }))
    .pipe(gulp.dest(examples))
})

gulp.task('lint', function() {
  return gulp.src([`${src}/**/*.js`])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
})

gulp.task('default', ['babel'])
