#!/usr/bin/env node
import { Command } from 'commander';

import { addCommand } from './commands/add.js';
import { loginCommand } from './commands/login.js';
import { lsCommand } from './commands/ls.js';
import { mkdirCommand } from './commands/mkdir.js';
import { mvCommand } from './commands/mv.js';
import { openCommand } from './commands/open.js';
import { restoreCommand } from './commands/restore.js';
import { rmCommand } from './commands/rm.js';
import { searchCommand } from './commands/search.js';
import { trashCommand } from './commands/trash.js';

const program = new Command();

program.name('bkmk').description('Bookmark manager CLI').version('0.0.1');

program.command('login').description('Log in with email and password').action(loginCommand);

program
  .command('add')
  .description('Add a bookmark')
  .argument('<url>', 'URL to bookmark')
  .option('-f, --folder <path>', 'Folder path')
  .option('--json', 'Output as JSON')
  .action(addCommand);

program
  .command('ls')
  .description('List folders and bookmarks')
  .argument('[path]', 'Folder path')
  .option('--deep', 'Recursive listing')
  .option('--json', 'Output as JSON')
  .option('--limit <number>', 'Maximum number of bookmarks to display', parseInt)
  .action(lsCommand);

program
  .command('search')
  .description('Search bookmarks')
  .argument('<keyword>', 'Search keyword')
  .option('--json', 'Output as JSON')
  .action(searchCommand);

program
  .command('mv')
  .description('Move a bookmark or folder')
  .argument('<id>', 'Item ID (UUID)')
  .argument('<path>', 'Destination path')
  .option('--json', 'Output as JSON')
  .action(mvCommand);

program
  .command('mkdir')
  .description('Create a folder')
  .argument('<path>', 'Folder path (e.g. /work/dev)')
  .option('--json', 'Output as JSON')
  .action(mkdirCommand);

program
  .command('rm')
  .description('Delete an item (move to trash, or permanently with --force)')
  .argument('<id>', 'Item ID (UUID)')
  .option('--force', 'Permanently delete from trash')
  .option('--json', 'Output as JSON')
  .action(rmCommand);

program
  .command('trash')
  .description('List items in trash')
  .option('--json', 'Output as JSON')
  .action(trashCommand);

program
  .command('restore')
  .description('Restore an item from trash')
  .argument('<id>', 'Item ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(restoreCommand);

program
  .command('open')
  .description('Open a bookmark in the browser')
  .argument('<id>', 'Bookmark ID (UUID)')
  .option('--json', 'Output as JSON')
  .action(openCommand);

program.parse();
