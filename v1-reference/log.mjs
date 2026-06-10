const isTTY = process.stdout.isTTY;

const c = {
  reset:  isTTY ? '\x1b[0m'  : '',
  bold:   isTTY ? '\x1b[1m'  : '',
  dim:    isTTY ? '\x1b[2m'  : '',
  yellow: isTTY ? '\x1b[33m' : '',
  red:    isTTY ? '\x1b[31m' : '',
};

export const log = {
  info(msg)    { console.log(`  ${msg}`); },
  success(msg) { console.log(`${c.bold}${msg}${c.reset}`); },
  warn(msg)    { console.warn(`${c.yellow}${msg}${c.reset}`); },
  error(msg)   { console.error(`${c.red}${msg}${c.reset}`); },
  header(msg)  { console.log(`\n${c.bold}${msg}${c.reset}`); },
  dim(msg)     { console.log(`${c.dim}  ${msg}${c.reset}`); },
  blank()      { console.log(''); },
};
